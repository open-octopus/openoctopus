import type { OpenOctopusConfig } from "@openoctopus/shared";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import WebSocket from "ws";
import { createServer } from "./server.js";
import type { InkServer, InkServerOptions } from "./server.js";

function getPort(server: InkServer): number {
  const addr = server.httpServer.address();
  if (addr && typeof addr === "object") {
    return addr.port;
  }
  throw new Error("Server not listening");
}

const testConfig: OpenOctopusConfig = {
  gateway: { wsPort: 0, httpPort: 0, host: "127.0.0.1", bind: "loopback" },
  llm: { defaultProvider: "stub", defaultModel: "stub", providers: {} },
  embeddings: { defaultProvider: "stub", defaultModel: "stub", providers: {} },
  channels: {},
  storage: { dataDir: "", database: "sqlite" },
  logging: { level: "error" },
};

const serverOptions: InkServerOptions = {
  port: 0,
  wsPort: 0,
  database: { inMemory: true },
  config: testConfig,
};

describe("Ink Server Integration", () => {
  let server: InkServer;

  beforeAll(async () => {
    server = await createServer(serverOptions);
  }, 30_000);

  afterAll(async () => {
    await server.close();
  }, 10_000);

  it("starts successfully and assigns a random port", () => {
    const port = getPort(server);
    expect(port).toBeGreaterThan(0);
  });

  it("GET /healthz returns ok", async () => {
    const port = getPort(server);
    const res = await fetch(`http://127.0.0.1:${port}/healthz`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; service: string };
    expect(body.status).toBe("ok");
    expect(body.service).toBe("openoctopus-ink");
  });

  it("GET /readyz returns ready with metadata", async () => {
    const port = getPort(server);
    const res = await fetch(`http://127.0.0.1:${port}/readyz`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; llm: unknown; channels: unknown };
    expect(body.status).toBe("ready");
    expect(body.llm).toBeDefined();
    expect(body.channels).toBeDefined();
  });

  it("GET /api/realms returns loaded realms", async () => {
    const port = getPort(server);
    const res = await fetch(`http://127.0.0.1:${port}/api/realms`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: Array<Record<string, unknown>> };
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
  });

  it("POST /api/realms creates a new realm", async () => {
    const port = getPort(server);
    const uniqueName = `TestRealm-${Date.now()}`;
    const res = await fetch(`http://127.0.0.1:${port}/api/realms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: uniqueName, description: "Integration test realm" }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { data: { name: string; id: string } };
    expect(body.data.name).toBe(uniqueName);
    expect(body.data.id).toMatch(/^realm_/);
  });

  it("GET /api/entities returns entities for a realm", async () => {
    const port = getPort(server);

    // Get a realm ID first
    const realmsRes = await fetch(`http://127.0.0.1:${port}/api/realms`);
    const realmsBody = (await realmsRes.json()) as { data: Array<{ id: string }> };
    const realmId = realmsBody.data[0]?.id;
    expect(realmId).toBeDefined();

    const res = await fetch(`http://127.0.0.1:${port}/api/entities?realmId=${realmId}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: unknown[] };
    expect(Array.isArray(body.data)).toBe(true);
  });

  it("POST /api/chat returns a response", async () => {
    const port = getPort(server);
    const res = await fetch(`http://127.0.0.1:${port}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "hello" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { message: unknown; sessionId: unknown } };
    expect(body.data.message).toBeDefined();
    expect(body.data.sessionId).toBeDefined();
  });

  it("WebSocket /ws accepts connections and sends welcome", async () => {
    const port = getPort(server);
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);

    const message = await new Promise<string>((resolve, reject) => {
      ws.once("message", (data) => resolve(data.toString()));
      ws.once("error", reject);
      setTimeout(() => reject(new Error("WS timeout")), 5000);
    });

    const parsed = JSON.parse(message);
    expect(parsed.type).toBe("connected");
    expect(parsed.payload.service).toBe("openoctopus-ink");

    ws.close();
  });

  it("WebSocket RPC request returns a response", async () => {
    const port = getPort(server);
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);

    // Attach message listener before awaiting open to avoid race condition
    let welcomeReceived = false;
    ws.once("message", () => {
      welcomeReceived = true;
    });

    await new Promise<void>((resolve, reject) => {
      ws.once("open", resolve);
      ws.once("error", reject);
      setTimeout(() => reject(new Error("WS open timeout")), 5000);
    });

    // If welcome wasn't received before open, wait for it now
    if (!welcomeReceived) {
      await new Promise<void>((resolve, reject) => {
        ws.once("message", () => resolve());
        setTimeout(() => reject(new Error("Welcome message timeout")), 5000);
      });
    }

    const rpcRequest = {
      jsonrpc: "2.0",
      id: "rpc-1",
      method: "status.info",
      params: {},
    };

    ws.send(JSON.stringify(rpcRequest));

    const response = await new Promise<string>((resolve, reject) => {
      ws.once("message", (data) => resolve(data.toString()));
      setTimeout(() => reject(new Error("RPC timeout")), 5000);
    });

    const parsed = JSON.parse(response);
    expect(parsed.id).toBe("rpc-1");
    expect(parsed.result).toBeDefined();
    expect(parsed.result.realms).toBeGreaterThanOrEqual(0);

    ws.close();
  });
});
