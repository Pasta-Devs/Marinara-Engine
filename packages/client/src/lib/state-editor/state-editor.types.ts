// ──────────────────────────────────────────────
// State Editor — the contract between the shared editor and a data source.
// The editor only knows sections of JSON; a source decides what they are and
// how a set of changed sections is saved.
// ──────────────────────────────────────────────

/** One editable top-level part of a source's state, shown as an entry in the sections list. */
export interface StateEditorSection {
  id: string;
  label: string;
  description?: string;
  value: unknown;
  /** Shown and searchable, never edited or saved (e.g. game data the server rebuilds itself). */
  readOnly?: boolean;
}

/** A section whose draft parsed and differs from the saved value. */
export interface StateEditorChange {
  sectionId: string;
  value: unknown;
}

/** A key path inside a section's value: object keys and array indexes. */
export type StateEditorPath = Array<string | number>;
