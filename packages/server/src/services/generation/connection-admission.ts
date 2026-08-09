import type { ChatCompletionResult, ChatMessage, ChatOptions, LLMUsage } from "../llm/base-provider.js";
import { BaseLLMProvider } from "../llm/base-provider.js";
import { logger } from "../../lib/logger.js";

// Admission keys identify one physical provider endpoint. Text work keys on the configured
// connection id; image work keys on the resolved base URL plus the endpoint id where the
// backend needs one, because most image callers have no connection row in scope and
// unregistered foreground work would defeat the priority rule. The keyspaces do not overlap.
type ConnectionState = {
  foregroundActive: number;
  backgroundActive: boolean;
  lastForegroundFinishedAt: number;
  consecutiveBackgroundFailures: number;
  backgroundQuarantinedUntil: number;
};

const states = new Map<string, ConnectionState>();
export const BACKGROUND_CONNECTION_IDLE_MS = 30_000;
export const BACKGROUND_CONNECTION_FAILURE_THRESHOLD = 3;
export const BACKGROUND_CONNECTION_FAILURE_COOLDOWN_MS = 6 * 60 * 60 * 1000;

export type ConnectionAttemptOutcome = "completed" | "failed";
export type ConnectionAttemptFinalizer = (outcome: ConnectionAttemptOutcome) => void | Promise<void>;
export type ConnectionAdmissionMode =
  | { kind: "foreground" }
  | {
      kind: "background";
      beforeAttempt?: () => void | ConnectionAttemptFinalizer | Promise<void | ConnectionAttemptFinalizer>;
    }
  /**
   * A call that is a step inside someone else's attempt rather than an attempt of its own. It
   * takes no slot and leaves no foreground stamp, because the work it feeds is already admitted
   * and would otherwise be refused by its own preparation.
   */
  | { kind: "none" };

/**
 * Marks a request the server issued to itself on a scheduler's behalf. Background admission is
 * strictly self-limiting — it can only make the caller yield — so an outside client setting this
 * gains nothing; it is a routing hint, not a privilege.
 */
export const AUTOMATIC_GENERATION_HEADER = "x-marinara-automatic-generation";

export function admissionModeForRequest(headers: Record<string, unknown>): ConnectionAdmissionMode {
  return headers[AUTOMATIC_GENERATION_HEADER] === "1" ? { kind: "background" } : { kind: "foreground" };
}

export class BackgroundConnectionBusyError extends Error {
  constructor(readonly connectionId: string) {
    super(`Connection ${connectionId} is not available for background generation.`);
    this.name = "BackgroundConnectionBusyError";
  }
}

export class ConnectionAttemptRejectedError extends Error {
  constructor(readonly cause: unknown) {
    super("Connection attempt was rejected before provider work started.", { cause });
    this.name = "ConnectionAttemptRejectedError";
  }
}

export class ConnectionAttemptFinalizationError extends Error {
  constructor(readonly cause: unknown) {
    super("Connection attempt accounting failed after provider work finished.", { cause });
    this.name = "ConnectionAttemptFinalizationError";
  }
}

export function isConnectionAdmissionFailure(error: unknown): boolean {
  return (
    error instanceof BackgroundConnectionBusyError ||
    error instanceof ConnectionAttemptRejectedError ||
    error instanceof ConnectionAttemptFinalizationError
  );
}

function stateFor(connectionId: string): ConnectionState {
  const existing = states.get(connectionId);
  if (existing) return existing;
  const state = {
    foregroundActive: 0,
    backgroundActive: false,
    lastForegroundFinishedAt: 0,
    consecutiveBackgroundFailures: 0,
    backgroundQuarantinedUntil: 0,
  };
  states.set(connectionId, state);
  return state;
}

