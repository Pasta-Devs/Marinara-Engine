import { isDockerRuntime } from "../config/runtime-config.js";

let stopForRestart: ((exitCode: number) => void) | null = null;
let pending = false;

/** index.ts hands in its shutdown, so an in-app restart stops the server the same way a signal does. */
export function setRestartHandler(handler: (exitCode: number) => void): void {
  stopForRestart = handler;
}

/** The exit code that brings this server back, or null when nothing would start it again. */
export function restartExitCode(): number | null {
  if (!stopForRestart) return null;
  // The launchers (scripts/run-server.mjs) and the Docker entrypoint start a new server on 75.
  if (process.env.MARINARA_RESTART_SUPERVISOR === String(process.ppid)) return 75;
  // A custom Docker command skips the entrypoint's supervisor; then the restart policy must start the container again.
  return isDockerRuntime() ? 0 : null;
}

/** True from the restart request until the process exits; /api/health then answers 503. */
export function isRestartPending(): boolean {
  return pending;
}

export function scheduleRestart(exitCode: number): void {
  pending = true;
  // Let the 202 reach the browser before the server starts closing.
  setTimeout(() => stopForRestart?.(exitCode), 750);
}
