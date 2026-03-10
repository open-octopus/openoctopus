import { createLogger } from "@openoctopus/shared";
import type { LlmProvider, LlmChatRequest, LlmChatResponse, LlmStreamChunk } from "../provider.js";

const log = createLogger("llm:openai");

/** OpenAI Chat Completions API provider (GPT models) */
export class OpenAIProvider implements LlmProvider {
  readonly name = "openai";
  readonly api = "openai-completions";
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl?: string) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl ?? "https://api.openai.com";
  }

  async chat(request: LlmChatRequest): Promise<LlmChatResponse> {
    const body = this.buildRequestBody(request);

    const res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      log.error(`OpenAI API error ${res.status}: ${text}`);
      throw new Error(`OpenAI API error: ${res.status}`);
    }

    const data = (await res.json()) as {
      choices: Array<{ message: { content: string }; finish_reason: string }>;
      usage: { prompt_tokens: number; completion_tokens: number };
      model: string;
    };

    const choice = data.choices[0];
    return {
      content: choice?.message.content ?? "",
      usage: { inputTokens: data.usage.prompt_tokens, outputTokens: data.usage.completion_tokens },
      model: data.model,
      finishReason: choice?.finish_reason ?? "stop",
    };
  }

  async *chatStream(request: LlmChatRequest): AsyncIterable<LlmStreamChunk> {
    const body = { ...this.buildRequestBody(request), stream: true, stream_options: { include_usage: true } };

    const res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      yield { type: "error", error: `OpenAI API error: ${res.status} ${text}` };
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
          if (!line.startsWith("data: ")) { continue; }
          const json = line.slice(6).trim();
          if (json === "[DONE]") { continue; }

          try {
            const event = JSON.parse(json) as {
              choices?: Array<{ delta?: { content?: string } }>;
              usage?: { prompt_tokens: number; completion_tokens: number };
            };

            const delta = event.choices?.[0]?.delta;
            if (delta?.content) {
              yield { type: "token", content: delta.content };
            }

            if (event.usage) {
              usage = {
                inputTokens: event.usage.prompt_tokens,
                outputTokens: event.usage.completion_tokens,
              };
            }
          } catch {
            // Skip malformed SSE lines
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    yield { type: "done", usage };
  }

  private buildRequestBody(request: LlmChatRequest): Record<string, unknown> {
    const messages = [];

    if (request.systemPrompt) {
      messages.push({ role: "system", content: request.systemPrompt });
    }

    for (const msg of request.messages) {
      messages.push({ role: msg.role, content: msg.content });
    }

    const body: Record<string, unknown> = {
      model: request.model,
      messages,
    };

    if (request.maxTokens) { body.max_tokens = request.maxTokens; }
    if (request.temperature !== undefined) { body.temperature = request.temperature; }

    return body;
  }
}
