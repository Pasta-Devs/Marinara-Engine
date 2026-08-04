import type {
  EntitySummaryBatch,
  EntitySummaryBatchItem,
  EntitySummaryBatchItemStatus,
  EntitySummaryBatchStatus,
  EntitySummaryKind,
} from "@marinara-engine/shared";
import type { DB } from "../../db/connection.js";
import { and, asc, eq, inArray } from "../../db/file-query.js";
import { entitySummaryBatchItems, entitySummaryBatches } from "../../db/schema/index.js";
import { newId, now } from "../../utils/id-generator.js";

type BatchRow = typeof entitySummaryBatches.$inferSelect;
type ItemRow = typeof entitySummaryBatchItems.$inferSelect;

async function settleBatchInTransaction(tx: DB, batchId: string, timestamp: string) {
  const batches = await tx.select().from(entitySummaryBatches).where(eq(entitySummaryBatches.id, batchId));
  const batch = batches[0];
  if (!batch || batch.cancelRequested === "true") return;
  const items = await tx.select().from(entitySummaryBatchItems).where(eq(entitySummaryBatchItems.batchId, batchId));
  const active = items.some((item) => item.status === "queued" || item.status === "running");
  const status: EntitySummaryBatchStatus = active ? "running" : "completed";
  await tx
    .update(entitySummaryBatches)
    .set({ status, updatedAt: timestamp, completedAt: active ? null : timestamp })
    .where(eq(entitySummaryBatches.id, batchId));
}

