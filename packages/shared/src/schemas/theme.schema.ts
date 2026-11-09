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

/**
 * A colour or gradient a theme may suggest for the accent or background (security audit,
 * 2026-11-09). These land in style properties directly, past the theme CSS sanitiser, so a value
 * like `url(https://tracker.example/x.png)` would load from the network: anything that can point at
 * a resource, or break out of the value, is refused.
 */
export const SAFE_CSS_PAINT =
  /^(?![\s\S]*(?:url\s*\(|image(?:-set)?\s*\(|src\s*\(|cross-fade|element\s*\(|paint\s*\(|attr\s*\(|expression|javascript|[\\;{}<>@!]))[\s\S]*$/i;
const cssPaint = z.string().max(2000).regex(SAFE_CSS_PAINT, "Colours must be plain colours or gradients");

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
    accent: cssPaint.optional(),
    accentLight: cssPaint.optional(),
    background: cssPaint.optional(),
    backgroundLight: cssPaint.optional(),
    fontFamily: z
      .string()
      .max(200)
      .regex(/^[^\\;{}<>()@!]*$/, "A font name can't hold CSS")
      .optional(),
    accentPulse: z.boolean().optional(),
    /** Appearance > Display Size (px). Offered unticked: it's the user's call. */
    fontSize: z
      .union([
        z.literal(12),
        z.literal(14),
        z.literal(16),
        z.literal(17),
        z.literal(19),
        z.literal(22),
        z.literal(26),
        z.literal(30),
        z.literal(34),
      ])
      .optional(),
    /** Appearance > Reduce motion. Offered unticked. */
    reduceMotion: z.boolean().optional(),
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
  /** The font's licence, e.g. "OFL-1.1" (the app ships that text; theming round 5). */
  license: z.string().max(60).optional(),
  /** Its copyright holder or designer, as the licence asks to be kept with the font. */
  credit: z.string().max(300).optional(),
});

/** One line of a theme's credits (theming round 5): who made a part of it and on what terms. */
export const themeCreditSchema = z.object({
  /** The part: "Backdrops", "Avatars", "Frames and icons". */
  what: z.string().min(1).max(120),
  by: z.string().min(1).max(300),
  license: z.string().max(60).optional(),
  url: z
    .string()
    .max(500)
    .regex(/^https:\/\//i, "Credit links must start with https://")
    .optional(),
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
    /** Who made the theme's pictures, frames and fonts (theming round 5), shown in the theme list. */
    credits: z.array(themeCreditSchema).max(24).optional(),
    /** The theme's own licence, e.g. "CC BY 4.0". */
    license: z.string().max(60).optional(),
    /** Short labels for the theme list, e.g. "High legibility", "No motion". */
    labels: z.array(z.string().min(1).max(40)).max(4).optional(),
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
export type ThemeCredit = z.infer<typeof themeCreditSchema>;
export type ThemeTemplates = NonNullable<ThemeMeta["templates"]>;
export type CreateThemeInput = z.infer<typeof createThemeSchema>;
export type UpdateThemeInput = z.infer<typeof updateThemeSchema>;
export type SetActiveThemeInput = z.infer<typeof setActiveThemeSchema>;
