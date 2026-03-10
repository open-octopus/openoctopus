import crypto from "node:crypto";

export type IdPrefix =
  | "realm"
  | "entity"
  | "agent"
  | "skill"
  | "session"
  | "memory"
  | "knode"
  | "kedge"
  | "pkg"
  | "audit";

export function generateId(prefix: IdPrefix): string {
  const uuid = crypto.randomUUID();
  return `${prefix}_${uuid}`;
}

export function extractPrefix(id: string): IdPrefix | null {
  const idx = id.indexOf("_");
  if (idx === -1) { return null; }
  return id.slice(0, idx) as IdPrefix;
}

export function isValidId(id: string, prefix?: IdPrefix): boolean {
  const extracted = extractPrefix(id);
  if (!extracted) { return false; }
  if (prefix && extracted !== prefix) { return false; }
  const uuid = id.slice(id.indexOf("_") + 1);
  return /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/.test(uuid);
}
