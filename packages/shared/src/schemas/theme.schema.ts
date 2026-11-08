// ──────────────────────────────────────────────
// Theme Zod Schemas
// ──────────────────────────────────────────────
import { z } from "zod";
import { cssByteLimit, cssByteMessage, utf8ByteLength } from "./css-size.js";

/** Images, thumbnail, fonts and backgrounds ride along with a theme package; together they stay under this. */
export const MAX_THEME_META_BYTES = 6 * 1024 * 1024; // 6 MiB

/** One message template (per role) stays under this many characters. */
export const MAX_THEME_TEMPLATE_CHARS = 4000;

const dataUrl = (prefix: RegExp, message = "Must be a data: URL") =>
  z
    .string()
    .max(MAX_THEME_META_BYTES)
    .refine((value) => prefix.test(value), { message });

/** Appearance settings a theme can suggest. The user picks which to apply when installing. */
export const themeSettingsSchema = z
  .object({
    /** "time" = Follow time of day (dayStart/nightStart, "HH:MM"), "system" = follow the device. */
    colorScheme: z.enum(["dark", "light", "time", "system"]).optional(),
    dayStart: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
      .optional(),
    nightStart: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
      .optional(),
    visualStyle: z.enum(["default", "sillytavern", "stage"]).optional(),
    accent: z.string().max(2000).optional(),
    accentLight: z.string().max(2000).optional(),
    background: z.string().max(2000).optional(),
    backgroundLight: z.string().max(2000).optional(),
    fontFamily: z.string().max(200).optional(),
    accentPulse: z.boolean().optional(),
  })
  .strip();

export const themeFontSchema = z.object({
  family: z.string().min(1).max(120),
  src: dataUrl(
    /^data:(font\/[a-z0-9.+-]+|application\/(font-woff2?|x-font-[a-z]+|octet-stream));base64,/i,
    "Fonts must be WOFF2, WOFF, TTF or OTF data: URLs",
  ),
  weight: z.string().max(20).optional(),
  style: z.enum(["normal", "italic"]).optional(),
});

/** A picture the theme's CSS uses as `url("theme:<name>")`. */
export const themeImageSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9][a-z0-9._-]*$/i, "Image names use letters, digits, dots, dashes and underscores"),
  src: dataUrl(
    /^data:image\/(png|jpeg|webp|gif|avif|svg\+xml)[;,]/i,
    "Images must be PNG, JPEG, WebP, GIF, AVIF or SVG data: URLs",
  ),
});

export const themeBackgroundSchema = z.object({
  name: z.string().min(1).max(120),
  src: dataUrl(
    /^data:image\/(png|jpeg|webp|gif|avif);base64,/i,
    "Backgrounds must be PNG, JPEG, WebP, GIF or AVIF data: URLs (SVG isn't allowed)",
  ),
});

export const themeMetaSchema = z
  .object({
    author: z.string().max(200).optional(),
    version: z.string().max(40).optional(),
    description: z.string().max(2000).optional(),
    /** Which color schemes the theme is designed for. */
    colorScheme: z.enum(["dark", "light", "both"]).optional(),
    thumbnail: dataUrl(
      /^data:image\/(png|jpeg|webp|gif|avif);base64,/i,
      "The thumbnail must be a PNG, JPEG, WebP, GIF or AVIF data: URL",
    ).optional(),
    settings: themeSettingsSchema.optional(),
    fonts: z.array(themeFontSchema).max(12).optional(),
    /** Message template slot (theming round 2, batch 7): sanitised HTML shown in every message's
     *  `data-mari-part="message-extra"` box. Only rendered when the user allows themes with HTML. */
    templates: z
      .object({
        message: z.string().max(MAX_THEME_TEMPLATE_CHARS).optional(),
        assistant: z.string().max(MAX_THEME_TEMPLATE_CHARS).optional(),
        user: z.string().max(MAX_THEME_TEMPLATE_CHARS).optional(),
        narrator: z.string().max(MAX_THEME_TEMPLATE_CHARS).optional(),
      })
      .strip()
      .optional(),
    /** Pictures the theme's CSS uses as `url("theme:<name>")` (theming round 3). They count in the
     *  6 MiB package budget, not the 256 KiB CSS budget. */
    images: z.array(themeImageSchema).max(64).optional(),
    backgrounds: z.array(themeBackgroundSchema).max(12).optional(),
  })
  .strip()
  .refine((value) => utf8ByteLength(JSON.stringify(value)) <= MAX_THEME_META_BYTES, {
    message: `Images, thumbnail, fonts and backgrounds must be at most ${MAX_THEME_META_BYTES / 1024 / 1024} MiB together`,
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
export type ThemeTemplates = NonNullable<ThemeMeta["templates"]>;
export type CreateThemeInput = z.infer<typeof createThemeSchema>;
export type UpdateThemeInput = z.infer<typeof updateThemeSchema>;
export type SetActiveThemeInput = z.infer<typeof setActiveThemeSchema>;
