// ──────────────────────────────────────────────
// Tile packs (worldgen W9a): the overworld's and the towns' art as data, a palette and every tile as
// sixteen rows of sixteen characters, one per pixel: a palette index from `0-9a-zA-Z`, or "." for clear.
// The Engine's own packs are drawn in code (scripts/art/build-overworld-tiles.mjs); a pack made in
// Pixelforge, or shared as a file, has the same shape. A tile a pack lacks is drawn plain.
//
// An image pack (version 2, Pixelforge's image tiles) draws its tiles from PNG sheets laid out on a grid
// of cells `tileSize` pixels across (48 for the RPG Maker look the art direction chose), each tile a
// rect of whole cells: one cell, or a sprite of several (a house over its lot, a tree two cells high).
// The sheets travel inside the pack as data URLs, so the library, share files and map packs carry an
// image pack as they carry a drawn one.
// ──────────────────────────────────────────────
import { z } from "zod";
import { WORLD_FURNITURE } from "./furniture.js";
import { WORLD_EDGE_BLOCK_ROWS, WORLD_EDGE_TERRAINS, WORLD_MAP_EDGE_TERRAINS } from "./edges.js";
import { WORLD_GROUND_LOOKS, WORLD_SEASONS } from "./overworld.js";
import { WORLD_TOWN_PROPS } from "./edits.js";

/** Pixels across and down a tile. */
export const TILE_PACK_SIZE = 16;
/** The characters a row is written in, a palette index each; "." is a clear pixel. */
export const TILE_PACK_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
export const TILE_PACK_CLEAR = ".";
/** The most variants a tile has. */
export const TILE_PACK_MAX_VARIANTS = 8;
/** The largest share file the Engine reads: a drawn pack, and an image pack. */
export const TILE_PACK_MAX_BYTES = 1_000_000;
export const TILE_PACK_IMAGE_MAX_BYTES = 6_000_000;
/** A whole image pack's file: its sheets, and room for its names and tiles beside them. */
export const TILE_PACK_IMAGE_FILE_MAX_BYTES = TILE_PACK_IMAGE_MAX_BYTES + 300_000;
/** The most pixels an image pack's sheets hold together (what a browser decodes to draw them). */
export const TILE_PACK_IMAGE_MAX_PIXELS = 16_777_216;
/** An image pack's cells, in pixels: the fewest and the most. */
export const TILE_PACK_IMAGE_CELL = [16, 96] as const;
/** An image pack's sheets: how many, how big each is across and down, and the most cells a sprite spans. */
export const TILE_PACK_IMAGE_SHEETS = 16;
export const TILE_PACK_IMAGE_SHEET_PX = 4096;
export const TILE_PACK_IMAGE_SPAN = 8;
/** An edge tile's block runs longer than a sprite: up to 30 cells down, with its slants and curves. */
export const TILE_PACK_EDGE_BLOCK_MAX_ROWS = 30;
/** The most characters an image pack has, and colours a character's recolour region lists. */
export const TILE_PACK_MAX_CHARACTERS = 64;
export const TILE_PACK_RECOLOUR_COLOURS = 8;

const NINE = ["nw", "n", "ne", "w", "c", "e", "sw", "s", "se"] as const;

/** A dungeon set's props: how many, and which one is the way out. */
export const WORLD_DUNGEON_PROP_COUNT = 8;
export const WORLD_DUNGEON_WAY_OUT_PROP = "dn_prop5";
function dungeonTileIds() {
  return [
    "dn_floor",
    "dn_wall",
    "dn_liquid",
    // A wall's face where a floor lies below it, its top elsewhere and a door standing in a doorway (image
    // packs, 2026-11-16): a pack without them draws every wall cell as dn_wall.
    "dn_wall_face",
    "dn_wall_top",
    "dn_door_wall",
    ...WORLD_MAP_EDGE_TERRAINS.map((terrain) => `edge_${terrain}` as const),
    "dn_prop0",
    "dn_prop1",
    "dn_prop2",
    "dn_prop3",
    "dn_prop4",
    "dn_prop5",
    "dn_prop6",
    "dn_prop7",
  ] as const;
}

