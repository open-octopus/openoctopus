import type { MemoryEntry } from "@openoctopus/shared";
import { createLogger } from "@openoctopus/shared";
import type { MemoryRepo } from "@openoctopus/storage";
import type { LlmProviderRegistry } from "./llm/provider-registry.js";
import type { KnowledgeDistributor } from "./knowledge-distributor.js";
import type { EmbeddingProviderRegistry } from "./embedding/embedding-registry.js";

const log = createLogger("memory-extractor");

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

const EXTRACTION_PROMPT = `You are a knowledge extraction system. Given a conversation between a user and an AI assistant, extract durable facts worth remembering for future conversations.

Rules:
- Extract ONLY facts that would be useful in future conversations about this topic
- Each fact should be a standalone statement (no context needed)
- Skip greetings, small talk, and procedural exchanges
- Focus on: preferences, decisions, events, relationships, states, plans, important numbers/dates
- Output JSON array of strings. If no facts worth extracting, output empty array []
- Maximum 5 facts per extraction
- Write facts in the same language as the conversation

Example input:
User: 我家猫咪最近不太吃东西，体重掉了不少
Assistant: 猫咪食欲下降和体重减轻需要关注...建议尽快带去看兽医

Example output:
["猫咪最近食欲下降，不太吃东西", "猫咪体重有所下降", "需要带猫咪去看兽医检查"]`;

export class MemoryExtractor {
  private knowledgeDistributor?: KnowledgeDistributor;
  private embeddingRegistry?: EmbeddingProviderRegistry;

  constructor(
    private memoryRepo: MemoryRepo,
    private llmRegistry: LlmProviderRegistry,
    knowledgeDistributor?: KnowledgeDistributor,
    embeddingRegistry?: EmbeddingProviderRegistry,
  ) {
    this.knowledgeDistributor = knowledgeDistributor;
    this.embeddingRegistry = embeddingRegistry;
  }

  /**
   * Extract knowledge from the latest conversation turn and persist to realm memory.
   * This runs asynchronously after the response is sent — does not block the chat.
   */
  async extractAndPersist(params: {
    realmId: string;
    entityId?: string;
    userMessage: string;
    assistantMessage: string;
  }): Promise<MemoryEntry[]> {
    if (!this.llmRegistry.hasRealProvider()) {
      return [];
    }

    try {
      const facts = await this.extractFacts(params.userMessage, params.assistantMessage);
      if (facts.length === 0) return [];

      const entries: MemoryEntry[] = [];
      for (const fact of facts) {
        // Check for duplicates before storing (only when embedding provider available)
        if (this.embeddingRegistry?.hasProvider()) {
          try {
            const provider = this.embeddingRegistry.getProvider();
            const factVec = await provider.embed(fact);
            const similar = this.memoryRepo.searchSemantic(factVec, params.realmId, 3);

            if (similar.length > 0 && similar[0].embedding) {
              const similarity = cosineSimilarity(factVec, similar[0].embedding);

              if (similarity > 0.85) {
                log.debug(`Skipping duplicate fact (similarity=${similarity.toFixed(2)}): ${fact.slice(0, 50)}...`);
                continue; // skip this fact entirely
              }

              if (similarity >= 0.6) {
                // Merge: combine old + new into one entry
                const merged = await this.mergeFacts(similar[0].content, fact);
                this.memoryRepo.updateContent(similar[0].id, merged);
                // Re-embed the merged content
                const mergedVec = await provider.embed(merged);
                this.memoryRepo.updateEmbedding(similar[0].id, mergedVec);
                log.debug(`Merged fact (similarity=${similarity.toFixed(2)}): ${fact.slice(0, 50)}...`);
                entries.push({ ...similar[0], content: merged });
                continue;
              }
            }

            // Similarity < 0.6 or no similar found — insert as new
            const entry = this.memoryRepo.create({
              realmId: params.realmId,
              entityId: params.entityId,
              tier: "archival",
              content: fact,
              metadata: {
                source: "conversation",
                extractedAt: new Date().toISOString(),
              },
            });
            this.memoryRepo.updateEmbedding(entry.id, factVec);
            entries.push(entry);
            continue;
          } catch {
            // Fall through to non-dedup insert if embedding fails
          }
        }

        // No embedding provider — insert normally (existing behavior)
        const entry = this.memoryRepo.create({
          realmId: params.realmId,
          entityId: params.entityId,
          tier: "archival",
          content: fact,
          metadata: {
            source: "conversation",
            extractedAt: new Date().toISOString(),
          },
        });
        entries.push(entry);
      }

      log.info(`Extracted ${entries.length} memories for realm ${params.realmId}`);

      // Cross-realm distribution (fire-and-forget)
      if (this.knowledgeDistributor && facts.length > 0) {
        this.knowledgeDistributor
          .classifyAndDistribute(facts, params.realmId)
          .catch(() => {});
      }

      return entries;
    } catch (err) {
      log.warn(`Memory extraction failed: ${err instanceof Error ? err.message : String(err)}`);
      return [];
    }
  }

  private async mergeFacts(existing: string, newFact: string): Promise<string> {
    if (!this.llmRegistry.hasRealProvider()) {
      return `${existing}; ${newFact}`;
    }
    try {
      const provider = this.llmRegistry.getProvider();
      const model = this.llmRegistry.resolveModel();
      const result = await provider.chat({
        model,
        messages: [
          {
            role: "user",
            content: `Existing fact: "${existing}"\nNew information: "${newFact}"\n\nCombine into a single, updated factual statement. Output ONLY the merged fact, nothing else.`,
          },
        ],
        maxTokens: 200,
      });
      return result.content.trim();
    } catch {
      return `${existing}; ${newFact}`;
    }
  }

  private async extractFacts(userMessage: string, assistantMessage: string): Promise<string[]> {
    const provider = this.llmRegistry.getProvider();
    const model = this.llmRegistry.resolveModel();

    const result = await provider.chat({
      model,
      messages: [
        {
          role: "user",
          content: `Conversation:\nUser: ${userMessage}\nAssistant: ${assistantMessage}`,
        },
      ],
      systemPrompt: EXTRACTION_PROMPT,
    });

    try {
      // Parse the JSON array from the response
      const content = result.content.trim();
      // Handle markdown code blocks
      const jsonStr = content.startsWith("[") ? content : content.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(jsonStr);
      if (Array.isArray(parsed)) {
        return parsed.filter((item): item is string => typeof item === "string").slice(0, 5);
      }
      return [];
    } catch {
      log.warn("Failed to parse extraction result as JSON");
      return [];
    }
  }
}
