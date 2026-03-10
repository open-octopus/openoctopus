import type { ChatMessage, ToolDefinition } from "@openoctopus/shared";

// ── LLM Provider Interface ──
// Aligned with OpenClaw's multi-provider pattern

export interface LlmChatRequest {
  model: string;
  messages: LlmMessage[];
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  tools?: ToolDefinition[];
}

export interface LlmMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface LlmChatResponse {
  content: string;
  toolCalls?: LlmToolCall[];
  usage: { inputTokens: number; outputTokens: number };
  model: string;
  finishReason: string;
}

export interface LlmToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface LlmStreamChunk {
  type: "token" | "tool_call" | "done" | "error";
  content?: string;
  toolCall?: LlmToolCall;
  error?: string;
  usage?: { inputTokens: number; outputTokens: number };
}

export interface LlmProvider {
  readonly name: string;
  readonly api: string;

  chat(request: LlmChatRequest): Promise<LlmChatResponse>;
  chatStream(request: LlmChatRequest): AsyncIterable<LlmStreamChunk>;
}

/** Convert ChatMessage[] to LlmMessage[] (strip extra fields) */
export function toLlmMessages(messages: ChatMessage[]): LlmMessage[] {
  return messages
    .filter((m) => m.role === "user" || m.role === "assistant" || m.role === "system")
    .map((m) => ({ role: m.role as LlmMessage["role"], content: m.content }));
}
