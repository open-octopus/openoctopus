import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GatewayClient } from "./client";

// Mock WebSocket with addEventListener support
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  sent: string[] = [];

  private eventHandlers = new Map<string, Array<(e: unknown) => void>>();

  addEventListener(event: string, handler: (e: unknown) => void) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
  }

  send(data: string) {
    this.sent.push(data);
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    this.dispatch("close", undefined);
  }

  // Test helpers
  simulateOpen() {
    this.readyState = MockWebSocket.OPEN;
    this.dispatch("open", undefined);
  }

  simulateMessage(data: unknown) {
    this.dispatch("message", { data: JSON.stringify(data) });
  }

  private dispatch(event: string, detail: unknown) {
    for (const handler of this.eventHandlers.get(event) ?? []) {
      handler(detail);
    }
  }
}

describe("GatewayClient", () => {
  let mockWs: MockWebSocket;
  let client: GatewayClient;

  beforeEach(() => {
    mockWs = new MockWebSocket();
    const MockWSConstructor = vi.fn(function () {
      return mockWs;
    });
    Object.assign(MockWSConstructor, {
      CONNECTING: 0,
      OPEN: 1,
      CLOSING: 2,
      CLOSED: 3,
    });
    vi.stubGlobal("WebSocket", MockWSConstructor);
    client = new GatewayClient("ws://localhost:19789");
  });

  afterEach(() => {
    client.disconnect();
    vi.unstubAllGlobals();
  });

  it("connects to gateway", () => {
    client.connect();
    expect(vi.mocked(WebSocket)).toHaveBeenCalledWith("ws://localhost:19789");
  });

  it("sends RPC request and receives response", async () => {
    client.connect();
    mockWs.simulateOpen();

    const promise = client.request("realm.list", {});

    const sent = JSON.parse(mockWs.sent[0]);
    expect(sent.method).toBe("realm.list");

    mockWs.simulateMessage({ id: sent.id, result: [{ id: "realm_1", name: "pet" }] });

    const result = await promise;
    expect(result).toEqual([{ id: "realm_1", name: "pet" }]);
  });

  it("handles RPC error response", async () => {
    client.connect();
    mockWs.simulateOpen();

    const promise = client.request("realm.get", { id: "nonexistent" });

    const sent = JSON.parse(mockWs.sent[0]);
    mockWs.simulateMessage({ id: sent.id, error: { code: 404, message: "Not found" } });

    await expect(promise).rejects.toThrow("Not found");
  });

  it("subscribes to events", () => {
    client.connect();
    mockWs.simulateOpen();

    const handler = vi.fn();
    client.on("crossrealm.reaction", handler);

    mockWs.simulateMessage({ event: "crossrealm.reaction", data: { realmId: "realm_1" } });

    expect(handler).toHaveBeenCalledWith({ realmId: "realm_1" });
  });
});
