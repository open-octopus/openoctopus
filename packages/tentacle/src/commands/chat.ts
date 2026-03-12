import { defineCommand } from "citty";
import consola from "consola";
import readline from "node:readline";
import { WsRpcClient, ApiClient } from "../api-client.js";
import { createInitialState } from "../tui/state.js";
import { renderStatusBar, renderMessage, renderWelcomeDashboard, showThinking, clearThinking, renderSummonSuggestion } from "../tui/renderer.js";
import { handleSlashCommand } from "../tui/commands.js";

export const chatCommand = defineCommand({
  meta: {
    name: "chat",
    description: "Start a chat session",
  },
  args: {
    realm: {
      type: "string",
      description: "Target realm ID",
      alias: "r",
    },
    entity: {
      type: "string",
      description: "Target entity ID (must be summoned)",
      alias: "e",
    },
    http: {
      type: "boolean",
      description: "Force HTTP mode (no WebSocket streaming)",
      default: false,
    },
  },
  async run({ args }) {
    // Try WebSocket RPC first, fall back to HTTP
    if (!args.http) {
      const wsClient = new WsRpcClient();
      const connected = await wsClient.tryConnect();

      if (connected) {
        await runWsChat(wsClient, args);
        return;
      }

      consola.debug("WebSocket not available, falling back to HTTP");
    }

    // HTTP fallback
    const client = new ApiClient();
    const alive = await client.healthCheck();
    if (!alive) {
      consola.error('OpenOctopus is not running. Start it with "pnpm tentacle start"');
      process.exit(1);
    }

    await runHttpChat(client, args);
  },
});

// ── WebSocket RPC Chat (streaming + TUI) ──

