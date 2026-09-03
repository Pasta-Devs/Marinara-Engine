export interface SupportDiagnostics {
  version: string;
  build: string;
  commit: string | null;
  serverOs: string;
  serverMemory?: {
    heapUsedMiB: number;
    heapLimitMiB: number;
    rssMiB: number;
  };
  clientOs: string;
  browser: string;
  gpu: string;
  connectionName: string | null;
  connectionProvider: string | null;
  model: string | null;
  /** Launcher-reported Android wake-lock outcome; null when not reported. */
  wakeLock?: string | null;
  /**
   * True when the health request timed out (frozen host). Server-side lines
   * then read as unreachable instead of affirmative "not reported"/"none
   * detected" text that would contradict the very signal the copy carries.
   */
  serverUnreachable?: boolean;
  /** Most recent host suspension the server's freeze detector observed. */
  lastFreeze?: { detectedAt: string; gapMs: number; suspendedMs: number } | null;
  /**
   * #5506 diagnostics: how the PREVIOUS server session ended, from the
   * heartbeat postmortem. An external kill (Android phantom process killer,
   * battery manager, reboot) leaves no in-process trace, so this is the only
   * witness. Tri-state on purpose: "unknown" (first run, unreadable record,
   * a live sibling instance) must never render as a clean shutdown.
   */
  previousSession?:
    | { status: "unknown"; reason: string }
    | { status: "ended"; exitKind: "clean" | "crash" | "restart"; exitedAt: string | null; exitCode: number | null }
    | {
        status: "unclean";
        record: {
          startedAt: string;
          lastSeenAt: string;
          uptimeMs: number;
          rssMiB: number;
          heapUsedMiB: number;
          pid: number;
          rebootedSince: boolean | null;
          detectedAt: string;
        };
      };
  /** How many unclean exits the server has recorded (rolling window). */
  uncleanExitCount?: number;
  /**
   * #5740: the phrase Professor Mari reported acting on in her most recent
   * mutating round, for triaging "she edited something I never asked for"
   * reports. Latest round only; undefined when the status fetch failed.
   */
  mariActingOn?: {
    text: string | null;
    permissionsMode: string;
    /** Observed outcome of the round's mutating commands (held/applied/failed/interrupted). */
    outcome: string;
    commands: string[];
    recordedAt: string;
  } | null;
}

export function resolveClientOs(userAgent: string, platform: string, maxTouchPoints = 0): string {
  const windows = userAgent.match(/Windows NT ([\d.]+)/u);
  if (windows) return `Windows ${windows[1]}`;
  const android = userAgent.match(/Android ([\d.]+)/u);
  if (android) return `Android ${android[1]}`;
  const ios = userAgent.match(/(?:iPhone OS|CPU OS) ([\d_]+)/u);
  if (ios) return `iOS ${ios[1]!.replaceAll("_", ".")}`;
  if (/Macintosh/u.test(userAgent) && maxTouchPoints > 1) {
    const webkitVersion = userAgent.match(/AppleWebKit\/([\d.]+)/u)?.[1];
    return webkitVersion ? `iPadOS (WebKit ${webkitVersion})` : "iPadOS";
  }
  const mac = userAgent.match(/Mac OS X ([\d_]+)/u);
  if (mac) return `macOS ${mac[1]!.replaceAll("_", ".")}`;
  if (/Linux/u.test(userAgent)) return "Linux";
  return platform.trim() || "Unavailable";
}

export function detectBrowserGpu(): string {
  try {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    if (!context) return "Unavailable";
    const debugInfo = context.getExtension("WEBGL_debug_renderer_info") as { UNMASKED_RENDERER_WEBGL: number } | null;
    const renderer = debugInfo
      ? context.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
      : context.getParameter(context.RENDERER);
    return typeof renderer === "string" && renderer.trim() ? renderer.trim() : "Unavailable";
  } catch {
    return "Unavailable";
  }
}

function available(value: string | null | undefined): string {
  return value?.trim() || "Unavailable";
}

export const SERVER_UNREACHABLE_DIAGNOSTIC = "Unreachable (request timed out)";

/**
 * #5740: the acting-on phrase is model-authored free text - the only such
 * field in this line-oriented report. Flatten it (a multi-line quote would
 * forge extra report lines and orphan the [mode: ...] metadata) and cap it to
 * a report-appropriate length; the full text stays in the Mari transcript.
 */
function reportPhrase(text: string): string {
  const flattened = text.replace(/\s+/gu, " ").trim();
  return flattened.length > 200 ? `${flattened.slice(0, 200)}…` : flattened;
}

/**
 * #5740: honest outcome wording. The record's outcome is observed, never
 * asserted - a Plan-floor refusal must read as refused, never as an execution
 * the server did not observe, or a pasted report manufactures a Plan-escape
 * P0 that never happened.
 */
const MARI_OUTCOME_LABELS: Record<string, string> = {
  held: "held for approval",
  applied: "applied",
  failed: "refused or failed",
  interrupted: "interrupted before completion",
};

