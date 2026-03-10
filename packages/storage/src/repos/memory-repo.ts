import type Database from "better-sqlite3";
import type { MemoryEntry, MemoryTier } from "@openoctopus/shared";
import { generateId } from "@openoctopus/shared";

interface MemoryRow {
  id: string;
  realm_id: string;
  entity_id: string | null;
  tier: string;
  content: string;
  metadata: string;
  created_at: string;
  updated_at: string;
}

function rowToMemory(row: MemoryRow): MemoryEntry {
  return {
    id: row.id,
    realmId: row.realm_id,
    entityId: row.entity_id ?? undefined,
    tier: row.tier as MemoryTier,
    content: row.content,
    metadata: JSON.parse(row.metadata) as Record<string, unknown>,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class MemoryRepo {
  constructor(private db: Database.Database) {}

  listByRealm(realmId: string, tier?: MemoryTier): MemoryEntry[] {
    if (tier) {
      const rows = this.db
        .prepare("SELECT * FROM memories WHERE realm_id = ? AND tier = ? ORDER BY updated_at DESC")
        .all(realmId, tier) as MemoryRow[];
      return rows.map(rowToMemory);
    }
    const rows = this.db
      .prepare("SELECT * FROM memories WHERE realm_id = ? ORDER BY updated_at DESC")
      .all(realmId) as MemoryRow[];
    return rows.map(rowToMemory);
  }

  listByEntity(entityId: string, tier?: MemoryTier): MemoryEntry[] {
    if (tier) {
      const rows = this.db
        .prepare("SELECT * FROM memories WHERE entity_id = ? AND tier = ? ORDER BY updated_at DESC")
        .all(entityId, tier) as MemoryRow[];
      return rows.map(rowToMemory);
    }
    const rows = this.db
      .prepare("SELECT * FROM memories WHERE entity_id = ? ORDER BY updated_at DESC")
      .all(entityId) as MemoryRow[];
    return rows.map(rowToMemory);
  }

  create(data: {
    realmId: string;
    entityId?: string;
    tier: MemoryTier;
    content: string;
    metadata?: Record<string, unknown>;
  }): MemoryEntry {
    const id = generateId("memory");
    const now = new Date().toISOString();

    this.db
      .prepare(
        `INSERT INTO memories (id, realm_id, entity_id, tier, content, metadata, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(id, data.realmId, data.entityId ?? null, data.tier, data.content, JSON.stringify(data.metadata ?? {}), now, now);

    return {
      id,
      realmId: data.realmId,
      entityId: data.entityId,
      tier: data.tier,
      content: data.content,
      metadata: data.metadata ?? {},
      createdAt: now,
      updatedAt: now,
    };
  }

  delete(id: string): void {
    this.db.prepare("DELETE FROM memories WHERE id = ?").run(id);
  }
}
