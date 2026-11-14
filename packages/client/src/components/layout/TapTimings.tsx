// ──────────────────────────────────────────────
// Tap timings (Settings > Advanced > Troubleshooting)
//
// A small box over the app that shows, for each tap or click, how long it took
// until the screen showed something and until it was smooth again, and how much
// of that was waiting on the server. For finding what feels slow on a phone or
// tablet where browser dev tools aren't at hand (iPad, Nov 14). This device only.
// ──────────────────────────────────────────────
import { useEffect, useState, useSyncExternalStore } from "react";
import { useTranslation as useUiTranslation } from "react-i18next";

const STORAGE_KEY = "marinara-tap-timings";
const CHANGE_EVENT = "marinara:tap-timings-change";
/** A frame longer than this counts as a stutter. */
const SLOW_FRAME_MS = 50;
/** The tap's work is over once this long passes without a slow frame or a request still loading. */
const QUIET_MS = 700;
const MAX_WINDOW_MS = 8000;
const ROWS = 6;

const RETIRED = Symbol("tapTimingsRetired");
const UNDERLYING = Symbol("tapTimingsUnderlying");
type CountedFetch = typeof window.fetch & {
  [RETIRED]?: () => boolean;
  [UNDERLYING]?: typeof window.fetch;
};

function readEnabled() {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setTapTimingsEnabled(enabled: boolean) {
  try {
    if (enabled) localStorage.setItem(STORAGE_KEY, "1");
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* private mode: the box just won't remember */
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function useTapTimingsEnabled() {
  return useSyncExternalStore(subscribe, readEnabled, () => false);
}

interface TapRow {
  id: number;
  label: string;
  /** Tap to the first frame drawn after it. */
  first: number;
  /** Tap to the end of the last slow frame (or the first frame when none were slow). */
  done: number;
  longest: number;
  slowFrames: number;
  requests: number;
  /** Tap to the moment the last request it started finished. */
  serverDone: number;
  finished: boolean;
}

function labelFor(target: EventTarget | null) {
  const el = target instanceof Element ? target : null;
  const control = el?.closest<HTMLElement>(
    "button, a, [role='button'], [role='tab'], [role='menuitem'], summary, label",
  );
  const source = control ?? (el as HTMLElement | null);
  if (!source) return "tap";
  const text =
    source.getAttribute("aria-label") ||
    source.getAttribute("title") ||
    // textContent, not innerText: innerText forces a layout inside the window being measured.
    (source.textContent || "").replace(/\s+/g, " ").trim() ||
    source.tagName.toLowerCase();
  return text.length > 26 ? `${text.slice(0, 25)}…` : text;
}

function apiRequestsSince(start: number) {
  if (typeof performance.getEntriesByType !== "function") return [];
  return (performance.getEntriesByType("resource") as PerformanceResourceTiming[]).filter(
    (entry) => entry.startTime >= start - 5,
  );
}

export function TapTimings() {
  const { t: localizeUi } = useUiTranslation();
  const enabled = useTapTimingsEnabled();
  const [rows, setRows] = useState<TapRow[]>([]);

  useEffect(() => {
    if (!enabled) return;
    let nextId = 1;
    let stopCurrent: (() => void) | null = null;
    // Counts the app's own requests in flight, so a slow server keeps the tap's timing open.
    let pendingFetches = 0;
    // A wrapper from an earlier toggle can come back onto window.fetch when another module (the mesh avatar
    // loader) restores what it saved, so start from the fetch underneath it instead of stacking layers.
    const current = window.fetch as CountedFetch;
    const originalFetch: typeof window.fetch = current[RETIRED]?.() ? (current[UNDERLYING] ?? current) : current;
    let retired = false;
    const countedFetch = ((...args: Parameters<typeof window.fetch>) => {
      // After the toggle is off, a copy left on window.fetch is a plain pass-through.
      if (retired) return originalFetch(...args);
      pendingFetches += 1;
      return originalFetch(...args).finally(() => {
        pendingFetches -= 1;
      });
    }) as CountedFetch;
    countedFetch[RETIRED] = () => retired;
    countedFetch[UNDERLYING] = originalFetch;
    window.fetch = countedFetch;
    try {
      performance.setResourceTimingBufferSize?.(2000);
    } catch {
      /* not supported */
    }

    const onTap = (event: PointerEvent | MouseEvent) => {
      if (event instanceof PointerEvent && !event.isPrimary) return;
      stopCurrent?.();
      const start = event.timeStamp || performance.now();
      const row: TapRow = {
        id: nextId++,
        label: labelFor(event.target),
        first: 0,
        done: 0,
        longest: 0,
        slowFrames: 0,
        requests: 0,
        serverDone: 0,
        finished: false,
      };
      setRows((current) => [row, ...current].slice(0, ROWS));
      let last = performance.now();
      let lastActivity = last;
      let frame = 0;
      let stopped = false;
      let lastPublish = last;
      const publish = (finished: boolean) => {
        const requests = apiRequestsSince(start);
        row.requests = requests.length;
        row.serverDone = requests.reduce((max, entry) => Math.max(max, entry.responseEnd - start), 0);
        row.finished = finished;
        setRows((current) => current.map((item) => (item.id === row.id ? { ...row } : item)));
      };
      const tick = (now: number) => {
        if (stopped) return;
        const gap = now - last;
        last = now;
        if (!row.first) {
          row.first = Math.max(1, now - start);
          row.done = row.first;
          lastActivity = now;
        } else {
          row.longest = Math.max(row.longest, gap);
          if (gap > SLOW_FRAME_MS) {
            row.slowFrames += 1;
            row.done = now - start;
            lastActivity = now;
          }
        }
        // A request still loading keeps the tap open.
        if (pendingFetches > 0) lastActivity = now;
        const over = now - lastActivity > QUIET_MS || now - start > MAX_WINDOW_MS;
        if (over) {
          stopped = true;
          publish(true);
          return;
        }
        if (now - lastPublish > 250) {
          lastPublish = now;
          publish(false);
        }
        frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
      stopCurrent = () => {
        if (stopped) return;
        stopped = true;
        cancelAnimationFrame(frame);
        publish(true);
      };
    };

    const listener = (event: Event) => onTap(event as PointerEvent);
    window.addEventListener("pointerup", listener, { capture: true, passive: true });
    return () => {
      window.removeEventListener("pointerup", listener, { capture: true });
      retired = true;
      if (window.fetch === countedFetch) window.fetch = originalFetch;
      stopCurrent?.();
    };
  }, [enabled]);

  if (!enabled) return null;
  return (
    <div
      aria-hidden="true"
      data-component="TapTimings"
      style={{
        position: "fixed",
        left: "max(0.5rem, var(--mari-safe-area-inset-left))",
        bottom: "calc(var(--mari-safe-area-inset-bottom, env(safe-area-inset-bottom)) + 4.5rem)",
        // Over every app overlay, but not over the omnibar or Mari (it never takes taps either way).
        zIndex: "calc(var(--mari-layer-omnibar) - 1)",
        pointerEvents: "none",
        maxWidth: "min(22rem, calc(100vw - 1rem))",
        padding: "0.375rem 0.5rem",
        borderRadius: "0.5rem",
        background: "rgb(0 0 0 / 0.78)",
        color: "#e8edf3",
        font: "500 11px/1.35 ui-monospace, SFMono-Regular, Menlo, monospace",
        fontVariantNumeric: "tabular-nums",
        whiteSpace: "nowrap",
      }}
    >
      <div style={{ opacity: 0.7 }}>{localizeUi("ui.layout.taptimings.tapShownSmoothLongestFrameServer")}</div>
      {rows.length === 0 ? <div style={{ opacity: 0.7 }}>{localizeUi("ui.layout.taptimings.tapSomething")}</div> : null}
      {rows.map((row) => (
        <div key={row.id} style={{ overflow: "hidden", textOverflow: "clip", opacity: row.finished ? 1 : 0.7 }}>
          <span style={{ color: "#9fd8ff" }}>{row.label}</span> {Math.round(row.first)} ·{" "}
          <b style={{ color: row.done > 400 ? "#ffb4a2" : "#b8f2c4" }}>{Math.round(row.done)}</b> ·{" "}
          {Math.round(row.longest)} ·{" "}
          {row.requests
            ? localizeUi("ui.layout.taptimings.value1Value2", {
                value1: row.requests,
                value2: Math.round(row.serverDone),
              })
            : "–"}
          {row.finished ? "" : " …"}
        </div>
      ))}
    </div>
  );
}
