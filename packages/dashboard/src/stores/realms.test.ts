import { describe, it, expect, beforeEach } from "vitest";
import { useRealmsStore } from "./realms";

describe("useRealmsStore", () => {
  beforeEach(() => {
    useRealmsStore.setState({ realms: [], entities: [] });
  });

  it("has correct initial state", () => {
    const state = useRealmsStore.getState();
    expect(state.realms).toEqual([]);
    expect(state.entities).toEqual([]);
  });

  it("sets realms", () => {
    useRealmsStore.getState().setRealms([
      { id: "r1", name: "健康", icon: "🏥", entityCount: 5, healthScore: 80 },
      { id: "r2", name: "财务", icon: "💰" },
    ]);
    expect(useRealmsStore.getState().realms).toHaveLength(2);
    expect(useRealmsStore.getState().realms[0].name).toBe("健康");
  });

  it("sets entities", () => {
    useRealmsStore.getState().setEntities([
      { id: "e1", name: "橘子", type: "living", realmId: "r1" },
    ]);
    expect(useRealmsStore.getState().entities).toHaveLength(1);
  });

  it("updates a specific realm", () => {
    useRealmsStore.getState().setRealms([
      { id: "r1", name: "健康", healthScore: 80 },
      { id: "r2", name: "财务", healthScore: 90 },
    ]);

    useRealmsStore.getState().updateRealm("r1", { healthScore: 60 });

    const realms = useRealmsStore.getState().realms;
    expect(realms[0].healthScore).toBe(60);
    expect(realms[1].healthScore).toBe(90);
  });

  it("updateRealm does not affect non-matching realms", () => {
    useRealmsStore.getState().setRealms([
      { id: "r1", name: "健康" },
    ]);

    useRealmsStore.getState().updateRealm("nonexistent", { name: "changed" });

    expect(useRealmsStore.getState().realms[0].name).toBe("健康");
  });
});
