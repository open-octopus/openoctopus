import { createLogger, type OpenOctopusConfig, type LlmProviderConfig } from "@openoctopus/shared";
import type { LlmProvider } from "./provider.js";
import { StubProvider } from "./providers/stub.js";
import { AnthropicProvider } from "./providers/anthropic.js";
import { OpenAIProvider } from "./providers/openai.js";
import { OllamaProvider } from "./providers/ollama.js";

const log = createLogger("llm:registry");

// ── Default model mappings per provider ──

const DEFAULT_MODELS: Record<string, string> = {
  anthropic: "claude-sonnet-4-6",
  openai: "gpt-4.1",
  google: "gemini-2.5-flash",
  ollama: "llama3.2",
  glm: "glm-5",
  minimax: "MiniMax-M2.5",
  kimi: "kimi-k2.5",
  deepseek: "deepseek-chat",
  qwen: "qwen3-max",
  stepfun: "step-3.5-flash",
};

// ── Default base URLs for OpenAI-compatible CN providers ──

const OPENAI_COMPAT_BASE_URLS: Record<string, string> = {
  glm: "https://open.bigmodel.cn/api/paas/v4",
  minimax: "https://api.minimax.chat/v1",
  kimi: "https://api.moonshot.cn/v1",
  deepseek: "https://api.deepseek.com",
  qwen: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  stepfun: "https://api.stepfun.com/v1",
  "google-genai": "https://generativelanguage.googleapis.com/v1beta/openai",
};

/**
 * Provider registry with failover support.
 * Aligned with OpenClaw's auth-profiles pattern: primary → fallback chain.
 */
export class LlmProviderRegistry {
  private providers = new Map<string, LlmProvider>();
  private providerOrder: string[] = [];
  private defaultProvider: string;
  private defaultModel: string;

  constructor(config?: OpenOctopusConfig["llm"]) {
    this.defaultProvider = config?.defaultProvider ?? "stub";
    this.defaultModel = config?.defaultModel ?? "claude-sonnet-4-6";

    if (config?.providers) {
      this.loadFromConfig(config.providers);
    }

    // Always register stub as ultimate fallback
    if (!this.providers.has("stub")) {
      this.providers.set("stub", new StubProvider());
    }
  }

  private loadFromConfig(providers: Record<string, LlmProviderConfig>): void {
    // Sort by priority (higher = preferred)
    const sorted = Object.entries(providers)
      .filter(([, cfg]) => cfg.enabled)
      .toSorted(([, a], [, b]) => (b.priority ?? 0) - (a.priority ?? 0));

    for (const [name, cfg] of sorted) {
      const provider = this.createProvider(name, cfg);
      if (provider) {
        this.providers.set(name, provider);
        this.providerOrder.push(name);
        log.info(`Registered LLM provider: ${name} (${cfg.api})`);
      }
    }
  }

  private createProvider(name: string, config: LlmProviderConfig): LlmProvider | undefined {
    switch (config.api) {
      case "anthropic-messages":
        if (!config.apiKey) {
          log.warn(`Anthropic provider "${name}" has no API key, skipping`);
          return undefined;
        }
        return new AnthropicProvider(config.apiKey, config.baseUrl);

      case "ollama":
        return new OllamaProvider(config.baseUrl);

      // All OpenAI-compatible providers (OpenAI, Google, GLM, MiniMax, Kimi, DeepSeek, Qwen, StepFun)
      case "openai-completions":
      case "openai-responses":
      case "google-genai":
      case "glm":
      case "minimax":
      case "kimi":
      case "deepseek":
      case "qwen":
      case "stepfun": {
        if (!config.apiKey) {
          log.warn(`Provider "${name}" (${config.api}) has no API key, skipping`);
          return undefined;
        }
        const baseUrl = config.baseUrl ?? OPENAI_COMPAT_BASE_URLS[config.api];
        return new OpenAIProvider(config.apiKey, baseUrl);
      }

      default:
        log.warn(`Unknown LLM API type: ${config.api}`);
        return undefined;
    }
  }

  /** Get the preferred provider. Falls back to stub if none configured. */
  getProvider(name?: string): LlmProvider {
    const providerName = name ?? this.defaultProvider;

    // Try exact match
    const provider = this.providers.get(providerName);
    if (provider) { return provider; }

    // Try first configured provider
    if (this.providerOrder.length > 0) {
      const first = this.providers.get(this.providerOrder[0]);
      if (first) { return first; }
    }

    // Fallback to stub
    return this.providers.get("stub")!;
  }

  /** Get provider with failover: try primary, fall back to next available */
  async getProviderWithFailover(primaryName?: string): Promise<LlmProvider> {
    const primary = this.getProvider(primaryName);

    // If primary is stub or there are no alternatives, just return it
    if (primary.name === "stub" || this.providerOrder.length <= 1) {
      return primary;
    }

    return primary;
  }

  /** Resolve the model ID for a given provider */
  resolveModel(providerName?: string, modelOverride?: string): string {
    if (modelOverride) { return modelOverride; }
    const name = providerName ?? this.defaultProvider;
    return DEFAULT_MODELS[name] ?? this.defaultModel;
  }

  /** Check if any real (non-stub) provider is configured */
  hasRealProvider(): boolean {
    return this.providerOrder.length > 0;
  }

  /** List all registered providers */
  listProviders(): string[] {
    return [...this.providers.keys()];
  }

  /** Register a provider manually (for testing or plugins) */
  register(name: string, provider: LlmProvider): void {
    this.providers.set(name, provider);
    if (!this.providerOrder.includes(name) && name !== "stub") {
      this.providerOrder.push(name);
    }
  }
}
