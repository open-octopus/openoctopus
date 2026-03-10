export const DEFAULT_PORT = 19790;
export const DEFAULT_WS_PORT = 19789;
export const DEFAULT_HTTP_PORT = 19790;

export const DEFAULT_REALMS = [
  "home",
  "vehicle",
  "pet",
  "parents",
  "partner",
  "friends",
  "finance",
  "work",
  "legal",
  "hobby",
  "fitness",
  "health",
] as const;

export type DefaultRealm = (typeof DEFAULT_REALMS)[number];

export const COLORS = {
  DEEP_OCEAN_BLUE: "#1E3A5F",
  OCTOPUS_PURPLE: "#6C3FA0",
  SUMMON_CYAN: "#00D4AA",
  ABYSS: "#0D1117",
} as const;

export const DATA_DIR = ".openoctopus";
export const REALM_CONFIG_FILE = "REALM.md";
export const SOUL_CONFIG_FILE = "SOUL.md";
export const SESSION_DIR = "sessions";
export const VECTOR_DIR = "vectors";
export const DB_FILE = "openoctopus.db";
