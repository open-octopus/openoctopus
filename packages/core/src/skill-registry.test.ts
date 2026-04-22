import { SkillNotFoundError } from "@openoctopus/shared";
import { describe, expect, it } from "vitest";
import { SkillRegistry } from "./skill-registry.js";

function makeSkill(id: string, name: string, scope: "global" | "realm" = "global") {
  return {
    id,
    name,
    scope,
    type: "native" as const,
    description: "",
    tools: [],
  };
}

describe("SkillRegistry", () => {
  it("registers and retrieves a skill", () => {
    const registry = new SkillRegistry();
    registry.register(makeSkill("skill_1", "Search"));
    expect(registry.get("skill_1").name).toBe("Search");
  });

  it("throws on missing skill", () => {
    const registry = new SkillRegistry();
    expect(() => registry.get("missing")).toThrow(SkillNotFoundError);
  });

  it("unregisters a skill", () => {
    const registry = new SkillRegistry();
    registry.register(makeSkill("s1", "A"));
    registry.unregister("s1");
    expect(() => registry.get("s1")).toThrow(SkillNotFoundError);
  });

  it("finds skill by name", () => {
    const registry = new SkillRegistry();
    registry.register(makeSkill("s1", "Alpha"));
    expect(registry.findByName("Alpha")?.id).toBe("s1");
    expect(registry.findByName("Beta")).toBeUndefined();
  });

  it("lists global skills", () => {
    const registry = new SkillRegistry();
    registry.register(makeSkill("g1", "Global", "global"));
    registry.register(makeSkill("r1", "Realm", "realm"));
    expect(registry.listGlobal()).toHaveLength(1);
    expect(registry.listGlobal()[0].id).toBe("g1");
  });

  it("lists by scope", () => {
    const registry = new SkillRegistry();
    registry.register(makeSkill("g1", "G", "global"));
    registry.register(makeSkill("r1", "R", "realm"));
    expect(registry.listByScope("global")).toHaveLength(1);
    expect(registry.listByScope("realm")).toHaveLength(1);
  });

  it("lists all skills", () => {
    const registry = new SkillRegistry();
    registry.register(makeSkill("s1", "A", "global"));
    registry.register(makeSkill("s2", "B", "realm"));
    expect(registry.listAll()).toHaveLength(2);
  });

  it("gets available skills for realm", () => {
    const registry = new SkillRegistry();
    registry.register(makeSkill("g1", "Global", "global"));
    registry.register(makeSkill("r1", "Realm", "realm"));
    registry.register(makeSkill("r2", "Realm2", "realm"));
    const available = registry.getAvailableForRealm(["r1"]);
    expect(available).toHaveLength(2);
    expect(available.map((s) => s.id)).toContain("g1");
    expect(available.map((s) => s.id)).toContain("r1");
  });
});
