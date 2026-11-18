/**
 * Every request to the built-in chat model goes through here: it waits its turn by
 * priority (see local-model-priority.ts) and counts as use, so the model is not unloaded
 * for being idle while a request is queued or running.
 */
import { logger } from "../../lib/logger.js";
import { localModelManager } from "./local-model-manager.js";
import { currentLocalModelPriority, type LocalModelPriority } from "./local-model-priority.js";
import { sidecarProcessService } from "./sidecar-process.service.js";

export function runOnMainModel<T>(
  level: LocalModelPriority | undefined,
  signal: AbortSignal | undefined,
  work: () => Promise<T>,
): Promise<T> {
  const end = localModelManager.begin("main");
  const resolved = level ?? currentLocalModelPriority();
  logger.debug("[local-models] built-in model request (%s) %j", resolved, sidecarProcessService.turns.snapshot());
  return sidecarProcessService.turns.run(resolved, signal, work).finally(end);
}

/** Hold a turn for a stream. Call the returned function once the stream is done. */
export async function acquireMainModelTurn(
  level: LocalModelPriority | undefined,
  signal: AbortSignal | undefined,
): Promise<() => void> {
  const end = localModelManager.begin("main");
  const resolved = level ?? currentLocalModelPriority();
  logger.debug("[local-models] built-in model stream (%s) %j", resolved, sidecarProcessService.turns.snapshot());
  try {
    const release = await sidecarProcessService.turns.acquire(resolved, signal);
    return () => {
      release();
      end();
    };
  } catch (error) {
    end();
    throw error;
  }
}
