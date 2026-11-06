// ──────────────────────────────────────────────
// Fight token picture (Game Mode Icon)
// ──────────────────────────────────────────────
import type { CombatIconChoice } from "../types/character.js";

// Only a picture from a character's or persona's own gallery: an icon is never a link off the app.
const GALLERY_FILE_URL_RE = /^\/api\/characters\/(?:personas\/)?[A-Za-z0-9_-]+\/gallery\/file\/[^/?#\\]+$/;

/** Read a stored choice, dropping anything that is not one of the three shapes. */
export function parseCombatIconChoice(value: unknown): CombatIconChoice | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (record.source === "avatar" || record.source === "initials") return { source: record.source };
  if (
    record.source === "image" &&
    typeof record.imageId === "string" &&
    record.imageId.trim() &&
    typeof record.url === "string" &&
    GALLERY_FILE_URL_RE.test(record.url) &&
    !record.url.includes("..")
  ) {
    return { source: "image", imageId: record.imageId, url: record.url };
  }
  return null;
}

/** The picture a fight token draws: the chosen image, the avatar, or null for the initials. */
export function resolveCombatIconUrl(choice: unknown, avatarUrl: string | null | undefined): string | null {
  const parsed = parseCombatIconChoice(choice);
  if (parsed?.source === "initials") return null;
  if (parsed?.source === "image") return parsed.url;
  return avatarUrl?.trim() || null;
}
