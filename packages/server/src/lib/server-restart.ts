import { isDockerRuntime } from "../config/runtime-config.js";

let stopForRestart: ((exitCode: number) => void) | null = null;

/** index.ts hands in its shutdown, so an in-app restart stops the server the same way a signal does. */
export function setRestartHandler(handler: (exitCode: number) => void): void {
  stopForRestart = handler;
}

/** The exit code that brings this server back, or null when nothing would start it again. */
export function restartExitCode(): number | null {
  if (!stopForRestart) return null;
  // Docker's restart policy restarts a clean exit; the launcher's supervisor (scripts/run-server.mjs) waits for 75.
  if (isDockerRuntime()) return 0;
  return process.env.MARINARA_RESTART_SUPERVISOR === String(process.ppid) ? 75 : null;
}

export function restartServer(exitCode: number): void {
  stopForRestart?.(exitCode);
}
