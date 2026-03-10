/**
 * Channel interface — aligned with OpenClaw's multi-channel plugin pattern.
 *
 * Each channel adapter implements this interface to receive/send messages
 * through messaging platforms (Telegram, Discord, Slack, WeChat, etc.)
 */

export interface IncomingMessage {
  channelType: string;
  channelId: string;
  chatId: string;
  userId: string;
  userName?: string;
  text: string;
  threadId?: string;
  replyToMessageId?: string;
  metadata?: Record<string, unknown>;
}

export interface OutgoingMessage {
  text: string;
  replyToMessageId?: string;
  threadId?: string;
  metadata?: Record<string, unknown>;
}

export type MessageHandler = (msg: IncomingMessage) => Promise<OutgoingMessage>;

/** Streaming handler — receives token-by-token callbacks for real-time display */
export type StreamingMessageHandler = (
  msg: IncomingMessage,
  onToken: (token: string) => void,
) => Promise<OutgoingMessage>;

export interface Channel {
  readonly name: string;
  readonly type: string;

  /** Start listening for messages */
  start(): Promise<void>;

  /** Stop and clean up */
  stop(): Promise<void>;

  /** Register message handler (gateway provides this) */
  onMessage(handler: MessageHandler): void;

  /** Register streaming handler for channels that support progressive display */
  onStreamingMessage?(handler: StreamingMessageHandler): void;

  /** Send a message to a specific chat */
  send(chatId: string, message: OutgoingMessage): Promise<void>;

  /** Check if channel is running */
  isRunning(): boolean;
}
