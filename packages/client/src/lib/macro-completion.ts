import { SUPPORTED_MACROS } from "@marinara-engine/shared";

/**
 * Ghost-text completion for macros in prompt fields: after `{{ch` the field
 * greys in `ar}}`, the same Tab-to-accept continuation the omnibar and the
 * Professor Mari composer use for names.
 *
 * Candidates come from the macro registry, so a macro added there completes
 * here with no extra work. Each candidate is what follows `{{`:
 * - plain macros close themselves: `char}}`
 * - macros that take arguments stop at their separator: `getvar::`, `roll:`
 * - block openers stop after the keyword: `#if `
 * Placeholders such as `{{NAME}}` or a card ID are not real names, so they are skipped.
 */

function candidatesFromSyntax(syntax: string): string[] {
  const candidates: string[] = [];
  for (const match of syntax.matchAll(/\{\{([^{}]+)\}\}/g)) {
    const token = match[1]!.trim();
    // `{{// comment}}`, `{{\n}}` and `{{21-character-card-ID}}` are not something to type letter by letter.
    if (!/^[#/]?[A-Za-z_]/.test(token)) continue;
    const space = token.search(/\s/);
    if (space > 0) {
      candidates.push(`${token.slice(0, space)} `);
      continue;
    }
    const separator = /^[^:]*?(::|:)/.exec(token);
    if (separator) {
      candidates.push(separator[0]);
      continue;
    }
    if (/^[A-Z_]+$/.test(token) || /-ID$/.test(token)) continue;
    candidates.push(`${token}}}`);
  }
  return candidates;
}

/** Every macro continuation, in registry order (the registry lists the common ones first). */
export const MACRO_COMPLETION_CANDIDATES: readonly string[] = Array.from(
  new Set(SUPPORTED_MACROS.flatMap((macro) => candidatesFromSyntax(macro.syntax))),
);

/**
 * The text to show greyed out at `caret`, or "" when nothing fits.
 * Only completes at the end of a line, so the ghost never overlaps text after the caret.
 */
export function completeMacro(
  value: string,
  caret: number,
  candidates: readonly string[] = MACRO_COMPLETION_CANDIDATES,
): string {
  const next = value[caret];
  if (next !== undefined && next !== "\n") return "";
  const before = value.slice(0, caret);
  const open = before.lastIndexOf("{{");
  if (open < 0) return "";
  const fragment = before.slice(open + 2);
  // An empty fragment matches everything; a space or a closed `}}` means the user is past the name.
  if (!fragment || /[\s{]|\}\}/.test(fragment)) return "";
  const lower = fragment.toLowerCase();
  for (const candidate of candidates) {
    if (candidate.length > fragment.length && candidate.toLowerCase().startsWith(lower)) {
      return candidate.slice(fragment.length);
    }
  }
  return "";
}
