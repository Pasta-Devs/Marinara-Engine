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
import { hostname } from "node:os";
import { isatty } from "node:tty";
import { getLogLevel, getNodeEnv } from "../config/runtime-config.js";
import { logContextMixin } from "./log-context.js";

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

/** Opt in when an Error's message/stack can contain provider text. Fields must contain metadata only. */
export const privateErrorLogFields = Symbol("privateErrorLogFields");

function errorLogFields(value: unknown): unknown {
  if (!(value instanceof Error)) return undefined;
  const seen = new Set<object>();
  let current: unknown = value;
  while (current && typeof current === "object") {
    if (seen.has(current)) break;
    seen.add(current);
    const fields = Reflect.get(current, privateErrorLogFields);
    if (fields) return fields;
    current = Reflect.get(current, "cause");
  }
  return undefined;
}

function privateErrorLogArgument(value: unknown): unknown {
  const fields = errorLogFields(value);
  if (fields) return fields;
  if (!value || typeof value !== "object" || value instanceof Error) return value;
  const err = errorLogFields(Reflect.get(value, "err"));
  const error = errorLogFields(Reflect.get(value, "error"));
  return err || error ? { ...value, ...(err ? { err } : {}), ...(error ? { error } : {}) } : value;
}

export const logger = pino({
  level: getLogLevel(),
  hooks: {
    logMethod(args, method, level) {
      // Pino copies a bare Error's message into msg before serializing it; intercept marked errors first.
      if (level >= 30)
        for (let index = 0; index < args.length; index++) args[index] = privateErrorLogArgument(args[index]);
      return method.apply(this, args);
    },
  },
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

export function logDebugOverride(overrideEnabled: boolean, message: string, ...args: any[]) {
  if (overrideEnabled && !logger.isLevelEnabled("debug")) {
    // Default LOG_LEVEL is warn, so explicit UI debug mode must log at warn to be visible.
    logger.warn(message, ...args);
    return;
  }

  logger.debug(message, ...args);
}