/** Every tile the overworld, the towns and the maps of places draw. */
export const WORLD_TILE_IDS = Object.freeze([
  ...WORLD_GROUND_LOOKS,
  "marker0",
  "marker1",
  "marker2",
  "marker3",
  "ruin",
  "party",
  "town_ground",
  "street",
  "square",
  "wall",
  "wall_window",
  "wall_door",
  "stall",
  "well",
  "tree",
  "folk",
  ...NINE.map((at) => `roof_${at}`),
  ...NINE.map((at) => `hall_${at}`),
  // Whole buildings as sprites (image packs): a home, and any other building, drawn over its lot in
  // place of the roofs and fronts above.
  "house",
  "hall",
  // Inside buildings (worldgen W13): the floor, a wall, a doorway, and each piece of furniture.
  "in_floor",
  "in_wall",
  "in_door",
  ...WORLD_FURNITURE.map((kind) => `in_${kind}` as const),
  // Edge tiles (image packs): each variant a block of sixteen pieces, four cells by four, for a terrain
  // that blends into the ground around it.
  ...WORLD_EDGE_TERRAINS.map((terrain) => `edge_${terrain}` as const),
  // Fringes (image packs): for a ground look, sixteen masks through which it spills onto its neighbours.
  ...WORLD_GROUND_LOOKS.map((look) => `fringe_${look}` as const),
  // A site on the overworld the party can walk into (a cave, mine or ruin outside any town): its marker, a
  // pack's own (image packs; each variant a kind of site, picked per place).
  "site",
  // Towns laid out freely (image packs; map editor Phase 2): a bridge over water, a hedge or fence, and a
  // pack's eight decorations. Fields draw as the farmland look, paths and water with their edge tiles.
  "bridge",
  "hedge",
  ...WORLD_TOWN_PROPS,
  // Maps of places (image packs; map editor Phase 3): a cave, dungeon or station set's floor, wall and liquid,
  // the liquid's edges, and eight props (WORLD_DUNGEON_PROP_COUNT; the sixth, dn_prop5, is the way out). Generic
  // ids, so one map plays with any set's pack.
  ...dungeonTileIds(),
] as const);
export type WorldTileId = (typeof WORLD_TILE_IDS)[number];
/** Ground an image pack may draw as a pattern (user, 2026-10-05, ground art in many looks): a variant larger
 *  than one cell is a texture laid over the ground by position (a cell at (x, y) draws the pattern's cell at
 *  (x mod w, y mod h)), so a texture several cells across tiles without a seam or a visible repeat. The first
 *  such variant is the pattern; the others are left aside, since mixing two would show where they meet. */
export const WORLD_PATTERN_TILE_IDS: readonly WorldTileId[] = Object.freeze([
  ...WORLD_GROUND_LOOKS,
  "town_ground",
  "street",
  "square",
  "in_floor",
  "in_wall",
  "dn_floor",
  "dn_wall",
  "dn_liquid",
  "dn_wall_face",
  "dn_wall_top",
]);
/** Tiles only an image pack draws (whole buildings as sprites); a drawn pack's roofs and fronts stand in. */
export const WORLD_IMAGE_ONLY_TILE_IDS: readonly WorldTileId[] = Object.freeze([
  "house",
  "hall",
  ...WORLD_EDGE_TERRAINS.map((terrain) => `edge_${terrain}` as const),
  ...WORLD_GROUND_LOOKS.map((look) => `fringe_${look}` as const),
  "site",
  "bridge",
  "hedge",
  ...WORLD_TOWN_PROPS,
  ...dungeonTileIds(),
]);

