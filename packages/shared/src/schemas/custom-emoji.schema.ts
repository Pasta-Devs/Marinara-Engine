// ──────────────────────────────────────────────
// Custom Emoji Zod Schemas
// ──────────────────────────────────────────────
import { z } from "zod";

/** Custom emoji names are slugs used in `:name:` tokens — lowercase letters, digits, underscores. */
export const CUSTOM_EMOJI_NAME_PATTERN = /^[a-z0-9_]{1,32}$/;
/** Custom emojis are dimension-gated like gallery-tagged emojis (max 256x256). */
export const CUSTOM_EMOJI_MAX_DIMENSION = 256;

export const customEmojiNameSchema = z
  .string()
  .regex(CUSTOM_EMOJI_NAME_PATTERN, "Name must be 1-32 lowercase letters, numbers, or underscores.");

export const createCustomEmojiSchema = z.object({
  name: customEmojiNameSchema,
  filePath: z.string().min(1),
  width: z.number().int().positive().nullable().default(null),
  height: z.number().int().positive().nullable().default(null),
  description: z.string().nullable().optional(),
});

export const updateCustomEmojiSchema = z.object({
  name: customEmojiNameSchema,
});

export type CreateCustomEmojiInput = z.infer<typeof createCustomEmojiSchema>;
export type UpdateCustomEmojiInput = z.infer<typeof updateCustomEmojiSchema>;

// ──────────────────────────────────────────────
// Selection preferences — how the model is told which custom emojis it may use.
// Stored per-chat in chat metadata; resolved with normalizeCustomEmojiSelection.
// ──────────────────────────────────────────────
export const CUSTOM_EMOJI_SELECTION_MODES = ["random", "semantic", "tool-call"] as const;
export type CustomEmojiSelectionMode = (typeof CUSTOM_EMOJI_SELECTION_MODES)[number];

export interface CustomEmojiSelectionPrefs {
  /** How the advertised subset is chosen when there are more emojis than maxCount. */
  mode: CustomEmojiSelectionMode;
  /** Max custom emojis advertised to the model per responder pool. */
  maxCount: number;
  /** Connection used for the tool-call selection mode (null = none). */
  toolConnectionId: string | null;
  /**
   * Let a model that reads images see custom emojis and stickers as a picture sheet: "off", the
   * newest message's, or those in the last `visionRecentCount` messages.
   */
  visionMode: CustomEmojiVisionMode;
  /** Messages scanned when `visionMode` is "recent". */
  visionRecentCount: number;
  /** How many of this turn's offered emojis and stickers also go on the sheet, in offered order (0 = none). */
  visionOfferedCount: number;
  /** Use the pictures' descriptions to choose which ones are offered (no prompt cost). */
  useDescriptions: boolean;
  /** Also show each offered one's description next to its name in the prompt (costs input tokens). */
  showDescriptions: boolean;
}

export const CUSTOM_EMOJI_VISION_MODES = ["off", "last", "recent"] as const;
export type CustomEmojiVisionMode = (typeof CUSTOM_EMOJI_VISION_MODES)[number];
export const CUSTOM_EMOJI_VISION_RECENT_MIN = 2;
export const CUSTOM_EMOJI_VISION_RECENT_MAX = 20;
export const CUSTOM_EMOJI_VISION_OFFERED_MAX = 30;

export const CUSTOM_EMOJI_SELECTION_MIN_COUNT = 1;
export const CUSTOM_EMOJI_SELECTION_MAX_COUNT = 100;
export const CUSTOM_EMOJI_SELECTION_DEFAULTS: CustomEmojiSelectionPrefs = {
  mode: "semantic",
  maxCount: 20,
  toolConnectionId: null,
  visionMode: "off",
  visionRecentCount: 6,
  visionOfferedCount: 6,
  useDescriptions: true,
  showDescriptions: false,
};

function clampWhole(value: unknown, min: number, max: number, fallback: number): number {
  const whole = typeof value === "number" && Number.isFinite(value) ? Math.floor(value) : fallback;
  return Math.min(max, Math.max(min, whole));
}

/** Coerce stored/partial/unknown chat metadata into valid selection prefs (fills defaults, clamps count). */
export function normalizeCustomEmojiSelection(raw: unknown): CustomEmojiSelectionPrefs {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const mode = (CUSTOM_EMOJI_SELECTION_MODES as readonly string[]).includes(obj.mode as string)
    ? (obj.mode as CustomEmojiSelectionMode)
    : CUSTOM_EMOJI_SELECTION_DEFAULTS.mode;
  const rawMax =
    typeof obj.maxCount === "number" && Number.isFinite(obj.maxCount)
      ? Math.floor(obj.maxCount)
      : CUSTOM_EMOJI_SELECTION_DEFAULTS.maxCount;
  const maxCount = Math.min(CUSTOM_EMOJI_SELECTION_MAX_COUNT, Math.max(CUSTOM_EMOJI_SELECTION_MIN_COUNT, rawMax));
  const toolConnectionId =
    typeof obj.toolConnectionId === "string" && obj.toolConnectionId.trim() ? obj.toolConnectionId.trim() : null;
  const visionMode = (CUSTOM_EMOJI_VISION_MODES as readonly string[]).includes(obj.visionMode as string)
    ? (obj.visionMode as CustomEmojiVisionMode)
    : CUSTOM_EMOJI_SELECTION_DEFAULTS.visionMode;
  const visionRecentCount = clampWhole(
    obj.visionRecentCount,
    CUSTOM_EMOJI_VISION_RECENT_MIN,
    CUSTOM_EMOJI_VISION_RECENT_MAX,
    CUSTOM_EMOJI_SELECTION_DEFAULTS.visionRecentCount,
  );
  const visionOfferedCount = clampWhole(
    obj.visionOfferedCount,
    0,
    CUSTOM_EMOJI_VISION_OFFERED_MAX,
    CUSTOM_EMOJI_SELECTION_DEFAULTS.visionOfferedCount,
  );
  const useDescriptions =
    typeof obj.useDescriptions === "boolean" ? obj.useDescriptions : CUSTOM_EMOJI_SELECTION_DEFAULTS.useDescriptions;
  const showDescriptions =
    typeof obj.showDescriptions === "boolean" ? obj.showDescriptions : CUSTOM_EMOJI_SELECTION_DEFAULTS.showDescriptions;
  return {
    mode,
    maxCount,
    toolConnectionId,
    visionMode,
    visionRecentCount,
    visionOfferedCount,
    useDescriptions,
    showDescriptions,
  };
}
