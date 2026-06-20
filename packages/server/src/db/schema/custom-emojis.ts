// ──────────────────────────────────────────────
// Schema: Custom Emojis (global pool, managed in the emoji picker)
// ──────────────────────────────────────────────
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const customEmojis = sqliteTable("custom_emojis", {
  id: text("id").primaryKey(),
  /** Slug used in `:name:` tokens — unique within the global pool */
  name: text("name").notNull().unique(),
  /** Relative path of the stored image under DATA_DIR/custom-emojis/ */
  filePath: text("file_path").notNull(),
  /** Pixel dimensions recorded on upload (null if unknown) */
  width: integer("width"),
  height: integer("height"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
