import type { AddJob } from "./add-connection";
import { JOBS, jobAddKind, matchesKind } from "./connection-jobs";
import { isConnectionFlagTrue } from "./connection-filters";

/** Container providers are not services: the Add flow lists their real backends instead. */
export const isAddService = (service: string) =>
  !["audio", "decision", "image_generation", "video_generation"].includes(service);

/** A missing job has no explicit assignment; a fallback does not count as a saved choice. */
export function missingAddJobs(
  rows: readonly { provider?: string; [key: string]: unknown }[],
  features: Record<string, string | null> | undefined,
  embeddingId?: string | null,
): AddJob[] {
  return JOBS.filter((job) => {
    if (job.add !== undefined) return false;
    if (job.flag) return !rows.some((row) => matchesKind(row, job.kind!) && isConnectionFlagTrue(row[job.flag!]));
    if (job.feature) return !features?.[job.feature];
    return job.key === "embeddings" && !embeddingId;
  }).map((job) => job.key);
}

/** Offer only jobs whose kind was actually added, never a chat model for an image or voice job. */
export const jobsForAddedKinds = (kinds: readonly string[]) =>
  JOBS.filter((job) => job.add === undefined && kinds.includes(jobAddKind(job.key) ?? "")).map((job) => job.key);
