import type { AgentConfig, ChatMessage } from "@openoctopus/shared";
import { createLogger, generateId } from "@openoctopus/shared";
import { LlmProviderRegistry } from "./llm/provider-registry.js";
import { toLlmMessages } from "./llm/provider.js";
import type { LlmStreamChunk } from "./llm/provider.js";

const log = createLogger("agent-runner");

export interface AgentRunOptions {
  agent: AgentConfig;
  messages: ChatMessage[];
  systemPrompt?: string;
  onToken?: (token: string) => void;
}

export interface AgentRunResult {
  sessionId: string;
  response: ChatMessage;
  tokensUsed?: { input: number; output: number };
}

export class AgentRunner {
  private registry: LlmProviderRegistry;

  constructor(registry?: LlmProviderRegistry) {
    this.registry = registry ?? new LlmProviderRegistry();
  }

  async run(options: AgentRunOptions): Promise<AgentRunResult> {
    const { agent, messages, systemPrompt, onToken } = options;
    const sessionId = generateId("session");

    log.info(`Running agent: ${agent.name} (${agent.id}) tier=${agent.tier}`);

    const prompt = this.buildPrompt(agent, messages, systemPrompt);
    const provider = this.registry.getProvider();
    const model = this.registry.resolveModel(undefined, agent.model);


    const llmMessages = toLlmMessages(messages);

    let responseText: string;
    let tokensUsed: { input: number; output: number } | undefined;

    if (onToken) {
      // Streaming mode
      responseText = "";
      for await (const chunk of provider.chatStream({
        model,
        messages: llmMessages,
        systemPrompt: prompt,
      })) {
        if (chunk.type === "token" && chunk.content) {
          responseText += chunk.content;
          onToken(chunk.content);
        } else if (chunk.type === "error") {
          log.error(`LLM stream error: ${chunk.error}`);
          throw new Error(chunk.error ?? "LLM stream failed");
        } else if (chunk.type === "done" && chunk.usage) {
          tokensUsed = { input: chunk.usage.inputTokens, output: chunk.usage.outputTokens };
        }
      }
    } else {
      // Non-streaming mode
      const result = await provider.chat({
        model,
        messages: llmMessages,
        systemPrompt: prompt,
      });
      responseText = result.content;
      tokensUsed = { input: result.usage.inputTokens, output: result.usage.outputTokens };
    }

    const response: ChatMessage = {
      role: "assistant",
      content: responseText,
      name: agent.name,
      timestamp: new Date().toISOString(),
    };

    return { sessionId, response, tokensUsed };
  }

  /** Stream tokens as async iterable (for WebSocket RPC) */
  async *runStream(options: Omit<AgentRunOptions, "onToken">): AsyncIterable<LlmStreamChunk & { sessionId: string }> {
    const { agent, messages, systemPrompt } = options;
    const sessionId = generateId("session");

    log.info(`Streaming agent: ${agent.name} (${agent.id}) tier=${agent.tier}`);

    const prompt = this.buildPrompt(agent, messages, systemPrompt);
    const provider = this.registry.getProvider();
    const model = this.registry.resolveModel(undefined, agent.model);

    const llmMessages = toLlmMessages(messages);

    for await (const chunk of provider.chatStream({
      model,
      messages: llmMessages,
      systemPrompt: prompt,
    })) {
      yield { ...chunk, sessionId };
    }
  }

  private buildPrompt(agent: AgentConfig, _messages: ChatMessage[], systemPrompt?: string): string {
    const parts: string[] = [];

    if (systemPrompt) {
      parts.push(systemPrompt);
    }

    if (agent.personality) {
      parts.push(`You are ${agent.name}. ${agent.personality}`);
    } else {
      parts.push(`You are ${agent.name}, an AI assistant in the ${agent.tier} tier.`);
    }

    return parts.join("\n\n");
  }
}
