import type { FastifyInstance } from "fastify";
import { abortTask, clearTaskHistory, listTaskHistory, listTasks, requestTaskStop } from "../services/task-registry.js";
import { logger } from "../lib/logger.js";

export async function tasksRoutes(app: FastifyInstance) {
  /**
   * GET /api/tasks
   * Everything the engine is currently working on. Polled by the top-bar activity menu.
   */
  app.get("/", async () => ({ tasks: listTasks(), history: listTaskHistory() }));

  app.delete("/history", async () => {
    clearTaskHistory();
    return { cleared: true };
  });

  app.post<{ Params: { id: string } }>("/:id/stop", async (req, reply) => {
    const result = requestTaskStop(req.params.id);
    if (!result.accepted) {
      return reply.status(404).send({ accepted: false, reason: "Unknown task" });
    }
    logger.info("[tasks] Stop requested for task %s (%s)", req.params.id, result.mode);
    return reply.status(202).send({ ...result, state: "stopping" });
  });

  /**
   * POST /api/tasks/:id/abort
   * Cancel a task that registered an abort handle.
   */
  app.post<{ Params: { id: string } }>("/:id/abort", async (req, reply) => {
    const aborted = abortTask(req.params.id);
    if (!aborted) {
      return reply.status(404).send({ aborted: false, reason: "Unknown or non-cancellable task" });
    }
    logger.info("[tasks] Legacy abort requested for task %s", req.params.id);
    return reply.send({ aborted: true });
  });
}
