/**
 * Telegram message formatting utilities.
 * Converts Markdown → Telegram HTML, splits long messages, handles parse errors.
 *
 * Aligned with OpenClaw's telegram/format.ts and telegram/send.ts patterns.
 */

/** Telegram message length limit */
export const TELEGRAM_MAX_LENGTH = 4096;

/** Escape HTML special characters */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Convert Markdown to Telegram-compatible HTML.
 *
 * Supports: bold, italic, strikethrough, inline code, code blocks (with language),
 * links, blockquotes. Code blocks and inline code are extracted first to prevent
 * inner formatting from being mangled.
 */
export function markdownToTelegramHtml(md: string): string {
  // Phase 1: Extract fenced code blocks (preserve verbatim)
  const codeBlocks: string[] = [];
  let result = md.replace(/```(\w*)\n([\s\S]*?)```/g, (_match, lang: string, code: string) => {
    const idx = codeBlocks.length;
    const langAttr = lang ? ` class="language-${escapeHtml(lang)}"` : "";
    codeBlocks.push(`<pre><code${langAttr}>${escapeHtml(code.trimEnd())}</code></pre>`);
    return `\uE000CB${idx}\uE000`;
  });

  // Phase 2: Extract inline code
  const inlineCodes: string[] = [];
  result = result.replace(/`([^`\n]+)`/g, (_match, code: string) => {
    const idx = inlineCodes.length;
    inlineCodes.push(`<code>${escapeHtml(code)}</code>`);
    return `\uE000IC${idx}\uE000`;
  });

  // Phase 3: Escape HTML in remaining text
  result = escapeHtml(result);

  // Phase 4: Apply formatting (order matters — bold before italic)
  // Bold: **text** or __text__
  result = result.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
  result = result.replace(/__(.+?)__/g, "<b>$1</b>");

  // Italic: *text* or _text_ (word-boundary aware to avoid false matches)
  result = result.replace(/(?<![*\w])\*([^*\n]+?)\*(?![*\w])/g, "<i>$1</i>");
  result = result.replace(/(?<![_\w])_([^_\n]+?)_(?![_\w])/g, "<i>$1</i>");

  // Strikethrough: ~~text~~
  result = result.replace(/~~(.+?)~~/g, "<s>$1</s>");

  // Links: [text](url)
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // Blockquote: > text (merge consecutive lines)
  result = result.replace(/^&gt; (.+)$/gm, "<blockquote>$1</blockquote>");
  result = result.replace(/<\/blockquote>\n<blockquote>/g, "\n");

  // Phase 5: Re-insert preserved code blocks and inline code
  result = result.replace(/\uE000CB(\d+)\uE000/g, (_m, idx: string) => codeBlocks[Number(idx)]);
  result = result.replace(/\uE000IC(\d+)\uE000/g, (_m, idx: string) => inlineCodes[Number(idx)]);

  return result;
}

/**
 * Split a message into chunks respecting Telegram's max length.
 * Tries to break at: paragraph → newline → space → hard boundary.
 */
export function splitMessage(text: string, maxLength = TELEGRAM_MAX_LENGTH): string[] {
  if (text.length <= maxLength) {
    return [text];
  }

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }

    // Find best split point (prefer earlier natural boundaries)
    let splitIdx = remaining.lastIndexOf("\n\n", maxLength);
    if (splitIdx < maxLength * 0.3) {
      splitIdx = remaining.lastIndexOf("\n", maxLength);
    }
    if (splitIdx < maxLength * 0.3) {
      splitIdx = remaining.lastIndexOf(" ", maxLength);
    }
    if (splitIdx < maxLength * 0.3) {
      // Hard split as last resort
      splitIdx = maxLength;
    }

    chunks.push(remaining.slice(0, splitIdx));
    remaining = remaining.slice(splitIdx).trimStart();
  }

  return chunks;
}

/** Strip HTML tags for plain-text fallback */
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

/** Check if a Telegram API error is a parse error */
export function isParseError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /can't parse entities|parse entities|find end of the entity/i.test(msg);
}

/** Check if a Telegram API error is "message not modified" (safe to ignore) */
export function isMessageNotModified(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /message is not modified/i.test(msg);
}

/** Check if a Telegram API error is "message not found" (safe to ignore) */
export function isMessageNotFound(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /message to edit not found|message not found/i.test(msg);
}
