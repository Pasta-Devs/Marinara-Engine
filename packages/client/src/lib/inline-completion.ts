/**
 * Inline "ghost text" completion for the omnibar input and the Professor Mari
 * composer: given what the user typed and a ranked list of candidate phrases,
 * return the text that would be appended if they press Tab.
 *
 * Two attempts, in order: continue the whole value (an omnibar query is one
 * phrase, "cel" -> "Celeste"), then continue the last word (prose in the Mari
 * composer, "tell me about cel" -> "Celeste"). Candidates are matched by
 * case-insensitive prefix and the candidate's own casing is kept, so accepting
 * a completion also fixes capitalisation.
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
  // Trailing whitespace means the user finished a word; there is nothing to continue.
  if (!value || /\s$/.test(value)) return "";
  if (value.length >= MIN_FRAGMENT) {
    const whole = matchSuffix(value, candidates);
    if (whole) return whole;
  }
  const lastBreak = value.search(/\S+$/);
  const lastWord = lastBreak > 0 ? value.slice(lastBreak) : "";
  if (lastWord.length < MIN_FRAGMENT) return "";
  return matchSuffix(lastWord, candidates);
}
