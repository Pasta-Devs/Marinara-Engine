#!/usr/bin/env node
// Runs the launcher regressions one after another, each under its own time limit (#8601). A check that hangs
// (for example on a child process that never exits) then fails within minutes and is named in the log,
// instead of silently using up the whole CI job.
import { spawn, spawnSync } from "node:child_process";
import { constants } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// Each one takes about 10 s or less on the slowest CI runner (macOS Intel).
const TIMEOUT_MS = 120_000;
// A stopped script gets this long to run its own cleanup (it may have started processes in other groups).
const STOP_GRACE_MS = 5_000;
const SCRIPTS = [
  "scripts/regressions/pnpm-runner.regression.mjs",
  "scripts/regressions/launcher/env.regression.mjs",
  "scripts/regressions/launcher/existing-server.regression.mjs",
  "scripts/regressions/launcher/update.regression.mjs",
  "scripts/regressions/dev-launcher-process.regression.mjs",
  "scripts/regressions/launcher/format-guard.regression.mjs",
  "scripts/regressions/launcher/server-build.regression.mjs",
  "scripts/check-windows-installer-layout.mjs",
];

let current = null;
let currentExited = Promise.resolve();

function signalGroup(pid, signal) {
  try {
    process.kill(-pid, signal);
  } catch (err) {
    // ESRCH: the group is already gone. EPERM: macOS can report it for a group whose members all exited.
    if (err?.code !== "ESRCH" && err?.code !== "EPERM") throw err;
  }
}

// The script runs in its own process group. It is asked to stop first, so it can clean up what it started
// in other groups. Once it exits, or after the grace period if it has not, the rest of its group is killed.
function stopCurrent() {
  if (!current?.pid || current.exitCode !== null || current.signalCode !== null) return currentExited;
  if (process.platform === "win32") {
    spawnSync("taskkill.exe", ["/pid", String(current.pid), "/T", "/F"], { stdio: "ignore" });
    return currentExited;
  }
  const { pid } = current;
  signalGroup(pid, "SIGTERM");
  const escalation = setTimeout(() => signalGroup(pid, "SIGKILL"), STOP_GRACE_MS);
  return currentExited.finally(() => {
    clearTimeout(escalation);
    signalGroup(pid, "SIGKILL"); // a member that outlived SIGTERM must not keep our output open
  });
}

let interrupted = false;
for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(signal, async () => {
    if (interrupted) return;
    interrupted = true;
    await stopCurrent();
    process.exit(128 + constants.signals[signal]);
  });
}

function run(script) {
  return new Promise((resolveRun) => {
    const started = Date.now();
    console.log(`[launcher regressions] START ${script}`);
    current = spawn(process.execPath, [script], {
      cwd: repositoryRoot,
      stdio: "inherit",
      detached: process.platform !== "win32",
    });
    const child = current;
    currentExited = new Promise((resolveExit) => {
      child.once("exit", resolveExit);
      child.once("error", resolveExit); // a script that never started has nothing to wait for
    });
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      console.error(`[launcher regressions] TIMEOUT after ${TIMEOUT_MS / 1000}s: ${script}; stopping it.`);
      void stopCurrent();
    }, TIMEOUT_MS);
    current.once("error", (error) => {
      clearTimeout(timer);
      console.error(`[launcher regressions] Could not start ${script}: ${error.message}`);
      resolveRun(false);
    });
    // stdio is inherited, so no pipe of ours outlives the script: "exit" fires as soon as the script ends.
    current.once("exit", (code, signal) => {
      clearTimeout(timer);
      const seconds = ((Date.now() - started) / 1000).toFixed(1);
      if (code === 0 && !timedOut) {
        console.log(`[launcher regressions] PASS ${script} (${seconds}s)`);
        resolveRun(true);
        return;
      }
      const reason = timedOut ? "timed out" : `exited with ${signal ?? code}`;
      console.error(`[launcher regressions] FAIL ${script} ${reason} (${seconds}s)`);
      resolveRun(false);
    });
  });
}

for (const script of SCRIPTS) {
  // A stop signal ends the run here; its handler exits once the current script is gone.
  if (interrupted || !(await run(script)) || interrupted) {
    process.exitCode = 1;
    break;
  }
}
current = null;
