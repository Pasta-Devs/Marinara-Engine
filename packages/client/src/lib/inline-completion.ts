/**
 * Inline "ghost text" completion for the omnibar input and the Professor Mari
 * composer: given what the user typed and a ranked list of candidate phrases,
 * return the text that would be appended if they press Tab.
 *
 * A leading `@` or `@"` on a word is masked, so `@Jes` suggests the same name as `Jes` (the Mari
 * composer's reference trigger).
 *
 * Continue the whole value first, then phrases at word boundaries (prose in
 * the Mari composer, "tell me about dc " -> "dc simulator"). Candidates are matched by
 * case-insensitive prefix; the suffix keeps the candidate's casing and the
 * text already typed stays unchanged.
 */

/** Below this, a fragment matches too much to be a useful guess. */
const MIN_FRAGMENT = 2;

/** The reference trigger (`@` or `@"`) is intent, not part of the name. */
const REFERENCE_TRIGGER = /^@"?/;

function matchSuffix(fragment: string, candidates: readonly string[]): string {
  const lower = fragment.toLowerCase();
  for (const candidate of candidates) {
    const trimmed = candidate.trim();
    if (trimmed.length <= fragment.length) continue;
    if (trimmed.toLowerCase().startsWith(lower)) return trimmed.slice(fragment.length);
  }
  return "";
}

/**
 * The text to show greyed out after `value`, or "" when nothing fits.
 * `candidates` must already be in priority order; the first match wins.
 */
export function completeInline(value: string, candidates: readonly string[]): string {
  if (!value) return "";
  const maxCandidateLength = candidates.reduce((max, candidate) => Math.max(max, candidate.trim().length), 0);
  // Try the longest suffix first so spaces inside a name remain part of its prefix.
  // Whitespace alone (or a single letter followed by a space) is not a useful guess.
  for (const word of value.matchAll(/\S+/g)) {
    const fragment = value.slice(word.index).replace(REFERENCE_TRIGGER, "");
    if (fragment.length >= maxCandidateLength) continue;
    if (fragment.trimEnd().length < MIN_FRAGMENT) continue;
    const suffix = matchSuffix(fragment, candidates);
    if (suffix) return suffix;
  }
  return "";
}
