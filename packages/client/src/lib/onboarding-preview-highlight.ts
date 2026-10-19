// ──────────────────────────────────────────────
// Marking the parts of a resolved onboarding persona that the player's answers
// filled in, so the review window can separate the card author's static text
// from what the player chose.
// ──────────────────────────────────────────────
export interface AnswerHighlightSegment {
  text: string;
  /** True when this run of text came from an answer, not from the card. */
  yours: boolean;
}

const WORD_CHAR = /[\p{L}\p{N}_]/u;

function isWordChar(char: string | undefined): boolean {
  return char !== undefined && WORD_CHAR.test(char);
}

/** The card's own prose, with every `{{tag}}` blanked out. */
function authoredText(template: string): string {
  return template.replace(/\{\{[^}]*\}\}/g, " ").toLowerCase();
}

/** Every place `value` occurs as a whole value, not inside a longer word. */
function wholeOccurrences(text: string, value: string): Array<{ start: number; end: number }> {
  const found: Array<{ start: number; end: number }> = [];
  const startsWord = isWordChar(value[0]);
  const endsWord = isWordChar(value[value.length - 1]);
  let index = text.indexOf(value);
  while (index !== -1) {
    const end = index + value.length;
    if ((!startsWord || !isWordChar(text[index - 1])) && (!endsWord || !isWordChar(text[end]))) {
      found.push({ start: index, end });
    }
    index = text.indexOf(value, index + 1);
  }
  return found;
}

/**
 * Split one resolved persona field into plain and player-chosen runs.
 *
 * The resolver returns only the finished string, so an answer is recognized by
 * its value, restricted to occurrences that do not already appear in the card's
 * own text for this field. A value the author also wrote in prose is therefore
 * left plain rather than guessed at: highlighting says "this is yours" and
 * must never say it about the author's words.
 *
 * ponytail: a value match, not engine spans — one answer repeated verbatim in
 * two places is highlighted at both. If the preview ever needs exact spans,
 * have `resolveMacros` report them instead of matching text here.
 */
export function highlightAnswerValues(
  text: string,
  values: readonly string[],
  template: string,
): AnswerHighlightSegment[] {
  const authored = authoredText(template);
  const candidates = [...new Set(values.map((value) => value.trim()))]
    .filter((value) => value.length >= 2 && wholeOccurrences(authored, value.toLowerCase()).length === 0)
    .sort((a, b) => b.length - a.length || a.localeCompare(b));

  const spans: Array<{ start: number; end: number }> = [];
  for (const value of candidates) {
    for (const span of wholeOccurrences(text, value)) {
      if (spans.some((taken) => span.start < taken.end && taken.start < span.end)) continue;
      spans.push(span);
    }
  }
  if (spans.length === 0) return [{ text, yours: false }];

  spans.sort((a, b) => a.start - b.start);
  const segments: AnswerHighlightSegment[] = [];
  let cursor = 0;
  for (const span of spans) {
    if (span.start > cursor) segments.push({ text: text.slice(cursor, span.start), yours: false });
    const previous = segments[segments.length - 1];
    if (previous?.yours) previous.text += text.slice(span.start, span.end);
    else segments.push({ text: text.slice(span.start, span.end), yours: true });
    cursor = span.end;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor), yours: false });
  return segments;
}
