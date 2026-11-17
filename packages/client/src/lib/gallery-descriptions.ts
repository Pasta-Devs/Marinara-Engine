// ──────────────────────────────────────────────
// Gallery picture descriptions: save one, or have the Image reading model describe
// a selection (sent in parts, so a long selection shows progress and can be stopped).
// ──────────────────────────────────────────────
import { GALLERY_DESCRIBE_BATCH_MAX, type GalleryDescriptionScope } from "@marinara-engine/shared";
import { api } from "./api-client";

export type DescribableGalleryImage = { id: string; description?: string | null };

export type GalleryDescriptionTarget = {
  scope: GalleryDescriptionScope;
  /** The chat, character or persona the gallery belongs to; leave out for the global galleries. */
  ownerId?: string | null;
};

export function saveGalleryDescription(target: GalleryDescriptionTarget, imageId: string, description: string | null) {
  return api.patch<{ id: string; description: string | null }>(
    `/gallery-descriptions/${target.scope}/${encodeURIComponent(imageId)}`,
    { ownerId: target.ownerId ?? undefined, description },
  );
}

type DescribeResult = { id: string; description?: string | null; skipped?: boolean; error?: string };

export type DescribeSummary = { described: number; skipped: number; failed: DescribeResult[] };

export async function describeGalleryImages(
  target: GalleryDescriptionTarget,
  imageIds: string[],
  options: { overwrite: boolean; onProgress?: (done: number) => void; signal?: AbortSignal },
): Promise<DescribeSummary> {
  const summary: DescribeSummary = { described: 0, skipped: 0, failed: [] };
  for (let start = 0; start < imageIds.length; start += GALLERY_DESCRIBE_BATCH_MAX) {
    options.signal?.throwIfAborted();
    const part = imageIds.slice(start, start + GALLERY_DESCRIBE_BATCH_MAX);
    const response = await api.post<{ results: DescribeResult[] }>(
      `/gallery-descriptions/${target.scope}/describe`,
      { ownerId: target.ownerId ?? undefined, imageIds: part, overwrite: options.overwrite },
      { signal: options.signal },
    );
    for (const result of response.results) {
      if (result.error) summary.failed.push(result);
      else if (result.skipped) summary.skipped++;
      else summary.described++;
    }
    options.onProgress?.(Math.min(imageIds.length, start + part.length));
  }
  return summary;
}
