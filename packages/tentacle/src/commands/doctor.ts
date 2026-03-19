import fs from "node:fs";
import path from "node:path";
import { DATA_DIR, DB_FILE, resolveConfigPath, loadConfig, resetConfig } from "@openoctopus/shared";
import { defineCommand } from "citty";
import consola from "consola";
import { ApiClient, WsRpcClient } from "../api-client.js";

interface CheckResult {
  name: string;
  status: "pass" | "warn" | "fail";
  message: string;
}

export const doctorCommand = defineCommand({
  meta: {
    name: "doctor",
    description: "Check system health and configuration",
  },
  async run() {
    consola.info("Running diagnostics...\n");
    const checks: CheckResult[] = [];

    // Check Node.js version
    const nodeVersion = process.version;
    const major = Number(nodeVersion.slice(1).split(".")[0]);
    checks.push({
      name: "Node.js version",
      status: major >= 22 ? "pass" : "warn",
      message: `${nodeVersion}${major < 22 ? " (>= 22 recommended)" : ""}`,
    });

    // Check config file
    const configPath = resolveConfigPath();
    checks.push({
      name: "Config file",
      status: fs.existsSync(configPath) ? "pass" : "warn",
      message: fs.existsSync(configPath)
        ? configPath
        : `${configPath} (not found — using defaults, run "tentacle config init" to create)`,
    });

    // Load and validate config
    resetConfig();
    const config = loadConfig();
    checks.push({
      name: "Config validation",
      status: "pass",
      message: `gateway=${config.gateway.httpPort}/${config.gateway.wsPort}, llm=${config.llm.defaultProvider}`,
    });

    // Check LLM providers
    const providerNames = Object.keys(config.llm.providers);
    checks.push({
      name: "LLM providers",
      status: providerNames.length > 0 ? "pass" : "warn",
      message:
        providerNames.length > 0
          ? providerNames.join(", ")
          : "None configured — add API keys to config.json5 or set ANTHROPIC_API_KEY",
    });

    // Check channels
    const enabledChannels: string[] = [];
    for (const [name, channelCfg] of Object.entries(config.channels)) {
      if ((channelCfg as { enabled?: boolean }).enabled) {
        enabledChannels.push(name);
      }
    }
    checks.push({
      name: "Channels",
      status: enabledChannels.length > 0 ? "pass" : "warn",
      message: enabledChannels.length > 0 ? enabledChannels.join(", ") : "None enabled",
    });

    // Check data directory
    const dataDir = config.storage.dataDir || path.join(process.cwd(), DATA_DIR);
    checks.push({
      name: "Data directory",
      status: fs.existsSync(dataDir) ? "pass" : "warn",
      message: fs.existsSync(dataDir) ? dataDir : `${dataDir} (will be created on start)`,
    });

    // Check database
    const dbPath = path.join(dataDir, DB_FILE);
    checks.push({
      name: "Database",
      status: fs.existsSync(dbPath) ? "pass" : "warn",
      message: fs.existsSync(dbPath) ? dbPath : "Not initialized yet",
    });

    // Check HTTP gateway connectivity
    const httpClient = new ApiClient(config.gateway.httpPort);
    const httpAlive = await httpClient.healthCheck();
    checks.push({
      name: "HTTP bridge",
      status: httpAlive ? "pass" : "warn",
      message: httpAlive
        ? `Running on port ${config.gateway.httpPort}`
        : `Not running (port ${config.gateway.httpPort})`,
    });

    // Check WebSocket gateway connectivity
    const wsClient = new WsRpcClient(config.gateway.wsPort);
    const wsAlive = await wsClient.tryConnect();
    if (wsAlive) {
      await wsClient.disconnect();
    }
    checks.push({
      name: "WebSocket RPC",
      status: wsAlive ? "pass" : "warn",
      message: wsAlive
        ? `Running on port ${config.gateway.wsPort}`
        : `Not running (port ${config.gateway.wsPort})`,
    });

    // Display results
    for (const check of checks) {
      const icon =
        check.status === "pass" ? "[PASS]" : check.status === "warn" ? "[WARN]" : "[FAIL]";
      consola.log(`  ${icon} ${check.name}: ${check.message}`);
    }

    const failures = checks.filter((c) => c.status === "fail");
    const warnings = checks.filter((c) => c.status === "warn");

    consola.log("");
    if (failures.length > 0) {
      consola.error(`${failures.length} check(s) failed`);
      process.exit(1);
    } else if (warnings.length > 0) {
      consola.warn(`${warnings.length} warning(s)`);
    } else {
      consola.success("All checks passed");
    }
  },
});
