import { createLogger, RpcRequestSchema, createRpcResponse } from "@openoctopus/shared";
import WebSocket, { type WebSocketServer } from "ws";
import { dispatchRpc, type RpcServices } from "./rpc-handlers.js";

const log = createLogger("ws");

export interface WsBroadcaster {
  broadcast: (data: unknown) => void;
}

export function setupWebSocket(wss: WebSocketServer, services?: RpcServices): WsBroadcaster {
  const clients = new Set<WebSocket>();

  wss.on("connection", (ws) => {
    clients.add(ws);
    log.info(`WebSocket client connected (${clients.size} total)`);

    ws.on("message", (data) => {
      let raw: Record<string, unknown>;
      try {
        raw = JSON.parse(data.toString()) as Record<string, unknown>;
      } catch {
        ws.send(JSON.stringify({ type: "error", payload: { message: "Invalid JSON" } }));
        return;
      }

      // RPC protocol: if it has `id` + `method`, treat as RPC request
      if (raw.id && raw.method && services) {
        const parsed = RpcRequestSchema.safeParse(raw);
        if (parsed.success) {
          dispatchRpc(ws, parsed.data, services).catch((err) => {
            log.error(`RPC dispatch error: ${err instanceof Error ? err.message : String(err)}`);
          });
          return;
        }

        // RPC parse failed but has an id — send error response
        ws.send(
          JSON.stringify(
            createRpcResponse(raw.id as string, undefined, {
              code: 400,
              message: "Invalid RPC request format",
            }),
          ),
        );
        return;
      }

      // Legacy protocol: handle simple type-based messages
      handleLegacyMessage(ws, raw);
    });

    ws.on("error", (err) => {
      log.error(`WebSocket error: ${err.message}`);
    });

    ws.on("close", () => {
      clients.delete(ws);
      log.info(`WebSocket client disconnected (${clients.size} total)`);
    });

    // Send welcome
    ws.send(
      JSON.stringify({
        type: "connected",
        payload: { service: "openoctopus-ink", protocol: "rpc" },
      }),
    );
  });

  return {
    broadcast: (data) => {
      const msg = JSON.stringify(data);
      for (const client of clients) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(msg);
        }
      }
    },
  };
}

function handleLegacyMessage(ws: WebSocket, msg: Record<string, unknown>): void {
  switch (msg.type) {
    case "ping":
      ws.send(JSON.stringify({ type: "pong" }));
      break;

    case "subscribe":
      ws.send(JSON.stringify({ type: "subscribed", payload: msg.payload }));
      break;

    default:
      ws.send(
        JSON.stringify({
          type: "error",
          payload: { message: `Unknown message type: ${String(msg.type)}` },
        }),
      );
  }
}
