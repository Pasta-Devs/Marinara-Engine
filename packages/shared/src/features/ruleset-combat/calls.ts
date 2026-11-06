/**
 * Creatures called into a fight (Capability API 1.325): the Owed's Jars Burst, two Unreaped
 * zombies; Shelves Lean's specters. Built as the fight built its own, on their caller's side, set
 * down in the area the call was aimed at or as near it as they fit (beside their caller without
 * one), and given their turns: their own initiative, or right after their caller.
 */
import { createRulesetEncounter, rulesetFitCell } from "./encounter.js";
import { rulesetFootprint, rulesetFootprintAt, rulesetPositionOf, rulesetSpanOf } from "./grid.js";
import type {
  RulesetCombatAction,
  RulesetCombatCell,
  RulesetCombatRoller,
  RulesetCombatant,
  RulesetEncounterState,
} from "./types.js";
import type { RulesetDefinition } from "../../schemas/ruleset.schema.js";

/** The most a fight holds once anybody has been called into it. */
export const RULESET_CALLED_FIGHT_MAX = 40;

/** The most one call brings (1.403). */
export const RULESET_CALL_MAX = 32;

/**
 * Calls `count` of the action's creatures into the fight, beside or among `cells`: the ids of those
 * who came. None come once the fight holds as many as it may.
 */
