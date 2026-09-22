import type { ClientRuntimeDiagnostics } from "./client-runtime-diagnostics";
import type { SidecarHealthSection, SidecarSlotFootprint } from "@marinara-engine/shared";

export interface SupportDiagnostics {
  clientRuntime?: ClientRuntimeDiagnostics;
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
    | {
        status: "ended";
        exitKind: "clean" | "crash" | "restart" | "forced";
        exitedAt: string | null;
        exitCode: number | null;
      }
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
   * The server's own GPU and local model slots.
   *
   * The `GPU:` line above is the *browser's* card, which says nothing about the
   * machine running the sidecars when the client is a phone or another PC. These
   * lines answer "my local model won't load" on their own, with or without any
   * decision model involved.
   */
  sidecars?: SidecarHealthSection;
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
  forced: "was stopped before its shutdown could finish, so the very last changes may not have been saved",
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

function formatBytes(bytes: number | null | undefined): string {
  if (typeof bytes !== "number" || !Number.isFinite(bytes) || bytes <= 0) return "unknown";
  return `${(bytes / 1_000_000_000).toFixed(1)} GB`;
}

const SLOT_LABELS: Record<SidecarSlotFootprint["slot"], string> = {
  main: "Main sidecar",
  utility: "Utility sidecar",
  decision: "Decision sidecar",
};

/**
 * One line per slot: whether it is configured, whether it is running, and what it is
 * expected to cost. A slot with nothing selected says so rather than being omitted, so
 * a reader can tell "not set up" from "this build does not report it".
 */
function formatSlot(slot: SidecarSlotFootprint): string {
  if (!slot.configured) return `${SLOT_LABELS[slot.slot]}: not configured`;
  const parts = [slot.running ? "running" : "stopped", slot.model ?? "unnamed model"];
  if (slot.fileBytes) parts.push(`${formatBytes(slot.fileBytes)} file`);
  if (slot.contextSize) parts.push(`context ${slot.contextSize}`);
  if (slot.backend) parts.push(`backend ${slot.backend}`);
  // "measured" and "est." are different claims. A reading taken from the running
  // process is worth distinguishing from arithmetic over the model file, because a
  // reader triaging a load failure needs to know which one they are looking at.
  const prefix = slot.measured ? "measured" : "est.";
  parts.push(
    slot.onCpu
      ? `${prefix} ${formatBytes(slot.estimatedBytes)} system memory (CPU)`
      : `${prefix} ${formatBytes(slot.estimatedBytes)} VRAM`,
  );
  return `${SLOT_LABELS[slot.slot]}: ${parts.join("; ")}`;
}

/**
 * The server's GPU.
 *
 * Reported in MiB, matching `nvidia-smi`'s own output, so a reader can line this up
 * against what the user pastes from that tool. The slot lines below are in GB, where
 * the question is how much of the card a model wants rather than an exact figure.
 *
 * Non-NVIDIA cards report their vendor and say the memory was not measured. Guessing
 * a number there would put a fabricated figure into a bug report.
 */
function formatServerGpu(sidecars: SidecarHealthSection | undefined): string {
  if (!sidecars) return "Unavailable";
  if (sidecars.gpu.pending) return "probe pending";
  const device = sidecars.gpu.devices[0];
  if (!device) return sidecars.gpu.vendor ? `${sidecars.gpu.vendor}, VRAM not measured` : "no NVIDIA GPU detected";
  const others = sidecars.gpu.devices.length > 1 ? ` (+${sidecars.gpu.devices.length - 1} more)` : "";
  return `${device.name}, ${Math.round(device.totalBytes / 1024 / 1024)} MiB total, ${Math.round(
    device.usedBytes / 1024 / 1024,
  )} MiB used, driver ${device.driverVersion}${others}`;
}

/**
 * The two "does not fit" verdicts are different problems and read differently: one
 * cannot be fixed by stopping anything, the other can. A support reader who cannot
 * tell them apart cannot tell the user what to do about it.
 */
const LOAD_VERDICT_LABELS: Record<string, string> = {
  recommended: "within recommended",
  tight: "tight (less than 1.5 GB headroom)",
  wont_fit: "**heavier than recommended for this device**",
  wont_fit_beside_sidecar: "**heavier than recommended for these slots together**",
  unsupported: "not supported on this device",
  not_enough_disk: "not enough free disk",
};

/** Everything the user has configured, weighed together against the card. */
function formatSidecarLoad(sidecars: SidecarHealthSection | undefined): string {
  if (!sidecars) return "Unavailable";
  if (sidecars.gpu.pending) return "probe pending";
  if (!sidecars.load) return "not measured";
  const { totalBytes, capacityBytes, verdict } = sidecars.load;
  const capacity = capacityBytes === null ? "unknown capacity" : formatBytes(capacityBytes);
  return `est. ${formatBytes(totalBytes)} of ${capacity} - ${LOAD_VERDICT_LABELS[verdict] ?? verdict}`;
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
    // Like the existing server fields, this is an English technical support
    // report, not UI copy. Event names are stable diagnostic protocol values.
    `Client runtime: ${diagnostics.clientRuntime ? JSON.stringify({ ...diagnostics.clientRuntime, events: diagnostics.clientRuntime.events.filter((event) => !["page-show", "page-hide", "visible", "hidden"].includes(event.kind)).slice(-5) }) : "Unavailable"}`,
    `GPU: ${available(diagnostics.gpu)}`,
    // Server-side GPU and slot lines. Time-sensitive like the other server
    // telemetry, so an unreachable host overrides them rather than presenting
    // a pre-freeze reading as current.
    `Server GPU: ${unreachable ? SERVER_UNREACHABLE_DIAGNOSTIC : formatServerGpu(diagnostics.sidecars)}`,
    ...(unreachable
      ? (["main", "utility", "decision"] as const).map(
          (slot) => `${SLOT_LABELS[slot]}: ${SERVER_UNREACHABLE_DIAGNOSTIC}`,
        )
      : (diagnostics.sidecars?.slots ?? []).map(formatSlot)),
    `Sidecar load: ${unreachable ? SERVER_UNREACHABLE_DIAGNOSTIC : formatSidecarLoad(diagnostics.sidecars)}`,
    // Only printed once the decision sidecar has been turned on. Support reads this to
    // tell an acknowledged warning from a surprise, so it carries both the time and
    // the verdict that was on screen at that moment.
    ...(diagnostics.sidecars?.decisionConsent
      ? [
          `Decision sidecar consent: enabled ${diagnostics.sidecars.decisionConsent.confirmedAt} (verdict shown: ${
            LOAD_VERDICT_LABELS[diagnostics.sidecars.decisionConsent.verdict] ??
            diagnostics.sidecars.decisionConsent.verdict
          })`,
        ]
      : []),
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
