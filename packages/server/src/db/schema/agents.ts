// ──────────────────────────────────────────────
// Schema: Agent Configs & Runs
// ──────────────────────────────────────────────
import { fileTable, text, integer } from "../file-schema.js";

export const agentConfigs = fileTable("agent_configs", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  phase: text("phase", { enum: ["pre_generation", "parallel", "post_processing"] }).notNull(),
  enabled: text("enabled").notNull().default("true"),
  connectionId: text("connection_id"),
  imagePath: text("image_path"),
  promptTemplate: text("prompt_template").notNull().default(""),
  /** JSON object for agent-specific settings */
  settings: text("settings").notNull().default("{}"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const agentRuns = fileTable("agent_runs", {
  id: text("id").primaryKey(),
  agentConfigId: text("agent_config_id")
    .notNull()
    .references(() => agentConfigs.id),
  chatId: text("chat_id").notNull(),
  messageId: text("message_id").notNull(),
  /** Null on legacy runs, which are only reusable on the original swipe. */
  swipeIndex: integer("swipe_index"),
  resultType: text("result_type").notNull(),
  /** JSON payload of the result */
  resultData: text("result_data").notNull().default("{}"),
  tokensUsed: integer("tokens_used").notNull().default(0),
  durationMs: integer("duration_ms").notNull().default(0),
  success: text("success").notNull().default("true"),
  error: text("error"),
  createdAt: text("created_at").notNull(),
});

/** Persistent memory for agents (key-value per agent per chat). */
export const agentMemory = fileTable("agent_memory", {
  id: text("id").primaryKey(),
  agentConfigId: text("agent_config_id")
    .notNull()
    .references(() => agentConfigs.id),
  chatId: text("chat_id").notNull(),
  key: text("key").notNull(),
  value: text("value").notNull().default(""),
  updatedAt: text("updated_at").notNull(),
});
