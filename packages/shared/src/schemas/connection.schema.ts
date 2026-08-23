// ──────────────────────────────────────────────
// Connection Zod Schemas
// ──────────────────────────────────────────────
import { z } from "zod";
import { IMAGE_GENERATION_QUALITIES } from "../types/connection.js";
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
  "custom",
  "image_generation",
  "video_generation",
  "audio",
]);

export const audioGenerationSourceSchema = z.enum(["openai", "elevenlabs", "pockettts", "xai"]);

export const imageGenerationQualitySchema = z.enum(IMAGE_GENERATION_QUALITIES);

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
  imagePath: z.string().nullable().default(null),
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
  audioSource: audioGenerationSourceSchema.nullable().default(null),
  audioVoice: z.string().nullable().default(null),
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
});

export type CreateConnectionInput = z.infer<typeof createConnectionSchema>;
