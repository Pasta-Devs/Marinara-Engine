// ──────────────────────────────────────────────
// Dice placeholders — `[[roll: <notation>]]`
//
// The Game Master writes a number it never sees: "the axe bites deep for
// [[roll: 2d6+3]] damage". After the turn is written, the engine rolls each
// placeholder, substitutes the total into the saved narration, and records the roll.
// The model committed the sentence before a die existed, so there is nothing for it
// to steer and nothing to pre-throw.
//
// Two things in here are load-bearing and neither is obvious.
//
// 1. THE SCAN IS AN OPENER WALK, NOT A BOUNDED REGEX. A bounded regex cannot see the
//    malformed spans the contract promises to replace, and a span that is never
//    matched cannot be replaced with anything. Measured against a bounded pattern:
//    `[[roll: 1d6+<70 nines>]]` does not match at all, `[[roll: 2d6]` does not match
//    at all, and `[[roll: 2d6 [x]]]` matches short and leaves a stray `]` in the
//    prose. A survivor is then half-eaten rather than left visible: the shipped
//    unknown-tag strippers turn "for [[roll: 2d6+3]] damage" into "for [] damage".
//    So every opener produces a BOUNDED span, and every bounded span is replaced —
//    with a number when the body reads, and with a short visible notice when it does
//    not. Never with an invented number.
//
// 2. THE ROLLER IS INJECTED. This package must stay free of `node:crypto`, and the
//    engine rolls a placeholder with `crypto.randomInt` rather than `Math.random()`.
//    Same dependency-injection shape `resolveGameDiceRequests` already uses for its
//    own roller, for the same reason: a lane needs a scripted die.
//
// The 64-character cap is a REJECTION REASON inside the pass, not a matching
// precondition. That distinction is the whole difference between a contract that
// holds and one that only looks like it does.
// ──────────────────────────────────────────────

import { clampParsedDiceToLimits, parseDiceNotation, type ParsedDiceNotation } from "./dice-notation.js";

/**
 * The opener, as written. A single-bracket `[roll:` is Roleplay's own command and is
 * never claimed here. Exported because the stream filter has to recognise a PARTIAL
 * opener mid-token, which is a prefix test on this string rather than a scan.
 */
export const ROLL_PLACEHOLDER_OPENER = "[[roll:";

/** Longest body the pass will read. Past this the placeholder is refused, not truncated. */
export const PLACEHOLDER_BODY_MAX = 64;

/**
 * What a refused placeholder becomes. No bracket, no colon, no brace, so it survives
 * every stripper, the segment editor and the prompt leaf as ordinary prose.
 */
export const ROLL_UNAVAILABLE_TEXT = "(roll unavailable)";

/** Why the engine would not read a placeholder. Every one of these becomes the notice. */
export type RollPlaceholderRefusal =
  /** No `]]` before the line ended, so the span was bounded by the line or the cap. */
  | "unterminated"
  /** The body ran past `PLACEHOLDER_BODY_MAX`. */
  | "over-long"
  /** The body carried a `]`, so the span the model wrote is not the span it meant. */
  | "closing-bracket"
  /** Not one NdM term with at most one flat modifier and at most one sheet name. */
  | "notation"
  /** A sheet name the chat's loaded modifiers do not carry. Refused, never defaulted to zero. */
  | "unresolved-name";

/** One bounded `[[roll:` span, whether or not its body can be read. */
export interface RollPlaceholderSpan {
  /** Offset of the `[[` in the scanned content. */
  start: number;
  /** Offset one past the end of the bounded span. */
  end: number;
  /** The span exactly as the model wrote it, for the audit log. */
  raw: string;
  /** The span's interior, trimmed. */
  body: string;
  /** Set when the scan alone already proves the span cannot be read. */
  refusal: RollPlaceholderRefusal | null;
}

/** One readable body: the dice term, plus at most one sheet name to ask the chat about. */
export interface ParsedRollPlaceholderBody {
  /** The NdM term with its flat modifier folded in, validated by the shared grammar. */
  dice: ParsedDiceNotation;
  /** The single sheet name written after the dice term, when there was one. */
  sheetName: string | null;
  /** `-STR` subtracts what `+STR` would add. */
  sheetSign: 1 | -1;
}

/** What a chat's sheet contributes for one name, and which form supplied it. */
export interface RollPlaceholderSheetModifier {
  /** Already summed: the attribute modifier alone, or a skill bonus plus its governing attribute. */
  value: number;
  source: "attribute" | "skill";
}

