// ──────────────────────────────────────────────
// Skill-check tag reader — the one [skill_check:] parse
//
// The client parsed GM check tags and the server did
// not: it read `skill` and `dc` with its own regex and
// threw everything else away, so a tag carrying the
// player's own d20 or an advantage mode was re-rolled
// from scratch the moment the server resolved it.
// Both sides read through this module now, so what the
// GM wrote survives whichever side does the rolling.
// ──────────────────────────────────────────────

import type { SkillCheckResult } from "../types/game.js";
import { isWithinDiceLimits, parseDiceNotation } from "./dice-notation.js";

export interface SkillCheckTag {
  skill: string;
  dc: number;
  advantage?: boolean;
  disadvantage?: boolean;
  resolvedResult?: SkillCheckResult;
  /**
   * Player-submitted d20 echoed by the GM when a `[dice:1d20]` was rolled
   * before the check. Forwarded to the server resolver so the sheet's
   * attribute modifier is applied on top of the player's number.
   */
  preRolledD20?: number;
  /**
   * `resolution=` as the GM wrote it, lowercased, when they wrote one.
   *
   * Carried on **every** tag, including one whose numbers this reader refused
   * to vouch for, because an absent `resolvedResult` means only "these numbers
   * are not trustworthy" — never "roll a d20 for this". A resolver that cannot
   * see the declaration cannot tell a sparse d20 request from a pool tag that
   * merely failed to parse. Ask `isEngineRollableSkillCheckTag`, not this field.
   */
  declaredResolution?: string;
  /** `dice=` as the GM wrote it, lowercased, when they wrote one. Same reason. */
  declaredDice?: string;
}

/**
 * Source of the `[skill_check: ...]` tag grammar, so a reader that needs its
 * own regex instance (they carry `lastIndex`) cannot drift from the shipped
 * shape.
 */
export const SKILL_CHECK_TAG_REGEX_SOURCE = String.raw`\[skill_check:\s*([^\]]+)\]`;

/** A fresh global, case-insensitive matcher over `[skill_check: ...]` tags. */
export function createSkillCheckTagRegex(): RegExp {
  return new RegExp(SKILL_CHECK_TAG_REGEX_SOURCE, "gi");
}

/**
 * Whether the engine may roll this tag itself.
 *
 * The engine implements exactly one system: one d20 — two under advantage or
 * disadvantage, which it labels itself — plus the sheet's flat modifier against
 * a DC. A tag that declares anything else names rules the engine does not have,
 * so the only honest answer is to leave the GM's tag standing.
 *
 * This must be asked **in addition to** `resolvedResult`, never instead of it.
 * An absent `resolvedResult` says only that the numbers are not vouched for, and
 * a pool tag that omits `modifier=`, or lists five dice where it declared six,
 * comes back looking exactly like a sparse d20 request. Answering that with a
 * d20 does not fix the tag — it deletes a V20 check and writes a D&D one in its
 * place, in the text that is about to be saved and read back as fact.
 *
 * Refusing a `dice=` label this reader cannot restate exactly (`"1d20+3"`, `""`,
 * `"pool"`) is the same judgement. `"1d20+3"` is the sharp one: it *is* a d20,
 * but the engine's modifier comes from the sheet, so rolling it would drop the
 * GM's flat bonus and relabel the tag `dice="1d20"` as if it had never asked.
 *
 * The die *count* is held to the same standard as the notation, so the declared
 * label and the mode have to agree with each other: one die normally, two under
 * advantage or disadvantage. `dice="2d20"` with no mode asks for a system where
 * two dice are thrown for a straight check, which the engine does not have —
 * answering it with one die and relabelling it `dice="1d20"` is the same silent
 * rewrite as answering a pool with a d20.
 *
 * A tag declaring BOTH modes is refused for that same reason, and it is the
 * sharpest case of it. The roller cancels the pair and throws a single normal
 * die, while this function used to read the pair as "two dice wanted" and pass
 * `dice="2d20" mode="advantage" disadvantage` as rollable — so the GM's declared
 * two dice came back as one, relabelled `dice="1d20" mode="normal"`, in the text
 * about to be saved. The guide already promises a check is never rolled with
 * both at once; refusing the tag keeps that promise as a refusal instead of
 * keeping it as a rewrite.
 */
