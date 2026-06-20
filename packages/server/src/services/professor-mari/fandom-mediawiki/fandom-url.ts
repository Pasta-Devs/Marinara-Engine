import { isIP } from "node:net";
import type { FandomWikiRef } from "./types.js";

const FANDOM_HOST_SUFFIX = ".fandom.com";
const SERVICES_HOST = "services.fandom.com";

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function assertHttpsFandomUrl(url: URL, allowServices = false) {
  if (url.protocol !== "https:") throw new Error("Only HTTPS Fandom URLs are allowed.");
  if (url.username || url.password) throw new Error("Fandom URLs with embedded credentials are not allowed.");
  const host = url.hostname.toLowerCase();
  if (isIP(host)) throw new Error("IP literal hosts are not allowed.");
  if (host === SERVICES_HOST && allowServices) return host;
  if (host === SERVICES_HOST) throw new Error("services.fandom.com is only allowed for shared search APIs.");
  if (!host.endsWith(FANDOM_HOST_SUFFIX)) throw new Error("Only *.fandom.com hosts are allowed.");
  return host;
}

function normalizeHostInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) throw new Error("Wiki is required.");
  if (/^https?:\/\//i.test(trimmed)) return new URL(trimmed);
  if (trimmed.includes("/") || trimmed.includes("?") || trimmed.includes("#")) {
    return new URL(`https://${trimmed}`);
  }
  const host = trimmed.endsWith(FANDOM_HOST_SUFFIX) ? trimmed : `${trimmed}${FANDOM_HOST_SUFFIX}`;
  return new URL(`https://${host}`);
}

function keyFromHost(host: string) {
  return host.replace(new RegExp(`${FANDOM_HOST_SUFFIX.replace(".", "\\.")}$`), "");
}

export function isFandomHost(host: string) {
  const normalized = host.toLowerCase();
  return normalized !== SERVICES_HOST && normalized.endsWith(FANDOM_HOST_SUFFIX);
}

export function wikiRefFromHost(host: string, details: Partial<FandomWikiRef> = {}): FandomWikiRef {
  const normalizedHost = host.toLowerCase();
  const slug = keyFromHost(normalizedHost);
  return {
    key: details.key ?? details.wikiId ?? slug,
    source: "fandom",
    url: details.url ? trimTrailingSlash(details.url) : `https://${normalizedHost}`,
    apiUrl: details.apiUrl ?? `https://${normalizedHost}/api.php`,
    host: normalizedHost,
    slug,
    wikiId: details.wikiId,
    sitename: details.sitename,
    language: details.language,
    articlePath: details.articlePath,
    scriptPath: details.scriptPath,
  };
}

export function wikiRefFromInput(input: string): FandomWikiRef {
  const url = normalizeHostInput(input);
  const host = assertHttpsFandomUrl(url);
  return wikiRefFromHost(host);
}

export function serviceUrl(path: string, params: Record<string, string | number | boolean | undefined>) {
  const url = new URL(path, `https://${SERVICES_HOST}`);
  assertHttpsFandomUrl(url, true);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  return url;
}

export function wikiApiUrl(wiki: FandomWikiRef, params: Record<string, string | number | boolean | undefined>) {
  const url = new URL(wiki.apiUrl);
  const host = assertHttpsFandomUrl(url);
  if (host !== wiki.host) throw new Error("Wiki API URL host does not match the resolved wiki host.");
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  return url;
}

export function pageTitleToPath(title: string) {
  return title
    .trim()
    .replace(/ /g, "_")
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
}

export function pageUrlForTitle(wiki: FandomWikiRef, title: string) {
  const articlePath = wiki.articlePath || "/wiki/$1";
  const path = articlePath.replace("$1", pageTitleToPath(title));
  return `${trimTrailingSlash(wiki.url)}${path.startsWith("/") ? path : `/${path}`}`;
}

export function pageRefFromUrl(pageUrl: string): { wiki: FandomWikiRef; title?: string; url: string } {
  const url = new URL(pageUrl);
  const host = assertHttpsFandomUrl(url);
  const wiki = wikiRefFromHost(host);
  let title: string | undefined;
  const marker = "/wiki/";
  if (url.pathname.startsWith(marker)) {
    const raw = url.pathname.slice(marker.length);
    if (raw) {
      title = decodeURIComponent(raw)
        .replace(/_/g, " ")
        .replace(/^\/+|\/+$/g, "");
    }
  }
  return { wiki, title, url: url.toString() };
}

export function wikiRefFromCommunityResult(value: Record<string, unknown>): FandomWikiRef | null {
  const rawUrl = typeof value.url === "string" ? value.url : "";
  if (!rawUrl) return null;
  try {
    const url = new URL(rawUrl);
    const host = assertHttpsFandomUrl(url);
    return wikiRefFromHost(host, {
      key: typeof value.id === "string" || typeof value.id === "number" ? String(value.id) : undefined,
      wikiId: typeof value.id === "string" || typeof value.id === "number" ? String(value.id) : undefined,
      sitename: typeof value.name === "string" ? value.name : undefined,
      language: typeof value.language === "string" ? value.language : undefined,
      url: trimTrailingSlash(url.origin),
    });
  } catch {
    return null;
  }
}

export function assertSafeRedirect(original: URL, next: URL) {
  const originalHost = assertHttpsFandomUrl(original, original.hostname === SERVICES_HOST);
  const nextHost = assertHttpsFandomUrl(next, next.hostname === SERVICES_HOST);
  if (originalHost !== nextHost) throw new Error("Fandom API redirect crossed to a different host.");
}
