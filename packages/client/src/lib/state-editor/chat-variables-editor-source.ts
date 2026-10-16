// ──────────────────────────────────────────────
// Chat variables as a State Editor source: the chat's `{{name}}` values
// (`metadata.macroVariables`) as one section, saved as a merge patch.
// ──────────────────────────────────────────────
import {
  MAX_CHAT_VARIABLE_VALUE_LENGTH,
  MAX_CHAT_VARIABLES,
  validateChatVariableName,
  type ChatVariableNameIssue,
} from "@marinara-engine/shared";
import type { StateEditorSection } from "./state-editor.types";

export const CHAT_VARIABLES_SECTION_ID = "chat-variables";

export type ChatVariablesEditorIssue =
  | { kind: "notObject" }
  | { kind: "notString"; name: string }
  | { kind: "tooLong"; name: string }
  | { kind: "name"; name: string; issue: ChatVariableNameIssue }
  | { kind: "tooMany" };

/** The string entries of a chat's stored `macroVariables`, in stored order. */
export function readChatVariables(metadata: unknown): Record<string, string> {
  const parsed = typeof metadata === "string" ? safeParse(metadata) : metadata;
  const stored = parsed && typeof parsed === "object" ? (parsed as { macroVariables?: unknown }).macroVariables : null;
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) return {};
  return Object.fromEntries(
    Object.entries(stored as Record<string, unknown>).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function buildChatVariablesEditorSections(
  variables: Record<string, string>,
  localize: (part: "label" | "description") => string,
): StateEditorSection[] {
  return [
    {
      id: CHAT_VARIABLES_SECTION_ID,
      label: localize("label"),
      description: localize("description"),
      value: variables,
    },
  ];
}

/**
 * The `macroVariables` merge patch that turns `original` (what the editor opened with) into `draft`.
 *
 * Only names the user changed are sent, so a `{{setvar}}` a generation saved meanwhile under another
 * name survives. Removed names become null. New names follow the same rules as the Chat Variables
 * section; names already stored keep whatever spelling `{{setvar}}` gave them.
 */
export function buildChatVariablesEditorPatch(
  saved: Record<string, string>,
  original: Record<string, string>,
  draft: unknown,
): { patch: Record<string, string | null> } | { issue: ChatVariablesEditorIssue } {
  if (!draft || typeof draft !== "object" || Array.isArray(draft)) return { issue: { kind: "notObject" } };
  const next = draft as Record<string, unknown>;
  // Null prototype: a stored "__proto__" (only {{setvar}} can make one) must stay a plain key.
  const patch = Object.create(null) as Record<string, string | null>;
  for (const [name, value] of Object.entries(next)) {
    if (typeof value !== "string") return { issue: { kind: "notString", name } };
    if (value.length > MAX_CHAT_VARIABLE_VALUE_LENGTH) return { issue: { kind: "tooLong", name } };
    if (!Object.hasOwn(saved, name) && !Object.hasOwn(original, name)) {
      // validateChatVariableName trims; a key with spaces around it would still be refused by the server.
      const issue = name.trim() === name ? validateChatVariableName(name) : "format";
      if (issue) return { issue: { kind: "name", name, issue } };
    }
    if (!Object.hasOwn(original, name) || original[name] !== value) patch[name] = value;
  }
  for (const name of Object.keys(original)) {
    if (!Object.hasOwn(next, name)) patch[name] = null;
  }
  const merged = new Set(Object.keys(saved));
  for (const [name, value] of Object.entries(patch)) {
    if (value === null) merged.delete(name);
    else merged.add(name);
  }
  if (merged.size > MAX_CHAT_VARIABLES) return { issue: { kind: "tooMany" } };
  return { patch };
}
