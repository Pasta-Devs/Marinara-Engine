/** Host check for direct NovelAI API connections (excludes OpenAI-compatible proxies). */
export function isNativeNovelAiHost(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase().replace(/\.$/, "");
  return normalized === "novelai.net" || normalized.endsWith(".novelai.net");
}

/** True only for HTTPS URLs targeting NovelAI's own host (`novelai.net` / `*.novelai.net`). */
export function isNativeNovelAiUrl(baseUrl: unknown): boolean {
  if (typeof baseUrl !== "string") return false;
  const trimmed = baseUrl.trim();
  if (!trimmed) return false;
  try {
    const url = new URL(trimmed);
    return url.protocol === "https:" && isNativeNovelAiHost(url.hostname);
  } catch {
    return false;
  }
}

/** True when a connection uses NovelAI's native HTTPS image endpoint rather than an OpenAI-compatible proxy. */
export function isNativeNovelAiConnection(
  connection: { provider?: unknown; baseUrl?: unknown; imageService?: unknown } | null | undefined,
): boolean {
  if (!connection) return false;
  if (connection.provider !== undefined && connection.provider !== null && connection.provider !== "image_generation") {
    return false;
  }
  if (typeof connection.imageService === "string") {
    const explicit = connection.imageService.trim().toLowerCase();
    if (explicit && explicit !== "novelai") return false;
  }
  return isNativeNovelAiUrl(connection.baseUrl);
}
