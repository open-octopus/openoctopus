import type Database from "better-sqlite3";
import type { RealmState } from "@openoctopus/shared";
import { generateId, RealmNotFoundError } from "@openoctopus/shared";

interface RealmRow {
  id: string;
  name: string;
  description: string;
  icon: string | null;
  status: string;
  health_score: number;
  risk_count: number;
  pending_actions: number;
  proactive_enabled: number;
  budget_daily_limit: number | null;
  budget_monthly_limit: number | null;
  budget_currency: string | null;
  last_activity: string | null;
  created_at: string;
  updated_at: string;
}

function rowToRealmState(row: RealmRow): RealmState {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    icon: row.icon ?? undefined,
    status: row.status as RealmState["status"],
    healthScore: row.health_score,
    riskCount: row.risk_count,
    pendingActions: row.pending_actions,
    proactiveEnabled: row.proactive_enabled === 1,
    budget: row.budget_daily_limit != null || row.budget_monthly_limit != null
      ? {
          dailyLimit: row.budget_daily_limit ?? undefined,
          monthlyLimit: row.budget_monthly_limit ?? undefined,
          currency: row.budget_currency ?? "USD",
        }
      : undefined,
    lastActivity: row.last_activity ?? undefined,
    entities: [],
    agents: [],
    skills: [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class RealmRepo {
  constructor(private db: Database.Database) {}

  list(): RealmState[] {
    const rows = this.db.prepare("SELECT * FROM realms ORDER BY name").all() as RealmRow[];
    return rows.map(rowToRealmState);
  }

  getById(id: string): RealmState {
    const row = this.db.prepare("SELECT * FROM realms WHERE id = ?").get(id) as RealmRow | undefined;
    if (!row) { throw new RealmNotFoundError(id); }
    return rowToRealmState(row);
  }

  findByName(name: string): RealmState | null {
    const row = this.db.prepare("SELECT * FROM realms WHERE name = ?").get(name) as RealmRow | undefined;
    return row ? rowToRealmState(row) : null;
  }

  create(data: { name: string; description?: string; icon?: string; proactiveEnabled?: boolean }): RealmState {
    const id = generateId("realm");
    const now = new Date().toISOString();

    this.db
      .prepare(
        `INSERT INTO realms (id, name, description, icon, proactive_enabled, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(id, data.name, data.description ?? "", data.icon ?? null, data.proactiveEnabled ? 1 : 0, now, now);

    return this.getById(id);
  }

  update(id: string, data: Partial<{ name: string; description: string; status: string; icon: string; proactiveEnabled: boolean }>): RealmState {
    this.getById(id); // throws if not found
    const now = new Date().toISOString();

    if (data.name !== undefined) {
      this.db.prepare("UPDATE realms SET name = ?, updated_at = ? WHERE id = ?").run(data.name, now, id);
    }
    if (data.description !== undefined) {
      this.db.prepare("UPDATE realms SET description = ?, updated_at = ? WHERE id = ?").run(data.description, now, id);
    }
    if (data.status !== undefined) {
      this.db.prepare("UPDATE realms SET status = ?, updated_at = ? WHERE id = ?").run(data.status, now, id);
    }
    if (data.icon !== undefined) {
      this.db.prepare("UPDATE realms SET icon = ?, updated_at = ? WHERE id = ?").run(data.icon, now, id);
    }
    if (data.proactiveEnabled !== undefined) {
      this.db.prepare("UPDATE realms SET proactive_enabled = ?, updated_at = ? WHERE id = ?").run(
        data.proactiveEnabled ? 1 : 0,
        now,
        id,
      );
    }

    return this.getById(id);
  }

  delete(id: string): void {
    this.getById(id); // throws if not found
    this.db.prepare("DELETE FROM realms WHERE id = ?").run(id);
  }

  updateActivity(id: string): void {
    const now = new Date().toISOString();
    this.db.prepare("UPDATE realms SET last_activity = ?, updated_at = ? WHERE id = ?").run(now, now, id);
  }

  updateHealthScore(id: string, healthScore: number, riskCount?: number): void {
    const now = new Date().toISOString();
    if (riskCount !== undefined) {
      this.db.prepare("UPDATE realms SET health_score = ?, risk_count = ?, updated_at = ? WHERE id = ?").run(healthScore, riskCount, now, id);
    } else {
      this.db.prepare("UPDATE realms SET health_score = ?, updated_at = ? WHERE id = ?").run(healthScore, now, id);
    }
  }
}
