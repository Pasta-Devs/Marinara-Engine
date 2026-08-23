import { LIMITS, type Lorebook, type LorebookEntry } from "@marinara-engine/shared";
import type { DB } from "../../db/connection.js";
import { logger } from "../../lib/logger.js";
import { localEmbed } from "../local-embedder.js";
import { embedMemoryRecallTexts, type MemoryRecallEmbeddingOptions } from "../memory-recall.js";
import { createLorebooksStorage } from "../storage/lorebooks.storage.js";

const DEFAULT_SEMANTIC_TOP_K = 40;
const DEFAULT_WARMUP_BATCH_SIZE = 32;
const SEMANTIC_CALIBRATION_TEXTS = [
  "A recipe explains how to bake a loaf of bread.",
  "A spacecraft studies distant galaxies and nebulae.",
  "A city council reviews municipal zoning regulations.",
] as const;

export type LorebookEmbeddingOptions = MemoryRecallEmbeddingOptions;

export interface LorebookEmbeddingWarmupResult {
  attempted: number;
  embedded: number;
}

export interface SemanticLorebookMatch {
  entry: LorebookEntry;
  similarity: number;
}

export function selectLorebookVectorQueryText(
  messages: Array<{ content: string; role?: string }>,
  depth: number,
): string {
  // Opening and assistant prose can dwarf a short, exact user query. Retrieval
  // should follow what the user is asking about now, while still allowing a
  // configurable history of earlier user turns.
  const userMessages = messages.filter((message) => message.role === "user");
  const queryMessages = userMessages.length > 0 ? userMessages : messages;
  const selectedMessages = depth > 0 ? queryMessages.slice(-depth) : queryMessages;
  return selectedMessages
    .map((message) => message.content)
    .join("\n")
    .trim();
}

function normalizeLorebookVectorQueryDepth(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return LIMITS.LOREBOOK_VECTOR_QUERY_DEPTH_DEFAULT;
  return Math.max(0, Math.min(LIMITS.LOREBOOK_VECTOR_QUERY_DEPTH_MAX, Math.trunc(parsed)));
}

function normalizedParts(parts: Array<[string, unknown]>): string[] {
  const lines: string[] = [];
  for (const [label, value] of parts) {
    if (Array.isArray(value)) {
      const text = value
        .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
        .filter(Boolean)
        .join(", ");
      if (text) lines.push(`${label}: ${text}`);
      continue;
    }
    if (typeof value !== "string") continue;
    const text = value.trim();
    if (text) lines.push(`${label}: ${text}`);
  }
  return lines;
}

