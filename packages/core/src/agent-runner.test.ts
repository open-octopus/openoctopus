import { describe, expect, it, vi, beforeEach } from "vitest";
import { AgentRunner } from "./agent-runner.js";

describe("AgentRunner", () => {
  const mockProvider = {
    chat: vi.fn(),
    chatStream: vi.fn(),
  };

  const mockRegistry = {
    getProvider: vi.fn().mockReturnValue(mockProvider),
    resolveModel: vi.fn().mockReturnValue("claude-sonnet-4-6"),
    hasRealProvider: vi.fn().mockReturnValue(true),
    listProviders: vi.fn().mockReturnValue(["mock"]),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("runs agent in non-streaming mode", async () => {
    mockProvider.chat.mockResolvedValue({
      content: "Hello!",
      usage: { inputTokens: 10, outputTokens: 5 },
    });

    const runner = new AgentRunner(
      mockRegistry as unknown as ConstructorParameters<typeof AgentRunner>[0],
    );
    const result = await runner.run({
      agent: {
        id: "agent_1",
        realmId: "realm_test",
        tier: "realm",
        name: "Helper",
        model: "claude-sonnet-4-6",
        skills: [],
        proactive: false,
      },
      messages: [{ role: "user", content: "hi", timestamp: new Date().toISOString() }],
    });

    expect(result.response.content).toBe("Hello!");
    expect(result.response.role).toBe("assistant");
    expect(result.tokensUsed).toEqual({ input: 10, output: 5 });
    expect(result.sessionId).toMatch(/^session_/);
  });

  it("builds prompt with personality", async () => {
    mockProvider.chat.mockResolvedValue({
      content: "ok",
      usage: { inputTokens: 1, outputTokens: 1 },
    });

    const runner = new AgentRunner(
      mockRegistry as unknown as ConstructorParameters<typeof AgentRunner>[0],
    );
    await runner.run({
      agent: {
        id: "agent_1",
        realmId: "realm_test",
        tier: "realm",
        name: "Helper",
        model: "claude-sonnet-4-6",
        skills: [],
        proactive: false,
        personality: "You are friendly",
      },
      messages: [{ role: "user", content: "hi", timestamp: new Date().toISOString() }],
    });

    const callArgs = mockProvider.chat.mock.calls[0][0];
    expect(callArgs.systemPrompt).toContain("You are Helper. You are friendly");
  });

  it("uses default personality when none provided", async () => {
    mockProvider.chat.mockResolvedValue({
      content: "ok",
      usage: { inputTokens: 1, outputTokens: 1 },
    });

    const runner = new AgentRunner(
      mockRegistry as unknown as ConstructorParameters<typeof AgentRunner>[0],
    );
    await runner.run({
      agent: {
        id: "agent_1",
        realmId: "realm_test",
        tier: "realm",
        name: "Helper",
        model: "claude-sonnet-4-6",
        skills: [],
        proactive: false,
      },
      messages: [{ role: "user", content: "hi", timestamp: new Date().toISOString() }],
    });

    const callArgs = mockProvider.chat.mock.calls[0][0];
    expect(callArgs.systemPrompt).toContain("You are Helper, an AI assistant in the realm tier.");
  });

  it("runs in streaming mode with onToken", async () => {
    mockProvider.chatStream.mockImplementation(async function* () {
      yield { type: "token", content: "H" };
      yield { type: "token", content: "i" };
      yield { type: "done", usage: { inputTokens: 2, outputTokens: 2 } };
    });

    const runner = new AgentRunner(
      mockRegistry as unknown as ConstructorParameters<typeof AgentRunner>[0],
    );
    const tokens: string[] = [];
    const result = await runner.run({
      agent: {
        id: "agent_1",
        realmId: "realm_test",
        tier: "realm",
        name: "Helper",
        model: "claude-sonnet-4-6",
        skills: [],
        proactive: false,
      },
      messages: [{ role: "user", content: "hi", timestamp: new Date().toISOString() }],
      onToken: (token: string) => tokens.push(token),
    });

    expect(tokens).toEqual(["H", "i"]);
    expect(result.response.content).toBe("Hi");
  });

  it("throws on stream error", async () => {
    mockProvider.chatStream.mockImplementation(async function* () {
      yield { type: "token", content: "H" };
      yield { type: "error", error: "Stream broke" };
    });

    const runner = new AgentRunner(
      mockRegistry as unknown as ConstructorParameters<typeof AgentRunner>[0],
    );

    await expect(
      runner.run({
        agent: {
          id: "agent_1",
          realmId: "realm_test",
          tier: "realm",
          name: "Helper",
          model: "claude-sonnet-4-6",
          skills: [],
          proactive: false,
        },
        messages: [{ role: "user", content: "hi", timestamp: new Date().toISOString() }],
        onToken: () => {},
      }),
    ).rejects.toThrow("Stream broke");
  });

  it("runStream yields chunks with sessionId", async () => {
    mockProvider.chatStream.mockImplementation(async function* () {
      yield { type: "token", content: "A" };
      yield { type: "done", usage: { inputTokens: 1, outputTokens: 1 } };
    });

    const runner = new AgentRunner(
      mockRegistry as unknown as ConstructorParameters<typeof AgentRunner>[0],
    );
    const chunks: Array<{ type: string; sessionId: string }> = [];
    for await (const chunk of runner.runStream({
      agent: {
        id: "agent_1",
        realmId: "realm_test",
        tier: "realm",
        name: "Helper",
        model: "claude-sonnet-4-6",
        skills: [],
        proactive: false,
      },
      messages: [{ role: "user", content: "hi", timestamp: new Date().toISOString() }],
    })) {
      chunks.push(chunk);
    }

    expect(chunks.length).toBe(2);
    expect(chunks[0].type).toBe("token");
    expect(chunks[0].sessionId).toMatch(/^session_/);
  });
});
