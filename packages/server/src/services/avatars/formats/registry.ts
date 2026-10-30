// ──────────────────────────────────────────────
// Avatar import: the format registry (contract; no lane edits this file)
// ──────────────────────────────────────────────
// The import route asks each importer in order whether it claims the file. Lanes fill the importers in
// their own files; this list stays fixed so no two lanes edit the same file.
import type { AvatarFormatImporter, AvatarKind } from "@marinara-engine/shared";
import { mavatarImporter } from "./mavatar.js";
import { pngtuberImporter } from "./pngtuber.js";
import { vrmImporter } from "./vrm.js";
import { mmdImporter } from "./mmd.js";

export const AVATAR_FORMAT_IMPORTERS: readonly AvatarFormatImporter[] = [
  pngtuberImporter,
  mavatarImporter,
  vrmImporter,
  mmdImporter,
];

/** The importer that claims a file, optionally limited to one kind, or null. */
export function findAvatarImporter(
  input: { filename: string; head: Uint8Array },
  kind?: AvatarKind,
): AvatarFormatImporter | null {
  return (
    AVATAR_FORMAT_IMPORTERS.find(
      (importer) => (kind === undefined || importer.kind === kind) && importer.detect(input),
    ) ?? null
  );
}
