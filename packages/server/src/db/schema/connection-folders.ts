// ──────────────────────────────────────────────
// Schema: API Connection Folders
// ──────────────────────────────────────────────
import { fileTable, text, integer } from "../file-schema.js";

export const apiConnectionFolders = fileTable("api_connection_folders", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  color: text("color").notNull().default(""),
  /** A lucide icon name the folder card shows; null on older rows (the plain folder icon). */
  icon: text("icon"),
  sortOrder: integer("sort_order").notNull().default(0),
  collapsed: text("collapsed").notNull().default("false"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
