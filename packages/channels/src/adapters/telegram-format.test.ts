import { describe, expect, it } from "vitest";
import {
  escapeHtml,
  markdownToTelegramHtml,
  splitMessage,
  stripHtml,
  isParseError,
  isMessageNotModified,
  isMessageNotFound,
} from "./telegram-format.js";

describe("escapeHtml", () => {
  it("escapes &, <, >", () => {
    expect(escapeHtml("a & b < c > d")).toBe("a &amp; b &lt; c &gt; d");
  });

  it("preserves normal text", () => {
    expect(escapeHtml("hello world 123")).toBe("hello world 123");
  });

  it("handles empty string", () => {
    expect(escapeHtml("")).toBe("");
  });
});

describe("markdownToTelegramHtml", () => {
  it("converts **bold** to <b>", () => {
    expect(markdownToTelegramHtml("**bold**")).toBe("<b>bold</b>");
  });

  it("converts *italic* to <i>", () => {
    expect(markdownToTelegramHtml("*italic*")).toBe("<i>italic</i>");
  });

  it("converts `code` to <code>", () => {
    expect(markdownToTelegramHtml("`inline code`")).toBe("<code>inline code</code>");
  });

  it("converts fenced code blocks without language", () => {
    const md = "```\nconst x = 1;\n```";
    expect(markdownToTelegramHtml(md)).toBe("<pre><code>const x = 1;</code></pre>");
  });

  it("converts fenced code blocks with language", () => {
    const md = "```js\nconst x = 1;\n```";
    expect(markdownToTelegramHtml(md)).toContain('class="language-js"');
    expect(markdownToTelegramHtml(md)).toContain("const x = 1;");
  });

  it("converts ~~strike~~ to <s>", () => {
    expect(markdownToTelegramHtml("~~strike~~")).toBe("<s>strike</s>");
  });

  it("converts [text](url) to <a>", () => {
    expect(markdownToTelegramHtml("[click](https://example.com)")).toBe(
      '<a href="https://example.com">click</a>',
    );
  });

  it("converts > blockquote to <blockquote>", () => {
    expect(markdownToTelegramHtml("> hello")).toBe("<blockquote>hello</blockquote>");
  });

  it("merges consecutive blockquotes", () => {
    const md = "> line1\n> line2";
    const result = markdownToTelegramHtml(md);
    expect(result).toBe("<blockquote>line1\nline2</blockquote>");
  });

  it("escapes HTML inside code blocks", () => {
    const md = "```\n<div>&</div>\n```";
    const result = markdownToTelegramHtml(md);
    expect(result).toContain("&lt;div&gt;&amp;&lt;/div&gt;");
  });

  it("handles mixed formatting", () => {
    const md = "**bold** and *italic* and `code`";
    const result = markdownToTelegramHtml(md);
    expect(result).toContain("<b>bold</b>");
    expect(result).toContain("<i>italic</i>");
    expect(result).toContain("<code>code</code>");
  });

  it("preserves markdown-like chars inside code", () => {
    const md = "`**not bold**`";
    const result = markdownToTelegramHtml(md);
    expect(result).toBe("<code>**not bold**</code>");
  });
});

describe("splitMessage", () => {
  it("returns single chunk for short text", () => {
    expect(splitMessage("hello")).toEqual(["hello"]);
  });

  it("splits at paragraph boundary", () => {
    const text = "a".repeat(3000) + "\n\n" + "b".repeat(2000);
    const chunks = splitMessage(text, 4096);
    expect(chunks.length).toBe(2);
    expect(chunks[0]).toBe("a".repeat(3000));
  });

  it("splits at newline when no paragraph break", () => {
    const text = "a".repeat(3000) + "\n" + "b".repeat(2000);
    const chunks = splitMessage(text, 4096);
    expect(chunks.length).toBe(2);
  });

  it("hard splits when no natural break", () => {
    const text = "a".repeat(5000);
    const chunks = splitMessage(text, 4096);
    expect(chunks.length).toBe(2);
    expect(chunks[0].length).toBe(4096);
  });

  it("respects custom maxLength", () => {
    const text = "hello world foo bar";
    const chunks = splitMessage(text, 10);
    expect(chunks.length).toBeGreaterThan(1);
  });
});

describe("stripHtml", () => {
  it("strips tags and reverses entities", () => {
    expect(stripHtml("<b>bold</b> &amp; &lt;tag&gt;")).toBe("bold & <tag>");
  });
});

describe("isParseError", () => {
  it("returns true for parse errors", () => {
    expect(isParseError(new Error("can't parse entities at offset 5"))).toBe(true);
  });

  it("returns false for other errors", () => {
    expect(isParseError(new Error("network timeout"))).toBe(false);
  });

  it("handles non-Error input", () => {
    expect(isParseError("can't parse entities")).toBe(true);
    expect(isParseError(42)).toBe(false);
  });
});

describe("isMessageNotModified", () => {
  it("returns true for not-modified errors", () => {
    expect(isMessageNotModified(new Error("message is not modified"))).toBe(true);
  });

  it("returns false for other errors", () => {
    expect(isMessageNotModified(new Error("some error"))).toBe(false);
  });
});

describe("isMessageNotFound", () => {
  it("returns true for not-found errors", () => {
    expect(isMessageNotFound(new Error("message to edit not found"))).toBe(true);
  });

  it("returns false for other errors", () => {
    expect(isMessageNotFound(new Error("some error"))).toBe(false);
  });
});
