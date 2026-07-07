// ──────────────────────────────────────────────
// Service: Memory Recall
// ──────────────────────────────────────────────
// Chunks conversation messages into groups, embeds them, and provides
// semantic recall: given a query, find the most relevant past
// conversation fragments from specified chats.
import { eq, desc, and, gt, inArray, isNotNull, isNull } from "drizzle-orm";
import type { DB } from "../db/connection.js";
import { messages, memoryChunks } from "../db/schema/index.js";
import { newId, now } from "../utils/id-generator.js";
import { localEmbed } from "./local-embedder.js";
import { logger } from "../lib/logger.js";
const isLite = process.env.MARINARA_LITE === "true" || process.env.MARINARA_LITE === "1";
let warnedUnavailableEmbeddingSource = false;

/** How many messages per chunk. */
const CHUNK_SIZE = 5;

/** Keep embedding requests comfortably below common 8k-token embedding ceilings. */
const MAX_EMBEDDING_CHUNK_CHARS = 18_000;

/** Minimum similarity score to include a memory in results. */
const SIMILARITY_THRESHOLD = 0.25;

/** Maximum number of recalled memories per generation. */
const DEFAULT_TOP_K = 8;

// ── Cosine similarity ──

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0,
    magA = 0,
    magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    magA += a[i]! * a[i]!;
    magB += b[i]! * b[i]!;
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

function parseStoredEmbedding(value: string | null): number[] | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) && parsed.every((item) => typeof item === "number" && Number.isFinite(item))
      ? parsed
      : null;
  } catch {
    return null;
  }
}

// ── Public API ──

export interface RecalledMemory {
  chatId: string;
  content: string;
  similarity: number;
  firstMessageAt: string;
  lastMessageAt: string;
}

export interface MemoryRecallEmbeddingSource {
  label: string;
  embed(texts: string[], signal?: AbortSignal): Promise<number[][] | null>;
}

export interface MemoryRecallEmbeddingOptions {
  embeddingSource?: MemoryRecallEmbeddingSource | null;
  localEmbedder?: (texts: string[], signal?: AbortSignal) => Promise<number[][] | null>;
  signal?: AbortSignal;
}

export interface ChunkAndEmbedMessagesOptions extends MemoryRecallEmbeddingOptions {
  /**
   * Keep the most recent N messages out of durable memory chunks. This lets
   * recall operate as read-behind storage for messages that have left the
   * active prompt window.
   */
  readBehindMessageCount?: number | null;
}

export async function embedMemoryRecallTexts(
  texts: string[],
  options: MemoryRecallEmbeddingOptions = {},
): Promise<number[][]> {
  if (options.embeddingSource) {
    const configuredEmbeddings = await options.embeddingSource.embed(texts, options.signal);
    if (configuredEmbeddings) {
      logger.debug("[memory-recall] Used configured embedding source %s", options.embeddingSource.label);
      return configuredEmbeddings;
    }
    return [];
  }

  const localEmbedder = options.localEmbedder ?? localEmbed;
  const localEmbeddings = await localEmbedder(texts, options.signal);
  if (localEmbeddings) return localEmbeddings;

  if (!warnedUnavailableEmbeddingSource) {
    warnedUnavailableEmbeddingSource = true;
    logger.warn("[memory-recall] No embedder configured; memory recall is disabled until an embedding source is available");
  }
  return [];
}

function normalizeReadBehindMessageCount(value: number | null | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return 0;
  return Math.floor(value);
}

function splitLongMemoryText(text: string, maxChars = MAX_EMBEDDING_CHUNK_CHARS): string[] {
  const normalized = text.trim();
  if (!normalized) return [];
  if (normalized.length <= maxChars) return [normalized];

  const parts: string[] = [];
  let remaining = normalized;

  while (remaining.length > maxChars) {
    const windowText = remaining.slice(0, maxChars);
    const breakAt =
      Math.max(windowText.lastIndexOf("\n\n"), windowText.lastIndexOf("\n"), windowText.lastIndexOf(". ")) || maxChars;
    const sliceAt = breakAt < maxChars * 0.5 ? maxChars : breakAt;
    const part = remaining.slice(0, sliceAt).trim();
    if (part) parts.push(part);
    remaining = remaining.slice(sliceAt).trim();
  }

  if (remaining) parts.push(remaining);
  return parts;
}

