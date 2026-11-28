// ──────────────────────────────────────────────
// Background agent candidates: what the Background agent is shown to pick from.
//
// The agent only reads text, so a picture it can't tell apart by text is a coin flip.
// It is shown:
//  - library backgrounds with a telling file name or tags (a file named only by random
//    letters and numbers, with no tags, is left out: nothing says which place it shows);
//  - background pictures in the chat's characters' and persona's galleries, by the places
//    they are labelled with and their description (these used to be missing, so a picture
//    labelled "dorm kitchen" lost to whatever unlabelled library file the agent guessed);
//  - the chat's own pinned places, as places on the picture they pin.
// The agent answers with a candidate's handle; resolveBackgroundAgentChoice turns it into
// what the chat stores as its background (a library file name or a gallery picture's URL).
// ──────────────────────────────────────────────

import {
  galleryBackgroundUrl,
  LOCATION_BACKGROUND_PINS_KEY,
  normalizeLocationBackgroundPins,
  splitLocationBackgroundNames,
} from "@marinara-engine/shared";
import { extname } from "node:path";
import { logger } from "../../lib/logger.js";
import { isChatBackgroundWeatherVersion } from "../game/game-asset-generation.js";

export type BackgroundAgentCandidate = {
  /** What the agent copies into "chosen": a library file name, or "gallery:<image id>". */
  filename: string;
  tags: string[];
  source?: "user" | "game_asset" | "gallery";
  /** Places the picture shows (gallery labels and pinned places). */
  places?: string[];
  /** Whose gallery the picture is in. */
  owner?: string;
  description?: string;
  /** What the chat stores when this is chosen (a gallery picture's URL); the file name otherwise. */
  background?: string;
};

export const GALLERY_CANDIDATE_PREFIX = "gallery:";
const DESCRIPTION_MAX = 280;

type GalleryRow = {
  id: string;
  filePath: string;
  customKind?: string | null;
  customName?: string | null;
  description?: string | null;
};

/**
 * True when a library file name says nothing about the picture: a UUID, a long hex or random id,
 * only digits, or a camera/download default such as "IMG_2041" or "background (3)".
 */
export function isUntellingBackgroundName(filename: string): boolean {
  const rawStem = filename.slice(0, filename.length - extname(filename).length).trim();
  // A UUID first: its last group is digits only sometimes, and the suffix trim below would cut it.
  if (/^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/iu.test(rawStem)) return true;
  const stem = rawStem
    .replace(/\s*\(\d+\)$/u, "")
    .replace(/[-_ ]\d+$/u, "")
    .trim();
  if (!stem) return true;
  if (/^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/iu.test(stem)) return true;
  if (/^[0-9a-f]{12,}$/iu.test(stem)) return true;
  if (/^[\d\s_.-]+$/u.test(stem)) return true;
  if (
    /^(img|image|imagen|photo|pic|picture|pxl|dsc|dscn|dcim|screenshot|screen shot|bg|background|wallpaper|download|unnamed|untitled|file)[\s_.-]*[\d\s_.-]*$/iu.test(
      stem,
    )
  )
    return true;
  // Random ids (nanoid and the like): one long run of letters and digits mixed, no separators.
  if (
    /^[A-Za-z0-9_-]{16,}$/u.test(stem) &&
    /\d/u.test(stem) &&
    /[A-Za-z]/u.test(stem) &&
    !/[-_ ]/u.test(stem.slice(1, -1))
  )
    return true;
  return false;
}

