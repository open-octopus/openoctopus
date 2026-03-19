import { describe, expect, it } from "vitest";
import { StubEmbeddingProvider } from "./embedding-provider.js";

describe("StubEmbeddingProvider", () => {
  const provider = new StubEmbeddingProvider(4);

  it("returns vectors of correct dimensions", async () => {
    const result = await provider.embed("hello world");
    expect(result.length).toBe(4);
  });

  it("returns deterministic vectors for same input", async () => {
    const a = await provider.embed("test");
    const b = await provider.embed("test");
    expect(a).toEqual(b);
  });

  it("embeds batch of texts", async () => {
    const results = await provider.embedBatch(["a", "b", "c"]);
    expect(results.length).toBe(3);
    results.forEach((v) => expect(v.length).toBe(4));
  });

  it("reports correct dimensions", () => {
    expect(provider.dimensions).toBe(4);
  });

  it("returns different vectors for different inputs", async () => {
    const a = await provider.embed("hello");
    const b = await provider.embed("world");
    expect(a).not.toEqual(b);
  });
});
