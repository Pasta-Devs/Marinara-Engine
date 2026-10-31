// ──────────────────────────────────────────────
// Optional shared parallel cap per connection account
// ──────────────────────────────────────────────
// A row's account scope (`account:<id>`) comes from connection-rate-limit-registry. With no cap
// set (the default) acquireAccountSlot returns a no-op release synchronously, so the unshared path
// is unchanged. All rows of an account share the slots, including streaming and embedding requests.
import { getConnectionBudgetScope } from "./connection-rate-limit-registry.js";

const caps = new Map<string, number>();
const active = new Map<string, number>();
const waiters = new Map<string, Set<() => void>>();
const noop = () => undefined;

/** Cap concurrent requests across an account's rows; null/invalid clears the cap. */
export function setAccountParallelLimit(accountId: string, cap: number | null): void {
  const scope = `account:${accountId}`;
  if (typeof cap === "number" && Number.isFinite(cap) && cap > 0) caps.set(scope, Math.max(1, Math.floor(cap)));
  else caps.delete(scope);
  for (const wake of [...(waiters.get(scope) ?? [])]) wake();
}

export function resetAccountBudgetsForTests(): void {
  caps.clear();
  active.clear();
  waiters.clear();
}

/** Release function (sync when no cap applies or a slot is free), else a promise of one. */
export function acquireAccountSlot(connectionId: string, signal?: AbortSignal): (() => void) | Promise<() => void> {
  const scope = getConnectionBudgetScope(connectionId);
  const cap = scope ? caps.get(scope) : undefined;
  if (!scope || !cap) return noop;
  if (signal?.aborted) throw signal.reason ?? new Error("Aborted");
  if ((active.get(scope) ?? 0) >= cap) {
    return new Promise<void>((resolve, reject) => {
      let queue = waiters.get(scope);
      if (!queue) {
        queue = new Set();
        waiters.set(scope, queue);
      }
      const wake = () => {
        cleanup();
        resolve();
      };
      const abort = () => {
        cleanup();
        reject(signal?.reason ?? new Error("Aborted"));
      };
      const cleanup = () => {
        queue!.delete(wake);
        signal?.removeEventListener("abort", abort);
      };
      queue.add(wake);
      signal?.addEventListener("abort", abort, { once: true });
    }).then(() => acquireAccountSlot(connectionId, signal));
  }
  active.set(scope, (active.get(scope) ?? 0) + 1);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const count = (active.get(scope) ?? 1) - 1;
    if (count) active.set(scope, count);
    else active.delete(scope);
    for (const wake of [...(waiters.get(scope) ?? [])]) wake();
    if (!waiters.get(scope)?.size) waiters.delete(scope);
  };
}
