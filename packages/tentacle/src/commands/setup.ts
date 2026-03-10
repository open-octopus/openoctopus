import { defineCommand } from "citty";
import {
  intro,
  outro,
  text,
  select,
  confirm,
  note,
  isCancel,
  cancel,
  spinner,
  multiselect,
} from "@clack/prompts";
import pc from "picocolors";
import fs from "node:fs";
import {
  resolveConfigPath,
  resolveConfigDir,
  loadConfig,
  resetConfig,
  type OpenOctopusConfig,
} from "@openoctopus/shared";
import { ApiClient, WsRpcClient } from "../api-client.js";

// ── Helpers ──

function guard<T>(value: T | symbol): T {
  if (isCancel(value)) {
    cancel("Setup cancelled.");
    process.exit(0);
  }
  return value;
}

function printBanner(): void {
  const banner = [
    "",
    pc.cyan("  ╔═══════════════════════════════════════════╗"),
    pc.cyan("  ║") + pc.bold("         🐙 OpenOctopus Setup 🐙          ") + pc.cyan("║"),
    pc.cyan("  ║") + pc.dim("   Your Realm-native life assistant agent  ") + pc.cyan("║"),
    pc.cyan("  ╚═══════════════════════════════════════════╝"),
    "",
  ].join("\n");
  console.log(banner);
}

// ── Section: LLM Provider ──

interface LlmSetupResult {
  defaultProvider: string;
  defaultModel: string;
  providers: Record<string, unknown>;
}

