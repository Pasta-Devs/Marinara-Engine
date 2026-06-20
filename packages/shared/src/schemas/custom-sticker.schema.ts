// ──────────────────────────────────────────────
// Custom Sticker Zod Schemas
// ──────────────────────────────────────────────
import { z } from "zod";

/** Custom sticker names are slugs used in `sticker:name:` tokens — lowercase letters, digits, underscores. */
export const CUSTOM_STICKER_NAME_PATTERN = /^[a-z0-9_]{1,32}$/;
/** Custom stickers are dimension-gated like gallery-tagged stickers (max 512x512). */
export const CUSTOM_STICKER_MAX_DIMENSION = 512;

export const customStickerNameSchema = z
  .string()
  .regex(CUSTOM_STICKER_NAME_PATTERN, "Name must be 1-32 lowercase letters, numbers, or underscores.");

export const createCustomStickerSchema = z.object({
  name: customStickerNameSchema,
  filePath: z.string().min(1),
  width: z.number().int().positive().nullable().default(null),
  height: z.number().int().positive().nullable().default(null),
});

export const updateCustomStickerSchema = z.object({
  name: customStickerNameSchema,
});

export type CreateCustomStickerInput = z.infer<typeof createCustomStickerSchema>;
export type UpdateCustomStickerInput = z.infer<typeof updateCustomStickerSchema>;
