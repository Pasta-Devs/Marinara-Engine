// ──────────────────────────────────────────────
// Schema: Resource Library Folders
// ──────────────────────────────────────────────
import { fileTable, integer, text } from "../file-schema.js";

export const libraryFolders = fileTable("library_folders", {
  id: text("id").primaryKey(),
  scope: text("scope").notNull(),
  name: text("name").notNull(),
  collapsed: text("collapsed").notNull().default("false"),
  paused: text("paused").notNull().default("false"),
  sortOrder: integer("sort_order").notNull().default(0),
  /** JSON array of resource IDs assigned to this folder. */
  itemIds: text("item_ids").notNull().default("[]"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