export function isEngineRollableSkillCheckTag(
  tag: Pick<SkillCheckTag, "declaredResolution" | "declaredDice" | "advantage" | "disadvantage">,
): boolean {
  if (tag.advantage && tag.disadvantage) return false;
  if (tag.declaredResolution != null && tag.declaredResolution !== "sum") return false;
  if (tag.declaredDice == null) return true;

  const notation = parseDiceNotation(tag.declaredDice);
  // A label carrying a flat modifier is refused for the same reason the audit
  // refuses it: the modifier belongs in modifier=, not in the die notation.
  if (!notation || notation.dice !== tag.declaredDice) return false;
  const wantedCount = tag.advantage || tag.disadvantage ? 2 : 1;
  return notation.sides === 20 && notation.count === wantedCount;
}

/** One `key = value` pair as it was written, with the span it occupied. */
interface SkillCheckTagAttribute {
  /** The `key` half, exactly as written. */
  key: string;
  /** The value half including its quotes, if it had any. */
  rawValue: string;
  /** Index of the key's first character in the body. */
  start: number;
  /** Index one past the value's last character. */
  end: number;
}

const WORD_CHARACTER = /\w/;
const SPACE_CHARACTER = /\s/;

/**
 * Read the value half at `at`: a quoted string, or an unquoted run.
 *
 * An unterminated quote is not a quoted value; it falls through to the unquoted
 * run, which reads the quote as an ordinary character. That is what the
 * alternation did when its first two branches failed, and a GM that opens a
 * quote and never closes it must not silently take the rest of the tag with it.
 *
 * The unquoted run refuses to start on something that is itself a `key=`, which
 * is what stops an attribute written with no value from swallowing the
 * declaration after it — see the note in `parseSkillCheckTagBody`.
 */
function readSkillCheckTagValue(body: string, at: number): { rawValue: string; end: number } | null {
  const opener = body[at];
  if (opener === '"' || opener === "'") {
    const close = body.indexOf(opener, at + 1);
    if (close >= 0) return { rawValue: body.slice(at, close + 1), end: close + 1 };
  }

  if (at < body.length && WORD_CHARACTER.test(body[at]!)) {
    let probe = at;
    while (probe < body.length && WORD_CHARACTER.test(body[probe]!)) probe += 1;
    while (probe < body.length && SPACE_CHARACTER.test(body[probe]!)) probe += 1;
    if (body[probe] === "=") return null;
  }

  let end = at;
  while (end < body.length && !SPACE_CHARACTER.test(body[end]!) && body[end] !== "]") end += 1;
  return end === at ? null : { rawValue: body.slice(at, end), end };
}

/**
 * Scan a tag body for `key = value` pairs, left to right, in one pass.
 *
 * This is the grammar the alternation above describes, walked by hand rather
 * than by a regex, and it is walked by hand for one reason: `(\w+)\s*=` can
 * restart inside a word. A body of repeated `0`s carries no `=` at all, and the
 * regex engine still tried the key at every one of those offsets, scanning to
 * the end of the run each time — the polynomial backtracking CodeQL flagged on
 * this line. Measured: 32,000 zeros took two seconds, and `0…0=0…0=` took nearly
 * five. The scan below visits each character a bounded number of times, so the
 * same bodies cost about a millisecond.
 *
 * It is the *same* grammar, not a tightened one, and the reason is worth stating
 * because "skip to the next run" looks like it should lose matches. A key can
 * only ever be a WHOLE run of word characters: the `=` a match needs must sit
 * after the run's last character, since inside the run the next character is a
 * word character and `\s*=` cannot match one. So every offset inside a run
 * reaches the same `=` and the same value, and therefore succeeds or fails
 * together with the run's start — the extra attempts the regex made were all
 * duplicates of one it had already made.
 */
