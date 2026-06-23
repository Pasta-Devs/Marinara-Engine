// ──────────────────────────────────────────────
// Lorebook Zod Schemas
// ──────────────────────────────────────────────
import { z } from "zod";
import { LIMITS } from "../constants/defaults.js";

export const lorebookCategorySchema = z.enum(["world", "character", "npc", "spellbook", "uncategorized"]);

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

// ──────────────────────────────────────────────
// Folders — collapsible containers for entries
// `parentFolderId` is reserved for a future nested-folder PR; v1 enforces
// `null` at the route layer so the schema accepts the field but the server
// rejects non-null values.
// ──────────────────────────────────────────────
export const createLorebookFolderSchema = z.object({
  name: z.string().min(1).max(200),
  enabled: z.boolean().default(true),
  parentFolderId: z.string().nullable().default(null),
  order: z.number().int().default(0),
});

export const updateLorebookFolderSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  enabled: z.boolean().optional(),
  parentFolderId: z.string().nullable().optional(),
  order: z.number().int().optional(),
});

export const createLorebookSchema = z.object({
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
  excludeFromVectorization: z.boolean().default(false),
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

export const updateLorebookSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    description: z.string().optional(),
    category: lorebookCategorySchema.optional(),
    imagePath: z.string().nullable().optional(),
    scanDepth: z.number().int().min(0).optional(),
    tokenBudget: z.number().int().min(0).optional(),
    entryLimit: z
      .number()
      .int()
      .min(LIMITS.LOREBOOK_ENTRY_LIMIT_MIN)
      .max(LIMITS.LOREBOOK_ENTRY_LIMIT_MAX)
      .optional(),
    recursiveScanning: z.boolean().optional(),
    maxRecursionDepth: z.number().int().min(1).max(10).optional(),
    excludeFromVectorization: z.boolean().optional(),
    characterId: z.string().nullable().optional(),
    characterIds: z.array(z.string()).optional(),
    personaId: z.string().nullable().optional(),
    personaIds: z.array(z.string()).optional(),
    chatId: z.string().nullable().optional(),
    isGlobal: z.boolean().optional(),
    enabled: z.boolean().optional(),
    scope: lorebookScopeSchema.optional(),
    tags: z.array(z.string()).optional(),
    generatedBy: lorebookGeneratedBySchema.optional(),
    sourceAgentId: z.string().nullable().optional(),
  })
  .superRefine((value, ctx) => {
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
  });

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

export const updateLorebookEntrySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  content: z.string().optional(),
  description: z.string().optional(),
  keys: z.array(z.string()).optional(),
  secondaryKeys: z.array(z.string()).optional(),
  enabled: z.boolean().optional(),
  constant: z.boolean().optional(),
  selective: z.boolean().optional(),
  selectiveLogic: selectiveLogicSchema.optional(),
  probability: z.number().nullable().optional(),
  scanDepth: z.number().nullable().optional(),
  matchWholeWords: z.boolean().optional(),
  caseSensitive: z.boolean().optional(),
  useRegex: z.boolean().optional(),
  characterFilterMode: lorebookFilterModeSchema.optional(),
  characterFilterIds: z.array(z.string()).optional(),
  characterTagFilterMode: lorebookFilterModeSchema.optional(),
  characterTagFilters: z.array(z.string()).optional(),
  generationTriggerFilterMode: lorebookFilterModeSchema.optional(),
  generationTriggerFilters: z.array(z.string()).optional(),
  additionalMatchingSources: z.array(lorebookMatchingSourceSchema).optional(),
  position: z.number().int().min(0).max(2).optional(),
  depth: z.number().int().min(0).optional(),
  order: z.number().int().optional(),
  role: z.enum(["system", "user", "assistant"]).optional(),
  sticky: z.number().nullable().optional(),
  cooldown: z.number().nullable().optional(),
  delay: z.number().nullable().optional(),
  ephemeral: z.number().int().min(0).nullable().optional(),
  group: z.string().optional(),
  groupWeight: z.number().nullable().optional(),
  folderId: z.string().nullable().optional(),
  preventRecursion: z.boolean().optional(),
  excludeRecursion: z.boolean().optional(),
  delayUntilRecursion: z.boolean().optional(),
  locked: z.boolean().optional(),
  tag: z.string().optional(),
  relationships: z.record(z.string()).optional(),
  dynamicState: z.record(z.unknown()).optional(),
  activationConditions: z.array(activationConditionSchema).optional(),
  schedule: lorebookScheduleSchema.nullable().optional(),
  excludeFromVectorization: z.boolean().optional(),
});

export type CreateLorebookInput = z.input<typeof createLorebookSchema>;
export type UpdateLorebookInput = z.infer<typeof updateLorebookSchema>;
export type CreateLorebookEntryInput = z.input<typeof createLorebookEntrySchema>;
export type UpdateLorebookEntryInput = z.infer<typeof updateLorebookEntrySchema>;
export type CreateLorebookFolderInput = z.input<typeof createLorebookFolderSchema>;
export type UpdateLorebookFolderInput = z.infer<typeof updateLorebookFolderSchema>;
