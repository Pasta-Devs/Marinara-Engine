// ──────────────────────────────────────────────
// Generation job tracking: reconnect recovery rules (DOM-free)
//
// With the generationJobTracking feature switch on, the client re-reads the
// server's job records after a reload, a reconnect or when the tab becomes visible again.
// A finished job the user has not accounted for yet is either announced
// ("finished while you were away") or quietly marked as seen because the user
// was present when it finished. See docs/development/generation-jobs.md.
// ──────────────────────────────────────────────

export type TrackedGenerationJobStatus = "accepted" | "running" | "completed" | "failed" | "cancelled" | "interrupted";
export type TrackedGenerationJobKind = "image" | "sprite" | "video";

export interface GenerationJobLogEvent {
  event: "job.state" | "job.progress";
  state: "accepted" | "running" | "progress" | "completed" | "failed" | "cancelled" | "recovered" | "expired";
  at: string;
  jobId: string;
  chatId: string | null;
  kind: TrackedGenerationJobKind;
  sourceKind: string;
  stage: string;
  elapsedMs?: number;
  errorCode?: string;
  errorId?: string;
  outcome?: "ok" | "failed" | "cancelled" | "skipped";
}

export interface TrackedGenerationJob {
  id: string;
  kind: TrackedGenerationJobKind;
  sourceKind: string;
  label: string;
  chatId: string | null;
  status: TrackedGenerationJobStatus;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  elapsedMs: number | null;
  errorCode: string | null;
  errorId: string | null;
  resultRef: string | null;
  seenAt: string | null;
  cancellable: boolean;
  trail?: GenerationJobLogEvent[];
}

/** A stretch of time the user could not see this tab: hidden, offline, or not yet loaded. */
export interface AwayWindow {
  from: number;
  /** null while the user is still away. */
  to: number | null;
}

export function isActiveJob(job: Pick<TrackedGenerationJob, "status">): boolean {
  return job.status === "accepted" || job.status === "running";
}

/**
 * Splits unseen finished jobs into those to announce (finished before this page loaded, or while the tab was
 * hidden or offline) and those to mark seen silently (the user was here when they finished).
 */
export function partitionFinishedJobs(
  jobs: readonly TrackedGenerationJob[],
  context: { pageLoadedAt: number; away: readonly AwayWindow[] },
): { announce: TrackedGenerationJob[]; quiet: TrackedGenerationJob[] } {
  const announce: TrackedGenerationJob[] = [];
  const quiet: TrackedGenerationJob[] = [];
  for (const job of jobs) {
    if (job.seenAt || isActiveJob(job)) continue;
    const finished = Date.parse(job.finishedAt ?? job.updatedAt);
    const away =
      !Number.isFinite(finished) ||
      finished < context.pageLoadedAt ||
      context.away.some((window) => finished >= window.from && finished <= (window.to ?? Number.POSITIVE_INFINITY));
    (away ? announce : quiet).push(job);
  }
  return { announce, quiet };
}

/** "3m", "1h 5m", "2d": compact ages for narrow rows. */
export function formatJobAge(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return minutes % 60 ? `${hours}h ${minutes % 60}m` : `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

/** Only same-origin asset paths become links; anything else is shown through the job's result preview. */
export function safeResultHref(resultRef: string | null): string | null {
  if (!resultRef || !/^\/(?:api|uploads|assets)\/[A-Za-z0-9._~%/-]+$/.test(resultRef) || resultRef.includes(".."))
    return null;
  return resultRef.endsWith("/result") ? null : resultRef;
}
