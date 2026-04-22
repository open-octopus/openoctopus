import { describe, expect, it } from "vitest";
import { compileSystemPrompt } from "./prompt-compiler.js";

describe("compileSystemPrompt", () => {
  const baseSoul = {
    name: "Luna",
    realm: "Pet",
    identity: {
      role: "Cat",
      personality: "Playful",
      background: "Adopted from shelter",
      speaking_style: "Meow-speaking",
    },
    catchphrases: ["Purr", "Meow"],
    coreMemory: ["Loves tuna", "Afraid of vacuum"],
    relationships: [
      { type: "owner", entityId: "entity_kevin", description: "Kevin" },
      { type: "sibling", entityId: "entity_max" },
    ],
    proactiveRules: [
      { trigger: "morning", action: "greet" },
      { trigger: "evening", action: "sleep reminder", interval: "1h" },
    ],
    version: "1.0",
    model: "claude-sonnet-4-6",
    skills: [],
  };

  const baseAgent = {
    id: "agent_1",
    name: "Luna",
    tier: "summoned" as const,
    model: "claude-sonnet-4-6",
    skills: [],
    proactive: false,
  };

  it("compiles basic prompt with identity", () => {
    const prompt = compileSystemPrompt({
      soul: baseSoul,
      agent: baseAgent,
      coreMemories: [],
      workingMemories: [],
      retrievedMemories: [],
    });
    expect(prompt).toContain("# Identity: Luna");
    expect(prompt).toContain("Role: Cat");
    expect(prompt).toContain("Personality: Playful");
    expect(prompt).toContain("Background: Adopted from shelter");
    expect(prompt).toContain("Speaking style: Meow-speaking");
  });

  it("includes catchphrases", () => {
    const prompt = compileSystemPrompt({
      soul: baseSoul,
      agent: baseAgent,
      coreMemories: [],
      workingMemories: [],
      retrievedMemories: [],
    });
    expect(prompt).toContain('Catchphrases: "Purr", "Meow"');
  });

  it("includes core memories from soul and memory entries", () => {
    const prompt = compileSystemPrompt({
      soul: baseSoul,
      agent: baseAgent,
      coreMemories: [
        {
          id: "m1",
          realmId: "realm_pet",
          content: "Remembers Kevin's birthday",
          tier: "core",
          metadata: {},
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-01T00:00:00Z",
        },
      ],
      workingMemories: [],
      retrievedMemories: [],
    });
    expect(prompt).toContain("## Core Memory");
    expect(prompt).toContain("- Loves tuna");
    expect(prompt).toContain("- Remembers Kevin's birthday");
  });

  it("includes working memories when present", () => {
    const prompt = compileSystemPrompt({
      soul: baseSoul,
      agent: baseAgent,
      coreMemories: [],
      workingMemories: [
        {
          id: "m2",
          realmId: "realm_pet",
          content: "Just ate breakfast",
          tier: "working",
          metadata: {},
          createdAt: "2024-01-02T00:00:00Z",
          updatedAt: "2024-01-02T00:00:00Z",
        },
      ],
      retrievedMemories: [],
    });
    expect(prompt).toContain("## Working Memory (Recent Context)");
    expect(prompt).toContain("- Just ate breakfast");
  });

  it("includes retrieved memories when present", () => {
    const prompt = compileSystemPrompt({
      soul: baseSoul,
      agent: baseAgent,
      coreMemories: [],
      workingMemories: [],
      retrievedMemories: [
        {
          id: "m3",
          realmId: "realm_pet",
          content: "Kevin likes jazz",
          tier: "retrieved",
          metadata: {},
          createdAt: "2024-01-03T00:00:00Z",
          updatedAt: "2024-01-03T00:00:00Z",
        },
      ],
    });
    expect(prompt).toContain("## Retrieved Memory (Relevant)");
    expect(prompt).toContain("- Kevin likes jazz");
  });

  it("includes relationships", () => {
    const prompt = compileSystemPrompt({
      soul: baseSoul,
      agent: baseAgent,
      coreMemories: [],
      workingMemories: [],
      retrievedMemories: [],
    });
    expect(prompt).toContain("## Relationships");
    expect(prompt).toContain("- owner: Kevin");
    expect(prompt).toContain("- sibling: entity_max");
  });

  it("includes proactive rules", () => {
    const prompt = compileSystemPrompt({
      soul: baseSoul,
      agent: baseAgent,
      coreMemories: [],
      workingMemories: [],
      retrievedMemories: [],
    });
    expect(prompt).toContain("## Proactive Rules");
    expect(prompt).toContain("- When morning: greet");
    expect(prompt).toContain("- When evening: sleep reminder (every 1h)");
  });

  it("includes instructions", () => {
    const prompt = compileSystemPrompt({
      soul: baseSoul,
      agent: baseAgent,
      coreMemories: [],
      workingMemories: [],
      retrievedMemories: [],
    });
    expect(prompt).toContain("## Instructions");
    expect(prompt).toContain('You are Luna, a summoned entity in the "Pet" realm');
    expect(prompt).toContain('Your tier is "summoned"');
  });

  it("omits optional identity fields when missing", () => {
    const soul = {
      ...baseSoul,
      identity: { role: "", personality: "", background: "", speaking_style: "" },
    };
    const prompt = compileSystemPrompt({
      soul,
      agent: baseAgent,
      coreMemories: [],
      workingMemories: [],
      retrievedMemories: [],
    });
    expect(prompt).not.toContain("Role:");
    expect(prompt).not.toContain("Personality:");
    expect(prompt).not.toContain("Background:");
    expect(prompt).not.toContain("Speaking style:");
  });

  it("omits sections when arrays are empty", () => {
    const soul = {
      ...baseSoul,
      catchphrases: [],
      coreMemory: [],
      relationships: [],
      proactiveRules: [],
    };
    const prompt = compileSystemPrompt({
      soul,
      agent: baseAgent,
      coreMemories: [],
      workingMemories: [],
      retrievedMemories: [],
    });
    expect(prompt).not.toContain("Catchphrases");
    expect(prompt).not.toContain("## Core Memory");
    expect(prompt).not.toContain("## Relationships");
    expect(prompt).not.toContain("## Proactive Rules");
    expect(prompt).not.toContain("## Working Memory");
    expect(prompt).not.toContain("## Retrieved Memory");
  });

  it("handles relationship with unknown target", () => {
    const soul = {
      ...baseSoul,
      relationships: [{ type: "friend", entityId: "entity_unknown" }],
    };
    const prompt = compileSystemPrompt({
      soul,
      agent: baseAgent,
      coreMemories: [],
      workingMemories: [],
      retrievedMemories: [],
    });
    expect(prompt).toContain("- friend: entity_unknown");
  });
});
