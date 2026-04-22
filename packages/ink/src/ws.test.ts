import http from "node:http";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import WebSocket, { WebSocketServer } from "ws";
import { setupWebSocket } from "./ws.js";

describe("setupWebSocket security", () => {
  let server: http.Server;
  let wss: WebSocketServer;
  let port: number;

  beforeEach(async () => {
    server = http.createServer((_req, res) => {
      res.writeHead(426);
      res.end("Upgrade required");
    });
    wss = new WebSocketServer({ server });

    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve());
    });

    const addr = server.address();
    port = typeof addr === "object" && addr ? addr.port : 0;
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
    wss.close();
  });

  it("allows normal connections within rate limit", async () => {
    setupWebSocket(wss, undefined, { maxConnectionsPerIp: 3, connectionWindowMs: 60_000 });

    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    await new Promise<void>((resolve, reject) => {
      ws.once("open", resolve);
      ws.once("error", reject);
    });

    expect(ws.readyState).toBe(WebSocket.OPEN);
    ws.close();
  });

  it("rejects connections exceeding per-IP rate limit", async () => {
    setupWebSocket(wss, undefined, { maxConnectionsPerIp: 2, connectionWindowMs: 60_000 });

    const ws1 = new WebSocket(`ws://127.0.0.1:${port}`);
    const ws2 = new WebSocket(`ws://127.0.0.1:${port}`);

    await Promise.all([
      new Promise<void>((resolve, reject) => {
        ws1.once("open", resolve);
        ws1.once("error", reject);
      }),
      new Promise<void>((resolve, reject) => {
        ws2.once("open", resolve);
        ws2.once("error", reject);
      }),
    ]);

    const ws3 = new WebSocket(`ws://127.0.0.1:${port}`);
    const closeCode = await new Promise<number>((resolve) => {
      ws3.once("close", (code) => resolve(code));
    });

    expect(closeCode).toBe(1008);
    ws1.close();
    ws2.close();
  });

  it("resets rate limit after window expires", async () => {
    setupWebSocket(wss, undefined, { maxConnectionsPerIp: 1, connectionWindowMs: 50 });

    const ws1 = new WebSocket(`ws://127.0.0.1:${port}`);
    await new Promise<void>((resolve, reject) => {
      ws1.once("open", resolve);
      ws1.once("error", reject);
    });
    ws1.close();

    // Wait for window to expire
    await new Promise((r) => setTimeout(r, 100));

    const ws2 = new WebSocket(`ws://127.0.0.1:${port}`);
    await new Promise<void>((resolve, reject) => {
      ws2.once("open", resolve);
      ws2.once("error", reject);
    });

    expect(ws2.readyState).toBe(WebSocket.OPEN);
    ws2.close();
  });

  it("rejects messages exceeding max size", async () => {
    setupWebSocket(wss, undefined, { maxMessageSize: 100 });

    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    await new Promise<void>((resolve, reject) => {
      ws.once("open", resolve);
      ws.once("error", reject);
    });

    const largePayload = JSON.stringify({ type: "ping", data: "x".repeat(200) });
    ws.send(largePayload);

    const errorMsg = await new Promise<string>((resolve) => {
      ws.once("message", (data) => {
        const msg = JSON.parse(data.toString()) as { type: string; payload: { message: string } };
        resolve(msg.payload.message);
      });
    });

    expect(errorMsg).toContain("Message too large");
    ws.close();
  });

  it("allows messages within size limit", async () => {
    setupWebSocket(wss, undefined, { maxMessageSize: 1024 });

    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    await new Promise<void>((resolve, reject) => {
      ws.once("open", resolve);
      ws.once("error", reject);
    });

    ws.send(JSON.stringify({ type: "ping" }));

    const msg = await new Promise<string>((resolve) => {
      ws.once("message", (data) => {
        const parsed = JSON.parse(data.toString()) as { type: string };
        resolve(parsed.type);
      });
    });

    expect(msg).toBe("pong");
    ws.close();
  });
});
