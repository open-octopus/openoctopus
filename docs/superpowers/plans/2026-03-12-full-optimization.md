# Full Optimization Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement 5-phase optimization: engineering foundation, vector semantic search, knowledge quality loop, conversation experience, and automation/proactivity.

**Architecture:** Bottom-up dependency chain. Vector search (Phase 2) is the multiplier — it unlocks semantic dedup, contextual memory injection, and knowledge graph queries. Phases 4 and 5 are independent and can run in parallel after Phase 3.

**Tech Stack:** TypeScript 5.7+, Vitest 4, SQLite (better-sqlite3), Zod, OpenAI/Ollama embedding APIs, node-cron, fs.watch.

**Spec:** `docs/superpowers/specs/2026-03-12-full-optimization-design.md`

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `.github/workflows/ci.yml` | CI pipeline: lint, typecheck, test, build, coverage artifacts |
| `packages/core/src/embedding/embedding-provider.ts` | EmbeddingProvider interface + OpenAI/Ollama/Stub implementations |
| `packages/core/src/embedding/embedding-registry.ts` | Multi-provider registry with failover (mirrors LlmProviderRegistry) |
| `packages/core/src/embedding/index.ts` | Barrel export |
| `packages/core/src/embedding/embedding-provider.test.ts` | Provider unit tests |
| `packages/core/src/embedding/embedding-registry.test.ts` | Registry unit tests |
| `packages/storage/src/repos/knowledge-graph-repo.ts` | KnowledgeNode/Edge CRUD + graph queries |
| `packages/storage/src/repos/knowledge-graph-repo.test.ts` | Graph repo tests |
| `packages/core/src/scheduler.ts` | Cron-based proactive rule engine |
| `packages/core/src/scheduler.test.ts` | Scheduler tests |

### Modified Files
| File | Changes |
|------|---------|
| `packages/shared/src/config.ts` | Add `embeddings` config section |
| `packages/shared/src/types.ts` | Add embedding-related types |
| `packages/shared/src/rpc-protocol.ts` | Add `maturity.progress` event |
| `packages/storage/src/migrations.ts` | v3 migration: `embedding` column on memories |
| `packages/storage/src/repos/memory-repo.ts` | `searchSemantic()`, `updateEmbedding()`, `backfillEmbeddings()` |
| `packages/storage/src/repos/memory-repo.test.ts` | Semantic search + backfill tests |
| `packages/storage/src/index.ts` | Export KnowledgeGraphRepo |
| `packages/core/src/memory-extractor.ts` | Dedup (skip + merge), relations, importance, attribute updates |
| `packages/core/src/memory-extractor.test.ts` | Extended tests |
| `packages/core/src/maturity-scanner.ts` | Progressive guidance (40-59 range) |
| `packages/core/src/maturity-scanner.test.ts` | Guidance tests |
| `packages/core/src/directory-scanner.ts` | `watchDirectory()` |
| `packages/core/src/index.ts` | Export new modules |
| `packages/ink/src/chat-pipeline.ts` | Semantic memory injection, attribute auto-update |
| `packages/ink/src/chat-pipeline.test.ts` | Extended tests |
| `packages/ink/src/rpc-handlers.ts` | Add embeddingRegistry to RpcServices |
| `packages/ink/src/server.ts` | Wire embedding registry, scheduler |
| `packages/tentacle/src/tui/renderer.ts` | Render proactive messages + progress events |
| `packages/tentacle/src/commands/chat.ts` | Handle progress events from WS |

---

## Chunk 1: Phase 1 (Engineering Foundation) + Phase 2 (Vector Semantic Search)

### Task 1: Commit existing changes

**Files:**
- All currently modified/untracked files (~34 files, ~2200 lines)

- [ ] **Step 1: Review and stage changes**

Run `git status` and `git diff --stat HEAD` to review.

- [ ] **Step 2: Commit Phase 1.5 + runtime fixes**

Stage all modified/new packages, docs, realms, test helpers, and lock file. Commit with message describing Phase 1.5 knowledge lifecycle modules and 7 runtime fixes.

