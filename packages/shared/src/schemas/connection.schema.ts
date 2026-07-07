// ──────────────────────────────────────────────
// Connection Zod Schemas
// ──────────────────────────────────────────────
import { z } from "zod";

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
  "custom",
  "image_generation",
  "video_generation",
]);

export const createConnectionSchema = z.object({
  name: z.string().min(1).max(200),
  provider: apiProviderSchema,
  baseUrl: z.string().url().or(z.literal("")).default(""),
  apiKey: z.string().default(""),
  model: z.string().default(""),
  imagePath: z.string().nullable().default(null),
  maxContext: z.number().int().min(1).default(128000),
  isDefault: z.boolean().default(false),
  useForRandom: z.boolean().default(false),
  defaultForAgents: z.boolean().default(false),
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
  videoGenerationSource: z.string().nullable().default(null),
  videoService: z.string().nullable().default(null),
  promptPresetId: z.string().nullable().default(null),
  maxTokensOverride: z.number().int().min(1).nullable().default(null),
  maxParallelJobs: z.number().int().min(1).max(16).default(1),
  treatAsLocalEndpoint: z.boolean().default(false),
  claudeFastMode: z.boolean().default(false),
});

export type CreateConnectionInput = z.infer<typeof createConnectionSchema>;
