// ──────────────────────────────────────────────
// Types: Author's Notes entries
// ──────────────────────────────────────────────

/** Default prompt depth for Author's Notes injection. */
export const AUTHOR_NOTES_DEFAULT_DEPTH = 4;

/** Separator that splits a legacy single-string note into discrete entries. */
export const AUTHOR_NOTES_LEGACY_SEPARATOR = "|";

/** One independently toggleable Author's Note block. */
export interface AuthorNoteEntry {
  id: string;
  content: string;
  enabled: boolean;
}

function isAuthorNoteEntry(value: unknown): value is AuthorNoteEntry {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Record<string, unknown>;
  return typeof entry.id === "string" && typeof entry.content === "string" && typeof entry.enabled === "boolean";
}

/**
 * Read entries out of chat metadata.
 *
 * Returns `null` for a chat that predates this feature and still stores a
 * single `authorNotes` string. Callers MUST treat `null` and `[]` as
 * different: `[]` means the user deliberately removed every entry, so
 * nothing should be injected, whereas `null` means fall back to the legacy
 * string. Branching on `entries.length` instead collapses the two and
 * resurrects deleted notes.
 */
export function readAuthorNoteEntries(meta: Record<string, unknown>): AuthorNoteEntry[] | null {
  const raw = meta.authorNoteEntries;
  if (!Array.isArray(raw)) return null;
  return raw.filter(isAuthorNoteEntry);
}

/** Split a legacy `authorNotes` string into entries, one per pipe-delimited block. */
export function migrateLegacyAuthorNotes(raw: string, makeId: () => string): AuthorNoteEntry[] {
  return raw
    .split(AUTHOR_NOTES_LEGACY_SEPARATOR)
    .map((block) => block.trim())
    .filter((block) => block.length > 0)
    .map((content) => ({ id: makeId(), content, enabled: true }));
}

/** Join the enabled entries into the string injected into the prompt. */
export function composeAuthorNoteEntries(entries: AuthorNoteEntry[]): string {
  return entries
    .filter((entry) => entry.enabled)
    .map((entry) => entry.content.trim())
    .filter((content) => content.length > 0)
    .join("\n\n");
}

/**
 * Resolve the text to inject, honouring the entries array when a chat has
 * been migrated and falling back to the legacy string when it has not.
 */
export function resolveAuthorNotesText(meta: Record<string, unknown>): string {
  const entries = readAuthorNoteEntries(meta);
  if (entries !== null) return composeAuthorNoteEntries(entries);
  return ((meta.authorNotes as string | undefined) ?? "").trim();
}
