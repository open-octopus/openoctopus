import { createLogger } from "@openoctopus/shared";

const log = createLogger("embedding");

/** Interface for embedding providers */
export interface EmbeddingProvider {
  readonly name: string;
  readonly dimensions: number;
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
}

/** OpenAI embedding provider — uses fetch to call /v1/embeddings */
export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  readonly name = "openai";
  readonly dimensions: number;
  private apiKey: string;
  private baseUrl: string;
  private model: string;

  constructor(opts: { apiKey: string; baseUrl?: string; model?: string; dimensions?: number }) {
    this.apiKey = opts.apiKey;
    this.baseUrl = opts.baseUrl ?? "https://api.openai.com/v1";
    this.model = opts.model ?? "text-embedding-3-small";
    this.dimensions = opts.dimensions ?? 1536;
  }

  async embed(text: string): Promise<number[]> {
    const results = await this.embedBatch([text]);
    return results[0];
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    log.debug(`Embedding ${texts.length} texts with model=${this.model}`);

    const response = await fetch(`${this.baseUrl}/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ input: texts, model: this.model }),
    });

    if (!response.ok) {
      const error = await response.text();
      log.error(`OpenAI embedding failed: ${response.status} ${error}`);
      throw new Error(`OpenAI embedding failed: ${response.status} ${error}`);
    }

    const data = (await response.json()) as {
      data: Array<{ embedding: number[]; index: number }>;
    };

    // Sort by index to preserve order
    return data.data.toSorted((a, b) => a.index - b.index).map((d) => d.embedding);
  }
}

/** Ollama embedding provider — uses fetch to call /api/embeddings */
export class OllamaEmbeddingProvider implements EmbeddingProvider {
  readonly name = "ollama";
  readonly dimensions: number;
  private baseUrl: string;
  private model: string;

  constructor(opts?: { baseUrl?: string; model?: string; dimensions?: number }) {
    this.baseUrl = opts?.baseUrl ?? "http://localhost:11434";
    this.model = opts?.model ?? "nomic-embed-text";
    this.dimensions = opts?.dimensions ?? 768;
  }

  async embed(text: string): Promise<number[]> {
    log.debug(`Embedding text with Ollama model=${this.model}`);

    const response = await fetch(`${this.baseUrl}/api/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: this.model, prompt: text }),
    });

    if (!response.ok) {
      const error = await response.text();
      log.error(`Ollama embedding failed: ${response.status} ${error}`);
      throw new Error(`Ollama embedding failed: ${response.status} ${error}`);
    }

    const data = (await response.json()) as { embedding: number[] };
    return data.embedding;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    // Ollama doesn't have batch API, call sequentially
    const results: number[][] = [];
    for (const text of texts) {
      results.push(await this.embed(text));
    }
    return results;
  }
}

/** Stub embedding provider for testing — deterministic hash-based vectors */
export class StubEmbeddingProvider implements EmbeddingProvider {
  readonly name = "stub";

  constructor(readonly dimensions: number = 128) {}

  async embed(text: string): Promise<number[]> {
    return this.hashToVector(text);
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    return texts.map((t) => this.hashToVector(t));
  }

  private hashToVector(text: string): number[] {
    const vector: number[] = [];
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
    }
    for (let i = 0; i < this.dimensions; i++) {
      // Use a simple hash-based deterministic sequence
      hash = ((hash << 5) - hash + i) | 0;
      vector.push(((hash & 0xffff) / 0xffff) * 2 - 1); // normalize to [-1, 1]
    }
    // Normalize to unit vector
    const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    return vector.map((v) => v / magnitude);
  }
}
