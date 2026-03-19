import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runMigrations } from "../migrations.js";
import { ScannedFileRepo } from "./scanned-file-repo.js";

let db: Database.Database;
let repo: ScannedFileRepo;

beforeEach(() => {
  db = new Database(":memory:");
  runMigrations(db);
  repo = new ScannedFileRepo(db);
});

afterEach(() => {
  db.close();
});

describe("ScannedFileRepo", () => {
  it("upsert and findByPath", () => {
    repo.upsert({ path: "/home/user/notes.md", fileHash: "abc123", factsExtracted: 5 });
    const file = repo.findByPath("/home/user/notes.md");
    expect(file).not.toBeNull();
    expect(file!.fileHash).toBe("abc123");
    expect(file!.factsExtracted).toBe(5);
  });

  it("upsert updates existing record", () => {
    repo.upsert({ path: "/home/user/notes.md", fileHash: "abc123", factsExtracted: 5 });
    repo.upsert({ path: "/home/user/notes.md", fileHash: "def456", factsExtracted: 10 });
    const file = repo.findByPath("/home/user/notes.md");
    expect(file).not.toBeNull();
    expect(file!.fileHash).toBe("def456");
  });

  it("findByPath returns null for unknown", () => {
    const file = repo.findByPath("/unknown");
    expect(file).toBeNull();
  });

  it("listByRealm filters by realm", () => {
    repo.upsert({ path: "/a.md", fileHash: "h1", realmId: "realm_aaa", factsExtracted: 1 });
    repo.upsert({ path: "/b.md", fileHash: "h2", realmId: "realm_bbb", factsExtracted: 2 });
    const results = repo.listByRealm("realm_aaa");
    expect(results).toHaveLength(1);
    expect(results[0].path).toBe("/a.md");
  });

  it("upsert overwrites on conflict", () => {
    repo.upsert({ path: "/dup.md", fileHash: "h1", factsExtracted: 1 });
    repo.upsert({ path: "/dup.md", fileHash: "h2", factsExtracted: 2 });
    const _all = repo.listByRealm("realm_any");
    // Both entries have no realmId matching "realm_any", so this returns 0
    // Instead verify by findByPath that there is only one record
    const file = repo.findByPath("/dup.md");
    expect(file).not.toBeNull();
    expect(file!.fileHash).toBe("h2");
    // Verify there's only 1 row total
    const count = db
      .prepare("SELECT COUNT(*) as cnt FROM scanned_files WHERE path = ?")
      .get("/dup.md") as { cnt: number };
    expect(count.cnt).toBe(1);
  });

  it("factsExtracted updates", () => {
    repo.upsert({ path: "/facts.md", fileHash: "h1", factsExtracted: 3 });
    repo.upsert({ path: "/facts.md", fileHash: "h1", factsExtracted: 5 });
    const file = repo.findByPath("/facts.md");
    expect(file).not.toBeNull();
    expect(file!.factsExtracted).toBe(5);
  });
});
