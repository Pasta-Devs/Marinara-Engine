import { fileTable, integer, text } from "../file-schema.js";

export const gameCombatSessions = fileTable("game_combat_sessions", {
  sessionId: text("session_id").primaryKey(),
  chatId: text("chat_id").notNull(),
  style: text("style", { enum: ["classic", "tactical"] as const }).notNull(),
  schemaVersion: integer("schema_version").notNull().default(1),
  state: text("state").notNull(),
  objectives: text("objectives").notNull().default("[]"),
  bossPhases: text("boss_phases").notNull().default("[]"),
  seed: integer("seed").notNull(),
  rngCursor: integer("rng_cursor").notNull().default(0),
  revision: integer("revision").notNull().default(0),
  lastActionId: text("last_action_id"),
  status: text("status", { enum: ["active", "completed", "abandoned"] as const })
    .notNull()
    .default("active"),
  actionHistory: text("action_history").notNull().default("[]"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
