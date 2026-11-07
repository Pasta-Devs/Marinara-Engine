// ──────────────────────────────────────────────
// Theme Zod Schemas
// ──────────────────────────────────────────────
import { z } from "zod";
import { cssByteLimit, cssByteMessage, utf8ByteLength } from "./css-size.js";

/** Thumbnail, fonts and backgrounds ride along with a theme package; together they stay under this. */
export const MAX_THEME_META_BYTES = 6 * 1024 * 1024; // 6 MiB

const dataUrl = (prefix: RegExp) =>
  z
    .string()
    .max(MAX_THEME_META_BYTES)
    .refine((value) => prefix.test(value), { message: "Must be a data: URL" });

/** Appearance settings a theme can suggest. The user picks which to apply when installing. */
export const themeSettingsSchema = z
  .object({
    colorScheme: z.enum(["dark", "light"]).optional(),
    visualStyle: z.enum(["default", "sillytavern", "stage"]).optional(),
    accent: z.string().max(2000).optional(),
    accentLight: z.string().max(2000).optional(),
    background: z.string().max(2000).optional(),
    backgroundLight: z.string().max(2000).optional(),
    fontFamily: z.string().max(200).optional(),
    accentPulse: z.boolean().optional(),
  })
  .strip();

export const themeMetaSchema = z
  .object({
    author: z.string().max(200).optional(),
    version: z.string().max(40).optional(),
    description: z.string().max(2000).optional(),
    /** Which color schemes the theme is designed for. */
    colorScheme: z.enum(["dark", "light", "both"]).optional(),
    thumbnail: dataUrl(/^data:image\/(png|jpeg|webp|gif|avif);base64,/i).optional(),
    settings: themeSettingsSchema.optional(),
    fonts: z
      .array(
        z.object({
          family: z.string().min(1).max(120),
          src: dataUrl(/^data:(font\/[a-z0-9.+-]+|application\/(font-woff2?|x-font-[a-z]+|octet-stream));base64,/i),
          weight: z.string().max(20).optional(),
          style: z.enum(["normal", "italic"]).optional(),
        }),
      )
      .max(12)
      .optional(),
    backgrounds: z
      .array(
        z.object({
          name: z.string().min(1).max(120),
          src: dataUrl(/^data:image\/(png|jpeg|webp|gif|avif);base64,/i),
        }),
      )
      .max(12)
      .optional(),
  })
  .strip()
  .refine((value) => utf8ByteLength(JSON.stringify(value)) <= MAX_THEME_META_BYTES, {
    message: `Thumbnail, fonts and backgrounds must be at most ${MAX_THEME_META_BYTES / 1024 / 1024} MiB together`,
  });

export const createThemeSchema = z.object({
  name: z.string().min(1).max(200),
  css: z.string().default("").refine(cssByteLimit, { message: cssByteMessage }),
  installedAt: z.string().datetime().optional(),
  meta: themeMetaSchema.nullable().optional(),
});

export const updateThemeSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    css: z.string().optional().refine(cssByteLimit, { message: cssByteMessage }),
    meta: themeMetaSchema.nullable().optional(),
  })
  .refine((value) => value.name !== undefined || value.css !== undefined || value.meta !== undefined, {
    message: "Must update at least one field",
  });

export const setActiveThemeSchema = z.object({
  id: z.string().nullable(),
});

export type ThemeSettings = z.infer<typeof themeSettingsSchema>;
export type ThemeMeta = z.infer<typeof themeMetaSchema>;
export type CreateThemeInput = z.infer<typeof createThemeSchema>;
export type UpdateThemeInput = z.infer<typeof updateThemeSchema>;
export type SetActiveThemeInput = z.infer<typeof setActiveThemeSchema>;
