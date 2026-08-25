// ──────────────────────────────────────────────
// Sandbox IPC protocol helpers (#4706)
// ──────────────────────────────────────────────
// The host and the sandboxed runner exchange newline-delimited JSON through
// append-only files (the file transport IS the sandbox security design and
// stays untouched). What changed in #4706 is the polling discipline: fixed
// 25ms intervals on both sides plus a 250ms watchdog and a 1s heartbeat cost
// ~80 timer wakeups and one flash write per second PER EXTENSION, forever,
// from boot. Polling now runs on self-scheduling timeout chains that stay at
// the hot cadence only while traffic is flowing (startup handshake, storage
// bursts, stop) and drop to a human-imperceptible idle cadence otherwise.
//
// The runner (src/assets/personal-extension-runner.mjs) is a standalone
// sandbox asset that cannot import server modules — it inlines the same
// values, and scripts/regressions/extension-ipc.regression.ts pins the two
// sides byte-for-byte so they cannot drift apart.

/** Poll cadence while traffic is flowing (unchanged from the old fixed rate). */
export const SANDBOX_HOT_POLL_MS = 25;

/** Host output-file poll cadence at idle (was a fixed 25ms). */
export const SANDBOX_HOST_IDLE_POLL_MS = 1_000;

/**
 * Runner input-file poll cadence at idle (was a fixed 25ms). Kept tighter
 * than the host's because stop responsiveness is bounded by this value.
 */
export const SANDBOX_RUNNER_IDLE_POLL_MS = 250;

/** How long after the last traffic either side keeps polling at the hot cadence. */
export const SANDBOX_HOT_WINDOW_MS = 3_000;

/** Runner heartbeat write cadence (was 1s — one flash write per second, forever). */
export const SANDBOX_HEARTBEAT_INTERVAL_MS = 5_000;

/**
 * Host-side unresponsive threshold: five missed heartbeats, the same
 * missed-beat multiple the old 1s/5s pair had.
 */
export const SANDBOX_HEARTBEAT_STALE_MS = 25_000;

/** Host watchdog cadence for heartbeat/file-limit checks (was 250ms). */
export const SANDBOX_WATCHDOG_INTERVAL_MS = 1_000;

/** Detect a process-wide pause so a healthy child gets a fresh heartbeat window after resume. */
export function shouldGrantSandboxResumeGrace(now: number, lastWatchdogTickAt: number): boolean {
  return now - lastWatchdogTickAt > SANDBOX_WATCHDOG_INTERVAL_MS * 2;
}

/**
 * Next delay for a self-scheduling poll chain. Hot while the startup
 * handshake has not settled or any traffic moved within the hot window.
 */
export function resolveSandboxPollDelay(options: {
  now: number;
  lastActivityAt: number;
  settled: boolean;
  idlePollMs: number;
}): number {
  const { now, lastActivityAt, settled, idlePollMs } = options;
  if (!settled) return SANDBOX_HOT_POLL_MS;
  return now - lastActivityAt <= SANDBOX_HOT_WINDOW_MS ? SANDBOX_HOT_POLL_MS : idlePollMs;
}

export type ExtractedProtocolLines = {
  /** Complete newline-terminated lines, in order, empty lines dropped. */
  lines: string[];
  /** Residual bytes after the last newline (an incomplete message). */
  rest: Buffer;
  /** True when a SINGLE message exceeded the cap (complete or residual). */
  oversized: boolean;
};

/**
 * Splits buffered protocol bytes into complete messages, applying the
 * per-message size cap to each individual message rather than to the whole
 * buffered chunk. This distinction is what makes adaptive polling safe: at a
 * 25ms cadence a whole-buffer cap approximated a per-message cap, but at an
 * idle cadence the buffer accumulates EVERYTHING that arrived across the idle
 * gap — several individually-legal messages bursting after a silence must not
 * be mistaken for one oversized message (#4706 red-team amendment).
 */
export function extractProtocolLines(buffer: Buffer, maxMessageBytes: number): ExtractedProtocolLines {
  const lines: string[] = [];
  let rest = buffer;
  while (true) {
    const newline = rest.indexOf(0x0a);
    if (newline === -1) break;
    if (newline > maxMessageBytes) {
      return { lines, rest, oversized: true };
    }
    const line = rest.subarray(0, newline).toString("utf8");
    rest = rest.subarray(newline + 1);
    if (line) lines.push(line);
  }
  if (rest.byteLength > maxMessageBytes) {
    return { lines, rest, oversized: true };
  }
  return { lines, rest, oversized: false };
}
