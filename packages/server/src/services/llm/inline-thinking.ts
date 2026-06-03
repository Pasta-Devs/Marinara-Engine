// Matches the opening of an XML-style thinking tag.
// Tolerant of:
//   - All three tag name variants: <think>, <thinking>, <thought>
//   - Arbitrary attributes:       <thinking type="internal" …>
//   - Leading whitespace / blank lines before the tag
//   - A single optional trailing newline directly after the `>`
const XML_THINKING_OPEN_RE = /^[ \t\r\n]*<(?:think|thinking|thought)(?:\s[^>]*)?>[ \t]*(?:\r?\n)?/i;

// Matches ANY XML-style thinking close tag, regardless of which variant was
// used to open the block.  This makes <think>…</thinking> round-trip cleanly.
const XML_THINKING_CLOSE_RE = /<\/(?:think|thinking|thought)\s*>/i;

const PIPE_THINKING_BLOCK_RE = /^(\s*)<\|think\|>([\s\S]*?)<\|\/think\|>/i;
const CHANNEL_THINKING_BLOCK_RE = /^(\s*)<\|channel>thought\b([\s\S]*?)<channel\|>/i;

export interface LeadingThinkingExtraction {
  content: string;
  thinking: string;
  stripped: boolean;
}

/**
 * Extract leading inline reasoning blocks that some models emit instead of
 * returning provider-native thinking channels.
 *
 * Improvements over the naïve single-regex approach:
 *  - Supports `<think>`, `<thinking>`, and `<thought>` interchangeably,
 *    including mismatched open/close pairs (e.g. `<think>…</thinking>`).
 *  - Tolerates attributes on the opening tag (`<thinking type="internal">`).
 *  - Handles an orphan closing tag (no matching open tag) by treating all
 *    preceding text as thinking content and everything after it as content.
 *  - Never leaves `content` empty when the model produced visible text
 *    after the final closing tag.
 */
export function extractLeadingThinkingBlocks(text: string): LeadingThinkingExtraction {
  let remaining = text;
  let stripped = false;
  const chunks: string[] = [];

  while (true) {
    // ── XML thinking blocks ──────────────────────────────────────────────────
    // Step 1: check for an opening tag at the current position.
    const openMatch = remaining.match(XML_THINKING_OPEN_RE);
    if (openMatch) {
      const afterOpen = remaining.slice(openMatch[0].length);
      const closeMatch = afterOpen.match(XML_THINKING_CLOSE_RE);

      if (closeMatch && typeof closeMatch.index === "number") {
        // Happy path: we have both an open and a close tag.
        const thinkingContent = afterOpen.slice(0, closeMatch.index).trimEnd();
        if (thinkingContent) chunks.push(thinkingContent);
        remaining = afterOpen.slice(closeMatch.index + closeMatch[0].length).trimStart();
        stripped = true;
        continue;
      }

      // Open tag found but no close tag in the remainder.  The model either
      // truncated mid-reasoning or the closing tag arrived in a previous
      // accumulation pass.  Do not consume the text — leave it as content so
      // the user sees something rather than an empty bubble.
      break;
    }

    // ── Pipe-style thinking blocks ───────────────────────────────────────────
    const pipeMatch = remaining.match(PIPE_THINKING_BLOCK_RE);
    if (pipeMatch) {
      stripped = true;
      const thinking = pipeMatch[2]?.trim();
      if (thinking) chunks.push(thinking);
      remaining = remaining.slice(pipeMatch[0].length).trimStart();
      continue;
    }

    // ── Channel thinking blocks ──────────────────────────────────────────────
    const channelMatch = remaining.match(CHANNEL_THINKING_BLOCK_RE);
    if (channelMatch) {
      stripped = true;
      const thinking = channelMatch[2]?.trim();
      if (thinking) chunks.push(thinking);
      remaining = remaining.slice(channelMatch[0].length).trimStart();
      continue;
    }

    // ── Orphan closing tag ───────────────────────────────────────────────────
    // A closing tag with no matching open tag in the current buffer can occur
    // when the opening tag was injected as an assistant prefill or arrived in
    // an earlier streaming accumulation window.  Treat everything before the
    // closing tag as thinking content and everything after it as content.
    // Only attempt this once (when stripped=false) so we don't loop endlessly.
    if (!stripped) {
      const closeMatch = remaining.match(XML_THINKING_CLOSE_RE);
      if (closeMatch && typeof closeMatch.index === "number") {
        const beforeClose = remaining.slice(0, closeMatch.index).trimEnd();
        const afterClose = remaining.slice(closeMatch.index + closeMatch[0].length).trimStart();
        if (beforeClose) chunks.push(beforeClose);
        remaining = afterClose;
        stripped = true;
        // Orphan handling is a one-shot pass; don't keep looping.
      }
    }

    break;
  }

  return {
    content: remaining,
    thinking: chunks.join("\n\n"),
    stripped,
  };
}

