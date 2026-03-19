import { describe, it, expect } from "vitest";
import { parseRealmFile, parseRealmFileWithBody } from "./realm-parser.js";

const FULL_REALM_MD = `---
name: pet
description: Pet care realm
icon: "\\U0001F419"
defaultEntities:
  - name: My Pet
    type: living
    attributes:
      species: cat
skills:
  - vet-lookup
agents:
  - name: Pet Care Expert
    personality: Warm and knowledgeable
    proactive: true
proactiveRules:
  - trigger: schedule
    action: Check vet appointments
    interval: weekly
---

# Pet Realm

Your pet care headquarters.
`;

describe("parseRealmFile", () => {
  it("parses a full REALM.md file", () => {
    const realm = parseRealmFile(FULL_REALM_MD);
    expect(realm.name).toBe("pet");
    expect(realm.description).toBe("Pet care realm");
    expect(realm.skills).toEqual(["vet-lookup"]);
    expect(realm.agents).toHaveLength(1);
    expect(realm.agents[0].name).toBe("Pet Care Expert");
    expect(realm.agents[0].personality).toBe("Warm and knowledgeable");
    expect(realm.agents[0].proactive).toBe(true);
    expect(realm.defaultEntities).toHaveLength(1);
    expect(realm.defaultEntities[0].type).toBe("living");
    expect(realm.proactiveRules).toHaveLength(1);
    expect(realm.proactiveRules[0].interval).toBe("weekly");
  });

  it("parses minimal REALM.md with only name", () => {
    const realm = parseRealmFile("---\nname: test\n---\n");
    expect(realm.name).toBe("test");
    expect(realm.description).toBe("");
    expect(realm.agents).toEqual([]);
    expect(realm.skills).toEqual([]);
    expect(realm.defaultEntities).toEqual([]);
    expect(realm.proactiveRules).toEqual([]);
  });

  it("throws on invalid YAML", () => {
    expect(() => parseRealmFile("---\n: invalid: yaml: [[\n---\n")).toThrow(
      "Failed to parse REALM.md YAML",
    );
  });

  it("throws on missing name", () => {
    expect(() => parseRealmFile("---\ndescription: no name\n---\n")).toThrow("Invalid REALM.md");
  });
});

describe("parseRealmFileWithBody", () => {
  it("extracts markdown body", () => {
    const { realm, body } = parseRealmFileWithBody(FULL_REALM_MD);
    expect(realm.name).toBe("pet");
    expect(body).toContain("# Pet Realm");
    expect(body).toContain("Your pet care headquarters.");
  });

  it("returns empty body when no markdown follows", () => {
    const { body } = parseRealmFileWithBody("---\nname: test\n---\n");
    expect(body).toBe("");
  });

  it("handles YAML without front matter delimiters", () => {
    const realm = parseRealmFile("name: test\ndescription: plain yaml");
    expect(realm.name).toBe("test");
    expect(realm.description).toBe("plain yaml");
  });
});
