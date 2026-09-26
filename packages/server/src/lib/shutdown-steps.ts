import { logger } from "./logger.js";

/**
 * Shutdown stops background runtimes before closing the file store. A runtime
 * whose stop() never settles (a worker waiting on a hung model call, say) can
 * hold the store close hostage: the process force-exits at the shutdown
 * deadline (see shutdown-deadline.ts), and if closeDB() has not run by then the
 * debounced writes are lost. SHUTDOWN_RUNTIME_STOP_BUDGET_MS (opt-in) gives the
 * stop phase its own budget inside the force-exit deadline so the store close
 * always runs after it. Unset, the stops are awaited in full, as before.
 */

/** No budget: wait for every runtime stop to settle (the default). */
export const UNBOUNDED_RUNTIME_STOP_BUDGET_MS = Number.POSITIVE_INFINITY;

/**
 * Time kept free after the runtime stops for the rest of onClose: queued
 * transactions, the final store flush and the writer lease release. Every
 * shutdown deadline pair must leave at least this much after the connection
 * cut and the runtime stop budget.
 */
export const STORE_CLOSE_RESERVE_MS = 1_500;

let activeRuntimeStopBudgetMs = UNBOUNDED_RUNTIME_STOP_BUDGET_MS;

/** The runtime stop budget for the shutdown in progress. */
export function getRuntimeStopBudgetMs(): number {
  return activeRuntimeStopBudgetMs;
}

/**
 * Tightens (or restores) the runtime stop budget before app.close() runs, so
 * a shutdown with a short force-exit deadline (a Windows console close) still
 * leaves the store close its reserve.
 */
export function setRuntimeStopBudgetMs(budgetMs: number = UNBOUNDED_RUNTIME_STOP_BUDGET_MS): void {
  activeRuntimeStopBudgetMs = Number.isNaN(budgetMs) ? UNBOUNDED_RUNTIME_STOP_BUDGET_MS : Math.max(0, budgetMs);
}

export interface NamedShutdownStep {
  name: string;
  run: () => unknown;
}

export interface ShutdownStepRecord {
  stage: string;
  elapsedMs: number;
  /** A step still pending at the budget is "failed" with reason "timeout". */
  outcome: "ok" | "failed";
  reason?: "timeout";
  /** Set with reason "timeout": the budget the step overran. */
  timeoutMs?: number;
}

export interface ShutdownStepsOptions {
  /**
   * Called when a step that already timed out rejects later. Defaults to a
   * warn line so the late error is recorded, not lost.
   */
  onLateFailure?: (name: string, reason: unknown, elapsedMs: number) => void;
}

function logLateShutdownFailure(name: string, reason: unknown, elapsedMs: number): void {
  logger.warn(
    { err: reason, stage: name, elapsedMs },
    "[shutdown] %s failed after its stop budget had already run out",
    name,
  );
}

export interface ShutdownStepsResult {
  failed: Array<{ name: string; reason: unknown; elapsedMs: number }>;
  /** Steps still pending when the budget ran out; they keep running detached. */
  timedOut: string[];
  /** One record per step, in step order. */
  records: ShutdownStepRecord[];
}

/**
 * Runs every step concurrently (like the Promise.allSettled it replaces) and
 * returns once all have settled. With a finite `budgetMs` it returns once all
 * have settled OR `budgetMs` has passed, whichever is first.
 * Steps still pending keep running detached; a later rejection from one of
 * them goes to `onLateFailure` instead of becoming an unhandled rejection.
 */
export async function runShutdownStepsWithin(
  steps: NamedShutdownStep[],
  budgetMs: number = getRuntimeStopBudgetMs(),
  options: ShutdownStepsOptions = {},
): Promise<ShutdownStepsResult> {
  const onLateFailure = options.onLateFailure ?? logLateShutdownFailure;
  const started = performance.now();
  let budgetSpent = false;
  const failed: ShutdownStepsResult["failed"] = [];
  const outcomes = new Map<string, ShutdownStepRecord>();
  const settled = Promise.all(
    steps.map(async (step) => {
      const stepStarted = performance.now();
      try {
        await step.run();
        outcomes.set(step.name, {
          stage: step.name,
          elapsedMs: Math.round(performance.now() - stepStarted),
          outcome: "ok",
        });
      } catch (reason) {
        const elapsedMs = Math.round(performance.now() - stepStarted);
        if (budgetSpent) {
          // The caller already reported this step as timed out and moved on;
          // log the late error instead of dropping it.
          try {
            onLateFailure(step.name, reason, elapsedMs);
          } catch (reportError) {
            // The logger itself threw; fall back to a process warning (stderr)
            // instead of an unhandled rejection, so the failure stays visible.
            process.emitWarning(
              `Shutdown step ${step.name} failed after its timeout and could not be logged: ${String(reportError)}`,
              "MarinaraShutdownWarning",
            );
          }
          return;
        }
        failed.push({ name: step.name, reason, elapsedMs });
        outcomes.set(step.name, { stage: step.name, elapsedMs, outcome: "failed" });
      }
    }),
  );
  let timer: NodeJS.Timeout | undefined;
  const budget = Number.isFinite(budgetMs)
    ? new Promise<void>((resolve) => {
        // Referenced on purpose: a hung step holding no handles must not let the
        // loop drain before the store close after this gets its turn.
        timer = setTimeout(resolve, budgetMs);
      })
    : null;
  try {
    await (budget ? Promise.race([settled, budget]) : settled);
  } finally {
    clearTimeout(timer);
    budgetSpent = true;
  }
  const waitedMs = Math.round(performance.now() - started);
  const timedOut: string[] = [];
  const records = steps.map((step) => {
    const record = outcomes.get(step.name);
    if (record) return record;
    timedOut.push(step.name);
    const timeoutRecord: ShutdownStepRecord = {
      stage: step.name,
      elapsedMs: waitedMs,
      outcome: "failed",
      reason: "timeout",
      timeoutMs: budgetMs,
    };
    return timeoutRecord;
  });
  return { failed: [...failed], timedOut, records };
}
