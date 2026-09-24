// ──────────────────────────────────────────────
// Server Entry Point
// ──────────────────────────────────────────────
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { buildApp } from "./app.js";
import { StorageWriterLeaseError } from "./db/file-backed-store.js";
import { logger } from "./lib/logger.js";
import { startup } from "./lib/startup-timeline.js";
import { checkBuildIntegrity } from "./lib/build-integrity.js";
import { startFreezeDetector, stopFreezeDetector } from "./lib/freeze-detector.js";
import { finalizeSessionExit, noteSessionExitKind, startSessionPostmortem } from "./lib/session-postmortem.js";
import { armShutdownDeadline } from "./lib/shutdown-deadline.js";
import {
  createShutdownSignalController,
  installShutdownSignalHandlers,
  runtimeStopBudgetFor,
  shutdownDeadlinesFor,
} from "./lib/shutdown-signals.js";
import { setRuntimeStopBudgetMs } from "./lib/shutdown-steps.js";
import { flushDB } from "./db/connection.js";
import {
  getHost,
  getPort,
  getServerProtocol,
  isShutdownEarlyFlushEnabled,
  loadTlsOptions,
  logStorageDiagnostics,
} from "./config/runtime-config.js";
import { logCsrfTrustSummary } from "./middleware/csrf-protection.js";
import { startEnvWatcher } from "./config/env-watcher.js";
import { migrateTaskbarShortcuts } from "./services/setup/taskbar-shortcut-migration.js";
import { sidecarProcessService } from "./services/sidecar/sidecar-process.service.js";
import {
  consoleTrayBrowserUrl,
  startConsoleTrayService,
  stopConsoleTrayService,
} from "./services/console-tray/console-tray.service.js";
import { startRuntimeMemoryMonitor } from "./utils/runtime-memory.js";

function isAddressInUseError(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && "code" in err && err.code === "EADDRINUSE";
}

function scheduleTaskbarShortcutMigration() {
  const timeout = setTimeout(() => {
    const installDir = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
    void migrateTaskbarShortcuts(installDir).catch((err) => {
      logger.warn({ err }, "taskbar shortcut migration skipped");
    });
  }, 1_000);
  timeout.unref?.();
}

function logFatalProcessError(reason: unknown, message: string): void {
  if (reason instanceof Error) {
    logger.error(reason, message);
    return;
  }

  logger.error({ reason }, message);
}

function stopDevelopmentWatcherAfterLeaseConflict(error: unknown): void {
  if (!(error instanceof StorageWriterLeaseError) || !process.argv.includes("--marinara-dev-watch")) return;
  if (process.ppid <= 1) return;
  try {
    process.kill(process.ppid, "SIGTERM");
  } catch (signalError) {
    if ((signalError as NodeJS.ErrnoException).code !== "ESRCH") {
      logger.warn(signalError, "[startup] Could not stop the development watcher after a writer lease conflict");
    }
  }
}

