import { describe, it, expect, vi, afterEach } from "vitest";
import { OllamaProvider } from "./ollama.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("OllamaProvider", () => {
  it("chat returns content and usage", async () => {
    const provider = new OllamaProvider();

    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        message: { content: "Hello" },
        model: "llama2",
        eval_count: 5,
        prompt_eval_count: 10,
      }),
    } as Response);

    const result = await provider.chat({
      model: "llama2",
      messages: [{ role: "user", content: "hi" }],
      systemPrompt: "You are helpful",
      temperature: 0.5,
      maxTokens: 100,
    });

    expect(result.content).toBe("Hello");
    expect(result.usage).toEqual({ inputTokens: 10, outputTokens: 5 });
    expect(result.model).toBe("llama2");
    expect(result.finishReason).toBe("stop");

    const callArgs = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(callArgs[0]).toBe("http://localhost:11434/api/chat");
    const body = JSON.parse(callArgs[1].body);
    expect(body.messages[0]).toEqual({ role: "system", content: "You are helpful" });
    expect(body.stream).toBe(false);
    expect(body.options.temperature).toBe(0.5);
    expect(body.options.num_predict).toBe(100);
  });

  it("chat throws on API error", async () => {
    const provider = new OllamaProvider();

    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 503,
      text: async () => "Service Unavailable",
    } as Response);

    await expect(
      provider.chat({
        model: "llama2",
        messages: [{ role: "user", content: "hi" }],
      }),
    ).rejects.toThrow("Ollama API error: 503");
  });

  it("uses custom baseUrl", async () => {
    const provider = new OllamaProvider("http://ollama.local");

    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        message: { content: "Ok" },
        model: "llama2",
      }),
    } as Response);

    await provider.chat({
      model: "llama2",
      messages: [{ role: "user", content: "hi" }],
    });

    const callArgs = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(callArgs[0]).toBe("http://ollama.local/api/chat");
  });

  describe("chatStream", () => {
    it("yields tokens and usage on success", async () => {
      const provider = new OllamaProvider();

      const chunks = [
        `{"message":{"content":"Hello"},"done":false}\n`,
        `{"message":{"content":" world"},"done":true,"prompt_eval_count":10,"eval_count":5}\n`,
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
        model: "llama2",
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
      const provider = new OllamaProvider();

      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => "Server error",
      } as unknown as Response);

      const chunks = [];
      for await (const chunk of provider.chatStream({
        model: "llama2",
        messages: [{ role: "user", content: "hi" }],
      })) {
        chunks.push(chunk);
      }

      expect(chunks[0]).toEqual({ type: "error", error: "Ollama API error: 500 Server error" });
    });

    it("yields error when no response body", async () => {
      const provider = new OllamaProvider();

      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        body: undefined,
      } as unknown as Response);

      const chunks = [];
      for await (const chunk of provider.chatStream({
        model: "llama2",
        messages: [{ role: "user", content: "hi" }],
      })) {
        chunks.push(chunk);
      }

      expect(chunks[0]).toEqual({ type: "error", error: "No response body" });
    });
  });
});
