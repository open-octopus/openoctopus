import { describe, expect, it } from "vitest";
import { LlmProviderRegistry } from "./provider-registry.js";
import { StubProvider } from "./providers/stub.js";
import type { LlmProvider, LlmChatRequest, LlmChatResponse, LlmStreamChunk } from "./provider.js";

class FakeProvider implements LlmProvider {
  readonly name: string;
  readonly api: string;
  constructor(name: string, api = "test") {
    this.name = name;
    this.api = api;
  }
  async chat(_req: LlmChatRequest): Promise<LlmChatResponse> {
    return { content: "fake", usage: { inputTokens: 0, outputTokens: 0 }, model: "fake", finishReason: "stop" };
  }
  async *chatStream(_req: LlmChatRequest): AsyncIterable<LlmStreamChunk> {
    yield { type: "done" };
  }
}

describe("LlmProviderRegistry", () => {
  describe("constructor", () => {
    it("has stub fallback with no config", () => {
      const reg = new LlmProviderRegistry();
      expect(reg.listProviders()).toContain("stub");
    });

    it("loads providers from config with priority", () => {
      const reg = new LlmProviderRegistry({
        defaultProvider: "ollama",
        defaultModel: "llama3.2",
        providers: {
          local: { api: "ollama", enabled: true, priority: 10, models: [], baseUrl: "http://localhost:11434" },
          backup: { api: "ollama", enabled: true, priority: 5, models: [], baseUrl: "http://localhost:11435" },
        },
      });
      const providers = reg.listProviders();
      expect(providers).toContain("local");
      expect(providers).toContain("backup");
    });

    it("skips disabled providers", () => {
      const reg = new LlmProviderRegistry({
        defaultProvider: "anthropic",
        defaultModel: "claude-sonnet-4-6",
        providers: {
          disabled: { api: "ollama", enabled: false, priority: 0, models: [] },
        },
      });
      expect(reg.listProviders()).not.toContain("disabled");
    });

    it("skips providers with missing apiKey", () => {
      const reg = new LlmProviderRegistry({
        defaultProvider: "anthropic",
        defaultModel: "claude-sonnet-4-6",
        providers: {
          nokey: { api: "anthropic-messages", enabled: true, priority: 0, models: [] },
        },
      });
      expect(reg.listProviders()).not.toContain("nokey");
    });
  });

  describe("getProvider", () => {
    it("returns stub when no real providers configured", () => {
      const reg = new LlmProviderRegistry();
      const provider = reg.getProvider();
      expect(provider.name).toBe("stub");
    });

    it("returns exact match by name", () => {
      const reg = new LlmProviderRegistry();
      const fake = new FakeProvider("custom");
      reg.register("custom", fake);
      expect(reg.getProvider("custom")).toBe(fake);
    });

    it("falls back to first configured provider", () => {
      const reg = new LlmProviderRegistry();
      const fake = new FakeProvider("primary");
      reg.register("primary", fake);
      // Ask for non-existent provider → should get first configured
      expect(reg.getProvider("nonexistent").name).toBe("primary");
    });

    it("falls back to stub when all else fails", () => {
      const reg = new LlmProviderRegistry();
      expect(reg.getProvider("nonexistent").name).toBe("stub");
    });
  });

  describe("resolveModel", () => {
    it("override wins", () => {
      const reg = new LlmProviderRegistry();
      expect(reg.resolveModel("anthropic", "custom-model")).toBe("custom-model");
    });

    it("returns default for known provider", () => {
      const reg = new LlmProviderRegistry();
      expect(reg.resolveModel("anthropic")).toBe("claude-sonnet-4-6");
      expect(reg.resolveModel("openai")).toBe("gpt-4.1");
    });

    it("returns configured default for unknown provider", () => {
      const reg = new LlmProviderRegistry({
        defaultProvider: "anthropic",
        defaultModel: "my-default",
        providers: {},
      });
      expect(reg.resolveModel("unknown-provider")).toBe("my-default");
    });
  });

  describe("register", () => {
    it("adds provider manually", () => {
      const reg = new LlmProviderRegistry();
      const fake = new FakeProvider("manual");
      reg.register("manual", fake);
      expect(reg.getProvider("manual")).toBe(fake);
    });

    it("does not add stub to providerOrder", () => {
      const reg = new LlmProviderRegistry();
      reg.register("stub", new StubProvider());
      expect(reg.hasRealProvider()).toBe(false);
    });
  });

  describe("hasRealProvider", () => {
    it("returns false with stub only", () => {
      const reg = new LlmProviderRegistry();
      expect(reg.hasRealProvider()).toBe(false);
    });

    it("returns true after registering a real provider", () => {
      const reg = new LlmProviderRegistry();
      reg.register("real", new FakeProvider("real"));
      expect(reg.hasRealProvider()).toBe(true);
    });
  });

  describe("listProviders", () => {
    it("lists all including stub", () => {
      const reg = new LlmProviderRegistry();
      reg.register("a", new FakeProvider("a"));
      const list = reg.listProviders();
      expect(list).toContain("stub");
      expect(list).toContain("a");
    });
  });
});
