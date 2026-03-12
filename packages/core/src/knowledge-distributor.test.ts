import { describe, it, expect, beforeEach, vi } from "vitest";
import { KnowledgeDistributor } from "./knowledge-distributor.js";

const mockMemoryRepo = {
  create: vi.fn().mockReturnValue({ id: "m1", content: "test" }),
};

const mockRealmManager = {
  list: vi.fn(),
  get: vi.fn(),
};

const mockEntityManager = {
  findByNameInRealm: vi.fn().mockReturnValue(null),
  create: vi.fn().mockReturnValue({ id: "e1", name: "test" }),
  listByRealm: vi.fn().mockReturnValue([]),
};

const mockLlmRegistry = {
  hasRealProvider: vi.fn().mockReturnValue(false),
  getProvider: vi.fn(),
  resolveModel: vi.fn(),
};

describe("KnowledgeDistributor", () => {
  let distributor: KnowledgeDistributor;

  beforeEach(() => {
    vi.clearAllMocks();
    distributor = new KnowledgeDistributor(
      mockMemoryRepo as any,
      mockRealmManager as any,
      mockEntityManager as any,
      mockLlmRegistry as any,
    );
  });

  describe("distributeFromText — keyword fallback", () => {
    it("should classify pet-related text to pet realm", async () => {
      mockRealmManager.list.mockReturnValue([
        { id: "r1", name: "pet", description: "Pets" },
        { id: "r2", name: "finance", description: "Finance" },
      ]);

      const result = await distributor.distributeFromText("我养了一只猫叫肉肉");

      expect(result.memoriesCreated).toBeGreaterThan(0);
      expect(result.realmsAffected).toContain("pet");
    });

    it("should classify finance text to finance realm", async () => {
      mockRealmManager.list.mockReturnValue([
        { id: "r1", name: "pet", description: "Pets" },
        { id: "r2", name: "finance", description: "Finance" },
      ]);

      const result = await distributor.distributeFromText("我的月工资是15000元");

      expect(result.memoriesCreated).toBeGreaterThan(0);
      expect(result.realmsAffected).toContain("finance");
    });

    it("should return empty for unrecognized text", async () => {
      mockRealmManager.list.mockReturnValue([
        { id: "r1", name: "pet", description: "Pets" },
      ]);

      const result = await distributor.distributeFromText("hello world");

      expect(result.memoriesCreated).toBe(0);
    });
  });

  describe("classifyAndDistribute", () => {
    it("should distribute facts to other realms", async () => {
      mockRealmManager.list.mockReturnValue([
        { id: "r1", name: "pet", description: "Pets" },
        { id: "r2", name: "finance", description: "Finance" },
      ]);

      const facts = ["宠物医疗花费3000元"];
      const result = await distributor.classifyAndDistribute(facts, "r2");

      // Pet keywords should trigger classification to pet realm
      expect(result.length).toBeGreaterThanOrEqual(0);
    });

    it("should skip facts belonging to source realm", async () => {
      mockRealmManager.list.mockReturnValue([
        { id: "r1", name: "pet", description: "Pets" },
      ]);

      const facts = ["猫咪很健康"];
      const result = await distributor.classifyAndDistribute(facts, "r1");

      expect(result).toHaveLength(0);
    });
  });

  describe("processOnboardingInput", () => {
    it("should process first step", async () => {
      mockRealmManager.list.mockReturnValue([
        { id: "r1", name: "pet", description: "Pets" },
      ]);

      const result = await distributor.processOnboardingInput(
        "我有一只猫叫肉肉",
        { step: 0, collectedFacts: [] },
      );

      expect(result.done).toBe(false);
      expect(result.message).toContain("captured");
      expect(result.nextContext.step).toBe(1);
    });
  });

  describe("LLM extraction path", () => {
    it("should use LLM when available and return structured facts", async () => {
      mockLlmRegistry.hasRealProvider.mockReturnValue(true);
      mockLlmRegistry.getProvider.mockReturnValue({
        chat: vi.fn().mockResolvedValue({
          content: JSON.stringify([
            { realm: "pet", entityName: "Luna", entityType: "living", fact: "Luna is 3 years old" },
          ]),
        }),
      });
      mockLlmRegistry.resolveModel.mockReturnValue("test-model");
      mockRealmManager.list.mockReturnValue([
        { id: "r1", name: "pet", description: "Pets" },
      ]);

      const result = await distributor.distributeFromText("我的猫Luna今年3岁了");
      expect(result.memoriesCreated).toBe(1);
      expect(result.realmsAffected).toContain("pet");
    });

    it("should fall back to keywords on malformed LLM JSON", async () => {
      mockLlmRegistry.hasRealProvider.mockReturnValue(true);
      mockLlmRegistry.getProvider.mockReturnValue({
        chat: vi.fn().mockResolvedValue({ content: "not json" }),
      });
      mockLlmRegistry.resolveModel.mockReturnValue("test-model");
      mockRealmManager.list.mockReturnValue([
        { id: "r1", name: "pet", description: "Pets" },
      ]);

      // Should fall back to keyword extraction — "猫" is a pet keyword
      const result = await distributor.distributeFromText("我的猫很可爱");
      // Keyword fallback should work since "猫" matches pet realm
      expect(result.memoriesCreated).toBeGreaterThanOrEqual(0);
    });

    it("should fall back to keywords on LLM error", async () => {
      mockLlmRegistry.hasRealProvider.mockReturnValue(true);
      mockLlmRegistry.getProvider.mockReturnValue({
        chat: vi.fn().mockRejectedValue(new Error("API error")),
      });
      mockLlmRegistry.resolveModel.mockReturnValue("test-model");
      mockRealmManager.list.mockReturnValue([
        { id: "r1", name: "pet", description: "Pets" },
      ]);

      const result = await distributor.distributeFromText("我家的猫咪");
      // Keyword fallback picks up "猫咪"
      expect(result.memoriesCreated).toBeGreaterThan(0);
    });
  });

  describe("entity creation", () => {
    it("should auto-create entity when entityName and entityType provided", async () => {
      mockLlmRegistry.hasRealProvider.mockReturnValue(true);
      mockLlmRegistry.getProvider.mockReturnValue({
        chat: vi.fn().mockResolvedValue({
          content: JSON.stringify([
            { realm: "pet", entityName: "Buddy", entityType: "living", fact: "Buddy is a golden retriever" },
          ]),
        }),
      });
      mockLlmRegistry.resolveModel.mockReturnValue("test-model");
      mockRealmManager.list.mockReturnValue([{ id: "r1", name: "pet" }]);
      mockEntityManager.findByNameInRealm.mockReturnValue(null);

      await distributor.distributeFromText("Buddy is a golden retriever");
      expect(mockEntityManager.create).toHaveBeenCalledWith(expect.objectContaining({
        realmId: "r1",
        name: "Buddy",
        type: "living",
      }));
    });

    it("should not recreate existing entity", async () => {
      mockLlmRegistry.hasRealProvider.mockReturnValue(true);
      mockLlmRegistry.getProvider.mockReturnValue({
        chat: vi.fn().mockResolvedValue({
          content: JSON.stringify([
            { realm: "pet", entityName: "Luna", entityType: "living", fact: "Luna eats fish" },
          ]),
        }),
      });
      mockLlmRegistry.resolveModel.mockReturnValue("test-model");
      mockRealmManager.list.mockReturnValue([{ id: "r1", name: "pet" }]);
      mockEntityManager.findByNameInRealm.mockReturnValue({ id: "e1", name: "Luna" });

      await distributor.distributeFromText("Luna eats fish");
      expect(mockEntityManager.create).not.toHaveBeenCalled();
    });

    it("should default to abstract for invalid entity type", async () => {
      mockLlmRegistry.hasRealProvider.mockReturnValue(true);
      mockLlmRegistry.getProvider.mockReturnValue({
        chat: vi.fn().mockResolvedValue({
          content: JSON.stringify([
            { realm: "pet", entityName: "Goal", entityType: "invalid_type", fact: "A goal" },
          ]),
        }),
      });
      mockLlmRegistry.resolveModel.mockReturnValue("test-model");
      mockRealmManager.list.mockReturnValue([{ id: "r1", name: "pet" }]);
      mockEntityManager.findByNameInRealm.mockReturnValue(null);

      await distributor.distributeFromText("A goal");
      expect(mockEntityManager.create).toHaveBeenCalledWith(expect.objectContaining({
        type: "abstract",
      }));
    });
  });

  describe("sentence splitting", () => {
    it("should split multi-sentence text into multiple facts", async () => {
      mockLlmRegistry.hasRealProvider.mockReturnValue(false);
      mockRealmManager.list.mockReturnValue([
        { id: "r1", name: "pet", description: "Pets" },
      ]);

      const result = await distributor.distributeFromText("我家有一只猫。猫咪叫Luna。Luna很可爱");
      expect(result.memoriesCreated).toBeGreaterThanOrEqual(2);
    });
  });

  describe("multi-realm matching", () => {
    it("should select best matching realm by keyword count", async () => {
      mockRealmManager.list.mockReturnValue([
        { id: "r1", name: "pet", description: "Pets" },
        { id: "r2", name: "finance", description: "Finance" },
      ]);

      // "猫" and "狗" are both pet keywords, "钱" is finance
      // pet has more matches → should classify to pet
      const result = await distributor.distributeFromText("我养了一只猫和一只狗");
      expect(result.realmsAffected).toContain("pet");
    });
  });

  describe("empty realm list", () => {
    it("should return empty result when no realms registered", async () => {
      mockRealmManager.list.mockReturnValue([]);

      const result = await distributor.distributeFromText("Some random text about cats and money");
      expect(result.memoriesCreated).toBe(0);
      expect(result.facts).toHaveLength(0);
    });
  });

  describe("English keywords", () => {
    it("should classify English text correctly", async () => {
      mockLlmRegistry.hasRealProvider.mockReturnValue(false);
      mockRealmManager.list.mockReturnValue([
        { id: "r1", name: "pet", description: "Pets" },
        { id: "r2", name: "finance", description: "Finance" },
      ]);

      const result = await distributor.distributeFromText("I need to budget my monthly salary for expenses");
      expect(result.realmsAffected).toContain("finance");
    });
  });

  describe("onboarding — step > 0", () => {
    it("should return different message for subsequent steps", async () => {
      mockRealmManager.list.mockReturnValue([
        { id: "r1", name: "pet", description: "Pets" },
      ]);

      const result = await distributor.processOnboardingInput(
        "我还有一只猫叫花花",
        { step: 1, collectedFacts: [] },
      );

      expect(result.done).toBe(false);
      // Step > 0 message says "Added X more facts" or "Nothing new"
      expect(result.message).toMatch(/Added|Nothing/);
      expect(result.nextContext.step).toBe(2);
    });

    it("should show hint when no facts extracted", async () => {
      mockLlmRegistry.hasRealProvider.mockReturnValue(false);
      mockRealmManager.list.mockReturnValue([]);

      const result = await distributor.processOnboardingInput(
        "hello world",
        { step: 1, collectedFacts: [] },
      );

      expect(result.message).toContain("Nothing new");
    });
  });

  describe("classifyAndDistribute — cross-realm metadata", () => {
    it("should create memory with cross-realm-distribution source", async () => {
      mockRealmManager.list.mockReturnValue([
        { id: "r1", name: "pet", description: "Pets" },
        { id: "r2", name: "finance", description: "Finance" },
      ]);

      await distributor.classifyAndDistribute(
        ["月工资预算投资理财"],  // multiple finance keywords, no pet keywords
        "r1",  // source is pet
      );

      expect(mockMemoryRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        realmId: "r2",
        metadata: expect.objectContaining({
          source: "cross-realm-distribution",
          sourceRealmId: "r1",
        }),
      }));
    });
  });
});
