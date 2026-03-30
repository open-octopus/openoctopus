import type { ChannelManager } from "@openoctopus/channels";
import type {
  RealmManager,
  EntityManager,
  AgentRunner,
  Router as IntentRouter,
  LlmProviderRegistry,
  RealmLoader,
  MemoryExtractor,
  MemoryHealthManager,
  KnowledgeDistributor,
  MaturityScanner,
  CrossRealmReactor,
  DirectoryScanner,
  EmbeddingProviderRegistry,
  FamilyRoleRouter,
  Scheduler,
} from "@openoctopus/core";
import {
  type RpcRequest,
  createRpcResponse,
  createRpcEvent,
  RPC_METHODS,
  RPC_EVENTS,
  toErrorResponse,
} from "@openoctopus/shared";
import type { MemoryRepo, FamilyMemberRepo } from "@openoctopus/storage";
import type { SummonEngine } from "@openoctopus/summon";
import type { WebSocket } from "ws";
import { processChatMessage } from "./chat-pipeline.js";
import type { WsBroadcaster } from "./ws.js";

export interface RpcServices {
  realmManager: RealmManager;
  entityManager: EntityManager;
  agentRunner: AgentRunner;
  router: IntentRouter;
  summonEngine: SummonEngine;
  channelManager?: ChannelManager;
  llmRegistry?: LlmProviderRegistry;
  realmLoader?: RealmLoader;
  memoryRepo?: MemoryRepo;
  memoryExtractor?: MemoryExtractor;
  memoryHealthManager?: MemoryHealthManager;
  knowledgeDistributor?: KnowledgeDistributor;
  maturityScanner?: MaturityScanner;
  crossRealmReactor?: CrossRealmReactor;
  directoryScanner?: DirectoryScanner;
  embeddingRegistry?: EmbeddingProviderRegistry;
  familyRoleRouter?: FamilyRoleRouter;
  familyMemberRepo?: FamilyMemberRepo;
  scheduler?: Scheduler;
  wsBroadcaster?: WsBroadcaster;
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
    ws.send(
      JSON.stringify(
        createRpcResponse(req.id, undefined, { code: 400, message: "message is required" }),
      ),
    );
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
  const realms = services.realmManager.list().map((r) => {
    const meta = services.realmLoader?.getRealmAgent(r.id);
    return Object.assign(r, {
      entityCount: services.entityManager.countByRealm(r.id),
      agentName: meta?.agentConfig.name,
    });
  });
  ws.send(JSON.stringify(createRpcResponse(req.id, { realms })));
});

handlers.set(RPC_METHODS.REALM_GET, async (ws, req, services) => {
  const { id } = req.params as { id?: string };
  if (!id) {
    ws.send(
      JSON.stringify(
        createRpcResponse(req.id, undefined, { code: 400, message: "id is required" }),
      ),
    );
    return;
  }
  const realm = services.realmManager.get(id);
  const entities = services.entityManager.listByRealm(id);
  const meta = services.realmLoader?.getRealmAgent(id);
  ws.send(
    JSON.stringify(
      createRpcResponse(req.id, {
        realm: {
          ...realm,
          entityCount: entities.length,
          entities: entities.map((e) => ({
            id: e.id,
            name: e.name,
            type: e.type,
            summonStatus: e.summonStatus,
          })),
          agentName: meta?.agentConfig.name,
          skills: meta?.skills ?? [],
        },
      }),
    ),
  );
});

handlers.set(RPC_METHODS.REALM_CREATE, async (ws, req, services) => {
  const data = req.params as { name?: string; description?: string };
  if (!data.name) {
    ws.send(
      JSON.stringify(
        createRpcResponse(req.id, undefined, { code: 400, message: "name is required" }),
      ),
    );
    return;
  }
  const realm = services.realmManager.create(data as { name: string; description?: string });
  ws.send(JSON.stringify(createRpcResponse(req.id, { realm })));
});

