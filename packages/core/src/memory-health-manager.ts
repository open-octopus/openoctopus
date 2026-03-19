import type { RealmHealthReport, HealthIssue, MemoryEntry } from "@openoctopus/shared";
import { createLogger } from "@openoctopus/shared";
import type { MemoryRepo, HealthReportRepo } from "@openoctopus/storage";
import type { EntityManager } from "./entity-manager.js";
import type { LlmProviderRegistry } from "./llm/provider-registry.js";
import type { RealmManager } from "./realm-manager.js";

const log = createLogger("memory-health");

const DEFAULT_STALE_DAYS = 90;
const LEVENSHTEIN_THRESHOLD = 0.3;

export interface CleanupOptions {
  deduplicate?: boolean;
  archiveStale?: boolean;
  staleDays?: number;
}

export interface CleanupResult {
  deduplicatedCount: number;
  archivedCount: number;
  issuesResolved: number;
}

export class MemoryHealthManager {
  constructor(
    private memoryRepo: MemoryRepo,
    private realmManager: RealmManager,
    private entityManager: EntityManager,
    private healthReportRepo: HealthReportRepo,
    private llmRegistry: LlmProviderRegistry,
  ) {}

  async computeHealth(realmId: string): Promise<RealmHealthReport> {
    const realm = this.realmManager.get(realmId);
    const totalMemories = this.memoryRepo.countByRealm(realmId);
    const entityCount = this.entityManager.countByRealm(realmId);

    const duplicateIssues = await this.detectDuplicates(realmId);
    const staleIssues = this.detectStale(realmId);
    const contradictionIssues = await this.detectContradictions(realmId);
    const incompleteIssues = this.detectIncompleteEntities(realmId);

    const duplicateCount = duplicateIssues.length;
    const staleCount = staleIssues.length;
    const contradictionCount = contradictionIssues.length;
    const incompleteCount = incompleteIssues.length;

    const issues = [
      ...duplicateIssues,
      ...staleIssues,
      ...contradictionIssues,
      ...incompleteIssues,
    ];

    // Health score formula
    const dupRate = totalMemories > 0 ? duplicateCount / totalMemories : 0;
    const staleRate = totalMemories > 0 ? staleCount / totalMemories : 0;
    const incompleteRate = entityCount > 0 ? incompleteCount / entityCount : 0;

    const score = Math.max(
      0,
      Math.min(
        100,
        Math.round(
          100 -
            dupRate * 20 * 100 -
            staleRate * 15 * 100 -
            contradictionCount * 10 -
            incompleteRate * 10 * 100,
        ),
      ),
    );

    const report: RealmHealthReport = {
      realmId,
      realmName: realm.name,
      healthScore: score,
      memoryCount: totalMemories,
      entityCount,
      duplicateCount,
      staleCount,
      contradictionCount,
      issues,
      computedAt: new Date().toISOString(),
    };

    // Persist report
    this.healthReportRepo.create({
      realmId,
      healthScore: score,
      memoryCount: totalMemories,
      duplicateCount,
      staleCount,
      contradictionCount,
      issues,
    });

    // Update realm health score
    this.realmManager.updateHealthScore(realmId, score, issues.length);

    log.info(`Health computed for ${realm.name}: ${score}/100 (${issues.length} issues)`);
    return report;
  }

  async computeAllHealth(): Promise<RealmHealthReport[]> {
    const realms = this.realmManager.list();
    const reports: RealmHealthReport[] = [];
    for (const realm of realms) {
      const report = await this.computeHealth(realm.id);
      reports.push(report);
    }
    return reports;
  }