export interface RollPlaceholderDeps {
  /** One die of `sides` faces. The engine passes its `crypto.randomInt` supplier. */
  nextValue: (sides: number) => number;
  /**
   * Resolve a sheet name to a modifier, or `null` when the chat cannot.
   *
   * Returning `null` refuses the placeholder. It deliberately does not default to
   * zero: a placeholder's name is only a modifier source, so defaulting it would add
   * a number nobody asked for to a sentence the player reads as fact. Omit the
   * callback entirely when the chat carries no names at all.
   */
  resolveSheetName?: (name: string) => RollPlaceholderSheetModifier | null;
}

/**
 * One substituted placeholder: what was rolled, and where the number landed.
 *
 * Saved out of band, because the content itself carries a bare number so the prompt
 * leaf and the transcript both read as prose.
 */
export interface GameDicePlaceholderRecord {
  /** The body as the model wrote it, for audit: "2d6+3", "1d8+STR". */
  raw: string;
  /** The notation actually thrown, after clamping and sheet resolution, with the modifier total. */
  notation: string;
  rolls: number[];
  /** The summed modifier: the flat term plus whatever the sheet name resolved to. */
  modifier: number;
  /**
   * Which form supplied the modifier, so a hover can name its source. A body carrying
   * both a flat number and a sheet name reports the sheet form; `raw` carries the rest.
   */
  modifierSource: "flat" | "attribute" | "skill" | "none";
  total: number;
  /** The substituted text, as written into content. */
  text: string;
  /** Character offset of `text` in the substituted content. */
  index: number;
}

/** One placeholder the pass refused, for the log line and the turn notice. */
export interface RollPlaceholderRefusalRecord {
  /** The bounded span, verbatim. */
  raw: string;
  reason: RollPlaceholderRefusal;
  /** The name that did not resolve, when that was the reason. */
  name?: string;
}

/** One notation the shared ceilings trimmed. `500d6` is thrown, and recorded, as `100d6`. */
export interface RollPlaceholderClamp {
  requested: string;
  thrown: string;
}

export interface RollPlaceholderPass {
  content: string;
  changed: boolean;
  records: GameDicePlaceholderRecord[];
  refusals: RollPlaceholderRefusalRecord[];
  clamps: RollPlaceholderClamp[];
}

