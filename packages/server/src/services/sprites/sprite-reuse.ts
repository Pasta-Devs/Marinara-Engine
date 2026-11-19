// ──────────────────────────────────────────────
// Reusing a character's saved sprites
// ──────────────────────────────────────────────
// One rule for every feature and package that needs a character's picture: use what the user chose, else
// a saved sprite that already shows the requested expression or outfit, else draw a new one with saved
// sprites as references, else draw one from nothing. Packages reach it through `api.runtime.sprites`
// (capability API) and the client through GET /api/sprites/:ownerId/match, so no package keeps its own copy.
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import {
  findSpriteExpressionFacetMatches,
  isSpriteTalkOrBlinkFrame,
  normalizeSpriteExpressionKey,
  spriteExpressionFacetKey,
  type CapabilitySpriteMatch,
  type CapabilitySpriteRecord,
  type CapabilitySpriteRequest,
  type CapabilitySpriteResolution,
  type CapabilitySpriteKind,
} from "@marinara-engine/shared";
import { hasSpriteTransparency } from "../image/sprite-background.service.js";
import { listSpriteCatalog, spriteDirectory } from "./sprite-catalog.js";

const MIME_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
};
/** Names a library's resting picture goes by, best first. */
const DEFAULT_NAMES = ["neutral", "idle", "default", "normal", "calm", "standing"];
const MAX_REFERENCES = 4;

function tokens(value: string): string[] {
  return normalizeSpriteExpressionKey(value).split("_").filter(Boolean);
}

/** Every saved sprite of a character or persona, as a package sees it. SVG is left out: no image model reads it. */
export function listCharacterSpriteRecords(ownerId: string): CapabilitySpriteRecord[] {
  const catalog = listSpriteCatalog(ownerId);
  return catalog.sprites.flatMap((sprite) => {
    const mimeType = MIME_BY_EXT[extname(sprite.filename).toLowerCase()];
    if (!mimeType) return [];
    const kind: CapabilitySpriteKind = sprite.expression.startsWith("full_") ? "full-body" : "expression";
    const name = normalizeSpriteExpressionKey(sprite.label) || normalizeSpriteExpressionKey(sprite.expression);
    return [
      {
        handle: sprite.expression,
        kind,
        name,
        label: sprite.label.replace(/^full_/iu, ""),
        folder: sprite.folderName,
        url: sprite.url,
        mimeType,
      },
    ];
  });
}

/** Whether a record belongs to an outfit: its folder is named for it, or its name carries it as a facet. */
function wearsOutfit(record: CapabilitySpriteRecord, outfit: string[]): boolean {
  if (outfit.length === 0) return true;
  const folder = record.folder ? tokens(record.folder) : [];
  if (outfit.every((token) => folder.includes(token))) return true;
  const facets = tokens(record.name).slice(1);
  return outfit.every((token) => facets.includes(token));
}

/** The record's expression or pose: its first name token (`happy_formalwear_02` is `happy`). */
function groupOf(record: CapabilitySpriteRecord): string {
  return tokens(record.name)[0] ?? "";
}

/** Plain names before faceted ones, then by name, so the same request always picks the same picture. */
function byPlainness(a: CapabilitySpriteRecord, b: CapabilitySpriteRecord): number {
  return tokens(a.name).length - tokens(b.name).length || a.name.localeCompare(b.name);
}

function restingPicture(records: CapabilitySpriteRecord[]): CapabilitySpriteRecord | null {
  for (const name of DEFAULT_NAMES) {
    const hit = records.filter((record) => groupOf(record) === name).sort(byPlainness)[0];
    if (hit) return hit;
  }
  return [...records].sort(byPlainness)[0] ?? null;
}

/**
 * The saved sprite that already shows a request, or null. `exact` is the requested expression (or pose) in the
 * requested outfit; with no expression asked, the outfit's resting picture (neutral, idle...) matches as `outfit`.
 * A picture of the right expression in another outfit is not a match: drawing it fresh with references keeps the
 * outfit right.
 */