export function readGmTagAttributes(body: string): SkillCheckTagAttribute[] {
  const attributes: SkillCheckTagAttribute[] = [];
  let index = 0;
  while (index < body.length) {
    if (!WORD_CHARACTER.test(body[index]!)) {
      index += 1;
      continue;
    }
    const start = index;
    while (index < body.length && WORD_CHARACTER.test(body[index]!)) index += 1;
    const key = body.slice(start, index);

    // `\s*=\s*`, and on any miss the scan resumes at `index` — past this key run,
    // which is the next offset a match could possibly begin at.
    let cursor = index;
    while (cursor < body.length && SPACE_CHARACTER.test(body[cursor]!)) cursor += 1;
    if (body[cursor] !== "=") continue;
    cursor += 1;
    while (cursor < body.length && SPACE_CHARACTER.test(body[cursor]!)) cursor += 1;

    const value = readSkillCheckTagValue(body, cursor);
    if (!value) continue;
    attributes.push({ key, rawValue: value.rawValue, start, end: value.end });
    index = value.end;
  }
  return attributes;
}

/**
 * Read one `[skill_check: ...]` tag body.
 *
 * Returns `null` when the body is not a check at all (no attributes, or no
 * skill/DC). Otherwise the request is always returned; `resolvedResult` is set
 * only when the GM reported a complete roll **that survives the audit below**.
 * An absent `resolvedResult` is the signal that this tag's numbers are not to be
 * believed — for a sparse tag because none were written, and for a full tag
 * because the ones written were wrong. It is **not** on its own permission to
 * roll: only `isEngineRollableSkillCheckTag` says whether the engine implements
 * the system the tag names.
 */
