// ──────────────────────────────────────────────
// Lorebook Zod Schemas
// ──────────────────────────────────────────────
import { z } from "zod";
import { LIMITS } from "../constants/defaults.js";

export const LOREBOOK_CATEGORY_VALUES = ["world", "character", "npc", "spellbook", "uncategorized"] as const;
export type LorebookCategoryValue = (typeof LOREBOOK_CATEGORY_VALUES)[number];
export const lorebookCategorySchema = z.enum(LOREBOOK_CATEGORY_VALUES);

export function normalizeLorebookCategory(value: unknown): LorebookCategoryValue {
  if (typeof value !== "string") return "uncategorized";
  const parsed = lorebookCategorySchema.safeParse(value.trim().toLowerCase());
  return parsed.success ? parsed.data : "uncategorized";
}

export const lorebookScopeModeSchema = z.enum(["all", "disabled", "specific"]);

export const lorebookScopeSchema = z.object({
  mode: lorebookScopeModeSchema.default("all"),
  chatIds: z.array(z.string()).default([]),
});

export const selectiveLogicSchema = z.enum(["and", "and_all", "or", "not", "not_all"]);

export const lorebookFilterModeSchema = z.enum(["any", "include", "exclude"]);

export const lorebookMatchingSourceSchema = z.enum([
  "character_name",
  "character_description",
  "character_personality",
  "character_scenario",
  "character_tags",
  "persona_description",
  "persona_tags",
]);

export const activationConditionSchema = z.object({
  field: z.string(),
  operator: z.enum(["equals", "not_equals", "contains", "not_contains", "gt", "lt"]),
  value: z.string(),
});

export const lorebookScheduleSchema = z.object({
  activeTimes: z.array(z.string()).default([]),
  activeDates: z.array(z.string()).default([]),
  activeLocations: z.array(z.string()).default([]),
});

const lorebookGeneratedBySchema = z
  .enum(["user", "agent", "import", "lorebook-maker"])
  .nullable()
  .transform((value) => (value === "lorebook-maker" ? "agent" : value));

type LorebookScopeConflictInput = {
  characterId?: string | null;
  characterIds?: string[];
  personaId?: string | null;
  personaIds?: string[];
  isGlobal?: boolean;
};

function addLorebookScopeConflictIssues(value: LorebookScopeConflictInput, ctx: z.RefinementCtx) {
  const hasCharacterId = typeof value.characterId === "string" && value.characterId.trim().length > 0;
  const hasCharacterIds = value.characterIds !== undefined && value.characterIds.length > 0;
  const hasPersonaId = typeof value.personaId === "string" && value.personaId.trim().length > 0;
  const hasPersonaIds = value.personaIds !== undefined && value.personaIds.length > 0;

  if (hasCharacterId && hasCharacterIds) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["characterIds"],
      message: "Use either characterId or characterIds, not both.",
    });
  }

  if (hasPersonaId && hasPersonaIds) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["personaIds"],
      message: "Use either personaId or personaIds, not both.",
    });
  }

  if (value.isGlobal === true && (hasCharacterId || hasCharacterIds || hasPersonaId || hasPersonaIds)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["isGlobal"],
      message: "Global lorebooks cannot also target specific characters or personas.",
    });
  }
}

// ──────────────────────────────────────────────
// Folders — collapsible containers for entries.
// Folders may nest via `parentFolderId` (`null` = a root-level folder). The
// POST route verifies the parent exists in the same lorebook; PATCH validates
// the full move (no self-parent, same lorebook, no descendant cycle) via
// `canReparentFolder` before persisting.
// ──────────────────────────────────────────────
export const createLorebookFolderSchema = z.object({
  name: z.string().min(1).max(200),
  enabled: z.boolean().default(true),
  parentFolderId: z.string().nullable().default(null),
  order: z.number().int().default(0),
});

export const updateLorebookFolderSchema = createLorebookFolderSchema.partial();

const lorebookBaseSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().default(""),
  category: lorebookCategorySchema.default("uncategorized"),
  imagePath: z.string().nullable().default(null),
  scanDepth: z.number().int().min(0).default(2),
  tokenBudget: z.number().int().min(0).default(2048),
  entryLimit: z
    .number()
    .int()
    .min(LIMITS.LOREBOOK_ENTRY_LIMIT_MIN)
    .max(LIMITS.LOREBOOK_ENTRY_LIMIT_MAX)
    .default(LIMITS.LOREBOOK_ENTRY_LIMIT_DEFAULT),
  recursiveScanning: z.boolean().default(false),
  maxRecursionDepth: z.number().int().min(1).max(10).default(3),
  excludeFromVectorization: z.boolean().default(true),
  vectorQueryDepth: z
    .number()
    .int()
    .min(0)
    .max(LIMITS.LOREBOOK_VECTOR_QUERY_DEPTH_MAX)
    .default(LIMITS.LOREBOOK_VECTOR_QUERY_DEPTH_DEFAULT),
  vectorScoreThreshold: z.number().min(0).max(1).default(LIMITS.LOREBOOK_VECTOR_SCORE_THRESHOLD_DEFAULT),
  vectorMaxResults: z
    .number()
    .int()
    .min(LIMITS.LOREBOOK_VECTOR_MAX_RESULTS_MIN)
    .max(LIMITS.LOREBOOK_VECTOR_MAX_RESULTS_MAX)
    .default(LIMITS.LOREBOOK_VECTOR_MAX_RESULTS_DEFAULT),
  characterId: z.string().nullable().default(null),
  characterIds: z.array(z.string()).default([]),
  personaId: z.string().nullable().default(null),
  personaIds: z.array(z.string()).default([]),
  chatId: z.string().nullable().default(null),
  isGlobal: z.boolean().default(false),
  enabled: z.boolean().default(true),
  scope: lorebookScopeSchema.default({ mode: "all", chatIds: [] }),
  tags: z.array(z.string()).default([]),
  generatedBy: lorebookGeneratedBySchema.default(null),
  sourceAgentId: z.string().nullable().default(null),
});

