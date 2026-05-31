import { CHARACTER_IMPORT_UNSUPPORTED_FILE_MESSAGE, isSupportedCharacterImportFilename } from "./import-drop";
import type { ImportResultRow } from "./character-import-model";

type MarinaraImportPayload = {
  file: File;
  payload: Record<string, unknown>;
};

export type ClassifiedCharacterImportFiles = {
  stCharacterFiles: File[];
  marinaraPayloads: MarinaraImportPayload[];
  marinaraPackages: File[];
  results: ImportResultRow[];
};

export async function isZipCharacterImportFile(file: File): Promise<boolean> {
  if (file.size < 4) return false;
  const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  return head[0] === 0x50 && head[1] === 0x4b;
}

export async function classifyCharacterImportFiles(files: File[]): Promise<ClassifiedCharacterImportFiles> {
  const stCharacterFiles: File[] = [];
  const marinaraPayloads: MarinaraImportPayload[] = [];
  const marinaraPackages: File[] = [];
  const results: ImportResultRow[] = [];

  for (const file of files) {
    const lower = file.name.toLowerCase();
    if (lower.endsWith(".png") || lower.endsWith(".charx")) {
      stCharacterFiles.push(file);
      continue;
    }

    // Marinara native files are .marinara zip files (data.json + avatar
    // binary). Detect via the zip signature so a renamed file still works.
    if (await isZipCharacterImportFile(file)) {
      marinaraPackages.push(file);
      continue;
    }

    if (!isSupportedCharacterImportFilename(file.name)) {
      results.push({
        filename: file.name,
        success: false,
        message: CHARACTER_IMPORT_UNSUPPORTED_FILE_MESSAGE,
      });
      continue;
    }

    const text = await file.text();
    let json: Record<string, unknown>;
    try {
      json = JSON.parse(text) as Record<string, unknown>;
    } catch (error) {
      results.push({
        filename: file.name,
        success: false,
        message: error instanceof Error ? error.message : "Invalid JSON file",
      });
      continue;
    }

    const isMarinaraEnvelope =
      json.version === 1 && typeof json.type === "string" && (json.type as string).startsWith("marinara_");

    if (isMarinaraEnvelope) {
      marinaraPayloads.push({ file, payload: json });
    } else {
      stCharacterFiles.push(file);
    }
  }

  return { stCharacterFiles, marinaraPayloads, marinaraPackages, results };
}
