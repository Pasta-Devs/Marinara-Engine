import { createHash } from "node:crypto";
import { EventEmitter } from "node:events";
import type {
  EntitySummaryBatch,
  EntitySummaryBatchItemRef,
  EntitySummaryKind,
  Lorebook,
  LorebookEntry,
  Persona,
} from "@marinara-engine/shared";
import type { DB } from "../../db/connection.js";
import { and, eq } from "../../db/file-query.js";
import { characters, entitySummaryBatchItems, lorebookEntries, lorebooks, personas } from "../../db/schema/index.js";
import { isDebugAgentsEnabled } from "../../config/runtime-config.js";
import { logDebugOverride, logger } from "../../lib/logger.js";
import { resolveBaseUrl } from "../generation/connection-base-url.js";
import { withLlmRequestTimeout, type BaseLLMProvider } from "../llm/base-provider.js";
import { createLLMProvider } from "../llm/provider-registry.js";
import { withConnectionFallbackProvider } from "../llm/connection-fallback-provider.js";
import { createConnectionsStorage } from "../storage/connections.storage.js";
import { ENTITY_SUMMARY_PROJECTION_VERSION, projectAndHashEntitySummary } from "./entity-summary-projection.js";
import { createEntitySummaryBatchStorage, type EntitySummaryBatchStorage } from "./entity-summary-batch.storage.js";

type LoadedEntity = {
  kind: EntitySummaryKind;
  name: string;
  projection: unknown;
  contentHash: string;
  summaryHash: string;
};

type Generator = (args: {
  item: EntitySummaryBatchItemRef;
  entity: LoadedEntity;
  timeoutMs: number;
  debugMode: boolean;
  signal: AbortSignal;
}) => Promise<{ summary: string; connectionId: string }>;

