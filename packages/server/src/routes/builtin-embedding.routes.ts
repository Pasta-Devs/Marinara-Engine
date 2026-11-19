/**
 * The built-in embedding model's API: status, download, choose, load, unload, remove.
 *
 * Separate from /api/sidecar: nothing here starts, stops or reconfigures the built-in model.
 * A change of model re-indexes Long-term memory the way a change of the Embeddings default does.
 */
import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import {
  BUILTIN_EMBEDDING_CONNECTION_ID,
  BUILTIN_EMBEDDING_MODELS,
  DEFAULT_EMBEDDING_CONNECTION_SETTINGS_KEY,
  type BuiltinEmbeddingModelId,
} from "@marinara-engine/shared";
import { logger } from "../lib/logger.js";
import { requirePrivilegedAccess } from "../middleware/privileged-gate.js";
import { STATUS_POLL_RATE_LIMIT, UTILITY_SIDECAR_RATE_LIMIT } from "../middleware/rate-limit.js";
import { withLongTermMemoryEmbeddingChange } from "../services/generation/long-term-memory-runtime.js";
import {
  readDefaultEmbeddingConnectionId,
  resetMemoryRecallVectorizerCache,
} from "../services/memory-recall-embedding.js";
import { createAppSettingsStorage } from "../services/storage/app-settings.storage.js";
import { builtinEmbeddingService } from "../services/sidecar/builtin-embedding.service.js";

const modelIdSchema = z.enum(BUILTIN_EMBEDDING_MODELS.map((model) => model.id) as [BuiltinEmbeddingModelId]);
const modelBody = z.object({ modelId: modelIdSchema });
const rateLimit = { config: { rateLimit: UTILITY_SIDECAR_RATE_LIMIT } };

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function builtinEmbeddingRoutes(app: FastifyInstance) {
  // The page polls this once a second during a download, so it gets a poll-sized limit, not the utility one.
  app.get("/status", { config: { rateLimit: STATUS_POLL_RATE_LIMIT } }, async () =>
    builtinEmbeddingService.getStatus(),
  );

  /**
   * Starts the download and answers at once; /status shows progress. When it finishes it becomes the model in use,
   * and Long-term memory re-indexes as it does when the Embeddings default changes.
   */
  app.post("/download", rateLimit, async (req, reply) => {
    if (!requirePrivilegedAccess(req, reply, { feature: "Built-in embedding model download" })) return;
    const { modelId } = modelBody.parse(req.body);
    let run: () => Promise<void>;
    try {
      run = builtinEmbeddingService.startDownload(modelId);
    } catch (error) {
      return reply.status(409).send({ error: message(error) });
    }
    // Nobody waits on this response, so the re-index has no reply to report on.
    const noReply = { header: () => undefined } as unknown as Pick<FastifyReply, "header">;
    void withLongTermMemoryEmbeddingChange(app.db, noReply, async () => {
      await run();
      // With no Embeddings default, search used Marinara's own small fallback: the download is meant to replace it.
      // A default the person chose is left alone.
      if (!(await readDefaultEmbeddingConnectionId(app.db))) {
        await createAppSettingsStorage(app.db).set(
          DEFAULT_EMBEDDING_CONNECTION_SETTINGS_KEY,
          BUILTIN_EMBEDDING_CONNECTION_ID,
        );
      }
      resetMemoryRecallVectorizerCache();
    }).catch((error: unknown) => logger.warn(error, "[builtin-embedding] Download did not finish"));
    return builtinEmbeddingService.getStatus();
  });

  app.post("/download/cancel", rateLimit, async (req, reply) => {
    if (!requirePrivilegedAccess(req, reply, { feature: "Built-in embedding model download" })) return;
    builtinEmbeddingService.cancelDownload();
    return builtinEmbeddingService.getStatus();
  });

  app.post("/use", rateLimit, async (req, reply) => {
    if (!requirePrivilegedAccess(req, reply, { feature: "Built-in embedding model selection" })) return;
    const { modelId } = modelBody.parse(req.body);
    try {
      return await withLongTermMemoryEmbeddingChange(app.db, reply, async () => {
        await builtinEmbeddingService.useModel(modelId);
        resetMemoryRecallVectorizerCache();
        return builtinEmbeddingService.getStatus();
      });
    } catch (error) {
      return reply.status(400).send({ error: message(error) });
    }
  });

  /** Starts it now (it also starts by itself on the first search). */
  app.post("/load", rateLimit, async (req, reply) => {
    if (!requirePrivilegedAccess(req, reply, { feature: "Built-in embedding model load" })) return;
    try {
      await builtinEmbeddingService.ensureRunning();
      return builtinEmbeddingService.getStatus();
    } catch (error) {
      return reply.status(400).send({ error: message(error) });
    }
  });

  app.post("/unload", rateLimit, async (req, reply) => {
    if (!requirePrivilegedAccess(req, reply, { feature: "Built-in embedding model unload" })) return;
    await builtinEmbeddingService.stop();
    return builtinEmbeddingService.getStatus();
  });

  app.post("/remove", rateLimit, async (req, reply) => {
    if (!requirePrivilegedAccess(req, reply, { feature: "Built-in embedding model removal" })) return;
    const { modelId } = modelBody.parse(req.body);
    return withLongTermMemoryEmbeddingChange(app.db, reply, async () => {
      await builtinEmbeddingService.removeModel(modelId);
      // With no model left, Embeddings goes back to Marinara's own search instead of naming a model that is gone.
      if (
        !builtinEmbeddingService.getActiveModel() &&
        (await readDefaultEmbeddingConnectionId(app.db)) === BUILTIN_EMBEDDING_CONNECTION_ID
      ) {
        await createAppSettingsStorage(app.db).remove(DEFAULT_EMBEDDING_CONNECTION_SETTINGS_KEY);
      }
      resetMemoryRecallVectorizerCache();
      return builtinEmbeddingService.getStatus();
    });
  });

  app.patch("/settings", rateLimit, async (req, reply) => {
    if (!requirePrivilegedAccess(req, reply, { feature: "Built-in embedding model settings" })) return;
    const { device } = z.object({ device: z.enum(["auto", "cpu"]) }).parse(req.body);
    await builtinEmbeddingService.setDevice(device);
    return builtinEmbeddingService.getStatus();
  });
}