export function rulesetCallCreatures(
  definition: RulesetDefinition,
  state: RulesetEncounterState,
  caller: RulesetCombatant,
  action: RulesetCombatAction,
  count: number,
  roll: RulesetCombatRoller,
  cells?: readonly RulesetCombatCell[],
  /** Only on `cells` (1.621): none set down anywhere else, so those with no cell left do not come. */
  only = false,
): string[] {
  const calls = action.calls;
  if (!calls) return [];
  const room = Math.max(0, RULESET_CALLED_FIGHT_MAX - state.combatants.length);
  // As many as Conjure Animals calls at 9th level (1.403): eight, four times over.
  const coming = Math.min(Math.max(0, Math.floor(count)), room, RULESET_CALL_MAX);
  if (coming === 0) return [];
  const same = state.combatants.filter((one) => one.calledBy && one.name.startsWith(calls.name)).length;
  const entries = Array.from({ length: coming }, (_, index) => {
    do state.called = (state.called ?? 0) + 1;
    while (state.combatants.some((one) => one.id === `called-${state.called}`));
    return {
      id: `called-${state.called}`,
      name: coming + same > 1 ? `${calls.name} ${same + index + 1}` : calls.name,
      side: "enemy" as const,
      block: structuredClone(calls.block),
    };
  });
  // Where each is set down: in the area first, then as near its middle (or the caller) as fits.
  const grid = state.board?.grid;
  const placements: Record<string, RulesetCombatCell> = {};
  if (grid) {
    const taken = new Set(
      state.combatants
        .filter((one) => !one.defeated || one.object)
        .flatMap((one) => rulesetFootprint(one))
        .map((cell) => `${cell.x},${cell.y}`),
    );
    const near = cells?.length ? cells[Math.floor(cells.length / 2)]! : rulesetPositionOf(caller);
    for (const entry of entries) {
      const inside = (cells ?? []).find((cell) => {
        const fit = rulesetFitCell(grid, cell, 1, taken);
        return fit?.x === cell.x && fit.y === cell.y;
      });
      const at = inside ?? (near && !only ? rulesetFitCell(grid, near, 1, taken) : null);
      if (!at) continue;
      placements[entry.id] = at;
      taken.add(`${at.x},${at.y}`);
    }
  }
  const built = createRulesetEncounter({
    definition,
    seed: state.seed,
    roller: roll,
    combatants: entries,
    ...(grid ? { board: { grid: structuredClone(grid), placements } } : {}),
  });
  // Set down again by the room all of each one needs, the biggest first, clear of everybody already
  // in the fight (cloud AI fights 2026-10-25: eight Draft Horses called by Conjure Animals were set
  // down by one cell each, and a Large one stood on the Gladiator it was called to fight).
  if (grid) {
    const taken = new Set(
      state.combatants
        .filter((one) => !one.defeated || one.object)
        .flatMap((one) => rulesetFootprint(one))
        .map((cell) => `${cell.x},${cell.y}`),
    );
    const placed = built.combatants.filter((one) => placements[one.id] && rulesetPositionOf(one));
    for (const combatant of [...placed].sort((a, b) => rulesetSpanOf(b) - rulesetSpanOf(a))) {
      const span = rulesetSpanOf(combatant);
      const inArea = (at: { x: number; y: number }) => (cells ?? []).some((cell) => cell.x === at.x && cell.y === at.y);
      let at = rulesetFitCell(grid, { x: combatant.x!, y: combatant.y! }, span, taken);
      // Where the nearest room falls outside the area, any room inside it, in the area's own order
      // (Ruleset 0.435 proof 2026-10-25: of Giant Insect's three Large spiders, one was dropped).
      if (only && (!at || !inArea(at)))
        at =
          (cells ?? []).find((cell) => {
            const fit = rulesetFitCell(grid, cell, span, taken);
            return fit?.x === cell.x && fit.y === cell.y;
          }) ?? null;
      if (!at || (only && !inArea(at))) {
        delete placements[combatant.id];
        continue;
      }
      combatant.x = at.x;
      combatant.y = at.y;
      for (const cell of rulesetFootprintAt(at, span)) taken.add(`${cell.x},${cell.y}`);
    }
  }
  const came: RulesetCombatant[] = [];
  for (const combatant of built.combatants) {
    // On a board, only those it found room for.
    if (grid && !placements[combatant.id]) continue;
    combatant.side = caller.side;
    combatant.calledBy = caller.id;
    // What called it (1.533), for a zone that sets aside what entries of its catalog call.
    if (action.catalog) combatant.calledFrom = action.catalog;
    combatant.creature = { ...calls.creature };
    // Called kin that cannot call kin of their own (1.446).
    if (calls.cantCall) {
      combatant.actions = combatant.actions.filter(
        (one) =>
          !one.calls &&
          !one.callsOf &&
          !one.callChoice &&
          !one.modes?.some((mode) => mode.call) &&
          !(one.switches && "called" in one.switches),
      );
    }
    state.combatants.push(combatant);
    came.push(combatant);
  }
  // Their turns: after everybody at their count or above it, or right after their caller. A place
  // this round's turn has passed is next round's.
  const order = state.order;
  for (const combatant of came) {
    // An object takes no turn (1.479).
    if (calls.turnless) {
      combatant.turnless = true;
      continue;
    }
    let place: number;
    if (calls.after) {
      combatant.initiative = caller.initiative;
      combatant.initiativeModifier = caller.initiativeModifier;
      const last = order.lastIndexOf(caller.id);
      place = last < 0 ? order.length : last + 1;
      // Those called before it by the same caller go first.
      while (place < order.length && state.combatants.find((one) => one.id === order[place])?.calledBy === caller.id) {
        place += 1;
      }
    } else {
      place = order.findIndex((id) => {
        const there = state.combatants.find((one) => one.id === id);
        return !!there && there.initiative < combatant.initiative;
      });
      if (place < 0) place = order.length;
    }
    order.splice(place, 0, combatant.id);
    if (place <= state.turn) state.turn += 1;
    // A turn put in after another (1.320) is where it was.
    if (state.interjected !== undefined && place <= state.interjected) state.interjected += 1;
  }
  return came.map((combatant) => combatant.id);
}

/** Where the turn that was `before`'s stands in `after`'s order, once anybody called has joined it
 *  (1.325): the same turn, however many were set in front of it. */
export function rulesetTurnAfterCalls(before: RulesetEncounterState, after: RulesetEncounterState): number {
  const was = new Set(before.order);
  let passed = 0;
  for (let index = 0; index < after.order.length; index += 1) {
    if (!was.has(after.order[index]!)) continue;
    if (passed === before.turn) return index;
    passed += 1;
  }
  return before.turn;
}
