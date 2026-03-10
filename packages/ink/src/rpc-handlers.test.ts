import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@openoctopus/storage", () => ({
  readTranscript: vi.fn(() => ({ messages: [] })),
  appendMessage: vi.fn(),
}));

import { dispatchRpc } from "./rpc-handlers.js";
import type { RpcServices } from "./rpc-handlers.js";
import { RPC_METHODS, NotFoundError } from "@openoctopus/shared";

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
          response: { role: "assistant", content: "Hello World", timestamp: new Date().toISOString() },
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
      expect(lastParsed().result.realms).toEqual([{ id: "realm_1", name: "Pet" }]);
    });

    it("realm.create creates realm", async () => {
      const { ws, lastParsed } = createMockWs();
      await dispatchRpc(ws, { id: "1", method: RPC_METHODS.REALM_CREATE, params: { name: "Finance" } }, services);
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
      await dispatchRpc(ws, { id: "1", method: RPC_METHODS.CHAT_SEND, params: { message: "hi" } }, services);
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
      (services.realmManager.get as ReturnType<typeof vi.fn>).mockImplementation(() => { throw new NotFoundError("Realm", "realm_bad"); });

      const { ws, lastParsed } = createMockWs();
      await dispatchRpc(ws, { id: "1", method: RPC_METHODS.REALM_GET, params: { id: "realm_bad" } }, services);
      expect(lastParsed().error.code).toBe(404);
    });
  });
});
