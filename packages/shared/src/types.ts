import { z } from "zod";

// ── Entity Types ──

export const EntityType = z.enum(["living", "asset", "organization", "abstract"]);
export type EntityType = z.infer<typeof EntityType>;

// ── Realm Status ──

export const RealmStatus = z.enum(["active", "paused", "archived"]);
export type RealmStatus = z.infer<typeof RealmStatus>;

// ── Agent Tier ──

export const AgentTier = z.enum(["central", "realm", "summoned"]);
export type AgentTier = z.infer<typeof AgentTier>;

// ── Skill Scope & Type ──

export const SkillScope = z.enum(["global", "realm"]);
export type SkillScope = z.infer<typeof SkillScope>;

export const SkillType = z.enum(["native", "mcp"]);
export type SkillType = z.infer<typeof SkillType>;

// ── Summon Status ──

export const SummonStatus = z.enum(["dormant", "summoning", "active", "suspended"]);
export type SummonStatus = z.infer<typeof SummonStatus>;

// ── Entity Relation ──

export const EntityRelationSchema = z.object({
  id: z.string(),
  sourceId: z.string(),
  targetId: z.string(),
  type: z.string(),
  label: z.string().optional(),
  bidirectional: z.boolean().default(false),
  crossRealm: z.boolean().default(false),
});
export type EntityRelation = z.infer<typeof EntityRelationSchema>;

// ── Entity ──

export const EntitySchema = z.object({
  id: z.string(),
  realmId: z.string(),
  name: z.string().min(1),
  type: EntityType,
  avatar: z.string().optional(),
  attributes: z.record(z.unknown()).default({}),
  summonStatus: SummonStatus.default("dormant"),
  soulPath: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Entity = z.infer<typeof EntitySchema>;

// ── Tool Definition ──

export const ToolDefinitionSchema = z.object({
  name: z.string(),
  description: z.string(),
  parameters: z.record(z.unknown()).optional(),
});
export type ToolDefinition = z.infer<typeof ToolDefinitionSchema>;

// ── Skill Definition ──

export const SkillDefinitionSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  description: z.string().default(""),
  scope: SkillScope,
  type: SkillType,
  tools: z.array(ToolDefinitionSchema).default([]),
  mcpServer: z
    .object({
      command: z.string(),
      args: z.array(z.string()).default([]),
      env: z.record(z.string()).optional(),
    })
    .optional(),
});
export type SkillDefinition = z.infer<typeof SkillDefinitionSchema>;

// ── Agent Config ──

export const AgentConfigSchema = z.object({
  id: z.string(),
  realmId: z.string().optional(),
  entityId: z.string().optional(),
  tier: AgentTier,
  name: z.string().min(1),
  model: z.string().default("claude-sonnet-4-6"),
  personality: z.string().optional(),
  skills: z.array(z.string()).default([]),
  proactive: z.boolean().default(false),
});
export type AgentConfig = z.infer<typeof AgentConfigSchema>;

// ── Realm Config ──

export const RealmConfigSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  description: z.string().default(""),
  icon: z.string().optional(),
  entities: z.array(z.string()).default([]),
  agents: z.array(z.string()).default([]),
  skills: z.array(z.string()).default([]),
  budget: z
    .object({
      dailyLimit: z.number().optional(),
      monthlyLimit: z.number().optional(),
      currency: z.string().default("USD"),
    })
    .optional(),
  proactiveEnabled: z.boolean().default(false),
});
export type RealmConfig = z.infer<typeof RealmConfigSchema>;

// ── Realm State ──

