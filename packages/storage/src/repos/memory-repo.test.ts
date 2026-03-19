import { afterEach, beforeEach, describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { runMigrations } from "../migrations.js";
import { MemoryRepo } from "./memory-repo.js";
import { RealmRepo } from "./realm-repo.js";
import { EntityRepo } from "./entity-repo.js";

const mockEmbed = async (texts: string[]) => texts.map(() => [1, 0, 0]);

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

  describe("embedding storage", () => {
    it("should store and retrieve embedding data", () => {
      // Create parent realm first (FK constraint)
      db.prepare("INSERT INTO realms (id, name, description) VALUES (?, ?, ?)").run("realm_emb", "emb", "test");

      const entry = repo.create({
        realmId: "realm_emb",
        tier: "archival",
        content: "test fact",
      });
      repo.updateEmbedding(entry.id, [0.1, 0.2, 0.3]);
      const retrieved = repo.getById(entry.id);
      expect(retrieved.embedding).toEqual([0.1, 0.2, 0.3]);
    });

    it("should store embeddingDim in metadata", () => {
      db.prepare("INSERT OR IGNORE INTO realms (id, name, description) VALUES (?, ?, ?)").run("realm_emb2", "emb2", "test");
      const entry = repo.create({ realmId: "realm_emb2", tier: "archival", content: "x" });
      repo.updateEmbedding(entry.id, [1, 2, 3, 4]);
      const retrieved = repo.getById(entry.id);
      expect(retrieved.metadata.embeddingDim).toBe(4);
    });

    it("getById throws for nonexistent id", () => {
      expect(() => repo.getById("nonexistent")).toThrow();
    });
  });

  describe("semantic search", () => {
    beforeEach(() => {
      db.prepare("INSERT OR IGNORE INTO realms (id, name, description) VALUES (?, ?, ?)").run("realm_sem", "sem", "test");
    });

    it("searchSemantic returns entries sorted by cosine similarity", () => {
      const e1 = repo.create({ realmId: "realm_sem", tier: "archival", content: "cats" });
      const e2 = repo.create({ realmId: "realm_sem", tier: "archival", content: "dogs" });
      const e3 = repo.create({ realmId: "realm_sem", tier: "archival", content: "fish" });

      repo.updateEmbedding(e1.id, [1, 0, 0]);
      repo.updateEmbedding(e2.id, [0.9, 0.1, 0]);
      repo.updateEmbedding(e3.id, [0, 0, 1]);

      const results = repo.searchSemantic([1, 0, 0], "realm_sem", 2);
      expect(results.length).toBe(2);
      expect(results[0].id).toBe(e1.id);
      expect(results[1].id).toBe(e2.id);
    });

    it("returns empty for realm with no embeddings", () => {
      const results = repo.searchSemantic([1, 0, 0], "realm_none", 5);
      expect(results.length).toBe(0);
    });

    it("only returns entries with matching dimensions", () => {
      const e1 = repo.create({ realmId: "realm_sem", tier: "archival", content: "a" });
      const e2 = repo.create({ realmId: "realm_sem", tier: "archival", content: "b" });
      repo.updateEmbedding(e1.id, [1, 0, 0]);       // 3-dim
      repo.updateEmbedding(e2.id, [1, 0, 0, 0, 0]); // 5-dim

      const results = repo.searchSemantic([1, 0, 0], "realm_sem", 10);
      expect(results.length).toBe(1);
      expect(results[0].id).toBe(e1.id);
    });

    it("backfillEmbeddings processes memories without embeddings", async () => {
      repo.create({ realmId: "realm_sem", tier: "archival", content: "fact1" });
      repo.create({ realmId: "realm_sem", tier: "archival", content: "fact2" });
      const result = await repo.backfillEmbeddings(mockEmbed);
      expect(result.processed).toBe(2);
      expect(result.skipped).toBe(0);
    });

    it("backfillEmbeddings skips memories that already have embeddings", async () => {
      const e = repo.create({ realmId: "realm_sem", tier: "archival", content: "has_emb" });
      repo.updateEmbedding(e.id, [0.5, 0.5, 0.5]);
      repo.create({ realmId: "realm_sem", tier: "archival", content: "no_emb" });
      const result = await repo.backfillEmbeddings(mockEmbed);
      expect(result.processed).toBe(1);
      expect(result.skipped).toBe(1);
    });
  });
});
