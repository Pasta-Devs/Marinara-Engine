// ──────────────────────────────────────────────
// Connection Zod Schemas
// ──────────────────────────────────────────────
import { z } from "zod";
import {
  DECISION_SOURCES,
  IMAGE_GENERATION_QUALITIES,
  MAX_MODEL_ID_LENGTH,
  MAX_PINNED_MODELS,
} from "../types/connection.js";
import { DECISION_CONNECTION_TIMEOUT_BOUNDS_MS } from "../types/decision.js";
import { TTS_REQUEST_TIMEOUT_MS } from "../types/tts.js";
import { MAX_IMAGE_PROMPT_INSTRUCTIONS_LENGTH } from "../constants/defaults.js";

export const apiProviderSchema = z.enum([
  "openai",
  "openai_chatgpt",
  "anthropic",
  "claude_subscription",
  "grok_subscription",
  "google",
  "google_vertex",
  "mistral",
  "cohere",
  "openrouter",
  "nanogpt",
  "xai",
  "arli",
  "zai",
  "deepseek",
  "custom",
  "image_generation",
  "video_generation",
  "audio",
  "decision",
]);

export const audioGenerationSourceSchema = z.enum(["openai", "elevenlabs", "pockettts", "xai"]);

export const imageGenerationQualitySchema = z.enum(IMAGE_GENERATION_QUALITIES);

/** A model ID as the model picker sends it: trimmed, non-empty and bounded. */
export const connectionModelIdSchema = z.string().trim().min(1).max(MAX_MODEL_ID_LENGTH);

/** Pin or unpin one model on a connection. */
export const connectionModelPinSchema = z.object({
  model: connectionModelIdSchema,
  pinned: z.boolean(),
});

/** Move a Model to another Connection (decision 28). */
/**
 * "Move to connection…": the target Connection, and for a Connection of another service the model it runs there
 * (from its catalog; a custom endpoint takes any id). A move within the same service ignores `model`.
 */
export const connectionMoveSchema = z.object({
  accountId: z.string().trim().min(1).max(200),
  model: connectionModelIdSchema.optional(),
});

/**
 * The picture of a Connection or Model, besides an uploaded `imagePath`: null = the service logo,
 * `brand:<key>` = a bundled provider logo, `letters:<XY>` = one or two typed characters.
 */
export type ConnectionIcon = { kind: "brand"; key: string } | { kind: "letters"; text: string };

const CONNECTION_ICON_BRAND_KEY = /^[a-z0-9][a-z0-9_-]{0,39}$/;
const graphemeSegmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

/** The stored icon value as a choice, or null for the default (also for a malformed value). */
export function parseConnectionIcon(value: unknown): ConnectionIcon | null {
  if (typeof value !== "string") return null;
  if (value.startsWith("brand:")) {
    const key = value.slice(6);
    return CONNECTION_ICON_BRAND_KEY.test(key) ? { kind: "brand", key } : null;
  }
  if (value.startsWith("letters:")) {
    const text = value.slice(8).trim();
    const count = [...graphemeSegmenter.segment(text)].length;
    // No whitespace or control characters inside: a picture tile has room for two visible characters.
    return count >= 1 && count <= 2 && !/[\s\p{Cc}]/u.test(text) ? { kind: "letters", text } : null;
  }
  return null;
}

/** Trust-boundary shape of the icon value; letters are trimmed. */
export const connectionIconSchema = z
  .string()
  .max(64)
  .nullable()
  .transform((value, ctx) => {
    if (value === null) return null;
    const icon = parseConnectionIcon(value);
    if (!icon) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Use brand:<key> or letters:<1-2 characters>" });
      return z.NEVER;
    }
    return icon.kind === "brand" ? `brand:${icon.key}` : `letters:${icon.text}`;
  });

export const connectionImageCaptioningDefaultsSchema = z.object({
  imageCaptioningEnabled: z.boolean().optional(),
  imageCaptioningConnectionId: z.string().trim().min(1).nullable().optional(),
});

export type ConnectionImageCaptioningDefaults = z.infer<typeof connectionImageCaptioningDefaultsSchema>;

export function parseConnectionImageCaptioningDefaults(raw: unknown): ConnectionImageCaptioningDefaults {
  let parsed = raw;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return {};
    }
  }
  const result = connectionImageCaptioningDefaultsSchema.safeParse(parsed);
  return result.success ? result.data : {};
}

