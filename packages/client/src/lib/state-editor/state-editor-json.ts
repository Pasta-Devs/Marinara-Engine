// ──────────────────────────────────────────────
// State Editor — JSON helpers shared by the editor UI.
// Pure functions so the regressions can pin them without a browser.
// ──────────────────────────────────────────────
import type { StateEditorChange, StateEditorPath, StateEditorSection } from "./state-editor.types";

export interface StateJsonLayout {
  /** Byte-for-byte the same text as JSON.stringify(value, null, 2). */
  text: string;
  /** 1-based line of each node, keyed by statePathKey(path). The root is the empty path. */
  lineByPath: Map<string, number>;
}

export function statePathKey(path: StateEditorPath): string {
  return JSON.stringify(path);
}

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

// JSON.stringify leaves these keys out of objects and writes them as null inside arrays.
const isOmittedJsonValue = (value: unknown) =>
  value === undefined || typeof value === "function" || typeof value === "symbol";

/**
 * Pretty-prints like JSON.stringify(value, null, 2) while recording the line every node starts on,
 * so a search result can jump the editor straight to its line.
 */
export function layoutStateJson(value: unknown): StateJsonLayout {
  const lines: string[] = [];
  const lineByPath = new Map<string, number>();

  const write = (node: unknown, depth: number, prefix: string, suffix: string, path: StateEditorPath) => {
    lineByPath.set(statePathKey(path), lines.length + 1);
    const pad = "  ".repeat(depth);
    if (Array.isArray(node)) {
      if (node.length === 0) {
        lines.push(`${pad}${prefix}[]${suffix}`);
        return;
      }
      lines.push(`${pad}${prefix}[`);
      node.forEach((item, index) =>
        write(isOmittedJsonValue(item) ? null : item, depth + 1, "", index < node.length - 1 ? "," : "", [
          ...path,
          index,
        ]),
      );
      lines.push(`${pad}]${suffix}`);
      return;
    }
    if (isPlainRecord(node)) {
      const entries = Object.entries(node).filter(([, item]) => !isOmittedJsonValue(item));
      if (entries.length === 0) {
        lines.push(`${pad}${prefix}{}${suffix}`);
        return;
      }
      lines.push(`${pad}${prefix}{`);
      entries.forEach(([key, item], index) =>
        write(item, depth + 1, `${JSON.stringify(key)}: `, index < entries.length - 1 ? "," : "", [...path, key]),
      );
      lines.push(`${pad}}${suffix}`);
      return;
    }
    lines.push(`${pad}${prefix}${JSON.stringify(node) ?? "null"}${suffix}`);
  };

  write(isOmittedJsonValue(value) ? null : value, 0, "", "", []);
  return { text: lines.join("\n"), lineByPath };
}

/** `error` is the JSON parser's own detail (may be empty); the UI leads it with a localized message. */
export type StateDraftParse = { ok: true; value: unknown } | { ok: false; error: string };

export function parseStateDraft(text: string): StateDraftParse {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "" };
  }
}

/** Same JSON content. Formatting doesn't count as a change; key order does, since it's what the user sees. */
export function stateValuesEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

// ── Syntax colouring ──

/** What a JSON token is drawn as. `punctuation` also covers the gaps between tokens. */
export type StateJsonTokenKind = "key" | "string" | "number" | "literal" | "punctuation";

export interface StateJsonToken {
  text: string;
  kind: StateJsonTokenKind;
}

// A string (with a trailing colon it is a key), a number, true/false/null, or one punctuator.
// Everything else — including half-typed text — falls through as punctuation, so an invalid draft
// still renders instead of vanishing behind the textarea.
const JSON_TOKEN_PATTERN =
  /("(?:\\.|[^"\\])*")(\s*:)?|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|\b(true|false|null)\b|([{}[\],:])/g;

/**
 * Splits JSON text into coloured tokens without parsing it. The token texts concatenate back to the
 * exact input, which is what lets the highlight layer stay aligned behind the textarea while typing.
 */
export function tokenizeStateJson(text: string): StateJsonToken[] {
  const tokens: StateJsonToken[] = [];
  let cursor = 0;
  for (let match = JSON_TOKEN_PATTERN.exec(text); match; match = JSON_TOKEN_PATTERN.exec(text)) {
    if (match.index > cursor) tokens.push({ text: text.slice(cursor, match.index), kind: "punctuation" });
    if (match[1] !== undefined) {
      tokens.push({ text: match[1], kind: match[2] === undefined ? "string" : "key" });
      if (match[2] !== undefined) tokens.push({ text: match[2], kind: "punctuation" });
    } else if (match[3] !== undefined) {
      tokens.push({ text: match[3], kind: "number" });
    } else if (match[4] !== undefined) {
      tokens.push({ text: match[4], kind: "literal" });
    } else {
      tokens.push({ text: match[5]!, kind: "punctuation" });
    }
    cursor = JSON_TOKEN_PATTERN.lastIndex;
  }
  if (cursor < text.length) tokens.push({ text: text.slice(cursor), kind: "punctuation" });
  return tokens;
}

