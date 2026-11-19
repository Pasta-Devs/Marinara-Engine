/**
 * Settings and status shared by every built-in model: when an unused model is unloaded,
 * what each one holds, and how many replies the chat model works on at once.
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { LOCAL_MODEL_IDLE_UNLOAD_CHOICES, type LocalModelsStatus } from "@marinara-engine/shared";
import { requirePrivilegedAccess } from "../middleware/privileged-gate.js";
import { STATUS_POLL_RATE_LIMIT, UTILITY_SIDECAR_RATE_LIMIT } from "../middleware/rate-limit.js";
import { localModelManager } from "../services/sidecar/local-model-manager.js";
import { sidecarModelService } from "../services/sidecar/sidecar-model.service.js";
import { sidecarProcessService } from "../services/sidecar/sidecar-process.service.js";
// Imported for their registration with the manager, so every slot shows even before first use.
import "../services/sidecar/builtin-embedding.service.js";
import "../services/sidecar/decision-process.service.js";
import "../services/utility-sidecar/utility-sidecar.service.js";

const settingsBody = z.object({
  idleUnloadMinutes: z
    .number()
    .int()
    .refine((value) => (LOCAL_MODEL_IDLE_UNLOAD_CHOICES as readonly number[]).includes(value)),
});

function status(): LocalModelsStatus {
  const parallel = sidecarProcessService.resolveParallel();
  return {
    ...localModelManager.getStatus(),
    parallel: {
      setting: sidecarModelService.getConfig().maxParallelJobs,
      effective: sidecarProcessService.getEffectiveParallelJobs(),
      reason: parallel.reason,
    },
  };
}

export async function localModelsRoutes(app: FastifyInstance) {
  // Polled by the built-in model pages, so the status-poll budget.
  app.get("/", { config: { rateLimit: STATUS_POLL_RATE_LIMIT } }, async () => status());

  app.patch("/settings", { config: { rateLimit: UTILITY_SIDECAR_RATE_LIMIT } }, async (req, reply) => {
    if (!requirePrivilegedAccess(req, reply, { feature: "Built-in model settings" })) return;
    const parsed = settingsBody.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: "Pick one of the listed times" });
    localModelManager.updateSettings(parsed.data);
    return status();
  });
}
