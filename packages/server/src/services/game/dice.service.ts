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
  formatPoolSlotName,
  isEngineRollableSkillCheckTag,
  parseDiceNotation,
  parsePoolSlotName,
  parseSkillCheckTagBody,
  readGmTagAttributes,
  rollParsedDice,
  serializeResolvedSkillCheckTag,
  serializeSparseSkillCheckTag,
  type DiceRollResult,
  type GameDicePoolConsumption,
  type GameDicePoolSlotName,
  type ParsedDiceNotation,
  type SkillCheckResult,
  type SkillCheckTagExtras,
} from "@marinara-engine/shared";
import { logger } from "../../lib/logger.js";
import { logPoolDcFit, pooledSizeForNotation, type GameDicePoolSession } from "./dice-pool.service.js";
import { SKILL_CHECK_MAX_DC, SKILL_CHECK_MIN_DC } from "./skill-check-resolution.service.js";

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
  const dc = payload.dc;
  if (dc !== undefined && (typeof dc !== "number" || !Number.isSafeInteger(dc))) return null;

  return { notation, rolls, modifier, total, ...(dc !== undefined ? { dc } : {}) };
}

/** Fresh regex so callers can collect or remove the same narration roll records. */
export function createGameRollTagRegex(): RegExp {
  return /\[(dice|skill_check):\s*([^\]]+)\]/gi;
}

/**
 * Read a `[dice:]` body the pool prompt produced: a leading NdM notation, whatever record
 * the model wrote after it, and a `pool=` slot name.
 *
 * A body with no `pool=` is not a pool tag and is left to the paths that already handle
 * it, which is what keeps a historical record reading exactly as it always did.
 */
export function readPoolDiceBody(
  body: string,
): { notation: ParsedDiceNotation; raw: string; slots: GameDicePoolSlotName | null } | null {
  const attribute = readGmTagAttributes(body).find((candidate) => candidate.key.toLowerCase() === "pool");
  // Written at all, readable or not, empty included. A slot name the engine cannot read
  // is still the model claiming a pool spend, and letting such a tag fall back to the
  // ordinary path would keep the model's own numbers in the saved record.
  if (!attribute) return null;
  const raw = attribute.rawValue;
  const head = body.trim().split(/[\s=]/, 1)[0] ?? "";
  const notation = parseDiceNotation(head);
  return notation ? { notation, raw, slots: parsePoolSlotName(raw) } : null;
}

/** Whether a `[dice:]` body wrote `pool=` at all, readable or not. */
export function hasPoolClaim(body: string): boolean {
  return readGmTagAttributes(body).some((attribute) => attribute.key.toLowerCase() === "pool");
}

/** The engine's own `[dice:]` record, with the slot it spent named on the end. */
function serializeDiceRecord(result: DiceRollResult, pool?: string): string {
  const modifier = result.modifier ? ` ${result.modifier > 0 ? "+" : "-"} ${Math.abs(result.modifier)}` : "";
  return `[dice: ${result.notation} = ${result.total} (${result.rolls.join(" + ")}${modifier})${pool ? ` pool="${pool}"` : ""}]`;
}

/**
 * Resolve fresh model requests; historical messages are never passed through this roller.
 *
 * `pool` is supplied by exactly one caller — generation post-processing, for the newly
 * generated segment only — and is what tells a record the model just wrote apart from one
 * read back out of a saved message. The two are the same bytes, so the distinction cannot
 * live in the text; carrying it out of band is what keeps every other reader, and every
 * already-saved transcript, behaving byte for byte as it does today.
 */
