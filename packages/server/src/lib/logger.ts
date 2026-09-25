// ──────────────────────────────────────────────
// Shared Logger — Pino singleton
// ──────────────────────────────────────────────
// Every module in the server package should import `logger` from here
// instead of using `console.log/warn/error` directly. This ensures
// LOG_LEVEL actually controls what gets printed.
//
// Fastify builds its own separate pino instance from a {level, transport}
// object (see app.ts) rather than importing this singleton, so
// req.log / reply.log do NOT track runtime LOG_LEVEL changes applied here
// by the env-watcher hot-reload.
// ──────────────────────────────────────────────
import pino from "pino";
import type { EventEmitter } from "node:events";
import { writeSync } from "node:fs";
import { isatty } from "node:tty";
import { getLogLevel, getNodeEnv } from "../config/runtime-config.js";

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

// Register BEFORE either Pino instance: shutdown can reach exit before an async
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

export const logger = pino({
  level: getLogLevel(),
  transport: getNodeEnv() !== "production" ? { target: "pino-pretty", options: { colorize: true } } : undefined,
});
protectTerminalLogger(logger, getNodeEnv() !== "production");

export function logDebugOverride(overrideEnabled: boolean, message: string, ...args: any[]) {
  if (overrideEnabled && !logger.isLevelEnabled("debug")) {
    // Default LOG_LEVEL is warn, so explicit UI debug mode must log at warn to be visible.
    logger.warn(message, ...args);
    return;
  }

  logger.debug(message, ...args);
}
