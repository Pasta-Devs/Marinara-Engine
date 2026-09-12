import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { advancedMemorySettingsSchema } from "@marinara-engine/shared";
import { createAdvancedMemoryService } from "../services/advanced-memory.js";
import { logger } from "../lib/logger.js";

const operationSchema = z.object({
  settings: advancedMemorySettingsSchema.partial().optional(),
  debugMode: z.boolean().optional(),
});
const recordPatchSchema = z
  .object({ content: z.string().min(1).max(500_000).optional(), enabled: z.boolean().optional() })
  .strict();

export async function advancedMemoryRoutes(app: FastifyInstance) {
  const service = createAdvancedMemoryService(app.db);
  const prefix = "/:id/advanced-memory";
  app.get<{ Params: { id: string } }>(prefix, async (req) => service.status(req.params.id));
  app.patch<{ Params: { id: string } }>(`${prefix}/settings`, async (req, reply) => {
    try {
      return await service.updateSettings(req.params.id, req.body);
    } catch (error) {
      return reply.status(400).send({ error: error instanceof Error ? error.message : "Invalid memory settings" });
    }
  });
  app.post<{ Params: { id: string } }>(`${prefix}/initialize`, async (req, reply) => {
    const options = operationSchema.parse(req.body ?? {});
    if (options.settings) await service.updateSettings(req.params.id, options.settings);
    const status = await service.status(req.params.id);
    if (!status.settings.enabled)
      return reply.status(400).send({ error: "Enable Advanced Memory before initialization" });
    if (status.missingKnowledgeCharacterIds.length)
      return reply.status(409).send({ error: "Confirm character knowledge ranges first", ...status });
    void service
      .initialize(req.params.id, { debugMode: options.debugMode, blocking: true })
      .catch((error) => logger.warn(error, "[advanced-memory] Initialization interrupted"));
    return reply.status(202).send(await service.status(req.params.id));
  });
  app.post<{ Params: { id: string } }>(`${prefix}/cancel`, async (req) => service.cancel(req.params.id));
  app.post<{ Params: { id: string } }>(`${prefix}/reindex`, async (req, reply) => {
    const options = operationSchema.parse(req.body ?? {});
    void service
      .reindex(req.params.id, { debugMode: options.debugMode, blocking: true })
      .catch((error) => logger.warn(error, "[advanced-memory] Reindex interrupted"));
    return reply.status(202).send(await service.status(req.params.id));
  });
  app.patch<{ Params: { id: string; recordId: string } }>(`${prefix}/records/:recordId`, async (req) =>
    service.updateRecord(req.params.id, req.params.recordId, recordPatchSchema.parse(req.body)),
  );
  app.get<{ Params: { id: string; recordId: string } }>(`${prefix}/records/:recordId/sources`, async (req) =>
    service.getSources(req.params.id, req.params.recordId),
  );
  app.get<{ Params: { id: string } }>(`${prefix}/export`, async (req, reply) =>
    reply
      .header("Content-Disposition", 'attachment; filename="advanced-memory.marinara.json"')
      .send(await service.exportMemory(req.params.id)),
  );
  app.post<{ Params: { id: string } }>(`${prefix}/import`, { bodyLimit: 25 * 1024 * 1024 }, async (req) =>
    service.importMemory(req.params.id, req.body),
  );
}
