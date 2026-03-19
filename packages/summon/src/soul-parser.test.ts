import { ValidationError } from "@openoctopus/shared";
import { describe, expect, it } from "vitest";
import { parseSoulFile, serializeSoulFile } from "./soul-parser.js";

const VALID_SOUL = `---
name: Luna
entityId: entity_abc123
realm: pet
identity:
  role: family cat
  personality: curious and playful ragdoll
  background: Adopted from a shelter in 2023
  speaking_style: short curious sentences
catchphrases:
  - "meow~ what's that?"
  - "*purrs contentedly*"
coreMemory:
  - Adopted on March 15, 2023
  - Favorite spot is the window sill
proactiveRules:
  - trigger: schedule
    action: Remind about vet appointment
    interval: monthly
relationships:
  - entityId: entity_owner
    type: owner
    description: My beloved human
---
`;

describe("parseSoulFile", () => {
  it("parses valid SOUL.md", () => {
    const soul = parseSoulFile(VALID_SOUL);
    expect(soul.name).toBe("Luna");
    expect(soul.entityId).toBe("entity_abc123");
    expect(soul.realm).toBe("pet");
    expect(soul.identity.role).toBe("family cat");
    expect(soul.catchphrases).toHaveLength(2);
    expect(soul.coreMemory).toHaveLength(2);
    expect(soul.proactiveRules).toHaveLength(1);
    expect(soul.relationships).toHaveLength(1);
  });

  it("parses minimal SOUL.md", () => {
    const minimal = `---
name: Max
realm: pet
identity: {}
---`;
    const soul = parseSoulFile(minimal);
    expect(soul.name).toBe("Max");
    expect(soul.entityId).toBeUndefined();
    expect(soul.catchphrases).toEqual([]);
    expect(soul.proactiveRules).toEqual([]);
  });

  it("parses SOUL.md without entityId", () => {
    const noEntityId = `---
name: Octy
realm: pet
identity:
  role: Digital octopus companion
  personality: Curious and playful
---`;
    const soul = parseSoulFile(noEntityId);
    expect(soul.name).toBe("Octy");
    expect(soul.entityId).toBeUndefined();
    expect(soul.realm).toBe("pet");
  });

  it("rejects invalid YAML", () => {
    expect(() => parseSoulFile("---\n: : : invalid\n---")).toThrow(ValidationError);
  });

  it("rejects missing required fields", () => {
    expect(() => parseSoulFile("---\nname: X\n---")).toThrow(ValidationError);
  });
});

describe("serializeSoulFile", () => {
  it("round-trips a soul file", () => {
    const soul = parseSoulFile(VALID_SOUL);
    const serialized = serializeSoulFile(soul);
    const reparsed = parseSoulFile(serialized);
    expect(reparsed.name).toBe(soul.name);
    expect(reparsed.entityId).toBe(soul.entityId);
    expect(reparsed.catchphrases).toEqual(soul.catchphrases);
  });
});
