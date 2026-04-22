import fs from "node:fs";
import path from "node:path";
import { describe, it, expect, vi, afterEach } from "vitest";
import { createDatabase, closeDatabase, getDataDir } from "./database.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("database", () => {
  it("getDataDir creates directory recursively", () => {
    const dir = path.join(process.cwd(), "tmp_test_data");
    const result = getDataDir(dir);
    expect(result).toBe(dir);
    expect(fs.existsSync(dir)).toBe(true);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("getDataDir defaults to cwd data dir", () => {
    const result = getDataDir();
    expect(result).toContain(".openoctopus");
    fs.rmSync(result, { recursive: true, force: true });
  });

  it("createDatabase opens in-memory database", () => {
    const db = createDatabase({ inMemory: true });
    expect(db.open).toBe(true);
    closeDatabase(db);
  });

  it("createDatabase opens file database and runs migrations", () => {
    const dataDir = path.join(process.cwd(), "tmp_db_test");
    const db = createDatabase({ dataDir });
    expect(db.open).toBe(true);
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{
      name: string;
    }>;
    expect(tables.some((t) => t.name === "realms")).toBe(true);
    closeDatabase(db);
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it("closeDatabase closes connection", () => {
    const db = createDatabase({ inMemory: true });
    closeDatabase(db);
    expect(db.open).toBe(false);
  });
});
