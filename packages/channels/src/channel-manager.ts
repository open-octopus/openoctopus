import { createLogger, type ChannelConfig } from "@openoctopus/shared";
import { TelegramChannel } from "./adapters/telegram.js";
import type { Channel, MessageHandler, StreamingMessageHandler } from "./channel.js";

const log = createLogger("channels");

/**
 * Channel manager — creates, starts, and stops channel adapters.
 * Aligned with OpenClaw's ChannelManager pattern.
 */
export class ChannelManager {
  private channels = new Map<string, Channel>();
  private handler?: MessageHandler;
  private streamingHandler?: StreamingMessageHandler;

  /** Load channels from config */
  loadFromConfig(channelsConfig: Record<string, ChannelConfig>): void {
    for (const [name, config] of Object.entries(channelsConfig)) {
      if (!config.enabled) {
        log.debug(`Channel "${name}" is disabled, skipping`);
        continue;
      }

      const channel = this.createChannel(name, config);
      if (channel) {
        this.channels.set(name, channel);
        log.info(`Loaded channel: ${name} (${config.type})`);
      }
    }
  }

  private createChannel(name: string, config: ChannelConfig): Channel | undefined {
    switch (config.type) {
      case "telegram":
        if (!config.token) {
          log.warn(`Telegram channel "${name}" has no token, skipping`);
          return undefined;
        }
        return new TelegramChannel(name, config.token, config);

      case "discord":
        log.info(`Discord channel "${name}" registered (adapter coming soon)`);
        return undefined;

      case "slack":
        log.info(`Slack channel "${name}" registered (adapter coming soon)`);
        return undefined;

      case "wechat":
        log.info(`WeChat channel "${name}" registered (adapter coming soon)`);
        return undefined;

      default:
        log.warn(`Unknown channel type: ${config.type}`);
        return undefined;
    }
  }

  /** Set the basic message handler (non-streaming) */
  setHandler(handler: MessageHandler): void {
    this.handler = handler;
    for (const channel of this.channels.values()) {
      channel.onMessage(handler);
    }
  }

  /**
   * Set the streaming message handler.
   * Channels that support streaming (e.g. Telegram in "partial" mode) will use this
   * for progressive display. Also sets the basic handler as a wrapper for non-streaming channels.
   */
  setStreamingHandler(handler: StreamingMessageHandler): void {
    this.streamingHandler = handler;

    // Derive a basic handler from the streaming one (discard token callbacks)
    this.handler = (msg) => handler(msg, () => {});

    for (const channel of this.channels.values()) {
      channel.onMessage(this.handler);
      if (channel.onStreamingMessage) {
        channel.onStreamingMessage(handler);
      }
    }
  }

  /** Start all enabled channels */
  async startAll(): Promise<void> {
    const startPromises = [];
    for (const [name, channel] of this.channels) {
      startPromises.push(
        channel.start().then(
          () => log.info(`Channel started: ${name}`),
          (err) =>
            log.error(
              `Failed to start channel ${name}: ${err instanceof Error ? err.message : String(err)}`,
            ),
        ),
      );
    }
    await Promise.all(startPromises);
  }

  /** Stop all channels */
  async stopAll(): Promise<void> {
    const stopPromises = [];
    for (const [name, channel] of this.channels) {
      stopPromises.push(
        channel.stop().then(
          () => log.debug(`Channel stopped: ${name}`),
          (err) =>
            log.error(
              `Failed to stop channel ${name}: ${err instanceof Error ? err.message : String(err)}`,
            ),
        ),
      );
    }
    await Promise.all(stopPromises);
  }

  /** Get a specific channel */
  get(name: string): Channel | undefined {
    return this.channels.get(name);
  }

  /** List all loaded channels */
  list(): Array<{ name: string; type: string; running: boolean }> {
    return [...this.channels.entries()].map(([name, ch]) => ({
      name,
      type: ch.type,
      running: ch.isRunning(),
    }));
  }

  /** Register a channel manually (for testing or plugins) */
  register(name: string, channel: Channel): void {
    this.channels.set(name, channel);
    if (this.handler) {
      channel.onMessage(this.handler);
    }
    if (this.streamingHandler && channel.onStreamingMessage) {
      channel.onStreamingMessage(this.streamingHandler);
    }
  }
}
