import type { RealmState, RouterIntent } from "@openoctopus/shared";
import { createLogger } from "@openoctopus/shared";
import type { LlmProviderRegistry } from "./llm/provider-registry.js";

const log = createLogger("router");

// ── Keyword fallback (used when no LLM is available) ──

const REALM_KEYWORDS: Record<string, string[]> = {
  pet: ["pet", "cat", "dog", "animal", "vet", "puppy", "kitten", "fish", "bird",
    "宠物", "猫", "狗", "狗狗", "猫咪", "动物", "兽医", "喂养", "饲养", "猫粮", "狗粮", "遛狗", "铲屎",
    "柴犬", "金毛", "泰迪", "仓鼠", "兔子", "乌龟", "鹦鹉", "旺财"],
  finance: ["money", "budget", "invest", "bank", "tax", "salary", "expense", "payment", "stock", "crypto",
    "钱", "预算", "投资", "银行", "税", "工资", "报销", "支出", "股票", "理财", "基金", "记账"],
  health: ["health", "doctor", "medicine", "symptom", "diet", "nutrition", "vitamin", "checkup",
    "健康", "医生", "药", "症状", "体检", "营养", "看病", "医院", "挂号", "病"],
  fitness: ["workout", "gym", "running", "yoga", "muscle", "weight", "cardio", "training",
    "健身", "锻炼", "跑步", "瑜伽", "肌肉", "体重", "减肥", "运动"],
  home: ["house", "apartment", "rent", "furniture", "repair", "cleaning", "garden",
    "家", "家里", "房子", "公寓", "租房", "家具", "维修", "打扫", "装修", "搬家"],
  vehicle: ["car", "drive", "fuel", "insurance", "tire", "oil", "mechanic",
    "车", "汽车", "开车", "加油", "保养", "轮胎", "驾照", "停车", "洗车"],
  work: ["work", "job", "career", "office", "meeting", "project", "deadline", "colleague",
    "工作", "上班", "职业", "办公", "会议", "项目", "同事", "老板", "加班", "面试"],
  parents: ["parent", "mom", "dad", "mother", "father", "family",
    "父母", "爸", "妈", "爸爸", "妈妈", "父亲", "母亲", "家人", "爷爷", "奶奶"],
  partner: ["partner", "spouse", "wife", "husband", "relationship", "anniversary",
    "伴侣", "老公", "老婆", "男朋友", "女朋友", "恋爱", "纪念日", "约会", "结婚"],
  friends: ["friend", "social", "party", "gathering",
    "朋友", "社交", "聚会", "聚餐", "好友", "兄弟", "闺蜜"],
  legal: ["legal", "lawyer", "contract", "law", "court",
    "法律", "律师", "合同", "法院", "维权", "诉讼"],
  hobby: ["hobby", "book", "movie", "music", "game", "art", "craft", "travel", "trip",
    "爱好", "书", "电影", "音乐", "游戏", "艺术", "摄影", "画画", "阅读", "追剧", "旅行", "旅游", "出行"],
};

// ── System action patterns ──

interface ActionPattern {
  patterns: RegExp[];
  action: "summon" | "unsummon" | "list_realms" | "list_entities" | "switch_realm";
  extractArgs?: (match: RegExpMatchArray) => Record<string, string>;
}

