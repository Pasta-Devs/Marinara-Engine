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
export function resolveGlobalMediaGenerationWaitTimeoutMs(): number {
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
  /** Wraps the permit and the task, after the per-connection FIFO: a wait placed here (the shared GPU turn) holds
   *  neither a permit nor a place that blocks others while the request ahead on its connection still renders. */
  aroundPermit?: <R>(work: () => Promise<R>) => Promise<R>;
  /** The task is generateImage/generateVideo, which take their own shared GPU turn and permit in the right order:
   *  this call keeps only the per-connection FIFO, so nothing reserves a permit while the task waits for the GPU. */
  taskTakesPermit?: boolean;
}): Promise<T> {
  const runWithPermit = async () => {
    if (args.taskTakesPermit) return args.task();
    const releasePermit = await acquireGlobalPermit(args.signal, args.priority);
    try {
      if (args.signal?.aborted) throw mediaGenerationAbortError(args.signal);
      return await heldMediaPermit.run(true, () => args.task());
    } finally {
      releasePermit();
    }
  };
  const permitAndTask = () => (args.aroundPermit ? args.aroundPermit(runWithPermit) : runWithPermit());
  if (!args.queue) {
    if (args.signal?.aborted) throw mediaGenerationAbortError(args.signal);
    // Non-queued callers skip the per-connection FIFO but NOT the global
    // ceiling — previously they had no limit at all (#5097). This is a
    // deliberate behavior change for them.
    return permitAndTask();
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
    return await permitAndTask();
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

// ── Provider lanes ───────────────────────────────────────────────────────────
// "Queue media generation requests" means one request at a time per provider
// account, whichever feature sends it. The per-connection FIFO above only
// covers callers that opt in, so agents, trackers and capability packages
// bypassed it and providers that reject parallel work (NovelAI) still got
// overlapping requests. Lanes are entered inside generateImage itself, keyed on
// the physical endpoint plus the account (API key), so every path shares one
// line per account no matter which connection row it came through.
//
// Order vs the global ceiling: callers enter the lane first and take a permit
// inside it (invariant 1 above), so lane waiters never sit on permits. Image
// routes no longer wrap generateImage in the per-connection FIFO; video still
// passes through it, inside its lane, for callers that opt in.

let providerLanesEnabled = true;
const providerLaneTails = new Map<string, Promise<void>>();
const heldProviderLanes = new AsyncLocalStorage<ReadonlySet<string>>();

/**
 * Mirror the user's "Queue media generation requests" toggle from the synced
 * `ui` app setting (null = key removed). Anything but an explicit `false`
 * keeps the default, which is on.
 */
export function applyMediaQueueUiSettingsValue(value: string | null): void {
  let parsed: unknown = null;
  if (value) {
    try {
      parsed = JSON.parse(value);
    } catch {
      parsed = null;
    }
  }
  const flag =
    parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>).queueImageGenerationRequests
      : undefined;
  providerLanesEnabled = flag !== false;
}

/** Load the toggle at startup; app-settings writes keep it current afterwards. */
export async function loadMediaQueueUiSettings(storage: { get(key: string): Promise<string | null> }) {
  applyMediaQueueUiSettingsValue(await storage.get("ui"));
}

export function mediaProviderLanesEnabled(): boolean {
  return providerLanesEnabled;
}

// API keys are interned to opaque account numbers, so lane keys never carry a key
// (or anything derived from it) and nothing secret is hashed. The numbers only need
// to be stable while a lane is in use, so the map is emptied whenever every lane
// goes idle: no key outlives the requests that brought it in.
const mediaProviderAccountIds = new Map<string, number>();

/** One lane per provider endpoint and account. */
export function mediaProviderLaneKey(endpointKey: string, apiKey: string): string {
  const key = apiKey.trim();
  let account = 0;
  if (key && providerLanesEnabled) {
    account = mediaProviderAccountIds.get(key) ?? mediaProviderAccountIds.size + 1;
    mediaProviderAccountIds.set(key, account);
  }
  return `${endpointKey.trim() || "default"}|account-${account}`;
}

// Some providers keep their own one-at-a-time lock for a moment after they answer,
// so a request sent the instant the previous one returns can still be rejected.
// The lane stays closed for this long after each request; the caller is not held.
const MEDIA_PROVIDER_LANE_GAP_MS: Readonly<Record<string, number>> = { novelai: 1_000 };

/** Breathing room between back-to-back requests in one lane, by resolved backend. */
export function mediaProviderLaneGapMs(resolvedSource: string): number {
  return MEDIA_PROVIDER_LANE_GAP_MS[resolvedSource] ?? 0;
}

/**
 * Run `task` alone in its provider lane when the queue setting is on. Re-entrant:
 * a task that already holds this lane (a nested generateImage call) runs straight
 * through instead of waiting on itself. `gapMs` keeps the lane closed after the
 * task settles, without delaying the task's own caller.
 */
export async function runInMediaProviderLane<T>(args: {
  laneKey: string;
  task: MediaGenerationQueueTask<T>;
  signal?: AbortSignal;
  gapMs?: number;
}): Promise<T> {
  if (!providerLanesEnabled) return args.task();
  const held = heldProviderLanes.getStore();
  if (held?.has(args.laneKey)) return args.task();

  const laneKey = args.laneKey;
  const previous = providerLaneTails.get(laneKey) ?? Promise.resolve();
  let releaseCurrent: () => void = () => undefined;
  const current = new Promise<void>((resolve) => {
    releaseCurrent = resolve;
  });
  const queuedTail = previous.catch(() => undefined).then(() => current);
  providerLaneTails.set(laneKey, queuedTail);

  try {
    await waitForMediaGenerationTurn(previous, args.signal);
    if (args.signal?.aborted) throw mediaGenerationAbortError(args.signal);
    const nextHeld = new Set(held ?? []);
    nextHeld.add(laneKey);
    return await heldProviderLanes.run(nextHeld, () => args.task());
  } finally {
    const gapMs = args.gapMs ?? 0;
    if (gapMs > 0) setTimeout(releaseCurrent, gapMs);
    else releaseCurrent();
    void queuedTail.finally(() => {
      if (providerLaneTails.get(laneKey) === queuedTail) providerLaneTails.delete(laneKey);
      if (providerLaneTails.size === 0) mediaProviderAccountIds.clear();
    });
  }
}

/** Test-only: lanes with a holder or waiters. */
export function inspectMediaProviderLanesForTests() {
  return {
    activeLanes: providerLaneTails.size,
    internedAccounts: mediaProviderAccountIds.size,
    enabled: providerLanesEnabled,
  };
}
