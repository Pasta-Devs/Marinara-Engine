// Field-level diffing for the Professor Mari "Easy Viewer". Turns a raw MariDbRowChange
// (full before/after row snapshots from approval.diffPreview) into a readable list of changed
// fields, recursing into the nested JSON columns (character `data`, lorebook arrays, preset order
// arrays) so the reviewer sees "Personality changed", not "data changed".

import type { MariDbRowChange } from "@marinara-engine/shared";

export interface FieldChange {
  path: string;
  label: string;
  /** Display string; "" means the field is absent on this side (added or removed). */
  before: string;
  after: string;
  kind: "added" | "removed" | "changed";
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
  "Secondary keys": 3,
  Content: 4,
  Personality: 5,
  Scenario: 6,
  "First message": 7,
  "Example messages": 8,
};

function humanizeLabel(path: string): string {
  if (LABEL_OVERRIDES[path]) return LABEL_OVERRIDES[path];
  const leaf = path.split(".").pop() ?? path;
  return leaf
    .replace(/_/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/^./, (c) => c.toUpperCase());
}

/** Diff a row change into a readable list of changed fields (skips unchanged + noise keys). */
export function computeFieldChanges(change: MariDbRowChange): FieldChange[] {
  const beforeMap = flattenRow(change.before ?? null);
  const afterMap = flattenRow(change.after ?? null);
  const paths = new Set([...beforeMap.keys(), ...afterMap.keys()]);
  const changes: FieldChange[] = [];
  for (const path of paths) {
    const before = beforeMap.get(path) ?? "";
    const after = afterMap.get(path) ?? "";
    if (before === after) continue;
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
