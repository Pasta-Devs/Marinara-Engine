export const QUOTE_FORMATS = ["straight", "typographic"] as const;
export type QuoteFormat = (typeof QUOTE_FORMATS)[number];

const STRAIGHT_DOUBLE_QUOTE = '"';
const STRAIGHT_SINGLE_QUOTE = "'";
const LEFT_DOUBLE_QUOTE = "\u201c";
const RIGHT_DOUBLE_QUOTE = "\u201d";
const LEFT_SINGLE_QUOTE = "\u2018";
const RIGHT_SINGLE_QUOTE = "\u2019";

const DOUBLE_QUOTE_RE = /["\u201c\u201d\u201e\u201f]/g;
const SINGLE_QUOTE_RE = /['\u2018\u2019\u201a\u201b]/g;
const QUOTE_RE = /["'\u2018\u2019\u201a\u201b\u201c\u201d\u201e\u201f]/;
const PROTECTED_TEXT_RE = /```[\s\S]*?```|`[^`\n]*`|<\/?[A-Za-z][^<>]*>/g;

export function normalizeQuoteFormat(value: unknown): QuoteFormat {
  return value === "typographic" ? "typographic" : "straight";
}

function isLetterOrNumber(value?: string): boolean {
  return !!value && /[\p{L}\p{N}]/u.test(value);
}

function isOpeningContext(previous?: string): boolean {
  return !previous || /[\s([{<]/.test(previous) || previous === "\u2014" || previous === "\u2013";
}

function formatDoubleQuote(previous?: string, next?: string): string {
  if (!next) return previous ? RIGHT_DOUBLE_QUOTE : LEFT_DOUBLE_QUOTE;
  if (/\s/.test(next)) return RIGHT_DOUBLE_QUOTE;
  return isOpeningContext(previous) ? LEFT_DOUBLE_QUOTE : RIGHT_DOUBLE_QUOTE;
}

function formatSingleQuote(previous?: string, next?: string): string {
  if (isLetterOrNumber(previous) && isLetterOrNumber(next)) return RIGHT_SINGLE_QUOTE;
  if (!next) return previous ? RIGHT_SINGLE_QUOTE : LEFT_SINGLE_QUOTE;
  if (/\s/.test(next)) return RIGHT_SINGLE_QUOTE;
  return isOpeningContext(previous) ? LEFT_SINGLE_QUOTE : RIGHT_SINGLE_QUOTE;
}

function toStraightQuotes(value: string): string {
  return value.replace(DOUBLE_QUOTE_RE, STRAIGHT_DOUBLE_QUOTE).replace(SINGLE_QUOTE_RE, STRAIGHT_SINGLE_QUOTE);
}

function toTypographicQuotes(value: string): string {
  const straight = toStraightQuotes(value);
  let result = "";

  for (let index = 0; index < straight.length; index++) {
    const current = straight[index];
    if (current === STRAIGHT_DOUBLE_QUOTE) {
      result += formatDoubleQuote(straight[index - 1], straight[index + 1]);
      continue;
    }
    if (current === STRAIGHT_SINGLE_QUOTE) {
      result += formatSingleQuote(straight[index - 1], straight[index + 1]);
      continue;
    }
    result += current ?? "";
  }

  return result;
}

function formatUnprotectedText(value: string, format: QuoteFormat): string {
  return format === "typographic" ? toTypographicQuotes(value) : toStraightQuotes(value);
}

export function formatTextQuotes(value: string, format: QuoteFormat): string {
  if (!QUOTE_RE.test(value)) return value;

  let result = "";
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  PROTECTED_TEXT_RE.lastIndex = 0;

  while ((match = PROTECTED_TEXT_RE.exec(value)) !== null) {
    result += formatUnprotectedText(value.slice(lastIndex, match.index), format);
    result += match[0];
    lastIndex = match.index + match[0].length;
  }

  result += formatUnprotectedText(value.slice(lastIndex), format);
  return result;
}
