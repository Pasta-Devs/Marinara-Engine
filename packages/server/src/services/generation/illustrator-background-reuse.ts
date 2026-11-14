// ──────────────────────────────────────────────
// Illustrator background reuse: before painting a new place, look for a
// picture the background library already has for it.
//
// A library picture serves a place when its file name (without "generated-"
// and numbering) or one of its tags of two or more words appears in the
// place text, so "john-bedroom.png" serves "Smith House, John's bedroom".
// The most specific match (most words, then longest) wins.
// ──────────────────────────────────────────────
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { extname, join } from "node:path";
import { DATA_DIR } from "../../utils/data-dir.js";

const LIBRARY_EXTS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif"]);

export type BackgroundLibraryItem = { filename: string; tags?: readonly string[] };

/** Case, accents, apostrophes and possessives folded, so "John's Bedroom" and "john-bedroom" compare equal. */
export function normalizePlaceText(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/gu, "")
    .toLowerCase()
    .replace(/[‘’ʼ`´]/gu, "'")
    .replace(/(\p{L})'s(?![\p{L}\p{N}])/gu, "$1")
    .replace(/(\p{L})s'(?![\p{L}\p{N}])/gu, "$1s")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** A library picture's place names: its file name and its tags of two or more words. */
function libraryPlaceNames(filename: string, tags: readonly string[]): string[] {
  const stem = filename
    .slice(0, filename.length - extname(filename).length)
    .replace(/^generated-/u, "")
    .replace(/[-_ ]\d+$/u, "");
  const names = [normalizePlaceText(stem.replace(/[-_]+/gu, " "))];
  // One-word tags ("interior", "night", "generated") say what a picture looks like, not which place it is.
  for (const tag of tags) {
    const name = normalizePlaceText(tag);
    if (name.includes(" ")) names.push(name);
  }
  return names.filter(Boolean);
}

/** The best library picture whose place name is found, as whole words, in the place text; or null. */
export function matchLibraryBackgroundForPlace(
  place: string | null | undefined,
  library: readonly BackgroundLibraryItem[],
): string | null {
  const text = normalizePlaceText(place);
  if (!text) return null;
  let best: { filename: string; words: number; length: number } | null = null;
  for (const item of library) {
    for (const name of libraryPlaceNames(item.filename, item.tags ?? [])) {
      if (!` ${text} `.includes(` ${name} `)) continue;
      const words = name.split(" ").length;
      if (!best || words > best.words || (words === best.words && name.length > best.length)) {
        best = { filename: item.filename, words, length: name.length };
      }
    }
  }
  return best?.filename ?? null;
}

/** The chat background library (data/backgrounds) with each picture's tags. */
export function readBackgroundLibrary(dir = join(DATA_DIR, "backgrounds")): BackgroundLibraryItem[] {
  if (!existsSync(dir)) return [];
  let meta: Record<string, { tags?: unknown }> = {};
  try {
    meta = JSON.parse(readFileSync(join(dir, "meta.json"), "utf-8")) as typeof meta;
  } catch {
    /* no tags */
  }
  try {
    return readdirSync(dir)
      .filter((file) => LIBRARY_EXTS.has(extname(file).toLowerCase()))
      .map((filename) => ({
        filename,
        tags: Array.isArray(meta[filename]?.tags)
          ? (meta[filename]!.tags as unknown[]).filter((tag): tag is string => typeof tag === "string")
          : [],
      }));
  } catch {
    return [];
  }
}
