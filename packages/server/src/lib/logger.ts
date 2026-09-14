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
import type { EventEmitter } from "node:events";
import { isatty } from "node:tty";
import pino from "pino";
import { getLogLevel, getNodeEnv } from "../config/runtime-config.js";

type LogOutputStream = EventEmitter & Record<"write" | "end" | "flushSync" | "destroy", unknown>;

const guardedStreams = new Set<LogOutputStream>();
const stdoutWasTerminal = isatty(1);

function stopWritingTo(stream: LogOutputStream) {
  const noop = () => undefined;
  Object.assign(stream, { write: noop, end: noop, flushSync: noop, destroy: noop });
}

/**
 * Pino stops writing after EPIPE - the reader of a pipe went away - instead
 * of crashing the process. A hung-up terminal answers every write with EIO
 * instead: closing the window that runs start.sh hangs up the pty before the
 * server even sees SIGHUP. Pino re-emits that EIO as an unhandled 'error',
 * and its exit-time flush retries a line that can never be written every
 * 100 ms without end, so a graceful shutdown would either crash or hang until
 * the launcher's ten-second SIGKILL - after the store flushed, but before the
 * session exit stamp (#6183). Treat a dead terminal exactly like a dead pipe:
 * stop logging, keep going. Every other write error still surfaces as before.
 */
export function guardLoggerAgainstLostOutput(instance: object): void {
  const stream = (instance as unknown as Record<symbol, unknown>)[pino.symbols.streamSym] as
    | LogOutputStream
    | undefined;
  if (typeof stream?.on !== "function" || guardedStreams.has(stream)) return;
  guardedStreams.add(stream);
  stream.on("error", (err: NodeJS.ErrnoException) => {
    if (err?.code !== "EIO" && err?.code !== "EPIPE") throw err;
    stopWritingTo(stream);
  });
}

// A shutdown that finishes within milliseconds exits before the failed
// write for its first log line reports back, so the 'error' path above never
// runs and the buffered lines would reach Pino's exit flush. Registered here,
// before any Pino instance exists, so it runs ahead of that flush.
process.on("exit", () => {
  if (!stdoutWasTerminal || isatty(1)) return;
  for (const stream of guardedStreams) stopWritingTo(stream);
});

export const logger = pino({
  level: getLogLevel(),
  transport: getNodeEnv() !== "production" ? { target: "pino-pretty", options: { colorize: true } } : undefined,
});
guardLoggerAgainstLostOutput(logger);

export function logDebugOverride(overrideEnabled: boolean, message: string, ...args: any[]) {
  if (overrideEnabled && !logger.isLevelEnabled("debug")) {
    // Default LOG_LEVEL is warn, so explicit UI debug mode must log at warn to be visible.
    logger.warn(message, ...args);
    return;
  }

  logger.debug(message, ...args);
}
