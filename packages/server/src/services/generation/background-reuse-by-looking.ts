// ──────────────────────────────────────────────
// Illustrator background reuse by looking: when no library background is named
// for a place, a decision model that reads pictures looks at a few that share
// words with it and reuses one that shows the place. Optional, per chat.
// ──────────────────────────────────────────────
import { join } from "node:path";
import type { DB } from "../../db/connection.js";
import { logger } from "../../lib/logger.js";
import { DATA_DIR } from "../../utils/data-dir.js";
import {
  pickPictureShowingPlace,
  pictureFileDataUrl,
  resolvePictureDecisionBackend,
} from "../decision/picture-decisions.js";
import { libraryBackgroundCandidatesForLocation } from "./illustrator-background-reuse.js";

/** At most this many library pictures are looked at for one place. */
export const MAX_BACKGROUNDS_LOOKED_AT = 4;

/** A library background that shows `place`, or null (no model that reads pictures, no candidate, or none matched). */
export async function reuseLibraryBackgroundByLooking(
  db: DB,
  place: string,
  library: ReadonlyArray<{ filename: string; tags?: readonly string[] }>,
  signal?: AbortSignal,
): Promise<string | null> {
  const filenames = libraryBackgroundCandidatesForLocation(place, library, MAX_BACKGROUNDS_LOOKED_AT);
  if (filenames.length === 0) return null;
  const backend = await resolvePictureDecisionBackend(db, signal);
  if (!backend) return null;
  const dir = join(DATA_DIR, "backgrounds");
  const candidates: Array<{ id: string; picture: string }> = [];
  for (const filename of filenames) {
    const picture = await pictureFileDataUrl(join(dir, filename));
    if (picture) candidates.push({ id: filename, picture });
  }
  const picked = await pickPictureShowingPlace({ backend, place, candidates });
  logger.info(
    "[background-reuse] looked at %d background(s) for %s: %s",
    candidates.length,
    JSON.stringify(place.slice(0, 80)),
    picked ?? "none shows it",
  );
  return picked;
}