export function buildLorebookEntryEmbeddingText(entry: LorebookEntry): string {
  return normalizedParts([
    ["Name", entry.name],
    ["Description", entry.description],
    ["Keys", entry.keys],
    ["Secondary Keys", entry.secondaryKeys],
    ["Content", entry.content],
  ]).join("\n\n");
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    magA += a[i]! * a[i]!;
    magB += b[i]! * b[i]!;
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Estimate the model's common cosine floor from deliberately unrelated text.
 * Some embedding backends produce raw cosine scores around 0.95+ for nearly
 * every pair; subtracting that floor keeps the user-facing 0-1 threshold useful.
 */
export function lorebookSimilarityBaseline(embeddings: number[][]): number {
  if (embeddings.length < 2) return 0;
  let similaritySum = 0;
  let similarityCount = 0;
  for (let left = 0; left < embeddings.length; left += 1) {
    for (let right = left + 1; right < embeddings.length; right += 1) {
      const similarity = cosineSimilarity(embeddings[left]!, embeddings[right]!);
      if (Number.isFinite(similarity)) {
        similaritySum += similarity;
        similarityCount += 1;
      }
    }
  }
  if (similarityCount === 0) return 0;
  return Math.max(0, Math.min(0.999, similaritySum / similarityCount));
}

export function calibrateLorebookSimilarity(similarity: number, baseline = 0): number {
  if (!Number.isFinite(similarity)) return 0;
  const safeBaseline = Number.isFinite(baseline) ? Math.max(0, Math.min(0.999, baseline)) : 0;
  const calibrated = (Math.max(-1, Math.min(1, similarity)) - safeBaseline) / (1 - safeBaseline);
  return Math.max(0, Math.min(1, calibrated));
}

function normalizePositiveInteger(value: unknown, fallback: number): number {
  const numeric = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  if (!Number.isFinite(numeric) || numeric < 1) return fallback;
  return Math.max(1, Math.trunc(numeric));
}

function getExistingEmbeddingDimension(entries: LorebookEntry[]): number | null {
  for (const entry of entries) {
    if (entry.excludeFromVectorization) continue;
    if (entry.embedding && entry.embedding.length > 0) {
      return entry.embedding.length;
    }
  }
  return null;
}

function getExistingEmbeddingSpaceId(entries: LorebookEntry[]): string | null {
  for (const entry of entries) {
    if (entry.excludeFromVectorization || !entry.embedding?.length) continue;
    if (entry.embeddingSpaceId) return entry.embeddingSpaceId;
  }
  return null;
}

function hasIncompatibleEmbeddingSpace(entries: LorebookEntry[], activeSpaceId: string): boolean {
  return entries.some(
    (entry) =>
      !entry.excludeFromVectorization && Boolean(entry.embedding?.length) && entry.embeddingSpaceId !== activeSpaceId,
  );
}

async function embedLorebookTexts(
  texts: string[],
  options: LorebookEmbeddingOptions,
  inputType: "document" | "query",
): Promise<number[][]> {
  return embedMemoryRecallTexts(texts, {
    localEmbedder: options.localEmbedder ?? localEmbed,
    embeddingSource: options.embeddingSource,
    signal: options.signal,
    inputType,
  });
}

export async function warmLorebookEntryEmbeddings(
  db: DB,
  entries: LorebookEntry[],
  options: LorebookEmbeddingOptions & { batchSize?: number } = {},
): Promise<LorebookEmbeddingWarmupResult> {
  const batchSize = normalizePositiveInteger(options.batchSize, DEFAULT_WARMUP_BATCH_SIZE);
  const candidates = entries
    .filter(
      (entry) => entry.enabled && !entry.excludeFromVectorization && (!entry.embedding || entry.embedding.length === 0),
    )
    .slice(0, batchSize);
  if (candidates.length === 0) return { attempted: 0, embedded: 0 };

  const texts = candidates.map(buildLorebookEntryEmbeddingText);
  const embeddings = await embedLorebookTexts(texts, options, "document");
  if (embeddings.length === 0) return { attempted: candidates.length, embedded: 0 };

  const embeddingDimension = embeddings.find((embedding) => embedding.length > 0)?.length ?? null;
  const existingDimension = getExistingEmbeddingDimension(entries);
  const existingSpaceId = getExistingEmbeddingSpaceId(entries);
  const embeddingSpaceId = options.embeddingSource?.spaceId ?? null;
  if (
    embeddingSpaceId &&
    (hasIncompatibleEmbeddingSpace(entries, embeddingSpaceId) ||
      (existingSpaceId !== null && existingSpaceId !== embeddingSpaceId))
  ) {
    logger.warn(
      "[lorebook-embeddings] Skipping warmup because stored entries use a different embedding source. Refresh lorebook embeddings before switching provider or model.",
    );
    return { attempted: candidates.length, embedded: 0 };
  }
  if (embeddingDimension && existingDimension && embeddingDimension !== existingDimension) {
    logger.warn(
      "[lorebook-embeddings] Skipping warmup because embedding dimension changed from %d to %d. Refresh lorebook embeddings before mixing embedding models.",
      existingDimension,
      embeddingDimension,
    );
    return { attempted: candidates.length, embedded: 0 };
  }

  const storage = createLorebooksStorage(db);
  let embedded = 0;
  for (let index = 0; index < candidates.length; index++) {
    const vector = embeddings[index];
    if (!vector || vector.length === 0) continue;
    await storage.updateEntryEmbedding(candidates[index]!.id, vector, embeddingSpaceId);
    candidates[index]!.embedding = vector;
    candidates[index]!.embeddingSpaceId = embeddingSpaceId;
    embedded += 1;
  }

  if (embedded > 0) {
    logger.debug("[lorebook-embeddings] Warmed %d/%d missing entry embedding(s)", embedded, candidates.length);
  }
  return { attempted: candidates.length, embedded };
}

export async function semanticShortlistLorebookEntries(
  entries: LorebookEntry[],
  query: string,
  options: LorebookEmbeddingOptions & { topK?: number } = {},
): Promise<SemanticLorebookMatch[] | null> {
  const topK = normalizePositiveInteger(options.topK, DEFAULT_SEMANTIC_TOP_K);
  const queryText = query.trim();
  if (!queryText) return null;

  const queryEmbeddings = await embedLorebookTexts([queryText, ...SEMANTIC_CALIBRATION_TEXTS], options, "query");
  const queryEmbedding = queryEmbeddings[0];
  if (!queryEmbedding || queryEmbedding.length === 0) return null;
  const similarityBaseline = lorebookSimilarityBaseline(queryEmbeddings.slice(1));

  let dimensionMismatchLogged = false;
  let sourceMismatchLogged = false;
  const matches = entries
    .map((entry) => {
      const embedding = entry.embedding;
      if (!embedding || embedding.length === 0) return null;
      if (options.embeddingSource?.spaceId && entry.embeddingSpaceId !== options.embeddingSource.spaceId) {
        if (!sourceMismatchLogged) {
          sourceMismatchLogged = true;
          logger.warn(
            "[lorebook-embeddings] Skipping one or more entries vectorized by a different provider or model. Re-vectorize the lorebook with the active embedding source.",
          );
        }
        return null;
      }
      if (embedding.length !== queryEmbedding.length) {
        if (!dimensionMismatchLogged) {
          dimensionMismatchLogged = true;
          logger.warn(
            "[lorebook-embeddings] Skipping one or more lorebook entries with embedding dimensions that do not match the query vector (%d vs %d). Refresh lorebook embeddings after changing embedding models.",
            embedding.length,
            queryEmbedding.length,
          );
        }
        return null;
      }
      return {
        entry,
        similarity: calibrateLorebookSimilarity(cosineSimilarity(queryEmbedding, embedding), similarityBaseline),
      };
    })
    .filter((match): match is SemanticLorebookMatch => match !== null)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);
  return matches.length > 0 ? matches : null;
}

