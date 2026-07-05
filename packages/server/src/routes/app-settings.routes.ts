// ──────────────────────────────────────────────
// Routes: Synced App Settings (key/value)
// ──────────────────────────────────────────────
import type { FastifyInstance } from "fastify";
import { VIDEO_GENERATION_SETTINGS_KEY, appSettingsUpdateSchema } from "@marinara-engine/shared";
import { createAppSettingsStorage } from "../services/storage/app-settings.storage.js";

const ALLOWED_KEYS = new Set(["ui", VIDEO_GENERATION_SETTINGS_KEY]);

export async function appSettingsRoutes(app: FastifyInstance) {
  const storage = createAppSettingsStorage(app.db);

  app.get<{ Params: { key: string } }>("/:key", async (req, reply) => {
    if (!ALLOWED_KEYS.has(req.params.key)) {
      return reply.status(404).send({ error: "Unknown settings key" });
    }
    const value = await storage.get(req.params.key);
    return { value };
  });

  app.put<{ Params: { key: string } }>("/:key", async (req, reply) => {
    if (!ALLOWED_KEYS.has(req.params.key)) {
      return reply.status(404).send({ error: "Unknown settings key" });
    }
    const input = appSettingsUpdateSchema.parse(req.body);
    await storage.set(req.params.key, input.value);
    return { value: input.value };
  });
}
