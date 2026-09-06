import type { FastifyInstance } from "fastify";
import { normalizeUILanguage, UI_LANGUAGE_CODES } from "@marinara-engine/shared";
import { installUIPack, readUIPack } from "../services/docs/ui-pack.service.js";
import { logger } from "../lib/logger.js";

export async function uiLanguagesRoutes(app: FastifyInstance) {
  app.get("/", async () => ({
    installed: [
      "en",
      ...(
        await Promise.all(
          UI_LANGUAGE_CODES.filter((code) => code !== "en").map(async (code) =>
            (await readUIPack(code)) ? code : null,
          ),
        )
      ).filter((code) => code !== null),
    ],
  }));

  app.get<{ Params: { language: string } }>("/:language", async (request, reply) => {
    const language = normalizeUILanguage(request.params.language);
    if (!language || language === "en") return reply.code(400).send({ error: "Unsupported UI language" });
    return reply.send(await readUIPack(language));
  });

  app.post<{ Params: { language: string } }>("/:language", async (request, reply) => {
    const language = normalizeUILanguage(request.params.language);
    if (!language || language === "en") return reply.code(400).send({ error: "Unsupported UI language" });
    try {
      await installUIPack(language);
      return { language };
    } catch (error) {
      logger.error(error, "UI language pack download failed for %s", language);
      return reply.code(502).send({ error: "UI language pack download failed. Check your connection and try again." });
    }
  });
}
