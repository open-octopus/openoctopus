import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@openoctopus/storage", () => ({
  readTranscript: vi.fn(() => ({ messages: [] })),
  appendMessage: vi.fn(),
}));

import { RPC_METHODS, NotFoundError } from "@openoctopus/shared";
import { dispatchRpc } from "./rpc-handlers.js";
import type { RpcServices } from "./rpc-handlers.js";

function createMockWs() {
  const sent: string[] = [];
  return {
    ws: { send: (data: string) => sent.push(data) } as unknown as import("ws").WebSocket,
    sent,
    lastParsed: () => JSON.parse(sent[sent.length - 1]),
  };
}

function createMockServices(): RpcServices {
  return {
    realmManager: {
      list: vi.fn(() => [{ id: "realm_1", name: "Pet" }]),
      get: vi.fn((id: string) => ({ id, name: "Pet" })),
      create: vi.fn((data: { name: string }) => ({ id: "realm_new", name: data.name })),
      update: vi.fn(),
      delete: vi.fn(),
    } as unknown as RpcServices["realmManager"],
    entityManager: {
      get: vi.fn(),
      listByRealm: vi.fn(() => [{ id: "entity_1", name: "Buddy" }]),
      countByRealm: vi.fn(() => 1),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    } as unknown as RpcServices["entityManager"],
    agentRunner: {
      run: vi.fn(async ({ onToken }: { onToken?: (t: string) => void }) => {
        if (onToken) {
          onToken("Hello");
          onToken(" World");
        }
        return {
          response: {
            role: "assistant",
            content: "Hello World",
            timestamp: new Date().toISOString(),
          },
          tokensUsed: { input: 10, output: 5 },
        };
      }),
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
  };
}

describe("dispatchRpc", () => {
  let services: RpcServices;

  beforeEach(() => {
    vi.clearAllMocks();
    services = createMockServices();
  });

  it("returns error for unknown method", async () => {
    const { ws, lastParsed } = createMockWs();
    await dispatchRpc(ws, { id: "1", method: "unknown.method", params: {} }, services);
    expect(lastParsed().error.code).toBe(404);
    expect(lastParsed().error.message).toContain("Unknown method");
  });

  describe("realm handlers", () => {
    it("realm.list returns realms", async () => {
      const { ws, lastParsed } = createMockWs();
      await dispatchRpc(ws, { id: "1", method: RPC_METHODS.REALM_LIST, params: {} }, services);
      expect(lastParsed().result.realms).toEqual([
        { id: "realm_1", name: "Pet", entityCount: 1, agentName: undefined },
      ]);
    });

    it("realm.create creates realm", async () => {
      const { ws, lastParsed } = createMockWs();
      await dispatchRpc(
        ws,
        { id: "1", method: RPC_METHODS.REALM_CREATE, params: { name: "Finance" } },
        services,
      );
      expect(lastParsed().result.realm.name).toBe("Finance");
    });

    it("realm.create rejects missing name", async () => {
      const { ws, lastParsed } = createMockWs();
      await dispatchRpc(ws, { id: "1", method: RPC_METHODS.REALM_CREATE, params: {} }, services);
      expect(lastParsed().error.code).toBe(400);
      expect(lastParsed().error.message).toContain("name is required");
    });
  });

  describe("entity handlers", () => {
    it("entity.list requires realmId", async () => {
      const { ws, lastParsed } = createMockWs();
      await dispatchRpc(ws, { id: "1", method: RPC_METHODS.ENTITY_LIST, params: {} }, services);
      expect(lastParsed().error.code).toBe(400);
      expect(lastParsed().error.message).toContain("realmId is required");
    });
  });

  describe("chat handler", () => {
    it("chat.send requires message", async () => {
      const { ws, lastParsed } = createMockWs();
      await dispatchRpc(ws, { id: "1", method: RPC_METHODS.CHAT_SEND, params: {} }, services);
      expect(lastParsed().error.code).toBe(400);
      expect(lastParsed().error.message).toContain("message is required");
    });

    it("chat.send with streaming emits tokens", async () => {
      const { ws, sent } = createMockWs();
      await dispatchRpc(
        ws,
        { id: "1", method: RPC_METHODS.CHAT_SEND, params: { message: "hi" } },
        services,
      );
      // Should have token events + final response
      const parsed = sent.map((s) => JSON.parse(s));
      const tokenEvents = parsed.filter((p) => p.event === "chat.token");
      expect(tokenEvents.length).toBeGreaterThan(0);
      // Last message should be the final response
      const final = parsed[parsed.length - 1];
      expect(final.result.message.content).toBe("Hello World");
    });
  });

  describe("status handlers", () => {
    it("status.health returns ok", async () => {
      const { ws, lastParsed } = createMockWs();
      await dispatchRpc(ws, { id: "1", method: RPC_METHODS.STATUS_HEALTH, params: {} }, services);
      expect(lastParsed().result.status).toBe("ok");
    });
  });

  describe("error handling", () => {
    it("catches service errors and returns error response", async () => {
      (services.realmManager.get as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new NotFoundError("Realm", "realm_bad");
      });

      const { ws, lastParsed } = createMockWs();
      await dispatchRpc(
        ws,
        { id: "1", method: RPC_METHODS.REALM_GET, params: { id: "realm_bad" } },
        services,
      );
      expect(lastParsed().error.code).toBe(404);
    });
  });

  describe("health.report handler", () => {
    it("returns 501 when memoryHealthManager is not available", async () => {
      const { ws, lastParsed } = createMockWs();
      await dispatchRpc(ws, { id: "1", method: RPC_METHODS.HEALTH_REPORT, params: {} }, services);
      expect(lastParsed().error.code).toBe(501);
    });

    it("calls computeHealth with realmId", async () => {
      const computeHealth = vi.fn().mockResolvedValue({ healthScore: 95 });
      const svc = {
        ...services,
        memoryHealthManager: {
          computeHealth,
          computeAllHealth: vi.fn(),
        } as unknown as RpcServices["memoryHealthManager"],
      };
      const { ws, lastParsed } = createMockWs();
      await dispatchRpc(
        ws,
        { id: "1", method: RPC_METHODS.HEALTH_REPORT, params: { realmId: "r1" } },
        svc,
      );
      expect(computeHealth).toHaveBeenCalledWith("r1");
      expect(lastParsed().result.report.healthScore).toBe(95);
    });

    it("calls computeAllHealth without realmId", async () => {
      const computeAllHealth = vi.fn().mockResolvedValue([{ healthScore: 90 }]);
      const svc = {
        ...services,
        memoryHealthManager: {
          computeHealth: vi.fn(),
          computeAllHealth,
        } as unknown as RpcServices["memoryHealthManager"],
      };
      const { ws, lastParsed } = createMockWs();
      await dispatchRpc(ws, { id: "1", method: RPC_METHODS.HEALTH_REPORT, params: {} }, svc);
      expect(computeAllHealth).toHaveBeenCalled();
      expect(lastParsed().result.reports).toHaveLength(1);
    });
  });

  describe("health.clean handler", () => {
    it("returns 501 when memoryHealthManager is not available", async () => {
      const { ws, lastParsed } = createMockWs();
      await dispatchRpc(ws, { id: "1", method: RPC_METHODS.HEALTH_CLEAN, params: {} }, services);
      expect(lastParsed().error.code).toBe(501);
    });

    it("returns 400 when realmId is missing", async () => {
      const svc = {
        ...services,
        memoryHealthManager: { cleanup: vi.fn() } as unknown as RpcServices["memoryHealthManager"],
      };
      const { ws, lastParsed } = createMockWs();
      await dispatchRpc(ws, { id: "1", method: RPC_METHODS.HEALTH_CLEAN, params: {} }, svc);
      expect(lastParsed().error.code).toBe(400);
      expect(lastParsed().error.message).toContain("realmId");
    });

    it("calls cleanup with realmId", async () => {
      const cleanup = vi
        .fn()
        .mockResolvedValue({ deduplicatedCount: 3, archivedCount: 1, issuesResolved: 4 });
      const svc = {
        ...services,
        memoryHealthManager: { cleanup } as unknown as RpcServices["memoryHealthManager"],
      };
      const { ws, lastParsed } = createMockWs();
      await dispatchRpc(
        ws,
        { id: "1", method: RPC_METHODS.HEALTH_CLEAN, params: { realmId: "r1" } },
        svc,
      );
      expect(cleanup).toHaveBeenCalledWith("r1", undefined);
      expect(lastParsed().result.result.deduplicatedCount).toBe(3);
    });
  });

  describe("knowledge.inject handler", () => {
    it("returns 501 when knowledgeDistributor is not available", async () => {
      const { ws, lastParsed } = createMockWs();
      await dispatchRpc(
        ws,
        { id: "1", method: RPC_METHODS.KNOWLEDGE_INJECT, params: {} },
        services,
      );
      expect(lastParsed().error.code).toBe(501);
    });

    it("returns 400 when text is missing", async () => {
      const svc = {
        ...services,
        knowledgeDistributor: {
          distributeFromText: vi.fn(),
        } as unknown as RpcServices["knowledgeDistributor"],
      };
      const { ws, lastParsed } = createMockWs();
      await dispatchRpc(ws, { id: "1", method: RPC_METHODS.KNOWLEDGE_INJECT, params: {} }, svc);
      expect(lastParsed().error.code).toBe(400);
      expect(lastParsed().error.message).toContain("text");
    });

    it("calls distributeFromText with text", async () => {
      const distributeFromText = vi
        .fn()
        .mockResolvedValue({ facts: [], realmsAffected: [], memoriesCreated: 2 });
      const svc = {
        ...services,
        knowledgeDistributor: {
          distributeFromText,
        } as unknown as RpcServices["knowledgeDistributor"],
      };
      const { ws, lastParsed } = createMockWs();
      await dispatchRpc(
        ws,
        { id: "1", method: RPC_METHODS.KNOWLEDGE_INJECT, params: { text: "My cat is 3" } },
        svc,
      );
      expect(distributeFromText).toHaveBeenCalledWith("My cat is 3");
      expect(lastParsed().result.result.memoriesCreated).toBe(2);
    });
  });

  describe("maturity.scan handler", () => {
    it("returns 501 when maturityScanner is not available", async () => {
      const { ws, lastParsed } = createMockWs();
      await dispatchRpc(ws, { id: "1", method: RPC_METHODS.MATURITY_SCAN, params: {} }, services);
      expect(lastParsed().error.code).toBe(501);
    });

    it("calls scanRealm with realmId", async () => {
      const scanRealm = vi.fn().mockReturnValue([{ entityId: "e1", overall: 75 }]);
      const svc = {
        ...services,
        maturityScanner: {
          scanRealm,
          scanAll: vi.fn(),
        } as unknown as RpcServices["maturityScanner"],
      };
      const { ws, lastParsed } = createMockWs();
      await dispatchRpc(
        ws,
        { id: "1", method: RPC_METHODS.MATURITY_SCAN, params: { realmId: "r1" } },
        svc,
      );
      expect(scanRealm).toHaveBeenCalledWith("r1");
      expect(lastParsed().result.scores).toHaveLength(1);
    });

    it("calls scanAll without realmId", async () => {
      const scanAll = vi.fn().mockReturnValue([{ entityId: "e1", maturityScore: 65 }]);
      const svc = {
        ...services,
        maturityScanner: {
          scanRealm: vi.fn(),
          scanAll,
        } as unknown as RpcServices["maturityScanner"],
      };
      const { ws, lastParsed } = createMockWs();
      await dispatchRpc(ws, { id: "1", method: RPC_METHODS.MATURITY_SCAN, params: {} }, svc);
      expect(scanAll).toHaveBeenCalled();
      expect(lastParsed().result.suggestions).toHaveLength(1);
    });
  });

  describe("directory.scan handler", () => {
    it("returns 501 when directoryScanner is not available", async () => {
      const { ws, lastParsed } = createMockWs();
      await dispatchRpc(ws, { id: "1", method: RPC_METHODS.DIRECTORY_SCAN, params: {} }, services);
      expect(lastParsed().error.code).toBe(501);
    });

    it("returns 400 when path is missing", async () => {
      const svc = {
        ...services,
        directoryScanner: { scanDirectory: vi.fn() } as unknown as RpcServices["directoryScanner"],
      };
      const { ws, lastParsed } = createMockWs();
      await dispatchRpc(ws, { id: "1", method: RPC_METHODS.DIRECTORY_SCAN, params: {} }, svc);
      expect(lastParsed().error.code).toBe(400);
      expect(lastParsed().error.message).toContain("path");
    });

    it("calls scanDirectory with path", async () => {
      const scanDirectory = vi.fn().mockResolvedValue({
        filesScanned: 5,
        filesSkipped: 1,
        factsExtracted: 10,
        realmsAffected: ["pet"],
        errors: [],
      });
      const svc = {
        ...services,
        directoryScanner: { scanDirectory } as unknown as RpcServices["directoryScanner"],
      };
      const { ws, lastParsed } = createMockWs();
      await dispatchRpc(
        ws,
        { id: "1", method: RPC_METHODS.DIRECTORY_SCAN, params: { path: "/tmp/docs" } },
        svc,
      );
      expect(scanDirectory).toHaveBeenCalledWith("/tmp/docs", undefined);
      expect(lastParsed().result.result.filesScanned).toBe(5);
    });
  });
});