  async cleanup(realmId: string, options?: CleanupOptions): Promise<CleanupResult> {
    const opts = {
      deduplicate: options?.deduplicate ?? true,
      archiveStale: options?.archiveStale ?? true,
      staleDays: options?.staleDays ?? DEFAULT_STALE_DAYS,
    };

    let deduplicatedCount = 0;
    let archivedCount = 0;

    if (opts.deduplicate) {
      const dups = await this.detectDuplicates(realmId);
      for (const issue of dups) {
        if (issue.memoryIds.length >= 2) {
          deduplicatedCount += await this.deduplicate(realmId, [issue.memoryIds]);
        }
      }
    }

    if (opts.archiveStale) {
      const staleIssues = this.detectStale(realmId, opts.staleDays);
      const staleIds = staleIssues.flatMap((i) => i.memoryIds);
      if (staleIds.length > 0) {
        archivedCount = this.archiveStale(realmId, staleIds);
      }
    }

    const issuesResolved = deduplicatedCount + archivedCount;
    log.info(`Cleanup for realm ${realmId}: dedup=${deduplicatedCount}, archived=${archivedCount}`);
    return { deduplicatedCount, archivedCount, issuesResolved };
  }

  async detectDuplicates(realmId: string): Promise<HealthIssue[]> {
    const memories = this.memoryRepo.listByRealm(realmId);
    const issues: HealthIssue[] = [];
    const seen = new Set<number>();

    for (let i = 0; i < memories.length; i++) {
      if (seen.has(i)) {
        continue;
      }

      const group: string[] = [memories[i].id];

      for (let j = i + 1; j < memories.length; j++) {
        if (seen.has(j)) {
          continue;
        }

        const dist = normalizedLevenshtein(memories[i].content, memories[j].content);
        if (dist < LEVENSHTEIN_THRESHOLD) {
          group.push(memories[j].id);
          seen.add(j);
        }
      }

      if (group.length > 1) {
        seen.add(i);
        issues.push({
          kind: "duplicate",
          memoryIds: group,
          description: `${group.length} near-duplicate memories found`,
          suggestion: `Merge or remove ${group.length - 1} duplicate(s)`,
        });
      }
    }

    return issues;
  }