const ACTION_PATTERNS: ActionPattern[] = [
  {
    action: "summon",
    patterns: [
      /^(?:summon)\s+(.+)/i,
      /^(?:\/summon)\s+(.+)/i,
      /^(?:召唤|唤醒|激活)\s*(.+)/i,
      /(?:帮我|请)?(?:summon|召唤|唤醒|激活)\s*(?:一下)?\s*(.+)/i,
    ],
    extractArgs: (m) => ({ entityName: m[1].trim() }),
  },
  {
    action: "unsummon",
    patterns: [
      /^(?:unsummon|dismiss)\s+(.+)/i,
      /^(?:\/unsummon)\s+(.+)/i,
      /^(?:释放|休眠)\s*(.+)/i,
    ],
    extractArgs: (m) => ({ entityName: m[1].trim() }),
  },
  {
    action: "list_realms",
    patterns: [
      /^(?:list|show|列举|展示|查看|显示)\s*(?:all\s+)?(?:realms?|领域|域)/i,
      /^(?:有哪些|有什么|多少个)\s*(?:realms?|领域|域)/i,
      /^realms?\s*(?:list|列表)?$/i,
    ],
  },
  {
    action: "list_entities",
    patterns: [
      /^(?:list|show|列举|展示|查看|显示)\s*(?:all\s+)?(?:entities|实体|对象)/i,
      /^(?:有哪些|有什么)\s*(?:entities|实体|对象)/i,
    ],
  },
  {
    action: "switch_realm",
    patterns: [
      /^(?:switch|go\s+to)\s+(?:to\s+)?(?:realm\s+)?(.+?)(?:\s+realm)?$/i,
      /^(?:切换|进入)\s*(?:到\s*)?(.+?)(?:\s*realm)?$/i,
    ],
    extractArgs: (m) => ({ realmName: m[1].trim() }),
  },
];

/** Conversation context for context-aware routing */
export interface RouteContext {
  previousRealmId?: string;
  recentMessages?: Array<{ role: string; content: string }>;
}

export class Router {
  private llmRegistry?: LlmProviderRegistry;

  constructor(llmRegistry?: LlmProviderRegistry) {
    this.llmRegistry = llmRegistry;
  }

