import { z } from "zod";

// Values shown in seconds; the existing backend variables retain their units.
export const REQUEST_TIMEOUTS = {
  chat: { env: "CHAT_GENERATION_TIMEOUT_MS", unit: 1000, defaultSeconds: 300, maxSeconds: 3600 },
  agents: { env: "AGENT_CALL_TIMEOUT_MS", unit: 1000, defaultSeconds: 300, maxSeconds: 3600 },
  imagePrompt: { env: "GAME_DYNAMIC_IMAGE_PROMPT_TIMEOUT_MS", unit: 1000, defaultSeconds: 45, maxSeconds: 3600 },
  images: { env: "IMAGE_GEN_TIMEOUT_MS", unit: 1000, defaultSeconds: 1800, maxSeconds: 86400 },
  video: { env: "VIDEO_GEN_TIMEOUT_MS", unit: 1000, defaultSeconds: 1800, maxSeconds: 86400 },
  comfyui: { env: "COMFYUI_GEN_TIMEOUT", unit: 1, defaultSeconds: 2400, maxSeconds: 86400 },
  embeddings: { env: "EMBEDDING_TIMEOUT_MS", unit: 1000, defaultSeconds: 300, maxSeconds: 86400 },
} as const;
export type RequestTimeoutKey = keyof typeof REQUEST_TIMEOUTS;
export type RequestTimeoutSettings = Record<RequestTimeoutKey, number>;
export const requestTimeoutSettingsSchema = z
  .object(
    Object.fromEntries(
      Object.entries(REQUEST_TIMEOUTS).map(([key, spec]) => [key, z.number().int().min(10).max(spec.maxSeconds)]),
    ) as Record<RequestTimeoutKey, z.ZodNumber>,
  )
  .strict();
