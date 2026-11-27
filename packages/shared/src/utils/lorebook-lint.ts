// Pure lorebook "Check lorebook" analyzer. Runs over the entries the editor
// already holds, so it needs no server round-trip and stays cheap for books
// with hundreds of entries (one pass per rule, maps instead of pairwise loops).

import type { LorebookEntry } from "../types/lorebook.js";
import { compareLorebookEntriesByPromptOrder } from "./lorebook-prompt-order.js";
import { isPatternSafe } from "./regex-safety.js";
import { estimateTextTokens } from "./token-estimator.js";

export type LorebookLintSeverity = "error" | "warning" | "info";

export type LorebookLintCode =
  | "empty_content"
  | "no_keys"
  | "invalid_regex"
  | "unsafe_regex"
  | "duplicate_content"
  | "duplicate_key"
  | "overlong"
  | "short_key"
  | "common_key"
  | "disabled";

export interface LorebookLintIssue {
  code: LorebookLintCode;
  severity: LorebookLintSeverity;
  entryId: string;
  entryName: string;
  /** The offending key, for key-level rules. */
  key?: string;
  /** Other entries involved in a duplicate finding. */
  relatedEntryIds?: string[];
  /** Estimated tokens, for the overlong rule. */
  tokens?: number;
}

export type LintableLorebookEntry = Pick<
  LorebookEntry,
  "id" | "name" | "content" | "keys" | "enabled" | "constant" | "useRegex" | "caseSensitive"
> &
  Partial<Pick<LorebookEntry, "order" | "position" | "depth">>;

export interface LorebookLintOptions {
  /** Entries estimated above this many tokens are flagged. Default 1000. */
  maxEntryTokens?: number;
  /** Literal keys shorter than this many characters are flagged. Default 3. */
  minKeyLength?: number;
}

export const LOREBOOK_LINT_DEFAULT_MAX_ENTRY_TOKENS = 1000;
export const LOREBOOK_LINT_DEFAULT_MIN_KEY_LENGTH = 3;

const SEVERITY_RANK: Record<LorebookLintSeverity, number> = { error: 0, warning: 1, info: 2 };

// ponytail: English-only stop list. Keys in other languages are still caught by
// the length rule; a per-locale list is the upgrade path if it proves noisy.
const COMMON_WORDS = new Set(
  (
    "a about after all also an and any are as at be because been before but by can come could day did do does " +
    "down each even first for from get give go good has have he her here him his how i if in into is it its just " +
    "know like look make man me more most my new no not now of on one only or other our out over people say see " +
    "she so some take than that the their them then there these they thing think this time to two up us use very " +
    "was way we well what when where which who will with would year yes you your yet ok okay hello hi hey sir " +
    "lady lord man woman girl boy yes no maybe please thanks thank"
  ).split(" "),
);

function normalizeKey(key: string, caseSensitive: boolean) {
  const trimmed = key.trim();
  return caseSensitive ? trimmed : trimmed.toLocaleLowerCase();
}

function normalizeContent(content: string) {
  return content.replace(/\s+/gu, " ").trim().toLocaleLowerCase();
}

function regexError(source: string): boolean {
  try {
    new RegExp(source, "u");
    return false;
  } catch {
    try {
      // Keys run without the unicode flag at scan time; accept either form.
      new RegExp(source);
      return false;
    } catch {
      return true;
    }
  }
}

/**
 * Analyze lorebook entries for authoring problems. Returns issues sorted by
 * severity, then by entry prompt order, then by entry name. Never mutates input.
 */
