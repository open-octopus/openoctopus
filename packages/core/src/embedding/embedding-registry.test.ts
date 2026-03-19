import { describe, expect, it } from "vitest";
import { StubEmbeddingProvider } from "./embedding-provider.js";
import { EmbeddingProviderRegistry } from "./embedding-registry.js";

describe("EmbeddingProviderRegistry", () => {
  it("creates with no config and has stub fallback", () => {
    const registry = new EmbeddingProviderRegistry();
    expect(registry.getProvider().name).toBe("stub");
    expect(registry.hasProvider()).toBe(false);
  });

  it("registers and retrieves a provider", () => {
    const registry = new EmbeddingProviderRegistry();
    const stub = new StubEmbeddingProvider(64);
    registry.register("test", stub);
    expect(registry.getProvider("test")).toBe(stub);
    expect(registry.hasProvider()).toBe(true);
  });

  it("getProvider falls back to first registered when default not found", () => {
    const registry = new EmbeddingProviderRegistry();
    const stub = new StubEmbeddingProvider(32);
    registry.register("custom", stub);
    expect(registry.getProvider("nonexistent")).toBe(stub);
  });

  it("lists all provider names", () => {
    const registry = new EmbeddingProviderRegistry();
    registry.register("a", new StubEmbeddingProvider(4));
    registry.register("b", new StubEmbeddingProvider(4));
    const names = registry.listProviders();
    expect(names).toContain("a");
    expect(names).toContain("b");
    expect(names).toContain("stub");
  });

  it("creates from config with OpenAI provider", () => {
    const registry = new EmbeddingProviderRegistry({
      defaultProvider: "openai",
      defaultModel: "text-embedding-3-small",
      providers: {
        openai: { api: "openai", apiKey: "sk-test", priority: 0 },
      },
    });
    expect(registry.hasProvider()).toBe(true);
    expect(registry.getProvider().name).toBe("openai");
  });

  it("skips provider without apiKey", () => {
    const registry = new EmbeddingProviderRegistry({
      defaultProvider: "openai",
      defaultModel: "text-embedding-3-small",
      providers: {
        openai: { api: "openai", priority: 0 },
      },
    });
    expect(registry.hasProvider()).toBe(false);
  });
});
