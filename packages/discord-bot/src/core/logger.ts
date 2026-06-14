export type BridgeLogger = {
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  warn(error: unknown, message: string): void;
  error(error: unknown, message: string): void;
};

const LOG_PREFIX = "[DISCORD-BOT]";

function formatMessage(message: string, args: unknown[]) {
  let index = 0;
  return message.replace(/%[ds]/g, () => String(args[index++] ?? ""));
}

const fallbackLogger: BridgeLogger = {
  info(message, ...args) {
    process.stdout.write(`${LOG_PREFIX} ${formatMessage(message, args)}\n`);
  },
  warn(first: unknown, second?: unknown, ...args: unknown[]) {
    if (typeof first === "string") {
      process.stderr.write(`${LOG_PREFIX} ${formatMessage(first, [second, ...args])}\n`);
      return;
    }
    process.stderr.write(`${LOG_PREFIX} ${String(second)}\n${first instanceof Error ? first.stack : String(first)}\n`);
  },
  error(error, message) {
    process.stderr.write(`${LOG_PREFIX} ${message}\n${error instanceof Error ? error.stack : String(error)}\n`);
  },
};

const baseLogger: BridgeLogger = await import("../../../server/dist/lib/logger.js")
  .then((module: { logger: BridgeLogger }) => module.logger)
  .catch(() => fallbackLogger);

function prefixed(message: string) {
  return `${LOG_PREFIX} ${message}`;
}

export const logger: BridgeLogger = {
  info(message, ...args) {
    baseLogger.info(prefixed(message), ...args);
  },
  warn(first: unknown, second?: unknown, ...args: unknown[]) {
    if (typeof first === "string") {
      baseLogger.warn(prefixed(first), second, ...args);
      return;
    }
    baseLogger.warn(first, prefixed(String(second)));
  },
  error(error, message) {
    baseLogger.error(error, prefixed(message));
  },
};
