import { describe, it, expect, vi, afterEach } from "vitest";
import { OpenAIProvider } from "./openai.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("OpenAIProvider", () => {
  it("chat returns content and usage", async () => {
    const provider = new OpenAIProvider("test-key");

    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "Hello" }, finish_reason: "stop" }],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
        model: "gpt-4",
      }),
    } as Response);

    const result = await provider.chat({
      model: "gpt-4",
      messages: [{ role: "user", content: "hi" }],
      systemPrompt: "You are helpful",
      temperature: 0.5,
      maxTokens: 100,
    });

    expect(result.content).toBe("Hello");
    expect(result.usage).toEqual({ inputTokens: 10, outputTokens: 5 });
    expect(result.model).toBe("gpt-4");
    expect(result.finishReason).toBe("stop");

    const callArgs = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(callArgs[0]).toBe("https://api.openai.com/v1/chat/completions");
    const body = JSON.parse(callArgs[1].body);
    expect(body.messages[0]).toEqual({ role: "system", content: "You are helpful" });
    expect(body.temperature).toBe(0.5);
    expect(body.max_tokens).toBe(100);
  });

  it("chat throws on API error", async () => {
    const provider = new OpenAIProvider("test-key");

    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => "Unauthorized",
    } as Response);

    await expect(
      provider.chat({
        model: "gpt-4",
        messages: [{ role: "user", content: "hi" }],
      }),
    ).rejects.toThrow("OpenAI API error: 401");
  });

  it("uses custom baseUrl", async () => {
    const provider = new OpenAIProvider("test-key", "https://custom.com/v1");

    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "Ok" }, finish_reason: "stop" }],
        usage: { prompt_tokens: 1, completion_tokens: 1 },
        model: "gpt-4",
      }),
    } as Response);

    await provider.chat({
      model: "gpt-4",
      messages: [{ role: "user", content: "hi" }],
    });

    const callArgs = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(callArgs[0]).toBe("https://custom.com/v1/chat/completions");
  });

  describe("chatStream", () => {
    it("yields tokens and usage on success", async () => {
      const provider = new OpenAIProvider("test-key");

      const chunks = [
        `data: {"choices":[{"delta":{"content":"Hello"}}],"usage":null}\n\n`,
        `data: {"choices":[{"delta":{"content":" world"}}],"usage":{"prompt_tokens":10,"completion_tokens":5}}\n\n`,
        `data: [DONE]\n\n`,
      ];
      let idx = 0;
      const stream = new ReadableStream({
        pull(controller) {
          if (idx < chunks.length) {
            controller.enqueue(new TextEncoder().encode(chunks[idx++]));
          } else {
            controller.close();
          }
        },
      });

      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        body: stream,
      } as unknown as Response);

      const result = [];
      for await (const chunk of provider.chatStream({
        model: "gpt-4",
        messages: [{ role: "user", content: "hi" }],
      })) {
        result.push(chunk);
      }

      expect(result).toEqual([
        { type: "token", content: "Hello" },
        { type: "token", content: " world" },
        { type: "done", usage: { inputTokens: 10, outputTokens: 5 } },
      ]);
    });

    it("yields error on API failure", async () => {
      const provider = new OpenAIProvider("test-key");

      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: false,
        status: 429,
        text: async () => "Rate limited",
      } as unknown as Response);

      const chunks = [];
      for await (const chunk of provider.chatStream({
        model: "gpt-4",
        messages: [{ role: "user", content: "hi" }],
      })) {
        chunks.push(chunk);
      }

      expect(chunks[0]).toEqual({ type: "error", error: "OpenAI API error: 429 Rate limited" });
    });

    it("yields error when no response body", async () => {
      const provider = new OpenAIProvider("test-key");

      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        body: undefined,
      } as unknown as Response);

      const chunks = [];
      for await (const chunk of provider.chatStream({
        model: "gpt-4",
        messages: [{ role: "user", content: "hi" }],
      })) {
        chunks.push(chunk);
      }

      expect(chunks[0]).toEqual({ type: "error", error: "No response body" });
    });
  });
});