function cleanText(value: unknown, max = DESCRIPTION_MAX): string {
  if (typeof value !== "string") return "";
  const text = value.replace(/\s+/gu, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

/** Library backgrounds the agent can tell apart, plus how many were left out for having nothing to go on. */
export function libraryBackgroundAgentCandidates(
  library: ReadonlyArray<{ filename: string; tags?: readonly string[]; source?: "user" | "game_asset" }>,
): { candidates: BackgroundAgentCandidate[]; leftOut: string[] } {
  const candidates: BackgroundAgentCandidate[] = [];
  const leftOut: string[] = [];
  for (const item of library) {
    // Weather and time of day versions follow their plain picture; the agent picks among plain pictures.
    if (isChatBackgroundWeatherVersion(item.filename)) continue;
    const tags = (item.tags ?? []).map((tag) => cleanText(tag, 60)).filter(Boolean);
    if (item.source !== "game_asset" && tags.length === 0 && isUntellingBackgroundName(item.filename)) {
      leftOut.push(item.filename);
      continue;
    }
    candidates.push({ filename: item.filename, tags, ...(item.source ? { source: item.source } : {}) });
  }
  return { candidates, leftOut };
}

/** Background pictures (with places) from the chat's characters' and persona's galleries. */
export async function loadGalleryBackgroundAgentCandidates(args: {
  characters: ReadonlyArray<{ id: string; name: string }>;
  persona: { id: string; name: string } | null;
  characterGallery: { listByCharacterId(id: string): Promise<GalleryRow[]> };
  personaGallery: { listByPersonaId(id: string): Promise<GalleryRow[]> };
}): Promise<BackgroundAgentCandidate[]> {
  const out: BackgroundAgentCandidate[] = [];
  const add = (type: "character" | "persona", owner: { id: string; name: string }, rows: GalleryRow[]) => {
    for (const row of rows) {
      if (row.customKind !== "background" || !row.filePath) continue;
      const places = splitLocationBackgroundNames(row.customName ?? "").map((name) =>
        type === "character"
          ? name.replace(/\{\{\s*char\s*\}\}/giu, owner.name)
          : name.replace(/\{\{\s*user\s*\}\}/giu, owner.name),
      );
      const description = cleanText(row.description);
      out.push({
        filename: `${GALLERY_CANDIDATE_PREFIX}${row.id}`,
        tags: [],
        source: "gallery",
        places,
        owner: owner.name,
        ...(description ? { description } : {}),
        background: galleryBackgroundUrl(type, owner.id, row.filePath),
      });
    }
  };
  for (const character of args.characters) {
    try {
      add("character", character, await args.characterGallery.listByCharacterId(character.id));
    } catch (err) {
      logger.warn(err, "[background-agent] Could not read the gallery of character %s", character.id);
    }
  }
  if (args.persona) {
    try {
      add("persona", args.persona, await args.personaGallery.listByPersonaId(args.persona.id));
    } catch (err) {
      logger.warn(err, "[background-agent] Could not read the gallery of persona %s", args.persona.id);
    }
  }
  return out;
}

/**
 * Everything the agent picks from: gallery pictures first (they name their places), then the library.
 * The chat's own pinned places are added as places on the picture they pin, and an unlabelled library
 * picture that a place is pinned to is listed after all (the pin names it).
 */
export function buildBackgroundAgentCandidates(args: {
  library: ReadonlyArray<{ filename: string; tags?: readonly string[]; source?: "user" | "game_asset" }>;
  gallery?: readonly BackgroundAgentCandidate[];
  chatMetadata?: Record<string, unknown>;
}): { candidates: BackgroundAgentCandidate[]; leftOut: string[] } {
  const { candidates: library, leftOut } = libraryBackgroundAgentCandidates(args.library);
  const gallery = [...(args.gallery ?? [])].map((item) => ({ ...item, places: [...(item.places ?? [])] }));
  const pins = normalizeLocationBackgroundPins(args.chatMetadata?.[LOCATION_BACKGROUND_PINS_KEY]);
  const stillLeftOut = new Set(leftOut);
  for (const pin of pins) {
    if (!pin.background || pin.names.length === 0) continue;
    const onGallery = gallery.find((item) => item.background === pin.background);
    if (onGallery) {
      onGallery.places = Array.from(new Set([...(onGallery.places ?? []), ...pin.names]));
      continue;
    }
    const onLibrary = library.find((item) => item.filename === pin.background);
    if (onLibrary) {
      onLibrary.places = Array.from(new Set([...(onLibrary.places ?? []), ...pin.names]));
      continue;
    }
    if (stillLeftOut.has(pin.background)) {
      stillLeftOut.delete(pin.background);
      library.push({ filename: pin.background, tags: [], source: "user", places: [...pin.names] });
    }
  }
  // A gallery background with neither places (its own or a pin's) nor a description has nothing to be picked by.
  const labelledGallery = gallery.filter((item) => (item.places?.length ?? 0) > 0 || !!item.description);
  return { candidates: [...labelledGallery, ...library], leftOut: [...stillLeftOut] };
}

/** The handle the agent knows the current background by (a gallery picture's URL becomes its handle). */
export function backgroundAgentHandleFor(
  background: string | null | undefined,
  candidates: readonly BackgroundAgentCandidate[],
): string | null {
  const value = typeof background === "string" ? background.trim() : "";
  if (!value) return null;
  return candidates.find((item) => item.background === value)?.filename ?? value;
}

/**
 * What the chat should store for the agent's answer, or null when it isn't one of the candidates.
 * Exact handles first; then the same handle in another letter case or wrapped in quotes or backticks.
 */
export function resolveBackgroundAgentChoice(
  chosen: unknown,
  candidates: readonly BackgroundAgentCandidate[],
): string | null {
  if (typeof chosen !== "string") return null;
  const raw = chosen.trim();
  if (!raw || raw.toLowerCase() === "null") return null;
  const exact = candidates.find((item) => item.filename === raw);
  const loose =
    exact ??
    (() => {
      const cleaned = raw
        .replace(/^[`"'“”‘’]+|[`"'“”‘’]+$/gu, "")
        .trim()
        .toLowerCase();
      return candidates.find((item) => item.filename.toLowerCase() === cleaned);
    })();
  if (!loose) return null;
  return loose.background ?? loose.filename;
}

/** Every value the chat may store from a candidate (file names and gallery URLs), for later checks. */
export function backgroundAgentStoredValues(candidates: readonly BackgroundAgentCandidate[]): Set<string> {
  return new Set(candidates.map((item) => item.background ?? item.filename));
}