handlers.set(RPC_METHODS.REALM_UPDATE, async (ws, req, services) => {
  const { id, ...data } = req.params as {
    id?: string;
    name?: string;
    description?: string;
    status?: string;
  };
  if (!id) {
    ws.send(
      JSON.stringify(
        createRpcResponse(req.id, undefined, { code: 400, message: "id is required" }),
      ),
    );
    return;
  }
  const realm = services.realmManager.update(id, data);
  ws.send(JSON.stringify(createRpcResponse(req.id, { realm })));
});

handlers.set(RPC_METHODS.REALM_DELETE, async (ws, req, services) => {
  const { id } = req.params as { id?: string };
  if (!id) {
    ws.send(
      JSON.stringify(
        createRpcResponse(req.id, undefined, { code: 400, message: "id is required" }),
      ),
    );
    return;
  }
  services.realmManager.delete(id);
  ws.send(JSON.stringify(createRpcResponse(req.id, { success: true })));
});

// ── Entity handlers ──

handlers.set(RPC_METHODS.ENTITY_LIST, async (ws, req, services) => {
  const { realmId } = req.params as { realmId?: string };
  if (!realmId) {
    ws.send(
      JSON.stringify(
        createRpcResponse(req.id, undefined, { code: 400, message: "realmId is required" }),
      ),
    );
    return;
  }
  const entities = services.entityManager.listByRealm(realmId);
  ws.send(JSON.stringify(createRpcResponse(req.id, { entities })));
});

handlers.set(RPC_METHODS.ENTITY_GET, async (ws, req, services) => {
  const { id } = req.params as { id?: string };
  if (!id) {
    ws.send(
      JSON.stringify(
        createRpcResponse(req.id, undefined, { code: 400, message: "id is required" }),
      ),
    );
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
    ws.send(
      JSON.stringify(
        createRpcResponse(req.id, undefined, {
          code: 400,
          message: "realmId and name are required",
        }),
      ),
    );
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
    ws.send(
      JSON.stringify(
        createRpcResponse(req.id, undefined, { code: 400, message: "id is required" }),
      ),
    );
    return;
  }
  const entity = services.entityManager.update(id, { name, type, avatar, attributes });
  ws.send(JSON.stringify(createRpcResponse(req.id, { entity })));
});

handlers.set(RPC_METHODS.ENTITY_DELETE, async (ws, req, services) => {
  const { id } = req.params as { id?: string };
  if (!id) {
    ws.send(
      JSON.stringify(
        createRpcResponse(req.id, undefined, { code: 400, message: "id is required" }),
      ),
    );
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
    ws.send(
      JSON.stringify(
        createRpcResponse(req.id, undefined, { code: 400, message: "entityId is required" }),
      ),
    );
    return;
  }
  const summoned = await services.summonEngine.summon(entityId);
  ws.send(
    JSON.stringify(
      createRpcResponse(req.id, {
        entity: { id: summoned.entity.id, name: summoned.entity.name },
        agent: { id: summoned.agent.id, name: summoned.agent.name },
      }),
    ),
  );
});

