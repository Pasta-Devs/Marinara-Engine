// ──────────────────────────────────────────────
// Service: Game Checkpoints
//
// Auto-save and manual checkpoint creation,
// listing, and loading for game mode.
// ──────────────────────────────────────────────

import { and, eq, ne, desc, inArray } from "../../db/file-query.js";
import type { DB } from "../../db/connection.js";
import { gameCheckpoints, gameStateSnapshots, spatialContextSnapshots } from "../../db/schema/index.js";
import { createGameEngineStateStorage } from "../storage/game-engine-state.storage.js";
import { newId, now } from "../../utils/id-generator.js";
import { logger } from "../../lib/logger.js";

export type CheckpointTrigger =
  | "manual"
  | "session_start"
  | "session_end"
  | "combat_start"
  | "combat_end"
  | "location_change"
  | "auto_interval";

export interface CreateCheckpointInput {
  chatId: string;
  snapshotId: string;
  spatialSnapshotId?: string | null;
  messageId: string;
  label: string;
  triggerType: CheckpointTrigger;
  location?: string | null;
  gameState?: string | null;
  weather?: string | null;
  timeOfDay?: string | null;
  turnNumber?: number | null;
}

export interface CheckpointRow {
  id: string;
  chatId: string;
  snapshotId: string;
  spatialSnapshotId: string | null;
  messageId: string;
  label: string;
  triggerType: string;
  location: string | null;
  gameState: string | null;
  weather: string | null;
  timeOfDay: string | null;
  turnNumber: number | null;
  createdAt: string;
}

export interface StoredCheckpointRow extends CheckpointRow {
  snapshotData: string | null;
  spatialSnapshotData: string | null;
  engineStateData: string | null;
}

/** One captured game_engine_state blob inside a checkpoint's engineStateData array (#5102). */
export interface CapturedEngineState {
  gameType: string;
  schemaVersion: number;
  state: string;
}

/** Auto-checkpoints fire at session start/end and on every combat start/end, and only manual
 *  deletion removed one — so a long campaign accumulated them without bound, each row carrying
 *  full immutable copies of the captured snapshots (and, once #5102 lands, the engine-state
 *  blobs). On the in-memory file store that is permanent heap plus an O(n^2) shard rewrite per
 *  new checkpoint. Cap the auto-checkpoints to the newest few PER TRIGGER TYPE so a campaign
 *  keeps a rewind point of each kind of event without hoarding every one; a manual checkpoint is
 *  the user's explicit save point and is never pruned (#5110). */
export const MAX_AUTO_CHECKPOINTS_PER_TRIGGER = 5;

/** Delete the oldest auto-checkpoints (everything except `manual`) beyond
 *  {@link MAX_AUTO_CHECKPOINTS_PER_TRIGGER} for each trigger type in a chat. `protectId` is the
 *  id of a checkpoint that must survive regardless (the row `create` just inserted), so a
 *  same-millisecond `createdAt` collision can never prune the checkpoint we are about to return. */
