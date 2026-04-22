import { describe, it, expect, vi, afterEach } from "vitest";
import { AnthropicProvider } from "./anthropic.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("AnthropicProvider", () => {
  it("chat returns content and usage", async () => {
    const provider = new AnthropicProvider("test-key");

    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ type: "text", text: "Hello" }],
        usage: { input_tokens: 10, output_tokens: 5 },
        model: "claude-3",
        stop_reason: "end_turn",
      }),
    } as Response);

    const result = await provider.chat({
      model: "claude-3",
      messages: [{ role: "user", content: "hi" }],
      systemPrompt: "You are helpful",
      temperature: 0.5,
      maxTokens: 100,
    });

    expect(result.content).toBe("Hello");
    expect(result.usage).toEqual({ inputTokens: 10, outputTokens: 5 });
    expect(result.model).toBe("claude-3");
    expect(result.finishReason).toBe("end_turn");

    const callArgs = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(callArgs[0]).toBe("https://api.anthropic.com/v1/messages");
    const body = JSON.parse(callArgs[1].body);
    expect(body.system).toBe("You are helpful");
    expect(body.temperature).toBe(0.5);
    expect(body.max_tokens).toBe(100);
  });

  it("chat throws on API error", async () => {
    const provider = new AnthropicProvider("test-key");

    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "Internal error",
    } as Response);

    await expect(
      provider.chat({
        model: "claude-3",
        messages: [{ role: "user", content: "hi" }],
      }),
    ).rejects.toThrow("Anthropic API error: 500");
  });

  it("uses custom baseUrl", async () => {
    const provider = new AnthropicProvider("test-key", "https://custom.com");

    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ type: "text", text: "Ok" }],
        usage: { input_tokens: 1, output_tokens: 1 },
        model: "claude-3",
        stop_reason: "stop",
      }),
    } as Response);

    await provider.chat({
      model: "claude-3",
      messages: [{ role: "user", content: "hi" }],
    });

    const callArgs = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(callArgs[0]).toBe("https://custom.com/v1/messages");
  });

  it("filters system messages from request", async () => {
    const provider = new AnthropicProvider("test-key");

    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ type: "text", text: "Ok" }],
        usage: { input_tokens: 1, output_tokens: 1 },
        model: "claude-3",
        stop_reason: "stop",
      }),
    } as Response);

    await provider.chat({
      model: "claude-3",
      messages: [
        { role: "system", content: "sys" },
        { role: "user", content: "hi" },
      ],
      systemPrompt: "You are helpful",
    });

    const callArgs = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(callArgs[1].body);
    expect(body.messages).toEqual([{ role: "user", content: "hi" }]);
    expect(body.system).toBe("You are helpful");
  });

  describe("chatStream", () => {
    it("yields tokens and usage on success", async () => {
      const provider = new AnthropicProvider("test-key");

      const chunks = [
        `data: {"type":"message_start","message":{"usage":{"input_tokens":10}}}\n\n`,
        `data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello"}}\n\n`,
        `data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":" world"}}\n\n`,
        `data: {"type":"message_delta","usage":{"output_tokens":5}}\n\n`,
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
        model: "claude-3",
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
      const provider = new AnthropicProvider("test-key");

      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: false,
        status: 503,
        text: async () => "Unavailable",
      } as unknown as Response);

      const chunks = [];
      for await (const chunk of provider.chatStream({
        model: "claude-3",
        messages: [{ role: "user", content: "hi" }],
      })) {
        chunks.push(chunk);
      }

      expect(chunks[0]).toEqual({ type: "error", error: "Anthropic API error: 503 Unavailable" });
    });

    it("yields error when no response body", async () => {
      const provider = new AnthropicProvider("test-key");

      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        body: undefined,
      } as unknown as Response);

      const chunks = [];
      for await (const chunk of provider.chatStream({
        model: "claude-3",
        messages: [{ role: "user", content: "hi" }],
      })) {
        chunks.push(chunk);
      }

      expect(chunks[0]).toEqual({ type: "error", error: "No response body" });
    });
  });
});
