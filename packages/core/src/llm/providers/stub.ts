import type { LlmProvider, LlmChatRequest, LlmChatResponse, LlmStreamChunk } from "../provider.js";

/** Stub provider for testing and offline use. Returns hardcoded responses. */
export class StubProvider implements LlmProvider {
  readonly name = "stub";
  readonly api = "stub";

  async chat(request: LlmChatRequest): Promise<LlmChatResponse> {
    const lastMessage = request.messages[request.messages.length - 1];
    const content =
      `[Stub] I received: "${lastMessage?.content ?? "(empty)"}". ` +
      `Model: ${request.model}. LLM integration pending — configure a provider in config.json5.`;

    return {
      content,
      usage: { inputTokens: 0, outputTokens: 0 },
      model: request.model,
      finishReason: "stop",
    };
  }

  async *chatStream(request: LlmChatRequest): AsyncIterable<LlmStreamChunk> {
    const response = await this.chat(request);
    for (const char of response.content) {
      yield { type: "token", content: char };
    }
    yield { type: "done", usage: response.usage };
  }
}
