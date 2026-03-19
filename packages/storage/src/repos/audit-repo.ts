import type { AuditEvent } from "@openoctopus/shared";
import { generateId } from "@openoctopus/shared";
import type Database from "better-sqlite3";

interface AuditRow {
  id: string;
  timestamp: string;
  realm_id: string | null;
  agent_id: string | null;
  action: string;
  resource: string;
  resource_id: string | null;
  details: string;
}

function rowToAudit(row: AuditRow): AuditEvent {
  return {
    id: row.id,
    timestamp: row.timestamp,
    realmId: row.realm_id ?? undefined,
    agentId: row.agent_id ?? undefined,
    action: row.action,
    resource: row.resource,
    resourceId: row.resource_id ?? undefined,
    details: JSON.parse(row.details) as Record<string, unknown>,
  };
}

export class AuditRepo {
  constructor(private db: Database.Database) {}

  log(event: {
    realmId?: string;
    agentId?: string;
    action: string;
    resource: string;
    resourceId?: string;
    details?: Record<string, unknown>;
  }): AuditEvent {
    const id = generateId("audit");
    const now = new Date().toISOString();

    this.db
      .prepare(
        `INSERT INTO audit_log (id, timestamp, realm_id, agent_id, action, resource, resource_id, details)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        now,
        event.realmId ?? null,
        event.agentId ?? null,
        event.action,
        event.resource,
        event.resourceId ?? null,
        JSON.stringify(event.details ?? {}),
      );

    return {
      id,
      timestamp: now,
      realmId: event.realmId,
      agentId: event.agentId,
      action: event.action,
      resource: event.resource,
      resourceId: event.resourceId,
      details: event.details ?? {},
    };
  }

  list(options?: { realmId?: string; limit?: number; offset?: number }): AuditEvent[] {
    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;

    let query = "SELECT * FROM audit_log";
    const params: unknown[] = [];

    if (options?.realmId) {
      query += " WHERE realm_id = ?";
      params.push(options.realmId);
    }

    query += " ORDER BY timestamp DESC LIMIT ? OFFSET ?";
    params.push(limit, offset);

    const rows = this.db.prepare(query).all(...params) as AuditRow[];
    return rows.map(rowToAudit);
  }
}
