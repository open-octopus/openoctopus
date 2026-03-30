import { z } from "zod";

// ── JSON-RPC-like protocol for WebSocket gateway ──
// Aligned with OpenClaw's WS RPC pattern: request/response with streaming events

export const RpcRequestSchema = z.object({
  id: z.string(),
  method: z.string(),
  params: z.record(z.unknown()).default({}),
});
export type RpcRequest = z.infer<typeof RpcRequestSchema>;

export const RpcResponseSchema = z.object({
  id: z.string(),
  result: z.unknown().optional(),
  error: z
    .object({
      code: z.number(),
      message: z.string(),
    })
    .optional(),
});
export type RpcResponse = z.infer<typeof RpcResponseSchema>;

export const RpcEventSchema = z.object({
  event: z.string(),
  requestId: z.string().optional(),
  data: z.unknown(),
});
export type RpcEvent = z.infer<typeof RpcEventSchema>;

// ── RPC Method Names ──

export const RPC_METHODS = {
  // Chat
  CHAT_SEND: "chat.send",
  CHAT_STREAM: "chat.stream",

  // Realms
  REALM_LIST: "realm.list",
  REALM_GET: "realm.get",
  REALM_CREATE: "realm.create",
  REALM_UPDATE: "realm.update",
  REALM_DELETE: "realm.delete",

  // Entities
  ENTITY_LIST: "entity.list",
  ENTITY_GET: "entity.get",
  ENTITY_CREATE: "entity.create",
  ENTITY_UPDATE: "entity.update",
  ENTITY_DELETE: "entity.delete",

  // Summon
  SUMMON_INVOKE: "summon.invoke",
  SUMMON_RELEASE: "summon.release",
  SUMMON_LIST: "summon.list",

  // Status
  STATUS_HEALTH: "status.health",
  STATUS_INFO: "status.info",

  // Knowledge Lifecycle
  KNOWLEDGE_INJECT: "knowledge.inject",
  MATURITY_SCAN: "maturity.scan",
  DIRECTORY_SCAN: "directory.scan",
  HEALTH_REPORT: "health.report",
  HEALTH_CLEAN: "health.clean",

  // Family
  FAMILY_LIST: "family.list",
  FAMILY_ADD: "family.add",
  FAMILY_UPDATE: "family.update",
  FAMILY_DELETE: "family.delete",
  FAMILY_ACTIONS: "family.actions",
  FAMILY_ACTION_DONE: "family.action.done",
} as const;

// ── RPC Event Names ──

export const RPC_EVENTS = {
  TOKEN: "chat.token",
  DONE: "chat.done",
  PROACTIVE: "proactive",
  CHANNEL_MESSAGE: "channel.message",
  REALM_UPDATE: "realm.update",
  ERROR: "error",
  MATURITY_SUGGESTION: "maturity.suggestion",
  CROSS_REALM_REACTION: "crossrealm.reaction",
  MATURITY_PROGRESS: "maturity.progress",
  FAMILY_ACTIONS: "family.actions",
} as const;

// ── Helper to create messages ──

export function createRpcRequest(method: string, params?: Record<string, unknown>): RpcRequest {
  return {
    id: `rpc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    method,
    params: params ?? {},
  };
}

export function createRpcResponse(
  id: string,
  result?: unknown,
  error?: { code: number; message: string },
): RpcResponse {
  return { id, result, error };
}

export function createRpcEvent(event: string, data: unknown, requestId?: string): RpcEvent {
  return { event, requestId, data };
}