/** Fresh each time: a `/g` regex carries `lastIndex`, and these are walked, not tested once. */
function createOpenerPattern(): RegExp {
  return /\[\[roll:/gi;
}

/** Whether the content is worth walking at all. */
export function hasRollPlaceholder(content: string): boolean {
  return createOpenerPattern().test(content);
}

/**
 * Bound one span, starting just past its opener.
 *
 *   1. The first `]]` before the next line break closes it. A placeholder never spans
 *      a line.
 *   2. Any run of `]` straight after that is swallowed too, so `[[roll: 2d6 [x]]]` is
 *      consumed whole and leaves no stray bracket in the prose.
 *   3. With no `]]` before the line break, the span ends at the line break or at
 *      `PLACEHOLDER_BODY_MAX` characters past the opener, whichever comes first.
 *
 * The cost of rule 3 is stated rather than hidden: an unterminated opener can take a
 * few words of that line's prose with it, bounded by the line end or the cap. That is
 * the price of never leaving a raw span in saved content, it is only reachable when
 * the model wrote a malformed tag, and the raw span is logged verbatim.
 */
/**
 * The two positions a bound depends on, remembered across openers. Both only ever move
 * right as the walk does, so a search that found nothing ahead of one opener has found
 * nothing ahead of the next either: without this memory a line of unterminated openers
 * would re-scan its whole suffix from every one of them, which is quadratic.
 */
interface PlaceholderScanMemory {
  /** End of the line the walk is on, valid while the walk is still on it. */
  lineEnd: number;
  /** The next `]]` at or past the last search, `-1` when there is none anywhere ahead, `-2` when unknown. */
  closer: number;
}

function findLineEnd(content: string, from: number): number {
  for (let index = from; index < content.length; index += 1) {
    const char = content[index];
    if (char === "\n" || char === "\r") return index;
  }
  return content.length;
}

function boundPlaceholderSpan(
  content: string,
  bodyStart: number,
  memory: PlaceholderScanMemory,
): { end: number; bodyEnd: number; closed: boolean } {
  if (bodyStart > memory.lineEnd) memory.lineEnd = findLineEnd(content, bodyStart);
  if (memory.closer === -2 || (memory.closer !== -1 && memory.closer < bodyStart)) {
    memory.closer = content.indexOf("]]", bodyStart);
  }
  const closer = memory.closer;
  if (closer !== -1 && closer < memory.lineEnd) {
    let end = closer + 2;
    while (content[end] === "]") end += 1;
    return { end, bodyEnd: closer, closed: true };
  }
  const end = Math.min(memory.lineEnd, bodyStart + PLACEHOLDER_BODY_MAX);
  return { end, bodyEnd: end, closed: false };
}

/** Walk every `[[roll:` opener and bound its span. Malformed spans are found, not skipped. */
export function scanRollPlaceholders(content: string): RollPlaceholderSpan[] {
  const opener = createOpenerPattern();
  const spans: RollPlaceholderSpan[] = [];
  const memory: PlaceholderScanMemory = { lineEnd: -1, closer: -2 };
  let match: RegExpExecArray | null;
  while ((match = opener.exec(content)) !== null) {
    const start = match.index;
    const bodyStart = start + match[0].length;
    const bounded = boundPlaceholderSpan(content, bodyStart, memory);
    const body = content.slice(bodyStart, bounded.bodyEnd).trim();
    let refusal: RollPlaceholderRefusal | null = null;
    if (!bounded.closed) refusal = "unterminated";
    else if (body.length > PLACEHOLDER_BODY_MAX) refusal = "over-long";
    else if (body.includes("]")) refusal = "closing-bracket";
    spans.push({ start, end: bounded.end, raw: content.slice(start, bounded.end), body, refusal });
    // A nested opener sits inside a span that was already consumed, so the walk resumes
    // past the whole span rather than inside it.
    opener.lastIndex = bounded.end;
  }
  return spans;
}

/** The dice term at the head of a body: `2d6`, `d20`. Nothing repeated after it. */
const PLACEHOLDER_HEAD_PATTERN = /^(\d*)d(\d+)/i;
/** A flat term is digits only; its sign is carried separately. */
const PLACEHOLDER_FLAT_TERM = /^\d+$/;
/** A sheet name: a word, possibly several ("Sleight of Hand"). Never a bracket, a colon or a sign. */
const PLACEHOLDER_NAME_TERM = /^[A-Za-z][A-Za-z0-9 _']*$/;

/**
 * Whether a sheet name is one a placeholder could ever carry. The prompt advertises only
 * names that pass this, so a name the grammar would refuse (a bracket, a newline, a sign)
 * is never offered and can never reshape the block it is printed into.
 */
export function isRollPlaceholderName(name: string): boolean {
  return PLACEHOLDER_NAME_TERM.test(name);
}

/**
 * Split what follows the dice term into signed terms, or return null when it is not a
 * run of them. Whitespace around a sign is tolerated; a term runs to the next sign.
 *
 * A character walk rather than a repeated regex group on purpose. A group of the shape
 * `(?:\s*[+-]\s*[^+-]*)*` can divide one run of spaces between its iterations in
 * exponentially many ways while failing a body it is about to refuse, and a body is
 * model-written text. The walk reads every character once.
 */
function readSignedTerms(tail: string): Array<{ sign: "+" | "-"; value: string }> | null {
  const terms: Array<{ sign: "+" | "-"; value: string }> = [];
  let rest = tail.trim();
  while (rest.length > 0) {
    const sign = rest[0];
    if (sign !== "+" && sign !== "-") return null;
    let end = 1;
    while (end < rest.length && rest[end] !== "+" && rest[end] !== "-") end += 1;
    const value = rest.slice(1, end).trim();
    if (value.length === 0) return null;
    terms.push({ sign, value });
    rest = rest.slice(end);
  }
  return terms;
}

/**
 * Read one placeholder body.
 *
 * One NdM term with an optional flat modifier — exactly the shared dice grammar — then
 * at most one flat number and at most one sheet name, in either order:
 * `2d6+3`, `1d8+STR`, `2d6+3+STR` and `2d6+STR+3` are all legal.
 *
 * Two different dice in one placeholder (`1d8+1d6`) is not supported, and is refused
 * here rather than given a second grammar: the whole point of the shared notation
 * module is that this codebase has one. The model writes two placeholders.
 */
export function parseRollPlaceholderBody(body: string): ParsedRollPlaceholderBody | null {
  const trimmed = body.trim();
  const head = PLACEHOLDER_HEAD_PATTERN.exec(trimmed);
  if (!head) return null;
  const countText = head[1] ?? "";
  const sidesText = head[2]!;
  const terms = readSignedTerms(trimmed.slice(head[0].length));
  if (!terms) return null;

  let flatText: string | null = null;
  let flatSign = "+";
  let sheetName: string | null = null;
  let sheetSign: 1 | -1 = 1;
  for (const { sign, value } of terms) {
    if (PLACEHOLDER_FLAT_TERM.test(value)) {
      // At most one flat number: two of them is arithmetic this grammar does not do.
      if (flatText !== null) return null;
      flatText = value;
      flatSign = sign;
    } else if (PLACEHOLDER_NAME_TERM.test(value)) {
      // At most one sheet name, for the same reason.
      if (sheetName !== null) return null;
      sheetName = value;
      sheetSign = sign === "-" ? -1 : 1;
    } else {
      return null;
    }
  }

  // Back through the shared grammar, so a placeholder is held to exactly the bounds
  // every other roll in the engine is: at least one die, at least one face, and a
  // total that stays an exact integer at both ends of what the notation could throw.
  const dice = parseDiceNotation(`${countText}d${sidesText}${flatText === null ? "" : `${flatSign}${flatText}`}`);
  if (!dice) return null;
  return { dice, sheetName, sheetSign };
}

function signedModifier(modifier: number): string {
  if (modifier === 0) return "";
  return `${modifier > 0 ? "+" : "-"}${Math.abs(modifier)}`;
}

/**
 * Roll every readable placeholder and replace every unreadable one.
 *
 * The walk splices in reading order over one cursor, so the prose between spans is
 * kept byte for byte and each record's `index` is its offset in the text this returns
 * rather than in the text that went in.
 *
 * An oversized notation is CLAMPED rather than refused, which is this path's shipped
 * policy: `[[roll: 500d6]]` substitutes a `100d6` total and the clamp is reported so
 * the caller can log it. The record names the dice actually thrown, never the ones
 * asked for.
 */
export function resolveRollPlaceholders(content: string, deps: RollPlaceholderDeps): RollPlaceholderPass {
  const spans = scanRollPlaceholders(content);
  const records: GameDicePlaceholderRecord[] = [];
  const refusals: RollPlaceholderRefusalRecord[] = [];
  const clamps: RollPlaceholderClamp[] = [];
  if (spans.length === 0) return { content, changed: false, records, refusals, clamps };

  let result = "";
  let cursor = 0;
  for (const span of spans) {
    result += content.slice(cursor, span.start);
    cursor = span.end;

    const refuse = (reason: RollPlaceholderRefusal, name?: string) => {
      refusals.push({ raw: span.raw, reason, ...(name === undefined ? {} : { name }) });
      result += ROLL_UNAVAILABLE_TEXT;
    };

    if (span.refusal) {
      refuse(span.refusal);
      continue;
    }
    const parsed = parseRollPlaceholderBody(span.body);
    if (!parsed) {
      refuse("notation");
      continue;
    }

    let sheet: RollPlaceholderSheetModifier | null = null;
    if (parsed.sheetName !== null) {
      sheet = deps.resolveSheetName?.(parsed.sheetName) ?? null;
      if (!sheet) {
        refuse("unresolved-name", parsed.sheetName);
        continue;
      }
    }

    const thrown = clampParsedDiceToLimits(parsed.dice);
    if (thrown.count !== parsed.dice.count || thrown.sides !== parsed.dice.sides) {
      clamps.push({ requested: parsed.dice.notation, thrown: thrown.notation });
    }

    const rolls: number[] = [];
    for (let die = 0; die < thrown.count; die += 1) {
      const value = deps.nextValue(thrown.sides);
      // The one thing this module may never do is write a number nobody rolled. A
      // supplier that hands back anything but a face takes the whole pass down to its
      // caller's fallback, where every span becomes the notice, rather than putting
      // "NaN damage" into a sentence the player reads as fact.
      if (!Number.isInteger(value) || value < 1 || value > thrown.sides) {
        throw new RangeError(`A d${thrown.sides} supplier returned ${String(value)}`);
      }
      rolls.push(value);
    }

    const modifier = thrown.modifier + (sheet ? parsed.sheetSign * sheet.value : 0);
    const total = rolls.reduce((sum, roll) => sum + roll, 0) + modifier;
    const text = String(total);
    records.push({
      raw: span.body,
      notation: `${thrown.dice}${signedModifier(modifier)}`,
      rolls,
      modifier,
      modifierSource: sheet ? sheet.source : modifier !== 0 ? "flat" : "none",
      total,
      text,
      index: result.length,
    });
    result += text;
  }
  result += content.slice(cursor);
  return { content: result, changed: true, records, refusals, clamps };
}

/**
 * Replace every `[[roll:` span with the notice, reading none of them.
 *
 * The failure path: used when the pass itself could not run, so that no raw span
 * reaches saved content for a downstream stripper to half-eat.
 */
export function replaceRollPlaceholdersWithNotice(content: string): {
  content: string;
  changed: boolean;
  spans: string[];
} {
  const spans = scanRollPlaceholders(content);
  if (spans.length === 0) return { content, changed: false, spans: [] };
  let result = "";
  let cursor = 0;
  for (const span of spans) {
    result += content.slice(cursor, span.start) + ROLL_UNAVAILABLE_TEXT;
    cursor = span.end;
  }
  result += content.slice(cursor);
  return { content: result, changed: true, spans: spans.map((span) => span.raw) };
}
