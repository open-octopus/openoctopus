import {
  type ChatMessage,
  generateId,
} from "@openoctopus/shared";
import { readTranscript, appendMessage } from "@openoctopus/storage";
import type { RpcServices } from "./rpc-handlers.js";

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
    agentConfig = {
      id: `agent_realm_${r.id}`,
      realmId: r.id,
      tier: "realm" as const,
      name: `${r.name} Agent`,
      model: "claude-sonnet-4-6",
      skills: [],
      proactive: false,
    };
    realm = { id: r.id, name: r.name };
  } else {
    // Auto-route
    const realms = services.realmManager.list();
    const intent = services.router.route(message, realms);
    routing = { targetRealmId: intent.targetRealmId, confidence: intent.confidence };

    if (intent.targetRealmId) {
      const r = services.realmManager.get(intent.targetRealmId);
      agentConfig = {
        id: `agent_realm_${r.id}`,
        realmId: r.id,
        tier: "realm" as const,
        name: `${r.name} Agent`,
        model: "claude-sonnet-4-6",
        skills: [],
        proactive: false,
      };
      realm = { id: r.id, name: r.name };
    } else {
      agentConfig = {
        id: "agent_central_router",
        tier: "central" as const,
        name: "Central Router",
        model: "claude-sonnet-4-6",
        skills: [],
        proactive: false,
      };
    }
  }

  const result = await services.agentRunner.run({
    agent: agentConfig,
    messages,
    systemPrompt,
    onToken,
  });

  appendMessage(sessionId, result.response);

  return {
    sessionId,
    response: result.response,
    tokensUsed: result.tokensUsed,
    routing,
    realm,
    entity,
  };
}
