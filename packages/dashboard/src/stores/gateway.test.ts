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

  it("clears error on connected", () => {
    useGatewayStore.getState().setError("connection refused");
    expect(useGatewayStore.getState().error).toBe("connection refused");

    useGatewayStore.getState().setStatus("connected");
    expect(useGatewayStore.getState().error).toBeNull();
  });

  it("preserves existing error when status changes to non-connected", () => {
    useGatewayStore.getState().setError("timeout");
    useGatewayStore.getState().setStatus("connecting");
    expect(useGatewayStore.getState().error).toBe("timeout");
  });
});
