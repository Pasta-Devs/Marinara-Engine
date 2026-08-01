import type { FastifyInstance } from "fastify";
import { logger } from "../../lib/logger.js";
import { createNoodleStorage } from "../storage/noodle.storage.js";
import { prepareNextNoodlerReservePost, reconcileNoodlerReserve } from "./noodle-noodler-reserve.operation.js";

const INITIAL_DELAY_MS = 30_000;
const POLL_MS = 60_000;

export function startNoodleAutoPostScheduler(app: FastifyInstance) {
  let stopped = false;
  let running: Promise<void> = Promise.resolve();
  let timer: ReturnType<typeof setTimeout> | null = null;

  const schedule = (delay = POLL_MS) => {
    if (stopped) return;
    timer = setTimeout(() => {
      running = poll();
    }, delay);
    timer.unref?.();
  };

  const poll = async () => {
    if (stopped) return;
    try {
      await reconcileNoodlerReserve(app.db);
      const outcome = await prepareNextNoodlerReservePost(app.db);
      if (outcome === "prepared") logger.info("[noodle-autopost] Prepared one future NoodleR post");
    } catch (error) {
      logger.error(error, "[noodle-autopost] Reserve poll failed");
    } finally {
      schedule();
    }
  };

  // Own reserve-state initialization here so upgrades begin their hold at server startup,
  // even when automatic posting is disabled. Provider work still waits for the normal delay.
  void (async () => {
    await createNoodleStorage(app.db).ensureNoodlerReserveState();
    await reconcileNoodlerReserve(app.db);
  })().catch((error) => logger.error(error, "[noodle-autopost] Startup reconciliation failed"));
  schedule(INITIAL_DELAY_MS);
  app.addHook("onClose", async () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    await running.catch(() => {});
  });
  logger.info("[noodle-autopost] Private reserve scheduler started");
  return { stop: () => { stopped = true; if (timer) clearTimeout(timer); } };
}
