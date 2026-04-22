import pc from "picocolors";
import type { WsRpcClient } from "../api-client.js";
import {
  renderHelp,
  renderRealmCards,
  renderRealmDetail,
  renderEntityList,
  renderHealthReport,
  renderHealthDashboard,
  renderCleanupResult,
  renderDistributionResult,
  renderMaturityScores,
  renderScanResult,
  type HealthReportData,
} from "./renderer.js";
import type { TuiState } from "./state.js";

interface SlashCommandResult {
  output?: string;
  stateUpdate?: Partial<TuiState>;
}

export async function handleSlashCommand(
  input: string,
  client: WsRpcClient,
  state: TuiState,
): Promise<SlashCommandResult> {
  const [cmd, ...args] = input.slice(1).split(/\s+/);

  switch (cmd) {
    case "help":
      return { output: renderHelp() };

    case "clear":
      process.stdout.write("\x1b[2J\x1b[H");
      return {};

    case "exit":
    case "quit":
      return { stateUpdate: { connectionMode: "disconnected" } };

    case "status":
      return handleStatus(client, state);

    case "realms":
      return handleRealms(client);

    case "realm":
      return handleRealm(client, args[0]);

    case "entities":
      return handleEntities(client, state);

    case "summon":
      return handleSummon(client, args[0]);

    case "release":
      return handleRelease(client, state);

    case "health":
      return handleHealth(client, args[0]);

    case "clean":
      return handleClean(client, args[0], state);

    case "inject":
      return handleInject(client, args.join(" "));

    case "maturity":
      return handleMaturity(client, args[0], state);

    case "scan":
      return handleScan(client, args[0]);

    default:
      return { output: pc.red(`Unknown command: /${cmd}. Type /help for available commands.`) };
  }
}

async function handleStatus(client: WsRpcClient, state: TuiState): Promise<SlashCommandResult> {
  try {
    const response = await client.call("status.info");
    const info = response.result as {
      realms: number;
      summoned: number;
      uptime: number;
      providers: string[];
      channels: Array<{ name: string; type: string; running: boolean }>;
    };

    const lines = [
      pc.bold("Status:"),
      `  Connection:  ${pc.green(state.connectionMode)}`,
      `  Realm:       ${state.currentRealm ? pc.blue(state.currentRealm.name) : pc.dim("none")}`,
      `  Entity:      ${state.currentEntity ? pc.magenta(state.currentEntity.name) : pc.dim("none")}`,
      `  Session:     ${state.sessionId ? pc.dim(state.sessionId) : pc.dim("none")}`,
      `  Realms:      ${info.realms}`,
      `  Summoned:    ${info.summoned}`,
      `  Uptime:      ${formatUptime(info.uptime)}`,
      `  Providers:   ${info.providers.join(", ")}`,
      `  Channels:    ${info.channels.length > 0 ? info.channels.map((c) => `${c.name}(${c.running ? pc.green("up") : pc.red("down")})`).join(", ") : pc.dim("none")}`,
    ];
    return { output: lines.join("\n") };
  } catch (err) {
    return {
      output: pc.red(`Failed to get status: ${err instanceof Error ? err.message : String(err)}`),
    };
  }
}

async function handleRealms(client: WsRpcClient): Promise<SlashCommandResult> {
  try {
    const response = await client.call("realm.list");
    const { realms } = response.result as {
      realms: Array<{
        id: string;
        name: string;
        icon?: string;
        status: string;
        description?: string;
        entityCount: number;
      }>;
    };

    if (realms.length === 0) {
      return { output: pc.dim("No realms found. Create one with the realm command.") };
    }

    return { output: renderRealmCards(realms) };
  } catch (err) {
    return {
      output: pc.red(`Failed to list realms: ${err instanceof Error ? err.message : String(err)}`),
    };
  }
}

