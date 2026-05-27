const SENTENCE_END_RE = /[.!?\u2026\u3002\uff01\uff1f]+(?:["'\u201d\u2019\u00bb\u300d\u300f)\]}]+)?(?=\s|$)/gu;

const OPEN_QUOTES = new Set(['"', "\u201c", "\u00ab", "\u300c", "\u300e"]);
const CLOSE_QUOTES_FOR: Record<string, string> = {
  '"': '"',
  "\u201c": "\u201d",
  "\u00ab": "\u00bb",
  "\u300c": "\u300d",
  "\u300e": "\u300f",
};

const ABBREVIATIONS = new Set(["mr", "mrs", "ms", "dr", "st", "prof", "sr", "jr", "vs", "etc", "ie", "eg", "fig", "no"]);

const THINKING_BLOCK_RE = /<(think|thinking|thought)\b[^>]*>[\s\S]*?<\/\1>/gi;
const SPECIAL_THINKING_BLOCK_RES = [
  { open: /<\|think\|>/i, close: /<\|\/think\|>/i },
  { open: /<\|channel>thought\b/i, close: /<channel\|>/i },
];
const THINKING_OPEN_TAG_RE = /<(think|thinking|thought)\b[^>]*>/i;

export interface ChunkerState {
  cursor: number;
  highWaterMark: number;
}

export function createChunkerState(): ChunkerState {
  return { cursor: 0, highWaterMark: 0 };
}

function endsWithAbbreviation(text: string, periodIndex: number): boolean {
  let start = periodIndex;
  while (start > 0 && /[A-Za-z]/.test(text[start - 1]!)) start -= 1;
  const token = text.slice(start, periodIndex).toLowerCase();
  return token.length > 0 && ABBREVIATIONS.has(token);
}

function stripClosedThinkingBlocks(text: string): string {
  let output = text.replace(THINKING_BLOCK_RE, "");
  for (const { open, close } of SPECIAL_THINKING_BLOCK_RES) {
    let openMatch = output.match(open);
    while (openMatch && openMatch.index !== undefined) {
      const rest = output.slice(openMatch.index + openMatch[0].length);
      const closeMatch = rest.match(close);
      if (!closeMatch || closeMatch.index === undefined) break;
      const blockEnd = openMatch.index + openMatch[0].length + closeMatch.index + closeMatch[0].length;
      output = output.slice(0, openMatch.index) + output.slice(blockEnd);
      openMatch = output.match(open);
    }
  }
  return output.replace(/\s+/g, " ");
}

function maskClosedThinkingBlocks(text: string): string {
  let masked = text.replace(THINKING_BLOCK_RE, (match) => " ".repeat(match.length));
  for (const { open, close } of SPECIAL_THINKING_BLOCK_RES) {
    let openMatch = masked.match(open);
    while (openMatch && openMatch.index !== undefined) {
      const rest = masked.slice(openMatch.index + openMatch[0].length);
      const closeMatch = rest.match(close);
      if (!closeMatch || closeMatch.index === undefined) break;
      const blockLength = openMatch[0].length + closeMatch.index + closeMatch[0].length;
      masked = masked.slice(0, openMatch.index) + " ".repeat(blockLength) + masked.slice(openMatch.index + blockLength);
      openMatch = masked.match(open);
    }
  }
  return masked;
}

function findUnclosedThinkingStart(tail: string): number | null {
  const masked = maskClosedThinkingBlocks(tail);
  const xmlMatch = masked.match(THINKING_OPEN_TAG_RE);
  if (xmlMatch && xmlMatch.index !== undefined) return xmlMatch.index;
  for (const { open } of SPECIAL_THINKING_BLOCK_RES) {
    const specialMatch = masked.match(open);
    if (specialMatch && specialMatch.index !== undefined) return specialMatch.index;
  }
  return null;
}

function isEllipsisEndCandidate(matchText: string): boolean {
  return /^\.{2,}["'\u201d\u2019\u00bb\u300d\u300f)\]}]*$/.test(matchText);
}

function lastSentencePunctuationIndex(matchText: string): number {
  return Math.max(
    matchText.lastIndexOf("."),
    matchText.lastIndexOf("!"),
    matchText.lastIndexOf("?"),
    matchText.lastIndexOf("\u2026"),
    matchText.lastIndexOf("\u3002"),
    matchText.lastIndexOf("\uff01"),
    matchText.lastIndexOf("\uff1f"),
  );
}

function isInsideUnclosedQuote(text: string, pos: number): boolean {
  let asciiOpen = false;
  const pairStack: string[] = [];

  for (let index = 0; index < pos; index += 1) {
    const char = text[index]!;
    if (char === '"' && text[index + 1] === '"') {
      asciiOpen = !asciiOpen;
      index += 1;
      continue;
    }
    if (char === '"') {
      asciiOpen = !asciiOpen;
      continue;
    }
    if (OPEN_QUOTES.has(char)) {
      pairStack.push(CLOSE_QUOTES_FOR[char]!);
      continue;
    }
    if (pairStack.length > 0 && char === pairStack[pairStack.length - 1]) {
      pairStack.pop();
    }
  }

  return asciiOpen || pairStack.length > 0;
}

export function extractNewSentences(buffer: string, state: ChunkerState): string {
  if (buffer.length < state.cursor) {
    state.cursor = buffer.length;
  }

  const startAt = Math.max(state.cursor, state.highWaterMark);
  if (startAt >= buffer.length) return "";

  const tail = buffer.slice(startAt);
  const unclosedThinkingStart = findUnclosedThinkingStart(tail);
  const scannable = unclosedThinkingStart === null ? tail : tail.slice(0, unclosedThinkingStart);

  let lastEnd = -1;
  SENTENCE_END_RE.lastIndex = 0;
  for (const match of scannable.matchAll(SENTENCE_END_RE)) {
    const matchText = match[0];
    if (isEllipsisEndCandidate(matchText)) continue;

    const localIndex = match.index ?? 0;
    const punctuationOffset = lastSentencePunctuationIndex(matchText);
    const punctuationIndex = punctuationOffset >= 0 ? localIndex + punctuationOffset : localIndex + matchText.length - 1;
    if (scannable[punctuationIndex] === "." && endsWithAbbreviation(scannable, punctuationIndex)) continue;

    const absoluteEnd = startAt + localIndex + matchText.length;
    if (isInsideUnclosedQuote(buffer, absoluteEnd)) continue;

    lastEnd = absoluteEnd;
  }

  if (lastEnd === -1) return "";

  const cleanSlice = stripClosedThinkingBlocks(buffer.slice(startAt, lastEnd)).trim();
  state.cursor = lastEnd;
  state.highWaterMark = lastEnd;
  return cleanSlice;
}

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

  const tail = buffer.slice(startAt);
  const unclosedThinkingStart = findUnclosedThinkingStart(tail);
  const usableTail = unclosedThinkingStart === null ? tail : tail.slice(0, unclosedThinkingStart);
  const remainder = stripClosedThinkingBlocks(usableTail).trim();
  state.cursor = buffer.length;
  state.highWaterMark = buffer.length;
  return remainder;
}
