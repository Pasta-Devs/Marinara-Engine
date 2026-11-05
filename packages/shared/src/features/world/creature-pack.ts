// ──────────────────────────────────────────────
// Creature packs (design-game-creature-art.md): art for the creatures Game Mode fights, by creature, with
// a size and looks of their own, in four facings (still now, walking later). Made in Pixelforge or
// imported from a file, kept in the library (`game_creature_packs`), and one chosen for every fight.
// `creaturePackSchema` is the shape; `parseCreaturePack` is the full check a pack passes before it is kept:
// its ids, its sheets' pictures and every block inside its sheet.
// ──────────────────────────────────────────────
import { z } from "zod";

export const CREATURE_PACK_SIZES = Object.freeze(["tiny", "small", "medium", "large", "huge", "gargantuan"] as const);
export type CreaturePackSize = (typeof CREATURE_PACK_SIZES)[number];
/** A creature's facings, in a block's rows (RPG Maker's layout, as a walking character's). */
export const CREATURE_FACINGS = Object.freeze(["down", "left", "right", "up"] as const);
export type CreatureFacing = (typeof CREATURE_FACINGS)[number];

/** The order a flying block's three frames play in, over and over (Capability API 1.352). */
export const CREATURE_FLY_STEPS = Object.freeze([0, 1, 2, 1] as const);

export const CREATURE_PACK_MAX = Object.freeze({ creatures: 2000, variants: 8, sheets: 64, span: 6, sheetPx: 8192 });
const PNG_DATA_URL = "data:image/png;base64,";
const id = z.string().regex(/^[a-z0-9][a-z0-9_-]{0,63}$/, "An id is lowercase letters, digits, _ and -");
/** A pack's id, which the library files under a namespace (`local/monsters`). */
const packId = z
  .string()
  .max(80)
  .regex(/^(?:[a-z0-9][a-z0-9_-]{0,15}\/)?[a-z0-9][a-z0-9_-]{0,63}$/, "An id is lowercase letters, digits, _ and -");

export const creaturePackSchema = z
  .object({
    /** 2 for a pack with flying blocks (Capability API 1.352), so an older Engine refuses it plainly. */
    creaturePackVersion: z.union([z.literal(1), z.literal(2)]),
    id: packId,
    name: z.string().trim().min(1).max(80),
    version: z.number().int().min(1).max(100_000),
    author: z.string().trim().max(80).optional(),
    /** One cell, in pixels (as an image tile pack's). */
    tileSize: z
      .number()
      .int()
      .min(16)
      .max(96)
      .refine((size) => size % 16 === 0, "A cell is a multiple of 16 pixels"),
    sheets: z
      .array(
        z
          .object({
            id,
            // Base64 and nothing else after the header, so a sheet is only ever its own picture.
            png: z
              .string()
              .startsWith(PNG_DATA_URL, "A sheet is a PNG data URL")
              .regex(/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/u, "A sheet is a PNG data URL"),
            width: z.number().int().min(1).max(CREATURE_PACK_MAX.sheetPx),
            height: z.number().int().min(1).max(CREATURE_PACK_MAX.sheetPx),
          })
          .strict(),
      )
      .min(1)
      .max(CREATURE_PACK_MAX.sheets),
    creatures: z
      .array(
        z
          .object({
            id,
            /** What it is the art of: a ruleset creature (`<catalog>/<entry>`, or `<ruleset>/<catalog>/<entry>`
             *  for one ruleset only) and names, matched with case and punctuation set aside. */
            match: z.array(z.string().trim().min(1).max(160)).min(1).max(16),
            size: z.enum(CREATURE_PACK_SIZES),
            /** One frame, in cells (RPG Maker blocks: 1 x 1 a wolf, 1 x 2 an upright Medium, 2 x 2 Large). */
            w: z.number().int().min(1).max(CREATURE_PACK_MAX.span),
            h: z.number().int().min(1).max(CREATURE_PACK_MAX.span),
            /** 1: still, one column of the four facings; 3: walking (step, stand, step). */
            frames: z.union([z.literal(1), z.literal(3)]),
            /** Its looks: each block's top-left cell on a sheet. */
            variants: z
              .array(
                z
                  .object({
                    sheet: id,
                    x: z.number().int().min(0).max(CREATURE_PACK_MAX.sheetPx),
                    y: z.number().int().min(0).max(CREATURE_PACK_MAX.sheetPx),
                  })
                  .strict(),
              )
              .min(1)
              .max(CREATURE_PACK_MAX.variants),
            /** Its flying (Capability API 1.352): a block laid out as a walking one (three frames across,
             *  the four facings down), played 0, 1, 2, 1 while it is in the air. One per look, or one for
             *  every look. */
            fly: z
              .array(
                z
                  .object({
                    sheet: id,
                    x: z.number().int().min(0).max(CREATURE_PACK_MAX.sheetPx),
                    y: z.number().int().min(0).max(CREATURE_PACK_MAX.sheetPx),
                  })
                  .strict(),
              )
              .min(1)
              .max(CREATURE_PACK_MAX.variants)
              .optional(),
          })
          .strict(),
      )
      .max(CREATURE_PACK_MAX.creatures),
  })
  .strict();
export type CreaturePack = z.infer<typeof creaturePackSchema>;
export type CreaturePackCreature = CreaturePack["creatures"][number];

