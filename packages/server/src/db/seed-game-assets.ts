// ──────────────────────────────────────────────
// Seed: Default Game Assets
// Copies bundled game-mode assets (music, ambient, and SFX)
// into the data/game-assets directory on first boot.
// All assets are CC0 — see CREDITS.md in the bundle.
// ──────────────────────────────────────────────
import { logger } from "../lib/logger.js";
import { createHash } from "crypto";
import { constants, copyFileSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";
import {
  GAME_ASSETS_DIR,
  gameAssetEntry,
  realGameAssetPath,
  writeGameAssetFile,
} from "../services/game/asset-manifest.service.js";
import { BUNDLED_GAME_ASSETS_DIR } from "../services/game/native-game-assets.js";

const SEED_MARKER = join(GAME_ASSETS_DIR, ".default-assets-seeded.sha256");

// The seed writes only inside the real game-assets folder, like the manifest build: Professor Mari's shell can leave
// links in it when the data dir sits in her workspace. Returns the checked real path of a folder to copy into, created
// if missing, or null with a warning when it leads outside game-assets or cannot be made (a dangling link), so a link
// never receives the bundle and never blocks boot.
function seedFolder(dest: string): string | null {
  try {
    const realDest = realGameAssetPath(dest);
    mkdirSync(realDest, { recursive: true });
    return realDest;
  } catch (error) {
    logger.warn(
      error,
      "[seed] Skipped default game assets for %s: it leads outside game-assets or cannot be made (for example, a link to a missing folder)",
      dest,
    );
    return null;
  }
}

// The recorded bundle hash, read only from a plain file at the name: a link or a FIFO there (which would block boot)
// reads as no hash, so the seed runs again and skips the files already in place.
function readSeedMarker(): string {
  try {
    const path = gameAssetEntry(SEED_MARKER);
    return lstatSync(path).isFile() ? readFileSync(path, "utf-8").trim() : "";
  } catch {
    return "";
  }
}

function hashDirRecursive(src: string, relativeRoot = ""): string {
  const hash = createHash("sha256");
  if (!existsSync(src)) return "";

  const entries = readdirSync(src).sort((a, b) => a.localeCompare(b));
  for (const entry of entries) {
    if (entry.startsWith(".")) continue;
    const srcPath = join(src, entry);
    const relativePath = relativeRoot ? `${relativeRoot}/${entry}` : entry;
    const stat = statSync(srcPath);
    if (stat.isDirectory()) {
      hash.update(relativePath);
      hash.update(hashDirRecursive(srcPath, relativePath));
      continue;
    }
    hash.update(relativePath);
    hash.update(readFileSync(srcPath));
  }

  return hash.digest("hex");
}

/**
 * Recursively copy a source directory into a destination,
 * skipping files that already exist at the destination.
 * Returns the number of files copied; a folder seedFolder refuses is added to `skipped`.
 */
function copyDirRecursive(src: string, dest: string, skipped: string[]): number {
  if (!existsSync(src)) return 0;
  const realDest = seedFolder(dest);
  if (!realDest) {
    skipped.push(dest);
    return 0;
  }

  let copied = 0;
  const entries = readdirSync(src);

  for (const entry of entries) {
    if (entry.startsWith(".")) continue;
    const srcPath = join(src, entry);
    const stat = statSync(srcPath);

    if (stat.isDirectory()) {
      copied += copyDirRecursive(srcPath, join(dest, entry), skipped);
    } else {
      // Anything already at the name, a link included, is kept; COPYFILE_EXCL also keeps one that appears meanwhile.
      const destPath = join(realDest, entry);
      if (!lstatSync(destPath, { throwIfNoEntry: false })) {
        copyFileSync(srcPath, destPath, constants.COPYFILE_EXCL);
        copied++;
      }
    }
  }

  return copied;
}

/**
 * Ensure every directory that exists in the bundled assets has a `.native`
 * marker at the corresponding destination path. Idempotent.
 */
function ensureNativeMarkers(src: string, dest: string) {
  if (!existsSync(src)) return;
  const realDest = seedFolder(dest);
  if (!realDest) return;
  // Written only when nothing is at the name, so a link there is left alone and never written through.
  const nativeMarker = join(realDest, ".native");
  if (!lstatSync(nativeMarker, { throwIfNoEntry: false })) {
    writeGameAssetFile(nativeMarker, "");
  }
  for (const entry of readdirSync(src)) {
    if (entry.startsWith(".")) continue;
    const srcPath = join(src, entry);
    const destPath = join(dest, entry);
    if (statSync(srcPath).isDirectory()) {
      ensureNativeMarkers(srcPath, destPath);
    }
  }
}

export async function seedDefaultGameAssets(): Promise<void> {
  if (!existsSync(BUNDLED_GAME_ASSETS_DIR)) {
    logger.warn("[seed] Default game assets bundle not found — skipping");
    return;
  }

  // game-assets itself may be a link (moved to another disk) and is created as written, as ensureAssetDirs does. When it
  // cannot be (a link to an unplugged disk), the seed is skipped and runs again next boot.
  try {
    mkdirSync(GAME_ASSETS_DIR, { recursive: true });
  } catch (error) {
    logger.warn(error, "[seed] Skipped default game assets: the game-assets folder cannot be created");
    return;
  }

  const bundleHash = hashDirRecursive(BUNDLED_GAME_ASSETS_DIR);
  const existingHash = readSeedMarker();
  const needsCopy = !bundleHash || existingHash !== bundleHash;

  if (needsCopy) {
    const skipped: string[] = [];
    const copied = copyDirRecursive(BUNDLED_GAME_ASSETS_DIR, GAME_ASSETS_DIR, skipped);
    // A skipped folder (a link that leads out, or one to an unplugged disk) has not received the bundle yet, so the hash
    // is recorded only once every folder was seeded: until then the seed runs again each boot.
    if (skipped.length) {
      logger.warn("[seed] Did not record the default game assets hash: %d folder(s) were skipped", skipped.length);
    } else {
      try {
        // A new file renamed into place; a link at the name is refused and left alone.
        writeGameAssetFile(SEED_MARKER, `${bundleHash}\n`);
      } catch (error) {
        logger.warn(error, "[seed] Did not record the default game assets hash; the seed runs again next boot");
      }
    }
    if (copied > 0) {
      logger.info(`[seed] Installed ${copied} default game asset${copied > 1 ? "s" : ""} (music, ambient, SFX)`);
    }
  }

  // Always ensure native markers are up to date (idempotent)
  ensureNativeMarkers(BUNDLED_GAME_ASSETS_DIR, GAME_ASSETS_DIR);
}
