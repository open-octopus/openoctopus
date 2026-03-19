import type { SoulFile } from "@openoctopus/shared";
import { SoulFileSchema, ValidationError } from "@openoctopus/shared";
import YAML from "yaml";

/**
 * Parses a SOUL.md file. The format is YAML front matter (between --- delimiters)
 * followed by optional markdown content for extended identity description.
 *
 * Example SOUL.md:
 * ```
 * ---
 * name: Luna
 * entityId: entity_abc
 * realm: pet
 * identity:
 *   role: family cat
 *   personality: curious and playful ragdoll
 *   background: Adopted from a shelter in 2023
 *   speaking_style: short, curious sentences with cat mannerisms
 * catchphrases:
 *   - "meow~ what's that?"
 *   - "*purrs contentedly*"
 * coreMemory:
 *   - Adopted by the family on March 15, 2023
 *   - Favorite spot is the window sill
 * proactiveRules:
 *   - trigger: schedule
 *     action: Remind about vet appointment
 *     interval: monthly
 * relationships:
 *   - entityId: entity_owner
 *     type: owner
 *     description: My beloved human
 * ---
 * ```
 */
export function parseSoulFile(content: string): SoulFile {
  const trimmed = content.trim();

  let yamlContent: string;
  if (trimmed.startsWith("---")) {
    const endIdx = trimmed.indexOf("---", 3);
    if (endIdx === -1) {
      yamlContent = trimmed.slice(3).trim();
    } else {
      yamlContent = trimmed.slice(3, endIdx).trim();
    }
  } else {
    yamlContent = trimmed;
  }

  let parsed: unknown;
  try {
    parsed = YAML.parse(yamlContent);
  } catch (err) {
    throw new ValidationError(
      `Failed to parse SOUL.md YAML: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const result = SoulFileSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .map(
        (i: { path: (string | number)[]; message: string }) => `${i.path.join(".")}: ${i.message}`,
      )
      .join("; ");
    throw new ValidationError(`Invalid SOUL.md: ${issues}`);
  }

  return result.data;
}

export function serializeSoulFile(soul: SoulFile): string {
  const doc = YAML.stringify(soul, { lineWidth: 0 });
  return `---\n${doc}---\n`;
}
