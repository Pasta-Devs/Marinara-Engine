import { z } from "zod";

/** Built-in instructions for describing image attachments. Used when a chat has no custom captioning prompt. */
export const DEFAULT_IMAGE_CAPTIONING_PROMPT =
  "You describe image attachments for a downstream chat model that may not support vision. " +
  "Write a faithful, concise description of the visible content, including readable text, subjects, setting, style, and any details important for conversation continuity. " +
  "Do not answer the chat and do not add speculation beyond what is visible.";

/** Built-in request sent with each image. `{{filename}}` becomes the attachment's name. */
export const DEFAULT_IMAGE_CAPTIONING_REQUEST =
  'Describe this image attachment named "{{filename}}" for use inside a chat prompt. Return only the description.';

export const DEFAULT_IMAGE_CAPTIONING_MAX_TOKENS = 700;
export const DEFAULT_IMAGE_CAPTIONING_TEMPERATURE = 0.2;

/** Engine-wide Image reading settings (Library › Connections › Image reading). Null fields use the built-in value. */
export const IMAGE_READING_SETTINGS_KEY = "image-reading-settings";

export const imageReadingSettingsSchema = z.object({
  prompt: z.string().max(20_000).nullable(),
  request: z.string().max(4_000).nullable(),
  maxTokens: z.number().int().min(64).max(32_768).nullable(),
  temperature: z.number().min(0).max(2).nullable(),
});

export type ImageReadingSettings = z.infer<typeof imageReadingSettingsSchema>;

export const DEFAULT_IMAGE_READING_SETTINGS: ImageReadingSettings = {
  prompt: null,
  request: null,
  maxTokens: null,
  temperature: null,
};

/** Stored settings with unreadable or blank fields dropped back to null. */
export function parseImageReadingSettings(raw: unknown): ImageReadingSettings {
  let parsed = raw;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return DEFAULT_IMAGE_READING_SETTINGS;
    }
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return DEFAULT_IMAGE_READING_SETTINGS;
  const source = parsed as Record<string, unknown>;
  const field = <K extends keyof ImageReadingSettings>(key: K): ImageReadingSettings[K] => {
    const result = imageReadingSettingsSchema.shape[key].safeParse(source[key]);
    if (!result.success) return null;
    const value = result.data;
    return (typeof value === "string" && !value.trim() ? null : value) as ImageReadingSettings[K];
  };
  return {
    prompt: field("prompt"),
    request: field("request"),
    maxTokens: field("maxTokens"),
    temperature: field("temperature"),
  };
}
