import type Database from "better-sqlite3";
import { generateId } from "@openoctopus/shared";

interface HealthReportRow {
  id: string;
  realm_id: string;
  health_score: number;
  memory_count: number;
  duplicate_count: number;
  stale_count: number;
  contradiction_count: number;
  issues: string;
  computed_at: string;
}

export interface HealthReportRecord {
  id: string;
  realmId: string;
  healthScore: number;
  memoryCount: number;
  duplicateCount: number;
  staleCount: number;
  contradictionCount: number;
  issues: unknown[];
  computedAt: string;
}

function rowToRecord(row: HealthReportRow): HealthReportRecord {
  return {
    id: row.id,
    realmId: row.realm_id,
    healthScore: row.health_score,
    memoryCount: row.memory_count,
    duplicateCount: row.duplicate_count,
    staleCount: row.stale_count,
    contradictionCount: row.contradiction_count,
    issues: JSON.parse(row.issues) as unknown[],
    computedAt: row.computed_at,
  };
}

export class HealthReportRepo {
  constructor(private db: Database.Database) {}

  create(data: {
    realmId: string;
    healthScore: number;
    memoryCount: number;
    duplicateCount: number;
    staleCount: number;
    contradictionCount: number;
    issues: unknown[];
  }): HealthReportRecord {
    const id = generateId("health");
    const now = new Date().toISOString();

    this.db
      .prepare(
        `INSERT INTO health_reports (id, realm_id, health_score, memory_count, duplicate_count, stale_count, contradiction_count, issues, computed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(id, data.realmId, data.healthScore, data.memoryCount, data.duplicateCount, data.staleCount, data.contradictionCount, JSON.stringify(data.issues), now);

    return {
      id,
      realmId: data.realmId,
      healthScore: data.healthScore,
      memoryCount: data.memoryCount,
      duplicateCount: data.duplicateCount,
      staleCount: data.staleCount,
      contradictionCount: data.contradictionCount,
      issues: data.issues,
      computedAt: now,
    };
  }

  getLatest(realmId: string): HealthReportRecord | null {
    const row = this.db
      .prepare("SELECT * FROM health_reports WHERE realm_id = ? ORDER BY computed_at DESC LIMIT 1")
      .get(realmId) as HealthReportRow | undefined;
    return row ? rowToRecord(row) : null;
  }

  listByRealm(realmId: string, limit = 10): HealthReportRecord[] {
    const rows = this.db
      .prepare("SELECT * FROM health_reports WHERE realm_id = ? ORDER BY computed_at DESC LIMIT ?")
      .all(realmId, limit) as HealthReportRow[];
    return rows.map(rowToRecord);
  }
}
