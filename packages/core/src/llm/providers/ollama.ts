import { createLogger } from "@openoctopus/shared";
import type { LlmProvider, LlmChatRequest, LlmChatResponse, LlmStreamChunk } from "../provider.js";

const log = createLogger("llm:ollama");

/** Ollama local model provider */
export class OllamaProvider implements LlmProvider {
  readonly name = "ollama";
  readonly api = "ollama";
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl ?? "http://localhost:11434";
  }

  async chat(request: LlmChatRequest): Promise<LlmChatResponse> {
    const body = this.buildRequestBody(request, false);

    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      log.error(`Ollama API error ${res.status}: ${text}`);
      throw new Error(`Ollama API error: ${res.status}`);
    }

    const data = (await res.json()) as {
      message: { content: string };
      model: string;
      eval_count?: number;
      prompt_eval_count?: number;
    };

    return {
      content: data.message.content,
      usage: {
        inputTokens: data.prompt_eval_count ?? 0,
        outputTokens: data.eval_count ?? 0,
      },
      model: data.model,
      finishReason: "stop",
    };
  }

  async *chatStream(request: LlmChatRequest): AsyncIterable<LlmStreamChunk> {
    const body = this.buildRequestBody(request, true);

    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      yield { type: "error", error: `Ollama API error: ${res.status} ${text}` };
      return;
    }

    const reader = res.body?.getReader();
    if (!reader) {
      yield { type: "error", error: "No response body" };
      return;
    }

    const decoder = new TextDecoder();
    let buffer = "";
    let usage = { inputTokens: 0, outputTokens: 0 };

    try {
      while (true) {
        // eslint-disable-next-line no-await-in-loop
        const { done, value } = await reader.read();
        if (done) { break; }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) { continue; }
          try {
            const event = JSON.parse(line) as {
              message?: { content?: string };
              done?: boolean;
              eval_count?: number;
              prompt_eval_count?: number;
            };

            if (event.message?.content) {
              yield { type: "token", content: event.message.content };
            }

            if (event.done) {
              usage = {
                inputTokens: event.prompt_eval_count ?? 0,
                outputTokens: event.eval_count ?? 0,
              };
            }
          } catch {
            // Skip malformed lines
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    yield { type: "done", usage };
  }

  private buildRequestBody(request: LlmChatRequest, stream: boolean): Record<string, unknown> {
    const messages = [];

    if (request.systemPrompt) {
      messages.push({ role: "system", content: request.systemPrompt });
    }

    for (const msg of request.messages) {
      messages.push({ role: msg.role, content: msg.content });
    }

    return {
      model: request.model,
      messages,
      stream,
      options: {
        ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
        ...(request.maxTokens ? { num_predict: request.maxTokens } : {}),
      },
    };
  }
}
