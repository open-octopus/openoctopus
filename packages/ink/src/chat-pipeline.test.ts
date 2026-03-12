import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@openoctopus/storage", () => ({
  readTranscript: vi.fn(() => ({ messages: [] })),
  appendMessage: vi.fn(),
}));

import { processChatMessage } from "./chat-pipeline.js";
import type { RpcServices } from "./rpc-handlers.js";

function createMockServices(overrides: Partial<RpcServices> = {}): RpcServices {
  return {
    realmManager: {
      list: vi.fn(() => []),
      get: vi.fn((id: string) => ({ id, name: "TestRealm", description: "", status: "active" })),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    } as unknown as RpcServices["realmManager"],
    entityManager: {
      get: vi.fn(),
      listByRealm: vi.fn(() => []),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    } as unknown as RpcServices["entityManager"],
    agentRunner: {
      run: vi.fn(async () => ({
        response: { role: "assistant" as const, content: "Hello!", timestamp: new Date().toISOString() },
        tokensUsed: { input: 10, output: 5 },
      })),
    } as unknown as RpcServices["agentRunner"],
    router: {
      route: vi.fn(() => ({ targetRealmId: undefined, confidence: 0 })),
    } as unknown as RpcServices["router"],
    summonEngine: {
      getSummoned: vi.fn(() => undefined),
      summon: vi.fn(),
      unsummon: vi.fn(),
      listActive: vi.fn(() => []),
    } as unknown as RpcServices["summonEngine"],
    ...overrides,
  };
}

