import type { MaturityScore } from "@openoctopus/shared";
import { createLogger } from "@openoctopus/shared";
import type { MemoryRepo } from "@openoctopus/storage";
import type { EntityManager } from "./entity-manager.js";
import type { RealmManager } from "./realm-manager.js";

const log = createLogger("maturity-scanner");

const SUMMON_THRESHOLD = 60;

export interface SummonSuggestion {
  entityId: string;
  entityName: string;
  realmId: string;
  realmName: string;
  maturityScore: number;
  reason: string;
}

export interface MaturityProgress {
  entityId: string;
  entityName: string;
  realmId: string;
  realmName: string;
  score: number;
  missing: string[];
  message: string;
}

export class MaturityScanner {
  constructor(
    private memoryRepo: MemoryRepo,
    private entityManager: EntityManager,
    private realmManager: RealmManager,
  ) {}

  computeEntityMaturity(entityId: string): MaturityScore {
    const entity = this.entityManager.get(entityId);
    const realm = this.realmManager.get(entity.realmId);

    // Attribute completeness (30%): non-empty attributes / total defined attributes
    const attrs = entity.attributes;
    const attrKeys = Object.keys(attrs);
    const nonEmptyAttrs = attrKeys.filter(k => {
      const v = attrs[k];
      return v !== undefined && v !== null && v !== "";
    }).length;
    const attributeCompleteness = attrKeys.length > 0
      ? Math.round((nonEmptyAttrs / attrKeys.length) * 100)
      : 0;

    // Memory depth (40%): min(archivalCount / 10, 1) * 100
    const archivalCount = this.memoryRepo.countByEntity(entityId, "archival");
    const allMemoryCount = this.memoryRepo.countByEntity(entityId);
    const memoryDepth = Math.round(Math.min(archivalCount / 10, 1) * 100);

    // Interaction frequency (30%): based on total memory count as proxy
    // (sessions aren't easily queryable, use memory count as proxy)
    const interactionFrequency = Math.round(Math.min(allMemoryCount / 15, 1) * 100);

    // Weighted overall score
    const overall = Math.round(
      attributeCompleteness * 0.3 +
      memoryDepth * 0.4 +
      interactionFrequency * 0.3,
    );

    return {
      entityId,
      entityName: entity.name,
      realmId: entity.realmId,
      overall,
      attributeCompleteness,
      memoryDepth,
      interactionFrequency,
      readyToSummon: overall >= SUMMON_THRESHOLD && entity.summonStatus === "dormant",
    };
  }

  scanRealm(realmId: string): MaturityScore[] {
    const entities = this.entityManager.listByRealm(realmId);
    return entities.map(e => this.computeEntityMaturity(e.id));
  }

  scanAll(): SummonSuggestion[] {
    const realms = this.realmManager.list();
    const suggestions: SummonSuggestion[] = [];

    for (const realm of realms) {
      const scores = this.scanRealm(realm.id);
      for (const score of scores) {
        if (score.readyToSummon) {
          suggestions.push({
            entityId: score.entityId,
            entityName: score.entityName,
            realmId: score.realmId,
            realmName: realm.name,
            maturityScore: score.overall,
            reason: `Knowledge about ${score.entityName} is comprehensive enough to summon as a living agent`,
          });
        }
      }
    }

    return suggestions;
  }

  async checkAndNotify(
    realmId: string,
    onSuggestion: (s: SummonSuggestion) => void,
    onProgress?: (p: MaturityProgress) => void,
  ): Promise<void> {
    const realm = this.realmManager.get(realmId);
    const scores = this.scanRealm(realmId);

    for (const score of scores) {
      if (score.readyToSummon) {
        log.info(`Entity "${score.entityName}" ready to summon (score: ${score.overall})`);
        onSuggestion({
          entityId: score.entityId,
          entityName: score.entityName,
          realmId: score.realmId,
          realmName: realm.name,
          maturityScore: score.overall,
          reason: `Knowledge about ${score.entityName} is comprehensive enough to summon as a living agent`,
        });
      }

      // Progressive guidance for entities approaching summon readiness
      if (onProgress && score.overall >= 40 && score.overall < SUMMON_THRESHOLD) {
        const entity = this.entityManager.get(score.entityId);
        if (entity.summonStatus === "dormant") {
          const missing = this.identifyMissingAttributes(entity);
          onProgress({
            entityId: score.entityId,
            entityName: score.entityName,
            realmId: score.realmId,
            realmName: realm.name,
            score: score.overall,
            missing,
            message: `${score.entityName}'s knowledge is at ${score.overall}/100. A few more conversations and they can be summoned!`,
          });
        }
      }
    }
  }

  private identifyMissingAttributes(entity: { attributes: Record<string, unknown> }): string[] {
    return Object.entries(entity.attributes)
      .filter(([, v]) => v === undefined || v === null || v === "")
      .map(([k]) => k);
  }
}
