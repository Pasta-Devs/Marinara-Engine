import { AsyncLocalStorage } from "node:async_hooks";
import { DEFAULT_MEDIA_GENERATION_CONCURRENCY } from "@marinara-engine/shared";
import { logger } from "../../lib/logger.js";

type MediaGenerationQueueTask<T> = () => Promise<T>;
export type MediaGenerationPriority = "foreground" | "background";

const mediaGenerationQueueTails = new Map<string, Promise<void>>();

// ── Global concurrency ceiling (#5097) ───────────────────────────────────────
// Applies IN ADDITION to the per-connection FIFO below, and — unlike the FIFO —
// to every caller. The invariants that keep it hang-proof (a leaked or
// deadlocked permit stalls ALL generation silently, the worst available
// failure mode):
//   1. the permit is acquired AFTER the per-connection turn, never before, so
//      the two queues cannot hold each other in a cycle;
//   2. release happens in `finally` on every path and is idempotent;
//   3. a task that RE-ENTERS this module while holding a permit (the video
//      fallback hop, generateImage's self-wrap under an outer caller wrapper)
//      is detected via AsyncLocalStorage and reuses the held permit — a second
//      acquire would self-deadlock at low limits;
//   4. waits are bounded: a waiter times out with a clear error instead of
//      parking forever behind a hung provider call;
//   5. background work never occupies the last permit (when the limit allows),
//      so interactive generation cannot be fully starved by batches — the
//      foreground/background split mirrors the connection-admission design.
const heldMediaPermit = new AsyncLocalStorage<true>();
let warnedInvalidConcurrencyEnv = false;

function parseStrictNonNegativeInt(raw: string): number | null {
  return /^\d+$/.test(raw) ? Number.parseInt(raw, 10) : null;
}

/** `0` is the explicit opt-out (unlimited); invalid values warn once and use the default. */
function resolveGlobalMediaGenerationLimit(): number {
  const raw = (process.env.MARINARA_MEDIA_GENERATION_CONCURRENCY ?? "").trim();
  if (!raw) return DEFAULT_MEDIA_GENERATION_CONCURRENCY;
  const value = parseStrictNonNegativeInt(raw);
  if (value === null) {
    if (!warnedInvalidConcurrencyEnv) {
      warnedInvalidConcurrencyEnv = true;
      logger.warn(
        "Ignoring invalid MARINARA_MEDIA_GENERATION_CONCURRENCY value %s; using the default of %d",
        raw,
        DEFAULT_MEDIA_GENERATION_CONCURRENCY,
      );
    }
    return DEFAULT_MEDIA_GENERATION_CONCURRENCY;
  }
  return value === 0 ? Number.POSITIVE_INFINITY : value;
}

const DEFAULT_MEDIA_GENERATION_WAIT_TIMEOUT_MS = 10 * 60 * 1000;
let warnedInvalidWaitTimeoutEnv = false;

/** Bound on how long a caller may WAIT for a permit (`0` disables the bound); invalid values
 *  warn once and use the default, matching `resolveGlobalMediaGenerationLimit`. */
function resolveGlobalMediaGenerationWaitTimeoutMs(): number {
  const raw = (process.env.MARINARA_MEDIA_GENERATION_WAIT_TIMEOUT_MS ?? "").trim();
  if (!raw) return DEFAULT_MEDIA_GENERATION_WAIT_TIMEOUT_MS;
  const value = parseStrictNonNegativeInt(raw);
  if (value === null) {
    if (!warnedInvalidWaitTimeoutEnv) {
      warnedInvalidWaitTimeoutEnv = true;
      logger.warn(
        "Ignoring invalid MARINARA_MEDIA_GENERATION_WAIT_TIMEOUT_MS value %s; using the default of %dms",
        raw,
        DEFAULT_MEDIA_GENERATION_WAIT_TIMEOUT_MS,
      );
    }
    return DEFAULT_MEDIA_GENERATION_WAIT_TIMEOUT_MS;
  }
  return value === 0 ? Number.POSITIVE_INFINITY : value;
}

