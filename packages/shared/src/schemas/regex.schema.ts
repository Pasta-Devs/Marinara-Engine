// ──────────────────────────────────────────────
// Regex Script Zod Schemas
// ──────────────────────────────────────────────
import { z } from "zod";
import { isPatternSafe } from "../utils/regex-safety.js";

export const regexPlacementSchema = z.enum(["ai_output", "user_input"]);

export const createRegexScriptSchema = z.object({
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
  flags: z.string().default("gi"),
  promptOnly: z.boolean().default(false),
  targetCharacterIds: z.array(z.string().min(1)).default([]),
  order: z.number().int().default(0),
  minDepth: z.number().int().nullable().default(null),
  maxDepth: z.number().int().nullable().default(null),
});

export const updateRegexScriptSchema = createRegexScriptSchema.partial();
export const reorderRegexScriptsSchema = z.object({
  scriptIds: z.array(z.string().min(1)),
});

export type CreateRegexScriptInput = z.infer<typeof createRegexScriptSchema>;
export type UpdateRegexScriptInput = z.infer<typeof updateRegexScriptSchema>;
export type ReorderRegexScriptsInput = z.infer<typeof reorderRegexScriptsSchema>;
