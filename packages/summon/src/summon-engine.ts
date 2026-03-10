import fs from "node:fs";
import type Database from "better-sqlite3";
import type { Entity, AgentConfig, SoulFile } from "@openoctopus/shared";
import { createLogger, ValidationError } from "@openoctopus/shared";
import { EntityRepo, AgentRepo, MemoryRepo } from "@openoctopus/storage";
import { parseSoulFile } from "./soul-parser.js";
import { compileSystemPrompt } from "./prompt-compiler.js";

const log = createLogger("summon");

export interface SummonedAgent {
  entity: Entity;
  agent: AgentConfig;
  soul: SoulFile;
  systemPrompt: string;
}

export class SummonEngine {
  private entityRepo: EntityRepo;
  private agentRepo: AgentRepo;
  private memoryRepo: MemoryRepo;
  private active = new Map<string, SummonedAgent>();

  constructor(db: Database.Database) {
    this.entityRepo = new EntityRepo(db);
    this.agentRepo = new AgentRepo(db);
    this.memoryRepo = new MemoryRepo(db);
  }

  async summon(entityId: string): Promise<SummonedAgent> {
    const entity = this.entityRepo.getById(entityId);

    if (entity.summonStatus === "active") {
      const existing = this.active.get(entityId);
      if (existing) { return existing; }
    }

    if (!entity.soulPath) {
      throw new ValidationError(`Entity "${entity.name}" has no SOUL.md path configured`);
    }

    // Update status to summoning
    this.entityRepo.updateSummonStatus(entityId, "summoning");

    try {
      // Parse SOUL.md
      const soulContent = fs.readFileSync(entity.soulPath, "utf-8");
      const soul = parseSoulFile(soulContent);

      // Create or retrieve agent
      let agent = this.agentRepo.findByEntityId(entityId);
      if (!agent) {
        agent = this.agentRepo.create({
          realmId: entity.realmId,
          entityId,
          tier: "summoned",
          name: soul.name,
          personality: soul.identity.personality,
          proactive: soul.proactiveRules.length > 0,
        });
      }

      // Compile system prompt with memory tiers
      const coreMemories = this.memoryRepo.listByEntity(entityId, "core");
      const workingMemories = this.memoryRepo.listByEntity(entityId, "working");
      const retrievedMemories = this.memoryRepo.listByEntity(entityId, "retrieved");

      const systemPrompt = compileSystemPrompt({
        soul,
        agent,
        coreMemories,
        workingMemories,
        retrievedMemories,
      });

      // Activate
      this.entityRepo.updateSummonStatus(entityId, "active");
      const summoned: SummonedAgent = { entity: this.entityRepo.getById(entityId), agent, soul, systemPrompt };
      this.active.set(entityId, summoned);

      log.info(`Summoned entity: ${soul.name} (${entityId})`);
      return summoned;
    } catch (err) {
      this.entityRepo.updateSummonStatus(entityId, "dormant");
      throw err;
    }
  }

  unsummon(entityId: string): void {
    const summoned = this.active.get(entityId);
    if (!summoned) {
      log.warn(`Entity ${entityId} is not summoned`);
      return;
    }

    this.entityRepo.updateSummonStatus(entityId, "dormant");
    this.active.delete(entityId);
    log.info(`Unsummoned entity: ${summoned.soul.name} (${entityId})`);
  }

  getSummoned(entityId: string): SummonedAgent | undefined {
    return this.active.get(entityId);
  }

  listActive(): SummonedAgent[] {
    return [...this.active.values()];
  }
}