- [ ] **Step 3: Verify clean state**

Run `git status` — expected: clean working tree.

---

### Task 2: Add CI/CD workflow

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Write CI workflow**

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm test:unit -- --coverage
      - run: pnpm test:integration
      - run: pnpm build
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: coverage-report
          path: coverage/
          retention-days: 14
```

- [ ] **Step 2: Commit**

---

### Task 3: Add embedding types to shared

**Files:**
- Modify: `packages/shared/src/types.ts`
- Modify: `packages/shared/src/config.ts`

- [ ] **Step 1: Add embedding types to `packages/shared/src/types.ts`**

Add before the ScanResult section:

```typescript
// -- Embedding --

export const EmbeddingEntrySchema = z.object({
  text: z.string(),
  vector: z.array(z.number()),
  model: z.string(),
  dimensions: z.number(),
});
export type EmbeddingEntry = z.infer<typeof EmbeddingEntrySchema>;
```

- [ ] **Step 2: Add embedding config to `packages/shared/src/config.ts`**

Add `EmbeddingProviderConfigSchema` parallel to `LlmProviderConfigSchema`:

```typescript
export const EmbeddingProviderConfigSchema = z.object({
  api: z.enum(["openai", "ollama"]).default("openai"),
  apiKey: z.string().optional(),
  baseUrl: z.string().optional(),
  model: z.string().optional(),
  priority: z.number().default(0),
});
```

Add `embeddings` field to `OpenOctopusConfigSchema`:

```typescript
embeddings: z.object({
  defaultProvider: z.string().default("openai"),
  defaultModel: z.string().default("text-embedding-3-small"),
  providers: z.record(z.string(), EmbeddingProviderConfigSchema).default({}),
}).default({}),
```

In the auto-config function, add OpenAI embedding provider auto-detection from `OPENAI_API_KEY`.

- [ ] **Step 3: Build to verify types compile**

Run: `pnpm build` — expected: success.

- [ ] **Step 4: Commit**

---

### Task 4: Add v3 migration for embedding column

**Files:**
- Modify: `packages/storage/src/migrations.ts`
- Modify: `packages/storage/src/repos/memory-repo.ts`
- Modify: `packages/storage/src/repos/memory-repo.test.ts`

- [ ] **Step 1: Write test for embedding storage**

Add to `memory-repo.test.ts`. **Note:** Tests must create a parent realm first to satisfy foreign key constraints.

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run packages/storage/src/repos/memory-repo.test.ts -t "embedding"`
Expected: FAIL — `updateEmbedding` does not exist.

- [ ] **Step 3: Add v3 migration**

Add to the `migrations` array in `packages/storage/src/migrations.ts`:

```typescript
{
  version: 3,
  name: "add_embedding_column",
  up(db) {
    db.exec("ALTER TABLE memories ADD COLUMN embedding BLOB");
  },
  down(db) {
    db.exec("ALTER TABLE memories DROP COLUMN embedding");
  },
},
```

- [ ] **Step 4: Add `updateEmbedding` and `getById` to MemoryRepo**

`updateEmbedding` must also store the dimension count in `metadata.embeddingDim` so that `searchSemantic` can filter by matching dimensions when the embedding provider changes.

```typescript
updateEmbedding(id: string, embedding: number[]): void {
  const blob = Buffer.from(new Float64Array(embedding).buffer);
  // Store embedding BLOB + dimension count in metadata
  const row = this.db.prepare("SELECT metadata FROM memories WHERE id = ?").get(id) as any;
  const metadata = row?.metadata ? JSON.parse(row.metadata) : {};
  metadata.embeddingDim = embedding.length;
  this.db.prepare("UPDATE memories SET embedding = ?, metadata = ? WHERE id = ?")
    .run(blob, JSON.stringify(metadata), id);
}

getById(id: string): MemoryEntry {
  const row = this.db.prepare("SELECT * FROM memories WHERE id = ?").get(id) as any;
  if (!row) throw new Error(`Memory ${id} not found`);
  return this.rowToEntry(row);
}
```

