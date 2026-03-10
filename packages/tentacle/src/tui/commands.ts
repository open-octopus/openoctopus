import pc from "picocolors";
import type { WsRpcClient } from "../api-client.js";
import type { TuiState } from "./state.js";
import { renderHelp } from "./renderer.js";

export interface SlashCommandResult {
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
      `  Channels:    ${info.channels.length > 0 ? info.channels.map(c => `${c.name}(${c.running ? pc.green("up") : pc.red("down")})`).join(", ") : pc.dim("none")}`,
    ];
    return { output: lines.join("\n") };
  } catch (err) {
    return { output: pc.red(`Failed to get status: ${err instanceof Error ? err.message : String(err)}`) };
  }
}

async function handleRealms(client: WsRpcClient): Promise<SlashCommandResult> {
  try {
    const response = await client.call("realm.list");
    const { realms } = response.result as { realms: Array<{ id: string; name: string; status: string; description?: string }> };

    if (realms.length === 0) {
      return { output: pc.dim("No realms found. Create one with the realm command.") };
    }

    const lines = [pc.bold("Realms:")];
    for (const r of realms) {
      const status = r.status === "active" ? pc.green("●") : pc.dim("○");
      lines.push(`  ${status} ${pc.blue(r.name)} ${pc.dim(`(${r.id.slice(0, 12)}...)`)}${r.description ? ` — ${pc.dim(r.description)}` : ""}`);
    }
    return { output: lines.join("\n") };
  } catch (err) {
    return { output: pc.red(`Failed to list realms: ${err instanceof Error ? err.message : String(err)}`) };
  }
}

async function handleRealm(client: WsRpcClient, nameOrId?: string): Promise<SlashCommandResult> {
  if (!nameOrId) {
    return { stateUpdate: { currentRealm: undefined }, output: pc.yellow("Realm context cleared. Now using auto-routing.") };
  }

  try {
    // Try as ID first
    const response = await client.call("realm.list");
    const { realms } = response.result as { realms: Array<{ id: string; name: string }> };
    const match = realms.find(r => r.id === nameOrId || r.name.toLowerCase() === nameOrId.toLowerCase());

    if (!match) {
      return { output: pc.red(`Realm "${nameOrId}" not found. Use /realms to see available realms.`) };
    }

    return {
      stateUpdate: { currentRealm: { id: match.id, name: match.name }, currentEntity: undefined },
      output: pc.green(`Switched to realm: ${match.name}`),
    };
  } catch (err) {
    return { output: pc.red(`Failed to switch realm: ${err instanceof Error ? err.message : String(err)}`) };
  }
}

async function handleEntities(client: WsRpcClient, state: TuiState): Promise<SlashCommandResult> {
  if (!state.currentRealm) {
    return { output: pc.yellow("No realm selected. Use /realm <name> to select one first.") };
  }

  try {
    const response = await client.call("entity.list", { realmId: state.currentRealm.id });
    const { entities } = response.result as { entities: Array<{ id: string; name: string; type: string; summonStatus: string }> };

    if (entities.length === 0) {
      return { output: pc.dim("No entities in this realm.") };
    }

    const lines = [pc.bold(`Entities in ${state.currentRealm.name}:`)];
    for (const e of entities) {
      const summon = e.summonStatus === "active" ? pc.green("⚡") : pc.dim("○");
      lines.push(`  ${summon} ${pc.magenta(e.name)} ${pc.dim(`[${e.type}]`)} ${pc.dim(`(${e.id.slice(0, 12)}...)`)}`);
    }
    return { output: lines.join("\n") };
  } catch (err) {
    return { output: pc.red(`Failed to list entities: ${err instanceof Error ? err.message : String(err)}`) };
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
    return { output: pc.red(`Release failed: ${err instanceof Error ? err.message : String(err)}`) };
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
