import type { FastifyPluginAsync } from "fastify";
import {
  entitySummaryBatchIdParamsSchema,
  entitySummaryBatchItemParamsSchema,
  startEntitySummaryBatchSchema,
  type EntitySummaryBatch,
} from "@marinara-engine/shared";
import { sendSseEvent, startSseKeepalive, startSseReply } from "./generate/sse.js";

export const librarySummarizeRoutes: FastifyPluginAsync = async (app) => {
  app.post("/start", async (request, reply) => {
    const input = startEntitySummaryBatchSchema.parse(request.body);
    const batch = await app.entitySummaryBatchService.create(input);
    return reply.status(202).send(batch);
  });

  app.get("/:batchId/status", async (request, reply) => {
    const { batchId } = entitySummaryBatchIdParamsSchema.parse(request.params);
    const batch = await app.entitySummaryBatchService.get(batchId);
    if (!batch) return reply.status(404).send({ error: "Entity summary batch not found" });
    return batch;
  });

  app.get("/:batchId/events", async (request, reply) => {
    const { batchId } = entitySummaryBatchIdParamsSchema.parse(request.params);
    let snapshotSent = false;
    const buffered: EntitySummaryBatch[] = [];
    const unsubscribe = app.entitySummaryBatchService.subscribe(batchId, (next) => {
      if (snapshotSent) sendSseEvent(reply, { type: "batch", batch: next });
      else buffered.push(next);
    });
    const batch = await app.entitySummaryBatchService.get(batchId);
    if (!batch) {
      unsubscribe();
      return reply.status(404).send({ error: "Entity summary batch not found" });
    }

    startSseReply(reply, { "X-Accel-Buffering": "no" });
    sendSseEvent(reply, { type: "batch", batch });
    snapshotSent = true;
    for (const next of buffered) sendSseEvent(reply, { type: "batch", batch: next });
    const stopKeepalive = startSseKeepalive(reply);
    const cleanup = () => {
      stopKeepalive();
      unsubscribe();
    };
    reply.raw.once("close", cleanup);
    reply.raw.once("finish", cleanup);
    return reply.hijack();
  });

  app.post("/:batchId/items/:itemId/retry", async (request, reply) => {
    const { batchId, itemId } = entitySummaryBatchItemParamsSchema.parse(request.params);
    const result = await app.entitySummaryBatchService.retry(batchId, itemId);
    if (result === "not-found") return reply.status(404).send({ error: "Entity summary batch item not found" });
    if (result === "not-retryable") {
      return reply.status(409).send({ error: "Only failed, cancelled, or stale items can be retried" });
    }
    return reply.status(202).send(await app.entitySummaryBatchService.get(batchId));
  });

  app.post("/:batchId/cancel", async (request, reply) => {
    const { batchId } = entitySummaryBatchIdParamsSchema.parse(request.params);
    const batch = await app.entitySummaryBatchService.get(batchId);
    if (!batch) return reply.status(404).send({ error: "Entity summary batch not found" });
    const changed = await app.entitySummaryBatchService.cancel(batchId);
    if (!changed) return reply.status(409).send({ error: "Entity summary batch is already terminal" });
    return app.entitySummaryBatchService.get(batchId);
  });

  app.post("/:batchId/items/:itemId/apply", async (request, reply) => {
    const { batchId, itemId } = entitySummaryBatchItemParamsSchema.parse(request.params);
    const result = await app.entitySummaryBatchService.apply(batchId, itemId);
    if (result === "not-found") return reply.status(404).send({ error: "Entity summary batch item not found" });
    if (result === "not-ready") return reply.status(409).send({ error: "Entity summary candidate is not ready" });
    if (result === "stale") {
      return reply.status(409).send({ error: "Entity source or summary changed; retry before applying" });
    }
    return app.entitySummaryBatchService.get(batchId);
  });
};
