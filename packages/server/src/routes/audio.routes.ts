import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { logger } from "../lib/logger.js";
import { AudioGenerationProviderError } from "../services/audio/generative-audio-providers.js";
import {
  AudioGenerationConfigurationError,
  generateAudioAsset,
  resolveGenerativeAudioReadiness,
} from "../services/audio/generative-audio.service.js";

const key = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .regex(/^[a-z0-9][a-z0-9_-]*$/);
const generateSchema = z.object({
  kind: z.enum(["music", "sfx"]),
  prompt: z.string().trim().min(1).max(4_100),
  audioConnectionId: z.string().trim().max(200).nullable().optional(),
  debugMode: z.boolean().default(false),
  context: z
    .object({
      scope: key.max(80),
      key,
      lengthMs: z.number().int().min(10_000).max(300_000).optional(),
    })
    .optional(),
});
// Only diagnoses written by this host become localized UI classes; raw detail stays out of the panel.
const audioFailureCodes = [
  [/MP3 audio|MP3 audio only|size limit|no supported inline audio/, "invalid_audio"],
  [/callback URL/, "invalid_callback"],
  [
    /length must|positive number of milliseconds|exceeds \d+ characters|custom .+ endpoint|endpoint must be a path|audio API base/,
    "invalid_input",
  ],
  [/SunoAPI (?:did not accept|could not look up|completed|audio task|audio download)/, "task_failed"],
] as const;

export async function audioRoutes(app: FastifyInstance) {
  app.get("/config", async (req, reply) => {
    const { audioConnectionId } = z
      .object({ audioConnectionId: z.string().trim().max(200).optional() })
      .parse(req.query);
    try {
      return await resolveGenerativeAudioReadiness(app.db, audioConnectionId);
    } catch (error) {
      if (!(error instanceof AudioGenerationConfigurationError)) throw error;
      if (error.statusCode === 409) return reply.status(409).send({ error: error.message });
      return { connectionId: null, configured: false, music: false, soundEffects: false, source: null };
    }
  });

  app.post("/generate", async (req, reply) => {
    const input = generateSchema.parse(req.body);
    if ((input.kind === "music") !== Boolean(input.context)) {
      return reply.status(400).send({
        error:
          input.kind === "music"
            ? "Music generation requires a context scope and key"
            : "Context tracks are music only",
      });
    }
    try {
      return await generateAudioAsset(app.db, input);
    } catch (error) {
      if (error instanceof AudioGenerationConfigurationError)
        return reply.status(error.statusCode).send({ error: error.message });
      logger.error(error, "Audio generation failed");
      const failureCode =
        error instanceof Error ? audioFailureCodes.find(([pattern]) => pattern.test(error.message))?.[1] : undefined;
      return reply.status(502).send({
        error: "Audio generation failed",
        detail: error instanceof Error ? error.message : "Unknown provider error",
        ...(error instanceof AudioGenerationProviderError
          ? { providerStatus: error.providerStatus, providerCode: error.providerCode, reason: error.reason }
          : { failureCode }),
      });
    }
  });
}
