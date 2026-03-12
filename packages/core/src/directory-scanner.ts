import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { ScanResult } from "@openoctopus/shared";
import { createLogger } from "@openoctopus/shared";
import type { ScannedFileRepo } from "@openoctopus/storage";
import type { KnowledgeDistributor } from "./knowledge-distributor.js";
import type { LlmProviderRegistry } from "./llm/provider-registry.js";

const log = createLogger("directory-scanner");

const DEFAULT_EXTENSIONS = [".md", ".txt", ".json"];
const DEFAULT_MAX_FILE_SIZE = 1024 * 1024; // 1MB

export interface ScanOptions {
  extensions?: string[];
  recursive?: boolean;
  maxFileSize?: number;
  realmId?: string;
  dryRun?: boolean;
}

export interface WatchHandle {
  stop(): void;
}

export interface WatchOptions {
  extensions?: string[];
  debounceMs?: number;
}

interface FileScanResult {
  path: string;
  factsExtracted: number;
  skipped: boolean;
  error?: string;
}

export class DirectoryScanner {
  constructor(
    private knowledgeDistributor: KnowledgeDistributor,
    private scannedFileRepo: ScannedFileRepo,
    private llmRegistry: LlmProviderRegistry,
  ) {}

  async scanDirectory(dirPath: string, options?: ScanOptions): Promise<ScanResult> {
    const opts = {
      extensions: options?.extensions ?? DEFAULT_EXTENSIONS,
      recursive: options?.recursive ?? true,
      maxFileSize: options?.maxFileSize ?? DEFAULT_MAX_FILE_SIZE,
      realmId: options?.realmId,
      dryRun: options?.dryRun ?? false,
    };

    const resolvedPath = path.resolve(dirPath);
    if (!fs.existsSync(resolvedPath)) {
      return {
        filesScanned: 0,
        filesSkipped: 0,
        factsExtracted: 0,
        realmsAffected: [],
        errors: [`Directory not found: ${resolvedPath}`],
      };
    }

    const stat = fs.statSync(resolvedPath);
    if (!stat.isDirectory()) {
      return {
        filesScanned: 0,
        filesSkipped: 0,
        factsExtracted: 0,
        realmsAffected: [],
        errors: [`Not a directory: ${resolvedPath}`],
      };
    }

    const files = this.collectFiles(resolvedPath, opts);

    let filesScanned = 0;
    let filesSkipped = 0;
    let factsExtracted = 0;
    const realmsAffected = new Set<string>();
    const errors: string[] = [];

    for (const filePath of files) {
      const result = await this.scanFile(filePath, opts);

      if (result.skipped) {
        filesSkipped++;
        continue;
      }

      if (result.error) {
        errors.push(result.error);
        filesSkipped++;
        continue;
      }

      filesScanned++;
      factsExtracted += result.factsExtracted;
    }

    log.info(`Scanned ${filesScanned} files, extracted ${factsExtracted} facts, skipped ${filesSkipped}`);

    return {
      filesScanned,
      filesSkipped,
      factsExtracted,
      realmsAffected: [...realmsAffected],
      errors,
    };
  }

  async scanFile(filePath: string, options?: ScanOptions): Promise<FileScanResult> {
    const opts = {
      maxFileSize: options?.maxFileSize ?? DEFAULT_MAX_FILE_SIZE,
      dryRun: options?.dryRun ?? false,
    };

    try {
      const stat = fs.statSync(filePath);
      if (stat.size > opts.maxFileSize) {
        return { path: filePath, factsExtracted: 0, skipped: true, error: `File too large: ${stat.size} bytes` };
      }

      // Check if file has been scanned before and hasn't changed
      const hash = this.computeFileHash(filePath);
      const existing = this.scannedFileRepo.findByPath(filePath);

      if (existing && existing.fileHash === hash) {
        return { path: filePath, factsExtracted: 0, skipped: true };
      }

      // Read file content
      const content = this.readFileContent(filePath);
      if (!content || content.trim().length === 0) {
        return { path: filePath, factsExtracted: 0, skipped: true };
      }

      if (opts.dryRun) {
        return { path: filePath, factsExtracted: 0, skipped: false };
      }

      // Distribute content through KnowledgeDistributor
      const result = await this.knowledgeDistributor.distributeFromText(content);

      // Record scan
      this.scannedFileRepo.upsert({
        path: filePath,
        fileHash: hash,
        factsExtracted: result.memoriesCreated,
      });

      return { path: filePath, factsExtracted: result.memoriesCreated, skipped: false };
    } catch (err) {
      const msg = `Failed to scan ${filePath}: ${err instanceof Error ? err.message : String(err)}`;
      log.warn(msg);
      return { path: filePath, factsExtracted: 0, skipped: true, error: msg };
    }
  }