export async function pruneAutoCheckpoints(db: DB, chatId: string, protectId?: string): Promise<void> {
  const autoRows = await db
    .select({
      id: gameCheckpoints.id,
      triggerType: gameCheckpoints.triggerType,
      createdAt: gameCheckpoints.createdAt,
    })
    .from(gameCheckpoints)
    .where(and(eq(gameCheckpoints.chatId, chatId), ne(gameCheckpoints.triggerType, "manual")));

  const byTrigger = new Map<string, Array<{ id: string; createdAt: string }>>();
  for (const row of autoRows) {
    const bucket = byTrigger.get(row.triggerType) ?? [];
    bucket.push({ id: row.id, createdAt: row.createdAt });
    byTrigger.set(row.triggerType, bucket);
  }

  const overflowIds: string[] = [];
  for (const bucket of byTrigger.values()) {
    if (bucket.length <= MAX_AUTO_CHECKPOINTS_PER_TRIGGER) continue;
    // Newest first. createdAt is an ISO-8601 string (lexical order == chronological); id is a
    // deterministic tiebreak for the rare same-millisecond collision.
    bucket.sort((a, b) => (a.createdAt === b.createdAt ? (a.id < b.id ? 1 : -1) : a.createdAt < b.createdAt ? 1 : -1));
    // Retain exactly MAX rows, but always keep protectId — the row create() just inserted. A
    // same-millisecond createdAt tie can sort that fresh row out of the newest MAX by the id
    // tiebreak even though it is by definition the newest, so keep it plus the newest others up
    // to the cap. This still evicts down to MAX (keeping protectId out of the overflow slice
    // alone would leave MAX+1 rows behind).
    const keep = new Set<string>();
    if (protectId !== undefined && bucket.some((row) => row.id === protectId)) keep.add(protectId);
    for (const row of bucket) {
      if (keep.size >= MAX_AUTO_CHECKPOINTS_PER_TRIGGER) break;
      keep.add(row.id);
    }
    for (const row of bucket) {
      if (!keep.has(row.id)) overflowIds.push(row.id);
    }
  }

  if (overflowIds.length > 0) {
    await db
      .delete(gameCheckpoints)
      .where(and(eq(gameCheckpoints.chatId, chatId), inArray(gameCheckpoints.id, overflowIds)));
    logger.debug("Pruned %d expired auto-checkpoint(s) for chat %s", overflowIds.length, chatId);
  }
}

/** Per-chat promise tail that serializes checkpoint insert+prune. `create` inserts then prunes
 *  across an await, so two concurrent automatic creates on one chat could otherwise both read the
 *  same over-cap bucket and build overlapping delete sets — which, under a `createdAt` tie, can
 *  delete both freshly-inserted rows and leave the bucket below the cap. Module-level so every
 *  `createCheckpointService(db)` instance shares one tail per chat (mirrors the experience-state
 *  write lock in game.routes). */
const checkpointWriteTails = new Map<string, Promise<unknown>>();
function withCheckpointWriteLock<T>(chatId: string, task: () => Promise<T>): Promise<T> {
  const previous = checkpointWriteTails.get(chatId) ?? Promise.resolve();
  const run = previous.then(task, task);
  const tail = run.catch(() => undefined);
  checkpointWriteTails.set(chatId, tail);
  void tail.finally(() => {
    if (checkpointWriteTails.get(chatId) === tail) checkpointWriteTails.delete(chatId);
  });
  return run;
}

