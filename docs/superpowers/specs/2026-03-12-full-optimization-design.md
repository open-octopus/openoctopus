# OpenOctopus Full Optimization Design

> Date: 2026-03-12
> Status: Approved
> Approach: Dependency-driven (A) — each phase unlocks the next

## Context

Phase 1 (monorepo scaffold, 8 packages) is committed. Phase 1.5 (knowledge lifecycle, 6 modules) and 7 runtime fixes are implemented but uncommitted (~2200 lines across 34 files). 319 tests passing.

This design covers the next full optimization cycle: 5 phases building bottom-up.

## Phase 1: Engineering Foundation

**Scope:** Commit current ~2200 lines of uncommitted changes, add CI/CD.

- Commit Phase 1.5 knowledge lifecycle + 7 runtime fixes
- GitHub Actions workflow: `lint → typecheck → test:unit → test:integration → build`
- Vitest V8 coverage output to CI artifacts

No design decisions required — pure execution.

## Phase 2: Vector Semantic Search

**The multiplier.** Every downstream feature (dedup, memory injection, knowledge graph) benefits from semantic understanding.

### Embedding Provider

Multi-provider architecture matching the existing LLM provider pattern:

| Provider | Dimensions | Cost | Offline |
|----------|-----------|------|---------|
| OpenAI text-embedding-3-small (primary) | 1536 | $0.02/1M tokens | No |
| Ollama nomic-embed-text (fallback) | 768 | Free | Yes |
| Stub (testing) | 128 | Free | Yes |

New interface: `EmbeddingProvider` with `embed(text): Promise<number[]>` and `embedBatch(texts): Promise<number[][]>`.

Registered via `EmbeddingProviderRegistry` (same pattern as `LlmProviderRegistry`), configured in `config.json5`.

### Storage

**SQLite + in-memory brute-force cosine similarity.** Rationale: personal assistant memory volume is <10k entries. 10k × 1536-dim brute-force cosine = <5ms in JS. Zero additional dependencies.

**Note:** The `memories` table currently has no `embedding` column. A v3 migration is required: `ALTER TABLE memories ADD COLUMN embedding BLOB`. Embeddings are stored as serialized float arrays. The Zod `MemoryEntrySchema` already defines an optional `embedding` field — only the SQLite schema is missing.

**Dimension mismatch handling:** Each embedding is stored with its dimension count in metadata (`metadata.embeddingDim`). When the active provider changes (e.g., OpenAI 1536-dim → Ollama 768-dim), `searchSemantic()` only compares entries with matching dimensions. `backfillEmbeddings()` can re-generate all embeddings with the current provider.

If >10k becomes a reality, migrate to sqlite-vec extension later.

### New APIs

```
MemoryRepo:
  searchSemantic(query: string, realmId: string, topK: number): MemoryEntry[]
    1. Generate embedding for query
    2. Load all embeddings for realm from DB
    3. Cosine similarity sort, return top-K

  backfillEmbeddings(): { processed: number; skipped: number }
    Batch-generate embeddings for existing memories that lack them
```

### Chat Pipeline Integration

```
Before: memoryRepo.listByRealm(realmId, "archival").slice(0, 20)
After:  memoryRepo.searchSemantic(userMessage, realmId, 10)
```

Falls back to current behavior when no embedding provider is configured.

### Files

| File | Action |
|------|--------|
| `core/src/embedding/embedding-provider.ts` | New — interface + OpenAI/Ollama/Stub implementations |
| `core/src/embedding/embedding-registry.ts` | New — multi-provider registry |
| `storage/src/repos/memory-repo.ts` | Extend — `searchSemantic()`, `backfillEmbeddings()` |
| `ink/src/chat-pipeline.ts` | Modify — use semantic search for memory injection |
| `ink/src/server.ts` | Modify — wire EmbeddingRegistry |
| `shared/src/config.ts` | Extend — embedding config section |
| `storage/src/migrations.ts` | Extend — v3 migration adding `embedding BLOB` column to `memories` |

### Estimated: ~400 lines, ~25 tests

## Phase 3: Knowledge Quality Loop

All three sub-features leverage the vector search infrastructure from Phase 2.

### 3a. Extraction Dedup

On each fact extraction, query `searchSemantic(fact, realmId, 3)`:
- Similarity > 0.85 → skip (duplicate)
- Similarity 0.6–0.85 → merge (LLM combines old + new into one entry, delete old)
- Similarity < 0.6 → insert as new

This replaces the current "append-only" pattern and prevents unbounded memory growth.

### 3b. Knowledge Graph

Extend the `MemoryExtractor` LLM prompt to also extract entity relations:

```json
{
  "facts": ["Luna is a gift from mom"],
  "relations": [{"subject": "Luna", "relation": "gifted_by", "object": "mom"}]
}
```

Relations are stored in `knowledge_edges` table (schema already exists, with foreign keys to `knowledge_nodes`).

**Node creation strategy:** Before inserting an edge, auto-create `knowledge_nodes` for subject/object if they don't exist. Node dedup: match by `(realmId, label)` pair — e.g., `(pet, "Luna")`. If an entity with that name exists in the `entities` table, link the node via `properties.entityId`. If not, create an orphan node (may be linked later when an entity is created).

New repo methods: `KnowledgeGraphRepo.findOrCreateNode()`, `addEdge()`, `getRelatedEntities()`, `getEntityGraph()`.

### 3c. Importance Scoring

