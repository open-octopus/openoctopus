import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { z } from "zod";
import { createLogger } from "./logger.js";

const log = createLogger("config");

// ── Model API Types (aligned with OpenClaw) ──

export const ModelApi = z.enum([
  "anthropic-messages",
  "openai-completions",
  "openai-responses",
  "google-genai",
  "ollama",
  "glm",
  "minimax",
  "kimi",
  "deepseek",
  "qwen",
  "stepfun",
]);
export type ModelApi = z.infer<typeof ModelApi>;

// ── Model Definition ──

export const ModelDefinitionSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  api: ModelApi.optional(),
  contextWindow: z.number().optional(),
  maxTokens: z.number().optional(),
  reasoning: z.boolean().default(false),
  vision: z.boolean().default(false),
  cost: z
    .object({
      input: z.number().optional(),
      output: z.number().optional(),
      cacheRead: z.number().optional(),
    })
    .optional(),
});
export type ModelDefinition = z.infer<typeof ModelDefinitionSchema>;

// ── LLM Provider Config ──

export const LlmProviderConfigSchema = z.object({
  api: ModelApi,
  baseUrl: z.string().optional(),
  apiKey: z.string().optional(),
  models: z.array(ModelDefinitionSchema).default([]),
  enabled: z.boolean().default(true),
  priority: z.number().default(0),
});
export type LlmProviderConfig = z.infer<typeof LlmProviderConfigSchema>;

// ── Embedding Provider Config ──

export const EmbeddingProviderConfigSchema = z.object({
  api: z.enum(["openai", "ollama"]).default("openai"),
  apiKey: z.string().optional(),
  baseUrl: z.string().optional(),
  model: z.string().optional(),
  priority: z.number().default(0),
});
export type EmbeddingProviderConfig = z.infer<typeof EmbeddingProviderConfigSchema>;

// ── Channel Config ──

export const ChannelConfigSchema = z.object({
  type: z.string(),
  enabled: z.boolean().default(false),
  token: z.string().optional(),
  webhook: z
    .object({
      url: z.string().optional(),
      port: z.number().optional(),
      secret: z.string().optional(),
    })
    .optional(),
  allowedUsers: z.array(z.string()).default([]),
  dmPolicy: z.enum(["pairing", "open", "closed"]).default("pairing"),
  groupPolicy: z.enum(["allowlist", "open"]).default("allowlist"),
  streaming: z.enum(["off", "partial", "block"]).default("partial"),
  options: z.record(z.unknown()).default({}),
});
export type ChannelConfig = z.infer<typeof ChannelConfigSchema>;

// ── Gateway Config ──

export const GatewayConfigSchema = z.object({
  wsPort: z.number().default(19789),
  httpPort: z.number().default(19790),
  host: z.string().default("127.0.0.1"),
  token: z.string().optional(),
  bind: z.enum(["loopback", "lan", "public"]).default("loopback"),
});
export type GatewayConfig = z.infer<typeof GatewayConfigSchema>;

// ── Storage Config ──

export const StorageConfigSchema = z.object({
  dataDir: z.string().default(""),
  database: z.enum(["sqlite"]).default("sqlite"),
});
export type StorageConfig = z.infer<typeof StorageConfigSchema>;

// ── Logging Config ──

export const LoggingConfigSchema = z.object({
  level: z.enum(["debug", "info", "warn", "error"]).default("info"),
});
export type LoggingConfig = z.infer<typeof LoggingConfigSchema>;

// ── Root Config ──

export const OpenOctopusConfigSchema = z.object({
  gateway: GatewayConfigSchema.default({}),
  llm: z
    .object({
      defaultProvider: z.string().default("anthropic"),
      defaultModel: z.string().default("claude-sonnet-4-6"),
      providers: z.record(z.string(), LlmProviderConfigSchema).default({}),
    })
    .default({}),
  embeddings: z
    .object({
      defaultProvider: z.string().default("openai"),
      defaultModel: z.string().default("text-embedding-3-small"),
      providers: z.record(z.string(), EmbeddingProviderConfigSchema).default({}),
    })
    .default({}),
  channels: z.record(z.string(), ChannelConfigSchema).default({}),
  storage: StorageConfigSchema.default({}),
  logging: LoggingConfigSchema.default({}),
});
export type OpenOctopusConfig = z.infer<typeof OpenOctopusConfigSchema>;

// ── Config Loading ──

const CONFIG_DIR = ".openoctopus";
const CONFIG_FILE = "config.json5";

export function resolveConfigDir(): string {
  const envDir = process.env.OPENOCTOPUS_CONFIG_DIR;
  if (envDir) {
    return envDir;
  }
  return path.join(os.homedir(), CONFIG_DIR);
}