export async function buildLorebookSemanticEmbeddingsById({
  lorebooks,
  entries,
  scanMessages,
  embeddingSource,
  signal,
}: {
  lorebooks: Lorebook[];
  entries: LorebookEntry[];
  scanMessages: Array<{ content: string; role?: string }>;
  embeddingSource: MemoryRecallEmbeddingOptions["embeddingSource"];
  signal?: AbortSignal;
}): Promise<{
  defaultEmbedding: number[] | null;
  embeddingsByLorebookId?: Map<string, number[] | null>;
  similarityBaseline: number;
  embeddingSpaceId: string | null;
}> {
  const lorebookIdsWithVectors = new Set(
    entries
      .filter(
        (entry) => !entry.excludeFromVectorization && Array.isArray(entry.embedding) && entry.embedding.length > 0,
      )
      .map((entry) => entry.lorebookId),
  );
  if (lorebookIdsWithVectors.size === 0) {
    return { defaultEmbedding: null, similarityBaseline: 0, embeddingSpaceId: embeddingSource?.spaceId ?? null };
  }

  const vectorLorebooks = lorebooks.filter(
    (lorebook) => !lorebook.excludeFromVectorization && lorebookIdsWithVectors.has(lorebook.id),
  );
  if (vectorLorebooks.length === 0) {
    return { defaultEmbedding: null, similarityBaseline: 0, embeddingSpaceId: embeddingSource?.spaceId ?? null };
  }

  const depths = Array.from(
    new Set(vectorLorebooks.map((lorebook) => normalizeLorebookVectorQueryDepth(lorebook.vectorQueryDepth))),
  );
  const embeddingsByDepth = new Map<number, number[] | null>();
  const queryTextsByDepth = new Map(
    depths.map((depth) => [depth, selectLorebookVectorQueryText(scanMessages, depth)] as const),
  );
  const populatedDepths = depths.filter((depth) => queryTextsByDepth.get(depth));
  const queryAndCalibrationEmbeddings = await embedMemoryRecallTexts(
    [...populatedDepths.map((depth) => queryTextsByDepth.get(depth)!), ...SEMANTIC_CALIBRATION_TEXTS],
    { embeddingSource, signal, inputType: "query" },
  );
  for (const depth of depths) {
    const queryIndex = populatedDepths.indexOf(depth);
    embeddingsByDepth.set(depth, queryIndex >= 0 ? (queryAndCalibrationEmbeddings[queryIndex] ?? null) : null);
  }
  const similarityBaseline = lorebookSimilarityBaseline(queryAndCalibrationEmbeddings.slice(populatedDepths.length));

  const embeddingsByLorebookId = new Map<string, number[] | null>();
  for (const lorebook of vectorLorebooks) {
    embeddingsByLorebookId.set(
      lorebook.id,
      embeddingsByDepth.get(normalizeLorebookVectorQueryDepth(lorebook.vectorQueryDepth)) ?? null,
    );
  }

  return {
    defaultEmbedding:
      embeddingsByDepth.get(LIMITS.LOREBOOK_VECTOR_QUERY_DEPTH_DEFAULT) ??
      Array.from(embeddingsByDepth.values()).find((embedding) => embedding && embedding.length > 0) ??
      null,
    embeddingsByLorebookId,
    similarityBaseline,
    embeddingSpaceId: embeddingSource?.spaceId ?? null,
  };
}
