/**
 * Inline "ghost text" completion for the omnibar input and the Professor Mari
 * composer: given what the user typed and a ranked list of candidate phrases,
 * return the text that would be appended if they press Tab.
 *
 * Continue the whole value first, then phrases at word boundaries (prose in
 * the Mari composer, "tell me about dc " -> "dc simulator"). Candidates are matched by
 * case-insensitive prefix; the suffix keeps the candidate's casing and the
 * text already typed stays unchanged.
 */

/** Below this, a fragment matches too much to be a useful guess. */
const MIN_FRAGMENT = 2;

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
    if (value.length - word.index >= maxCandidateLength) continue;
    const fragment = value.slice(word.index);
    if (fragment.trimEnd().length < MIN_FRAGMENT) continue;
    const suffix = matchSuffix(fragment, candidates);
    if (suffix) return suffix;
  }
  return "";
}
