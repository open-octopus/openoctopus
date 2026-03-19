import type { RealmState } from "@openoctopus/shared";
import { createLogger } from "@openoctopus/shared";
import type { MemoryRepo } from "@openoctopus/storage";
import type { EntityManager } from "./entity-manager.js";
import type { LlmProviderRegistry } from "./llm/provider-registry.js";
import type { RealmManager } from "./realm-manager.js";

const log = createLogger("knowledge-distributor");

// Keyword mapping for fallback classification (reused from router)
const REALM_KEYWORDS: Record<string, string[]> = {
  pet: [
    "pet",
    "cat",
    "dog",
    "animal",
    "vet",
    "puppy",
    "kitten",
    "fish",
    "bird",
    "宠物",
    "猫",
    "狗",
    "狗狗",
    "猫咪",
    "动物",
    "兽医",
    "喂养",
    "饲养",
    "猫粮",
    "狗粮",
    "遛狗",
    "铲屎",
  ],
  finance: [
    "money",
    "budget",
    "invest",
    "bank",
    "tax",
    "salary",
    "expense",
    "payment",
    "stock",
    "crypto",
    "钱",
    "预算",
    "投资",
    "银行",
    "税",
    "工资",
    "报销",
    "支出",
    "股票",
    "理财",
    "基金",
    "记账",
  ],
  health: [
    "health",
    "doctor",
    "medicine",
    "symptom",
    "diet",
    "nutrition",
    "vitamin",
    "checkup",
    "健康",
    "医生",
    "药",
    "症状",
    "体检",
    "营养",
    "看病",
    "医院",
    "挂号",
    "病",
  ],
  fitness: [
    "workout",
    "gym",
    "running",
    "yoga",
    "muscle",
    "weight",
    "cardio",
    "training",
    "健身",
    "锻炼",
    "跑步",
    "瑜伽",
    "肌肉",
    "体重",
    "减肥",
    "运动",
  ],
  home: [
    "house",
    "apartment",
    "rent",
    "furniture",
    "repair",
    "cleaning",
    "garden",
    "家",
    "房子",
    "公寓",
    "租房",
    "家具",
    "维修",
    "打扫",
    "装修",
    "搬家",
  ],
  vehicle: [
    "car",
    "drive",
    "fuel",
    "insurance",
    "tire",
    "oil",
    "mechanic",
    "车",
    "汽车",
    "开车",
    "加油",
    "保养",
    "轮胎",
    "驾照",
    "停车",
    "洗车",
  ],
  work: [
    "work",
    "job",
    "career",
    "office",
    "meeting",
    "project",
    "deadline",
    "colleague",
    "工作",
    "上班",
    "职业",
    "办公",
    "会议",
    "项目",
    "同事",
    "老板",
    "加班",
    "面试",
  ],
  parents: [
    "parent",
    "mom",
    "dad",
    "mother",
    "father",
    "family",
    "父母",
    "爸",
    "妈",
    "爸爸",
    "妈妈",
    "父亲",
    "母亲",
    "家人",
    "爷爷",
    "奶奶",
  ],
  partner: [
    "partner",
    "spouse",
    "wife",
    "husband",
    "relationship",
    "anniversary",
    "伴侣",
    "老公",
    "老婆",
    "男朋友",
    "女朋友",
    "恋爱",
    "纪念日",
    "约会",
    "结婚",
  ],
  friends: [
    "friend",
    "social",
    "party",
    "gathering",
    "朋友",
    "社交",
    "聚会",
    "聚餐",
    "好友",
    "兄弟",
    "闺蜜",
  ],
  legal: [
    "legal",
    "lawyer",
    "contract",
    "law",
    "court",
    "法律",
    "律师",
    "合同",
    "法院",
    "维权",
    "诉讼",
  ],
  hobby: [
    "hobby",
    "book",
    "movie",
    "music",
    "game",
    "art",
    "craft",
    "爱好",
    "书",
    "电影",
    "音乐",
    "游戏",
    "艺术",
    "摄影",
    "画画",
    "阅读",
    "追剧",
  ],
};

export interface ExtractedFact {
  content: string;
  realmId: string;
  realmName: string;
  entityName?: string;
  entityType?: string;
}

