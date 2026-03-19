import type { MemoryEntry, MemoryTier } from "@openoctopus/shared";
import { createLogger } from "@openoctopus/shared";
import type { MemoryRepo, KnowledgeGraphRepo } from "@openoctopus/storage";
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

const EXTRACTION_PROMPT = `You are a knowledge extraction system. Given a conversation, extract durable facts and their relationships.

Output a JSON object with these fields:
{
  "facts": ["fact1", "fact2"],
  "importance": [3, 5],
  "relations": [{"subject": "Entity1", "relation": "relationship_type", "object": "Entity2"}],
  "attribute_updates": [{"entityName": "Entity", "key": "attribute", "value": "new_value"}]
}

Rules:
- facts: Standalone factual statements worth remembering. Max 5.
- importance: 1-5 score per fact (one score per fact, same order).
  - 5 = core identity (name, breed, birthday)
  - 4 = major events/decisions
  - 3 = preferences
  - 2 = temporary states
  - 1 = small talk (DISCARD — don't store)
- relations: Entity relationships found in conversation. Subject/object should be entity names.
- attribute_updates: Detected attribute changes (e.g., age changed, new address)
- Write in the same language as the conversation
- If nothing to extract, return {"facts": [], "importance": [], "relations": [], "attribute_updates": []}`;

/** Structured extraction result from the LLM */
export interface ExtractionResult {
  facts: string[];
  importance: number[];
  relations: Array<{ subject: string; relation: string; object: string }>;
  attributeUpdates: Array<{ entityName: string; key: string; value: string }>;
}

export class MemoryExtractor {
  private knowledgeDistributor?: KnowledgeDistributor;
  private embeddingRegistry?: EmbeddingProviderRegistry;
  private knowledgeGraphRepo?: KnowledgeGraphRepo;

  constructor(
    private memoryRepo: MemoryRepo,
    private llmRegistry: LlmProviderRegistry,
    knowledgeDistributor?: KnowledgeDistributor,
    embeddingRegistry?: EmbeddingProviderRegistry,
    knowledgeGraphRepo?: KnowledgeGraphRepo,
  ) {
    this.knowledgeDistributor = knowledgeDistributor;
    this.embeddingRegistry = embeddingRegistry;
    this.knowledgeGraphRepo = knowledgeGraphRepo;
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
  }): Promise<{ memories: MemoryEntry[]; attributeUpdates: ExtractionResult["attributeUpdates"] }> {
    if (!this.llmRegistry.hasRealProvider()) {
      return { memories: [], attributeUpdates: [] };
    }

    try {
      const extraction = await this.extractFacts(params.userMessage, params.assistantMessage);
      const { facts, importance, relations } = extraction;
      if (facts.length === 0) {return { memories: [], attributeUpdates: [] };}

      const entries: MemoryEntry[] = [];
      for (let i = 0; i < facts.length; i++) {
        const fact = facts[i];
        const imp = importance[i] ?? 3; // default importance if missing

        // Discard importance=1 (small talk)
        if (imp <= 1) {
          log.debug(`Discarding low-importance fact (importance=${imp}): ${fact.slice(0, 50)}...`);
          continue;
        }

        // Determine tier based on importance
        const tier: MemoryTier = imp >= 5 ? "core" : "archival";

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
              tier,
              content: fact,
              metadata: {
                source: "conversation",
                extractedAt: new Date().toISOString(),
                importance: imp,
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
          tier,
          content: fact,
          metadata: {
            source: "conversation",
            extractedAt: new Date().toISOString(),
            importance: imp,
          },
        });
        entries.push(entry);
      }

      log.info(`Extracted ${entries.length} memories for realm ${params.realmId}`);

      // Process knowledge graph relations
      await this.processRelations(relations, params.realmId);

      // Cross-realm distribution (fire-and-forget)
      if (this.knowledgeDistributor && facts.length > 0) {
        this.knowledgeDistributor
          .classifyAndDistribute(facts, params.realmId)
          .catch(() => {});
      }

      return { memories: entries, attributeUpdates: extraction.attributeUpdates };
    } catch (err) {
      log.warn(`Memory extraction failed: ${err instanceof Error ? err.message : String(err)}`);
      return { memories: [], attributeUpdates: [] };
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

  private async extractFacts(userMessage: string, assistantMessage: string): Promise<ExtractionResult> {
    const provider = this.llmRegistry.getProvider();
    const model = this.llmRegistry.resolveModel();

    const empty: ExtractionResult = { facts: [], importance: [], relations: [], attributeUpdates: [] };

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
      // Parse the JSON from the response
      const content = result.content.trim();
      // Handle markdown code blocks
      const jsonStr = content.startsWith("[") || content.startsWith("{")
        ? content
        : content.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(jsonStr);

      // Backward compatibility: if the LLM returns a plain array (old format), wrap it
      if (Array.isArray(parsed)) {
        const facts = parsed.filter((item): item is string => typeof item === "string").slice(0, 5);
        return {
          facts,
          importance: facts.map(() => 3), // default importance for old format
          relations: [],
          attributeUpdates: [],
        };
      }

      // New structured format
      if (typeof parsed === "object" && parsed !== null && Array.isArray(parsed.facts)) {
        const facts = (parsed.facts as unknown[])
          .filter((item): item is string => typeof item === "string")
          .slice(0, 5);
        const importance = Array.isArray(parsed.importance)
          ? (parsed.importance as unknown[])
              .slice(0, facts.length)
              .map((v) => (typeof v === "number" ? v : 3))
          : facts.map(() => 3);
        // Pad importance if shorter than facts
        while (importance.length < facts.length) {
          importance.push(3);
        }
        const relations = Array.isArray(parsed.relations)
          ? (parsed.relations as unknown[]).filter(
              (r): r is { subject: string; relation: string; object: string } =>
                typeof r === "object" &&
                r !== null &&
                typeof (r as Record<string, unknown>).subject === "string" &&
                typeof (r as Record<string, unknown>).relation === "string" &&
                typeof (r as Record<string, unknown>).object === "string",
            )
          : [];
        const attributeUpdates = Array.isArray(parsed.attribute_updates)
          ? (parsed.attribute_updates as unknown[]).filter(
              (a): a is { entityName: string; key: string; value: string } =>
                typeof a === "object" &&
                a !== null &&
                typeof (a as Record<string, unknown>).entityName === "string" &&
                typeof (a as Record<string, unknown>).key === "string" &&
                typeof (a as Record<string, unknown>).value === "string",
            )
          : [];

        return { facts, importance, relations, attributeUpdates };
      }

      return empty;
    } catch {
      log.warn("Failed to parse extraction result as JSON");
      return empty;
    }
  }

  /**
   * Process extracted relations by creating knowledge graph nodes and edges.
   */
  private async processRelations(
    relations: ExtractionResult["relations"],
    realmId: string,
  ): Promise<void> {
    if (!this.knowledgeGraphRepo || relations.length === 0) {return;}

    for (const rel of relations) {
      try {
        const subjectNode = this.knowledgeGraphRepo.findOrCreateNode(realmId, rel.subject, "entity");
        const objectNode = this.knowledgeGraphRepo.findOrCreateNode(realmId, rel.object, "entity");
        this.knowledgeGraphRepo.addEdge(subjectNode.id, objectNode.id, rel.relation);
      } catch (err) {
        log.warn(`Failed to process relation ${rel.subject} -[${rel.relation}]-> ${rel.object}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }
}
