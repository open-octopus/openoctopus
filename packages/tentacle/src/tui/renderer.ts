import pc from "picocolors";
import type { TuiState } from "./state.js";

export function renderStatusBar(state: TuiState): string {
  const parts: string[] = [];

  parts.push(state.connectionMode === "ws" ? pc.green("ws") : state.connectionMode === "http" ? pc.yellow("http") : pc.red("disconnected"));

  if (state.currentEntity) {
    parts.push(pc.magenta(`entity:${state.currentEntity.name}`));
  } else if (state.currentRealm) {
    parts.push(pc.blue(`realm:${state.currentRealm.name}`));
  } else {
    parts.push(pc.dim("auto-routing"));
  }

  if (state.sessionId) {
    parts.push(pc.dim(`session:${state.sessionId.slice(0, 12)}`));
  }

  return pc.dim("── ") + parts.join(pc.dim(" | ")) + pc.dim(" ──");
}

export function renderMessage(role: "user" | "assistant" | "error" | "system", content: string): string {
  switch (role) {
    case "user":
      return pc.dim("you> ") + content;
    case "assistant":
      return pc.cyan("assistant> ") + content;
    case "error":
      return pc.red("error> ") + content;
    case "system":
      return pc.yellow(content);
  }
}

const thinkingFrames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
let thinkingInterval: ReturnType<typeof setInterval> | undefined;

export function showThinking(): void {
  let i = 0;
  thinkingInterval = setInterval(() => {
    process.stdout.write(`\r${pc.cyan(thinkingFrames[i % thinkingFrames.length])} ${pc.dim("thinking...")}`);
    i++;
  }, 80);
}

export function clearThinking(): void {
  if (thinkingInterval) {
    clearInterval(thinkingInterval);
    thinkingInterval = undefined;
    process.stdout.write("\r\x1b[K"); // Clear line
  }
}

export function renderHelp(): string {
  const commands = [
    ["/realm [name]", "Switch realm context"],
    ["/realms", "List all realms"],
    ["/entities", "List entities in current realm"],
    ["/summon <id>", "Summon an entity"],
    ["/release", "Release summoned entity"],
    ["/status", "Show connection info"],
    ["/clear", "Clear screen"],
    ["/help", "Show this help"],
    ["/exit", "Quit"],
  ];

  const lines = [pc.bold("Commands:")];
  for (const [cmd, desc] of commands) {
    lines.push(`  ${pc.cyan(cmd.padEnd(18))} ${pc.dim(desc)}`);
  }
  return lines.join("\n");
}
