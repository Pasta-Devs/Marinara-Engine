// ──────────────────────────────────────────────
// Schema: Turn-Game Engine State Snapshots
// ──────────────────────────────────────────────
// Per-(message, swipe) snapshots of a deterministic turn-game's full state
// (UNO, Chess, Poker, Eight Ball, and future games). Mirrors
// game_state_snapshots so regenerate / branch / undo rewind the game
// correctly. The `state` column holds the engine's own JSON blob;
// `game_type` + `schema_version` make it self-describing.
import { fileTable, text, integer } from "../file-schema.js";

export const gameEngineState = fileTable("game_engine_state", {
  id: text("id").primaryKey(),
  chatId: text("chat_id").notNull(),
  /** Anchor message — "" before any message exists for the opening deal. */
  messageId: text("message_id").notNull().default(""),
  swipeIndex: integer("swipe_index").notNull().default(0),

  /** Engine type identifier (e.g. "uno"). */
  gameType: text("game_type").notNull(),
  /** Engine state schema version, for future migrations. */
  schemaVersion: integer("schema_version").notNull().default(1),
  /** JSON-serialized engine state (the game's private TState). */
  state: text("state").notNull(),

  /** Whether this snapshot has been "committed" (the turn was accepted). */
  committed: integer("committed").notNull().default(0),

  /**
   * Per-chat monotonic write ordinal drawn from `chats.write_ordinal_counter` (#5406). Set by
   * the host-owned experience-state PUT (and by checkpoint restore, which re-allocates) so a
   * game-surface Experience can order this row against the chat-metadata copy it also keeps.
   * Null on rows written before #5406 and on turn-game rows — a turn-game has a single store, so
   * it has nothing to order against, and neither the PUT nor the restore stamps one. A
   * chat-branch clone copies its source row's ordinal verbatim, so it is null exactly when the
   * source row's was. Never compare ordinals across chats.
   */
  writeOrdinal: integer("write_ordinal"),

  createdAt: text("created_at").notNull(),
});
