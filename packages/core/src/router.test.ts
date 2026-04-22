import type { RealmState } from "@openoctopus/shared";
import { describe, expect, it } from "vitest";
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
  // No LLM registry → uses keyword fallback
  const router = new Router();
  const realms = [makeRealm("pet"), makeRealm("finance"), makeRealm("health")];

  it("routes pet-related messages to pet realm", async () => {
    const intent = await router.route("My cat is not eating today", realms);
    expect(intent.targetRealmId).toBe("realm_pet");
    expect(intent.confidence).toBeGreaterThan(0);
  });

  it("routes finance-related messages to finance realm", async () => {
    const intent = await router.route("I need to check my budget", realms);
    expect(intent.targetRealmId).toBe("realm_finance");
  });

  it("routes health messages to health realm", async () => {
    const intent = await router.route("I have a doctor appointment tomorrow", realms);
    expect(intent.targetRealmId).toBe("realm_health");
  });

  it("returns low confidence for unmatched messages", async () => {
    const intent = await router.route("Tell me a joke", realms);
    expect(intent.confidence).toBe(0);
    expect(intent.targetRealmId).toBeUndefined();
  });

  it("boosts confidence for direct realm name mention", async () => {
    const intent = await router.route("open the pet realm", realms);
    expect(intent.targetRealmId).toBe("realm_pet");
    expect(intent.confidence).toBeGreaterThanOrEqual(0.6);
  });

  describe("system action detection", () => {
    it("detects summon command in English", () => {
      const action = router.detectSystemAction("summon Luna");
      expect(action).not.toBeNull();
      expect(action!.action).toBe("summon");
      expect(action!.actionArgs?.entityName).toBe("Luna");
    });

    it("detects summon command in Chinese", () => {
      const action = router.detectSystemAction("召唤旺财");
      expect(action).not.toBeNull();
      expect(action!.action).toBe("summon");
      expect(action!.actionArgs?.entityName).toBe("旺财");
    });

    it("detects list realms in English", () => {
      const action = router.detectSystemAction("list realms");
      expect(action).not.toBeNull();
      expect(action!.action).toBe("list_realms");
    });

    it("detects list realms in Chinese", () => {
      const action = router.detectSystemAction("列举realm");
      expect(action).not.toBeNull();
      expect(action!.action).toBe("list_realms");
    });

    it("detects show realms", () => {
      const action = router.detectSystemAction("show all realms");
      expect(action).not.toBeNull();
      expect(action!.action).toBe("list_realms");
    });

    it("detects 查看realm", () => {
      const action = router.detectSystemAction("查看realm");
      expect(action).not.toBeNull();
      expect(action!.action).toBe("list_realms");
    });

    it("detects unsummon command", () => {
      const action = router.detectSystemAction("释放旺财");
      expect(action).not.toBeNull();
      expect(action!.action).toBe("unsummon");
      expect(action!.actionArgs?.entityName).toBe("旺财");
    });

    it("detects switch realm", () => {
      const action = router.detectSystemAction("switch to pet");
      expect(action).not.toBeNull();
      expect(action!.action).toBe("switch_realm");
      expect(action!.actionArgs?.realmName).toBe("pet");
    });

    it("detects 切换 realm", () => {
      const action = router.detectSystemAction("切换pet");
      expect(action).not.toBeNull();
      expect(action!.action).toBe("switch_realm");
    });

    it("returns null for normal messages", () => {
      const action = router.detectSystemAction("My cat is hungry");
      expect(action).toBeNull();
    });

    it("returns null for greetings", () => {
      const action = router.detectSystemAction("你好");
      expect(action).toBeNull();
    });
  });

  describe("context-aware routing", () => {
    it("applies realm momentum when no keyword match but previous realm exists", async () => {
      const intent = await router.route("怎么样了", realms, {
        previousRealmId: "realm_pet",
      });
      // Should fall back to previous realm with low confidence
      expect(intent.targetRealmId).toBe("realm_pet");
      expect(intent.confidence).toBeLessThanOrEqual(0.3);
    });

    it("prefers keyword match over realm momentum", async () => {
      const intent = await router.route("I need to see a doctor", realms, {
        previousRealmId: "realm_pet",
      });
      expect(intent.targetRealmId).toBe("realm_health");
    });
  });

  describe("Chinese keyword routing", () => {
    it("routes 柴犬 to pet realm", async () => {
      const intent = await router.route("我有一只柴犬", realms);
      expect(intent.targetRealmId).toBe("realm_pet");
    });

    it("routes 家里 to home realm", async () => {
      const allRealms = [...realms, makeRealm("home")];
      const intent = await router.route("家里最近好不好", allRealms);
      expect(intent.targetRealmId).toBe("realm_home");
    });

    it("routes 旅行 to hobby realm", async () => {
      const allRealms = [...realms, makeRealm("hobby")];
      const intent = await router.route("我想去旅行", allRealms);
      expect(intent.targetRealmId).toBe("realm_hobby");
    });
  });

  it("returns zero confidence when no realms exist", async () => {
    const intent = await router.route("hello", []);
    expect(intent.confidence).toBe(0);
    expect(intent.targetRealmId).toBeUndefined();
  });

  describe("parseRouterResponse edge cases", () => {
    // @ts-expect-error accessing private method for testing
    const parse = (content: string) => router.parseRouterResponse(content, realms);

    it("parses valid JSON response", () => {
      const result = parse('{"realm": "pet", "confidence": 0.8, "reasoning": "cat mention"}');
      expect(result).not.toBeNull();
      expect(result!.realmName).toBe("pet");
      expect(result!.confidence).toBe(0.8);
    });

    it("returns null when no JSON found", () => {
      expect(parse("just some text")).toBeNull();
    });

    it("returns null for invalid JSON", () => {
      expect(parse("{broken json")).toBeNull();
    });

    it("handles missing confidence with default", () => {
      const result = parse('{"realm": "pet"}');
      expect(result!.confidence).toBe(0.5);
    });

    it("clamps confidence to [0, 1]", () => {
      expect(parse('{"realm": "pet", "confidence": 2}')!.confidence).toBe(1);
      expect(parse('{"realm": "pet", "confidence": -1}')!.confidence).toBe(0);
    });

    it("handles null realm", () => {
      const result = parse('{"realm": null, "confidence": 0}');
      expect(result!.realmName).toBeNull();
    });

    it("handles missing realm field", () => {
      const result = parse('{"confidence": 0.5}');
      expect(result!.realmName).toBeNull();
    });
  });

  describe("system action takes priority over routing", () => {
    it("召唤 is detected as action, not routed as keyword", async () => {
      const intent = await router.route("召唤旺财", realms);
      expect(intent.action).toBe("summon");
      expect(intent.targetRealmId).toBeUndefined();
    });

    it("列举realm is detected as action", async () => {
      const intent = await router.route("列举realm", realms);
      expect(intent.action).toBe("list_realms");
    });
  });
});
