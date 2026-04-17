// ──────────────────────────────────────────────
// Schema: Chat Presets
// ──────────────────────────────────────────────
import { sqliteTable, text } from "drizzle-orm/sqlite-core";

/** Reusable bundles of chat settings used as defaults for new chats. */
export const chatPresets = sqliteTable("chat_presets", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  /** Which chat mode this preset applies to. */
  mode: text("mode", { enum: ["conversation", "roleplay", "visual_novel"] }).notNull(),
  /** "true" for the built-in default preset (cannot be deleted, renamed, or saved into). */
  isDefault: text("is_default").notNull().default("false"),
  /** "true" for the active preset of its mode (used as starting state for new chats). */
  isActive: text("is_active").notNull().default("false"),
  /** JSON-serialized ChatPresetSettings. */
  settings: text("settings").notNull().default("{}"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