Add `importance` field (1–5) to the extraction LLM prompt:
- 5 = core identity (name, breed, birthday) → auto-promote to `core` memory tier
- 4 = major events/decisions (vet visit, job change)
- 3 = preferences (likes fish, enjoys running)
- 2 = temporary states (feeling sick today)
- 1 = small talk → skip storage (always discard)

Zero architectural cost — just an additional JSON field in the LLM response, stored in `metadata.importance`.

### Files

| File | Action |
|------|--------|
| `core/src/memory-extractor.ts` | Extend — dedup check, relation extraction, importance scoring |
| `storage/src/repos/memory-repo.ts` | Extend — update/merge methods |
| `storage/src/repos/knowledge-graph-repo.ts` | New — node dedup + edge CRUD + graph queries |
| `storage/src/index.ts` | Extend — export KnowledgeGraphRepo |
| `storage/src/migrations.ts` | Extend — importance column if needed |

### Estimated: ~350 lines, ~20 tests

## Phase 4: Conversation Experience

Note: Semantic memory injection (replacing `listByRealm().slice(0,20)` with `searchSemantic()`) is delivered in Phase 2. Phase 4 focuses on two additional conversation enhancements.

### 4a. Entity Attribute Auto-Update

Extend `MemoryExtractor` LLM prompt to detect attribute changes:

```json
{
  "facts": ["Luna is now 4 years old"],
  "attribute_updates": [{"entityName": "Luna", "key": "age", "value": "4"}]
}
```

Pipeline: extract → find entity by name → `EntityManager.update(id, { attributes: { ...existing, age: "4" } })`.

This creates a virtuous cycle: conversation → attribute update → maturity score increase → summon suggestion.

### 4b. Progressive Guidance

Extend `MaturityScanner`:
- Current: `overall ≥ 60 && dormant` → broadcast `maturity.suggestion`
- New: `overall 40–59` → broadcast `maturity.progress` event with missing attributes list

```
Event payload: {
  entityName: "Luna",
  realmName: "pet",
  score: 52,
  missing: ["age", "breed"],
  message: "Luna's knowledge is at 52/100. A few more conversations and she can be summoned!"
}
```

CLI renders as a progress indicator. Motivates users to fill knowledge gaps naturally.

### Files

| File | Action |
|------|--------|
| `core/src/memory-extractor.ts` | Extend — attribute_updates extraction |
| `core/src/maturity-scanner.ts` | Extend — progress events for 40–59 range |
| `ink/src/chat-pipeline.ts` | Extend — apply attribute updates |
| `tentacle/src/tui/renderer.ts` | Extend — render progress events |
| `shared/src/rpc-protocol.ts` | Extend — `maturity.progress` event |

### Estimated: ~300 lines, ~15 tests

## Phase 5: Automation & Proactivity

### 5a. Scheduler Agent

New module: `packages/core/src/scheduler.ts`

Reads `proactiveRules` from REALM.md and SOUL.md. The existing `RealmFileProactiveRuleSchema` defines `trigger`, `action`, and `interval` fields.

**Trigger format translation:** Human-readable triggers in REALM.md/SOUL.md are translated to node-cron expressions via a mapping layer:

| Human format | Cron expression |
|-------------|----------------|
| `"every day 9am"` | `"0 9 * * *"` |
| `"every week"` | `"0 9 * * 1"` |
| `"every month"` | `"0 9 1 * *"` |
| Raw cron (e.g., `"30 8 * * *"`) | Passed through directly |

The `interval` field from the schema is used for repeat frequency within a trigger.

Implementation: `node-cron` (lightweight, no Redis/MQ). Each rule → cron job → `AgentRunner.run()` → broadcast `proactive` event.

Design decision: in-memory cron (single-process architecture). No persistence of cron state — rules are re-loaded from REALM.md/SOUL.md on startup.

### 5b. Scheduled Health Checks

Built-in scheduler tasks (not user-configurable):
- Daily 03:00 → `MemoryHealthManager.computeAllHealth()`
- Daily 03:30 → `MaturityScanner` full scan
- Health score drop > 10 points → broadcast alert event

### 5c. File Watching

Extend `DirectoryScanner`:
- New method: `watchDirectory(path, options)`
- Uses `fs.watch({ recursive: true })`
- File change → debounce 5s → incremental scan of changed file
- Integrated with Scheduler: auto-watch configured directories on startup

### Files

| File | Action |
|------|--------|
| `core/src/scheduler.ts` | New — cron-based rule engine |
| `core/src/scheduler.test.ts` | New — tests |
| `core/src/directory-scanner.ts` | Extend — watchDirectory() |
| `ink/src/server.ts` | Extend — wire scheduler, start on boot |
| `tentacle/src/tui/renderer.ts` | Extend — render proactive messages |

### Estimated: ~350 lines, ~20 tests

## Summary

| Phase | What | New Code | New Tests |
|-------|------|----------|-----------|
| 1. Engineering | Commit + CI/CD | ~50 YAML | — |
| 2. Vector Search | Embedding providers + semantic search | ~400 lines | ~25 |
| 3. Knowledge Quality | Dedup + graph + importance | ~350 lines | ~20 |
| 4. Conversation | Auto-attr + progressive guidance | ~250 lines | ~15 |
| 5. Automation | Scheduler + health cron + file watch | ~350 lines | ~20 |
| **Total** | | **~1450 lines** | **~80 tests** |

Execution order: Phase 1 → 2 → 3 are strictly sequential (each depends on the previous). Phases 4 and 5 depend on Phase 2 but are independent of each other — they can be developed in parallel after Phase 3, or in either order.
