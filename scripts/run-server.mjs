import { spawn } from "node:child_process";
import { constants } from "node:os";

// Keep restart ownership in the launcher's console. Start the replacement only
// after the old process exits, releasing its port and storage writer lease.
let child;
let stopping = false;
let stopTimer;
for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(signal, () => {
    if (stopping) return;
    stopping = true;
    process.exitCode = 128 + (constants.signals[signal] ?? 0);
    // Ctrl+C already reaches both processes sharing the terminal. Forward
    // programmatic/pipe signals, without double-signalling a graceful close.
    if (signal !== "SIGINT" || !process.stdin.isTTY) child?.kill(signal);
    stopTimer = setTimeout(() => child?.kill("SIGKILL"), 10_000);
    stopTimer.unref();
  });
}

do {
  child = spawn(process.execPath, [...process.execArgv, ...process.argv.slice(2)], {
    stdio: "inherit",
    env: { ...process.env, MARINARA_RESTART_SUPERVISOR: String(process.pid) },
  });
  const code = await new Promise((resolve) => {
    child.once("error", (error) => {
      process.stderr.write(`Could not start Marinara Engine: ${error.message}\n`);
      resolve(1);
    });
    child.once("close", (status, signal) => resolve(status ?? 128 + (constants.signals[signal] ?? 0)));
  });
  if (stopping || code !== 75) {
    clearTimeout(stopTimer);
    process.exitCode ??= code;
    break;
  }
} while (!stopping);
