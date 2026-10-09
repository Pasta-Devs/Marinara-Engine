// Field-level diffing for the Professor Mari "Easy Viewer". Turns a raw MariDbRowChange
// (full before/after row snapshots from approval.diffPreview) into a readable list of changed
// fields, recursing into the nested JSON columns (character `data`, lorebook arrays, preset order
// arrays) so the reviewer sees "Personality changed", not "data changed".

import type { MariDbRowChange } from "@marinara-engine/shared";
import { diffWords, type DiffSegment } from "./word-diff";

export interface FieldChange {
  path: string;
  label: string;
  /** Display string; "" means the field is absent on this side (added or removed). */
  before: string;
  after: string;
  kind: "added" | "removed" | "changed";
}

/**
 * Fields whose value is prose a person wrote, rather than structure.
 *
 * A rewrite of a character's description is not an error being corrected, so it
 * must not be painted red and green - that reads as wrong-and-right. Structural
 * changes (keys, flags, ids, counts) keep true diff colouring, because there the
 * red really does mean "this is gone".
 *
 * ponytail: a name list, so an unusual custom field falls back to diff colours.
 * Widen it when a real field is missing, not preemptively.
 */
const PROSE_FIELD_NAMES = new Set([
  "aboutme",
  "appearance",
  "backstory",
  "content",
  "creatornotes",
  "depthprompt",
  "description",
  "firstmes",
  "greeting",
  "mesexample",
  "personality",
  "posthistoryinstructions",
  "prompttemplate",
  "scenario",
  "summary",
  "systemprompt",
]);

/** True when a changed field holds prose rather than structure. See PROSE_FIELD_NAMES. */
export function isProseField(path: string): boolean {
  const leaf = path.split(".").at(-1) ?? path;
  return PROSE_FIELD_NAMES.has(leaf.replace(/[_\-\s]/g, "").toLowerCase());
}

/** `lorebook_entries` -> `Lorebook entry`; `agent_configs` reads as the agent it is. */
export function describeTable(table: string): string {
  if (table === "agent_configs") return "Agent";
  return table
    .replace(/_/g, " ")
    .replace(/ies$/, "y")
    .replace(/s$/, "")
    .replace(/^./, (first) => first.toUpperCase());
}

/** The changed record's own name (a character keeps it in `data`), or "" when it has none. */
export function changeRecordName(change: MariDbRowChange): string {
  const pick = (value: unknown) =>
    value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
  const row = pick(change.after) ?? pick(change.before);
  const name = (change.table === "characters" ? pick(row?.data) : row)?.name;
  return typeof name === "string" ? name : "";
}

/** Mari's reply fix (`chat.updateMessage`, a new active swipe) names its chat; null for any other change. */
export function replyFixChat(change: MariDbRowChange): { id: string; name: string } | null {
  if (change.table !== "messages") return null;
  const row = change.after ?? change.before;
  const id = row?.chatId;
  if (typeof id !== "string" || !id) return null;
  return { id, name: typeof row?.chatName === "string" ? row.chatName : "" };
}

export type LorebookVectorStatus = "excluded" | "vectorized" | "notVectorized";

/** Resolve the vector state shown in Professor Mari's lorebook-entry review. */
export function resolveLorebookVectorStatus(row: Record<string, unknown> | null | undefined): LorebookVectorStatus {
  const excluded =
    row?.excludeFromVectorization === true ||
    row?.excludeFromVectorization === 1 ||
    row?.excludeFromVectorization === "true" ||
    row?.excludeFromVectorization === "1";
  if (excluded) return "excluded";
  const embedding = row?.embedding;
  return Array.isArray(embedding) && embedding.length > 0 ? "vectorized" : "notVectorized";
}

// Columns/keys that are bookkeeping, identical by construction, or too noisy to show as edits.
const NOISE_KEYS = new Set([
  "id",
  "createdAt",
  "updatedAt",
  "created_at",
  "updated_at",
  "lorebookId",
  "lorebook_id",
  "sourceAgentId",
  "source_agent_id",
  "generatedBy",
  "generated_by",
  "operationHash",
  "operation_hash",
  // Derived embedding vectors (lorebook entries, memories) are large float arrays and never a
  // meaningful user-facing edit — never render them as a field diff.
  "embedding",
]);

const MAX_FLATTEN_DEPTH = 2;

// Fields stored as integers/strings but meaning a toggle — shown as on/off instead of "0"/"1".
const BOOLEAN_LEAF_KEYS = new Set([
  "enabled",
  "persistent",
  "constant",
  "selective",
  "matchWholeWords",
  "caseSensitive",
  "useRegex",
  "locked",
  "preventRecursion",
  "excludeRecursion",
  "delayUntilRecursion",
  "excludeFromVectorization",
]);

