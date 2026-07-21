// ──────────────────────────────────────────────
// Schema: Installed Extensions
// ──────────────────────────────────────────────
import { fileTable, text } from "../file-schema.js";

export const installedExtensions = fileTable("installed_extensions", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  version: text("version"),
  description: text("description").notNull().default(""),
  runtime: text("runtime").notNull().default("client"),
  css: text("css"),
  js: text("js"),
  serverJs: text("server_js"),
  enabled: text("enabled").notNull().default("true"),
  installedAt: text("installed_at").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
