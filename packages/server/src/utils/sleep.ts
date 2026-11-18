import { setTimeout as delay } from "node:timers/promises";

/** Wait `ms`; an aborted `signal` rejects with an `AbortError` and clears the timer. */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return delay(ms, undefined, signal ? { signal } : undefined);
}
