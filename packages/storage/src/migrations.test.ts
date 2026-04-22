import Database from "better-sqlite3";
import { describe, it, expect } from "vitest";
import { runMigrations } from "./migrations.js";

describe("migrations", () => {
  it("applies all migrations on fresh database", () => {
    const db = new Database(":memory:");
    runMigrations(db);

    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{
      name: string;
    }>;
    const tableNames = tables.map((t) => t.name);

    expect(tableNames).toContain("realms");
    expect(tableNames).toContain("entities");
    expect(tableNames).toContain("agents");
    expect(tableNames).toContain("skills");
    expect(tableNames).toContain("memories");
    expect(tableNames).toContain("family_members");
    expect(tableNames).toContain("scanned_files");
    expect(tableNames).toContain("health_reports");
    expect(tableNames).toContain("onboarding_state");

    const migrations = db
      .prepare("SELECT version FROM schema_migrations ORDER BY version")
      .all() as Array<{ version: number }>;
    expect(migrations.map((m) => m.version)).toEqual([1, 2, 3, 4]);

    db.close();
  });

  it("skips already-applied migrations", () => {
    const db = new Database(":memory:");
    runMigrations(db);
    runMigrations(db);

    const migrations = db
      .prepare("SELECT version FROM schema_migrations ORDER BY version")
      .all() as Array<{ version: number }>;
    expect(migrations).toHaveLength(4);

    db.close();
  });

  it("applies pending migrations incrementally", () => {
    const db = new Database(":memory:");

    // Apply v1 schema manually, then mark v1 as applied
    db.exec(`
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        realm_id TEXT NOT NULL,
        entity_id TEXT,
        tier TEXT NOT NULL,
        content TEXT NOT NULL,
        metadata TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT);
      INSERT INTO schema_migrations (version, name) VALUES (1, 'initial_schema');
    `);

    // Run migrations — should apply v2, v3, v4
    runMigrations(db);

    const migrations = db
      .prepare("SELECT version FROM schema_migrations ORDER BY version")
      .all() as Array<{ version: number }>;
    expect(migrations.map((m) => m.version)).toEqual([1, 2, 3, 4]);

    db.close();
  });

  it("adds embedding column via migration v3", () => {
    const db = new Database(":memory:");
    runMigrations(db);

    const columns = db.prepare("PRAGMA table_info(memories)").all() as Array<{ name: string }>;
    expect(columns.some((c) => c.name === "embedding")).toBe(true);

    db.close();
  });
});
