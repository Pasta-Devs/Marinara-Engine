import type { CapabilityEmbeddingHost } from "@marinara-engine/shared";
import { createHash } from "node:crypto";
import type { DB } from "../../db/connection.js";
import { localEmbed } from "../local-embedder.js";
import { logger } from "../../lib/logger.js";
import type { MemoryRecallEmbeddingSource } from "../memory-recall.js";
import {
  resolveConnectionTestEmbeddingSource,
  resolveMemoryRecallEmbeddingSource,
} from "../memory-recall-embedding.js";
import { createConnectionsStorage } from "../storage/connections.storage.js";

const MAX_EMBEDDING_TEXTS = 128;
const MAX_EMBEDDING_CHARACTERS = 200_000;
const LTM_EMBEDDING_SPACE_ID = "local:Xenova/all-MiniLM-L6-v2:q8:mean:normalized:v1";
const LTM_EMBEDDING_LABEL = "Built-in local MiniLM";

export function createCapabilityEmbeddingHost(): CapabilityEmbeddingHost {
  return Object.freeze({
    spaceId: LTM_EMBEDDING_SPACE_ID,
    label: LTM_EMBEDDING_LABEL,
    // MiniLM uses no query or document prefix, so the input type does not change its input.
    async embed(texts: string[], signal?: AbortSignal): Promise<number[][] | null> {
      if (texts.length === 0 || texts.length > MAX_EMBEDDING_TEXTS) return null;
      if (texts.reduce((total, text) => total + text.length, 0) > MAX_EMBEDDING_CHARACTERS) return null;
      return localEmbed(texts, signal);
    },
  });
}

function wrapEmbeddingSource(source: MemoryRecallEmbeddingSource): CapabilityEmbeddingHost {
  const fallbackSpaceId = `remote:${createHash("sha256").update(source.label).digest("hex")}`;
  return Object.freeze({
    spaceId: source.spaceId ?? fallbackSpaceId,
    label: source.label,
    async embed(texts: string[], signal?: AbortSignal, inputType?: "query" | "document"): Promise<number[][] | null> {
      if (texts.length === 0 || texts.length > MAX_EMBEDDING_TEXTS) return null;
      if (texts.reduce((total, text) => total + text.length, 0) > MAX_EMBEDDING_CHARACTERS) return null;
      return source.embed(texts, signal, inputType === "query" ? "query" : "document");
    },
  });
}

export async function createConfiguredCapabilityEmbeddingHost(
  db: DB,
  connectionId?: string | null,
): Promise<CapabilityEmbeddingHost> {
  try {
    const source = await resolveMemoryRecallEmbeddingSource(db, { connectionId });
    return source ? wrapEmbeddingSource(source) : createCapabilityEmbeddingHost();
  } catch (error) {
    logger.warn(error, "Could not resolve configured capability embeddings; using the built-in local embedder");
    return createCapabilityEmbeddingHost();
  }
}

/**
 * Capability API 1.818 `embeddingsFor(connectionId)`: that connection's own embedding source, resolved as
 * Connections > Test embedding resolves it, so the app-wide default never fills in. Null when the id names no usable
 * connection or the connection has no embedding source.
 */
export async function createConnectionCapabilityEmbeddingHost(
  db: DB,
  connectionId: string,
): Promise<CapabilityEmbeddingHost | null> {
  try {
    const connection = await createConnectionsStorage(db).getWithKey(connectionId);
    if (!connection) {
      logger.debug("[capability-embeddings] No connection %s; embeddingsFor resolves null", connectionId);
      return null;
    }
    const source = await resolveConnectionTestEmbeddingSource(db, connection, false);
    if (!source) {
      logger.debug(
        "[capability-embeddings] Connection %s has no embedding source; embeddingsFor resolves null",
        connectionId,
      );
      return null;
    }
    return wrapEmbeddingSource(source);
  } catch (error) {
    logger.warn(error, "[capability-embeddings] Could not resolve embeddings for connection %s", connectionId);
    return null;
  }
}
