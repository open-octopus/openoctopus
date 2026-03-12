import { describe, it, expect, beforeEach, vi } from "vitest";
import { MemoryExtractor } from "./memory-extractor.js";

const mockMemoryRepo = {
  create: vi.fn().mockReturnValue({
    id: "memory_test1",
    realmId: "r1",
    tier: "archival",
    content: "test fact",
    metadata: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }),
};

const mockLlmRegistry = {
  hasRealProvider: vi.fn().mockReturnValue(false),
  getProvider: vi.fn(),
  resolveModel: vi.fn().mockReturnValue("test-model"),
};

const mockKnowledgeDistributor = {
  classifyAndDistribute: vi.fn().mockResolvedValue([]),
};

describe("MemoryExtractor", () => {
  let extractor: MemoryExtractor;
  let extractorWithDistributor: MemoryExtractor;

  beforeEach(() => {
    vi.clearAllMocks();
    extractor = new MemoryExtractor(
      mockMemoryRepo as any,
      mockLlmRegistry as any,
    );
    extractorWithDistributor = new MemoryExtractor(
      mockMemoryRepo as any,
      mockLlmRegistry as any,
      mockKnowledgeDistributor as any,
    );
  });

  it("should return empty when no LLM provider", async () => {
    mockLlmRegistry.hasRealProvider.mockReturnValue(false);

    const result = await extractor.extractAndPersist({
      realmId: "r1",
      userMessage: "My cat is 3",
      assistantMessage: "Nice!",
    });

    expect(result).toEqual([]);
    expect(mockMemoryRepo.create).not.toHaveBeenCalled();
  });

  it("should create memory entries when LLM extracts facts", async () => {
    mockLlmRegistry.hasRealProvider.mockReturnValue(true);
    mockLlmRegistry.getProvider.mockReturnValue({
      chat: vi.fn().mockResolvedValue({
        content: JSON.stringify(["Cat is 3 years old", "Cat likes fish"]),
      }),
    });

    const result = await extractor.extractAndPersist({
      realmId: "r1",
      entityId: "e1",
      userMessage: "My cat is 3 and likes fish",
      assistantMessage: "Great!",
    });

    expect(result).toHaveLength(2);
    expect(mockMemoryRepo.create).toHaveBeenCalledTimes(2);
    expect(mockMemoryRepo.create).toHaveBeenCalledWith(expect.objectContaining({
      realmId: "r1",
      entityId: "e1",
      tier: "archival",
      content: "Cat is 3 years old",
    }));
  });

  it("should create no memories when LLM returns empty array", async () => {
    mockLlmRegistry.hasRealProvider.mockReturnValue(true);
    mockLlmRegistry.getProvider.mockReturnValue({
      chat: vi.fn().mockResolvedValue({ content: "[]" }),
    });

    const result = await extractor.extractAndPersist({
      realmId: "r1",
      userMessage: "hello",
      assistantMessage: "hi",
    });

    expect(result).toEqual([]);
    expect(mockMemoryRepo.create).not.toHaveBeenCalled();
  });

  it("should handle non-JSON LLM response gracefully", async () => {
    mockLlmRegistry.hasRealProvider.mockReturnValue(true);
    mockLlmRegistry.getProvider.mockReturnValue({
      chat: vi.fn().mockResolvedValue({ content: "not valid json at all" }),
    });

    const result = await extractor.extractAndPersist({
      realmId: "r1",
      userMessage: "test",
      assistantMessage: "test",
    });

    expect(result).toEqual([]);
  });

  it("should truncate to 5 facts maximum", async () => {
    mockLlmRegistry.hasRealProvider.mockReturnValue(true);
    mockLlmRegistry.getProvider.mockReturnValue({
      chat: vi.fn().mockResolvedValue({
        content: JSON.stringify(["f1", "f2", "f3", "f4", "f5", "f6", "f7"]),
      }),
    });

    const result = await extractor.extractAndPersist({
      realmId: "r1",
      userMessage: "lots of info",
      assistantMessage: "noted",
    });

    expect(result).toHaveLength(5);
    expect(mockMemoryRepo.create).toHaveBeenCalledTimes(5);
  });

  it("should call classifyAndDistribute when knowledgeDistributor is present", async () => {
    mockLlmRegistry.hasRealProvider.mockReturnValue(true);
    mockLlmRegistry.getProvider.mockReturnValue({
      chat: vi.fn().mockResolvedValue({
        content: JSON.stringify(["fact about cats"]),
      }),
    });

    await extractorWithDistributor.extractAndPersist({
      realmId: "r1",
      userMessage: "My cat info",
      assistantMessage: "Noted",
    });

    // Allow fire-and-forget promise to resolve
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(mockKnowledgeDistributor.classifyAndDistribute).toHaveBeenCalledWith(
      ["fact about cats"],
      "r1",
    );
  });

  it("should not error when knowledgeDistributor is absent", async () => {
    mockLlmRegistry.hasRealProvider.mockReturnValue(true);
    mockLlmRegistry.getProvider.mockReturnValue({
      chat: vi.fn().mockResolvedValue({
        content: JSON.stringify(["a fact"]),
      }),
    });

    // extractor has no knowledgeDistributor
    const result = await extractor.extractAndPersist({
      realmId: "r1",
      userMessage: "test",
      assistantMessage: "ok",
    });

    expect(result).toHaveLength(1);
    expect(mockKnowledgeDistributor.classifyAndDistribute).not.toHaveBeenCalled();
  });

  it("should catch LLM exceptions and return empty", async () => {
    mockLlmRegistry.hasRealProvider.mockReturnValue(true);
    mockLlmRegistry.getProvider.mockReturnValue({
      chat: vi.fn().mockRejectedValue(new Error("API down")),
    });

    const result = await extractor.extractAndPersist({
      realmId: "r1",
      userMessage: "test",
      assistantMessage: "test",
    });

    expect(result).toEqual([]);
  });
});