function hashSummary(value: unknown): string {
  return `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
}

function summaryState(entity: {
  entitySummary?: unknown;
  entitySummaryGeneratedAt?: unknown;
  entitySummarySource?: unknown;
  entitySummaryContentHash?: unknown;
  entitySummaryProjectionVersion?: unknown;
}) {
  return hashSummary({
    summary: entity.entitySummary ?? "",
    generatedAt: entity.entitySummaryGeneratedAt ?? null,
    source: entity.entitySummarySource ?? null,
    contentHash: entity.entitySummaryContentHash ?? null,
    projectionVersion: entity.entitySummaryProjectionVersion ?? null,
  });
}

function parseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function entityPrompt(entity: LoadedEntity): string {
  return [
    "Summarize this library entity for quick human review and semantic discovery.",
    "Be factual, specific, and compact. Preserve names, roles, relationships, setting, and defining traits.",
    "Do not invent details, mention these instructions, use markdown headings, or prefix the answer.",
    "Return only the summary in at most 900 characters.",
    `Entity kind: ${entity.kind}`,
    `Entity name: ${entity.name}`,
    `Canonical source:\n${JSON.stringify(entity.projection)}`,
  ].join("\n\n");
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message.slice(0, 2_000);
  return "Entity summary generation failed";
}

async function raceTimeout<T>(operation: Promise<T>, timeoutMs: number, controller: AbortController): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error(`Entity summary generation timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    timer.unref?.();
  });
  try {
    return await Promise.race([operation, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export class EntitySummaryBatchService {
  private readonly storage: EntitySummaryBatchStorage;
  private readonly events = new EventEmitter();
  private runner: Promise<void> | null = null;
  private active: { batchId: string; itemId: string; controller: AbortController } | null = null;
  private stopping = false;

  constructor(
    private readonly db: DB,
    private readonly generate: Generator = (args) => this.generateWithConfiguredConnection(args),
  ) {
    this.storage = createEntitySummaryBatchStorage(db);
    this.events.setMaxListeners(100);
  }

  async start() {
    this.stopping = false;
    await this.storage.reconcileInterrupted();
    this.kick();
  }

  async stop() {
    this.stopping = true;
    this.active?.controller.abort();
    await this.runner;
  }

  async create(input: { items: EntitySummaryBatchItemRef[]; timeoutMs: number; debugMode: boolean }) {
    const seen = new Set<string>();
    const items = input.items.filter((item) => {
      const key = `${item.kind}:${item.entityId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    const batch = await this.storage.create({ ...input, items });
    this.emit(batch.id);
    this.kick();
    return batch;
  }

  get(batchId: string) {
    return this.storage.get(batchId);
  }

  subscribe(batchId: string, listener: (batch: EntitySummaryBatch) => void) {
    const event = `batch:${batchId}`;
    this.events.on(event, listener);
    return () => this.events.off(event, listener);
  }

  async retry(batchId: string, itemId: string) {
    const result = await this.storage.requeue(batchId, itemId);
    if (result === "requeued") {
      this.emit(batchId);
      this.kick();
    }
    return result;
  }

  async cancel(batchId: string) {
    const changed = await this.storage.requestCancel(batchId);
    if (changed && this.active?.batchId === batchId) this.active.controller.abort();
    if (changed) this.emit(batchId);
    return changed;
  }

  async apply(batchId: string, itemId: string) {
    let result: "applied" | "not-found" | "not-ready" | "stale" = "not-found";
    await this.db.transaction(async (tx) => {
      const rows = await tx
        .select()
        .from(entitySummaryBatchItems)
        .where(and(eq(entitySummaryBatchItems.batchId, batchId), eq(entitySummaryBatchItems.id, itemId)));
      const item = rows[0];
      if (!item) return;
      if (item.status !== "candidate" || !item.candidateSummary || !item.sourceHash || !item.sourceSummaryHash) {
        result = "not-ready";
        return;
      }
      const entity = await this.loadEntity(item.kind, item.entityId, tx);
      if (!entity || entity.contentHash !== item.sourceHash || entity.summaryHash !== item.sourceSummaryHash) {
        result = "stale";
        await tx
          .update(entitySummaryBatchItems)
          .set({
            status: "stale",
            error: "Entity source or summary changed before apply",
            updatedAt: new Date().toISOString(),
          })
          .where(eq(entitySummaryBatchItems.id, itemId));
        return;
      }
      const timestamp = new Date().toISOString();
      const fields = {
        entitySummary: item.candidateSummary,
        entitySummaryGeneratedAt: timestamp,
        entitySummarySource: "ai" as const,
        entitySummaryContentHash: item.sourceHash,
        entitySummaryProjectionVersion: ENTITY_SUMMARY_PROJECTION_VERSION,
      };
      if (item.kind === "character") {
        const characterRows = await tx.select().from(characters).where(eq(characters.id, item.entityId));
        const character = characterRows[0];
        if (!character) return;
        const data = JSON.parse(character.data) as Record<string, unknown>;
        const extensions =
          data.extensions && typeof data.extensions === "object" && !Array.isArray(data.extensions)
            ? (data.extensions as Record<string, unknown>)
            : {};
        await tx
          .update(characters)
          .set({ data: JSON.stringify({ ...data, extensions: { ...extensions, ...fields } }), updatedAt: timestamp })
          .where(eq(characters.id, item.entityId));
      } else if (item.kind === "persona") {
        await tx
          .update(personas)
          .set({ ...fields, updatedAt: timestamp })
          .where(eq(personas.id, item.entityId));
      } else {
        await tx
          .update(lorebooks)
          .set({ ...fields, updatedAt: timestamp })
          .where(eq(lorebooks.id, item.entityId));
      }
      await tx
        .update(entitySummaryBatchItems)
        .set({ status: "applied", error: null, updatedAt: timestamp })
        .where(eq(entitySummaryBatchItems.id, itemId));
      result = "applied";
    });
    await this.storage.settleBatch(batchId);
    this.emit(batchId);
    return result;
  }

  private kick() {
    if (this.runner || this.stopping) return;
    this.runner = this.run().finally(() => {
      this.runner = null;
      if (!this.stopping) void this.storage.listRunnable().then((items) => items.length > 0 && this.kick());
    });
  }

  private async run() {
    while (!this.stopping) {
      const item = (await this.storage.listRunnable())[0];
      if (!item) return;
      const batch = await this.storage.get(item.batchId);
      if (!batch || batch.cancelRequested) continue;
      const controller = new AbortController();
      this.active = { batchId: item.batchId, itemId: item.id, controller };
      const attempt = await this.storage.markRunning(item.batchId, item.id);
      if (attempt === null) {
        if (this.active?.controller === controller) this.active = null;
        continue;
      }
      this.emit(item.batchId);
      try {
        controller.signal.throwIfAborted();
        const entity = await this.loadEntity(item.kind, item.entityId, this.db);
        if (!entity) throw new Error(`${item.kind} ${item.entityId} was not found`);
        const generated = await this.generate({
          item: { kind: item.kind, entityId: item.entityId },
          entity,
          timeoutMs: batch.timeoutMs,
          debugMode: batch.debugMode,
          signal: controller.signal,
        });
        controller.signal.throwIfAborted();
        const summary = generated.summary.trim();
        if (!summary) throw new Error("Provider returned an empty entity summary");
        await this.storage.finishItem(item.batchId, item.id, attempt, {
          status: "candidate",
          sourceHash: entity.contentHash,
          sourceSummaryHash: entity.summaryHash,
          candidateSummary: summary.slice(0, 4_000),
          error: null,
          connectionId: generated.connectionId,
        });
      } catch (error) {
        if (this.stopping) {
          await this.storage.interruptItem(item.batchId, item.id, attempt);
        } else {
          const current = await this.storage.get(item.batchId);
          const cancelled = current?.cancelRequested === true;
          const changed = await this.storage.finishItem(item.batchId, item.id, attempt, {
            status: cancelled ? "cancelled" : "failed",
            error: cancelled ? "Batch cancelled" : errorMessage(error),
          });
          if (changed && !cancelled) logger.warn(error, "Entity summary batch item %s failed", item.id);
        }
      } finally {
        if (this.active?.controller === controller) this.active = null;
        this.emit(item.batchId);
      }
    }
  }

  private async emit(batchId: string) {
    const batch = await this.storage.get(batchId);
    if (batch) this.events.emit(`batch:${batchId}`, batch);
  }

  private async loadEntity(kind: EntitySummaryKind, entityId: string, db: DB): Promise<LoadedEntity | null> {
    if (kind === "character") {
      const rows = await db.select().from(characters).where(eq(characters.id, entityId));
      if (!rows[0]) return null;
      const data = JSON.parse(rows[0].data);
      const projected = projectAndHashEntitySummary("character", data);
      return {
        kind,
        name: data.name || "Unnamed character",
        ...projected,
        summaryHash: summaryState(data.extensions ?? {}),
      };
    }
    if (kind === "persona") {
      const rows = await db.select().from(personas).where(eq(personas.id, entityId));
      if (!rows[0]) return null;
      const row = rows[0];
      const persona = { ...row, tags: parseStringArray(row.tags) } as unknown as Persona;
      const projected = projectAndHashEntitySummary("persona", persona);
      return { kind, name: row.name, ...projected, summaryHash: summaryState(row) };
    }
    const rows = await db.select().from(lorebooks).where(eq(lorebooks.id, entityId));
    if (!rows[0]) return null;
    const row = rows[0];
    const entryRows = await db.select().from(lorebookEntries).where(eq(lorebookEntries.lorebookId, entityId));
    const entries = entryRows.map(
      (entry) =>
        ({
          ...entry,
          keys: parseStringArray(entry.keys),
          secondaryKeys: parseStringArray(entry.secondaryKeys),
        }) as unknown as LorebookEntry,
    );
    const projected = projectAndHashEntitySummary(
      "lorebook",
      { ...row, tags: parseStringArray(row.tags) } as unknown as Partial<Lorebook>,
      entries,
    );
    return { kind, name: row.name, ...projected, summaryHash: summaryState(row) };
  }

  private async generateWithConfiguredConnection(args: Parameters<Generator>[0]) {
    const connections = createConnectionsStorage(this.db);
    const primary = await connections.getDefaultForAgents();
    if (!primary) throw new Error("No default Agent text connection is configured");
    const baseUrl = resolveBaseUrl(primary);
    if (!baseUrl) throw new Error("The default Agent connection has no usable base URL");
    const fallback = await connections.getFallbackForAgents();
    let usedConnectionId = primary.id;
    const provider: BaseLLMProvider = withConnectionFallbackProvider({
      primary: createLLMProvider(
        primary.provider,
        baseUrl,
        primary.apiKey,
        primary.maxContext,
        primary.openrouterProvider,
        primary.maxTokensOverride,
        primary.claudeFastMode === "true",
        primary.treatAsLocalEndpoint === "true",
        primary.defaultParameters,
      ),
      primaryConnectionId: primary.id,
      fallbackConnection: fallback,
      fallbackBaseUrl: fallback ? resolveBaseUrl(fallback) : "",
      category: "agents",
      onFallback: (notice) => {
        usedConnectionId = notice.connectionId;
      },
    });
    const prompt = entityPrompt(args.entity);
    logDebugOverride(
      args.debugMode || isDebugAgentsEnabled(),
      "[debug/entity-summary-batch] final prompt for %s:%s:\n%s",
      args.item.kind,
      args.item.entityId,
      prompt,
    );
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (args.signal.aborted) controller.abort();
    else args.signal.addEventListener("abort", abort, { once: true });
    try {
      const result = await raceTimeout(
        withLlmRequestTimeout(args.timeoutMs, () =>
          provider.chatComplete([{ role: "user", content: prompt }], {
            model: primary.model,
            temperature: 0.2,
            maxTokens: 500,
            signal: controller.signal,
            debugMode: args.debugMode,
          }),
        ),
        args.timeoutMs,
        controller,
      );
      return { summary: result.content ?? "", connectionId: usedConnectionId };
    } finally {
      args.signal.removeEventListener("abort", abort);
    }
  }
}