async function handleRealm(client: WsRpcClient, nameOrId?: string): Promise<SlashCommandResult> {
  if (!nameOrId) {
    return {
      stateUpdate: { currentRealm: undefined },
      output: pc.yellow("Realm context cleared. Now using auto-routing."),
    };
  }

  try {
    // Find realm by name or ID
    const listResponse = await client.call("realm.list");
    const { realms } = listResponse.result as {
      realms: Array<{ id: string; name: string; icon?: string }>;
    };
    const match = realms.find(
      (r) => r.id === nameOrId || r.name.toLowerCase() === nameOrId.toLowerCase(),
    );

    if (!match) {
      return {
        output: pc.red(`Realm "${nameOrId}" not found. Use /realms to see available realms.`),
      };
    }

    // Fetch detailed realm info
    const detailResponse = await client.call("realm.get", { id: match.id });
    const detail = detailResponse.result as {
      realm: {
        id: string;
        name: string;
        icon?: string;
        description?: string;
        agentName?: string;
        skills: string[];
        entities: Array<{ id: string; name: string; type: string; summonStatus: string }>;
      };
    };

    const r = detail.realm;
    const output = renderRealmDetail({
      name: r.name,
      icon: r.icon,
      description: r.description,
      agentName: r.agentName,
      skills: r.skills ?? [],
      entities: r.entities ?? [],
    });

    return {
      stateUpdate: {
        currentRealm: { id: match.id, name: match.name, icon: match.icon },
        currentEntity: undefined,
      },
      output,
    };
  } catch (err) {
    return {
      output: pc.red(`Failed to switch realm: ${err instanceof Error ? err.message : String(err)}`),
    };
  }
}

async function handleEntities(client: WsRpcClient, state: TuiState): Promise<SlashCommandResult> {
  if (!state.currentRealm) {
    return { output: pc.yellow("No realm selected. Use /realm <name> to select one first.") };
  }

  try {
    const response = await client.call("entity.list", { realmId: state.currentRealm.id });
    const { entities } = response.result as {
      entities: Array<{ id: string; name: string; type: string; summonStatus: string }>;
    };

    return { output: renderEntityList(entities, state.currentRealm.name) };
  } catch (err) {
    return {
      output: pc.red(
        `Failed to list entities: ${err instanceof Error ? err.message : String(err)}`,
      ),
    };
  }
}

async function handleSummon(client: WsRpcClient, entityId?: string): Promise<SlashCommandResult> {
  if (!entityId) {
    return { output: pc.red("Usage: /summon <entityId>") };
  }

  try {
    const response = await client.call("summon.invoke", { entityId });
    if (response.error) {
      return { output: pc.red(`Summon failed: ${response.error.message}`) };
    }
    const result = response.result as { entity: { id: string; name: string } };
    return {
      stateUpdate: { currentEntity: { id: result.entity.id, name: result.entity.name } },
      output: pc.green(`Summoned: ${result.entity.name}`),
    };
  } catch (err) {
    return { output: pc.red(`Summon failed: ${err instanceof Error ? err.message : String(err)}`) };
  }
}

async function handleRelease(client: WsRpcClient, state: TuiState): Promise<SlashCommandResult> {
  if (!state.currentEntity) {
    return { output: pc.yellow("No entity is currently summoned.") };
  }

  try {
    await client.call("summon.release", { entityId: state.currentEntity.id });
    return {
      stateUpdate: { currentEntity: undefined },
      output: pc.green(`Released: ${state.currentEntity.name}`),
    };
  } catch (err) {
    return {
      output: pc.red(`Release failed: ${err instanceof Error ? err.message : String(err)}`),
    };
  }
}

async function handleHealth(client: WsRpcClient, realmName?: string): Promise<SlashCommandResult> {
  try {
    if (realmName) {
      // Find realm ID by name
      const listResponse = await client.call("realm.list");
      const { realms } = listResponse.result as { realms: Array<{ id: string; name: string }> };
      const match = realms.find((r) => r.name.toLowerCase() === realmName.toLowerCase());

      if (!match) {
        return { output: pc.red(`Realm "${realmName}" not found.`) };
      }

      const response = await client.call("health.report", { realmId: match.id });
      const { report } = response.result as { report: HealthReportData };
      return { output: renderHealthReport(report) };
    }

    const response = await client.call("health.report");
    const { reports } = response.result as { reports: HealthReportData[] };
    return { output: renderHealthDashboard(reports) };
  } catch (err) {
    return {
      output: pc.red(`Health check failed: ${err instanceof Error ? err.message : String(err)}`),
    };
  }
}

