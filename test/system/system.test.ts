/**
 * System tests — boot the real ink gateway and exercise full flows
 * through the WebSocket RPC protocol. No mocks, no stubs (except LLM).
 *
 * Tests run sequentially within each describe block because they share
 * server state (realm created in one test is used in the next).
 *
 * NOTE: The server loads REALM.md files from realms/ on startup, so
 * "finance" and "parents" realms may already exist. Tests use unique
 * names (prefixed with "test-") to avoid collisions.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { startTestServer, createRpcClient, type TestServer, type RpcClient } from "./helpers.js";

let server: TestServer;
let rpc: RpcClient;

// Track IDs across sequential tests
const state: Record<string, string> = {};

beforeAll(async () => {
  server = await startTestServer();
  rpc = await createRpcClient(server.wsUrl);
});

afterAll(async () => {
  rpc?.close();
  await server?.server.close();
});

// ── Flow 1: Health Check ──────────────────────────────────────────

describe("Flow 1: Server health", () => {
  it("status.health returns ok", async () => {
    const resp = await rpc.call("status.health");
    expect(resp.error).toBeUndefined();
    expect(resp.result).toMatchObject({ status: "ok", service: "openoctopus-ink" });
  });

  it("status.info returns system state", async () => {
    const resp = await rpc.call("status.info");
    expect(resp.error).toBeUndefined();
    const result = resp.result as Record<string, unknown>;
    expect(result.realms).toBeDefined();
    expect(result.uptime).toBeDefined();
    expect(result.timestamp).toBeDefined();
  });
});

// ── Flow 2: Realm CRUD ────────────────────────────────────────────

describe("Flow 2: Realm CRUD", () => {
  it("realm.create creates a new realm", async () => {
    const resp = await rpc.call("realm.create", {
      name: "test-pet",
      description: "Test pet care",
    });
    expect(resp.error).toBeUndefined();
    const result = resp.result as { realm: { id: string; name: string } };
    expect(result.realm.name).toBe("test-pet");
    expect(result.realm.id).toMatch(/^realm_/);
    state.petRealmId = result.realm.id;
  });

  it("realm.create creates a second realm", async () => {
    const resp = await rpc.call("realm.create", {
      name: "test-finance",
      description: "Test finance",
    });
    expect(resp.error).toBeUndefined();
    const result = resp.result as { realm: { id: string } };
    state.financeRealmId = result.realm.id;
  });

  it("realm.list includes test realms", async () => {
    const resp = await rpc.call("realm.list");
    expect(resp.error).toBeUndefined();
    const result = resp.result as { realms: Array<{ name: string }> };
    const names = result.realms.map((r) => r.name);
    expect(names).toContain("test-pet");
    expect(names).toContain("test-finance");
  });

  it("realm.get returns realm detail", async () => {
    const resp = await rpc.call("realm.get", { id: state.petRealmId });
    expect(resp.error).toBeUndefined();
    const result = resp.result as { realm: { name: string; entities: unknown[] } };
    expect(result.realm.name).toBe("test-pet");
    expect(result.realm.entities).toEqual([]);
  });

  it("realm.update modifies realm", async () => {
    const resp = await rpc.call("realm.update", {
      id: state.petRealmId,
      description: "Test pet care and wellness",
    });
    expect(resp.error).toBeUndefined();
  });

  it("realm.create rejects missing name", async () => {
    const resp = await rpc.call("realm.create", {});
    expect(resp.error).toBeDefined();
    expect(resp.error!.code).toBe(400);
  });
});

// ── Flow 3: Entity CRUD ──────────────────────────────────────────

describe("Flow 3: Entity CRUD", () => {
  it("entity.create creates an entity in the test realm", async () => {
    const resp = await rpc.call("entity.create", {
      realmId: state.petRealmId,
      name: "Luna",
      type: "living",
      attributes: { breed: "tabby", age: 3 },
    });
    expect(resp.error).toBeUndefined();
    const result = resp.result as { entity: { id: string; name: string; type: string } };
    expect(result.entity.name).toBe("Luna");
    expect(result.entity.type).toBe("living");
    state.lunaEntityId = result.entity.id;
  });

  it("entity.list returns entities in realm", async () => {
    const resp = await rpc.call("entity.list", { realmId: state.petRealmId });
    expect(resp.error).toBeUndefined();
    const result = resp.result as { entities: Array<{ name: string }> };
    expect(result.entities.length).toBeGreaterThanOrEqual(1);
    expect(result.entities.some((e) => e.name === "Luna")).toBe(true);
  });

  it("entity.get returns entity detail", async () => {
    const resp = await rpc.call("entity.get", { id: state.lunaEntityId });
    expect(resp.error).toBeUndefined();
    const result = resp.result as {
      entity: { name: string; attributes: Record<string, unknown> };
    };
    expect(result.entity.name).toBe("Luna");
    expect(result.entity.attributes).toMatchObject({ breed: "tabby", age: 3 });
  });

  it("entity.update modifies entity", async () => {
    const resp = await rpc.call("entity.update", {
      id: state.lunaEntityId,
      attributes: { breed: "tabby", age: 4, color: "orange" },
    });
    expect(resp.error).toBeUndefined();
  });

  it("entity.create rejects missing realmId", async () => {
    const resp = await rpc.call("entity.create", { name: "Bad" });
    expect(resp.error).toBeDefined();
    expect(resp.error!.code).toBe(400);
  });

  it("realm.get now includes Luna", async () => {
    const resp = await rpc.call("realm.get", { id: state.petRealmId });
    const result = resp.result as { realm: { entities: Array<{ name: string }> } };
    expect(result.realm.entities.some((e) => e.name === "Luna")).toBe(true);
  });
});

// ── Flow 4: Chat Routing ──────────────────────────────────────────

describe("Flow 4: Chat routing", () => {
  it("chat.send with message returns a response", async () => {
    const { response, events } = await rpc.callWithEvents(
      "chat.send",
      { message: "Hello, how are you?" },
      "chat.token",
    );
    expect(response.error).toBeUndefined();
    const result = response.result as { sessionId: string; message: { content: string } };
    expect(result.sessionId).toMatch(/^session_/);
    expect(result.message.content).toBeDefined();
    // Should have streaming token events
    expect(events.length).toBeGreaterThan(0);
    state.sessionId = result.sessionId;
  });

  it("chat.send with sessionId continues conversation", async () => {
    const resp = await rpc.call("chat.send", {
      message: "Tell me more",
      sessionId: state.sessionId,
    });
    expect(resp.error).toBeUndefined();
    const result = resp.result as { sessionId: string };
    expect(result.sessionId).toBe(state.sessionId);
  });

  it("chat.send with realmId routes to specific realm", async () => {
    const resp = await rpc.call("chat.send", {
      message: "How is Luna doing?",
      realmId: state.petRealmId,
    });
    expect(resp.error).toBeUndefined();
    const result = resp.result as { message: { content: string } };
    expect(result.message.content).toBeDefined();
  });

  it("chat.send rejects missing message", async () => {
    const resp = await rpc.call("chat.send", {});
    expect(resp.error).toBeDefined();
    expect(resp.error!.code).toBe(400);
  });
});

// ── Flow 5: Summon Lifecycle ──────────────────────────────────────

describe("Flow 5: Summon lifecycle", () => {
  it("summon.list returns empty initially", async () => {
    const resp = await rpc.call("summon.list");
    expect(resp.error).toBeUndefined();
    const result = resp.result as { summoned: unknown[] };
    expect(result.summoned).toHaveLength(0);
  });

  it("summon.invoke fails for entity without SOUL.md", async () => {
    const resp = await rpc.call("summon.invoke", { entityId: state.lunaEntityId });
    // Should fail because Luna has no soulPath
    expect(resp.error).toBeDefined();
  });

  it("summon.invoke rejects missing entityId", async () => {
    const resp = await rpc.call("summon.invoke", {});
    expect(resp.error).toBeDefined();
    expect(resp.error!.code).toBe(400);
  });
});

// ── Flow 6: Family System ─────────────────────────────────────────

describe("Flow 6: Family system", () => {
  it("family.list returns empty initially", async () => {
    const resp = await rpc.call("family.list");
    expect(resp.error).toBeUndefined();
    const result = resp.result as { members: unknown[] };
    expect(result.members).toHaveLength(0);
  });

  it("family.add creates a family member", async () => {
    const resp = await rpc.call("family.add", {
      name: "TestDad",
      nickname: "Papa",
      roles: ["scheduler", "executor"],
      realmIds: [state.petRealmId],
    });
    expect(resp.error).toBeUndefined();
    const result = resp.result as { member: { id: string; name: string; roles: string[] } };
    expect(result.member.name).toBe("TestDad");
    expect(result.member.roles).toEqual(["scheduler", "executor"]);
    state.dadMemberId = result.member.id;
  });

  it("family.add creates a second member", async () => {
    const resp = await rpc.call("family.add", {
      name: "TestMom",
      roles: ["caretaker", "coordinator"],
    });
    expect(resp.error).toBeUndefined();
    const result = resp.result as { member: { id: string } };
    state.momMemberId = result.member.id;
  });

  it("family.list returns both members", async () => {
    const resp = await rpc.call("family.list");
    expect(resp.error).toBeUndefined();
    const result = resp.result as { members: Array<{ name: string }> };
    expect(result.members).toHaveLength(2);
  });

  it("family.update modifies a member", async () => {
    const resp = await rpc.call("family.update", {
      id: state.dadMemberId,
      nickname: "Daddy",
    });
    expect(resp.error).toBeUndefined();
    const result = resp.result as { member: { nickname: string } };
    expect(result.member.nickname).toBe("Daddy");
  });

  it("family.actions returns empty initially", async () => {
    const resp = await rpc.call("family.actions", {});
    expect(resp.error).toBeUndefined();
    const result = resp.result as { actions: unknown[] };
    expect(result.actions).toHaveLength(0);
  });

  it("family.add rejects missing name", async () => {
    const resp = await rpc.call("family.add", {});
    expect(resp.error).toBeDefined();
    expect(resp.error!.code).toBe(400);
  });

  it("family.delete removes a member", async () => {
    const addResp = await rpc.call("family.add", { name: "TempSibling", roles: [] });
    const tempId = (addResp.result as { member: { id: string } }).member.id;

    const resp = await rpc.call("family.delete", { id: tempId });
    expect(resp.error).toBeUndefined();

    const listResp = await rpc.call("family.list");
    const members = (listResp.result as { members: Array<{ name: string }> }).members;
    expect(members.find((m) => m.name === "TempSibling")).toBeUndefined();
  });
});

// ── Flow 7: Knowledge Lifecycle ───────────────────────────────────

describe("Flow 7: Knowledge lifecycle", () => {
  it("knowledge.inject distributes text to realms", async () => {
    const resp = await rpc.call("knowledge.inject", {
      text: "My cat Luna likes fish and napping in the sun",
    });
    expect(resp.error).toBeUndefined();
    const result = resp.result as { result: { memoriesCreated: number } };
    expect(result.result.memoriesCreated).toBeGreaterThanOrEqual(0);
  });

  it("health.report returns health data for test realm", async () => {
    const resp = await rpc.call("health.report", { realmId: state.petRealmId });
    expect(resp.error).toBeUndefined();
    const result = resp.result as {
      report: { healthScore: number; realmId: string; memoryCount: number };
    };
    expect(result.report.realmId).toBe(state.petRealmId);
    expect(result.report.healthScore).toBeGreaterThanOrEqual(0);
    expect(result.report.healthScore).toBeLessThanOrEqual(100);
  });

  it("health.report without realmId returns all realms", async () => {
    const resp = await rpc.call("health.report", {});
    expect(resp.error).toBeUndefined();
    const result = resp.result as { reports: Array<{ realmId: string }> };
    expect(result.reports.length).toBeGreaterThanOrEqual(2);
  });

  it("maturity.scan returns scores for realm with entity", async () => {
    const resp = await rpc.call("maturity.scan", { realmId: state.petRealmId });
    expect(resp.error).toBeUndefined();
    const result = resp.result as { scores: Array<{ entityName: string; overall: number }> };
    expect(result.scores.length).toBeGreaterThanOrEqual(1);
    const luna = result.scores.find((s) => s.entityName === "Luna");
    expect(luna).toBeDefined();
    expect(luna!.overall).toBeGreaterThanOrEqual(0);
  });

  it("maturity.scan without realmId returns all suggestions", async () => {
    const resp = await rpc.call("maturity.scan", {});
    expect(resp.error).toBeUndefined();
    const result = resp.result as { suggestions: unknown[] };
    expect(result.suggestions).toBeDefined();
  });

  it("knowledge.inject rejects missing text", async () => {
    const resp = await rpc.call("knowledge.inject", {});
    expect(resp.error).toBeDefined();
    expect(resp.error!.code).toBe(400);
  });

  it("health.clean cleans up realm memories", async () => {
    const resp = await rpc.call("health.clean", { realmId: state.petRealmId });
    expect(resp.error).toBeUndefined();
    const result = resp.result as { result: { deduplicatedCount: number } };
    expect(result.result.deduplicatedCount).toBeGreaterThanOrEqual(0);
  });
});

// ── Flow 8: Error Handling ────────────────────────────────────────

describe("Flow 8: Error handling", () => {
  it("unknown method returns 404", async () => {
    const resp = await rpc.call("nonexistent.method");
    expect(resp.error).toBeDefined();
    expect(resp.error!.code).toBe(404);
  });

  it("realm.get with invalid ID returns error", async () => {
    const resp = await rpc.call("realm.get", { id: "realm_does_not_exist" });
    expect(resp.error).toBeDefined();
  });

  it("entity.get with invalid ID returns error", async () => {
    const resp = await rpc.call("entity.get", { id: "entity_does_not_exist" });
    expect(resp.error).toBeDefined();
  });
});

// ── Flow 9: Cleanup ──────────────────────────────────────────────

describe("Flow 9: Cleanup", () => {
  it("entity.delete removes test entity", async () => {
    const resp = await rpc.call("entity.delete", { id: state.lunaEntityId });
    expect(resp.error).toBeUndefined();
    const result = resp.result as { success: boolean };
    expect(result.success).toBe(true);
  });

  it("realm.delete removes test realms", async () => {
    const resp1 = await rpc.call("realm.delete", { id: state.petRealmId });
    expect(resp1.error).toBeUndefined();

    const resp2 = await rpc.call("realm.delete", { id: state.financeRealmId });
    expect(resp2.error).toBeUndefined();
  });

  it("realm.list no longer contains test realms", async () => {
    const resp = await rpc.call("realm.list");
    const result = resp.result as { realms: Array<{ name: string }> };
    const names = result.realms.map((r) => r.name);
    expect(names).not.toContain("test-pet");
    expect(names).not.toContain("test-finance");
  });
});
