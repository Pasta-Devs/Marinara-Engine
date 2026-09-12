const STORAGE_KEY = "marinara-client-runtime-events";
const MAX_EVENTS = 16;
const EVENT_KINDS = [
  "page-start",
  "page-show",
  "page-hide",
  "visible",
  "hidden",
  "reload-requested",
  "chunk-error",
  "javascript-error",
  "promise-error",
  "render-error",
  "message-edited",
  "image-arrived",
] as const;
const RELOAD_REASONS = [
  "chunk-recovery",
  "version-update",
  "service-worker-update",
  "update-fallback",
  "settings-refresh",
  "render-recovery",
  "reset-ui",
  "capability-refresh",
] as const;
const ERROR_NAMES = [
  "Error",
  "TypeError",
  "RangeError",
  "ReferenceError",
  "SyntaxError",
  "URIError",
  "EvalError",
  "Unknown",
] as const;
export type ClientReloadReason = (typeof RELOAD_REASONS)[number];
type EventKind = (typeof EVENT_KINDS)[number];
type RuntimeEvent = {
  at: number;
  page: string;
  build: string;
  kind: EventKind;
  reason?: ClientReloadReason;
  error?: (typeof ERROR_NAMES)[number];
  reactCode?: number;
  asset?: string;
  view?: [number, number, number, number];
};
let events: RuntimeEvent[] = [];
let page = "";
let build = "unavailable";
let storageAvailable = true;
let stopListening: (() => void) | null = null;
const seenErrors = new Set<string>();

function isOneOf<T extends string>(value: unknown, choices: readonly T[]): value is T {
  return typeof value === "string" && choices.includes(value as T);
}

function parseEvent(value: unknown): RuntimeEvent | null {
  if (!value || typeof value !== "object") return null;
  const entry = value as Record<string, unknown>;
  if (
    typeof entry.at !== "number" ||
    !Number.isInteger(entry.at) ||
    entry.at < 0 ||
    entry.at > 8_640_000_000_000_000 ||
    typeof entry.page !== "string" ||
    !/^[a-z0-9-]{1,40}$/.test(entry.page) ||
    typeof entry.build !== "string" ||
    !/^[a-zA-Z0-9.+-]{1,80}$/.test(entry.build) ||
    !isOneOf(entry.kind, EVENT_KINDS)
  )
    return null;
  // Rebuild the object: never pass stored unknown fields through to the report.
  const result: RuntimeEvent = { at: entry.at, page: entry.page, build: entry.build, kind: entry.kind };
  if (isOneOf(entry.reason, RELOAD_REASONS)) result.reason = entry.reason;
  if (isOneOf(entry.error, ERROR_NAMES)) result.error = entry.error;
  if (
    typeof entry.reactCode === "number" &&
    Number.isInteger(entry.reactCode) &&
    entry.reactCode >= 0 &&
    entry.reactCode <= 100_000
  )
    result.reactCode = entry.reactCode;
  // Asset basenames/positions only: no URLs, query strings, raw messages or stacks.
  if (typeof entry.asset === "string" && /^[a-zA-Z0-9_-]{1,100}\.js:\d{1,8}:\d{1,8}$/.test(entry.asset))
    result.asset = entry.asset;
  if (
    Array.isArray(entry.view) &&
    entry.view.length === 4 &&
    entry.view.every((n) => typeof n === "number" && Number.isFinite(n) && Math.abs(n) <= 1_000_000)
  )
    result.view = [...entry.view] as RuntimeEvent["view"];
  return result;
}

function readEvents(): RuntimeEvent[] {
  if (!storageAvailable) return events;
  let raw: string | null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    storageAvailable = false;
    return events;
  }
  try {
    // Ignore malformed/oversized records. Reconstruct through the allowlist so
    // unknown fields in storage can never leak into a copied support report.
    const parsed: unknown = raw && raw.length <= 16_384 ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(-MAX_EVENTS).flatMap((entry) => {
      const result = parseEvent(entry);
      return result ? [result] : [];
    });
  } catch {
    return [];
  }
}

