import { AsyncLocalStorage } from "node:async_hooks";
import type { FastifyInstance } from "fastify";
import { logger } from "./logger.js";

/**
 * Fastify boots the whole instance on the first `inject()` call: after that no route, hook or plugin can be added.
 * Startup registers routes for a while (capability packages activate one by one), and background work started early
 * in that window (continuity workers, package timers calling their internal routes) could call `inject()` and freeze
 * registration half way, so later packages failed with "Root plugin has already booted" and the next `addHook` threw
 * and killed the process. This holds every `inject()` made before registration ends and releases them afterwards.
 *
 * A call that registration itself waits for must not be held, or startup would never finish. Two guards cover that:
 * - Code that registration awaits and that may reach `inject()` (a capability package's `activate()` and
 *   `selfCheck()`) runs inside `failInjectFastDuring`. An `inject()` from there fails at once with
 *   `InjectDuringRegistrationError` instead of waiting, so only that package fails to activate and startup goes on.
 * - Any other held call is rejected with the same error after `maxHoldMs`, with a warning (and its stack) first
 *   after `warnAfterMs`. Startup then fails loudly instead of hanging.
 */
export class InjectDuringRegistrationError extends Error {
  readonly code = "MARINARA_INJECT_DURING_REGISTRATION";
  constructor(message: string) {
    super(message);
    this.name = "InjectDuringRegistrationError";
  }
}

type FailFastScope = { active: boolean };
const failFastScope = new AsyncLocalStorage<FailFastScope>();

/**
 * Runs `operation` so that a held `inject()` it makes while it is running fails at once instead of waiting for the
 * end of registration. Timers it starts that fire after it has settled are held normally.
 */
export async function failInjectFastDuring<T>(operation: () => Promise<T> | T): Promise<T> {
  const scope: FailFastScope = { active: true };
  try {
    return await failFastScope.run(scope, operation);
  } finally {
    scope.active = false;
  }
}

export type InjectGateOptions = {
  /** Log a warning, with the caller's stack, for a call still held after this long. */
  warnAfterMs?: number;
  /** Reject a call still held after this long, so startup cannot hang on it. */
  maxHoldMs?: number;
};

export function holdInjectUntilRegistered(app: FastifyInstance, options: InjectGateOptions = {}): () => void {
  const warnAfterMs = options.warnAfterMs ?? 60_000;
  const maxHoldMs = options.maxHoldMs ?? 10 * 60_000;
  const originalInject = app.inject.bind(app) as (...args: unknown[]) => unknown;
  let released = false;
  let release: () => void = () => undefined;
  const registered = new Promise<void>((resolve) => {
    release = resolve;
  });

  const gatedInject = (...args: unknown[]): unknown => {
    if (released || args.length === 0) return originalInject(...args);
    const callback = typeof args[1] === "function" ? (args[1] as (error: unknown) => void) : null;
    if (failFastScope.getStore()?.active) {
      const error = new InjectDuringRegistrationError(
        "app.inject() cannot run while startup is still registering routes; call internal routes after activate() and selfCheck() return",
      );
      if (callback) {
        queueMicrotask(() => callback(error));
        return undefined;
      }
      return Promise.reject(error);
    }
    const stack = new Error("inject() called before startup registration finished").stack;
    const held = new Promise<void>((resolve, reject) => {
      const warning = setTimeout(() => {
        logger.warn({ stack }, "[startup] An internal request is still waiting for route registration to finish");
      }, warnAfterMs);
      const limit = setTimeout(() => {
        reject(
          new InjectDuringRegistrationError(
            `app.inject() waited ${maxHoldMs} ms for startup registration to finish and was cancelled`,
          ),
        );
      }, maxHoldMs);
      warning.unref?.();
      limit.unref?.();
      void registered.then(() => {
        clearTimeout(warning);
        clearTimeout(limit);
        resolve();
      });
    });
    if (callback) {
      held.then(
        () => {
          // A synchronous throw would otherwise become an unhandled rejection instead of reaching the caller.
          try {
            originalInject(...args);
          } catch (error) {
            callback(error);
          }
        },
        (error: unknown) => callback(error),
      );
      return undefined;
    }
    return held.then(() => originalInject(...args));
  };
  (app as unknown as { inject: typeof gatedInject }).inject = gatedInject;

  return () => {
    if (released) return;
    released = true;
    release();
  };
}
