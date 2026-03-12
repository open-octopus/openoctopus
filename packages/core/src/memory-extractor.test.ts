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
  searchSemantic: vi.fn().mockReturnValue([]),
  updateContent: vi.fn(),
  updateEmbedding: vi.fn(),
  delete: vi.fn(),
};

const mockLlmRegistry = {
  hasRealProvider: vi.fn().mockReturnValue(false),
  getProvider: vi.fn(),
  resolveModel: vi.fn().mockReturnValue("test-model"),
};

const mockKnowledgeDistributor = {
  classifyAndDistribute: vi.fn().mockResolvedValue([]),
};

const mockEmbeddingRegistry = {
  hasProvider: vi.fn().mockReturnValue(false),
  getProvider: vi.fn(),
};

/** Helper: create a unit vector pointing along a single dimension */
function basisVector(dim: number, size = 128): number[] {
  const v = new Array(size).fill(0);
  v[dim] = 1;
  return v;
}

/** Helper: create a vector that is `similarity` cosine-similar to a basis vector at dim */
function vectorWithSimilarity(baseDim: number, similarity: number, size = 128): number[] {
  // Start with the basis vector scaled by similarity, add orthogonal component
  const v = new Array(size).fill(0);
  v[baseDim] = similarity;
  // Add orthogonal component in the next dimension to make it a unit vector
  const orthDim = (baseDim + 1) % size;
  v[orthDim] = Math.sqrt(1 - similarity * similarity);
  return v;
}

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

  describe("extraction dedup", () => {
    let dedupExtractor: MemoryExtractor;
    let chatFn: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      mockEmbeddingRegistry.hasProvider.mockReturnValue(true);
      dedupExtractor = new MemoryExtractor(
        mockMemoryRepo as any,
        mockLlmRegistry as any,
        undefined,
        mockEmbeddingRegistry as any,
      );
    });

    it("skips duplicate when similarity > 0.85", async () => {
      // The extracted fact embedding will be the basis vector at dim 0
      const factVec = basisVector(0);
      // The existing memory has an embedding nearly identical (cosine sim ~0.95)
      const existingVec = vectorWithSimilarity(0, 0.95);

      // LLM extraction returns one fact
      chatFn = vi.fn().mockResolvedValue({
        content: JSON.stringify(["Cat is 3 years old"]),
      });
      mockLlmRegistry.hasRealProvider.mockReturnValue(true);
      mockLlmRegistry.getProvider.mockReturnValue({ chat: chatFn });

      // Embedding provider returns the factVec when embedding the fact
      mockEmbeddingRegistry.getProvider.mockReturnValue({
        embed: vi.fn().mockResolvedValue(factVec),
      });

      // searchSemantic returns an existing memory with high-similarity embedding
      mockMemoryRepo.searchSemantic.mockReturnValue([
        {
          id: "memory_existing1",
          realmId: "r1",
          tier: "archival",
          content: "Cat is 3 years old",
          embedding: existingVec,
          metadata: {},
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]);

      const result = await dedupExtractor.extractAndPersist({
        realmId: "r1",
        userMessage: "My cat is 3",
        assistantMessage: "Nice!",
      });

      // Should skip — no create called
      expect(mockMemoryRepo.create).not.toHaveBeenCalled();
      expect(result).toHaveLength(0);
    });

    it("merges when similarity is 0.6-0.85", async () => {
      // The extracted fact embedding
      const factVec = basisVector(0);
      // The existing memory has moderate similarity (~0.75)
      const existingVec = vectorWithSimilarity(0, 0.75);

      // LLM extraction returns one fact
      chatFn = vi.fn()
        // First call: extraction
        .mockResolvedValueOnce({
          content: JSON.stringify(["Cat is 3 years old and healthy"]),
        })
        // Second call: merge prompt
        .mockResolvedValueOnce({
          content: "Cat is 3 years old, healthy, and loves fish",
        });
      mockLlmRegistry.hasRealProvider.mockReturnValue(true);
      mockLlmRegistry.getProvider.mockReturnValue({ chat: chatFn });

      // Embedding provider returns factVec for the fact, then a new vec for merged content
      const mergedVec = basisVector(2);
      const embedFn = vi.fn()
        .mockResolvedValueOnce(factVec)   // embed the new fact
        .mockResolvedValueOnce(mergedVec); // embed the merged content
      mockEmbeddingRegistry.getProvider.mockReturnValue({
        embed: embedFn,
      });

      // searchSemantic returns an existing memory with moderate similarity
      mockMemoryRepo.searchSemantic.mockReturnValue([
        {
          id: "memory_existing2",
          realmId: "r1",
          tier: "archival",
          content: "Cat likes fish",
          embedding: existingVec,
          metadata: {},
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]);

      const result = await dedupExtractor.extractAndPersist({
        realmId: "r1",
        userMessage: "My cat is 3 and healthy",
        assistantMessage: "Great!",
      });

      // Should merge: updateContent + updateEmbedding on old entry, no create
      expect(mockMemoryRepo.create).not.toHaveBeenCalled();
      expect(mockMemoryRepo.updateContent).toHaveBeenCalledWith(
        "memory_existing2",
        "Cat is 3 years old, healthy, and loves fish",
      );
      expect(mockMemoryRepo.updateEmbedding).toHaveBeenCalledWith(
        "memory_existing2",
        mergedVec,
      );
      // The merged entry should be in the result
      expect(result).toHaveLength(1);
      expect(result[0].content).toBe("Cat is 3 years old, healthy, and loves fish");
    });

    it("inserts new when similarity < 0.6", async () => {
      // The extracted fact embedding
      const factVec = basisVector(0);
      // The existing memory has low similarity (~0.3)
      const existingVec = vectorWithSimilarity(0, 0.3);

      chatFn = vi.fn().mockResolvedValue({
        content: JSON.stringify(["Dog weighs 20kg"]),
      });
      mockLlmRegistry.hasRealProvider.mockReturnValue(true);
      mockLlmRegistry.getProvider.mockReturnValue({ chat: chatFn });

      mockEmbeddingRegistry.getProvider.mockReturnValue({
        embed: vi.fn().mockResolvedValue(factVec),
      });

      // searchSemantic returns a low-similarity result
      mockMemoryRepo.searchSemantic.mockReturnValue([
        {
          id: "memory_existing3",
          realmId: "r1",
          tier: "archival",
          content: "Cat is 3 years old",
          embedding: existingVec,
          metadata: {},
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]);

      const result = await dedupExtractor.extractAndPersist({
        realmId: "r1",
        userMessage: "My dog weighs 20kg",
        assistantMessage: "Noted!",
      });

      // Should insert as new
      expect(mockMemoryRepo.create).toHaveBeenCalledTimes(1);
      expect(mockMemoryRepo.updateEmbedding).toHaveBeenCalled();
      expect(result).toHaveLength(1);
    });

    it("inserts new when no similar memories found", async () => {
      const factVec = basisVector(0);

      chatFn = vi.fn().mockResolvedValue({
        content: JSON.stringify(["First fact ever"]),
      });
      mockLlmRegistry.hasRealProvider.mockReturnValue(true);
      mockLlmRegistry.getProvider.mockReturnValue({ chat: chatFn });

      mockEmbeddingRegistry.getProvider.mockReturnValue({
        embed: vi.fn().mockResolvedValue(factVec),
      });

      // No similar memories
      mockMemoryRepo.searchSemantic.mockReturnValue([]);

      const result = await dedupExtractor.extractAndPersist({
        realmId: "r1",
        userMessage: "Brand new info",
        assistantMessage: "Got it!",
      });

      expect(mockMemoryRepo.create).toHaveBeenCalledTimes(1);
      expect(mockMemoryRepo.updateEmbedding).toHaveBeenCalled();
      expect(result).toHaveLength(1);
    });

    it("uses fallback merge (append with semicolon) when LLM merge fails", async () => {
      const factVec = basisVector(0);
      const existingVec = vectorWithSimilarity(0, 0.75);

      chatFn = vi.fn()
        .mockResolvedValueOnce({
          content: JSON.stringify(["Cat is 3 years old"]),
        })
        // Merge LLM call fails
        .mockRejectedValueOnce(new Error("LLM down"));
      mockLlmRegistry.hasRealProvider.mockReturnValue(true);
      mockLlmRegistry.getProvider.mockReturnValue({ chat: chatFn });

      const mergedVec = basisVector(2);
      const embedFn = vi.fn()
        .mockResolvedValueOnce(factVec)
        .mockResolvedValueOnce(mergedVec);
      mockEmbeddingRegistry.getProvider.mockReturnValue({
        embed: embedFn,
      });

      mockMemoryRepo.searchSemantic.mockReturnValue([
        {
          id: "memory_existing4",
          realmId: "r1",
          tier: "archival",
          content: "Cat likes fish",
          embedding: existingVec,
          metadata: {},
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]);

      const result = await dedupExtractor.extractAndPersist({
        realmId: "r1",
        userMessage: "My cat is 3",
        assistantMessage: "Nice!",
      });

      // Should use fallback: "old; new"
      expect(mockMemoryRepo.updateContent).toHaveBeenCalledWith(
        "memory_existing4",
        "Cat likes fish; Cat is 3 years old",
      );
      expect(result).toHaveLength(1);
    });

    it("skips dedup when existing memory has no embedding", async () => {
      const factVec = basisVector(0);

      chatFn = vi.fn().mockResolvedValue({
        content: JSON.stringify(["New fact"]),
      });
      mockLlmRegistry.hasRealProvider.mockReturnValue(true);
      mockLlmRegistry.getProvider.mockReturnValue({ chat: chatFn });

      mockEmbeddingRegistry.getProvider.mockReturnValue({
        embed: vi.fn().mockResolvedValue(factVec),
      });

      // searchSemantic returns a result with no embedding
      mockMemoryRepo.searchSemantic.mockReturnValue([
        {
          id: "memory_noembedding",
          realmId: "r1",
          tier: "archival",
          content: "Old fact without embedding",
          embedding: undefined,
          metadata: {},
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]);

      const result = await dedupExtractor.extractAndPersist({
        realmId: "r1",
        userMessage: "Some info",
        assistantMessage: "Ok!",
      });

      // Should insert as new since we can't compare embeddings
      expect(mockMemoryRepo.create).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(1);
    });
  });
});