function splitMemoryChunksForEmbedding<T extends { content: string; messageCount: number }>(chunks: T[]): T[] {
  const expanded: T[] = [];
  let splitCount = 0;
  for (const chunk of chunks) {
    const parts = splitLongMemoryText(chunk.content);
    if (parts.length <= 1) {
      expanded.push({ ...chunk, content: parts[0] ?? chunk.content });
      continue;
    }
    splitCount += parts.length - 1;
    for (let index = 0; index < parts.length; index += 1) {
      expanded.push({
        ...chunk,
        messageCount: index === 0 ? chunk.messageCount : 0,
        content: `[Memory chunk part ${index + 1}/${parts.length}]\n${parts[index]}`,
      });
    }
  }
  if (splitCount > 0) {
    logger.debug("[memory-recall] Split oversized memory input into %d additional embedding chunk(s)", splitCount);
  }
  return expanded;
}

async function pruneStaleNativeMemoryChunks(
  db: DB,
  chatId: string,
  currentMessages: Array<{ createdAt: string }>,
): Promise<void> {
  const chunks = await db
    .select({
      id: memoryChunks.id,
      messageCount: memoryChunks.messageCount,
      firstMessageAt: memoryChunks.firstMessageAt,
      lastMessageAt: memoryChunks.lastMessageAt,
    })
    .from(memoryChunks)
    .where(and(eq(memoryChunks.chatId, chatId), isNull(memoryChunks.sourceChatId)))
    .orderBy(memoryChunks.firstMessageAt);

  if (chunks.length === 0) return;

  const messageTimes = currentMessages.map((message) => message.createdAt);
  const messageTimeSet = new Set(messageTimes);
  let invalidateFrom: string | null = null;

  for (const chunk of chunks) {
    const hasAnchors = messageTimeSet.has(chunk.firstMessageAt) && messageTimeSet.has(chunk.lastMessageAt);
    const spanMessageCount = hasAnchors
      ? messageTimes.filter((createdAt) => createdAt >= chunk.firstMessageAt && createdAt <= chunk.lastMessageAt).length
      : 0;

    if (!hasAnchors || (chunk.messageCount > 0 && spanMessageCount !== chunk.messageCount)) {
      invalidateFrom = chunk.firstMessageAt;
      break;
    }
  }

  if (!invalidateFrom) return;

  const staleIds = chunks.filter((chunk) => chunk.firstMessageAt >= invalidateFrom).map((chunk) => chunk.id);
  for (let i = 0; i < staleIds.length; i += 500) {
    await db
      .delete(memoryChunks)
      .where(
        and(
          eq(memoryChunks.chatId, chatId),
          isNull(memoryChunks.sourceChatId),
          inArray(memoryChunks.id, staleIds.slice(i, i + 500)),
        ),
      );
  }

  logger.debug(
    "[memory-recall] Pruned %d stale native chunk(s) for chat %s from %s",
    staleIds.length,
    chatId,
    invalidateFrom,
  );
}

async function pruneNativeMemoryChunksAfter(
  db: DB,
  chatId: string,
  lastEligibleMessageAt: string | null,
): Promise<void> {
  if (!lastEligibleMessageAt) {
    await db.delete(memoryChunks).where(and(eq(memoryChunks.chatId, chatId), isNull(memoryChunks.sourceChatId)));
    logger.debug(
      "[memory-recall] Pruned native chunks for chat %s because all messages are still in active context",
      chatId,
    );
    return;
  }

  await db
    .delete(memoryChunks)
    .where(
      and(
        eq(memoryChunks.chatId, chatId),
        isNull(memoryChunks.sourceChatId),
        gt(memoryChunks.lastMessageAt, lastEligibleMessageAt),
      ),
    );
}

/**
 * Chunk any un-chunked messages for a given chat and embed them.
 * Should be called after generation completes (fire-and-forget).
 */
