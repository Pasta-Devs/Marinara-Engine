// ──────────────────────────────────────────────
// Game: dice-pool row storage
//
// One row per (chat, message, swipe), holding the queue a turn was PROMPTED with and
// what that turn spent out of it. Reads are always chat-scoped, so a lookup never
// crosses a chat even when a message id is reused by an import.
//
// The row's id IS the triple. The lazy tier cannot declare a `uniqueBy` constraint
// (`file-backed-store.ts` refuses to boot a lazy table that does), so the primary key
// is what makes the triple unique: a save is an upsert on the id, and two saves for the
// same turn can never leave two rows for `getForTurn` to choose between.
// ──────────────────────────────────────────────

import { and, desc, eq } from "../../db/file-query.js";
import type { DB } from "../../db/connection.js";
import { gameDicePools } from "../../db/schema/index.js";
import { now } from "../../utils/id-generator.js";

export interface GameDicePoolRow {
  id: string;
  chatId: string;
  messageId: string;
  swipeIndex: number;
  pool: string;
  consumed: string;
  createdAt: string;
}

export interface SaveGameDicePoolInput {
  chatId: string;
  messageId: string;
  swipeIndex: number;
  pool: string;
  consumed: string;
}

/** The row id for one turn: the triple itself, so the key and the identity cannot drift apart. */
export function gameDicePoolRowId(chatId: string, messageId: string, swipeIndex: number): string {
  return `${chatId}:${messageId}:${swipeIndex}`;
}

let lastIssuedStamp = "";

/**
 * A creation stamp that is strictly increasing within the process.
 *
 * `getLatestForChat` and `getEarliestForMessage` order rows by `createdAt` alone, and the
 * clock has millisecond precision, so two rows written in the same millisecond would tie
 * and the newest one would be whichever the store happened to keep first. Two distinct
 * turns of one chat never land that close in play, but a scripted provider can, and the
 * refill must never read the wrong queue on a coin flip. The stamp steps one millisecond
 * past the last one issued whenever the clock has not moved; the writer lease keeps one
 * process writing a data directory, so per-process is enough.
 */
export function nextGameDicePoolStamp(): string {
  let stamp = now();
  if (stamp <= lastIssuedStamp) {
    const previous = Date.parse(lastIssuedStamp);
    stamp = Number.isFinite(previous) ? new Date(previous + 1).toISOString() : stamp;
  }
  lastIssuedStamp = stamp;
  return stamp;
}

export function createGameDicePoolsStorage(db: DB) {
  return {
    /** The row this exact (message, swipe) already wrote, when it has one. */
    async getForTurn(chatId: string, messageId: string, swipeIndex: number): Promise<GameDicePoolRow | null> {
      const rows = (await db
        .select()
        .from(gameDicePools)
        .where(
          and(
            eq(gameDicePools.chatId, chatId),
            eq(gameDicePools.messageId, messageId),
            eq(gameDicePools.swipeIndex, swipeIndex),
          ),
        )) as GameDicePoolRow[];
      return rows[0] ?? null;
    },

    /**
     * The earliest row any swipe of this message wrote.
     *
     * A regenerate re-reads the pool the first telling of that turn was dealt, which is
     * what closes reroll-until-lucky: an alternative telling faces the same luck rather
     * than a queue that has moved on.
     */
    async getEarliestForMessage(chatId: string, messageId: string): Promise<GameDicePoolRow | null> {
      const rows = (await db
        .select()
        .from(gameDicePools)
        .where(and(eq(gameDicePools.chatId, chatId), eq(gameDicePools.messageId, messageId)))) as GameDicePoolRow[];
      return [...rows].sort((left, right) => left.createdAt.localeCompare(right.createdAt))[0] ?? null;
    },

    /** The most recent row in the chat — the queue a brand new turn refills from. */
    async getLatestForChat(chatId: string): Promise<GameDicePoolRow | null> {
      const rows = (await db
        .select()
        .from(gameDicePools)
        .where(eq(gameDicePools.chatId, chatId))
        .orderBy(desc(gameDicePools.createdAt))
        .limit(1)) as GameDicePoolRow[];
      return rows[0] ?? null;
    },

    /**
     * Write this turn's row, updating the one it already had in place.
     *
     * An upsert on the primary key rather than a delete and an insert: a continuation
     * updates its own row, and whichever of two overlapping saves lands second becomes an
     * update of the same id instead of a second row. On a conflict only the queue and the
     * ledger are written; `createdAt` is set on the insert alone, so the row keeps the
     * timestamp of whichever save created it and an in-place update can never reorder
     * the chat's rows under `getLatestForChat`, even when two saves raced past the read.
     */
    async save(input: SaveGameDicePoolInput): Promise<GameDicePoolRow> {
      const id = gameDicePoolRowId(input.chatId, input.messageId, input.swipeIndex);
      const existing = await this.getForTurn(input.chatId, input.messageId, input.swipeIndex);
      // A row written under a random id, before the id was the triple, would otherwise be
      // left standing beside the keyed one.
      if (existing && existing.id !== id) {
        await db
          .delete(gameDicePools)
          .where(and(eq(gameDicePools.chatId, input.chatId), eq(gameDicePools.id, existing.id)));
      }
      const row: GameDicePoolRow = {
        id,
        chatId: input.chatId,
        messageId: input.messageId,
        swipeIndex: input.swipeIndex,
        pool: input.pool,
        consumed: input.consumed,
        createdAt: existing?.createdAt ?? nextGameDicePoolStamp(),
      };
      await db
        .insert(gameDicePools)
        .values(row)
        .onConflictDoUpdate({ target: gameDicePools.id, set: { pool: input.pool, consumed: input.consumed } });
      // Read back rather than trusting the local copy: in a race the stored timestamp is
      // the other save's, and that is the one every later reader will see.
      return (await this.getForTurn(input.chatId, input.messageId, input.swipeIndex)) ?? row;
    },
  };
}
