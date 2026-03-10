import { describe, expect, it } from "vitest";
import type { RealmState } from "@openoctopus/shared";
import { Router } from "./router.js";

const makeRealm = (name: string, id?: string): RealmState => ({
  id: id ?? `realm_${name}`,
  name,
  description: "",
  status: "active",
  healthScore: 100,
  riskCount: 0,
  pendingActions: 0,
  proactiveEnabled: false,
  entities: [],
  agents: [],
  skills: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

describe("Router", () => {
  const router = new Router();
  const realms = [makeRealm("pet"), makeRealm("finance"), makeRealm("health")];

  it("routes pet-related messages to pet realm", () => {
    const intent = router.route("My cat is not eating today", realms);
    expect(intent.targetRealmId).toBe("realm_pet");
    expect(intent.confidence).toBeGreaterThan(0);
  });

  it("routes finance-related messages to finance realm", () => {
    const intent = router.route("I need to check my budget", realms);
    expect(intent.targetRealmId).toBe("realm_finance");
  });

  it("routes health messages to health realm", () => {
    const intent = router.route("I have a doctor appointment tomorrow", realms);
    expect(intent.targetRealmId).toBe("realm_health");
  });

  it("returns low confidence for unmatched messages", () => {
    const intent = router.route("Tell me a joke", realms);
    expect(intent.confidence).toBe(0);
    expect(intent.targetRealmId).toBeUndefined();
  });

  it("boosts confidence for direct realm name mention", () => {
    const intent = router.route("open the pet realm", realms);
    expect(intent.targetRealmId).toBe("realm_pet");
    expect(intent.confidence).toBeGreaterThanOrEqual(0.6);
  });
});
