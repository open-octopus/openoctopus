import type { RpcRequest, RpcResponse, RpcEvent } from "./types";

type EventHandler = (data: unknown) => void;
type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

export class GatewayClient {
  private ws: WebSocket | null = null;
  private pending = new Map<string, PendingRequest>();
  private listeners = new Map<string, Set<EventHandler>>();
  private url: string;
  private reconnectDelay = 800;
  private maxReconnectDelay = 15000;
  private shouldReconnect = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(url: string) {
    this.url = url;
  }

  connect(): void {
    this.shouldReconnect = true;
    this.reconnectDelay = 800;
    this.createConnection();
  }

  disconnect(): void {
    this.shouldReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    // Reject all pending requests
    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.reject(new Error("Client disconnected"));
      this.pending.delete(id);
    }
  }

  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  async request(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("Not connected to gateway");
    }

    const id = `rpc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const request: RpcRequest = { id, method, params };

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`RPC timeout: ${method}`));
      }, 30000);

      this.pending.set(id, { resolve, reject, timer });
      this.ws!.send(JSON.stringify(request));
    });
  }

  on(event: string, handler: EventHandler): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);

    // Return unsubscribe function
    return () => {
      this.listeners.get(event)?.delete(handler);
    };
  }

  private createConnection(): void {
    this.ws = new WebSocket(this.url);

    this.ws.addEventListener("open", () => {
      this.reconnectDelay = 800;
      this.emit("_connected", null);
    });

    this.ws.addEventListener("close", () => {
      this.emit("_disconnected", null);
      if (this.shouldReconnect) {
        this.scheduleReconnect();
      }
    });

    this.ws.addEventListener("error", () => {
      // close event will fire after this
    });

    this.ws.addEventListener("message", (e) => {
      try {
        const data = JSON.parse(e.data as string);
        this.handleMessage(data);
      } catch {
        // Ignore malformed messages
      }
    });
  }

  private handleMessage(data: RpcResponse | RpcEvent): void {
    // RPC response (has id)
    if ("id" in data && typeof data.id === "string") {
      const response = data as RpcResponse;
      const pending = this.pending.get(response.id);
      if (pending) {
        clearTimeout(pending.timer);
        this.pending.delete(response.id);
        if (response.error) {
          pending.reject(new Error(response.error.message));
        } else {
          pending.resolve(response.result);
        }
      }
      return;
    }

    // RPC event (has event)
    if ("event" in data && typeof data.event === "string") {
      const event = data as RpcEvent;
      this.emit(event.event, event.data);
    }
  }

  private emit(event: string, data: unknown): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      for (const handler of handlers) {
        handler(data);
      }
    }
  }

  private scheduleReconnect(): void {
    this.reconnectTimer = setTimeout(() => {
      this.createConnection();
    }, this.reconnectDelay);
    this.reconnectDelay = Math.min(this.reconnectDelay * 1.5, this.maxReconnectDelay);
  }
}
