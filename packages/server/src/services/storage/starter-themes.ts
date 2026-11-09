// ──────────────────────────────────────────────
// Starter themes (theming round 6)
//
// Themes that ship with the app (assets/starter-themes/*.json, theme package v2 files). They're
// kept as rows of custom_themes with ids "starter-<file>", so switching to one works like any
// other theme, but they're read-only: the routes refuse to change or delete them, and the app
// offers "Clone + Edit" instead. A row is refreshed when its file changes in an update.
// ──────────────────────────────────────────────
import { existsSync, readdirSync, readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { themeMetaSchema, type ThemeMeta } from "@marinara-engine/shared";
import { logger } from "../../lib/logger.js";

const STARTER_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "assets", "starter-themes");
export const STARTER_THEME_PREFIX = "starter-";

export interface StarterTheme {
  id: string;
  name: string;
  css: string;
  meta: ThemeMeta;
}

export function isStarterThemeId(id: string) {
  return id.startsWith(STARTER_THEME_PREFIX);
}

let cache: StarterTheme[] | null = null;

/** The bundled starter themes, read once. A file that doesn't parse is skipped with a warning. */
export function loadStarterThemes(dir = STARTER_DIR): StarterTheme[] {
  if (cache && dir === STARTER_DIR) return cache;
  const themes: StarterTheme[] = [];
  if (existsSync(dir)) {
    for (const file of readdirSync(dir)
      .filter((name) => name.endsWith(".json"))
      .sort()) {
      try {
        const record = JSON.parse(readFileSync(join(dir, file), "utf8")) as Record<string, unknown>;
        const { name, css, kind: _kind, formatVersion: _version, ...rest } = record;
        if (typeof name !== "string" || typeof css !== "string") throw new Error("name and css are required");
        const meta = themeMetaSchema.parse(rest);
        themes.push({ id: `${STARTER_THEME_PREFIX}${file.replace(/\.json$/, "")}`, name, css, meta });
      } catch (error) {
        logger.warn(`[themes] Skipping starter theme ${file}: ${(error as Error).message}`);
      }
    }
  }
  if (dir === STARTER_DIR) cache = themes;
  return themes;
}
