// Images in message content that would make the browser contact another site.
// Pure helpers: no store, no DOM, no i18n, so CSS sanitizers and node
// regressions can use them.

/** What message rendering does with images from other sites. */
export type RemoteImagePolicy = {
  /** The "Load images from other websites in messages" setting. */
  loadAll: boolean;
  /** Absolute URLs the user chose to load. */
  approved: ReadonlySet<string>;
};

// Approvals sync with the other UI settings, whose server value has a size cap.
const APPROVED_REMOTE_IMAGE_LIMIT = 1000;
const APPROVED_REMOTE_IMAGE_CHARACTER_LIMIT = 200_000;

function pageHref(): string | undefined {
  return typeof location === "undefined" ? undefined : location.href;
}

/**
 * The absolute URL when loading `url` would contact another site, otherwise null.
 * The app's own files (same origin), data: and blob: URLs never contact another site.
 */
export function remoteImageHref(url: string, base: string | undefined = pageHref()): string | null {
  let parsed: URL;
  try {
    parsed = base ? new URL(url, base) : new URL(url);
  } catch {
    return null; // Relative without a page, or unparseable: the browser cannot fetch it from another site either.
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  if (base && parsed.origin === new URL(base).origin) return null;
  return parsed.href;
}

export function remoteImageHost(href: string): string {
  try {
    return new URL(href).host;
  } catch {
    return href;
  }
}

/** Newest first, absolute http(s) URLs only, without duplicates, within the sync size cap. */
export function normalizeApprovedRemoteImageUrls(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const urls: string[] = [];
  const seen = new Set<string>();
  let characters = 0;
  for (const entry of value) {
    if (typeof entry !== "string") continue;
    const href = remoteImageHref(entry, undefined);
    if (!href || seen.has(href)) continue;
    if (urls.length >= APPROVED_REMOTE_IMAGE_LIMIT) break;
    if (characters + href.length > APPROVED_REMOTE_IMAGE_CHARACTER_LIMIT) continue;
    seen.add(href);
    characters += href.length;
    urls.push(href);
  }
  return urls;
}

export function addApprovedRemoteImageUrl(urls: string[], href: string): string[] {
  return urls[0] === href ? urls : normalizeApprovedRemoteImageUrls([href, ...urls]);
}
