import type { FastifyInstance, FastifyReply } from "fastify";
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

const validationErrors = new Set([
  "Advanced Memory is available only for Roleplay chats",
  "Minimum recalled messages cannot exceed the maximum",
  "The continuity summary budget must be smaller than the total context limit",
  "Select a narrator from this chat's characters",
  "A character knowledge range points to a message that no longer exists",
  "Memory text must contain between 1 and 500000 characters",
  "Invalid Advanced Memory export",
]);

async function withMemoryDomainErrors<T>(reply: FastifyReply, operation: () => Promise<T>) {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof z.ZodError) return reply.status(400).send({ error: error.message });
    if (error instanceof Error && error.message === "Memory record not found")
      return reply.status(404).send({ error: error.message });
    if (error instanceof Error && validationErrors.has(error.message))
      return reply.status(400).send({ error: error.message });
    throw error;
  }
}

export async function advancedMemoryRoutes(app: FastifyInstance) {
  const service = createAdvancedMemoryService(app.db);
  const prefix = "/:id/advanced-memory";
  app.get<{ Params: { id: string } }>(prefix, async (req) => service.status(req.params.id));
  app.patch<{ Params: { id: string } }>(`${prefix}/settings`, async (req, reply) =>
    withMemoryDomainErrors(reply, () => service.updateSettings(req.params.id, req.body)),
  );
  app.post<{ Params: { id: string } }>(`${prefix}/initialize`, async (req, reply) =>
    withMemoryDomainErrors(reply, async () => {
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
    }),
  );
  app.post<{ Params: { id: string } }>(`${prefix}/cancel`, async (req) => service.cancel(req.params.id));
  app.post<{ Params: { id: string } }>(`${prefix}/reindex`, async (req, reply) =>
    withMemoryDomainErrors(reply, async () => {
      const options = operationSchema.parse(req.body ?? {});
      void service
        .reindex(req.params.id, { debugMode: options.debugMode, blocking: true })
        .catch((error) => logger.warn(error, "[advanced-memory] Reindex interrupted"));
      return reply.status(202).send(await service.status(req.params.id));
    }),
  );
  app.patch<{ Params: { id: string; recordId: string } }>(`${prefix}/records/:recordId`, async (req, reply) =>
    withMemoryDomainErrors(reply, () =>
      service.updateRecord(req.params.id, req.params.recordId, recordPatchSchema.parse(req.body)),
    ),
  );
  app.get<{ Params: { id: string; recordId: string } }>(`${prefix}/records/:recordId/sources`, async (req, reply) =>
    withMemoryDomainErrors(reply, () => service.getSources(req.params.id, req.params.recordId)),
  );
  app.get<{ Params: { id: string } }>(`${prefix}/export`, async (req, reply) =>
    reply
      .header("Content-Disposition", 'attachment; filename="advanced-memory.marinara.json"')
      .send(await service.exportMemory(req.params.id)),
  );
  app.post<{ Params: { id: string } }>(`${prefix}/import`, { bodyLimit: 25 * 1024 * 1024 }, async (req, reply) =>
    withMemoryDomainErrors(reply, () => service.importMemory(req.params.id, req.body)),
  );
}
