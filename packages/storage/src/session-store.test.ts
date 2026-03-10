import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { ChatMessage } from "@openoctopus/shared";
import { appendMessage, deleteTranscript, listSessions, readTranscript } from "./session-store.js";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "oo-test-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("session-store", () => {
  it("appends and reads messages", () => {
    const msg: ChatMessage = {
      role: "user",
      content: "Hello",
      timestamp: new Date().toISOString(),
    };

    appendMessage("session-1", msg, tmpDir);
    appendMessage("session-1", { role: "assistant", content: "Hi!", timestamp: new Date().toISOString() }, tmpDir);

    const transcript = readTranscript("session-1", tmpDir);
    expect(transcript.sessionId).toBe("session-1");
    expect(transcript.messages).toHaveLength(2);
    expect(transcript.messages[0].content).toBe("Hello");
    expect(transcript.messages[1].content).toBe("Hi!");
  });

  it("returns empty for missing session", () => {
    const transcript = readTranscript("nonexistent", tmpDir);
    expect(transcript.messages).toHaveLength(0);
  });

  it("lists sessions", () => {
    const msg: ChatMessage = { role: "user", content: "test", timestamp: new Date().toISOString() };
    appendMessage("session-a", msg, tmpDir);
    appendMessage("session-b", msg, tmpDir);

    const sessions = listSessions(tmpDir);
    expect(sessions).toHaveLength(2);
    expect(sessions).toContain("session-a");
    expect(sessions).toContain("session-b");
  });

  it("deletes a session", () => {
    const msg: ChatMessage = { role: "user", content: "test", timestamp: new Date().toISOString() };
    appendMessage("session-del", msg, tmpDir);
    expect(deleteTranscript("session-del", tmpDir)).toBe(true);
    expect(readTranscript("session-del", tmpDir).messages).toHaveLength(0);
    expect(deleteTranscript("session-del", tmpDir)).toBe(false);
  });
});
