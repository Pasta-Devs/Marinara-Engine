// ──────────────────────────────────────────────
// Regex Script Zod Schemas
// ──────────────────────────────────────────────
import { z } from "zod";
import { isPatternSafe } from "../utils/regex-safety.js";

export const regexPlacementSchema = z.enum(["ai_output", "user_input"]);
export const regexApplyModeSchema = z.enum(["prompt", "display", "both"]);

function hasValidRegexFlags(flags: string): boolean {
  try {
    new RegExp("", flags);
    return true;
  } catch {
    return false;
  }
}

function validateDepthRange(data: { minDepth?: number | null; maxDepth?: number | null }, ctx: z.RefinementCtx): void {
  if (data.minDepth != null && data.maxDepth != null && data.minDepth > data.maxDepth) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["maxDepth"],
      message: "Maximum depth must be greater than or equal to minimum depth.",
    });
  }
}

const regexScriptShape = z.object({
  name: z.string().min(1).max(200),
  enabled: z.boolean().default(true),
  findRegex: z
    .string()
    .min(1)
    .refine(
      // Macros like {{char}}/{{user}} are resolved before the pattern is compiled
      // at apply-time; strip them here so the static check doesn't read the macro
      // braces as a malformed `{n,m}` quantifier and reject a legitimate pattern.
      (pattern) => isPatternSafe(pattern.replace(/\{\{[^}]*\}\}/g, "x")),
      "Regex pattern is unsafe: it may cause catastrophic backtracking. Avoid nested quantifiers and overly long patterns.",
    ),
  replaceString: z.string().default(""),
  trimStrings: z.array(z.string()).default([]),
  placement: z.array(regexPlacementSchema).min(1),
  flags: z.string().default("gi").refine(hasValidRegexFlags, "Invalid or duplicated regex flags."),
  promptOnly: z.boolean().default(false),
  applyMode: regexApplyModeSchema.optional(),
  targetCharacterIds: z.array(z.string().min(1)).default([]),
  targetPromptPresetIds: z.array(z.string().min(1)).default([]),
  order: z.number().int().optional(),
  minDepth: z.number().int().nullable().default(null),
  maxDepth: z.number().int().nullable().default(null),
});

export const createRegexScriptSchema = regexScriptShape.superRefine(validateDepthRange);
export const updateRegexScriptSchema = regexScriptShape.partial().superRefine(validateDepthRange);
export const reorderRegexScriptsSchema = z.object({
  scriptIds: z.array(z.string().min(1)),
});

export type CreateRegexScriptInput = z.infer<typeof createRegexScriptSchema>;
export type UpdateRegexScriptInput = z.infer<typeof updateRegexScriptSchema>;
export type ReorderRegexScriptsInput = z.infer<typeof reorderRegexScriptsSchema>;
