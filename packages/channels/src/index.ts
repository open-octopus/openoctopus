export type { Channel, IncomingMessage, OutgoingMessage, MessageHandler, StreamingMessageHandler } from "./channel.js";
export { ChannelManager } from "./channel-manager.js";
export { TelegramChannel } from "./adapters/telegram.js";
export { markdownToTelegramHtml, splitMessage, escapeHtml } from "./adapters/telegram-format.js";