async function handleClean(
  client: WsRpcClient,
  realmName?: string,
  state?: TuiState,
): Promise<SlashCommandResult> {
  // Use provided name or current realm
  const name = realmName ?? state?.currentRealm?.name;
  if (!name) {
    return {
      output: pc.yellow("Usage: /clean <realmName> or select a realm first with /realm <name>"),
    };
  }

  try {
    const listResponse = await client.call("realm.list");
    const { realms } = listResponse.result as { realms: Array<{ id: string; name: string }> };
    const match = realms.find((r) => r.name.toLowerCase() === name.toLowerCase());

    if (!match) {
      return { output: pc.red(`Realm "${name}" not found.`) };
    }

    const response = await client.call("health.clean", { realmId: match.id });
    const { result } = response.result as {
      result: { deduplicatedCount: number; archivedCount: number; issuesResolved: number };
    };
    return { output: renderCleanupResult(result) };
  } catch (err) {
    return {
      output: pc.red(`Cleanup failed: ${err instanceof Error ? err.message : String(err)}`),
    };
  }
}

async function handleInject(client: WsRpcClient, text?: string): Promise<SlashCommandResult> {
  if (!text || text.trim().length === 0) {
    return {
      output: pc.yellow("Usage: /inject <text>\nExample: /inject 我养了一只橘猫叫肉肉3岁了"),
    };
  }

  try {
    const response = await client.call("knowledge.inject", { text });
    const { result } = response.result as {
      result: {
        facts: Array<{ content: string; realmName: string; entityName?: string }>;
        realmsAffected: string[];
        memoriesCreated: number;
      };
    };
    return { output: renderDistributionResult(result) };
  } catch (err) {
    return {
      output: pc.red(`Injection failed: ${err instanceof Error ? err.message : String(err)}`),
    };
  }
}

async function handleMaturity(
  client: WsRpcClient,
  realmName?: string,
  _state?: TuiState,
): Promise<SlashCommandResult> {
  try {
    if (realmName) {
      const listResponse = await client.call("realm.list");
      const { realms } = listResponse.result as { realms: Array<{ id: string; name: string }> };
      const match = realms.find((r) => r.name.toLowerCase() === realmName.toLowerCase());

      if (!match) {
        return { output: pc.red(`Realm "${realmName}" not found.`) };
      }

      const response = await client.call("maturity.scan", { realmId: match.id });
      const { scores } = response.result as {
        scores: Array<{
          entityName: string;
          overall: number;
          attributeCompleteness: number;
          memoryDepth: number;
          interactionFrequency: number;
          readyToSummon: boolean;
        }>;
      };
      return { output: renderMaturityScores(scores, match.name) };
    }

    // Show all suggestions
    const response = await client.call("maturity.scan");
    const { suggestions } = response.result as {
      suggestions: Array<{
        entityName: string;
        realmName: string;
        maturityScore: number;
        reason: string;
      }>;
    };

    if (suggestions.length === 0) {
      return {
        output: pc.dim(
          "No entities are ready for summoning yet. Keep chatting to build knowledge!",
        ),
      };
    }

    const lines = [pc.bold("Summon Suggestions:")];
    for (const s of suggestions) {
      lines.push(`  ${pc.cyan(s.entityName)} (${s.realmName}) — ${s.maturityScore}/100`);
      lines.push(`    ${pc.dim(s.reason)}`);
    }
    return { output: lines.join("\n") };
  } catch (err) {
    return {
      output: pc.red(`Maturity scan failed: ${err instanceof Error ? err.message : String(err)}`),
    };
  }
}

async function handleScan(client: WsRpcClient, dirPath?: string): Promise<SlashCommandResult> {
  if (!dirPath) {
    return { output: pc.yellow("Usage: /scan <directory-path>\nExample: /scan ~/Documents/") };
  }

  try {
    const response = await client.call("directory.scan", { path: dirPath });
    const { result } = response.result as {
      result: {
        filesScanned: number;
        filesSkipped: number;
        factsExtracted: number;
        realmsAffected: string[];
        errors: string[];
      };
    };
    return { output: renderScanResult(result) };
  } catch (err) {
    return { output: pc.red(`Scan failed: ${err instanceof Error ? err.message : String(err)}`) };
  }
}

function formatUptime(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  if (seconds < 3600) {
    return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}
