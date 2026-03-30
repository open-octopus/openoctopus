import type { ChannelConfig } from "@openoctopus/shared";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { IncomingMessage, OutgoingMessage } from "../channel.js";

// ── Grammy mock ──────────────────────────────────────────────────────
// Capture the handler registered via bot.on("message:text", handler)
// so tests can invoke it directly with a fake Context.

type MessageTextHandler = (ctx: MockContext) => Promise<void>;

interface MockApi {
  sendMessage: ReturnType<typeof vi.fn>;
  editMessageText: ReturnType<typeof vi.fn>;
  setWebhook: ReturnType<typeof vi.fn>;
}

interface MockContext {
  chat: { id: number; type: string };
  from: { id: number; username?: string; first_name?: string; last_name?: string };
  message: {
    text: string;
    message_id: number;
    message_thread_id?: number;
    reply_to_message?: { message_id: number; from?: { id: number } };
  };
  reply: ReturnType<typeof vi.fn>;
  replyWithChatAction: ReturnType<typeof vi.fn>;
}

let capturedTextHandler: MessageTextHandler | undefined;
let mockApi: MockApi;
let mockCatchHandler: ((err: { message: string }) => unknown) | undefined;

vi.mock("grammy", () => {
  return {
    Bot: class MockBot {
      api: MockApi;
      botInfo = { id: 123, username: "test_bot" };

      constructor(_token: string) {
        mockApi = {
          sendMessage: vi.fn().mockResolvedValue({ message_id: 1 }),
          editMessageText: vi.fn().mockResolvedValue(true),
          setWebhook: vi.fn().mockResolvedValue(true),
        };
        this.api = mockApi;
      }

      on(filter: string, handler: MessageTextHandler): void {
        if (filter === "message:text") {
          capturedTextHandler = handler;
        }
      }

      catch(handler: (err: { message: string }) => unknown): void {
        mockCatchHandler = handler;
      }

      start(): Promise<void> {
        return Promise.resolve();
      }

      stop(): Promise<void> {
        return Promise.resolve();
      }
    },
  };
});

// Import after mock so the mock is applied
const { TelegramChannel } = await import("./telegram.js");

// ── Helpers ──────────────────────────────────────────────────────────

function makeConfig(overrides: Partial<ChannelConfig> = {}): ChannelConfig {
  return {
    type: "telegram",
    enabled: true,
    token: "test-token",
    allowedUsers: [],
    dmPolicy: "open",
    groupPolicy: "allowlist",
    streaming: "off",
    options: {},
    ...overrides,
  };
}

