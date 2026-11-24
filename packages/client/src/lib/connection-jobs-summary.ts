// ──────────────────────────────────────────────
// Connection jobs summary — sorts every job but Main by what it runs, for the Jobs card at the top of the
// Connections panel and the Jobs page: a Model of its own, Main's or Agents' Model, or nothing. A job with a
// problem stays a full row, so its fix stays in view. Reads the tiles useConnectionDefaults builds.
// ──────────────────────────────────────────────
import { JOB, type JobKey } from "./connection-jobs";

export type JobBucket = "own" | "followsMain" | "followsAgents" | "off";

/** The parts of a job's tile (DefaultsTile) the sorting reads. */
export type SummaryTile = {
  key: JobKey;
  /** "Follows Main" or "Follows Agents", when the job runs the Model of the job it follows. */
  follows?: string;
  muted?: boolean;
  source?: unknown;
  find?: unknown;
  setup?: unknown;
  warning: { quiet?: boolean } | null;
};

/** The warning a job's row shows: an empty job's Pick or Add is its fix, so its row drops the warning. */
export const shownWarning = (tile: SummaryTile) => (tile.find ? null : tile.warning);

/** A problem, not an optional step: a quiet warning (the built-in model not downloaded) is not one. */
export const hasProblem = (tile: SummaryTile) => {
  const warning = shownWarning(tile);
  return !!warning && !warning.quiet;
};

/**
 * What a job runs, problems aside. Edge cases:
 * - With no Model to inherit, a follower names no Model and has no `follows` ("Uses the chat's model", Agents'
 *   plain "Follows Main"); it still follows that job, by the job table (Agents follow Main).
 * - A muted tile with no Model that follows nothing is an explicit Off (Voice, Dictation, Image reading "Off").
 * - Quick answers unset runs the built-in model, and Shuffle or "Same as Prof. Mari" is a choice: its own.
 * - Voice with text to speech off but a Model kept for sound effects still has that Model: its own.
 */
export function baseBucket(tile: SummaryTile, followsAgents: string): JobBucket {
  if (tile.find || tile.setup) return "off";
  if (tile.follows) return tile.follows === followsAgents ? "followsAgents" : "followsMain";
  if (tile.muted && !tile.source) {
    const from = tile.key === "agents" ? "main" : JOB[tile.key].follows;
    return from === "main" ? "followsMain" : from === "agents" ? "followsAgents" : "off";
  }
  return "own";
}

/** Problems show as rows of their own, whatever the job runs. */
export const bucketOf = (tile: SummaryTile, followsAgents: string): JobBucket =>
  hasProblem(tile) ? "own" : baseBucket(tile, followsAgents);

/**
 * Main, then the other jobs by bucket in the tiles' order (JOBS order), the jobs with a problem, and the jobs the
 * card's sentence names after "except". `followsAgents` is the "Follows Agents" text the tiles carry.
 *
 * Main is always its own line, so it is in no bucket and not among the problems (its row shows its own warning).
 * The sentence names the jobs that run a Model of their own; a follower is a row for its problem but still follows
 * Main, so it is not named there. Off jobs are never named.
 */
export function summarizeJobs<T extends SummaryTile>(tiles: readonly T[], followsAgents: string) {
  const buckets: Record<JobBucket, T[]> = { own: [], followsMain: [], followsAgents: [], off: [] };
  const problems: T[] = [];
  const exceptions: T[] = [];
  let main: T | undefined;
  for (const tile of tiles) {
    if (tile.key === "main") {
      main = tile;
      continue;
    }
    buckets[bucketOf(tile, followsAgents)].push(tile);
    if (hasProblem(tile)) problems.push(tile);
    if (baseBucket(tile, followsAgents) === "own") exceptions.push(tile);
  }
  return { main, ...buckets, problems, exceptions };
}
