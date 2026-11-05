// The dice a ruleset fight is made of, and the one place they are read out of text.
//
// Its own module so a creature, a party member's attack row and a turn in progress all throw dice
// the same way, without the bestiary having to reach into the encounter or the other way round.

import { seededDieRoller } from "../../utils/dice-notation.js";
import type { RulesetCombatAmount, RulesetCombatRoller } from "./types.js";

/** The seeded roller a server uses: the tactical engine's own stream, one die per tick, so a fight
 *  replays from its seed and the choices that were made. A caller that has its own dice (a test
 *  with a written sequence) passes those instead. */
export function rulesetCombatRoller(seed: number, cursor: number): RulesetCombatRoller {
  return seededDieRoller(seed, cursor);
}

/** A face this die actually has. A roller that hands back something else is a caller's bug, and it
 *  costs that one die rather than the fight. */
function face(value: number, sides: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(sides, Math.max(1, Math.floor(value)));
}

/** Throw `count` dice, in order. */
export function rollRulesetDice(roll: RulesetCombatRoller, count: number, sides: number): number[] {
  const rolls: number[] = [];
  for (let i = 0; i < Math.max(0, Math.min(100, Math.floor(count))); i++) rolls.push(face(roll(sides), sides));
  return rolls;
}

/** How many uses one item of its stack has in all (1.536): its `rolled` dice where it has them, thrown
 *  once for that stack and the same at every reading after (each die's face from the stack's id and
 *  the use's place), never past `max`; otherwise `max`. A Helm of Brilliance's 1d10 diamonds. */
export function rulesetOwnUsesMax(
  uses: { max: number; rolled?: string },
  stackId: string | undefined,
  place: number | string,
  /** Its item's `moreUsesRolled` (1.746): its count is how many of the pieces rolled for the stack
   *  were picked for it, none at all where none was. A Necklace of Prayer Beads' beads. */
  rolledKinds?: { dice: string; weights: readonly number[] },
): number {
  if (rolledKinds && typeof place === "number") {
    const pieces = rulesetRolledPieces(rolledKinds, stackId);
    return Math.min(uses.max, pieces.filter((kind) => kind === place - 1).length);
  }
  const dice = uses.rolled ? parseRulesetCombatDice(uses.rolled) : null;
  if (!dice) return uses.max;
  let total = dice.flat;
  for (let at = 0; at < dice.count; at++) {
    // FNV-1a over what names this die, so each stack keeps the count it was made with.
    let hash = 0x811c9dc5;
    for (const char of `${stackId ?? ""}:${place}:${at}`) hash = Math.imul(hash ^ char.charCodeAt(0), 0x01000193) >>> 0;
    total += 1 + (hash % Math.max(1, dice.sides));
  }
  return Math.max(1, Math.min(uses.max, total));
}

/** The place in `moreUses` (from 0) of the further use whose count one spends (1.747), by its
 *  `usesOf` label: one that counts its own. -1 where there is none. */
export function rulesetMoreUsesOf(
  item: { moreUses?: ReadonlyArray<{ label: string; uses?: unknown; usesOf?: string }> },
  more: { usesOf?: string },
): number {
  const wanted = more.usesOf?.trim().toLowerCase();
  if (!wanted) return -1;
  return (item.moreUses ?? []).findIndex(
    (one) => one !== more && !!one.uses && !one.usesOf && one.label.trim().toLowerCase() === wanted,
  );
}

/** The pieces rolled for one stack of an item with `moreUsesRolled` (1.746), each the place (from 0) of
 *  the further use it was picked for: the count thrown and each pick made from the stack's id, so the
 *  stack keeps what it was made with. */
export function rulesetRolledPieces(
  rolled: { dice: string; weights: readonly number[] },
  stackId: string | undefined,
): number[] {
  const dice = parseRulesetCombatDice(rolled.dice);
  const total = rolled.weights.reduce((sum, weight) => sum + Math.max(0, weight), 0);
  if (!dice || total <= 0) return [];
  // FNV-1a over what names each throw, as a stack's own uses are rolled.
  const face = (name: string, sides: number) => {
    let hash = 0x811c9dc5;
    for (const char of `${stackId ?? ""}:${name}`) hash = Math.imul(hash ^ char.charCodeAt(0), 0x01000193) >>> 0;
    return 1 + (hash % Math.max(1, sides));
  };
  let count = dice.flat;
  for (let at = 0; at < dice.count; at++) count += face(`pieces:${at}`, dice.sides);
  const pieces: number[] = [];
  for (let piece = 0; piece < Math.max(0, Math.min(100, count)); piece++) {
    let pick = face(`piece:${piece}`, total);
    const kind = rolled.weights.findIndex((weight) => (pick -= Math.max(0, weight)) <= 0);
    pieces.push(kind);
  }
  return pieces;
}

/** What a stack of an item with charges starts with (1.573): its `rolled` dice where it has them,
 *  thrown once for that stack as its own uses' are (none below 0, none past `max`); otherwise `max`.
 *  A Rod of Absorption's 1d10. */
