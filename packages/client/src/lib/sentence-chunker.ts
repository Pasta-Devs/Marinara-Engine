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

// Inline reasoning-block patterns that some models emit (chain-of-thought,
// scratch-pad reasoning, etc.). The server strips these at end of stream via
// content_replace, but mid-stream the client buffer still contains them.
// We need to (a) pause emission while inside an UNCLOSED block, and
// (b) strip CLOSED blocks from emitted text — otherwise TTS speaks the
// model's reasoning aloud before it gets hidden.
//
// `[^>]*` allows attributes like `<thought type="cot">`. Backreference `\1`
// ensures we match the corresponding closing tag.
const THINKING_BLOCK_RE = /<(think|thinking|thought)\b[^>]*>[\s\S]*?<\/\1>/gi;
// Special-token variants that some models emit (no XML close form).
const SPECIAL_THINKING_BLOCK_RES = [
  { open: /<\|think\|>/i, close: /<\|\/think\|>/i },
  { open: /<\|channel>thought\b/i, close: /<channel\|>/i },
];
// Open-tag regex used to detect an UNCLOSED block in the tail. We test this
// against a "masked" string where all CLOSED blocks have been replaced with
// spaces of equal length, so we don't mistake the open tag of a closed pair
// for an unclosed one.
const THINKING_OPEN_TAG_RE = /<(think|thinking|thought)\b[^>]*>/i;

/** Strip all closed thinking blocks from `text` (returns the stripped text). */
function stripClosedThinkingBlocks(text: string): string {
  let out = text.replace(THINKING_BLOCK_RE, "");
  for (const { open, close } of SPECIAL_THINKING_BLOCK_RES) {
    let openMatch = out.match(open);
    while (openMatch && openMatch.index !== undefined) {
      const rest = out.slice(openMatch.index + openMatch[0].length);
      const closeMatch = rest.match(close);
      if (!closeMatch || closeMatch.index === undefined) break;
      const blockEnd = openMatch.index + openMatch[0].length + closeMatch.index + closeMatch[0].length;
      out = out.slice(0, openMatch.index) + out.slice(blockEnd);
      openMatch = out.match(open);
    }
  }
  return out;
}

/** Return the position in `tail` where an UNCLOSED thinking block begins,
 *  or `null` if no unclosed block is present. Mask CLOSED blocks first so
 *  their open tags don't get reported as unclosed. */
function findUnclosedThinkingStart(tail: string): number | null {
  // Replace closed blocks with same-length space runs to preserve indices.
  let masked = tail.replace(THINKING_BLOCK_RE, (m) => " ".repeat(m.length));
  for (const { open, close } of SPECIAL_THINKING_BLOCK_RES) {
    let openMatch = masked.match(open);
    while (openMatch && openMatch.index !== undefined) {
      const rest = masked.slice(openMatch.index + openMatch[0].length);
      const closeMatch = rest.match(close);
      if (!closeMatch || closeMatch.index === undefined) break;
      const start = openMatch.index;
      const blockLen = openMatch[0].length + closeMatch.index + closeMatch[0].length;
      masked = masked.slice(0, start) + " ".repeat(blockLen) + masked.slice(start + blockLen);
      openMatch = masked.match(open);
    }
  }
  const m = masked.match(THINKING_OPEN_TAG_RE);
  if (m && m.index !== undefined) return m.index;
  for (const { open } of SPECIAL_THINKING_BLOCK_RES) {
    const sm = masked.match(open);
    if (sm && sm.index !== undefined) return sm.index;
  }
  return null;
}

export interface ChunkerState {
  /** Number of chars already emitted as completed sentences. */
  cursor: number;
  /** Furthest buffer offset we have ever emitted to. Used to guard against
   *  re-emitting content after the server fires a `content_replace` event
   *  (use-generate.ts) — that rewinds the streamBuffer to a common prefix
   *  and re-types the cleaned tail via the typewriter. Without this, the
   *  chunker would emit sentences again as the buffer grows back and the
   *  streaming-TTS hook would play them a second time. */
  highWaterMark: number;
}

export function createChunkerState(): ChunkerState {
  return { cursor: 0, highWaterMark: 0 };
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
  // Never re-emit content past the high-water mark. After a `content_replace`
  // rewind the cursor snaps to the smaller buffer length, but the typewriter
  // is about to re-type the cleaned tail — we already spoke the original.
  const startAt = Math.max(state.cursor, state.highWaterMark);
  if (startAt >= buffer.length) return "";
  const tail = buffer.slice(startAt);

  // If the tail contains an UNCLOSED thinking block, treat the position of
  // that open tag as the effective end of the scannable region — we never
  // emit content past an unclosed thinking block (the model is still
  // reasoning; once it closes, the server's content_replace will strip the
  // block and our hwm guard prevents replay).
  const unclosedAt = findUnclosedThinkingStart(tail);
  const scannable = unclosedAt === null ? tail : tail.slice(0, unclosedAt);

  // Find the last sentence end in the scannable region. We ship everything
  // up to and including that end; what follows is the in-progress sentence
  // and stays in reserve.
  let lastEnd = -1;
  for (const match of scannable.matchAll(SENTENCE_END_RE)) {
    const localEnd = (match.index ?? 0) + match[0].length;
    const absoluteEnd = startAt + localEnd;
    const periodPos = (match.index ?? 0) + match[0].length - 1;
    // Reject multi-dot ellipses ("..", "...", etc.) — continuations, not ends.
    const matched = match[0];
    const onlyDots = /^\.{2,}["'”’)\]}]?$/.test(matched);
    if (onlyDots) continue;
    if (endsWithAbbreviation(scannable, periodPos)) continue;
    lastEnd = absoluteEnd;
  }

  if (lastEnd === -1) return "";

  // Strip any CLOSED thinking blocks from the emitted text. The cursor still
  // advances over the original byte positions (so we don't reprocess), but
  // the TTS layer never sees the thinking content.
  const rawSlice = buffer.slice(startAt, lastEnd);
  const cleanSlice = stripClosedThinkingBlocks(rawSlice).trim();
  state.cursor = lastEnd;
  state.highWaterMark = lastEnd;
  return cleanSlice;
}

/**
 * Called once streaming has ended — return whatever is left in the buffer
 * after the last sentence boundary. Updates the cursor to the buffer end.
 */
export function extractRemainder(buffer: string, state: ChunkerState): string {
  if (buffer.length < state.cursor) {
    state.cursor = buffer.length;
  }
  const startAt = Math.max(state.cursor, state.highWaterMark);
  if (startAt >= buffer.length) {
    state.cursor = buffer.length;
    state.highWaterMark = buffer.length;
    return "";
  }
  // Drop everything from any UNCLOSED thinking block onward — if the stream
  // ended with the model still inside a thinking block, the tail is partial
  // reasoning we should never speak.
  const tail = buffer.slice(startAt);
  const unclosedAt = findUnclosedThinkingStart(tail);
  const usable = unclosedAt === null ? tail : tail.slice(0, unclosedAt);
  // Strip any CLOSED thinking blocks from the usable tail too.
  const remainder = stripClosedThinkingBlocks(usable).trim();
  state.cursor = buffer.length;
  state.highWaterMark = buffer.length;
  return remainder;
}
