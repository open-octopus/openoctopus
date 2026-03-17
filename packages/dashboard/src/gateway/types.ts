// Re-export shared RPC types for browser usage
// Note: we can't import @openoctopus/shared directly in browser
// (it targets NodeNext), so we re-declare the protocol types here.

export interface RpcRequest {
  id: string;
  method: string;
  params: Record<string, unknown>;
}

export interface RpcResponse {
  id: string;
  result?: unknown;
  error?: { code: number; message: string };
}

export interface RpcEvent {
  event: string;
  requestId?: string;
  data: unknown;
}

// Mirror RPC_METHODS from @openoctopus/shared/rpc-protocol
export const RPC_METHODS = {
  CHAT_SEND: "chat.send",
  REALM_LIST: "realm.list",
  REALM_GET: "realm.get",
  REALM_CREATE: "realm.create",
  REALM_UPDATE: "realm.update",
  REALM_DELETE: "realm.delete",
  ENTITY_LIST: "entity.list",
  ENTITY_GET: "entity.get",
  ENTITY_CREATE: "entity.create",
  ENTITY_UPDATE: "entity.update",
  ENTITY_DELETE: "entity.delete",
  SUMMON_INVOKE: "summon.invoke",
  SUMMON_RELEASE: "summon.release",
  SUMMON_LIST: "summon.list",
  STATUS_HEALTH: "status.health",
  STATUS_INFO: "status.info",
  HEALTH_REPORT: "health.report",
} as const;

export const RPC_EVENTS = {
  TOKEN: "chat.token",
  DONE: "chat.done",
  PROACTIVE: "proactive",
  CHANNEL_MESSAGE: "channel.message",
  REALM_UPDATE: "realm.update",
  CROSS_REALM_REACTION: "crossrealm.reaction",
  HEALTH_ALERT: "health.alert",
  MATURITY_SUGGESTION: "maturity.suggestion",
} as const;
