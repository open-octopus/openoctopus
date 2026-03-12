import { afterEach, beforeEach, describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { runMigrations } from "../migrations.js";
import { MemoryRepo } from "./memory-repo.js";
import { RealmRepo } from "./realm-repo.js";
import { EntityRepo } from "./entity-repo.js";

let db: Database.Database;
let repo: MemoryRepo;
let realmRepo: RealmRepo;
let entityRepo: EntityRepo;

beforeEach(() => {
  db = new Database(":memory:");
  runMigrations(db);
  repo = new MemoryRepo(db);
  realmRepo = new RealmRepo(db);
  entityRepo = new EntityRepo(db);
});

afterEach(() => {
  db.close();
});

describe("MemoryRepo", () => {
  describe("basic CRUD", () => {
    it("create and listByRealm", () => {
      const realm = realmRepo.create({ name: "test" });
      repo.create({ realmId: realm.id, tier: "archival", content: "Luna is a cat" });
      const memories = repo.listByRealm(realm.id);
      expect(memories).toHaveLength(1);
      expect(memories[0].content).toBe("Luna is a cat");
      expect(memories[0].realmId).toBe(realm.id);
    });

    it("listByRealm with tier filter", () => {
      const realm = realmRepo.create({ name: "test" });
      repo.create({ realmId: realm.id, tier: "archival", content: "fact one" });
      repo.create({ realmId: realm.id, tier: "working", content: "fact two" });
      const archival = repo.listByRealm(realm.id, "archival");
      expect(archival).toHaveLength(1);
      expect(archival[0].content).toBe("fact one");
    });

    it("listByEntity with tier filter", () => {
      const realm = realmRepo.create({ name: "test" });
      const entity = entityRepo.create({ realmId: realm.id, name: "Luna", type: "living" });
      repo.create({ realmId: realm.id, entityId: entity.id, tier: "archival", content: "archival fact" });
      repo.create({ realmId: realm.id, entityId: entity.id, tier: "working", content: "working fact" });
      const archival = repo.listByEntity(entity.id, "archival");
      expect(archival).toHaveLength(1);
      expect(archival[0].content).toBe("archival fact");
    });

    it("delete", () => {
      const realm = realmRepo.create({ name: "test" });
      const memory = repo.create({ realmId: realm.id, tier: "archival", content: "to delete" });
      repo.delete(memory.id);
      const memories = repo.listByRealm(realm.id);
      expect(memories).toHaveLength(0);
    });
  });

  describe("countByRealm", () => {
    it("counts without tier", () => {
      const realm = realmRepo.create({ name: "test" });
      repo.create({ realmId: realm.id, tier: "archival", content: "one" });
      repo.create({ realmId: realm.id, tier: "working", content: "two" });
      repo.create({ realmId: realm.id, tier: "core", content: "three" });
      expect(repo.countByRealm(realm.id)).toBe(3);
    });

    it("counts with tier", () => {
      const realm = realmRepo.create({ name: "test" });
      repo.create({ realmId: realm.id, tier: "archival", content: "one" });
      repo.create({ realmId: realm.id, tier: "archival", content: "two" });
      repo.create({ realmId: realm.id, tier: "working", content: "three" });
      expect(repo.countByRealm(realm.id, "archival")).toBe(2);
    });

    it("returns 0 for empty", () => {
      const realm = realmRepo.create({ name: "test" });
      expect(repo.countByRealm(realm.id)).toBe(0);
    });
  });

  describe("countByEntity", () => {
    it("counts without tier", () => {
      const realm = realmRepo.create({ name: "test" });
      const entity = entityRepo.create({ realmId: realm.id, name: "Luna", type: "living" });
      repo.create({ realmId: realm.id, entityId: entity.id, tier: "archival", content: "one" });
      repo.create({ realmId: realm.id, entityId: entity.id, tier: "working", content: "two" });
      expect(repo.countByEntity(entity.id)).toBe(2);
    });

    it("counts with tier", () => {
      const realm = realmRepo.create({ name: "test" });
      const entity = entityRepo.create({ realmId: realm.id, name: "Luna", type: "living" });
      repo.create({ realmId: realm.id, entityId: entity.id, tier: "archival", content: "one" });
      repo.create({ realmId: realm.id, entityId: entity.id, tier: "working", content: "two" });
      expect(repo.countByEntity(entity.id, "archival")).toBe(1);
    });
  });

  describe("searchByContent", () => {
    it("finds matching content", () => {
      const realm = realmRepo.create({ name: "test" });
      repo.create({ realmId: realm.id, tier: "archival", content: "Luna likes fish" });
      const results = repo.searchByContent(realm.id, "fish");
      expect(results).toHaveLength(1);
      expect(results[0].content).toBe("Luna likes fish");
    });

    it("returns empty for no match", () => {
      const realm = realmRepo.create({ name: "test" });
      repo.create({ realmId: realm.id, tier: "archival", content: "Luna likes fish" });
      const results = repo.searchByContent(realm.id, "xyz123");
      expect(results).toHaveLength(0);
    });

    it("respects limit", () => {
      const realm = realmRepo.create({ name: "test" });
      repo.create({ realmId: realm.id, tier: "archival", content: "fish one" });
      repo.create({ realmId: realm.id, tier: "archival", content: "fish two" });
      repo.create({ realmId: realm.id, tier: "archival", content: "fish three" });
      const results = repo.searchByContent(realm.id, "fish", 1);
      expect(results).toHaveLength(1);
    });
  });

  describe("listStale", () => {
    it("finds old memories", () => {
      const realm = realmRepo.create({ name: "test" });
      const memory = repo.create({ realmId: realm.id, tier: "archival", content: "old fact" });
      const pastDate = new Date(Date.now() - 100 * 86400000).toISOString();
      db.prepare("UPDATE memories SET updated_at = ? WHERE id = ?").run(pastDate, memory.id);
      const stale = repo.listStale(realm.id, 90);
      expect(stale).toHaveLength(1);
      expect(stale[0].id).toBe(memory.id);
    });

    it("returns empty when none stale", () => {
      const realm = realmRepo.create({ name: "test" });
      repo.create({ realmId: realm.id, tier: "archival", content: "fresh fact" });
      const stale = repo.listStale(realm.id, 90);
      expect(stale).toHaveLength(0);
    });
  });

  describe("updateTier", () => {
    it("updates tier", () => {
      const realm = realmRepo.create({ name: "test" });
      const memory = repo.create({ realmId: realm.id, tier: "archival", content: "fact" });
      repo.updateTier(memory.id, "core");
      const coreMemories = repo.listByRealm(realm.id, "core");
      expect(coreMemories).toHaveLength(1);
      expect(coreMemories[0].id).toBe(memory.id);
    });
  });

  describe("updateContent", () => {
    it("updates content", () => {
      const realm = realmRepo.create({ name: "test" });
      const memory = repo.create({ realmId: realm.id, tier: "archival", content: "old content" });
      repo.updateContent(memory.id, "new content");
      const memories = repo.listByRealm(realm.id);
      expect(memories[0].content).toBe("new content");
    });
  });

  describe("deleteMany", () => {
    it("deletes specified IDs and keeps others", () => {
      const realm = realmRepo.create({ name: "test" });
      const m1 = repo.create({ realmId: realm.id, tier: "archival", content: "one" });
      const m2 = repo.create({ realmId: realm.id, tier: "archival", content: "two" });
      repo.create({ realmId: realm.id, tier: "archival", content: "three" });
      const deleted = repo.deleteMany([m1.id, m2.id]);
      expect(deleted).toBe(2);
      const remaining = repo.listByRealm(realm.id);
      expect(remaining).toHaveLength(1);
      expect(remaining[0].content).toBe("three");
    });

    it("returns 0 for empty array", () => {
      expect(repo.deleteMany([])).toBe(0);
    });
  });
});