  async detectContradictions(realmId: string): Promise<HealthIssue[]> {
    if (!this.llmRegistry.hasRealProvider()) {
      return [];
    }

    const memories = this.memoryRepo.listByRealm(realmId, "archival");
    if (memories.length < 2) {
      return [];
    }

    // Batch memories for LLM check (limit to 30 to control cost)
    const batch = memories.slice(0, 30);
    const memoryList = batch.map((m, i) => `[${i}] ${m.content}`).join("\n");

    try {
      const provider = this.llmRegistry.getProvider();
      const model = this.llmRegistry.resolveModel();

      const result = await provider.chat({
        model,
        messages: [{ role: "user", content: `Memories:\n${memoryList}` }],
        systemPrompt: `Analyze these memories for contradictions. Two memories contradict if they state conflicting facts about the same subject.
Output a JSON array of contradiction pairs: [{"indices": [i, j], "reason": "..."}]
If no contradictions found, output [].`,
        maxTokens: 500,
        temperature: 0,
      });

      const content = result.content.trim();
      const jsonStr = content.startsWith("[")
        ? content
        : content
            .replace(/```json?\n?/g, "")
            .replace(/```/g, "")
            .trim();
      const parsed = JSON.parse(jsonStr) as Array<{ indices: number[]; reason: string }>;

      return parsed
        .filter((c) => Array.isArray(c.indices) && c.indices.length === 2)
        .map((c) => ({
          kind: "contradiction" as const,
          memoryIds: c.indices.filter((i) => i < batch.length).map((i) => batch[i].id),
          description: c.reason,
          suggestion: "Review and resolve conflicting memories",
        }));
    } catch (err) {
      log.warn(
        `Contradiction detection failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return [];
    }
  }

  detectStale(realmId: string, staleDays = DEFAULT_STALE_DAYS): HealthIssue[] {
    const staleMemories = this.memoryRepo.listStale(realmId, staleDays);

    if (staleMemories.length === 0) {
      return [];
    }

    return [
      {
        kind: "stale",
        memoryIds: staleMemories.map((m) => m.id),
        description: `${staleMemories.length} memories older than ${staleDays} days`,
        suggestion: "Archive or refresh stale memories",
      },
    ];
  }

  detectIncompleteEntities(realmId: string): HealthIssue[] {
    const entities = this.entityManager.listByRealm(realmId);
    const issues: HealthIssue[] = [];

    for (const entity of entities) {
      const attrs = entity.attributes;
      const attrCount = Object.keys(attrs).length;
      const memoryCount = this.memoryRepo.countByEntity(entity.id);

      if (attrCount === 0 && memoryCount < 3) {
        issues.push({
          kind: "incomplete_entity",
          memoryIds: [],
          description: `Entity "${entity.name}" has minimal data (${attrCount} attributes, ${memoryCount} memories)`,
          suggestion: `Add more information about ${entity.name} through conversations or /inject`,
        });
      }
    }

    return issues;
  }

  async deduplicate(realmId: string, memoryIdPairs: string[][]): Promise<number> {
    let removed = 0;
    for (const group of memoryIdPairs) {
      if (group.length < 2) {
        continue;
      }
      const toDelete = group.slice(1);
      removed += this.memoryRepo.deleteMany(toDelete);
    }
    return removed;
  }

  archiveStale(realmId: string, memoryIds: string[]): number {
    let archived = 0;
    for (const id of memoryIds) {
      this.memoryRepo.updateTier(id, "archival");
      archived++;
    }
    return archived;
  }

  async promoteToCore(realmId: string, memoryIds: string[]): Promise<number> {
    let promoted = 0;
    for (const id of memoryIds) {
      this.memoryRepo.updateTier(id, "core");
      promoted++;
    }
    return promoted;
  }

  async compress(realmId: string, memoryIds: string[]): Promise<MemoryEntry | null> {
    if (memoryIds.length === 0) {
      return null;
    }

    const memories = memoryIds
      .map((id) => {
        try {
          const all = this.memoryRepo.listByRealm(realmId);
          return all.find((m) => m.id === id);
        } catch {
          return undefined;
        }
      })
      .filter((m): m is MemoryEntry => m !== undefined);

    if (memories.length === 0) {
      return null;
    }

    if (!this.llmRegistry.hasRealProvider()) {
      // Simple concatenation fallback
      const combined = memories.map((m) => m.content).join("; ");
      this.memoryRepo.deleteMany(memoryIds);
      return this.memoryRepo.create({
        realmId,
        entityId: memories[0].entityId,
        tier: "archival",
        content: combined,
        metadata: { source: "compressed", originalCount: memories.length },
      });
    }

    try {
      const provider = this.llmRegistry.getProvider();
      const model = this.llmRegistry.resolveModel();
      const memoryList = memories.map((m) => `- ${m.content}`).join("\n");

      const result = await provider.chat({
        model,
        messages: [{ role: "user", content: `Memories to compress:\n${memoryList}` }],
        systemPrompt:
          "Merge these related memories into a single comprehensive summary. Keep all important facts. Output only the merged text, nothing else.",
        maxTokens: 300,
      });

      this.memoryRepo.deleteMany(memoryIds);
      return this.memoryRepo.create({
        realmId,
        entityId: memories[0].entityId,
        tier: "archival",
        content: result.content.trim(),
        metadata: { source: "compressed", originalCount: memories.length },
      });
    } catch (err) {
      log.warn(`Memory compression failed: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  }
}

/** Normalized Levenshtein distance (0 = identical, 1 = completely different) */
function normalizedLevenshtein(a: string, b: string): number {
  if (a === b) {
    return 0;
  }
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) {
    return 0;
  }

  // For performance, skip very long strings
  if (maxLen > 500) {
    // Use simple character overlap heuristic
    const setA = new Set(a.toLowerCase().split(/\s+/));
    const setB = new Set(b.toLowerCase().split(/\s+/));
    let overlap = 0;
    for (const w of setA) {
      if (setB.has(w)) {
        overlap++;
      }
    }
    const union = new Set([...setA, ...setB]).size;
    return union > 0 ? 1 - overlap / union : 1;
  }

  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0) as number[]);

  for (let i = 0; i <= m; i++) {
    dp[i][0] = i;
  }
  for (let j = 0; j <= n; j++) {
    dp[0][j] = j;
  }

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }

  return dp[m][n] / maxLen;
}
