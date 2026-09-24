// ──────────────────────────────────────────────
// Seed: Default Backgrounds
// Copies bundled background images into the data directory on first boot.
// Images sourced from Unsplash (https://unsplash.com/license — free for any use).
// ──────────────────────────────────────────────
import { logger } from "../lib/logger.js";
import { existsSync, mkdirSync, readdirSync, copyFileSync, readFileSync, renameSync, rmSync, writeFileSync } from "fs";
import { randomUUID } from "crypto";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { DATA_DIR } from "../utils/data-dir.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ASSETS_DIR = join(__dirname, "..", "assets", "default-backgrounds");
const BG_DIR = join(DATA_DIR, "backgrounds");
const BLACK_BACKGROUND_FILENAME = "Black.jpg";
const BLACK_BACKGROUND_JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAgAAAQABAAD//gAQTGF2YzYxLjE5LjEwMQD/2wBDAAgEBAQEBAUFBQUFBQYGBgYGBgYGBgYGBgYHBwcICAgHBwcGBgcHCAgICAkJCQgICAgJCQoKCgwMCwsODg4RERT/xABLAAEBAAAAAAAAAAAAAAAAAAAACAEBAAAAAAAAAAAAAAAAAAAAABABAAAAAAAAAAAAAAAAAAAAABEBAAAAAAAAAAAAAAAAAAAAAP/AABEIABAAEAMBIgACEQADEQD/2gAMAwEAAhEDEQA/AJ/AB//Z",
  "base64",
);

/** Tag definitions for each bundled background. */
const BACKGROUND_TAGS: Record<string, string[]> = {
  [BLACK_BACKGROUND_FILENAME]: ["black", "plain", "dark"],
  "ancient_library.jpg": ["interior", "library", "fantasy", "cozy"],
  "castle_cliff.jpg": ["castle", "cliff", "fantasy", "medieval", "dramatic"],
  "city_night.jpg": ["city", "night", "urban", "modern", "neon"],
  "dark_forest.jpg": ["forest", "dark", "nature", "mysterious", "night"],
  "enchanted_forest.jpg": ["forest", "nature", "green", "fantasy", "peaceful"],
  "foggy_valley.jpg": ["valley", "fog", "mountains", "nature", "mysterious"],
  "misty_mountains.jpg": ["mountains", "dramatic", "nature", "epic", "landscape"],
  "moonlit_lake.jpg": ["lake", "night", "moon", "water", "peaceful"],
  "mountain_lake.jpg": ["mountains", "lake", "nature", "landscape", "peaceful"],
  "ocean_sunset.jpg": ["ocean", "sunset", "beach", "water", "romantic"],
  "starry_mountains.jpg": ["mountains", "night", "stars", "space", "epic"],
  "tropical_beach.jpg": ["beach", "tropical", "ocean", "day", "paradise"],
  "winter_mountains.jpg": ["winter", "snow", "mountains", "cold", "landscape"],
};

export async function seedDefaultBackgrounds(backgroundDir = BG_DIR) {
  // Ensure data backgrounds directory exists
  if (!existsSync(backgroundDir)) {
    mkdirSync(backgroundDir, { recursive: true });
  }

  // Black.jpg is the default Roleplay fallback, so restore it even when the
  // user already has a background collection.
  const existingFiles = readdirSync(backgroundDir).filter((f) => /\.(jpg|jpeg|png|gif|webp|avif)$/i.test(f));
  const hasExistingCollection = existingFiles.some(
    (filename) => filename.toLowerCase() !== BLACK_BACKGROUND_FILENAME.toLowerCase(),
  );
  const blackBackgroundPath = join(backgroundDir, BLACK_BACKGROUND_FILENAME);
  const installedBlackBackground = !existsSync(blackBackgroundPath);
  if (installedBlackBackground) {
    writeFileSync(blackBackgroundPath, BLACK_BACKGROUND_JPEG);
  }

  // Existing collections only need the fallback; fresh installs also receive
  // the scenic bundled backgrounds.
  let assetFiles: string[] = [];
  if (!hasExistingCollection && existsSync(ASSETS_DIR)) {
    assetFiles = readdirSync(ASSETS_DIR).filter((f) => /\.(jpg|jpeg|png|gif|webp)$/i.test(f));
  } else if (!hasExistingCollection) {
    logger.warn("[seed] Default backgrounds assets not found — skipping");
  }

  // Copy each background file
  let copied = installedBlackBackground ? 1 : 0;
  for (const filename of assetFiles) {
    const src = join(ASSETS_DIR, filename);
    const dest = join(backgroundDir, filename);
    if (!existsSync(dest)) {
      copyFileSync(src, dest);
      copied++;
    }
  }

  // Build meta.json with tags
  const metaPath = join(backgroundDir, "meta.json");
  let meta: Record<string, { tags: string[] }> = {};
  const metaExisted = existsSync(metaPath);
  let unreadable = false;
  let preserveFailed = false;
  if (metaExisted) {
    try {
      const parsed: unknown = JSON.parse(readFileSync(metaPath, "utf-8"));
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        meta = parsed as Record<string, { tags: string[] }>;
      } else {
        unreadable = true;
      }
    } catch {
      unreadable = true;
    }
  }
  if (unreadable) {
    // Keep the unreadable file for manual recovery instead of overwriting the
    // user's tags with a rebuilt map.
    const corruptPath = `${metaPath}.corrupt-${Date.now()}`;
    try {
      renameSync(metaPath, corruptPath);
      logger.warn(
        {
          event: "storage.json_corrupt",
          path: metaPath,
          backupPath: corruptPath,
          outcome: "ok",
          reason: "preserved-and-rebuilt",
        },
        `[seed] Background meta.json was unreadable; preserved it as ${corruptPath} and rebuilt it`,
      );
    } catch (err) {
      logger.warn(
        { event: "storage.json_corrupt", path: metaPath, err, outcome: "skipped", reason: "preserve-failed" },
        "[seed] Background meta.json is unreadable and could not be preserved; leaving it untouched",
      );
      preserveFailed = true;
    }
  }
  let changed = !preserveFailed && (!metaExisted || unreadable);
  for (const filename of [BLACK_BACKGROUND_FILENAME, ...assetFiles]) {
    if (!meta[filename]) {
      meta[filename] = { tags: BACKGROUND_TAGS[filename] ?? [] };
      changed = !preserveFailed;
    }
  }
  if (changed) {
    // Temp file + rename, so a crash never leaves a torn meta.json.
    const temporaryPath = `${metaPath}.${process.pid}.${randomUUID()}.tmp`;
    try {
      writeFileSync(temporaryPath, JSON.stringify(meta, null, 2), "utf-8");
      renameSync(temporaryPath, metaPath);
    } finally {
      if (existsSync(temporaryPath)) rmSync(temporaryPath, { force: true });
    }
  }

  if (hasExistingCollection) {
    if (installedBlackBackground) logger.info("[seed] Restored default Black.jpg background");
    return;
  }

  if (copied > 0) {
    logger.info(`[seed] Installed ${copied} default background${copied > 1 ? "s" : ""}`);
  }
}
