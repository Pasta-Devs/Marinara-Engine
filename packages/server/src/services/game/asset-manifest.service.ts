// ──────────────────────────────────────────────
// Game: Asset Manifest Scanner
//
// Scans the game-assets directory tree and builds
// a tag → path manifest. Re-scans on demand or
// after uploads.
// ──────────────────────────────────────────────
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
  type Dirent,
  type Stats,
} from "fs";
import { join, extname, relative, basename, dirname } from "path";
import { WORLD_ART_FAMILIES, type MusicGenre, type MusicIntensity } from "@marinara-engine/shared";
import { logger } from "../../lib/logger.js";
import { realPathInAppFolder, realPathInRealFolder } from "../../utils/app-folder.js";
import { DATA_DIR } from "../../utils/data-dir.js";

export const GAME_ASSETS_DIR = join(DATA_DIR, "game-assets");
const USER_BACKGROUNDS_DIR = join(DATA_DIR, "backgrounds");
const MANIFEST_PATH = join(GAME_ASSETS_DIR, "manifest.json");

// Professor Mari's shell can make links inside the data dir when it sits in her workspace, so a game-assets path is
// never used as written. game-assets itself may be a link (moved to another disk), so, as the file route does, it is
// held to its own real path: a path is used only while it resolves inside it, and a link inside that leads out is
// refused. See realPathInAppFolder for the check-then-use window.
// ponytail: a game-assets folder replaced as a whole by a link is followed like a user's own move to another disk;
// extending the shell sandbox's read-only rule to the data dir's app folders (#8797) keeps that link from being made.
export function realGameAssetPath(path: string): string {
  return realPathInRealFolder(GAME_ASSETS_DIR, path);
}

// The name `path` in its checked real folder, to rename, delete, read or copy. A rename or delete acts on a link at
// the name, never through it, and a link there is accepted only while it leads inside the real game-assets folder.
export function gameAssetEntry(path: string): string {
  const entry = join(realGameAssetPath(dirname(path)), basename(path));
  if (lstatSync(entry, { throwIfNoEntry: false })?.isSymbolicLink()) realGameAssetPath(entry);
  return entry;
}

export function tempWritePath(filePath: string): string {
  return join(
    dirname(filePath),
    `.${basename(filePath)}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`,
  );
}

// Writes a new temporary file in the checked real folder and renames it over the name, so a link that appears at the
// name later is replaced, never followed. A link already at the name is refused.
export function writeGameAssetFile(path: string, data: string | Buffer): void {
  const entry = join(realGameAssetPath(dirname(path)), basename(path));
  if (lstatSync(entry, { throwIfNoEntry: false })?.isSymbolicLink()) {
    throw new Error(`Linked game asset file refused: ${basename(entry)}`);
  }
  mkdirSync(dirname(entry), { recursive: true });
  const temporary = tempWritePath(entry);
  try {
    writeFileSync(temporary, data, { flag: "wx" });
    renameSync(temporary, entry);
  } catch (error) {
    rmSync(temporary, { force: true });
    throw error;
  }
}

export interface AssetFolderEntry {
  name: string;
  /** The name in the folder's checked real path. */
  path: string;
  /** lstat of a real entry; stat of a linked file's target. */
  stat: Stats;
}

