import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runMigrations } from "../migrations.js";
import { AuditRepo } from "./audit-repo.js";
import { RealmRepo } from "./realm-repo.js";

let db: Database.Database;
let auditRepo: AuditRepo;
let realmRepo: RealmRepo;
let realmId: string;

beforeEach(() => {
  db = new Database(":memory:");
  runMigrations(db);
  auditRepo = new AuditRepo(db);
  realmRepo = new RealmRepo(db);
  realmId = realmRepo.create({ name: "Test" }).id;
});

afterEach(() => {
  db.close();
});

describe("AuditRepo", () => {
  it("logs an audit event with all fields", () => {
    const event = auditRepo.log({
      realmId,
      agentId: "agent_1",
      action: "create",
      resource: "realm",
      resourceId: realmId,
      details: { reason: "test" },
    });
    expect(event.action).toBe("create");
    expect(event.resource).toBe("realm");
    expect(event.realmId).toBe(realmId);
    expect(event.agentId).toBe("agent_1");
    expect(event.resourceId).toBe(realmId);
    expect(event.details).toEqual({ reason: "test" });
    expect(event.timestamp).toBeDefined();
  });

  it("logs an audit event with minimal fields", () => {
    const event = auditRepo.log({
      action: "delete",
      resource: "entity",
    });
    expect(event.action).toBe("delete");
    expect(event.resource).toBe("entity");
    expect(event.realmId).toBeUndefined();
    expect(event.agentId).toBeUndefined();
    expect(event.resourceId).toBeUndefined();
    expect(event.details).toEqual({});
  });

  it("lists audit events", () => {
    auditRepo.log({ action: "a1", resource: "r1" });
    auditRepo.log({ action: "a2", resource: "r2" });
    const events = auditRepo.list();
    expect(events).toHaveLength(2);
    expect(events[0].action).toBe("a2"); // DESC order
  });

  it("lists audit events with realm filter", () => {
    const otherRealm = realmRepo.create({ name: "Other" }).id;
    auditRepo.log({ realmId, action: "a1", resource: "r1" });
    auditRepo.log({ realmId: otherRealm, action: "a2", resource: "r2" });
    auditRepo.log({ action: "a3", resource: "r3" });

    const filtered = auditRepo.list({ realmId });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].action).toBe("a1");
  });

  it("lists audit events with pagination", () => {
    auditRepo.log({ action: "a1", resource: "r1" });
    auditRepo.log({ action: "a2", resource: "r2" });
    auditRepo.log({ action: "a3", resource: "r3" });

    const page = auditRepo.list({ limit: 1, offset: 1 });
    expect(page).toHaveLength(1);
    expect(page[0].action).toBe("a2");
  });
});
