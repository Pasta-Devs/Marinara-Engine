// ──────────────────────────────────────────────
// Schema: Personal Extensions
// ──────────────────────────────────────────────
// Personal extensions are user-owned code. Approval is bound to contentHash;
// any executable change clears approvedHash and disables the extension.
import { fileTable, text } from "../file-schema.js";

export const installedExtensions = fileTable("installed_extensions", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  version: text("version"),
  description: text("description").notNull().default(""),
  runtime: text("runtime").notNull().default("client"),
  capabilities: text("capabilities").notNull().default("[]"),
  css: text("css"),
  js: text("js"),
  serverJs: text("server_js"),
  enabled: text("enabled").notNull().default("false"),
  contentHash: text("content_hash").notNull().default(""),
  approvedHash: text("approved_hash"),
  source: text("source").notNull().default("legacy"),
  revisions: text("revisions").notNull().default("[]"),
  installedAt: text("installed_at").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
