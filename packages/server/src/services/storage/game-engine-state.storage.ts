// ──────────────────────────────────────────────
// Storage: Turn-Game Engine State Snapshots
// ──────────────────────────────────────────────
// Game-agnostic persistence for the turn-game framework (UNO and beyond).
// Mirrors game-state.storage.ts (per-message snapshots + committed flag +
// regen-exclusion) but stores an opaque engine JSON blob instead of RPG fields.
import { and, asc, desc, eq, gt, inArray, lte, ne, notLike, type FileCondition } from "../../db/file-query.js";
import type { DB } from "../../db/connection.js";
import { gameEngineState } from "../../db/schema/index.js";
import { newId, now } from "../../utils/id-generator.js";

export type GameEngineStateRow = typeof gameEngineState.$inferSelect;
export type GameEngineVisibleAnchor = { messageId: string; swipeIndex: number };

/** Host-owned namespace prefix for game-surface Experience rows (#5102). Turn-game engine
 *  types are bare identifiers ("uno", "chess"); Experience rows are "experience:<packageId>". */
export const EXPERIENCE_GAME_TYPE_PREFIX = "experience:";

/** Row-type scope for reads and destructive seams: a literal gameType selects exactly that
 *  namespace; `{ excludePrefix }` selects everything OUTSIDE a namespace (what the turn-game
 *  runner uses so Experience rows can never masquerade as — or be destroyed as — turn-games). */
export type GameEngineStateScope = string | { readonly excludePrefix: string };

export interface CreateGameEngineStateInput {
  chatId: string;
  messageId: string;
  swipeIndex: number;
  gameType: string;
  schemaVersion: number;
  /** Already JSON-stringified engine state. */
  state: string;
  committed?: boolean;
  /**
   * Per-chat write ordinal from `chats.writeOrdinalCounter` (#5406). Omit (null) for writers
   * with a single store — turn-games have nothing to order this row against.
   *
   * A value passed here is only ever valid inside ONE chat's counter space. Checkpoint restore
   * therefore ALLOCATES a fresh ordinal for its experience rows rather than replaying the
   * captured one (which would hand the same value out twice, and would also under-state a
   * restore that is genuinely the newest write); its turn-game rows stay null. Chat branching is
   * the one case that copies an ordinal verbatim, and only because it raises the branch's counter
   * above every ordinal it copied via `chats.raiseWriteOrdinalFloor` — same counter space, so the
   * copies keep their order and the branch's next allocation still beats all of them.
   */
  writeOrdinal?: number | null;
  /**
   * Override the row's creation timestamp (#5405). Only the experience-state writers use this
   * (the PUT save and the bulk import): `createdAt` is the sole recency key every read orders
   * by, and a `desc(createdAt).limit(1)` read of a TIED group does not return the newest write
   * under either regime the store can be in —
   *   - in-process, `Array.prototype.sort` is stable, so the tied group keeps insertion order
   *     and the FIRST-inserted row wins;
   *   - after a shard reload the loader pre-sorts rows by `createdAt` then primary key, so the
   *     LOWEST row id wins instead.
   * Two saves inside the same millisecond (a tight save loop) or a bulk import landing inside
   * one millisecond would therefore hand fallback reads an arbitrary — often the OLDEST — save,
   * and which one it is can change across a restart. Both writers pass a strictly increasing
   * stamp instead, so a tie never forms. Every other caller omits this and gets `now()`.
   */
  createdAt?: string;
}

