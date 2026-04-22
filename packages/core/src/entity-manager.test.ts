import { runMigrations, RealmRepo } from "@openoctopus/storage";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { EntityManager } from "./entity-manager.js";

let db: Database.Database;
let manager: EntityManager;
let realmId: string;

beforeEach(() => {
  db = new Database(":memory:");
  runMigrations(db);
  manager = new EntityManager(db);

  const realmRepo = new RealmRepo(db);
  realmId = realmRepo.create({ name: "Test" }).id;
});

afterEach(() => {
  db.close();
});

describe("EntityManager", () => {
  it("lists entities by realm", () => {
    expect(manager.listByRealm(realmId)).toHaveLength(0);
    manager.create({ realmId, name: "A", type: "living" });
    expect(manager.listByRealm(realmId)).toHaveLength(1);
  });

  it("finds entity by name in realm", () => {
    manager.create({ realmId, name: "Luna", type: "living" });
    expect(manager.findByNameInRealm(realmId, "Luna")?.name).toBe("Luna");
    expect(manager.findByNameInRealm(realmId, "Missing")).toBeNull();
  });

  it("counts entities by realm", () => {
    manager.create({ realmId, name: "A", type: "living" });
    manager.create({ realmId, name: "B", type: "asset" });
    expect(manager.countByRealm(realmId)).toBe(2);
  });

  it("gets entity by id", () => {
    const entity = manager.create({ realmId, name: "X", type: "living" });
    expect(manager.get(entity.id).name).toBe("X");
  });

  it("creates entity and logs audit", () => {
    const entity = manager.create({ realmId, name: "Y", type: "abstract", avatar: "y.png" });
    expect(entity.name).toBe("Y");
    expect(entity.type).toBe("abstract");
    expect(entity.avatar).toBe("y.png");
  });

  it("validates realm on create", () => {
    expect(() => manager.create({ realmId: "realm_missing", name: "Z", type: "living" })).toThrow();
  });

  it("validates realm on list", () => {
    expect(() => manager.listByRealm("realm_missing")).toThrow();
  });

  it("updates entity", () => {
    const entity = manager.create({ realmId, name: "Old", type: "living" });
    const updated = manager.update(entity.id, { name: "New" });
    expect(updated.name).toBe("New");
  });

  it("deletes entity", () => {
    const entity = manager.create({ realmId, name: "Temp", type: "living" });
    manager.delete(entity.id);
    expect(manager.findByNameInRealm(realmId, "Temp")).toBeNull();
  });
});
