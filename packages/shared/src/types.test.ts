import { describe, expect, it } from "vitest";
import {
  AgentConfigSchema,
  EntitySchema,
  RealmConfigSchema,
  RealmStateSchema,
  SkillDefinitionSchema,
  SoulFileSchema,
} from "./types.js";

describe("RealmConfigSchema", () => {
  it("validates a minimal realm config", () => {
    const result = RealmConfigSchema.safeParse({
      id: "realm_test",
      name: "Pet",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.description).toBe("");
      expect(result.data.entities).toEqual([]);
      expect(result.data.proactiveEnabled).toBe(false);
    }
  });

  it("rejects empty name", () => {
    const result = RealmConfigSchema.safeParse({ id: "r1", name: "" });
    expect(result.success).toBe(false);
  });
});

describe("RealmStateSchema", () => {
  it("validates a full realm state", () => {
    const now = new Date().toISOString();
    const result = RealmStateSchema.safeParse({
      id: "realm_1",
      name: "Finance",
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.healthScore).toBe(100);
      expect(result.data.riskCount).toBe(0);
    }
  });
});

describe("EntitySchema", () => {
  it("validates a living entity", () => {
    const now = new Date().toISOString();
    const result = EntitySchema.safeParse({
      id: "entity_1",
      realmId: "realm_1",
      name: "Luna",
      type: "living",
      createdAt: now,
      updatedAt: now,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.summonStatus).toBe("dormant");
    }
  });

  it("rejects invalid entity type", () => {
    const now = new Date().toISOString();
    const result = EntitySchema.safeParse({
      id: "e1",
      realmId: "r1",
      name: "X",
      type: "invalid",
      createdAt: now,
      updatedAt: now,
    });
    expect(result.success).toBe(false);
  });
});

describe("AgentConfigSchema", () => {
  it("validates agent config with defaults", () => {
    const result = AgentConfigSchema.safeParse({
      id: "agent_1",
      tier: "realm",
      name: "Pet Expert",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.model).toBe("claude-sonnet-4-6");
      expect(result.data.proactive).toBe(false);
      expect(result.data.skills).toEqual([]);
    }
  });
});

describe("SkillDefinitionSchema", () => {
  it("validates a native skill", () => {
    const result = SkillDefinitionSchema.safeParse({
      id: "skill_1",
      name: "web-search",
      scope: "global",
      type: "native",
    });
    expect(result.success).toBe(true);
  });

  it("validates an MCP skill", () => {
    const result = SkillDefinitionSchema.safeParse({
      id: "skill_2",
      name: "vet-lookup",
      scope: "realm",
      type: "mcp",
      mcpServer: {
        command: "npx",
        args: ["-y", "@mcp/vet-server"],
      },
    });
    expect(result.success).toBe(true);
  });
});

describe("SoulFileSchema", () => {
  it("validates a soul file", () => {
    const result = SoulFileSchema.safeParse({
      name: "Luna",
      entityId: "entity_1",
      realm: "pet",
      identity: {
        role: "family cat",
        personality: "curious and playful",
      },
      catchphrases: ["meow", "purr"],
      coreMemory: ["Adopted in 2023"],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.proactiveRules).toEqual([]);
    }
  });
});
