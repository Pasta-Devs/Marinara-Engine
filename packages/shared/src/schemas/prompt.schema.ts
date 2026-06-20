// ──────────────────────────────────────────────
// Prompt Zod Schemas
// ──────────────────────────────────────────────
import { z } from "zod";

export const promptRoleSchema = z.enum(["system", "user", "assistant"]);

export const injectionPositionSchema = z.enum(["ordered", "depth"]);

export const wrapFormatSchema = z.enum(["xml", "markdown", "none"]);

export const markerTypeSchema = z.enum([
  "character",
  "lorebook",
  "persona",
  "chat_history",
  "chat_summary",
  "world_info_before",
  "world_info_after",
  "dialogue_examples",
  "agent_data",
]);

export const markerConfigSchema = z.object({
  type: markerTypeSchema,
  characterFields: z.array(z.string()).optional(),
  lorebookFormat: z.enum(["full", "worldbook_only", "character_only"]).optional(),
  chatHistoryOptions: z
    .object({
      maxMessages: z.number().int().min(1).optional(),
      includeSystemMessages: z.boolean().optional(),
    })
    .optional(),
  agentType: z.string().optional(),
});

export const generationParametersSchema = z.object({
  temperature: z.number().min(0).max(2).default(1),
  topP: z.number().gt(0).max(1).default(1),
  topK: z.number().int().min(0).default(0),
  minP: z.number().min(0).max(1).default(0),
  maxTokens: z.number().int().min(1).default(4096),
  maxContext: z.number().int().min(1).default(128000),
  frequencyPenalty: z.number().min(-2).max(2).default(0),
  presencePenalty: z.number().min(-2).max(2).default(0),
  reasoningEffort: z.enum(["low", "medium", "high", "xhigh", "maximum"]).nullable().default(null),
  verbosity: z.enum(["low", "medium", "high"]).nullable().default(null),
  serviceTier: z.enum(["flex", "priority"]).nullable().default(null),
  assistantPrefill: z.string().default(""),
  customThinkingTags: z
    .array(
      z.object({
        open: z.string().trim().min(1).max(120),
        close: z.string().trim().min(1).max(120),
      }),
    )
    .max(20)
    .default([]),
  customParameters: z.record(z.unknown()).default({}),
  squashSystemMessages: z.boolean().default(true),
  showThoughts: z.boolean().default(true),
  useMaxContext: z.boolean().default(false),
  stopSequences: z.array(z.string()).default([]),
  strictRoleFormatting: z.boolean().default(true),
  singleUserMessage: z.boolean().default(false),
});

export const promptVariableOptionSchema = z.object({
  label: z.string(),
  value: z.string(),
});

export const promptVariableGroupSchema = z.object({
  name: z.string(),
  label: z.string(),
  options: z.array(promptVariableOptionSchema),
});

// ── Choice blocks (preset variables) ──

export const choiceOptionSchema = z.object({
  id: z.string(),
  label: z.string(),
  value: z.string(),
});

export const choiceDisplayModeSchema = z.enum(["auto", "buttons", "listbox"]);
export const choiceOptionSortSchema = z.enum(["manual", "alphabetical"]);

export const createChoiceBlockSchema = z.object({
  presetId: z.string(),
  variableName: z.string().min(1).max(100).regex(/^\w+$/, "Variable name must be alphanumeric/underscores only"),
  question: z.string().min(1).max(500),
  options: z.array(choiceOptionSchema).min(1),
  multiSelect: z.boolean().default(false),
  separator: z.string().max(20).default(", "),
  randomPick: z.boolean().default(false),
  displayMode: choiceDisplayModeSchema.default("auto"),
  optionSort: choiceOptionSortSchema.default("manual"),
});

export const updateChoiceBlockSchema = z.object({
  variableName: z
    .string()
    .min(1)
    .max(100)
    .regex(/^\w+$/, "Variable name must be alphanumeric/underscores only")
    .optional(),
  question: z.string().min(1).max(500).optional(),
  options: z.array(choiceOptionSchema).min(1).optional(),
  multiSelect: z.boolean().optional(),
  separator: z.string().max(20).optional(),
  randomPick: z.boolean().optional(),
  displayMode: choiceDisplayModeSchema.optional(),
  optionSort: choiceOptionSortSchema.optional(),
});

// ── Groups ──

export const createPromptGroupSchema = z.object({
  presetId: z.string(),
  name: z.string().min(1).max(200),
  parentGroupId: z.string().nullable().default(null),
  order: z.number().int().default(100),
  enabled: z.boolean().default(true),
});

export const updatePromptGroupSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  parentGroupId: z.string().nullable().optional(),
  order: z.number().int().optional(),
  enabled: z.boolean().optional(),
});

// ── Presets ──

export const createPromptPresetSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().default(""),
  variableGroups: z.array(promptVariableGroupSchema).default([]),
  variableValues: z.record(z.string()).default({}),
  parameters: generationParametersSchema.default({}),
  wrapFormat: wrapFormatSchema.default("xml"),
  isDefault: z.boolean().default(false),
  author: z.string().default(""),
});

export const updatePromptPresetSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  sectionOrder: z.array(z.string()).optional(),
  groupOrder: z.array(z.string()).optional(),
  variableGroups: z.array(promptVariableGroupSchema).optional(),
  variableValues: z.record(z.string()).optional(),
  parameters: generationParametersSchema.partial().optional(),
  wrapFormat: wrapFormatSchema.optional(),
  author: z.string().optional(),
  defaultChoices: z.record(z.union([z.string(), z.array(z.string())])).optional(),
});

// ── Sections ──

export const createPromptSectionSchema = z.object({
  presetId: z.string(),
  identifier: z.string(),
  name: z.string().min(1).max(200),
  content: z.string().default(""),
  role: promptRoleSchema.default("system"),
  enabled: z.boolean().default(true),
  isMarker: z.boolean().default(false),
  groupId: z.string().nullable().default(null),
  markerConfig: markerConfigSchema.nullable().default(null),
  injectionPosition: injectionPositionSchema.default("ordered"),
  injectionDepth: z.number().int().min(0).default(0),
  injectionOrder: z.number().int().default(100),
  forbidOverrides: z.boolean().default(false),
});

export const updatePromptSectionSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  content: z.string().optional(),
  role: promptRoleSchema.optional(),
  enabled: z.boolean().optional(),
  groupId: z.string().nullable().optional(),
  markerConfig: markerConfigSchema.nullable().optional(),
  injectionPosition: injectionPositionSchema.optional(),
  injectionDepth: z.number().int().min(0).optional(),
  injectionOrder: z.number().int().optional(),
  forbidOverrides: z.boolean().optional(),
});

// ── Exported input types ──

export type CreatePromptPresetInput = z.input<typeof createPromptPresetSchema>;
export type UpdatePromptPresetInput = z.infer<typeof updatePromptPresetSchema>;
export type CreatePromptSectionInput = z.input<typeof createPromptSectionSchema>;
export type UpdatePromptSectionInput = z.infer<typeof updatePromptSectionSchema>;
export type CreatePromptGroupInput = z.input<typeof createPromptGroupSchema>;
export type UpdatePromptGroupInput = z.infer<typeof updatePromptGroupSchema>;
export type CreateChoiceBlockInput = z.infer<typeof createChoiceBlockSchema>;
export type UpdateChoiceBlockInput = z.infer<typeof updateChoiceBlockSchema>;
export type GenerationParametersInput = z.infer<typeof generationParametersSchema>;
