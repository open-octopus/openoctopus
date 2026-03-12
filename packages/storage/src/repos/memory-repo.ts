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

  countByRealm(realmId: string, tier?: MemoryTier): number {
    if (tier) {
      const row = this.db
        .prepare("SELECT COUNT(*) as cnt FROM memories WHERE realm_id = ? AND tier = ?")
        .get(realmId, tier) as { cnt: number };
      return row.cnt;
    }
    const row = this.db
      .prepare("SELECT COUNT(*) as cnt FROM memories WHERE realm_id = ?")
      .get(realmId) as { cnt: number };
    return row.cnt;
  }

  countByEntity(entityId: string, tier?: MemoryTier): number {
    if (tier) {
      const row = this.db
        .prepare("SELECT COUNT(*) as cnt FROM memories WHERE entity_id = ? AND tier = ?")
        .get(entityId, tier) as { cnt: number };
      return row.cnt;
    }
    const row = this.db
      .prepare("SELECT COUNT(*) as cnt FROM memories WHERE entity_id = ?")
      .get(entityId) as { cnt: number };
    return row.cnt;
  }

  searchByContent(realmId: string, query: string, limit = 20): MemoryEntry[] {
    const rows = this.db
      .prepare("SELECT * FROM memories WHERE realm_id = ? AND content LIKE ? ORDER BY updated_at DESC LIMIT ?")
      .all(realmId, `%${query}%`, limit) as MemoryRow[];
    return rows.map(rowToMemory);
  }

  listStale(realmId: string, olderThanDays: number): MemoryEntry[] {
    const cutoff = new Date(Date.now() - olderThanDays * 86400000).toISOString();
    const rows = this.db
      .prepare("SELECT * FROM memories WHERE realm_id = ? AND updated_at < ? ORDER BY updated_at ASC")
      .all(realmId, cutoff) as MemoryRow[];
    return rows.map(rowToMemory);
  }

  updateTier(id: string, tier: MemoryTier): void {
    const now = new Date().toISOString();
    this.db.prepare("UPDATE memories SET tier = ?, updated_at = ? WHERE id = ?").run(tier, now, id);
  }

  updateContent(id: string, content: string): void {
    const now = new Date().toISOString();
    this.db.prepare("UPDATE memories SET content = ?, updated_at = ? WHERE id = ?").run(content, now, id);
  }

  deleteMany(ids: string[]): number {
    if (ids.length === 0) return 0;
    const placeholders = ids.map(() => "?").join(",");
    const result = this.db.prepare(`DELETE FROM memories WHERE id IN (${placeholders})`).run(...ids);
    return result.changes;
  }
}
