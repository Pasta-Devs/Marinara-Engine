// ──────────────────────────────────────────────
// XML Wrapper Utility
// ──────────────────────────────────────────────

/**
 * Convert a display name to a valid XML tag slug.
 * "World Info (Before)" → "world_info_before"
 * "Dr. 홍길동" → "dr_홍길동"
 * "Luna ❤️" → "luna"
 */
export function nameToXmlTag(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\s_-]/gu, "")
    .replace(/[\p{Variation_Selector}\u20E3]/gu, "")
    .replace(/^[\p{M}\s]+/u, "")
    .trim()
    .replace(/[\s-]+/g, "_")
    .replace(/_+/g, "_");
}
