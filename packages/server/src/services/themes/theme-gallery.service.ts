// ──────────────────────────────────────────────
// Theme gallery: starter themes downloaded on demand.
//
// The gallery is `themes/index.json` plus one theme package (v2 JSON) per theme on the repo's theme
// branch. The index lists each theme's name, details, a small preview picture, and the exact byte size
// and sha256 of its file. Nothing is downloaded until someone opens the gallery (the index, ~0.5 MB)
// or picks a theme (that one file). A downloaded theme is checked against the index (size + sha256),
// parsed with the same schema as an import, and stored as a read-only "starter-<id>" row. The app's
// theme safety checks (content check at apply time, Keep countdown) apply to it like any other theme.
// ──────────────────────────────────────────────
import { createHash } from "node:crypto";
import { z } from "zod";
import { APP_VERSION, createThemeSchema, themeMetaSchema, type ThemeMeta } from "@marinara-engine/shared";
import { safeFetch } from "../../utils/security.js";
import { resolvePinnedBase } from "../docs/docs-pack.service.js";
import { STARTER_THEME_PREFIX } from "../storage/starter-themes.js";

/**
 * Base URL of the gallery folder. The UI overhaul fork keeps it on its own `kolacheee-themes` branch, so a
 * normal install (a clone of the code branch) never downloads the themes. Overridable for mirrors; must be
 * public https (safeFetch blocks private and loopback addresses).
 */
const DEFAULT_BASE_URL = "https://raw.githubusercontent.com/kolacheee/Marinara-Engine-kolacheee/kolacheee-themes";
const GALLERY_FOLDER = "themes";
const MAX_INDEX_BYTES = 4 * 1024 * 1024;
/** A theme package is CSS (256 KiB) + pictures/fonts (6 MiB) as base64 JSON, with headroom. */
const MAX_THEME_BYTES = 10 * 1024 * 1024;
const INDEX_TTL_MS = 10 * 60_000;

const galleryEntrySchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/),
  file: z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}\.json$/),
  name: z.string().min(1).max(200),
  author: z.string().max(200).optional(),
  version: z.string().max(40).optional(),
  description: z.string().max(2000).optional(),
  colorScheme: z.enum(["dark", "light", "both"]).optional(),
  labels: z.array(z.string().min(1).max(40)).max(4).optional(),
  preview: z
    .string()
    .max(160_000)
    .regex(/^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=]+$/i)
    .optional(),
  bytes: z.number().int().positive().max(MAX_THEME_BYTES),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
});

const galleryIndexSchema = z.object({
  formatVersion: z.literal(1),
  themes: z.array(galleryEntrySchema).max(200),
});

export type ThemeGalleryEntry = z.infer<typeof galleryEntrySchema>;

export function themeGalleryBaseUrl(): string {
  const configured = process.env.THEME_GALLERY_BASE_URL?.trim();
  return (configured || DEFAULT_BASE_URL).replace(/\/+$/, "");
}

async function fetchBytes(url: string, maximum: number): Promise<Buffer> {
  const response = await safeFetch(url, {
    policy: { allowedProtocols: ["https:"] },
    maxResponseBytes: maximum,
    allowMissingContentType: true,
    headers: { "User-Agent": `MarinaraEngine/${APP_VERSION}` },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Download failed with HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

let cached: { at: number; base: string; entries: ThemeGalleryEntry[] } | null = null;

/** The gallery's list of themes, fetched at most every 10 minutes (the commit it came from is kept, so
 *  a theme file downloaded later matches the list it was picked from). */
export async function fetchThemeGallery(force = false): Promise<{ base: string; entries: ThemeGalleryEntry[] }> {
  if (!force && cached && Date.now() - cached.at < INDEX_TTL_MS) return cached;
  const base = await resolvePinnedBase(themeGalleryBaseUrl());
  const raw = await fetchBytes(`${base}/${GALLERY_FOLDER}/index.json`, MAX_INDEX_BYTES);
  const parsed = galleryIndexSchema.parse(JSON.parse(raw.toString("utf8")));
  const ids = new Set<string>();
  const entries = parsed.themes.filter((entry) => !ids.has(entry.id) && ids.add(entry.id));
  cached = { at: Date.now(), base, entries };
  return cached;
}

export interface DownloadedGalleryTheme {
  id: string;
  name: string;
  css: string;
  meta: ThemeMeta;
}

/** Downloads one gallery theme and checks it against the list (size, sha256) and the theme schema. */
export async function downloadGalleryTheme(galleryId: string): Promise<DownloadedGalleryTheme> {
  const { base, entries } = await fetchThemeGallery();
  const entry = entries.find((item) => item.id === galleryId);
  if (!entry) throw new ThemeGalleryNotFoundError(galleryId);
  const bytes = await fetchBytes(`${base}/${GALLERY_FOLDER}/${entry.file}`, entry.bytes + 1);
  if (bytes.length !== entry.bytes) throw new Error("The theme file doesn't match the gallery list (size)");
  const sha = createHash("sha256").update(bytes).digest("hex");
  if (sha !== entry.sha256) throw new Error("The theme file doesn't match the gallery list (checksum)");
  const record = JSON.parse(bytes.toString("utf8")) as Record<string, unknown>;
  if (!record || typeof record !== "object" || Array.isArray(record)) throw new Error("Not a theme package");
  const { name, css, kind, formatVersion: _version, ...rest } = record;
  if (kind !== "marinara.theme") throw new Error("Not a Marinara theme package");
  const meta = themeMetaSchema.parse(rest);
  // Same limits as any theme the person imports (CSS size, name length).
  const checked = createThemeSchema.parse({ name, css, meta });
  return { id: `${STARTER_THEME_PREFIX}${entry.id}`, name: checked.name, css: checked.css, meta };
}

export class ThemeGalleryNotFoundError extends Error {
  constructor(id: string) {
    super(`The theme gallery has no theme "${id}"`);
    this.name = "ThemeGalleryNotFoundError";
  }
}