// The entries of `dir`, read in its real path held by `bound`. A linked folder in it is never listed for entering, so a
// link cycle cannot be followed, and a linked file is kept only while it leads to a file inside. Anything else is skipped with a
// warning, never thrown, since startup scans here. Linked folders are not a supported game-assets layout: the file
// route never served a link that leads out, and nothing the app writes there is a link.
function listFolder(bound: (path: string) => string, dir: string): AssetFolderEntry[] {
  let realDir: string;
  let names: Dirent[];
  try {
    realDir = bound(dir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    logger.warn(error, "[game-assets] Skipped %s: its real path is outside its folder", dir);
    return [];
  }
  try {
    names = readdirSync(realDir, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  const entries: AssetFolderEntry[] = [];
  for (const entry of names) {
    if (entry.name.startsWith(".")) continue; // skip hidden files
    const path = join(realDir, entry.name);
    if (!entry.isSymbolicLink()) {
      entries.push({ name: entry.name, path, stat: lstatSync(path) });
      continue;
    }
    try {
      const stat = lstatSync(bound(path));
      if (stat.isFile()) entries.push({ name: entry.name, path, stat });
      else logger.warn("[game-assets] Skipped linked folder %s: linked folders are not scanned", join(dir, entry.name));
    } catch (error) {
      logger.warn(error, "[game-assets] Skipped link %s: it leads outside its folder", join(dir, entry.name));
    }
  }
  return entries;
}

/** The entries of a game-assets folder; see listFolder. */
export function listGameAssetFolder(dir: string): AssetFolderEntry[] {
  return listFolder(realGameAssetPath, dir);
}

/** Supported file extensions by asset category. */
const EXTENSIONS: Record<string, Set<string>> = {
  music: new Set([".mp3", ".ogg", ".wav", ".flac", ".m4a", ".aac", ".webm"]),
  sfx: new Set([".mp3", ".ogg", ".wav", ".flac", ".m4a", ".aac", ".webm"]),
  ambient: new Set([".mp3", ".ogg", ".wav", ".flac", ".m4a", ".aac", ".webm"]),
  sprites: new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".svg"]),
  backgrounds: new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif"]),
};

/** A single entry in the asset manifest. */
export interface AssetEntry {
  /** Tag for referencing in prompts, e.g. "music:combat:fantasy:intense:epic-battle" */
  tag: string;
  /** Category: music, sfx, sprites, backgrounds */
  category: string;
  /** Sub-category, e.g. "combat", "exploration", "generic-fantasy" */
  subcategory: string;
  /** Filename without extension */
  name: string;
  /** Relative path from game-assets root */
  path: string;
  /** File extension */
  ext: string;
}

export interface AssetManifest {
  /** ISO timestamp of last scan */
  scannedAt: string;
  /** Total asset count */
  count: number;
  /** All assets indexed by tag */
  assets: Record<string, AssetEntry>;
  /** Assets grouped by category for quick listing */
  byCategory: Record<string, AssetEntry[]>;
}

const MUSIC_STATES = ["exploration", "dialogue", "combat", "travel_rest"] as const;
const LEGACY_MUSIC_STATE_SET = new Set<string>(MUSIC_STATES);

function inferLegacyMusicGenre(name: string, state: string): MusicGenre {
  const lower = name.toLowerCase();
  if (/(horror|dark|sinister|eerie|dread|nightmare|shadow|catastrophe|menace|hostility|desolate)/.test(lower)) {
    return "horror";
  }
  if (/(mystery|secret|hidden|ancient|arcane|illusion|truth|crypt|forgotten|unknown)/.test(lower)) {
    return "mystery";
  }
  if (/(romance|love|tender|sweet|adieu|lullaby|smile|felicitation|reverie|dreamy|devotion)/.test(lower)) {
    return "romance";
  }
  if (/(clockwork|industry|gear|city|urban|fontaine)/.test(lower)) {
    return "modern";
  }
  if (state === "dialogue" && /(town|cosy|peaceful|daily|summer|festival|chat|murmur)/.test(lower)) {
    return "slice_of_life";
  }
  return "fantasy";
}

function inferLegacyMusicIntensity(name: string, state: string): MusicIntensity {
  const lower = name.toLowerCase();
  if (
    state === "combat" ||
    /(battle|boss|fury|rage|wrath|combat|conflict|confrontation|pursuit|danger|thunder|rapid|force|war|climax)/.test(
      lower,
    )
  ) {
    return "intense";
  }
  if (/(tense|dark|mist|unrest|sinister|secret|snow|forgotten|rain|storm|night|menace|ominous|hollow)/.test(lower)) {
    return "tense";
  }
  return state === "exploration" ? "tense" : "calm";
}

function uniqueDestinationPath(destDir: string, filename: string): string {
  const ext = extname(filename);
  const base = basename(filename, ext);
  let candidate = join(destDir, filename);
  let suffix = 2;
  while (lstatSync(candidate, { throwIfNoEntry: false })) {
    candidate = join(destDir, `${base}-${suffix}${ext}`);
    suffix++;
  }
  return candidate;
}

// Moves files only from and into folders inside the real game-assets folder: a linked music/<state> folder is skipped.
function migrateLegacyFlatMusicAssets(): void {
  for (const state of MUSIC_STATES) {
    const stateDir = join(GAME_ASSETS_DIR, "music", state);

    for (const { name: entry, path: sourcePath, stat } of listGameAssetFolder(stateDir)) {
      if (!stat.isFile()) continue;

      const ext = extname(entry).toLowerCase();
      if (!EXTENSIONS.music?.has(ext)) continue;
      if (!LEGACY_MUSIC_STATE_SET.has(state)) continue;

      const name = basename(entry, ext);
      const genre = inferLegacyMusicGenre(name, state);
      const intensity = inferLegacyMusicIntensity(name, state);
      let destDir: string;
      try {
        destDir = realGameAssetPath(join(stateDir, genre, intensity));
      } catch (error) {
        logger.warn(error, "[game-assets] Left %s in place: its music folder leads outside game-assets", entry);
        continue;
      }
      if (!existsSync(destDir)) mkdirSync(destDir, { recursive: true });
      renameSync(sourcePath, uniqueDestinationPath(destDir, entry));
    }
  }
}

/** Ensure the base game-assets directory structure exists. */
export function ensureAssetDirs(): void {
  const dirs = [
    GAME_ASSETS_DIR,
    join(GAME_ASSETS_DIR, "music"),
    ...MUSIC_STATES.map((state) => join(GAME_ASSETS_DIR, "music", state)),
    join(GAME_ASSETS_DIR, "sfx", "ui"),
    join(GAME_ASSETS_DIR, "sfx", "combat"),
    join(GAME_ASSETS_DIR, "sfx", "exploration"),
    join(GAME_ASSETS_DIR, "ambient", "nature"),
    join(GAME_ASSETS_DIR, "ambient", "urban"),
    join(GAME_ASSETS_DIR, "ambient", "interior"),
    join(GAME_ASSETS_DIR, "sprites", "generic-fantasy"),
    join(GAME_ASSETS_DIR, "sprites", "generic-scifi"),
    // One folder per art family the Engine knows (worldgen W6f), where a setting's backgrounds go.
    ...WORLD_ART_FAMILIES.map((family) => join(GAME_ASSETS_DIR, "backgrounds", family)),
  ];
  // The folder itself may be a link (to another disk); every folder in it is created in its checked real path.
  mkdirSync(GAME_ASSETS_DIR, { recursive: true });
  for (const dir of dirs) {
    let realDir: string;
    try {
      realDir = realGameAssetPath(dir);
    } catch (error) {
      logger.warn(error, "[game-assets] Skipped creating %s: its real path is outside game-assets", dir);
      continue;
    }
    if (!existsSync(realDir)) mkdirSync(realDir, { recursive: true });
  }
  migrateLegacyFlatMusicAssets();
}

/** Recursively scan a directory for files matching the given extensions. */
function scanDir(
  bound: (path: string) => string,
  dir: string,
  allowedExts: Set<string>,
): Array<{ rel: string; name: string; ext: string }> {
  const results: Array<{ rel: string; name: string; ext: string }> = [];

  for (const { name: entry, stat } of listFolder(bound, dir)) {
    const full = join(dir, entry);
    if (stat.isDirectory()) {
      // Recurse into subdirectories
      const sub = scanDir(bound, full, allowedExts);
      results.push(...sub);
    } else if (stat.isFile()) {
      const ext = extname(entry).toLowerCase();
      if (allowedExts.has(ext)) {
        const rel = relative(GAME_ASSETS_DIR, full).replace(/\\/g, "/");
        const name = basename(entry, ext);
        results.push({ rel, name, ext });
      }
    }
  }
  return results;
}

/**
 * Build a tag from a relative path.
 * e.g. "music/combat/fantasy/intense/epic-battle.mp3" → "music:combat:fantasy:intense:epic-battle"
 */
function pathToTag(rel: string): string {
  const withoutExt = rel.replace(/\.[^.]+$/, "");
  return withoutExt.replace(/\//g, ":");
}

/** Extract category and subcategory from relative path. */
function parsePathParts(rel: string): { category: string; subcategory: string } {
  const parts = rel.split("/");
  return {
    category: parts[0] ?? "unknown",
    subcategory: parts[1] ?? "default",
  };
}

/** Scan the entire game-assets tree and build the manifest. */
export function buildAssetManifest(): AssetManifest {
  ensureAssetDirs();
  const assets: Record<string, AssetEntry> = {};
  const byCategory: Record<string, AssetEntry[]> = {};

  for (const [category, exts] of Object.entries(EXTENSIONS)) {
    const categoryDir = join(GAME_ASSETS_DIR, category);
    const files = scanDir(realGameAssetPath, categoryDir, exts);

    if (!byCategory[category]) byCategory[category] = [];

    for (const file of files) {
      const tag = pathToTag(file.rel);
      const { subcategory } = parsePathParts(file.rel);
      const entry: AssetEntry = {
        tag,
        category,
        subcategory,
        name: file.name,
        path: file.rel,
        ext: file.ext,
      };
      assets[tag] = entry;
      byCategory[category]!.push(entry);
    }
  }

  // Also scan user-uploaded backgrounds from data/backgrounds/
  // Held to the real backgrounds folder like the other app folders (its images are served only from the data dir).
  const userBgFiles = scanDir(
    (path) => realPathInAppFolder(USER_BACKGROUNDS_DIR, path),
    USER_BACKGROUNDS_DIR,
    EXTENSIONS.backgrounds!,
  );
  if (!byCategory.backgrounds) byCategory.backgrounds = [];
  for (const file of userBgFiles) {
    // Tag format: "backgrounds:user:<filename>" — path is relative to GAME_ASSETS_DIR
    // but served via /api/backgrounds/<filename> so we store a special marker
    const tag = `backgrounds:user:${file.name}`;
    if (assets[tag]) continue; // skip if already exists
    const entry: AssetEntry = {
      tag,
      category: "backgrounds",
      subcategory: "user",
      name: file.name,
      path: `__user_bg__/${file.name}${file.ext}`,
      ext: file.ext,
    };
    assets[tag] = entry;
    byCategory.backgrounds.push(entry);
  }

  const manifest: AssetManifest = {
    scannedAt: new Date().toISOString(),
    count: Object.keys(assets).length,
    assets,
    byCategory,
  };

  // Persist to disk for quick reload, as a new file renamed into place; a link at the name is left alone.
  if (lstatSync(MANIFEST_PATH, { throwIfNoEntry: false })?.isSymbolicLink()) {
    logger.warn("[game-assets] Kept the asset manifest in memory: manifest.json is a link and is not written through");
  } else {
    writeGameAssetFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
  }

  return manifest;
}

/** Load manifest from cache or scan if missing. */
export function getAssetManifest(): AssetManifest {
  try {
    // Only a plain file at the name is read; a link there is never followed, and the manifest is rebuilt instead.
    const path = gameAssetEntry(MANIFEST_PATH);
    if (lstatSync(path).isFile()) return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    // Missing, corrupt or refused — rebuild
  }
  return buildAssetManifest();
}
