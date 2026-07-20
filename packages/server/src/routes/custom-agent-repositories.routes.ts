import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import { isCustomAgentRepositoriesEnabled } from "../config/runtime-config.js";
import { logger } from "../lib/logger.js";
import { requirePrivilegedAccess } from "../middleware/privileged-gate.js";
import { createCustomAgentRepositoriesService } from "../services/agents/custom-agent-repositories.service.js";

const repositoryUrlSchema = z.object({ url: z.string().trim().min(1).max(2048) }).strict();
const applyRepositorySchema = repositoryUrlSchema
  .extend({
    digest: z.string().regex(/^[a-f0-9]{64}$/u),
    confirmed: z.boolean().default(false),
  })
  .strict();
const syncRepositorySchema = z
  .object({
    digest: z.string().regex(/^[a-f0-9]{64}$/u),
    confirmed: z.boolean().default(false),
  })
  .strict();
const repositoryParamsSchema = z.object({ id: z.string().regex(/^[a-f0-9]{16}$/u) }).strict();

function requireFeature(reply: FastifyReply): boolean {
  if (isCustomAgentRepositoriesEnabled()) return true;
  void reply.status(404).send({ error: "Custom agent repositories are disabled" });
  return false;
}

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message.trim() ? error.message : "Custom agent repository operation failed";
}

export async function customAgentRepositoriesRoutes(app: FastifyInstance) {
  const service = createCustomAgentRepositoriesService(app.db);

  app.get("/", async () => ({
    enabled: isCustomAgentRepositoriesEnabled(),
    repositories: isCustomAgentRepositoriesEnabled() ? await service.list() : [],
  }));

  app.post("/preview", async (request, reply) => {
    if (!requireFeature(reply)) return;
    if (!requirePrivilegedAccess(request, reply, { feature: "Custom agent repository preview" })) return;
    try {
      const { url } = repositoryUrlSchema.parse(request.body);
      return await service.preview(url);
    } catch (error) {
      logger.error(error, "Custom agent repository preview failed");
      return reply.status(400).send({ error: errorMessage(error) });
    }
  });

  app.post("/", async (request, reply) => {
    if (!requireFeature(reply)) return;
    if (!requirePrivilegedAccess(request, reply, { feature: "Custom agent repository installation" })) return;
    try {
      const { url, digest, confirmed } = applyRepositorySchema.parse(request.body);
      return await service.add(url, digest, confirmed);
    } catch (error) {
      logger.error(error, "Custom agent repository installation failed");
      return reply.status(400).send({ error: errorMessage(error) });
    }
  });

  app.post<{ Params: { id: string } }>("/:id/preview", async (request, reply) => {
    if (!requireFeature(reply)) return;
    if (!requirePrivilegedAccess(request, reply, { feature: "Custom agent repository preview" })) return;
    try {
      const { id } = repositoryParamsSchema.parse(request.params);
      const repository = (await service.list()).find((entry) => entry.id === id);
      if (!repository) return reply.status(404).send({ error: "Custom agent repository not found" });
      return await service.preview(repository.url);
    } catch (error) {
      logger.error(error, "Saved custom agent repository preview failed");
      return reply.status(400).send({ error: errorMessage(error) });
    }
  });

  app.post<{ Params: { id: string } }>("/:id/sync", async (request, reply) => {
    if (!requireFeature(reply)) return;
    if (!requirePrivilegedAccess(request, reply, { feature: "Custom agent repository synchronization" })) return;
    try {
      const { id } = repositoryParamsSchema.parse(request.params);
      const { digest, confirmed } = syncRepositorySchema.parse(request.body);
      return await service.sync(id, digest, confirmed);
    } catch (error) {
      logger.error(error, "Custom agent repository synchronization failed");
      return reply.status(400).send({ error: errorMessage(error) });
    }
  });

  app.delete<{ Params: { id: string } }>("/:id", async (request, reply) => {
    if (!requireFeature(reply)) return;
    if (!requirePrivilegedAccess(request, reply, { feature: "Custom agent repository removal" })) return;
    try {
      const { id } = repositoryParamsSchema.parse(request.params);
      if (!(await service.remove(id))) return reply.status(404).send({ error: "Custom agent repository not found" });
      return reply.status(204).send();
    } catch (error) {
      logger.error(error, "Custom agent repository removal failed");
      return reply.status(400).send({ error: errorMessage(error) });
    }
  });
}
