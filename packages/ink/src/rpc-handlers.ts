import type { WebSocket } from "ws";
import {
  type RpcRequest,
  createRpcResponse,
  createRpcEvent,
  RPC_METHODS,
  RPC_EVENTS,
  toErrorResponse,
} from "@openoctopus/shared";
import type { RealmManager, EntityManager, AgentRunner, Router as IntentRouter, LlmProviderRegistry } from "@openoctopus/core";
import type { SummonEngine } from "@openoctopus/summon";
import type { ChannelManager } from "@openoctopus/channels";
import { processChatMessage } from "./chat-pipeline.js";

export interface RpcServices {
  realmManager: RealmManager;
  entityManager: EntityManager;
  agentRunner: AgentRunner;
  router: IntentRouter;
  summonEngine: SummonEngine;
  channelManager?: ChannelManager;
  llmRegistry?: LlmProviderRegistry;
  startTime?: number;
}

type RpcHandler = (ws: WebSocket, req: RpcRequest, services: RpcServices) => Promise<void>;

const handlers = new Map<string, RpcHandler>();

// ── Chat handlers ──

handlers.set(RPC_METHODS.CHAT_SEND, async (ws, req, services) => {
  const { message, sessionId, realmId, entityId } = req.params as {
    message?: string;
    sessionId?: string;
    realmId?: string;
    entityId?: string;
  };

  if (!message) {
    ws.send(JSON.stringify(createRpcResponse(req.id, undefined, { code: 400, message: "message is required" })));
    return;
  }

  const result = await processChatMessage({
    message,
    sessionId,
    realmId,
    entityId,
    services,
    onToken: (token: string) => {
      ws.send(JSON.stringify(createRpcEvent(RPC_EVENTS.TOKEN, { token }, req.id)));
    },
  });

  ws.send(
    JSON.stringify(
      createRpcResponse(req.id, {
        sessionId: result.sessionId,
        message: result.response,
        tokensUsed: result.tokensUsed,
      }),
    ),
  );
});

// ── Realm handlers ──

handlers.set(RPC_METHODS.REALM_LIST, async (ws, req, services) => {
  const realms = services.realmManager.list();
  ws.send(JSON.stringify(createRpcResponse(req.id, { realms })));
});

handlers.set(RPC_METHODS.REALM_GET, async (ws, req, services) => {
  const { id } = req.params as { id?: string };
  if (!id) {
    ws.send(JSON.stringify(createRpcResponse(req.id, undefined, { code: 400, message: "id is required" })));
    return;
  }
  const realm = services.realmManager.get(id);
  ws.send(JSON.stringify(createRpcResponse(req.id, { realm })));
});

handlers.set(RPC_METHODS.REALM_CREATE, async (ws, req, services) => {
  const data = req.params as { name?: string; description?: string };
  if (!data.name) {
    ws.send(JSON.stringify(createRpcResponse(req.id, undefined, { code: 400, message: "name is required" })));
    return;
  }
  const realm = services.realmManager.create(data as { name: string; description?: string });
  ws.send(JSON.stringify(createRpcResponse(req.id, { realm })));
});

handlers.set(RPC_METHODS.REALM_UPDATE, async (ws, req, services) => {
  const { id, ...data } = req.params as { id?: string; name?: string; description?: string; status?: string };
  if (!id) {
    ws.send(JSON.stringify(createRpcResponse(req.id, undefined, { code: 400, message: "id is required" })));
    return;
  }
  const realm = services.realmManager.update(id, data);
  ws.send(JSON.stringify(createRpcResponse(req.id, { realm })));
});

handlers.set(RPC_METHODS.REALM_DELETE, async (ws, req, services) => {
  const { id } = req.params as { id?: string };
  if (!id) {
    ws.send(JSON.stringify(createRpcResponse(req.id, undefined, { code: 400, message: "id is required" })));
    return;
  }
  services.realmManager.delete(id);
  ws.send(JSON.stringify(createRpcResponse(req.id, { success: true })));
});

// ── Entity handlers ──

handlers.set(RPC_METHODS.ENTITY_LIST, async (ws, req, services) => {
  const { realmId } = req.params as { realmId?: string };
  if (!realmId) {
    ws.send(JSON.stringify(createRpcResponse(req.id, undefined, { code: 400, message: "realmId is required" })));
    return;
  }
  const entities = services.entityManager.listByRealm(realmId);
  ws.send(JSON.stringify(createRpcResponse(req.id, { entities })));
});

handlers.set(RPC_METHODS.ENTITY_GET, async (ws, req, services) => {
  const { id } = req.params as { id?: string };
  if (!id) {
    ws.send(JSON.stringify(createRpcResponse(req.id, undefined, { code: 400, message: "id is required" })));
    return;
  }
  const entity = services.entityManager.get(id);
  ws.send(JSON.stringify(createRpcResponse(req.id, { entity })));
});