export function lintLorebookEntries(
  entries: readonly LintableLorebookEntry[],
  options: LorebookLintOptions = {},
): LorebookLintIssue[] {
  const maxEntryTokens = options.maxEntryTokens ?? LOREBOOK_LINT_DEFAULT_MAX_ENTRY_TOKENS;
  const minKeyLength = options.minKeyLength ?? LOREBOOK_LINT_DEFAULT_MIN_KEY_LENGTH;
  const issues: LorebookLintIssue[] = [];
  const keyOwners = new Map<string, { key: string; entryIds: string[] }>();
  const contentOwners = new Map<string, string[]>();

  for (const entry of entries) {
    const base = { entryId: entry.id, entryName: entry.name };
    const keys = entry.keys.map((key) => key.trim()).filter(Boolean);
    const content = entry.content ?? "";
    const bypassesKeys = entry.constant;

    if (!entry.enabled) issues.push({ ...base, code: "disabled", severity: "info" });
    if (!content.trim()) issues.push({ ...base, code: "empty_content", severity: "warning" });
    if (keys.length === 0 && !bypassesKeys) issues.push({ ...base, code: "no_keys", severity: "warning" });

    const tokens = content ? estimateTextTokens(content) : 0;
    if (tokens > maxEntryTokens) issues.push({ ...base, code: "overlong", severity: "warning", tokens });

    const normalizedContent = normalizeContent(content);
    if (normalizedContent) {
      const owners = contentOwners.get(normalizedContent);
      if (owners) owners.push(entry.id);
      else contentOwners.set(normalizedContent, [entry.id]);
    }

    const seenInEntry = new Set<string>();
    for (const key of keys) {
      // Regex escapes are case-sensitive syntax even for case-insensitive matching (\D is not \d).
      const normalized = normalizeKey(key, entry.caseSensitive || entry.useRegex);
      // Only identical matching modes are duplicates. Regex/literal and
      // case-sensitive/insensitive keys may overlap without being equivalent.
      const ownerKey = `${entry.useRegex ? "re" : "lit"}:${entry.caseSensitive ? "case" : "nocase"}:${normalized}`;
      if (!seenInEntry.has(ownerKey)) {
        seenInEntry.add(ownerKey);
        const owner = keyOwners.get(ownerKey);
        if (owner) owner.entryIds.push(entry.id);
        else keyOwners.set(ownerKey, { key, entryIds: [entry.id] });
      }

      if (entry.useRegex) {
        if (regexError(key)) issues.push({ ...base, code: "invalid_regex", severity: "error", key });
        else if (!isPatternSafe(key)) issues.push({ ...base, code: "unsafe_regex", severity: "warning", key });
        continue;
      }
      if (bypassesKeys) continue;
      if (Array.from(key).length < minKeyLength) {
        issues.push({ ...base, code: "short_key", severity: "warning", key });
      } else if (COMMON_WORDS.has(key.toLocaleLowerCase())) {
        issues.push({ ...base, code: "common_key", severity: "warning", key });
      }
    }
  }

  const nameById = new Map(entries.map((entry) => [entry.id, entry.name]));
  for (const ids of contentOwners.values()) {
    if (ids.length < 2) continue;
    for (const id of ids) {
      issues.push({
        code: "duplicate_content",
        severity: "warning",
        entryId: id,
        entryName: nameById.get(id) ?? "",
        relatedEntryIds: ids.filter((other) => other !== id),
      });
    }
  }
  for (const { key, entryIds } of keyOwners.values()) {
    if (entryIds.length < 2) continue;
    for (const id of entryIds) {
      issues.push({
        code: "duplicate_key",
        severity: "info",
        entryId: id,
        entryName: nameById.get(id) ?? "",
        key,
        relatedEntryIds: entryIds.filter((other) => other !== id),
      });
    }
  }

  // Within a severity, issues follow the entries' prompt order (Before, After, depth, Outlets; Order inside each).
  const positionById = new Map(entries.map((entry, index) => [entry.id, { entry, index }]));
  return issues.sort((a, b) => {
    const severity = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    if (severity !== 0) return severity;
    const left = positionById.get(a.entryId)!;
    const right = positionById.get(b.entryId)!;
    return (
      compareLorebookEntriesByPromptOrder(left.entry, right.entry) ||
      left.index - right.index ||
      a.code.localeCompare(b.code)
    );
  });
}