export interface DistributionResult {
  facts: ExtractedFact[];
  realmsAffected: string[];
  memoriesCreated: number;
}

export interface OnboardingContext {
  step: number;
  collectedFacts: ExtractedFact[];
}

export interface OnboardingStepResult {
  message: string;
  facts: ExtractedFact[];
  done: boolean;
  nextContext: OnboardingContext;
}

export class KnowledgeDistributor {
  constructor(
    private memoryRepo: MemoryRepo,
    private realmManager: RealmManager,
    private entityManager: EntityManager,
    private llmRegistry: LlmProviderRegistry,
  ) {}

  async distributeFromText(text: string): Promise<DistributionResult> {
    const realms = this.realmManager.list();
    const facts = await this.extractAndClassify(text, realms);

    if (facts.length === 0) {
      return { facts: [], realmsAffected: [], memoriesCreated: 0 };
    }

    let memoriesCreated = 0;
    const affectedRealms = new Set<string>();

    for (const fact of facts) {
      this.memoryRepo.create({
        realmId: fact.realmId,
        tier: "archival",
        content: fact.content,
        metadata: {
          source: "injection",
          injectedAt: new Date().toISOString(),
          entityName: fact.entityName,
        },
      });
      memoriesCreated++;
      affectedRealms.add(fact.realmName);

      // Auto-create entity if mentioned and doesn't exist
      if (fact.entityName && fact.entityType) {
        await this.createMissingEntity(fact);
      }
    }

    log.info(`Distributed ${memoriesCreated} facts to ${affectedRealms.size} realms`);
    return {
      facts,
      realmsAffected: [...affectedRealms],
      memoriesCreated,
    };
  }

  async processOnboardingInput(
    input: string,
    context: OnboardingContext,
  ): Promise<OnboardingStepResult> {
    const result = await this.distributeFromText(input);

    const newContext: OnboardingContext = {
      step: context.step + 1,
      collectedFacts: [...context.collectedFacts, ...result.facts],
    };

    if (context.step === 0) {
      return {
        message:
          result.facts.length > 0
            ? `Got it! I captured ${result.facts.length} facts across ${result.realmsAffected.join(", ")}. Tell me more, or type /done to finish.`
            : "I couldn't extract specific facts from that. Try telling me about your pets, family, hobbies, work, etc. Or type /done to skip.",
        facts: result.facts,
        done: false,
        nextContext: newContext,
      };
    }

    return {
      message:
        result.facts.length > 0
          ? `Added ${result.facts.length} more facts. Anything else? Type /done to finish.`
          : "Nothing new to capture. Type /done to finish, or tell me more!",
      facts: result.facts,
      done: false,
      nextContext: newContext,
    };
  }

  async classifyAndDistribute(facts: string[], sourceRealmId: string): Promise<ExtractedFact[]> {
    const realms = this.realmManager.list();
    const distributed: ExtractedFact[] = [];

    for (const fact of facts) {
      const classification = await this.classifyToRealm(fact, realms);

      // Skip if the fact belongs to the source realm (already handled)
      if (!classification || classification.realmId === sourceRealmId) {
        continue;
      }

      this.memoryRepo.create({
        realmId: classification.realmId,
        tier: "archival",
        content: fact,
        metadata: {
          source: "cross-realm-distribution",
          sourceRealmId,
          distributedAt: new Date().toISOString(),
        },
      });

      distributed.push({
        content: fact,
        realmId: classification.realmId,
        realmName: classification.realmName,
      });
    }

    if (distributed.length > 0) {
      log.info(`Cross-realm distributed ${distributed.length} facts from ${sourceRealmId}`);
    }

    return distributed;
  }