export const createLorebookSchema = lorebookBaseSchema.superRefine(addLorebookScopeConflictIssues);

export const updateLorebookSchema = lorebookBaseSchema.partial().superRefine(addLorebookScopeConflictIssues);

export const createLorebookEntrySchema = z.object({
  lorebookId: z.string(),
  name: z.string().min(1).max(200),
  content: z.string().default(""),
  description: z.string().default(""),
  keys: z.array(z.string()).default([]),
  secondaryKeys: z.array(z.string()).default([]),
  enabled: z.boolean().default(true),
  constant: z.boolean().default(false),
  selective: z.boolean().default(false),
  selectiveLogic: selectiveLogicSchema.default("and"),
  probability: z.number().nullable().default(null),
  scanDepth: z.number().nullable().default(null),
  matchWholeWords: z.boolean().default(false),
  caseSensitive: z.boolean().default(false),
  useRegex: z.boolean().default(false),
  characterFilterMode: lorebookFilterModeSchema.default("any"),
  characterFilterIds: z.array(z.string()).default([]),
  characterTagFilterMode: lorebookFilterModeSchema.default("any"),
  characterTagFilters: z.array(z.string()).default([]),
  generationTriggerFilterMode: lorebookFilterModeSchema.default("any"),
  generationTriggerFilters: z.array(z.string()).default([]),
  additionalMatchingSources: z.array(lorebookMatchingSourceSchema).default([]),
  position: z.number().int().min(0).max(2).default(0),
  depth: z.number().int().min(0).default(4),
  order: z.number().int().default(100),
  role: z.enum(["system", "user", "assistant"]).default("system"),
  sticky: z.number().nullable().default(null),
  cooldown: z.number().nullable().default(null),
  delay: z.number().nullable().default(null),
  ephemeral: z.number().int().min(0).nullable().default(null),
  group: z.string().default(""),
  groupWeight: z.number().nullable().default(null),
  /** Optional folder this entry belongs to. Null/omitted = root level. */
  folderId: z.string().nullable().default(null),
  preventRecursion: z.boolean().default(true),
  excludeRecursion: z.boolean().default(false),
  delayUntilRecursion: z.boolean().default(false),
  locked: z.boolean().default(false),
  tag: z.string().default(""),
  relationships: z.record(z.string()).default({}),
  dynamicState: z.record(z.unknown()).default({}),
  activationConditions: z.array(activationConditionSchema).default([]),
  schedule: lorebookScheduleSchema.nullable().default(null),
  excludeFromVectorization: z.boolean().default(false),
});

export const updateLorebookEntrySchema = createLorebookEntrySchema.omit({ lorebookId: true }).partial();

const bulkUpdateLorebookEntryChangesSchema = updateLorebookEntrySchema
  .pick({
    enabled: true,
    constant: true,
    selective: true,
    matchWholeWords: true,
    caseSensitive: true,
    useRegex: true,
    preventRecursion: true,
    excludeRecursion: true,
    delayUntilRecursion: true,
    excludeFromVectorization: true,
    locked: true,
  })
  .refine((changes) => Object.values(changes).some((value) => value !== undefined), {
    message: "Choose at least one setting to update",
  });

export const bulkUpdateLorebookEntriesSchema = z.object({
  entryIds: z.array(z.string().min(1)).min(1).max(5000),
  changes: bulkUpdateLorebookEntryChangesSchema,
});

export type CreateLorebookInput = z.input<typeof createLorebookSchema>;
export type UpdateLorebookInput = z.infer<typeof updateLorebookSchema>;
export type CreateLorebookEntryInput = z.input<typeof createLorebookEntrySchema>;
export type UpdateLorebookEntryInput = z.infer<typeof updateLorebookEntrySchema>;
export type BulkUpdateLorebookEntriesInput = z.infer<typeof bulkUpdateLorebookEntriesSchema>;
export type CreateLorebookFolderInput = z.input<typeof createLorebookFolderSchema>;
export type UpdateLorebookFolderInput = z.infer<typeof updateLorebookFolderSchema>;
