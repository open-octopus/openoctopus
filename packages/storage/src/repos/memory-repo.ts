import type Database from "better-sqlite3";
import type { MemoryEntry, MemoryTier } from "@openoctopus/shared";
import { generateId } from "@openoctopus/shared";

interface MemoryRow {
  id: string;
  realm_id: string;
  entity_id: string | null;
  tier: string;
  content: string;
  metadata: string;
  embedding: Buffer | null;
  created_at: string;
  updated_at: string;
}

function rowToMemory(row: MemoryRow): MemoryEntry {
  let embedding: number[] | undefined;
  if (row.embedding) {
    const buf = row.embedding;
    embedding = Array.from(new Float64Array(buf.buffer, buf.byteOffset, buf.byteLength / 8));
  }
  return {
    id: row.id,
    realmId: row.realm_id,
    entityId: row.entity_id ?? undefined,
    tier: row.tier as MemoryTier,
    content: row.content,
    embedding,
    metadata: JSON.parse(row.metadata) as Record<string, unknown>,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Compute cosine similarity between two vectors */
function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

export class MemoryRepo {
  constructor(private db: Database.Database) {}

  listByRealm(realmId: string, tier?: MemoryTier): MemoryEntry[] {
    if (tier) {
      const rows = this.db
        .prepare("SELECT * FROM memories WHERE realm_id = ? AND tier = ? ORDER BY updated_at DESC")
        .all(realmId, tier) as MemoryRow[];
      return rows.map(rowToMemory);
    }
    const rows = this.db
      .prepare("SELECT * FROM memories WHERE realm_id = ? ORDER BY updated_at DESC")
      .all(realmId) as MemoryRow[];
    return rows.map(rowToMemory);
  }

  listByEntity(entityId: string, tier?: MemoryTier): MemoryEntry[] {
    if (tier) {
      const rows = this.db
        .prepare("SELECT * FROM memories WHERE entity_id = ? AND tier = ? ORDER BY updated_at DESC")
        .all(entityId, tier) as MemoryRow[];
      return rows.map(rowToMemory);
    }
    const rows = this.db
      .prepare("SELECT * FROM memories WHERE entity_id = ? ORDER BY updated_at DESC")
      .all(entityId) as MemoryRow[];
    return rows.map(rowToMemory);
  }

  create(data: {
    realmId: string;
    entityId?: string;
    tier: MemoryTier;
    content: string;
    metadata?: Record<string, unknown>;
  }): MemoryEntry {
    const id = generateId("memory");
    const now = new Date().toISOString();

    this.db
      .prepare(
        `INSERT INTO memories (id, realm_id, entity_id, tier, content, metadata, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(id, data.realmId, data.entityId ?? null, data.tier, data.content, JSON.stringify(data.metadata ?? {}), now, now);

    return {
      id,
      realmId: data.realmId,
      entityId: data.entityId,
      tier: data.tier,
      content: data.content,
      metadata: data.metadata ?? {},
      createdAt: now,
      updatedAt: now,
    };
  }

  delete(id: string): void {
    this.db.prepare("DELETE FROM memories WHERE id = ?").run(id);
  }

  countByRealm(realmId: string, tier?: MemoryTier): number {
    if (tier) {
      const row = this.db
        .prepare("SELECT COUNT(*) as cnt FROM memories WHERE realm_id = ? AND tier = ?")
        .get(realmId, tier) as { cnt: number };
      return row.cnt;
    }
    const row = this.db
      .prepare("SELECT COUNT(*) as cnt FROM memories WHERE realm_id = ?")
      .get(realmId) as { cnt: number };
    return row.cnt;
  }

  countByEntity(entityId: string, tier?: MemoryTier): number {
    if (tier) {
      const row = this.db
        .prepare("SELECT COUNT(*) as cnt FROM memories WHERE entity_id = ? AND tier = ?")
        .get(entityId, tier) as { cnt: number };
      return row.cnt;
    }
    const row = this.db
      .prepare("SELECT COUNT(*) as cnt FROM memories WHERE entity_id = ?")
      .get(entityId) as { cnt: number };
    return row.cnt;
  }

  searchByContent(realmId: string, query: string, limit = 20): MemoryEntry[] {
    const rows = this.db
      .prepare("SELECT * FROM memories WHERE realm_id = ? AND content LIKE ? ORDER BY updated_at DESC LIMIT ?")
      .all(realmId, `%${query}%`, limit) as MemoryRow[];
    return rows.map(rowToMemory);
  }

  listStale(realmId: string, olderThanDays: number): MemoryEntry[] {
    const cutoff = new Date(Date.now() - olderThanDays * 86400000).toISOString();
    const rows = this.db
      .prepare("SELECT * FROM memories WHERE realm_id = ? AND updated_at < ? ORDER BY updated_at ASC")
      .all(realmId, cutoff) as MemoryRow[];
    return rows.map(rowToMemory);
  }

  updateTier(id: string, tier: MemoryTier): void {
    const now = new Date().toISOString();
    this.db.prepare("UPDATE memories SET tier = ?, updated_at = ? WHERE id = ?").run(tier, now, id);
  }

  updateContent(id: string, content: string): void {
    const now = new Date().toISOString();
    this.db.prepare("UPDATE memories SET content = ?, updated_at = ? WHERE id = ?").run(content, now, id);
  }

  deleteMany(ids: string[]): number {
    if (ids.length === 0) {return 0;}
    const placeholders = ids.map(() => "?").join(",");
    const result = this.db.prepare(`DELETE FROM memories WHERE id IN (${placeholders})`).run(...ids);
    return result.changes;
  }

  updateEmbedding(id: string, embedding: number[]): void {
    const blob = Buffer.from(new Float64Array(embedding).buffer);
    // Store embedding BLOB + dimension count in metadata
    const row = this.db.prepare("SELECT metadata FROM memories WHERE id = ?").get(id) as { metadata: string } | undefined;
    const metadata = row?.metadata ? JSON.parse(row.metadata) : {};
    metadata.embeddingDim = embedding.length;
    this.db.prepare("UPDATE memories SET embedding = ?, metadata = ? WHERE id = ?")
      .run(blob, JSON.stringify(metadata), id);
  }

  getById(id: string): MemoryEntry {
    const row = this.db.prepare("SELECT * FROM memories WHERE id = ?").get(id) as MemoryRow | undefined;
    if (!row) {throw new Error(`Memory ${id} not found`);}
    return rowToMemory(row);
  }

  searchSemantic(queryVector: number[], realmId: string, topK: number): MemoryEntry[] {
    const rows = this.db
      .prepare("SELECT * FROM memories WHERE realm_id = ? AND embedding IS NOT NULL")
      .all(realmId) as MemoryRow[];

    const queryDim = queryVector.length;
    const scored: Array<{ entry: MemoryEntry; score: number }> = [];

    for (const row of rows) {
      const entry = rowToMemory(row);
      if (!entry.embedding) {continue;}
      // Filter by matching dimension count
      const embeddingDim = (entry.metadata as Record<string, unknown>).embeddingDim as number | undefined;
      if (embeddingDim !== undefined && embeddingDim !== queryDim) {continue;}
      if (entry.embedding.length !== queryDim) {continue;}

      const score = cosineSimilarity(queryVector, entry.embedding);
      scored.push({ entry, score });
    }

    return scored
      .toSorted((a, b) => b.score - a.score)
      .slice(0, topK)
      .map(s => s.entry);
  }

  async backfillEmbeddings(
    embedFn: (texts: string[]) => Promise<number[][]>,
    realmId?: string,
  ): Promise<{ processed: number; skipped: number }> {
    const query = realmId
      ? "SELECT * FROM memories WHERE embedding IS NULL AND realm_id = ?"
      : "SELECT * FROM memories WHERE embedding IS NULL";
    const rows = (realmId
      ? this.db.prepare(query).all(realmId)
      : this.db.prepare(query).all()) as MemoryRow[];

    const withEmbedding = realmId
      ? (this.db.prepare("SELECT COUNT(*) as cnt FROM memories WHERE embedding IS NOT NULL AND realm_id = ?").get(realmId) as { cnt: number }).cnt
      : (this.db.prepare("SELECT COUNT(*) as cnt FROM memories WHERE embedding IS NOT NULL").get() as { cnt: number }).cnt;

    if (rows.length === 0) {
      return { processed: 0, skipped: withEmbedding };
    }

    // Batch in groups of 50
    const batchSize = 50;
    let processed = 0;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const texts = batch.map(r => r.content);
      const vectors = await embedFn(texts);
      for (let j = 0; j < batch.length; j++) {
        this.updateEmbedding(batch[j].id, vectors[j]);
        processed++;
      }
    }

    return { processed, skipped: withEmbedding };
  }
}
