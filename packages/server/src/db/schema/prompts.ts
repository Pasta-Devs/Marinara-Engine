// ──────────────────────────────────────────────
// Schema: Prompt Presets, Groups, Sections & Choices
// ──────────────────────────────────────────────
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const promptPresets = sqliteTable("prompt_presets", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  /** JSON array of section IDs in order */
  sectionOrder: text("section_order").notNull().default("[]"),
  /** JSON array of group IDs in order */
  groupOrder: text("group_order").notNull().default("[]"),
  /** JSON array of variable groups */
  variableGroups: text("variable_groups").notNull().default("[]"),
  /** JSON object of current variable values */
  variableValues: text("variable_values").notNull().default("{}"),
  /** JSON object of generation parameters */
  parameters: text("parameters").notNull().default("{}"),
  /** Auto-wrapping format: "xml" | "markdown" */
  wrapFormat: text("wrap_format").notNull().default("xml"),
  /** JSON object of saved default variable selections for this preset */
  defaultChoices: text("default_choices").notNull().default("{}"),
  /** Whether this is the built-in default preset */
  isDefault: text("is_default").notNull().default("false"),
  /** Author of this preset */
  author: text("author").notNull().default(""),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const promptGroups = sqliteTable("prompt_groups", {
  id: text("id").primaryKey(),
  presetId: text("preset_id")
    .notNull()
    .references(() => promptPresets.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  /** Self-referencing parent group for nesting (null = top-level) */
  parentGroupId: text("parent_group_id"),
  order: integer("order").notNull().default(100),
  enabled: text("enabled").notNull().default("true"),
  createdAt: text("created_at").notNull(),
});

export const promptSections = sqliteTable("prompt_sections", {
  id: text("id").primaryKey(),
  presetId: text("preset_id")
    .notNull()
    .references(() => promptPresets.id, { onDelete: "cascade" }),
  identifier: text("identifier").notNull(),
  name: text("name").notNull(),
  content: text("content").notNull().default(""),
  role: text("role", { enum: ["system", "user", "assistant"] })
    .notNull()
    .default("system"),
  enabled: text("enabled").notNull().default("true"),
  isMarker: text("is_marker").notNull().default("false"),
  /** Group this section belongs to */
  groupId: text("group_id"),
  /** JSON MarkerConfig for marker sections */
  markerConfig: text("marker_config"),
  injectionPosition: text("injection_position", { enum: ["ordered", "depth"] })
    .notNull()
    .default("ordered"),
  injectionDepth: integer("injection_depth").notNull().default(0),
  injectionOrder: integer("injection_order").notNull().default(100),
  // Legacy columns kept for backward compat — no longer used by assembler
  wrapInXml: text("wrap_in_xml").notNull().default("false"),
  xmlTagName: text("xml_tag_name").notNull().default(""),
  forbidOverrides: text("forbid_overrides").notNull().default("false"),
});

export const choiceBlocks = sqliteTable("choice_blocks", {
  id: text("id").primaryKey(),
  presetId: text("preset_id")
    .notNull()
    .references(() => promptPresets.id, { onDelete: "cascade" }),
  /** Machine name used in macros, e.g. "POV" → {{POV}} */
  variableName: text("variable_name").notNull(),
  /** Human-readable question shown to the user */
  question: text("question").notNull(),
  /** JSON array of ChoiceOption[] */
  options: text("options").notNull().default("[]"),
  /** If true, the user can select multiple options */
  multiSelect: text("multi_select").notNull().default("false"),
  /** Separator for joining multiple values (default ", ") */
  separator: text("separator").notNull().default(", "),
  /** If true, randomly pick one of the user's selected options each generation */
  randomPick: text("random_pick").notNull().default("false"),
  /** UI presentation mode for the choice picker */
  displayMode: text("display_mode").notNull().default("auto"),
  /** Manual or alphabetic option presentation */
  optionSort: text("option_sort").notNull().default("manual"),
  /** Sort order for display / question sequence */
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at").notNull(),
});
