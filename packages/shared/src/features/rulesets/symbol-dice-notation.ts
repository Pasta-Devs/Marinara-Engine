// ──────────────────────────────────────────────
// Named symbol dice: "2 ability 1 proficiency vs 2 difficulty"
//
// A `symbol-pool` ruleset (Capability API 1.141) declares dice whose faces carry symbols. Its
// checks build the pool from the sheet (`rollSymbolPoolCheck`); this reads a pool someone names
// outright, so `/roll`, composer dice and the `roll_dice` tool can throw the same dice. Nothing
// here reads the sheet, upgrades a die or changes the ruleset format.
// ──────────────────────────────────────────────

import type { RulesetResolutionDeclaration } from "../../schemas/ruleset.schema.js";
import type { DiceRollResult } from "../../types/game.js";
import type { DieRoller } from "../../utils/dice-notation.js";

type SymbolPoolResolution = Extract<RulesetResolutionDeclaration, { kind: "symbol-pool" }>;

/** The longest notation read, and the most dice it may name in all. */
export const SYMBOL_DICE_NOTATION_MAX_LENGTH = 200;
export const SYMBOL_DICE_MAX_DICE = 40;

/** One named die and how many of it, in the order the notation named them. */
export interface SymbolDiceTerm {
  die: string;
  count: number;
}

/** A roll of named symbol dice as a dice card and a tool result carry it. */
export type SymbolDiceRollResult = DiceRollResult &
  Required<Pick<DiceRollResult, "thrown" | "symbols" | "symbolLabels" | "symbolFaces" | "success">>;

function symbolPool(resolution: RulesetResolutionDeclaration | null | undefined): SymbolPoolResolution | null {
  return resolution?.kind === "symbol-pool" ? resolution : null;
}

/** Read `2 ability 1 proficiency vs 2 difficulty` against a symbol-pool ruleset's dice. Terms are
 *  a count and a die's id or label (any case, a trailing "s" allowed), apart by spaces, commas, `+`
 *  or `vs`. Null for any other resolution, an unknown die, or past the limits. */
export function parseSymbolDiceNotation(
  resolution: RulesetResolutionDeclaration | null | undefined,
  notation: string,
): SymbolDiceTerm[] | null {
  const pool = symbolPool(resolution);
  const text = notation.trim().toLowerCase();
  if (!pool || !text || text.length > SYMBOL_DICE_NOTATION_MAX_LENGTH) return null;
  const names = new Map<string, string>();
  for (const die of pool.dice) {
    for (const name of [die.id, die.label]) {
      const key = name.trim().toLowerCase().replace(/\s+/g, " ");
      if (!names.has(key)) names.set(key, die.id);
    }
  }
  const terms: SymbolDiceTerm[] = [];
  let total = 0;
  for (const part of text.split(/\s*(?:,|\+|\bvs\.?(?=\s|\d|$)|\bagainst\b)\s*|\s+(?=\d)/)) {
    if (!part) continue;
    const match = /^(\d{1,3})\s*(.+)$/.exec(part);
    if (!match) return null;
    const count = Number(match[1]);
    const name = match[2]!.replace(/\s+/g, " ");
    const die = names.get(name) ?? (name.endsWith("s") ? names.get(name.slice(0, -1)) : undefined);
    if (!die || count < 1) return null;
    total += count;
    if (total > SYMBOL_DICE_MAX_DICE) return null;
    const named = terms.find((term) => term.die === die);
    if (named) named.count += count;
    else terms.push({ die, count });
  }
  return terms.length ? terms : null;
}

/** Throw the named dice, count their symbols and cancel pairs the way a symbol-pool check does
 *  (`rollSymbolPoolCheck`): `counts` adds its symbol before cancellation, then `cancels` pairs
 *  come off one for one. `total` is the net success symbol, and `success` whether it met the
 *  ruleset's `success.needed`. */
