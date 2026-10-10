import type { MariWorkspaceLatestRun } from "@marinara-engine/shared";

/** What the top-bar edge line and the top-bar pill show (P2). */
export type MariEdgeGlow = "working" | "approval" | "error" | "finished" | null;

export interface MariRunState {
  /** She is running something right now (server status). */
  working: boolean;
  /** Approvals waiting on the user. They clear when answered, not when seen. */
  pendingApprovals: number;
  /** The newest run, from the server. A change it holds behind Accept (Manual mode) waits on the user too. */
  latestRun: MariWorkspaceLatestRun | null;
  /**
   * The id of the newest run the user has seen in her window, for that run's thread. Undefined while
   * the marker loads: nothing run-based shows then, so a seen result never flashes as new.
   */
  seenRunId: string | null | undefined;
  /** A failure before the server saw the run (the client keeps this until a retry or Dismiss). */
  clientRunFailed: boolean;
}

/**
 * Priority: Needs you > Failed > Working > Done. Done and Failed stay until the user has seen that run in
 * her window; a newer run replaces an older result. Survives a reload, because the seen marker is on the
 * server.
 */
export function resolveMariEdgeGlow(state: MariRunState): MariEdgeGlow {
  const { latestRun, seenRunId } = state;
  if (state.pendingApprovals > 0 || latestRun?.heldChange === true) return "approval";
  const unseen = latestRun !== null && seenRunId !== undefined && latestRun.id !== seenRunId;
  if (state.clientRunFailed || (unseen && latestRun?.outcome === "failed")) return "error";
  if (state.working) return "working";
  if (unseen && latestRun?.outcome === "finished") return "finished";
  return null;
}
