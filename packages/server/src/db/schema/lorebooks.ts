// ──────────────────────────────────────────────
// Schema: Lorebooks, Folders & Entries
// ──────────────────────────────────────────────
import { fileTable, text, integer, vectorText, real } from "../file-schema.js";

export const lorebooks = fileTable("lorebooks", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  category: text("category").notNull().default("uncategorized"),
  imagePath: text("image_path"),
  scanDepth: integer("scan_depth").notNull().default(2),
  tokenBudget: integer("token_budget").notNull().default(2048),
  entryLimit: integer("entry_limit").notNull().default(100),
  recursiveScanning: text("recursive_scanning").notNull().default("false"),
  maxRecursionDepth: integer("max_recursion_depth").notNull().default(3),
  excludeFromVectorization: text("exclude_from_vectorization").notNull().default("true"),
  vectorQueryDepth: integer("vector_query_depth").notNull().default(10),
  vectorScoreThreshold: real("vector_score_threshold").notNull().default(0.3),
  vectorMaxResults: integer("vector_max_results").notNull().default(10),
  characterId: text("character_id"),
  personaId: text("persona_id"),
  chatId: text("chat_id"),
  isGlobal: text("is_global").notNull().default("false"),
  enabled: text("enabled").notNull().default("true"),
  /** UI-only visibility flag; hidden books remain active and editable from their owning character. */
  hiddenFromLibrary: text("hidden_from_library").notNull().default("false"),
  /** JSON object: { mode: "all" | "disabled" | "specific", chatIds: string[] } */
  scope: text("scope").notNull().default('{"mode":"all","chatIds":[]}'),
  /** Tags for organizing/filtering lorebooks (JSON array of strings) */
  tags: text("tags").notNull().default("[]"),
  generatedBy: text("generated_by"),
  sourceAgentId: text("source_agent_id"),
  /** Pre-computed book-level semantic embedding of name/description/category/tags (JSON float[]), null until vectorized (#4768). Distinct from per-entry lorebook_entries.embedding. */
  embedding: text("embedding"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const lorebookCharacterLinks = fileTable(
  "lorebook_character_links",
  {
    id: text("id").primaryKey(),
    lorebookId: text("lorebook_id")
      .notNull()
      .references(() => lorebooks.id, { onDelete: "cascade" }),
    characterId: text("character_id").notNull(),
    createdAt: text("created_at").notNull(),
  },
  { uniqueBy: [["lorebookId", "characterId"]] },
);

export const lorebookPersonaLinks = fileTable(
  "lorebook_persona_links",
  {
    id: text("id").primaryKey(),
    lorebookId: text("lorebook_id")
      .notNull()
      .references(() => lorebooks.id, { onDelete: "cascade" }),
    personaId: text("persona_id").notNull(),
    createdAt: text("created_at").notNull(),
  },
  { uniqueBy: [["lorebookId", "personaId"]] },
);

/**
 * Lorebook folders — collapsible containers that group entries to reduce
 * visual clutter in the editor. Folders may nest via `parentFolderId`
 * (`null` = a root-level folder; see `canReparentFolder` / `buildFolderForest`
 * in shared for the tree rules). When a folder's
 * `enabled` flag is "false", every entry whose `folderId` matches is
 * excluded from activation regardless of the entry's own enabled flag —
 * gating happens at `listActiveEntries` time, not by mutating entry rows.
 */
export const lorebookFolders = fileTable("lorebook_folders", {
  id: text("id").primaryKey(),
  lorebookId: text("lorebook_id")
    .notNull()
    .references(() => lorebooks.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  /** Boolean encoded as "true"/"false" text, matching the rest of this table. */
  enabled: text("enabled").notNull().default("true"),
  /** Parent folder for nesting; NULL for a root-level folder. */
  parentFolderId: text("parent_folder_id"),
  /** Display order among sibling folders (lower = higher in the list). */
  order: integer("order").notNull().default(0),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const lorebookEntries = fileTable("lorebook_entries", {
  id: text("id").primaryKey(),
  lorebookId: text("lorebook_id")
    .notNull()
    .references(() => lorebooks.id, { onDelete: "cascade" }),
  /**
   * Folder this entry belongs to, or NULL for root-level. Not enforced as a
   * enforced foreign key to keep folder deletion cheap (the storage layer
   * sets entries' folderId back to null when a folder is removed instead of
   * cascading the entries themselves).
   */
  folderId: text("folder_id"),
  name: text("name").notNull(),
  content: text("content").notNull().default(""),
  /** Short summary used by the knowledge-router agent to decide if this entry is relevant */
  description: text("description").notNull().default(""),
  /** JSON array of primary keywords */
  keys: text("keys").notNull().default("[]"),
  /** JSON array of secondary keywords */
  secondaryKeys: text("secondary_keys").notNull().default("[]"),

  enabled: text("enabled").notNull().default("true"),
  constant: text("constant").notNull().default("false"),
  selective: text("selective").notNull().default("false"),
  selectiveLogic: text("selective_logic", { enum: ["and", "and_all", "or", "not", "not_all"] })
    .notNull()
    .default("and"),
  probability: integer("probability"),
  scanDepth: integer("scan_depth"),
  matchWholeWords: text("match_whole_words").notNull().default("false"),
  caseSensitive: text("case_sensitive").notNull().default("false"),
  useRegex: text("use_regex").notNull().default("false"),
  characterFilterMode: text("character_filter_mode", { enum: ["any", "include", "exclude"] })
    .notNull()
    .default("any"),
  /** JSON array of character IDs used by characterFilterMode */
  characterFilterIds: text("character_filter_ids").notNull().default("[]"),
  characterTagFilterMode: text("character_tag_filter_mode", { enum: ["any", "include", "exclude"] })
    .notNull()
    .default("any"),
  /** JSON array of character-card tags used by characterTagFilterMode */
  characterTagFilters: text("character_tag_filters").notNull().default("[]"),
  generationTriggerFilterMode: text("generation_trigger_filter_mode", { enum: ["any", "include", "exclude"] })
    .notNull()
    .default("any"),
  /** JSON array of generation trigger names */
  generationTriggerFilters: text("generation_trigger_filters").notNull().default("[]"),
  /** JSON array of non-chat matching sources */
  additionalMatchingSources: text("additional_matching_sources").notNull().default("[]"),

  position: integer("position").notNull().default(0),
  /** Exact, case-sensitive name used by the {{outlet::name}} prompt macro */
  outletName: text("outlet_name").notNull().default(""),
  depth: integer("depth").notNull().default(4),
  order: integer("order").notNull().default(100),
  role: text("role", { enum: ["system", "user", "assistant"] })
    .notNull()
    .default("system"),

  sticky: integer("sticky"),
  cooldown: integer("cooldown"),
  delay: integer("delay"),
  ephemeral: integer("ephemeral"),
  group: text("group").notNull().default(""),
  groupWeight: integer("group_weight"),

  // Engine extensions
  /** When true, the Lorebook Keeper agent cannot modify or overwrite this entry */
  locked: text("locked").notNull().default("false"),
  tag: text("tag").notNull().default(""),
  /** JSON object { entryId: relationshipType } */
  relationships: text("relationships").notNull().default("{}"),
  /** JSON object for dynamic state */
  dynamicState: text("dynamic_state").notNull().default("{}"),
  /** JSON array of activation conditions */
  activationConditions: text("activation_conditions").notNull().default("[]"),
  /** JSON schedule object or null */
  schedule: text("schedule"),

  /** When true, this entry's content won't trigger further entries during recursive scanning */
  preventRecursion: text("prevent_recursion").notNull().default("true"),

  /** When true, recursive scanning cannot activate this entry */
  excludeRecursion: text("exclude_recursion").notNull().default("false"),

  /** When true, only recursive scanning can activate this entry */
  delayUntilRecursion: text("delay_until_recursion").notNull().default("false"),

  /** When true, bulk vectorization skips this entry and semantic matching ignores stored vectors */
  excludeFromVectorization: text("exclude_from_vectorization").notNull().default("false"),

  /** Pre-computed embedding vector (JSON array of floats) for semantic matching; held in memory as a packed Float64Array (#5592). */
  embedding: vectorText("embedding"),
  /** Stable provider/model/profile identity for the stored embedding */
  embeddingSpaceId: text("embedding_space_id"),

  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