function displayScalar(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
}

function displayBoolean(value: unknown): string {
  return value === true || value === 1 || value === "true" || value === "1" ? "on" : "off";
}

function displayArray(value: unknown[]): string {
  if (value.length === 0) return "";
  const allScalar = value.every((v) => v === null || ["string", "number", "boolean"].includes(typeof v));
  if (allScalar) return value.map((v) => displayScalar(v)).join(", ");
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function flatten(value: unknown, path: string, out: Map<string, string>, depth: number): void {
  if (Array.isArray(value)) {
    out.set(path, displayArray(value));
    return;
  }
  if (value && typeof value === "object") {
    if (depth >= MAX_FLATTEN_DEPTH) {
      try {
        // Indent so the word diff has whitespace to tokenize on (minified JSON diffs as one blob).
        out.set(path, JSON.stringify(value, null, 1));
      } catch {
        out.set(path, String(value));
      }
      return;
    }
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (NOISE_KEYS.has(key)) continue;
      flatten(nested, path ? `${path}.${key}` : key, out, depth + 1);
    }
    return;
  }
  const leaf = path.split(".").pop() ?? path;
  out.set(path, BOOLEAN_LEAF_KEYS.has(leaf) ? displayBoolean(value) : displayScalar(value));
}

function flattenRow(row: Record<string, unknown> | null | undefined): Map<string, string> {
  const out = new Map<string, string>();
  if (!row) return out;
  for (const [key, value] of Object.entries(row)) {
    if (NOISE_KEYS.has(key)) continue;
    flatten(value, key, out, 1);
  }
  return out;
}

const LABEL_OVERRIDES: Record<string, string> = {
  "data.name": "Name",
  "data.description": "Description",
  "data.personality": "Personality",
  "data.scenario": "Scenario",
  "data.first_mes": "First message",
  "data.mes_example": "Example messages",
  "data.system_prompt": "System prompt",
  "data.post_history_instructions": "Post-history instructions",
  "data.creator_notes": "Creator notes",
  "data.alternate_greetings": "Alternate greetings",
  "data.character_book": "Lorebook entries",
  name: "Name",
  description: "Description",
  content: "Content",
  keys: "Primary keys",
  secondaryKeys: "Secondary keys",
  matchWholeWords: "Whole words",
  caseSensitive: "Case sensitive",
  useRegex: "Regex",
  selectiveLogic: "Selective logic",
};

// Lower weight sorts earlier; unknown fields fall to the alphabetical tail.
const FIELD_ORDER: Record<string, number> = {
  Name: 0,
  Description: 1,
  "Primary keys": 2,
  "Prompt Template": 2,
  "Secondary keys": 3,
  Content: 4,
  Personality: 5,
  Scenario: 6,
  "First message": 7,
  "Example messages": 8,
};

/** Slice 71: a saved field key ("first_mes") as its label ("First message"), cards first, then the plain key. */
export function fieldLabel(key: string): string {
  // A key typed with spaces ("first mes") still finds its label ("First message").
  const id = key.trim().replace(/\s+/gu, "_");
  return LABEL_OVERRIDES[`data.${id}`] ?? humanizeLabel(id);
}

/** "Lorebook entry" -> "lorebook entries": the table's thing, plural and lower case, for a count. */
export function describeTablePlural(table: string): string {
  const thing = describeTable(table).toLowerCase();
  return /[^aeiou]y$/u.test(thing) ? `${thing.slice(0, -1)}ies` : `${thing}s`;
}

function humanizeLabel(path: string): string {
  if (LABEL_OVERRIDES[path]) return LABEL_OVERRIDES[path];
  const leaf = path.split(".").pop() ?? path;
  return leaf
    .replace(/_/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/^./, (c) => c.toUpperCase());
}

