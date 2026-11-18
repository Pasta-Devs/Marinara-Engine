// ──────────────────────────────────────────────
// Optional shared parallel cap per connection account
// ──────────────────────────────────────────────
// A row's account scope (`account:<id>`) comes from connection-rate-limit-registry. With no cap
// set (the default) acquireAccountSlot returns a no-op release synchronously, so the unshared path
// is unchanged. All rows of an account share the slots, including streaming and embedding requests.
//
// When the slots are full, waiting requests go in the same order as on the built-in model:
// agents that must finish before the reply, then the reply, then agents beside or after it,
// then everything else (see local-model-priority.ts). With two or more slots the lower two
// keep one free, so a long tracker run never makes the reply wait. A server on this computer
// or the home network gets one slot unless its account says otherwise (connection-accounts
// storage), which is what puts Ollama, LM Studio and the like in task order.
import { getConnectionBudgetScope } from "./connection-rate-limit-registry.js";
import {
  LocalModelTurns,
  currentLocalModelPriority,
  type LocalModelPriority,
} from "../sidecar/local-model-priority.js";

const caps = new Map<string, number>();
const turns = new Map<string, LocalModelTurns>();
const noop = () => undefined;

/** Cap concurrent requests across an account's rows; null/invalid clears the cap. */
export function setAccountParallelLimit(accountId: string, cap: number | null): void {
  const scope = `account:${accountId}`;
  if (typeof cap === "number" && Number.isFinite(cap) && cap > 0) caps.set(scope, Math.max(1, Math.floor(cap)));
  else caps.delete(scope);
  // A raised or cleared cap lets requests that are already waiting start now.
  turns.get(scope)?.recheck();
}

export function resetAccountBudgetsForTests(): void {
  caps.clear();
  turns.clear();
}

function turnsFor(scope: string): LocalModelTurns {
  let queue = turns.get(scope);
  if (!queue) {
    // Read on every decision, so a changed cap applies to the next request. A cleared cap
    // lets requests already waiting through one at a time; new ones skip the queue.
    queue = new LocalModelTurns(() => caps.get(scope) ?? 1);
    turns.set(scope, queue);
  }
  return queue;
}

/**
 * Release function (sync when no cap applies or a slot is free), else a promise of one.
 * `level` is the request's place in the turn order; without one it comes from the
 * generation it runs in, and outside any generation it is background work.
 */
export function acquireAccountSlot(
  connectionId: string,
  signal?: AbortSignal,
  level?: LocalModelPriority,
): (() => void) | Promise<() => void> {
  const scope = getConnectionBudgetScope(connectionId);
  const cap = scope ? caps.get(scope) : undefined;
  if (!scope || !cap) return noop;
  if (signal?.aborted) throw signal.reason ?? new Error("Aborted");
  const queue = turnsFor(scope);
  const priority = level ?? currentLocalModelPriority();
  const acquired = queue.tryAcquire(priority);
  if (acquired) return acquired;
  return queue.acquire(priority, signal).then((release) => {
    if (!signal?.aborted) return release;
    release();
    throw signal.reason ?? new Error("Aborted");
  });
}

/** Test-only: running and waiting requests per level for an account. */
export function inspectAccountTurnsForTests(accountId: string) {
  return turns.get(`account:${accountId}`)?.snapshot() ?? null;
}
