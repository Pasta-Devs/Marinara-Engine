// ──────────────────────────────────────────────
// Regex Script Zod Schemas
// ──────────────────────────────────────────────
import { z } from "zod";

export const regexPlacementSchema = z.enum(["ai_output", "user_input"]);

export const createRegexScriptSchema = z.object({
  name: z.string().min(1).max(200),
  enabled: z.boolean().default(true),
  findRegex: z.string().min(1),
  replaceString: z.string().default(""),
  trimStrings: z.array(z.string()).default([]),
  placement: z.array(regexPlacementSchema).min(1),
  flags: z.string().default("gi"),
  promptOnly: z.boolean().default(false),
  order: z.number().int().default(0),
  minDepth: z.number().int().nullable().default(null),
  maxDepth: z.number().int().nullable().default(null),
});

export const updateRegexScriptSchema = createRegexScriptSchema.partial().extend({
  sortOrder: z.number().int().optional(),
});
export const reorderRegexScriptsSchema = z.object({
  scriptIds: z.array(z.string().min(1)),
});

export type CreateRegexScriptInput = z.infer<typeof createRegexScriptSchema>;
export type UpdateRegexScriptInput = z.infer<typeof updateRegexScriptSchema>;
export type ReorderRegexScriptsInput = z.infer<typeof reorderRegexScriptsSchema>;
