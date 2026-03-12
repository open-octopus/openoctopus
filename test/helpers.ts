import { vi } from "vitest";
import type { RealmState, Entity, MemoryEntry, RouterIntent } from "@openoctopus/shared";
import type { HealthReportRecord, OnboardingState } from "@openoctopus/storage";
import type { MemoryRepo } from "@openoctopus/storage";
import type { RealmManager, EntityManager, AgentRunner, AgentRunResult, Router } from "@openoctopus/core";
import type { LlmProviderRegistry, LlmProvider } from "@openoctopus/core";
import type { SummonEngine, SummonedAgent } from "@openoctopus/summon";
import type { WebSocket } from "ws";

// ────────────────────────────────────────────────────────────────
// 1. Mock Factories
// ────────────────────────────────────────────────────────────────

type MockOf<T> = { [K in keyof T]: T[K] extends (...args: infer A) => infer R ? ReturnType<typeof vi.fn<(...args: A) => R>> : T[K] };

/** Mock MemoryRepo — all methods are vi.fn() */
export function createMockMemoryRepo(): MockOf<MemoryRepo> {
  return {
    listByRealm: vi.fn().mockReturnValue([]),
    listByEntity: vi.fn().mockReturnValue([]),
    create: vi.fn().mockReturnValue({
      id: "memory_test1",
      content: "test",
      realmId: "realm_test1",
      tier: "archival",
      metadata: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } satisfies MemoryEntry),
    delete: vi.fn(),
    countByRealm: vi.fn().mockReturnValue(0),
    countByEntity: vi.fn().mockReturnValue(0),
    searchByContent: vi.fn().mockReturnValue([]),
    listStale: vi.fn().mockReturnValue([]),
    updateTier: vi.fn(),
    updateContent: vi.fn(),
    deleteMany: vi.fn().mockReturnValue(0),
    updateEmbedding: vi.fn(),
    searchSemantic: vi.fn().mockReturnValue([]),
    backfillEmbeddings: vi.fn().mockResolvedValue({ processed: 0, skipped: 0 }),
    getById: vi.fn().mockReturnValue({
      id: "memory_test1",
      content: "test",
      realmId: "realm_test1",
      tier: "archival",
      metadata: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } satisfies MemoryEntry),
  } as unknown as MockOf<MemoryRepo>;
}

/** Mock RealmManager — all methods are vi.fn() */
export function createMockRealmManager(): MockOf<RealmManager> {
  return {
    list: vi.fn().mockReturnValue([]),
    get: vi.fn().mockReturnValue({
      id: "realm_test1",
      name: "test",
      description: "",
      status: "active",
      healthScore: 100,
      riskCount: 0,
      pendingActions: 0,
      proactiveEnabled: false,
      entities: [],
      agents: [],
      skills: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } satisfies RealmState),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    findByName: vi.fn().mockReturnValue(null),
    updateHealthScore: vi.fn(),
    archive: vi.fn(),
  } as unknown as MockOf<RealmManager>;
}

/** Mock EntityManager — all methods are vi.fn() */
export function createMockEntityManager(): MockOf<EntityManager> {
  return {
    get: vi.fn().mockReturnValue({
      id: "entity_test1",
      realmId: "realm_test1",
      name: "TestEntity",
      type: "living",
      attributes: {},
      summonStatus: "dormant",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } satisfies Entity),
    listByRealm: vi.fn().mockReturnValue([]),
    countByRealm: vi.fn().mockReturnValue(0),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    findByNameInRealm: vi.fn().mockReturnValue(null),
  } as unknown as MockOf<EntityManager>;
}

/** Mock LlmProviderRegistry — all methods are vi.fn() */
export function createMockLlmRegistry(opts?: { hasReal?: boolean }): MockOf<LlmProviderRegistry> {
  const mockProvider: MockOf<LlmProvider> = {
    name: "test",
    api: "test",
    chat: vi.fn().mockResolvedValue({
      content: "[]",
      usage: { inputTokens: 0, outputTokens: 0 },
      model: "test",
      finishReason: "stop",
    }),
    chatStream: vi.fn(),
  } as unknown as MockOf<LlmProvider>;

  return {
    hasRealProvider: vi.fn().mockReturnValue(opts?.hasReal ?? false),
    getProvider: vi.fn().mockReturnValue(mockProvider),
    resolveModel: vi.fn().mockReturnValue("test-model"),
    listProviders: vi.fn().mockReturnValue([]),
    register: vi.fn(),
    getProviderWithFailover: vi.fn().mockResolvedValue(mockProvider),
  } as unknown as MockOf<LlmProviderRegistry>;
}

