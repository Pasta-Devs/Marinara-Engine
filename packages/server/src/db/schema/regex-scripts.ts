// ──────────────────────────────────────────────
// Schema: Regex Scripts
// ──────────────────────────────────────────────
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const regexScripts = sqliteTable("regex_scripts", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  enabled: text("enabled").notNull().default("true"),
  /** The regex pattern (without delimiters) */
  findRegex: text("find_regex").notNull(),
  /** Replacement string (supports $1 groups) */
  replaceString: text("replace_string").notNull().default(""),
  /** JSON array of strings to trim */
  trimStrings: text("trim_strings").notNull().default("[]"),
  /** JSON array of placements: ["ai_output","user_input"] */
  placement: text("placement").notNull().default('["ai_output"]'),
  /** Regex flags (e.g. "gi") */
  flags: text("flags").notNull().default("gi"),
  /** Only apply in prompt context, not displayed text */
  promptOnly: text("prompt_only").notNull().default("false"),
  /** JSON array of target recipient character IDs (empty = all recipients) */
  targetCharacterIds: text("target_character_ids").notNull().default("[]"),
  /** Execution order (lower = first) */
  order: integer("order").notNull().default(0),
  /** Min message depth to apply (null = unlimited) */
  minDepth: integer("min_depth"),
  /** Max message depth to apply (null = unlimited) */
  maxDepth: integer("max_depth"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