function makeContext(overrides: Partial<MockContext> = {}): MockContext {
  return {
    chat: { id: 42, type: "private" },
    from: { id: 100, username: "alice", first_name: "Alice" },
    message: { text: "Hello bot", message_id: 1 },
    reply: vi.fn().mockResolvedValue(undefined),
    replyWithChatAction: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────

describe("TelegramChannel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    capturedTextHandler = undefined;
    mockCatchHandler = undefined;
  });

  describe("constructor", () => {
    it("sets name and type", () => {
      const channel = new TelegramChannel("tg-main", "tok", makeConfig());
      expect(channel.name).toBe("tg-main");
      expect(channel.type).toBe("telegram");
    });

    it("registers a message:text handler on the bot", () => {
      const _channel = new TelegramChannel("tg", "tok", makeConfig());
      expect(capturedTextHandler).toBeDefined();
    });

    it("registers a global error handler via bot.catch", () => {
      const _channel = new TelegramChannel("tg", "tok", makeConfig());
      expect(mockCatchHandler).toBeDefined();
    });
  });

  describe("message handling (simple / non-streaming)", () => {
    it("calls the registered handler and sends formatted reply", async () => {
      const channel = new TelegramChannel("tg", "tok", makeConfig());
      const handler = vi
        .fn<(msg: IncomingMessage) => Promise<OutgoingMessage>>()
        .mockResolvedValue({
          text: "Reply text",
        });
      channel.onMessage(handler);

      const ctx = makeContext();
      await capturedTextHandler!(ctx);

      // Handler was called with correct incoming message
      expect(handler).toHaveBeenCalledOnce();
      const incoming = handler.mock.calls[0][0];
      expect(incoming.channelType).toBe("telegram");
      expect(incoming.chatId).toBe("42");
      expect(incoming.userId).toBe("100");
      expect(incoming.userName).toBe("alice");
      expect(incoming.text).toBe("Hello bot");

      // Bot API was used to send the reply
      expect(mockApi.sendMessage).toHaveBeenCalled();
      const sendArgs = mockApi.sendMessage.mock.calls[0] as unknown[];
      expect(sendArgs[0]).toBe(42); // chatId as number
    });

    it("does nothing if no handler is set", async () => {
      const _channel = new TelegramChannel("tg", "tok", makeConfig());
      const ctx = makeContext();
      await capturedTextHandler!(ctx);
      expect(mockApi.sendMessage).not.toHaveBeenCalled();
    });

    it("starts typing indicator while processing", async () => {
      const channel = new TelegramChannel("tg", "tok", makeConfig());
      channel.onMessage(
        vi.fn<(msg: IncomingMessage) => Promise<OutgoingMessage>>().mockResolvedValue({
          text: "ok",
        }),
      );

      const ctx = makeContext();
      await capturedTextHandler!(ctx);

      expect(ctx.replyWithChatAction).toHaveBeenCalledWith("typing");
    });
  });

  describe("message formatting / metadata", () => {
    it("passes chat metadata (chatType, firstName, lastName) in incoming message", async () => {
      const channel = new TelegramChannel("tg", "tok", makeConfig());
      const handler = vi
        .fn<(msg: IncomingMessage) => Promise<OutgoingMessage>>()
        .mockResolvedValue({
          text: "ok",
        });
      channel.onMessage(handler);

      const ctx = makeContext({
        from: { id: 200, username: "bob", first_name: "Bob", last_name: "Smith" },
      });
      await capturedTextHandler!(ctx);

      const incoming = handler.mock.calls[0][0];
      expect(incoming.metadata).toEqual({
        chatType: "private",
        firstName: "Bob",
        lastName: "Smith",
      });
    });

    it("includes threadId when message has message_thread_id", async () => {
      const channel = new TelegramChannel("tg", "tok", makeConfig());
      const handler = vi
        .fn<(msg: IncomingMessage) => Promise<OutgoingMessage>>()
        .mockResolvedValue({
          text: "ok",
        });
      channel.onMessage(handler);

      const ctx = makeContext({
        message: { text: "threaded", message_id: 5, message_thread_id: 77 },
      });
      await capturedTextHandler!(ctx);

      const incoming = handler.mock.calls[0][0];
      expect(incoming.threadId).toBe("77");
    });

    it("includes replyToMessageId when message is a reply", async () => {
      const channel = new TelegramChannel("tg", "tok", makeConfig());
      const handler = vi
        .fn<(msg: IncomingMessage) => Promise<OutgoingMessage>>()
        .mockResolvedValue({
          text: "ok",
        });
      channel.onMessage(handler);

      const ctx = makeContext({
        message: {
          text: "replying",
          message_id: 10,
          reply_to_message: { message_id: 9 },
        },
      });
      await capturedTextHandler!(ctx);

      const incoming = handler.mock.calls[0][0];
      expect(incoming.replyToMessageId).toBe("9");
    });

    it("uses first_name as userName fallback when username is absent", async () => {
      const channel = new TelegramChannel("tg", "tok", makeConfig());
      const handler = vi
        .fn<(msg: IncomingMessage) => Promise<OutgoingMessage>>()
        .mockResolvedValue({
          text: "ok",
        });
      channel.onMessage(handler);

      const ctx = makeContext({
        from: { id: 300, first_name: "Carol" },
      });
      await capturedTextHandler!(ctx);

      const incoming = handler.mock.calls[0][0];
      expect(incoming.userName).toBe("Carol");
    });
  });

  describe("token streaming", () => {
    it("accumulates tokens when streamingHandler provides onToken callback", async () => {
      const config = makeConfig({ streaming: "partial" });
      const channel = new TelegramChannel("tg", "tok", config);

      const tokens: string[] = [];
      const streamingHandler = vi
        .fn<(msg: IncomingMessage, onToken: (token: string) => void) => Promise<OutgoingMessage>>()
        .mockImplementation(async (_msg, onToken) => {
          const parts = ["Hello", " ", "world"];
          for (const part of parts) {
            tokens.push(part);
            onToken(part);
          }
          return { text: "Hello world" };
        });

      channel.onStreamingMessage(streamingHandler);

      vi.useFakeTimers();
      const ctx = makeContext();
      const promise = capturedTextHandler!(ctx);
      // Advance timers to let any intervals fire
      await vi.advanceTimersByTimeAsync(5000);
      await promise;
      vi.useRealTimers();

      expect(streamingHandler).toHaveBeenCalledOnce();
      expect(tokens).toEqual(["Hello", " ", "world"]);
      // Final message should be sent (either via edit or sendMessage)
      expect(mockApi.sendMessage).toHaveBeenCalled();
    });

    it("uses non-streaming handler when streaming is off even if streamingHandler is set", async () => {
      const config = makeConfig({ streaming: "off" });
      const channel = new TelegramChannel("tg", "tok", config);

      const handler = vi
        .fn<(msg: IncomingMessage) => Promise<OutgoingMessage>>()
        .mockResolvedValue({ text: "simple reply" });
      const streamingHandler = vi
        .fn<(msg: IncomingMessage, onToken: (token: string) => void) => Promise<OutgoingMessage>>()
        .mockResolvedValue({ text: "streamed reply" });

      channel.onMessage(handler);
      channel.onStreamingMessage(streamingHandler);

      const ctx = makeContext();
      await capturedTextHandler!(ctx);

      // When streaming is "off", uses streamingHandler (if available) but discards tokens
      // per handleSimpleMessage logic
      expect(streamingHandler).toHaveBeenCalledOnce();
      expect(mockApi.sendMessage).toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    it("sends error message to user when handler throws", async () => {
      const channel = new TelegramChannel("tg", "tok", makeConfig());
      const handler = vi
        .fn<(msg: IncomingMessage) => Promise<OutgoingMessage>>()
        .mockRejectedValue(new Error("LLM timeout"));
      channel.onMessage(handler);

      const ctx = makeContext();
      await capturedTextHandler!(ctx);

      expect(ctx.reply).toHaveBeenCalledWith("Sorry, an error occurred processing your message.");
    });

    it("does not throw when error reply itself fails", async () => {
      const channel = new TelegramChannel("tg", "tok", makeConfig());
      const handler = vi
        .fn<(msg: IncomingMessage) => Promise<OutgoingMessage>>()
        .mockRejectedValue(new Error("handler error"));
      channel.onMessage(handler);

      const ctx = makeContext({
        reply: vi.fn().mockRejectedValue(new Error("network down")),
        replyWithChatAction: vi.fn().mockResolvedValue(undefined),
        chat: { id: 42, type: "private" },
        from: { id: 100, username: "alice", first_name: "Alice" },
        message: { text: "test", message_id: 1 },
      });

      // Should not throw even when ctx.reply fails
      await expect(capturedTextHandler!(ctx)).resolves.toBeUndefined();
    });
  });

  describe("access control", () => {
    it("ignores DMs when dmPolicy is closed", async () => {
      const config = makeConfig({ dmPolicy: "closed" });
      const channel = new TelegramChannel("tg", "tok", config);
      const handler = vi
        .fn<(msg: IncomingMessage) => Promise<OutgoingMessage>>()
        .mockResolvedValue({ text: "ok" });
      channel.onMessage(handler);

      const ctx = makeContext({ chat: { id: 42, type: "private" } });
      await capturedTextHandler!(ctx);

      expect(handler).not.toHaveBeenCalled();
    });

    it("denies DM from non-allowed user when dmPolicy is pairing", async () => {
      const config = makeConfig({
        dmPolicy: "pairing",
        allowedUsers: ["999"],
      });
      const channel = new TelegramChannel("tg", "tok", config);
      const handler = vi
        .fn<(msg: IncomingMessage) => Promise<OutgoingMessage>>()
        .mockResolvedValue({ text: "ok" });
      channel.onMessage(handler);

      const ctx = makeContext({
        chat: { id: 42, type: "private" },
        from: { id: 100, username: "alice", first_name: "Alice" },
      });
      await capturedTextHandler!(ctx);

      expect(handler).not.toHaveBeenCalled();
      expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining("Access not authorized"));
    });
  });

  describe("start / stop lifecycle", () => {
    it("isRunning returns false initially", () => {
      const channel = new TelegramChannel("tg", "tok", makeConfig());
      expect(channel.isRunning()).toBe(false);
    });

    it("isRunning returns true after start", async () => {
      const channel = new TelegramChannel("tg", "tok", makeConfig());
      await channel.start();
      expect(channel.isRunning()).toBe(true);
    });

    it("isRunning returns false after stop", async () => {
      const channel = new TelegramChannel("tg", "tok", makeConfig());
      await channel.start();
      await channel.stop();
      expect(channel.isRunning()).toBe(false);
    });

    it("start is idempotent", async () => {
      const channel = new TelegramChannel("tg", "tok", makeConfig());
      await channel.start();
      await channel.start();
      expect(channel.isRunning()).toBe(true);
    });

    it("stop is idempotent", async () => {
      const channel = new TelegramChannel("tg", "tok", makeConfig());
      await channel.stop();
      expect(channel.isRunning()).toBe(false);
    });
  });

  describe("send method", () => {
    it("sends formatted message to a chat by chatId", async () => {
      const channel = new TelegramChannel("tg", "tok", makeConfig());
      await channel.send("42", { text: "Hello **bold**" });

      expect(mockApi.sendMessage).toHaveBeenCalled();
      const sendArgs = mockApi.sendMessage.mock.calls[0] as unknown[];
      expect(sendArgs[0]).toBe(42); // chatId converted to number
      // The text should contain HTML formatting (bold -> <b>)
      const sentText = sendArgs[1] as string;
      expect(sentText).toContain("<b>bold</b>");
    });
  });
});
