import type { ChatImageGenerationRecord } from "@marinara-engine/shared";

export interface GalleryImageUploadMetadata {
  prompt?: string;
  generation?: ChatImageGenerationRecord | string | null;
  provider?: string;
  model?: string;
  width?: number;
  height?: number;
}

export type GalleryImageUploadInput = File[] | (GalleryImageUploadMetadata & { files: File[] });

/** Multipart fields must precede the file: the server reads them as it consumes the image stream. */
export function galleryImageUploadForm(file: File, metadata: GalleryImageUploadMetadata = {}): FormData {
  const form = new FormData();
  for (const key of ["prompt", "provider", "model", "width", "height"] as const) {
    const value = metadata[key];
    if (value !== undefined) form.append(key, String(value));
  }
  if (metadata.generation) {
    form.append(
      "generation",
      typeof metadata.generation === "string" ? metadata.generation : JSON.stringify(metadata.generation),
    );
  }
  form.append("file", file);
  return form;
}
