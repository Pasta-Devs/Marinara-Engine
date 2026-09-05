import { logger } from "./logger.js";
import { noteSessionExitKind } from "./session-postmortem.js";

/**
 * #5838 field finding: a SteamOS box's earlyoom sent SIGTERM and our graceful
 * shutdown took 39 seconds, because shutdown() awaits app.close() without any
 * bound and Fastify's close waits for open connections - a phone browser
 * holding an SSE stream is enough. earlyoom gives roughly 10 seconds before
 * treating the stop as failed; Docker and systemd have their own stop
 * timeouts. Past any of them, an orderly stop becomes a SIGKILL that drops
 * the store's debounced writes.
 *
 * Two stages, mirroring the pattern admin.routes.ts already used for its
 * restart: first sever open connections so close() can proceed to the onClose
 * flush (the gentle remedy for the observed hang), then - only if close is
 * still stuck, e.g. inside the flush itself - exit outright, because whatever
 * has not finished by then is exactly what the supervisor was about to
 * SIGKILL anyway, except we leave on our own terms with the session exit
 * stamp already recorded.
 */
export const SHUTDOWN_CONNECTION_DEADLINE_MS = 4_000;
export const SHUTDOWN_FORCE_EXIT_DEADLINE_MS = 8_000;

export interface ShutdownDeadlineOptions {
  connectionDeadlineMs?: number;
  forceExitDeadlineMs?: number;
}

export function armShutdownDeadline(
  app: { server: { closeAllConnections(): void } },
  context: string,
  options: ShutdownDeadlineOptions = {},
): void {
  const connectionDeadlineMs = options.connectionDeadlineMs ?? SHUTDOWN_CONNECTION_DEADLINE_MS;
  const forceExitDeadlineMs = options.forceExitDeadlineMs ?? SHUTDOWN_FORCE_EXIT_DEADLINE_MS;

  const connectionTimer = setTimeout(() => {
    logger.warn(
      "Graceful shutdown (%s) still waiting after %d ms; severing open connections so the close can finish",
      context,
      connectionDeadlineMs,
    );
    try {
      app.server.closeAllConnections();
    } catch (err) {
      logger.warn(err, "Could not sever open connections during shutdown");
    }
  }, connectionDeadlineMs);

  // This timer is deliberately REFERENCED - no handle kept, no unref
  // (CodeRabbit, #5863): a pending await app.close() does not keep the event
  // loop alive, so a never-settling onClose hook that has already released
  // its handles would otherwise let Node exit naturally before this fires -
  // recording a "clean" exit for a close that may have skipped the flush,
  // the exact lie the "forced" stamp exists to prevent. Successful shutdowns
  // are unaffected: every caller ends with an explicit process.exit right
  // after close, which preempts this timer.
  setTimeout(() => {
    logger.warn(
      "Graceful shutdown (%s) exceeded %d ms; forcing exit now, before a supervisor escalates to SIGKILL",
      context,
      forceExitDeadlineMs,
    );
    // Exit 0: the stop was requested and honored, matching the restart
    // routes' convention of never signaling a crash to a supervisor for an
    // intentional stop. The postmortem stamp, however, must NOT read "clean":
    // a close cut short here may have truncated the store flush, and a user
    // pasting Support Diagnostics after losing a message needs the record to
    // say the shutdown was forced - not to alibi it. Last-write-wins, so a
    // forced update-restart is stamped forced too, which is the truth that
    // matters for triage. The process "exit" hook writes the stamp.
    noteSessionExitKind("forced");
    process.exit(0);
  }, forceExitDeadlineMs);

  // The connection watchdog is advisory: if the loop empties there are no
  // connections left to sever, so it must never hold the process open.
  connectionTimer.unref();
}