export function createGameEngineStateStorage(db: DB) {
  // Optional row-type scoping (#5102): callers that pass no scope see every row exactly as
  // before. The experience-state routes scope every read to their own "experience:<id>"
  // namespace so a package can never observe turn-game rows (or another experience's rows),
  // and the turn-game runner excludes the experience namespace so a newer experience save
  // can never shadow an active turn-game or be wiped by turn-game start/resign.
  const scoped = (predicate: FileCondition, scope?: GameEngineStateScope) =>
    scope === undefined
      ? predicate
      : typeof scope === "string"
        ? and(predicate, eq(gameEngineState.gameType, scope))
        : and(predicate, notLike(gameEngineState.gameType, `${scope.excludePrefix}%`));

  return {
    async getLatest(chatId: string, gameType?: GameEngineStateScope) {
      const rows = await db
        .select()
        .from(gameEngineState)
        .where(scoped(eq(gameEngineState.chatId, chatId), gameType))
        .orderBy(desc(gameEngineState.createdAt))
        .limit(1);
      return rows[0] ?? null;
    },

    /**
     * The latest snapshot for a chat created at or before a reference timestamp. Used by checkpoint
     * restore (#5077) to recover the engine state that was current when the checkpoint was taken:
     * `createdAt` is set once at `create` and never mutated afterward (updateStateById/commit/reanchor
     * leave it), so it is a stable checkpoint-time key even though the engine state's own message
     * anchor is independent of the game/spatial snapshot anchors the checkpoint captures.
     *
     * Caveat: a row whose state is later overwritten in place (updateStateById/commit) keeps its
     * original `createdAt` and recovers its CURRENT state, and a row that is delete-recreated at
     * the same anchor (create()'s dedupe — every experience-state save inside one narration turn)
     * moves PAST the reference timestamp entirely, so this heuristic can no-op or step back a
     * whole anchor. Checkpoints therefore capture the engine-state blobs at CREATE time
     * (engineStateData, #5102) and restore from that; this method remains only as the restore
     * fallback for checkpoints created before that field existed.
     */
    async getLatestAtOrBefore(chatId: string, createdAtInclusive: string) {
      const rows = await db
        .select()
        .from(gameEngineState)
        .where(and(eq(gameEngineState.chatId, chatId), lte(gameEngineState.createdAt, createdAtInclusive)))
        .orderBy(desc(gameEngineState.createdAt))
        .limit(1);
      return rows[0] ?? null;
    },

    async getLatestCommitted(chatId: string, gameType?: GameEngineStateScope) {
      const rows = await db
        .select()
        .from(gameEngineState)
        .where(scoped(and(eq(gameEngineState.chatId, chatId), eq(gameEngineState.committed, 1)), gameType))
        .orderBy(desc(gameEngineState.createdAt))
        .limit(1);
      return rows[0] ?? null;
    },

    async getByChatAndMessage(chatId: string, messageId: string, swipeIndex = 0, gameType?: GameEngineStateScope) {
      const rows = await db
        .select()
        .from(gameEngineState)
        .where(
          scoped(
            and(
              eq(gameEngineState.chatId, chatId),
              eq(gameEngineState.messageId, messageId),
              eq(gameEngineState.swipeIndex, swipeIndex),
            ),
            gameType,
          ),
        )
        .orderBy(desc(gameEngineState.createdAt))
        .limit(1);
      return rows[0] ?? null;
    },

    /** Every row at one (message, swipe) anchor — up to one per gameType writer (#5102).
     *  Seams that clone an anchor (chat branching) must copy them all, not limit(1). */
    async listByChatAndMessage(chatId: string, messageId: string, swipeIndex = 0) {
      return db
        .select()
        .from(gameEngineState)
        .where(
          and(
            eq(gameEngineState.chatId, chatId),
            eq(gameEngineState.messageId, messageId),
            eq(gameEngineState.swipeIndex, swipeIndex),
          ),
        )
        .orderBy(desc(gameEngineState.createdAt));
    },

    /**
     * Every row of one scope in a chat, oldest write first (#5405). Backs the experience-state
     * bulk export and the row count the namespace delete reports; ordering is `asc(createdAt)`
     * so a re-import replaying the array in order reproduces the original recency.
     */
    async listForChat(chatId: string, gameType?: GameEngineStateScope) {
      return db
        .select()
        .from(gameEngineState)
        .where(scoped(eq(gameEngineState.chatId, chatId), gameType))
        .orderBy(asc(gameEngineState.createdAt));
    },

    async getLatestExcludingMessage(chatId: string, excludeMessageId: string, gameType?: GameEngineStateScope) {
      const rows = await db
        .select()
        .from(gameEngineState)
        .where(
          scoped(and(eq(gameEngineState.chatId, chatId), ne(gameEngineState.messageId, excludeMessageId)), gameType),
        )
        .orderBy(desc(gameEngineState.createdAt))
        .limit(1);
      return rows[0] ?? null;
    },

    /**
     * Resolve the state to use for a generation/turn. Prefers the snapshot tied
     * to the currently-visible message anchor (so editing/swiping rewinds the
     * game), then the latest committed, then the latest of any.
     */
    async getForGeneration(
      chatId: string,
      options?: {
        visibleAnchor?: GameEngineVisibleAnchor | null;
        excludeMessageId?: string | null;
        gameType?: GameEngineStateScope;
      },
    ) {
      const gameType = options?.gameType;
      if (options?.visibleAnchor?.messageId) {
        const visible = await this.getByChatAndMessage(
          chatId,
          options.visibleAnchor.messageId,
          options.visibleAnchor.swipeIndex,
          gameType,
        );
        if (visible) return visible;
      }
      if (options?.excludeMessageId) {
        const committed = await db
          .select()
          .from(gameEngineState)
          .where(
            scoped(
              and(
                eq(gameEngineState.chatId, chatId),
                eq(gameEngineState.committed, 1),
                ne(gameEngineState.messageId, options.excludeMessageId),
              ),
              gameType,
            ),
          )
          .orderBy(desc(gameEngineState.createdAt))
          .limit(1);
        if (committed[0]) return committed[0];
        return this.getLatestExcludingMessage(chatId, options.excludeMessageId, gameType);
      }
      return (await this.getLatestCommitted(chatId, gameType)) ?? (await this.getLatest(chatId, gameType));
    },

    /** Create a snapshot, replacing any prior one of the same gameType for the same (message, swipe). */
    async create(input: CreateGameEngineStateInput) {
      // Dedupe unconditionally — including the empty-message live anchor
      // (messageId === ""). Otherwise repeated live-row writes (e.g. the
      // bot-turn persistence-failure fallback, which re-creates with
      // messageId "") accumulate rows for (chatId, "", swipeIndex) unbounded.
      // Scoped to the writer's own gameType (#5102): an experience-state save
      // sharing an anchor with a turn-game row must replace only its own row,
      // never another writer's. For chats with a single state writer (every
      // chat today outside the regression suite) this is the old behavior.
      await db
        .delete(gameEngineState)
        .where(
          and(
            eq(gameEngineState.messageId, input.messageId),
            eq(gameEngineState.swipeIndex, input.swipeIndex),
            eq(gameEngineState.chatId, input.chatId),
            eq(gameEngineState.gameType, input.gameType),
          ),
        );
      const id = newId();
      await db.insert(gameEngineState).values({
        id,
        chatId: input.chatId,
        messageId: input.messageId,
        swipeIndex: input.swipeIndex,
        gameType: input.gameType,
        schemaVersion: input.schemaVersion,
        state: input.state,
        committed: input.committed ? 1 : 0,
        writeOrdinal: input.writeOrdinal ?? null,
        createdAt: input.createdAt ?? now(),
      });
      return id;
    },

    /** Replace the stored state (and optionally the commit flag) on an existing row. */
    async updateStateById(id: string, state: string, committed?: boolean, chatId?: string) {
      const updates: Partial<GameEngineStateRow> = { state };
      if (committed !== undefined) updates.committed = committed ? 1 : 0;
      const condition = chatId
        ? and(eq(gameEngineState.chatId, chatId), eq(gameEngineState.id, id))
        : eq(gameEngineState.id, id);
      await db.update(gameEngineState).set(updates).where(condition);
    },

    /** Re-anchor a snapshot to a (message, swipe) once the narration message exists. */
    async reanchor(id: string, messageId: string, swipeIndex: number, chatId?: string) {
      const condition = chatId
        ? and(eq(gameEngineState.chatId, chatId), eq(gameEngineState.id, id))
        : eq(gameEngineState.id, id);
      await db.update(gameEngineState).set({ messageId, swipeIndex }).where(condition);
    },

    async commit(id: string, chatId?: string) {
      const condition = chatId
        ? and(eq(gameEngineState.chatId, chatId), eq(gameEngineState.id, id))
        : eq(gameEngineState.id, id);
      await db.update(gameEngineState).set({ committed: 1 }).where(condition);
    },

    /** Mark every snapshot for a chat committed (used when a turn cycle finishes). */
    async commitForChat(chatId: string) {
      await db.update(gameEngineState).set({ committed: 1 }).where(eq(gameEngineState.chatId, chatId));
    },

    /** Drop snapshots strictly newer than a reference timestamp (rewind on regenerate/branch). */
    async deleteAfter(chatId: string, createdAtExclusive: string) {
      await db
        .delete(gameEngineState)
        .where(and(eq(gameEngineState.chatId, chatId), gt(gameEngineState.createdAt, createdAtExclusive)));
    },

    async deleteForChat(chatId: string, scope?: GameEngineStateScope) {
      await db.delete(gameEngineState).where(scoped(eq(gameEngineState.chatId, chatId), scope));
    },

    /** The newest row of each gameType present in a chat — what a checkpoint captures (#5102). */
    async latestPerGameType(chatId: string) {
      const rows = await db.select().from(gameEngineState).where(eq(gameEngineState.chatId, chatId));
      const latest = new Map<string, GameEngineStateRow>();
      for (const row of rows) {
        const current = latest.get(row.gameType);
        // Strictly-greater keeps the FIRST row of a createdAt tie in array order — the same
        // row a desc(createdAt) read returns, so the captured blob is the one the running
        // game shows. Which row that is depends on the store's state, and neither answer is
        // "the newest write": in-process Array.prototype.sort is stable, so it is the
        // first-INSERTED row; after a shard reload the loader has pre-sorted ties by primary
        // key, so it is the LOWEST row id. Writers that care (the experience-state save and
        // import, #5405) re-stamp createdAt strictly upward so no tie ever forms here.
        if (!current || row.createdAt > current.createdAt) latest.set(row.gameType, row);
      }
      return [...latest.values()];
    },

    /**
     * Keep only the newest `keep` rows of one gameType in a chat (#5102). Bounds the per-chat
     * shard against an Experience that saves on every narration turn forever: swipe/branch
     * rewind only ever targets recent anchors, and checkpoint restore reads the state captured
     * in the checkpoint row itself, so rows beyond the newest `keep` anchors are unreachable.
     */
    async pruneToNewestAnchors(chatId: string, gameType: string, keep: number) {
      const rows = await db
        .select()
        .from(gameEngineState)
        .where(and(eq(gameEngineState.chatId, chatId), eq(gameEngineState.gameType, gameType)))
        .orderBy(desc(gameEngineState.createdAt));
      const doomed = rows.slice(Math.max(0, keep));
      if (doomed.length === 0) return;
      // One statement, one shard rewrite — not one per pruned row. The chatId conjunct keeps
      // the id-list delete scoped to this chat's shard in the lazy store.
      await db.delete(gameEngineState).where(
        and(
          eq(gameEngineState.chatId, chatId),
          inArray(
            gameEngineState.id,
            doomed.map((row) => row.id),
          ),
        ),
      );
    },
  };
}
