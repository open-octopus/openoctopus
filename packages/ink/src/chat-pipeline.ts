import {
  type ChatMessage,
  type AgentConfig,
  type RealmState,
  type MemoryEntry,
  type Entity,
  generateId,
  createRpcEvent,
  RPC_EVENTS,
} from "@openoctopus/shared";
import { readTranscript, appendMessage } from "@openoctopus/storage";
import type { RpcServices } from "./rpc-handlers.js";

function resolveRealmAgent(
  r: RealmState,
  services: RpcServices,
): { agentConfig: AgentConfig; systemPrompt?: string } {
  const meta = services.realmLoader?.getRealmAgent(r.id);
  if (meta) {
    return { agentConfig: meta.agentConfig, systemPrompt: meta.systemPrompt };
  }
  // Fallback: minimal config (no regression)
  return {
    agentConfig: {
      id: `agent_realm_${r.id}`,
      realmId: r.id,
      tier: "realm",
      name: `${r.name} Agent`,
      model: "",
      skills: [],
      proactive: false,
    },
  };
}

export interface ChatPipelineParams {
  message: string;
  sessionId?: string;
  realmId?: string;
  entityId?: string;
  services: RpcServices;
  onToken?: (token: string) => void;
}

export interface ChatPipelineResult {
  sessionId: string;
  response: ChatMessage;
  tokensUsed?: { input: number; output: number };
  routing?: { targetRealmId?: string; confidence?: number };
  realm?: { id: string; name: string };
  entity?: { id: string; name: string };
}

