import type { AdvancedMemoryJob } from "@marinara-engine/shared";

/** Only jobs that need user input should interrupt the current chat with Settings. */
export function shouldOpenAdvancedMemorySettings(job: Pick<AdvancedMemoryJob, "blocking" | "status">): boolean {
  return job.blocking !== false && (job.status === "needs_confirmation" || job.status === "error");
}
