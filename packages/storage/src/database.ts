import fs from "node:fs";
import path from "node:path";
import { createLogger, DB_FILE, DATA_DIR } from "@openoctopus/shared";
import Database from "better-sqlite3";
import { runMigrations } from "./migrations.js";

const log = createLogger("storage");

export interface DatabaseOptions {
  dataDir?: string;
  inMemory?: boolean;
}

export function getDataDir(baseDir?: string): string {
  const dir = baseDir ?? path.join(process.cwd(), DATA_DIR);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function createDatabase(options: DatabaseOptions = {}): Database.Database {
  const dbPath = options.inMemory ? ":memory:" : path.join(getDataDir(options.dataDir), DB_FILE);

  if (!options.inMemory) {
    log.info(`Opening database at ${dbPath}`);
  }

  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  runMigrations(db);

  return db;
}

export function closeDatabase(db: Database.Database): void {
  db.close();
}