export async function processChatMessage(params: ChatPipelineParams): Promise<ChatPipelineResult> {
  const { message, services, onToken } = params;
  const sessionId = params.sessionId ?? generateId("session");

  const userMsg: ChatMessage = {
    role: "user",
    content: message,
    timestamp: new Date().toISOString(),
  };

  const transcript = readTranscript(sessionId);
  const messages = [...transcript.messages, userMsg];
  appendMessage(sessionId, userMsg);

  let agentConfig;
  let systemPrompt: string | undefined;
  let routing: ChatPipelineResult["routing"];
  let realm: ChatPipelineResult["realm"];
  let entity: ChatPipelineResult["entity"];

  if (params.entityId) {
    const summoned = services.summonEngine.getSummoned(params.entityId);
    if (!summoned) {
      throw Object.assign(new Error("Entity must be summoned"), { status: 400, code: "NOT_SUMMONED" });
    }
    agentConfig = summoned.agent;
    systemPrompt = summoned.systemPrompt;
    entity = { id: summoned.entity.id, name: summoned.entity.name };
  } else if (params.realmId) {
    const r = services.realmManager.get(params.realmId);
    const resolved = resolveRealmAgent(r, services);
    agentConfig = resolved.agentConfig;
    systemPrompt = resolved.systemPrompt;
    realm = { id: r.id, name: r.name };
  } else {
    // Auto-route with conversation context
    const realms = services.realmManager.list();

    // Build route context from transcript
    const previousRealmId = inferPreviousRealmFromTranscript(transcript.messages, realms);
    const recentMessages = transcript.messages.slice(-6).map(m => ({
      role: m.role,
      content: m.content,
    }));

    const intent = await services.router.route(message, realms, {
      previousRealmId,
      recentMessages,
    });
    routing = { targetRealmId: intent.targetRealmId, confidence: intent.confidence };

    // Handle system actions (summon, list realms, etc.)
    if (intent.action) {
      const actionResult = await handleSystemAction(intent.action, intent.actionArgs ?? {}, services);
      const actionResponse: ChatMessage = {
        role: "assistant",
        content: actionResult,
        timestamp: new Date().toISOString(),
      };
      appendMessage(sessionId, actionResponse);
      return {
        sessionId,
        response: actionResponse,
        routing,
      };
    }

    if (intent.targetRealmId) {
      const r = services.realmManager.get(intent.targetRealmId);
      const resolved = resolveRealmAgent(r, services);
      agentConfig = resolved.agentConfig;
      systemPrompt = resolved.systemPrompt;
      realm = { id: r.id, name: r.name };
    } else {
      // Central Router — enrich with system state
      agentConfig = {
        id: "agent_central_router",
        tier: "central" as const,
        name: "Central Router",
        model: "",
        skills: [],
        proactive: false,
      };
      systemPrompt = buildCentralRouterPrompt(realms, services);
    }
  }

  // Load realm memories into system prompt
  if (realm && services.memoryRepo) {
    let recentMemories: MemoryEntry[] = [];

    // Prefer semantic search when embedding provider is available
    if (services.embeddingRegistry?.hasProvider()) {
      try {
        const provider = services.embeddingRegistry.getProvider();
        const queryVec = await provider.embed(message);
        recentMemories = services.memoryRepo.searchSemantic(queryVec, realm.id, 10);
      } catch {
        // Fallback to keyword-based retrieval
        recentMemories = services.memoryRepo.listByRealm(realm.id, "archival").slice(0, 20);
      }
    } else {
      recentMemories = services.memoryRepo.listByRealm(realm.id, "archival").slice(0, 20);
    }

    if (recentMemories.length > 0) {
      const memoryContext = recentMemories.map(m => `- ${m.content}`).join("\n");
      systemPrompt = (systemPrompt ?? "") + `\n\n## Realm Knowledge (from past conversations)\n${memoryContext}`;
    }
  }

  const result = await services.agentRunner.run({
    agent: agentConfig,
    messages,
    systemPrompt,
    onToken,
  });

  appendMessage(sessionId, result.response);

  // Extract and persist knowledge asynchronously (don't block response)
  if (services.memoryExtractor) {
    if (realm) {
      // Realm-scoped extraction
      services.memoryExtractor.extractAndPersist({
        realmId: realm.id,
        entityId: entity?.id,
        userMessage: message,
        assistantMessage: result.response.content,
      }).then((extractionResult) => {
        // Apply attribute updates to entities
        if (extractionResult.attributeUpdates.length > 0) {
          for (const update of extractionResult.attributeUpdates) {
            try {
              const foundEntity = services.entityManager.findByNameInRealm(realm.id, update.entityName);
              if (foundEntity) {
                services.entityManager.update(foundEntity.id, {
                  attributes: { ...foundEntity.attributes, [update.key]: update.value },
                });
              }
            } catch {
              // Best-effort — don't crash on attribute update failure
            }
          }
        }
      }).catch(() => {});  // fire-and-forget
    } else if (!params.entityId && !params.realmId) {
      // Central Router: try to infer a realm from the message and extract memories
      const inferredRealmId = inferRealmFromMessage(message, services);
      if (inferredRealmId) {
        services.memoryExtractor.extractAndPersist({
          realmId: inferredRealmId,
          userMessage: message,
          assistantMessage: result.response.content,
        }).catch(() => {});  // fire-and-forget
      }
    }
  }

  // Check maturity for summon suggestions (fire-and-forget)
  if (realm && services.maturityScanner) {
    services.maturityScanner.checkAndNotify(
      realm.id,
      (suggestion) => {
        services.wsBroadcaster?.broadcast(
          createRpcEvent(RPC_EVENTS.MATURITY_SUGGESTION, suggestion),
        );
      },
      (progress) => {
        services.wsBroadcaster?.broadcast(
          createRpcEvent(RPC_EVENTS.MATURITY_PROGRESS, progress),
        );
      },
    ).catch(() => {});
  }

  // Cross-realm reactions (fire-and-forget)
  if (realm && services.crossRealmReactor) {
    services.crossRealmReactor.checkReactions({
      sourceRealmId: realm.id,
      userMessage: message,
      assistantResponse: result.response.content,
      onReaction: (reaction) => {
        services.wsBroadcaster?.broadcast(
          createRpcEvent(RPC_EVENTS.CROSS_REALM_REACTION, reaction),
        );
      },
    }).catch(() => {});
  }

  return {
    sessionId,
    response: result.response,
    tokensUsed: result.tokensUsed,
    routing,
    realm,
    entity,
  };
}

