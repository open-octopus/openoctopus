import YAML from "yaml";
import type { RealmFile } from "@openoctopus/shared";
import { RealmFileSchema, ValidationError } from "@openoctopus/shared";

export interface RealmFileWithBody {
  realm: RealmFile;
  body: string;
}

/**
 * Parses a REALM.md file. The format is YAML front matter (between --- delimiters)
 * followed by optional markdown content used as system prompt context.
 */
export function parseRealmFile(content: string): RealmFile {
  return parseRealmFileWithBody(content).realm;
}

export function parseRealmFileWithBody(content: string): RealmFileWithBody {
  const trimmed = content.trim();

  let yamlContent: string;
  let body = "";

  if (trimmed.startsWith("---")) {
    const endIdx = trimmed.indexOf("---", 3);
    if (endIdx === -1) {
      yamlContent = trimmed.slice(3).trim();
    } else {
      yamlContent = trimmed.slice(3, endIdx).trim();
      body = trimmed.slice(endIdx + 3).trim();
    }
  } else {
    yamlContent = trimmed;
  }

  let parsed: unknown;
  try {
    parsed = YAML.parse(yamlContent);
  } catch (err) {
    throw new ValidationError(`Failed to parse REALM.md YAML: ${err instanceof Error ? err.message : String(err)}`);
  }

  const result = RealmFileSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues.map((i: { path: (string | number)[]; message: string }) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new ValidationError(`Invalid REALM.md: ${issues}`);
  }

  return { realm: result.data, body };
}