function recordConnectionOutcome(state: ConnectionState, outcome: ConnectionAttemptOutcome | undefined) {
  if (outcome === "completed") {
    state.consecutiveBackgroundFailures = 0;
    state.backgroundQuarantinedUntil = 0;
    return;
  }
  if (outcome !== "failed") return;
  state.consecutiveBackgroundFailures += 1;
  if (state.consecutiveBackgroundFailures >= BACKGROUND_CONNECTION_FAILURE_THRESHOLD) {
    state.backgroundQuarantinedUntil = Date.now() + BACKGROUND_CONNECTION_FAILURE_COOLDOWN_MS;
  }
}

export function beginForegroundConnection(connectionId: string): (outcome?: ConnectionAttemptOutcome) => void {
  const state = stateFor(connectionId);
  state.foregroundActive += 1;
  let released = false;
  return (outcome) => {
    if (released) return;
    released = true;
    state.foregroundActive -= 1;
    state.lastForegroundFinishedAt = Date.now();
    if (outcome === "completed") recordConnectionOutcome(state, outcome);
  };
}

export function tryBackgroundConnection(
  connectionId: string,
  at: Date,
): { acquired: false } | { acquired: true; release: (outcome?: ConnectionAttemptOutcome) => void } {
  const state = stateFor(connectionId);
  if (
    state.backgroundActive ||
    state.foregroundActive > 0 ||
    at.getTime() < state.backgroundQuarantinedUntil ||
    at.getTime() - state.lastForegroundFinishedAt < BACKGROUND_CONNECTION_IDLE_MS
  ) {
    return { acquired: false };
  }
  state.backgroundActive = true;
  let released = false;
  return {
    acquired: true,
    release: (outcome) => {
      if (released) return;
      released = true;
      state.backgroundActive = false;
      recordConnectionOutcome(state, outcome);
    },
  };
}

export function resetConnectionAdmissionForTests(): void {
  states.clear();
}

async function beginConnectionAttempt(
  connectionId: string,
  mode: ConnectionAdmissionMode,
): Promise<{ release: (outcome?: ConnectionAttemptOutcome) => void; finalize?: ConnectionAttemptFinalizer }> {
  if (mode.kind === "none") return { release: () => undefined };
  if (mode.kind === "foreground") return { release: beginForegroundConnection(connectionId) };

  const admission = tryBackgroundConnection(connectionId, new Date());
  if (!admission.acquired) throw new BackgroundConnectionBusyError(connectionId);
  try {
    return { release: admission.release, finalize: (await mode.beforeAttempt?.()) || undefined };
  } catch (error) {
    admission.release();
    throw new ConnectionAttemptRejectedError(error);
  }
}

/**
 * Record the attempt outcome without letting accounting failures overwrite a provider
 * error: the operation's own failure is what the caller (and the fallback chain) needs to
 * see. A finalization failure only surfaces when the operation itself succeeded.
 */
async function finalizeConnectionAttempt(
  attempt: { release: (outcome?: ConnectionAttemptOutcome) => void; finalize?: ConnectionAttemptFinalizer },
  outcome: ConnectionAttemptOutcome,
): Promise<void> {
  try {
    await attempt.finalize?.(outcome);
  } catch (error) {
    if (outcome === "completed") throw new ConnectionAttemptFinalizationError(error);
    logger.error(error, "[connection-admission] Attempt accounting failed after a failed provider call");
  } finally {
    attempt.release(outcome);
  }
}

export async function withConnectionAdmission<T>(
  connectionId: string,
  mode: ConnectionAdmissionMode,
  operation: () => Promise<T>,
): Promise<T> {
  const attempt = await beginConnectionAttempt(connectionId, mode);
  let outcome: ConnectionAttemptOutcome = "failed";
  try {
    const result = await operation();
    outcome = "completed";
    return result;
  } finally {
    await finalizeConnectionAttempt(attempt, outcome);
  }
}

