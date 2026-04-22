import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runMigrations } from "../migrations.js";
import { FamilyMemberRepo } from "./family-member-repo.js";
import { RealmRepo } from "./realm-repo.js";

let db: Database.Database;
let repo: FamilyMemberRepo;
let realmRepo: RealmRepo;
let realmId: string;

beforeEach(() => {
  db = new Database(":memory:");
  runMigrations(db);
  repo = new FamilyMemberRepo(db);
  realmRepo = new RealmRepo(db);
  realmId = realmRepo.create({ name: "Test" }).id;
});

afterEach(() => {
  db.close();
});

describe("FamilyMemberRepo", () => {
  it("creates and retrieves a member", () => {
    const member = repo.create({
      name: "Kevin",
      nickname: "Kev",
      roles: ["admin", "parent"],
      realmIds: [realmId],
      notifyChannels: ["telegram"],
    });
    expect(member.name).toBe("Kevin");
    expect(member.nickname).toBe("Kev");
    expect(member.roles).toEqual(["admin", "parent"]);
    expect(member.realmIds).toEqual([realmId]);
    expect(member.notifyChannels).toEqual(["telegram"]);

    const fetched = repo.getById(member.id);
    expect(fetched?.name).toBe("Kevin");
  });

  it("uses defaults for optional fields", () => {
    const member = repo.create({ name: "Alice" });
    expect(member.nickname).toBeUndefined();
    expect(member.roles).toEqual([]);
    expect(member.realmIds).toEqual([]);
    expect(member.notifyChannels).toEqual([]);
  });

  it("lists all members", () => {
    repo.create({ name: "A" });
    repo.create({ name: "B" });
    expect(repo.list()).toHaveLength(2);
  });

  it("finds member by name", () => {
    repo.create({ name: "Kevin", nickname: "Kev" });
    expect(repo.findByName("Kevin")?.name).toBe("Kevin");
    expect(repo.findByName("Kev")?.name).toBe("Kevin");
    expect(repo.findByName("Missing")).toBeNull();
  });

  it("finds members by role", () => {
    repo.create({ name: "A", roles: ["admin"] });
    repo.create({ name: "B", roles: ["parent"] });
    repo.create({ name: "C", roles: ["admin", "parent"] });
    expect(repo.findByRole("admin")).toHaveLength(2);
    expect(repo.findByRole("parent")).toHaveLength(2);
    expect(repo.findByRole("child")).toHaveLength(0);
  });

  it("finds members by realm", () => {
    const otherRealm = realmRepo.create({ name: "Other" }).id;
    repo.create({ name: "A", realmIds: [realmId] });
    repo.create({ name: "B", realmIds: [otherRealm] });
    repo.create({ name: "C", realmIds: [realmId, otherRealm] });
    expect(repo.findByRealm(realmId)).toHaveLength(2);
    expect(repo.findByRealm(otherRealm)).toHaveLength(2);
  });

  it("updates member fields", () => {
    const member = repo.create({ name: "Old" });
    const updated = repo.update(member.id, { name: "New", nickname: "N" });
    expect(updated?.name).toBe("New");
    expect(updated?.nickname).toBe("N");
  });

  it("updates roles and realmIds", () => {
    const member = repo.create({ name: "A", roles: ["admin"], realmIds: [realmId] });
    const updated = repo.update(member.id, {
      roles: ["parent"],
      realmIds: [],
      notifyChannels: ["email"],
    });
    expect(updated?.roles).toEqual(["parent"]);
    expect(updated?.realmIds).toEqual([]);
    expect(updated?.notifyChannels).toEqual(["email"]);
  });

  it("returns null when updating missing member", () => {
    expect(repo.update("fmember_missing", { name: "X" })).toBeNull();
  });

  it("deletes a member", () => {
    const member = repo.create({ name: "Temp" });
    repo.delete(member.id);
    expect(repo.getById(member.id)).toBeNull();
  });

  describe("actions", () => {
    it("creates and retrieves an action", () => {
      const member = repo.create({ name: "Kevin" });
      const action = repo.createAction({
        memberId: member.id,
        memberName: member.name,
        role: "parent",
        action: "check homework",
        sourceRealmId: realmId,
      });
      expect(action.action).toBe("check homework");
      expect(action.status).toBe("pending");
      expect(action.priority).toBe("normal");

      const fetched = repo.getAction(action.id);
      expect(fetched?.action).toBe("check homework");
    });

    it("creates action with priority and source message", () => {
      const member = repo.create({ name: "Kevin" });
      const action = repo.createAction({
        memberId: member.id,
        memberName: member.name,
        role: "admin",
        action: "urgent task",
        priority: "urgent",
        sourceRealmId: realmId,
        sourceMessage: "do it now",
      });
      expect(action.priority).toBe("urgent");
      expect(action.sourceMessage).toBe("do it now");
    });

    it("lists pending actions for a member", () => {
      const member = repo.create({ name: "Kevin" });
      repo.createAction({
        memberId: member.id,
        memberName: member.name,
        role: "parent",
        action: "a1",
        sourceRealmId: realmId,
      });
      repo.createAction({
        memberId: member.id,
        memberName: member.name,
        role: "parent",
        action: "a2",
        sourceRealmId: realmId,
      });
      expect(repo.listPendingActions(member.id)).toHaveLength(2);
    });

    it("lists all pending actions", () => {
      const m1 = repo.create({ name: "A" });
      const m2 = repo.create({ name: "B" });
      repo.createAction({
        memberId: m1.id,
        memberName: m1.name,
        role: "parent",
        action: "a1",
        sourceRealmId: realmId,
      });
      repo.createAction({
        memberId: m2.id,
        memberName: m2.name,
        role: "child",
        action: "a2",
        sourceRealmId: realmId,
      });
      expect(repo.listPendingActions()).toHaveLength(2);
    });

    it("updates action status", () => {
      const member = repo.create({ name: "Kevin" });
      const action = repo.createAction({
        memberId: member.id,
        memberName: member.name,
        role: "parent",
        action: "task",
        sourceRealmId: realmId,
      });
      repo.updateActionStatus(action.id, "done");
      expect(repo.listPendingActions()).toHaveLength(0);
    });
  });
});
