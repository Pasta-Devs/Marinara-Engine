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