async function setupLlm(existing: OpenOctopusConfig["llm"]): Promise<LlmSetupResult> {
  const providers: Record<string, unknown> = { ...existing.providers };

  const provider = guard(
    await select({
      message: "Primary LLM provider",
      options: [
        // Global providers
        { value: "anthropic", label: "Anthropic (Claude)", hint: "recommended" },
        { value: "openai", label: "OpenAI (GPT)" },
        { value: "google", label: "Google (Gemini)" },
        // CN providers
        { value: "deepseek", label: "DeepSeek (深度求索)", hint: "OpenAI-compatible" },
        { value: "glm", label: "GLM (智谱清言)" },
        { value: "kimi", label: "Kimi (月之暗面)" },
        { value: "qwen", label: "Qwen (通义千问)" },
        { value: "minimax", label: "MiniMax (稀宇)" },
        { value: "stepfun", label: "StepFun (阶跃星辰)" },
        // Local
        { value: "ollama", label: "Ollama (local)", hint: "no API key needed" },
        { value: "skip", label: "Skip for now", hint: "use stub responses" },
      ],
      initialValue: existing.defaultProvider,
    }),
  );

  if (provider === "skip") {
    return {
      defaultProvider: existing.defaultProvider,
      defaultModel: existing.defaultModel,
      providers,
    };
  }

  const providerConfigs: Record<string, { api: string; models: Array<{ value: string; label: string }> }> = {
    anthropic: {
      api: "anthropic-messages",
      models: [
        { value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6 (balanced)" },
        { value: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5 (fast)" },
        { value: "claude-opus-4-6", label: "Claude Opus 4.6 (most capable)" },
      ],
    },
    openai: {
      api: "openai-completions",
      models: [
        { value: "gpt-4.1", label: "GPT-4.1 (latest)" },
        { value: "gpt-4.1-mini", label: "GPT-4.1 Mini (fast)" },
        { value: "gpt-4.1-nano", label: "GPT-4.1 Nano (fastest)" },
        { value: "o3", label: "o3 (reasoning)" },
        { value: "o4-mini", label: "o4 Mini (reasoning, fast)" },
      ],
    },
    google: {
      api: "google-genai",
      models: [
        { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash (balanced)" },
        { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro (most capable)" },
      ],
    },
    deepseek: {
      api: "deepseek",
      models: [
        { value: "deepseek-chat", label: "DeepSeek V3.2 (balanced)" },
        { value: "deepseek-reasoner", label: "DeepSeek R1 (reasoning)" },
      ],
    },
    glm: {
      api: "glm",
      models: [
        { value: "glm-5", label: "GLM-5 (most capable, 744B)" },
        { value: "glm-4.7-flash", label: "GLM-4.7-Flash (fast, free)" },
        { value: "glm-4-plus", label: "GLM-4-Plus (balanced)" },
        { value: "glm-z1-flash", label: "GLM-Z1-Flash (reasoning, fast)" },
      ],
    },
    kimi: {
      api: "kimi",
      models: [
        { value: "kimi-k2.5", label: "Kimi K2.5 (most capable, 1T MoE)" },
        { value: "k2.5-vision", label: "K2.5 Vision (multimodal)" },
        { value: "kimi-latest", label: "Kimi Latest (balanced)" },
        { value: "k1", label: "K1 (reasoning)" },
      ],
    },
    qwen: {
      api: "qwen",
      models: [
        { value: "qwen3-max", label: "Qwen3 Max (most capable)" },
        { value: "qwen3.5-plus", label: "Qwen3.5 Plus (multimodal)" },
        { value: "qwen-plus", label: "Qwen Plus (balanced)" },
        { value: "qwq-plus", label: "QwQ Plus (reasoning)" },
        { value: "qwen-turbo", label: "Qwen Turbo (fast)" },
      ],
    },
    minimax: {
      api: "minimax",
      models: [
        { value: "MiniMax-M2.5", label: "MiniMax-M2.5 (most capable)" },
        { value: "MiniMax-M2.5-lightning", label: "MiniMax-M2.5 Lightning (fast)" },
        { value: "MiniMax-M2.1", label: "MiniMax-M2.1 (balanced)" },
        { value: "MiniMax-M1", label: "MiniMax-M1 (reasoning)" },
      ],
    },
    stepfun: {
      api: "stepfun",
      models: [
        { value: "step-3.5-flash", label: "Step-3.5 Flash (latest)" },
        { value: "step-2-16k", label: "Step-2 16K (most capable)" },
        { value: "step-1v-8k", label: "Step-1V 8K (vision)" },
      ],
    },
    ollama: {
      api: "ollama",
      models: [
        { value: "llama3.2", label: "Llama 3.2" },
        { value: "qwen2.5", label: "Qwen 2.5" },
        { value: "deepseek-r1", label: "DeepSeek R1" },
        { value: "mistral", label: "Mistral" },
        { value: "gemma3", label: "Gemma 3" },
      ],
    },
  };

  const cfg = providerConfigs[provider];
  if (!cfg) {
    return { defaultProvider: provider, defaultModel: existing.defaultModel, providers };
  }

  // API key (skip for Ollama)
  if (provider !== "ollama") {
    const envVarNames: Record<string, string> = {
      anthropic: "ANTHROPIC_API_KEY",
      openai: "OPENAI_API_KEY",
      google: "GOOGLE_API_KEY",
      deepseek: "DEEPSEEK_API_KEY",
      glm: "GLM_API_KEY",
      kimi: "MOONSHOT_API_KEY",
      qwen: "DASHSCOPE_API_KEY",
      minimax: "MINIMAX_API_KEY",
      stepfun: "STEPFUN_API_KEY",
    };
    const envVarName = envVarNames[provider] ?? `${provider.toUpperCase()}_API_KEY`;
    const existingKey = (existing.providers[provider] as { apiKey?: string } | undefined)?.apiKey;
    const envKey = process.env[envVarName];

    if (envKey) {
      await note(
        `Found ${pc.green(envVarName)} in environment. Will use it automatically.`,
        "API Key",
      );
      providers[provider] = { api: cfg.api, apiKey: `$env:${envVarName}` };
    } else {
      const apiKey = guard(
        await text({
          message: `${provider} API key`,
          placeholder: existingKey ? "(press Enter to keep current)" : `paste key or set ${envVarName} env var`,
          defaultValue: existingKey,
          validate: (v) => {
            if (!v && !existingKey) {
              return "API key is required (or set the environment variable and re-run)";
            }
          },
        }),
      );
      providers[provider] = { api: cfg.api, apiKey: apiKey || existingKey };
    }
  } else {
    // Ollama
    const baseUrl = guard(
      await text({
        message: "Ollama base URL",
        initialValue: (existing.providers.ollama as { baseUrl?: string } | undefined)?.baseUrl ?? "http://localhost:11434",
      }),
    );
    providers.ollama = { api: "ollama", baseUrl };
  }

  // Model selection
  const model = guard(
    await select({
      message: "Default model",
      options: cfg.models,
      initialValue: cfg.models[0].value,
    }),
  );

  return { defaultProvider: provider, defaultModel: model, providers };
}

// ── Section: Channels ──

interface ChannelSetupResult {
  channels: Record<string, unknown>;
}

async function setupChannels(existing: OpenOctopusConfig["channels"]): Promise<ChannelSetupResult> {
  const channels: Record<string, unknown> = { ...existing };

  const selected = guard(
    await multiselect({
      message: "Messaging channels to enable (Space to select, Enter to confirm)",
      options: [
        { value: "telegram", label: "Telegram", hint: existing.telegram?.enabled ? pc.green("configured") : undefined },
        { value: "discord", label: "Discord", hint: existing.discord?.enabled ? pc.green("configured") : undefined },
        { value: "slack", label: "Slack", hint: existing.slack?.enabled ? pc.green("configured") : undefined },
        { value: "none", label: "None / Skip" },
      ],
      required: false,
    }),
  );

  const actualChannels = (selected as string[]).filter(s => s !== "none");

  // Sequential prompts — each channel requires interactive user input
  const promptChannel = async (name: string) => {
    const existingCh = existing[name] as { token?: string; enabled?: boolean } | undefined;

    const token = guard(
      await text({
        message: `${name.charAt(0).toUpperCase() + name.slice(1)} bot token`,
        placeholder: existingCh?.token ? "(press Enter to keep current)" : "paste your bot token",
        defaultValue: existingCh?.token,
        validate: (v) => {
          if (!v && !existingCh?.token) {
            return "Bot token is required";
          }
        },
      }),
    );

    channels[name] = {
      type: name,
      enabled: true,
      token: token || existingCh?.token,
    };
  };

  for (const ch of actualChannels) {
    await promptChannel(ch); // eslint-disable-line no-await-in-loop
  }

  return { channels };
}

// ── Section: Gateway ──

interface GatewaySetupResult {
  wsPort: number;
  httpPort: number;
  host: string;
}

async function setupGateway(existing: OpenOctopusConfig["gateway"]): Promise<GatewaySetupResult> {
  const wsPort = guard(
    await text({
      message: "WebSocket RPC port",
      initialValue: String(existing.wsPort),
      validate: (v) => {
        const n = Number(v);
        if (!Number.isFinite(n) || n < 1024 || n > 65535) {
          return "Must be a port number (1024-65535)";
        }
      },
    }),
  );

  const httpPort = guard(
    await text({
      message: "HTTP REST port",
      initialValue: String(existing.httpPort),
      validate: (v) => {
        const n = Number(v);
        if (!Number.isFinite(n) || n < 1024 || n > 65535) {
          return "Must be a port number (1024-65535)";
        }
      },
    }),
  );

  const bind = guard(
    await select({
      message: "Gateway bind mode",
      options: [
        { value: "loopback", label: "Loopback (localhost only)", hint: "recommended" },
        { value: "lan", label: "LAN (local network)" },
        { value: "public", label: "Public (all interfaces)", hint: "use with caution" },
      ],
      initialValue: existing.bind,
    }),
  );

  const hostMap: Record<string, string> = {
    loopback: "127.0.0.1",
    lan: "0.0.0.0",
    public: "0.0.0.0",
  };

  return {
    wsPort: Number(wsPort),
    httpPort: Number(httpPort),
    host: hostMap[bind] ?? "127.0.0.1",
  };
}

// ── Main: Build Config ──

function buildConfigJson5(config: {
  gateway: GatewaySetupResult;
  llm: LlmSetupResult;
  channels: ChannelSetupResult;
}): string {
  const lines: string[] = ["{"];
  lines.push("  // OpenOctopus Configuration");
  lines.push("");

  // Gateway
  lines.push('  "gateway": {');
  lines.push(`    "wsPort": ${config.gateway.wsPort},`);
  lines.push(`    "httpPort": ${config.gateway.httpPort},`);
  lines.push(`    "host": "${config.gateway.host}",`);
  lines.push('    "bind": "loopback"');
  lines.push("  },");
  lines.push("");

  // LLM
  lines.push('  "llm": {');
  lines.push(`    "defaultProvider": "${config.llm.defaultProvider}",`);
  lines.push(`    "defaultModel": "${config.llm.defaultModel}",`);
  lines.push('    "providers": {');
  const providerEntries = Object.entries(config.llm.providers);
  for (let i = 0; i < providerEntries.length; i++) {
    const [name, cfg] = providerEntries[i];
    const providerCfg = cfg as Record<string, unknown>;
    const parts: string[] = [];
    for (const [k, v] of Object.entries(providerCfg)) {
      parts.push(`        "${k}": ${JSON.stringify(v)}`);
    }
    lines.push(`      "${name}": {`);
    lines.push(parts.join(",\n"));
    lines.push(`      }${i < providerEntries.length - 1 ? "," : ""}`);
  }
  lines.push("    }");
  lines.push("  },");
  lines.push("");

  // Channels
  lines.push('  "channels": {');
  const channelEntries = Object.entries(config.channels.channels);
  for (let i = 0; i < channelEntries.length; i++) {
    const [name, cfg] = channelEntries[i];
    const channelCfg = cfg as Record<string, unknown>;
    const parts: string[] = [];
    for (const [k, v] of Object.entries(channelCfg)) {
      parts.push(`      "${k}": ${JSON.stringify(v)}`);
    }
    lines.push(`    "${name}": {`);
    lines.push(parts.join(",\n"));
    lines.push(`    }${i < channelEntries.length - 1 ? "," : ""}`);
  }
  lines.push("  },");
  lines.push("");

  // Storage + Logging defaults
  lines.push('  "storage": {');
  lines.push('    "dataDir": "",');
  lines.push('    "database": "sqlite"');
  lines.push("  },");
  lines.push("");
  lines.push('  "logging": {');
  lines.push('    "level": "info"');
  lines.push("  }");
  lines.push("}");

  return lines.join("\n") + "\n";
}

// ── Setup Command ──

export const setupCommand = defineCommand({
  meta: {
    name: "setup",
    description: "Interactive setup wizard",
  },
  args: {
    force: {
      type: "boolean",
      description: "Overwrite existing config",
      default: false,
    },
  },
  async run({ args }) {
    printBanner();
    intro(pc.bold("OpenOctopus Setup"));

    const configPath = resolveConfigPath();
    const configDir = resolveConfigDir();

    // Check existing config
    resetConfig();
    let existingConfig: OpenOctopusConfig | undefined;

    if (fs.existsSync(configPath) && !args.force) {
      existingConfig = loadConfig(configPath);

      await note(
        [
          `Config file: ${pc.dim(configPath)}`,
          `Providers: ${Object.keys(existingConfig.llm.providers).join(", ") || pc.dim("none")}`,
          `Channels: ${Object.keys(existingConfig.channels).filter(k => (existingConfig!.channels[k] as { enabled?: boolean })?.enabled).join(", ") || pc.dim("none")}`,
          `Gateway: ws://${existingConfig.gateway.host}:${existingConfig.gateway.wsPort} + http://${existingConfig.gateway.host}:${existingConfig.gateway.httpPort}`,
        ].join("\n"),
        "Existing Configuration",
      );

      const action = guard(
        await select({
          message: "Config already exists. What would you like to do?",
          options: [
            { value: "modify", label: "Modify existing config" },
            { value: "reset", label: "Start fresh", hint: "overwrites current config" },
            { value: "cancel", label: "Cancel" },
          ],
        }),
      );

      if (action === "cancel") {
        outro("Setup cancelled.");
        return;
      }
      if (action === "reset") {
        existingConfig = undefined;
      }
    }

    // Load defaults
    const baseConfig = existingConfig ?? loadConfig();

    // ── Step 1: LLM Provider (always ask) ──
    await note("Configure your AI model provider and API key.", "Step 1: LLM Provider");
    const llmResult = await setupLlm(baseConfig.llm);

    // ── Step 2: Channels (always ask) ──
    await note("Connect messaging platforms for multi-channel access.", "Step 2: Channels");
    const channelResult = await setupChannels(baseConfig.channels);

    // ── Step 3: Gateway (optional) ──
    let gatewayResult: GatewaySetupResult = {
      wsPort: baseConfig.gateway.wsPort,
      httpPort: baseConfig.gateway.httpPort,
      host: baseConfig.gateway.host,
    };

    const configureGateway = guard(
      await confirm({
        message: `Configure gateway ports? (current: WS ${gatewayResult.wsPort} / HTTP ${gatewayResult.httpPort})`,
        initialValue: false,
      }),
    );

    if (configureGateway) {
      gatewayResult = await setupGateway(baseConfig.gateway);
    }

    // ── Write config ──
    const s = spinner();
    s.start("Writing configuration...");

    fs.mkdirSync(configDir, { recursive: true });
    const content = buildConfigJson5({
      gateway: gatewayResult,
      llm: llmResult,
      channels: channelResult,
    });
    fs.writeFileSync(configPath, content, "utf-8");

    s.stop("Configuration saved");

    // ── Verify gateway ──
    const doCheck = guard(
      await confirm({
        message: "Check gateway connectivity?",
        initialValue: true,
      }),
    );

    if (doCheck) {
      const s2 = spinner();
      s2.start("Checking gateway...");

      const httpClient = new ApiClient(gatewayResult.httpPort);
      const httpOk = await httpClient.healthCheck();

      const wsClient = new WsRpcClient(gatewayResult.wsPort);
      const wsOk = await wsClient.tryConnect();
      if (wsOk) {
        await wsClient.disconnect();
      }

      s2.stop("Gateway check complete");

      const statusLines = [
        `HTTP bridge (${gatewayResult.httpPort}): ${httpOk ? pc.green("✓ running") : pc.yellow("✗ not running")}`,
        `WebSocket RPC (${gatewayResult.wsPort}): ${wsOk ? pc.green("✓ running") : pc.yellow("✗ not running")}`,
      ];

      if (!httpOk && !wsOk) {
        statusLines.push("");
        statusLines.push(pc.dim("Start the gateway with: pnpm tentacle start"));
      }

      await note(statusLines.join("\n"), "Gateway Status");
    }

    // ── Summary ──
    const summaryLines = [
      `Config: ${pc.dim(configPath)}`,
      `LLM: ${pc.cyan(llmResult.defaultProvider)} / ${pc.cyan(llmResult.defaultModel)}`,
      `Channels: ${Object.entries(channelResult.channels).filter(([, v]) => (v as { enabled?: boolean })?.enabled).map(([k]) => pc.green(k)).join(", ") || pc.dim("none")}`,
      `Gateway: ws://${gatewayResult.host}:${gatewayResult.wsPort} + http://${gatewayResult.host}:${gatewayResult.httpPort}`,
      "",
      pc.dim("Next steps:"),
      pc.dim("  pnpm tentacle start    — start the gateway"),
      pc.dim("  pnpm tentacle chat     — start chatting"),
      pc.dim("  pnpm tentacle doctor   — run diagnostics"),
    ];

    await note(summaryLines.join("\n"), "Setup Complete");

    outro(pc.green("🐙 OpenOctopus is ready!"));
  },
});