export function createCheckpointService(db: DB) {
  return {
    async create(input: CreateCheckpointInput): Promise<string> {
      const capturedGameRows = await db
        .select()
        .from(gameStateSnapshots)
        .where(and(eq(gameStateSnapshots.chatId, input.chatId), eq(gameStateSnapshots.id, input.snapshotId)))
        .limit(1);
      const capturedGameSnapshot = capturedGameRows[0];
      if (!capturedGameSnapshot || capturedGameSnapshot.chatId !== input.chatId) {
        throw new Error("Checkpoint Game snapshot is missing or belongs to another chat");
      }

      const capturedSpatialRows = input.spatialSnapshotId
        ? await db
            .select()
            .from(spatialContextSnapshots)
            .where(
              and(
                eq(spatialContextSnapshots.chatId, input.chatId),
                eq(spatialContextSnapshots.id, input.spatialSnapshotId),
              ),
            )
            .limit(1)
        : await db
            .select()
            .from(spatialContextSnapshots)
            .where(
              and(
                eq(spatialContextSnapshots.chatId, input.chatId),
                eq(spatialContextSnapshots.messageId, capturedGameSnapshot.messageId),
                eq(spatialContextSnapshots.swipeIndex, capturedGameSnapshot.swipeIndex),
              ),
            )
            .limit(1);
      const capturedSpatialSnapshot = capturedSpatialRows[0] ?? null;
      if (capturedSpatialSnapshot && capturedSpatialSnapshot.chatId !== input.chatId) {
        throw new Error("Checkpoint Spatial Context snapshot belongs to another chat");
      }

      // Engine-state blobs (turn-games AND game-surface Experiences) are captured by VALUE at
      // create time (#5102): the legacy restore re-lookup keyed on createdAt breaks whenever a
      // writer delete-recreates one anchor (every experience save within a narration turn, and
      // silent turn games), because the checkpoint-time row's timestamp moves past the
      // checkpoint. Newest row per gameType = the world "now", mirroring snapshotData.
      const capturedEngineStates = (await createGameEngineStateStorage(db).latestPerGameType(input.chatId)).map(
        (row): CapturedEngineState => ({ gameType: row.gameType, schemaVersion: row.schemaVersion, state: row.state }),
      );

      const id = newId();
      // Serialize the insert + prune per chat so concurrent automatic creates cannot race on the
      // same bucket (see withCheckpointWriteLock). The snapshot reads above touch other tables and
      // stay outside the lock.
      await withCheckpointWriteLock(input.chatId, async () => {
        await db.insert(gameCheckpoints).values({
          id,
          chatId: input.chatId,
          snapshotId: input.snapshotId,
          spatialSnapshotId: capturedSpatialSnapshot?.id ?? null,
          snapshotData: JSON.stringify(capturedGameSnapshot),
          spatialSnapshotData: capturedSpatialSnapshot ? JSON.stringify(capturedSpatialSnapshot) : null,
          engineStateData: capturedEngineStates.length > 0 ? JSON.stringify(capturedEngineStates) : null,
          messageId: input.messageId,
          label: input.label,
          triggerType: input.triggerType,
          location: input.location ?? null,
          gameState: input.gameState ?? null,
          weather: input.weather ?? null,
          timeOfDay: input.timeOfDay ?? null,
          turnNumber: input.turnNumber ?? null,
          createdAt: now(),
        });
        // A manual save never grows an auto bucket, so only an auto checkpoint can push a bucket
        // over the cap; skip the scan on manual creates.
        if (input.triggerType !== "manual") {
          await pruneAutoCheckpoints(db, input.chatId, id);
        }
      });
      return id;
    },

    async listForChat(chatId: string): Promise<CheckpointRow[]> {
      // Project only the list columns so the (potentially large) captured snapshot blobs are
      // never copied out of the store just to be stripped again — the list never needs them.
      const rows = await db
        .select({
          id: gameCheckpoints.id,
          chatId: gameCheckpoints.chatId,
          snapshotId: gameCheckpoints.snapshotId,
          spatialSnapshotId: gameCheckpoints.spatialSnapshotId,
          messageId: gameCheckpoints.messageId,
          label: gameCheckpoints.label,
          triggerType: gameCheckpoints.triggerType,
          location: gameCheckpoints.location,
          gameState: gameCheckpoints.gameState,
          weather: gameCheckpoints.weather,
          timeOfDay: gameCheckpoints.timeOfDay,
          turnNumber: gameCheckpoints.turnNumber,
          createdAt: gameCheckpoints.createdAt,
        })
        .from(gameCheckpoints)
        .where(eq(gameCheckpoints.chatId, chatId))
        .orderBy(desc(gameCheckpoints.createdAt));
      // The projection already omits every blob column (snapshotData, spatialSnapshotData,
      // engineStateData), so the rows are list-shaped as-is — no post-strip needed.
      return rows as CheckpointRow[];
    },

    async getById(id: string, chatId?: string): Promise<StoredCheckpointRow | null> {
      const condition = chatId
        ? and(eq(gameCheckpoints.chatId, chatId), eq(gameCheckpoints.id, id))
        : eq(gameCheckpoints.id, id);
      const rows = await db.select().from(gameCheckpoints).where(condition).limit(1);
      return (rows[0] as StoredCheckpointRow) ?? null;
    },

    async deleteForChat(chatId: string): Promise<void> {
      await db.delete(gameCheckpoints).where(eq(gameCheckpoints.chatId, chatId));
    },

    async deleteById(id: string, chatId?: string): Promise<void> {
      const condition = chatId
        ? and(eq(gameCheckpoints.chatId, chatId), eq(gameCheckpoints.id, id))
        : eq(gameCheckpoints.id, id);
      await db.delete(gameCheckpoints).where(condition);
    },
  };
}
