import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { loadConfig, resetConfig, writeDefaultConfig } from "./config.js";

describe("config", () => {
  let tmpDir: string;

  beforeEach(() => {
    resetConfig();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "oo-config-test-"));
  });

  afterEach(() => {
    resetConfig();
    fs.rmSync(tmpDir, { recursive: true, force: true });
    vi.unstubAllEnvs();
  });

  describe("loadConfig (comments)", () => {
    it("loads JSON with // comments", () => {
      const configPath = path.join(tmpDir, "config.json5");
      fs.writeFileSync(
        configPath,
        `{
        // This is a comment
        "gateway": { "wsPort": 9999 }
      }`,
      );
      const config = loadConfig(configPath);
      expect(config.gateway.wsPort).toBe(9999);
    });

    it("loads JSON with /* */ comments", () => {
      const configPath = path.join(tmpDir, "config.json5");
      fs.writeFileSync(
        configPath,
        `{
        /* block comment */
        "gateway": { "httpPort": 8888 }
      }`,
      );
      const config = loadConfig(configPath);
      expect(config.gateway.httpPort).toBe(8888);
    });

    it("returns defaults when no file exists", () => {
      const config = loadConfig(path.join(tmpDir, "nonexistent.json5"));
      expect(config.gateway.wsPort).toBe(19789);
      expect(config.gateway.httpPort).toBe(19790);
    });

    it("returns defaults on invalid JSON", () => {
      const configPath = path.join(tmpDir, "bad.json5");
      fs.writeFileSync(configPath, "not json at all {{{");
      const config = loadConfig(configPath);
      expect(config.gateway.wsPort).toBe(19789);
    });

    it("handles escaped quotes inside strings with comments", () => {
      const configPath = path.join(tmpDir, "escape.json5");
      fs.writeFileSync(configPath, `{"llm": {"defaultModel": "claude-\\"sonnet\\""}}`);
      const config = loadConfig(configPath);
      expect(config.llm.defaultModel).toBe('claude-"sonnet"');
    });
  });

  describe("loadConfig (env interpolation)", () => {
    it("interpolates $env:VAR syntax", () => {
      vi.stubEnv("TEST_OO_KEY", "my-key-123");
      const configPath = path.join(tmpDir, "config.json5");
      fs.writeFileSync(
        configPath,
        JSON.stringify({
          llm: {
            providers: {
              anthropic: { api: "anthropic-messages", apiKey: "$env:TEST_OO_KEY" },
            },
          },
        }),
      );
      const config = loadConfig(configPath);
      expect(config.llm.providers.anthropic?.apiKey).toBe("my-key-123");
    });

    it("interpolates ${VAR} syntax", () => {
      vi.stubEnv("TEST_OO_KEY2", "key-456");
      const configPath = path.join(tmpDir, "config.json5");
      fs.writeFileSync(
        configPath,
        JSON.stringify({
          llm: {
            providers: {
              openai: { api: "openai-completions", apiKey: "${TEST_OO_KEY2}" },
            },
          },
        }),
      );
      const config = loadConfig(configPath);
      expect(config.llm.providers.openai?.apiKey).toBe("key-456");
    });

    it("replaces missing env var with empty string", () => {
      const configPath = path.join(tmpDir, "config.json5");
      fs.writeFileSync(
        configPath,
        JSON.stringify({
          llm: {
            providers: {
              test: { api: "ollama", baseUrl: "$env:NONEXISTENT_VAR_12345" },
            },
          },
        }),
      );
      const config = loadConfig(configPath);
      expect(config.llm.providers.test?.baseUrl).toBe("");
    });
  });

  describe("loadConfig (overrides)", () => {
    it("OPENOCTOPUS_PORT overrides httpPort", () => {
      vi.stubEnv("OPENOCTOPUS_PORT", "3000");
      const config = loadConfig(path.join(tmpDir, "no.json5"));
      expect(config.gateway.httpPort).toBe(3000);
    });

    it("ANTHROPIC_API_KEY auto-configures anthropic provider", () => {
      vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test");
      const config = loadConfig(path.join(tmpDir, "no.json5"));
      expect(config.llm.providers.anthropic).toBeDefined();
      expect(config.llm.providers.anthropic?.apiKey).toBe("sk-ant-test");
    });

    it("PORT overrides httpPort", () => {
      vi.stubEnv("PORT", "8080");
      const config = loadConfig(path.join(tmpDir, "no.json5"));
      expect(config.gateway.httpPort).toBe(8080);
    });

    it("OPENOCTOPUS_WS_PORT overrides wsPort", () => {
      vi.stubEnv("OPENOCTOPUS_WS_PORT", "9999");
      const config = loadConfig(path.join(tmpDir, "no.json5"));
      expect(config.gateway.wsPort).toBe(9999);
    });

    it("OPENOCTOPUS_DATA_DIR overrides storage", () => {
      vi.stubEnv("OPENOCTOPUS_DATA_DIR", "/tmp/data");
      const config = loadConfig(path.join(tmpDir, "no.json5"));
      expect(config.storage.dataDir).toBe("/tmp/data");
    });

    it("OPENOCTOPUS_HOST overrides host", () => {
      vi.stubEnv("OPENOCTOPUS_HOST", "0.0.0.0");
      const config = loadConfig(path.join(tmpDir, "no.json5"));
      expect(config.gateway.host).toBe("0.0.0.0");
    });

    it("OPENOCTOPUS_LOG_LEVEL overrides logging", () => {
      vi.stubEnv("OPENOCTOPUS_LOG_LEVEL", "debug");
      const config = loadConfig(path.join(tmpDir, "no.json5"));
      expect(config.logging.level).toBe("debug");
    });

    it("OPENAI_API_KEY auto-configures openai provider", () => {
      vi.stubEnv("OPENAI_API_KEY", "sk-openai-test");
      const config = loadConfig(path.join(tmpDir, "no.json5"));
      expect(config.llm.providers.openai).toBeDefined();
      expect(config.llm.providers.openai?.apiKey).toBe("sk-openai-test");
    });

    it("OPENAI_API_KEY auto-configures embedding provider", () => {
      vi.stubEnv("OPENAI_API_KEY", "sk-openai-test");
      const config = loadConfig(path.join(tmpDir, "no.json5"));
      expect(config.embeddings.providers.openai).toBeDefined();
      expect(config.embeddings.providers.openai?.apiKey).toBe("sk-openai-test");
    });

    it("GOOGLE_API_KEY auto-configures google provider", () => {
      vi.stubEnv("GOOGLE_API_KEY", "google-key");
      const config = loadConfig(path.join(tmpDir, "no.json5"));
      expect(config.llm.providers.google).toBeDefined();
      expect(config.llm.providers.google?.apiKey).toBe("google-key");
    });

    it("CN provider env keys auto-configure providers", () => {
      vi.stubEnv("DEEPSEEK_API_KEY", "ds-key");
      const config = loadConfig(path.join(tmpDir, "no.json5"));
      expect(config.llm.providers.deepseek).toBeDefined();
      expect(config.llm.providers.deepseek?.apiKey).toBe("ds-key");
    });

    it("returns defaults on validation failure", () => {
      const configPath = path.join(tmpDir, "bad-type.json5");
      fs.writeFileSync(configPath, JSON.stringify({ gateway: { wsPort: "not-a-number" } }));
      const config = loadConfig(configPath);
      expect(config.gateway.wsPort).toBe(19789);
    });
  });

  describe("writeDefaultConfig", () => {
    it("creates directory and file", () => {
      const configPath = path.join(tmpDir, "sub", "dir", "config.json5");
      writeDefaultConfig(configPath);
      expect(fs.existsSync(configPath)).toBe(true);
    });

    it("has correct default ports", () => {
      const configPath = path.join(tmpDir, "config.json5");
      writeDefaultConfig(configPath);
      const content = fs.readFileSync(configPath, "utf-8");
      expect(content).toContain("19789");
      expect(content).toContain("19790");
    });
  });

  describe("resetConfig", () => {
    it("clears cache for fresh load", () => {
      const configPath = path.join(tmpDir, "config.json5");
      fs.writeFileSync(configPath, JSON.stringify({ gateway: { wsPort: 1111 } }));
      const first = loadConfig(configPath);
      expect(first.gateway.wsPort).toBe(1111);

      resetConfig();
      fs.writeFileSync(configPath, JSON.stringify({ gateway: { wsPort: 2222 } }));
      const second = loadConfig(configPath);
      expect(second.gateway.wsPort).toBe(2222);
    });
  });
});
