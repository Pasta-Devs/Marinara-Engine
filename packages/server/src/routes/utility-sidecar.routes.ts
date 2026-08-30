/**
 * The utility model slot's API.
 *
 * Separate from /api/sidecar on purpose: nothing here can start, stop, reconfigure or
 * re-point the main sidecar. An agent that wants its own small model installs it here
 * and the main slot carries on serving whatever the operator already chose.
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { utilitySidecarService } from "../services/utility-sidecar/utility-sidecar.service.js";
import { requirePrivilegedAccess } from "../middleware/privileged-gate.js";
import { logger } from "../lib/logger.js";
import { UTILITY_SIDECAR_RATE_LIMIT } from "../middleware/rate-limit.js";

const modelIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9._-]+$/, "Model id may contain letters, numbers, dot, dash and underscore");

const installSchema = z.object({
  modelId: modelIdSchema,
  repo: z
    .string()
    .trim()
    .regex(/^[^/\s]+\/[^/\s]+$/, "Expected a HuggingFace repo of the form owner/name"),
  file: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9._-]+\.gguf$/, "Expected a .gguf file name"),
});

export async function utilitySidecarRoutes(app: FastifyInstance) {
  /** What is installed, what is active, and whether it is answering. */
  app.get("/status", { config: { rateLimit: UTILITY_SIDECAR_RATE_LIMIT } }, async () =>
    utilitySidecarService.getStatus(),
  );

  /**
   * Which connection will answer for this agent, and why.
   *
   * The precedence rule lives in one place server-side; this exposes its verdict so the
   * UI can name the model that will actually run instead of guessing from config. An
   * extractor answered by the wrong model fails in ways that look like a bad model, so
   * this is worth stating plainly to the operator.
   */
  app.get<{ Params: { agentType: string } }>(
    "/routing/:agentType",
    { config: { rateLimit: UTILITY_SIDECAR_RATE_LIMIT } },
    async (req) => {
      const agentType = modelIdSchema.parse(req.params.agentType);
      const status = utilitySidecarService.getStatus();
      const serves = utilitySidecarService.servesAgent(agentType);
      const installed = status.models[agentType];
      return {
        agentType,
        source: serves ? ("utility-sidecar" as const) : ("agent-connection" as const),
        modelId: serves ? status.activeModelId : null,
        model: serves && installed ? { repo: installed.repo, file: installed.file, oid: installed.oid } : null,
        baseUrl: serves ? status.baseUrl : null,
        running: status.ready,
        reason: serves
          ? status.ready
            ? "The local model is loaded and answering; it takes precedence over this agent's connection."
            : "The local model is selected and starts on the next run; it takes precedence over this agent's connection."
          : !installed
            ? "No model is installed in the utility slot for this agent."
            : status.activeModelId !== agentType
              ? "The utility slot is serving a different model."
              : status.error
                ? `The local model could not start: ${status.error}`
                : !status.runtimeInstalled
                  ? "The local runtime is not installed, so the local model cannot start."
                  : "The local model is installed but not selected.",
      };
    },
  );

  /** Install a model into this slot. Long-running; progress is logged. */
  app.post("/models/install", { config: { rateLimit: UTILITY_SIDECAR_RATE_LIMIT } }, async (req, reply) => {
    if (!requirePrivilegedAccess(req, reply, { feature: "Utility model download" })) return;
    const body = installSchema.parse(req.body);
    try {
      const record = await utilitySidecarService.installModel({
        modelId: body.modelId,
        repo: body.repo,
        file: body.file,
        onProgress: (progress) => {
          if (progress.downloaded && progress.total) {
            logger.debug(
              `[utility-sidecar] ${body.modelId} ${Math.round((progress.downloaded / progress.total) * 100)}%`,
            );
          }
        },
      });
      return { model: record, status: utilitySidecarService.getStatus() };
    } catch (error) {
      return reply.status(400).send({ error: error instanceof Error ? error.message : "Install failed" });
    }
  });

  /**
   * Is a newer build available?
   *
   * Answers with both blob ids so the caller can say why, and reports `indeterminate`
   * rather than implying the installed copy is current when the comparison cannot be
   * made. The operator is being asked to spend a download.
   */
  app.get<{ Params: { modelId: string } }>(
    "/models/:modelId/update-check",
    { config: { rateLimit: UTILITY_SIDECAR_RATE_LIMIT } },
    async (req, reply) => {
      try {
        return await utilitySidecarService.checkForUpdate(modelIdSchema.parse(req.params.modelId));
      } catch (error) {
        return reply.status(404).send({ error: error instanceof Error ? error.message : "Unknown model" });
      }
    },
  );

  app.delete<{ Params: { modelId: string } }>(
    "/models/:modelId",
    { config: { rateLimit: UTILITY_SIDECAR_RATE_LIMIT } },
    async (req, reply) => {
      if (!requirePrivilegedAccess(req, reply, { feature: "Utility model removal" })) return;
      await utilitySidecarService.removeModel(modelIdSchema.parse(req.params.modelId));
      return utilitySidecarService.getStatus();
    },
  );

  /** Choose which installed model this slot serves, or null to serve none. */
  app.patch("/active", { config: { rateLimit: UTILITY_SIDECAR_RATE_LIMIT } }, async (req, reply) => {
    if (!requirePrivilegedAccess(req, reply, { feature: "Utility model selection" })) return;
    const body = z.object({ modelId: modelIdSchema.nullable() }).parse(req.body);
    try {
      await utilitySidecarService.setActiveModel(body.modelId);
      if (body.modelId) await utilitySidecarService.ensureRunning();
      else await utilitySidecarService.stop();
      return utilitySidecarService.getStatus();
    } catch (error) {
      return reply.status(400).send({ error: error instanceof Error ? error.message : "Selection failed" });
    }
  });

  /**
   * Hardware settings only.
   *
   * Sampling is intentionally not exposed: the extractor is graded against a schema,
   * and a temperature dial on it turns a working install into a subtly broken one.
   */
  app.patch("/settings", { config: { rateLimit: UTILITY_SIDECAR_RATE_LIMIT } }, async (req, reply) => {
    if (!requirePrivilegedAccess(req, reply, { feature: "Utility model settings" })) return;
    const body = z
      .object({
        contextSize: z.number().int().optional(),
        gpuLayers: z.number().int().optional(),
        maxParallelJobs: z.number().int().optional(),
      })
      .parse(req.body);
    try {
      return await utilitySidecarService.updateSettings(body);
    } catch (error) {
      return reply.status(400).send({ error: error instanceof Error ? error.message : "Update failed" });
    }
  });

  app.post("/start", { config: { rateLimit: UTILITY_SIDECAR_RATE_LIMIT } }, async (req, reply) => {
    if (!requirePrivilegedAccess(req, reply, { feature: "Utility model start" })) return;
    return utilitySidecarService.ensureRunning();
  });

  app.post("/stop", { config: { rateLimit: UTILITY_SIDECAR_RATE_LIMIT } }, async (req, reply) => {
    if (!requirePrivilegedAccess(req, reply, { feature: "Utility model stop" })) return;
    await utilitySidecarService.stop();
    return utilitySidecarService.getStatus();
  });
}
