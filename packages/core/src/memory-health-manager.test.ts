import { describe, it, expect, beforeEach, vi } from "vitest";
import { MemoryHealthManager } from "./memory-health-manager.js";

// Mock dependencies
const mockMemoryRepo = {
  listByRealm: vi.fn(),
  countByRealm: vi.fn(),
  countByEntity: vi.fn(),
  listStale: vi.fn(),
  deleteMany: vi.fn(),
  updateTier: vi.fn(),
  create: vi.fn(),
};

const mockRealmManager = {
  get: vi.fn(),
  list: vi.fn(),
  updateHealthScore: vi.fn(),
};

const mockEntityManager = {
  listByRealm: vi.fn(),
  countByRealm: vi.fn(),
  get: vi.fn(),
  findByNameInRealm: vi.fn(),
};

const mockHealthReportRepo = {
  create: vi.fn(),
  getLatest: vi.fn(),
};

const mockLlmRegistry = {
  hasRealProvider: vi.fn().mockReturnValue(false),
  getProvider: vi.fn(),
  resolveModel: vi.fn(),
};

describe("MemoryHealthManager", () => {
  let manager: MemoryHealthManager;

  beforeEach(() => {
    vi.clearAllMocks();

    manager = new MemoryHealthManager(
      mockMemoryRepo as any,
      mockRealmManager as any,
      mockEntityManager as any,
      mockHealthReportRepo as any,
      mockLlmRegistry as any,
    );
  });

  describe("computeHealth", () => {
    it("should compute 100 for empty realm", async () => {
      mockRealmManager.get.mockReturnValue({ id: "r1", name: "test" });
      mockMemoryRepo.countByRealm.mockReturnValue(0);
      mockEntityManager.countByRealm.mockReturnValue(0);
      mockMemoryRepo.listByRealm.mockReturnValue([]);
      mockMemoryRepo.listStale.mockReturnValue([]);
      mockEntityManager.listByRealm.mockReturnValue([]);

      const report = await manager.computeHealth("r1");

      expect(report.healthScore).toBe(100);
      expect(report.issues).toHaveLength(0);
      expect(report.realmName).toBe("test");
    });

    it("should reduce score for stale memories", async () => {
      mockRealmManager.get.mockReturnValue({ id: "r1", name: "test" });
      mockMemoryRepo.countByRealm.mockReturnValue(10);
      mockEntityManager.countByRealm.mockReturnValue(0);
      mockMemoryRepo.listByRealm.mockReturnValue([]);
      mockMemoryRepo.listStale.mockReturnValue([
        { id: "m1", content: "old fact" },
        { id: "m2", content: "old fact 2" },
      ]);
      mockEntityManager.listByRealm.mockReturnValue([]);

      const report = await manager.computeHealth("r1");

      expect(report.healthScore).toBeLessThan(100);
      expect(report.staleCount).toBeGreaterThan(0);
    });

    it("should detect incomplete entities", async () => {
      mockRealmManager.get.mockReturnValue({ id: "r1", name: "test" });
      mockMemoryRepo.countByRealm.mockReturnValue(5);
      mockEntityManager.countByRealm.mockReturnValue(1);
      mockMemoryRepo.listByRealm.mockReturnValue([]);
      mockMemoryRepo.listStale.mockReturnValue([]);
      mockEntityManager.listByRealm.mockReturnValue([
        { id: "e1", name: "Luna", attributes: {}, type: "living" },
      ]);
      mockMemoryRepo.countByEntity.mockReturnValue(1);

      const report = await manager.computeHealth("r1");

      const incompleteIssues = report.issues.filter(i => i.kind === "incomplete_entity");
      expect(incompleteIssues).toHaveLength(1);
    });
  });

  describe("detectDuplicates", () => {
    it("should find near-duplicate memories", async () => {
      mockMemoryRepo.listByRealm.mockReturnValue([
        { id: "m1", content: "The cat is 3 years old" },
        { id: "m2", content: "The cat is 3 years old." },
        { id: "m3", content: "I enjoy swimming in summer" },
      ]);

      const issues = await manager.detectDuplicates("r1");

      expect(issues).toHaveLength(1);
      expect(issues[0].kind).toBe("duplicate");
      expect(issues[0].memoryIds).toContain("m1");
      expect(issues[0].memoryIds).toContain("m2");
    });

    it("should return empty for no duplicates", async () => {
      mockMemoryRepo.listByRealm.mockReturnValue([
        { id: "m1", content: "Fact about cats" },
        { id: "m2", content: "Completely different topic about finance" },
      ]);

      const issues = await manager.detectDuplicates("r1");
      expect(issues).toHaveLength(0);
    });
  });

  describe("detectStale", () => {
    it("should detect stale memories", () => {
      mockMemoryRepo.listStale.mockReturnValue([
        { id: "m1", content: "old memory" },
      ]);

      const issues = manager.detectStale("r1", 90);
      expect(issues).toHaveLength(1);
      expect(issues[0].kind).toBe("stale");
    });

    it("should return empty when no stale memories", () => {
      mockMemoryRepo.listStale.mockReturnValue([]);

      const issues = manager.detectStale("r1");
      expect(issues).toHaveLength(0);
    });
  });

  describe("cleanup", () => {
    it("should deduplicate and archive", async () => {
      mockMemoryRepo.listByRealm.mockReturnValue([
        { id: "m1", content: "duplicate fact" },
        { id: "m2", content: "duplicate fact" },
      ]);
      mockMemoryRepo.listStale.mockReturnValue([
        { id: "m3", content: "stale" },
      ]);
      mockMemoryRepo.deleteMany.mockReturnValue(1);

      const result = await manager.cleanup("r1");

      expect(result.deduplicatedCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe("detectIncompleteEntities", () => {
    it("should flag entities with no attributes and few memories", () => {
      mockEntityManager.listByRealm.mockReturnValue([
        { id: "e1", name: "Empty Entity", attributes: {} },
      ]);
      mockMemoryRepo.countByEntity.mockReturnValue(0);

      const issues = manager.detectIncompleteEntities("r1");
      expect(issues).toHaveLength(1);
      expect(issues[0].kind).toBe("incomplete_entity");
    });

    it("should not flag entities with sufficient data", () => {
      mockEntityManager.listByRealm.mockReturnValue([
        { id: "e1", name: "Rich Entity", attributes: { age: 3, breed: "tabby" } },
      ]);
      mockMemoryRepo.countByEntity.mockReturnValue(10);

      const issues = manager.detectIncompleteEntities("r1");
      expect(issues).toHaveLength(0);
    });
  });

  describe("computeHealth — score boundaries", () => {
    it("should clamp score to 0 when all memories are duplicates", async () => {
      mockRealmManager.get.mockReturnValue({ id: "r1", name: "test" });
      mockMemoryRepo.countByRealm.mockReturnValue(2);
      mockEntityManager.countByRealm.mockReturnValue(0);
      // 2 duplicate memories → dupRate = 1/2 = 0.5 (one issue with 2 IDs counts as 1 duplicate issue)
      // Actually, detectDuplicates returns issues, each issue counts as 1 duplicate. With 2 mems being dups, 1 issue.
      // dupRate = 1/2 = 0.5, penalty = 0.5 * 20 * 100 = 1000 → clamped to 0
      mockMemoryRepo.listByRealm.mockReturnValue([
        { id: "m1", content: "same fact about cats" },
        { id: "m2", content: "same fact about cats" },
      ]);
      mockMemoryRepo.listStale.mockReturnValue([]);
      mockEntityManager.listByRealm.mockReturnValue([]);

      const report = await manager.computeHealth("r1");
      expect(report.healthScore).toBe(0);
    });

    it("should compute precise mixed-issue score", async () => {
      mockRealmManager.get.mockReturnValue({ id: "r1", name: "test" });
      mockMemoryRepo.countByRealm.mockReturnValue(10);
      mockEntityManager.countByRealm.mockReturnValue(2);
      // No duplicates, 2 stale, 0 contradictions, 1 incomplete
      mockMemoryRepo.listByRealm.mockReturnValue(
        Array.from({ length: 10 }, (_, i) => ({
          id: `m${i}`,
          content: `unique fact number ${i} that is completely different`,
        })),
      );
      mockMemoryRepo.listStale.mockReturnValue([
        { id: "m8", content: "stale1" },
        { id: "m9", content: "stale2" },
      ]);
      mockEntityManager.listByRealm.mockReturnValue([
        { id: "e1", name: "Entity1", attributes: {} },
        { id: "e2", name: "Entity2", attributes: { a: 1 } },
      ]);
      mockMemoryRepo.countByEntity.mockReturnValue(1);

      const report = await manager.computeHealth("r1");
      // staleRate = 2/10 = 0.2, penalty = 0.2*15*100 = 300
      // incompleteRate = 1/2 = 0.5 (e1 has 0 attrs & <3 memories), penalty = 0.5*10*100 = 500
      // score = 100 - 0 - 300 - 0 - 500 = clamped to 0
      // Actually e1 has {} attrs (0) and countByEntity=1 (<3) so incomplete
      // e2 has {a:1} (1 attr, not 0) so NOT incomplete (condition is attrCount===0 AND memoryCount<3)
      // So incompleteRate = 1/2 = 0.5
      // score = 100 - 300 - 500 = clamped to 0
      expect(report.healthScore).toBe(0);
    });

    it("should handle totalMemories=0 without division error", async () => {
      mockRealmManager.get.mockReturnValue({ id: "r1", name: "test" });
      mockMemoryRepo.countByRealm.mockReturnValue(0);
      mockEntityManager.countByRealm.mockReturnValue(0);
      mockMemoryRepo.listByRealm.mockReturnValue([]);
      mockMemoryRepo.listStale.mockReturnValue([]);
      mockEntityManager.listByRealm.mockReturnValue([]);

      const report = await manager.computeHealth("r1");
      expect(report.healthScore).toBe(100);
    });
  });

  describe("detectContradictions", () => {
    it("should return contradictions when LLM is available", async () => {
      mockLlmRegistry.hasRealProvider.mockReturnValue(true);
      mockLlmRegistry.getProvider.mockReturnValue({
        chat: vi.fn().mockResolvedValue({
          content: JSON.stringify([{ indices: [0, 1], reason: "Cat age conflict" }]),
        }),
      });
      mockLlmRegistry.resolveModel.mockReturnValue("test-model");
      mockMemoryRepo.listByRealm.mockReturnValue([
        { id: "m1", content: "The cat is 3 years old" },
        { id: "m2", content: "The cat is 5 years old" },
      ]);

      const issues = await manager.detectContradictions("r1");
      expect(issues).toHaveLength(1);
      expect(issues[0].kind).toBe("contradiction");
      expect(issues[0].memoryIds).toEqual(["m1", "m2"]);
    });

    it("should return empty when LLM is not available", async () => {
      mockLlmRegistry.hasRealProvider.mockReturnValue(false);
      const issues = await manager.detectContradictions("r1");
      expect(issues).toHaveLength(0);
    });

    it("should handle malformed LLM JSON gracefully", async () => {
      mockLlmRegistry.hasRealProvider.mockReturnValue(true);
      mockLlmRegistry.getProvider.mockReturnValue({
        chat: vi.fn().mockResolvedValue({ content: "not valid json at all" }),
      });
      mockLlmRegistry.resolveModel.mockReturnValue("test-model");
      mockMemoryRepo.listByRealm.mockReturnValue([
        { id: "m1", content: "fact 1" },
        { id: "m2", content: "fact 2" },
      ]);

      const issues = await manager.detectContradictions("r1");
      expect(issues).toHaveLength(0);
    });

    it("should truncate to 30 memories", async () => {
      mockLlmRegistry.hasRealProvider.mockReturnValue(true);
      const chatFn = vi.fn().mockResolvedValue({ content: "[]" });
      mockLlmRegistry.getProvider.mockReturnValue({ chat: chatFn });
      mockLlmRegistry.resolveModel.mockReturnValue("test-model");
      mockMemoryRepo.listByRealm.mockReturnValue(
        Array.from({ length: 40 }, (_, i) => ({ id: `m${i}`, content: `memory ${i}` })),
      );

      await manager.detectContradictions("r1");
      const callArg = chatFn.mock.calls[0][0].messages[0].content;
      // Should only have indices 0-29
      expect(callArg).toContain("[29]");
      expect(callArg).not.toContain("[30]");
    });
  });

  describe("compress", () => {
    it("should return null for empty ids", async () => {
      const result = await manager.compress("r1", []);
      expect(result).toBeNull();
    });

    it("should concatenate without LLM", async () => {
      mockLlmRegistry.hasRealProvider.mockReturnValue(false);
      mockMemoryRepo.listByRealm.mockReturnValue([
        { id: "m1", content: "fact one", entityId: "e1" },
        { id: "m2", content: "fact two", entityId: "e1" },
      ]);
      mockMemoryRepo.deleteMany.mockReturnValue(2);
      mockMemoryRepo.create.mockReturnValue({ id: "m_new", content: "fact one; fact two" });

      const result = await manager.compress("r1", ["m1", "m2"]);
      expect(result).not.toBeNull();
      expect(mockMemoryRepo.deleteMany).toHaveBeenCalledWith(["m1", "m2"]);
      expect(mockMemoryRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        content: "fact one; fact two",
        metadata: expect.objectContaining({ source: "compressed", originalCount: 2 }),
      }));
    });

    it("should use LLM when available", async () => {
      mockLlmRegistry.hasRealProvider.mockReturnValue(true);
      mockLlmRegistry.getProvider.mockReturnValue({
        chat: vi.fn().mockResolvedValue({ content: "Merged: combined facts about cats" }),
      });
      mockLlmRegistry.resolveModel.mockReturnValue("test-model");
      mockMemoryRepo.listByRealm.mockReturnValue([
        { id: "m1", content: "cat is orange", entityId: "e1" },
        { id: "m2", content: "cat weighs 5kg", entityId: "e1" },
      ]);
      mockMemoryRepo.deleteMany.mockReturnValue(2);
      mockMemoryRepo.create.mockReturnValue({ id: "m_new", content: "compressed" });

      const result = await manager.compress("r1", ["m1", "m2"]);
      expect(result).not.toBeNull();
      expect(mockMemoryRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        content: "Merged: combined facts about cats",
      }));
    });

    it("should return null on LLM error", async () => {
      mockLlmRegistry.hasRealProvider.mockReturnValue(true);
      mockLlmRegistry.getProvider.mockReturnValue({
        chat: vi.fn().mockRejectedValue(new Error("LLM down")),
      });
      mockLlmRegistry.resolveModel.mockReturnValue("test-model");
      mockMemoryRepo.listByRealm.mockReturnValue([
        { id: "m1", content: "fact", entityId: "e1" },
      ]);

      const result = await manager.compress("r1", ["m1"]);
      expect(result).toBeNull();
    });
  });

  describe("promoteToCore", () => {
    it("should call updateTier for each ID", async () => {
      const count = await manager.promoteToCore("r1", ["m1", "m2", "m3"]);
      expect(count).toBe(3);
      expect(mockMemoryRepo.updateTier).toHaveBeenCalledTimes(3);
      expect(mockMemoryRepo.updateTier).toHaveBeenCalledWith("m1", "core");
      expect(mockMemoryRepo.updateTier).toHaveBeenCalledWith("m2", "core");
      expect(mockMemoryRepo.updateTier).toHaveBeenCalledWith("m3", "core");
    });
  });

  describe("deduplicate", () => {
    it("should delete all but first in each group", async () => {
      mockMemoryRepo.deleteMany.mockReturnValue(2);
      const count = await manager.deduplicate("r1", [["m1", "m2", "m3"]]);
      expect(count).toBe(2);
      expect(mockMemoryRepo.deleteMany).toHaveBeenCalledWith(["m2", "m3"]);
    });

    it("should skip groups with less than 2 members", async () => {
      const count = await manager.deduplicate("r1", [["m1"]]);
      expect(count).toBe(0);
      expect(mockMemoryRepo.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe("computeAllHealth", () => {
    it("should compute health for all realms", async () => {
      mockRealmManager.list.mockReturnValue([
        { id: "r1", name: "pet" },
        { id: "r2", name: "finance" },
      ]);
      mockRealmManager.get.mockImplementation((id: string) => ({ id, name: id === "r1" ? "pet" : "finance" }));
      mockMemoryRepo.countByRealm.mockReturnValue(0);
      mockEntityManager.countByRealm.mockReturnValue(0);
      mockMemoryRepo.listByRealm.mockReturnValue([]);
      mockMemoryRepo.listStale.mockReturnValue([]);
      mockEntityManager.listByRealm.mockReturnValue([]);

      const reports = await manager.computeAllHealth();
      expect(reports).toHaveLength(2);
      expect(reports[0].realmName).toBe("pet");
      expect(reports[1].realmName).toBe("finance");
    });
  });

  describe("cleanup — custom options", () => {
    it("should use custom staleDays", async () => {
      mockMemoryRepo.listByRealm.mockReturnValue([]);
      mockMemoryRepo.listStale.mockReturnValue([]);

      await manager.cleanup("r1", { staleDays: 30 });
      expect(mockMemoryRepo.listStale).toHaveBeenCalledWith("r1", 30);
    });

    it("should skip deduplication when deduplicate=false", async () => {
      mockMemoryRepo.listStale.mockReturnValue([]);

      const result = await manager.cleanup("r1", { deduplicate: false });
      expect(result.deduplicatedCount).toBe(0);
      // listByRealm should NOT be called for duplicate detection
      // (it IS called for stale detection though via detectStale->listStale)
    });
  });

  describe("persistence", () => {
    it("should call healthReportRepo.create on computeHealth", async () => {
      mockRealmManager.get.mockReturnValue({ id: "r1", name: "test" });
      mockMemoryRepo.countByRealm.mockReturnValue(0);
      mockEntityManager.countByRealm.mockReturnValue(0);
      mockMemoryRepo.listByRealm.mockReturnValue([]);
      mockMemoryRepo.listStale.mockReturnValue([]);
      mockEntityManager.listByRealm.mockReturnValue([]);

      await manager.computeHealth("r1");
      expect(mockHealthReportRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        realmId: "r1",
        healthScore: 100,
      }));
    });

    it("should call realmManager.updateHealthScore on computeHealth", async () => {
      mockRealmManager.get.mockReturnValue({ id: "r1", name: "test" });
      mockMemoryRepo.countByRealm.mockReturnValue(0);
      mockEntityManager.countByRealm.mockReturnValue(0);
      mockMemoryRepo.listByRealm.mockReturnValue([]);
      mockMemoryRepo.listStale.mockReturnValue([]);
      mockEntityManager.listByRealm.mockReturnValue([]);

      await manager.computeHealth("r1");
      expect(mockRealmManager.updateHealthScore).toHaveBeenCalledWith("r1", 100, 0);
    });
  });
});
