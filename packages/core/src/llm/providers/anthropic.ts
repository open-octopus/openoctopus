import { createLogger } from "@openoctopus/shared";
import type {
  LlmProvider,
  LlmChatRequest,
  LlmChatResponse,
  LlmStreamChunk,
  LlmMessage,
} from "../provider.js";

const log = createLogger("llm:anthropic");

/** Anthropic Messages API provider (Claude models) */
export class AnthropicProvider implements LlmProvider {
  readonly name = "anthropic";
  readonly api = "anthropic-messages";
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl?: string) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl ?? "https://api.anthropic.com";
  }

  async chat(request: LlmChatRequest): Promise<LlmChatResponse> {
    const body = this.buildRequestBody(request);

    const res = await fetch(`${this.baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      log.error(`Anthropic API error ${res.status}: ${text}`);
      throw new Error(`Anthropic API error: ${res.status}`);
    }

    const data = (await res.json()) as {
      content: Array<{ type: string; text?: string }>;
      usage: { input_tokens: number; output_tokens: number };
      model: string;
      stop_reason: string;
    };

    const content = data.content
      .filter((b) => b.type === "text")
      .map((b) => b.text ?? "")
      .join("");

    return {
      content,
      usage: { inputTokens: data.usage.input_tokens, outputTokens: data.usage.output_tokens },
      model: data.model,
      finishReason: data.stop_reason,
    };
  }

  async *chatStream(request: LlmChatRequest): AsyncIterable<LlmStreamChunk> {
    const body = { ...this.buildRequestBody(request), stream: true };

    const res = await fetch(`${this.baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      yield { type: "error", error: `Anthropic API error: ${res.status} ${text}` };
      return;
    }

    const reader = res.body?.getReader();
    if (!reader) {
      yield { type: "error", error: "No response body" };
      return;
    }

    const decoder = new TextDecoder();
    let buffer = "";
    let inputTokens = 0;
    let outputTokens = 0;

    try {
      while (true) {
        // eslint-disable-next-line no-await-in-loop
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) {
            continue;
          }
          const json = line.slice(6).trim();
          if (json === "[DONE]") {
            continue;
          }

          try {
            const event = JSON.parse(json) as Record<string, unknown>;
            const eventType = event.type as string;

            if (eventType === "content_block_delta") {
              const delta = event.delta as { type: string; text?: string };
              if (delta.type === "text_delta" && delta.text) {
                yield { type: "token", content: delta.text };
              }
            } else if (eventType === "message_delta") {
              const usage = event.usage as { output_tokens?: number } | undefined;
              if (usage?.output_tokens) {
                outputTokens = usage.output_tokens;
              }
            } else if (eventType === "message_start") {
              const message = event.message as { usage?: { input_tokens?: number } } | undefined;
              if (message?.usage?.input_tokens) {
                inputTokens = message.usage.input_tokens;
              }
            }
          } catch {
            // Skip malformed SSE lines
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    yield { type: "done", usage: { inputTokens, outputTokens } };
  }

  private buildRequestBody(request: LlmChatRequest): Record<string, unknown> {
    const messages = this.formatMessages(request.messages);
    const body: Record<string, unknown> = {
      model: request.model,
      messages,
      max_tokens: request.maxTokens ?? 4096,
    };

    if (request.systemPrompt) {
      body.system = request.systemPrompt;
    }
    if (request.temperature !== undefined) {
      body.temperature = request.temperature;
    }

    return body;
  }

  private formatMessages(messages: LlmMessage[]): Array<{ role: string; content: string }> {
    return messages
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role, content: m.content }));
  }
}