function toItem(row: ItemRow): EntitySummaryBatchItem {
  return {
    id: row.id,
    batchId: row.batchId,
    kind: row.kind,
    entityId: row.entityId,
    status: row.status,
    attempts: row.attempts,
    sourceHash: row.sourceHash,
    candidateSummary: row.candidateSummary,
    error: row.error,
    connectionId: row.connectionId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toBatch(row: BatchRow, items: ItemRow[]): EntitySummaryBatch {
  return {
    id: row.id,
    status: row.status,
    cancelRequested: row.cancelRequested === "true",
    timeoutMs: row.timeoutMs,
    debugMode: row.debugMode === "true",
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    completedAt: row.completedAt,
    items: items.map(toItem),
  };
}

export function createEntitySummaryBatchStorage(db: DB) {
  return {
    async create(input: {
      items: Array<{ kind: EntitySummaryKind; entityId: string }>;
      timeoutMs: number;
      debugMode: boolean;
    }) {
      const id = newId();
      const timestamp = now();
      await db.transaction(async (tx) => {
        await tx.insert(entitySummaryBatches).values({
          id,
          status: "queued",
          cancelRequested: "false",
          timeoutMs: input.timeoutMs,
          debugMode: String(input.debugMode),
          createdAt: timestamp,
          updatedAt: timestamp,
          completedAt: null,
        });
        for (const item of input.items) {
          await tx.insert(entitySummaryBatchItems).values({
            id: newId(),
            batchId: id,
            kind: item.kind,
            entityId: item.entityId,
            status: "queued",
            attempts: 0,
            sourceHash: null,
            sourceSummaryHash: null,
            candidateSummary: null,
            error: null,
            connectionId: null,
            createdAt: timestamp,
            updatedAt: timestamp,
          });
        }
      });
      return (await this.get(id))!;
    },

    async get(batchId: string) {
      const rows = await db.select().from(entitySummaryBatches).where(eq(entitySummaryBatches.id, batchId));
      if (!rows[0]) return null;
      const items = await db
        .select()
        .from(entitySummaryBatchItems)
        .where(eq(entitySummaryBatchItems.batchId, batchId))
        .orderBy(asc(entitySummaryBatchItems.createdAt), asc(entitySummaryBatchItems.id));
      return toBatch(rows[0], items);
    },

    async getItem(batchId: string, itemId: string) {
      const rows = await db
        .select()
        .from(entitySummaryBatchItems)
        .where(and(eq(entitySummaryBatchItems.batchId, batchId), eq(entitySummaryBatchItems.id, itemId)));
      return rows[0] ?? null;
    },

    async listRunnable() {
      return db
        .select()
        .from(entitySummaryBatchItems)
        .where(eq(entitySummaryBatchItems.status, "queued"))
        .orderBy(asc(entitySummaryBatchItems.createdAt), asc(entitySummaryBatchItems.id));
    },

    async markRunning(batchId: string, itemId: string) {
      const timestamp = now();
      return db.transaction(async (tx) => {
        const batches = await tx.select().from(entitySummaryBatches).where(eq(entitySummaryBatches.id, batchId));
        if (!batches[0] || batches[0].cancelRequested === "true") return null;
        const rows = await tx
          .select()
          .from(entitySummaryBatchItems)
          .where(and(eq(entitySummaryBatchItems.batchId, batchId), eq(entitySummaryBatchItems.id, itemId)));
        const item = rows[0];
        if (!item || item.status !== "queued") return null;
        const attempt = item.attempts + 1;
        await tx
          .update(entitySummaryBatchItems)
          .set({ status: "running", attempts: attempt, error: null, updatedAt: timestamp })
          .where(eq(entitySummaryBatchItems.id, itemId));
        await tx
          .update(entitySummaryBatches)
          .set({ status: "running", updatedAt: timestamp, completedAt: null })
          .where(eq(entitySummaryBatches.id, batchId));
        return attempt;
      });
    },

    async finishItem(
      batchId: string,
      itemId: string,
      attempt: number,
      update: {
        status: Extract<EntitySummaryBatchItemStatus, "candidate" | "failed" | "cancelled" | "stale">;
        sourceHash?: string | null;
        sourceSummaryHash?: string | null;
        candidateSummary?: string | null;
        error?: string | null;
        connectionId?: string | null;
      },
    ) {
      return db.transaction(async (tx) => {
        const rows = await tx
          .select()
          .from(entitySummaryBatchItems)
          .where(and(eq(entitySummaryBatchItems.batchId, batchId), eq(entitySummaryBatchItems.id, itemId)));
        const item = rows[0];
        if (!item || item.status !== "running" || item.attempts !== attempt) return false;
        const timestamp = now();
        await tx
          .update(entitySummaryBatchItems)
          .set({ ...update, updatedAt: timestamp })
          .where(eq(entitySummaryBatchItems.id, itemId));
        await settleBatchInTransaction(tx, batchId, timestamp);
        return true;
      });
    },

    async interruptItem(batchId: string, itemId: string, attempt: number) {
      await db.transaction(async (tx) => {
        const rows = await tx
          .select()
          .from(entitySummaryBatchItems)
          .where(and(eq(entitySummaryBatchItems.batchId, batchId), eq(entitySummaryBatchItems.id, itemId)));
        const item = rows[0];
        if (!item || item.status !== "running" || item.attempts !== attempt) return;
        const timestamp = now();
        await tx
          .update(entitySummaryBatchItems)
          .set({
            status: "queued",
            error: "Interrupted by server shutdown; queued for retry",
            updatedAt: timestamp,
          })
          .where(eq(entitySummaryBatchItems.id, itemId));
        await tx
          .update(entitySummaryBatches)
          .set({ status: "queued", completedAt: null, updatedAt: timestamp })
          .where(eq(entitySummaryBatches.id, batchId));
      });
    },

    async reconcileInterrupted() {
      const timestamp = now();
      await db.transaction(async (tx) => {
        const batches = await tx.select().from(entitySummaryBatches);
        for (const batch of batches) {
          const items = await tx
            .select()
            .from(entitySummaryBatchItems)
            .where(eq(entitySummaryBatchItems.batchId, batch.id));
          const interruptedStatus = batch.cancelRequested === "true" ? "cancelled" : "queued";
          for (const item of items.filter((candidate) => candidate.status === "running")) {
            await tx
              .update(entitySummaryBatchItems)
              .set({
                status: interruptedStatus,
                error:
                  interruptedStatus === "cancelled"
                    ? "Batch cancelled"
                    : "Interrupted by server restart; queued for retry",
                updatedAt: timestamp,
              })
              .where(eq(entitySummaryBatchItems.id, item.id));
            item.status = interruptedStatus;
          }
          if (batch.cancelRequested === "true") {
            await tx
              .update(entitySummaryBatches)
              .set({ status: "cancelled", completedAt: batch.completedAt ?? timestamp, updatedAt: timestamp })
              .where(eq(entitySummaryBatches.id, batch.id));
            continue;
          }
          const active = items.some((item) => item.status === "queued" || item.status === "running");
          await tx
            .update(entitySummaryBatches)
            .set({
              status: active ? "queued" : "completed",
              completedAt: active ? null : (batch.completedAt ?? timestamp),
              updatedAt: timestamp,
            })
            .where(eq(entitySummaryBatches.id, batch.id));
        }
      });
    },

    async requeue(batchId: string, itemId: string) {
      const timestamp = now();
      return db.transaction(async (tx) => {
        const rows = await tx
          .select()
          .from(entitySummaryBatchItems)
          .where(and(eq(entitySummaryBatchItems.batchId, batchId), eq(entitySummaryBatchItems.id, itemId)));
        const item = rows[0];
        if (!item) return "not-found" as const;
        if (!["failed", "cancelled", "stale"].includes(item.status)) return "not-retryable" as const;
        await tx
          .update(entitySummaryBatchItems)
          .set({
            status: "queued",
            sourceHash: null,
            sourceSummaryHash: null,
            candidateSummary: null,
            error: null,
            connectionId: null,
            updatedAt: timestamp,
          })
          .where(eq(entitySummaryBatchItems.id, itemId));
        await tx
          .update(entitySummaryBatches)
          .set({ status: "queued", cancelRequested: "false", completedAt: null, updatedAt: timestamp })
          .where(eq(entitySummaryBatches.id, batchId));
        return "requeued" as const;
      });
    },

    async requestCancel(batchId: string) {
      const timestamp = now();
      let changed = false;
      await db.transaction(async (tx) => {
        const batches = await tx.select().from(entitySummaryBatches).where(eq(entitySummaryBatches.id, batchId));
        if (!batches[0] || ["completed", "cancelled"].includes(batches[0].status)) return;
        changed = true;
        await tx
          .update(entitySummaryBatches)
          .set({ status: "cancelled", cancelRequested: "true", completedAt: timestamp, updatedAt: timestamp })
          .where(eq(entitySummaryBatches.id, batchId));
        await tx
          .update(entitySummaryBatchItems)
          .set({ status: "cancelled", error: "Batch cancelled", updatedAt: timestamp })
          .where(
            and(
              eq(entitySummaryBatchItems.batchId, batchId),
              inArray(entitySummaryBatchItems.status, ["queued", "running"]),
            ),
          );
      });
      return changed;
    },

    async settleBatch(batchId: string) {
      const timestamp = now();
      await db.transaction(async (tx) => {
        await settleBatchInTransaction(tx, batchId, timestamp);
      });
    },
  };
}

export type EntitySummaryBatchStorage = ReturnType<typeof createEntitySummaryBatchStorage>;