async function runWsChat(
  client: WsRpcClient,
  args: { realm?: string; entity?: string },
): Promise<void> {
  const state = createInitialState("ws");

  // Set initial context from args
  if (args.entity) {
    state.currentEntity = { id: args.entity, name: args.entity };
  } else if (args.realm) {
    state.currentRealm = { id: args.realm, name: args.realm };
  }

  // Listen for broadcast events (maturity suggestions, cross-realm reactions)
  client.onEvent((event, data) => {
    if (event === "maturity.suggestion" && data) {
      const s = data as { entityName: string; realmName: string; maturityScore: number; entityId: string };
      process.stdout.write(`\n${renderSummonSuggestion(s)}\n`);
    }
    if (event === "maturity.progress" && data) {
      const p = data as { entityName: string; realmName: string; score: number; missing: string[]; message: string };
      const bar = "\u2588".repeat(Math.floor(p.score / 5)) + "\u2591".repeat(20 - Math.floor(p.score / 5));
      process.stdout.write(`\n  ${p.entityName} (${p.realmName}): [${bar}] ${p.score}/100\n`);
      if (p.missing.length > 0) {
        process.stdout.write(`     Missing: ${p.missing.join(", ")}\n`);
      }
      process.stdout.write(`     ${p.message}\n`);
    }
    if (event === "crossrealm.reaction" && data) {
      const r = data as { targetRealmName: string; agentName: string; content: string };
      process.stdout.write(`\n  ${renderMessage("system", `${r.agentName} (${r.targetRealmName}): ${r.content}`)}\n`);
    }
  });

  // Fetch realms for welcome dashboard
  try {
    const realmResponse = await client.call("realm.list");
    const { realms } = realmResponse.result as { realms: Array<{ id: string; name: string; icon?: string; entityCount: number; status: string; description?: string; agentName?: string }> };
    state.realms = realms.map((r) => ({ id: r.id, name: r.name, icon: r.icon, description: r.description, entityCount: r.entityCount, status: r.status, agentName: r.agentName }));
    console.log(renderWelcomeDashboard(state.realms));
  } catch {
    console.log(renderStatusBar(state));
    console.log(renderMessage("system", 'Chat session started. Type /help for commands, /exit to quit.\n'));
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
    historySize: 100,
  });

  // Handle SIGINT gracefully — cancel streaming or exit
  let abortController: AbortController | undefined;

  process.on("SIGINT", () => {
    if (state.isStreaming) {
      // Cancel current stream
      clearThinking();
      abortController?.abort();
      state.isStreaming = false;
      process.stdout.write("\n");
      consola.info("Stream cancelled.");
      promptUser();
    } else {
      console.log("\n" + renderMessage("system", "Goodbye!"));
      rl.close();
      client.disconnect().then(() => process.exit(0));
    }
  });

  const promptUser = (): void => {
    rl.question("you> ", async (input) => {
      const message = input.trim();

      if (!message) {
        promptUser();
        return;
      }

      // Slash commands
      if (message.startsWith("/")) {
        const result = await handleSlashCommand(message, client, state);

        if (result.output) {
          console.log(result.output);
        }

        if (result.stateUpdate) {
          Object.assign(state, result.stateUpdate);

          // Handle /exit
          if (state.connectionMode === "disconnected") {
            rl.close();
            await client.disconnect();
            return;
          }
        }

        promptUser();
        return;
      }

      // Chat message
      state.isStreaming = true;
      abortController = new AbortController();
      let hasTokens = false;

      showThinking();

      try {
        const chatOptions: { sessionId?: string; realmId?: string; entityId?: string } = {
          sessionId: state.sessionId,
        };

        if (state.currentEntity) {
          chatOptions.entityId = state.currentEntity.id;
        } else if (state.currentRealm) {
          chatOptions.realmId = state.currentRealm.id;
        }

        const response = await client.chat(
          message,
          chatOptions,
          (token) => {
            if (!hasTokens) {
              clearThinking();
              process.stdout.write(renderMessage("assistant", ""));
              hasTokens = true;
            }
            process.stdout.write(token);
          },
        );

        if (!hasTokens) {
          clearThinking();
        }

        process.stdout.write("\n\n");

        if (response.result) {
          const result = response.result as { sessionId?: string };
          state.sessionId = result.sessionId;
        }

        if (response.error) {
          console.log(renderMessage("error", response.error.message));
        }
      } catch (err) {
        clearThinking();
        if (!hasTokens) {
          process.stdout.write("\n");
        }
        console.log(renderMessage("error", err instanceof Error ? err.message : "Chat failed"));
      }

      state.isStreaming = false;
      abortController = undefined;

      // Show status bar periodically
      console.log(renderStatusBar(state));
      promptUser();
    });
  };

  promptUser();
}

// ── HTTP Chat (non-streaming fallback) ──

async function runHttpChat(
  client: ApiClient,
  args: { realm?: string; entity?: string },
): Promise<void> {
  let endpoint = "/api/chat";
  const state = createInitialState("http");

  if (args.entity) {
    endpoint = `/api/chat/entity/${args.entity}`;
    state.currentEntity = { id: args.entity, name: args.entity };
  } else if (args.realm) {
    endpoint = `/api/chat/realm/${args.realm}`;
    state.currentRealm = { id: args.realm, name: args.realm };
  }

  console.log(renderStatusBar(state));
  console.log(renderMessage("system", 'Chat session started via HTTP. Type "exit" to quit.\n'));

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
    historySize: 100,
  });

  const promptUser = (): void => {
    rl.question("you> ", async (input) => {
      const message = input.trim();
      if (!message || message === "exit" || message === "quit") {
        console.log(renderMessage("system", "Goodbye!"));
        rl.close();
        return;
      }

      try {
        const result = await client.post<{
          data: {
            sessionId: string;
            message: { content: string; name?: string };
            routing?: { targetRealmId?: string; confidence?: number };
            realm?: { name: string };
            entity?: { name: string };
          };
        }>(endpoint, { message, sessionId: state.sessionId });

        state.sessionId = result.data.sessionId;
        console.log(renderMessage("assistant", `${result.data.message.content}\n`));
      } catch (err) {
        console.log(renderMessage("error", err instanceof Error ? err.message : "Chat failed"));
      }

      promptUser();
    });
  };

  promptUser();
}
