// ──────────────────────────────────────────────
// Schema: Custom Stickers (global pool, managed in the sticker selector)
// ──────────────────────────────────────────────
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const customStickers = sqliteTable("custom_stickers", {
  id: text("id").primaryKey(),
  /** Slug used in `sticker:name:` tokens — unique within the global pool */
  name: text("name").notNull().unique(),
  /** Relative path of the stored image under DATA_DIR/custom-stickers/ */
  filePath: text("file_path").notNull(),
  /** Pixel dimensions recorded on upload (null if unknown) */
  width: integer("width"),
  height: integer("height"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