function formatUptime(uptimeMs: number): string {
  const minutes = Math.round(uptimeMs / 60_000);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

/**
 * #5506: how the previous server session ended. Every branch reports only
 * what was observed - an unknown fate never renders as a clean shutdown, and
 * an ending the server itself logged (crash, restart) is never attributed to
 * an external kill.
 */
const SESSION_EXIT_LABELS: Record<string, string> = {
  clean: "shut down cleanly",
  crash: "ended in a server crash (details in the server log)",
  restart: "restarted itself for an update or a settings restart",
};

function formatPreviousSession(diagnostics: SupportDiagnostics): string {
  const previous = diagnostics.previousSession;
  if (previous === undefined) return "Unavailable";
  if (previous.status === "unknown") return `unknown - ${previous.reason}`;
  if (previous.status === "ended") {
    const label = SESSION_EXIT_LABELS[previous.exitKind] ?? previous.exitKind;
    return previous.exitedAt ? `${label} at ${previous.exitedAt}` : label;
  }
  const record = previous.record;
  return `ended without shutting down - last alive ${record.lastSeenAt} (up ${formatUptime(record.uptimeMs)}, RSS ${record.rssMiB} MiB); device rebooted before next launch: ${record.rebootedSince === null ? "unknown" : record.rebootedSince ? "yes" : "no"}`;
}

export function formatSupportDiagnostics(diagnostics: SupportDiagnostics): string {
  const memory = diagnostics.serverMemory;
  const freeze = diagnostics.lastFreeze;
  const unreachable = diagnostics.serverUnreachable === true;
  return [
    "Marinara Engine diagnostics",
    `Version: ${available(diagnostics.version)}`,
    `Build: ${available(diagnostics.build)}`,
    `Commit: ${available(diagnostics.commit)}`,
    // Server OS is static identity: a cached value is still true while the
    // host is frozen, so known data stays. The three telemetry lines below are
    // time-sensitive - stale readings would present pre-freeze state as
    // current - so unreachable overrides them unconditionally.
    `Server OS: ${unreachable ? diagnostics.serverOs?.trim() || SERVER_UNREACHABLE_DIAGNOSTIC : available(diagnostics.serverOs)}`,
    `Server memory: ${unreachable ? SERVER_UNREACHABLE_DIAGNOSTIC : memory ? `heap ${memory.heapUsedMiB} / ${memory.heapLimitMiB} MiB; RSS ${memory.rssMiB} MiB` : "Unavailable"}`,
    `Background wake lock: ${unreachable ? SERVER_UNREACHABLE_DIAGNOSTIC : (diagnostics.wakeLock ?? "not reported")}`,
    `Last detected freeze: ${unreachable ? SERVER_UNREACHABLE_DIAGNOSTIC : freeze ? `~${Math.round(freeze.suspendedMs / 1000)}s suspension, thawed at ${freeze.detectedAt}` : "none detected"}`,
    // #5506: the previous session's fate, and the running count of sessions
    // that ended without shutting down. The count is reported even when the
    // LAST session ended normally - a history of kills is the pattern worth
    // seeing, and hiding it behind the most recent session buries it.
    `Previous session: ${unreachable ? SERVER_UNREACHABLE_DIAGNOSTIC : formatPreviousSession(diagnostics)}`,
    `Sessions ended without shutdown: ${
      unreachable
        ? SERVER_UNREACHABLE_DIAGNOSTIC
        : typeof diagnostics.uncleanExitCount === "number"
          ? `${diagnostics.uncleanExitCount} recorded`
          : "Unavailable"
    }`,
    `Client OS: ${available(diagnostics.clientOs)}`,
    `Browser / app shell: ${available(diagnostics.browser)}`,
    `GPU: ${available(diagnostics.gpu)}`,
    `Active connection: ${available(diagnostics.connectionName)}`,
    `Connection provider: ${available(diagnostics.connectionProvider)}`,
    `LLM model: ${available(diagnostics.model)}`,
    // #5740 triage line: what Mari last reported acting on. undefined = the
    // status fetch failed (say so); null = no mutating round recorded yet.
    `Mari last acted on: ${
      diagnostics.mariActingOn === undefined
        ? "Unavailable (workspace status not reachable)"
        : diagnostics.mariActingOn === null
          ? "none recorded this session"
          : `${diagnostics.mariActingOn.text ? `"${reportPhrase(diagnostics.mariActingOn.text)}"` : "(no phrase reported)"} [mode: ${diagnostics.mariActingOn.permissionsMode}; ${MARI_OUTCOME_LABELS[diagnostics.mariActingOn.outcome] ?? diagnostics.mariActingOn.outcome}; ${diagnostics.mariActingOn.commands.join(", ") || "no commands"}; at ${diagnostics.mariActingOn.recordedAt}]`
    }`,
  ].join("\n");
}
