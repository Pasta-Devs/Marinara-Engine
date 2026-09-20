// Shared by application code; Fastify's independently configured logger is
// wired through the same diagnostic hooks. File writes are synchronous so an
// immediate process.exit after a fatal error does not discard the diagnostic.
import pino from "pino";
import type { EventEmitter } from "node:events";
import { writeSync } from "node:fs";
import { isatty } from "node:tty";
import pretty from "pino-pretty";
import { RotatingFileSink } from "./rotating-sink.js";
import { createDiagnostic, getDiagnosticContext, sanitizeDiagnosticValue } from "./diagnostics.js";
import {
  getLogDirectory,
  getLogFileKeep,
  getLogFileLevel,
  getLogFileMaxBytes,
  getLogLevel,
  getNodeEnv,
} from "../config/runtime-config.js";

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

function levelNumber(value: string, fallback: number): number {
  return value === "silent" ? Infinity : (pino.levels.values[value] ?? fallback);
}
const fileThreshold = () => levelNumber(getLogFileLevel(), 30);
let consoleThreshold = levelNumber(getLogLevel(), 40);
let sink: RotatingFileSink | undefined;
let consoleSink: ReturnType<typeof pretty> | undefined;
function combinedLevel(): pino.Level {
  return (pino.levels.labels[Math.min(fileThreshold(), consoleThreshold)] ?? "fatal") as pino.Level;
}

export const logger = pino(
  {
    level: combinedLevel(),
    serializers: { err: (value: unknown) => value },
    mixin: () => sanitizeDiagnosticValue(getDiagnosticContext()) as Record<string, unknown>,
    hooks: {
      logMethod(input, method, level) {
        const first = input[0];
        const fields =
          first && typeof first === "object" && !(first instanceof Error)
            ? (first as Record<string, unknown>)
            : undefined;
        const originalError = first instanceof Error ? first : (fields?.err ?? fields?.error);
        const debug = level <= 20 || fields?.debugPrompt === true;
        const args = input.map((value) => sanitizeDiagnosticValue(value, 0, new WeakSet(), debug));
        if ((level >= 50 || originalError instanceof Error) && !fields?.diagnostic && !fields?.errorId) {
          const reference = createDiagnostic(
            originalError ?? new Error(typeof first === "string" ? first : String(input[1] ?? "Logged failure")),
          );
          const metadata = { ...reference, diagnostic: reference };
          if (first instanceof Error) args[0] = { err: args[0], ...metadata };
          else if (fields) args[0] = { ...(args[0] as Record<string, unknown>), ...metadata };
          else args.unshift(metadata);
        }
        method.apply(this, args as Parameters<pino.LogFn>);
      },
    },
  },
  {
    write(chunk: string) {
      // Lazy initialization avoids the runtime-config/logger import cycle and
      // resolves DATA_DIR only after the .env file has been loaded.
      try {
        const parsed = JSON.parse(chunk) as Record<string, unknown>;
        const severity = Number(parsed.level);
        const safe = sanitizeDiagnosticValue(parsed, 0, new WeakSet(), severity <= 20 || parsed.debugPrompt === true);
        const line = `${JSON.stringify(safe)}\n`;
        if (severity >= fileThreshold()) {
          sink ??= new RotatingFileSink({
            directory: getLogDirectory(),
            maxBytes: getLogFileMaxBytes(),
            keep: getLogFileKeep(),
          });
          sink.write(line);
        }
        if (severity >= consoleThreshold) {
          if (getNodeEnv() !== "production" && process.stderr.isTTY) {
            consoleSink ??= pretty({ sync: true, colorize: true, destination: 2, translateTime: "SYS:standard" });
            consoleSink.write(line);
          } else process.stderr.write(line);
        }
      } catch {
        // Never replay an unsanitized line or throw from error reporting itself.
        try {
          process.stderr.write('{"level":50,"code":"ME_LOG_WRITE","msg":"Diagnostic output unavailable"}\n');
        } catch {
          /* stderr unavailable */
        }
      }
    },
  },
);
protectTerminalLogger(logger, false);

export function refreshConsoleLogLevel(): void {
  consoleThreshold = levelNumber(getLogLevel(), 40);
  logger.level = combinedLevel();
}

// runtime-config may be the first module imported, in which case its .env load
// finishes after this cyclic dependency initializes. Reconcile after evaluation.
queueMicrotask(refreshConsoleLogLevel);

export function logDebugOverride(overrideEnabled: boolean, message: string, ...args: unknown[]) {
  if (overrideEnabled && !logger.isLevelEnabled("debug")) {
    logger.warn({ debugPrompt: true }, message, ...args);
  } else logger.debug({ debugPrompt: true }, message, ...args);
}