interface GlobalPermitWaiter {
  grant: () => void;
  fail: (error: Error) => void;
}

let activeGlobalPermits = 0;
const foregroundPermitWaiters: GlobalPermitWaiter[] = [];
const backgroundPermitWaiters: GlobalPermitWaiter[] = [];

/** Background work may use at most limit-1 slots (but always at least one). */
function backgroundPermitCapacity(limit: number): number {
  return Number.isFinite(limit) ? Math.max(1, limit - 1) : limit;
}

/** Grants as many parked waiters as the CURRENT limit allows, foreground first.
 *  Called on every release and every acquire, so a live limit raise wakes
 *  parked waiters and a live lower converges as in-flight tasks complete. */
function pumpGlobalPermitWaiters(): void {
  const limit = resolveGlobalMediaGenerationLimit();
  while (activeGlobalPermits < limit && foregroundPermitWaiters.length > 0) {
    activeGlobalPermits += 1;
    foregroundPermitWaiters.shift()!.grant();
  }
  const backgroundCap = backgroundPermitCapacity(limit);
  while (activeGlobalPermits < backgroundCap && backgroundPermitWaiters.length > 0) {
    activeGlobalPermits += 1;
    backgroundPermitWaiters.shift()!.grant();
  }
}

function releaseGlobalPermit(): void {
  if (activeGlobalPermits <= 0) {
    // The idempotent release wrapper should make this unreachable; if it ever
    // fires there is an accounting bug that must announce itself.
    logger.warn("Media generation permit released more times than acquired — permit accounting bug");
    activeGlobalPermits = 0;
  } else {
    activeGlobalPermits -= 1;
  }
  pumpGlobalPermitWaiters();
}

async function acquireGlobalPermit(
  signal?: AbortSignal,
  priority: MediaGenerationPriority = "foreground",
): Promise<() => void> {
  // Re-entrant call under a held permit (invariant 3): the parent's permit
  // covers this work; a no-op release keeps the caller's finally harmless.
  if (heldMediaPermit.getStore()) return () => undefined;
  if (signal?.aborted) throw mediaGenerationAbortError(signal);
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    releaseGlobalPermit();
  };
  // Wake anyone a live limit-raise has stranded before judging our own turn.
  pumpGlobalPermitWaiters();
  const limit = resolveGlobalMediaGenerationLimit();
  const capacity = priority === "background" ? backgroundPermitCapacity(limit) : limit;
  const mustQueue =
    foregroundPermitWaiters.length > 0 || (priority === "background" && backgroundPermitWaiters.length > 0);
  if (!mustQueue && activeGlobalPermits < capacity) {
    activeGlobalPermits += 1;
    return release;
  }
  const waiters = priority === "background" ? backgroundPermitWaiters : foregroundPermitWaiters;
  await new Promise<void>((resolve, reject) => {
    let timer: NodeJS.Timeout | null = null;
    const cleanup = () => {
      if (signal) signal.removeEventListener("abort", onAbort);
      if (timer) clearTimeout(timer);
    };
    const waiter: GlobalPermitWaiter = {
      grant: () => {
        cleanup();
        resolve();
      },
      fail: (error: Error) => {
        cleanup();
        reject(error);
      },
    };
    const removeSelf = () => {
      const index = waiters.indexOf(waiter);
      if (index >= 0) waiters.splice(index, 1);
    };
    const onAbort = () => {
      removeSelf();
      waiter.fail(mediaGenerationAbortError(signal!));
    };
    if (signal) signal.addEventListener("abort", onAbort, { once: true });
    const timeoutMs = resolveGlobalMediaGenerationWaitTimeoutMs();
    if (Number.isFinite(timeoutMs)) {
      timer = setTimeout(() => {
        removeSelf();
        logger.warn(
          "Media generation request timed out after waiting %dms for a concurrency permit (%d in flight)",
          timeoutMs,
          activeGlobalPermits,
        );
        waiter.fail(
          new Error(
            `Media generation queue is saturated: waited ${Math.round(timeoutMs / 1000)}s for one of ` +
              `${resolveGlobalMediaGenerationLimit()} concurrency slots. Retry later, or raise ` +
              `MARINARA_MEDIA_GENERATION_CONCURRENCY if your provider can take more parallel requests.`,
          ),
        );
      }, timeoutMs);
      timer.unref?.();
    }
    waiters.push(waiter);
  });
  return release;
}

