/**
 * Every generated message records the lorebook scan that built its prompt (`extra.lorebookScan`), and that scan
 * carries the full resolved text of every activated entry. With large lorebooks that is hundreds of KB per message,
 * stored again in each swipe: in a chat of a few hundred messages that copied lore was most of a ~190 MB shard, and
 * because chats stay resident once loaded it drove the server towards its heap limit in long sessions.
 *
 * Opt-in with LOREBOOK_COMPACT_STORED_SCANS=true (off by default, which keeps the stored shape unchanged). Only the
 * newest assistant or narrator message's scan is read with its text (Active Context and agent retries), so that message keeps
 * the text on its row and on every swipe (swiping back still restores the text that built that swipe), and the
 * scans of older messages keep only ids, names, keys and scores. When an older message becomes the newest again
 * (the newer ones were deleted), readers fall back to the entry's stored text.
 */

export const COMPACT_LOREBOOK_SCAN_MARKER = "contentStripped";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/** True when a stored scan still carries entry text. */
export function lorebookScanHasContent(scan: unknown): boolean {
  if (!isRecord(scan) || !Array.isArray(scan.activatedEntries)) return false;
  return scan.activatedEntries.some((entry) => isRecord(entry) && typeof entry.content === "string");
}

/** The same scan without entry text; anything that is not a scan is returned unchanged. */
export function compactLorebookScan<T>(scan: T): T {
  if (!isRecord(scan) || !Array.isArray(scan.activatedEntries)) return scan;
  return {
    ...scan,
    activatedEntries: scan.activatedEntries.map((entry) => {
      if (!isRecord(entry) || !("content" in entry)) return entry;
      const { content: _content, ...rest } = entry;
      return rest;
    }),
    [COMPACT_LOREBOOK_SCAN_MARKER]: true,
  } as T;
}

/** Cheap pre-check on a serialized extra so the sweep only parses extras that still hold a full scan. */
export function serializedExtraMayHoldFullLorebookScan(extra: unknown): boolean {
  return (
    typeof extra === "string" &&
    extra.includes('"lorebookScan"') &&
    !extra.includes(`"${COMPACT_LOREBOOK_SCAN_MARKER}":true`)
  );
}

/**
 * Stored text of each activated entry that a scan keeps without text (a compacted scan), by entry id. Entries that
 * still carry their resolved text, and entries that no longer exist, are left out.
 */
export async function storedContentForTextlessScanEntries(
  scan: unknown,
  getEntry: (id: string) => Promise<unknown>,
): Promise<Map<string, string>> {
  const contentById = new Map<string, string>();
  if (!isRecord(scan) || !Array.isArray(scan.activatedEntries)) return contentById;
  for (const entry of scan.activatedEntries) {
    if (!isRecord(entry) || typeof entry.id !== "string" || typeof entry.content === "string") continue;
    if (contentById.has(entry.id)) continue;
    const stored = await getEntry(entry.id).catch(() => null);
    if (isRecord(stored) && typeof stored.content === "string") contentById.set(entry.id, stored.content);
  }
  return contentById;
}

/** Returns the extra with a compacted scan, or null when there was nothing to compact. */
export function compactLorebookScanInExtra(extra: Record<string, unknown>): Record<string, unknown> | null {
  if (!lorebookScanHasContent(extra.lorebookScan)) return null;
  return { ...extra, lorebookScan: compactLorebookScan(extra.lorebookScan) };
}
