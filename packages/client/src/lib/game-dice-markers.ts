// ──────────────────────────────────────────────
// Game: inline markers for one-request dice numbers
//
// A `[[roll: 2d6+3]]` placeholder is substituted server-side, so what the transcript
// carries is a BARE NUMBER — "the axe bites deep for 14 damage". That is deliberate:
// the prompt leaf and the saved message both have to read as prose, and a marker baked
// into the content would change how an already-saved transcript reads. The marker is
// therefore carried out of band, on the message extra, and reattached here at render
// time.
//
// Reattaching is the whole problem this module solves, and it is not a lookup.
//
//   - THE OFFSET CANNOT BE TRUSTED, SO IT IS NEVER READ. `stripGmTags` removes tags ahead
//     of the number and the segment editor rewrites content wholesale, so a record's
//     `index` says where the number was when it was substituted, not where it is now.
//     The narration is also split into segments before it is rendered, so the offset is
//     in message coordinates while the text here is one segment of it, and every segment
//     is handed the whole message's records. An offset compared against that text would
//     let a record from one segment claim an equal number in another. `index` stays on
//     the record as an audit fact and nothing here uses it to choose.
//   - A WRONG MATCH IS WORSE THAN NO MATCH. Marking the wrong word would attach a real
//     roll's breakdown to a number nobody rolled. So the rule is conservative: a record
//     marks a number only when the text says unambiguously which occurrence it is, and
//     it degrades to the plain number otherwise. The number is still true and the
//     session log still carries the roll, so nothing is lost by declining.
//
// Nothing here invents a number, and nothing here changes the text it is given except
// to wrap a number that is already in it.
// ──────────────────────────────────────────────

import type { GameDicePlaceholderRecord } from "@marinara-engine/shared";

/** The wrapper class the narration stylesheet paints. */
export const GAME_DICE_MARKER_CLASS = "game-dice-marker";

/** One record, reattached to the number it produced. */
export interface GameDiceMarkerMatch {
  record: GameDicePlaceholderRecord;
  /** Offset of the number in the text that was searched. */
  start: number;
  /** Offset one past the number. */
  end: number;
}

function isDigit(char: string | undefined): boolean {
  return char !== undefined && char >= "0" && char <= "9";
}

/**
 * Spans a marker must never open inside: a bracket command and an HTML-ish tag.
 *
 * The narration formatter reads `[skill_check: ... total="14"]` and `[dice: 2d6 = 9]`
 * as whole tags and turns them into badges. A `<span>` opened in the middle of one
 * would break that read, and the number inside a tag is not the prose number anyway.
 * Both forms are single-line by construction, so the scan stops at a line break.
 */
function findProtectedRanges(text: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  for (const [open, close] of [
    ["[", "]"],
    ["<", ">"],
  ] as Array<[string, string]>) {
    let cursor = 0;
    for (;;) {
      const start = text.indexOf(open, cursor);
      if (start === -1) break;
      let end = -1;
      for (let index = start + 1; index < text.length; index += 1) {
        const char = text[index]!;
        if (char === "\n" || char === "\r") break;
        if (char === close) {
          end = index;
          break;
        }
      }
      if (end === -1) {
        cursor = start + 1;
        continue;
      }
      ranges.push([start, end + 1]);
      cursor = end + 1;
    }
  }
  return ranges;
}

/** Every standalone occurrence of `value`: a whole digit run, outside any protected span. */
function findStandaloneOccurrences(text: string, value: string, protectedRanges: Array<[number, number]>): number[] {
  if (!value) return [];
  const found: number[] = [];
  let cursor = 0;
  for (;;) {
    const at = text.indexOf(value, cursor);
    if (at === -1) return found;
    cursor = at + 1;
    const before = text[at - 1];
    const after = text[at + value.length];
    // Part of a larger numeric token, which a digit check alone misses: "1.43", "2,430"
    // and "-43" all contain a 43 that no record rolled. A separator counts only when a
    // digit sits on its far side, so "43." at the end of a sentence is still standalone.
    const insideNegative = !value.startsWith("-") && (before === "-" || before === "−");
    const afterSeparator = (before === "." || before === ",") && isDigit(text[at - 2]);
    const beforeSeparator = (after === "." || after === ",") && isDigit(text[at + value.length + 1]);
    if (isDigit(before) || isDigit(after) || insideNegative || afterSeparator || beforeSeparator) continue;
    if (protectedRanges.some(([start, end]) => at < end && at + value.length > start)) continue;
    found.push(at);
  }
}

