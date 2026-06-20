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
}

export const CUSTOM_EMOJI_SELECTION_MIN_COUNT = 1;
export const CUSTOM_EMOJI_SELECTION_MAX_COUNT = 100;
export const CUSTOM_EMOJI_SELECTION_DEFAULTS: CustomEmojiSelectionPrefs = {
  mode: "semantic",
  maxCount: 20,
  toolConnectionId: null,
};

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
  return { mode, maxCount, toolConnectionId };
}