/** Handle system actions programmatically (no LLM call needed) */
async function handleSystemAction(
  action: string,
  args: Record<string, string>,
  services: RpcServices,
): Promise<string> {
  switch (action) {
    case "summon": {
      const entityName = args.entityName;
      if (!entityName) {return "Please specify which entity to summon.";}

      // Find entity by name across all realms (case-insensitive exact match)
      const realms = services.realmManager.list();
      for (const realm of realms) {
        const entity = services.entityManager.findByNameInRealm(realm.id, entityName);
        if (entity) {
          try {
            const result = await services.summonEngine.summon(entity.id);
            return `${entity.name} has been summoned! (Realm: ${realm.name})\nYou can now chat with ${entity.name} using the entity chat mode.\n\nAgent: ${result.agent.name}`;
          } catch (err) {
            return `Failed to summon ${entityName}: ${err instanceof Error ? err.message : String(err)}`;
          }
        }
      }

      // Try fuzzy/case-insensitive matching
      const allEntities: Array<{ entity: Entity; realm: Realm }> = [];
      for (const realm of realms) {
        const entities = services.entityManager.listByRealm(realm.id);
        for (const entity of entities) {
          allEntities.push({ entity, realm });
        }
      }

      const searchLower = entityName.toLowerCase();
      const fuzzyMatches = allEntities.filter(
        ({ entity }) =>
          entity.name.toLowerCase().includes(searchLower) ||
          searchLower.includes(entity.name.toLowerCase())
      );

      if (fuzzyMatches.length === 1) {
        const { entity, realm } = fuzzyMatches[0];
        try {
          const result = await services.summonEngine.summon(entity.id);
          return `${entity.name} has been summoned! (Realm: ${realm.name})\nYou can now chat with ${entity.name} using the entity chat mode.\n\nAgent: ${result.agent.name}`;
        } catch (err) {
          return `Failed to summon ${entity.name}: ${err instanceof Error ? err.message : String(err)}`;
        }
      }

      if (fuzzyMatches.length > 1) {
        const suggestions = fuzzyMatches.map(({ entity }) => `  - ${entity.name}`).join("\n");
        return `Multiple entities match "${entityName}":\n${suggestions}\n\nPlease be more specific.`;
      }

      // List available entities to help the user
      const entityList = allEntities.length > 0
        ? "\n\nAvailable entities:\n" + allEntities.map(({ entity }) => `  - ${entity.name}`).join("\n")
        : "\n\nNo entities found. Create one first using entity.create.";

      return `Entity "${entityName}" not found.${entityList}`;
    }

    case "unsummon": {
      const entityName = args.entityName;
      if (!entityName) {return "Please specify which entity to unsummon.";}

      const active = services.summonEngine.listActive();
      const match = active.find(a => a.entity.name.toLowerCase() === entityName.toLowerCase());
      if (match) {
        services.summonEngine.unsummon(match.entity.id);
        return `${match.entity.name} has been released from summoning.`;
      }
      return `No active summoned entity named "${entityName}".`;
    }

    case "list_realms": {
      const realms = services.realmManager.list();
      if (realms.length === 0) {return "No realms configured yet.";}

      const lines = realms.map(r => {
        const icon = r.icon ? `${r.icon} ` : "";
        const entities = services.entityManager.countByRealm(r.id);
        const status = r.status === "active" ? "" : ` [${r.status}]`;
        return `  ${icon}${r.name}${status} — ${r.description || "No description"} (${entities} entities)`;
      });
      return `Available Realms (${realms.length}):\n${lines.join("\n")}`;
    }

    case "list_entities": {
      const realms = services.realmManager.list();
      const lines: string[] = [];
      for (const realm of realms) {
        const entities = services.entityManager.listByRealm(realm.id);
        if (entities.length > 0) {
          lines.push(`\n  ${realm.icon ?? ""} ${realm.name}:`);
          for (const e of entities) {
            const summoned = e.summonStatus === "active" ? " [summoned]" : "";
            lines.push(`    - ${e.name} (${e.type})${summoned}`);
          }
        }
      }
      if (lines.length === 0) {return "No entities found across any realm.";}
      return `Entities:${lines.join("\n")}`;
    }

    case "switch_realm": {
      const realmName = args.realmName;
      if (!realmName) {return "Please specify which realm to switch to.";}

      const realm = services.realmManager.findByName(realmName);
      if (realm) {
        return `Switched to realm "${realm.name}". Use /realm ${realm.id} or start chatting about ${realm.name} topics.`;
      }
      const realms = services.realmManager.list();
      const names = realms.map(r => r.name).join(", ");
      return `Realm "${realmName}" not found. Available realms: ${names}`;
    }

    default:
      return "Unknown action.";
  }
}

