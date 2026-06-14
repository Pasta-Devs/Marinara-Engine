export type BridgeLogger = {
  info(message: string, ...args: unknown[]): void;
  error(error: unknown, message: string): void;
};

function formatMessage(message: string, args: unknown[]) {
  let index = 0;
  return message.replace(/%s/g, () => String(args[index++] ?? ""));
}

const fallbackLogger: BridgeLogger = {
  info(message, ...args) {
    process.stdout.write(`[discord-bot] ${formatMessage(message, args)}\n`);
  },
  error(error, message) {
    process.stderr.write(`[discord-bot] ${message}\n${error instanceof Error ? error.stack : String(error)}\n`);
  },
};

export const logger: BridgeLogger = await import("../../../server/dist/lib/logger.js")
  .then((module: { logger: BridgeLogger }) => module.logger)
  .catch(() => fallbackLogger);