Update the `rowToEntry` helper to deserialize embedding BLOBs:

```typescript
let embedding: number[] | undefined;
if (row.embedding) {
  const buf = row.embedding as Buffer;
  embedding = Array.from(new Float64Array(buf.buffer, buf.byteOffset, buf.byteLength / 8));
}
```

- [ ] **Step 5: Run test — expected: PASS**

- [ ] **Step 6: Commit**

---

### Task 5: Create EmbeddingProvider interface and implementations

**Files:**
- Create: `packages/core/src/embedding/embedding-provider.ts`
- Create: `packages/core/src/embedding/embedding-provider.test.ts`
- Create: `packages/core/src/embedding/index.ts`

- [ ] **Step 1: Write failing tests for StubEmbeddingProvider**

```typescript
import { describe, expect, it } from "vitest";
import { StubEmbeddingProvider } from "./embedding-provider.js";

describe("StubEmbeddingProvider", () => {
  const provider = new StubEmbeddingProvider(4);

  it("returns vectors of correct dimensions", async () => {
    const result = await provider.embed("hello world");
    expect(result.length).toBe(4);
  });

  it("returns deterministic vectors for same input", async () => {
    const a = await provider.embed("test");
    const b = await provider.embed("test");
    expect(a).toEqual(b);
  });

  it("embeds batch of texts", async () => {
    const results = await provider.embedBatch(["a", "b", "c"]);
    expect(results.length).toBe(3);
    results.forEach(v => expect(v.length).toBe(4));
  });

  it("reports correct dimensions", () => {
    expect(provider.dimensions).toBe(4);
  });
});
```

- [ ] **Step 2: Run test — expected: FAIL (module not found)**

- [ ] **Step 3: Implement EmbeddingProvider interface + 3 implementations**

Create `packages/core/src/embedding/embedding-provider.ts` with:

1. `EmbeddingProvider` interface: `name`, `dimensions`, `embed(text)`, `embedBatch(texts)`
2. `OpenAIEmbeddingProvider` — uses `fetch` to call OpenAI `/v1/embeddings`
3. `OllamaEmbeddingProvider` — uses `fetch` to call Ollama `/api/embeddings`
4. `StubEmbeddingProvider` — deterministic hash-based vectors for testing

Create barrel export at `packages/core/src/embedding/index.ts`.

- [ ] **Step 4: Run tests — expected: PASS (4 tests)**

- [ ] **Step 5: Commit**

---

### Task 6: Create EmbeddingProviderRegistry

**Files:**
- Create: `packages/core/src/embedding/embedding-registry.ts`
- Create: `packages/core/src/embedding/embedding-registry.test.ts`

- [ ] **Step 1: Write failing tests**

Test: creates with no config, falls back to stub, registers/retrieves providers, lists providers.

- [ ] **Step 2: Run test — expected: FAIL**

- [ ] **Step 3: Implement EmbeddingProviderRegistry**

Mirror `LlmProviderRegistry` pattern:
- Constructor takes `config.embeddings`
- Sorts providers by priority
- `getProvider()` returns first registered or stub fallback
- `hasProvider()` checks if any real provider registered
- `register()` for testing

- [ ] **Step 4: Run tests — expected: PASS**

- [ ] **Step 5: Commit**

---

### Task 7: Add semantic search to MemoryRepo

**Files:**
- Modify: `packages/storage/src/repos/memory-repo.ts`
- Modify: `packages/storage/src/repos/memory-repo.test.ts`

- [ ] **Step 1: Write failing tests**

**Note:** Each test `beforeEach` must create the parent realm to satisfy FK constraints: `db.prepare("INSERT INTO realms (id, name, description) VALUES (?, ?, ?)").run("realm_sem", "sem", "test")`.

```typescript
describe("semantic search", () => {
  beforeEach(() => {
    db.prepare("INSERT INTO realms (id, name, description) VALUES (?, ?, ?)").run("realm_sem", "sem", "test");
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
});
```

