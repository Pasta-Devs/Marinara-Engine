// ──────────────────────────────────────────────
// Schema: Prompt Overrides
//
// User-supplied templates that replace hardcoded
// prompt builders. One row per registered key.
// ──────────────────────────────────────────────
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const promptOverrides = sqliteTable("prompt_overrides", {
  key: text("key").primaryKey(),
  template: text("template").notNull(),
  enabled: integer("enabled").notNull().default(1),
  updatedAt: text("updated_at").notNull(),
});
