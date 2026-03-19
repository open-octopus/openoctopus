import fs from "node:fs";
import path from "node:path";
import type { AgentConfig, RealmFile } from "@openoctopus/shared";
import { createLogger, REALM_CONFIG_FILE } from "@openoctopus/shared";
import type { EntityManager } from "./entity-manager.js";
import type { RealmManager } from "./realm-manager.js";
import { parseRealmFileWithBody } from "./realm-parser.js";

const log = createLogger("realm-loader");

export interface RealmAgentMeta {
  agentConfig: AgentConfig;
  systemPrompt: string;
  skills: string[];
}

export class RealmLoader {
  private realmManager: RealmManager;
  private entityManager: EntityManager;
  private cache = new Map<string, RealmAgentMeta>();

  constructor(realmManager: RealmManager, entityManager: EntityManager) {
    this.realmManager = realmManager;
    this.entityManager = entityManager;
  }

  async loadFromDirectory(realmsDir: string): Promise<number> {
    if (!fs.existsSync(realmsDir)) {
      log.warn(`Realms directory not found: ${realmsDir}`);
      return 0;
    }

    const entries = fs.readdirSync(realmsDir, { withFileTypes: true });
    let count = 0;

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      const realmMdPath = path.join(realmsDir, entry.name, REALM_CONFIG_FILE);
      if (!fs.existsSync(realmMdPath)) {
        continue;
      }

      try {
        const content = fs.readFileSync(realmMdPath, "utf-8");
        const { realm, body } = parseRealmFileWithBody(content);

        // Seed or sync realm
        let realmState = this.realmManager.findByName(realm.name);
        if (!realmState) {
          realmState = this.realmManager.create({
            name: realm.name,
            description: realm.description,
            icon: realm.icon,
          });
          log.info(`Seeded realm: ${realm.name} (${realmState.id})`);
        } else {
          // Sync fields from REALM.md (icon/description may have changed)
          realmState = this.realmManager.update(realmState.id, {
            description: realm.description,
            icon: realm.icon,
          });
        }

        // Seed default entities
        for (const entityDef of realm.defaultEntities) {
          const existing = this.entityManager.findByNameInRealm(realmState.id, entityDef.name);
          if (existing) {
            continue;
          }

          const soulPath = entityDef.soulFile
            ? path.join(realmsDir, entry.name, entityDef.soulFile)
            : undefined;

          this.entityManager.create({
            realmId: realmState.id,
            name: entityDef.name,
            type: entityDef.type,
            attributes: entityDef.attributes,
            soulPath,
          });
          log.info(`Seeded entity: ${entityDef.name} in realm ${realm.name}`);
        }

        // Cache agent metadata
        const meta = this.buildRealmAgentMeta(realmState.id, realm, body);
        this.cache.set(realmState.id, meta);
        count++;
      } catch (err) {
        log.error(
          `Failed to load realm from ${realmMdPath}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    log.info(`Loaded ${count} realm(s) from ${realmsDir}`);
    return count;
  }

  getRealmAgent(realmId: string): RealmAgentMeta | undefined {
    return this.cache.get(realmId);
  }

  private buildRealmAgentMeta(
    realmId: string,
    realm: RealmFile,
    markdownBody: string,
  ): RealmAgentMeta {
    const primaryAgent = realm.agents[0];

    const agentConfig: AgentConfig = {
      id: `agent_realm_${realmId}`,
      realmId,
      tier: "realm",
      name: primaryAgent?.name ?? `${realm.name} Agent`,
      model: "",
      personality: primaryAgent?.personality,
      skills: realm.skills,
      proactive: primaryAgent?.proactive ?? false,
    };

    const systemPrompt = this.buildSystemPrompt(realm, primaryAgent, markdownBody);

    return { agentConfig, systemPrompt, skills: realm.skills };
  }

  private buildSystemPrompt(
    realm: RealmFile,
    agent: RealmFile["agents"][number] | undefined,
    markdownBody: string,
  ): string {
    const parts: string[] = [];

    // Realm context
    parts.push(`You are an AI assistant for the "${realm.name}" realm.`);
    if (realm.description) {
      parts.push(realm.description);
    }

    // Agent personality
    if (agent?.personality) {
      parts.push(`Personality: ${agent.personality}`);
    }

    // Skills
    if (realm.skills.length > 0) {
      parts.push(`Available skills: ${realm.skills.join(", ")}`);
    }

    // Proactive rules
    if (realm.proactiveRules.length > 0) {
      const rules = realm.proactiveRules
        .map((r) => `- ${r.action} (${r.trigger}${r.interval ? `, ${r.interval}` : ""})`)
        .join("\n");
      parts.push(`Proactive behaviors:\n${rules}`);
    }

    // Markdown body from REALM.md
    if (markdownBody) {
      parts.push(markdownBody);
    }

    return parts.join("\n\n");
  }
}
