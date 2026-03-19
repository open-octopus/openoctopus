import type { CrossRealmReaction, AgentConfig, Entity } from "@openoctopus/shared";
import { createLogger } from "@openoctopus/shared";
import type { RealmManager } from "./realm-manager.js";
import type { AgentRunner } from "./agent-runner.js";
import type { LlmProviderRegistry } from "./llm/provider-registry.js";

/** Minimal interface for SummonEngine — avoids circular dependency with @openoctopus/summon */
export interface SummonEnginePort {
  listActive(): Array<{ entity: Entity; agent: AgentConfig; systemPrompt: string }>;
  getSummoned(entityId: string): { entity: Entity; agent: AgentConfig; systemPrompt: string } | undefined;
}

const log = createLogger("cross-realm-reactor");

// Keyword mapping for relevance detection
const REALM_KEYWORDS: Record<string, string[]> = {
  pet: ["pet", "cat", "dog", "animal", "vet", "宠物", "猫", "狗", "猫咪", "兽医"],
  finance: ["money", "budget", "invest", "cost", "price", "expense", "payment",
    "钱", "预算", "花费", "费用", "支出", "报销"],
  health: ["health", "doctor", "medicine", "symptom", "健康", "医生", "药", "症状", "病"],
  fitness: ["workout", "gym", "running", "健身", "锻炼", "运动"],
  home: ["house", "apartment", "rent", "家", "房子", "租房", "装修"],
  vehicle: ["car", "drive", "fuel", "车", "汽车", "加油", "保养"],
  work: ["work", "job", "meeting", "工作", "上班", "会议", "项目"],
  parents: ["parent", "mom", "dad", "father", "mother", "父母", "爸", "妈"],
  partner: ["partner", "spouse", "wife", "husband", "伴侣", "老公", "老婆"],
  friends: ["friend", "social", "party", "朋友", "社交", "聚会"],
  legal: ["legal", "lawyer", "contract", "法律", "律师", "合同"],
  hobby: ["hobby", "book", "movie", "music", "game", "爱好", "书", "电影", "音乐", "游戏"],
};

export class CrossRealmReactor {
  constructor(
    private realmManager: RealmManager,
    private summonEngine: SummonEnginePort,
    private agentRunner: AgentRunner,
    private llmRegistry: LlmProviderRegistry,
  ) {}

  async checkReactions(params: {
    sourceRealmId: string;
    userMessage: string;
    assistantResponse: string;
    onReaction: (reaction: CrossRealmReaction) => void;
  }): Promise<void> {
    const { sourceRealmId, userMessage, assistantResponse, onReaction } = params;

    const activeSummoned = this.summonEngine.listActive();
    if (activeSummoned.length === 0) {return;}

    const realms = this.realmManager.list();
    const combinedText = `${userMessage} ${assistantResponse}`;

    // Find relevant agents from other realms (keyword-first, max 1 reaction)
    let bestMatch: { realmId: string; realmName: string; agentName: string; score: number } | null = null;

    for (const summoned of activeSummoned) {
      // Skip agents in the source realm
      if (summoned.entity.realmId === sourceRealmId) {continue;}

      const targetRealm = realms.find(r => r.id === summoned.entity.realmId);
      if (!targetRealm) {continue;}

      const score = this.computeRelevanceScore(combinedText, targetRealm);
      if (score > 0 && (!bestMatch || score > bestMatch.score)) {
        bestMatch = {
          realmId: targetRealm.id,
          realmName: targetRealm.name,
          agentName: summoned.agent.name,
          score,
        };
      }
    }

    if (!bestMatch) {return;}

    // Generate reaction from the best-matching agent
    try {
      const reaction = await this.generateReaction(
        bestMatch.agentName,
        bestMatch.realmId,
        bestMatch.realmName,
        sourceRealmId,
        combinedText,
      );

      if (reaction) {
        const sourceRealm = realms.find(r => r.id === sourceRealmId);
        onReaction({
          sourceRealmId,
          targetRealmId: bestMatch.realmId,
          targetRealmName: bestMatch.realmName,
          agentName: bestMatch.agentName,
          content: reaction,
          triggeredAt: new Date().toISOString(),
        });
        log.info(`Cross-realm reaction: ${bestMatch.agentName} (${bestMatch.realmName}) → ${sourceRealm?.name ?? sourceRealmId}`);
      }
    } catch (err) {
      log.warn(`Cross-realm reaction generation failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private computeRelevanceScore(text: string, targetRealm: { name: string }): number {
    const lowered = text.toLowerCase();
    const realmName = targetRealm.name.toLowerCase();
    const keywords = REALM_KEYWORDS[realmName] ?? [];

    let score = 0;
    for (const kw of keywords) {
      if (lowered.includes(kw)) {score++;}
    }

    return score;
  }

  private async generateReaction(
    agentName: string,
    targetRealmId: string,
    targetRealmName: string,
    sourceRealmId: string,
    conversationSummary: string,
  ): Promise<string | null> {
    if (!this.llmRegistry.hasRealProvider()) {return null;}

    try {
      const provider = this.llmRegistry.getProvider();
      const model = this.llmRegistry.resolveModel();

      const sourceRealm = this.realmManager.get(sourceRealmId);

      const result = await provider.chat({
        model,
        messages: [{
          role: "user",
          content: `The user is chatting in the "${sourceRealm.name}" realm. Here's the conversation:\n${conversationSummary}`,
        }],
        systemPrompt: `You are ${agentName}, an AI agent managing the "${targetRealmName}" realm. You noticed something relevant to your domain in a conversation happening in another realm.
Generate a brief, helpful one-line reaction (max 50 words) from your domain's perspective. Be concise and useful.
If nothing truly relevant from your domain's perspective, respond with exactly "SKIP".`,
        maxTokens: 150,
        temperature: 0.3,
      });

      const content = result.content.trim();
      if (content === "SKIP" || content.length < 5) {return null;}

      return content;
    } catch (err) {
      log.warn(`Reaction generation failed: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  }
}
