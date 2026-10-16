// ──────────────────────────────────────────────
// Provider icons (concept decision 34b)
// ──────────────────────────────────────────────
// A Connection shows its service's icon. The server fetches it ONCE, when a Connection is added (and once for the
// Connections that existed before this feature), and keeps it in DATA_DIR. A failure is remembered too, so nothing
// asks the site again until the user chooses "Refresh icon". Opening a window never fetches. The setting
// "Load provider icons" (on by default) turns all of it off.
import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { providerIconSite } from "@marinara-engine/shared";
import type { DB } from "../../db/connection.js";
import { connectionAccounts } from "../../db/schema/index.js";
import { getDataDir } from "../../utils/data-dir.js";
import { isAllowedImageBuffer, safeFetch } from "../../utils/security.js";
import { isSafeSvgImageBuffer } from "../../utils/media-file-security.js";
import { isProviderLocalUrlsEnabled } from "../../config/runtime-config.js";
import { createAppSettingsStorage } from "../storage/app-settings.storage.js";
import { logger } from "../../lib/logger.js";

export const PROVIDER_ICONS_ENABLED_SETTINGS_KEY = "providerIconsEnabled";
const BACKFILL_MARKER_KEY = "providerIconsBackfilled";
const MAX_ICON_BYTES = 256 * 1024;
const FETCH_TIMEOUT_MS = 8_000;
/** Tried in order on the site's own host: a large touch icon first, then the classic favicon. */
const ICON_PATHS = ["/apple-touch-icon.png", "/favicon.ico"];

type IconEntry = { hash: string; type: string; fetchedAt: string } | { failedAt: string };
type IconIndex = Record<string, IconEntry>;

const iconDir = () => join(getDataDir(), "provider-icons");
const indexPath = () => join(iconDir(), "index.json");
const fileFor = (site: string) => createHash("sha256").update(site).digest("hex");

async function readIndex(): Promise<IconIndex> {
  try {
    const parsed = JSON.parse(await readFile(indexPath(), "utf8")) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as IconIndex) : {};
  } catch {
    return {};
  }
}

// ponytail: one in-process writer chain; one server process owns DATA_DIR.
let writes: Promise<unknown> = Promise.resolve();
function updateIndex(site: string, entry: IconEntry): Promise<void> {
  const next = writes.then(async () => {
    const index = await readIndex();
    index[site] = entry;
    await mkdir(iconDir(), { recursive: true });
    const temp = `${indexPath()}.${process.pid}.tmp`;
    await writeFile(temp, JSON.stringify(index));
    await rename(temp, indexPath());
  });
  writes = next.catch(() => undefined);
  return next;
}

export async function providerIconsEnabled(db: DB): Promise<boolean> {
  return (await createAppSettingsStorage(db).get(PROVIDER_ICONS_ENABLED_SETTINGS_KEY)) !== "false";
}

/** ICO files have no entry in the shared image check; their header is fixed. */
function isIco(buffer: Buffer): boolean {
  return buffer.length >= 6 && buffer.readUInt32BE(0) === 0x00000100 && buffer.readUInt16LE(4) > 0;
}

/** The image type of a downloaded icon, or null when the bytes are not a safe image. */
function iconType(buffer: Buffer): string | null {
  const image = isAllowedImageBuffer(buffer);
  if (image) return image.mimeType;
  if (isIco(buffer)) return "image/x-icon";
  return isSafeSvgImageBuffer(buffer) ? "image/svg+xml" : null;
}

async function download(site: string): Promise<{ buffer: Buffer; type: string } | null> {
  const host = new URL(site).hostname;
  for (const path of ICON_PATHS) {
    try {
      const response = await safeFetch(`${site}${path}`, {
        // The site's own host only: a redirect to any other host is refused.
        policy: {
          allowLocal: isProviderLocalUrlsEnabled(),
          allowLoopback: isProviderLocalUrlsEnabled(),
          allowedProtocols: ["https:", "http:"],
          allowedHostnames: [host],
          maxRedirects: 3,
          flagName: "PROVIDER_LOCAL_URLS_ENABLED",
        },
        maxResponseBytes: MAX_ICON_BYTES,
        allowedContentTypes: ["image/"],
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!response.ok) continue;
      const buffer = Buffer.from(await response.arrayBuffer());
      const type = iconType(buffer);
      if (type) return { buffer, type };
    } catch (error) {
      logger.debug(error, "[provider-icons] No icon at %s%s", site, path);
    }
  }
  return null;
}

const inFlight = new Map<string, Promise<boolean>>();

/**
 * Fetch a site's icon unless it is already known, or `force` (the "Refresh icon" action). A known failure counts as
 * known. Returns whether an icon is cached afterwards.
 */
export function ensureProviderIcon(db: DB, site: string, force = false): Promise<boolean> {
  const running = inFlight.get(site);
  if (running) return running;
  const run = (async () => {
    if (!(await providerIconsEnabled(db))) return false;
    const known = (await readIndex())[site];
    if (known && !force) return "hash" in known;
    const icon = await download(site);
    if (!icon) {
      await updateIndex(site, { failedAt: new Date().toISOString() });
      logger.info("[provider-icons] No usable icon for %s; the Connection shows its initials", site);
      return false;
    }
    const hash = createHash("sha256").update(icon.buffer).digest("hex").slice(0, 16);
    await mkdir(iconDir(), { recursive: true });
    await writeFile(join(iconDir(), fileFor(site)), icon.buffer);
    await updateIndex(site, { hash, type: icon.type, fetchedAt: new Date().toISOString() });
    return true;
  })().finally(() => inFlight.delete(site));
  inFlight.set(site, run);
  return run;
}

/** Fetch the icon for a Connection's service in the background. Never throws. */
export function fetchIconForConnection(db: DB, provider: string, baseUrl: string | null | undefined): void {
  const site = providerIconSite(provider, baseUrl);
  if (!site) return;
  void ensureProviderIcon(db, site).catch((error) => logger.warn(error, "[provider-icons] Fetch failed for %s", site));
}

/** The cached icons by site, with a version for the image URL. Empty when the setting is off. */
export async function listProviderIcons(db: DB): Promise<Record<string, string>> {
  if (!(await providerIconsEnabled(db))) return {};
  const icons: Record<string, string> = {};
  for (const [site, entry] of Object.entries(await readIndex())) if ("hash" in entry) icons[site] = entry.hash;
  return icons;
}

export async function readProviderIcon(site: string): Promise<{ buffer: Buffer; type: string } | null> {
  const entry = (await readIndex())[site];
  if (!entry || !("hash" in entry)) return null;
  try {
    return { buffer: await readFile(join(iconDir(), fileFor(site))), type: entry.type };
  } catch {
    return null;
  }
}

/** Once after the upgrade: one fetch per existing Connection's site, one at a time, in the background. */
export async function backfillProviderIcons(db: DB): Promise<void> {
  const settings = createAppSettingsStorage(db);
  // Turned off: no marker either, so the backfill runs on the first start after the setting is turned on.
  if ((await settings.get(BACKFILL_MARKER_KEY)) === "true" || !(await providerIconsEnabled(db))) return;
  const sites = new Set<string>();
  for (const account of await db.select().from(connectionAccounts)) {
    const site = providerIconSite(account.provider, account.baseUrl);
    if (site) sites.add(site);
  }
  // Known sites (an icon or a cached failure) are skipped, so a backfill cut short only fetches the rest next start.
  for (const site of sites) await ensureProviderIcon(db, site).catch(() => false);
  await settings.set(BACKFILL_MARKER_KEY, "true");
}
