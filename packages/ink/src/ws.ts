import type { IncomingMessage } from "node:http";
import { createLogger, RpcRequestSchema, createRpcResponse } from "@openoctopus/shared";
import WebSocket, { type WebSocketServer } from "ws";
import { dispatchRpc, type RpcServices } from "./rpc-handlers.js";

const log = createLogger("ws");

interface WsSecurityOptions {
  /** Max WebSocket connections per IP within the window (default: 10) */
  maxConnectionsPerIp?: number;
  /** Connection rate-limit window in ms (default: 60_000) */
  connectionWindowMs?: number;
  /** Max incoming message size in bytes (default: 65_536) */
  maxMessageSize?: number;
}

export interface WsBroadcaster {
  broadcast: (data: unknown) => void;
}

function getClientIp(req: IncomingMessage): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    return forwarded.split(",")[0].trim();
  }
  return req.socket.remoteAddress ?? "unknown";
}

export function setupWebSocket(
  wss: WebSocketServer,
  services?: RpcServices,
  security: WsSecurityOptions = {},
): WsBroadcaster {
  const clients = new Set<WebSocket>();
  const maxConnections = security.maxConnectionsPerIp ?? 10;
  const windowMs = security.connectionWindowMs ?? 60_000;
  const maxMessageSize = security.maxMessageSize ?? 65_536;

  // Connection rate limiter: Map<ip, timestamps[]>
  const connectionTimestamps = new Map<string, number[]>();

  function isRateLimited(ip: string): boolean {
    const now = Date.now();
    const timestamps = connectionTimestamps.get(ip) ?? [];
    // Remove timestamps outside the window
    const recent = timestamps.filter((t) => now - t < windowMs);
    connectionTimestamps.set(ip, recent);
    return recent.length >= maxConnections;
  }

  function recordConnection(ip: string): void {
    const timestamps = connectionTimestamps.get(ip) ?? [];
    timestamps.push(Date.now());
    connectionTimestamps.set(ip, timestamps);
  }

  wss.on("connection", (ws, req) => {
    const ip = getClientIp(req);

    if (isRateLimited(ip)) {
      log.warn(`WebSocket connection rate limited for ${ip}`);
      ws.close(1008, "Connection rate limit exceeded");
      return;
    }

    recordConnection(ip);
    clients.add(ws);
    log.info(`WebSocket client connected (${clients.size} total)`);

    ws.on("message", (data) => {
      let buf: Buffer;
      if (Array.isArray(data)) {
        buf = Buffer.concat(data);
      } else if (Buffer.isBuffer(data)) {
        buf = data;
      } else {
        buf = Buffer.from(data);
      }
      const byteLength = buf.length;
      if (byteLength > maxMessageSize) {
        ws.send(
          JSON.stringify({
            type: "error",
            payload: { message: `Message too large (${byteLength} > ${maxMessageSize} bytes)` },
          }),
        );
        return;
      }

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
