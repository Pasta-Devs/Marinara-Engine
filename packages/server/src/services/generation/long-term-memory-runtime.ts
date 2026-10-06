import type { ChatMode } from "@marinara-engine/shared";
import type { FastifyReply } from "fastify";
import type { DB } from "../../db/connection.js";
import { getAgentCallTimeoutMs } from "../../config/runtime-config.js";
import { logger } from "../../lib/logger.js";
import { getCapabilityService } from "../capability-packages/capability-service-registry.service.js";
import { withLlmRequestTimeout } from "../llm/base-provider.js";
import { resolveMemoryRecallEmbeddingSource } from "../memory-recall-embedding.js";
import { createAgentsStorage } from "../storage/agents.storage.js";
import { createConnectionsStorage } from "../storage/connections.storage.js";

const SERVICE_KEY = "long-term-memory:runtime";
const MAX_RECALL_CHARACTERS = 100_000;

export type LongTermMemoryRecallReceipt = unknown;

export interface LongTermMemoryRuntimeService {
  /** Optional for older packages. The package owns freshness checks, locking and rebuilding. */
  refresh?(input: { signal: AbortSignal }): Promise<{ status: "refreshed" | "deferred" }>;
  recall(input: {
    chatId: string;
    chatMode: ChatMode;
    characterIds: string[];
    messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
    signal?: AbortSignal;
    debugMode: boolean;
  }): Promise<{ text: string; receipt?: LongTermMemoryRecallReceipt } | null>;
  recordPromptAccepted(input: {
    chatId: string;
    receipt: LongTermMemoryRecallReceipt;
    messages: Array<{ role: string; content: string }>;
  }): Promise<void>;
}

function runtimeService() {
  return getCapabilityService<LongTermMemoryRuntimeService>(SERVICE_KEY);
}

async function embeddingConfiguration(db: DB): Promise<string | null> {
  const config = await createAgentsStorage(db).getByType("long-term-memory");
  if (!config && !runtimeService()) return null;
  const connections = createConnectionsStorage(db);
  const selected = config?.connectionId
    ? await connections.getById(config.connectionId)
    : await connections.getDefault();
  const source = await resolveMemoryRecallEmbeddingSource(db, { connectionId: config?.connectionId });
  // Selection changes matter even when space IDs coincide (including the sidecar).
  // Request identity catches credential/header recovery without declaring vectors incompatible.
  return JSON.stringify([
    config?.connectionId ?? selected?.id ?? null,
    selected?.embeddingConnectionId?.trim() || null,
    source?.cacheIdentity ?? source?.spaceId ?? "built-in",
  ]);
}

/** Keep configuration-save success independent of an optional package's refresh outcome. */
export async function withLongTermMemoryEmbeddingChange<T>(
  db: DB,
  reply: Pick<FastifyReply, "header">,
  save: () => Promise<T>,
): Promise<T> {
  let before: string | null | undefined;
  try {
    before = await embeddingConfiguration(db);
  } catch (error) {
    logger.warn(error, "Could not resolve the previous Long-term memory embedding configuration");
  }
  const saved = await save();
  let refreshSignal: AbortSignal | undefined;
  try {
    const after = await embeddingConfiguration(db);
    if (after === null || before === after) return saved;
    const service = runtimeService();
    if (typeof service?.refresh !== "function") {
      reply.header("X-Marinara-LTM-Refresh", "unavailable");
      return saved;
    }
    const result = await withLongTermMemoryRuntimeTimeout(getAgentCallTimeoutMs(), (signal) => {
      refreshSignal = signal;
      return service.refresh!({ signal });
    });
    if (result?.status !== "refreshed" && result?.status !== "deferred") {
      throw new Error("Long-term memory refresh returned an invalid outcome");
    }
    reply.header("X-Marinara-LTM-Refresh", result.status);
  } catch (error) {
    logger.warn(error, "Configuration saved, but Long-term memory index refresh did not complete");
    reply.header("X-Marinara-LTM-Refresh", refreshSignal?.aborted ? "timeout" : "failed");
  }
  return saved;
}

export async function withLongTermMemoryRuntimeTimeout<T>(
  timeoutMs: number,
  operation: (signal: AbortSignal) => Promise<T>,
  signal?: AbortSignal,
): Promise<T> {
  const timeoutController = new AbortController();
  const combinedSignal = signal ? AbortSignal.any([signal, timeoutController.signal]) : timeoutController.signal;
  const timeoutError = new Error(`Long-term memory operation timed out after ${timeoutMs} ms`);
  let rejectOnAbort: (() => void) | undefined;
  const aborted = new Promise<never>((_, reject) => {
    rejectOnAbort = () => {
      reject(combinedSignal.reason instanceof Error ? combinedSignal.reason : timeoutError);
    };
    if (combinedSignal.aborted) rejectOnAbort();
    else combinedSignal.addEventListener("abort", rejectOnAbort, { once: true });
  });
  const timeout = setTimeout(() => timeoutController.abort(timeoutError), timeoutMs);
  try {
    return await withLlmRequestTimeout(timeoutMs, () => Promise.race([operation(combinedSignal), aborted]));
  } finally {
    clearTimeout(timeout);
    if (rejectOnAbort) combinedSignal.removeEventListener("abort", rejectOnAbort);
  }
}

export async function recallLongTermMemory(
  input: Parameters<LongTermMemoryRuntimeService["recall"]>[0],
): Promise<{ text: string; receipt?: LongTermMemoryRecallReceipt } | null> {
  const service = runtimeService();
  if (!service) return null;
  try {
    const recall = await withLongTermMemoryRuntimeTimeout(
      getAgentCallTimeoutMs(),
      (signal) => service.recall({ ...input, signal }),
      input.signal,
    );
    const text = recall?.text.trim().slice(0, MAX_RECALL_CHARACTERS) ?? "";
    return text ? { text, receipt: recall?.receipt ?? null } : null;
  } catch (error) {
    if (input.signal?.aborted) return null;
    logger.warn(error, "Long-term memory recall failed; continuing without recalled context");
    return null;
  }
}

export async function recordLongTermMemoryPromptAccepted(
  input: Parameters<LongTermMemoryRuntimeService["recordPromptAccepted"]>[0],
): Promise<void> {
  const service = runtimeService();
  if (!service) return;
  try {
    await withLongTermMemoryRuntimeTimeout(getAgentCallTimeoutMs(), () => service.recordPromptAccepted(input));
  } catch (error) {
    logger.warn(error, "Long-term memory prompt accounting failed");
  }
}
