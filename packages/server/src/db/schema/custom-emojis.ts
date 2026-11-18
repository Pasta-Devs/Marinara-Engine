// ──────────────────────────────────────────────
// Schema: Custom Emojis (global pool, managed in the emoji picker)
// ──────────────────────────────────────────────
import { fileTable, text, integer } from "../file-schema.js";

export const customEmojis = fileTable(
  "custom_emojis",
  {
    id: text("id").primaryKey(),
    /** Slug used in `:name:` tokens — unique within the global pool */
    name: text("name").notNull(),
    /** Relative path of the stored image under DATA_DIR/custom-emojis/ */
    filePath: text("file_path").notNull(),
    /** Pixel dimensions recorded on upload (null if unknown) */
    width: integer("width"),
    height: integer("height"),
    /** What it shows and the feeling it gives, used to pick and explain it in Conversation. Null when none. */
    description: text("description"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  { uniqueBy: [["name"]] },
);
