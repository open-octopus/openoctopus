import type { AgentConfig } from "@openoctopus/shared";
import { generateId, AgentNotFoundError } from "@openoctopus/shared";
import type Database from "better-sqlite3";

interface AgentRow {
  id: string;
  realm_id: string | null;
  entity_id: string | null;
  tier: string;
  name: string;
  model: string;
  personality: string | null;
  skills: string;
  proactive: number;
  created_at: string;
  updated_at: string;
}

function rowToAgent(row: AgentRow): AgentConfig {
  return {
    id: row.id,
    realmId: row.realm_id ?? undefined,
    entityId: row.entity_id ?? undefined,
    tier: row.tier as AgentConfig["tier"],
    name: row.name,
    model: row.model,
    personality: row.personality ?? undefined,
    skills: JSON.parse(row.skills) as string[],
    proactive: row.proactive === 1,
  };
}

export class AgentRepo {
  constructor(private db: Database.Database) {}

  listByRealm(realmId: string): AgentConfig[] {
    const rows = this.db
      .prepare("SELECT * FROM agents WHERE realm_id = ? ORDER BY name")
      .all(realmId) as AgentRow[];
    return rows.map(rowToAgent);
  }

  listCentral(): AgentConfig[] {
    const rows = this.db
      .prepare("SELECT * FROM agents WHERE tier = 'central' ORDER BY name")
      .all() as AgentRow[];
    return rows.map(rowToAgent);
  }

  getById(id: string): AgentConfig {
    const row = this.db.prepare("SELECT * FROM agents WHERE id = ?").get(id) as
      | AgentRow
      | undefined;
    if (!row) {
      throw new AgentNotFoundError(id);
    }
    return rowToAgent(row);
  }

  findByEntityId(entityId: string): AgentConfig | null {
    const row = this.db.prepare("SELECT * FROM agents WHERE entity_id = ?").get(entityId) as
      | AgentRow
      | undefined;
    return row ? rowToAgent(row) : null;
  }

  create(data: {
    realmId?: string;
    entityId?: string;
    tier: AgentConfig["tier"];
    name: string;
    model?: string;
    personality?: string;
    skills?: string[];
    proactive?: boolean;
  }): AgentConfig {
    const id = generateId("agent");
    const now = new Date().toISOString();

    this.db
      .prepare(
        `INSERT INTO agents (id, realm_id, entity_id, tier, name, model, personality, skills, proactive, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        data.realmId ?? null,
        data.entityId ?? null,
        data.tier,
        data.name,
        data.model ?? "claude-sonnet-4-6",
        data.personality ?? null,
        JSON.stringify(data.skills ?? []),
        data.proactive ? 1 : 0,
        now,
        now,
      );

    return this.getById(id);
  }

  delete(id: string): void {
    this.getById(id);
    this.db.prepare("DELETE FROM agents WHERE id = ?").run(id);
  }
}
