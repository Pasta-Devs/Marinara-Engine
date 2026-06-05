// Pure keyword-matching helpers for lorebook entries.
// Server scanning and the in-editor keyword-test preview share these so the
// preview cannot drift from the real activation rules.

import type { SelectiveLogic } from "../../contracts/types/lorebook.js";
import { isPatternSafe } from "./regex-safety.js";

/** Pluggable executor for compiled regex test calls. Runtime-specific callers can add extra guards. */
type RegexExecutor = (regex: RegExp, text: string) => boolean;
type AsyncRegexExecutor = (regex: RegExp, text: string) => boolean | Promise<boolean>;

const defaultRegexExecutor: RegexExecutor = (regex, text) => regex.test(text);

export interface KeywordMatchOptions {
  useRegex: boolean;
  matchWholeWords: boolean;
  caseSensitive: boolean;
  /** Optional override for executing user-supplied regex patterns. Only applied
   *  to the `useRegex` path; the matchWholeWords branch builds its regex from
   *  escaped-literal text and skips the executor. */
  regexExecutor?: RegexExecutor;
}

export interface AsyncKeywordMatchOptions extends Omit<KeywordMatchOptions, "regexExecutor"> {
  regexExecutor?: AsyncRegexExecutor;
}

type KeywordMatchBaseOptions = Pick<KeywordMatchOptions, "caseSensitive">;

function literalMatch(keyword: string, text: string, options: KeywordMatchBaseOptions): boolean {
  const needle = options.caseSensitive ? keyword : keyword.toLowerCase();
  const haystack = options.caseSensitive ? text : text.toLowerCase();
  return haystack.includes(needle);
}

/** Test whether a single keyword would match the given text under the given options. */
function testKeyword(keyword: string, text: string, options: KeywordMatchOptions): boolean {
  if (!keyword) return false;

  try {
    if (options.useRegex) {
      // Static ReDoS guard: refuse to compile patterns with nested quantifiers,
      // pathological repetition counts, or oversized sources. Fall back to literal
      // substring match — same posture as the existing invalid-regex catch below.
      if (!isPatternSafe(keyword)) {
        return literalMatch(keyword, text, options);
      }
      const flags = options.caseSensitive ? "g" : "gi";
      const regex = new RegExp(keyword, flags);
      const exec = options.regexExecutor ?? defaultRegexExecutor;
      return exec(regex, text);
    }

    if (options.matchWholeWords) {
      const needle = options.caseSensitive ? keyword : keyword.toLowerCase();
      const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const flags = options.caseSensitive ? "g" : "gi";
      const regex = new RegExp(`\\b${escaped}\\b`, flags);
      // No regexExecutor here — pattern is built from escaped-literal text, can't ReDoS.
      return regex.test(text);
    }

    return literalMatch(keyword, text, options);
  } catch {
    // Invalid regex or executor failure — fall back to plain substring
    return literalMatch(keyword, text, options);
  }
}

async function testKeywordAsync(keyword: string, text: string, options: AsyncKeywordMatchOptions): Promise<boolean> {
  if (!keyword) return false;

  try {
    if (options.useRegex) {
      if (!isPatternSafe(keyword)) {
        return literalMatch(keyword, text, options);
      }
      const flags = options.caseSensitive ? "g" : "gi";
      const regex = new RegExp(keyword, flags);
      const exec = options.regexExecutor ?? defaultRegexExecutor;
      return await exec(regex, text);
    }

    if (options.matchWholeWords) {
      const needle = options.caseSensitive ? keyword : keyword.toLowerCase();
      const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const flags = options.caseSensitive ? "g" : "gi";
      const regex = new RegExp(`\\b${escaped}\\b`, flags);
      return regex.test(text);
    }

    return literalMatch(keyword, text, options);
  } catch {
    return literalMatch(keyword, text, options);
  }
}

/** Primary key set: any single key matching counts as a match. */
export function testPrimaryKeys(
  keys: string[],
  text: string,
  options: KeywordMatchOptions,
): { matched: boolean; matchedKeys: string[] } {
  const matchedKeys: string[] = [];
  for (const key of keys) {
    if (testKeyword(key, text, options)) {
      matchedKeys.push(key);
    }
  }
  return { matched: matchedKeys.length > 0, matchedKeys };
}

export async function testPrimaryKeysAsync(
  keys: string[],
  text: string,
  options: AsyncKeywordMatchOptions,
): Promise<{ matched: boolean; matchedKeys: string[] }> {
  const matchedKeys: string[] = [];
  for (const key of keys) {
    if (await testKeywordAsync(key, text, options)) {
      matchedKeys.push(key);
    }
  }
  return { matched: matchedKeys.length > 0, matchedKeys };
}

/** Secondary key set with selective logic (and/or/not). Empty list passes. */
export function testSecondaryKeys(
  secondaryKeys: string[],
  text: string,
  logic: SelectiveLogic,
  options: KeywordMatchOptions,
): boolean {
  if (secondaryKeys.length === 0) return true;

  switch (logic) {
    case "and":
      for (const key of secondaryKeys) {
        if (!testKeyword(key, text, options)) return false;
      }
      return true;
    case "or":
      for (const key of secondaryKeys) {
        if (testKeyword(key, text, options)) return true;
      }
      return false;
    case "not":
      for (const key of secondaryKeys) {
        if (testKeyword(key, text, options)) return false;
      }
      return true;
    default:
      return true;
  }
}

export async function testSecondaryKeysAsync(
  secondaryKeys: string[],
  text: string,
  logic: SelectiveLogic,
  options: AsyncKeywordMatchOptions,
): Promise<boolean> {
  if (secondaryKeys.length === 0) return true;

  switch (logic) {
    case "and":
      for (const key of secondaryKeys) {
        if (!(await testKeywordAsync(key, text, options))) return false;
      }
      return true;
    case "or":
      for (const key of secondaryKeys) {
        if (await testKeywordAsync(key, text, options)) return true;
      }
      return false;
    case "not":
      for (const key of secondaryKeys) {
        if (await testKeywordAsync(key, text, options)) return false;
      }
      return true;
    default:
      return true;
  }
}