/** Mock HealthReportRepo — all methods are vi.fn() */
export function createMockHealthReportRepo() {
  return {
    create: vi.fn().mockReturnValue({
      id: "health_test1",
      realmId: "realm_test1",
      healthScore: 100,
      memoryCount: 0,
      duplicateCount: 0,
      staleCount: 0,
      contradictionCount: 0,
      issues: [],
      computedAt: new Date().toISOString(),
    } satisfies HealthReportRecord),
    getLatest: vi.fn().mockReturnValue(null),
    listByRealm: vi.fn().mockReturnValue([]),
  };
}

/** Mock ScannedFileRepo — all methods are vi.fn() */
export function createMockScannedFileRepo() {
  return {
    findByPath: vi.fn().mockReturnValue(null),
    upsert: vi.fn(),
    listByRealm: vi.fn().mockReturnValue([]),
  };
}

/** Mock OnboardingRepo — all methods are vi.fn() */
export function createMockOnboardingRepo() {
  return {
    isCompleted: vi.fn().mockReturnValue(false),
    markCompleted: vi.fn(),
    getState: vi.fn().mockReturnValue({
      completed: false,
      realmsSeeded: [],
    } satisfies OnboardingState),
  };
}

/** Mock SummonEngine — all methods are vi.fn() */
export function createMockSummonEngine(): MockOf<SummonEngine> {
  return {
    getSummoned: vi.fn().mockReturnValue(undefined),
    summon: vi.fn(),
    unsummon: vi.fn(),
    listActive: vi.fn().mockReturnValue([] as SummonedAgent[]),
  } as unknown as MockOf<SummonEngine>;
}

/** Mock AgentRunner — all methods are vi.fn() */
export function createMockAgentRunner(): MockOf<AgentRunner> {
  return {
    run: vi.fn().mockResolvedValue({
      response: {
        role: "assistant",
        content: "test response",
        timestamp: new Date().toISOString(),
      },
      tokensUsed: { input: 10, output: 5 },
    } as AgentRunResult),
    runStream: vi.fn(),
  } as unknown as MockOf<AgentRunner>;
}

/** Mock Router — all methods are vi.fn() */
export function createMockRouter(): MockOf<Router> {
  return {
    route: vi.fn().mockResolvedValue({
      targetRealmId: undefined,
      confidence: 0,
    } as RouterIntent),
    routeWithKeywords: vi.fn(),
  } as unknown as MockOf<Router>;
}

// ────────────────────────────────────────────────────────────────
// 2. Fixture Factories
// ────────────────────────────────────────────────────────────────

/** Create a RealmState fixture with sensible defaults */
export function createRealmFixture(overrides?: Partial<RealmState>): RealmState {
  return {
    id: "realm_test1",
    name: "pet",
    description: "Pet realm",
    status: "active",
    healthScore: 100,
    riskCount: 0,
    pendingActions: 0,
    proactiveEnabled: false,
    entities: [],
    agents: [],
    skills: [],
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
    ...overrides,
  };
}

/** Create an Entity fixture with sensible defaults */
export function createEntityFixture(overrides?: Partial<Entity>): Entity {
  return {
    id: "entity_test1",
    realmId: "realm_test1",
    name: "Luna",
    type: "living",
    attributes: {},
    summonStatus: "dormant",
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
    ...overrides,
  };
}

/** Create a MemoryEntry fixture with sensible defaults */
export function createMemoryFixture(overrides?: Partial<MemoryEntry>): MemoryEntry {
  return {
    id: "memory_test1",
    realmId: "realm_test1",
    tier: "archival",
    content: "Test memory content",
    metadata: {},
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
    ...overrides,
  };
}

// ────────────────────────────────────────────────────────────────
// 3. DB Tool for Storage Tests
// ────────────────────────────────────────────────────────────────

/** Create an in-memory SQLite database with all migrations applied */
export async function createTestDb() {
  const Database = (await import("better-sqlite3")).default;
  const { runMigrations } = await import("@openoctopus/storage");

  const db = new Database(":memory:");
  runMigrations(db);

  return {
    db,
    cleanup: () => db.close(),
  };
}

// ────────────────────────────────────────────────────────────────
// 4. Mock WebSocket for RPC Tests
// ────────────────────────────────────────────────────────────────

/** Create a mock WebSocket that captures sent messages */
export function createMockWs() {
  const sent: string[] = [];

  const ws = {
    send: (data: string) => {
      sent.push(data);
    },
  } as unknown as WebSocket;

  return {
    ws,
    sent,
    lastParsed: () => JSON.parse(sent[sent.length - 1]) as unknown,
  };
}
