// ──────────────────────────────────────────────
// Routes: Synced App Settings (key/value)
// ──────────────────────────────────────────────
import type { FastifyInstance } from "fastify";
import {
  CHAT_SUMMARY_PROMPT_SETTINGS_KEY,
  CUSTOM_GENERATION_PARAMETERS_SETTINGS_KEY,
  EMPTY_IMPERSONATE_PROMPT_TEMPLATE_CATALOG,
  IMPERSONATE_PROMPT_TEMPLATES_SETTINGS_KEY,
  STORAGE_MIGRATION_NOTICE_SETTINGS_KEY,
  VIDEO_GENERATION_SETTINGS_KEY,
  appSettingsUpdateSchema,
  impersonatePromptTemplateCatalogSchema,
} from "@marinara-engine/shared";
import { logger } from "../lib/logger.js";
import { createAppSettingsStorage } from "../services/storage/app-settings.storage.js";

const ALLOWED_KEYS = new Set([
  "ui",
  CHAT_SUMMARY_PROMPT_SETTINGS_KEY,
  CUSTOM_GENERATION_PARAMETERS_SETTINGS_KEY,
  STORAGE_MIGRATION_NOTICE_SETTINGS_KEY,
  VIDEO_GENERATION_SETTINGS_KEY,
]);

export async function appSettingsRoutes(app: FastifyInstance) {
  const storage = createAppSettingsStorage(app.db);

  app.get(`/${IMPERSONATE_PROMPT_TEMPLATES_SETTINGS_KEY}`, async () => {
    const value = await storage.get(IMPERSONATE_PROMPT_TEMPLATES_SETTINGS_KEY);
    if (!value) return EMPTY_IMPERSONATE_PROMPT_TEMPLATE_CATALOG;
    try {
      return impersonatePromptTemplateCatalogSchema.parse(JSON.parse(value));
    } catch (error) {
      logger.warn(error, "Ignoring invalid stored impersonate prompt template catalog");
      return EMPTY_IMPERSONATE_PROMPT_TEMPLATE_CATALOG;
    }
  });

  app.put(`/${IMPERSONATE_PROMPT_TEMPLATES_SETTINGS_KEY}`, async (req) => {
    const catalog = impersonatePromptTemplateCatalogSchema.parse(req.body);
    await storage.set(IMPERSONATE_PROMPT_TEMPLATES_SETTINGS_KEY, JSON.stringify(catalog));
    return catalog;
  });

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
