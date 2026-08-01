// ──────────────────────────────────────────────
// Schema: chat settings profiles (legacy table name retained for compatibility)
// ──────────────────────────────────────────────
import { fileTable, text } from "../file-schema.js";

/** Reusable bundles of chat settings used as defaults for new chats. */
export const chatPresets = fileTable("chat_presets", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  /** Which chat mode this profile applies to. */
  mode: text("mode", { enum: ["conversation", "roleplay", "game"] }).notNull(),
  /** "true" for the built-in Default profile (cannot be deleted, renamed, or saved into). */
  isDefault: text("is_default").notNull().default("false"),
  /** "true" for the active profile of its mode (used as starting state for new chats). */
  isActive: text("is_active").notNull().default("false"),
  /** JSON-serialized ChatPresetSettings. */
  settings: text("settings").notNull().default("{}"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
