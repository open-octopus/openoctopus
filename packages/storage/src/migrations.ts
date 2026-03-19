import type Database from "better-sqlite3";

export interface Migration {
  version: number;
  name: string;
  up: (db: Database.Database) => void;
  down: (db: Database.Database) => void;
}

export const migrations: Migration[] = [
  {
    version: 1,
    name: "initial_schema",
    up(db) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS realms (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT NOT NULL DEFAULT '',
          icon TEXT,
          status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
          health_score REAL NOT NULL DEFAULT 100,
          risk_count INTEGER NOT NULL DEFAULT 0,
          pending_actions INTEGER NOT NULL DEFAULT 0,
          proactive_enabled INTEGER NOT NULL DEFAULT 0,
          budget_daily_limit REAL,
          budget_monthly_limit REAL,
          budget_currency TEXT DEFAULT 'USD',
          last_activity TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS entities (
          id TEXT PRIMARY KEY,
          realm_id TEXT NOT NULL REFERENCES realms(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          type TEXT NOT NULL CHECK (type IN ('living', 'asset', 'organization', 'abstract')),
          avatar TEXT,
          attributes TEXT NOT NULL DEFAULT '{}',
          summon_status TEXT NOT NULL DEFAULT 'dormant' CHECK (summon_status IN ('dormant', 'summoning', 'active', 'suspended')),
          soul_path TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_entities_realm ON entities(realm_id);

        CREATE TABLE IF NOT EXISTS entity_relations (
          id TEXT PRIMARY KEY,
          source_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
          target_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
          type TEXT NOT NULL,
          label TEXT,
          bidirectional INTEGER NOT NULL DEFAULT 0,
          cross_realm INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_relations_source ON entity_relations(source_id);
        CREATE INDEX IF NOT EXISTS idx_relations_target ON entity_relations(target_id);

        CREATE TABLE IF NOT EXISTS agents (
          id TEXT PRIMARY KEY,
          realm_id TEXT REFERENCES realms(id) ON DELETE CASCADE,
          entity_id TEXT REFERENCES entities(id) ON DELETE SET NULL,
          tier TEXT NOT NULL CHECK (tier IN ('central', 'realm', 'summoned')),
          name TEXT NOT NULL,
          model TEXT NOT NULL DEFAULT 'claude-sonnet-4-6',
          personality TEXT,
          skills TEXT NOT NULL DEFAULT '[]',
          proactive INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_agents_realm ON agents(realm_id);

        CREATE TABLE IF NOT EXISTS skills (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          description TEXT NOT NULL DEFAULT '',
          scope TEXT NOT NULL CHECK (scope IN ('global', 'realm')),
          type TEXT NOT NULL CHECK (type IN ('native', 'mcp')),
          tools TEXT NOT NULL DEFAULT '[]',
          mcp_server TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS realm_skills (
          realm_id TEXT NOT NULL REFERENCES realms(id) ON DELETE CASCADE,
          skill_id TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
          PRIMARY KEY (realm_id, skill_id)
        );

        CREATE TABLE IF NOT EXISTS memories (
          id TEXT PRIMARY KEY,
          realm_id TEXT NOT NULL REFERENCES realms(id) ON DELETE CASCADE,
          entity_id TEXT REFERENCES entities(id) ON DELETE SET NULL,
          tier TEXT NOT NULL CHECK (tier IN ('core', 'working', 'retrieved', 'archival')),
          content TEXT NOT NULL,
          metadata TEXT NOT NULL DEFAULT '{}',
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_memories_realm ON memories(realm_id);
        CREATE INDEX IF NOT EXISTS idx_memories_entity ON memories(entity_id);
        CREATE INDEX IF NOT EXISTS idx_memories_tier ON memories(tier);

        CREATE TABLE IF NOT EXISTS knowledge_nodes (
          id TEXT PRIMARY KEY,
          realm_id TEXT NOT NULL REFERENCES realms(id) ON DELETE CASCADE,
          label TEXT NOT NULL,
          type TEXT NOT NULL,
          properties TEXT NOT NULL DEFAULT '{}',
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_knodes_realm ON knowledge_nodes(realm_id);

        CREATE TABLE IF NOT EXISTS knowledge_edges (
          id TEXT PRIMARY KEY,
          source_id TEXT NOT NULL REFERENCES knowledge_nodes(id) ON DELETE CASCADE,
          target_id TEXT NOT NULL REFERENCES knowledge_nodes(id) ON DELETE CASCADE,
          type TEXT NOT NULL,
          properties TEXT NOT NULL DEFAULT '{}',
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS sessions (
          id TEXT PRIMARY KEY,
          realm_id TEXT REFERENCES realms(id) ON DELETE SET NULL,
          agent_id TEXT REFERENCES agents(id) ON DELETE SET NULL,
          entity_id TEXT REFERENCES entities(id) ON DELETE SET NULL,
          message_count INTEGER NOT NULL DEFAULT 0,
          session_file TEXT,
          started_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS audit_log (
          id TEXT PRIMARY KEY,
          timestamp TEXT NOT NULL DEFAULT (datetime('now')),
          realm_id TEXT,
          agent_id TEXT,
          action TEXT NOT NULL,
          resource TEXT NOT NULL,
          resource_id TEXT,
          details TEXT NOT NULL DEFAULT '{}'
        );

        CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp);
        CREATE INDEX IF NOT EXISTS idx_audit_realm ON audit_log(realm_id);

        CREATE TABLE IF NOT EXISTS budget_usage (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          realm_id TEXT NOT NULL REFERENCES realms(id) ON DELETE CASCADE,
          agent_id TEXT,
          date TEXT NOT NULL,
          tokens_in INTEGER NOT NULL DEFAULT 0,
          tokens_out INTEGER NOT NULL DEFAULT 0,
          cost REAL NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_budget_realm_date ON budget_usage(realm_id, date);

        CREATE TABLE IF NOT EXISTS schema_migrations (
          version INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          applied_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
      `);
    },
    down(db) {
      db.exec(`
        DROP TABLE IF EXISTS budget_usage;
        DROP TABLE IF EXISTS audit_log;
        DROP TABLE IF EXISTS sessions;
        DROP TABLE IF EXISTS knowledge_edges;
        DROP TABLE IF EXISTS knowledge_nodes;
        DROP TABLE IF EXISTS memories;
        DROP TABLE IF EXISTS realm_skills;
        DROP TABLE IF EXISTS skills;
        DROP TABLE IF EXISTS agents;
        DROP TABLE IF EXISTS entity_relations;
        DROP TABLE IF EXISTS entities;
        DROP TABLE IF EXISTS realms;
        DROP TABLE IF EXISTS schema_migrations;
      `);
    },
  },
  {
    version: 2,
    name: "knowledge_lifecycle",
    up(db) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS scanned_files (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          path TEXT NOT NULL UNIQUE,
          file_hash TEXT NOT NULL,
          realm_id TEXT,
          facts_extracted INTEGER NOT NULL DEFAULT 0,
          scanned_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_scanned_path ON scanned_files(path);

        CREATE TABLE IF NOT EXISTS health_reports (
          id TEXT PRIMARY KEY,
          realm_id TEXT NOT NULL REFERENCES realms(id) ON DELETE CASCADE,
          health_score REAL NOT NULL,
          memory_count INTEGER NOT NULL DEFAULT 0,
          duplicate_count INTEGER NOT NULL DEFAULT 0,
          stale_count INTEGER NOT NULL DEFAULT 0,
          contradiction_count INTEGER NOT NULL DEFAULT 0,
          issues TEXT NOT NULL DEFAULT '[]',
          computed_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_health_realm ON health_reports(realm_id);

        CREATE TABLE IF NOT EXISTS onboarding_state (
          user_key TEXT PRIMARY KEY DEFAULT 'default',
          completed INTEGER NOT NULL DEFAULT 0,
          completed_at TEXT,
          realms_seeded TEXT NOT NULL DEFAULT '[]'
        );
      `);
    },
    down(db) {
      db.exec(`
        DROP TABLE IF EXISTS onboarding_state;
        DROP TABLE IF EXISTS health_reports;
        DROP TABLE IF EXISTS scanned_files;
      `);
    },
  },
  {
    version: 3,
    name: "add_embedding_column",
    up(db) {
      db.exec("ALTER TABLE memories ADD COLUMN embedding BLOB");
    },
    down(db) {
      // SQLite doesn't support DROP COLUMN in older versions, recreate table
      db.exec(`
        CREATE TABLE memories_backup AS SELECT id, realm_id, entity_id, tier, content, metadata, created_at, updated_at FROM memories;
        DROP TABLE memories;
        ALTER TABLE memories_backup RENAME TO memories;
      `);
    },
  },
];

export function runMigrations(db: Database.Database): void {
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const applied = new Set(
    db
      .prepare("SELECT version FROM schema_migrations")
      .all()
      .map((row) => (row as { version: number }).version),
  );

  const pending = migrations
    .filter((m) => !applied.has(m.version))
    .toSorted((a, b) => a.version - b.version);

  for (const migration of pending) {
    db.transaction(() => {
      migration.up(db);
      db.prepare("INSERT INTO schema_migrations (version, name) VALUES (?, ?)").run(
        migration.version,
        migration.name,
      );
    })();
  }
}
