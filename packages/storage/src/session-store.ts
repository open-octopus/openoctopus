import fs from "node:fs";
import path from "node:path";
import { createLogger, DATA_DIR, SESSION_DIR } from "@openoctopus/shared";
import type { ChatMessage } from "@openoctopus/shared";

const log = createLogger("sessions");

export interface SessionTranscript {
  sessionId: string;
  messages: ChatMessage[];
}

function getSessionDir(dataDir?: string): string {
  const dir = path.join(dataDir ?? path.join(process.cwd(), DATA_DIR), SESSION_DIR);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getSessionPath(sessionId: string, dataDir?: string): string {
  return path.join(getSessionDir(dataDir), `${sessionId}.jsonl`);
}

export function appendMessage(sessionId: string, message: ChatMessage, dataDir?: string): void {
  const filePath = getSessionPath(sessionId, dataDir);
  const line = JSON.stringify(message) + "\n";
  fs.appendFileSync(filePath, line, "utf-8");
}

export function readTranscript(sessionId: string, dataDir?: string): SessionTranscript {
  const filePath = getSessionPath(sessionId, dataDir);

  if (!fs.existsSync(filePath)) {
    return { sessionId, messages: [] };
  }

  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.trim().split("\n").filter(Boolean);
  const messages: ChatMessage[] = [];

  for (const line of lines) {
    try {
      messages.push(JSON.parse(line) as ChatMessage);
    } catch {
      log.warn(`Skipping malformed line in session ${sessionId}`);
    }
  }

  return { sessionId, messages };
}

export function deleteTranscript(sessionId: string, dataDir?: string): boolean {
  const filePath = getSessionPath(sessionId, dataDir);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    return true;
  }
  return false;
}

export function listSessions(dataDir?: string): string[] {
  const dir = getSessionDir(dataDir);
  if (!fs.existsSync(dir)) { return []; }

  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".jsonl"))
    .map((f) => f.replace(".jsonl", ""));
}
