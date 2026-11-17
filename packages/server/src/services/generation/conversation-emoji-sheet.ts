import { stat } from "node:fs/promises";

import { logger } from "../../lib/logger.js";
import { getSharp } from "../../utils/sharp.js";

/**
 * One picture of several custom emojis or stickers, each in a numbered cell, so a model that reads images sees
 * them for the cost of one image. The numbers are drawn as seven-segment shapes, not text, because some installs
 * have no fonts for SVG text. Names stay in the prompt text ("1 = :cat_wave:"), so the model never copies a name
 * off the picture.
 */
export type EmojiSheetKind = "emoji" | "sticker";

export type EmojiSheetItem = { number: number; path: string };

export type EmojiSheet = {
  dataUrl: string;
  /** Numbers whose image loaded; an item that failed to load has no cell and must be left out of the text too. */
  numbers: number[];
  width: number;
  height: number;
};

/**
 * Cell sizes are multiples of 28 px (how Claude bills images), so a cell never pays for a partly used patch row.
 * Emojis: 112 x 140 (a 112 tile and a 28 px number strip). Stickers: 196 x 224.
 */
const LAYOUT: Record<EmojiSheetKind, { tile: number; strip: number; columns: number }> = {
  emoji: { tile: 112, strip: 28, columns: 5 },
  sticker: { tile: 196, strip: 28, columns: 3 },
};

export const EMOJI_SHEET_MAX_ITEMS: Record<EmojiSheetKind, number> = { emoji: 30, sticker: 12 };

const GRID_LINE = "#4a4a4a";
const TILE_BACKGROUND = { r: 168, g: 168, b: 168 };
const STRIP_BACKGROUND = "#ffffff";
const DIGIT_COLOR = "#111111";
const TILE_INSET = 4;

/** Seven-segment digits: a top, b top right, c bottom right, d bottom, e bottom left, f top left, g middle. */
const DIGIT_SEGMENTS: Record<string, string> = {
  "0": "abcdef",
  "1": "bc",
  "2": "abged",
  "3": "abgcd",
  "4": "fgbc",
  "5": "afgcd",
  "6": "afgedc",
  "7": "abc",
  "8": "abcdefg",
  "9": "abcdfg",
};

const DIGIT_WIDTH = 12;
const DIGIT_HEIGHT = 20;
const DIGIT_STROKE = 3;
const DIGIT_GAP = 4;

function digitRects(digit: string, left: number, y: number): string {
  const w = DIGIT_WIDTH;
  // A "1" is only its right-hand segments; centre them so "1" doesn't read as sitting off to one side.
  const x = digit === "1" ? left - Math.round((w - DIGIT_STROKE) / 2) : left;
  const h = DIGIT_HEIGHT;
  const t = DIGIT_STROKE;
  const half = Math.round(h / 2);
  const segments: Record<string, [number, number, number, number]> = {
    a: [x, y, w, t],
    b: [x + w - t, y, t, half + 1],
    c: [x + w - t, y + half - 1, t, h - half + 1],
    d: [x, y + h - t, w, t],
    e: [x, y + half - 1, t, h - half + 1],
    f: [x, y, t, half + 1],
    g: [x, y + half - Math.floor(t / 2), w, t],
  };
  return [...(DIGIT_SEGMENTS[digit] ?? "")]
    .map((segment) => {
      const [rx, ry, rw, rh] = segments[segment]!;
      return `<rect x="${rx}" y="${ry}" width="${rw}" height="${rh}" fill="${DIGIT_COLOR}"/>`;
    })
    .join("");
}

function numberRects(value: number, centerX: number, top: number): string {
  const digits = String(value);
  const width = digits.length * DIGIT_WIDTH + (digits.length - 1) * DIGIT_GAP;
  let x = Math.round(centerX - width / 2);
  let out = "";
  for (const digit of digits) {
    out += digitRects(digit, x, top);
    x += DIGIT_WIDTH + DIGIT_GAP;
  }
  return out;
}

export function emojiSheetGeometry(kind: EmojiSheetKind, count: number) {
  const { tile, strip, columns } = LAYOUT[kind];
  const cols = Math.max(1, Math.min(columns, count));
  const rows = Math.max(1, Math.ceil(count / cols));
  const cellWidth = tile;
  const cellHeight = tile + strip;
  return { tile, strip, cols, rows, cellWidth, cellHeight, width: cols * cellWidth, height: rows * cellHeight };
}

