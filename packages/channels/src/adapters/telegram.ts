import { Bot, type Context } from "grammy";
import type { Message } from "grammy/types";
import { createLogger, type ChannelConfig } from "@openoctopus/shared";
import type { Channel, IncomingMessage, OutgoingMessage, MessageHandler, StreamingMessageHandler } from "../channel.js";
import {
  markdownToTelegramHtml,
  splitMessage,
  stripHtml,
  isParseError,
  isMessageNotModified,
  isMessageNotFound,
} from "./telegram-format.js";

const log = createLogger("channel:telegram");

/** Streaming edit throttle interval (ms) */
const EDIT_THROTTLE_MS = 1000;

/** Minimum chars before sending first streaming message */
const MIN_INITIAL_CHARS = 10;

/** Typing indicator repeat interval (Telegram shows typing for ~5s) */
const TYPING_INTERVAL_MS = 4000;

/**
 * Telegram channel adapter using grammY.
 *
 * Features (aligned with OpenClaw):
 * - Long-polling (default) or webhook mode
 * - Streaming responses via progressive message editing ("partial" mode)
 * - Markdown → Telegram HTML conversion with parse-error fallback
 * - Long message splitting (4096 char limit)
 * - Typing indicator while processing
 * - Per-chat message sequentialization (prevent race conditions)
 * - DM/group access control policies
 * - @mention stripping in group messages
 */
export class TelegramChannel implements Channel {
  readonly name: string;
  readonly type = "telegram";

  private bot: Bot;
  private config: ChannelConfig;
  private handler?: MessageHandler;
  private streamingHandler?: StreamingMessageHandler;
  private running = false;
  private chatLocks = new Map<string, Promise<void>>();

  constructor(name: string, token: string, config: ChannelConfig) {
    this.name = name;
    this.config = config;
    this.bot = new Bot(token);

    // Wire text message handler
    this.bot.on("message:text", async (ctx) => {
      if (!this.handler && !this.streamingHandler) { return; }

      // Access control
      if (!this.checkAccess(ctx)) { return; }

      // Sequentialize: one handler per chat at a time
      const chatId = String(ctx.chat.id);
      await this.withChatLock(chatId, () => this.handleMessage(ctx));
    });

    // Global error handler
    this.bot.catch((err) => {
      log.error(`Bot error: ${err.message}`);
    });
  }

  onMessage(handler: MessageHandler): void {
    this.handler = handler;
  }

  onStreamingMessage(handler: StreamingMessageHandler): void {
    this.streamingHandler = handler;
  }

  async start(): Promise<void> {
    if (this.running) { return; }

    const webhookConfig = this.config.webhook;
    if (webhookConfig?.url) {
      await this.bot.api.setWebhook(webhookConfig.url, {
        secret_token: webhookConfig.secret,
      });
      log.info(`Telegram bot started (webhook: ${webhookConfig.url})`);
    } else {
      this.bot.start({
        onStart: (botInfo) => {
          log.info(`Telegram bot @${botInfo.username} started (long-polling)`);
        },
      });
    }

    this.running = true;
  }

  async stop(): Promise<void> {
    if (!this.running) { return; }
    await this.bot.stop();
    this.running = false;
    log.info("Telegram bot stopped");
  }

  async send(chatId: string, message: OutgoingMessage): Promise<void> {
    const html = markdownToTelegramHtml(message.text);
    const chunks = splitMessage(html);

    for (const chunk of chunks) {
      // eslint-disable-next-line no-await-in-loop -- chunks must be sent sequentially to preserve order
      await this.sendHtml(Number(chatId), chunk, {
        replyToMessageId: message.replyToMessageId ? Number(message.replyToMessageId) : undefined,
      });
    }
  }

  isRunning(): boolean {
    return this.running;
  }

  // ── Access Control ──────────────────────────────────────────────

  private checkAccess(ctx: Context): boolean {
    const userId = String(ctx.from?.id);

    // DM policy
    if (ctx.chat?.type === "private") {
      if (this.config.dmPolicy === "closed") {
        log.debug(`Ignoring DM from ${userId} (policy: closed)`);
        return false;
      }
      if (
        this.config.dmPolicy === "pairing" &&
        this.config.allowedUsers.length > 0 &&
        !this.config.allowedUsers.includes(userId)
      ) {
        ctx.reply("Access not authorized. Contact the admin to add your user ID.").catch(() => {});
        return false;
      }
      return true;
    }

    // Group policy
    if (ctx.chat?.type === "group" || ctx.chat?.type === "supergroup") {
      if (this.config.groupPolicy === "allowlist") {
        const chatId = String(ctx.chat.id);
        const allowedGroups = (this.config.options.allowedGroups ?? []) as string[];
        if (allowedGroups.length > 0 && !allowedGroups.includes(chatId)) {
          log.debug(`Ignoring message from unallowed group ${chatId}`);
          return false;
        }
      }

      // In groups, only respond to @mentions or replies to bot
      const botUsername = this.bot.botInfo?.username;
      const text = ctx.message?.text ?? "";
      const isReplyToBot = ctx.message?.reply_to_message?.from?.id === this.bot.botInfo?.id;
      const isMention = botUsername ? text.includes(`@${botUsername}`) : false;

      if (!isReplyToBot && !isMention) { return false; }
    }

    return true;
  }