export function parseSkillCheckTagBody(body: string): SkillCheckTag | null {
  // `key = "value"` with any amount of space — a newline included — around the
  // `=`, because the spacing decides nothing about what the GM meant and it must
  // not decide which attributes the tag is read as carrying. A tag whose `dice=`
  // and `resolution=` both happened to be spaced read as skill and DC alone —
  // indistinguishable from a sparse d20 request — so the pool it had declared was
  // answered with an engine d20. The server's other check reader
  // (`segment-edits.ts`) always scanned this loosely, so the strict form was also
  // the two of them disagreeing about the same tag.
  //
  // The unquoted alternative may not start on something that is itself a `key=`,
  // or reaching across the space turns an attribute written with no value into a
  // swallow: `mode= dice="6d10"` read as `mode='dice="6d10'`, leaving no `dice=`
  // for the guard to see and the declared pool answered with an engine d20 —
  // the same rewrite the guard exists to refuse, arrived at from the other end.
  // A bare `key=` therefore declares nothing and consumes nothing, and the
  // attribute after it is read as written.
  //
  // Requiring the unquoted value to *touch* the `=` would close that too, and
  // re-open the hole above it: `dice = 6d10` would stop being read at all, which
  // is a declared pool going unseen — exactly the sparse-looking pool tag this
  // reader must never hand to a d20. Whitespace still decides nothing.
  const attributes = readGmTagAttributes(body);
  if (attributes.length === 0) return null;

  const values = new Map<string, string>();
  for (const attribute of attributes) {
    const key = attribute.key.trim().toLowerCase();
    const rawValue = attribute.rawValue.trim();
    if (!key || !rawValue) continue;
    values.set(key, rawValue.replace(/^['"]|['"]$/g, ""));
  }

  const skill = values.get("skill")?.trim() ?? "";
  const dc = Number.parseInt(values.get("dc") ?? "", 10);
  if (!skill || Number.isNaN(dc)) return null;

  const tag: SkillCheckTag = { skill, dc };
  const modeValue = values.get("mode")?.trim().toLowerCase();

  // Advantage is a declaration, so it is read where declarations live: `mode=`,
  // or a bare `advantage` / `disadvantage` flag standing on its own in the body.
  // Never as a substring of the whole body — that read the word out of the skill
  // *name*, so `skill="Press the advantage" dice="1d20"` became a two-die request
  // over a one-die label, which the count rule then refuses, and the check was
  // left unresolved for good with nothing in the transcript to say why.
  // Everything inside a `key=value` pair is the value's business; only what is
  // left over can carry a flag.
  let outsideAttributes = "";
  let attributeEnd = 0;
  for (const attribute of attributes) {
    outsideAttributes += body.slice(attributeEnd, attribute.start);
    attributeEnd = attribute.end;
  }
  outsideAttributes += body.slice(attributeEnd);
  const flags = outsideAttributes.toLowerCase();
  // `\badvantage\b` does not match inside "disadvantage" — no word boundary
  // after "dis" — so the two flags stay distinct.
  if (modeValue === "advantage" || /\badvantage\b/.test(flags)) tag.advantage = true;
  if (modeValue === "disadvantage" || /\bdisadvantage\b/.test(flags)) tag.disadvantage = true;

  // Recorded before the sparse return below, so what the GM declared about the
  // rules system survives even on a tag whose numbers do not. Keyed on the
  // attribute being written at all, not on it being readable: `dice=""` is a
  // declaration this reader cannot restate, and refusing to roll it is the
  // conservative half of the same rule.
  const declaredResolution = values.has("resolution") ? values.get("resolution")!.trim().toLowerCase() : undefined;
  const declaredDice = values.has("dice") ? values.get("dice")!.trim().toLowerCase() : undefined;
  if (declaredResolution !== undefined) tag.declaredResolution = declaredResolution;
  if (declaredDice !== undefined) tag.declaredDice = declaredDice;

  const rollsValue = values.get("rolls");
  const modifier = Number.parseInt(values.get("modifier") ?? "", 10);
  const total = Number.parseInt(values.get("total") ?? "", 10);
  const resultValue = values.get("result")?.trim().toLowerCase();
  const resolution: SkillCheckResult["resolution"] = declaredResolution === "successes" ? "successes" : "sum";

  if (!rollsValue || Number.isNaN(modifier) || Number.isNaN(total) || !resultValue) {
    // Sparse tag — the resolver will roll + apply modifier, unless the tag names
    // a system the engine does not roll. If the GM echoed a single integer in
    // rolls="...", treat it as a player-submitted d20 — but only on a tag the
    // engine would actually roll, so a d10 from a pool is never adopted as a d20.
    if (rollsValue && isEngineRollableSkillCheckTag(tag)) {
      const trimmed = rollsValue.trim();
      if (/^-?\d+$/.test(trimmed)) {
        const n = Number.parseInt(trimmed, 10);
        if (Number.isInteger(n) && n >= 1 && n <= 20) tag.preRolledD20 = n;
      }
    }
    return tag;
  }

  const normalizedMode: SkillCheckResult["rollMode"] =
    modeValue === "advantage" || tag.advantage
      ? "advantage"
      : modeValue === "disadvantage" || tag.disadvantage
        ? "disadvantage"
        : "normal";

  const explicitUsedRoll = Number.parseInt(values.get("used") ?? "", 10);
  const inferredRollFromTotal = total - modifier;
  const parsedRolls = parseSkillCheckRolls(rollsValue, inferredRollFromTotal);
  const rolls = parsedRolls.rolls;
  if (rolls.length === 0) return tag;

  const usedRoll = Number.isFinite(explicitUsedRoll)
    ? explicitUsedRoll
    : rolls.includes(inferredRollFromTotal)
      ? inferredRollFromTotal
      : normalizedMode === "advantage"
        ? Math.max(...rolls)
        : normalizedMode === "disadvantage"
          ? Math.min(...rolls)
          : rolls[0]!;

  const normalizedResult = resultValue.replace(/\s+/g, "_");
  const criticalSuccess = normalizedResult === "critical_success";
  const criticalFailure = normalizedResult === "critical_failure";
  const success = criticalSuccess ? true : criticalFailure ? false : normalizedResult === "success";

  // Dice notation the GM declared. Only trusted as a label; a non-d20 value is
  // how a pool system (V20 and friends) tells the card what to draw.
  const hasDeclaredDice = values.has("dice");
  // The shared grammar accepts a modifier ("1d20+3"); a dice label must not
  // carry one, because the modifier belongs in modifier=. Comparing against the
  // parsed NdM half refuses the label without forking the grammar.
  const parsedDeclaredDice = declaredDice ? parseDiceNotation(declaredDice) : null;
  const declaredNotation = parsedDeclaredDice?.dice === declaredDice ? parsedDeclaredDice : null;
  const declaredCount = declaredNotation?.count ?? Number.NaN;
  const declaredSides = declaredNotation?.sides ?? Number.NaN;
  const declaredDiceValue =
    declaredNotation &&
    isWithinDiceLimits(declaredNotation) &&
    declaredCount === rolls.length &&
    rolls.every((roll) => roll >= 1 && roll <= declaredSides)
      ? declaredDice
      : undefined;

  // A plain single-die d20 check is the one shape whose rules we know, so it is
  // the one shape we can audit. If the GM's own arithmetic disagrees, drop the
  // resolved result and let the resolver roll it properly. Pool systems are
  // left alone — we cannot second-guess rules the engine does not implement.
  const declaredD20 = !!declaredNotation && declaredCount === 1 && declaredSides === 20;
  const isImplicitD20Notation = parsedRolls.notation
    ? parsedRolls.notation.count === 1 && parsedRolls.notation.sides === 20
    : rolls.length === 1;
  const implicitD20 = !hasDeclaredDice && isImplicitD20Notation;
  if (hasDeclaredDice && !declaredDiceValue) return tag;
  if (!hasDeclaredDice && !isImplicitD20Notation) return tag;
  if (
    hasDeclaredDice &&
    parsedRolls.notation &&
    (declaredCount !== parsedRolls.notation.count || declaredSides !== parsedRolls.notation.sides)
  ) {
    return tag;
  }

  const dice = declaredDiceValue ?? parsedRolls.notation?.dice;

  const isPlainD20Check =
    resolution === "sum" && rolls.length === 1 && normalizedMode === "normal" && (implicitD20 || declaredD20);
  if (isPlainD20Check) {
    const actualRoll = rolls[0]!;
    const rollIsD20 = actualRoll >= 1 && actualRoll <= 20;
    const usedRollHolds = usedRoll === actualRoll;
    const arithmeticHolds = actualRoll + modifier === total;
    const outcomeHolds = criticalSuccess || criticalFailure || success === total >= dc;
    if (!rollIsD20 || !usedRollHolds || !arithmeticHolds || !outcomeHolds) return tag;
  }

  tag.resolvedResult = {
    skill,
    dc,
    rolls,
    usedRoll,
    modifier,
    total,
    success,
    criticalSuccess,
    criticalFailure,
    rollMode: normalizedMode,
    resolution,
    dice,
  };

  return tag;
}

function parseSkillCheckRolls(
  rollsValue: string,
  inferredRollFromTotal: number,
): { rolls: number[]; notation?: { dice: string; count: number; sides: number } } {
  const trimmed = rollsValue.trim();
  const parsed = parseDiceNotation(trimmed);
  if (parsed) {
    const { count, sides } = parsed;
    if (count === 1 && inferredRollFromTotal >= 1 && inferredRollFromTotal <= sides) {
      return {
        rolls: [inferredRollFromTotal],
        notation: { dice: parsed.dice, count, sides },
      };
    }
    return { rolls: [] };
  }

  return {
    rolls: rollsValue
      .split(/[|,]/)
      .map((entry) => entry.trim())
      .filter((entry) => /^-?\d+$/.test(entry))
      .map((entry) => Number.parseInt(entry, 10))
      .filter((entry) => Number.isFinite(entry)),
  };
}