export function resolveConfigPath(): string {
  const envPath = process.env.OPENOCTOPUS_CONFIG;
  if (envPath) {
    return envPath;
  }
  return path.join(resolveConfigDir(), CONFIG_FILE);
}

/** Interpolate $env:VAR_NAME and ${VAR_NAME} references in string values */
function interpolateEnvVars(value: string): string {
  // Handle $env:VAR_NAME syntax (OpenClaw style)
  let result = value.replaceAll(/\$env:([A-Z_][A-Z0-9_]*)/g, (_match, name: string) => {
    return process.env[name] ?? "";
  });
  // Handle ${VAR_NAME} syntax
  result = result.replaceAll(/\$\{([A-Z_][A-Z0-9_]*)\}/g, (_match, name: string) => {
    return process.env[name] ?? "";
  });
  return result;
}

/** Recursively walk an object and interpolate env vars in string values */
function resolveEnvVars(obj: unknown): unknown {
  if (typeof obj === "string") {
    return interpolateEnvVars(obj);
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => resolveEnvVars(item));
  }
  if (obj !== null && typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = resolveEnvVars(value);
    }
    return result;
  }
  return obj;
}

/** Apply environment variable overrides (OPENOCTOPUS_* pattern) */
function applyEnvOverrides(config: Record<string, unknown>): void {
  // Gateway overrides — Railway sets PORT; we also support OPENOCTOPUS_PORT
  const httpPortEnv = process.env.PORT || process.env.OPENOCTOPUS_PORT;
  if (httpPortEnv) {
    const gateway = (config.gateway ?? {}) as Record<string, unknown>;
    gateway.httpPort = Number(httpPortEnv);
    config.gateway = gateway;
  }
  if (process.env.OPENOCTOPUS_WS_PORT) {
    const gateway = (config.gateway ?? {}) as Record<string, unknown>;
    gateway.wsPort = Number(process.env.OPENOCTOPUS_WS_PORT);
    config.gateway = gateway;
  }
  if (process.env.OPENOCTOPUS_DATA_DIR) {
    const storage = (config.storage ?? {}) as Record<string, unknown>;
    storage.dataDir = process.env.OPENOCTOPUS_DATA_DIR;
    config.storage = storage;
  }
  if (process.env.OPENOCTOPUS_HOST) {
    const gateway = (config.gateway ?? {}) as Record<string, unknown>;
    gateway.host = process.env.OPENOCTOPUS_HOST;
    config.gateway = gateway;
  }
  if (process.env.OPENOCTOPUS_LOG_LEVEL) {
    const logging = (config.logging ?? {}) as Record<string, unknown>;
    logging.level = process.env.OPENOCTOPUS_LOG_LEVEL;
    config.logging = logging;
  }

  // Auto-configure providers from env API keys
  const llm = (config.llm ?? {}) as Record<string, unknown>;
  const providers = (llm.providers ?? {}) as Record<string, unknown>;

  if (process.env.ANTHROPIC_API_KEY && !providers.anthropic) {
    providers.anthropic = {
      api: "anthropic-messages",
      apiKey: process.env.ANTHROPIC_API_KEY,
    };
  }
  if (process.env.OPENAI_API_KEY && !providers.openai) {
    providers.openai = {
      api: "openai-completions",
      apiKey: process.env.OPENAI_API_KEY,
    };
  }

  // Auto-configure embedding provider from OPENAI_API_KEY
  const embeddings = (config.embeddings ?? {}) as Record<string, unknown>;
  const embeddingProviders = (embeddings.providers ?? {}) as Record<string, unknown>;
  if (process.env.OPENAI_API_KEY && !embeddingProviders.openai) {
    embeddingProviders.openai = {
      api: "openai",
      apiKey: process.env.OPENAI_API_KEY,
    };
  }
  embeddings.providers = embeddingProviders;
  config.embeddings = embeddings;

  if (process.env.GOOGLE_API_KEY && !providers.google) {
    providers.google = {
      api: "google-genai",
      apiKey: process.env.GOOGLE_API_KEY,
    };
  }

  // CN providers auto-configure from env
  const cnProviders: Array<{ env: string; name: string; api: string }> = [
    { env: "DEEPSEEK_API_KEY", name: "deepseek", api: "deepseek" },
    { env: "GLM_API_KEY", name: "glm", api: "glm" },
    { env: "MOONSHOT_API_KEY", name: "kimi", api: "kimi" },
    { env: "DASHSCOPE_API_KEY", name: "qwen", api: "qwen" },
    { env: "MINIMAX_API_KEY", name: "minimax", api: "minimax" },
    { env: "STEPFUN_API_KEY", name: "stepfun", api: "stepfun" },
  ];
  for (const p of cnProviders) {
    if (process.env[p.env] && !providers[p.name]) {
      providers[p.name] = { api: p.api, apiKey: process.env[p.env] };
    }
  }

  llm.providers = providers;
  config.llm = llm;
}

