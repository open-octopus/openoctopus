import WebSocket from "ws";
import {
  DEFAULT_HTTP_PORT,
  DEFAULT_WS_PORT,
  type RpcResponse,
  type RpcEvent,
  createRpcRequest,
  RPC_METHODS,
  RPC_EVENTS,
} from "@openoctopus/shared";

// ── HTTP API Client (bridge on port 18790) ──

export class ApiClient {
  private baseUrl: string;

  constructor(port?: number) {
    const p = port ?? (Number(process.env.OPENOCTOPUS_PORT) || DEFAULT_HTTP_PORT);
    this.baseUrl = `http://localhost:${p}`;
  }

  async get<T>(path: string): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`);
    if (!res.ok) {
      const body = (await res.json()) as { message?: string };
      throw new Error(body.message ?? `Request failed: ${res.status}`);
    }
    return (await res.json()) as T;
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const resBody = (await res.json()) as { message?: string };
      throw new Error(resBody.message ?? `Request failed: ${res.status}`);
    }
    return (await res.json()) as T;
  }

  async patch<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const resBody = (await res.json()) as { message?: string };
      throw new Error(resBody.message ?? `Request failed: ${res.status}`);
    }
    return (await res.json()) as T;
  }

  async delete(path: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}${path}`, { method: "DELETE" });
    if (!res.ok && res.status !== 204) {
      const body = (await res.json()) as { message?: string };
      throw new Error(body.message ?? `Request failed: ${res.status}`);
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.get("/healthz");
      return true;
    } catch {
      return false;
    }
  }
}

// ── WebSocket RPC Client (gateway on port 18789) ──
// Aligned with OpenClaw's WS RPC protocol for CLI-to-gateway communication

export type WsEventHandler = (event: string, data: unknown) => void;

export class WsRpcClient {
  private ws: WebSocket | undefined;
  private port: number;
  private host: string;
  private pendingRequests = new Map<string, {
    resolve: (value: RpcResponse) => void;
    reject: (error: Error) => void;
    onToken?: (token: string) => void;
  }>();
  private connected = false;
  private eventHandlers: WsEventHandler[] = [];

  constructor(port?: number, host?: string) {
    this.port = port ?? (Number(process.env.OPENOCTOPUS_WS_PORT) || DEFAULT_WS_PORT);
    this.host = host ?? "localhost";
  }

  async connect(): Promise<void> {
    if (this.connected) { return; }

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(`ws://${this.host}:${this.port}`);

      this.ws.on("open", () => {
        this.connected = true;
        resolve();
      });

      this.ws.on("message", (data) => {
        try {
          const msg = JSON.parse(data.toString()) as Record<string, unknown>;

          // RPC Response
          if (msg.id && (msg.result !== undefined || msg.error !== undefined)) {
            const pending = this.pendingRequests.get(msg.id as string);
            if (pending) {
              this.pendingRequests.delete(msg.id as string);
              pending.resolve(msg as unknown as RpcResponse);
            }
            return;
          }

          // RPC Event (streaming tokens + broadcast events)
          if (msg.event) {
            const event = msg as unknown as RpcEvent;
            if (event.event === RPC_EVENTS.TOKEN && event.requestId) {
              const pending = this.pendingRequests.get(event.requestId);
              if (pending?.onToken) {
                const tokenData = event.data as { token: string };
                pending.onToken(tokenData.token);
              }
            }

            // Notify registered event handlers for broadcast events
            for (const handler of this.eventHandlers) {
              handler(event.event, event.data);
            }
          }
        } catch {
          // Ignore parse errors
        }
      });

      this.ws.on("error", (err) => {
        if (!this.connected) {
          reject(err);
        }
      });

      this.ws.on("close", () => {
        this.connected = false;
        // Reject all pending requests
        for (const [id, pending] of this.pendingRequests) {
          pending.reject(new Error("WebSocket connection closed"));
          this.pendingRequests.delete(id);
        }
      });
    });
  }

  async disconnect(): Promise<void> {
    if (this.ws) {
      this.ws.close();
      this.ws = undefined;
      this.connected = false;
    }
  }

  /** Send an RPC request and wait for response */
  async call(method: string, params?: Record<string, unknown>, onToken?: (token: string) => void): Promise<RpcResponse> {
    if (!this.ws || !this.connected) {
      throw new Error("Not connected to gateway");
    }

    const request = createRpcRequest(method, params);

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(request.id, { resolve, reject, onToken });
      this.ws!.send(JSON.stringify(request));

      // Timeout after 120 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(request.id)) {
          this.pendingRequests.delete(request.id);
          reject(new Error(`RPC timeout: ${method}`));
        }
      }, 120_000);
    });
  }

  /** Send a chat message via RPC with streaming */
  async chat(
    message: string,
    options?: { sessionId?: string; realmId?: string; entityId?: string },
    onToken?: (token: string) => void,
  ): Promise<RpcResponse> {
    return this.call(
      RPC_METHODS.CHAT_SEND,
      { message, ...options },
      onToken,
    );
  }

  /** Check if connected */
  isConnected(): boolean {
    return this.connected;
  }

  /** Try to connect, return false if fails */
  async tryConnect(): Promise<boolean> {
    try {
      await this.connect();
      return true;
    } catch {
      return false;
    }
  }

  /** Register a handler for broadcast events */
  onEvent(handler: WsEventHandler): void {
    this.eventHandlers.push(handler);
  }

  // ── Convenience methods for RPC calls ──

  async listRealms(): Promise<RpcResponse> {
    return this.call(RPC_METHODS.REALM_LIST);
  }

  async getRealm(id: string): Promise<RpcResponse> {
    return this.call(RPC_METHODS.REALM_GET, { id });
  }

  async listEntities(realmId: string): Promise<RpcResponse> {
    return this.call(RPC_METHODS.ENTITY_LIST, { realmId });
  }

  async summonEntity(entityId: string): Promise<RpcResponse> {
    return this.call(RPC_METHODS.SUMMON_INVOKE, { entityId });
  }

  async releaseEntity(entityId: string): Promise<RpcResponse> {
    return this.call(RPC_METHODS.SUMMON_RELEASE, { entityId });
  }

  async getStatus(): Promise<RpcResponse> {
    return this.call(RPC_METHODS.STATUS_INFO);
  }
}
