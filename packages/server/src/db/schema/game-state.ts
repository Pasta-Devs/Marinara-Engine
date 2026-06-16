// ──────────────────────────────────────────────
// Schema: Game State Snapshots
// ──────────────────────────────────────────────
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const gameStateSnapshots = sqliteTable("game_state_snapshots", {
  id: text("id").primaryKey(),
  chatId: text("chat_id").notNull(),
  /** FK to messages.id — cascade handled at application level */
  messageId: text("message_id").notNull(),
  swipeIndex: integer("swipe_index").notNull().default(0),

  date: text("date"),
  time: text("time"),
  location: text("location"),
  weather: text("weather"),
  temperature: text("temperature"),

  /** JSON array of PresentCharacter objects */
  presentCharacters: text("present_characters").notNull().default("[]"),
  /** JSON array of recent event strings */
  recentEvents: text("recent_events").notNull().default("[]"),
  /** JSON object for player stats */
  playerStats: text("player_stats"),
  /** JSON array of persona stat bars */
  personaStats: text("persona_stats"),

  /** JSON object of manually-edited fields — keys are field names, values are the user-set values. */
  manualOverrides: text("manual_overrides"),
  /** JSON object of tracker field lock keys → enabled. */
  fieldLocks: text("field_locks"),

  /** Whether this snapshot has been "committed" (user sent a follow-up message). */
  committed: integer("committed").notNull().default(0),

  createdAt: text("created_at").notNull(),
});
