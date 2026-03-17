import { describe, it, expect, beforeEach } from "vitest";
import { useGatewayStore } from "./gateway";

describe("useGatewayStore", () => {
  beforeEach(() => {
    useGatewayStore.setState({
      status: "disconnected",
      url: "ws://localhost:19789",
      error: null,
    });
  });

  it("has correct initial state", () => {
    const state = useGatewayStore.getState();
    expect(state.status).toBe("disconnected");
    expect(state.url).toBe("ws://localhost:19789");
    expect(state.error).toBeNull();
  });

  it("updates status", () => {
    useGatewayStore.getState().setStatus("connected");
    expect(useGatewayStore.getState().status).toBe("connected");
  });
});
