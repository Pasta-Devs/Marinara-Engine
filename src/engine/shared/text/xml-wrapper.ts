// XML tag-name helpers.

/**
 * Convert a display name to a valid XML tag slug.
 * "World Info (Before)" -> "world_info_before"
 */
export function nameToXmlTag(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, "")
    .trim()
    .replace(/[\s-]+/g, "_")
    .replace(/_+/g, "_");
}