  // ── Message Handling ────────────────────────────────────────────

  private async handleMessage(ctx: Context): Promise<void> {
    const incoming = this.buildIncoming(ctx);
    const useStreaming = this.config.streaming === "partial" && !!this.streamingHandler;

    // Start typing indicator
    const stopTyping = this.startTyping(ctx);

    try {
      if (useStreaming) {
        await this.handleStreamingMessage(ctx, incoming);
      } else {
        await this.handleSimpleMessage(ctx, incoming);
      }
    } catch (err) {
      log.error(`Error handling message: ${err instanceof Error ? err.message : String(err)}`);
      await this.safeSend(ctx, "Sorry, an error occurred processing your message.");
    } finally {
      stopTyping();
    }
  }

  /** Non-streaming: wait for full response, send formatted message */
  private async handleSimpleMessage(ctx: Context, incoming: IncomingMessage): Promise<void> {
    let response: OutgoingMessage;

    if (this.streamingHandler) {
      // Use streaming handler but discard token callbacks
      response = await this.streamingHandler(incoming, () => {});
    } else {
      response = await this.handler!(incoming);
    }

    await this.sendFormattedReply(ctx, response.text);
  }

  /**
   * Streaming: send initial message, progressively edit with tokens, final formatted edit.
   *
   * Pattern (aligned with OpenClaw's draft-stream):
   * 1. Accumulate tokens from LLM stream
   * 2. Every EDIT_THROTTLE_MS, edit the message with accumulated text + cursor "▌"
   * 3. On completion, final edit with full Markdown→HTML formatted response
   */
  private async handleStreamingMessage(ctx: Context, incoming: IncomingMessage): Promise<void> {
    const chatId = ctx.chat!.id;
    const replyToId = ctx.message!.message_id;
    let messageId: number | undefined;
    let accumulated = "";
    let lastSentLength = 0;
    let editing = false;

    // Periodic edit interval for streaming updates
    const intervalId = setInterval(async () => {
      if (editing) { return; }
      if (accumulated.length === lastSentLength) { return; }
      if (accumulated.length < MIN_INITIAL_CHARS && !messageId) { return; }

      editing = true;
      const text = accumulated + " ▌";
      lastSentLength = accumulated.length;

      try {
        if (!messageId) {
          // Send initial message (plain text — Markdown may be incomplete)
          const sent = await this.bot.api.sendMessage(chatId, text, {
            reply_parameters: { message_id: replyToId },
          });
          messageId = sent.message_id;
        } else {
          // Edit with accumulated text (plain text — avoid parse errors on partial MD)
          await this.bot.api.editMessageText(chatId, messageId, text);
        }
      } catch (err) {
        if (!isMessageNotModified(err) && !isMessageNotFound(err)) {
          log.debug(`Streaming edit error: ${err instanceof Error ? err.message : String(err)}`);
        }
      } finally {
        editing = false;
      }
    }, EDIT_THROTTLE_MS);

    try {
      const response = await this.streamingHandler!(incoming, (token) => {
        accumulated += token;
      });

      clearInterval(intervalId);

      // Final: convert full response to formatted HTML
      const finalText = response.text || accumulated;
      const html = markdownToTelegramHtml(finalText);
      const chunks = splitMessage(html);

      if (messageId) {
        // Edit existing message with formatted HTML
        await this.editMessageHtml(chatId, messageId, chunks[0]);
        // Send remaining chunks as separate messages
        for (let i = 1; i < chunks.length; i++) {
          // eslint-disable-next-line no-await-in-loop -- chunks must be sent sequentially
          await this.sendHtml(chatId, chunks[i]);
        }
      } else {
        // Response was too short to have triggered initial send
        for (let i = 0; i < chunks.length; i++) {
          // eslint-disable-next-line no-await-in-loop -- chunks must be sent sequentially
          await this.sendHtml(chatId, chunks[i], {
            replyToMessageId: i === 0 ? replyToId : undefined,
          });
        }
      }
    } catch (err) {
      clearInterval(intervalId);
      throw err;
    }
  }