  async route(message: string, realms: RealmState[], context?: RouteContext): Promise<RouterIntent> {
    if (realms.length === 0) {
      return { confidence: 0, isMultiRealm: false, reasoning: "No realms available" };
    }

    // 1. Detect system actions first (summon, list realms, etc.)
    const systemAction = this.detectSystemAction(message);
    if (systemAction) {
      log.info(`System action detected: ${systemAction.action} (${systemAction.reasoning})`);
      return systemAction;
    }

    // 2. Try LLM routing first if a real provider is configured
    if (this.llmRegistry?.hasRealProvider()) {
      try {
        const intent = await this.routeWithLlm(message, realms, context);
        if (intent) {
          // Apply realm momentum: if LLM is uncertain and there's a previous realm, lean towards it
          if (context?.previousRealmId && intent.confidence < 0.5 && !intent.targetRealmId) {
            const prevRealm = realms.find(r => r.id === context.previousRealmId);
            if (prevRealm) {
              log.info(`Applying realm momentum to "${prevRealm.name}" (previous realm, LLM uncertain)`);
              return {
                ...intent,
                targetRealmId: context.previousRealmId,
                confidence: 0.3,
                reasoning: `${intent.reasoning} (momentum from previous realm: ${prevRealm.name})`,
              };
            }
          }
          return intent;
        }
      } catch (err) {
        log.warn(`LLM routing failed, falling back to keywords: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // 3. Fallback: keyword matching with context
    return this.routeWithKeywords(message, realms, context);
  }

  /** Detect system actions from natural language */
  detectSystemAction(message: string): RouterIntent | null {
    const trimmed = message.trim();

    for (const { patterns, action, extractArgs } of ACTION_PATTERNS) {
      for (const pattern of patterns) {
        const match = trimmed.match(pattern);
        if (match) {
          return {
            confidence: 1.0,
            isMultiRealm: false,
            action,
            actionArgs: extractArgs?.(match),
            reasoning: `system action: ${action}`,
          };
        }
      }
    }

    return null;
  }

  private async routeWithLlm(message: string, realms: RealmState[], context?: RouteContext): Promise<RouterIntent | null> {
    const provider = this.llmRegistry!.getProvider();
    const model = this.llmRegistry!.resolveModel();

    const realmList = realms.map((r) => `- ${r.name}: ${r.description || r.name}`).join("\n");

    let contextHint = "";
    if (context?.previousRealmId) {
      const prevRealm = realms.find(r => r.id === context.previousRealmId);
      if (prevRealm) {
        contextHint = `\nThe user was previously talking in the "${prevRealm.name}" realm. Consider this for ambiguous messages.`;
      }
    }

    const systemPrompt = `You are a message router for a personal life assistant. Your job is to analyze the user's message and decide which realm (domain) should handle it.

Available realms:
${realmList}
${contextHint}
Respond with ONLY a JSON object in this exact format, nothing else:
{"realm": "<realm_name or null>", "confidence": <0.0-1.0>, "reasoning": "<brief reason>"}

Rules:
- If the message clearly belongs to a realm, return its name with high confidence (0.7-1.0)
- If it somewhat relates to a realm, return it with medium confidence (0.3-0.7)
- If it doesn't match any realm, return {"realm": null, "confidence": 0, "reasoning": "general question"}
- Match based on semantic meaning, not just keywords
- The user may write in any language (English, Chinese, etc.)
- Greetings and small talk should return null unless they mention a specific domain topic`;

    const response = await provider.chat({
      model,
      messages: [{ role: "user", content: message }],
      systemPrompt,
      maxTokens: 100,
      temperature: 0,
    });

    const parsed = this.parseRouterResponse(response.content, realms);
    if (!parsed) { return null; }

    log.info(`LLM routed to "${parsed.realmName}" (confidence=${parsed.confidence.toFixed(2)}, reason=${parsed.reasoning})`);

    if (!parsed.realmName) {
      return { confidence: 0, isMultiRealm: false, reasoning: parsed.reasoning };
    }

    const matchedRealm = realms.find((r) => r.name.toLowerCase() === parsed.realmName!.toLowerCase());
    if (!matchedRealm) { return null; }

    return {
      targetRealmId: matchedRealm.id,
      confidence: parsed.confidence,
      isMultiRealm: false,
      reasoning: parsed.reasoning,
    };
  }

  private parseRouterResponse(
    content: string,
    _realms: RealmState[],
  ): { realmName: string | null; confidence: number; reasoning: string } | null {
    try {
      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = content.match(/\{[\s\S]*?\}/);
      if (!jsonMatch) { return null; }

      const data = JSON.parse(jsonMatch[0]) as { realm?: string | null; confidence?: number; reasoning?: string };
      return {
        realmName: data.realm ?? null,
        confidence: typeof data.confidence === "number" ? Math.min(Math.max(data.confidence, 0), 1) : 0.5,
        reasoning: data.reasoning ?? "",
      };
    } catch {
      log.warn(`Failed to parse LLM router response: ${content.slice(0, 100)}`);
      return null;
    }
  }

  /** Keyword-based fallback routing with optional context */
  routeWithKeywords(message: string, realms: RealmState[], context?: RouteContext): RouterIntent {
    const lowered = message.toLowerCase();

    let bestMatch: { realmId: string; score: number } | null = null;

    for (const realm of realms) {
      const name = realm.name.toLowerCase();
      const keywords = REALM_KEYWORDS[name] ?? [];

      let score = 0;
      for (const kw of keywords) {
        if (lowered.includes(kw)) {
          score += 1;
        }
      }

      if (lowered.includes(name)) {
        score += 3;
      }

      if (score > 0 && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { realmId: realm.id, score };
      }
    }

    if (bestMatch) {
      // Normalize confidence: use log scale to avoid very low values for single keyword matches
      const maxKeywords = Math.max(...realms.map(r => (REALM_KEYWORDS[r.name.toLowerCase()] ?? []).length), 1);
      const confidence = Math.min(bestMatch.score / Math.min(maxKeywords * 0.3, 5), 1.0);
      log.info(`Keyword-routed to realm ${bestMatch.realmId} (confidence=${confidence.toFixed(2)})`);
      return {
        targetRealmId: bestMatch.realmId,
        confidence,
        isMultiRealm: false,
      };
    }

    // Realm momentum: if no keyword match but there's a previous realm, use it with low confidence
    if (context?.previousRealmId) {
      const prevRealm = realms.find(r => r.id === context.previousRealmId);
      if (prevRealm) {
        log.info(`No keyword match, applying realm momentum to "${prevRealm.name}"`);
        return {
          targetRealmId: context.previousRealmId,
          confidence: 0.2,
          isMultiRealm: false,
          reasoning: `Realm momentum from previous: ${prevRealm.name}`,
        };
      }
    }

    log.info("No realm match found, routing to general");
    return {
      confidence: 0,
      isMultiRealm: false,
      reasoning: "No realm keywords matched",
    };
  }
}
