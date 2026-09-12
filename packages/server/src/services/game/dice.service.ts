// ──────────────────────────────────────────────
// Game: Dice Rolling Service
//
// The NdM grammar and the roller live in
// @marinara-engine/shared (utils/dice-notation.ts).
// What stays here is this path's own bounds policy:
// an oversized roll is clamped to the ceilings, not
// refused, so /roll still answers 500d6 with a roll.
// The result names the dice it threw, so a clamped
// roll reads 100d6 rather than the 500d6 asked for.
// ──────────────────────────────────────────────

import {
  clampParsedDiceToLimits,
  isEngineRollableSkillCheckTag,
  parseDiceNotation,
  parseSkillCheckTagBody,
  readGmTagAttributes,
  rollParsedDice,
  serializeResolvedSkillCheckTag,
  serializeSparseSkillCheckTag,
  type DiceRollResult,
  type SkillCheckResult,
} from "@marinara-engine/shared";

export { isDiceNotation } from "@marinara-engine/shared";

/**
 * Parse and roll dice using NdM notation (e.g. "2d6+3", "d20", "4d8-1").
 * Returns individual rolls, modifier, and total.
 */
export function rollDice(notation: string): DiceRollResult {
  const parsed = parseDiceNotation(notation);
  if (!parsed) {
    throw new Error(`Invalid dice notation: "${notation}". Use NdM format (e.g. 2d6, d20+3, 4d8-1).`);
  }

  return rollParsedDice(clampParsedDiceToLimits(parsed));
}

/**
 * Read a successful `roll_dice` tool result back as the message-extra shape `/roll`
 * writes, so a tool-called roll renders through the same animated dice card.
 * Returns null for refusals, malformed payloads, or anything the card cannot draw.
 */
export function parseRollDiceToolResult(raw: string): DiceRollResult | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;

  const payload = parsed as Record<string, unknown>;
  const notation = typeof payload.notation === "string" ? payload.notation.trim() : "";
  const rolls = Array.isArray(payload.rolls) ? payload.rolls : null;
  const modifier = typeof payload.modifier === "number" ? payload.modifier : 0;
  const total = payload.total;

  if (!notation || !rolls || rolls.length === 0) return null;
  if (!rolls.every((roll): roll is number => typeof roll === "number" && Number.isFinite(roll))) return null;
  if (typeof total !== "number" || !Number.isFinite(total)) return null;
  if (!Number.isFinite(modifier)) return null;

  return { notation, rolls, modifier, total };
}

/** Fresh regex so callers can collect or remove the same narration roll records. */
export function createGameRollTagRegex(): RegExp {
  return /\[(dice|skill_check):\s*([^\]]+)\]/gi;
}

/** Resolve fresh model requests; historical messages are never passed through this roller. */
export function resolveGameDiceRequests(
  content: string,
  knownRolls: readonly DiceRollResult[] = [],
  roll: (notation: string) => DiceRollResult = rollDice,
): { content: string; diceRolls: DiceRollResult[]; checkResults: SkillCheckResult[]; rolled: number } {
  const diceRolls: DiceRollResult[] = [];
  const checkResults: SkillCheckResult[] = [];
  let rolled = 0;
  const resolved = content.replace(createGameRollTagRegex(), (original, kind: string, body: string) => {
    if (kind.toLowerCase() === "dice") {
      const notation = parseDiceNotation(body);
      // A resolved [dice: NdM = total (...)] record is not a new request.
      if (!notation) return original;
      const result = roll(notation.notation);
      diceRolls.push(result);
      rolled++;
      return `[dice: ${result.notation} = ${result.total} (${result.rolls.join(" + ")}${result.modifier ? ` ${result.modifier > 0 ? "+" : "-"} ${Math.abs(result.modifier)}` : ""})]`;
    }

    const tag = parseSkillCheckTagBody(body);
    // Standard d20 checks keep their existing character-sheet modifier path.
    if (!tag || tag.skill.length > 100 || isEngineRollableSkillCheckTag(tag) || tag.advantage || tag.disadvantage)
      return original;
    const declared = tag.declaredDice ? parseDiceNotation(tag.declaredDice) : null;
    const notation = declared ? clampParsedDiceToLimits(declared) : null;
    const resolution = tag.declaredResolution ?? "sum";
    if (
      !notation ||
      (resolution !== "sum" && resolution !== "successes") ||
      !Number.isSafeInteger(tag.dc) ||
      tag.dc < 1
    )
      return original;

    const attributes = new Map(
      readGmTagAttributes(body).map((attribute) => [
        attribute.key.toLowerCase(),
        attribute.rawValue.replace(/^["']|["']$/g, ""),
      ]),
    );
    if (Number(attributes.get("dc")) !== tag.dc) return original;
    const threshold = Number(attributes.get("threshold"));
    if (
      resolution === "successes" &&
      (!Number.isSafeInteger(threshold) || threshold < 1 || threshold > notation.sides || notation.modifier !== 0)
    ) {
      // A pool without its per-die threshold has no defined counting rule.
      // Keep the request, but never keep numbers the model invented for it.
      return serializeSparseSkillCheckTag(tag).replace(/]$/, ' resolution="successes"]');
    }

    const declaredRolls = attributes.get("rolls")?.split(/[|,]/).map(Number);
    const known = knownRolls.find((candidate) => {
      const parsed = parseDiceNotation(candidate.notation);
      return (
        parsed?.count === notation.count &&
        parsed.sides === notation.sides &&
        candidate.modifier === Number(attributes.get("modifier") ?? notation.modifier) &&
        candidate.total === Number(attributes.get("total")) &&
        candidate.rolls.length === declaredRolls?.length &&
        candidate.rolls.every((value, index) => value === declaredRolls?.[index])
      );
    });
    const result = known || roll(notation.notation);
    if (!known) rolled++;
    const dice = parseDiceNotation(result.notation)!;
    const total = resolution === "successes" ? result.rolls.filter((value) => value >= threshold).length : result.total;
    const check: SkillCheckResult = {
      skill: tag.skill,
      dc: tag.dc,
      rolls: result.rolls,
      usedRoll: resolution === "successes" ? total : result.total - result.modifier,
      modifier: result.modifier,
      total,
      success: total >= tag.dc,
      criticalSuccess: false,
      criticalFailure: false,
      rollMode: "normal",
      resolution,
      dice: dice.dice,
    };
    checkResults.push(check);
    const record = serializeResolvedSkillCheckTag(check);
    return resolution === "successes" ? record.replace(/]$/, ` threshold="${threshold}"]`) : record;
  });
  return { content: resolved, diceRolls, checkResults, rolled };
}
