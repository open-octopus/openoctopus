import { describe, expect, it } from "vitest";
import { StubProvider } from "./stub.js";

describe("StubProvider", () => {
  it("returns stub response in chat", async () => {
    const provider = new StubProvider();
    const result = await provider.chat({
      model: "test-model",
      messages: [{ role: "user", content: "hello" }],
    });

    expect(result.content).toContain("[Stub]");
    expect(result.content).toContain("hello");
    expect(result.content).toContain("test-model");
    expect(result.usage).toEqual({ inputTokens: 0, outputTokens: 0 });
    expect(result.finishReason).toBe("stop");
  });

  it("handles empty messages in chat", async () => {
    const provider = new StubProvider();
    const result = await provider.chat({
      model: "test-model",
      messages: [],
    });

    expect(result.content).toContain("(empty)");
  });

  it("streams response as tokens", async () => {
    const provider = new StubProvider();
    const chunks: string[] = [];
    for await (const chunk of provider.chatStream({
      model: "test-model",
      messages: [{ role: "user", content: "hi" }],
    })) {
      if (chunk.type === "token") {
        chunks.push(chunk.content ?? "");
      }
      if (chunk.type === "done") {
        expect(chunk.usage).toEqual({ inputTokens: 0, outputTokens: 0 });
      }
    }

    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.join("")).toContain("[Stub]");
  });
});
