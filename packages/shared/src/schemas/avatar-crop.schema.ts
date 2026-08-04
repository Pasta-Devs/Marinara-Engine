// ──────────────────────────────────────────────
// Avatar Crop Zod Schema
// ──────────────────────────────────────────────
import { z } from "zod";

/** Strict request-schema union for avatar crops: the current source-rectangle
 *  shape or the legacy zoom+offset shape. Both variants reject unknown keys
 *  (`.strict()`), and every numeric field must be finite with positive
 *  dimensions inside normalized source bounds, so malformed shapes are
 *  rejected at the request boundary. */
export const avatarCropSchema = z.union([
  z
    .object({
      srcX: z.number().finite().min(0),
      srcY: z.number().finite().min(0),
      srcWidth: z.number().finite().positive(),
      srcHeight: z.number().finite().positive(),
    })
    .strict()
    .refine((crop) => crop.srcX + crop.srcWidth <= 1.001 && crop.srcY + crop.srcHeight <= 1.001, {
      message: "Avatar crop must stay inside the source image.",
    }),
  z
    .object({
      zoom: z.number().finite().positive(),
      offsetX: z.number().finite(),
      offsetY: z.number().finite(),
      fullImage: z.boolean().optional(),
    })
    .strict(),
]);
