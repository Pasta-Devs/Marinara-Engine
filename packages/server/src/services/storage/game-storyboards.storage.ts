import { and, asc, desc, eq, inArray, lt } from "../../db/file-query.js";
import type { DB } from "../../db/connection.js";
import { gameTurnStoryboardKeyframes, gameTurnStoryboards } from "../../db/schema/index.js";
import { newId, now } from "../../utils/id-generator.js";

export interface CreateGameTurnStoryboardInput {
  chatId: string;
  messageId: string;
  swipeIndex: number;
  snapshotId?: string | null;
  sessionNumber?: number | null;
  turnNumber?: number | null;
  title?: string;
  sourceNarration: string;
  sourceNarrationHash: string;
  status?: string;
  provider?: string;
  model?: string;
  directorPrompt?: string;
  error?: string | null;
}

export interface CreateGameTurnStoryboardKeyframeInput {
  index: number;
  title?: string;
  sectionStartIndex?: number | null;
  sectionEndIndex?: number | null;
  anchorQuote?: string;
  anchorKind?: string;
  narrationBeat?: string;
  mangaPanelPrompt?: string;
  imagePrompt?: string;
  videoPrompt?: string;
  animationSuitability?: string;
  characters?: string;
  continuityNotes?: string;
  cameraMotion?: string;
  transitionHint?: string;
  durationSeconds?: number;
  aspectRatio?: string;
  chatImageId?: string | null;
  sceneVideoId?: string | null;
  status?: string;
  error?: string | null;
}