export function findCharacterSprite(
  records: CapabilitySpriteRecord[],
  request: CapabilitySpriteRequest,
): { sprite: CapabilitySpriteRecord; match: CapabilitySpriteMatch } | null {
  const pool = records.filter((record) => record.kind === request.kind && !isSpriteTalkOrBlinkFrame(record.name));
  const outfit = request.outfit ? tokens(request.outfit) : [];
  const expression = request.expression ? normalizeSpriteExpressionKey(request.expression) : "";
  if (expression) {
    const wanted = spriteExpressionFacetKey(expression);
    const wantedGroup = wanted.split("_")[0] ?? "";
    if (outfit.length > 0) {
      // `happy_winter_coat` in any folder, or `happy` filed in a "Winter coat" folder.
      const faceted = findSpriteExpressionFacetMatches(pool, `${wanted}_${outfit.join("_")}`, (record) => record.name)
        .filter((record) => wearsOutfit(record, outfit))
        .sort(byPlainness)[0];
      if (faceted) return { sprite: faceted, match: "exact" };
      const filed = pool
        .filter((record) => wearsOutfit(record, outfit) && spriteExpressionFacetKey(record.name).startsWith(wanted))
        .filter((record) => groupOf(record) === wantedGroup)
        .sort(byPlainness)[0];
      return filed ? { sprite: filed, match: "exact" } : null;
    }
    const same = pool.filter((record) => spriteExpressionFacetKey(record.name) === wanted).sort(byPlainness)[0];
    if (same) return { sprite: same, match: "exact" };
    const faceted = findSpriteExpressionFacetMatches(pool, wanted, (record) => record.name).sort(byPlainness)[0];
    if (faceted) return { sprite: faceted, match: "exact" };
    const group = wanted.includes("_")
      ? null
      : pool.filter((record) => groupOf(record) === wanted).sort(byPlainness)[0];
    return group ? { sprite: group, match: "exact" } : null;
  }
  const dressed = pool.filter((record) => wearsOutfit(record, outfit));
  const resting = restingPicture(dressed);
  return resting ? { sprite: resting, match: outfit.length > 0 ? "outfit" : "default" } : null;
}

/**
 * Up to `max` saved sprites to draw a missing picture from, best first: the outfit's own pictures (resting one
 * first), the requested expression in another outfit, then the resting picture of each kind. Full-body pictures
 * lead for a full-body request, faces for an expression.
 */
export function pickCharacterSpriteReferences(
  records: CapabilitySpriteRecord[],
  request: CapabilitySpriteRequest,
  max = MAX_REFERENCES,
): CapabilitySpriteRecord[] {
  const limit = Math.max(1, Math.min(MAX_REFERENCES, Math.trunc(max) || MAX_REFERENCES));
  const usable = records.filter((record) => !isSpriteTalkOrBlinkFrame(record.name));
  const outfit = request.outfit ? tokens(request.outfit) : [];
  const expression = request.expression ? spriteExpressionFacetKey(request.expression).split("_")[0] : "";
  const sameKind = usable.filter((record) => record.kind === request.kind);
  const otherKind = usable.filter((record) => record.kind !== request.kind);
  const picked: CapabilitySpriteRecord[] = [];
  const add = (record: CapabilitySpriteRecord | null | undefined) => {
    if (record && picked.length < limit && !picked.some((entry) => entry.handle === record.handle)) {
      picked.push(record);
    }
  };
  if (outfit.length > 0) {
    const dressed = sameKind.filter((record) => wearsOutfit(record, outfit));
    add(restingPicture(dressed));
    for (const record of [...dressed].sort(byPlainness)) add(record);
    add(restingPicture(otherKind.filter((record) => wearsOutfit(record, outfit))));
  }
  if (expression) add(sameKind.filter((record) => groupOf(record) === expression).sort(byPlainness)[0]);
  add(restingPicture(sameKind));
  add(restingPicture(otherKind));
  return picked;
}

/** One saved sprite's bytes, base64, or null when it is gone or not a picture an image model reads. */
export async function readCharacterSprite(
  ownerId: string,
  handle: string,
): Promise<{ base64: string; mimeType: string; transparent: boolean } | null> {
  const record = listCharacterSpriteRecords(ownerId).find((entry) => entry.handle === handle);
  if (!record) return null;
  const filename = listSpriteCatalog(ownerId).sprites.find((sprite) => sprite.expression === handle)?.filename;
  if (!filename) return null;
  try {
    const bytes = await readFile(join(spriteDirectory(ownerId), filename));
    return {
      base64: bytes.toString("base64"),
      mimeType: record.mimeType,
      transparent: await hasSpriteTransparency(bytes).catch(() => false),
    };
  } catch {
    return null;
  }
}

/**
 * The artwork rule in one call. `selected` (a saved sprite's handle the user or the package's own state chose,
 * such as an equipped outfit) wins when it still exists; then a saved sprite that already shows the request;
 * then saved sprites to draw it from; else nothing, and the caller draws from its description.
 */
export function resolveCharacterSprite(
  ownerId: string,
  request: CapabilitySpriteRequest & { selected?: string | null; maxReferences?: number },
): CapabilitySpriteResolution {
  const records = listCharacterSpriteRecords(ownerId);
  const selected = request.selected ? records.find((record) => record.handle === request.selected) : undefined;
  if (selected) return { source: "selected", sprite: selected };
  const found = findCharacterSprite(records, request);
  if (found) return { source: "library", sprite: found.sprite, match: found.match };
  const references = pickCharacterSpriteReferences(records, request, request.maxReferences);
  return references.length > 0 ? { source: "reference", references } : { source: "none" };
}
