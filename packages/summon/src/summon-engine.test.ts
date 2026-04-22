import fs from "node:fs";
import { runMigrations } from "@openoctopus/storage";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SummonEngine } from "./summon-engine.js";

let db: Database.Database;

const SOUL_CONTENT = `---
name: Test Soul
realm: test
identity:
  role: Test role
  personality: Friendly
  background: Test background
  speaking_style: Casual
catchphrases:
  - "Hello there"
coreMemory:
  - Remember this
proactiveRules:
  - trigger: time
    action: Say hello
    interval: daily
relationships: []
---
`;

beforeEach(() => {
  db = new Database(":memory:");
  runMigrations(db);

  db.prepare(
    `INSERT INTO realms (id, name, description, created_at, updated_at)
     VALUES ('realm_test', 'test', 'Test realm', datetime('now'), datetime('now'))`,
  ).run();
});

afterEach(() => {
  db.close();
  vi.restoreAllMocks();
});

describe("SummonEngine", () => {
  it("summons an entity and returns summoned agent", async () => {
    db.prepare(
      `INSERT INTO entities (id, realm_id, name, type, soul_path, created_at, updated_at)
       VALUES ('entity_1', 'realm_test', 'Entity One', 'living', '/fake/soul.md', datetime('now'), datetime('now'))`,
    ).run();

    vi.spyOn(fs, "readFileSync").mockReturnValue(SOUL_CONTENT);

    const engine = new SummonEngine(db);
    const result = await engine.summon("entity_1");

    expect(result.entity.name).toBe("Entity One");
    expect(result.entity.summonStatus).toBe("active");
    expect(result.soul.name).toBe("Test Soul");
    expect(result.agent.tier).toBe("summoned");
    expect(result.systemPrompt).toContain("Friendly");
    expect(result.systemPrompt).toContain("Hello there");
  });

  it("returns existing summoned agent on double summon", async () => {
    db.prepare(
      `INSERT INTO entities (id, realm_id, name, type, soul_path, created_at, updated_at)
       VALUES ('entity_1', 'realm_test', 'Entity One', 'living', '/fake/soul.md', datetime('now'), datetime('now'))`,
    ).run();

    vi.spyOn(fs, "readFileSync").mockReturnValue(SOUL_CONTENT);

    const engine = new SummonEngine(db);
    const first = await engine.summon("entity_1");
    const second = await engine.summon("entity_1");

    expect(second).toEqual(first);
    expect(engine.listActive()).toHaveLength(1);
  });

  it("re-summons entity that was active in DB but not in memory", async () => {
    db.prepare(
      `INSERT INTO entities (id, realm_id, name, type, soul_path, summon_status, created_at, updated_at)
       VALUES ('entity_1', 'realm_test', 'Entity One', 'living', '/fake/soul.md', 'active', datetime('now'), datetime('now'))`,
    ).run();

    vi.spyOn(fs, "readFileSync").mockReturnValue(SOUL_CONTENT);

    const engine = new SummonEngine(db);
    const result = await engine.summon("entity_1");

    expect(result.entity.summonStatus).toBe("active");
    expect(result.soul.name).toBe("Test Soul");
  });

  it("throws when entity has no soul path", async () => {
    db.prepare(
      `INSERT INTO entities (id, realm_id, name, type, created_at, updated_at)
       VALUES ('entity_1', 'realm_test', 'Entity One', 'living', datetime('now'), datetime('now'))`,
    ).run();

    const engine = new SummonEngine(db);
    await expect(engine.summon("entity_1")).rejects.toThrow("has no SOUL.md path");
  });

  it("unsummons active entity", async () => {
    db.prepare(
      `INSERT INTO entities (id, realm_id, name, type, soul_path, created_at, updated_at)
       VALUES ('entity_1', 'realm_test', 'Entity One', 'living', '/fake/soul.md', datetime('now'), datetime('now'))`,
    ).run();

    vi.spyOn(fs, "readFileSync").mockReturnValue(SOUL_CONTENT);

    const engine = new SummonEngine(db);
    await engine.summon("entity_1");
    engine.unsummon("entity_1");

    expect(engine.listActive()).toHaveLength(0);
    expect(engine.getSummoned("entity_1")).toBeUndefined();

    const row = db.prepare("SELECT summon_status FROM entities WHERE id = ?").get("entity_1") as {
      summon_status: string;
    };
    expect(row.summon_status).toBe("dormant");
  });

  it("unsummon warns and returns when entity not active", () => {
    const engine = new SummonEngine(db);
    // Should not throw
    engine.unsummon("entity_missing");
  });

  it("injects memories into system prompt", async () => {
    db.prepare(
      `INSERT INTO entities (id, realm_id, name, type, soul_path, created_at, updated_at)
       VALUES ('entity_1', 'realm_test', 'Entity One', 'living', '/fake/soul.md', datetime('now'), datetime('now'))`,
    ).run();

    db.prepare(
      `INSERT INTO memories (id, realm_id, entity_id, tier, content, created_at, updated_at)
       VALUES ('mem_1', 'realm_test', 'entity_1', 'core', 'Core memory content', datetime('now'), datetime('now'))`,
    ).run();

    db.prepare(
      `INSERT INTO memories (id, realm_id, entity_id, tier, content, created_at, updated_at)
       VALUES ('mem_2', 'realm_test', 'entity_1', 'working', 'Working memory content', datetime('now'), datetime('now'))`,
    ).run();

    vi.spyOn(fs, "readFileSync").mockReturnValue(SOUL_CONTENT);

    const engine = new SummonEngine(db);
    const result = await engine.summon("entity_1");

    expect(result.systemPrompt).toContain("Core memory content");
    expect(result.systemPrompt).toContain("Working memory content");
  });

  it("sets status to dormant on fs read error", async () => {
    db.prepare(
      `INSERT INTO entities (id, realm_id, name, type, soul_path, created_at, updated_at)
       VALUES ('entity_1', 'realm_test', 'Entity One', 'living', '/fake/soul.md', datetime('now'), datetime('now'))`,
    ).run();

    vi.spyOn(fs, "readFileSync").mockImplementation(() => {
      throw new Error("ENOENT");
    });

    const engine = new SummonEngine(db);
    await expect(engine.summon("entity_1")).rejects.toThrow("ENOENT");

    const row = db.prepare("SELECT summon_status FROM entities WHERE id = ?").get("entity_1") as {
      summon_status: string;
    };
    expect(row.summon_status).toBe("dormant");
  });
});