export const RealmStateSchema = RealmConfigSchema.extend({
  status: RealmStatus.default("active"),
  healthScore: z.number().min(0).max(100).default(100),
  riskCount: z.number().default(0),
  pendingActions: z.number().default(0),
  lastActivity: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type RealmState = z.infer<typeof RealmStateSchema>;

// ── Memory ──

export const MemoryTier = z.enum(["core", "working", "retrieved", "archival"]);
export type MemoryTier = z.infer<typeof MemoryTier>;

export const MemoryEntrySchema = z.object({
  id: z.string(),
  realmId: z.string(),
  entityId: z.string().optional(),
  tier: MemoryTier,
  content: z.string(),
  embedding: z.array(z.number()).optional(),
  metadata: z.record(z.unknown()).default({}),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type MemoryEntry = z.infer<typeof MemoryEntrySchema>;

// ── Knowledge Graph ──

export const KnowledgeNodeSchema = z.object({
  id: z.string(),
  realmId: z.string(),
  label: z.string(),
  type: z.string(),
  properties: z.record(z.unknown()).default({}),
  createdAt: z.string().datetime(),
});
export type KnowledgeNode = z.infer<typeof KnowledgeNodeSchema>;

export const KnowledgeEdgeSchema = z.object({
  id: z.string(),
  sourceId: z.string(),
  targetId: z.string(),
  type: z.string(),
  properties: z.record(z.unknown()).default({}),
  createdAt: z.string().datetime(),
});
export type KnowledgeEdge = z.infer<typeof KnowledgeEdgeSchema>;

// ── Session ──

export const SessionEntrySchema = z.object({
  id: z.string(),
  realmId: z.string().optional(),
  agentId: z.string().optional(),
  entityId: z.string().optional(),
  startedAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  messageCount: z.number().default(0),
  sessionFile: z.string().optional(),
});
export type SessionEntry = z.infer<typeof SessionEntrySchema>;

// ── Chat Messages ──

export const ChatRole = z.enum(["user", "assistant", "system", "tool"]);
export type ChatRole = z.infer<typeof ChatRole>;

export const ChatMessageSchema = z.object({
  role: ChatRole,
  content: z.string(),
  name: z.string().optional(),
  toolCallId: z.string().optional(),
  timestamp: z.string().datetime(),
});
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

// ── Audit Log ──

export const AuditEventSchema = z.object({
  id: z.string(),
  timestamp: z.string().datetime(),
  realmId: z.string().optional(),
  agentId: z.string().optional(),
  action: z.string(),
  resource: z.string(),
  resourceId: z.string().optional(),
  details: z.record(z.unknown()).default({}),
});
export type AuditEvent = z.infer<typeof AuditEventSchema>;

// ── SOUL.md Parsed File ──

export const SoulFileSchema = z.object({
  name: z.string(),
  entityId: z.string().optional(),
  realm: z.string(),
  identity: z.object({
    role: z.string().optional(),
    personality: z.string().optional(),
    background: z.string().optional(),
    speaking_style: z.string().optional(),
  }),
  catchphrases: z.array(z.string()).default([]),
  coreMemory: z.array(z.string()).default([]),
  proactiveRules: z
    .array(
      z.object({
        trigger: z.string(),
        action: z.string(),
        interval: z.string().optional(),
      }),
    )
    .default([]),
  relationships: z
    .array(
      z.object({
        entityId: z.string(),
        type: z.string(),
        description: z.string().optional(),
      }),
    )
    .default([]),
});
export type SoulFile = z.infer<typeof SoulFileSchema>;

// ── REALM.md Parsed File ──

export const RealmFileAgentSchema = z.object({
  name: z.string(),
  personality: z.string().optional(),
  proactive: z.boolean().default(false),
});
export type RealmFileAgent = z.infer<typeof RealmFileAgentSchema>;

export const RealmFileEntitySchema = z.object({
  name: z.string(),
  type: EntityType,
  attributes: z.record(z.unknown()).default({}),
  soulFile: z.string().optional(),
});
export type RealmFileEntity = z.infer<typeof RealmFileEntitySchema>;

export const RealmFileProactiveRuleSchema = z.object({
  trigger: z.string(),
  action: z.string(),
  interval: z.string().optional(),
});
export type RealmFileProactiveRule = z.infer<typeof RealmFileProactiveRuleSchema>;

export const RealmFileSchema = z.object({
  name: z.string().min(1),
  description: z.string().default(""),
  icon: z.string().optional(),
  defaultEntities: z.array(RealmFileEntitySchema).default([]),
  skills: z.array(z.string()).default([]),
  agents: z.array(RealmFileAgentSchema).default([]),
  proactiveRules: z.array(RealmFileProactiveRuleSchema).default([]),
});
export type RealmFile = z.infer<typeof RealmFileSchema>;

// ── Realm Package (RealmHub) ──

export const RealmPackageSchema = z.object({
  name: z.string().min(1),
  version: z.string(),
  author: z.string().optional(),
  description: z.string().default(""),
  realmConfig: RealmConfigSchema.omit({ id: true }),
  entities: z
    .array(EntitySchema.omit({ id: true, realmId: true, createdAt: true, updatedAt: true }))
    .default([]),
  soulFiles: z.array(SoulFileSchema.omit({ entityId: true })).default([]),
  skills: z.array(SkillDefinitionSchema.omit({ id: true })).default([]),
});
export type RealmPackage = z.infer<typeof RealmPackageSchema>;

// ── System Action (meta-commands detected from natural language) ──

export const SystemActionSchema = z.enum([
  "summon",
  "unsummon",
  "list_realms",
  "list_entities",
  "switch_realm",
]);
export type SystemAction = z.infer<typeof SystemActionSchema>;

// ── Router Intent ──

export const RouterIntentSchema = z.object({
  targetRealmId: z.string().optional(),
  targetEntityId: z.string().optional(),
  confidence: z.number().min(0).max(1),
  isMultiRealm: z.boolean().default(false),
  reasoning: z.string().optional(),
  action: SystemActionSchema.optional(),
  actionArgs: z.record(z.string()).optional(),
});
export type RouterIntent = z.infer<typeof RouterIntentSchema>;

// ── Health Report ──

export const HealthIssueKindSchema = z.enum([
  "duplicate",
  "contradiction",
  "stale",
  "incomplete_entity",
]);
export type HealthIssueKind = z.infer<typeof HealthIssueKindSchema>;

export const HealthIssueSchema = z.object({
  kind: HealthIssueKindSchema,
  memoryIds: z.array(z.string()),
  description: z.string(),
  suggestion: z.string(),
});
export type HealthIssue = z.infer<typeof HealthIssueSchema>;

export const RealmHealthReportSchema = z.object({
  realmId: z.string(),
  realmName: z.string(),
  healthScore: z.number().min(0).max(100),
  memoryCount: z.number(),
  entityCount: z.number(),
  duplicateCount: z.number(),
  staleCount: z.number(),
  contradictionCount: z.number(),
  issues: z.array(HealthIssueSchema),
  computedAt: z.string(),
});
export type RealmHealthReport = z.infer<typeof RealmHealthReportSchema>;

// ── Maturity Score ──

export const MaturityScoreSchema = z.object({
  entityId: z.string(),
  entityName: z.string(),
  realmId: z.string(),
  overall: z.number().min(0).max(100),
  attributeCompleteness: z.number().min(0).max(100),
  memoryDepth: z.number().min(0).max(100),
  interactionFrequency: z.number().min(0).max(100),
  readyToSummon: z.boolean(),
});
export type MaturityScore = z.infer<typeof MaturityScoreSchema>;

// ── Cross-Realm Reaction ──

export const CrossRealmReactionSchema = z.object({
  sourceRealmId: z.string(),
  targetRealmId: z.string(),
  targetRealmName: z.string(),
  agentName: z.string(),
  content: z.string(),
  triggeredAt: z.string(),
});
export type CrossRealmReaction = z.infer<typeof CrossRealmReactionSchema>;

// -- Embedding --

export const EmbeddingEntrySchema = z.object({
  text: z.string(),
  vector: z.array(z.number()),
  model: z.string(),
  dimensions: z.number(),
});
export type EmbeddingEntry = z.infer<typeof EmbeddingEntrySchema>;

// ── Directory Scan Result ──

export const ScanResultSchema = z.object({
  filesScanned: z.number(),
  filesSkipped: z.number(),
  factsExtracted: z.number(),
  realmsAffected: z.array(z.string()),
  errors: z.array(z.string()),
});
export type ScanResult = z.infer<typeof ScanResultSchema>;
