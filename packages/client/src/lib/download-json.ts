import { saveExportFile } from "./file-download";

export function sanitizeExportFilenamePart(value: string | null | undefined, fallback = "export") {
  const normalized = (value ?? "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
  return normalized || fallback;
}

/** Save JSON as a file; resolves "saved" only when the file was saved or its download started. */
export function downloadJsonFile(data: unknown, filename: string) {
  return saveExportFile(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }), filename);
}