export function createGameStoryboardsStorage(db: DB) {
  return {
    async listByChatId(chatId: string) {
      return db
        .select()
        .from(gameTurnStoryboards)
        .where(eq(gameTurnStoryboards.chatId, chatId))
        .orderBy(desc(gameTurnStoryboards.createdAt));
    },

    async listRecentByChatId(chatId: string, limit: number) {
      return db
        .select()
        .from(gameTurnStoryboards)
        .where(eq(gameTurnStoryboards.chatId, chatId))
        .orderBy(desc(gameTurnStoryboards.createdAt))
        .limit(limit);
    },

    async listForTurn(chatId: string, messageId: string, swipeIndex: number) {
      return db
        .select()
        .from(gameTurnStoryboards)
        .where(
          and(
            eq(gameTurnStoryboards.chatId, chatId),
            eq(gameTurnStoryboards.messageId, messageId),
            eq(gameTurnStoryboards.swipeIndex, swipeIndex),
          ),
        )
        .orderBy(desc(gameTurnStoryboards.createdAt));
    },

    async getById(id: string, chatId?: string) {
      // The optional chatId keeps the read's unit scope resolvable when the
      // row's unit is not resident (#5592 PR-B) — a bare-PK probe miss would
      // otherwise lease the whole table, permanently for this process.
      const condition = chatId
        ? and(eq(gameTurnStoryboards.chatId, chatId), eq(gameTurnStoryboards.id, id))
        : eq(gameTurnStoryboards.id, id);
      const rows = await db.select().from(gameTurnStoryboards).where(condition);
      return rows[0] ?? null;
    },

    async listKeyframes(storyboardId: string) {
      return db
        .select()
        .from(gameTurnStoryboardKeyframes)
        .where(eq(gameTurnStoryboardKeyframes.storyboardId, storyboardId))
        .orderBy(asc(gameTurnStoryboardKeyframes.index));
    },

    async create(input: CreateGameTurnStoryboardInput) {
      const id = newId();
      const timestamp = now();
      await db.insert(gameTurnStoryboards).values({
        id,
        chatId: input.chatId,
        messageId: input.messageId,
        swipeIndex: input.swipeIndex,
        snapshotId: input.snapshotId ?? null,
        sessionNumber: input.sessionNumber ?? null,
        turnNumber: input.turnNumber ?? null,
        title: input.title ?? "",
        sourceNarration: input.sourceNarration,
        sourceNarrationHash: input.sourceNarrationHash,
        status: input.status ?? "planning",
        provider: input.provider ?? "",
        model: input.model ?? "",
        directorPrompt: input.directorPrompt ?? "",
        error: input.error ?? null,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      return this.getById(id);
    },

    async update(id: string, patch: Partial<typeof gameTurnStoryboards.$inferInsert>, chatId?: string) {
      const condition = chatId
        ? and(eq(gameTurnStoryboards.chatId, chatId), eq(gameTurnStoryboards.id, id))
        : eq(gameTurnStoryboards.id, id);
      await db
        .update(gameTurnStoryboards)
        .set({ ...patch, updatedAt: now() })
        .where(condition);
      return this.getById(id, chatId);
    },

    /**
     * `chatId` scopes the sweep to one chat so the lazy store (#5592 Phase 2)
     * loads only that chat's unit; the storyboard routes sweep their own chat
     * before reading, with a cutoff that also covers pre-boot crash leftovers.
     * The unscoped form remains for eager storage but leases the whole table.
     */
    async failInProgressUpdatedBefore(cutoffUpdatedAt: string, error: string, chatId?: string) {
      const inProgressStoryboardStatuses = ["planning", "rendering_images", "rendering_videos"];
      const inProgressKeyframeStatuses = ["planned", "rendering_image", "rendering_video"];
      const staleCondition = and(
        inArray(gameTurnStoryboards.status, inProgressStoryboardStatuses),
        lt(gameTurnStoryboards.updatedAt, cutoffUpdatedAt),
      );
      const staleRows = await db
        .select({ id: gameTurnStoryboards.id })
        .from(gameTurnStoryboards)
        .where(chatId ? and(eq(gameTurnStoryboards.chatId, chatId), staleCondition) : staleCondition);
      if (staleRows.length === 0) return 0;

      const staleIds = staleRows.map((row) => row.id);
      const timestamp = now();
      await db
        .update(gameTurnStoryboards)
        .set({ status: "failed", error, updatedAt: timestamp })
        .where(
          chatId
            ? and(eq(gameTurnStoryboards.chatId, chatId), inArray(gameTurnStoryboards.id, staleIds))
            : inArray(gameTurnStoryboards.id, staleIds),
        );
      await db
        .update(gameTurnStoryboardKeyframes)
        .set({ status: "failed", error, updatedAt: timestamp })
        .where(
          and(
            inArray(gameTurnStoryboardKeyframes.storyboardId, staleIds),
            inArray(gameTurnStoryboardKeyframes.status, inProgressKeyframeStatuses),
          ),
        );

      return staleRows.length;
    },

    async replaceKeyframes(storyboardId: string, frames: CreateGameTurnStoryboardKeyframeInput[]) {
      await db.delete(gameTurnStoryboardKeyframes).where(eq(gameTurnStoryboardKeyframes.storyboardId, storyboardId));

      const timestamp = now();
      if (frames.length > 0) {
        await db.insert(gameTurnStoryboardKeyframes).values(
          frames.map((frame) => ({
            id: newId(),
            storyboardId,
            index: frame.index,
            title: frame.title ?? "",
            sectionStartIndex: frame.sectionStartIndex ?? null,
            sectionEndIndex: frame.sectionEndIndex ?? null,
            anchorQuote: frame.anchorQuote ?? "",
            anchorKind: frame.anchorKind ?? "",
            narrationBeat: frame.narrationBeat ?? "",
            mangaPanelPrompt: frame.mangaPanelPrompt ?? "",
            imagePrompt: frame.imagePrompt ?? "",
            videoPrompt: frame.videoPrompt ?? "",
            animationSuitability: frame.animationSuitability ?? "",
            characters: frame.characters ?? "[]",
            continuityNotes: frame.continuityNotes ?? "",
            cameraMotion: frame.cameraMotion ?? "",
            transitionHint: frame.transitionHint ?? "",
            durationSeconds: frame.durationSeconds ?? 5,
            aspectRatio: frame.aspectRatio ?? "16:9",
            chatImageId: frame.chatImageId ?? null,
            sceneVideoId: frame.sceneVideoId ?? null,
            status: frame.status ?? "planned",
            error: frame.error ?? null,
            createdAt: timestamp,
            updatedAt: timestamp,
          })),
        );
      }

      return this.listKeyframes(storyboardId);
    },

    async updateKeyframe(id: string, patch: Partial<typeof gameTurnStoryboardKeyframes.$inferInsert>) {
      await db
        .update(gameTurnStoryboardKeyframes)
        .set({ ...patch, updatedAt: now() })
        .where(eq(gameTurnStoryboardKeyframes.id, id));
      const rows = await db.select().from(gameTurnStoryboardKeyframes).where(eq(gameTurnStoryboardKeyframes.id, id));
      return rows[0] ?? null;
    },

    async removeByChatId(chatId: string) {
      const boards = await this.listByChatId(chatId);
      for (const board of boards) {
        await db.delete(gameTurnStoryboardKeyframes).where(eq(gameTurnStoryboardKeyframes.storyboardId, board.id));
      }
      await db.delete(gameTurnStoryboards).where(eq(gameTurnStoryboards.chatId, chatId));
    },
  };
}
