import type Database from "better-sqlite3";

interface ScannedFileRow {
  id: number;
  path: string;
  file_hash: string;
  realm_id: string | null;
  facts_extracted: number;
  scanned_at: string;
  updated_at: string;
}

export interface ScannedFile {
  id: number;
  path: string;
  fileHash: string;
  realmId?: string;
  factsExtracted: number;
  scannedAt: string;
  updatedAt: string;
}

function rowToScannedFile(row: ScannedFileRow): ScannedFile {
  return {
    id: row.id,
    path: row.path,
    fileHash: row.file_hash,
    realmId: row.realm_id ?? undefined,
    factsExtracted: row.facts_extracted,
    scannedAt: row.scanned_at,
    updatedAt: row.updated_at,
  };
}

export class ScannedFileRepo {
  constructor(private db: Database.Database) {}

  findByPath(path: string): ScannedFile | null {
    const row = this.db.prepare("SELECT * FROM scanned_files WHERE path = ?").get(path) as ScannedFileRow | undefined;
    return row ? rowToScannedFile(row) : null;
  }

  upsert(data: { path: string; fileHash: string; realmId?: string; factsExtracted: number }): void {
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO scanned_files (path, file_hash, realm_id, facts_extracted, scanned_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(path) DO UPDATE SET
           file_hash = excluded.file_hash,
           realm_id = excluded.realm_id,
           facts_extracted = excluded.facts_extracted,
           updated_at = excluded.updated_at`,
      )
      .run(data.path, data.fileHash, data.realmId ?? null, data.factsExtracted, now, now);
  }

  listByRealm(realmId: string): ScannedFile[] {
    const rows = this.db
      .prepare("SELECT * FROM scanned_files WHERE realm_id = ? ORDER BY scanned_at DESC")
      .all(realmId) as ScannedFileRow[];
    return rows.map(rowToScannedFile);
  }
}
