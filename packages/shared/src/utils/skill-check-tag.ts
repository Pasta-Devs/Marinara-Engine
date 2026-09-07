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
 * Read one `[skill_check: ...]` tag body.
 *
 * Returns `null` when the body is not a check at all (no attributes, or no
 * skill/DC). Otherwise the request is always returned; `resolvedResult` is set
 * only when the GM reported a complete roll **that survives the audit below**.
 * An absent `resolvedResult` is the signal that a resolver still owes this tag
 * a real roll — for a sparse tag because no numbers were written, and for a
 * full tag because the numbers written were wrong.
 */
export function parseSkillCheckTagBody(body: string): SkillCheckTag | null {
  const attributes = Array.from(body.matchAll(/(\w+)=("[^"]*"|'[^']*'|[^\s\]]+)/g));
  if (attributes.length === 0) return null;

  const values = new Map<string, string>();
  for (const match of attributes) {
    const key = match[1]?.trim().toLowerCase();
    const rawValue = match[2]?.trim();
    if (!key || !rawValue) continue;
    values.set(key, rawValue.replace(/^['"]|['"]$/g, ""));
  }

  const skill = values.get("skill")?.trim() ?? "";
  const dc = Number.parseInt(values.get("dc") ?? "", 10);
  if (!skill || Number.isNaN(dc)) return null;

  const tag: SkillCheckTag = { skill, dc };
  const raw = body.toLowerCase();
  if (values.get("mode") === "advantage" || raw.includes(" advantage")) tag.advantage = true;
  if (values.get("mode") === "disadvantage" || raw.includes(" disadvantage")) tag.disadvantage = true;

  const rollsValue = values.get("rolls");
  const modifier = Number.parseInt(values.get("modifier") ?? "", 10);
  const total = Number.parseInt(values.get("total") ?? "", 10);
  const resultValue = values.get("result")?.trim().toLowerCase();
  const modeValue = values.get("mode")?.trim().toLowerCase();
  const resolution: SkillCheckResult["resolution"] =
    values.get("resolution")?.trim().toLowerCase() === "successes" ? "successes" : "sum";

  if (!rollsValue || Number.isNaN(modifier) || Number.isNaN(total) || !resultValue) {
    // Sparse tag — the resolver will roll + apply modifier. If the GM echoed
    // a single integer in rolls="...", treat it as a player-submitted d20.
    if (rollsValue) {
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
  const declaredDice = values.get("dice")?.trim().toLowerCase();
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
