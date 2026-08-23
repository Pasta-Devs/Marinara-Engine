import { z } from "zod";
import { avatarCropSchema } from "./avatar-crop.schema.js";
import { convoBehaviorInsertionStrategySchema } from "./character.schema.js";
import { normalizeStatIcon, SUPPORTED_STAT_ICONS } from "../constants/stat-icons.js";
import { normalizeAvatarCrop } from "../utils/avatar-crop.js";
import type { ConvoBehaviorConfig } from "../types/character.js";
import type { PersonaStatsConfig, TrackerCardColorConfig } from "../types/persona.js";

const trackerCardColorModeSchema = z.enum(["default", "chat", "custom"]);
const trackerCardPortraitStageBackgroundSchema = z.enum(["ambient", "spotlight", "soft", "plain"]);
const finiteNumberSchema = z.number().finite();
const personaNameSchema = z.string().trim().min(1);
const gradientMarkerPattern = /gradient\s*\(/i;
const supportedLocalPaintGradientPattern = /^\s*(?:repeating-)?(?:linear|radial|conic)-gradient\s*\(/i;
const unsafeLocalPaintPattern = /\\|(?:url|(?:-\w+-)?image(?:-set)?|expression)\s*\(|[;{}]/i;

function isSafePersonaLocalPaint(value: string): boolean {
  if (unsafeLocalPaintPattern.test(value)) return false;
  if (!gradientMarkerPattern.test(value)) return true;
  if (!supportedLocalPaintGradientPattern.test(value) || !value.trimEnd().endsWith(")")) {
    return false;
  }

  let depth = 0;
  let outerGradientClosed = false;
  for (const character of value.trim()) {
    if (character === "(") {
      if (outerGradientClosed) return false;
      depth += 1;
    } else if (character === ")") {
      depth -= 1;
      if (depth < 0) return false;
      if (depth === 0) outerGradientClosed = true;
    } else if (outerGradientClosed && !/\s/.test(character)) {
      return false;
    }
  }
  return depth === 0 && outerGradientClosed;
}

/** Persona CSS paint values must remain a single, local paint value. */
export const personaLocalPaintSchema = z
  .string()
  .refine(isSafePersonaLocalPaint, "Paint must be a solid color or one local gradient");

const personaTimestampSchema = z.union([
  z.string().datetime(),
  finiteNumberSchema.transform((value, ctx) => {
    const normalized = value < 1e12 ? value * 1000 : value;
    const date = new Date(normalized);
    if (Number.isNaN(date.getTime())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid timestamp" });
      return z.NEVER;
    }
    return date.toISOString();
  }),
]);

function clampedInteger(value: number, max: number): number {
  return Math.max(0, Math.min(max, Math.round(value)));
}

const trackerPercentageSchema = finiteNumberSchema.transform((value) => clampedInteger(value, 100));
const trackerPortraitFocusYSchema = finiteNumberSchema.transform((value) => clampedInteger(value, 140));
const trackerPortraitZoomSchema = finiteNumberSchema.transform(
  (value) => Math.round(Math.max(0.75, Math.min(2.35, value)) * 100) / 100,
);

function validateRpgValueRange(value: { value: number; max: number }, ctx: z.RefinementCtx): void {
  if (value.max < 1) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["max"], message: "Maximum must be at least 1" });
  }
  if (value.value < 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["value"], message: "Value cannot be negative" });
  } else if (value.value > value.max) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["value"], message: "Value cannot exceed maximum" });
  }
}

/** Numeric tracker fields legacy clients sometimes serialized as strings. */
const LEGACY_TRACKER_NUMERIC_FIELDS = [
  "nameColorOpacity",
  "dialogueColorOpacity",
  "boxColorOpacity",
  "tintIntensity",
  "materialBrightness",
  "glowIntensity",
  "contrastIntensity",
  "portraitFocusX",
  "portraitFocusY",
  "portraitZoom",
] as const;