export function resolveGameDiceRequests(
  content: string,
  knownRolls: readonly DiceRollResult[] = [],
  roll: (notation: string) => DiceRollResult = rollDice,
  pool?: GameDicePoolSession,
): {
  content: string;
  diceRolls: DiceRollResult[];
  checkResults: SkillCheckResult[];
  rolled: number;
  unresolved: string[];
} {
  const diceRolls: DiceRollResult[] = [];
  const checkResults: SkillCheckResult[] = [];
  let rolled = 0;
  const unresolved: string[] = [];
  const reportUnresolved = (request: string, reason: string) => {
    logger.warn({ request: request.slice(0, 200) }, "[game/dice] Unresolved roll request: %s", reason);
    if (unresolved.length < 8) unresolved.push(`${request.slice(0, 200)}: ${reason}`);
  };
  let poolTagIndex = 0;
  const resolved = content.replace(createGameRollTagRegex(), (original, kind: string, body: string) => {
    if (kind.toLowerCase() === "dice") {
      const notation = parseDiceNotation(body);
      // A resolved [dice: NdM = total (...)] record is not a new request.
      if (!notation) {
        // The pool's own attachment point, BEFORE the return below: the complete record the
        // pool prompt asks for parses as a record here, so the roller further down is never
        // reached for it and a branch placed after this return would never run.
        const poolBody = pool ? readPoolDiceBody(body) : null;
        if (pool && poolBody)
          return resolvePoolDiceTag(pool, poolBody, body, diceRolls, () => rolled++, poolTagIndex++);
        if (pool && hasPoolClaim(body)) {
          // `pool=` written in front of nothing the grammar can read. The numbers on such
          // a record are a claim the pool never validated, so they are dropped with the
          // claim rather than saved as written; the head is kept as the bare ask it may
          // have been. Only reachable with a live pool, so a re-read is untouched.
          const head = body.trim().split(/[\s=]/, 1)[0] ?? "";
          reportUnresolved(body, "A pool record needs a readable NdM notation; its numbers were dropped.");
          return `[dice: ${head}]`;
        }
        // Widened for the pool's slot name only. Widening it is necessary and not
        // sufficient: it makes a pool-bearing record PASS the historical test, which is
        // right for a re-read and fatal for a fresh turn without the out-of-band session
        // above — which is exactly why the pool branch sits in front of it.
        const recorded = /^([^\s=]+)\s*=\s*-?\d+\s*\([^)]*\)(?:\s+pool="[^"]*")?\s*$/u.exec(body.trim());
        if (!recorded || !parseDiceNotation(recorded[1]!))
          reportUnresolved(body, "Unsupported dice notation. Use NdM with an optional +K or -K modifier.");
        return original;
      }
      const result = roll(notation.notation);
      diceRolls.push(result);
      rolled++;
      return serializeDiceRecord(result);
    }

    const tag = parseSkillCheckTagBody(body);
    // Standard d20 checks keep their existing character-sheet modifier path.
    if (!tag || tag.skill.length > 100 || isEngineRollableSkillCheckTag(tag) || tag.advantage || tag.disadvantage)
      return original;
    const declared = tag.declaredDice ? parseDiceNotation(tag.declaredDice) : null;
    const notation = declared ? clampParsedDiceToLimits(declared) : null;
    const resolution = tag.declaredResolution ?? "sum";
    const sparse = (reason: string, extras?: SkillCheckTagExtras) => {
      reportUnresolved(`${tag.skill} (${tag.declaredDice ?? "no dice declared"})`, reason);
      return serializeSparseSkillCheckTag({ ...tag, preRolledD20: undefined }, extras);
    };
    if (
      !notation ||
      (resolution !== "sum" && resolution !== "successes") ||
      tag.dc === undefined ||
      !Number.isSafeInteger(tag.dc) ||
      tag.dc < 1
    )
      return sparse("The declared dice or resolution cannot be rolled; no outcome has been determined.");

    const attributes = new Map(
      readGmTagAttributes(body).map((attribute) => [
        attribute.key.toLowerCase(),
        attribute.rawValue.replace(/^["']|["']$/g, ""),
      ]),
    );
    if (Number(attributes.get("dc")) !== tag.dc) return sparse("The check needs a valid difficulty.");
    const threshold = Number(attributes.get("threshold"));
    if (
      resolution === "successes" &&
      (!Number.isSafeInteger(threshold) || threshold < 1 || threshold > notation.sides || notation.modifier !== 0)
    ) {
      // A pool without its per-die threshold has no defined counting rule.
      // Keep the request, but never keep numbers the model invented for it.
      return sparse("Success pools need a per-die threshold within the die range and no modifier.");
    }

    const declaredRolls = attributes.get("rolls")?.split(/[|,]/).map(Number);

    // ── The sighted pool, for a declared non-d20 check ──
    // The engine COMPUTES this record rather than checking it: it spends the next
    // unconsumed values of the declared size in reading order, bounds the DC — which this
    // path has never bounded for a written tag — and re-serializes. What the model wrote
    // in pool= and rolls= is compared and never obeyed.
    let poolResult: DiceRollResult | null = null;
    let poolName: string | undefined;
    let boundedDc = tag.dc;
    if (pool && tag.poolDeclared) {
      const spent = spendPoolForNotation(
        pool,
        notation,
        `${tag.skill} (${tag.declaredDice ?? "no dice"})`,
        poolTagIndex++,
      );
      // The per-die threshold rides along: without it a success pool has no counting rule,
      // and every later reader would refuse the ask instead of rolling it.
      if (!spent)
        return sparse("The pool held no value for this check; no outcome has been determined.", {
          threshold: tag.threshold,
        });
      pool.audit(spent.spent, {
        ...(tag.poolRaw !== undefined ? { rawPool: tag.poolRaw } : {}),
        ...(tag.poolSlots ? { slots: tag.poolSlots.slots } : {}),
        ...(declaredRolls ? { values: declaredRolls.filter((value) => Number.isFinite(value)) } : {}),
      });
      poolResult = spent.result;
      poolName = spent.name;
      // A success pool's DC is a count of successes, so its ceiling is the dice thrown;
      // a summed check keeps the endpoint's own bound. Neither existed here before.
      const ceiling = resolution === "successes" ? Math.max(1, notation.count) : SKILL_CHECK_MAX_DC;
      boundedDc = Math.min(ceiling, Math.max(SKILL_CHECK_MIN_DC, Math.round(tag.dc)));
    }

    const known = poolResult
      ? undefined
      : knownRolls.find((candidate) => {
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
    const result = poolResult ?? known ?? roll(notation.notation);
    if (!known) rolled++;
    const dice = parseDiceNotation(result.notation)!;
    const total = resolution === "successes" ? result.rolls.filter((value) => value >= threshold).length : result.total;
    const check: SkillCheckResult = {
      skill: tag.skill,
      dc: boundedDc,
      rolls: result.rolls,
      usedRoll: resolution === "successes" ? total : result.total - result.modifier,
      modifier: result.modifier,
      total,
      success: total >= boundedDc,
      criticalSuccess: false,
      criticalFailure: false,
      rollMode: "normal",
      resolution,
      dice: dice.dice,
      // The threshold this path counted with rides on the result itself now, so the dice card can
      // mark the dice that counted and the serializer writes `threshold=` from one place.
      ...(resolution === "successes" ? { threshold } : {}),
    };
    checkResults.push(check);
    if (pool && poolResult) logPoolDcFit(pool, boundedDc, check.usedRoll, check.modifier);
    // `threshold=` is written by the serializer now rather than spliced onto a finished
    // tag by this caller, so the two spellings of the same attribute cannot drift. The
    // bytes are the ones this path has always written.
    return serializeResolvedSkillCheckTag(check, { ...(poolName ? { pool: poolName } : {}) });
  });
  return { content: resolved, diceRolls, checkResults, rolled, unresolved };
}

/**
 * Spend the pool for one NdM notation, or refuse the whole tag.
 *
 * Refuse, never partially spend: a tag that narrated three of the four dice it declared
 * would be the engine inventing the shape of a roll, and the queue's own accounting would
 * disagree with what the turn reported. An unpooled size is the same refusal — the
 * grammar allows a hundred dice of a thousand sides and pre-loading that space is not
 * possible, so `7d13` is an overflow rather than a pool miss.
 */
function spendPoolForNotation(
  pool: GameDicePoolSession,
  notation: ParsedDiceNotation,
  detail: string,
  tagIndex: number,
): { result: DiceRollResult; name: string; spent: GameDicePoolConsumption[] } | null {
  const size = pooledSizeForNotation(notation.sides);
  if (!size) {
    pool.recordOverflow(`d${notation.sides} is not a pooled size`, detail);
    return null;
  }
  const spent = pool.spend(size, notation.count, tagIndex);
  if (!spent) {
    pool.recordOverflow(`no ${size} value left`, detail);
    return null;
  }
  const rolls = spent.map((entry) => entry.value);
  return {
    result: {
      notation: notation.notation,
      rolls,
      modifier: notation.modifier,
      total: rolls.reduce((sum, value) => sum + value, 0) + notation.modifier,
    },
    name: formatPoolSlotName(
      size,
      spent.map((entry) => entry.slot),
    ),
    spent,
  };
}

/**
 * The pool's `[dice:]` arm: spend the declared dice, write the engine's own record with
 * the slot named on it, and report an overflow as the bare request it started as.
 *
 * On overflow nothing is rolled and nothing is written. No value exists, the engine
 * cannot invent one, and by the one-request guarantee it must not send a second request
 * to obtain one — so the tag goes back to the bare ask and the number is owed to the
 * next turn.
 */
function resolvePoolDiceTag(
  pool: GameDicePoolSession,
  poolBody: { notation: ParsedDiceNotation; raw: string; slots: GameDicePoolSlotName | null },
  body: string,
  diceRolls: DiceRollResult[],
  countRoll: () => void,
  tagIndex: number,
): string {
  const notation = clampParsedDiceToLimits(poolBody.notation);
  const spent = spendPoolForNotation(pool, notation, body, tagIndex);
  if (!spent) return `[dice: ${notation.notation}]`;
  pool.audit(spent.spent, {
    rawPool: poolBody.raw,
    ...(poolBody.slots ? { slots: poolBody.slots.slots } : {}),
    values: readRecordedDiceValues(body),
  });
  diceRolls.push(spent.result);
  countRoll();
  return serializeDiceRecord(spent.result, spent.name);
}

/** The per-die numbers the model wrote inside a `[dice: NdM = T (a + b)]` record. */
function readRecordedDiceValues(body: string): number[] {
  const inside = /\(([^)]*)\)/u.exec(body)?.[1];
  if (!inside) return [];
  return inside
    .split("+")
    .map((entry) => Number.parseInt(entry.trim(), 10))
    .filter((entry) => Number.isFinite(entry));
}
