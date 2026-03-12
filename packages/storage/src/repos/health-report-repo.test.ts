import { afterEach, beforeEach, describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { runMigrations } from "../migrations.js";
import { HealthReportRepo } from "./health-report-repo.js";
import { RealmRepo } from "./realm-repo.js";

let db: Database.Database;
let repo: HealthReportRepo;
let realmRepo: RealmRepo;

beforeEach(() => {
  db = new Database(":memory:");
  runMigrations(db);
  repo = new HealthReportRepo(db);
  realmRepo = new RealmRepo(db);
});

afterEach(() => {
  db.close();
});

describe("HealthReportRepo", () => {
  it("create and getLatest", () => {
    const realm = realmRepo.create({ name: "test" });
    const report = repo.create({
      realmId: realm.id,
      healthScore: 85,
      memoryCount: 10,
      duplicateCount: 1,
      staleCount: 2,
      contradictionCount: 0,
      issues: [],
    });
    const latest = repo.getLatest(realm.id);
    expect(latest).not.toBeNull();
    expect(latest!.id).toBe(report.id);
    expect(latest!.healthScore).toBe(85);
  });

  it("getLatest returns null when empty", () => {
    const realm = realmRepo.create({ name: "empty" });
    const latest = repo.getLatest(realm.id);
    expect(latest).toBeNull();
  });

  it("getLatest returns most recent", () => {
    const realm = realmRepo.create({ name: "test" });
    const older = repo.create({
      realmId: realm.id,
      healthScore: 70,
      memoryCount: 5,
      duplicateCount: 0,
      staleCount: 0,
      contradictionCount: 0,
      issues: [],
    });
    // Push the first report's computed_at into the past so ordering is deterministic
    db.prepare("UPDATE health_reports SET computed_at = ? WHERE id = ?").run("2020-01-01T00:00:00.000Z", older.id);
    repo.create({
      realmId: realm.id,
      healthScore: 95,
      memoryCount: 15,
      duplicateCount: 0,
      staleCount: 0,
      contradictionCount: 0,
      issues: [],
    });
    const latest = repo.getLatest(realm.id);
    expect(latest).not.toBeNull();
    expect(latest!.healthScore).toBe(95);
  });

  it("listByRealm with limit", () => {
    const realm = realmRepo.create({ name: "test" });
    repo.create({ realmId: realm.id, healthScore: 80, memoryCount: 1, duplicateCount: 0, staleCount: 0, contradictionCount: 0, issues: [] });
    repo.create({ realmId: realm.id, healthScore: 85, memoryCount: 2, duplicateCount: 0, staleCount: 0, contradictionCount: 0, issues: [] });
    repo.create({ realmId: realm.id, healthScore: 90, memoryCount: 3, duplicateCount: 0, staleCount: 0, contradictionCount: 0, issues: [] });
    const reports = repo.listByRealm(realm.id, 2);
    expect(reports).toHaveLength(2);
  });

  it("issues JSON roundtrip", () => {
    const realm = realmRepo.create({ name: "test" });
    const issues = [{ kind: "duplicate", memoryIds: ["m1"], description: "dup", suggestion: "fix" }];
    repo.create({
      realmId: realm.id,
      healthScore: 60,
      memoryCount: 10,
      duplicateCount: 1,
      staleCount: 0,
      contradictionCount: 0,
      issues,
    });
    const latest = repo.getLatest(realm.id);
    expect(latest).not.toBeNull();
    expect(latest!.issues).toEqual(issues);
  });

  it("realm delete cascades", () => {
    const realm = realmRepo.create({ name: "cascade" });
    repo.create({
      realmId: realm.id,
      healthScore: 50,
      memoryCount: 5,
      duplicateCount: 0,
      staleCount: 0,
      contradictionCount: 0,
      issues: [],
    });
    realmRepo.delete(realm.id);
    const latest = repo.getLatest(realm.id);
    expect(latest).toBeNull();
  });
});