export async function chunkAndEmbedMessages(
  db: DB,
  chatId: string,
  /** Map from role → display name. Used to format "Name: content" lines. */
  nameMap: { userName: string; characterNames: Record<string, string> },
  options: ChunkAndEmbedMessagesOptions = {},
): Promise<void> {
  if (isLite) return;
  const allMessages = await db
    .select({
      id: messages.id,
      role: messages.role,
      characterId: messages.characterId,
      content: messages.content,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .where(eq(messages.chatId, chatId))
    .orderBy(messages.createdAt);

  await pruneStaleNativeMemoryChunks(db, chatId, allMessages);

  const readBehindMessageCount = normalizeReadBehindMessageCount(options.readBehindMessageCount);
  const eligibleMessages =
    readBehindMessageCount > 0
      ? allMessages.slice(0, Math.max(0, allMessages.length - readBehindMessageCount))
      : allMessages;

  if (readBehindMessageCount > 0) {
    await pruneNativeMemoryChunksAfter(db, chatId, eligibleMessages.at(-1)?.createdAt ?? null);
  }

  // Find the last chunk for this chat to know where to start
  const lastChunk = await db
    .select({ lastMessageAt: memoryChunks.lastMessageAt })
    .from(memoryChunks)
    .where(and(eq(memoryChunks.chatId, chatId), isNull(memoryChunks.sourceChatId), isNotNull(memoryChunks.embedding)))
    .orderBy(desc(memoryChunks.lastMessageAt))
    .limit(1);

  const after = lastChunk[0]?.lastMessageAt ?? null;

  // Get eligible messages that haven't been chunked yet.
  const unchunked = after ? eligibleMessages.filter((message) => message.createdAt > after) : eligibleMessages;

  if (unchunked.length < CHUNK_SIZE) return; // not enough to form a chunk yet

  // Group into chunks of CHUNK_SIZE
  const chunksToCreate: Array<{
    content: string;
    messageCount: number;
    firstMessageAt: string;
    lastMessageAt: string;
  }> = [];

  // Only chunk complete groups — leftover messages wait for next round
  const completeCount = Math.floor(unchunked.length / CHUNK_SIZE) * CHUNK_SIZE;
  for (let i = 0; i < completeCount; i += CHUNK_SIZE) {
    const group = unchunked.slice(i, i + CHUNK_SIZE);
    const lines = group.map((m) => {
      const name =
        m.role === "user"
          ? nameMap.userName
          : m.role === "narrator" || m.role === "system"
            ? "Narrator"
            : ((m.characterId && nameMap.characterNames[m.characterId]) ?? "Character");
      return `${name}: ${m.content}`;
    });
    chunksToCreate.push({
      content: lines.join("\n\n"),
      messageCount: group.length,
      firstMessageAt: group[0]!.createdAt,
      lastMessageAt: group[group.length - 1]!.createdAt,
    });
  }

  if (chunksToCreate.length === 0) return;
  const embeddableChunks = splitMemoryChunksForEmbedding(chunksToCreate);
  if (embeddableChunks.length === 0) return;

  // Embed all chunks using local model
  const texts = embeddableChunks.map((c) => c.content);
  const embeddings = await embedMemoryRecallTexts(texts, options);
  if (
    embeddings.length !== embeddableChunks.length ||
    embeddings.some((embedding) => !Array.isArray(embedding) || embedding.length === 0)
  ) {
    logger.debug(
      "[memory-recall] Skipping %d memory chunk(s) for chat %s because embedding generation returned %d/%d usable vectors",
      embeddableChunks.length,
      chatId,
      embeddings.filter((embedding) => Array.isArray(embedding) && embedding.length > 0).length,
      embeddableChunks.length,
    );
    return;
  }

  const embeddingDimension = embeddings[0]!.length;
  const existingEmbeddedChunk = await db
    .select({ embedding: memoryChunks.embedding })
    .from(memoryChunks)
    .where(and(eq(memoryChunks.chatId, chatId), isNull(memoryChunks.sourceChatId), isNotNull(memoryChunks.embedding)))
    .limit(1);
  const existingEmbedding = parseStoredEmbedding(existingEmbeddedChunk[0]?.embedding ?? null);
  if (Array.isArray(existingEmbedding) && existingEmbedding.length > 0 && existingEmbedding.length !== embeddingDimension) {
    logger.warn(
      "[memory-recall] Skipping memory chunk insert for chat %s because embedding dimension changed from %d to %d. Rebuild memories before mixing embedding models.",
      chatId,
      existingEmbedding.length,
      embeddingDimension,
    );
    return;
  }

  // Store chunks
  const timestamp = now();
  for (let i = 0; i < embeddableChunks.length; i++) {
    const chunk = embeddableChunks[i]!;
    await db.insert(memoryChunks).values({
      id: newId(),
      chatId,
      content: chunk.content,
      embedding: JSON.stringify(embeddings[i]!),
      messageCount: chunk.messageCount,
      firstMessageAt: chunk.firstMessageAt,
      lastMessageAt: chunk.lastMessageAt,
      createdAt: timestamp,
    });
  }

  logger.debug("[memory-recall] Created %d chunk(s) for chat %s", embeddableChunks.length, chatId);
}

/**
 * Rebuild all memory-recall chunks for a chat from the current message log.
 */
export async function rebuildMemoryChunks(
  db: DB,
  chatId: string,
  nameMap: { userName: string; characterNames: Record<string, string> },
  options: ChunkAndEmbedMessagesOptions = {},
): Promise<number> {
  if (isLite) return 0;

  await db.delete(memoryChunks).where(and(eq(memoryChunks.chatId, chatId), isNull(memoryChunks.sourceChatId)));
  await chunkAndEmbedMessages(db, chatId, nameMap, options);

  const rebuilt = await db
    .select({ id: memoryChunks.id })
    .from(memoryChunks)
    .where(and(eq(memoryChunks.chatId, chatId), isNull(memoryChunks.sourceChatId)));
  return rebuilt.length;
}

/**
 * Recall relevant conversation memories for a given query.
 * Searches only the specified chat IDs for relevant chunks.
 */
export async function recallMemories(
  db: DB,
  query: string,
  chatIds: string[],
  options: MemoryRecallEmbeddingOptions & { topK?: number } = {},
): Promise<RecalledMemory[]> {
  if (isLite) return [];
  if (chatIds.length === 0) return [];

  // Embed the query using local model
  const queryEmbeddings = await embedMemoryRecallTexts([query], options);
  if (!queryEmbeddings || queryEmbeddings.length === 0) return [];
  const queryEmbedding = queryEmbeddings[0]!;
  if (queryEmbedding.length === 0) return [];

  const matchingChatIds = chatIds.slice(0, 50);

  // Load every embedded chunk in scope before scoring. Applying a recency cap
  // here would exclude old-but-relevant memories before cosine similarity can
  // evaluate them.
  const chunks = await db
    .select({
      id: memoryChunks.id,
      chatId: memoryChunks.chatId,
      content: memoryChunks.content,
      embedding: memoryChunks.embedding,
      firstMessageAt: memoryChunks.firstMessageAt,
      lastMessageAt: memoryChunks.lastMessageAt,
    })
    .from(memoryChunks)
    .where(and(inArray(memoryChunks.chatId, matchingChatIds), isNotNull(memoryChunks.embedding)));

  if (chunks.length === 0) return [];

  let dimensionMismatchLogged = false;

  // Score each chunk by cosine similarity
  const scored = chunks
    .map((chunk): RecalledMemory | null => {
      const embedding = parseStoredEmbedding(chunk.embedding);
      if (!embedding || embedding.length !== queryEmbedding.length) {
        if (!dimensionMismatchLogged) {
          dimensionMismatchLogged = true;
          logger.warn(
            "[memory-recall] Skipping one or more memory chunks with embedding dimensions that do not match the query vector. Refresh memories after changing embedding models.",
          );
        }
        return null;
      }
      return {
        chatId: chunk.chatId,
        content: chunk.content,
        similarity: cosineSimilarity(queryEmbedding, embedding),
        firstMessageAt: chunk.firstMessageAt,
        lastMessageAt: chunk.lastMessageAt,
      };
    })
    .filter((s): s is RecalledMemory => s !== null && s.similarity >= SIMILARITY_THRESHOLD)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, options.topK ?? DEFAULT_TOP_K);

  return scored;
}
