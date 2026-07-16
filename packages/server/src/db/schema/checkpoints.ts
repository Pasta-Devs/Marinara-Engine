// ──────────────────────────────────────────────
// Schema: Game Checkpoints
// ──────────────────────────────────────────────
import { fileTable, text, integer } from "../file-schema.js";

export const gameCheckpoints = fileTable("game_checkpoints", {
  id: text("id").primaryKey(),
  chatId: text("chat_id").notNull(),
  /** Spatial snapshot captured alongside the Game snapshot, when enabled. */
  spatialSnapshotId: text("spatial_snapshot_id"),
  /** FK to game_state_snapshots.id */
  snapshotId: text("snapshot_id").notNull(),
  /** Immutable JSON copy of the captured Game snapshot. */
  snapshotData: text("snapshot_data"),
  /** Immutable JSON copy of the captured Spatial Context snapshot, when enabled. */
  spatialSnapshotData: text("spatial_snapshot_data"),
  /** FK to messages.id — the message this checkpoint was taken at */
  messageId: text("message_id").notNull(),

  /** Human-readable label (e.g. "Session 3 Start", "Before Boss Fight") */
  label: text("label").notNull(),
  /** What triggered this checkpoint */
  triggerType: text("trigger_type", {
    enum: ["manual", "session_start", "session_end", "combat_start", "combat_end", "location_change", "auto_interval"],
  }).notNull(),

  /** Denormalised context for UI display (avoids joining snapshot) */
  location: text("location"),
  gameState: text("game_state"),
  weather: text("weather"),
  timeOfDay: text("time_of_day"),
  /** Approximate turn number at checkpoint */
  turnNumber: integer("turn_number"),

  createdAt: text("created_at").notNull(),
});
