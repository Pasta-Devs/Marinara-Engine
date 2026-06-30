// ──────────────────────────────────────────────────────────────────────────
// Render-timing diagnostics — a fully opt-in performance troubleshooting tool.
//
// Originally added to pin issue #3104 (severe client freeze on chats using the
// world-state / character-tracker agents), but kept as a permanent diagnostic
// for future "the app froze / lagged" reports.
//
// OFF BY DEFAULT — it is completely inert unless explicitly enabled:
//   • Enable:  run `localStorage.mariPerfVerbose = "1"` in the console, reload.
//   • Disable: run `localStorage.mariPerfVerbose = "0"` (or remove the key), reload.
//
// When disabled there are zero clock reads, zero warnings, no PerformanceObserver,
// and no console output — so it can never be a source of overhead or lag itself.
// When enabled it logs every render + long task (ones over SLOW_MS are tagged
// "SLOW" so the culprit is easy to spot).
//
// Notes:
// - The flag is read ONCE at module load; toggling it requires a reload (so the
//   enabled/disabled state can never change mid-session, keeping React hook
//   order stable).
// - Uses `console.warn` (NOT `console.log`): production builds strip
//   `console.log` via esbuild but keep `console.warn`/`console.error`, so this
//   still surfaces in built installs (where the lag reports come from).
// - Zero behavior change: it only measures and reports.
// ──────────────────────────────────────────────────────────────────────────
import { useLayoutEffect } from "react";

/** Renders / long tasks at or above this (ms) are tagged "SLOW" to spot the culprit quickly. */
const SLOW_MS = 250;

function readVerboseFlag(): boolean {
  try {
    return typeof localStorage !== "undefined" && localStorage.getItem("mariPerfVerbose") === "1";
  } catch {
    return false;
  }
}

/** Read once at module load — toggling requires a reload, so this is constant for the session. */
const ENABLED = readVerboseFlag();

/**
 * When enabled, warn with this component's render + commit duration on every
 * render. Inert (no clock read, no effect work) when disabled. Call once at the
 * top level of a component body (it is a hook).
 */
export function useRenderTimer(label: string): void {
  // Clock is only read when enabled; the purity heuristic flags the potential
  // render-phase read, but it is measurement-only and gated behind ENABLED.
  // eslint-disable-next-line react-hooks/purity
  const start = ENABLED ? performance.now() : 0;
  useLayoutEffect(() => {
    if (!ENABLED) return;
    const elapsed = Math.round(performance.now() - start);
    console.warn(`[mari-perf]${elapsed >= SLOW_MS ? " SLOW" : ""} ${label} render+commit ${elapsed}ms`);
  });
}

let installed = false;

/**
 * When enabled, log a one-time "on" confirmation and warn on every main-thread
 * long task. Completely inert (no observer, no output) when disabled. Idempotent.
 */
export function installLongTaskWarner(): void {
  if (installed || !ENABLED) return;
  installed = true;

  console.warn(
    `[mari-perf] render diagnostics ON — logging every render + long task ` +
      `(${SLOW_MS}ms+ tagged SLOW). Run \`localStorage.mariPerfVerbose = "0"\` (or remove the key) and reload to disable.`,
  );

  if (typeof PerformanceObserver === "undefined") return;
  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const duration = Math.round(entry.duration);
        console.warn(`[mari-perf]${duration >= SLOW_MS ? " SLOW" : ""} long task ${duration}ms`);
      }
    });
    observer.observe({ entryTypes: ["longtask"] });
  } catch {
    // "longtask" is not supported in every browser — safe to ignore.
  }
}
