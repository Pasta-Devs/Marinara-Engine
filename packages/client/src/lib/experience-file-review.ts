// What the import review shows of an Experience file (Capability API 1.373), read in the browser before
// anything is sent: only the start of the file, up to the end of its manifest, never the files it holds.
import {
  EXPERIENCE_FILE_HEADER_MAX_BYTES,
  ExperienceFileError,
  ExperienceFileReader,
  readExperienceFileManifest,
  type ExperienceFileSummary,
} from "@marinara-engine/shared";

const SLICE_BYTES = 64 * 1024;

export type ExperienceFileReview =
  { ok: true; summary: ExperienceFileSummary; fileBytes: number } | { ok: false; issues: string[] };

/** Reads an Experience file's manifest from its start and checks it as the import will. */
export async function readExperienceFileReview(file: Blob): Promise<ExperienceFileReview> {
  const reader = new ExperienceFileReader();
  try {
    for (let at = 0; at < Math.min(file.size, EXPERIENCE_FILE_HEADER_MAX_BYTES + SLICE_BYTES); at += SLICE_BYTES) {
      const chunk = new Uint8Array(await file.slice(at, at + SLICE_BYTES).arrayBuffer());
      const manifest = reader.push(chunk).find((event) => event.type === "manifest");
      if (manifest?.type === "manifest") {
        const read = readExperienceFileManifest(manifest.manifest);
        return read.ok ? { ok: true, summary: read.summary, fileBytes: file.size } : read;
      }
    }
  } catch (error) {
    if (error instanceof ExperienceFileError) return { ok: false, issues: [error.message] };
    throw error;
  }
  return { ok: false, issues: ["This is not an Experience file."] };
}

/** A byte count as people read it. */
export function formatExperienceBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
