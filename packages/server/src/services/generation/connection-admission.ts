import type { ChatCompletionResult, ChatMessage, ChatOptions, LLMUsage } from "../llm/base-provider.js";
import { BaseLLMProvider } from "../llm/base-provider.js";
import { logger } from "../../lib/logger.js";

// Admission keys identify one physical provider endpoint. Text work keys on the configured
// connection id; image work keys on the resolved base URL, because most image callers have
// no connection row in scope and unregistered foreground work would defeat the priority
// rule. The two keyspaces do not overlap.
type ConnectionState = {
  foregroundActive: number;
  backgroundActive: boolean;
  lastForegroundFinishedAt: number;
};

const states = new Map<string, ConnectionState>();
export const BACKGROUND_CONNECTION_IDLE_MS = 30_000;

export type ConnectionAttemptOutcome = "completed" | "failed";
export type ConnectionAttemptFinalizer = (outcome: ConnectionAttemptOutcome) => void | Promise<void>;
export type ConnectionAdmissionMode =
  | { kind: "foreground" }
  | {
      kind: "background";
      beforeAttempt?: () => void | ConnectionAttemptFinalizer | Promise<void | ConnectionAttemptFinalizer>;
    }
  | { kind: "none" };

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
  const state = { foregroundActive: 0, backgroundActive: false, lastForegroundFinishedAt: 0 };
  states.set(connectionId, state);
  return state;
}

export async function withForegroundConnection<T>(connectionId: string, operation: () => Promise<T>): Promise<T> {
  const release = beginForegroundConnection(connectionId);
  try {
    return await operation();
  } finally {
    release();
  }
}

export function beginForegroundConnection(connectionId: string): () => void {
  const state = stateFor(connectionId);
  state.foregroundActive += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    state.foregroundActive -= 1;
    state.lastForegroundFinishedAt = Date.now();
  };
}

export function tryBackgroundConnection(
  connectionId: string,
  at: Date,
): { acquired: false } | { acquired: true; release: () => void } {
  const state = stateFor(connectionId);
  if (
    state.backgroundActive ||
    state.foregroundActive > 0 ||
    at.getTime() - state.lastForegroundFinishedAt < BACKGROUND_CONNECTION_IDLE_MS
  ) {
    return { acquired: false };
  }
  state.backgroundActive = true;
  return {
    acquired: true,
    release: () => {
      state.backgroundActive = false;
    },
  };
}

export function resetConnectionAdmissionForTests(): void {
  states.clear();
}

async function beginConnectionAttempt(
  connectionId: string,
  mode: ConnectionAdmissionMode,
): Promise<{ release: () => void; finalize?: ConnectionAttemptFinalizer }> {
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
  attempt: { release: () => void; finalize?: ConnectionAttemptFinalizer },
  outcome: ConnectionAttemptOutcome,
): Promise<void> {
  try {
    await attempt.finalize?.(outcome);
  } catch (error) {
    if (outcome === "completed") throw new ConnectionAttemptFinalizationError(error);
    logger.error(error, "[connection-admission] Attempt accounting failed after a failed provider call");
  } finally {
    attempt.release();
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

export class ConnectionAdmissionProvider extends BaseLLMProvider {
  constructor(
    private readonly provider: BaseLLMProvider,
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
      await finalizeConnectionAttempt(attempt, outcome);
    }
  }

  async chatComplete(messages: ChatMessage[], options: ChatOptions): Promise<ChatCompletionResult> {
    return withConnectionAdmission(this.connectionId, this.mode, () => this.provider.chatComplete(messages, options));
  }

  async embed(texts: string[], model: string, signal?: AbortSignal): Promise<number[][]> {
    return withConnectionAdmission(this.connectionId, this.mode, () => this.provider.embed(texts, model, signal));
  }
}

export function withConnectionAdmissionProvider(
  provider: BaseLLMProvider,
  connectionId: string,
  mode: ConnectionAdmissionMode = { kind: "foreground" },
): BaseLLMProvider {
  return mode.kind === "none" ? provider : new ConnectionAdmissionProvider(provider, connectionId, mode);
}
