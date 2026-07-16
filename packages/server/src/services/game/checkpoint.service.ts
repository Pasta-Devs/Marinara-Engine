// ──────────────────────────────────────────────
// Service: Game Checkpoints
//
// Auto-save and manual checkpoint creation,
// listing, and loading for game mode.
// ──────────────────────────────────────────────

import { and, eq, desc } from "../../db/file-query.js";
import type { DB } from "../../db/connection.js";
import { gameCheckpoints, gameStateSnapshots, spatialContextSnapshots } from "../../db/schema/index.js";
import { newId, now } from "../../utils/id-generator.js";

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
}

export function createCheckpointService(db: DB) {
  return {
    async create(input: CreateCheckpointInput): Promise<string> {
      const capturedGameRows = await db
        .select()
        .from(gameStateSnapshots)
        .where(eq(gameStateSnapshots.id, input.snapshotId))
        .limit(1);
      const capturedGameSnapshot = capturedGameRows[0];
      if (!capturedGameSnapshot || capturedGameSnapshot.chatId !== input.chatId) {
        throw new Error("Checkpoint Game snapshot is missing or belongs to another chat");
      }

      const capturedSpatialRows = input.spatialSnapshotId
        ? await db
            .select()
            .from(spatialContextSnapshots)
            .where(eq(spatialContextSnapshots.id, input.spatialSnapshotId))
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

      const id = newId();
      await db.insert(gameCheckpoints).values({
        id,
        chatId: input.chatId,
        snapshotId: input.snapshotId,
        spatialSnapshotId: capturedSpatialSnapshot?.id ?? null,
        snapshotData: JSON.stringify(capturedGameSnapshot),
        spatialSnapshotData: capturedSpatialSnapshot ? JSON.stringify(capturedSpatialSnapshot) : null,
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
      return id;
    },

    async listForChat(chatId: string): Promise<CheckpointRow[]> {
      const rows = await db
        .select()
        .from(gameCheckpoints)
        .where(eq(gameCheckpoints.chatId, chatId))
        .orderBy(desc(gameCheckpoints.createdAt));
      return rows.map((row) => {
        const checkpoint = { ...row } as Record<string, unknown>;
        delete checkpoint.snapshotData;
        delete checkpoint.spatialSnapshotData;
        return checkpoint as unknown as CheckpointRow;
      });
    },

    async getById(id: string): Promise<StoredCheckpointRow | null> {
      const rows = await db.select().from(gameCheckpoints).where(eq(gameCheckpoints.id, id)).limit(1);
      return (rows[0] as StoredCheckpointRow) ?? null;
    },

    async deleteForChat(chatId: string): Promise<void> {
      await db.delete(gameCheckpoints).where(eq(gameCheckpoints.chatId, chatId));
    },

    async deleteById(id: string): Promise<void> {
      await db.delete(gameCheckpoints).where(eq(gameCheckpoints.id, id));
    },
  };
}
