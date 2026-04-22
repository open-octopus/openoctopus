import { ConflictError } from "@openoctopus/shared";
import { runMigrations } from "@openoctopus/storage";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { RealmManager } from "./realm-manager.js";

let db: Database.Database;
let manager: RealmManager;

beforeEach(() => {
  db = new Database(":memory:");
  runMigrations(db);
  manager = new RealmManager(db);
});

afterEach(() => {
  db.close();
});

describe("RealmManager", () => {
  it("lists realms", () => {
    expect(manager.list()).toHaveLength(0);
    manager.create({ name: "A" });
    expect(manager.list()).toHaveLength(1);
  });

  it("gets realm by id", () => {
    const realm = manager.create({ name: "Test" });
    expect(manager.get(realm.id).name).toBe("Test");
  });

  it("finds realm by name", () => {
    manager.create({ name: "Test" });
    expect(manager.findByName("Test")?.name).toBe("Test");
    expect(manager.findByName("Missing")).toBeNull();
  });

  it("creates realm and logs audit", () => {
    const realm = manager.create({ name: "Finance", description: "Money" });
    expect(realm.name).toBe("Finance");
    expect(realm.description).toBe("Money");
  });

  it("throws on duplicate name", () => {
    manager.create({ name: "Test" });
    expect(() => manager.create({ name: "Test" })).toThrow(ConflictError);
  });

  it("updates realm", () => {
    const realm = manager.create({ name: "Old" });
    const updated = manager.update(realm.id, { name: "New" });
    expect(updated.name).toBe("New");
  });

  it("archives realm", () => {
    const realm = manager.create({ name: "Test" });
    const archived = manager.archive(realm.id);
    expect(archived.status).toBe("archived");
  });

  it("deletes realm", () => {
    const realm = manager.create({ name: "Temp" });
    manager.delete(realm.id);
    expect(manager.findByName("Temp")).toBeNull();
  });

  it("updates health score", () => {
    const realm = manager.create({ name: "Test" });
    manager.updateHealthScore(realm.id, 85, 2);
    const updated = manager.get(realm.id);
    expect(updated.healthScore).toBe(85);
    expect(updated.riskCount).toBe(2);
  });
});
