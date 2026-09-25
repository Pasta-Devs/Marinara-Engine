// ──────────────────────────────────────────────
// Game: the sighted dice pool's own table
//
// A dedicated table rather than a column on the game-state snapshot, and the reasons
// are all facts about that snapshot rather than preferences:
//
//   - The generate-path snapshot write is gated on a tracker agent result, so with
//     agents off no row is created at all. The pool has to exist for every pool turn.
//   - The snapshot writer is a delete-then-insert from an explicit field list, so any
//     column a caller does not name is silently lost.
//   - Snapshot reads are committed-filtered, so a row only becomes visible once the
//     player sends a follow-up.
//
// Chat metadata is ruled out for a different reason: it is client-writable and it is
// not per-swipe, so a swipe would spend dice and never give them back.
//
// One row per (chat, message, swipe). `pool` is the queue the turn was PROMPTED with,
// and `consumed` is what that turn actually spent out of it; the refill is derived from
// the pair at the next accepted turn, which is what makes a swipe, a regenerate and a
// continuation all face the same luck instead of a freshly refilled queue.
// ──────────────────────────────────────────────

import { fileTable, text, integer } from "../file-schema.js";
import { chats } from "./chats.js";

export const gameDicePools = fileTable("game_dice_pools", {
  id: text("id").primaryKey(),
  chatId: text("chat_id")
    .notNull()
    .references(() => chats.id, { onDelete: "cascade" }),
  messageId: text("message_id").notNull(),
  swipeIndex: integer("swipe_index").notNull().default(0),
  /** Serialized `GameDicePool`: the queues, the aging clocks and the format revision. */
  pool: text("pool").notNull(),
  /** Serialized `GameDicePoolConsumption[]`: what this turn spent, in spend order. */
  consumed: text("consumed").notNull().default("[]"),
  createdAt: text("created_at").notNull(),
});
