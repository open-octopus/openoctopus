import { afterEach, beforeEach, describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { RealmNotFoundError } from "@openoctopus/shared";
import { runMigrations } from "../migrations.js";
import { RealmRepo } from "./realm-repo.js";

let db: Database.Database;
let repo: RealmRepo;

beforeEach(() => {
  db = new Database(":memory:");
  runMigrations(db);
  repo = new RealmRepo(db);
});

afterEach(() => {
  db.close();
});

describe("RealmRepo", () => {
  it("creates and retrieves a realm", () => {
    const realm = repo.create({ name: "Pet", description: "Pet care realm" });
    expect(realm.name).toBe("Pet");
    expect(realm.description).toBe("Pet care realm");
    expect(realm.status).toBe("active");
    expect(realm.healthScore).toBe(100);

    const fetched = repo.getById(realm.id);
    expect(fetched.name).toBe("Pet");
  });

  it("lists all realms", () => {
    repo.create({ name: "Finance" });
    repo.create({ name: "Health" });
    const realms = repo.list();
    expect(realms).toHaveLength(2);
    expect(realms.map((r) => r.name)).toEqual(["Finance", "Health"]);
  });

  it("finds realm by name", () => {
    repo.create({ name: "Pet" });
    const found = repo.findByName("Pet");
    expect(found).not.toBeNull();
    expect(found?.name).toBe("Pet");

    const notFound = repo.findByName("Unknown");
    expect(notFound).toBeNull();
  });

  it("updates a realm", () => {
    const realm = repo.create({ name: "Old" });
    const updated = repo.update(realm.id, { name: "New", status: "paused" });
    expect(updated.name).toBe("New");
    expect(updated.status).toBe("paused");
  });

  it("deletes a realm", () => {
    const realm = repo.create({ name: "Temp" });
    repo.delete(realm.id);
    expect(() => repo.getById(realm.id)).toThrow(RealmNotFoundError);
  });

  it("throws on missing realm", () => {
    expect(() => repo.getById("realm_nonexistent")).toThrow(RealmNotFoundError);
  });

  it("updates activity timestamp", () => {
    const realm = repo.create({ name: "Active" });
    repo.updateActivity(realm.id);
    const updated = repo.getById(realm.id);
    expect(updated.lastActivity).toBeDefined();
  });

  describe("updateHealthScore", () => {
    it("updates health score with riskCount", () => {
      const realm = repo.create({ name: "Health" });
      repo.updateHealthScore(realm.id, 75, 3);
      const updated = repo.getById(realm.id);
      expect(updated.healthScore).toBe(75);
      expect(updated.riskCount).toBe(3);
    });

    it("updates health score without riskCount", () => {
      const realm = repo.create({ name: "NoRisk" });
      repo.updateHealthScore(realm.id, 90);
      const updated = repo.getById(realm.id);
      expect(updated.healthScore).toBe(90);
      expect(updated.riskCount).toBe(0); // default unchanged
    });
  });
});
