// ──────────────────────────────────────────────
// Shared Logger — Pino singleton
// ──────────────────────────────────────────────
// Every module in the server package should import `logger` from here
// instead of using `console.log/warn/error` directly. This ensures
// LOG_LEVEL actually controls what gets printed.
//
// Fastify is built on this same instance (app.ts passes it as
// `loggerInstance`), so req.log / reply.log / app.log are children of it and
// share its serializers and context fields. Pino children copy the level
// when they are created, so app.ts calls followLogLevel(app.log) to keep the
// env-watcher LOG_LEVEL hot reload in effect for request lines too.
//
// Every line carries `bootId` (one per process start) and, inside an HTTP
// request, the fields of the current log context (`requestId`, `route`; see
// log-context.ts). An Error logged under
// either `err` or `error` keeps its `cause` chain. See
// docs/development/logging.md.
// ──────────────────────────────────────────────
import pino from "pino";
import { randomBytes } from "node:crypto";
import type { EventEmitter } from "node:events";
import { writeSync } from "node:fs";
import { join } from "node:path";
import { format } from "node:util";
import { hostname } from "node:os";
import { isatty } from "node:tty";
import { getDataDir, getLogLevel, getNodeEnv, isPromptDebugFileLoggingEnabled } from "../config/runtime-config.js";
import { logContextMixin } from "./log-context.js";
import { RotatingFileSink } from "./rotating-sink.js";

type TerminalLogStream = EventEmitter & {
  fd?: number;
  write: (chunk: string) => unknown;
  end: () => unknown;
  flushSync: () => unknown;
  destroy: () => unknown;
};

const stdoutWasTerminal = process.platform !== "win32" && isatty(1);
const terminalStreams = new Set<TerminalLogStream>();
const noop = () => undefined;
function isBrokenTerminalError(error: unknown) {
  const code = (error as NodeJS.ErrnoException)?.code;
  return code === "EIO" || code === "EPIPE";
}
function isTerminalUnavailable() {
  try {
    // macOS can still report isatty(1) after hangup, and zero-byte writes need
    // not probe a PTY. Send one ignorable NUL byte to exercise the actual fd.
    writeSync(1, "\0");
    return false;
  } catch (error) {
    return isBrokenTerminalError(error);
  }
}
function silenceTerminalStream(stream: TerminalLogStream) {
  // Match Pino's broken-pipe policy: the terminal is gone, so stop writing to it.
  stream.write = noop;
  stream.end = noop;
  stream.flushSync = noop;
  stream.destroy = noop;
}

// Register BEFORE the Pino instance below: shutdown can reach exit before an async
// EIO arrives, and SonicBoom's exit-time flush otherwise retries the dead fd forever.
if (stdoutWasTerminal) {
  process.once("exit", () => {
    if (isTerminalUnavailable()) for (const stream of terminalStreams) silenceTerminalStream(stream);
  });
}

// prettyStdout is only for our pino-pretty transport with its default stdout destination.
export function protectTerminalLogger(log: object, prettyStdout = false): void {
  if (!stdoutWasTerminal) return;
  const stream = Reflect.get(log, pino.symbols.streamSym) as TerminalLogStream | undefined;
  // File and custom transports are not ours; their errors must remain visible.
  if (!stream || (stream.fd !== 1 && !prettyStdout) || terminalStreams.has(stream)) return;
  terminalStreams.add(stream);
  stream.once("close", () => terminalStreams.delete(stream));
  stream.on("error", (error: NodeJS.ErrnoException) => {
    // ThreadStream can lose the errno or report only "the worker has exited".
    // For our pretty transport, verify the actual stdout failure before silencing it.
    if (prettyStdout ? isTerminalUnavailable() : isBrokenTerminalError(error)) {
      silenceTerminalStream(stream);
      return;
    }
    throw error;
  });
}

/** Short random id of this process start; tells two runs apart in one log file. */
const bootId = randomBytes(4).toString("hex");

export const logger = pino({
  level: getLogLevel(),
  // pino-pretty hides hostname by default; bootId is hidden too, since a dev terminal only
  // ever shows one run. JSON output (production, log files) keeps both.
  transport:
    getNodeEnv() !== "production"
      ? { target: "pino-pretty", options: { colorize: true, ignore: "hostname,bootId" } }
      : undefined,
  // Pino's defaults (pid, hostname) plus bootId.
  base: { pid: process.pid, hostname: hostname(), bootId },
  mixin: logContextMixin,
  // Pino only serialises `err` by default; `{ error }` would otherwise print as `{}`.
  serializers: { err: pino.stdSerializers.err, error: pino.stdSerializers.err },
});
protectTerminalLogger(logger, getNodeEnv() !== "production");

/**
 * Keeps a child logger (Fastify's app.log) on the shared logger's level after
 * runtime changes; Pino children otherwise keep the level they were created with.
 */
export function followLogLevel(child: { level: string }): () => void {
  child.level = logger.level;
  const listener = (label: string, _value: number, _previous: string, _previousValue: number, from: unknown) => {
    if (from === logger && child.level !== label) child.level = label;
  };
  logger.on("level-change", listener);
  // Returns the unsubscribe; app.ts calls it on close so repeated buildApp() calls
  // (tests, in-process restarts) do not pile up listeners on the shared logger.
  return () => {
    logger.off("level-change", listener);
  };
}

const PROMPT_DEBUG_FILE_BYTES = 10 * 1024 * 1024;
const PROMPT_DEBUG_FILES_KEPT = 3;
let promptDebugSink: RotatingFileSink | undefined;

/** Where LOG_PROMPT_DEBUG_FILES writes: DATA_DIR/logs/prompt-debug. */
export function getPromptDebugLogDirectory(): string {
  return join(getDataDir(), "logs", "prompt-debug");
}

function writePromptDebugLine(level: number, message: string, args: unknown[]): void {
  if (!promptDebugSink) {
    const directory = getPromptDebugLogDirectory();
    promptDebugSink = new RotatingFileSink({
      directory,
      prefix: "prompt-debug",
      runId: bootId,
      maxBytes: PROMPT_DEBUG_FILE_BYTES,
      keep: PROMPT_DEBUG_FILES_KEPT,
    });
    logger.info({ event: "log.prompt_debug_files", directory }, "[logger] Prompt debug output goes to %s", directory);
  }
  promptDebugSink.write(
    JSON.stringify({
      level,
      time: Date.now(),
      pid: process.pid,
      bootId,
      ...logContextMixin({}, level),
      debugPrompt: true,
      msg: format(message, ...args),
    }),
  );
}

/**
 * Prompt and model text for debugging: shown when the chat's debug mode is on (`overrideEnabled`) or at
 * LOG_LEVEL=debug. With LOG_PROMPT_DEBUG_FILES it goes to DATA_DIR/logs/prompt-debug/ instead of the console.
 */
export function logDebugOverride(overrideEnabled: boolean, message: string, ...args: any[]) {
  if (isPromptDebugFileLoggingEnabled()) {
    const debugEnabled = logger.isLevelEnabled("debug");
    if (overrideEnabled || debugEnabled) writePromptDebugLine(debugEnabled ? 20 : 40, message, args);
    return;
  }
  if (overrideEnabled && !logger.isLevelEnabled("debug")) {
    // Default LOG_LEVEL is warn, so explicit UI debug mode must log at warn to be visible.
    logger.warn(message, ...args);
    return;
  }

  logger.debug(message, ...args);
}
