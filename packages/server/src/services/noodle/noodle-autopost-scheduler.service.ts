import type { FastifyInstance } from "fastify";
import { logger } from "../../lib/logger.js";
import { sweepStagedImages } from "../image/image-generation.js";
import { createNoodleStorage } from "../storage/noodle.storage.js";
import { prepareNextNoodlerReservePost, reconcileNoodlerReserve } from "./noodle-noodler-reserve.operation.js";

const INITIAL_DELAY_MS = 30_000;
const POLL_MS = 60_000;

/**
 * Reserve work writes rows and gallery files in the same pass, and a backup collects tables and
 * assets separately. Running both at once can archive a row whose media is not in the zip, or
 * media no row owns, so the exporter holds this gate for the length of its snapshot.
 */
let pauseDepth = 0;
let activePoll: Promise<void> = Promise.resolve();

export async function withNoodleAutoPostPaused<T>(run: () => Promise<T>): Promise<T> {
  pauseDepth += 1;
  try {
    await activePoll.catch(() => {});
    return await run();
  } finally {
    pauseDepth -= 1;
  }
}

/** True when nothing can be prepared or published, so the poll only has existing rows to tidy. */
export function noodlerReservePollIsIdle(settings: {
  enableNoodler: boolean;
  autoPostingScheduleEnabled: boolean;
}): boolean {
  return !settings.enableNoodler || !settings.autoPostingScheduleEnabled;
}

export function startNoodleAutoPostScheduler(app: FastifyInstance) {
  let stopped = false;
  let running: Promise<void> = Promise.resolve();
  let timer: ReturnType<typeof setTimeout> | null = null;

  const schedule = (delay = POLL_MS) => {
    if (stopped) return;
    timer = setTimeout(() => {
      running = poll();
      activePoll = running;
    }, delay);
    timer.unref?.();
  };

  const poll = async () => {
    if (stopped) return;
    // A paused poll re-arms rather than skipping its turn: the backup it is waiting on is short.
    if (pauseDepth > 0) {
      schedule();
      return;
    }
    try {
      // Reconciliation walks every prepared post and every Noodle post. With posting off and no
      // reserve rows there is nothing for it to repair or publish, so skip the scan entirely
      // rather than materializing both tables once a minute for the server's lifetime.
      const noodle = createNoodleStorage(app.db);
      const settings = await noodle.getSettings();
      if (noodlerReservePollIsIdle(settings) && !(await noodle.hasNoodlerPreparedPosts())) return;
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
  running = (async () => {
    // Images staged by a process that was killed mid-preparation are referenced by nothing.
    const swept = sweepStagedImages();
    if (swept > 0) logger.info("[noodle-autopost] Reclaimed %d staged image file(s)", swept);
    await createNoodleStorage(app.db).ensureNoodlerReserveState();
    await reconcileNoodlerReserve(app.db);
  })().catch((error) => logger.error(error, "[noodle-autopost] Startup reconciliation failed"));
  activePoll = running;
  schedule(INITIAL_DELAY_MS);
  app.addHook("onClose", async () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    await running.catch(() => {});
  });
  logger.info("[noodle-autopost] Private reserve scheduler started");
  return { stop: () => { stopped = true; if (timer) clearTimeout(timer); } };
}
