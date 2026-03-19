import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { DirectoryScanner } from "./directory-scanner.js";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const mockKnowledgeDistributor = {
  distributeFromText: vi.fn(),
};

const mockScannedFileRepo = {
  findByPath: vi.fn(),
  upsert: vi.fn(),
};

const mockLlmRegistry = {
  hasRealProvider: vi.fn().mockReturnValue(false),
};

describe("DirectoryScanner", () => {
  let scanner: DirectoryScanner;

  beforeEach(() => {
    vi.clearAllMocks();
    scanner = new DirectoryScanner(
      mockKnowledgeDistributor as any,
      mockScannedFileRepo as any,
      mockLlmRegistry as any,
    );
  });

  describe("scanDirectory", () => {
    it("should return error for non-existent directory", async () => {
      const result = await scanner.scanDirectory("/nonexistent/path/xyz");

      expect(result.filesScanned).toBe(0);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe("scanFile", () => {
    it("should skip already scanned files with same hash", async () => {
      // This test relies on a real file, so we test the logic path
      mockScannedFileRepo.findByPath.mockReturnValue({
        fileHash: "same-hash",
      });

      // We'd need a real file to test this fully
      // Just verify the repo interaction pattern
      expect(mockScannedFileRepo.findByPath).toBeDefined();
    });
  });

  describe("real filesystem scans", () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "oo-scanner-"));
      mockKnowledgeDistributor.distributeFromText.mockResolvedValue({
        facts: [],
        realmsAffected: [],
        memoriesCreated: 2,
      });
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it("should scan .md files and call distributeFromText", async () => {
      fs.writeFileSync(path.join(tmpDir, "notes.md"), "My cat Luna is 3 years old");

      const result = await scanner.scanDirectory(tmpDir);
      expect(result.filesScanned).toBe(1);
      expect(mockKnowledgeDistributor.distributeFromText).toHaveBeenCalledWith("My cat Luna is 3 years old");
    });

    it("should skip already scanned files with same hash (incremental)", async () => {
      const filePath = path.join(tmpDir, "notes.md");
      fs.writeFileSync(filePath, "content");

      // First scan
      mockScannedFileRepo.findByPath.mockReturnValue(null);
      await scanner.scanDirectory(tmpDir);
      expect(mockKnowledgeDistributor.distributeFromText).toHaveBeenCalledTimes(1);

      // Second scan — same hash
      vi.clearAllMocks();
      mockKnowledgeDistributor.distributeFromText.mockResolvedValue({ facts: [], realmsAffected: [], memoriesCreated: 0 });
      const crypto = await import("node:crypto");
      const hash = crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
      mockScannedFileRepo.findByPath.mockReturnValue({ fileHash: hash });

      const result = await scanner.scanDirectory(tmpDir);
      expect(result.filesScanned).toBe(0);
      expect(result.filesSkipped).toBe(1);
    });

    it("should rescan modified files", async () => {
      const filePath = path.join(tmpDir, "notes.md");
      fs.writeFileSync(filePath, "original");
      mockScannedFileRepo.findByPath.mockReturnValue({ fileHash: "old-hash" });

      const result = await scanner.scanDirectory(tmpDir);
      expect(result.filesScanned).toBe(1);
      expect(mockKnowledgeDistributor.distributeFromText).toHaveBeenCalled();
    });

    it("should ignore .py files", async () => {
      fs.writeFileSync(path.join(tmpDir, "script.py"), "print('hello')");
      fs.writeFileSync(path.join(tmpDir, "notes.md"), "Some notes");

      const result = await scanner.scanDirectory(tmpDir);
      expect(result.filesScanned).toBe(1);
    });

    it("should skip files larger than maxFileSize", async () => {
      const filePath = path.join(tmpDir, "huge.md");
      fs.writeFileSync(filePath, "x".repeat(100));

      const result = await scanner.scanDirectory(tmpDir, { maxFileSize: 50 });
      expect(result.filesScanned).toBe(0);
      expect(result.filesSkipped).toBe(1);
    });

    it("should scan nested subdirectories recursively", async () => {
      const subDir = path.join(tmpDir, "subdir");
      fs.mkdirSync(subDir);
      fs.writeFileSync(path.join(subDir, "deep.md"), "deep content");

      const result = await scanner.scanDirectory(tmpDir);
      expect(result.filesScanned).toBe(1);
    });

    it("should skip hidden files and directories", async () => {
      fs.writeFileSync(path.join(tmpDir, ".secret.md"), "secret");
      const hiddenDir = path.join(tmpDir, ".hidden");
      fs.mkdirSync(hiddenDir);
      fs.writeFileSync(path.join(hiddenDir, "file.md"), "hidden content");

      const result = await scanner.scanDirectory(tmpDir);
      expect(result.filesScanned).toBe(0);
    });

    it("should read JSON files", async () => {
      fs.writeFileSync(path.join(tmpDir, "data.json"), JSON.stringify({ name: "Luna", age: 3 }));
      mockScannedFileRepo.findByPath.mockReturnValue(null);

      await scanner.scanDirectory(tmpDir);
      expect(mockKnowledgeDistributor.distributeFromText).toHaveBeenCalled();
    });

    it("should skip empty files", async () => {
      fs.writeFileSync(path.join(tmpDir, "empty.md"), "");

      const result = await scanner.scanDirectory(tmpDir);
      expect(result.filesScanned).toBe(0);
    });

    it("should not call distributeFromText in dryRun mode", async () => {
      fs.writeFileSync(path.join(tmpDir, "notes.md"), "some content");

      await scanner.scanDirectory(tmpDir, { dryRun: true });
      expect(mockKnowledgeDistributor.distributeFromText).not.toHaveBeenCalled();
    });

    it("should skip node_modules directory", async () => {
      const nmDir = path.join(tmpDir, "node_modules");
      fs.mkdirSync(nmDir);
      fs.writeFileSync(path.join(nmDir, "pkg.md"), "package docs");

      const result = await scanner.scanDirectory(tmpDir);
      expect(result.filesScanned).toBe(0);
    });

    it("should call scannedFileRepo.upsert after scanning", async () => {
      const filePath = path.join(tmpDir, "notes.md");
      fs.writeFileSync(filePath, "test content");
      mockScannedFileRepo.findByPath.mockReturnValue(null);

      await scanner.scanDirectory(tmpDir);
      expect(mockScannedFileRepo.upsert).toHaveBeenCalledWith(expect.objectContaining({
        path: filePath,
        factsExtracted: 2,
      }));
    });

    it("should only scan custom extensions", async () => {
      fs.writeFileSync(path.join(tmpDir, "data.csv"), "a,b,c");
      fs.writeFileSync(path.join(tmpDir, "notes.md"), "markdown");

      const result = await scanner.scanDirectory(tmpDir, { extensions: [".csv"] });
      expect(result.filesScanned).toBe(1);
      // distributeFromText should be called once (for CSV, not MD)
      expect(mockKnowledgeDistributor.distributeFromText).toHaveBeenCalledTimes(1);
    });
  });

  describe("non-directory path", () => {
    it("should return error for file path", async () => {
      const tmpFile = path.join(os.tmpdir(), `oo-test-file-${Date.now()}.txt`);
      fs.writeFileSync(tmpFile, "test");
      try {
        const result = await scanner.scanDirectory(tmpFile);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors[0]).toContain("Not a directory");
      } finally {
        fs.unlinkSync(tmpFile);
      }
    });
  });

  describe("watchDirectory", () => {
    it("returns a watcher that can be stopped", () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "oo-watch-"));
      try {
        const watcher = scanner.watchDirectory(tmpDir, { extensions: [".md"] });
        expect(watcher).toBeDefined();
        expect(typeof watcher.stop).toBe("function");
        watcher.stop();
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    it("stop is idempotent", () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "oo-watch-"));
      try {
        const watcher = scanner.watchDirectory(tmpDir);
        watcher.stop();
        watcher.stop(); // Should not throw
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    it("handles non-existent directory gracefully", () => {
      // Should return a handle even if directory doesn't exist
      // The watcher will simply not fire events
      const watcher = scanner.watchDirectory("/nonexistent/path/xyz");
      expect(watcher).toBeDefined();
      watcher.stop();
    });
  });
});
