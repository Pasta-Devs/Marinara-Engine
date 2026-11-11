// ──────────────────────────────────────────────
// Import tags
//
// Imports used to mark what they brought in by renaming it ("Imported: X",
// "X (imported)") or by writing "Imported from SillyTavern" into the
// description. Instead, imported content gets the tag "Imported" plus a tag
// for where it came from ("ST", "Backup", ...). Both are optional: the import
// windows have "Tag imported" and "Tag source" checkboxes, on by default.
// ──────────────────────────────────────────────

/** The tag every import adds when "Tag imported" is on. */
export const IMPORTED_TAG = "Imported";

/** Where imported content came from, written as its source tag. */
export const IMPORT_SOURCE_TAGS = {
  /** SillyTavern files: character cards (PNG/JSON), World Info, presets, chats, a SillyTavern folder. */
  st: "ST",
  /** A CharX card (.charx). */
  charx: "CharX",
  /** A Marinara export (.marinara or .marinara.json). */
  marinara: "Marinara",
  /** A Marinara profile backup. */
  backup: "Backup",
} as const;

export type ImportSource = keyof typeof IMPORT_SOURCE_TAGS;

/** The two import checkboxes. A missing value counts as on, matching the checkboxes' default. */
export interface ImportTagOptions {
  /** Add the "Imported" tag. */
  imported?: boolean;
  /** Add the source tag ("ST", "Backup", ...). */
  source?: boolean;
}

/** The field name the clients send the two checkboxes under (JSON body key or multipart field). */
export const IMPORT_TAGS_FIELD = "importTags";

function readFlag(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "1") return true;
  if (value === "false" || value === "0") return false;
  return undefined;
}

/**
 * Read the checkboxes from a request: an object, or the JSON text a multipart field carries.
 * Anything unreadable falls back to both on.
 */
export function readImportTagOptions(value: unknown): Required<ImportTagOptions> {
  let raw = value;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      raw = null;
    }
  }
  const record = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  return {
    imported: readFlag(record.imported) ?? true,
    source: readFlag(record.source) ?? true,
  };
}

/**
 * The source tag for a bot-browser site id ("chub", "janny", ...), or the "site:card" marker the
 * browser stores on a character. Unknown ids keep their
 * own spelling with a capital first letter.
 */
export function botBrowserSourceTag(site: string): string {
  const id = site.split(":")[0]!.trim();
  if (!id) return "";
  const known: Record<string, string> = {
    chub: "Chub",
    janny: "JannyAI",
    chartavern: "Character Tavern",
    pygmalion: "Pygmalion",
    wyvern: "Wyvern",
    datacat: "DataCat",
  };
  return known[id.toLowerCase()] ?? id.charAt(0).toUpperCase() + id.slice(1);
}

/** The tags an import adds, given where it came from and the two checkboxes. */
export function importTagsFor(source: ImportSource | string | null | undefined, options?: ImportTagOptions): string[] {
  const tags: string[] = [];
  if (options?.imported !== false) tags.push(IMPORTED_TAG);
  if (options?.source !== false && source) {
    const sourceTag = source in IMPORT_SOURCE_TAGS ? IMPORT_SOURCE_TAGS[source as ImportSource] : source;
    if (sourceTag.trim()) tags.push(sourceTag.trim());
  }
  return tags;
}

/** The item's own tags plus the import tags, without adding one it already has (any letter case). */
export function withImportTags(
  tags: readonly unknown[] | null | undefined,
  source: ImportSource | string | null | undefined,
  options?: ImportTagOptions,
): string[] {
  const own = Array.isArray(tags)
    ? tags.filter((tag): tag is string => typeof tag === "string" && tag.trim() !== "")
    : [];
  const seen = new Set(own.map((tag) => tag.trim().toLowerCase()));
  const added = importTagsFor(source, options).filter((tag) => {
    const key = tag.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return added.length ? [...own, ...added] : own;
}

/** A stored tag list (JSON text or an array) as clean strings; anything unreadable is no tags. */
export function parseTagList(raw: unknown): string[] {
  let value = raw;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(value)) return [];
  return value.filter((tag): tag is string => typeof tag === "string" && tag.trim() !== "").map((tag) => tag.trim());
}