/**
 * Split one logical attempt across a primary and its fallback connection. `beforeAttempt` books
 * the attempt against a quota and hands back the finalizer that closes it out; falling back is a
 * retry of that same logical attempt, so it must be booked once (on the primary) and reported
 * once (by `settle`, after the whole chain finishes). Without this the primary's own finalizer
 * fires `failed` before the fallback even starts and a successful fallback stays recorded as a
 * failure. Each connection still takes its own physical slot, which is what the modes carry.
 *
 * No leg's own outcome is trusted, because no leg knows the chain's result: an empty-but-
 * successful primary is a `completed` leg inside an attempt that produced nothing, and a
 * rejection raised between legs never reaches a leg finalizer at all. Only the caller driving
 * the chain knows whether the logical attempt delivered, so it passes the outcome to `settle`.
 */
export function splitConnectionAttemptAcrossFallback(mode: ConnectionAdmissionMode): {
  primaryMode: ConnectionAdmissionMode;
  fallbackMode: ConnectionAdmissionMode;
  settle: (outcome: ConnectionAttemptOutcome) => Promise<void>;
} {
  if (mode.kind !== "background" || !mode.beforeAttempt) {
    return { primaryMode: mode, fallbackMode: mode, settle: async () => {} };
  }
  const book = mode.beforeAttempt;
  let finalize: ConnectionAttemptFinalizer | undefined;
  const noopLegFinalizer: ConnectionAttemptFinalizer = () => undefined;
  return {
    primaryMode: {
      kind: "background",
      beforeAttempt: async () => {
        finalize = (await book()) || undefined;
        return noopLegFinalizer;
      },
    },
    // The fallback takes its own physical slot but books nothing: it is a retry of the attempt
    // the primary already booked.
    fallbackMode: { kind: "background" },
    settle: async (outcome) => {
      const pending = finalize;
      // A rejected primary never booked anything, and settle must stay idempotent because a
      // stream can be closed more than once.
      finalize = undefined;
      try {
        await pending?.(outcome);
      } catch (error) {
        logger.error(error, "[connection-admission] Attempt accounting failed after a fallback chain");
      }
    },
  };
}

export class ConnectionAdmissionProvider extends BaseLLMProvider {
  constructor(
    readonly provider: BaseLLMProvider,
    private readonly connectionId: string,
    private readonly mode: ConnectionAdmissionMode = { kind: "foreground" },
  ) {
    super("", "", provider.maxContextValue ?? undefined, null, provider.maxTokensOverrideValue);
  }

  async *chat(messages: ChatMessage[], options: ChatOptions): AsyncGenerator<string, LLMUsage | void, unknown> {
    const attempt = await beginConnectionAttempt(this.connectionId, this.mode);
    let outcome: ConnectionAttemptOutcome = "failed";
    try {
      const result = yield* this.provider.chat(messages, options);
      outcome = "completed";
      return result;
    } finally {
      // A stream's finally runs after its tokens already reached the consumer, so a late
      // accounting failure has nothing left to protect and would only destroy a generation
      // that succeeded. Non-streaming callers still surface it via withConnectionAdmission.
      try {
        await finalizeConnectionAttempt(attempt, outcome);
      } catch (error) {
        logger.error(error, "[connection-admission] Attempt accounting failed after a streamed call");
      }
    }
  }

  async chatComplete(messages: ChatMessage[], options: ChatOptions): Promise<ChatCompletionResult> {
    return withConnectionAdmission(this.connectionId, this.mode, () => this.provider.chatComplete(messages, options));
  }

  async embed(texts: string[], model: string, signal?: AbortSignal): Promise<number[][]> {
    return withConnectionAdmission(this.connectionId, this.mode, () => this.provider.embed(texts, model, signal));
  }
}

/**
 * Look through the admission decorator to the provider that actually talks to the backend.
 * Diagnostics that report a provider class need the concrete one, not the wrapper.
 */
export function unwrapConnectionAdmissionProvider(provider: BaseLLMProvider): BaseLLMProvider {
  return provider instanceof ConnectionAdmissionProvider ? provider.provider : provider;
}

export function withConnectionAdmissionProvider(
  provider: BaseLLMProvider,
  connectionId: string,
  mode: ConnectionAdmissionMode = { kind: "foreground" },
): BaseLLMProvider {
  return mode.kind === "none" ? provider : new ConnectionAdmissionProvider(provider, connectionId, mode);
}