  private async extractAndClassify(text: string, realms: RealmState[]): Promise<ExtractedFact[]> {
    if (this.llmRegistry.hasRealProvider()) {
      try {
        return await this.extractWithLlm(text, realms);
      } catch (err) {
        log.warn(
          `LLM extraction failed, using keyword fallback: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    return this.extractWithKeywords(text, realms);
  }

  private async extractWithLlm(text: string, realms: RealmState[]): Promise<ExtractedFact[]> {
    const provider = this.llmRegistry.getProvider();
    const model = this.llmRegistry.resolveModel();

    const realmNames = realms.map((r) => r.name).join(", ");

    const result = await provider.chat({
      model,
      messages: [{ role: "user", content: text }],
      systemPrompt: `Extract structured life information from this text.
For each fact, identify: target realm, entity name (if applicable), entity type (living/asset/organization/abstract), and the fact itself.
Available realms: ${realmNames}
Output a JSON array: [{"realm": "...", "entityName": "..." or null, "entityType": "..." or null, "fact": "..."}]
If no facts found, output [].
Write facts in the same language as the input.`,
      maxTokens: 500,
      temperature: 0,
    });

    const content = result.content.trim();
    const jsonStr = content.startsWith("[")
      ? content
      : content
          .replace(/```json?\n?/g, "")
          .replace(/```/g, "")
          .trim();

    try {
      const parsed = JSON.parse(jsonStr) as Array<{
        realm: string;
        entityName?: string | null;
        entityType?: string | null;
        fact: string;
      }>;

      return parsed
        .filter((item) => item.fact && item.realm)
        .map((item): ExtractedFact | null => {
          const matchedRealm = realms.find(
            (r) => r.name.toLowerCase() === item.realm.toLowerCase(),
          );
          if (!matchedRealm) {
            return null;
          }
          return {
            content: item.fact,
            realmId: matchedRealm.id,
            realmName: matchedRealm.name,
            entityName: item.entityName ?? undefined,
            entityType: item.entityType ?? undefined,
          };
        })
        .filter((f): f is ExtractedFact => f !== null);
    } catch {
      log.warn("Failed to parse LLM extraction result");
      return [];
    }
  }

  private extractWithKeywords(text: string, realms: RealmState[]): ExtractedFact[] {
    const lowered = text.toLowerCase();
    const facts: ExtractedFact[] = [];

    // Find best matching realm by keywords
    let bestRealm: RealmState | undefined;
    let bestScore = 0;

    for (const realm of realms) {
      const keywords = REALM_KEYWORDS[realm.name.toLowerCase()] ?? [];
      let score = 0;
      for (const kw of keywords) {
        if (lowered.includes(kw)) {
          score++;
        }
      }
      if (score > bestScore) {
        bestScore = score;
        bestRealm = realm;
      }
    }

    if (bestRealm && bestScore > 0) {
      // Split text into sentences and classify each as a fact
      const sentences = text
        .split(/[.!?。！？\n]+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 2);
      for (const sentence of sentences) {
        facts.push({
          content: sentence,
          realmId: bestRealm.id,
          realmName: bestRealm.name,
        });
      }
    }

    return facts;
  }

  private async classifyToRealm(
    fact: string,
    realms: RealmState[],
  ): Promise<{ realmId: string; realmName: string } | null> {
    // Keyword-based classification
    const lowered = fact.toLowerCase();
    let bestRealm: RealmState | undefined;
    let bestScore = 0;

    for (const realm of realms) {
      const keywords = REALM_KEYWORDS[realm.name.toLowerCase()] ?? [];
      let score = 0;
      for (const kw of keywords) {
        if (lowered.includes(kw)) {
          score++;
        }
      }
      if (score > bestScore) {
        bestScore = score;
        bestRealm = realm;
      }
    }

    if (bestRealm && bestScore > 0) {
      return { realmId: bestRealm.id, realmName: bestRealm.name };
    }

    return null;
  }

  private async createMissingEntity(fact: ExtractedFact): Promise<void> {
    if (!fact.entityName) {
      return;
    }

    try {
      const existing = this.entityManager.findByNameInRealm(fact.realmId, fact.entityName);
      if (existing) {
        return;
      }

      const validTypes = ["living", "asset", "organization", "abstract"] as const;
      const entityType = validTypes.includes(fact.entityType as (typeof validTypes)[number])
        ? (fact.entityType as (typeof validTypes)[number])
        : "abstract";

      this.entityManager.create({
        realmId: fact.realmId,
        name: fact.entityName,
        type: entityType,
      });

      log.info(`Auto-created entity "${fact.entityName}" in realm ${fact.realmName}`);
    } catch (err) {
      log.warn(
        `Failed to create entity "${fact.entityName}": ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
