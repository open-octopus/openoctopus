import type Database from "better-sqlite3";
import type { Entity } from "@openoctopus/shared";
import { generateId, EntityNotFoundError } from "@openoctopus/shared";

interface EntityRow {
  id: string;
  realm_id: string;
  name: string;
  type: string;
  avatar: string | null;
  attributes: string;
  summon_status: string;
  soul_path: string | null;
  created_at: string;
  updated_at: string;
}

function rowToEntity(row: EntityRow): Entity {
  return {
    id: row.id,
    realmId: row.realm_id,
    name: row.name,
    type: row.type as Entity["type"],
    avatar: row.avatar ?? undefined,
    attributes: JSON.parse(row.attributes) as Record<string, unknown>,
    summonStatus: row.summon_status as Entity["summonStatus"],
    soulPath: row.soul_path ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class EntityRepo {
  constructor(private db: Database.Database) {}

  listByRealm(realmId: string): Entity[] {
    const rows = this.db.prepare("SELECT * FROM entities WHERE realm_id = ? ORDER BY name").all(realmId) as EntityRow[];
    return rows.map(rowToEntity);
  }

  findByNameInRealm(realmId: string, name: string): Entity | null {
    const row = this.db.prepare("SELECT * FROM entities WHERE realm_id = ? AND name = ?").get(realmId, name) as EntityRow | undefined;
    return row ? rowToEntity(row) : null;
  }

  countByRealm(realmId: string): number {
    const row = this.db.prepare("SELECT COUNT(*) as cnt FROM entities WHERE realm_id = ?").get(realmId) as { cnt: number };
    return row.cnt;
  }

  getById(id: string): Entity {
    const row = this.db.prepare("SELECT * FROM entities WHERE id = ?").get(id) as EntityRow | undefined;
    if (!row) { throw new EntityNotFoundError(id); }
    return rowToEntity(row);
  }

  create(data: {
    realmId: string;
    name: string;
    type: Entity["type"];
    avatar?: string;
    attributes?: Record<string, unknown>;
    soulPath?: string;
  }): Entity {
    const id = generateId("entity");
    const now = new Date().toISOString();

    this.db
      .prepare(
        `INSERT INTO entities (id, realm_id, name, type, avatar, attributes, soul_path, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        data.realmId,
        data.name,
        data.type,
        data.avatar ?? null,
        JSON.stringify(data.attributes ?? {}),
        data.soulPath ?? null,
        now,
        now,
      );

    return this.getById(id);
  }

  update(id: string, data: Partial<{
    name: string;
    type: Entity["type"];
    avatar: string;
    attributes: Record<string, unknown>;
    summonStatus: Entity["summonStatus"];
    soulPath: string;
  }>): Entity {
    this.getById(id);
    const now = new Date().toISOString();

    if (data.name !== undefined) {
      this.db.prepare("UPDATE entities SET name = ?, updated_at = ? WHERE id = ?").run(data.name, now, id);
    }
    if (data.type !== undefined) {
      this.db.prepare("UPDATE entities SET type = ?, updated_at = ? WHERE id = ?").run(data.type, now, id);
    }
    if (data.attributes !== undefined) {
      this.db.prepare("UPDATE entities SET attributes = ?, updated_at = ? WHERE id = ?").run(
        JSON.stringify(data.attributes),
        now,
        id,
      );
    }
    if (data.summonStatus !== undefined) {
      this.db.prepare("UPDATE entities SET summon_status = ?, updated_at = ? WHERE id = ?").run(data.summonStatus, now, id);
    }
    if (data.soulPath !== undefined) {
      this.db.prepare("UPDATE entities SET soul_path = ?, updated_at = ? WHERE id = ?").run(data.soulPath, now, id);
    }

    return this.getById(id);
  }

  delete(id: string): void {
    this.getById(id);
    this.db.prepare("DELETE FROM entities WHERE id = ?").run(id);
  }

  updateSummonStatus(id: string, status: Entity["summonStatus"]): Entity {
    return this.update(id, { summonStatus: status });
  }
}
