import { describe, expect, it, vi, beforeEach } from "vitest";
import { ChannelManager } from "./channel-manager.js";
import type {
  Channel,
  MessageHandler,
  StreamingMessageHandler,
  OutgoingMessage,
} from "./channel.js";

function createMockChannel(overrides: Partial<Channel> = {}): Channel {
  return {
    name: overrides.name ?? "test",
    type: overrides.type ?? "test",
    start: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    stop: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    onMessage: vi.fn(),
    onStreamingMessage: vi.fn(),
    send: vi
      .fn<(chatId: string, msg: OutgoingMessage) => Promise<void>>()
      .mockResolvedValue(undefined),
    isRunning: vi.fn<() => boolean>().mockReturnValue(false),
    ...overrides,
  };
}

describe("ChannelManager", () => {
  let manager: ChannelManager;

  beforeEach(() => {
    manager = new ChannelManager();
  });

  describe("register / get / list", () => {
    it("registers and retrieves a channel", () => {
      const ch = createMockChannel({ name: "tg", type: "telegram" });
      manager.register("tg", ch);
      expect(manager.get("tg")).toBe(ch);
    });

    it("lists channels with type and status", () => {
      const ch = createMockChannel({ name: "tg", type: "telegram" });
      manager.register("tg", ch);
      const list = manager.list();
      expect(list).toEqual([{ name: "tg", type: "telegram", running: false }]);
    });
  });

  describe("setHandler", () => {
    it("sets handler on existing channels", () => {
      const ch = createMockChannel();
      manager.register("ch1", ch);
      const handler: MessageHandler = vi.fn();
      manager.setHandler(handler);
      expect(ch.onMessage).toHaveBeenCalledWith(handler);
    });

    it("sets handler on later-registered channels", () => {
      const handler: MessageHandler = vi.fn();
      manager.setHandler(handler);
      const ch = createMockChannel();
      manager.register("ch1", ch);
      expect(ch.onMessage).toHaveBeenCalledWith(handler);
    });
  });

  describe("setStreamingHandler", () => {
    it("sets streaming handler on channels", () => {
      const ch = createMockChannel();
      manager.register("ch1", ch);
      const streamHandler: StreamingMessageHandler = vi.fn();
      manager.setStreamingHandler(streamHandler);
      expect(ch.onStreamingMessage).toHaveBeenCalledWith(streamHandler);
    });

    it("derives basic handler from streaming handler", () => {
      const ch = createMockChannel();
      manager.register("ch1", ch);
      const streamHandler: StreamingMessageHandler = vi.fn();
      manager.setStreamingHandler(streamHandler);
      // onMessage should also have been called (with derived handler)
      expect(ch.onMessage).toHaveBeenCalled();
    });
  });

  describe("startAll / stopAll", () => {
    it("starts all channels", async () => {
      const ch1 = createMockChannel();
      const ch2 = createMockChannel();
      manager.register("ch1", ch1);
      manager.register("ch2", ch2);
      await manager.startAll();
      expect(ch1.start).toHaveBeenCalled();
      expect(ch2.start).toHaveBeenCalled();
    });

    it("stops all channels", async () => {
      const ch1 = createMockChannel();
      manager.register("ch1", ch1);
      await manager.stopAll();
      expect(ch1.stop).toHaveBeenCalled();
    });

    it("handles start failure gracefully", async () => {
      const ch = createMockChannel({
        start: vi.fn<() => Promise<void>>().mockRejectedValue(new Error("fail")),
      });
      manager.register("ch1", ch);
      // Should not throw
      await expect(manager.startAll()).resolves.toBeUndefined();
    });

    it("handles stop failure gracefully", async () => {
      const ch = createMockChannel({
        stop: vi.fn<() => Promise<void>>().mockRejectedValue(new Error("fail")),
      });
      manager.register("ch1", ch);
      await expect(manager.stopAll()).resolves.toBeUndefined();
    });
  });

  describe("loadFromConfig", () => {
    it("skips disabled channels", () => {
      manager.loadFromConfig({
        tg: {
          type: "telegram",
          enabled: false,
          allowedUsers: [],
          dmPolicy: "pairing",
          groupPolicy: "allowlist",
          streaming: "partial",
          options: {},
        },
      });
      expect(manager.list()).toEqual([]);
    });

    it("skips telegram without token", () => {
      manager.loadFromConfig({
        tg: {
          type: "telegram",
          enabled: true,
          allowedUsers: [],
          dmPolicy: "pairing",
          groupPolicy: "allowlist",
          streaming: "partial",
          options: {},
        },
      });
      expect(manager.list()).toEqual([]);
    });

    it("logs coming-soon for discord and slack", () => {
      manager.loadFromConfig({
        dc: {
          type: "discord",
          enabled: true,
          token: "tok",
          allowedUsers: [],
          dmPolicy: "pairing",
          groupPolicy: "allowlist",
          streaming: "partial",
          options: {},
        },
        sl: {
          type: "slack",
          enabled: true,
          token: "tok",
          allowedUsers: [],
          dmPolicy: "pairing",
          groupPolicy: "allowlist",
          streaming: "partial",
          options: {},
        },
      });
      // Neither should be added since adapters are not yet implemented
      expect(manager.list()).toEqual([]);
    });

    it("skips unknown channel type", () => {
      manager.loadFromConfig({
        x: {
          type: "unknown-type" as "telegram",
          enabled: true,
          allowedUsers: [],
          dmPolicy: "pairing",
          groupPolicy: "allowlist",
          streaming: "partial",
          options: {},
        },
      });
      expect(manager.list()).toEqual([]);
    });
  });
});
