import type { LorebookEntry } from "../../contracts/types/lorebook";

export interface LorebookEmbeddingOptions {
  chatEmbedding?: number[] | null;
  topK?: number;
  threshold?: number;
  localEmbedder?: ((texts: string[]) => Promise<number[][] | null>) | null;
  embeddingSource?: { embed(texts: string[]): Promise<number[][] | null> } | null;
  [key: string]: unknown;
}

export interface SemanticLorebookMatch {
  entry: LorebookEntry;
  score: number;
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let index = 0; index < a.length; index += 1) {
    dot += a[index]! * b[index]!;
    magA += a[index]! * a[index]!;
    magB += b[index]! * b[index]!;
  }
  const denominator = Math.sqrt(magA) * Math.sqrt(magB);
  return denominator === 0 ? 0 : dot / denominator;
}

function entryEmbedding(entry: LorebookEntry): number[] | null {
  if (!Array.isArray(entry.embedding) || entry.embedding.length === 0) return null;
  const embedding = entry.embedding.filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value),
  );
  return embedding.length > 0 ? embedding : null;
}

async function embedQuery(query: string, options: LorebookEmbeddingOptions): Promise<number[] | null> {
  const provided = options.chatEmbedding?.filter((value): value is number => Number.isFinite(value));
  if (provided?.length) return provided;
  const text = query.trim();
  if (!text) return null;
  const localEmbedding = options.localEmbedder ? await options.localEmbedder([text]) : null;
  const localVector = localEmbedding?.[0];
  if (localVector?.length) return localVector;
  const sourceEmbedding = options.embeddingSource ? await options.embeddingSource.embed([text]) : null;
  return sourceEmbedding?.[0]?.length ? sourceEmbedding[0] : null;
}

function positiveInteger(value: unknown, fallback: number): number {
  const numeric = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  return Number.isFinite(numeric) && numeric > 0 ? Math.trunc(numeric) : fallback;
}

export async function semanticShortlistLorebookEntries(
  entries: LorebookEntry[],
  query = "",
  options: LorebookEmbeddingOptions = {},
): Promise<SemanticLorebookMatch[] | null> {
  const queryEmbedding = await embedQuery(query, options);
  if (!queryEmbedding?.length) return null;
  const topK = positiveInteger(options.topK, 40);
  const threshold = typeof options.threshold === "number" ? options.threshold : 0;
  const matches = entries
    .map((entry) => {
      if (!entry.enabled || entry.excludeFromVectorization) return null;
      const embedding = entryEmbedding(entry);
      if (!embedding || embedding.length !== queryEmbedding.length) return null;
      return { entry, score: cosineSimilarity(queryEmbedding, embedding) };
    })
    .filter((match): match is SemanticLorebookMatch => !!match && match.score >= threshold)
    .sort((left, right) => right.score - left.score)
    .slice(0, topK);
  return matches.length > 0 ? matches : null;
}
