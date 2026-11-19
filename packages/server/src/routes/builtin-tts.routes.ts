/**
 * The built-in voice models' API: status, download, choose, settings, load, unload, remove, a preview line, and
 * saved voice blends.
 * Speaking for the Voice job goes through /api/tts like every other source (source "builtin").
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  BUILTIN_TTS_LATIN_LANGUAGES,
  BUILTIN_TTS_MODELS,
  BUILTIN_TTS_SUPERTONIC_LANGUAGES,
  type BuiltinTtsModelId,
} from "@marinara-engine/shared";
import { requirePrivilegedAccess } from "../middleware/privileged-gate.js";
import { STATUS_POLL_RATE_LIMIT, UTILITY_SIDECAR_RATE_LIMIT } from "../middleware/rate-limit.js";
import { builtinTtsService } from "../services/sidecar/builtin-tts.service.js";

const rateLimit = { config: { rateLimit: UTILITY_SIDECAR_RATE_LIMIT } };
const modelBody = z.object({
  modelId: z.enum(BUILTIN_TTS_MODELS.map((model) => model.id) as [BuiltinTtsModelId]),
});
/** `use`: the person picked this model, so it becomes the one in use once it is downloaded. */
const downloadBody = modelBody.extend({ use: z.boolean().optional() });
const PREVIEW_MAX_CHARS = 300;

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function builtinTtsRoutes(app: FastifyInstance) {
  // The page polls this once a second during a download, so the status-poll budget.
  app.get("/status", { config: { rateLimit: STATUS_POLL_RATE_LIMIT } }, async () => builtinTtsService.getStatus());

  app.post("/download", rateLimit, async (req, reply) => {
    if (!requirePrivilegedAccess(req, reply, { feature: "Built-in voice model download" })) return;
    const { modelId, use } = downloadBody.parse(req.body);
    try {
      builtinTtsService.startDownload(modelId, { use });
    } catch (error) {
      return reply.status(409).send({ error: message(error) });
    }
    return builtinTtsService.getStatus();
  });

  app.post("/download/cancel", rateLimit, async (req, reply) => {
    if (!requirePrivilegedAccess(req, reply, { feature: "Built-in voice model download" })) return;
    builtinTtsService.cancelDownload();
    return builtinTtsService.getStatus();
  });

  /** Makes an installed model the one the Voice job speaks with. */
  app.post("/use", rateLimit, async (req, reply) => {
    if (!requirePrivilegedAccess(req, reply, { feature: "Built-in voice model selection" })) return;
    const { modelId } = modelBody.parse(req.body);
    try {
      await builtinTtsService.useModel(modelId);
      return builtinTtsService.getStatus();
    } catch (error) {
      return reply.status(400).send({ error: message(error) });
    }
  });

  /** Supertonic's reading language. */
  app.patch("/settings", rateLimit, async (req, reply) => {
    if (!requirePrivilegedAccess(req, reply, { feature: "Built-in voice model settings" })) return;
    const body = z
      .object({
        language: z.enum(["auto", ...BUILTIN_TTS_SUPERTONIC_LANGUAGES]).optional(),
        latinLanguage: z.enum(BUILTIN_TTS_LATIN_LANGUAGES).optional(),
      })
      .parse(req.body);
    try {
      builtinTtsService.setSettings(body);
      return builtinTtsService.getStatus();
    } catch (error) {
      return reply.status(400).send({ error: message(error) });
    }
  });

  app.post("/load", rateLimit, async (req, reply) => {
    if (!requirePrivilegedAccess(req, reply, { feature: "Built-in voice model load" })) return;
    try {
      await builtinTtsService.ensureLoaded();
      return builtinTtsService.getStatus();
    } catch (error) {
      return reply.status(400).send({ error: message(error) });
    }
  });

  app.post("/unload", rateLimit, async (req, reply) => {
    if (!requirePrivilegedAccess(req, reply, { feature: "Built-in voice model unload" })) return;
    await builtinTtsService.unload();
    return builtinTtsService.getStatus();
  });

  app.post("/remove", rateLimit, async (req, reply) => {
    if (!requirePrivilegedAccess(req, reply, { feature: "Built-in voice model removal" })) return;
    const { modelId } = modelBody.parse(req.body);
    await builtinTtsService.remove(modelId);
    return builtinTtsService.getStatus();
  });

  /** One short line in a voice or blend, so a voice can be heard before it is picked. */
  app.post("/preview", rateLimit, async (req, reply) => {
    const body = z
      .object({
        voice: z.string().min(1).max(200),
        text: z.string().min(1).max(PREVIEW_MAX_CHARS),
        speed: z.number().min(0.5).max(2).optional(),
      })
      .parse(req.body);
    try {
      const audio = await builtinTtsService.speak(body.text, body.voice, body.speed ?? 1);
      return reply.header("Content-Type", "audio/wav").header("Cache-Control", "no-store").send(audio);
    } catch (error) {
      return reply.status(400).send({ error: message(error) });
    }
  });

  app.post("/blends", rateLimit, async (req, reply) => {
    if (!requirePrivilegedAccess(req, reply, { feature: "Built-in voice blends" })) return;
    const body = z.object({ name: z.string().min(1).max(60), voice: z.string().min(1).max(200) }).parse(req.body);
    try {
      builtinTtsService.saveBlend(body.name, body.voice);
      return builtinTtsService.getStatus();
    } catch (error) {
      return reply.status(400).send({ error: message(error) });
    }
  });

  app.post("/blends/delete", rateLimit, async (req, reply) => {
    if (!requirePrivilegedAccess(req, reply, { feature: "Built-in voice blends" })) return;
    const body = z.object({ voice: z.string().min(1).max(200) }).parse(req.body);
    builtinTtsService.deleteBlend(body.voice);
    return builtinTtsService.getStatus();
  });
}
