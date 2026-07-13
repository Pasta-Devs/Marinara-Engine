// ──────────────────────────────────────────────
// Storage: HumanOS v2 committed Runtime snapshots
// ──────────────────────────────────────────────
import { and, desc, eq } from "drizzle-orm";
import type { DB } from "../../db/connection.js";
import { gameEngineState } from "../../db/schema/index.js";
import { newId, now } from "../../utils/id-generator.js";

const GAME_TYPE = "humanos-v2";
const SCHEMA_VERSION = 2;

export interface CommitHumanOSRuntimeInput {
  chatId: string;
  messageId: string;
  swipeIndex: number;
  state: string;
  baseRevision: number;
  turnId: string;
  sourceContentHash: string;
  patchType: "humanos-runtime";
  idempotencyKey: string;
}

export type CommitHumanOSRuntimeResult =
  | { status: "committed" | "replayed"; row: typeof gameEngineState.$inferSelect }
  | { status: "revision_conflict"; expectedRevision: number; currentRevision: number }
  | { status: "idempotency_conflict" };

export function createHumanOSRuntimeStorage(db: DB) {
  return {
    async getLatestCommitted(chatId: string) {
      const rows = await db
        .select()
        .from(gameEngineState)
        .where(and(eq(gameEngineState.chatId, chatId), eq(gameEngineState.gameType, GAME_TYPE), eq(gameEngineState.committed, 1)))
        .orderBy(desc(gameEngineState.revision), desc(gameEngineState.createdAt))
        .limit(1);
      return rows[0] ?? null;
    },

    async commit(input: CommitHumanOSRuntimeInput): Promise<CommitHumanOSRuntimeResult> {
      return db.transaction(async (tx) => {
        const retries = await tx
          .select()
          .from(gameEngineState)
          .where(eq(gameEngineState.idempotencyKey, input.idempotencyKey))
          .limit(1);
        const retry = retries[0];
        if (retry) {
          const exact =
            retry.chatId === input.chatId &&
            retry.messageId === input.messageId &&
            retry.swipeIndex === input.swipeIndex &&
            retry.gameType === GAME_TYPE &&
            retry.state === input.state &&
            retry.baseRevision === input.baseRevision &&
            retry.turnId === input.turnId &&
            retry.sourceContentHash === input.sourceContentHash &&
            retry.patchType === input.patchType;
          return exact ? { status: "replayed", row: retry } : { status: "idempotency_conflict" };
        }

        const latestRows = await tx
          .select()
          .from(gameEngineState)
          .where(and(eq(gameEngineState.chatId, input.chatId), eq(gameEngineState.gameType, GAME_TYPE), eq(gameEngineState.committed, 1)))
          .orderBy(desc(gameEngineState.revision), desc(gameEngineState.createdAt))
          .limit(1);
        const currentRevision = latestRows[0]?.revision ?? 0;
        if (currentRevision !== input.baseRevision) {
          return { status: "revision_conflict", expectedRevision: input.baseRevision, currentRevision };
        }

        const row: typeof gameEngineState.$inferInsert = {
          id: newId(),
          chatId: input.chatId,
          messageId: input.messageId,
          swipeIndex: input.swipeIndex,
          gameType: GAME_TYPE,
          schemaVersion: SCHEMA_VERSION,
          state: input.state,
          committed: 1,
          revision: currentRevision + 1,
          baseRevision: input.baseRevision,
          turnId: input.turnId,
          sourceContentHash: input.sourceContentHash,
          patchType: input.patchType,
          idempotencyKey: input.idempotencyKey,
          createdAt: now(),
        };
        await tx.insert(gameEngineState).values(row);
        return { status: "committed", row: row as typeof gameEngineState.$inferSelect };
      });
    },
  };
}
