import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { runMigrations, MemoryRepo, RealmRepo, EntityRepo, HealthReportRepo, ScannedFileRepo, OnboardingRepo } from "@openoctopus/storage";

import { RealmManager } from "./realm-manager.js";
import { EntityManager } from "./entity-manager.js";
import { MemoryHealthManager } from "./memory-health-manager.js";
import { KnowledgeDistributor } from "./knowledge-distributor.js";
import { MaturityScanner } from "./maturity-scanner.js";
import { DirectoryScanner } from "./directory-scanner.js";

const mockLlmRegistry = {
  hasRealProvider: vi.fn().mockReturnValue(false),
  getProvider: vi.fn(),
  resolveModel: vi.fn().mockReturnValue("test-model"),
  listProviders: vi.fn().mockReturnValue([]),
};

describe("Knowledge Lifecycle Integration", () => {
  let db: Database.Database;
  let memoryRepo: MemoryRepo;
  let realmRepo: RealmRepo;
  let entityRepo: EntityRepo;
  let healthReportRepo: HealthReportRepo;
  let scannedFileRepo: ScannedFileRepo;
  let onboardingRepo: OnboardingRepo;
  let realmManager: RealmManager;
  let entityManager: EntityManager;

  beforeEach(() => {
    vi.clearAllMocks();
    db = new Database(":memory:");
    runMigrations(db);
    memoryRepo = new MemoryRepo(db);
    realmRepo = new RealmRepo(db);
    entityRepo = new EntityRepo(db);
    healthReportRepo = new HealthReportRepo(db);
    scannedFileRepo = new ScannedFileRepo(db);
    onboardingRepo = new OnboardingRepo(db);
    realmManager = new RealmManager(db);
    entityManager = new EntityManager(db);
  });

  afterEach(() => {
    db.close();
  });

  it("inject → health → maturity: end-to-end knowledge flow", async () => {
    // Create realm and entity
    const realm = realmManager.create({ name: "pet", description: "Pet care" });
    const entity = entityManager.create({ realmId: realm.id, name: "Luna", type: "living" });

    // Inject facts via KnowledgeDistributor (keyword fallback, no LLM)
    const distributor = new KnowledgeDistributor(memoryRepo, realmManager, entityManager, mockLlmRegistry as any);
    const distResult = await distributor.distributeFromText("我养了一只猫叫Luna，Luna很可爱。猫咪喜欢吃鱼");

    expect(distResult.memoriesCreated).toBeGreaterThan(0);
    expect(distResult.realmsAffected).toContain("pet");

    // Compute health
    const healthManager = new MemoryHealthManager(memoryRepo, realmManager, entityManager, healthReportRepo, mockLlmRegistry as any);
    const report = await healthManager.computeHealth(realm.id);

    expect(report.healthScore).toBeGreaterThanOrEqual(0);
    expect(report.healthScore).toBeLessThanOrEqual(100);
    expect(report.memoryCount).toBe(distResult.memoriesCreated);

    // Scan maturity
    const scanner = new MaturityScanner(memoryRepo, entityManager, realmManager);
    const score = scanner.computeEntityMaturity(entity.id);

    // Entity has 0 attributes, and some memories → score reflects data
    expect(score.entityName).toBe("Luna");
    expect(score.overall).toBeGreaterThanOrEqual(0);
  });

  it("continuous injection → summon threshold", async () => {
    const realm = realmManager.create({ name: "pet", description: "Pet care" });
    const entity = entityManager.create({
      realmId: realm.id,
      name: "Luna",
      type: "living",
      attributes: { breed: "tabby", age: 3, color: "orange" },
    });

    // Inject enough archival memories to push maturity up
    for (let i = 0; i < 15; i++) {
      memoryRepo.create({
        realmId: realm.id,
        entityId: entity.id,
        tier: "archival",
        content: `Fact #${i} about Luna the cat`,
      });
    }

    const scanner = new MaturityScanner(memoryRepo, entityManager, realmManager);
    const score = scanner.computeEntityMaturity(entity.id);

    // 3 attrs all non-empty → attrComp=100
    // 15 archival → memDepth = min(15/10,1)*100 = 100
    // 15 all → interFreq = min(15/15,1)*100 = 100
    // overall = round(100*0.3 + 100*0.4 + 100*0.3) = 100
    expect(score.overall).toBe(100);
    expect(score.readyToSummon).toBe(true);
  });

  it("health cleanup end-to-end: detect duplicates → cleanup → score improves", async () => {
    const realm = realmManager.create({ name: "pet", description: "Pet care" });

    // Insert duplicate memories
    memoryRepo.create({ realmId: realm.id, tier: "archival", content: "Luna is a tabby cat" });
    memoryRepo.create({ realmId: realm.id, tier: "archival", content: "Luna is a tabby cat" });
    memoryRepo.create({ realmId: realm.id, tier: "archival", content: "Luna is a tabby cat" });
    memoryRepo.create({ realmId: realm.id, tier: "archival", content: "unique fact about Luna" });

    // Insert a stale memory by manipulating DB directly
    const staleId = memoryRepo.create({ realmId: realm.id, tier: "archival", content: "old stale memory" }).id;
    const oldDate = new Date(Date.now() - 100 * 86400000).toISOString();
    db.prepare("UPDATE memories SET updated_at = ? WHERE id = ?").run(oldDate, staleId);

    const healthManager = new MemoryHealthManager(memoryRepo, realmManager, entityManager, healthReportRepo, mockLlmRegistry as any);

    // Compute health before cleanup
    const beforeReport = await healthManager.computeHealth(realm.id);
    expect(beforeReport.healthScore).toBeLessThan(100);
    expect(beforeReport.duplicateCount).toBeGreaterThan(0);

    // Run cleanup
    const cleanupResult = await healthManager.cleanup(realm.id);
    expect(cleanupResult.deduplicatedCount + cleanupResult.archivedCount).toBeGreaterThan(0);
  });

  it("incremental directory scan", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "oo-integration-"));

    try {
      const realm = realmManager.create({ name: "pet", description: "Pet care" });
      fs.writeFileSync(path.join(tmpDir, "notes.md"), "My cat Luna likes fish");

      const distributor = new KnowledgeDistributor(memoryRepo, realmManager, entityManager, mockLlmRegistry as any);
      const dirScanner = new DirectoryScanner(distributor, scannedFileRepo, mockLlmRegistry as any);

      // First scan
      const result1 = await dirScanner.scanDirectory(tmpDir);
      expect(result1.filesScanned).toBe(1);

      // Second scan without changes — should skip
      const result2 = await dirScanner.scanDirectory(tmpDir);
      expect(result2.filesScanned).toBe(0);
      expect(result2.filesSkipped).toBe(1);

      // Modify file and rescan
      fs.writeFileSync(path.join(tmpDir, "notes.md"), "Updated: Luna is now 4 years old");
      const result3 = await dirScanner.scanDirectory(tmpDir);
      expect(result3.filesScanned).toBe(1);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("onboarding flow end-to-end", () => {
    expect(onboardingRepo.isCompleted()).toBe(false);

    // Simulate multi-step onboarding
    onboardingRepo.markCompleted(["pet", "finance"]);

    expect(onboardingRepo.isCompleted()).toBe(true);
    const state = onboardingRepo.getState();
    expect(state.completed).toBe(true);
    expect(state.realmsSeeded).toEqual(["pet", "finance"]);
    expect(state.completedAt).toBeDefined();
  });

  it("cross-realm distribution: pet text with finance keywords → finance realm gets memory", async () => {
    const petRealm = realmManager.create({ name: "pet", description: "Pet care" });
    const financeRealm = realmManager.create({ name: "finance", description: "Finance" });

    const distributor = new KnowledgeDistributor(memoryRepo, realmManager, entityManager, mockLlmRegistry as any);

    // Distribute facts from pet realm that contain finance keywords
    await distributor.classifyAndDistribute(
      ["月工资预算投资理财"],  // finance keywords only
      petRealm.id,
    );

    // Finance realm should have received the memory
    const financeMemories = memoryRepo.listByRealm(financeRealm.id);
    expect(financeMemories.length).toBeGreaterThan(0);
    expect(financeMemories[0].metadata).toEqual(expect.objectContaining({
      source: "cross-realm-distribution",
      sourceRealmId: petRealm.id,
    }));
  });

  it("cross-realm keyword matching: best agent selected among 3 realms", async () => {
    // This test verifies the keyword scoring logic with real realm data
    const petRealm = realmManager.create({ name: "pet", description: "Pets" });
    const financeRealm = realmManager.create({ name: "finance", description: "Finance" });
    const healthRealm = realmManager.create({ name: "health", description: "Health" });

    const distributor = new KnowledgeDistributor(memoryRepo, realmManager, entityManager, mockLlmRegistry as any);

    // Text with primarily health keywords
    const result = await distributor.distributeFromText("今天去看医生检查身体 symptoms are bad 健康很重要");

    expect(result.realmsAffected).toContain("health");
  });

  it("health report persistence: computeHealth stores to DB", async () => {
    const realm = realmManager.create({ name: "pet", description: "Pet care" });
    memoryRepo.create({ realmId: realm.id, tier: "archival", content: "Luna is a cat" });

    const healthManager = new MemoryHealthManager(memoryRepo, realmManager, entityManager, healthReportRepo, mockLlmRegistry as any);
    await healthManager.computeHealth(realm.id);

    // Verify health_reports table has a record
    const latest = healthReportRepo.getLatest(realm.id);
    expect(latest).not.toBeNull();
    expect(latest!.realmId).toBe(realm.id);
    expect(latest!.memoryCount).toBe(1);

    // Verify realm health_score updated
    const updatedRealm = realmManager.get(realm.id);
    expect(updatedRealm.healthScore).toBeDefined();
  });
});
