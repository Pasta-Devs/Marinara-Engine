// ──────────────────────────────────────────────
// Routes: Regex Scripts
// ──────────────────────────────────────────────
import type { FastifyInstance } from "fastify";
import { createRegexScriptSchema, reorderRegexScriptsSchema, updateRegexScriptSchema } from "@marinara-engine/shared";
import { createRegexScriptsStorage } from "../services/storage/regex-scripts.storage.js";

export async function regexScriptsRoutes(app: FastifyInstance) {
  const storage = createRegexScriptsStorage(app.db);

  app.get<{ Querystring: { characterIds?: string } }>("/", async (req) => {
    const raw = req.query.characterIds;
    if (raw) {
      const ids = raw.split(",").filter(Boolean);
      return storage.listForCharacters(ids);
    }
    return storage.list();
  });

  app.put("/reorder", async (req) => {
    const input = reorderRegexScriptsSchema.parse(req.body);
    return storage.reorder(input.scriptIds);
  });

  app.get<{ Params: { id: string } }>("/:id", async (req, reply) => {
    const script = await storage.getById(req.params.id);
    if (!script) return reply.status(404).send({ error: "Regex script not found" });
    return script;
  });

  app.post("/", async (req) => {
    const input = createRegexScriptSchema.parse(req.body);
    return storage.create(input);
  });

  app.patch<{ Params: { id: string } }>("/:id", async (req) => {
    const data = updateRegexScriptSchema.parse(req.body);
    return storage.update(req.params.id, data);
  });

  app.delete<{ Params: { id: string } }>("/:id", async (req, reply) => {
    await storage.remove(req.params.id);
    return reply.status(204).send();
  });
}