- [ ] **Step 2: Run test — expected: FAIL**

- [ ] **Step 3: Implement `searchSemantic` with cosine similarity**

Add a module-level `cosineSimilarity(a, b)` helper and `searchSemantic(queryVector, realmId, topK)` method that:
1. Loads all rows with embeddings for the realm
2. Deserializes each embedding BLOB
3. Filters by matching dimension count (using `metadata.embeddingDim`)
4. Sorts by cosine similarity descending
5. Returns top-K entries

- [ ] **Step 4: Implement `backfillEmbeddings(embedFn, realmId?)`**

Add `backfillEmbeddings` method that batch-generates embeddings for existing memories that lack them:
1. Query all memories where `embedding IS NULL` (optionally filtered by realmId)
2. Batch texts in groups of 50
3. Call `embedFn(texts): Promise<number[][]>` for each batch
4. Call `updateEmbedding(id, vec)` for each result
5. Return `{ processed: number; skipped: number }`

Add test:
```typescript
it("backfillEmbeddings processes memories without embeddings", async () => {
  repo.create({ realmId: "realm_sem", tier: "archival", content: "fact1" });
  repo.create({ realmId: "realm_sem", tier: "archival", content: "fact2" });
  const mockEmbed = async (texts: string[]) => texts.map(() => [1, 0, 0]);
  const result = await repo.backfillEmbeddings(mockEmbed);
  expect(result.processed).toBe(2);
  expect(result.skipped).toBe(0);
});
```

- [ ] **Step 5: Run tests — expected: PASS**

- [ ] **Step 6: Commit**

---

### Task 8: Wire embedding into chat pipeline and server

**Files:**
- Modify: `packages/ink/src/chat-pipeline.ts`
- Modify: `packages/ink/src/chat-pipeline.test.ts`
- Modify: `packages/ink/src/server.ts`
- Modify: `packages/ink/src/rpc-handlers.ts`
- Modify: `packages/core/src/index.ts`
- Modify: `packages/core/src/memory-extractor.ts`

- [ ] **Step 1: Write failing test for semantic memory injection**

Add to `chat-pipeline.test.ts`:
```typescript
it("uses semantic search for memory injection when embedding provider is available", async () => {
  // Set up embeddingRegistry with a stub provider
  // Mock memoryRepo.searchSemantic to return results
  // Verify searchSemantic is called instead of listByRealm
});
```

- [ ] **Step 2: Export embedding modules from core index**

Add to `packages/core/src/index.ts`:
```typescript
export * from "./embedding/index.js";
```

- [ ] **Step 3: Add `embeddingRegistry` to `RpcServices` interface**

In `packages/ink/src/rpc-handlers.ts`, add `embeddingRegistry?: EmbeddingProviderRegistry`.

- [ ] **Step 4: Update chat pipeline memory injection**

Replace the memory injection block with semantic search:
- If `embeddingRegistry.hasProvider()`: embed the user message, call `searchSemantic(vec, realmId, 10)`
- Fallback to `listByRealm(realmId, "archival").slice(0, 20)` when no provider

Also store `metadata.embeddingDim` when generating embeddings for new memories (via `updateEmbedding`, which already sets it per Task 4).

- [ ] **Step 5: Add `embeddingRegistry` param to `MemoryExtractor` constructor**

After storing each extracted fact, generate and store its embedding:
```typescript
if (this.embeddingRegistry?.hasProvider()) {
  const vec = await this.embeddingRegistry.getProvider().embed(fact);
  this.memoryRepo.updateEmbedding(entry.id, vec);
}
```

- [ ] **Step 6: Wire `EmbeddingProviderRegistry` in server.ts**

Instantiate `EmbeddingProviderRegistry(config.embeddings)` and add to `rpcServices`.
Update `MemoryExtractor` constructor call to pass `embeddingRegistry`.

- [ ] **Step 7: Run failing test from Step 1 — expected: PASS**

- [ ] **Step 8: Build and run all tests**

