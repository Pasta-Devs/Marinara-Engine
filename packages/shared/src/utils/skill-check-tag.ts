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

import { z } from "zod";
import type { GameDicePoolSlotName, SkillCheckResult } from "../types/game.js";
import { parsePoolSlotName } from "./dice-pool.js";
import { isWithinDiceLimits, parseDiceNotation } from "./dice-notation.js";

/** Why the Engine did not roll a check it was asked for: the character cannot attempt it untrained,
 *  or the check picks out no one party member to roll it. */
export type SkillCheckRefusalReason = "untrained" | "unknown-roller";

export interface SkillCheckTag {
  skill: string;
  /**
   * `dc=` as written. Absent only on a tag that names its difficulty by `difficulty=` instead, which
   * only a ruleset game can turn into a number; every other reader treats such a tag as a check it
   * cannot roll.
   */
  dc?: number;
  /**
   * `difficulty="Label"` as the GM wrote it: a step of the ruleset's difficulty ladder, picked by
   * name. Carried, never judged: whether the ladder has such a step is the resolver's business.
   */
  difficulty?: string;
  /**
   * `explode=` and `double=` as whole numbers, when the GM wrote readable ones: the face a pool
   * ruleset's moving rule fires on for this one check. Carried, never judged, like `threshold=`.
   */
  explode?: number;
  double?: number;
  /** `reroll="id"` as the GM wrote it: one of the ruleset's standing re-throws, by its id. Carried,
   *  never judged: whether the ruleset has one by that name is the resolver's business. */
  reroll?: string;
  /** `reason="untrained"`: the Engine did not roll this check, because the ruleset does not let
   *  the character attempt it untrained. Settled, not owed: the client's fallback and the roll
   *  endpoint's record never roll it later. Only the Engine writes it, but the Game Master could
   *  copy it, so a turn's own pass ignores it and decides again from the sheet. `"unknown-roller"`:
   *  not rolled because its `who=` named nobody in the party, or several, or it named nobody where a
   *  party member had to be named; settled on the same terms. */
  reason?: SkillCheckRefusalReason;
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
  /**
   * `threshold=` as a number, when the GM wrote a readable one.
   *
   * Read here rather than re-scanned by the one caller that needs it, so the two readers
   * of the same tag cannot drift. Carried, never judged: whether a threshold is usable —
   * within the die's range, on a pool with no flat modifier — is the resolver's rule and
   * stays there.
   */
  threshold?: number;
  /**
   * Whether `pool=` was written at all, READABLE OR NOT.
   *
   * This is what the pool branch gates on, never `poolSlots`. A slot name the engine
   * cannot read is still the model claiming a pool spend, and dropping such a tag back
   * onto the ordinary path would adopt its `rolls=` as a player-submitted die — the
   * model's own invented number becoming the roll, through the one door the authority
   * rule cannot see. An unreadable name costs the tag a `slot` mismatch instead.
   */
  poolDeclared?: boolean;
  /**
   * `who=` as the GM wrote it: the party member a ruleset game rolls the check for. Absent means
   * the player. Carried, never judged: only a game with a pinned ruleset reads it, and whether
   * the name matches a sheet is the resolver's business.
   */
  who?: string;
  /**
   * `with=` as the GM wrote it: roll this skill or save with another ability than its own. Carried,
   * never judged — whether the ruleset has such an ability is the resolver's business, and a name
   * no ability answers to is ignored there rather than refused here.
   */
  withAbility?: string;
  /** `for=` as the GM wrote it (1.752): what the check is made for, "climb" or "swim", for a change
   *  narrowed to that purpose. Carried, never judged. */
  purpose?: string;
  /**
   * `bonus=` as a whole number, when the GM wrote a readable one: dice a pool ruleset adds or
   * takes for this one check. Read like `threshold=` and held to the same rule — `Number` rather
   * than `parseInt`, so "1.5" stays unusable instead of becoming 1, and whether the ruleset allows
   * situational dice at all is decided by the resolver.
   */
  bonusDice?: number;
  /** `dark="2"`: the dark dice the Game Master adds to a keep-the-highest check (1.138), where the
   *  ruleset has them. Read like `bonus=`; the resolver holds it to the ruleset's `dark.max`. */
  darkDice?: number;
  /** `upgrade=` turns difficulty dice into challenge dice (1.141). */
  upgrades?: number;
  /** Independent setback dice and optional own-pool upgrades (1.150). */
  setback?: number;
  upgradeOwn?: number;
  /**
   * `spend="willpower:1"` as the GM wrote it, read into a pool name and a whole number of points.
   *
   * What the player said they were spending on THIS check, so one resolution both rolls the dice
   * and pays for what changed them. Carried, never judged: whether the ruleset offers such a spend,
   * whether the pool covers it and what it buys are all the resolver's business.
   */
  spend?: { pool: string; amount: number };
  /**
   * `use="Potence"` as the GM wrote it: the catalog entry the player is using ON this check.
   *
   * Carried, never judged. Whether the character actually has that entry, what it costs and what
   * it does to the roll are all the resolver's business, and it needs the ruleset's catalogs to
   * answer any of them.
   */
  useEntry?: string;
  /** `apply="Name; Other"` as the GM wrote it (1.156): rows or entries that apply to this roll.
   *  Carried, never judged; the resolver decides which apply and what they do. */
  apply?: string[];
  /** `pool=` exactly as written, for the mismatch log. Present whenever `poolDeclared` is. */
  poolRaw?: string;
  /**
   * `pool="d20:1"` as the GM wrote it, parsed into a size and zero-based slots.
   *
   * A CHECKSUM, never an instruction. The engine spends the next unconsumed value of that
   * size in reading order whatever this says, and a disagreement is recorded as a
   * mismatch. Present on every reader, meaningful only where a pool session is supplied:
   * a historical tag read back carries it and changes nothing, which is what keeps an
   * already-saved transcript reading exactly as it always did.
   */
  poolSlots?: GameDicePoolSlotName;
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
 * The quote that closes a value opened at `at`. A quote inside a word (`'O'Brien'`) is not the close,
 * and nor is one that stands where an inner quote would open, after a space and right before a word:
 * it and its partner are skipped, so a value holding a quoted nickname is read whole (cheap-GM
 * playtest 2026-10-26: `who="Marigold "Mars" Thimblewick"` read as `Marigold `, so her checks rolled
 * flat and her Hit Dice were refused). Where no candidate closes it, the first quote does, as before.
 * Only a few quotes are passed over, so a body made of quotes costs no scan to its end per attribute.
 */
const MAX_PASSED_QUOTES = 6;
/** Whether a `key=` starts at `at`. Bounded by the key's own run. */
function startsKey(body: string, at: number): boolean {
  let cursor = at;
  while (cursor < body.length && WORD_CHARACTER.test(body[cursor]!)) cursor += 1;
  while (cursor < body.length && SPACE_CHARACTER.test(body[cursor]!)) cursor += 1;
  return cursor > at && body[cursor] === "=";
}
function closingQuoteAt(body: string, at: number, quote: string): number {
  const first = body.indexOf(quote, at + 1);
  let close = first;
  for (let passed = 0; close >= 0 && passed < MAX_PASSED_QUOTES; passed += 1) {
    const before = close - 1 > at ? (body[close - 1] ?? "") : "";
    const after = body[close + 1] ?? "";
    if (!WORD_CHARACTER.test(after) || !(SPACE_CHARACTER.test(before) || WORD_CHARACTER.test(before))) return close;
    // Right against the next attribute (`"Stealth"dc=15`) it is the close all the same.
    if (startsKey(body, close + 1)) return close;
    if (WORD_CHARACTER.test(before)) {
      close = body.indexOf(quote, close + 1);
      continue;
    }
    const partner = body.indexOf(quote, close + 1);
    if (partner < 0) return first;
    close = body.indexOf(quote, partner + 1);
  }
  return first;
}

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
    const close = closingQuoteAt(body, at, opener);
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

const symbolId = z
  .string()
  .max(40)
  .regex(/^[a-z][a-z0-9_]*$/);
const symbolDetailsSchema = z
  .object({
    labels: z.record(symbolId, z.string().min(1).max(80)).refine((labels) => Object.keys(labels).length <= 10),
    faces: z.array(z.array(symbolId).max(3)).max(36),
    criticalSuccess: z.boolean(),
    criticalFailure: z.boolean(),
  })
  .strict();

/** Read only bounded symbol records; malformed metadata stays an unresolved request. */
function readSymbolRecord(values: Map<string, string>) {
  if (!values.has("symbols")) return undefined;
  try {
    const raw = values.get("symboldetails") ?? "";
    if (raw.length > 20000) return undefined;
    const details = symbolDetailsSchema.parse(JSON.parse(decodeURIComponent(raw)));
    const entries = (values.get("symbols") ?? "").trim().split(/\s+/).filter(Boolean);
    if (entries.length > 10) return undefined;
    const symbols: Record<string, number> = Object.create(null);
    for (const entry of entries) {
      const match = /^(\d{1,3})([a-z][a-z0-9_]{0,39})$/.exec(entry);
      if (!match || Number(match[1]) < 1 || Number(match[1]) > 216 || Object.hasOwn(symbols, match[2]!))
        return undefined;
      symbols[match[2]!] = Number(match[1]);
    }
    const thrown = (values.get("thrown") ?? "").split("|").filter(Boolean);
    if (!z.array(symbolId).max(36).safeParse(thrown).success || thrown.length !== details.faces.length)
      return undefined;
    if ([...Object.keys(symbols), ...details.faces.flat()].some((id) => !Object.hasOwn(details.labels, id)))
      return undefined;
    return {
      symbols: { ...symbols },
      thrown,
      symbolLabels: details.labels,
      symbolFaces: details.faces,
      criticalSuccess: details.criticalSuccess,
      criticalFailure: details.criticalFailure,
    };
  } catch {
    return undefined;
  }
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
  // A difficulty named by its ladder step stands in for `dc=`, which only a ruleset game can read.
  // Cut at the schema's own label limit, so any step's label can be named.
  const difficulty = values.get("difficulty")?.trim().slice(0, 80);
  if (!skill || (Number.isNaN(dc) && !difficulty)) return null;

  const tag: SkillCheckTag = { skill, ...(Number.isNaN(dc) ? {} : { dc }), ...(difficulty ? { difficulty } : {}) };
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

  // Recorded beside the other declarations, for the same reason and on the same terms:
  // written at all, not necessarily usable. `Number` rather than `parseInt` deliberately,
  // so "6.5" stays unusable rather than becoming 6 — the resolver's own integer test is
  // what refuses it, and reading it loosely here would quietly widen that refusal.
  if (values.has("threshold")) {
    const threshold = Number(values.get("threshold"));
    if (Number.isFinite(threshold)) tag.threshold = threshold;
  }
  // A whole number of dice, or nothing. `Number` rather than `parseInt`, so "1.5" stays unusable
  // instead of becoming 1, and the emptiness test comes first because `Number("")` is 0 and an
  // attribute written with no value has declared nothing.
  const bonusValue = values.get("bonus")?.trim();
  if (bonusValue) {
    const bonus = Number(bonusValue);
    if (Number.isInteger(bonus)) tag.bonusDice = bonus;
  }
  for (const key of ["setback", "upgradeOwn"] as const) {
    const value = values.get(key.toLowerCase())?.trim();
    if (value && Number.isInteger(Number(value)) && Number(value) >= 0) tag[key] = Number(value);
  }
  const upgradeValue = values.get("upgrade")?.trim();
  if (upgradeValue) {
    const upgrades = Number(upgradeValue);
    if (Number.isInteger(upgrades) && upgrades >= 0) tag.upgrades = upgrades;
  }
  const darkValue = values.get("dark")?.trim();
  if (darkValue) {
    const dark = Number(darkValue);
    if (Number.isInteger(dark) && dark >= 0) tag.darkDice = dark;
  }
  const rerollName = values.get("reroll")?.trim();
  if (rerollName) tag.reroll = rerollName.slice(0, 40);
  const reason = values.get("reason")?.trim().toLowerCase();
  if (reason === "untrained" || reason === "unknown-roller") tag.reason = reason;
  // A face, so a whole number or nothing, on the same terms as `bonus=`.
  for (const key of ["explode", "double"] as const) {
    const written = values.get(key)?.trim();
    const face = written ? Number(written) : Number.NaN;
    if (Number.isInteger(face)) tag[key] = face;
  }
  // `spend="<pool>:<points>"`. Read on the same terms as `threshold=` and `bonus=`: written at all,
  // not necessarily usable. A body with no colon, an empty pool name or a number that is not a
  // whole positive one has declared nothing the Engine could act on.
  const spendValue = values.get("spend")?.trim();
  if (spendValue) {
    const at = spendValue.lastIndexOf(":");
    const pool = at > 0 ? spendValue.slice(0, at).trim() : "";
    const amount = at > 0 ? Number(spendValue.slice(at + 1).trim()) : Number.NaN;
    if (pool && Number.isInteger(amount) && amount > 0) tag.spend = { pool: pool.slice(0, 100), amount };
  }
  const useEntry = values.get("use")?.trim();
  // A catalog entry's label may be 120 characters, and this is the name that has to match one, so
  // the cut is the schema's own limit rather than the 100 the rest of these use: a shorter one
  // would make an entry with a long label impossible to name.
  if (useEntry) tag.useEntry = useEntry.slice(0, 120);
  // `apply="Name; Other"` (1.156): what the character has that applies to this one roll. Up to four
  // names, each cut where an entry's label is.
  const applied = (values.get("apply") ?? "")
    .split(";")
    .map((name) => name.trim().slice(0, 120))
    .filter(Boolean)
    .slice(0, 4);
  if (applied.length) tag.apply = applied;
  const who = values.get("who")?.trim();
  if (who) tag.who = who.slice(0, 100);
  const withAbility = values.get("with")?.trim();
  if (withAbility) tag.withAbility = withAbility.slice(0, 100);
  const purpose = values.get("for")?.trim();
  if (purpose) tag.purpose = purpose.slice(0, 40);
  if (values.has("pool")) {
    tag.poolDeclared = true;
    tag.poolRaw = values.get("pool")!;
    const poolSlots = parsePoolSlotName(tag.poolRaw);
    if (poolSlots) tag.poolSlots = poolSlots;
  }

  // A record always has the number it was rolled against, so a tag that names only a difficulty is
  // read as an ask whatever else it carries.
  const recordDc = tag.dc;

  const penaltyValue = Number(values.get("penalty"));
  const penalty = Number.isFinite(penaltyValue) && penaltyValue < 0 ? { penalty: penaltyValue } : {};
  // Said by the Engine's own record only, and read back so a reloaded card still says it.
  const complication = values.get("complication")?.trim().toLowerCase() === "true" ? { complication: true } : {};
  const adjustValue = Number(values.get("adjust"));
  const adjust = Number.isInteger(adjustValue) && adjustValue !== 0 ? { adjust: adjustValue } : {};
  // The standing re-throw the record says was thrown, read back with the rest of what it applied.
  const thrownAgain = tag.reroll ? { reroll: tag.reroll } : {};
  // And what the character's conditions and items did, said by the Engine's own record only.
  const effectsValue = Number(values.get("effects"));
  const fromNames = (values.get("from") ?? "")
    .split(";")
    .map((name) => name.trim().slice(0, 120))
    .filter(Boolean)
    .slice(0, 24);
  const automatic = values.get("automatic")?.trim().toLowerCase() === "true";
  // The ruleset's outcome band (1.135), said by the Engine's own record and read back so a reloaded
  // card still says it. Cut at the schema's label limit.
  const outcomeLabel = values.get("outcome")?.trim().slice(0, 80);
  // What the die's faces are worth (1.136), whole numbers only and no more than the schema allows.
  const faceList = (values.get("faces") ?? "").split("|").map((entry) => entry.trim());
  const faceValues =
    faceList.length >= 2 && faceList.length <= 20 && faceList.every((entry) => /^-?\d+$/.test(entry))
      ? faceList.map((entry) => Number.parseInt(entry, 10))
      : undefined;
  const unmodifiedFace = Number(values.get("unmodified"));
  // A stance's direction and the dice that showed exactly the target (1.137).
  const compareRaw = values.get("compare")?.trim().toLowerCase();
  const compareValue: SkillCheckResult["compare"] =
    compareRaw === "below" || compareRaw === "above" ? compareRaw : undefined;
  const exactCount = Number(values.get("exact"));
  const exactLabel = values.get("exactlabel")?.trim().slice(0, 40);
  // A keep-the-highest check and its dark dice (1.138).
  const highestCount = Number(values.get("highest"));
  const zeroDice = values.get("zerodice")?.trim().toLowerCase() === "true";
  const darkCount = Number(values.get("dark"));
  const darkLabel = values.get("darklabel")?.trim().slice(0, 40);
  const darkHighest = values.get("darkhighest")?.trim().toLowerCase() === "true";
  // A roll read against the sheet's number, and its tens dice (1.139).
  const againstRaw = values.get("against")?.trim().toLowerCase();
  const againstValue: SkillCheckResult["against"] =
    againstRaw === "at-most" || againstRaw === "at-least" ? againstRaw : undefined;
  const tensCount = Number(values.get("tens"));
  const symbolRecord = readSymbolRecord(values);
  if (values.has("symbols") && !symbolRecord) return tag;
  const effected = {
    ...symbolRecord,
    ...(symbolRecord && tag.setback ? { setback: tag.setback } : {}),
    ...(symbolRecord && tag.upgradeOwn ? { upgradeOwn: tag.upgradeOwn } : {}),
    ...(Number.isInteger(effectsValue) && effectsValue !== 0 ? { effects: effectsValue } : {}),
    ...(fromNames.length > 0 ? { from: fromNames } : {}),
    ...(automatic ? { automatic: true } : {}),
    ...(outcomeLabel ? { outcome: outcomeLabel } : {}),
    ...(faceValues ? { faces: faceValues } : {}),
    ...(Number.isInteger(unmodifiedFace) && unmodifiedFace > 0 ? { unmodified: unmodifiedFace } : {}),
    ...(compareValue ? { compare: compareValue } : {}),
    ...(Number.isInteger(exactCount) && exactCount > 0
      ? { exact: exactCount, ...(exactLabel ? { exactLabel } : {}) }
      : {}),
    ...(Number.isInteger(highestCount) && highestCount > 0 && highestCount <= 3
      ? {
          highest: highestCount,
          ...(zeroDice ? { zeroDice: true } : {}),
          ...(values.get("darkoutcome") === "light" ? { darkOutcome: "light" as const } : {}),
        }
      : {}),
    ...(againstValue ? { against: againstValue } : {}),
    ...(Number.isInteger(tensCount) && tensCount !== 0 && Math.abs(tensCount) <= 3 ? { tens: tensCount } : {}),
    ...(Number.isInteger(darkCount) && darkCount > 0 && darkCount <= 10
      ? { dark: darkCount, ...(darkLabel ? { darkLabel } : {}), ...(darkHighest ? { darkHighest: true } : {}) }
      : {}),
  };
  const rollsValue = values.get("rolls");
  const modifier = Number.parseInt(values.get("modifier") ?? "", 10);
  const total = Number.parseInt(values.get("total") ?? "", 10);
  const resultValue = values.get("result")?.trim().toLowerCase();
  const resolution: SkillCheckResult["resolution"] = declaredResolution === "successes" ? "successes" : "sum";

  // An EMPTY pool is a real result with no dice in it: a ruleset whose pool may be 0 fails the check
  // without a roll and records `dice="0dN" rolls=""`. Read it back as the failure it was, so the
  // record survives a reload instead of looking like a check nobody rolled. Nothing else may have
  // an empty `rolls=`, and the shape is never Engine-rollable, so this cannot adopt a model's claim
  // as a roll: it can only ever say "no dice, no successes". A save something made fail without a
  // roll (`automatic="true"`) has the same shape on a summed check too.
  const emptyPool =
    recordDc !== undefined &&
    values.has("rolls") &&
    (rollsValue ?? "").trim() === "" &&
    (resolution === "successes" || automatic || symbolRecord || (Number.isInteger(highestCount) && highestCount > 0)) &&
    // The written strings, not the parsed numbers: `parseInt` reads "0 or so" as 0, and only the
    // Engine's own exact record may be read back this way.
    values.get("total")?.trim() === "0" &&
    values.get("modifier")?.trim() === "0" &&
    /^0d[1-9]\d{0,3}$/.test(declaredDice ?? "") &&
    (resultValue === "failure" ||
      resultValue === "critical_failure" ||
      resultValue === "critical failure" ||
      (!!symbolRecord && resultValue === "success"));
  if (emptyPool && (!symbolRecord || symbolRecord.thrown.length === 0)) {
    tag.resolvedResult = {
      skill,
      dc: recordDc!,
      rolls: [],
      usedRoll: 0,
      modifier: 0,
      total: 0,
      success: !!symbolRecord && resultValue === "success",
      criticalSuccess: false,
      criticalFailure: resultValue !== "failure",
      rollMode: "normal",
      resolution,
      dice: declaredDice,
      ...penalty,
      ...complication,
      ...adjust,
      ...thrownAgain,
      ...effected,
    };
    return tag;
  }

  if (!rollsValue || Number.isNaN(modifier) || Number.isNaN(total) || !resultValue || recordDc === undefined) {
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
  if (rolls.length === 0 || (symbolRecord && symbolRecord.thrown.length !== rolls.length)) return tag;

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
  // A roll at most its target (1.139) succeeds the other way round, so the d20 audit is not its own.
  if (isPlainD20Check && !againstValue && !symbolRecord) {
    const actualRoll = rolls[0]!;
    const rollIsD20 = actualRoll >= 1 && actualRoll <= 20;
    const usedRollHolds = usedRoll === actualRoll;
    const arithmeticHolds = actualRoll + modifier === total;
    const outcomeHolds = criticalSuccess || criticalFailure || success === total >= recordDc;
    if (!rollIsD20 || !usedRollHolds || !arithmeticHolds || !outcomeHolds) return tag;
  }

  tag.resolvedResult = {
    skill,
    dc: recordDc,
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
    ...penalty,
    ...complication,
    ...adjust,
    ...thrownAgain,
    ...effected,
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
