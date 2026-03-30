import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runMigrations } from "@openoctopus/storage";
import Database from "better-sqlite3";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SummonEngine } from "./summon-engine.js";

describe("SummonEngine integration", () => {
  let db: Database.Database;
  let tmpDir: string;
  let soulPath: string;

  const SOUL_CONTENT = `---
name: Budget Guru
realm: finance
identity:
  role: Family financial advisor
  personality: Practical and encouraging, makes budgeting feel approachable
  background: Decades of financial wisdom distilled into friendly advice
  speaking_style: Clear, conversational, with occasional money metaphors
catchphrases:
  - "A budget is telling your money where to go"
  - "Pay yourself first"
coreMemory:
  - Every dollar has a job
  - Compound interest is the eighth wonder of the world
proactiveRules:
  - trigger: schedule
    action: Monthly budget review reminder
    interval: monthly
relationships: []
---
`;

  beforeEach(() => {
    db = new Database(":memory:");
    runMigrations(db);

    // Create temp dir with SOUL.md file
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "oo-summon-test-"));
    soulPath = path.join(tmpDir, "budget-guru.soul.md");
    fs.writeFileSync(soulPath, SOUL_CONTENT);

    // Seed a realm
    db.prepare(
      `INSERT INTO realms (id, name, description, created_at, updated_at)
       VALUES ('realm_finance', 'finance', 'Finance realm', datetime('now'), datetime('now'))`,
    ).run();

    // Seed entity with soulPath
    db.prepare(
      `INSERT INTO entities (id, realm_id, name, type, soul_path, created_at, updated_at)
       VALUES ('entity_budget', 'realm_finance', 'Budget Guru', 'abstract', ?, datetime('now'), datetime('now'))`,
    ).run(soulPath);
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("summon entity with SOUL.md → verify personality in system prompt", async () => {
    const engine = new SummonEngine(db);

    const summoned = await engine.summon("entity_budget");

    // Verify entity is summoned
    expect(summoned.entity.name).toBe("Budget Guru");
    expect(summoned.entity.summonStatus).toBe("active");

    // Verify soul was parsed
    expect(summoned.soul.name).toBe("Budget Guru");
    expect(summoned.soul.realm).toBe("finance");
    expect(summoned.soul.identity.personality).toContain("Practical");

    // Verify system prompt contains personality traits
    expect(summoned.systemPrompt).toContain("Budget Guru");
    expect(summoned.systemPrompt).toContain("Practical and encouraging");
    expect(summoned.systemPrompt).toContain("Speaking style:");
    expect(summoned.systemPrompt).toContain("Clear, conversational");

    // Verify catchphrases are in prompt
    expect(summoned.systemPrompt).toContain("A budget is telling your money where to go");

    // Verify core memories are in prompt
    expect(summoned.systemPrompt).toContain("Every dollar has a job");

    // Verify agent was created in DB
    expect(summoned.agent.tier).toBe("summoned");
    expect(summoned.agent.entityId).toBe("entity_budget");
  });

  it("summon → unsummon → re-summon lifecycle", async () => {
    const engine = new SummonEngine(db);

    // Summon
    const summoned = await engine.summon("entity_budget");
    expect(engine.listActive()).toHaveLength(1);

    // Unsummon
    engine.unsummon("entity_budget");
    expect(engine.listActive()).toHaveLength(0);

    // Verify entity status reverted
    const row = db
      .prepare("SELECT summon_status FROM entities WHERE id = ?")
      .get("entity_budget") as { summon_status: string };
    expect(row.summon_status).toBe("dormant");

    // Re-summon (should reuse existing agent)
    const reSummoned = await engine.summon("entity_budget");
    expect(reSummoned.entity.summonStatus).toBe("active");
    expect(reSummoned.agent.id).toBe(summoned.agent.id);
  });

  it("summon fails when entity has no soulPath", async () => {
    // Create entity without soulPath
    db.prepare(
      `INSERT INTO entities (id, realm_id, name, type, created_at, updated_at)
       VALUES ('entity_nosoul', 'realm_finance', 'No Soul', 'abstract', datetime('now'), datetime('now'))`,
    ).run();

    const engine = new SummonEngine(db);
    await expect(engine.summon("entity_nosoul")).rejects.toThrow("has no SOUL.md path");
  });

  it("summoned entity gets memories injected into system prompt", async () => {
    // Add some memories for the entity
    db.prepare(
      `INSERT INTO memories (id, realm_id, entity_id, tier, content, created_at, updated_at)
       VALUES ('mem_1', 'realm_finance', 'entity_budget', 'core', 'Monthly income is $5000', datetime('now'), datetime('now'))`,
    ).run();
    db.prepare(
      `INSERT INTO memories (id, realm_id, entity_id, tier, content, created_at, updated_at)
       VALUES ('mem_2', 'realm_finance', 'entity_budget', 'working', 'Currently reviewing March expenses', datetime('now'), datetime('now'))`,
    ).run();

    const engine = new SummonEngine(db);
    const summoned = await engine.summon("entity_budget");

    // Core memory from DB should be in system prompt
    expect(summoned.systemPrompt).toContain("Monthly income is $5000");

    // Working memory should also be in prompt
    expect(summoned.systemPrompt).toContain("Currently reviewing March expenses");
  });

  it("getSummoned returns undefined for non-summoned entity", () => {
    const engine = new SummonEngine(db);
    expect(engine.getSummoned("entity_budget")).toBeUndefined();
  });

  it("double summon returns existing summoned agent", async () => {
    const engine = new SummonEngine(db);
    const first = await engine.summon("entity_budget");
    const second = await engine.summon("entity_budget");
    expect(first).toEqual(second);
  });
});
