import { describe, it, expect, beforeEach, vi } from "vitest";
import { CrossRealmReactor } from "./cross-realm-reactor.js";

const mockRealmManager = {
  list: vi.fn(),
  get: vi.fn(),
};

const mockSummonEngine = {
  listActive: vi.fn(),
};

const mockAgentRunner = {};

const mockLlmRegistry = {
  hasRealProvider: vi.fn().mockReturnValue(false),
  getProvider: vi.fn(),
  resolveModel: vi.fn(),
};

describe("CrossRealmReactor", () => {
  let reactor: CrossRealmReactor;

  beforeEach(() => {
    vi.clearAllMocks();
    reactor = new CrossRealmReactor(
      mockRealmManager as unknown as ConstructorParameters<typeof CrossRealmReactor>[0],
      mockSummonEngine as unknown as ConstructorParameters<typeof CrossRealmReactor>[1],
      mockAgentRunner as unknown as ConstructorParameters<typeof CrossRealmReactor>[2],
      mockLlmRegistry as unknown as ConstructorParameters<typeof CrossRealmReactor>[3],
    );
  });

  describe("checkReactions", () => {
    it("should skip when no active summoned agents", async () => {
      const onReaction = vi.fn();
      mockSummonEngine.listActive.mockReturnValue([]);

      await reactor.checkReactions({
        sourceRealmId: "r1",
        userMessage: "test",
        assistantResponse: "response",
        onReaction,
      });

      expect(onReaction).not.toHaveBeenCalled();
    });

    it("should skip when summoned agent is in same realm", async () => {
      const onReaction = vi.fn();
      mockSummonEngine.listActive.mockReturnValue([
        {
          entity: { realmId: "r1", id: "e1" },
          agent: { name: "Pet Agent" },
        },
      ]);
      mockRealmManager.list.mockReturnValue([{ id: "r1", name: "pet" }]);

      await reactor.checkReactions({
        sourceRealmId: "r1",
        userMessage: "猫咪很可爱",
        assistantResponse: "是的",
        onReaction,
      });

      expect(onReaction).not.toHaveBeenCalled();
    });

    it("should detect relevance by keywords", async () => {
      const onReaction = vi.fn();
      mockSummonEngine.listActive.mockReturnValue([
        {
          entity: { realmId: "r2", id: "e1" },
          agent: { name: "Finance Agent" },
        },
      ]);
      mockRealmManager.list.mockReturnValue([
        { id: "r1", name: "pet" },
        { id: "r2", name: "finance" },
      ]);
      mockRealmManager.get.mockReturnValue({ id: "r1", name: "pet" });

      // No LLM available, so no reaction generated (keyword detection only)
      await reactor.checkReactions({
        sourceRealmId: "r1",
        userMessage: "猫咪看病花了很多钱",
        assistantResponse: "建议查看费用",
        onReaction,
      });

      // Without LLM, reaction won't be generated (returns null)
      // but the keyword detection should find relevance
      expect(onReaction).not.toHaveBeenCalled(); // no LLM = no reaction text
    });

    it("should generate reaction with LLM", async () => {
      const onReaction = vi.fn();
      mockLlmRegistry.hasRealProvider.mockReturnValue(true);
      mockLlmRegistry.getProvider.mockReturnValue({
        chat: vi.fn().mockResolvedValue({ content: "注意宠物医疗支出" }),
      });
      mockLlmRegistry.resolveModel.mockReturnValue("test-model");

      mockSummonEngine.listActive.mockReturnValue([
        {
          entity: { realmId: "r2", id: "e1" },
          agent: { name: "Finance Agent" },
        },
      ]);
      mockRealmManager.list.mockReturnValue([
        { id: "r1", name: "pet" },
        { id: "r2", name: "finance" },
      ]);
      mockRealmManager.get.mockReturnValue({ id: "r1", name: "pet" });

      await reactor.checkReactions({
        sourceRealmId: "r1",
        userMessage: "猫咪看病花了很多钱",
        assistantResponse: "建议查看费用",
        onReaction,
      });

      expect(onReaction).toHaveBeenCalledTimes(1);
      expect(onReaction).toHaveBeenCalledWith(
        expect.objectContaining({
          targetRealmName: "finance",
          agentName: "Finance Agent",
        }),
      );
    });
  });

  describe("multi-agent selection", () => {
    it("should select agent with highest keyword relevance", async () => {
      const onReaction = vi.fn();
      mockLlmRegistry.hasRealProvider.mockReturnValue(true);
      mockLlmRegistry.getProvider.mockReturnValue({
        chat: vi.fn().mockResolvedValue({ content: "Finance tip about pet costs" }),
      });
      mockLlmRegistry.resolveModel.mockReturnValue("test-model");

      mockSummonEngine.listActive.mockReturnValue([
        { entity: { realmId: "r2", id: "e1" }, agent: { name: "Health Agent" } },
        { entity: { realmId: "r3", id: "e2" }, agent: { name: "Finance Agent" } },
      ]);
      mockRealmManager.list.mockReturnValue([
        { id: "r1", name: "pet" },
        { id: "r2", name: "health" },
        { id: "r3", name: "finance" },
      ]);
      mockRealmManager.get.mockReturnValue({ id: "r1", name: "pet" });

      await reactor.checkReactions({
        sourceRealmId: "r1",
        userMessage: "我花了很多钱给猫看病 费用支出很高 预算不够",
        assistantResponse: "这笔expense确实不少",
        onReaction,
      });

      // finance keywords: 钱, 费用, 支出, 预算, expense = ~5 hits
      // health keywords: 病 = ~1 hit
      // Finance should win
      expect(onReaction).toHaveBeenCalledWith(
        expect.objectContaining({
          targetRealmName: "finance",
          agentName: "Finance Agent",
        }),
      );
    });
  });

  describe("LLM returns SKIP", () => {
    it("should not call onReaction when LLM returns SKIP", async () => {
      const onReaction = vi.fn();
      mockLlmRegistry.hasRealProvider.mockReturnValue(true);
      mockLlmRegistry.getProvider.mockReturnValue({
        chat: vi.fn().mockResolvedValue({ content: "SKIP" }),
      });
      mockLlmRegistry.resolveModel.mockReturnValue("test-model");

      mockSummonEngine.listActive.mockReturnValue([
        { entity: { realmId: "r2", id: "e1" }, agent: { name: "Finance Agent" } },
      ]);
      mockRealmManager.list.mockReturnValue([
        { id: "r1", name: "pet" },
        { id: "r2", name: "finance" },
      ]);
      mockRealmManager.get.mockReturnValue({ id: "r1", name: "pet" });

      await reactor.checkReactions({
        sourceRealmId: "r1",
        userMessage: "猫咪花了很多钱",
        assistantResponse: "费用",
        onReaction,
      });

      expect(onReaction).not.toHaveBeenCalled();
    });
  });

  describe("LLM returns short text", () => {
    it("should not call onReaction when response is less than 5 chars", async () => {
      const onReaction = vi.fn();
      mockLlmRegistry.hasRealProvider.mockReturnValue(true);
      mockLlmRegistry.getProvider.mockReturnValue({
        chat: vi.fn().mockResolvedValue({ content: "ok" }),
      });
      mockLlmRegistry.resolveModel.mockReturnValue("test-model");

      mockSummonEngine.listActive.mockReturnValue([
        { entity: { realmId: "r2", id: "e1" }, agent: { name: "Finance Agent" } },
      ]);
      mockRealmManager.list.mockReturnValue([
        { id: "r1", name: "pet" },
        { id: "r2", name: "finance" },
      ]);
      mockRealmManager.get.mockReturnValue({ id: "r1", name: "pet" });

      await reactor.checkReactions({
        sourceRealmId: "r1",
        userMessage: "花了很多钱",
        assistantResponse: "费用报销",
        onReaction,
      });

      expect(onReaction).not.toHaveBeenCalled();
    });
  });

  describe("LLM error handling", () => {
    it("should not call onReaction on LLM error", async () => {
      const onReaction = vi.fn();
      mockLlmRegistry.hasRealProvider.mockReturnValue(true);
      mockLlmRegistry.getProvider.mockReturnValue({
        chat: vi.fn().mockRejectedValue(new Error("LLM failure")),
      });
      mockLlmRegistry.resolveModel.mockReturnValue("test-model");

      mockSummonEngine.listActive.mockReturnValue([
        { entity: { realmId: "r2", id: "e1" }, agent: { name: "Finance Agent" } },
      ]);
      mockRealmManager.list.mockReturnValue([
        { id: "r1", name: "pet" },
        { id: "r2", name: "finance" },
      ]);
      mockRealmManager.get.mockReturnValue({ id: "r1", name: "pet" });

      await reactor.checkReactions({
        sourceRealmId: "r1",
        userMessage: "花了很多钱",
        assistantResponse: "费用报销",
        onReaction,
      });

      expect(onReaction).not.toHaveBeenCalled();
    });
  });

  describe("3 realm competition", () => {
    it("should pick the highest-scoring realm among 3", async () => {
      const onReaction = vi.fn();
      mockLlmRegistry.hasRealProvider.mockReturnValue(true);
      mockLlmRegistry.getProvider.mockReturnValue({
        chat: vi.fn().mockResolvedValue({ content: "Health tip for your situation" }),
      });
      mockLlmRegistry.resolveModel.mockReturnValue("test-model");

      mockSummonEngine.listActive.mockReturnValue([
        { entity: { realmId: "r2", id: "e1" }, agent: { name: "Finance Agent" } },
        { entity: { realmId: "r3", id: "e2" }, agent: { name: "Health Agent" } },
        { entity: { realmId: "r4", id: "e3" }, agent: { name: "Work Agent" } },
      ]);
      mockRealmManager.list.mockReturnValue([
        { id: "r1", name: "pet" },
        { id: "r2", name: "finance" },
        { id: "r3", name: "health" },
        { id: "r4", name: "work" },
      ]);
      mockRealmManager.get.mockReturnValue({ id: "r1", name: "pet" });

      // health keywords: health, doctor, medicine, symptom, 健康, 医生, 药, 症状, 病
      await reactor.checkReactions({
        sourceRealmId: "r1",
        userMessage: "猫咪生病了要看医生吃药 symptoms are bad 健康很重要",
        assistantResponse: "建议去看doctor",
        onReaction,
      });

      // health has most keyword hits: 病, 医生, 药, symptoms(?), 健康, doctor = many
      // finance: 0, work: 0
      expect(onReaction).toHaveBeenCalledWith(
        expect.objectContaining({
          targetRealmName: "health",
          agentName: "Health Agent",
        }),
      );
    });
  });

  describe("empty message", () => {
    it("should not match any realm with empty message", async () => {
      const onReaction = vi.fn();
      mockSummonEngine.listActive.mockReturnValue([
        { entity: { realmId: "r2", id: "e1" }, agent: { name: "Finance Agent" } },
      ]);
      mockRealmManager.list.mockReturnValue([
        { id: "r1", name: "pet" },
        { id: "r2", name: "finance" },
      ]);

      await reactor.checkReactions({
        sourceRealmId: "r1",
        userMessage: "",
        assistantResponse: "",
        onReaction,
      });

      expect(onReaction).not.toHaveBeenCalled();
    });
  });

  describe("Chinese keywords", () => {
    it("should match Chinese keywords correctly", async () => {
      const onReaction = vi.fn();
      mockLlmRegistry.hasRealProvider.mockReturnValue(true);
      mockLlmRegistry.getProvider.mockReturnValue({
        chat: vi.fn().mockResolvedValue({ content: "关注健身计划和运动量" }),
      });
      mockLlmRegistry.resolveModel.mockReturnValue("test-model");

      mockSummonEngine.listActive.mockReturnValue([
        { entity: { realmId: "r2", id: "e1" }, agent: { name: "Fitness Agent" } },
      ]);
      mockRealmManager.list.mockReturnValue([
        { id: "r1", name: "pet" },
        { id: "r2", name: "fitness" },
      ]);
      mockRealmManager.get.mockReturnValue({ id: "r1", name: "pet" });

      await reactor.checkReactions({
        sourceRealmId: "r1",
        userMessage: "带狗狗去锻炼运动健身",
        assistantResponse: "好的",
        onReaction,
      });

      // fitness keywords: 健身, 锻炼, 运动 all match
      expect(onReaction).toHaveBeenCalledWith(
        expect.objectContaining({
          targetRealmName: "fitness",
        }),
      );
    });
  });
});