const colour = z.string().regex(/^#[0-9a-f]{6}([0-9a-f]{2})?$/i, "A colour is #rrggbb or #rrggbbaa");
const row = z.string().length(TILE_PACK_SIZE);
const variant = z.array(row).length(TILE_PACK_SIZE);

export const tilePackSchema = z
  .object({
    tilePackVersion: z.literal(1),
    /** Stored packs are namespaced (`local/...`); a built-in pack's id is its family's. */
    id: z
      .string()
      .min(1)
      .max(80)
      .regex(/^[a-z0-9][a-z0-9_/-]*$/, "An id is lowercase letters, digits, _ - and /"),
    name: z.string().trim().min(1).max(80),
    /** The setting family it is drawn for (fantasy, wuxia ...), or a kit's own. */
    family: z.string().trim().min(1).max(40),
    version: z.number().int().min(1).max(100_000),
    author: z.string().trim().max(80).optional(),
    palette: z.array(colour).min(1).max(TILE_PACK_ALPHABET.length),
    tiles: z.record(z.string().max(40), z.array(variant).min(1).max(TILE_PACK_MAX_VARIANTS)),
  })
  .strict();
export type DrawnTilePack = z.infer<typeof tilePackSchema>;

const PNG_DATA_URL = "data:image/png;base64,";
const sheetId = z.string().regex(/^[a-z0-9][a-z0-9_-]{0,39}$/, "A sheet's id is lowercase letters, digits, _ and -");
// Sprites span at most TILE_PACK_IMAGE_SPAN cells (checked by id below); edge blocks run longer.
const span = z.number().int().min(1).max(TILE_PACK_EDGE_BLOCK_MAX_ROWS);

export const imageTilePackSchema = z
  .object({
    tilePackVersion: z.literal(2),
    id: tilePackSchema.shape.id,
    name: tilePackSchema.shape.name,
    family: tilePackSchema.shape.family,
    version: tilePackSchema.shape.version,
    author: tilePackSchema.shape.author,
    tileSize: z
      .number()
      .int()
      .min(TILE_PACK_IMAGE_CELL[0])
      .max(TILE_PACK_IMAGE_CELL[1])
      .refine((size) => size % 16 === 0, "A cell is a multiple of 16 pixels"),
    sheets: z
      .array(
        z
          .object({
            id: sheetId,
            png: z.string().startsWith(PNG_DATA_URL, "A sheet is a PNG data URL").max(TILE_PACK_IMAGE_MAX_BYTES),
            width: z.number().int().min(1).max(TILE_PACK_IMAGE_SHEET_PX),
            height: z.number().int().min(1).max(TILE_PACK_IMAGE_SHEET_PX),
          })
          .strict(),
      )
      .min(1)
      .max(TILE_PACK_IMAGE_SHEETS),
    tiles: z.record(
      z.string().max(40),
      z
        .array(
          z
            .object({
              sheet: sheetId,
              x: z.number().int().min(0).max(TILE_PACK_IMAGE_SHEET_PX),
              y: z.number().int().min(0).max(TILE_PACK_IMAGE_SHEET_PX),
              w: span.optional(),
              h: span.optional(),
            })
            .strict(),
        )
        .min(1)
        .max(TILE_PACK_MAX_VARIANTS),
    ),
    /** People who walk (Pixelforge characters): each a block of frames on a sheet, RPG Maker's layout. */
    characters: z
      .array(
        z
          .object({
            id: sheetId,
            sheet: sheetId,
            /** The block's top-left cell. */
            x: z.number().int().min(0).max(TILE_PACK_IMAGE_SHEET_PX),
            y: z.number().int().min(0).max(TILE_PACK_IMAGE_SHEET_PX),
            /** One frame's size in cells: one wide and two tall by default (48 x 96 at 48 px cells). */
            w: z.number().int().min(1).max(2).optional(),
            h: z.number().int().min(1).max(3).optional(),
            /** Who may wear it: the party, townsfolk, or both (when left out). */
            for: z
              .array(z.enum(["party", "folk"]))
              .min(1)
              .max(2)
              .optional(),
            /** Which of the sheet's colours are hair, eyes, skin and clothes, for recolouring to each person. */
            recolour: z
              .object(
                Object.fromEntries(
                  ["hair", "eyes", "skin", "clothes"].map((region) => [
                    region,
                    z.array(colour).max(TILE_PACK_RECOLOUR_COLOURS).optional(),
                  ]),
                ) as Record<"hair" | "eyes" | "skin" | "clothes", z.ZodOptional<z.ZodArray<typeof colour>>>,
              )
              .strict()
              .optional(),
          })
          .strict(),
      )
      .max(TILE_PACK_MAX_CHARACTERS)
      .optional(),
  })
  .strict();
export type ImageTilePack = z.infer<typeof imageTilePackSchema>;
export type ImageCharacter = NonNullable<ImageTilePack["characters"]>[number];
/** A character's walking block (RPG Maker's layout): three frames across (step, stand, step) by four rows,
 *  facing down, left, right and up. */
export const CHARACTER_FACINGS = Object.freeze(["down", "left", "right", "up"] as const);
export type CharacterFacing = (typeof CHARACTER_FACINGS)[number];

/** The frame a walk shows at a time: step, stand, step, stand (RPG Maker's 0-1-2-1). */
export const characterFrameAt = (now: number) => [0, 1, 2, 1][Math.floor(now / 180) % 4]!;
/** Which way a move faces, by its larger axis (`was` kept within a few degrees of the diagonal). */
export function characterFacing(dx: number, dy: number, was: CharacterFacing = "down"): CharacterFacing {
  if (dx === 0 && dy === 0) return was;
  const horizontal =
    Math.abs(dx) > Math.abs(dy) * 1.15 || (Math.abs(dy) <= Math.abs(dx) * 1.15 && (was === "left" || was === "right"));
  return horizontal ? (dx < 0 ? "left" : "right") : dy < 0 ? "up" : "down";
}
export type ImageTile = ImageTilePack["tiles"][string][number];

/** A tile pack: drawn (16 px rows on a palette) or made of images. */
export type TilePack = DrawnTilePack | ImageTilePack;

export type TilePackRead = { ok: true; pack: TilePack; notes: string[] } | { ok: false; issues: string[] };

const KNOWN = new Set<string>(WORLD_TILE_IDS);
/** Tiles an image pack may give seasonal variants, as `<id>@<season>` (drawn in that season, the plain id
 *  otherwise): the ground and its fringes, the town's ground and its trees. */
export const WORLD_SEASONAL_TILE_IDS: readonly WorldTileId[] = Object.freeze([
  ...WORLD_GROUND_LOOKS,
  ...WORLD_GROUND_LOOKS.map((look) => `fringe_${look}` as const),
  "town_ground",
  "tree",
]);
const IMAGE_KNOWN = new Set<string>([
  ...WORLD_TILE_IDS,
  ...WORLD_SEASONAL_TILE_IDS.flatMap((id) => WORLD_SEASONS.map((season) => `${id}@${season}`)),
]);

let crcTable: Uint32Array | null = null;
function crc32(bytes: Uint8Array, from: number, to: number): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let at = from; at < to; at++) crc = crcTable[(crc ^ bytes[at]!) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** A PNG data URL checked whole without decoding its pixels, the same in the browser and the server: the
 *  signature, an IHDR first, every chunk's CRC, an IEND last with nothing after it. Its size, or why not. */
export function pngDataUrlCheck(dataUrl: string): { width: number; height: number } | { issue: string } {
  if (!dataUrl.startsWith(PNG_DATA_URL)) return { issue: "is not a PNG data URL" };
  let bytes: Uint8Array;
  try {
    const text = atob(dataUrl.slice(PNG_DATA_URL.length));
    bytes = new Uint8Array(text.length);
    for (let at = 0; at < text.length; at++) bytes[at] = text.charCodeAt(at);
  } catch {
    return { issue: "is not base64" };
  }
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (bytes.length < 8 || signature.some((byte, at) => bytes[at] !== byte)) return { issue: "is not a PNG" };
  const word = (at: number) =>
    ((bytes[at]! << 24) | (bytes[at + 1]! << 16) | (bytes[at + 2]! << 8) | bytes[at + 3]!) >>> 0;
  let at = 8;
  let size: { width: number; height: number } | null = null;
  for (let index = 0; ; index++) {
    if (at + 12 > bytes.length) return { issue: "ends before its last chunk" };
    const length = word(at);
    const type = String.fromCharCode(bytes[at + 4]!, bytes[at + 5]!, bytes[at + 6]!, bytes[at + 7]!);
    const end = at + 8 + length;
    if (end + 4 > bytes.length) return { issue: "ends inside a chunk" };
    if (crc32(bytes, at + 4, end) !== word(end)) return { issue: `has a damaged ${type} chunk` };
    if (index === 0) {
      if (type !== "IHDR" || length !== 13) return { issue: "does not begin with its header" };
      size = { width: word(at + 8), height: word(at + 12) };
    }
    at = end + 4;
    if (type === "IEND") break;
  }
  if (at !== bytes.length) return { issue: "has data after its end" };
  return size!;
}

/** A pack read and checked: its shape, every pixel within its palette (a drawn pack), every sheet a PNG
 *  of its stated size and every tile inside its sheet (an image pack); tiles the Engine does not draw are
 *  left out and noted. An image pack's sheets are checked by their headers here; the server also decodes
 *  them before keeping one. */
export function parseTilePack(input: unknown): TilePackRead {
  let value = input;
  if (typeof input === "string") {
    if (input.length > TILE_PACK_IMAGE_FILE_MAX_BYTES)
      return { ok: false, issues: ["The file is larger than a tile pack can be."] };
    try {
      value = JSON.parse(input);
    } catch {
      return { ok: false, issues: ["The file is not JSON."] };
    }
    if (input.length > TILE_PACK_MAX_BYTES && (value as { tilePackVersion?: unknown } | null)?.tilePackVersion !== 2)
      return { ok: false, issues: ["The file is larger than a tile pack can be."] };
  }
  if ((value as { tilePackVersion?: unknown } | null)?.tilePackVersion === 2) return parseImageTilePack(value);
  const parsed = tilePackSchema.safeParse(value);
  if (!parsed.success) {
    return { ok: false, issues: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`) };
  }
  const pack = parsed.data;
  const notes: string[] = [];
  const issues: string[] = [];
  const allowed = new Set([TILE_PACK_CLEAR, ...TILE_PACK_ALPHABET.slice(0, pack.palette.length)]);
  const tiles: DrawnTilePack["tiles"] = {};
  for (const [id, variants] of Object.entries(pack.tiles)) {
    if (!KNOWN.has(id)) {
      notes.push(`"${id}" is not a tile the Engine draws, so it was left out.`);
      continue;
    }
    // A whole building is a sprite, which only an image pack has; a drawn pack's roofs and fronts stand in.
    if (WORLD_IMAGE_ONLY_TILE_IDS.includes(id as WorldTileId)) {
      notes.push(`"${id}" is drawn only from an image pack, so it was left out.`);
      continue;
    }
    variants.forEach((rows, index) => {
      rows.forEach((line, y) => {
        for (const char of line) {
          if (!allowed.has(char)) {
            issues.push(`${id} variant ${index + 1} row ${y + 1}: "${char}" is not in the palette.`);
            return;
          }
        }
      });
    });
    tiles[id] = variants;
  }
  if (issues.length) return { ok: false, issues: issues.slice(0, 20) };
  return { ok: true, pack: { ...pack, tiles }, notes: notes.slice(0, 20) };
}

function parseImageTilePack(value: unknown): TilePackRead {
  const parsed = imageTilePackSchema.safeParse(value);
  if (!parsed.success) {
    return { ok: false, issues: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`) };
  }
  const pack = parsed.data;
  const notes: string[] = [];
  const issues: string[] = [];
  const sheets = new Map<string, ImageTilePack["sheets"][number]>();
  let bytes = 0;
  let pixels = 0;
  for (const sheet of pack.sheets) {
    if (sheets.has(sheet.id)) issues.push(`Two sheets are called "${sheet.id}".`);
    sheets.set(sheet.id, sheet);
    bytes += sheet.png.length;
    pixels += sheet.width * sheet.height;
    const checked = pngDataUrlCheck(sheet.png);
    if ("issue" in checked) issues.push(`The sheet "${sheet.id}" ${checked.issue}.`);
    else if (checked.width !== sheet.width || checked.height !== sheet.height)
      issues.push(
        `The sheet "${sheet.id}" is ${checked.width} x ${checked.height}, not ${sheet.width} x ${sheet.height}.`,
      );
  }
  if (bytes > TILE_PACK_IMAGE_MAX_BYTES) issues.push("The sheets are larger than a tile pack can be.");
  if (pixels > TILE_PACK_IMAGE_MAX_PIXELS)
    issues.push(`The sheets hold more than ${TILE_PACK_IMAGE_MAX_PIXELS.toLocaleString("en")} pixels together.`);
  const tiles: ImageTilePack["tiles"] = {};
  for (const [id, variants] of Object.entries(pack.tiles)) {
    if (!IMAGE_KNOWN.has(id)) {
      notes.push(`"${id}" is not a tile the Engine draws, so it was left out.`);
      continue;
    }
    variants.forEach((tile, index) => {
      const sheet = sheets.get(tile.sheet);
      if (!sheet) {
        issues.push(`${id} variant ${index + 1}: no sheet "${tile.sheet}".`);
        return;
      }
      const [w, h] = [tile.w ?? 1, tile.h ?? 1];
      if ((tile.x + w) * pack.tileSize > sheet.width || (tile.y + h) * pack.tileSize > sheet.height)
        issues.push(`${id} variant ${index + 1} reaches past the edge of the sheet "${sheet.id}".`);
      // An edge tile is a block of sixteen pieces, four cells by four, or longer with its slanted corners (4 by
      // 6) and its curved runs (4 by 30); a sprite spans at most TILE_PACK_IMAGE_SPAN cells each way.
      if (id.startsWith("fringe_")) {
        if (w !== 4 || h !== 4)
          issues.push(`${id} variant ${index + 1} is ${w} by ${h} cells; a fringe's block is 4 by 4.`);
      } else if (id.startsWith("edge_")) {
        if (w !== 4 || !(WORLD_EDGE_BLOCK_ROWS as readonly number[]).includes(h))
          issues.push(
            `${id} variant ${index + 1} is ${w} by ${h} cells; an edge tile's block is 4 by 4, 4 by 6, or 4 by 30.`,
          );
      } else if (w > TILE_PACK_IMAGE_SPAN || h > TILE_PACK_IMAGE_SPAN)
        issues.push(`${id} variant ${index + 1} spans ${w} by ${h} cells; at most ${TILE_PACK_IMAGE_SPAN} each way.`);
    });
    tiles[id] = variants;
  }
  // The characters' blocks are drawn from one canvas of their own (2048 pixels wide, at most 8192 tall):
  // packs whose blocks could not fit on it are refused here, so none is drawn as the plain fallback.
  const blockPixels = (pack.characters ?? []).reduce(
    (sum, character) => sum + 3 * (character.w ?? 1) * 4 * (character.h ?? 2) * pack.tileSize ** 2,
    0,
  );
  if (blockPixels > 2048 * 6144)
    issues.push("The characters' frames take more room than a pack can draw; use fewer or smaller characters.");
  const characterIds = new Set<string>();
  for (const character of pack.characters ?? []) {
    if (characterIds.has(character.id)) issues.push(`Two characters are called "${character.id}".`);
    characterIds.add(character.id);
    const sheet = sheets.get(character.sheet);
    if (!sheet) {
      issues.push(`The character "${character.id}": no sheet "${character.sheet}".`);
      continue;
    }
    const [w, h] = [character.w ?? 1, character.h ?? 2];
    if ((character.x + 3 * w) * pack.tileSize > sheet.width || (character.y + 4 * h) * pack.tileSize > sheet.height)
      issues.push(`The character "${character.id}" reaches past the edge of the sheet "${sheet.id}".`);
    const seen = new Map<string, string>();
    for (const [region, colours] of Object.entries(character.recolour ?? {})) {
      for (const value of colours ?? []) {
        const key = value.slice(0, 7).toLowerCase();
        const other = seen.get(key);
        if (other && other !== region)
          issues.push(`The character "${character.id}" lists ${key} as both ${other} and ${region}.`);
        seen.set(key, region);
      }
    }
  }
  if (issues.length) return { ok: false, issues: issues.slice(0, 20) };
  return { ok: true, pack: { ...pack, tiles }, notes };
}

/** A tile's pixels as RGBA, row by row. */
export function tilePackPixels(pack: DrawnTilePack, rows: readonly string[]): Uint8ClampedArray<ArrayBuffer> {
  const colours = pack.palette.map((value) => {
    const hex = value.slice(1);
    return [0, 2, 4, 6].map((at) => (at < hex.length ? parseInt(hex.slice(at, at + 2), 16) : 255));
  });
  const out = new Uint8ClampedArray(TILE_PACK_SIZE * TILE_PACK_SIZE * 4);
  rows.forEach((line, y) => {
    [...line].forEach((char, x) => {
      if (char === TILE_PACK_CLEAR) return;
      const rgba = colours[TILE_PACK_ALPHABET.indexOf(char)];
      if (rgba) out.set(rgba, (y * TILE_PACK_SIZE + x) * 4);
    });
  });
  return out;
}