handlers.set(RPC_METHODS.SUMMON_RELEASE, async (ws, req, services) => {
  const { entityId } = req.params as { entityId?: string };
  if (!entityId) {
    ws.send(
      JSON.stringify(
        createRpcResponse(req.id, undefined, { code: 400, message: "entityId is required" }),
      ),
    );
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

// ── Knowledge Lifecycle handlers ──

handlers.set(RPC_METHODS.HEALTH_REPORT, async (ws, req, services) => {
  if (!services.memoryHealthManager) {
    ws.send(
      JSON.stringify(
        createRpcResponse(req.id, undefined, {
          code: 501,
          message: "Health manager not available",
        }),
      ),
    );
    return;
  }
  const { realmId } = req.params as { realmId?: string };
  if (realmId) {
    const report = await services.memoryHealthManager.computeHealth(realmId);
    ws.send(JSON.stringify(createRpcResponse(req.id, { report })));
  } else {
    const reports = await services.memoryHealthManager.computeAllHealth();
    ws.send(JSON.stringify(createRpcResponse(req.id, { reports })));
  }
});

handlers.set(RPC_METHODS.HEALTH_CLEAN, async (ws, req, services) => {
  if (!services.memoryHealthManager) {
    ws.send(
      JSON.stringify(
        createRpcResponse(req.id, undefined, {
          code: 501,
          message: "Health manager not available",
        }),
      ),
    );
    return;
  }
  const { realmId, options } = req.params as {
    realmId?: string;
    options?: Record<string, unknown>;
  };
  if (!realmId) {
    ws.send(
      JSON.stringify(
        createRpcResponse(req.id, undefined, { code: 400, message: "realmId is required" }),
      ),
    );
    return;
  }
  const result = await services.memoryHealthManager.cleanup(
    realmId,
    options as { deduplicate?: boolean; archiveStale?: boolean; staleDays?: number } | undefined,
  );
  ws.send(JSON.stringify(createRpcResponse(req.id, { result })));
});

handlers.set(RPC_METHODS.KNOWLEDGE_INJECT, async (ws, req, services) => {
  if (!services.knowledgeDistributor) {
    ws.send(
      JSON.stringify(
        createRpcResponse(req.id, undefined, {
          code: 501,
          message: "Knowledge distributor not available",
        }),
      ),
    );
    return;
  }
  const { text } = req.params as { text?: string };
  if (!text) {
    ws.send(
      JSON.stringify(
        createRpcResponse(req.id, undefined, { code: 400, message: "text is required" }),
      ),
    );
    return;
  }
  const result = await services.knowledgeDistributor.distributeFromText(text);
  ws.send(JSON.stringify(createRpcResponse(req.id, { result })));
});

handlers.set(RPC_METHODS.MATURITY_SCAN, async (ws, req, services) => {
  if (!services.maturityScanner) {
    ws.send(
      JSON.stringify(
        createRpcResponse(req.id, undefined, {
          code: 501,
          message: "Maturity scanner not available",
        }),
      ),
    );
    return;
  }
  const { realmId } = req.params as { realmId?: string };
  if (realmId) {
    const scores = services.maturityScanner.scanRealm(realmId);
    ws.send(JSON.stringify(createRpcResponse(req.id, { scores })));
  } else {
    const suggestions = services.maturityScanner.scanAll();
    ws.send(JSON.stringify(createRpcResponse(req.id, { suggestions })));
  }
});

handlers.set(RPC_METHODS.DIRECTORY_SCAN, async (ws, req, services) => {
  if (!services.directoryScanner) {
    ws.send(
      JSON.stringify(
        createRpcResponse(req.id, undefined, {
          code: 501,
          message: "Directory scanner not available",
        }),
      ),
    );
    return;
  }
  const { path, options } = req.params as { path?: string; options?: Record<string, unknown> };
  if (!path) {
    ws.send(
      JSON.stringify(
        createRpcResponse(req.id, undefined, { code: 400, message: "path is required" }),
      ),
    );
    return;
  }
  const result = await services.directoryScanner.scanDirectory(
    path,
    options as
      | {
          extensions?: string[];
          recursive?: boolean;
          maxFileSize?: number;
          realmId?: string;
          dryRun?: boolean;
        }
      | undefined,
  );
  ws.send(JSON.stringify(createRpcResponse(req.id, { result })));
});

// ── Family Member handlers ──

handlers.set(RPC_METHODS.FAMILY_LIST, async (ws, req, services) => {
  if (!services.familyMemberRepo) {
    ws.send(
      JSON.stringify(
        createRpcResponse(req.id, undefined, {
          code: 501,
          message: "Family member system not available",
        }),
      ),
    );
    return;
  }
  const members = services.familyMemberRepo.list();
  ws.send(JSON.stringify(createRpcResponse(req.id, { members })));
});

handlers.set(RPC_METHODS.FAMILY_ADD, async (ws, req, services) => {
  if (!services.familyMemberRepo) {
    ws.send(
      JSON.stringify(
        createRpcResponse(req.id, undefined, {
          code: 501,
          message: "Family member system not available",
        }),
      ),
    );
    return;
  }
  const { name, nickname, roles, realmIds, notifyChannels } = req.params as {
    name?: string;
    nickname?: string;
    roles?: string[];
    realmIds?: string[];
    notifyChannels?: string[];
  };
  if (!name) {
    ws.send(
      JSON.stringify(
        createRpcResponse(req.id, undefined, { code: 400, message: "name is required" }),
      ),
    );
    return;
  }
  const member = services.familyMemberRepo.create({
    name,
    nickname,
    roles: roles as import("@openoctopus/shared").FamilyRole[],
    realmIds,
    notifyChannels,
  });
  ws.send(JSON.stringify(createRpcResponse(req.id, { member })));
});

handlers.set(RPC_METHODS.FAMILY_UPDATE, async (ws, req, services) => {
  if (!services.familyMemberRepo) {
    ws.send(
      JSON.stringify(
        createRpcResponse(req.id, undefined, {
          code: 501,
          message: "Family member system not available",
        }),
      ),
    );
    return;
  }
  const { id, ...data } = req.params as { id?: string; [key: string]: unknown };
  if (!id) {
    ws.send(
      JSON.stringify(
        createRpcResponse(req.id, undefined, { code: 400, message: "id is required" }),
      ),
    );
    return;
  }
  const member = services.familyMemberRepo.update(
    id,
    data as Parameters<typeof services.familyMemberRepo.update>[1],
  );
  ws.send(JSON.stringify(createRpcResponse(req.id, { member })));
});

handlers.set(RPC_METHODS.FAMILY_DELETE, async (ws, req, services) => {
  if (!services.familyMemberRepo) {
    ws.send(
      JSON.stringify(
        createRpcResponse(req.id, undefined, {
          code: 501,
          message: "Family member system not available",
        }),
      ),
    );
    return;
  }
  const { id } = req.params as { id?: string };
  if (!id) {
    ws.send(
      JSON.stringify(
        createRpcResponse(req.id, undefined, { code: 400, message: "id is required" }),
      ),
    );
    return;
  }
  services.familyMemberRepo.delete(id);
  ws.send(JSON.stringify(createRpcResponse(req.id, { success: true })));
});

handlers.set(RPC_METHODS.FAMILY_ACTIONS, async (ws, req, services) => {
  if (!services.familyMemberRepo) {
    ws.send(
      JSON.stringify(
        createRpcResponse(req.id, undefined, {
          code: 501,
          message: "Family member system not available",
        }),
      ),
    );
    return;
  }
  const { memberId } = req.params as { memberId?: string };
  const actions = services.familyMemberRepo.listPendingActions(memberId);
  ws.send(JSON.stringify(createRpcResponse(req.id, { actions })));
});

handlers.set(RPC_METHODS.FAMILY_ACTION_DONE, async (ws, req, services) => {
  if (!services.familyMemberRepo) {
    ws.send(
      JSON.stringify(
        createRpcResponse(req.id, undefined, {
          code: 501,
          message: "Family member system not available",
        }),
      ),
    );
    return;
  }
  const { id, status } = req.params as { id?: string; status?: string };
  if (!id) {
    ws.send(
      JSON.stringify(
        createRpcResponse(req.id, undefined, { code: 400, message: "id is required" }),
      ),
    );
    return;
  }
  services.familyMemberRepo.updateActionStatus(id, (status as "done" | "dismissed") ?? "done");
  ws.send(JSON.stringify(createRpcResponse(req.id, { success: true })));
});

// ── Dispatch ──

export async function dispatchRpc(
  ws: WebSocket,
  req: RpcRequest,
  services: RpcServices,
): Promise<void> {
  const handler = handlers.get(req.method);
  if (!handler) {
    ws.send(
      JSON.stringify(
        createRpcResponse(req.id, undefined, {
          code: 404,
          message: `Unknown method: ${req.method}`,
        }),
      ),
    );
    return;
  }

  try {
    await handler(ws, req, services);
  } catch (err) {
    const errResponse = toErrorResponse(err);
    ws.send(
      JSON.stringify(
        createRpcResponse(req.id, undefined, {
          code: errResponse.status,
          message: errResponse.message,
        }),
      ),
    );
  }
}
