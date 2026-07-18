import type { FastifyInstance } from "fastify";
import { logger } from "../../lib/logger.js";
import { createNoodleStorage } from "../storage/noodle.storage.js";
import {
  dueNoodleRefreshTimes,
  markNoodleRefreshAttempt,
  markNoodleRefreshFailure,
  markNoodleRefreshSuccess,
  nextNoodleRefreshTime,
  type PersistedNoodleRefreshSchedule,
} from "./noodle-refresh-schedule.js";

const NOODLE_SCHEDULER_INITIAL_DELAY_MS = 20_000;
const NOODLE_SCHEDULER_MAX_POLL_MS = 60_000;
const NOODLE_SCHEDULER_CONFIGURATION_RETRY_MS = 15 * 60_000;
const NOODLE_SCHEDULER_BUSY_RETRY_MS = 60_000;
const NOODLE_SCHEDULER_RATE_LIMIT_RETRY_MS = 5 * 60_000;
const NOODLE_SCHEDULER_FAILURE_BASE_RETRY_MS = 5 * 60_000;
const NOODLE_SCHEDULER_FAILURE_MAX_RETRY_MS = 60 * 60_000;

function responseError(payload: string): string {
  try {
    const parsed = JSON.parse(payload) as { error?: unknown };
    if (typeof parsed.error === "string" && parsed.error) return parsed.error;
  } catch {
    // Fall through to the raw payload.
  }
  return payload.trim().slice(0, 500) || "Automatic Noodle refresh failed";
}

export function noodleRefreshRetryDelayMs(statusCode: number, failureAttempts: number): number {
  if (statusCode === 409) return NOODLE_SCHEDULER_BUSY_RETRY_MS;
  if (statusCode === 429) return NOODLE_SCHEDULER_RATE_LIMIT_RETRY_MS;
  if ([400, 401, 403, 404, 405, 410, 422].includes(statusCode)) {
    return NOODLE_SCHEDULER_CONFIGURATION_RETRY_MS;
  }
  return Math.min(
    NOODLE_SCHEDULER_FAILURE_MAX_RETRY_MS,
    NOODLE_SCHEDULER_FAILURE_BASE_RETRY_MS * 2 ** Math.max(0, failureAttempts),
  );
}

export function nextNoodleSchedulerPollDelayMs(schedule: PersistedNoodleRefreshSchedule, at: Date): number {
  if (schedule.refreshesPerDay === 0) return NOODLE_SCHEDULER_MAX_POLL_MS;
  const now = at.getTime();
  const retryAt = schedule.nextAttemptAt ? Date.parse(schedule.nextAttemptAt) : Number.NaN;
  if (Number.isFinite(retryAt) && retryAt > now) {
    return Math.max(1_000, Math.min(NOODLE_SCHEDULER_MAX_POLL_MS, retryAt - now));
  }
  const nextRefreshAt = nextNoodleRefreshTime(schedule);
  if (!nextRefreshAt) return NOODLE_SCHEDULER_MAX_POLL_MS;
  return Math.max(1_000, Math.min(NOODLE_SCHEDULER_MAX_POLL_MS, Date.parse(nextRefreshAt) - now));
}

export function startNoodleRefreshScheduler(app: FastifyInstance) {
  const noodle = createNoodleStorage(app.db);
  let stopped = false;
  let polling = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const scheduleNext = (delayMs: number) => {
    if (stopped) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(
      () => {
        void poll();
      },
      Math.max(1_000, delayMs),
    );
    timer.unref?.();
  };

  const persistFailure = async (
    schedule: PersistedNoodleRefreshSchedule,
    error: string,
    statusCode: number,
    at: Date,
  ) => {
    const failed = markNoodleRefreshFailure(
      schedule,
      error,
      at,
      noodleRefreshRetryDelayMs(statusCode, schedule.failureAttempts),
    );
    await noodle.saveRefreshSchedule(failed);
    if ([400, 401, 403, 404, 405, 410, 422].includes(statusCode)) {
      logger.debug("[noodle-scheduler] Automatic refresh is waiting for valid configuration: %s", error);
    } else {
      logger.warn(
        "[noodle-scheduler] Automatic refresh failed with status %d; retrying at %s: %s",
        statusCode,
        failed.nextAttemptAt ?? "unknown",
        error,
      );
    }
    return failed;
  };

  const poll = async () => {
    if (stopped || polling) return;
    polling = true;
    let nextDelay = NOODLE_SCHEDULER_MAX_POLL_MS;
    try {
      const now = new Date();
      const settings = await noodle.getSettings();
      let schedule = await noodle.ensureRefreshSchedule(now, settings);
      const retryAt = schedule.nextAttemptAt ? Date.parse(schedule.nextAttemptAt) : Number.NaN;
      if (Number.isFinite(retryAt) && retryAt > now.getTime()) {
        nextDelay = nextNoodleSchedulerPollDelayMs(schedule, now);
        return;
      }

      const dueTimes = dueNoodleRefreshTimes(schedule, now);
      if (settings.refreshesPerDay === 0 || dueTimes.length === 0) {
        nextDelay = nextNoodleSchedulerPollDelayMs(schedule, now);
        return;
      }

      schedule = markNoodleRefreshAttempt(schedule, now);
      await noodle.saveRefreshSchedule(schedule);

      if (!settings.generationConnectionId) {
        schedule = await persistFailure(schedule, "Select a Noodle generation connection first.", 400, new Date());
        nextDelay = nextNoodleSchedulerPollDelayMs(schedule, new Date());
        return;
      }

      const response = await app.inject({
        method: "POST",
        url: "/api/noodle/refresh",
        payload: { mode: "public" },
      });
      const completedAt = new Date();
      const latest = await noodle.ensureRefreshSchedule(completedAt);
      if (response.statusCode >= 200 && response.statusCode < 300) {
        const latestDueTimes = dueNoodleRefreshTimes(latest, completedAt);
        const consumedTimes = dueTimes.filter((time) => latest.scheduledTimes.includes(time));
        const completed = markNoodleRefreshSuccess(
          latest,
          consumedTimes.length > 0 ? consumedTimes : latestDueTimes,
          completedAt,
        );
        await noodle.saveRefreshSchedule(completed);
        logger.info(
          "[noodle-scheduler] Automatic timeline refresh completed; consumed %d due slot%s",
          Math.max(consumedTimes.length, latestDueTimes.length),
          Math.max(consumedTimes.length, latestDueTimes.length) === 1 ? "" : "s",
        );
        nextDelay = nextNoodleSchedulerPollDelayMs(completed, completedAt);
        return;
      }

      const failed = await persistFailure(latest, responseError(response.payload), response.statusCode, completedAt);
      nextDelay = nextNoodleSchedulerPollDelayMs(failed, completedAt);
    } catch (error) {
      const at = new Date();
      const message = error instanceof Error ? error.message : String(error);
      try {
        const schedule = await noodle.ensureRefreshSchedule(at);
        const failed = await persistFailure(schedule, message, 500, at);
        nextDelay = nextNoodleSchedulerPollDelayMs(failed, at);
      } catch (persistError) {
        logger.error(persistError, "[noodle-scheduler] Failed to persist scheduler failure state");
      }
    } finally {
      polling = false;
      scheduleNext(nextDelay);
    }
  };

  scheduleNext(NOODLE_SCHEDULER_INITIAL_DELAY_MS);
  app.addHook("onClose", async () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    timer = null;
  });

  logger.info("[noodle-scheduler] Automatic timeline refresh scheduler started");
  return {
    stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
      timer = null;
    },
  };
}