/** Parse a serialized legacy Persona field while leaving decoded inputs strict. */
function decodeLegacyJson(value: unknown, emptyValue?: unknown): unknown {
  if (typeof value !== "string") return value;
  if (value === "" && emptyValue !== undefined) return emptyValue;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

/** The structured Persona fields historical clients serialized as JSON strings. */
const LEGACY_PERSONA_FIELDS = [
  "avatarCrop",
  "trackerCardColors",
  "personaStats",
  "tags",
  "savedStatusOptions",
  "convoBehavior",
] as const;

type LegacyPersonaField = (typeof LEGACY_PERSONA_FIELDS)[number];

function canonicalizeLegacyTrackerCardColors(value: unknown): unknown {
  const decoded = decodeLegacyJson(value, { mode: "chat" });
  if (typeof value !== "string" || !decoded || typeof decoded !== "object" || Array.isArray(decoded)) return decoded;
  const result = { ...(decoded as Record<string, unknown>) };
  for (const key of LEGACY_TRACKER_NUMERIC_FIELDS) {
    if (typeof result[key] === "string" && result[key].trim() !== "") {
      const numeric = Number(result[key]);
      if (Number.isFinite(numeric)) result[key] = numeric;
    }
  }
  if (Array.isArray(result.statIcons)) {
    result.statIcons = result.statIcons.map((assignment) => {
      if (!assignment || typeof assignment !== "object" || Array.isArray(assignment)) return assignment;
      const record = assignment as Record<string, unknown>;
      if (record.icon === null || typeof record.icon !== "string") return assignment;
      const canonicalIcon = normalizeStatIcon(record.icon);
      // Only supported aliases are canonicalized; unknown icons stay raw so
      // the strict boundary schema still rejects them.
      return canonicalIcon === null ? assignment : { ...record, icon: canonicalIcon };
    });
  }
  return result;
}

function canonicalizeLegacyConvoBehavior(value: unknown): unknown {
  const decoded = decodeLegacyJson(value, null);
  if (typeof value !== "string" || !decoded || typeof decoded !== "object" || Array.isArray(decoded)) return decoded;
  const record = decoded as Record<string, unknown>;
  if (typeof record.instruction !== "string") return decoded;
  if (convoBehaviorInsertionStrategySchema.safeParse(record.insertionStrategy).success) return decoded;
  return { ...record, insertionStrategy: "constant_after" };
}

function canonicalizeLegacyAvatarCrop(value: unknown): unknown {
  const decoded = decodeLegacyJson(value, null);
  if (typeof value !== "string" || decoded === null || decoded === undefined) return decoded;
  if (typeof decoded !== "object" || Array.isArray(decoded)) return decoded;
  return normalizeAvatarCrop(decoded) ?? decoded;
}

/**
 * Canonicalize one originally serialized legacy field before boundary
 * validation. Deliberately module-private: boundaries go through
 * `canonicalizeLegacyPersonaInput` so the field inventory lives in one place.
 */
function canonicalizeLegacyPersonaField(field: LegacyPersonaField, value: unknown): unknown {
  switch (field) {
    case "avatarCrop":
      return canonicalizeLegacyAvatarCrop(value);
    case "trackerCardColors":
      return canonicalizeLegacyTrackerCardColors(value);
    case "convoBehavior":
      return canonicalizeLegacyConvoBehavior(value);
    case "personaStats":
      return decodeLegacyJson(value, null);
    case "tags":
    case "savedStatusOptions":
      return decodeLegacyJson(value);
  }
}

/**
 * Canonicalize every recognized legacy structured field on a Persona input
 * object before boundary validation, so each boundary reuses one field
 * inventory and one compatibility policy instead of restating both.
 *
 * Only keys that are actually present are touched — absent keys stay absent so
 * partial updates keep their meaning — and anything that is not a plain object
 * is passed straight through for the boundary schema to reject. Modern decoded
 * inputs are unaffected: the field helpers only decode serialized strings.
 */
export function canonicalizeLegacyPersonaInput(input: unknown): unknown {
  if (!input || typeof input !== "object" || Array.isArray(input)) return input;
  const record = input as Record<string, unknown>;
  const result: Record<string, unknown> = { ...record };
  for (const field of LEGACY_PERSONA_FIELDS) {
    if (Object.hasOwn(record, field)) result[field] = canonicalizeLegacyPersonaField(field, record[field]);
  }
  return result;
}

const trackerStatIconAssignmentSchema = z
  .object({
    name: z.string(),
    occurrence: z.number().int().min(0),
    icon: z.enum(SUPPORTED_STAT_ICONS).nullable(),
  })
  .passthrough();

export const trackerCardColorConfigSchema = z
  .object({
    mode: trackerCardColorModeSchema.optional(),
    statIcons: z.array(trackerStatIconAssignmentSchema).optional(),
    displayEnabled: z.boolean().optional(),
    nameColor: personaLocalPaintSchema.optional(),
    nameColorOpacity: trackerPercentageSchema.optional(),
    accentEnabled: z.boolean().optional(),
    dialogueColor: personaLocalPaintSchema.optional(),
    dialogueColorOpacity: trackerPercentageSchema.optional(),
    surfaceEnabled: z.boolean().optional(),
    boxColor: personaLocalPaintSchema.optional(),
    boxColorOpacity: trackerPercentageSchema.optional(),
    tintIntensity: trackerPercentageSchema.optional(),
    materialBrightness: trackerPercentageSchema.optional(),
    glowIntensity: trackerPercentageSchema.optional(),
    contrastIntensity: trackerPercentageSchema.optional(),
    portraitStageBackground: trackerCardPortraitStageBackgroundSchema.optional(),
    portraitFocusX: trackerPercentageSchema.optional(),
    portraitFocusY: trackerPortraitFocusYSchema.optional(),
    portraitZoom: trackerPortraitZoomSchema.optional(),
  })
  .passthrough()
  .transform((value): TrackerCardColorConfig => value);

const personaStatBarSchema = z
  .object({ name: z.string(), value: finiteNumberSchema, max: finiteNumberSchema, color: z.string() })
  .passthrough();
const rpgStatPoolSchema = z
  .object({ name: z.string(), value: finiteNumberSchema, max: finiteNumberSchema, color: z.string() })
  .passthrough()
  .superRefine(validateRpgValueRange);
const rpgStatsSchema = z
  .object({
    enabled: z.boolean(),
    attributes: z.array(z.object({ name: z.string(), value: finiteNumberSchema }).passthrough()),
    hp: z
      .object({ value: finiteNumberSchema, max: finiteNumberSchema })
      .passthrough()
      .superRefine(validateRpgValueRange),
    pools: z.array(rpgStatPoolSchema).optional(),
  })
  .passthrough();

const personaStatsSchema = z
  .object({ enabled: z.boolean(), bars: z.array(personaStatBarSchema), rpgStats: rpgStatsSchema.optional() })
  .passthrough()
  .transform((value): PersonaStatsConfig => value);

const convoBehaviorSchema = z
  .object({
    instruction: z.string(),
    insertionStrategy: convoBehaviorInsertionStrategySchema,
  })
  .passthrough()
  .transform((value): ConvoBehaviorConfig => value);

const personaFields = {
  name: personaNameSchema,
  comment: z.string().optional(),
  creator: z.string().optional(),
  personaVersion: z.string().optional(),
  versioningEnabled: z.boolean().optional(),
  creatorNotes: z.string().optional(),
  phoneticName: z.string().optional(),
  description: z.string().optional(),
  personality: z.string().optional(),
  scenario: z.string().optional(),
  backstory: z.string().optional(),
  appearance: z.string().optional(),
  avatarCrop: avatarCropSchema.nullable().optional(),
  nameColor: personaLocalPaintSchema.optional(),
  dialogueColor: personaLocalPaintSchema.optional(),
  boxColor: personaLocalPaintSchema.optional(),
  trackerCardColors: trackerCardColorConfigSchema.optional(),
  personaStats: personaStatsSchema.nullable().optional(),
  tags: z.array(z.string()).optional(),
  savedStatusOptions: z.array(z.string()).optional(),
  convoDisplayName: z.string().optional(),
  aboutMe: z.string().optional(),
  convoBehavior: convoBehaviorSchema.nullable().optional(),
};

// createdAt/updatedAt are create/import-only ISO timestamp overrides. Explicit
// update keys are forbidden while unrelated unknown top-level keys stay stripped.
export const personaCreateInputSchema = z.object({
  ...personaFields,
  createdAt: personaTimestampSchema.optional(),
  updatedAt: personaTimestampSchema.optional(),
});
export const personaUpdateInputSchema = z.object({
  ...personaFields,
  name: personaNameSchema.optional(),
  avatarPath: z.string().nullable().optional(),
  createdAt: z.never().optional(),
  updatedAt: z.never().optional(),
});

export type PersonaCreateInput = z.infer<typeof personaCreateInputSchema>;
export type PersonaUpdateInput = z.infer<typeof personaUpdateInputSchema>;
