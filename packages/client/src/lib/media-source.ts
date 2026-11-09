import { inferImageSource, inferVideoSource } from "@marinara-engine/shared";

type MediaSourceRow = {
  provider?: string | null;
  imageGenerationSource?: string | null;
  imageService?: string | null;
  videoGenerationSource?: string | null;
  videoService?: string | null;
  model?: string | null;
  baseUrl?: string | null;
};

export function rowUsesMediaSource(row: MediaSourceRow, source: string) {
  return (
    (row.provider === "image_generation" &&
      (row.imageGenerationSource || row.imageService || inferImageSource(row.model ?? "", row.baseUrl ?? "")) ===
        source) ||
    (row.provider === "video_generation" &&
      (row.videoGenerationSource || row.videoService || inferVideoSource(row.model ?? "", row.baseUrl ?? "")) ===
        source)
  );
}