/** Build an enriched system prompt for the Central Router with real system state */
function buildCentralRouterPrompt(realms: RealmState[], services: RpcServices): string {
  const realmSummary = realms.map(r => {
    const icon = r.icon ? `${r.icon} ` : "";
    const entities = services.entityManager.countByRealm(r.id);
    return `- ${icon}${r.name}: ${r.description || "No description"} (${entities} entities, health: ${r.healthScore}/100)`;
  }).join("\n");

  const activeSummoned = services.summonEngine.listActive();
  const summonedInfo = activeSummoned.length > 0
    ? `\n\nActive Summoned Agents:\n${activeSummoned.map(s => `- ${s.entity.name} (${s.agent.name})`).join("\n")}`
    : "";

  return `You are the Central Router for OpenOctopus, a personal life assistant. You help the user navigate between life domains (Realms) and provide general assistance.

## System State
Available Realms (${realms.length}):
${realmSummary}
${summonedInfo}

## Instructions
- When users ask about system capabilities, available realms, or entities, answer based on the REAL system state above
- For domain-specific questions, suggest the appropriate realm
- For general conversation, respond helpfully
- You can suggest the user summon entities, switch realms, or explore specific domains
- Always be helpful and guide the user to the right realm when appropriate`;
}

/** Infer the previous realm from transcript messages (simple heuristic) */
function inferPreviousRealmFromTranscript(
  messages: ChatMessage[],
  realms: RealmState[],
): string | undefined {
  // Look at the last few messages for realm-related content
  const recent = messages.slice(-4);
  if (recent.length === 0) {return undefined;}

  // Check if any recent message metadata contains realm info
  // For now, use keyword matching on recent messages
  const realmKeywords: Record<string, string[]> = {
    pet: ["pet", "cat", "dog", "宠物", "猫", "狗", "柴犬"],
    home: ["home", "house", "家", "家里", "房子"],
    work: ["work", "job", "工作", "上班"],
    health: ["health", "doctor", "健康", "医生"],
    finance: ["money", "budget", "钱", "预算"],
    fitness: ["gym", "workout", "健身", "运动"],
    hobby: ["hobby", "travel", "旅行", "爱好"],
  };

  let bestRealm: string | undefined;
  let bestScore = 0;

  for (const msg of recent) {
    const lowered = msg.content.toLowerCase();
    for (const realm of realms) {
      const keywords = realmKeywords[realm.name.toLowerCase()] ?? [];
      let score = 0;
      for (const kw of keywords) {
        if (lowered.includes(kw)) { score++; }
      }
      if (score > bestScore) {
        bestScore = score;
        bestRealm = realm.id;
      }
    }
  }

  return bestRealm;
}

/** Infer realm from a message using keyword matching (for Central Router memory extraction) */
function inferRealmFromMessage(message: string, services: RpcServices): string | undefined {
  const realms = services.realmManager.list();
  const lowered = message.toLowerCase();

  const realmKeywords: Record<string, string[]> = {
    pet: ["pet", "cat", "dog", "宠物", "猫", "狗", "柴犬", "旺财"],
    home: ["home", "house", "家", "家里", "房子"],
    work: ["work", "job", "工作", "上班"],
    health: ["health", "doctor", "健康", "医生"],
    finance: ["money", "budget", "钱", "预算"],
    fitness: ["gym", "workout", "健身", "运动"],
    hobby: ["hobby", "travel", "旅行", "旅游", "爱好"],
    parents: ["parent", "mom", "dad", "父母", "爸", "妈"],
    partner: ["partner", "spouse", "伴侣", "老公", "老婆"],
    friends: ["friend", "朋友", "社交"],
    legal: ["legal", "lawyer", "法律", "律师"],
    vehicle: ["car", "drive", "车", "汽车"],
  };

  let bestRealm: RealmState | undefined;
  let bestScore = 0;

  for (const realm of realms) {
    const keywords = realmKeywords[realm.name.toLowerCase()] ?? [];
    let score = 0;
    for (const kw of keywords) {
      if (lowered.includes(kw)) {score++;}
    }
    if (score > bestScore) {
      bestScore = score;
      bestRealm = realm;
    }
  }

  return bestRealm?.id;
}
