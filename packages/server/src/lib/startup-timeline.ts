// ──────────────────────────────────────────────
// Startup timeline: one timed record per boot step
// ──────────────────────────────────────────────
// A slow or failing boot used to show only "[startup] Unhandled error during
// server bootstrap" or nothing at all. startup.phase() times each step and
// remembers which one an error came out of; index.ts writes one
// `startup.ready` summary once the server listens.
//
// Phases do not put `stage` into the log context: services started during a
// phase keep timers and pollers that would otherwise carry that stage forever.
// ──────────────────────────────────────────────
import { AsyncLocalStorage } from "node:async_hooks";
import { logger } from "./logger.js";

export interface StartupPhaseRecord {
  stage: string;
  elapsedMs: number;
  /** Time not spent in nested phases: the part of elapsedMs this step itself took. */
  selfMs: number;
  outcome: "ok" | "failed";
}

// Levels follow selfMs, so an outer phase (app.build wraps every buildApp step)
// does not report the same slow inner step a second time. The warn line is the
// only one LOG_LEVEL=warn (the default) shows, so it is kept for steps that are
// slow even on a small host or a first run.
const SLOW_PHASE_INFO_MS = 1_000;
const SLOW_PHASE_WARN_MS = 15_000;

const failedStages = new WeakMap<object, string>();
const phases: StartupPhaseRecord[] = [];

/** The running phase; nested phases add their time to it so it can subtract that. */
interface OpenPhase {
  nestedMs: number;
}
const openPhase = new AsyncLocalStorage<OpenPhase>();

export const startup = {
  /**
   * Runs one boot step and records its time. The level follows the step's own
   * time (selfMs, without nested phases): debug when fast, info over 1 s and
   * warn over 15 s (`event: "startup.phase"`). A failure is not logged here:
   * it propagates to the caller, which logs it once and can name the step with
   * startup.stageOf(error).
   */
  async phase<T>(stage: string, work: () => Promise<T> | T): Promise<T> {
    const parent = openPhase.getStore();
    const self: OpenPhase = { nestedMs: 0 };
    const started = performance.now();
    const finish = (outcome: StartupPhaseRecord["outcome"]) => {
      const elapsedMs = Math.round(performance.now() - started);
      // Parallel nested phases can add up to more than the wall time.
      const selfMs = Math.max(0, elapsedMs - self.nestedMs);
      if (parent) parent.nestedMs += elapsedMs;
      phases.push({ stage, elapsedMs, selfMs, outcome });
      return { elapsedMs, selfMs };
    };
    try {
      const result = await openPhase.run(self, work);
      const { elapsedMs, selfMs } = finish("ok");
      const fields = { event: "startup.phase", stage, elapsedMs, selfMs, outcome: "ok" };
      if (selfMs > SLOW_PHASE_WARN_MS) logger.warn(fields, "[startup] %s took %d ms", stage, elapsedMs);
      else if (selfMs > SLOW_PHASE_INFO_MS) logger.info(fields, "[startup] %s took %d ms", stage, elapsedMs);
      else logger.debug(fields, "[startup] %s done in %d ms", stage, elapsedMs);
      return result;
    } catch (error) {
      finish("failed");
      // The innermost phase names the failure; outer phases rethrow it unchanged.
      if (error && typeof error === "object" && !failedStages.has(error)) failedStages.set(error, stage);
      throw error;
    }
  },

  /** The phase an error failed in, when it came out of startup.phase. */
  stageOf(error: unknown): string | undefined {
    return error && typeof error === "object" ? failedStages.get(error) : undefined;
  },

  phases(): readonly StartupPhaseRecord[] {
    return phases;
  },

  /** The startup.ready fields: total boot time and the five steps that took longest themselves. */
  summary() {
    return {
      event: "startup.ready",
      elapsedMs: Math.round(process.uptime() * 1000),
      phaseCount: phases.length,
      slowest: [...phases].sort((a, b) => b.selfMs - a.selfMs).slice(0, 5),
    };
  },
};
