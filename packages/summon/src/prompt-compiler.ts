import type { SoulFile, MemoryEntry, AgentConfig } from "@openoctopus/shared";

export interface PromptContext {
  soul: SoulFile;
  agent: AgentConfig;
  coreMemories: MemoryEntry[];
  workingMemories: MemoryEntry[];
  retrievedMemories: MemoryEntry[];
}

/**
 * Compiles a system prompt for a summoned agent using Letta-inspired tiered memory.
 *
 * Tiers:
 * 1. Core Memory — fixed identity facts (from SOUL.md coreMemory + entity attributes)
 * 2. Working Memory — recent context, current state
 * 3. Retrieved Memory — vector-search results relevant to current query
 * 4. Archival Memory — long-term storage (not included in prompt, queried on demand)
 */
export function compileSystemPrompt(ctx: PromptContext): string {
  const { soul, agent, coreMemories, workingMemories, retrievedMemories } = ctx;
  const sections: string[] = [];

  // Identity section
  sections.push(`# Identity: ${soul.name}`);
  if (soul.identity.role) {
    sections.push(`Role: ${soul.identity.role}`);
  }
  if (soul.identity.personality) {
    sections.push(`Personality: ${soul.identity.personality}`);
  }
  if (soul.identity.background) {
    sections.push(`Background: ${soul.identity.background}`);
  }
  if (soul.identity.speaking_style) {
    sections.push(`Speaking style: ${soul.identity.speaking_style}`);
  }

  // Catchphrases
  if (soul.catchphrases.length > 0) {
    sections.push(`\nCatchphrases: ${soul.catchphrases.map((c: string) => `"${c}"`).join(", ")}`);
  }

  // Core Memory tier
  const coreItems = [...soul.coreMemory, ...coreMemories.map((m) => m.content)];
  if (coreItems.length > 0) {
    sections.push(`\n## Core Memory\n${coreItems.map((m) => `- ${m}`).join("\n")}`);
  }

  // Working Memory tier
  if (workingMemories.length > 0) {
    sections.push(
      `\n## Working Memory (Recent Context)\n${workingMemories.map((m) => `- ${m.content}`).join("\n")}`,
    );
  }

  // Retrieved Memory tier
  if (retrievedMemories.length > 0) {
    sections.push(
      `\n## Retrieved Memory (Relevant)\n${retrievedMemories.map((m) => `- ${m.content}`).join("\n")}`,
    );
  }

  // Relationships
  if (soul.relationships.length > 0) {
    sections.push(
      `\n## Relationships\n${soul.relationships.map((r: { type: string; description?: string; entityId?: string }) => `- ${r.type}: ${r.description ?? r.entityId ?? "unknown"}`).join("\n")}`,
    );
  }

  // Proactive rules
  if (soul.proactiveRules.length > 0) {
    sections.push(
      `\n## Proactive Rules\n${soul.proactiveRules.map((r: { trigger: string; action: string; interval?: string }) => `- When ${r.trigger}: ${r.action}${r.interval ? ` (every ${r.interval})` : ""}`).join("\n")}`,
    );
  }

  // Instructions
  sections.push(
    `\n## Instructions\nYou are ${soul.name}, a summoned entity in the "${soul.realm}" realm. ` +
      `Stay in character. Use your personality and speaking style consistently. ` +
      `Reference your core memories naturally. Your tier is "${agent.tier}".`,
  );

  return sections.join("\n");
}