export function rollSymbolDice(
  resolution: RulesetResolutionDeclaration,
  notation: string,
  terms: readonly SymbolDiceTerm[],
  roll: DieRoller,
): SymbolDiceRollResult | null {
  const pool = symbolPool(resolution);
  if (!pool) return null;
  const dieById = new Map(pool.dice.map((die) => [die.id, die]));
  const counted = new Map<string, number>();
  const thrown: string[] = [];
  const rolls: number[] = [];
  const symbolFaces: string[][] = [];
  for (const term of terms) {
    const die = dieById.get(term.die);
    if (!die) return null;
    for (let index = 0; index < term.count; index++) {
      const face = roll(die.faces.length);
      const symbols = die.faces[face - 1] ?? [];
      thrown.push(die.label);
      rolls.push(face);
      symbolFaces.push([...symbols]);
      for (const symbol of symbols) counted.set(symbol, (counted.get(symbol) ?? 0) + 1);
    }
  }
  const totals = new Map(counted);
  for (const symbol of pool.symbols) {
    if (symbol.counts) totals.set(symbol.counts, (totals.get(symbol.counts) ?? 0) + (counted.get(symbol.id) ?? 0));
  }
  for (const symbol of pool.symbols) {
    if (!symbol.cancels) continue;
    const pair = Math.min(totals.get(symbol.id) ?? 0, totals.get(symbol.cancels) ?? 0);
    totals.set(symbol.id, (totals.get(symbol.id) ?? 0) - pair);
    totals.set(symbol.cancels, (totals.get(symbol.cancels) ?? 0) - pair);
  }
  const net = Math.max(0, totals.get(pool.success.symbol) ?? 0);
  return {
    notation: notation.trim(),
    rolls,
    modifier: 0,
    total: net,
    success: net >= pool.success.needed,
    thrown,
    symbols: Object.fromEntries([...totals].filter(([, count]) => count > 0)),
    symbolLabels: Object.fromEntries(pool.symbols.map((symbol) => [symbol.id, symbol.label])),
    symbolFaces,
  };
}

/** Read and throw named symbol dice in one step; null when the notation does not name them. */
export function rollSymbolDiceNotation(
  resolution: RulesetResolutionDeclaration | null | undefined,
  notation: string,
  roll: DieRoller,
): SymbolDiceRollResult | null {
  const terms = parseSymbolDiceNotation(resolution, notation);
  return terms && resolution ? rollSymbolDice(resolution, notation, terms, roll) : null;
}

const SYMBOL_TEXT_MAX = 80;

function isShortText(value: unknown): value is string {
  return typeof value === "string" && value.length <= SYMBOL_TEXT_MAX;
}

/** Whether a stored roll's symbol fields read as a symbol roll of `length` dice: all four or none,
 *  one die label and one face per die, symbol counts whole and positive. */
export function isDiceRollSymbols(
  value: Pick<DiceRollResult, "thrown" | "symbols" | "symbolLabels" | "symbolFaces">,
  length: number,
): boolean {
  const { thrown, symbols, symbolLabels, symbolFaces } = value as Record<string, unknown>;
  if (thrown === undefined && symbols === undefined && symbolLabels === undefined && symbolFaces === undefined) {
    return true;
  }
  const isRecord = (candidate: unknown): candidate is Record<string, unknown> =>
    !!candidate && typeof candidate === "object" && !Array.isArray(candidate);
  return (
    Array.isArray(thrown) &&
    thrown.length === length &&
    thrown.every(isShortText) &&
    Array.isArray(symbolFaces) &&
    symbolFaces.length === length &&
    symbolFaces.every((face) => Array.isArray(face) && face.length <= 3 && face.every(isShortText)) &&
    isRecord(symbols) &&
    Object.values(symbols).every((count) => Number.isSafeInteger(count) && (count as number) > 0) &&
    isRecord(symbolLabels) &&
    Object.values(symbolLabels).every(isShortText)
  );
}