export type StateSectionDraftStatus =
  { kind: "clean" } | { kind: "changed"; value: unknown } | { kind: "invalid"; error: string };

/** What a section's draft means: untouched (or only reformatted), a real change, or unparsable JSON. */
export function getStateSectionDraftStatus(
  section: StateEditorSection,
  draft: string | undefined,
): StateSectionDraftStatus {
  if (draft === undefined) return { kind: "clean" };
  const parsed = parseStateDraft(draft);
  if (!parsed.ok) return { kind: "invalid", error: parsed.error };
  return stateValuesEqual(parsed.value, section.value) ? { kind: "clean" } : { kind: "changed", value: parsed.value };
}

export function collectStateChanges(
  sections: StateEditorSection[],
  drafts: Record<string, string>,
): { changes: StateEditorChange[]; invalidSectionIds: string[] } {
  const changes: StateEditorChange[] = [];
  const invalidSectionIds: string[] = [];
  for (const section of sections) {
    if (section.readOnly) continue;
    const status = getStateSectionDraftStatus(section, drafts[section.id]);
    if (status.kind === "changed") changes.push({ sectionId: section.id, value: status.value });
    else if (status.kind === "invalid") invalidSectionIds.push(section.id);
  }
  return { changes, invalidSectionIds };
}

// ── Search ──

export interface StateSearchResult {
  sectionId: string;
  sectionLabel: string;
  /** Readable trail from the section down to the match's parent, e.g. ["Gwendolyn"]. */
  trail: string[];
  /** The matched key, or "#n" for an array item. */
  key: string;
  /** One-line preview in JSON syntax, e.g. `"mood": "tense"`. */
  preview: string;
  /** 1-based line of the match in the section's pretty-printed JSON. */
  line: number;
  /** Where the match sits in the section's value, so the Fields view can scroll to it. */
  path: StateEditorPath;
}

const NAME_FIELDS = ["name", "title", "label", "id"] as const;

/** Names an array item by its own name/title/label/id when it has one, so trails read like the tracker. */
export function describeArrayItem(item: unknown, index: number): string {
  if (isPlainRecord(item)) {
    for (const field of NAME_FIELDS) {
      const candidate = item[field];
      if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
    }
  }
  return `#${index + 1}`;
}

const PREVIEW_MAX = 120;

function previewValue(value: unknown): string {
  if (Array.isArray(value)) return `[${value.length}]`;
  if (isPlainRecord(value)) return "{…}";
  const text = JSON.stringify(value) ?? "null";
  return text.length > PREVIEW_MAX ? `${text.slice(0, PREVIEW_MAX - 1)}…` : text;
}

/**
 * Finds every node whose key or primitive value contains the query (case-insensitive) across all
 * sections, in section order then document order. `values` lets the caller search drafts instead of
 * the saved values.
 */
export function searchStateSections(
  sections: StateEditorSection[],
  query: string,
  values: Record<string, unknown> = {},
  limit = 200,
): StateSearchResult[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  const results: StateSearchResult[] = [];

  for (const section of sections) {
    const value = section.id in values ? values[section.id] : section.value;
    const { lineByPath } = layoutStateJson(value);

    const visit = (node: unknown, path: StateEditorPath, trail: string[]) => {
      if (results.length >= limit) return;
      if (path.length > 0) {
        const last = path[path.length - 1]!;
        const key = typeof last === "number" ? `#${last + 1}` : last;
        const keyMatches = typeof last === "string" && last.toLowerCase().includes(needle);
        const isLeaf = !Array.isArray(node) && !isPlainRecord(node);
        const valueMatches = isLeaf && String(node).toLowerCase().includes(needle);
        if (keyMatches || valueMatches) {
          const preview = previewValue(node);
          results.push({
            sectionId: section.id,
            sectionLabel: section.label,
            trail: trail.slice(0, -1),
            key,
            preview: typeof last === "string" ? `${JSON.stringify(last)}: ${preview}` : preview,
            line: lineByPath.get(statePathKey(path)) ?? 1,
            path,
          });
        }
      }
      if (Array.isArray(node)) {
        node.forEach((item, index) => visit(item, [...path, index], [...trail, describeArrayItem(item, index)]));
      } else if (isPlainRecord(node)) {
        for (const [key, item] of Object.entries(node)) {
          if (isOmittedJsonValue(item)) continue;
          visit(item, [...path, key], [...trail, key]);
        }
      }
    };

    visit(value, [], []);
    if (results.length >= limit) break;
  }
  return results;
}

// ── Fields view ──

/**
 * A copy of `root` with the value at `path` replaced. Only the containers on the path are copied, so
 * the rest of the draft keeps its identity and key order.
 */
export function setStateValueAtPath(root: unknown, path: StateEditorPath, next: unknown): unknown {
  if (path.length === 0) return next;
  const [head, ...rest] = path;
  if (Array.isArray(root) && typeof head === "number") {
    const copy = root.slice();
    copy[head] = setStateValueAtPath(root[head], rest, next);
    return copy;
  }
  if (isPlainRecord(root) && typeof head === "string") {
    return { ...root, [head]: setStateValueAtPath(root[head], rest, next) };
  }
  return root;
}

