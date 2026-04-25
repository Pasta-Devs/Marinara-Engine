// ──────────────────────────────────────────────
// Routes: Oracle — Web Search Configuration & Test
// ──────────────────────────────────────────────
import type { FastifyInstance } from "fastify";
import {
  oracleConfigSchema,
  ORACLE_API_KEY_MASK,
  ORACLE_SETTINGS_KEY,
  type OracleTestResponse,
} from "@marinara-engine/shared";
import { createAppSettingsStorage } from "../services/storage/app-settings.storage.js";
import {
  loadOracleConfig,
  loadRawOracleConfig,
  saveOracleConfig,
} from "../services/agents/web-search/config.js";
import { getWebSearchProvider } from "../services/agents/web-search/web-search-provider-factory.js";

export async function oracleRoutes(app: FastifyInstance) {
  const storage = createAppSettingsStorage(app.db);

  /**
   * GET /api/oracle/config
   * Returns the Oracle config with the API key masked.
   */
  app.get("/config", async () => {
    const cfg = await loadRawOracleConfig(storage);
    const hasKey = Boolean(cfg.apiKey);
    return { ...cfg, apiKey: hasKey ? ORACLE_API_KEY_MASK : "" };
  });

  /**
   * PUT /api/oracle/config
   * Saves the Oracle config. Encrypts the API key before storage.
   * If apiKey equals the mask, the existing key is preserved.
   */
  app.put("/config", async (req, reply) => {
    const input = oracleConfigSchema.parse(req.body);

    if (input.apiKey === ORACLE_API_KEY_MASK) {
      // Preserve the existing encrypted blob — don't re-encrypt the mask itself
      const existing = await loadRawOracleConfig(storage);
      await storage.set(
        ORACLE_SETTINGS_KEY,
        JSON.stringify({ ...input, apiKey: existing.apiKey }),
      );
      return reply.status(204).send();
    }

    await saveOracleConfig(storage, input);
    return reply.status(204).send();
  });

  /**
   * POST /api/oracle/test
   * Validates the configured API key by issuing a 1-result search.
   * Uses an independent timeout — never blocks longer than 10s.
   */
  app.post("/test", async (): Promise<OracleTestResponse> => {
    const cfg = await loadOracleConfig(storage);
    if (!cfg.apiKey) {
      return { ok: false, resultCount: 0, error: "No API key configured" };
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);
      try {
        const provider = getWebSearchProvider(cfg.provider, cfg.apiKey);
        const response = await provider.search("Marinara Engine roleplay", {
          maxResults: 1,
          signal: controller.signal,
        });
        return { ok: true, resultCount: response.results.length };
      } finally {
        clearTimeout(timeout);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      return { ok: false, resultCount: 0, error: msg };
    }
  });
}
