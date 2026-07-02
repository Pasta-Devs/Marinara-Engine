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
import { useLayoutEffect, useRef } from "react";

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

/** A render is tagged IDLE when no user input (pointer/key/wheel/touch) happened in the last IDLE_MS. */
const IDLE_MS = 1000;
let lastInputAt = 0;
let inputTrackerInstalled = false;

function ensureInputTracker(): void {
  if (inputTrackerInstalled || !ENABLED || typeof window === "undefined") return;
  inputTrackerInstalled = true;
  const mark = () => {
    lastInputAt = performance.now();
  };
  for (const type of ["pointerdown", "pointerup", "keydown", "wheel", "touchstart"]) {
    window.addEventListener(type, mark, { passive: true, capture: true });
  }
}

/**
 * When enabled, warn on every render with WHICH watched input changed reference
 * since the previous render — the key signal for a re-render *storm* (and for
 * naming its driver). Renders with no user input in the last second are tagged
 * IDLE: a storm that fires while idle is a loop, not interaction cost. Pass a flat
 * record of the component's SOURCE inputs (store slices, query results, key state);
 * derived/memoized values naturally show as "changed" whenever their sources do, so
 * prefer sources. "no watched input changed" means the re-render came from the
 * parent or from unwatched state. Inert when disabled. Call once at the top level
 * of a component body (it is a hook).
 */
export function useWhyRender(label: string, watched: Record<string, unknown> | (() => Record<string, unknown>)): void {
  const previous = useRef<Record<string, unknown> | null>(null);
  const renderCount = useRef(0);
  useLayoutEffect(() => {
    if (!ENABLED) return;
    ensureInputTracker();
    renderCount.current += 1;
    const n = renderCount.current;
    const idleTag = performance.now() - lastInputAt > IDLE_MS ? " IDLE" : "";
    const rawSnapshot = typeof watched === "function" ? watched() : watched;
    const snapshot: Record<string, unknown> = { ...rawSnapshot };
    const prior = previous.current;
    previous.current = snapshot;
    if (!prior) {
      console.warn(`[mari-perf] ${label} why-render #${n} (first render)`);
      return;
    }
    const changed: string[] = [];
    for (const key of Object.keys(snapshot)) {
      if (!Object.is(prior[key], snapshot[key])) changed.push(key);
    }
    if (changed.length === 0) {
      console.warn(
        `[mari-perf]${idleTag} ${label} why-render #${n} — no watched input changed ` +
          `(re-render from parent or unwatched state)`,
      );
    } else {
      console.warn(`[mari-perf]${idleTag} ${label} why-render #${n} — changed: ${changed.join(", ")}`);
    }
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