  // ── Sending Helpers ─────────────────────────────────────────────

  /** Send HTML message with fallback to plain text on parse error */
  private async sendHtml(
    chatId: number,
    html: string,
    opts?: { replyToMessageId?: number },
  ): Promise<Message.TextMessage> {
    const params: Record<string, unknown> = {
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
    };
    if (opts?.replyToMessageId) {
      params.reply_parameters = { message_id: opts.replyToMessageId };
    }

    try {
      return await this.bot.api.sendMessage(chatId, html, params);
    } catch (err) {
      if (isParseError(err)) {
        log.debug("HTML parse error, falling back to plain text");
        const plainParams: Record<string, unknown> = {};
        if (opts?.replyToMessageId) {
          plainParams.reply_parameters = { message_id: opts.replyToMessageId };
        }
        return await this.bot.api.sendMessage(chatId, stripHtml(html), plainParams);
      }
      throw err;
    }
  }

  /** Edit message with HTML, fallback to plain text on parse error */
  private async editMessageHtml(chatId: number, messageId: number, html: string): Promise<void> {
    try {
      await this.bot.api.editMessageText(chatId, messageId, html, {
        parse_mode: "HTML",
        link_preview_options: { is_disabled: true },
      });
    } catch (err) {
      if (isParseError(err)) {
        log.debug("HTML parse error on edit, falling back to plain text");
        await this.bot.api.editMessageText(chatId, messageId, stripHtml(html)).catch(() => {});
      } else if (!isMessageNotModified(err) && !isMessageNotFound(err)) {
        throw err;
      }
    }
  }

  /** Send formatted reply: Markdown → HTML → split → send */
  private async sendFormattedReply(ctx: Context, text: string): Promise<void> {
    const html = markdownToTelegramHtml(text);
    const chunks = splitMessage(html);

    for (let i = 0; i < chunks.length; i++) {
      // eslint-disable-next-line no-await-in-loop -- chunks must be sent sequentially
      await this.sendHtml(ctx.chat!.id, chunks[i], {
        replyToMessageId: i === 0 ? ctx.message?.message_id : undefined,
      });
    }
  }

  /** Send plain text, ignoring errors (best-effort) */
  private async safeSend(ctx: Context, text: string): Promise<void> {
    try {
      await ctx.reply(text);
    } catch {
      // Best effort — ignore
    }
  }

  // ── Typing Indicator ────────────────────────────────────────────

  /** Start repeating typing indicator. Returns stop function. */
  private startTyping(ctx: Context): () => void {
    // Send immediately
    ctx.replyWithChatAction("typing").catch(() => {});

    // Repeat every 4s (Telegram shows typing for ~5s)
    const intervalId = setInterval(() => {
      ctx.replyWithChatAction("typing").catch(() => {});
    }, TYPING_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }

  // ── Message Building ────────────────────────────────────────────

  private buildIncoming(ctx: Context): IncomingMessage {
    const text = ctx.message?.text ?? "";

    // Strip @mention from group messages (send clean text to LLM)
    const botUsername = this.bot.botInfo?.username;
    const cleanText = botUsername
      ? text.replace(new RegExp(`@${botUsername}\\b`, "g"), "").trim()
      : text;

    return {
      channelType: "telegram",
      channelId: this.name,
      chatId: String(ctx.chat!.id),
      userId: String(ctx.from!.id),
      userName: ctx.from?.username ?? ctx.from?.first_name,
      text: cleanText,
      threadId: ctx.message?.message_thread_id ? String(ctx.message.message_thread_id) : undefined,
      replyToMessageId: ctx.message?.reply_to_message
        ? String(ctx.message.reply_to_message.message_id)
        : undefined,
      metadata: {
        chatType: ctx.chat!.type,
        firstName: ctx.from?.first_name,
        lastName: ctx.from?.last_name,
      },
    };
  }

  // ── Per-chat Sequentialization ──────────────────────────────────

  /**
   * Ensure only one message handler runs per chat at a time.
   * Prevents race conditions in stateful operations (streaming edits, etc.)
   */
  private async withChatLock(chatId: string, fn: () => Promise<void>): Promise<void> {
    const prev = this.chatLocks.get(chatId) ?? Promise.resolve();
    const current = prev.then(fn, fn);
    this.chatLocks.set(chatId, current);

    // Clean up after completion to prevent memory leak
    current.then(
      () => { if (this.chatLocks.get(chatId) === current) { this.chatLocks.delete(chatId); } },
      () => { if (this.chatLocks.get(chatId) === current) { this.chatLocks.delete(chatId); } },
    );

    return current;
  }
}
