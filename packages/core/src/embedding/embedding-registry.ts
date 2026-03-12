import { createLogger } from "@openoctopus/shared";
import type { EmbeddingProvider } from "./embedding-provider.js";
import { OpenAIEmbeddingProvider, OllamaEmbeddingProvider, StubEmbeddingProvider } from "./embedding-provider.js";

const log = createLogger("embedding:registry");

interface EmbeddingProviderConfig {
  api: string;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  priority?: number;
}

interface EmbeddingConfig {
  defaultProvider?: string;
  defaultModel?: string;
  providers?: Record<string, EmbeddingProviderConfig>;
}

/**
 * Registry for embedding providers with multi-provider support.
 * Mirrors the LlmProviderRegistry pattern: constructor takes config,
 * sorts by priority, getProvider() with stub fallback.
 */
export class EmbeddingProviderRegistry {
  private providers = new Map<string, EmbeddingProvider>();
  private providerOrder: string[] = [];
  private defaultProvider: string;

  constructor(config?: EmbeddingConfig) {
    this.defaultProvider = config?.defaultProvider ?? "stub";

    if (config?.providers) {
      const sorted = Object.entries(config.providers)
        .toSorted(([, a], [, b]) => (b.priority ?? 0) - (a.priority ?? 0));

      for (const [name, cfg] of sorted) {
        const provider = this.createProvider(name, cfg);
        if (provider) {
          this.providers.set(name, provider);
          this.providerOrder.push(name);
          log.info(`Registered embedding provider: ${name} (${cfg.api})`);
        }
      }
    }

    // Always register stub as ultimate fallback
    if (!this.providers.has("stub")) {
      this.providers.set("stub", new StubEmbeddingProvider());
    }
  }

  private createProvider(name: string, config: EmbeddingProviderConfig): EmbeddingProvider | undefined {
    switch (config.api) {
      case "openai":
        if (!config.apiKey) {
          log.warn(`OpenAI embedding provider "${name}" has no API key, skipping`);
          return undefined;
        }
        return new OpenAIEmbeddingProvider({
          apiKey: config.apiKey,
          baseUrl: config.baseUrl,
          model: config.model,
        });
      case "ollama":
        return new OllamaEmbeddingProvider({
          baseUrl: config.baseUrl,
          model: config.model,
        });
      default:
        log.warn(`Unknown embedding API type: ${config.api}`);
        return undefined;
    }
  }

  /** Get a provider by name. Falls back to first registered, then stub. */
  getProvider(name?: string): EmbeddingProvider {
    const providerName = name ?? this.defaultProvider;

    // Try exact match
    const provider = this.providers.get(providerName);
    if (provider) return provider;

    // Try first configured provider
    if (this.providerOrder.length > 0) {
      return this.providers.get(this.providerOrder[0])!;
    }

    // Fallback to stub
    return this.providers.get("stub")!;
  }

  /** Check if any real (non-stub) provider is configured */
  hasProvider(): boolean {
    return this.providerOrder.length > 0;
  }

  /** List all registered provider names */
  listProviders(): string[] {
    return [...this.providers.keys()];
  }

  /** Register a provider manually (for testing or plugins) */
  register(name: string, provider: EmbeddingProvider): void {
    this.providers.set(name, provider);
    if (!this.providerOrder.includes(name) && name !== "stub") {
      this.providerOrder.push(name);
    }
  }
}
