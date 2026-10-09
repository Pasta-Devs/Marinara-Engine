// ──────────────────────────────────────────────
// Routes: Speech to Text server settings
// ──────────────────────────────────────────────
import type { FastifyInstance } from "fastify";
import { speechToTextConfigSchema } from "@marinara-engine/shared";
import {
  createSilentTestClip,
  loadSpeechToTextConfig,
  readMaskedSpeechToTextConfig,
  saveSpeechToTextConfig,
  transcribeWithSpeechToTextServer,
} from "../services/speech-to-text.service.js";

const TEST_TIMEOUT_MS = 30_000;

export async function speechToTextRoutes(app: FastifyInstance) {
  /** GET /api/speech-to-text/config: the saved settings, with the API key masked. */
  app.get("/config", async () => readMaskedSpeechToTextConfig(app.db));

  /** PUT /api/speech-to-text/config: sending the masked key back keeps the saved one. */
  app.put("/config", async (req, reply) => {
    await saveSpeechToTextConfig(app.db, speechToTextConfigSchema.parse(req.body));
    return reply.status(204).send();
  });

  /** POST /api/speech-to-text/test: send a short silent clip to the saved server and report whether it answered. */
  app.post("/test", async (_req, reply) => {
    const config = await loadSpeechToTextConfig(app.db);
    if (!config.baseUrl) return reply.status(400).send({ error: "Enter a server URL first." });
    try {
      await transcribeWithSpeechToTextServer(config, createSilentTestClip(), {
        filename: "marinara-test.wav",
        mimeType: "audio/wav",
        timeoutMs: TEST_TIMEOUT_MS,
      });
      return { ok: true };
    } catch (error) {
      return reply.status(502).send({ error: error instanceof Error ? error.message : "The test failed." });
    }
  });
}