Run: `pnpm build && pnpm test:unit` — expected: all pass.

- [ ] **Step 9: Commit**

---

## Chunk 2: Phase 3 (Knowledge Quality Loop)

### Task 9: Add extraction dedup to MemoryExtractor

**Files:**
- Modify: `packages/core/src/memory-extractor.ts`
- Modify: `packages/core/src/memory-extractor.test.ts`

- [ ] **Step 1: Write failing tests for dedup**

Two tests:
1. When a similar memory exists (cosine > 0.85), the new fact is **skipped** (not stored).
2. When a similar memory exists (cosine 0.6-0.85), the old and new are **merged** via LLM into one entry (old deleted, new merged entry stored).

```typescript
it("skips duplicate when similarity > 0.85", async () => { ... });
it("merges when similarity is 0.6-0.85", async () => { ... });
it("inserts new when similarity < 0.6", async () => { ... });
```

- [ ] **Step 2: Implement dedup logic**

Before storing each fact, if embedding provider is available:
1. Embed the fact
2. Call `searchSemantic(vec, realmId, 3)`
3. If top result similarity > 0.85: **skip** (duplicate)
4. If top result similarity 0.6-0.85: **merge** — call LLM to combine old content + new fact into one entry, delete old entry, store merged entry
5. If top result similarity < 0.6: **insert** as new

For the merge step (0.6-0.85), if no LLM is available, fall back to appending new fact to old content with a separator.

- [ ] **Step 3: Run tests — expected: PASS**

- [ ] **Step 4: Commit**

---

### Task 10: Create KnowledgeGraphRepo

**Files:**
- Create: `packages/storage/src/repos/knowledge-graph-repo.ts`
- Create: `packages/storage/src/repos/knowledge-graph-repo.test.ts`
- Modify: `packages/storage/src/index.ts`

- [ ] **Step 1: Write failing tests**

```typescript
describe("KnowledgeGraphRepo", () => {
  it("findOrCreateNode creates a new node", () => { ... });
  it("findOrCreateNode returns existing for same realm+label", () => { ... });
  it("addEdge creates a relationship", () => { ... });
  it("getRelatedNodes returns connected nodes", () => { ... });
});
```

- [ ] **Step 2: Run tests — expected: FAIL**

- [ ] **Step 3: Implement KnowledgeGraphRepo**

Methods:
- `findOrCreateNode(realmId, label, type, properties?)` — dedup by `(realm_id, label)`
- `addEdge(sourceId, targetId, type, properties?)` — insert into `knowledge_edges`
- `getRelatedNodes(nodeId)` — join edges with nodes, return both directions

Export from `packages/storage/src/index.ts`.

- [ ] **Step 4: Run tests — expected: PASS**

- [ ] **Step 5: Commit**

---

### Task 11: Add relation extraction and importance scoring

**Files:**
- Modify: `packages/core/src/memory-extractor.ts`
- Modify: `packages/core/src/memory-extractor.test.ts`

- [ ] **Step 1: Write failing tests**

Test relation extraction (LLM mock returns relations array) and importance scoring (importance=5 promotes to core, importance=1 skips storage).

- [ ] **Step 2: Update extraction LLM prompt**

Extend `EXTRACTION_PROMPT` to request JSON with fields: `facts`, `importance` (1-5 array), `relations` (subject/relation/object array), `attribute_updates` (entityName/key/value array).

- [ ] **Step 3: Update `extractAndPersist` to process importance**

- importance >= 5 → store as `core` tier
- importance = 1 → skip storage
- importance 2-4 → store as `archival` (existing behavior)

- [ ] **Step 4: Add relation processing**

For each relation in LLM response, call `knowledgeGraphRepo.findOrCreateNode()` for subject and object, then `addEdge()`.

- [ ] **Step 5: Run tests — expected: PASS**

- [ ] **Step 6: Commit**

---

## Chunk 3: Phase 4 (Conversation Experience) + Phase 5 (Automation)

### Task 12: Add entity attribute auto-update

