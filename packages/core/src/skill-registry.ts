import type { SkillDefinition } from "@openoctopus/shared";
import { createLogger, SkillNotFoundError } from "@openoctopus/shared";

const log = createLogger("skill-registry");

export class SkillRegistry {
  private skills = new Map<string, SkillDefinition>();

  register(skill: SkillDefinition): void {
    this.skills.set(skill.id, skill);
    log.info(`Registered skill: ${skill.name} (${skill.id}) [${skill.scope}/${skill.type}]`);
  }

  unregister(id: string): void {
    const skill = this.skills.get(id);
    if (skill) {
      this.skills.delete(id);
      log.info(`Unregistered skill: ${skill.name} (${id})`);
    }
  }

  get(id: string): SkillDefinition {
    const skill = this.skills.get(id);
    if (!skill) { throw new SkillNotFoundError(id); }
    return skill;
  }

  findByName(name: string): SkillDefinition | undefined {
    for (const skill of this.skills.values()) {
      if (skill.name === name) { return skill; }
    }
    return undefined;
  }

  listGlobal(): SkillDefinition[] {
    return [...this.skills.values()].filter((s) => s.scope === "global");
  }

  listByScope(scope: "global" | "realm"): SkillDefinition[] {
    return [...this.skills.values()].filter((s) => s.scope === scope);
  }

  listAll(): SkillDefinition[] {
    return [...this.skills.values()];
  }

  getAvailableForRealm(realmSkillIds: string[]): SkillDefinition[] {
    const global = this.listGlobal();
    const realmSkills = realmSkillIds
      .map((id) => this.skills.get(id))
      .filter((s): s is SkillDefinition => s !== undefined);
    return [...global, ...realmSkills];
  }
}
