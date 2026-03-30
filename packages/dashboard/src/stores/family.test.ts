import { describe, it, expect, beforeEach } from "vitest";
import { useFamilyStore } from "./family";

describe("useFamilyStore", () => {
  beforeEach(() => {
    useFamilyStore.setState({ members: [], routeEvents: [] });
  });

  it("has correct initial state", () => {
    const state = useFamilyStore.getState();
    expect(state.members).toEqual([]);
    expect(state.routeEvents).toEqual([]);
  });

  it("sets members", () => {
    useFamilyStore
      .getState()
      .setMembers([
        { id: "m1", name: "爸爸", role: "adult", channels: ["微信"], watchedRealms: ["健康"] },
      ]);
    expect(useFamilyStore.getState().members).toHaveLength(1);
    expect(useFamilyStore.getState().members[0].name).toBe("爸爸");
  });

  it("adds route events in reverse chronological order", () => {
    const store = useFamilyStore.getState();
    store.addRouteEvent({
      id: "ev1",
      timestamp: "2026-01-01T10:00:00Z",
      source: { memberId: "m1", message: "膝盖疼" },
      realms: ["健康"],
      targets: [{ memberId: "m2", relevance: "high", pushed: true, summary: "就医" }],
    });
    store.addRouteEvent({
      id: "ev2",
      timestamp: "2026-01-02T10:00:00Z",
      source: { memberId: "m1", message: "发烧" },
      realms: ["健康"],
      targets: [{ memberId: "m2", relevance: "high", pushed: true, summary: "送医" }],
    });

    const events = useFamilyStore.getState().routeEvents;
    expect(events[0].id).toBe("ev2");
    expect(events[1].id).toBe("ev1");
  });

  it("caps route events at 100", () => {
    const store = useFamilyStore.getState();
    for (let i = 0; i < 105; i++) {
      store.addRouteEvent({
        id: String(i),
        timestamp: "2026-01-01T10:00:00Z",
        source: { memberId: "m1", message: `event ${i}` },
        realms: ["test"],
        targets: [],
      });
    }
    expect(useFamilyStore.getState().routeEvents).toHaveLength(100);
  });
});