**Files:**
- Modify: `packages/core/src/memory-extractor.ts`
- Modify: `packages/ink/src/chat-pipeline.ts`
- Modify: `packages/ink/src/chat-pipeline.test.ts`

- [ ] **Step 1: Write failing test**

Test that when extractAndPersist returns attribute updates, the entity's attributes are updated via `entityManager.update()`.

```typescript
it("applies attribute updates from extraction to entity", async () => {
  // Mock memoryExtractor.extractAndPersist to return { memories: [], attributeUpdates: [{ entityName: "Luna", key: "age", value: "4" }] }
  // Mock entityManager.findByNameInRealm to return entity
  // Verify entityManager.update is called with merged attributes
});
```

- [ ] **Step 2: Extend `extractAndPersist` return type**

Return `{ memories, attributeUpdates }` instead of just `MemoryEntry[]`.
`attributeUpdates` comes from the `attribute_updates` field in the LLM extraction response.

- [ ] **Step 3: Apply attribute updates in chat pipeline**

In the fire-and-forget memory extraction block, after extraction completes:
- For each `attributeUpdate`: find entity by name in realm, merge attribute into existing attributes, call `entityManager.update()`.

- [ ] **Step 4: Run test from Step 1 — expected: PASS**

- [ ] **Step 5: Commit**

---

### Task 13: Add progressive maturity guidance

**Files:**
- Modify: `packages/shared/src/rpc-protocol.ts`
- Modify: `packages/core/src/maturity-scanner.ts`
- Modify: `packages/core/src/maturity-scanner.test.ts`
- Modify: `packages/ink/src/chat-pipeline.ts`
- Modify: `packages/tentacle/src/commands/chat.ts`

- [ ] **Step 1: Add `MATURITY_PROGRESS` event**

In `packages/shared/src/rpc-protocol.ts`, add to `RPC_EVENTS`:
```typescript
MATURITY_PROGRESS: "maturity.progress",
```

- [ ] **Step 2: Write failing test**

Test that entities with score 40-59 emit a progress event with missing attributes list.

- [ ] **Step 3: Extend `checkAndNotify` signature**

Add optional `onProgress` callback parameter. For entities with score 40-59 and status `dormant`, call `onProgress` with entity name, score, missing attributes, and a guidance message.

Add `identifyMissingAttributes(score)` private method.

- [ ] **Step 4: Wire in chat pipeline**

Pass `onProgress` to `maturityScanner.checkAndNotify()`, broadcast as `MATURITY_PROGRESS` event.

- [ ] **Step 5: Add CLI event listener**

In `packages/tentacle/src/commands/chat.ts`, listen for `maturity.progress` events and render progress bar.

- [ ] **Step 6: Run all tests — expected: PASS**

- [ ] **Step 7: Commit**

---

### Task 14: Add Scheduler for proactive rules