describe("processChatMessage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("entity-scoped", () => {
    it("uses summoned agent config and system prompt", async () => {
      const services = createMockServices({
        summonEngine: {
          getSummoned: vi.fn(() => ({
            entity: { id: "entity_1", name: "Buddy" },
            agent: { id: "agent_1", name: "Buddy Agent", model: "claude-sonnet-4-6", skills: [], proactive: false },
            systemPrompt: "You are Buddy the dog",
          })),
          summon: vi.fn(),
          unsummon: vi.fn(),
          listActive: vi.fn(() => []),
        } as unknown as RpcServices["summonEngine"],
      });

      const result = await processChatMessage({
        message: "hi",
        entityId: "entity_1",
        services,
      });
      expect(result.entity).toEqual({ id: "entity_1", name: "Buddy" });
      expect(services.agentRunner.run).toHaveBeenCalledWith(
        expect.objectContaining({ systemPrompt: "You are Buddy the dog" }),
      );
    });

    it("throws NOT_SUMMONED when entity is not summoned", async () => {
      const services = createMockServices();
      await expect(
        processChatMessage({ message: "hi", entityId: "entity_1", services }),
      ).rejects.toThrow("Entity must be summoned");
    });
  });

  describe("realm-scoped", () => {
    it("creates realm agent config", async () => {
      const services = createMockServices();
      const result = await processChatMessage({
        message: "check budget",
        realmId: "realm_finance",
        services,
      });
      expect(result.realm).toEqual({ id: "realm_finance", name: "TestRealm" });
      expect(services.agentRunner.run).toHaveBeenCalled();
    });
  });

  describe("auto-routed", () => {
    it("routes to matching realm", async () => {
      const services = createMockServices({
        router: {
          route: vi.fn(() => ({ targetRealmId: "realm_pet", confidence: 0.8 })),
        } as unknown as RpcServices["router"],
      });
      const result = await processChatMessage({ message: "my cat", services });
      expect(result.routing?.targetRealmId).toBe("realm_pet");
      expect(result.realm?.id).toBe("realm_pet");
    });

    it("uses central router when no realm matches", async () => {
      const services = createMockServices();
      const result = await processChatMessage({ message: "hello", services });
      expect(result.routing?.targetRealmId).toBeUndefined();
      expect(result.realm).toBeUndefined();
    });
  });

  describe("session", () => {
    it("generates session ID when not provided", async () => {
      const services = createMockServices();
      const result = await processChatMessage({ message: "hi", services });
      expect(result.sessionId).toMatch(/^session_/);
    });

    it("uses provided session ID", async () => {
      const services = createMockServices();
      const result = await processChatMessage({
        message: "hi",
        sessionId: "session_existing",
        services,
      });
      expect(result.sessionId).toBe("session_existing");
    });
  });

  describe("streaming", () => {
    it("passes onToken to agentRunner", async () => {
      const services = createMockServices();
      const onToken = vi.fn();
      await processChatMessage({ message: "hi", services, onToken });
      expect(services.agentRunner.run).toHaveBeenCalledWith(
        expect.objectContaining({ onToken }),
      );
    });
  });

  describe("memory extraction integration", () => {
    it("should call memoryExtractor.extractAndPersist when realm exists", async () => {
      const extractAndPersist = vi.fn().mockResolvedValue({ memories: [], attributeUpdates: [] });
      const services = createMockServices({
        memoryExtractor: { extractAndPersist } as any,
      });

      await processChatMessage({
        message: "my cat is sick",
        realmId: "realm_pet",
        services,
      });

      // Allow fire-and-forget to execute
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(extractAndPersist).toHaveBeenCalledWith(expect.objectContaining({
        realmId: "realm_pet",
        userMessage: "my cat is sick",
      }));
    });

    it("should not block response if extractAndPersist rejects", async () => {
      const extractAndPersist = vi.fn().mockRejectedValue(new Error("extraction failed"));
      const services = createMockServices({
        memoryExtractor: { extractAndPersist } as any,
      });

      const result = await processChatMessage({
        message: "test",
        realmId: "realm_pet",
        services,
      });

      expect(result.response.content).toBe("Hello!");
    });
  });

  describe("maturity scanner integration", () => {
    it("should call maturityScanner.checkAndNotify when realm exists", async () => {
      const checkAndNotify = vi.fn().mockResolvedValue(undefined);
      const services = createMockServices({
        maturityScanner: { checkAndNotify } as any,
      });

      await processChatMessage({
        message: "check pet",
        realmId: "realm_pet",
        services,
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(checkAndNotify).toHaveBeenCalledWith("realm_pet", expect.any(Function));
    });
  });

  describe("cross-realm reactor integration", () => {
    it("should call checkReactions when realm exists and active agents > 0", async () => {
      const checkReactions = vi.fn().mockResolvedValue(undefined);
      const services = createMockServices({
        crossRealmReactor: { checkReactions } as any,
        summonEngine: {
          getSummoned: vi.fn(() => undefined),
          summon: vi.fn(),
          unsummon: vi.fn(),
          listActive: vi.fn(() => [{ entity: { id: "e1" }, agent: { name: "A" } }]),
        } as any,
      });

      await processChatMessage({
        message: "discuss finance",
        realmId: "realm_pet",
        services,
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(checkReactions).toHaveBeenCalledWith(expect.objectContaining({
        sourceRealmId: "realm_pet",
        userMessage: "discuss finance",
      }));
    });

    it("should call checkReactions even when no active agents (reactor handles it internally)", async () => {
      const checkReactions = vi.fn().mockResolvedValue(undefined);
      const services = createMockServices({
        crossRealmReactor: { checkReactions } as any,
        // Default summonEngine.listActive returns []
      });

      await processChatMessage({
        message: "discuss finance",
        realmId: "realm_pet",
        services,
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(checkReactions).toHaveBeenCalledWith(expect.objectContaining({
        sourceRealmId: "realm_pet",
        userMessage: "discuss finance",
      }));
    });
  });

  describe("entity attribute auto-update", () => {
    it("applies attribute updates from extraction to entity", async () => {
      const extractAndPersist = vi.fn().mockResolvedValue({
        memories: [],
        attributeUpdates: [{ entityName: "Luna", key: "age", value: "4" }],
      });
      const findByNameInRealm = vi.fn().mockReturnValue({
        id: "entity_luna",
        realmId: "realm_pet",
        name: "Luna",
        type: "living",
        attributes: { breed: "Shiba" },
      });
      const update = vi.fn();

      const services = createMockServices({
        memoryExtractor: { extractAndPersist } as any,
        entityManager: {
          get: vi.fn(),
          listByRealm: vi.fn(() => []),
          create: vi.fn(),
          update,
          delete: vi.fn(),
          countByRealm: vi.fn(() => 0),
          findByNameInRealm,
        } as any,
      });

      await processChatMessage({
        message: "Luna is now 4 years old",
        realmId: "realm_pet",
        services,
      });

      // Allow fire-and-forget to execute
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(extractAndPersist).toHaveBeenCalled();
      expect(findByNameInRealm).toHaveBeenCalledWith("realm_pet", "Luna");
      expect(update).toHaveBeenCalledWith("entity_luna", {
        attributes: { breed: "Shiba", age: "4" },
      });
    });

    it("does not crash when entity is not found for attribute update", async () => {
      const extractAndPersist = vi.fn().mockResolvedValue({
        memories: [],
        attributeUpdates: [{ entityName: "Unknown", key: "age", value: "4" }],
      });

      const services = createMockServices({
        memoryExtractor: { extractAndPersist } as any,
        entityManager: {
          get: vi.fn(),
          listByRealm: vi.fn(() => []),
          create: vi.fn(),
          update: vi.fn(),
          delete: vi.fn(),
          countByRealm: vi.fn(() => 0),
          findByNameInRealm: vi.fn().mockReturnValue(null),
        } as any,
      });

      const result = await processChatMessage({
        message: "Unknown is 4 years old",
        realmId: "realm_pet",
        services,
      });

      // Should not throw
      expect(result.response.content).toBe("Hello!");
    });
  });

  describe("memory injection into system prompt", () => {
    it("should inject realm memories into system prompt", async () => {
      const services = createMockServices({
        memoryRepo: {
          listByRealm: vi.fn(() => [
            { id: "m1", content: "Cat is 3 years old" },
            { id: "m2", content: "Cat likes fish" },
          ]),
        } as any,
      });

      await processChatMessage({
        message: "tell me about my cat",
        realmId: "realm_pet",
        services,
      });

      expect(services.agentRunner.run).toHaveBeenCalledWith(
        expect.objectContaining({
          systemPrompt: expect.stringContaining("Cat is 3 years old"),
        }),
      );
    });

    it("uses semantic search for memory injection when embedding provider is available", async () => {
      const mockEmbeddingRegistry = {
        hasProvider: vi.fn().mockReturnValue(true),
        getProvider: vi.fn().mockReturnValue({
          embed: vi.fn().mockResolvedValue([1, 0, 0]),
          dimensions: 3,
          name: "stub",
          embedBatch: vi.fn(),
        }),
      };

      const mockMemoryRepo = {
        listByRealm: vi.fn(() => []),
        searchSemantic: vi.fn().mockReturnValue([
          { id: "m1", realmId: "realm_pet", content: "Luna likes fish", tier: "archival", metadata: {}, createdAt: "", updatedAt: "" },
        ]),
      };

      const services = createMockServices({
        memoryRepo: mockMemoryRepo as any,
        embeddingRegistry: mockEmbeddingRegistry as any,
      });

      const result = await processChatMessage({
        message: "What does my cat eat?",
        realmId: "realm_pet",
        services,
      });

      expect(mockMemoryRepo.searchSemantic).toHaveBeenCalled();
      expect(result.response).toBeDefined();
    });

    it("falls back to listByRealm when embedding provider is not available", async () => {
      const mockMemoryRepo = {
        listByRealm: vi.fn(() => [
          { id: "m1", content: "Cat is 3 years old" },
        ]),
        searchSemantic: vi.fn(),
      };

      const services = createMockServices({
        memoryRepo: mockMemoryRepo as any,
      });

      await processChatMessage({
        message: "tell me about my cat",
        realmId: "realm_pet",
        services,
      });

      expect(mockMemoryRepo.listByRealm).toHaveBeenCalled();
      expect(mockMemoryRepo.searchSemantic).not.toHaveBeenCalled();
    });

    it("falls back to listByRealm when semantic search throws", async () => {
      const mockEmbeddingRegistry = {
        hasProvider: vi.fn().mockReturnValue(true),
        getProvider: vi.fn().mockReturnValue({
          embed: vi.fn().mockRejectedValue(new Error("embedding API error")),
          dimensions: 3,
          name: "stub",
          embedBatch: vi.fn(),
        }),
      };

      const mockMemoryRepo = {
        listByRealm: vi.fn(() => [
          { id: "m1", content: "Fallback memory" },
        ]),
        searchSemantic: vi.fn(),
      };

      const services = createMockServices({
        memoryRepo: mockMemoryRepo as any,
        embeddingRegistry: mockEmbeddingRegistry as any,
      });

      await processChatMessage({
        message: "tell me about my cat",
        realmId: "realm_pet",
        services,
      });

      // Should have fallen back to listByRealm after embed() threw
      expect(mockMemoryRepo.listByRealm).toHaveBeenCalled();
    });
  });
});
