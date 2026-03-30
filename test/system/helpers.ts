/**
 * System test helpers — boot a real ink server with in-memory DB,
 * connect via WebSocket, and provide RPC request/response helpers.
 */

import type { InkServer } from "@openoctopus/ink";
import { createServer } from "@openoctopus/ink";
import type { RpcResponse, RpcEvent } from "@openoctopus/shared";
import WebSocket from "ws";

export interface TestServer {
  server: InkServer;
  wsUrl: string;
  httpUrl: string;
}

/**
 * Start a real ink server with:
 * - In-memory SQLite (fast, isolated)
 * - OS-assigned random ports (no conflicts)
 * - No REALM.md loading (empty realms dir)
 * - Stub LLM (no API keys needed)
 */
export async function startTestServer(): Promise<TestServer> {
  const server = await createServer({
    port: 0, // OS picks free port
    wsPort: 0, // OS picks free port
    database: { inMemory: true },
    config: {
      gateway: { wsPort: 0, httpPort: 0, host: "127.0.0.1", bind: "loopback" },
      llm: {}, // No providers → stub mode
      embeddings: {},
      channels: {},
      storage: { dataDir: "", database: "sqlite" },
      logging: { level: "error", format: "pretty" }, // Quiet during tests
    },
  });

  // Extract the actual ports assigned by the OS
  const httpAddr = server.httpServer.address();
  const wsAddr = server.wsServer.address();
  const httpPort = typeof httpAddr === "object" && httpAddr ? httpAddr.port : 0;
  const wsPort = typeof wsAddr === "object" && wsAddr ? wsAddr.port : 0;

  return {
    server,
    wsUrl: `ws://127.0.0.1:${wsPort}`,
    httpUrl: `http://127.0.0.1:${httpPort}`,
  };
}

export interface RpcClient {
  ws: WebSocket;
  /** Send an RPC request and wait for the matching response */
  call: (method: string, params?: Record<string, unknown>) => Promise<RpcResponse>;
  /** Collect events matching a filter during a call */
  callWithEvents: (
    method: string,
    params?: Record<string, unknown>,
    eventFilter?: string,
  ) => Promise<{ response: RpcResponse; events: RpcEvent[] }>;
  close: () => void;
}

let rpcCounter = 0;

/**
 * Connect a WebSocket client to the test server and return typed RPC helpers.
 */
export function createRpcClient(wsUrl: string): Promise<RpcClient> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const pending = new Map<
      string,
      {
        resolve: (resp: RpcResponse) => void;
        reject: (err: Error) => void;
        events: RpcEvent[];
        eventFilter?: string;
      }
    >();

    ws.on("open", () => {
      resolve({
        ws,

        call(method, params = {}) {
          const id = `test_${++rpcCounter}`;
          return new Promise((res, rej) => {
            pending.set(id, { resolve: res, reject: rej, events: [] });
            ws.send(JSON.stringify({ id, method, params }));

            // Timeout after 10s
            setTimeout(() => {
              if (pending.has(id)) {
                pending.delete(id);
                rej(new Error(`RPC timeout: ${method} (id=${id})`));
              }
            }, 10_000);
          });
        },

        callWithEvents(method, params = {}, eventFilter) {
          const id = `test_${++rpcCounter}`;
          return new Promise((res, rej) => {
            pending.set(id, { resolve: () => {}, reject: rej, events: [], eventFilter });

            // Override resolve to also return events
            const entry = pending.get(id)!;
            entry.resolve = (resp) => {
              const events = entry.events;
              pending.delete(id);
              res({ response: resp, events });
            };

            ws.send(JSON.stringify({ id, method, params }));

            setTimeout(() => {
              if (pending.has(id)) {
                pending.delete(id);
                rej(new Error(`RPC timeout: ${method} (id=${id})`));
              }
            }, 10_000);
          });
        },

        close() {
          ws.close();
        },
      });
    });

    ws.on("message", (data) => {
      const msg = JSON.parse(data.toString()) as Record<string, unknown>;

      // RPC Response (has "id" field)
      if ("id" in msg && typeof msg.id === "string") {
        const entry = pending.get(msg.id);
        if (entry) {
          entry.resolve(msg as unknown as RpcResponse);
          if (!entry.eventFilter) {
            pending.delete(msg.id);
          }
        }
        return;
      }

      // RPC Event (has "event" field)
      if ("event" in msg && typeof msg.event === "string") {
        const event = msg as unknown as RpcEvent;
        // Attach to matching pending request
        if (event.requestId) {
          const entry = pending.get(event.requestId);
          if (entry && (!entry.eventFilter || event.event === entry.eventFilter)) {
            entry.events.push(event);
          }
        }
      }
    });

    ws.on("error", reject);

    // Timeout connection attempt
    setTimeout(() => reject(new Error("WebSocket connection timeout")), 5_000);
  });
}