/** Test-only: waits for a quiescent queue would race; expose the counters. */
export function inspectMediaGenerationConcurrencyForTests() {
  return {
    activeGlobalPermits,
    queuedWaiters: foregroundPermitWaiters.length + backgroundPermitWaiters.length,
    foregroundWaiters: foregroundPermitWaiters.length,
    backgroundWaiters: backgroundPermitWaiters.length,
  };
}

function mediaGenerationAbortError(signal: AbortSignal): Error {
  return signal.reason instanceof Error ? signal.reason : new Error("Media generation request aborted");
}

async function waitForMediaGenerationTurn(previous: Promise<void>, signal?: AbortSignal): Promise<void> {
  const settledPrevious = previous.catch(() => undefined);
  if (!signal) {
    await settledPrevious;
    return;
  }
  if (signal.aborted) throw mediaGenerationAbortError(signal);

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener("abort", onAbort);
      callback();
    };
    const onAbort = () => finish(() => reject(mediaGenerationAbortError(signal)));

    signal.addEventListener("abort", onAbort, { once: true });
    void settledPrevious.then(() => finish(resolve));
  });
}

/**
 * Serialize media provider requests per configured connection when the caller's
 * global queue preference is enabled. Callers that disable the preference
 * bypass the queue entirely, while queued callers retain FIFO ordering.
 */
export async function runMediaGenerationRequest<T>(args: {
  connectionKey: string;
  queue: boolean;
  task: MediaGenerationQueueTask<T>;
  signal?: AbortSignal;
  /** Batch/automatic work should pass "background" so it can never occupy the
   *  last permit ahead of interactive requests. Defaults to foreground. */
  priority?: MediaGenerationPriority;
}): Promise<T> {
  if (!args.queue) {
    if (args.signal?.aborted) throw mediaGenerationAbortError(args.signal);
    // Non-queued callers skip the per-connection FIFO but NOT the global
    // ceiling — previously they had no limit at all (#5097). This is a
    // deliberate behavior change for them.
    const releasePermit = await acquireGlobalPermit(args.signal, args.priority);
    try {
      if (args.signal?.aborted) throw mediaGenerationAbortError(args.signal);
      return await heldMediaPermit.run(true, () => args.task());
    } finally {
      releasePermit();
    }
  }

  const connectionKey = args.connectionKey.trim() || "default";
  const previous = mediaGenerationQueueTails.get(connectionKey) ?? Promise.resolve();
  let releaseCurrent: () => void = () => undefined;
  const current = new Promise<void>((resolve) => {
    releaseCurrent = resolve;
  });
  const queuedTail = previous.catch(() => undefined).then(() => current);
  mediaGenerationQueueTails.set(connectionKey, queuedTail);

  try {
    await waitForMediaGenerationTurn(previous, args.signal);
    if (args.signal?.aborted) throw mediaGenerationAbortError(args.signal);
    // Invariant: the global permit is acquired AFTER the per-connection turn,
    // never before — otherwise a full permit pool could be held by tasks that
    // are themselves waiting on connection turns held behind the pool.
    const releasePermit = await acquireGlobalPermit(args.signal, args.priority);
    try {
      if (args.signal?.aborted) throw mediaGenerationAbortError(args.signal);
      return await heldMediaPermit.run(true, () => args.task());
    } finally {
      releasePermit();
    }
  } finally {
    releaseCurrent();
    void queuedTail.finally(() => {
      if (mediaGenerationQueueTails.get(connectionKey) === queuedTail) {
        mediaGenerationQueueTails.delete(connectionKey);
      }
    });
  }
}

/** Backward-compatible image-specific entry point for existing callers. */
export const runImageGenerationRequest = runMediaGenerationRequest;