/** The most a creature pack's file may be (its sheets are most of it). */
export const CREATURE_PACK_MAX_BYTES = 32_000_000;

export type CreaturePackRead = { ok: true; pack: CreaturePack; notes: string[] } | { ok: false; issues: string[] };

/** A PNG data URL's size from its header, or null when it is not a PNG (board packs read sheets the same way). */
export function sheetPngSize(dataUrl: string): { width: number; height: number } | null {
  const head = dataUrl.slice(PNG_DATA_URL.length, PNG_DATA_URL.length + 44);
  let bytes: Uint8Array;
  try {
    bytes = Uint8Array.from(atob(head.slice(0, head.length - (head.length % 4))), (char) => char.charCodeAt(0));
  } catch {
    return null;
  }
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length < 24 || signature.some((byte, n) => bytes[n] !== byte)) return null;
  if (String.fromCharCode(...bytes.slice(12, 16)) !== "IHDR") return null;
  const word = (at: number) =>
    ((bytes[at]! << 24) | (bytes[at + 1]! << 16) | (bytes[at + 2]! << 8) | bytes[at + 3]!) >>> 0;
  return { width: word(16), height: word(20) };
}

/**
 * A creature pack read and checked before it is kept: its shape; one id per sheet and per creature; every
 * sheet a PNG of the size it states; every look's block (`frames` frames across, the four facings down,
 * each frame `w` by `h` cells) inside its sheet, and every flying block (three frames across) too. A creature matching what another creature earlier in
 * the pack matches is noted (the earlier one is drawn).
 */
export function parseCreaturePack(input: unknown): CreaturePackRead {
  let value = input;
  if (typeof input === "string") {
    if (input.length > CREATURE_PACK_MAX_BYTES) return { ok: false, issues: ["The creature pack is too large."] };
    try {
      value = JSON.parse(input);
    } catch {
      return { ok: false, issues: ["The creature pack is not JSON."] };
    }
  }
  const parsed = creaturePackSchema.safeParse(value);
  if (!parsed.success)
    return {
      ok: false,
      issues: parsed.error.issues.slice(0, 8).map((issue) => `${issue.path.join(".") || "pack"}: ${issue.message}`),
    };
  const pack = parsed.data;
  const issues: string[] = [];
  const notes: string[] = [];
  const sheets = new Map<string, CreaturePack["sheets"][number]>();
  for (const sheet of pack.sheets) {
    if (sheets.has(sheet.id)) issues.push(`Two sheets are called "${sheet.id}".`);
    sheets.set(sheet.id, sheet);
    const size = sheetPngSize(sheet.png);
    if (!size) issues.push(`The sheet "${sheet.id}" is not a PNG.`);
    else if (size.width !== sheet.width || size.height !== sheet.height)
      issues.push(
        `The sheet "${sheet.id}" is ${size.width} by ${size.height} pixels, not ${sheet.width} by ${sheet.height}.`,
      );
  }
  const creatureIds = new Set<string>();
  const matched = new Map<string, string>();
  const key = (name: string) => name.toLowerCase().replace(/[^a-z0-9/]+/g, "");
  for (const creature of pack.creatures) {
    if (creatureIds.has(creature.id)) issues.push(`Two creatures are called "${creature.id}".`);
    creatureIds.add(creature.id);
    for (const [n, look] of creature.variants.entries()) {
      const sheet = sheets.get(look.sheet);
      const label = `The creature "${creature.id}"${creature.variants.length > 1 ? ` (look ${n + 1})` : ""}`;
      if (!sheet) {
        issues.push(`${label}: no sheet "${look.sheet}".`);
        continue;
      }
      const [right, bottom] = [
        (look.x + creature.frames * creature.w) * pack.tileSize,
        (look.y + 4 * creature.h) * pack.tileSize,
      ];
      if (right > sheet.width || bottom > sheet.height)
        issues.push(`${label} reaches past the edge of the sheet "${sheet.id}".`);
    }
    if (creature.fly) {
      if (pack.creaturePackVersion < 2)
        issues.push(`The creature "${creature.id}" flies, which needs creaturePackVersion 2.`);
      if (creature.fly.length !== 1 && creature.fly.length !== creature.variants.length)
        issues.push(`The creature "${creature.id}" has ${creature.fly.length} flying blocks: one, or one a look.`);
      for (const [n, look] of creature.fly.entries()) {
        const sheet = sheets.get(look.sheet);
        const label = `The creature "${creature.id}"'s flying${creature.fly.length > 1 ? ` (look ${n + 1})` : ""}`;
        if (!sheet) {
          issues.push(`${label}: no sheet "${look.sheet}".`);
          continue;
        }
        if (
          (look.x + 3 * creature.w) * pack.tileSize > sheet.width ||
          (look.y + 4 * creature.h) * pack.tileSize > sheet.height
        )
          issues.push(`${label} reaches past the edge of the sheet "${sheet.id}".`);
      }
    }
    for (const name of creature.match) {
      const earlier = matched.get(key(name));
      if (earlier && earlier !== creature.id)
        notes.push(`"${name}" is matched by "${earlier}" first, not "${creature.id}".`);
      else matched.set(key(name), creature.id);
    }
  }
  return issues.length ? { ok: false, issues } : { ok: true, pack, notes };
}