let cachedConfig: OpenOctopusConfig | undefined;

export function loadConfig(configPath?: string): OpenOctopusConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const filePath = configPath ?? resolveConfigPath();
  let raw: Record<string, unknown> = {};

  if (fs.existsSync(filePath)) {
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      // JSON5 is a superset of JSON — for basic use, JSON.parse works on strict JSON.
      // For full JSON5 (comments, trailing commas), we strip comments first.
      const stripped = stripJsonComments(content);
      raw = JSON.parse(stripped) as Record<string, unknown>;
      log.info(`Loaded config from ${filePath}`);
    } catch (err) {
      log.warn(
        `Failed to parse config at ${filePath}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  } else {
    log.debug(`No config file at ${filePath}, using defaults`);
  }

  // Pipeline: env interpolation → env overrides → validation
  raw = resolveEnvVars(raw) as Record<string, unknown>;
  applyEnvOverrides(raw);

  const result = OpenOctopusConfigSchema.safeParse(raw);
  if (!result.success) {
    log.error(`Config validation failed: ${result.error.message}`);
    // Return defaults on validation failure
    cachedConfig = OpenOctopusConfigSchema.parse({});
    return cachedConfig;
  }

  cachedConfig = result.data;
  return cachedConfig;
}

/** Reset cached config (for testing) */
export function resetConfig(): void {
  cachedConfig = undefined;
}

/** Write a default config file */
export function writeDefaultConfig(configPath?: string): string {
  const filePath = configPath ?? resolveConfigPath();
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });

  const defaultConfig = `{
  // OpenOctopus Configuration
  // See: https://github.com/openoctopus/openoctopus

  "gateway": {
    "wsPort": 19789,
    "httpPort": 19790,
    "host": "127.0.0.1",
    "bind": "loopback"
  },

  "llm": {
    "defaultProvider": "anthropic",
    "defaultModel": "claude-sonnet-4-6",
    "providers": {
      // Uncomment and add your API key:
      // "anthropic": {
      //   "api": "anthropic-messages",
      //   "apiKey": "$env:ANTHROPIC_API_KEY"
      // },
      // "openai": {
      //   "api": "openai-completions",
      //   "apiKey": "$env:OPENAI_API_KEY"
      // },
      // "ollama": {
      //   "api": "ollama",
      //   "baseUrl": "http://localhost:11434"
      // }
    }
  },

  "channels": {
    // "telegram": {
    //   "type": "telegram",
    //   "enabled": true,
    //   "token": "$env:TELEGRAM_BOT_TOKEN"
    // },
    // "discord": {
    //   "type": "discord",
    //   "enabled": true,
    //   "token": "$env:DISCORD_BOT_TOKEN"
    // }
  },

  "storage": {
    "dataDir": "",
    "database": "sqlite"
  },

  "logging": {
    "level": "info"
  }
}
`;

  fs.writeFileSync(filePath, defaultConfig, "utf-8");
  log.info(`Created default config at ${filePath}`);
  return filePath;
}

/** Strip single-line (//) and block comments from JSON5-ish content */
function stripJsonComments(content: string): string {
  let result = "";
  let i = 0;
  let inString = false;
  let stringChar = "";

  while (i < content.length) {
    if (inString) {
      if (content[i] === "\\" && i + 1 < content.length) {
        result += content[i] + content[i + 1];
        i += 2;
        continue;
      }
      if (content[i] === stringChar) {
        inString = false;
      }
      result += content[i];
      i++;
      continue;
    }

    if (content[i] === '"' || content[i] === "'") {
      inString = true;
      stringChar = content[i];
      result += content[i];
      i++;
      continue;
    }

    // Single-line comment
    if (content[i] === "/" && i + 1 < content.length && content[i + 1] === "/") {
      while (i < content.length && content[i] !== "\n") {
        i++;
      }
      continue;
    }

    // Block comment
    if (content[i] === "/" && i + 1 < content.length && content[i + 1] === "*") {
      i += 2;
      while (
        i < content.length &&
        !(content[i] === "*" && i + 1 < content.length && content[i + 1] === "/")
      ) {
        i++;
      }
      i += 2;
      continue;
    }

    result += content[i];
    i++;
  }

  return result;
}