async function main() {
  // Under dist: warns (ME_BUILD_STALE) when dist lacks a src module or src changed after the build.
  const buildIntegrity = await startup.phase("build.integrity", () => checkBuildIntegrity());
  const tls = await startup.phase("config.tls", () => loadTlsOptions());
  await startup.phase("storage.diagnostics", () => logStorageDiagnostics());
  const app = await startup.phase("app.build", () => buildApp(tls ?? undefined));
  const envWatcher = startEnvWatcher();
  const protocol = tls ? "https" : getServerProtocol();
  const port = getPort();
  const host = getHost();
  let isShuttingDown = false;
  let stopRuntimeMemoryMonitor: () => void = () => undefined;

  const reapSidecar = () => {
    sidecarProcessService.killCurrentChildForProcessExit();
  };

  process.once("exit", reapSidecar);
  // #5506 diagnostics: stamp how this session ended. Every deliberate ending
  // reaches process "exit" (signal shutdown, in-app update, Advanced Settings
  // restart, a fatal crash); an external SIGKILL reaches nothing, which is
  // precisely the signal the postmortem reports at the next startup.
  process.once("exit", (code) => {
    finalizeSessionExit(code);
  });
  process.on("uncaughtException", (err) => {
    logFatalProcessError(err, "[process] Uncaught exception; reaping sidecar before exit");
    noteSessionExitKind("crash");
    reapSidecar();
    process.exit(1);
  });
  process.on("unhandledRejection", (reason) => {
    logFatalProcessError(reason, "[process] Unhandled rejection; reaping sidecar before exit");
    noteSessionExitKind("crash");
    reapSidecar();
    process.exit(1);
  });

  const shutdown = async (signal: NodeJS.Signals) => {
    if (isShuttingDown) {
      logger.warn("Received %s while shutdown is already in progress", signal);
      return;
    }

    isShuttingDown = true;
    logger.info("Received %s; shutting down Marinara Engine", signal);
    // Restore the console (if the tray hid it) and remove the tray icon, alongside the close below.
    const trayStopped = stopConsoleTrayService();
    // #5838: bound the whole close - sever connections at 4 s, force-exit at
    // 8 s - so a supervisor's stop window (earlyoom ~10 s, Docker 10 s) never
    // expires on a connection-wait and escalates to a write-dropping SIGKILL.
    // A Windows console close gets a tighter budget (see shutdownDeadlinesFor);
    // every other signal keeps the defaults above.
    armShutdownDeadline(app, signal, shutdownDeadlinesFor(signal));
    setRuntimeStopBudgetMs(runtimeStopBudgetFor(signal));

    // Opt-in (SHUTDOWN_EARLY_FLUSH): start writing pending saves now, while
    // app.close() may still be waiting on open connections; the store close
    // inside onClose writes the rest.
    if (isShutdownEarlyFlushEnabled()) {
      // The store already logs a failed flush at error level, and the store close retries it.
      void flushDB().catch(() => {});
    }

    try {
      envWatcher.stop();
      stopRuntimeMemoryMonitor();
      stopFreezeDetector();
      await app.close();
      // Usually finished long before the close; bounded so a stuck helper never delays the exit.
      await Promise.race([trayStopped, new Promise((resolve) => setTimeout(resolve, 1_000).unref())]);
      logger.info("Shutdown complete");
      process.exit(0);
    } catch (err) {
      logger.error(err, "Shutdown failed");
      process.exit(1);
    }
  };

  // Same signals and repeat handling as before by default. Opt-in:
  // SHUTDOWN_WINDOWS_CONSOLE_SIGNALS adds Ctrl+Break and the console close on
  // Windows, SHUTDOWN_FORCE_EXIT_ON_REPEAT lets a deliberate second Ctrl+C
  // force the exit.
  installShutdownSignalHandlers(
    createShutdownSignalController({
      onShutdown: (signal) => {
        void shutdown(signal);
      },
    }),
  );

  try {
    await startup.phase("http.listen", () => app.listen({ port, host }));
    logger.info(`Marinara Engine server listening on ${protocol}://${host}:${port}`);
    const ready = { ...startup.summary(), buildStale: buildIntegrity.stale };
    logger[buildIntegrity.stale ? "warn" : "info"](ready, "[startup] Ready in %d ms", ready.elapsedMs);
    startFreezeDetector();
    startSessionPostmortem();
    stopRuntimeMemoryMonitor = startRuntimeMemoryMonitor();
    logCsrfTrustSummary();
    scheduleTaskbarShortcutMigration();
    // Windows only, feature switch "consoleTray": tray icon, and the console hides when minimized.
    // Quit in the tray menu runs the same graceful shutdown as Ctrl+C.
    startConsoleTrayService({
      url: consoleTrayBrowserUrl(protocol, host, port),
      port,
      onQuit: () => void shutdown("SIGINT"),
    });
  } catch (err) {
    if (isShuttingDown) {
      logger.info("Startup interrupted by shutdown");
      return;
    }

    if (isAddressInUseError(err)) {
      logger.error(
        err,
        "Port %d is already in use. Marinara Engine could not start. Close the app using that port or set PORT to another value, for example PORT=7869 bash ./start.sh on macOS/Linux or set PORT=7869 && start.bat in Windows cmd.",
        port,
      );
    } else {
      logger.error(err);
    }
    process.exit(1);
  }
}

main().catch((err) => {
  const stage = startup.stageOf(err);
  logger.error(
    { err, event: "startup.failed", stage },
    "[startup] Unhandled error during server bootstrap (in %s)",
    stage ?? "unknown step",
  );
  stopDevelopmentWatcherAfterLeaseConflict(err);
  process.exit(1);
});