/**
 * Reattach every record that can be reattached without guessing.
 *
 * A record matches when the text contains exactly one standalone occurrence of its
 * number and no other record rolled that same total. Several occurrences, or several
 * records that rolled the same total, are left unmarked: the record's offset is in
 * message coordinates and this text is one segment, so an offset cannot break the tie
 * without sometimes breaking it the wrong way.
 *
 * Returned in reading order, never overlapping.
 */
export function matchGameDicePlaceholders(
  text: string,
  records: readonly GameDicePlaceholderRecord[] | null | undefined,
): GameDiceMarkerMatch[] {
  if (!text || !records || records.length === 0) return [];
  const protectedRanges = findProtectedRanges(text);
  const shared = new Map<string, number>();
  for (const record of records) shared.set(record.text, (shared.get(record.text) ?? 0) + 1);

  const claimed = new Set<number>();
  const matches: GameDiceMarkerMatch[] = [];
  for (const record of records) {
    if (typeof record?.text !== "string" || !/^-?\d+$/.test(record.text)) continue;
    if ((shared.get(record.text) ?? 0) !== 1) continue;
    const occurrences = findStandaloneOccurrences(text, record.text, protectedRanges).filter((at) => !claimed.has(at));
    if (occurrences.length !== 1) continue;

    const chosen = occurrences[0]!;
    claimed.add(chosen);
    matches.push({ record, start: chosen, end: chosen + record.text.length });
  }
  return matches.sort((left, right) => left.start - right.start);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * The dice that made the total, in the shape the session log already uses:
 * `4 + 5 + 3` for a flat bonus, `4 + 5 − 1` for a penalty.
 */
export function formatGameDiceRolls(record: GameDicePlaceholderRecord): string {
  const rolls = Array.isArray(record.rolls) ? record.rolls : [];
  const dice = rolls.join(" + ");
  if (!record.modifier) return dice;
  return `${dice} ${record.modifier > 0 ? "+" : "−"} ${Math.abs(record.modifier)}`;
}

/** The modifier as a signed number, for the part of the hover that names its source. */
export function formatGameDiceModifier(record: GameDicePlaceholderRecord): string {
  if (!record.modifier) return "";
  return `${record.modifier > 0 ? "+" : "−"}${Math.abs(record.modifier)}`;
}

/**
 * Wrap every reattached number in a marker span carrying the breakdown as its title.
 *
 * `describe` is supplied by the caller so the breakdown can be localized; this module
 * stays free of the translation runtime and free of React, which is what lets a
 * regression lane drive it directly.
 *
 * Runs BEFORE the narration formatter, so the injected span goes through the same
 * sanitizer everything else does and the surrounding markdown is untouched.
 */
export function applyGameDiceMarkers(
  text: string,
  records: readonly GameDicePlaceholderRecord[] | null | undefined,
  describe: (record: GameDicePlaceholderRecord) => string,
): string {
  const matches = matchGameDicePlaceholders(text, records);
  if (matches.length === 0) return text;
  let result = "";
  let cursor = 0;
  for (const match of matches) {
    const title = escapeHtml(describe(match.record));
    result += text.slice(cursor, match.start);
    result += `<span class="${GAME_DICE_MARKER_CLASS}" title="${title}">${text.slice(match.start, match.end)}</span>`;
    cursor = match.end;
  }
  return result + text.slice(cursor);
}
