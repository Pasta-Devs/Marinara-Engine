// ──────────────────────────────────────────────
// Sentence chunker for streaming TTS
// ──────────────────────────────────────────────
//
// Given a growing text buffer (from a streaming LLM), emit each newly
// completed sentence as soon as it arrives so the client can dispatch TTS
// before the model finishes. We deliberately keep the partial sentence at
// the tail in reserve until either (a) a sentence-ending punctuation +
// whitespace appears or (b) the caller flushes the remainder via
// `extractRemainder()` when streaming ends.

const SENTENCE_END_RE = /[.!?]+(?:["'”’)\]}])?(?=\s|$)/g;

// Tokens that often precede a period but should NOT end a sentence.
// Conservative list — over-eager exclusion would just delay TTS a bit.
const ABBREVIATIONS = new Set([
  "mr",
  "mrs",
  "ms",
  "dr",
  "st",
  "prof",
  "sr",
  "jr",
  "vs",
  "etc",
  "ie",
  "eg",
  "fig",
  "no",
]);

function endsWithAbbreviation(text: string, periodIndex: number): boolean {
  // Walk back from periodIndex to find the token ending there
  let start = periodIndex;
  while (start > 0 && /[A-Za-z]/.test(text[start - 1]!)) start -= 1;
  const token = text.slice(start, periodIndex).toLowerCase();
  return token.length > 0 && ABBREVIATIONS.has(token);
}

// Inline reasoning-block patterns that some models emit at the start of a
// reply. The server strips these via extractLeadingThinkingBlocks at end of
// stream and issues a content_replace, but mid-stream the client buffer
// still contains them. Skip past complete blocks; wait if a block is still
// opening (we don't want to TTS the model's thinking).
const LEADING_THINKING_PATTERNS = [
  { open: /^\s*<(think|thinking|thought)>/i, close: /<\/(think|thinking|thought)>/i },
  { open: /^\s*<\|think\|>/i, close: /<\|\/think\|>/i },
  { open: /^\s*<\|channel>thought\b/i, close: /<channel\|>/i },
];

/** If the buffer starts with an unclosed thinking block, return null (wait).
 *  If it starts with a complete thinking block, return the index just past
 *  it. Otherwise return 0 (no leading block). */
function advancePastLeadingThinking(text: string): number | null {
  for (const pat of LEADING_THINKING_PATTERNS) {
    const open = text.match(pat.open);
    if (!open) continue;
    const after = text.slice(open[0].length);
    const close = after.match(pat.close);
    if (!close) return null; // wait for the block to close
    return open[0].length + (close.index ?? 0) + close[0].length;
  }
  return 0;
}

export interface ChunkerState {
  /** Number of chars already emitted as completed sentences. */
  cursor: number;
  /** Once true, no further leading-thinking skipping is attempted (we've
   *  already past the leading block, or there wasn't one). */
  thinkingResolved: boolean;
}

export function createChunkerState(): ChunkerState {
  return { cursor: 0, thinkingResolved: false };
}

/**
 * Inspect the buffer and emit any newly-completed sentence(s) since the last
 * call. Updates the cursor in place. Returns the joined new content (may
 * contain multiple sentences if several completed in one buffer update).
 */
export function extractNewSentences(buffer: string, state: ChunkerState): string {
  // Defensive: the server can replace the buffer mid-stream (content_replace
  // event — e.g. when it strips inline thinking blocks at end-of-stream).
  // If the buffer just got shorter than what we've already emitted, snap the
  // cursor to the new length so we don't slice past the end. We accept the
  // edge case that some content we already spoke may have been rewritten —
  // it's preferable to losing the rest of the reply.
  if (buffer.length < state.cursor) {
    state.cursor = buffer.length;
  }
  if (!state.thinkingResolved) {
    const skip = advancePastLeadingThinking(buffer);
    if (skip === null) return ""; // thinking block still streaming in
    if (skip > state.cursor) state.cursor = skip;
    state.thinkingResolved = true;
  }
  if (state.cursor >= buffer.length) return "";
  const tail = buffer.slice(state.cursor);

  // Find the last sentence end in the tail. We ship everything up to and
  // including that end; what follows is the in-progress sentence and stays
  // in reserve.
  let lastEnd = -1;
  for (const match of tail.matchAll(SENTENCE_END_RE)) {
    const localEnd = (match.index ?? 0) + match[0].length;
    const absoluteEnd = state.cursor + localEnd;
    // Defensive abbreviation check
    const periodPos = (match.index ?? 0) + match[0].length - 1;
    if (endsWithAbbreviation(tail, periodPos)) continue;
    lastEnd = absoluteEnd;
  }

  if (lastEnd === -1) return "";

  const slice = buffer.slice(state.cursor, lastEnd).trim();
  state.cursor = lastEnd;
  return slice;
}

/**
 * Called once streaming has ended — return whatever is left in the buffer
 * after the last sentence boundary. Updates the cursor to the buffer end.
 */
export function extractRemainder(buffer: string, state: ChunkerState): string {
  if (buffer.length < state.cursor) {
    state.cursor = buffer.length;
  }
  if (!state.thinkingResolved) {
    // Streaming ended — handle whatever leading-thinking state we're in.
    const skip = advancePastLeadingThinking(buffer);
    if (skip !== null && skip > state.cursor) state.cursor = skip;
    state.thinkingResolved = true;
  }
  if (state.cursor >= buffer.length) return "";
  const remainder = buffer.slice(state.cursor).trim();
  state.cursor = buffer.length;
  return remainder;
}
