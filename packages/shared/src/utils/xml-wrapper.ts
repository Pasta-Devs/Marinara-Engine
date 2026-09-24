// ──────────────────────────────────────────────
// XML Wrapper Utility
// ──────────────────────────────────────────────

/**
 * Convert a display name to a valid XML tag slug.
 * "World Info (Before)" → "world_info_before"
 */
export function nameToXmlTag(name: string | null | undefined): string {
  return String(name ?? "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, "")
    .trim()
    .replace(/[\s-]+/g, "_")
    .replace(/_+/g, "_");
}