/**
 * A copy of `value` with nothing in it: what an added field or entry starts as. Cloning the shape
 * instead of following a schema keeps it readable by the same tracker — the editor is never told what
 * a section's entries look like, only what the entries already there look like.
 */
export function blankStateValueLike(value: unknown): unknown {
  if (Array.isArray(value)) return [];
  if (typeof value === "number") return 0;
  if (typeof value === "boolean") return false;
  if (isPlainRecord(value)) {
    const blank: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) blank[key] = blankStateValueLike(item);
    return blank;
  }
  return "";
}

/** One Inventory Tracker row. `qty` is "at least one": the tracker stores it only above 1. */
const INVENTORY_TRACKER_ROW = { name: "", qty: 1, description: "", location: "" };

/**
 * What an entry starts as when its list is empty and there is nothing to copy, keyed by the name the
 * section uses for the list. The shapes are the ones `GameState` declares in the shared package. Only
 * id-free shapes are here: characters and quests need ids the editor can't invent safely, so those lists
 * keep the generic "add field" row.
 */
const EMPTY_STATE_ENTRIES: Record<string, unknown> = {
  worldCustomFields: { name: "", value: "", icon: "" },
  customTrackerFields: { name: "", value: "" },
  stats: { name: "", value: 0, max: 0, color: "" },
  // Persona Stats shows playerStats.inventory, whose rows count `quantity`.
  inventory: { name: "", description: "", quantity: 1, location: "" },
  currencies: INVENTORY_TRACKER_ROW,
  equipped: INVENTORY_TRACKER_ROW,
};

/**
 * The same list name can mean a different record in another section: `inventory` is `InventoryItem[]`
 * in Persona Stats and an Inventory Tracker row list in the Inventory Tracker, where `playerStats.
 * inventoryTracker*` is shown under that name. Sections that are objects build their own patch, so a row
 * of the wrong contract would be stored as given.
 */
const SECTION_EMPTY_STATE_ENTRIES: Record<string, Record<string, unknown>> = {
  "inventory-tracker": {
    currencies: INVENTORY_TRACKER_ROW,
    equipped: INVENTORY_TRACKER_ROW,
    inventory: INVENTORY_TRACKER_ROW,
  },
};

function emptyStateEntry(key?: string, sectionId?: string): unknown {
  if (!key) return undefined;
  return (sectionId ? SECTION_EMPTY_STATE_ENTRIES[sectionId]?.[key] : undefined) ?? EMPTY_STATE_ENTRIES[key];
}

/** Whether this list's entries have a declared shape, i.e. an entry card shows known fields. */
export function hasDeclaredStateEntry(key?: string, sectionId?: string): boolean {
  return emptyStateEntry(key, sectionId) !== undefined;
}

/**
 * The entry an add control appends: the last item's shape, cleared; for an empty list, the shape its key
 * declares in this section; and for a list of unknown shape, `{}` for the "add field" row to fill in
 * (ponytail: a list of plain values that starts empty therefore gets an object; the JSON view is the way
 * back).
 */
export function blankStateArrayItem(items: readonly unknown[], key?: string, sectionId?: string): unknown {
  const shape = emptyStateEntry(key, sectionId);
  if (items.length > 0) {
    const blank = blankStateValueLike(items[items.length - 1]);
    // The save path rejects a quantity below 1 (`findInvalidInventoryTrackerRow`), so a cleared row can't
    // keep the 0 every other number clears to.
    if (isPlainRecord(shape) && "qty" in shape && isPlainRecord(blank) && blank.qty === 0) blank.qty = 1;
    return blank;
  }
  return shape === undefined ? {} : structuredClone(shape);
}

/**
 * How the Fields view shows one entry: the keys its list declares, with the stored values on top, so an
 * entry the trackers only half-filled still shows the rows it is missing. A missing key reads as `null`
 * ("No value"), and nothing reaches the draft until one of those rows is edited.
 */
export function shapeStateEntry(item: unknown, key?: string, sectionId?: string): unknown {
  if (!key || !isPlainRecord(item)) return item;
  const template = emptyStateEntry(key, sectionId);
  if (!template) return item;
  const missing: Record<string, null> = {};
  for (const declaredKey of Object.keys(template)) missing[declaredKey] = null;
  return { ...missing, ...item };
}

/** "currentMood" and "current_mood" read as "Current mood", "maxHP" as "Max HP"; the raw key stays in the tooltip. */
export function humanizeStateKey(key: string): string {
  const words = key
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/\s+/)
    .filter(Boolean)
    // Acronyms (HP, XP) keep their capitals; other words read as a sentence.
    .map((word) => (word.length > 1 && word === word.toUpperCase() ? word : word.toLowerCase()));
  if (words.length === 0) return key;
  const sentence = words.join(" ");
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}