**Files:**
- Create: `packages/core/src/scheduler.ts`
- Create: `packages/core/src/scheduler.test.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Write failing tests**

```typescript
describe("Scheduler", () => {
  it("parseTrigger converts human-readable to cron", () => {
    expect(Scheduler.parseTrigger("every day 9am")).toBe("0 9 * * *");
    expect(Scheduler.parseTrigger("every week")).toBe("0 9 * * 1");
    expect(Scheduler.parseTrigger("every month")).toBe("0 9 1 * *");
    expect(Scheduler.parseTrigger("0 8 * * *")).toBe("0 8 * * *");
  });

  it("parseTrigger returns null for unrecognized", () => {
    expect(Scheduler.parseTrigger("whenever")).toBeNull();
  });

  it("addRule stores a rule", () => {
    const scheduler = new Scheduler();
    scheduler.addRule({ realmId: "realm_pet", trigger: "every day 9am", action: "Feed cat" });
    expect(scheduler.listRules().length).toBe(1);
  });

  it("start and stop lifecycle", () => {
    const scheduler = new Scheduler();
    scheduler.addRule({ realmId: "realm_pet", trigger: "every day 9am", action: "test" });
    scheduler.start();
    expect(scheduler.isRunning()).toBe(true);
    scheduler.stop();
    expect(scheduler.isRunning()).toBe(false);
  });
});
```

- [ ] **Step 2: Run test — expected: FAIL**

- [ ] **Step 3: Implement Scheduler**

- `SchedulerRule` interface: `realmId`, `entityId?`, `trigger`, `action`
- `TRIGGER_MAP`: human-readable strings to cron expressions
- `parseTrigger(trigger)`: static method, check map then raw cron passthrough then regex for "every day Xam/pm"
- `addRule()`, `listRules()`, `start()`, `stop()`, `isRunning()`
- `setActionHandler(handler)`: callback for executing rules
- Uses `setInterval` based on simple cron-to-interval conversion (MVP, not full cron parser)

Export from `packages/core/src/index.ts`.

- [ ] **Step 4: Run tests — expected: PASS**

- [ ] **Step 5: Commit**

---

### Task 15: Add file watching to DirectoryScanner

**Files:**
- Modify: `packages/core/src/directory-scanner.ts`
- Modify: `packages/core/src/directory-scanner.test.ts`

- [ ] **Step 1: Write test**

```typescript
describe("watchDirectory", () => {
  it("returns a watcher that can be stopped", () => {
    const watcher = scanner.watchDirectory("/tmp/test-watch", { extensions: [".md"] });
    expect(watcher).toBeDefined();
    expect(typeof watcher.stop).toBe("function");
    watcher.stop();
  });
});
```

- [ ] **Step 2: Run test — expected: FAIL**

- [ ] **Step 3: Implement `watchDirectory`**

Uses `fs.watch({ recursive: true })` with:
- Extension filtering
- 5-second debounce on changes
- Calls `scanFile()` for changed files
- Returns `{ stop() }` handle

- [ ] **Step 4: Run test — expected: PASS**

- [ ] **Step 5: Commit**

---

### Task 16: Wire Scheduler, health checks, and proactive rendering into server

**Files:**
- Modify: `packages/ink/src/server.ts`
- Modify: `packages/tentacle/src/tui/renderer.ts`

- [ ] **Step 1: Wire Scheduler**

After `realmLoader.loadFromDirectory()`:
- Create `Scheduler` instance
- Load proactive rules from all realms via `realmLoader.getRealmMeta()`
- Add built-in health check rules:
  - Daily 03:00 → `memoryHealthManager.computeAllHealth()` — compute health for all realms
  - Daily 03:30 → `maturityScanner.scanAll()` — full maturity scan
  - After each health computation: compare with previous score, if delta > 10 points → broadcast `health.alert` event via WS
- Set action handler: system rules run health checks, user rules run through `AgentRunner` and broadcast `proactive` event
- `scheduler.start()` after servers are listening
- `scheduler.stop()` in close function

- [ ] **Step 2: Add proactive message rendering to TUI renderer**

In `packages/tentacle/src/tui/renderer.ts`, add handlers for:
- `proactive` event → render proactive message with realm/entity context
- `health.alert` event → render health score change alert

- [ ] **Step 3: Write integration test for scheduler wiring**

Test that Scheduler is created, rules are loaded, and start/stop lifecycle works when server starts.

- [ ] **Step 4: Build and run all tests**

Run: `pnpm build && pnpm test:unit && pnpm test:integration` — expected: all pass.

- [ ] **Step 5: Commit**

---

### Task 17: Final verification and cleanup

- [ ] **Step 1: Run full test suite**

Run: `pnpm check && pnpm test:unit && pnpm test:integration`
Expected: all pass, 0 lint errors, 0 type errors.

- [ ] **Step 2: Verify test count**

Expected: ~400 tests (up from 319).

- [ ] **Step 3: Build all packages**

Run: `pnpm build` — expected: all 8 packages succeed.

- [ ] **Step 4: Update optimization roadmap**

Update `docs/optimization-roadmap.md` sections 8 and 9 to reflect new completion status.

- [ ] **Step 5: Commit docs update**