handlers.set(RPC_METHODS.ENTITY_CREATE, async (ws, req, services) => {
  const data = req.params as {
    realmId?: string;
    name?: string;
    type?: string;
    avatar?: string;
    attributes?: Record<string, unknown>;
    soulPath?: string;
  };
  if (!data.realmId || !data.name) {
    ws.send(JSON.stringify(createRpcResponse(req.id, undefined, { code: 400, message: "realmId and name are required" })));
    return;
  }
  const entity = services.entityManager.create(data as Parameters<EntityManager["create"]>[0]);
  ws.send(JSON.stringify(createRpcResponse(req.id, { entity })));
});

handlers.set(RPC_METHODS.ENTITY_UPDATE, async (ws, req, services) => {
  const { id, name, type, avatar, attributes } = req.params as {
    id?: string;
    name?: string;
    type?: "living" | "asset" | "organization" | "abstract";
    avatar?: string;
    attributes?: Record<string, unknown>;
  };
  if (!id) {
    ws.send(JSON.stringify(createRpcResponse(req.id, undefined, { code: 400, message: "id is required" })));
    return;
  }
  const entity = services.entityManager.update(id, { name, type, avatar, attributes });
  ws.send(JSON.stringify(createRpcResponse(req.id, { entity })));
});

handlers.set(RPC_METHODS.ENTITY_DELETE, async (ws, req, services) => {
  const { id } = req.params as { id?: string };
  if (!id) {
    ws.send(JSON.stringify(createRpcResponse(req.id, undefined, { code: 400, message: "id is required" })));
    return;
  }
  services.entityManager.delete(id);
  ws.send(JSON.stringify(createRpcResponse(req.id, { success: true })));
});

// ── Summon handlers ──

handlers.set(RPC_METHODS.SUMMON_LIST, async (ws, req, services) => {
  const summoned = services.summonEngine.listActive();
  ws.send(JSON.stringify(createRpcResponse(req.id, { summoned })));
});

handlers.set(RPC_METHODS.SUMMON_INVOKE, async (ws, req, services) => {
  const { entityId } = req.params as { entityId?: string };
  if (!entityId) {
    ws.send(JSON.stringify(createRpcResponse(req.id, undefined, { code: 400, message: "entityId is required" })));
    return;
  }
  const summoned = await services.summonEngine.summon(entityId);
  ws.send(JSON.stringify(createRpcResponse(req.id, {
    entity: { id: summoned.entity.id, name: summoned.entity.name },
    agent: { id: summoned.agent.id, name: summoned.agent.name },
  })));
});

handlers.set(RPC_METHODS.SUMMON_RELEASE, async (ws, req, services) => {
  const { entityId } = req.params as { entityId?: string };
  if (!entityId) {
    ws.send(JSON.stringify(createRpcResponse(req.id, undefined, { code: 400, message: "entityId is required" })));
    return;
  }
  services.summonEngine.unsummon(entityId);
  ws.send(JSON.stringify(createRpcResponse(req.id, { success: true })));
});

// ── Status handlers ──

handlers.set(RPC_METHODS.STATUS_HEALTH, async (ws, req, _services) => {
  ws.send(
    JSON.stringify(
      createRpcResponse(req.id, {
        status: "ok",
        service: "openoctopus-ink",
        timestamp: new Date().toISOString(),
      }),
    ),
  );
});

handlers.set(RPC_METHODS.STATUS_INFO, async (ws, req, services) => {
  const realms = services.realmManager.list();
  const summoned = services.summonEngine.listActive();
  const providers = services.llmRegistry?.listProviders() ?? [];
  const channels = services.channelManager?.list() ?? [];
  const uptime = services.startTime ? Math.floor((Date.now() - services.startTime) / 1000) : 0;

  ws.send(
    JSON.stringify(
      createRpcResponse(req.id, {
        realms: realms.length,
        summoned: summoned.length,
        uptime,
        providers,
        channels,
        timestamp: new Date().toISOString(),
      }),
    ),
  );
});

// ── Dispatch ──

export async function dispatchRpc(ws: WebSocket, req: RpcRequest, services: RpcServices): Promise<void> {
  const handler = handlers.get(req.method);
  if (!handler) {
    ws.send(
      JSON.stringify(createRpcResponse(req.id, undefined, { code: 404, message: `Unknown method: ${req.method}` })),
    );
    return;
  }

  try {
    await handler(ws, req, services);
  } catch (err) {
    const errResponse = toErrorResponse(err);
    ws.send(
      JSON.stringify(createRpcResponse(req.id, undefined, { code: errResponse.status, message: errResponse.message })),
    );
  }
}