export const createConnectionSchema = z.object({
  name: z.string().min(1).max(200),
  provider: apiProviderSchema,
  baseUrl: z.string().url().or(z.literal("")).default(""),
  apiKey: z.string().default(""),
  model: z.string().default(""),
  /** Model IDs shown first in this connection's model picker. */
  pinnedModels: z.array(connectionModelIdSchema).max(MAX_PINNED_MODELS).default([]),
  imagePath: z.string().nullable().default(null),
  /** Picture choice; any change clears `imagePath` unless the same request sets it. */
  icon: connectionIconSchema.default(null),
  maxContext: z.number().int().min(1).default(128000),
  isDefault: z.boolean().default(false),
  fallbackForMain: z.boolean().default(false),
  useForRandom: z.boolean().default(false),
  defaultForAgents: z.boolean().default(false),
  fallbackForAgents: z.boolean().default(false),
  enableCaching: z.boolean().default(false),
  anthropicExtendedCacheTtl: z.boolean().default(false),
  cachingAtDepth: z.number().int().min(0).default(5),
  embeddingModel: z.string().default(""),
  embeddingBaseUrl: z.string().url().or(z.literal("")).default(""),
  embeddingConnectionId: z.string().nullable().default(null),
  openrouterProvider: z.string().nullable().default(null),
  imageGenerationSource: z.string().nullable().default(null),
  comfyuiWorkflow: z.string().nullable().default(null),
  imageService: z.string().nullable().default(null),
  imageEndpointId: z.string().nullable().default(null),
  imagePromptInstructions: z.string().trim().max(MAX_IMAGE_PROMPT_INSTRUCTIONS_LENGTH).nullable().default(null),
  imageGenerationQuality: imageGenerationQualitySchema.default("auto"),
  videoGenerationSource: z.string().nullable().default(null),
  videoService: z.string().nullable().default(null),
  videoPromptInstructions: z.string().trim().max(MAX_IMAGE_PROMPT_INSTRUCTIONS_LENGTH).nullable().default(null),
  audioSource: audioGenerationSourceSchema.nullable().default(null),
  decisionSource: z.enum(DECISION_SOURCES).nullable().default(null),
  credentialsFromConnectionId: z.string().trim().min(1).nullable().default(null),
  accountId: z.string().trim().min(1).nullable().default(null),
  maxStateTokens: z.number().int().min(1).max(30000).nullable().default(null),
  /** Milliseconds; null keeps the default. */
  decisionTimeoutMs: z
    .number()
    .int()
    .min(DECISION_CONNECTION_TIMEOUT_BOUNDS_MS.min)
    .max(DECISION_CONNECTION_TIMEOUT_BOUNDS_MS.max)
    .nullable()
    .default(null),
  /** null = Automatic: the Model's catalog decides whether it reads images. */
  imageInput: z.enum(["reads", "text"]).nullable().default(null),
  audioVoice: z.string().nullable().default(null),
  /** Milliseconds; null keeps the default. */
  audioTimeoutMs: z
    .number()
    .int()
    .min(TTS_REQUEST_TIMEOUT_MS.min)
    .max(TTS_REQUEST_TIMEOUT_MS.max)
    .nullable()
    .default(null),
  audioSoundEffects: z.boolean().default(false),
  audioMusic: z.boolean().default(false),
  promptPresetId: z.string().nullable().default(null),
  maxTokensOverride: z.number().int().min(1).nullable().default(null),
  maxParallelJobs: z.number().int().min(1).max(16).default(1),
  /**
   * Cap on outbound requests per minute to this connection (null = unlimited). Paces bursty
   * callers — notably Professor Mari's tool-call loop — so a rate-limited proxy is not exceeded.
   */
  maxRequestsPerMinute: z.number().int().min(1).max(600).nullable().default(null),
  treatAsLocalEndpoint: z.boolean().default(false),
  claudeFastMode: z.boolean().default(false),
  /**
   * NanoGPT only: a management token with the `usage:read` scope, used solely to
   * read subscription quotas for the usage widget. It cannot authenticate
   * inference endpoints, so it is never used in place of the API key.
   */
  managementToken: z.string().default(""),
  /** NanoGPT, Claude (Subscription) and OpenAI (ChatGPT): show the subscription usage widget for this connection. */
  showUsageWidget: z.boolean().default(false),
  /** Claude (Subscription) and OpenAI (ChatGPT): which plan windows the usage widget shows. */
  showUsageFiveHour: z.boolean().default(true),
  showUsageWeekly: z.boolean().default(true),
});

export type CreateConnectionInput = z.infer<typeof createConnectionSchema>;
