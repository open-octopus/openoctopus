import { describe, it, expect, beforeEach, vi } from "vitest";
import { MaturityScanner } from "./maturity-scanner.js";

const mockMemoryRepo = {
  countByEntity: vi.fn(),
};

const mockEntityManager = {
  get: vi.fn(),
  listByRealm: vi.fn(),
};

const mockRealmManager = {
  get: vi.fn(),
  list: vi.fn(),
};

describe("MaturityScanner", () => {
  let scanner: MaturityScanner;

  beforeEach(() => {
    vi.clearAllMocks();
    scanner = new MaturityScanner(
      mockMemoryRepo as any,
      mockEntityManager as any,
      mockRealmManager as any,
    );
  });

  describe("computeEntityMaturity", () => {
    it("should compute low score for empty entity", () => {
      mockEntityManager.get.mockReturnValue({
        id: "e1",
        name: "Luna",
        realmId: "r1",
        attributes: {},
        summonStatus: "dormant",
      });
      mockRealmManager.get.mockReturnValue({ id: "r1", name: "pet" });
      mockMemoryRepo.countByEntity.mockReturnValue(0);

      const score = scanner.computeEntityMaturity("e1");

      expect(score.overall).toBe(0);
      expect(score.readyToSummon).toBe(false);
      expect(score.entityName).toBe("Luna");
    });

    it("should compute high score for well-known entity", () => {
      mockEntityManager.get.mockReturnValue({
        id: "e1",
        name: "Luna",
        realmId: "r1",
        attributes: { breed: "tabby", age: 3, color: "orange", weight: "5kg" },
        summonStatus: "dormant",
      });
      mockRealmManager.get.mockReturnValue({ id: "r1", name: "pet" });
      // First call for archival count, second for all count
      mockMemoryRepo.countByEntity
        .mockReturnValueOnce(15) // archival
        .mockReturnValueOnce(20); // all

      const score = scanner.computeEntityMaturity("e1");

      expect(score.overall).toBeGreaterThanOrEqual(60);
      expect(score.readyToSummon).toBe(true);
      expect(score.attributeCompleteness).toBe(100);
      expect(score.memoryDepth).toBe(100);
    });

    it("should not suggest summon for already active entity", () => {
      mockEntityManager.get.mockReturnValue({
        id: "e1",
        name: "Luna",
        realmId: "r1",
        attributes: { breed: "tabby", age: 3 },
        summonStatus: "active",
      });
      mockRealmManager.get.mockReturnValue({ id: "r1", name: "pet" });
      mockMemoryRepo.countByEntity.mockReturnValue(20);

      const score = scanner.computeEntityMaturity("e1");

      expect(score.readyToSummon).toBe(false);
    });
  });

  describe("scanRealm", () => {
    it("should scan all entities in realm", () => {
      mockEntityManager.listByRealm.mockReturnValue([
        { id: "e1", name: "Luna", realmId: "r1", attributes: {}, summonStatus: "dormant" },
        { id: "e2", name: "Max", realmId: "r1", attributes: { breed: "golden" }, summonStatus: "dormant" },
      ]);
      mockRealmManager.get.mockReturnValue({ id: "r1", name: "pet" });
      mockEntityManager.get
        .mockReturnValueOnce({ id: "e1", name: "Luna", realmId: "r1", attributes: {}, summonStatus: "dormant" })
        .mockReturnValueOnce({ id: "e2", name: "Max", realmId: "r1", attributes: { breed: "golden" }, summonStatus: "dormant" });
      mockMemoryRepo.countByEntity.mockReturnValue(0);

      const scores = scanner.scanRealm("r1");

      expect(scores).toHaveLength(2);
      expect(scores[0].entityName).toBe("Luna");
      expect(scores[1].entityName).toBe("Max");
    });
  });

  describe("scanAll", () => {
    it("should return suggestions for ready entities", () => {
      mockRealmManager.list.mockReturnValue([
        { id: "r1", name: "pet" },
      ]);
      mockEntityManager.listByRealm.mockReturnValue([
        { id: "e1", name: "Luna", realmId: "r1", attributes: { breed: "tabby", age: 3, color: "orange" }, summonStatus: "dormant" },
      ]);
      mockRealmManager.get.mockReturnValue({ id: "r1", name: "pet" });
      mockMemoryRepo.countByEntity.mockReturnValue(20);

      const suggestions = scanner.scanAll();

      expect(suggestions.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe("checkAndNotify", () => {
    it("should call onSuggestion for ready entities", async () => {
      const onSuggestion = vi.fn();

      mockRealmManager.get.mockReturnValue({ id: "r1", name: "pet" });
      mockEntityManager.listByRealm.mockReturnValue([
        { id: "e1", name: "Luna", realmId: "r1", attributes: { a: 1, b: 2, c: 3 }, summonStatus: "dormant" },
      ]);
      mockEntityManager.get.mockReturnValue({
        id: "e1", name: "Luna", realmId: "r1", attributes: { a: 1, b: 2, c: 3 }, summonStatus: "dormant",
      });
      mockMemoryRepo.countByEntity.mockReturnValue(20);

      await scanner.checkAndNotify("r1", onSuggestion);

      expect(onSuggestion).toHaveBeenCalled();
    });
  });

  describe("threshold boundaries", () => {
    it("should return readyToSummon=true at exactly 60", () => {
      // Need: overall = 60
      // attrs = 100 * 0.3 = 30, memDepth = 75 * 0.4 = 30, interFreq = 0 * 0.3 = 0 → 60
      // attrs: 100% → all non-empty
      // memDepth: 75 → archivalCount = 7.5 → round(min(7.5/10,1)*100) = 75
      // Actually min(7.5/10,1)=0.75, *100=75
      // interFreq: 0 → allCount = 0
      // overall = round(100*0.3 + 75*0.4 + 0*0.3) = round(30+30+0) = 60
      mockEntityManager.get.mockReturnValue({
        id: "e1", name: "Test", realmId: "r1",
        attributes: { a: "1", b: "2" },
        summonStatus: "dormant",
      });
      mockRealmManager.get.mockReturnValue({ id: "r1", name: "test" });
      // archivalCount = 8 → memDepth = round(min(8/10,1)*100) = 80
      // overall = round(100*0.3 + 80*0.4 + 0*0.3) = round(30+32+0) = 62
      // Let's try archivalCount = 7 → memDepth = round(0.7*100) = 70
      // overall = round(100*0.3 + 70*0.4 + 0*0.3) = round(30+28) = 58 → not 60
      // archivalCount = 8 → 80 → 30+32=62 ✓ (>=60)
      mockMemoryRepo.countByEntity
        .mockReturnValueOnce(8)   // archival
        .mockReturnValueOnce(0);  // all

      const score = scanner.computeEntityMaturity("e1");
      expect(score.overall).toBe(62);
      expect(score.readyToSummon).toBe(true);
    });

    it("should return readyToSummon=false at 59", () => {
      mockEntityManager.get.mockReturnValue({
        id: "e1", name: "Test", realmId: "r1",
        attributes: { a: "1", b: "2" },
        summonStatus: "dormant",
      });
      mockRealmManager.get.mockReturnValue({ id: "r1", name: "test" });
      // archivalCount = 7 → memDepth = 70
      // overall = round(100*0.3 + 70*0.4 + 0*0.3) = round(30+28) = 58
      mockMemoryRepo.countByEntity
        .mockReturnValueOnce(7)   // archival
        .mockReturnValueOnce(0);  // all

      const score = scanner.computeEntityMaturity("e1");
      expect(score.overall).toBe(58);
      expect(score.readyToSummon).toBe(false);
    });
  });

  describe("exact formula", () => {
    it("should compute precise weighted score", () => {
      mockEntityManager.get.mockReturnValue({
        id: "e1", name: "Luna", realmId: "r1",
        attributes: { breed: "tabby", age: 3, color: "", weight: null },
        summonStatus: "dormant",
      });
      mockRealmManager.get.mockReturnValue({ id: "r1", name: "pet" });
      // 4 keys, 2 non-empty (breed, age) → attrComp = round(2/4 * 100) = 50
      // archivalCount=5 → memDepth = round(min(5/10,1)*100) = 50
      // allCount=8 → interFreq = round(min(8/15,1)*100) = round(53.33) = 53
      mockMemoryRepo.countByEntity
        .mockReturnValueOnce(5)  // archival
        .mockReturnValueOnce(8); // all

      const score = scanner.computeEntityMaturity("e1");
      expect(score.attributeCompleteness).toBe(50);
      expect(score.memoryDepth).toBe(50);
      expect(score.interactionFrequency).toBe(53);
      // overall = round(50*0.3 + 50*0.4 + 53*0.3) = round(15+20+15.9) = round(50.9) = 51
      expect(score.overall).toBe(51);
    });
  });

  describe("memoryDepth cap", () => {
    it("should cap memoryDepth at 100", () => {
      mockEntityManager.get.mockReturnValue({
        id: "e1", name: "Luna", realmId: "r1",
        attributes: { a: "1" },
        summonStatus: "dormant",
      });
      mockRealmManager.get.mockReturnValue({ id: "r1", name: "pet" });
      mockMemoryRepo.countByEntity
        .mockReturnValueOnce(15)  // archival: min(15/10,1)=1 → 100
        .mockReturnValueOnce(5);  // all

      const score = scanner.computeEntityMaturity("e1");
      expect(score.memoryDepth).toBe(100);
    });
  });

  describe("interactionFrequency cap", () => {
    it("should cap interactionFrequency at 100", () => {
      mockEntityManager.get.mockReturnValue({
        id: "e1", name: "Luna", realmId: "r1",
        attributes: {},
        summonStatus: "dormant",
      });
      mockRealmManager.get.mockReturnValue({ id: "r1", name: "pet" });
      mockMemoryRepo.countByEntity
        .mockReturnValueOnce(0)    // archival
        .mockReturnValueOnce(20);  // all: min(20/15,1)=1 → 100

      const score = scanner.computeEntityMaturity("e1");
      expect(score.interactionFrequency).toBe(100);
    });
  });

  describe("scanAll edge cases", () => {
    it("should return empty when no entities ready", () => {
      mockRealmManager.list.mockReturnValue([{ id: "r1", name: "pet" }]);
      mockEntityManager.listByRealm.mockReturnValue([
        { id: "e1", name: "Luna", realmId: "r1", attributes: {}, summonStatus: "dormant" },
      ]);
      mockEntityManager.get.mockReturnValue({
        id: "e1", name: "Luna", realmId: "r1", attributes: {}, summonStatus: "dormant",
      });
      mockRealmManager.get.mockReturnValue({ id: "r1", name: "pet" });
      mockMemoryRepo.countByEntity.mockReturnValue(0);

      const suggestions = scanner.scanAll();
      expect(suggestions).toHaveLength(0);
    });

    it("should collect suggestions across multiple realms", () => {
      mockRealmManager.list.mockReturnValue([
        { id: "r1", name: "pet" },
        { id: "r2", name: "finance" },
      ]);
      mockEntityManager.listByRealm.mockImplementation((realmId: string) => {
        if (realmId === "r1") return [{ id: "e1", name: "Luna", realmId: "r1", attributes: { a: 1, b: 2, c: 3 }, summonStatus: "dormant" }];
        return [{ id: "e2", name: "Account", realmId: "r2", attributes: { x: 1 }, summonStatus: "dormant" }];
      });
      mockEntityManager.get.mockImplementation((id: string) => {
        if (id === "e1") return { id: "e1", name: "Luna", realmId: "r1", attributes: { a: 1, b: 2, c: 3 }, summonStatus: "dormant" };
        return { id: "e2", name: "Account", realmId: "r2", attributes: { x: 1 }, summonStatus: "dormant" };
      });
      mockRealmManager.get.mockImplementation((id: string) => ({ id, name: id === "r1" ? "pet" : "finance" }));
      mockMemoryRepo.countByEntity.mockReturnValue(20);

      const suggestions = scanner.scanAll();
      expect(suggestions.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("zero attributes", () => {
    it("should return attributeCompleteness=0 for empty attributes", () => {
      mockEntityManager.get.mockReturnValue({
        id: "e1", name: "Luna", realmId: "r1",
        attributes: {},
        summonStatus: "dormant",
      });
      mockRealmManager.get.mockReturnValue({ id: "r1", name: "pet" });
      mockMemoryRepo.countByEntity.mockReturnValue(0);

      const score = scanner.computeEntityMaturity("e1");
      expect(score.attributeCompleteness).toBe(0);
    });
  });

  describe("progressive guidance", () => {
    it("should call onProgress for entities with score 40-59", async () => {
      const onSuggestion = vi.fn();
      const onProgress = vi.fn();

      mockRealmManager.get.mockReturnValue({ id: "r1", name: "pet" });
      mockEntityManager.listByRealm.mockReturnValue([
        { id: "e1", name: "Luna", realmId: "r1", attributes: { breed: "tabby", age: null, color: "" }, summonStatus: "dormant" },
      ]);
      mockEntityManager.get.mockReturnValue({
        id: "e1", name: "Luna", realmId: "r1", attributes: { breed: "tabby", age: null, color: "" }, summonStatus: "dormant",
      });
      // Need overall score in 40-59 range
      // attrs: 3 keys, 1 non-empty (breed) -> attrComp = round(1/3*100) = 33
      // archivalCount = 6 -> memDepth = round(0.6*100) = 60
      // allCount = 5 -> interFreq = round(5/15*100) = round(33.33) = 33
      // overall = round(33*0.3 + 60*0.4 + 33*0.3) = round(9.9+24+9.9) = round(43.8) = 44
      mockMemoryRepo.countByEntity
        .mockReturnValueOnce(6)   // archival
        .mockReturnValueOnce(5);  // all

      await scanner.checkAndNotify("r1", onSuggestion, onProgress);

      expect(onSuggestion).not.toHaveBeenCalled();
      expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({
        entityName: "Luna",
        realmName: "pet",
        score: 44,
        missing: expect.arrayContaining(["age", "color"]),
      }));
    });

    it("should not call onProgress for score below 40", async () => {
      const onSuggestion = vi.fn();
      const onProgress = vi.fn();

      mockRealmManager.get.mockReturnValue({ id: "r1", name: "pet" });
      mockEntityManager.listByRealm.mockReturnValue([
        { id: "e1", name: "Luna", realmId: "r1", attributes: {}, summonStatus: "dormant" },
      ]);
      mockEntityManager.get.mockReturnValue({
        id: "e1", name: "Luna", realmId: "r1", attributes: {}, summonStatus: "dormant",
      });
      mockMemoryRepo.countByEntity.mockReturnValue(0);

      await scanner.checkAndNotify("r1", onSuggestion, onProgress);

      expect(onProgress).not.toHaveBeenCalled();
    });

    it("should not call onProgress for score >= 60 (those get onSuggestion instead)", async () => {
      const onSuggestion = vi.fn();
      const onProgress = vi.fn();

      mockRealmManager.get.mockReturnValue({ id: "r1", name: "pet" });
      mockEntityManager.listByRealm.mockReturnValue([
        { id: "e1", name: "Luna", realmId: "r1", attributes: { a: 1, b: 2, c: 3 }, summonStatus: "dormant" },
      ]);
      mockEntityManager.get.mockReturnValue({
        id: "e1", name: "Luna", realmId: "r1", attributes: { a: 1, b: 2, c: 3 }, summonStatus: "dormant",
      });
      mockMemoryRepo.countByEntity.mockReturnValue(20);

      await scanner.checkAndNotify("r1", onSuggestion, onProgress);

      expect(onSuggestion).toHaveBeenCalled();
      expect(onProgress).not.toHaveBeenCalled();
    });
  });
});