/** Background, grid, number strips and digits for a sheet; the pictures are laid on top. */
export function buildEmojiSheetBackgroundSvg(kind: EmojiSheetKind, numbers: number[]): string {
  const g = emojiSheetGeometry(kind, numbers.length);
  const tileFill = `rgb(${TILE_BACKGROUND.r},${TILE_BACKGROUND.g},${TILE_BACKGROUND.b})`;
  let body = "";
  numbers.forEach((value, index) => {
    const x = (index % g.cols) * g.cellWidth;
    const y = Math.floor(index / g.cols) * g.cellHeight;
    body += `<rect x="${x + 1}" y="${y + 1}" width="${g.cellWidth - 2}" height="${g.tile - 1}" fill="${tileFill}"/>`;
    body += `<rect x="${x + 1}" y="${y + g.tile}" width="${g.cellWidth - 2}" height="${g.strip - 1}" fill="${STRIP_BACKGROUND}"/>`;
    body += numberRects(value, x + g.cellWidth / 2, y + g.tile + Math.round((g.strip - DIGIT_HEIGHT) / 2));
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${g.width}" height="${g.height}"><rect width="100%" height="100%" fill="${GRID_LINE}"/>${body}</svg>`;
}

const sheetCache = new Map<string, EmojiSheet>();
const SHEET_CACHE_LIMIT = 24;

async function cacheKey(kind: EmojiSheetKind, items: EmojiSheetItem[]): Promise<string> {
  const parts = await Promise.all(
    items.map(async (item) => {
      try {
        const info = await stat(item.path);
        return `${item.number}\u0000${item.path}\u0000${info.mtimeMs}\u0000${info.size}`;
      } catch {
        return `${item.number}\u0000${item.path}\u0000missing`;
      }
    }),
  );
  return `${kind}\u0001${parts.join("\u0001")}`;
}

/**
 * Render a numbered sheet as a PNG data URL. Returns null when sharp cannot load (some Android/Termux installs) or
 * no picture loads; the caller then sends names only, as before.
 */
export async function renderEmojiSheet(kind: EmojiSheetKind, items: EmojiSheetItem[]): Promise<EmojiSheet | null> {
  const capped = items.slice(0, EMOJI_SHEET_MAX_ITEMS[kind]);
  if (capped.length === 0) return null;
  const sharp = await getSharp();
  if (!sharp) return null;

  const key = await cacheKey(kind, capped);
  const cached = sheetCache.get(key);
  if (cached) {
    sheetCache.delete(key);
    sheetCache.set(key, cached);
    return cached;
  }

  const { tile } = LAYOUT[kind];
  const inner = tile - TILE_INSET * 2;
  const loaded: Array<{ number: number; buffer: Buffer; width: number; height: number }> = [];
  for (const item of capped) {
    try {
      // First frame only: OpenAI refuses animated GIFs, and one frame is enough to recognise the picture.
      const { data, info } = await sharp(item.path, { animated: false, limitInputPixels: 4096 * 4096 })
        .resize(inner, inner, { fit: "inside" })
        .flatten({ background: TILE_BACKGROUND })
        .png()
        .toBuffer({ resolveWithObject: true });
      loaded.push({ number: item.number, buffer: data, width: info.width, height: info.height });
    } catch (error) {
      logger.debug(error, "[custom-emoji] Could not read %s for the picture sheet", item.path);
    }
  }
  if (loaded.length === 0) return null;

  const numbers = loaded.map((entry) => entry.number);
  const geometry = emojiSheetGeometry(kind, loaded.length);
  const composites = loaded.map((entry, index) => {
    const x = (index % geometry.cols) * geometry.cellWidth;
    const y = Math.floor(index / geometry.cols) * geometry.cellHeight;
    return {
      input: entry.buffer,
      left: x + Math.round((geometry.cellWidth - entry.width) / 2),
      top: y + Math.round((geometry.tile - entry.height) / 2),
    };
  });
  const png = await sharp(Buffer.from(buildEmojiSheetBackgroundSvg(kind, numbers)))
    .composite(composites)
    .png({ compressionLevel: 9 })
    .toBuffer();
  const sheet: EmojiSheet = {
    dataUrl: `data:image/png;base64,${png.toString("base64")}`,
    numbers,
    width: geometry.width,
    height: geometry.height,
  };
  sheetCache.set(key, sheet);
  while (sheetCache.size > SHEET_CACHE_LIMIT) {
    const oldest = sheetCache.keys().next().value;
    if (oldest === undefined) break;
    sheetCache.delete(oldest);
  }
  return sheet;
}
