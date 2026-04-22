import { describe, it, expect } from "vitest";
import { createInitialState } from "./state.js";

describe("createInitialState", () => {
  it("creates WS mode state", () => {
    const state = createInitialState("ws");
    expect(state.connectionMode).toBe("ws");
    expect(state.isStreaming).toBe(false);
    expect(state.currentRealm).toBeUndefined();
    expect(state.currentEntity).toBeUndefined();
  });

  it("creates HTTP mode state", () => {
    const state = createInitialState("http");
    expect(state.connectionMode).toBe("http");
    expect(state.isStreaming).toBe(false);
  });
});