export function rulesetChargesStart(charges: { rolled?: string }, max: number, stackId: string | undefined): number {
  if (!charges.rolled) return max;
  const dice = parseRulesetCombatDice(charges.rolled);
  if (!dice) return max;
  let total = dice.flat;
  for (let at = 0; at < dice.count; at++) {
    let hash = 0x811c9dc5;
    for (const char of `${stackId ?? ""}:charges:${at}`) hash = Math.imul(hash ^ char.charCodeAt(0), 0x01000193) >>> 0;
    total += 1 + (hash % Math.max(1, dice.sides));
  }
  return Math.max(0, Math.min(max, total));
}

/** What a stack of an item that stores is found holding (1.576): its `found.levels` dice, thrown once
 *  for that stack as its rolled charges are (never past what it holds), filled out of `found.from` in
 *  an order drawn for that stack too, each that still fits, up to how many it holds. */
export function rulesetFoundStored(
  stores: {
    levels: number;
    count?: number;
    found?: { levels: string; from: ReadonlyArray<{ entry: string; level: number; label?: string }> };
  },
  stackId: string | undefined,
): Array<{ entry: string; level: number; label?: string }> {
  const found = stores.found;
  if (!found) return [];
  const dice = parseRulesetCombatDice(found.levels);
  if (!dice) return [];
  const face = (place: string, sides: number) => {
    let hash = 0x811c9dc5;
    for (const char of `${stackId ?? ""}:${place}`) hash = Math.imul(hash ^ char.charCodeAt(0), 0x01000193) >>> 0;
    return hash % Math.max(1, sides);
  };
  let left = dice.flat;
  for (let at = 0; at < dice.count; at++) left += 1 + face(`found:${at}`, dice.sides);
  left = Math.max(0, Math.min(stores.levels, left));
  const order = found.from
    .map((one, at) => ({ one, key: face(`found-order:${at}`, 0x7fffffff) }))
    .sort((a, b) => a.key - b.key)
    .map((pair) => pair.one);
  const held: Array<{ entry: string; level: number; label?: string }> = [];
  const most = stores.count ?? 20;
  for (const one of order) {
    if (held.length >= most || left < 1) break;
    if (one.level > left) continue;
    held.push({ entry: one.entry, level: one.level, ...(one.label ? { label: one.label } : {}) });
    left -= one.level;
  }
  return held;
}

export function sumOf(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

/** `2d6`, `1d8+3` or a plain number, as a sheet's dice column happens to hold it. A dice column is
 *  free text, so anything else reads as no dice at all rather than failing a turn. */
export function parseRulesetCombatDice(text: unknown): RulesetCombatAmount | null {
  // A dice column is short by its own schema; anything longer is not dice, and saying so first
  // keeps every pattern below on a string of bounded length.
  if (typeof text !== "string" || text.length > 40) return null;
  // Spaces are allowed around the parts ("2d6 + 3") and nowhere inside a number ("1 2d6" is not
  // twelve dice), so the parts are split on the letter and the sign rather than matched with a
  // pattern full of optional whitespace.
  const trimmed = text.trim();
  const split = /^([^dD]*)[dD]([^+-]*)([+-].*)?$/.exec(trimmed);
  const whole = (part: string | undefined, max: number) => {
    const digits = (part ?? "").trim();
    return /^\d+$/.test(digits) && digits.length <= max ? Number(digits) : null;
  };
  const count = split ? whole(split[1], 3) : null;
  const sides = split ? whole(split[2], 4) : null;
  const bonus = split?.[3] ? whole(split[3].slice(1), 4) : 0;
  if (!split || count === null || sides === null || bonus === null) {
    const flat = Number(trimmed);
    return trimmed !== "" && Number.isFinite(flat) && flat !== 0
      ? { count: 0, sides: 0, flat: Math.trunc(flat) }
      : null;
  }
  return { count, sides, flat: split[3]?.startsWith("-") ? -bonus : bonus };
}

/** The average of a roll. Never a future die: the expected amount, as it stands. */
export function rulesetAverageAmount(amount: { count: number; sides: number; flat: number }): number {
  // A flat amount written without dice (`{ flat: 1 }`) averages to its flat part, never NaN.
  const dice = amount.count > 0 && amount.sides > 0 ? amount.count * ((amount.sides + 1) / 2) : 0;
  return dice + (amount.flat ?? 0);
}

/**
 * What a whole blow averages: its first amount and every clause on it.
 *
 * A clause with a save of its own is counted IN FULL, because a forecast says what a blow would do,
 * not what a die nobody has thrown might take off it: the same reading the first amount gets when
 * the action itself asks for a save.
 */
export function rulesetAverageDamage(damage: {
  count: number;
  sides: number;
  flat: number;
  plus?: ReadonlyArray<{
    count: number;
    sides: number;
    flat: number;
    targetIs?: unknown;
    onCritical?: true;
    whileOn?: number;
  }>;
}): number {
  // A clause dealt only to some targets (1.168) or only on a critical hit (1.169) is not part of what
  // the blow does to anyone.
  return (damage.plus ?? [])
    .filter((clause) => !clause.targetIs && !clause.onCritical && clause.whileOn === undefined)
    .reduce((total, clause) => total + rulesetAverageAmount(clause), rulesetAverageAmount(damage));
}