/** A nested object or list flattened to JSON text (not a scalar that merely starts with `{{`). */
function isJsonText(value: string): boolean {
  if (!/^[[{]/.test(value)) return false;
  try {
    return typeof JSON.parse(value) === "object";
  } catch {
    return false;
  }
}

/**
 * Diff a row change into a readable list of changed fields (skips unchanged + noise keys). An
 * agent's nested `settings` JSON is left to the review's Raw view; its plain values still show.
 */
export function computeFieldChanges(change: MariDbRowChange): FieldChange[] {
  const beforeMap = flattenRow(change.before ?? null);
  const afterMap = flattenRow(change.after ?? null);
  const paths = new Set([...beforeMap.keys(), ...afterMap.keys()]);
  const changes: FieldChange[] = [];
  for (const path of paths) {
    const before = beforeMap.get(path) ?? "";
    const after = afterMap.get(path) ?? "";
    if (before === after) continue;
    if (change.table === "agent_configs" && path.startsWith("settings.") && (isJsonText(before) || isJsonText(after)))
      continue;
    const kind: FieldChange["kind"] = !beforeMap.has(path) ? "added" : !afterMap.has(path) ? "removed" : "changed";
    changes.push({ path, label: humanizeLabel(path), before, after, kind });
  }
  changes.sort((a, b) => {
    const wa = FIELD_ORDER[a.label] ?? 100;
    const wb = FIELD_ORDER[b.label] ?? 100;
    return wa !== wb ? wa - wb : a.label.localeCompare(b.label);
  });
  return changes;
}

/**
 * Tracked changes for a prose field: word by word when much of the old text survives (a greeting
 * reworked around its lines, a sentence added), or the whole old text struck and the whole new text
 * inserted when it was rewritten, since a word-by-word diff of a rewrite is confetti.
 */
export function trackProseChange(before: string, after: string): DiffSegment[] {
  const segments = diffWords(before, after);
  const words = (text: string) => text.replace(/\s+/g, "").length;
  const kept = segments.reduce((sum, segment) => sum + (segment.type === "equal" ? words(segment.value) : 0), 0);
  if (kept >= 0.4 * words(before)) return segments;
  return [
    ...(before ? [{ type: "removed" as const, value: before }] : []),
    ...(before && after ? [{ type: "equal" as const, value: " " }] : []),
    ...(after ? [{ type: "added" as const, value: after }] : []),
  ];
}

/** A list field such as tags: every value once, in reading order, marked kept, removed or added. */
export function trackListChange(before: string, after: string): DiffSegment[] {
  const split = (value: string) =>
    value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  const oldItems = split(before);
  const newItems = split(after);
  return [
    ...oldItems.map((value) => ({ type: newItems.includes(value) ? ("equal" as const) : ("removed" as const), value })),
    ...newItems.filter((value) => !oldItems.includes(value)).map((value) => ({ type: "added" as const, value })),
  ];
}

const LIST_FIELD_NAMES = new Set(["tags", "keys", "secondaryKeys"]);

/**
 * How a changed field reads in the review: a list (tags, lorebook keys) and an enum (a short
 * one-word value such as "and_any" or "50") as −/+ chips, a switch as one chip with its label, and
 * everything else as tracked text.
 */
export function fieldChangeStyle(field: FieldChange): "list" | "toggle" | "enum" | "text" {
  const leaf = field.path.split(".").at(-1) ?? field.path;
  if (LIST_FIELD_NAMES.has(leaf)) return "list";
  if (BOOLEAN_LEAF_KEYS.has(leaf)) return "toggle";
  const word = (value: string) => value.length <= 32 && /^[\w.:-]*$/u.test(value);
  if (leaf !== "name" && !isProseField(field.path) && word(field.before) && word(field.after)) return "enum";
  return "text";
}

/**
 * R10: a review row's one fact, in words: what this change does to the record ("Adds 2 keys: compass,
 * heirloom", "Changed description and tags", "New lorebook entry"), never a table name and a field list.
 */
export function reviewRowFact(
  change: MariDbRowChange,
  fields: readonly FieldChange[],
  t: (key: string, options?: Record<string, unknown>) => string,
  language = "en",
): string {
  if (replyFixChat(change)) return t("ui.chat.mariediteasyviewer.replyMeta");
  if (change.action === "insert") {
    return t("ui.chat.mariappliededit.factNew", { entity: describeTable(change.table).toLocaleLowerCase() });
  }
  const only = fields.length === 1 ? fields[0]! : null;
  if (only && /keys$/iu.test(only.path) && fieldChangeStyle(only) === "list") {
    const segments = trackListChange(only.before, only.after);
    const added = segments.filter((segment) => segment.type === "added").map((segment) => segment.value);
    if (added.length > 0 && !segments.some((segment) => segment.type === "removed")) {
      return t("ui.chat.mariappliededit.factAddsKeys", { count: added.length, keys: added.join(", ") });
    }
  }
  if (fields.length === 0) return t("ui.chat.mariediteasyviewer.noFieldChanges");
  if (fields.length > 3) return t("ui.chat.mariappliededit.factChangedMany", { count: fields.length });
  const labels = fields.map((field) => field.label.toLocaleLowerCase());
  return t("ui.chat.mariappliededit.factChanged", {
    fields: new Intl.ListFormat(language, { type: "conjunction" }).format(labels),
  });
}