function viewport(): RuntimeEvent["view"] {
  // Sample only on diagnostic events, never on a scroll/animation timer.
  const root = document.getElementById("root")?.getBoundingClientRect();
  return [
    Math.round(window.visualViewport?.height ?? window.innerHeight),
    Math.round(window.visualViewport?.offsetTop ?? 0),
    Math.round(root?.height ?? 0),
    Math.round(root?.top ?? 0),
  ];
}

function append(kind: EventKind, details: Partial<RuntimeEvent> = {}) {
  if (!page) return;
  try {
    const result = parseEvent({ ...details, at: Date.now(), page, build, kind, view: viewport() });
    if (!result) return;
    events = [...readEvents(), result].slice(-MAX_EVENTS);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
    } catch {
      storageAvailable = false;
    }
  } catch {
    // Diagnostics must never break rendering, editing or an intentional reload.
  }
}

export function recordClientRuntimeEvent(kind: "message-edited" | "image-arrived") {
  append(kind);
}

export function recordClientReload(reason: ClientReloadReason) {
  append("reload-requested", { reason });
}

export function recordClientError(
  kind: "javascript-error" | "promise-error" | "render-error" | "chunk-error",
  error: unknown,
) {
  try {
    const nativeError = error instanceof Error ? error : null;
    const name = nativeError?.name;
    const reactCode = nativeError?.message.match(/Minified React error #(\d+)/)?.[1];
    const asset = nativeError?.stack?.match(/\/assets\/([a-zA-Z0-9_-]{1,100}\.js:\d{1,8}:\d{1,8})(?:\D|$)/)?.[1];
    const details = {
      error: isOneOf(name, ERROR_NAMES) ? name : ("Unknown" as const),
      ...(reactCode ? { reactCode: Number(reactCode) } : {}),
      ...(asset ? { asset } : {}),
    };
    const signature = JSON.stringify([kind, details]);
    // A render/rejection loop must not become a synchronous storage-write loop.
    if (seenErrors.has(signature) || seenErrors.size >= MAX_EVENTS) return;
    seenErrors.add(signature);
    append(kind, details);
  } catch {
    // Error objects can have throwing custom properties; ignore them safely.
  }
}

/**
 * Bounded, local-only observations, not crash detection. Page IDs keep different
 * tabs distinguishable. A new page without a reload marker has an UNKNOWN cause.
 * ponytail: event-only history cannot identify an OS/GPU process kill or record
 * an already-dead renderer. Use a physical-device crash trace if events are silent.
 */
export function registerClientRuntimeDiagnostics(clientBuild: string) {
  if (stopListening) return stopListening;
  page = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  build = /^[a-zA-Z0-9.+-]{1,80}$/.test(clientBuild) ? clientBuild : "unavailable";
  storageAvailable = true;
  events = [];
  seenErrors.clear();
  const onError = (event: ErrorEvent) => recordClientError("javascript-error", event.error);
  const onRejection = (event: PromiseRejectionEvent) => recordClientError("promise-error", event.reason);
  const onPreloadError = (event: Event) =>
    recordClientError("chunk-error", (event as Event & { payload?: unknown }).payload);
  const onPageShow = () => append("page-show");
  const onPageHide = () => append("page-hide");
  const onVisibility = () => append(document.visibilityState === "visible" ? "visible" : "hidden");
  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);
  window.addEventListener("vite:preloadError", onPreloadError);
  window.addEventListener("pageshow", onPageShow);
  window.addEventListener("pagehide", onPageHide);
  document.addEventListener("visibilitychange", onVisibility);
  append("page-start");
  stopListening = () => {
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onRejection);
    window.removeEventListener("vite:preloadError", onPreloadError);
    window.removeEventListener("pageshow", onPageShow);
    window.removeEventListener("pagehide", onPageHide);
    document.removeEventListener("visibilitychange", onVisibility);
    stopListening = null;
    page = "";
  };
  return stopListening;
}

export function getClientRuntimeDiagnostics() {
  const history = readEvents();
  const navigation = (performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined)?.type;
  return {
    build,
    page,
    persistence: storageAvailable ? "local" : "unavailable",
    navigation: navigation ?? "unknown",
    standalone:
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true,
    // view = visual viewport height/offsetTop, root height/top, all in CSS px.
    view: viewport(),
    events: history,
  };
}

export type ClientRuntimeDiagnostics = ReturnType<typeof getClientRuntimeDiagnostics>;