  /**
   * Watch a directory for file changes and automatically scan modified files.
   * Uses 5-second debounce to batch rapid changes.
   */
  watchDirectory(dirPath: string, options?: WatchOptions): WatchHandle {
    const extensions = options?.extensions ?? DEFAULT_EXTENSIONS;
    const debounceMs = options?.debounceMs ?? 5000;

    const resolvedPath = path.resolve(dirPath);
    const pendingScans = new Map<string, ReturnType<typeof setTimeout>>();

    let closed = false;
    let watcher: ReturnType<typeof fs.watch> | null = null;

    try {
      watcher = fs.watch(
        resolvedPath,
        { recursive: true, persistent: false },
        (eventType, filename) => {
          if (!filename || closed) return;

          // Check extension
          const ext = path.extname(filename).toLowerCase();
          if (!extensions.includes(ext)) return;

          const filePath = path.join(resolvedPath, filename);

          // Debounce: clear any pending scan for this file
          const existing = pendingScans.get(filePath);
          if (existing) clearTimeout(existing);

          // Schedule new scan
          const timer = setTimeout(() => {
            pendingScans.delete(filePath);
            if (closed) return;

            // Scan the file (fire-and-forget)
            this.scanFile(filePath).catch((err) => {
              log.warn(`Watch scan failed for ${filePath}: ${err instanceof Error ? err.message : String(err)}`);
            });
          }, debounceMs);

          pendingScans.set(filePath, timer);
        },
      );

      watcher.on("error", (err) => {
        log.warn(`Directory watcher error: ${err.message}`);
      });

      log.info(`Watching directory: ${resolvedPath}`);
    } catch (err) {
      log.warn(`Failed to watch directory ${resolvedPath}: ${err instanceof Error ? err.message : String(err)}`);
    }

    return {
      stop: () => {
        closed = true;
        // Clear all pending scans
        for (const timer of pendingScans.values()) {
          clearTimeout(timer);
        }
        pendingScans.clear();
        if (watcher) {
          watcher.close();
          watcher = null;
        }
        log.info(`Stopped watching directory: ${resolvedPath}`);
      },
    };
  }

  private collectFiles(dirPath: string, opts: { extensions: string[]; recursive: boolean; maxFileSize: number }): string[] {
    const files: string[] = [];

    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        // Skip hidden files/dirs
        if (entry.name.startsWith(".")) continue;
        // Skip node_modules, etc.
        if (entry.name === "node_modules" || entry.name === "__pycache__") continue;

        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory() && opts.recursive) {
          files.push(...this.collectFiles(fullPath, opts));
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (opts.extensions.includes(ext)) {
            files.push(fullPath);
          }
        }
      }
    } catch (err) {
      log.warn(`Failed to read directory ${dirPath}: ${err instanceof Error ? err.message : String(err)}`);
    }

    return files;
  }

  private computeFileHash(filePath: string): string {
    const content = fs.readFileSync(filePath);
    return crypto.createHash("sha256").update(content).digest("hex");
  }

  private readFileContent(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();

    if (ext === ".json") {
      try {
        const raw = fs.readFileSync(filePath, "utf-8");
        const parsed = JSON.parse(raw);
        // Convert JSON to readable text
        return typeof parsed === "string" ? parsed : JSON.stringify(parsed, null, 2);
      } catch {
        return "";
      }
    }

    // .md, .txt — read as-is
    return fs.readFileSync(filePath, "utf-8");
  }
}
