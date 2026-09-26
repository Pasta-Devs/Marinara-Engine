// ──────────────────────────────────────────────
// Log context: fields every line in one unit of work should carry
// ──────────────────────────────────────────────
// The shared logger (lib/logger.ts) reads this through a Pino mixin, so a
// plain `logger.warn(err, "...")` deep inside a service picks up the
// requestId of the HTTP request that caused it without that id being
// threaded through every call.
//
// This module deliberately imports only node built-ins so logger.ts can use
// it without an import cycle.
// ──────────────────────────────────────────────
import { AsyncLocalStorage } from "node:async_hooks";

/** Flat, primitive fields only: they are copied onto every log line. */
export interface LogContext {
  requestId?: string;
  /** The matched route pattern, set once the body is parsed. */
  route?: string;
  [field: string]: string | number | boolean | undefined;
}

const storage = new AsyncLocalStorage<LogContext>();

/** The context of the current async execution, or undefined outside any. */
export function getLogContext(): LogContext | undefined {
  return storage.getStore();
}

/**
 * Runs `fn` in a fresh context that does not inherit the caller's. Used at the
 * start of a request, and by timers or pollers that must not keep the
 * requestId of whatever request happened to start them.
 */
export function runWithRootLogContext<T>(context: LogContext, fn: () => T): T {
  return storage.run({ ...context }, fn);
}

type BindingsSource = { bindings?: () => Record<string, unknown> };

// log.bindings() JSON.parses the logger's bindings on every call, so the bound
// keys are read once per logger. Loggers here get their bindings when they are
// created (Fastify makes one child per request); a later setBindings() on the
// same logger is not seen, which at worst prints a context field twice.
const boundKeysByLogger = new WeakMap<object, ReadonlySet<string>>();

function boundKeys(log: BindingsSource | undefined): ReadonlySet<string> | undefined {
  if (!log || typeof log.bindings !== "function") return undefined;
  let keys = boundKeysByLogger.get(log);
  if (!keys) {
    keys = new Set(Object.keys(log.bindings()));
    boundKeysByLogger.set(log, keys);
  }
  return keys;
}

/**
 * Pino mixin. Returns the current context minus keys the logger already
 * binds (pino passes the logger as the third argument), so a Fastify request
 * child that already has `requestId` does not print it twice.
 */
export function logContextMixin(_mergeObject: object, _level: number, log?: BindingsSource): Record<string, unknown> {
  const context = storage.getStore();
  if (!context) return {};
  const bound = boundKeys(log);
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(context)) {
    if (value === undefined) continue;
    if (bound?.has(key)) continue;
    out[key] = value;
  }
  return out;
}

/**
 * True for a user stop, a closed client or an aborted signal: an expected
 * outcome that belongs at info, not error.
 */
export function isCancellation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { name?: unknown; code?: unknown };
  if (candidate.name === "AbortError" || candidate.code === "ABORT_ERR") return true;
  // AbortSignal.timeout() rejects with a TimeoutError; that is a failure, not a cancellation.
  return false;
}

/** The level to log a failure at: "info" for cancellations, otherwise `fallback`. */
export function failureLevel<L extends "error" | "warn">(error: unknown, fallback: L): L | "info";
export function failureLevel(error: unknown): "error" | "info";
export function failureLevel(error: unknown, fallback: "error" | "warn" = "error"): "error" | "warn" | "info" {
  return isCancellation(error) ? "info" : fallback;
}
