// ──────────────────────────────────────────────
// Keep-Alive: Prevent Chrome/Edge tab sleeping
// ──────────────────────────────────────────────
// Chrome and Edge aggressively throttle/freeze background tabs
// ("Sleeping Tabs" / Tab Discarding). This kills timers, stales
// React Query data, and makes the app feel laggy when returning.
//
// Two mechanisms:
// 1. Web Locks API — holding a lock signals the browser that the
//    tab has important work; Chrome won't discard it.
// 2. Periodic BroadcastChannel ping — lightweight activity that
//    prevents the "idle" heuristic from triggering.
// ──────────────────────────────────────────────

let started = false;

export function startKeepAlive() {
  if (started) return;
  started = true;

  // ── Web Lock (primary defense) ──
  // navigator.locks.request() holds a lock for as long as the returned
  // promise is pending. We never resolve it → lock held forever → tab
  // won't be discarded while the page is open.
  if (navigator.locks) {
    navigator.locks.request("marinara-engine-keep-alive", () => new Promise(() => {}));
  }

  // ── Periodic activity (fallback for older Edge) ──
  // A tiny BroadcastChannel message every 20s counts as "tab activity"
  // and resets the idle timer that triggers tab sleeping.
  try {
    const channel = new BroadcastChannel("marinara-heartbeat");
    setInterval(() => {
      channel.postMessage(0);
    }, 20_000);
  } catch {
    // BroadcastChannel not available — that's fine
  }
}
