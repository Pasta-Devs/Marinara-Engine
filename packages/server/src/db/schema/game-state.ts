// ──────────────────────────────────────────────
// Schema: Game State Snapshots
// ──────────────────────────────────────────────
import { fileTable, text, integer } from "../file-schema.js";

export const gameStateSnapshots = fileTable("game_state_snapshots", {
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
  /** JSON array of user-defined world fields */
  worldCustomFields: text("world_custom_fields").notNull().default("[]"),

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
  /** JSON object of tracker field keys hidden from the UI. */
  hiddenTrackerFields: text("hidden_tracker_fields"),

  /** JSON object of live ruleset sheet state (current pools, tracks, conditions) per party card,
   *  keyed by normalized card name. Lives here, not on the card, so it rewinds with swipes. */
  rulesetLive: text("ruleset_live"),

  /** Whether this snapshot has been "committed" (user sent a follow-up message). */
  committed: integer("committed").notNull().default(0),

  createdAt: text("created_at").notNull(),
});
