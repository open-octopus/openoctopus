import type { FamilyMember, FamilyRole } from "@openoctopus/shared";
import { generateId } from "@openoctopus/shared";
import type Database from "better-sqlite3";

interface FamilyMemberRow {
  id: string;
  name: string;
  nickname: string | null;
  roles: string;
  realm_ids: string;
  notify_channels: string;
  created_at: string;
  updated_at: string;
}

interface FamilyActionRow {
  id: string;
  member_id: string;
  member_name: string;
  role: string;
  action: string;
  priority: string;
  source_realm_id: string;
  source_message: string | null;
  status: string;
  created_at: string;
}

function rowToMember(row: FamilyMemberRow): FamilyMember {
  return {
    id: row.id,
    name: row.name,
    nickname: row.nickname ?? undefined,
    roles: JSON.parse(row.roles) as FamilyRole[],
    realmIds: JSON.parse(row.realm_ids) as string[],
    notifyChannels: JSON.parse(row.notify_channels) as string[],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface FamilyActionRecord {
  id: string;
  memberId: string;
  memberName: string;
  role: FamilyRole;
  action: string;
  priority: "low" | "normal" | "high" | "urgent";
  sourceRealmId: string;
  sourceMessage?: string;
  status: "pending" | "done" | "dismissed";
  createdAt: string;
}

function rowToAction(row: FamilyActionRow): FamilyActionRecord {
  return {
    id: row.id,
    memberId: row.member_id,
    memberName: row.member_name,
    role: row.role as FamilyRole,
    action: row.action,
    priority: row.priority as FamilyActionRecord["priority"],
    sourceRealmId: row.source_realm_id,
    sourceMessage: row.source_message ?? undefined,
    status: row.status as FamilyActionRecord["status"],
    createdAt: row.created_at,
  };
}

export class FamilyMemberRepo {
  constructor(private db: Database.Database) {}

  list(): FamilyMember[] {
    const rows = this.db
      .prepare("SELECT * FROM family_members ORDER BY name")
      .all() as FamilyMemberRow[];
    return rows.map(rowToMember);
  }

  getById(id: string): FamilyMember | null {
    const row = this.db.prepare("SELECT * FROM family_members WHERE id = ?").get(id) as
      | FamilyMemberRow
      | undefined;
    return row ? rowToMember(row) : null;
  }

  findByName(name: string): FamilyMember | null {
    const row = this.db
      .prepare("SELECT * FROM family_members WHERE name = ? OR nickname = ?")
      .get(name, name) as FamilyMemberRow | undefined;
    return row ? rowToMember(row) : null;
  }

  findByRole(role: FamilyRole): FamilyMember[] {
    const rows = this.db
      .prepare("SELECT * FROM family_members ORDER BY name")
      .all() as FamilyMemberRow[];
    return rows.map(rowToMember).filter((m) => m.roles.includes(role));
  }

  findByRealm(realmId: string): FamilyMember[] {
    const rows = this.db
      .prepare("SELECT * FROM family_members ORDER BY name")
      .all() as FamilyMemberRow[];
    return rows.map(rowToMember).filter((m) => m.realmIds.includes(realmId));
  }

  create(data: {
    name: string;
    nickname?: string;
    roles?: FamilyRole[];
    realmIds?: string[];
    notifyChannels?: string[];
  }): FamilyMember {
    const id = generateId("fmember");
    const now = new Date().toISOString();

    this.db
      .prepare(
        `INSERT INTO family_members (id, name, nickname, roles, realm_ids, notify_channels, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        data.name,
        data.nickname ?? null,
        JSON.stringify(data.roles ?? []),
        JSON.stringify(data.realmIds ?? []),
        JSON.stringify(data.notifyChannels ?? []),
        now,
        now,
      );

    return this.getById(id)!;
  }

  update(
    id: string,
    data: Partial<{
      name: string;
      nickname: string;
      roles: FamilyRole[];
      realmIds: string[];
      notifyChannels: string[];
    }>,
  ): FamilyMember | null {
    const existing = this.getById(id);
    if (!existing) {
      return null;
    }

    const now = new Date().toISOString();
    if (data.name !== undefined) {
      this.db
        .prepare("UPDATE family_members SET name = ?, updated_at = ? WHERE id = ?")
        .run(data.name, now, id);
    }
    if (data.nickname !== undefined) {
      this.db
        .prepare("UPDATE family_members SET nickname = ?, updated_at = ? WHERE id = ?")
        .run(data.nickname, now, id);
    }
    if (data.roles !== undefined) {
      this.db
        .prepare("UPDATE family_members SET roles = ?, updated_at = ? WHERE id = ?")
        .run(JSON.stringify(data.roles), now, id);
    }
    if (data.realmIds !== undefined) {
      this.db
        .prepare("UPDATE family_members SET realm_ids = ?, updated_at = ? WHERE id = ?")
        .run(JSON.stringify(data.realmIds), now, id);
    }
    if (data.notifyChannels !== undefined) {
      this.db
        .prepare("UPDATE family_members SET notify_channels = ?, updated_at = ? WHERE id = ?")
        .run(JSON.stringify(data.notifyChannels), now, id);
    }

    return this.getById(id);
  }

  delete(id: string): void {
    this.db.prepare("DELETE FROM family_members WHERE id = ?").run(id);
  }

  // ── Action tracking ──

  createAction(data: {
    memberId: string;
    memberName: string;
    role: FamilyRole;
    action: string;
    priority?: "low" | "normal" | "high" | "urgent";
    sourceRealmId: string;
    sourceMessage?: string;
  }): FamilyActionRecord {
    const id = generateId("faction");
    const now = new Date().toISOString();

    this.db
      .prepare(
        `INSERT INTO family_actions (id, member_id, member_name, role, action, priority, source_realm_id, source_message, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        data.memberId,
        data.memberName,
        data.role,
        data.action,
        data.priority ?? "normal",
        data.sourceRealmId,
        data.sourceMessage ?? null,
        now,
      );

    return this.getAction(id)!;
  }

  getAction(id: string): FamilyActionRecord | null {
    const row = this.db.prepare("SELECT * FROM family_actions WHERE id = ?").get(id) as
      | FamilyActionRow
      | undefined;
    return row ? rowToAction(row) : null;
  }

  listPendingActions(memberId?: string): FamilyActionRecord[] {
    if (memberId) {
      const rows = this.db
        .prepare(
          "SELECT * FROM family_actions WHERE member_id = ? AND status = 'pending' ORDER BY created_at DESC",
        )
        .all(memberId) as FamilyActionRow[];
      return rows.map(rowToAction);
    }
    const rows = this.db
      .prepare("SELECT * FROM family_actions WHERE status = 'pending' ORDER BY created_at DESC")
      .all() as FamilyActionRow[];
    return rows.map(rowToAction);
  }

  updateActionStatus(id: string, status: "done" | "dismissed"): void {
    this.db.prepare("UPDATE family_actions SET status = ? WHERE id = ?").run(status, id);
  }
}
