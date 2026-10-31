// The board, for a fight the ruleset resolves itself.
//
// Pure geometry over the tactical engine's OWN grid: this slice adds no second generator and no
// second terrain table. What it does add is the way a tabletop grid is actually played, which is
// not how the Engine's own tactical fights move: eight neighbours at one step each, distance as the
// larger of the two axis differences, and real burst, cone and line shapes instead of one radius.
//
// Every number in here is in CELLS. Turning a ruleset's own distance into cells happens once, when
// the fight is built, through `rulesetInCells`.

import { TERRAIN_DATA, type TacticalGrid } from "../tactical-combat/types.js";
import { blocksSight, climbCost, elevationAt, hasLineOfSight } from "../tactical-combat/math.js";
import type { RulesetCombat, RulesetDefinition } from "../../schemas/ruleset.schema.js";
import { rulesetActionDropped, rulesetShotsAvailable } from "./ammo.js";
import { rulesetAbilityModifier } from "../rulesets/sheet-math.js";
import {
  rulesetAbilityScore,
  rulesetActiveConditions,
  rulesetCombatant,
  rulesetCombatEffects,
  rulesetCombatStanding,
  rulesetSealedApart,
  rulesetSizeRank,
  rulesetTargetIs,
} from "./encounter.js";
import type {
  RulesetBlowKind,
  RulesetMoveMode,
  RulesetCombatAction,
  RulesetCombatant,
  RulesetCombatArea,
  RulesetCombatCell,
  RulesetCombatZone,
  RulesetEncounterState,
  RulesetReachableCell,
} from "./types.js";

/** The eight neighbours, in a fixed order so the same board always produces the same paths. */
const STEPS: ReadonlyArray<readonly [number, number]> = [
  [0, -1],
  [1, -1],
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
];

/** How far a search may ever look, whatever a ruleset asks for. A board is at most 64 by 64 and a
 *  cell costs at least one, so nothing legitimate reaches this.
 *  ponytail: a flat ceiling rather than a budget worked out from the board. The upgrade path is to
 *  bound it by the grid's own area if a ruleset ever declares a speed this large. */
const MOVEMENT_CEILING = 512;

/**
 * A distance in the ruleset's own unit, in cells. A cell is the smallest step there is, so anything
 * an author bothered to give a number to reaches at least one: a touch is one cell when it is aimed
 * at somebody else, exactly as the older bridge's `inCells` already reads one.
 */
export function rulesetInCells(distance: number, perCell: number): number {
  if (!(perCell > 0) || !Number.isFinite(distance)) return 1;
  return Math.max(1, Math.round(distance / perCell));
}

/** How far apart two cells are: the larger of the two axis differences, because a step sideways and
 *  a step corner-wise cost the same on the grids this is for. */
export function rulesetCellDistance(a: RulesetCombatCell, b: RulesetCombatCell): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

/** Whether both of them are standing somewhere, which is what makes a fight positioned for them. */
export function rulesetPositionOf(combatant: RulesetCombatant | undefined): RulesetCombatCell | null {
  if (!combatant || typeof combatant.x !== "number" || typeof combatant.y !== "number") return null;
  return { x: combatant.x, y: combatant.y };
}

/** What a condition's behavior is measured from (1.264): whoever put it on, standing on the board and
 *  not its holder; or, `from` the point (1.457), where it was put on from, as one cell standing there;
 *  or where it was last `steered` (1.464).
 *  Nothing when there is nothing to measure from. */
export function rulesetBehaviorAnchor(
  state: RulesetEncounterState,
  holder: RulesetCombatant,
  condition: string,
  behavior: { from?: "point" | "steered" } | undefined,
): RulesetCombatant | undefined {
  const tracked = holder.tracked.find((entry) => entry.condition === condition);
  if ((behavior?.from === "point" || behavior?.from === "steered") && tracked?.at) {
    return { id: "", x: tracked.at.x, y: tracked.at.y } as unknown as RulesetCombatant;
  }
  // Steered (1.464): nothing to measure from until it has been.
  if (behavior?.from === "steered") return undefined;
  const source = tracked?.source ? rulesetCombatant(state, tracked.source) : undefined;
  return source && source.id !== holder.id && rulesetPositionOf(source) && rulesetCombatStanding(source)
    ? source
    : undefined;
}

/** How many cells a side somebody fills (1.194): one unless their size says more. */
export function rulesetSpanOf(combatant: { span?: number } | undefined): number {
  const span = combatant?.span;
  return typeof span === "number" && Number.isInteger(span) && span > 1 ? Math.min(span, 6) : 1;
}

/** How somebody fits into a cell their whole space does not, between walls (1.681): as small as a
 *  condition's `squeezesAs` says, freely, or squeezed to the size below their own at `costs` times a
 *  step, holding `condition`. Undefined where they fit whole, or cannot fit even so. */
export function rulesetSqueezeAt(
  definition: RulesetDefinition,
  state: RulesetEncounterState,
  actor: RulesetCombatant,
  cell: RulesetCombatCell,
): { span: number; costs: number; condition?: string } | undefined {
  const combat = definition.combat;
  const grid = state.board?.grid;
  const whole = actor.squeezedFrom ?? rulesetSpanOf(actor);
  if (!combat?.sizes || !grid || whole <= 1) return undefined;
  const solid = (at: RulesetCombatCell) =>
    rulesetCellSolidFor(grid, at.x, at.y, actor) && !rulesetThroughSolid(grid, at.x, at.y, actor);
  if (!rulesetFootprintAt(cell, whole).some(solid)) return undefined;
  const order = combat.sizes.order;
  const ways: Array<{ span: number; costs: number; condition?: string }> = [];
  const as = rulesetActiveConditions(definition, combat, actor, state).find((entry) => entry.squeezesAs)?.squeezesAs;
  const free = as ? order.find((size) => size.id === as) : undefined;
  if (free) ways.push({ span: free.cells ?? 1, costs: 1 });
  const rank = rulesetSizeRank(combat, actor);
  const squeezing = combat.sizes.squeezing;
  if (squeezing && rank !== undefined && rank > 0) {
    ways.push({
      span: order[rank - 1]!.cells ?? 1,
      costs: squeezing.costs,
      ...(squeezing.condition ? { condition: squeezing.condition } : {}),
    });
  }
  return ways.find((way) => way.span < whole && !rulesetFootprintAt(cell, way.span).some(solid));
}

/** Every cell somebody fills (1.194), their own cell the top-left one. Empty off the board. */
export function rulesetFootprint(combatant: RulesetCombatant | undefined): RulesetCombatCell[] {
  const at = rulesetPositionOf(combatant);
  return at ? rulesetFootprintAt(at, rulesetSpanOf(combatant)) : [];
}

/** The cells `span` a side from `at`, its top-left corner (1.194). */
export function rulesetFootprintAt(at: RulesetCombatCell, span: number): RulesetCombatCell[] {
  if (span <= 1) return [{ x: at.x, y: at.y }];
  const cells: RulesetCombatCell[] = [];
  for (let dy = 0; dy < span; dy++) for (let dx = 0; dx < span; dx++) cells.push({ x: at.x + dx, y: at.y + dy });
  return cells;
}

/** Whether somebody fills this cell (1.194). */
export function rulesetFills(combatant: RulesetCombatant | undefined, cell: RulesetCombatCell | null): boolean {
  const at = rulesetPositionOf(combatant);
  if (!at || !cell) return false;
  const span = rulesetSpanOf(combatant);
  return cell.x >= at.x && cell.y >= at.y && cell.x < at.x + span && cell.y < at.y + span;
}

/** How far a cell is from the nearest cell somebody fills (1.194): the cell distance for somebody of
 *  one cell, and nothing at all from a cell they stand in. */
export function rulesetDistanceTo(cell: RulesetCombatCell, combatant: RulesetCombatant | undefined): number {
  return rulesetCellDistance(cell, rulesetNearestCell(combatant, cell) ?? cell);
}

/** The cell somebody fills nearest to `toward` (1.194): their own cell when they fill one. */
export function rulesetNearestCell(
  combatant: RulesetCombatant | undefined,
  toward: RulesetCombatCell | null,
): RulesetCombatCell | null {
  const at = rulesetPositionOf(combatant);
  if (!at || !toward) return at;
  const span = rulesetSpanOf(combatant);
  if (span <= 1) return at;
  const clamp = (value: number, low: number) => Math.min(Math.max(value, low), low + span - 1);
  return { x: clamp(toward.x, at.x), y: clamp(toward.y, at.y) };
}

/** How far apart two people stand on the flat, nearest cell to nearest cell (1.194): a Large ogre
 *  is next to whoever stands beside any of its four cells. */
export function rulesetGap(a: RulesetCombatant | undefined, b: RulesetCombatant | undefined): number {
  const from = rulesetPositionOf(a);
  const to = rulesetPositionOf(b);
  if (!from || !to) return 0;
  return rulesetGapFrom(from, rulesetSpanOf(a), b);
}

/** How far somebody `span` cells a side with their top-left cell at `at` would stand from `b`,
 *  nearest cell to nearest cell (1.194). */
export function rulesetGapFrom(at: RulesetCombatCell, span: number, b: RulesetCombatant | undefined): number {
  const to = rulesetPositionOf(b);
  if (!to) return 0;
  const other = rulesetSpanOf(b);
  const apart = (mine: number, theirs: number) => Math.max(0, theirs - (mine + span - 1), mine - (theirs + other - 1));
  return Math.max(apart(at.x, to.x), apart(at.y, to.y));
}

/** Whether a line runs from any cell one fills to any cell the other does (1.194): whoever of
 *  them is one cell checks exactly the one line it always did. */
export function rulesetFootprintsSee(
  grid: TacticalGrid,
  a: RulesetCombatant | undefined,
  b: RulesetCombatant | undefined,
): boolean {
  const from = rulesetFootprint(a);
  const to = rulesetFootprint(b);
  return from.some((one) => to.some((other) => rulesetLineOfSight(grid, one, other)));
}

function inBounds(grid: TacticalGrid, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < grid.width && y < grid.height;
}

/** Out of bounds reads as solid, so a search can never walk off the board. */
export function rulesetCellBlocked(grid: TacticalGrid, x: number, y: number): boolean {
  if (!inBounds(grid, x, y)) return true;
  const terrain = grid.tiles[y]?.[x];
  return terrain === undefined || !!TERRAIN_DATA[terrain]?.impassable || ((grid.walls?.[`${x},${y}`] ?? 0) & 1) === 1;
}

/** What it costs to step INTO this cell, by the same terrain table the Engine's own fights use. */
export function rulesetCellEnterCost(grid: TacticalGrid, x: number, y: number): number {
  const terrain = grid.tiles[y]?.[x];
  // A saved board can arrive through an import, and a terrain word this Engine does not know must
  // cost an ordinary step rather than throw in the middle of a turn.
  const cost = (terrain === undefined ? undefined : TERRAIN_DATA[terrain]?.moveCost) ?? 1;
  // Growth is hard going (1.318), and does not make hard going harder.
  if (grid.ground?.[`${x},${y}`]?.growth) return Math.max(2, Math.round(cost));
  return Math.max(1, Math.round(cost));
}

/** What the ground under this cell is worth as cover, by the same terrain table. */
export function rulesetCellCover(grid: TacticalGrid, cell: RulesetCombatCell): number {
  const terrain = grid.tiles[cell.y]?.[cell.x];
  return (terrain === undefined ? undefined : TERRAIN_DATA[terrain]?.defenseBonus) ?? 0;
}

/** What one step on foot from a cell into its neighbour costs (combat C6b): entering it, and one more to
 *  climb a level; null for a step of two levels or more either way, which nobody walks. */
export function rulesetStepCost(grid: TacticalGrid, from: RulesetCombatCell, to: RulesetCombatCell): number | null {
  const climb = climbCost(grid, from, to);
  return climb === null ? null : rulesetCellEnterCost(grid, to.x, to.y) + climb;
}

/** How high somebody is, in the board's levels: a flier's altitude while it is up, or the ground under
 *  them (1.114). */
export function rulesetLevelOf(grid: TacticalGrid, combatant: RulesetCombatant): number {
  const ground = typeof combatant.x === "number" ? elevationAt(grid, combatant.x, combatant.y!) : 0;
  return combatant.altitude !== undefined && combatant.altitude > ground ? combatant.altitude : ground;
}

/** Whether a flier is up in the air above the ground under it (1.114). */
export function rulesetAirborne(grid: TacticalGrid | undefined, combatant: RulesetCombatant): boolean {
  if (!grid || combatant.altitude === undefined || typeof combatant.x !== "number") return false;
  return combatant.altitude > elevationAt(grid, combatant.x, combatant.y!);
}

/**
 * How far apart two combatants are, in cells (1.114): the board's own distance, or the height
 * between them when one is up in the air and that is further. Two on the ground are as far apart
 * as their cells, whatever the ground under them, exactly as before anybody flew.
 */
export function rulesetCombatantDistance(
  state: RulesetEncounterState,
  a: RulesetCombatant,
  b: RulesetCombatant,
): number {
  const from = rulesetPositionOf(a);
  const to = rulesetPositionOf(b);
  if (!from || !to) return 0;
  const flat = rulesetGap(a, b);
  const grid = state.board?.grid;
  const levelCells = state.board?.levelCells;
  if (!grid || !levelCells || !(rulesetAirborne(grid, a) || rulesetAirborne(grid, b))) return flat;
  return Math.max(flat, Math.abs(rulesetLevelOf(grid, a) - rulesetLevelOf(grid, b)) * levelCells);
}

/** Whether one combatant sees another (1.118). Nobody sees somebody who has hidden (the Hide
 *  standard action, until it wears off); otherwise it is a line of sight between them on the board,
 *  and a fight with no board, or anybody without a place on it, sees everybody, as a condition gated
 *  on sight reads it. */
export function rulesetSees(
  state: RulesetEncounterState,
  holder: RulesetCombatant,
  other: RulesetCombatant | undefined,
): boolean {
  if (other?.flags.hidden) return false;
  // Hidden from this one for real (1.287).
  if (other && other.id !== holder.id && other.hiding?.from.includes(holder.id)) return false;
  const grid = state.board?.grid;
  if (!grid || !rulesetPositionOf(holder) || !rulesetPositionOf(other)) return true;
  return rulesetFootprintsSee(grid, holder, other);
}

/** How many cells the actor's walk this turn ran straight at the target, ending where the actor stands
 *  now (1.186): counted back from the last step, each one a cell closer to them than the one before.
 *  A step that came no closer ends the run, and so does being moved off the end of the walk. */
export function rulesetChargeRun(actor: RulesetCombatant, target: RulesetCombatant): number {
  const trail = actor.trail;
  const at = rulesetPositionOf(actor);
  const to = rulesetPositionOf(target);
  if (!trail || trail.length < 2 || !at || !to) return 0;
  const last = trail[trail.length - 1]!;
  if (last.x !== at.x || last.y !== at.y) return 0;
  // Measured footprint to footprint (1.194).
  const span = rulesetSpanOf(actor);
  const away = (cell: RulesetCombatCell) => rulesetGapFrom(cell, span, target);
  let run = 0;
  for (let index = trail.length - 1; index > 0; index--) {
    if (away(trail[index]!) !== away(trail[index - 1]!) - 1) break;
    run++;
  }
  return run;
}

/** Whether a blow is struck in reach or from afar (1.118). Something with a reach and no range is
 *  melee and something with a range and no reach is ranged; something with both (a thrown dagger) is
 *  melee while its target stands in its reach, and with no board it is taken as swung in hand. */
export function rulesetBlowKind(
  state: RulesetEncounterState,
  actor: RulesetCombatant,
  target: RulesetCombatant,
  action: { reach?: number; range?: unknown },
): RulesetBlowKind {
  if (!action.range) return "melee";
  if (action.reach === undefined) return "ranged";
  if (!state.board || !rulesetPositionOf(actor) || !rulesetPositionOf(target)) return "melee";
  return rulesetCombatantDistance(state, actor, target) <= Math.max(1, action.reach) ? "melee" : "ranged";
}

/** Whether a cell is water, which nobody walks into and a swimmer or a flier crosses (1.113). */
function isWater(grid: TacticalGrid, x: number, y: number): boolean {
  return inBounds(grid, x, y) && grid.tiles[y]?.[x] === "water";
}

/** What is left this turn of one way of moving, in cells (1.113). Somebody who only walks walks on
 *  what is left of their allowance. */
function modeLeftOf(mover: RulesetCombatant, mode: RulesetMoveMode): number {
  if (!mover.modeLeft) return mode === "walk" ? (mover.movementLeft ?? 0) : 0;
  return mover.modeLeft[mode] ?? 0;
}

/** Whether a cell is solid to this mover, for stepping into it and for squeezing past its corner: water
 *  is not, to a swimmer or a flier (1.113), nor to somebody who runs across it (1.432). */
export function rulesetCellSolidFor(grid: TacticalGrid, x: number, y: number, mover?: RulesetCombatant): boolean {
  if (!rulesetCellBlocked(grid, x, y)) return false;
  return !(
    isWater(grid, x, y) &&
    (!!mover?.speeds?.fly || !!mover?.speeds?.swim || !!mover?.runsAcross || !!mover?.walksOnLiquid)
  );
}

/** Whether this mover may cross a cell here but never stop on it (1.432): water, to somebody who
 *  runs across it and neither swims nor flies. */
export function rulesetOnlyCrosses(grid: TacticalGrid, at: RulesetCombatCell, mover: RulesetCombatant): boolean {
  if (!mover.runsAcross || mover.walksOnLiquid || mover.speeds?.swim || mover.speeds?.fly) return false;
  return rulesetFootprintAt(at, rulesetSpanOf(mover)).some((cell) => isWater(grid, cell.x, cell.y));
}

/** Whether this combatant is under water (1.498): on a tile the ruleset's `underwater.terrain` names,
 *  not up in the air, and no flier without a swim speed. */
export function rulesetUnderwater(
  definition: RulesetDefinition,
  state: RulesetEncounterState | undefined,
  combatant: RulesetCombatant,
): boolean {
  const rule = definition.combat?.underwater;
  const grid = state?.board?.grid;
  if (!rule || !grid || !rulesetPositionOf(combatant) || rulesetAirborne(grid, combatant)) return false;
  if (combatant.speeds?.fly && !combatant.speeds.swim) return false;
  // On the water, not in it (1.529): Water Walk.
  if (combatant.walksOnLiquid) return false;
  return rulesetFootprint(combatant).some((cell) => {
    const tile = grid.tiles[cell.y]?.[cell.x];
    return tile !== undefined && rule.terrain.includes(tile);
  });
}

/** Whether an attack is one an underwater rule's `unless` spares (1.498): named in its label as a word,
 *  or of one of the qualities. */
export function rulesetUnderwaterSpares(
  unless: { names?: string[]; qualities?: string[] } | undefined,
  action: { label: string; qualities?: string[] } | undefined,
): boolean {
  if (!unless || !action) return false;
  const words = action.label.toLowerCase().split(/[^a-z0-9']+/);
  if (unless.names?.some((name) => words.includes(name.trim().toLowerCase()))) return true;
  return !!unless.qualities?.some((quality) => action.qualities?.includes(quality));
}

/** Whom this mover drags along as they walk (1.497), those holding a `dragged` condition they put
 *  on, and whether that halves their speed: anybody not `unlessSmaller` sizes smaller does. */
export function rulesetDragging(
  definition: RulesetDefinition,
  state: RulesetEncounterState,
  mover: RulesetCombatant,
): { ids: string[]; halves: boolean } {
  const combat = definition.combat;
  const out = { ids: [] as string[], halves: false };
  if (!combat) return out;
  const own = rulesetSizeRank(combat, mover);
  for (const one of state.combatants) {
    if (one.id === mover.id || one.defeated || !rulesetPositionOf(one) || one.insideOf || one.mountedOn) continue;
    const rule = rulesetActiveConditions(definition, combat, one, state).find(
      (entry) =>
        entry.dragged &&
        one.tracked.some((tracked) => tracked.condition === entry.condition && tracked.source === mover.id),
    );
    if (!rule?.dragged) continue;
    out.ids.push(one.id);
    const rank = rulesetSizeRank(combat, one);
    const smaller = rule.dragged.unlessSmaller;
    if (smaller === undefined || own === undefined || rank === undefined || own - rank < smaller) out.halves = true;
  }
  return out;
}

/** How far this combatant jumps now (1.499), in cells: a long jump and a high one, at their full
 *  distance with a run-up walked this turn just before it, else as `standing` says; and whether it
 *  had one. Null in a fight with no jumping or no distance. */
export function rulesetJumpReach(
  definition: RulesetDefinition,
  state: RulesetEncounterState,
  jumper: RulesetCombatant,
): { long: number; high: number; running: boolean } | null {
  const combat = definition.combat;
  const rule = combat?.jumping;
  const perCell = combat?.distance?.perCell;
  if (!rule || !perCell) return null;
  const at = rulesetPositionOf(jumper);
  const trail = jumper.trail ?? [];
  const last = trail[trail.length - 1];
  const running =
    !!at && trail.length - 1 >= Math.ceil(rule.runUp / perCell) && !!last && last.x === at.x && last.y === at.y;
  const read = (ability: string, of: "score" | "modifier") => {
    const score = rulesetAbilityScore(definition, jumper, ability);
    if (score === undefined) return 0;
    return of === "score" ? score : rulesetAbilityModifier(definition, score);
  };
  const keys = rulesetActiveConditions(definition, combat, jumper, state).flatMap((entry) =>
    entry.jumps ? [entry.jumps] : [],
  );
  const times = keys.reduce((most, one) => Math.max(most, one.times ?? 1), 1);
  // A creature's own jump (1.716): a bulette's Standing Leap.
  const own = jumper.block?.jump;
  const span = (which: "long" | "high") => {
    const base =
      (own ? own[which] : Math.max(0, read(rule[which].ability, rule[which].of) + (rule[which].plus ?? 0))) * times;
    const plus = running
      ? keys.reduce(
          (sum, one) =>
            one.plus && (which === "long" || !one.plus.long)
              ? sum + Math.max(0, read(one.plus.ability, "modifier"))
              : sum,
          0,
        )
      : 0;
    const feet = base + plus;
    return Math.floor((running || rule.standing !== "half" || own?.withoutRunUp ? feet : feet / 2) / perCell);
  };
  return { long: span("long"), high: span("high"), running };
}

/**
 * Where this combatant may jump to now (1.499): a straight line in one of the eight directions, two
 * cells or more and no further than its long jump or what is left of its movement, each cell of it a
 * cell of movement. It goes over hard going, water and pits, over friends and ground no higher than
 * its high jump clears, never through a wall or a foe; it lands where it could stand, no more than a
 * level down. Nobody jumps who cannot walk, rides, is inside somebody, up in the air, held to or kept
 * from somewhere, or drags somebody.
 */
export function rulesetJumpCells(
  definition: RulesetDefinition,
  state: RulesetEncounterState,
  actorId: string,
  /** A leap onto others (1.725): only landings at least this many cells off, each in a space one
   *  or more others fill, foes too. */
  onto?: number,
): RulesetReachableCell[] {
  const combat = definition.combat;
  const grid = state.board?.grid;
  const actor = rulesetCombatant(state, actorId);
  const from = rulesetPositionOf(actor);
  if (!combat?.jumping || !grid || !actor || !from) return [];
  if (actor.levitating || actor.insideOf || actor.mountedOn || rulesetAirborne(grid, actor)) return [];
  if (rulesetDragging(definition, state, actor).ids.length) return [];
  const active = rulesetActiveConditions(definition, combat, actor, state);
  if (
    active.some(
      (entry) =>
        entry.behavior?.moves || entry.behavior?.keepsOut !== undefined || entry.behavior?.keepsIn !== undefined,
    ) ||
    rulesetKeptBy(definition, state, actor).length
  )
    return [];
  // Kept from getting any nearer to somebody (5e's frightened): no cell of the jump nearer them.
  const held: Array<{ source: RulesetCombatant; away: number }> = [];
  for (const entry of active) {
    if (!entry.effects.includes("cannot-approach-source")) continue;
    const sourceId = actor.tracked.find((tracked) => tracked.condition === entry.condition)?.source;
    const source = sourceId ? rulesetCombatant(state, sourceId) : undefined;
    if (rulesetPositionOf(source)) held.push({ source: source!, away: rulesetGap(actor, source) });
  }
  const reach = rulesetJumpReach(definition, state, actor);
  const budget = Math.min(MOVEMENT_CEILING, Math.max(0, Math.floor(actor.movementLeft ?? 0)));
  const far = Math.min(reach?.long ?? 0, budget);
  if (far < 2 || (onto !== undefined && far < onto)) return [];
  const levelCells = state.board?.levelCells ?? 1;
  const ground = elevationAt(grid, from.x, from.y);
  const span = rulesetSpanOf(actor);
  const foes = new Set<string>();
  const occupied = new Set<string>();
  for (const one of state.combatants) {
    if (one.id === actor.id || !rulesetCombatStanding(one) || one.insideOf || one.mountedOn) continue;
    for (const cell of rulesetFootprint(one)) {
      occupied.add(`${cell.x},${cell.y}`);
      if (one.side !== actor.side) foes.add(`${cell.x},${cell.y}`);
    }
  }
  const clears = (x: number, y: number, overFoes = false) =>
    inBounds(grid, x, y) &&
    (!rulesetCellBlocked(grid, x, y) || isWater(grid, x, y)) &&
    (overFoes || !foes.has(`${x},${y}`)) &&
    (elevationAt(grid, x, y) - ground) * levelCells <= reach!.high;
  const threats = rulesetThreateningEnemies(definition, combat, state, actor);
  const out: RulesetReachableCell[] = [];
  for (const [dx, dy] of STEPS) {
    const path: RulesetCombatCell[] = [];
    for (let step = 1; step <= far; step++) {
      const x = from.x + dx * step;
      const y = from.y + dy * step;
      const cells = rulesetFootprintAt({ x, y }, span);
      const open = cells.every((cell) => clears(cell.x, cell.y));
      if (held.some((one) => rulesetGapFrom({ x, y }, span, one.source) < one.away)) break;
      // Onto others (1.725): landing among foes too, and nowhere else.
      if (onto !== undefined) {
        if (!open && !cells.every((cell) => clears(cell.x, cell.y, true))) break;
        path.push({ x, y });
        const lands =
          step >= Math.max(2, onto) &&
          cells.some((cell) => occupied.has(`${cell.x},${cell.y}`)) &&
          cells.every((cell) => {
            const rise = elevationAt(grid, cell.x, cell.y) - ground;
            return rise >= -1 && !rulesetCellSolidFor(grid, cell.x, cell.y, actor);
          });
        if (lands && !rulesetOnlyCrosses(grid, { x, y }, actor))
          out.push({ x, y, cost: step, path: [...path], provokes: provokedBy(threats, from, path) });
        if (!open) break;
        continue;
      }
      if (!open) break;
      path.push({ x, y });
      if (step < 2) continue;
      const lands = cells.every((cell) => {
        const rise = elevationAt(grid, cell.x, cell.y) - ground;
        return !occupied.has(`${cell.x},${cell.y}`) && rise >= -1 && !rulesetCellSolidFor(grid, cell.x, cell.y, actor);
      });
      if (!lands || rulesetOnlyCrosses(grid, { x, y }, actor)) continue;
      out.push({ x, y, cost: step, path: [...path], provokes: provokedBy(threats, from, path) });
    }
  }
  return out.sort((a, b) => a.cost - b.cost || a.y - b.y || a.x - b.x);
}

/** Whether landing here is landing on hard going (1.499): ground that costs more than a step, of
 *  itself or by a lasting area on it. */
export function rulesetHardLanding(
  grid: TacticalGrid,
  state: RulesetEncounterState,
  jumper: RulesetCombatant,
  at: RulesetCombatCell,
): boolean {
  if (jumper.ignoresHardGround) return false;
  const slowed = rulesetSlowedCells(state, jumper);
  return rulesetFootprintAt(at, rulesetSpanOf(jumper)).some(
    (cell) => rulesetCellEnterCost(grid, cell.x, cell.y) > 1 || slowed.has(`${cell.x},${cell.y}`),
  );
}

/** Solid ground this mover walks through (1.495): Incorporeal Movement. */
export function rulesetThroughSolid(grid: TacticalGrid, x: number, y: number, mover: RulesetCombatant): boolean {
  return !!mover.passesObjects && inBounds(grid, x, y) && rulesetCellSolidFor(grid, x, y, mover);
}

/** A step into a cell another creature fills, priced as hard going `combat.sizes.passing.crowded`
 *  times over (1.495), from the step it would otherwise cost. */
export function rulesetCrowdedStep(
  definition: RulesetDefinition,
  state: RulesetEncounterState,
  mover: RulesetCombatant,
  cell: RulesetCombatCell,
  plain: number,
  step: number,
): number {
  const crowded = definition.combat?.sizes?.passing?.crowded;
  const grid = state.board?.grid;
  if (crowded === undefined || !grid) return step;
  const filled = state.combatants.some(
    (one) => one.id !== mover.id && !one.insideOf && rulesetCombatStanding(one) && rulesetFills(one, cell),
  );
  return filled ? Math.max(step, plain + Math.max(0, crowded - enterCostFor(grid, cell, mover))) : step;
}

/** What stepping into this cell costs this mover: a plain step over ground hard going of itself, for
 *  somebody who ignores it (1.432). */
function enterCostFor(grid: TacticalGrid, cell: RulesetCombatCell, mover?: RulesetCombatant): number {
  if (mover?.ignoresHardGround) return 1;
  // Easy going on its own tiles (1.708): Ice Walk on ice and snow.
  const tile = grid.tiles[cell.y]?.[cell.x];
  if (tile !== undefined && mover?.easyGround?.includes(tile)) return 1;
  return rulesetCellEnterCost(grid, cell.x, cell.y);
}

/** Whether a mover's climb takes it into a cell (1.671): not one whose tile its climb is kept off, nor
 *  slippery ground where it is kept off that. */
function rulesetClimbsInto(
  grid: TacticalGrid,
  to: RulesetCombatCell,
  mover: RulesetCombatant,
  slick?: ReadonlySet<string>,
): boolean {
  const kept = mover.climbNotOn;
  if (!kept) return true;
  const tile = grid.tiles[to.y]?.[to.x];
  if (tile !== undefined && kept.terrain.includes(tile)) return false;
  return !(kept.slippery && slick?.has(`${to.x},${to.y}`));
}

/** The cells slippery ground covers (1.671), for a mover whose climb is kept off it. */
export function rulesetSlickCells(state: RulesetEncounterState, mover: RulesetCombatant): Set<string> | undefined {
  if (!mover.climbNotOn?.slippery) return undefined;
  const slick = new Set<string>();
  for (const caster of state.combatants) {
    for (const zone of caster.zones ?? []) {
      const action = caster.actions.find((entry) => entry.id === zone.actionId);
      if (!action?.zone?.slippery) continue;
      for (const cell of rulesetZoneCells(state, caster, zone)) slick.add(`${cell.x},${cell.y}`);
    }
  }
  return slick;
}

/**
 * The cheapest way this mover takes one step, and what it costs (1.113), with `spent` already moved
 * this turn: a way of moving whose own allowance the step would pass is not one it may use. On foot
 * (and burrowing, which a board moves as a walk) a step costs what `rulesetStepCost` says; a climber
 * takes a step of any height for the ground it steps onto; a flier steps anywhere not solid for one
 * cell, water and heights included; a swimmer crosses water for one cell, and walks on land. Null
 * when no way it moves takes the step. Somebody who only walks gets exactly `rulesetStepCost`.
 * Ground hard going of itself costs a plain step to somebody who ignores it, and somebody who runs
 * across walks steps of any height as a climber does and water for one cell (1.432).
 */
export function rulesetMoveStep(
  grid: TacticalGrid,
  from: RulesetCombatCell,
  to: RulesetCombatCell,
  mover: RulesetCombatant,
  spent = 0,
  /** Cells slippery ground covers (1.671), where a climb kept off it is no good. */
  slick?: ReadonlySet<string>,
): { mode: RulesetMoveMode; cost: number } | null {
  const speeds = mover.speeds ?? {};
  const options: Array<{ mode: RulesetMoveMode; cost: number | null }> = [];
  const enter = enterCostFor(grid, to, mover);
  const climb = climbCost(grid, from, to);
  const onFoot = climb === null ? null : enter + climb;
  // Up in the air (1.114) it only flies, a cell a step over anything not solid. Ground as high as
  // it is, or higher, it lands on, exactly as a flier on the ground flies onto a cliff.
  const altitude = mover.altitude;
  if (altitude !== undefined && altitude > elevationAt(grid, from.x, from.y)) {
    if (speeds.fly && !rulesetCellSolidFor(grid, to.x, to.y, mover)) {
      options.push({ mode: "fly", cost: 1 });
    }
  } else if (isWater(grid, to.x, to.y)) {
    if (speeds.swim) options.push({ mode: "swim", cost: 1 });
    if (speeds.fly) options.push({ mode: "fly", cost: 1 });
    if (mover.runsAcross) options.push({ mode: "walk", cost: 1 });
    // As on plain ground (1.529): a step, and the climb onto it.
    else if (mover.walksOnLiquid) options.push({ mode: "walk", cost: climb === null ? null : 1 + climb });
  } else if (!rulesetCellBlocked(grid, to.x, to.y)) {
    options.push({ mode: "walk", cost: mover.runsAcross ? enter : onFoot });
    if (speeds.climb && rulesetClimbsInto(grid, to, mover, slick)) options.push({ mode: "climb", cost: enter });
    if (speeds.fly) options.push({ mode: "fly", cost: 1 });
    if (speeds.burrow) options.push({ mode: "burrow", cost: onFoot });
  }
  let best: { mode: RulesetMoveMode; cost: number } | null = null;
  for (const option of options) {
    if (option.cost === null || spent + option.cost > modeLeftOf(mover, option.mode)) continue;
    if (!best || option.cost < best.cost) best = { mode: option.mode, cost: option.cost };
  }
  return best;
}

/** Whether one cell can see another: the Engine's one sight test (combat C6), which a wall or a mountain
 *  blocks and water does not. Symmetric, so the two always see each other or never do. */
export function rulesetLineOfSight(grid: TacticalGrid, a: RulesetCombatCell, b: RulesetCombatCell): boolean {
  return hasLineOfSight(grid, a, b);
}

/**
 * The cells a shape covers, in cells, with nothing solid in the way.
 *
 * A burst is every cell within `size` of the cell it was aimed at. A cone runs from the actor toward
 * that cell, as wide at each step as it is far, and a line runs the same way one cell wide by default.
 * All three stop at anything solid: a cell the origin cannot see is not in the area.
 */
export function rulesetAreaCells(
  shape: RulesetCombatArea["shape"],
  size: number,
  origin: RulesetCombatCell,
  toward: RulesetCombatCell,
  grid: TacticalGrid,
  width = 1,
): RulesetCombatCell[] {
  const reach = Math.max(1, Math.round(size));
  // A burst of no size is only its own cell (1.702): a Sphere of Annihilation.
  if (shape === "burst") return burstCells(size === 0 ? 0 : reach, toward, grid);
  if (shape === "box") return boxCells(reach, origin, toward, grid);
  // A wall is shown run across the line from its maker; how it was really laid is the cast's.
  if (shape === "wall") return rulesetWallShape(grid, { size, width }, toward, origin).cells;
  const dx = Math.sign(toward.x - origin.x);
  const dy = Math.sign(toward.y - origin.y);
  // Aimed at the cell it is standing in: there is no direction, so the shape covers nothing.
  if (dx === 0 && dy === 0) return [];
  if (shape === "line" && Math.max(1, Math.round(width)) === 1) {
    // A one-cell line runs at whatever angle it was aimed (a Lightning Bolt is not held to the eight
    // ways a grid runs): one cell for each step out, on the straight run toward the aim.
    return lineCells(reach, origin, toward.x - origin.x, toward.y - origin.y, grid, 1);
  }
  return shape === "line"
    ? lineCells(reach, origin, dx, dy, grid, Math.max(1, Math.round(width)))
    : coneCells(reach, origin, dx, dy, grid);
}

/** The cells strictly between two cells, one per step of the straight run from one to the other
 *  (1.190): a javelin of lightning's bolt on its way to its target. */
export function rulesetPathCells(from: RulesetCombatCell, to: RulesetCombatCell): RulesetCombatCell[] {
  const steps = Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y));
  const cells: RulesetCombatCell[] = [];
  for (let step = 1; step < steps; step++) {
    cells.push({
      x: Math.round(from.x + ((to.x - from.x) * step) / steps),
      y: Math.round(from.y + ((to.y - from.y) * step) / steps),
    });
  }
  return cells;
}

/** The part of the board within `reach` of a cell. Every shape is scanned over THIS, never over its
 *  own size: a ruleset may declare an area ten thousand units across, and a loop that long would be
 *  a way to stall a server with one catalog entry. */
function boardBox(grid: TacticalGrid, around: RulesetCombatCell, reach: number) {
  return {
    top: Math.max(0, around.y - reach),
    bottom: Math.min(grid.height - 1, around.y + reach),
    left: Math.max(0, around.x - reach),
    right: Math.min(grid.width - 1, around.x + reach),
  };
}

/** A box (1.177): `side` cells a side, its near corner on the cell aimed at, reaching away from its
 *  maker. Along an axis the maker is level with, it is centred on that cell instead, so a cube set
 *  down straight ahead covers the cells either side of the line evenly. */
function boxCells(
  side: number,
  maker: RulesetCombatCell,
  at: RulesetCombatCell,
  grid: TacticalGrid,
): RulesetCombatCell[] {
  const span = (from: number, toward: number) => {
    const sign = Math.sign(toward - from);
    if (sign > 0) return [toward, toward + side - 1] as const;
    if (sign < 0) return [toward - side + 1, toward] as const;
    const low = toward - Math.floor((side - 1) / 2);
    return [low, low + side - 1] as const;
  };
  const [left, right] = span(maker.x, at.x);
  const [top, bottom] = span(maker.y, at.y);
  const cells: RulesetCombatCell[] = [];
  for (let y = Math.max(0, top); y <= Math.min(grid.height - 1, bottom); y++) {
    for (let x = Math.max(0, left); x <= Math.min(grid.width - 1, right); x++) {
      if (rulesetCellBlocked(grid, x, y)) continue;
      if (!rulesetLineOfSight(grid, at, { x, y })) continue;
      cells.push({ x, y });
    }
  }
  return cells;
}

/**
 * A wall (1.177), in cells, and the cells of its chosen side.
 *
 * A straight wall is `size` cells long, run from `at` toward `toward`, or across the line from its
 * maker to `at` and centred there when no way is given. A diagonal one fills the corner of every step
 * so nothing slips between two of its cells. `width` thickens it to either side of that line. Laid as
 * a ring, when its area allows one, it is the cells `ring / 2` out from `at`, thickened inward. Its side is the cells within `distance` of
 * it toward its maker (`near`, inside a ring) or away (`far`, outside a ring), never its own cells.
 */
export function rulesetWallShape(
  grid: TacticalGrid,
  area: { size: number; width?: number; ring?: number; ringOnly?: true },
  at: RulesetCombatCell,
  maker: RulesetCombatCell,
  toward?: RulesetCombatCell,
  side?: { distance: number; which: "near" | "far" },
  asRing = false,
  /** Cut into sections this many cells long (1.200): along its run, or around a ring. */
  every?: number,
): { cells: RulesetCombatCell[]; side: RulesetCombatCell[]; sections?: RulesetCombatCell[][] } {
  const length = Math.max(1, Math.round(area.size));
  const thick = Math.max(1, Math.round(area.width ?? 1));
  const keys = new Set<string>();
  const cells: RulesetCombatCell[] = [];
  const add = (x: number, y: number) => {
    const key = `${x},${y}`;
    if (keys.has(key) || x < 0 || y < 0 || x >= grid.width || y >= grid.height) return;
    if (rulesetCellBlocked(grid, x, y)) return;
    keys.add(key);
    cells.push({ x, y });
  };
  const sideCells: RulesetCombatCell[] = [];
  const reach = side ? Math.max(1, Math.round(side.distance)) : 0;
  // One laid only as a ring (1.602) is one whichever way it was asked for.
  if ((asRing || area.ringOnly) && area.ring) {
    const radius = Math.max(1, Math.round(area.ring / 2));
    const inner = radius - thick + 1;
    const box = boardBox(grid, at, radius + reach);
    for (let y = box.top; y <= box.bottom; y++) {
      for (let x = box.left; x <= box.right; x++) {
        const away = rulesetCellDistance(at, { x, y });
        if (away >= inner && away <= radius) add(x, y);
      }
    }
    if (side) {
      for (let y = box.top; y <= box.bottom; y++) {
        for (let x = box.left; x <= box.right; x++) {
          const away = rulesetCellDistance(at, { x, y });
          const inside = away < inner && away >= inner - reach;
          const outside = away > radius && away <= radius + reach;
          if ((side.which === "near" ? inside : outside) && !rulesetCellBlocked(grid, x, y)) sideCells.push({ x, y });
        }
      }
    }
    if (!every) return { cells, side: sideCells };
    // Around the ring: as many sections as its outer edge holds, each an equal share of the turn.
    const outer = cells.filter((cell) => rulesetCellDistance(at, cell) === radius).length;
    const count = Math.max(1, Math.round(outer / every));
    const turn = (cell: RulesetCombatCell) => (Math.atan2(cell.y - at.y, cell.x - at.x) + Math.PI) / (2 * Math.PI);
    return {
      cells,
      side: sideCells,
      sections: cutInto(cells, (cell) => Math.min(count - 1, Math.floor(turn(cell) * count))),
    };
  }
  let dx: number;
  let dy: number;
  let start: RulesetCombatCell;
  if (toward && (toward.x !== at.x || toward.y !== at.y)) {
    dx = Math.sign(toward.x - at.x);
    dy = Math.sign(toward.y - at.y);
    start = at;
  } else {
    const mx = Math.sign(at.x - maker.x);
    const my = Math.sign(at.y - maker.y);
    [dx, dy] = mx === 0 && my === 0 ? [1, 0] : [-my, mx];
    const back = Math.floor((length - 1) / 2);
    start = { x: at.x - dx * back, y: at.y - dy * back };
  }
  // Across the wall: thickened to both sides of its line, an even thickness one more to the left.
  const low = -Math.floor((thick - 1) / 2);
  for (let step = 0; step < length; step++) {
    const x = start.x + dx * step;
    const y = start.y + dy * step;
    for (let across = low; across < low + thick; across++) {
      add(x - dy * across, y + dx * across);
      // A diagonal step leaves two corners touching; fill one so the wall is closed.
      if (dx !== 0 && dy !== 0 && step < length - 1) add(x + dx - dy * across, y + dx * across);
    }
  }
  if (side && cells.length > 0) {
    const crossOf = (cell: RulesetCombatCell) => (cell.x - start.x) * dy - (cell.y - start.y) * dx;
    const makerSign = Math.sign(crossOf(maker)) || -1;
    const wanted = side.which === "near" ? makerSign : -makerSign;
    const xs = cells.map((cell) => cell.x);
    const ys = cells.map((cell) => cell.y);
    const top = Math.max(0, Math.min(...ys) - reach);
    const bottom = Math.min(grid.height - 1, Math.max(...ys) + reach);
    const left = Math.max(0, Math.min(...xs) - reach);
    const right = Math.min(grid.width - 1, Math.max(...xs) + reach);
    for (let y = top; y <= bottom; y++) {
      for (let x = left; x <= right; x++) {
        const cell = { x, y };
        if (keys.has(`${x},${y}`) || rulesetCellBlocked(grid, x, y)) continue;
        if (Math.sign(crossOf(cell)) !== wanted) continue;
        if (!cells.some((one) => rulesetCellDistance(one, cell) <= reach)) continue;
        sideCells.push(cell);
      }
    }
  }
  if (!every) return { cells, side: sideCells };
  // Along its run: how far along each cell is, whatever its place across the wall.
  const along = (cell: RulesetCombatCell) =>
    Math.max(0, Math.floor(((cell.x - start.x) * dx + (cell.y - start.y) * dy) / (dx * dx + dy * dy) + 1e-9));
  return { cells, side: sideCells, sections: cutInto(cells, (cell) => Math.floor(along(cell) / every)) };
}

/** Cells grouped by the section each falls in, in order, with no empty section. */
function cutInto(cells: RulesetCombatCell[], sectionOf: (cell: RulesetCombatCell) => number): RulesetCombatCell[][] {
  const groups = new Map<number, RulesetCombatCell[]>();
  for (const cell of cells) {
    const index = sectionOf(cell);
    const group = groups.get(index);
    if (group) group.push(cell);
    else groups.set(index, [cell]);
  }
  return [...groups.entries()].sort(([a], [b]) => a - b).map(([, group]) => group);
}

function burstCells(reach: number, centre: RulesetCombatCell, grid: TacticalGrid): RulesetCombatCell[] {
  const cells: RulesetCombatCell[] = [];
  const box = boardBox(grid, centre, reach);
  for (let y = box.top; y <= box.bottom; y++) {
    for (let x = box.left; x <= box.right; x++) {
      if (rulesetCellBlocked(grid, x, y)) continue;
      if (!rulesetLineOfSight(grid, centre, { x, y })) continue;
      cells.push({ x, y });
    }
  }
  return cells;
}

/** The cells a burst centred on its maker (1.282) covers: within its size of every cell its maker
 *  fills, each once, and behind walls too when it goes through them. A kraken's Ink Cloud. */
export function rulesetAroundCells(
  maker: RulesetCombatant,
  around: { size: number; throughWalls?: true },
  grid: TacticalGrid,
  grow = 0,
): RulesetCombatCell[] {
  const reach = Math.max(1, Math.round(around.size + grow));
  const cells = new Map<string, RulesetCombatCell>();
  for (const from of rulesetFootprint(maker)) {
    const box = boardBox(grid, from, reach);
    for (let y = box.top; y <= box.bottom; y++) {
      for (let x = box.left; x <= box.right; x++) {
        if (cells.has(`${x},${y}`) || rulesetCellBlocked(grid, x, y)) continue;
        if (!around.throughWalls && !rulesetLineOfSight(grid, from, { x, y })) continue;
        cells.set(`${x},${y}`, { x, y });
      }
    }
  }
  return [...cells.values()];
}

function lineCells(
  reach: number,
  origin: RulesetCombatCell,
  dx: number,
  dy: number,
  grid: TacticalGrid,
  width: number,
): RulesetCombatCell[] {
  // Keep the one-cell path unchanged, including how a diagonal stops at a wall.
  if (width > 1) {
    const cells: RulesetCombatCell[] = [];
    const left = Math.floor(width / 2);
    const right = Math.floor((width - 1) / 2);
    const box = boardBox(grid, origin, reach + left);
    const axes = dx !== 0 && dy !== 0 ? 2 : 1;
    for (let y = box.top; y <= box.bottom; y++) {
      for (let x = box.left; x <= box.right; x++) {
        const offX = x - origin.x;
        const offY = y - origin.y;
        const along = offX * dx + offY * dy;
        // Screen y grows downwards: positive across is the caster's left. An even width puts
        // its extra column there. Diagonals measure across by the difference of their axes,
        // and along by their average, so the band stays contiguous on a square grid.
        const across = offX * dy - offY * dx;
        if (along <= 0 || along > reach * axes || across < -right || across > left) continue;
        if (rulesetCellBlocked(grid, x, y) || !rulesetLineOfSight(grid, origin, { x, y })) continue;
        cells.push({ x, y });
      }
    }
    return cells;
  }
  const cells: RulesetCombatCell[] = [];
  // The run toward the aim, one cell further out each step: along an axis or a diagonal `dx` and
  // `dy` are 1 or 0, and at any other angle the cell nearest the straight run is taken.
  const most = Math.max(Math.abs(dx), Math.abs(dy), 1);
  // Rounded away from the middle either way, so a line aimed left is the mirror of one aimed right.
  const round = (value: number) => Math.sign(value) * Math.round(Math.abs(value));
  // `blocksSight` reads off the board as solid, so the line ends at the edge whatever its size.
  for (let step = 1; step <= reach; step++) {
    const cell = { x: origin.x + round((dx * step) / most), y: origin.y + round((dy * step) / most) };
    // What blocks sight ends the line where it stands, rather than letting it carry on behind; it
    // carries on across water, where nobody stands.
    if (blocksSight(grid, cell.x, cell.y)) break;
    if (rulesetCellBlocked(grid, cell.x, cell.y)) continue;
    cells.push(cell);
  }
  return cells;
}

/**
 * A cone, as wide at each step as it is far: at `k` cells out it spreads `floor(k / 2)` to either
 * side of the line it was aimed along, which is the odd number of cells that centres on it. The same
 * rule holds whether it was aimed along an axis or corner-wise, so no direction is quietly wider.
 */
function coneCells(
  reach: number,
  origin: RulesetCombatCell,
  dx: number,
  dy: number,
  grid: TacticalGrid,
): RulesetCombatCell[] {
  const diagonal = dx !== 0 && dy !== 0;
  const cells: RulesetCombatCell[] = [];
  const box = boardBox(grid, origin, reach);
  for (let y = box.top; y <= box.bottom; y++) {
    for (let x = box.left; x <= box.right; x++) {
      const offX = x - origin.x;
      const offY = y - origin.y;
      const out = Math.max(Math.abs(offX), Math.abs(offY));
      if (out < 1 || out > reach) continue;
      const spread = Math.floor(out / 2);
      if (diagonal) {
        if (offX * dx < 1 || offY * dy < 1) continue;
        if (Math.abs(Math.abs(offX) - Math.abs(offY)) > spread) continue;
      } else if (dx !== 0) {
        if (offX * dx !== out || Math.abs(offY) > spread) continue;
      } else {
        if (offY * dy !== out || Math.abs(offX) > spread) continue;
      }
      if (rulesetCellBlocked(grid, x, y)) continue;
      if (!rulesetLineOfSight(grid, origin, { x, y })) continue;
      cells.push({ x, y });
    }
  }
  return cells;
}

// ── Moving ──

/** The best melee attack this combatant has: the one with the most damage behind it that reaches
 *  rather than carries. Something thrown counts, because a thrown weapon is still swung in hand.
 *  Null when it has nothing to strike a passer-by with. */
export function rulesetOpportunityAttack(combatant: RulesetCombatant): RulesetCombatAction | null {
  return rulesetBestWeapon(combatant, "melee");
}

/** Its best weapon strike of the kind (1.428): one that reaches for "melee", one that carries for
 *  "ranged", with the same bookkeeping an opportunity attack keeps. */
export function rulesetBestWeapon(combatant: RulesetCombatant, kind: "melee" | "ranged"): RulesetCombatAction | null {
  let best: RulesetCombatAction | null = null;
  let most = -1;
  for (const action of combatant.actions) {
    if (kind === "melee" ? action.reach === undefined && action.range : !action.range || action.toHit === undefined)
      continue;
    // Nor a strike again (1.428); and a blow or a shot is a weapon's, not a spell's: a cult fanatic's
    // Inflict Wounds is no opportunity attack (playtest).
    if (
      action.strikeAgain ||
      action.catalog ||
      action.casts ||
      action.components?.length ||
      action.innate ||
      action.castLevel !== undefined
    )
      continue;
    if (action.area || action.signature || action.sequence || !action.damage) continue;
    // The same bookkeeping the menu keeps: a strike that has run out of uses, or is waiting for its
    // dice, is not one to be made in passing either. (Written out rather than imported, because the
    // menu's own module reads this one.)
    if (action.uses && (combatant.uses[action.usesKey ?? action.id] ?? 0) < 1) continue;
    if (combatant.spent.includes(action.id)) continue;
    // Nor is a weapon with nothing loaded or nothing to shoot, nor a second blow in the off hand,
    // which follows the holder's own attack on their own turn.
    if (!rulesetShotsAvailable(combatant, action) || action.offHandOf !== undefined) continue;
    // Nor is using an item: that is its holder's own choice on their own turn.
    if (action.itemUse) continue;
    // Nor a weapon lying where it was dropped (1.266).
    if (rulesetActionDropped(combatant, action)) continue;
    // Nor is an answer to a moment, or what is added to another blow (1.243): Divine Smite is no
    // strike of its own.
    if (action.reaction || action.addsToBlow) continue;
    // Nor a strike a condition gives (1.236) while that condition is not on its holder: Flame
    // Blade's, with the blade not called up.
    if (action.whileHolds && !combatant.tracked.some((entry) => entry.condition === action.whileHolds)) continue;
    const average = action.damage.count * ((action.damage.sides + 1) / 2) + action.damage.flat;
    if (average > most) {
      most = average;
      best = action;
    }
  }
  return best;
}

/** How far this action reaches to strike somebody, in cells. Anything with no distance of its own
 *  reaches the next cell. */
export function rulesetActionReach(action: { reach?: number; range?: { normal: number; long?: number } }): number {
  if (action.range) return Math.max(action.range.long ?? action.range.normal, action.range.normal);
  return Math.max(1, action.reach ?? 1);
}

/** Everybody who would strike at somebody leaving the cell next to them: standing, able to act and
 *  to react, holding the budget the ruleset says such a strike costs, and carrying something to
 *  strike with. A ruleset that declares no `opportunity` has none of this. */
export function rulesetThreateningEnemies(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  state: RulesetEncounterState,
  mover: RulesetCombatant,
): Array<{ combatant: RulesetCombatant; at: RulesetCombatCell; reach: number; span?: number; moverSpan?: number }> {
  const opportunity = combat.opportunity;
  if (!opportunity || mover.flags.disengaged) return [];
  // Flying out of reach (1.679): an owl's Flyby, with a flying speed to fly by on.
  if (
    (mover.speeds?.fly ?? 0) > 0 &&
    combat.conditions?.some((rule) => rule.flyby) &&
    rulesetActiveConditions(definition, combat, mover, state).some((entry) => entry.flyby)
  )
    return [];
  const threats: Array<{
    combatant: RulesetCombatant;
    at: RulesetCombatCell;
    reach: number;
    span?: number;
    moverSpan?: number;
  }> = [];
  for (const combatant of state.combatants) {
    if (combatant.side === mover.side || !rulesetCombatStanding(combatant)) continue;
    // Or with a spare head's (1.550): a hydra's Reactive Heads.
    if ((combatant.budgets[opportunity.budget] ?? 0) < 1 && !combatant.heads?.spare) continue;
    // Nobody strikes through a sphere (1.314).
    if (rulesetSealedApart(definition, state, combatant, mover)) continue;
    const effects = rulesetCombatEffects(definition, combat, combatant, state);
    // Nor one who may harm nobody (1.457).
    if (effects.has("cannot-act") || effects.has("cannot-react") || effects.has("cannot-harm")) continue;
    // Nor one hanging on to somebody (1.676): carried along with the mover, or kept to its holder.
    if (
      combat.conditions?.some((rule) => rule.attaches) &&
      state.combatants.some((holder) =>
        holder.tracked.some(
          (entry) =>
            entry.source === combatant.id &&
            combat.conditions!.some((rule) => rule.condition === entry.condition && rule.attaches),
        ),
      )
    )
      continue;
    const at = rulesetPositionOf(combatant);
    const strike = rulesetOpportunityAttack(combatant);
    if (!at || !strike) continue;
    const reach = Math.max(1, strike.reach ?? 1);
    // Nor through a barrier that stops reach (1.595): Antilife Shell.
    if (rulesetReachBarred(definition, state, combatant, mover, strike)) continue;
    // Somebody up in the air too high above (or below) to be reached is no threat to them (1.114).
    const grid = state.board?.grid;
    const levelCells = state.board?.levelCells;
    if (grid && levelCells && (rulesetAirborne(grid, mover) || rulesetAirborne(grid, combatant))) {
      if (Math.abs(rulesetLevelOf(grid, mover) - rulesetLevelOf(grid, combatant)) * levelCells > reach) continue;
    }
    // Reach runs from any cell it fills to any cell the mover does (1.194).
    const span = rulesetSpanOf(combatant);
    const moverSpan = rulesetSpanOf(mover);
    threats.push({
      combatant,
      at,
      reach,
      ...(span > 1 ? { span } : {}),
      ...(moverSpan > 1 ? { moverSpan } : {}),
    });
  }
  return threats;
}

/**
 * Every cell this combatant could walk to on what is left of their allowance, with what each one
 * costs, the cells the walk goes through and the enemies whose reach it leaves on the way.
 *
 * Eight neighbours at the cost of the ground they step onto, nothing solid, no corner cut between
 * two solid cells, a friend may be walked past and nobody at all may be stopped on. An enemy is a
 * wall: a fight where opponents walk through each other is not one anybody plays at.
 */
export function rulesetReachableCells(
  definition: RulesetDefinition,
  state: RulesetEncounterState,
  actorId: string,
  /** Whoever it may walk into and through (1.403): those an engulf takes in. */
  passes?: (combatant: RulesetCombatant) => boolean,
  /** Walking carefully (1.689), at half speed on ground that spares slow walkers. */
  careful = false,
): RulesetReachableCell[] {
  const combat = definition.combat;
  const grid = state.board?.grid;
  const actor = rulesetCombatant(state, actorId);
  const from = rulesetPositionOf(actor);
  if (!combat || !grid || !actor || !from) return [];
  // Levitating (1.395): up and down only, never across.
  if (actor.levitating) return [];
  // Inside somebody (1.403), even fallen (1.405): out is climbed, never walked.
  if (actor.insideOf) return [];
  // Riding (1.496): the mount walks.
  if (actor.mountedOn) return [];
  const budget = Math.min(MOVEMENT_CEILING, Math.max(0, Math.floor(actor.movementLeft ?? 0)));
  if (budget < 1) return [];

  const blockers = new Set<string>();
  const occupied = new Set<string>();
  // A space somebody lets them through as hard going (1.600).
  const hardGoing = new Set<string>();
  // Into a foe's space and stopping there (1.504): Air Form. Only a friend's is somewhere not to stop.
  const stopsInFoes = rulesetActiveConditions(definition, combat, actor, state).some((entry) => entry.stopsInFoes);
  // Sharing spaces (1.680): a swarm walks into and stops in anybody's, and anybody in its own.
  const shares = (one: RulesetCombatant) =>
    !!combat.conditions?.some((rule) => rule.sharesSpace) &&
    rulesetActiveConditions(definition, combat, one, state).some((entry) => entry.sharesSpace);
  const sharing = shares(actor);
  const friendly = new Set<string>();
  // Through a foe far enough apart in size, or through larger ones or anybody (1.495).
  const apart = combat.sizes?.passing?.apart;
  const ownRank = rulesetSizeRank(combat, actor);
  const walksThrough = (combatant: RulesetCombatant) => {
    if (actor.passesCreatures === "any" || stopsInFoes || sharing) return true;
    const rank = rulesetSizeRank(combat, combatant);
    if (rank === undefined || ownRank === undefined) return false;
    if (actor.passesCreatures === "larger" && rank > ownRank) return true;
    return apart !== undefined && Math.abs(rank - ownRank) >= apart;
  };
  for (const combatant of state.combatants) {
    // A prisoner (1.762) is out of the fight but still stands where it gave up (re-test 16).
    const prisoner = !!combatant.away?.surrendered && !!rulesetPositionOf(combatant);
    if (combatant.id === actor.id || (combatant.defeated && !prisoner)) continue;
    // Inside somebody (1.403), they fill none of their own: whoever holds them fills it. Nor does a
    // rider (1.496): their mount does.
    if (combatant.insideOf || combatant.mountedOn || passes?.(combatant)) continue;
    // Down and still in the fight, they block nobody but their space is still theirs: walked over,
    // never stopped on. So with a prisoner.
    if (combatant.down || prisoner) {
      for (const at of rulesetFootprint(combatant)) {
        occupied.add(`${at.x},${at.y}`);
        if (combatant.side === actor.side) friendly.add(`${at.x},${at.y}`);
      }
      continue;
    }
    // A swarm's space is anybody's to walk into and stop in (1.680).
    if (shares(combatant)) continue;
    // Moved through only by a foe strong enough, as hard going (1.600): the Arcane Hand.
    const passable = combatant.side !== actor.side ? combatant.block?.passableBy : undefined;
    const strong = passable ? (rulesetAbilityScore(definition, actor, passable.ability) ?? 0) > passable.above : false;
    const through = combatant.side !== actor.side && (passable ? strong : walksThrough(combatant));
    // Nor does one that fills none of its space (1.600) keep anybody it lets by from stopping there.
    const fills = combatant.block?.fillsSpace !== false;
    // Every cell they fill (1.194).
    for (const at of rulesetFootprint(combatant)) {
      if (fills) occupied.add(`${at.x},${at.y}`);
      if (fills && combatant.side === actor.side) friendly.add(`${at.x},${at.y}`);
      if (combatant.side !== actor.side && !through) blockers.add(`${at.x},${at.y}`);
      if (passable?.difficult && strong) hardGoing.add(`${at.x},${at.y}`);
    }
  }
  const taken = sharing ? new Set<string>() : stopsInFoes ? friendly : occupied;
  // Another's space costs as hard going (1.495), and solid ground does to one who walks through it.
  const crowded = combat.sizes?.passing?.crowded;
  // Dragging somebody they hold (1.497): every step costs double, unless all are much smaller.
  const dragging = rulesetDragging(definition, state, actor);
  const solidFor = (x: number, y: number) =>
    rulesetCellSolidFor(grid, x, y, actor) && !rulesetThroughSolid(grid, x, y, actor);
  const insideSolid = (x: number, y: number) => rulesetThroughSolid(grid, x, y, actor);
  // Somebody bigger than one cell moves the whole of themselves (1.194): a step is taken by their
  // top-left cell, and every cell they would fill must be open. The cost is the ground their
  // top-left cell steps onto, the way the one cell of anybody else pays. Squeezed (1.681), their
  // whole size still.
  const span = actor.squeezedFrom ?? rulesetSpanOf(actor);
  const fits = (x: number, y: number, set: ReadonlySet<string>, as = span) =>
    rulesetFootprintAt({ x, y }, as).every((cell) => !solidFor(cell.x, cell.y) && !set.has(`${cell.x},${cell.y}`));

  // Whoever this combatant may not get any nearer to, and how near they stand right now. A cell
  // closer than that is not offered at all, so the menu stays the one place legality lives.
  const held: Array<{ source: RulesetCombatant; away: number }> = [];
  for (const entry of rulesetActiveConditions(definition, combat, actor, state)) {
    if (!entry.effects.includes("cannot-approach-source")) continue;
    const sourceId = actor.tracked.find((tracked) => tracked.condition === entry.condition)?.source;
    const source = sourceId ? rulesetCombatant(state, sourceId) : undefined;
    if (rulesetPositionOf(source)) held.push({ source: source!, away: rulesetGap(actor, source) });
  }
  // Walking only away from, or toward, whoever put a condition on (1.264): never a step the wrong
  // way, and somewhere to stop only further off, or nearer, than they began.
  const driven: Array<{ source: RulesetCombatant; start: number; moves: "away" | "toward" }> = [];
  for (const entry of rulesetActiveConditions(definition, combat, actor, state)) {
    const moves = entry.behavior?.moves;
    if (!moves) continue;
    const source = rulesetBehaviorAnchor(state, actor, entry.condition, entry.behavior);
    if (source) driven.push({ source, start: rulesetGap(actor, source), moves });
  }
  // Kept out of a ring around whoever put a condition on (1.266): inside it, only steps further off;
  // and somewhere to stop only outside it while there is anywhere outside it to stop.
  const kept: Array<{ source: RulesetCombatant; ring: number }> = [];
  for (const entry of rulesetActiveConditions(definition, combat, actor, state)) {
    const keepsOut = entry.behavior?.keepsOut;
    if (keepsOut === undefined || !combat.distance) continue;
    const source = rulesetBehaviorAnchor(state, actor, entry.condition, entry.behavior);
    if (source) kept.push({ source, ring: Math.floor(keepsOut / combat.distance.perCell) });
  }

  const keptBy = rulesetKeptBy(definition, state, actor);
  // Kept within a ring around whoever put a condition on, once inside it (1.274): Sympathy's.
  const within: Array<{ source: RulesetCombatant; ring: number }> = [];
  for (const entry of rulesetActiveConditions(definition, combat, actor, state)) {
    const keepsIn = entry.behavior?.keepsIn;
    if (keepsIn === undefined || !combat.distance) continue;
    const sourceId = actor.tracked.find((tracked) => tracked.condition === entry.condition)?.source;
    const source = sourceId ? rulesetCombatant(state, sourceId) : undefined;
    const ring = Math.floor(keepsIn / combat.distance.perCell);
    if (
      source &&
      source.id !== actor.id &&
      rulesetPositionOf(source) &&
      rulesetCombatStanding(source) &&
      rulesetGap(actor, source) <= ring
    ) {
      within.push({ source, ring });
    }
  }
  // Drawn toward somebody and already inside the ring that keeps it near them (1.274): the ring is
  // the leash then, so it may move about within it rather than only ever closer (Sympathy).
  for (let index = driven.length - 1; index >= 0; index--) {
    const one = driven[index]!;
    if (one.moves === "toward" && within.some((ring) => ring.source.id === one.source.id)) driven.splice(index, 1);
  }

  const threats = rulesetThreateningEnemies(definition, combat, state, actor);
  const slowed = rulesetSlowedCells(state, actor, careful);
  const slick = rulesetSlickCells(state, actor);
  const best = new Map<string, number>([[`${from.x},${from.y}`, 0]]);
  // Of two ways to a cell that cost the same, the one through fewer cells that hurt on the way in
  // (burning oil, a friend's Spirit Guardians): what anybody walking round it would pick.
  const harmful = rulesetHarmfulCells(state, actor);
  const burns = new Map<string, number>([[`${from.x},${from.y}`, 0]]);
  // And then the one that steps out of fewer reaches: the long way round a fighter, not past it.
  const leaves = new Map<string, number>([[`${from.x},${from.y}`, 0]]);
  const cameFrom = new Map<string, string>();
  const cells = new Map<string, RulesetReachableCell>();
  // A small board and a small allowance: the cheapest open cell is found by a scan rather than by a
  // heap, which is fewer moving parts for the same answer.
  const open = new Map<string, RulesetCombatCell>([[`${from.x},${from.y}`, from]]);
  while (open.size > 0) {
    let key: string | null = null;
    let at: RulesetCombatCell | null = null;
    let cheapest = Infinity;
    for (const [candidate, cell] of open) {
      const cost = best.get(candidate) ?? Infinity;
      if (cost < cheapest) {
        cheapest = cost;
        key = candidate;
        at = cell;
      }
    }
    if (key === null || at === null) break;
    open.delete(key);
    for (const [dx, dy] of STEPS) {
      const x = at.x + dx;
      const y = at.y + dy;
      const next = `${x},${y}`;
      if (solidFor(x, y) || blockers.has(next)) continue;
      // Between walls too close for all of them, squeezed (1.681).
      const squeeze = span > 1 ? rulesetSqueezeAt(definition, state, actor, { x, y }) : undefined;
      if (span > 1 && !fits(x, y, blockers, squeeze?.span)) continue;
      // Somebody this combatant may not approach is not walked PAST either. A route that dips
      // inside the ring and comes out the far side is still getting nearer, which is the thing the
      // condition forbids, and the board DRAWS that route. So the step is refused rather than only
      // the place it would have ended, and a cell far enough away is still offered whenever there
      // is a way round.
      if (held.some((one) => rulesetGapFrom({ x, y }, span, one.source) < one.away)) continue;
      if (
        driven.some((one) => {
          const gap = rulesetGapFrom({ x, y }, span, one.source);
          return one.moves === "away" ? gap < one.start : gap > one.start;
        })
      )
        continue;
      if (
        kept.some((one) => {
          const gap = rulesetGapFrom({ x, y }, span, one.source);
          return gap <= one.ring && gap <= rulesetGapFrom(at!, span, one.source);
        })
      )
        continue;
      if (within.some((one) => rulesetGapFrom({ x, y }, span, one.source) > one.ring)) continue;
      // Kept out of a zone, or in it (1.452): Magic Circle, Hallow.
      if (
        keptBy.some(({ cells, rule }) =>
          (rule.way ?? "in") === "in" ? cells.has(next) && !cells.has(key) : cells.has(key) && !cells.has(next),
        )
      )
        continue;
      // No squeezing between two solid corners: a step corner-wise needs one of its two sides open.
      if (dx !== 0 && dy !== 0 && solidFor(at.x + dx, at.y) && solidFor(at.x, at.y + dy)) continue;
      // The cheapest way they move that takes this step on what that way has left (1.113); through
      // solid ground, two steps' worth (1.495).
      const plain = insideSolid(x, y) ? 2 : rulesetMoveStep(grid, at, { x, y }, actor, cheapest, slick)?.cost;
      if (plain === undefined) continue;
      // Ground a lasting area makes hard going (1.173), and another's space (1.495).
      const slowedStep = rulesetSlowedStep(grid, { x, y }, plain, slowed, at, actor);
      const crowdedStep =
        crowded !== undefined && occupied.has(next)
          ? Math.max(slowedStep, plain + Math.max(0, crowded - enterCostFor(grid, { x, y }, actor)))
          : slowedStep;
      // Through a space let by as hard going (1.600), as difficult ground is.
      const throughStep = hardGoing.has(next) ? Math.max(crowdedStep, plain * 2) : crowdedStep;
      const step = (dragging.halves ? throughStep * 2 : throughStep) * (squeeze?.costs ?? 1);
      const cost = cheapest + step;
      const burnt = (burns.get(key) ?? 0) + (harmful.has(next) ? 1 : 0);
      const known = best.get(next) ?? Infinity;
      const left =
        (leaves.get(key) ?? 0) + threats.filter((threat) => rulesetStepLeavesReach(threat, at!, { x, y })).length;
      if (
        cost > budget ||
        cost > known ||
        (cost === known &&
          (burnt > (burns.get(next) ?? 0) || (burnt === (burns.get(next) ?? 0) && left >= (leaves.get(next) ?? 0))))
      )
        continue;
      best.set(next, cost);
      burns.set(next, burnt);
      leaves.set(next, left);
      cameFrom.set(next, key);
      open.set(next, { x, y });
      // A friend can be walked past and not stood on, so their cell is searched through and never
      // offered as somewhere to stop.
      if (taken.has(next) || (span > 1 && !fits(x, y, taken, squeeze?.span))) continue;
      // Run across and never stopped on (1.432).
      if (rulesetOnlyCrosses(grid, { x, y }, actor)) continue;
      if (
        driven.some((one) => {
          const gap = rulesetGapFrom({ x, y }, span, one.source);
          return one.moves === "away" ? gap <= one.start : gap >= one.start;
        })
      )
        continue;
      const path = pathTo(cameFrom, from, { x, y });
      cells.set(next, { x, y, cost, path, provokes: provokedBy(threats, from, path) });
    }
  }
  let stops = [...cells.values()];
  if (kept.length) {
    const outside = stops.filter((cell) => kept.every((one) => rulesetGapFrom(cell, span, one.source) > one.ring));
    if (outside.length) stops = outside;
  }
  return stops.sort((a, b) => a.cost - b.cost || a.y - b.y || a.x - b.x);
}

/**
 * The cells somebody pushed straight away from another crosses: up to `cells` steps along the line
 * from the pusher through them, stopping short of anything solid, anybody standing, the board's edge
 * or a corner too tight to squeeze through, exactly as a walk would. Empty when there is nowhere to
 * go. A push is not a walk: it spends nothing and nobody strikes at it on the way.
 */
/** The way somebody is pulled straight toward whoever pulls them (1.675), a cell at a time from
 *  their nearest cells to each other, stopping once beside them. Walls, filled cells and steep
 *  rises stop it as they stop a push: a balor's whip, a roper's Reel. */
export function rulesetPullPath(
  state: RulesetEncounterState,
  pullerId: string,
  targetId: string,
  cells: number,
): RulesetCombatCell[] {
  const grid = state.board?.grid;
  const puller = rulesetCombatant(state, pullerId);
  const pulled = rulesetCombatant(state, targetId);
  const start = rulesetPositionOf(pulled);
  if (!grid || !start || !rulesetPositionOf(puller)) return [];
  const span = rulesetSpanOf(pulled);
  const anchors = rulesetFootprint(puller);
  const occupied = new Set(
    state.combatants.flatMap((combatant) =>
      combatant.id === targetId || !rulesetCombatStanding(combatant)
        ? []
        : rulesetFootprint(combatant).map((at) => `${at.x},${at.y}`),
    ),
  );
  /** Their nearest cell and the puller's nearest to it, and how far apart those are. */
  const closest = (at: RulesetCombatCell) => {
    let best = { own: at, to: at, gap: Infinity };
    for (const own of rulesetFootprintAt(at, span)) {
      for (const to of anchors) {
        const gap = Math.max(Math.abs(to.x - own.x), Math.abs(to.y - own.y));
        if (gap < best.gap) best = { own, to, gap };
      }
    }
    return best;
  };
  const path: RulesetCombatCell[] = [];
  let at = start;
  for (let step = 0; step < Math.min(cells, MOVEMENT_CEILING); step++) {
    const near = closest(at);
    if (near.gap <= 1) break;
    const dx = Math.sign(near.to.x - near.own.x);
    const dy = Math.sign(near.to.y - near.own.y);
    const x = at.x + dx;
    const y = at.y + dy;
    if (
      rulesetFootprintAt({ x, y }, span).some(
        (cell) => rulesetCellBlocked(grid, cell.x, cell.y) || occupied.has(`${cell.x},${cell.y}`),
      )
    ) {
      break;
    }
    if (
      dx !== 0 &&
      dy !== 0 &&
      rulesetCellBlocked(grid, at.x + dx, at.y) &&
      rulesetCellBlocked(grid, at.x, at.y + dy)
    ) {
      break;
    }
    const rise = elevationAt(grid, x, y) - elevationAt(grid, at.x, at.y);
    if (rise > 1) break;
    at = { x, y };
    path.push(at);
    if (rise < -1) break;
  }
  return path;
}

export function rulesetPushPath(
  state: RulesetEncounterState,
  pusherId: string,
  targetId: string,
  cells: number,
  /** Pushed away from this cell rather than from the pusher (1.631): where a Bead of Force burst. */
  fromCell?: RulesetCombatCell,
): RulesetCombatCell[] {
  const grid = state.board?.grid;
  const pusher = rulesetCombatant(state, pusherId);
  const pushed = rulesetCombatant(state, targetId);
  const from = fromCell ?? rulesetPositionOf(pusher);
  const target = rulesetPositionOf(pushed);
  if (!grid || !from || !target) return [];
  // Nearest cell to nearest cell, so somebody bigger than one cell is pushed straight away from
  // whoever shoves them (1.194).
  const span = rulesetSpanOf(pushed);
  const near = fromCell ?? rulesetNearestCell(pusher, rulesetNearestCell(pushed, from)) ?? from;
  const far = rulesetNearestCell(pushed, near) ?? target;
  const dx = Math.sign(far.x - near.x);
  const dy = Math.sign(far.y - near.y);
  if (dx === 0 && dy === 0) return [];
  const occupied = new Set(
    state.combatants.flatMap((combatant) =>
      combatant.id === targetId || !rulesetCombatStanding(combatant)
        ? []
        : rulesetFootprint(combatant).map((at) => `${at.x},${at.y}`),
    ),
  );
  const path: RulesetCombatCell[] = [];
  let at = target;
  for (let step = 0; step < Math.min(cells, MOVEMENT_CEILING); step++) {
    const x = at.x + dx;
    const y = at.y + dy;
    if (rulesetCellBlocked(grid, x, y) || occupied.has(`${x},${y}`)) break;
    // Every cell they would fill (1.194).
    if (
      span > 1 &&
      rulesetFootprintAt({ x, y }, span).some(
        (cell) => rulesetCellBlocked(grid, cell.x, cell.y) || occupied.has(`${cell.x},${cell.y}`),
      )
    ) {
      break;
    }
    if (
      dx !== 0 &&
      dy !== 0 &&
      rulesetCellBlocked(grid, at.x + dx, at.y) &&
      rulesetCellBlocked(grid, at.x, at.y + dy)
    ) {
      break;
    }
    // Height (combat C6b): nobody is shoved up a step of two levels or more, and somebody shoved off one
    // falls, and lies where they land.
    const rise = elevationAt(grid, x, y) - elevationAt(grid, at.x, at.y);
    if (rise > 1) break;
    at = { x, y };
    path.push(at);
    if (rise < -1) break;
  }
  return path;
}

/**
 * What it costs to walk from each cell of the board to a cell next to one of `goals`, by the steps,
 * terrain costs and corner rule a walk pays; a cell no route reaches is absent. Reach and range are
 * measured in a straight line, but closing that distance is walked, and the two part ways wherever
 * a wall stands between: two fighters either side of a ridge are two cells apart and a long way
 * round. Who stands where is left out, since they move while the walk is under way.
 */
export function rulesetWalkingDistances(
  grid: TacticalGrid,
  goals: ReadonlyArray<RulesetCombatCell>,
  /** Who is moving, when they move some way besides walking (1.113): their ways count, with no
   *  turn's allowance to run out of. */
  mover?: RulesetCombatant,
): Map<string, number> {
  const unbounded =
    mover?.speeds || mover?.ignoresHardGround || mover?.runsAcross || mover?.walksOnLiquid
      ? {
          ...mover,
          modeLeft: Object.fromEntries(
            (["walk", ...Object.keys(mover.speeds ?? {})] as RulesetMoveMode[]).map((mode) => [mode, Infinity]),
          ),
        }
      : undefined;
  const solid = (x: number, y: number) => rulesetCellSolidFor(grid, x, y, unbounded);
  const into = (from: RulesetCombatCell, to: RulesetCombatCell) =>
    unbounded ? (rulesetMoveStep(grid, from, to, unbounded)?.cost ?? null) : rulesetStepCost(grid, from, to);
  const best = new Map<string, number>();
  // Terrain costs are small whole numbers, so the cheapest open cell is kept in buckets by cost
  // rather than found by a scan over a board that may be 64 by 64.
  const buckets: RulesetCombatCell[][] = [];
  const reach = (x: number, y: number, cost: number) => {
    if (cost >= (best.get(`${x},${y}`) ?? Infinity)) return;
    best.set(`${x},${y}`, cost);
    (buckets[cost] ??= []).push({ x, y });
  };
  // Standing next to a goal is where a walk towards it ends, so those cells cost nothing more.
  for (const goal of goals) {
    for (const [dx, dy] of STEPS) {
      if (!solid(goal.x + dx, goal.y + dy)) reach(goal.x + dx, goal.y + dy, 0);
    }
  }
  for (let cost = 0; cost < buckets.length; cost++) {
    for (const at of buckets[cost] ?? []) {
      if (best.get(`${at.x},${at.y}`) !== cost) continue;
      // Walked the other way: stepping from the neighbour INTO `at` costs what entering `at` does, and
      // what climbing up to it does (combat C6b), which is not the same both ways.
      for (const [dx, dy] of STEPS) {
        const x = at.x + dx;
        const y = at.y + dy;
        if (solid(x, y)) continue;
        if (dx !== 0 && dy !== 0 && solid(at.x + dx, at.y) && solid(at.x, at.y + dy)) {
          continue;
        }
        const step = into({ x, y }, at);
        if (step !== null) reach(x, y, cost + step);
      }
    }
  }
  return best;
}

function pathTo(
  cameFrom: ReadonlyMap<string, string>,
  from: RulesetCombatCell,
  to: RulesetCombatCell,
): RulesetCombatCell[] {
  const path: RulesetCombatCell[] = [];
  let key: string | undefined = `${to.x},${to.y}`;
  const start = `${from.x},${from.y}`;
  while (key && key !== start && path.length <= MOVEMENT_CEILING) {
    const [x, y] = key.split(",").map(Number) as [number, number];
    path.unshift({ x, y });
    key = cameFrom.get(key);
  }
  return path;
}

/** Whether one step takes a walker out of this threat's reach: inside it before, outside it after.
 *  The preview and the resolution both ask exactly this, so they can never name different people. */
export function rulesetStepLeavesReach(
  threat: { at: RulesetCombatCell; reach: number; span?: number; moverSpan?: number },
  from: RulesetCombatCell,
  to: RulesetCombatCell,
): boolean {
  // Footprint to footprint (1.194): either of them may fill more than the one cell.
  const holder = { x: threat.at.x, y: threat.at.y, span: threat.span } as RulesetCombatant;
  const away = (cell: RulesetCombatCell) => rulesetGapFrom(cell, threat.moverSpan ?? 1, holder);
  return away(from) <= threat.reach && away(to) > threat.reach;
}

/** Whose reach this walk leaves, in the order it leaves them. One strike each: a budget is a budget,
 *  however many times somebody dances in and out of it. */
function provokedBy(
  threats: ReadonlyArray<{
    combatant: RulesetCombatant;
    at: RulesetCombatCell;
    reach: number;
    span?: number;
    moverSpan?: number;
  }>,
  from: RulesetCombatCell,
  path: readonly RulesetCombatCell[],
): string[] {
  if (threats.length === 0) return [];
  const provoked: string[] = [];
  let previous = from;
  for (const cell of path) {
    for (const threat of threats) {
      if (provoked.includes(threat.combatant.id)) continue;
      if (rulesetStepLeavesReach(threat, previous, cell)) provoked.push(threat.combatant.id);
    }
    previous = cell;
  }
  return provoked;
}

/** The cells a zone covers as the fight stands. None off a board, or for a caster with no cell. */
/** Whom a zone keeps out (1.452): its rule's kinds, less those its caster left out as it was cast
 *  (1.666), Hallow's "You can exclude one or more of those types of creatures". */
export function rulesetKeptOutIs(
  zone: RulesetCombatZone,
  rule: NonNullable<NonNullable<RulesetCombatAction["zone"]>["keepsOut"]>,
): NonNullable<NonNullable<RulesetCombatAction["zone"]>["keepsOut"]>["is"] {
  if (!zone.keptOutSpares?.length) return rule.is;
  return {
    ...rule.is,
    except: { ...rule.is.except, types: [...new Set([...(rule.is.except?.types ?? []), ...zone.keptOutSpares])] },
  };
}

/** The zones that keep this combatant out, or in (1.452), each with its cells: Magic Circle and
 *  Hallow against the kinds they name. */
export function rulesetKeptBy(
  definition: RulesetDefinition,
  state: RulesetEncounterState,
  combatant: RulesetCombatant,
): Array<{ cells: Set<string>; rule: NonNullable<NonNullable<RulesetCombatAction["zone"]>["keepsOut"]> }> {
  if (!state.board?.grid) return [];
  return state.combatants.flatMap((caster) =>
    (caster.zones ?? []).flatMap((zone) => {
      const rule = caster.actions.find((entry) => entry.id === zone.actionId)?.zone?.keepsOut;
      if (!rule || !rulesetTargetIs(definition, combatant, rulesetKeptOutIs(zone, rule))) return [];
      return [{ cells: new Set(rulesetZoneCells(state, caster, zone).map((cell) => `${cell.x},${cell.y}`)), rule }];
    }),
  );
}

/** The zones that ward somebody against `from` (1.452): one that keeps `from` out, with them inside it
 *  and `from` outside; or one that keeps `from` in (`way: "out"`, 1.458), with `from` inside it and
 *  them outside. */
export function rulesetWardedFrom(
  definition: RulesetDefinition,
  state: RulesetEncounterState,
  target: RulesetCombatant,
  from: RulesetCombatant,
): Array<NonNullable<NonNullable<RulesetCombatAction["zone"]>["keepsOut"]>> {
  const at = rulesetFootprint(target).map((cell) => `${cell.x},${cell.y}`);
  const by = rulesetFootprint(from).map((cell) => `${cell.x},${cell.y}`);
  return rulesetKeptBy(definition, state, from)
    .filter(({ cells, rule }) => {
      const targetIn = at.some((key) => cells.has(key));
      const fromIn = by.some((key) => cells.has(key));
      return (rule.way ?? "in") === "in" ? targetIn && !fromIn : fromIn && !targetIn;
    })
    .map(({ rule }) => rule);
}

/** Whether a zone keeps `from` reaching `target` with this blow (1.595): one that keeps them out
 *  and stops reach, with `target` inside it and `from` outside, against a melee blow with no more than
 *  the least reach that is not a spell. 5e's Antilife Shell, which a reach or ranged weapon passes. */
export function rulesetReachBarred(
  definition: RulesetDefinition,
  state: RulesetEncounterState,
  from: RulesetCombatant,
  target: RulesetCombatant,
  blow: RulesetCombatAction,
): boolean {
  if (blow.toHit === undefined || blow.area || Math.max(1, blow.reach ?? 1) > 1) return false;
  // A spell is cast through it.
  if (blow.catalog && blow.kind !== "item" && !blow.whileHolds && !blow.signature && !blow.again) return false;
  if (rulesetBlowKind(state, from, target, blow) !== "melee") return false;
  return rulesetWardedFrom(definition, state, target, from).some((rule) => rule.reach);
}

export function rulesetZoneCells(
  state: RulesetEncounterState,
  caster: RulesetCombatant,
  zone: RulesetCombatZone,
): RulesetCombatCell[] {
  const cells = zoneCellsAsCast(state, caster, zone);
  const rules = caster.actions.find((entry) => entry.id === zone.actionId)?.zone;
  // A gas, a fog or a wind (1.659), which a zone that seals the air keeps to one side of its edge.
  const airy = !!rules?.obscures?.dispersed || !!rules?.disperses || !!rules?.stages?.some((stage) => stage.disperses);
  return airy && cells.length > 0 ? sealedOff(state, caster, zone, cells) : cells;
}

/** A gas, a fog or a wind's cells on the side of every zone that seals the air its middle is on
 *  (1.659): a Fog Cloud outside a Cube of Force stops at its face, one inside stays in. */
function sealedOff(
  state: RulesetEncounterState,
  caster: RulesetCombatant,
  zone: RulesetCombatZone,
  cells: RulesetCombatCell[],
): RulesetCombatCell[] {
  const key = (cell: RulesetCombatCell) => `${cell.x},${cell.y}`;
  const middle = rulesetZoneMiddles(state, caster, zone)[0];
  let out = cells;
  for (const one of state.combatants) {
    for (const other of one.zones ?? []) {
      if (other === zone || !one.actions.find((entry) => entry.id === other.actionId)?.zone?.sealsAir) continue;
      const inside = new Set(zoneCellsAsCast(state, one, other).map(key));
      if (inside.size === 0) continue;
      const within = middle !== undefined && inside.has(key(middle));
      out = out.filter((cell) => inside.has(key(cell)) === within);
    }
  }
  return out;
}

/** A zone's cells as it was cast, before anything keeps it out of some of them. */
function zoneCellsAsCast(
  state: RulesetEncounterState,
  caster: RulesetCombatant,
  zone: RulesetCombatZone,
): RulesetCombatCell[] {
  const grid = state.board?.grid;
  if (!grid) return [];
  // Carried by somebody (1.301): around them, wherever they are now.
  const holder = zone.on ? rulesetCombatant(state, zone.on) : undefined;
  if (zone.anchor === "point" && !(holder && rulesetPositionOf(holder))) return zone.cells ?? [];
  const action = caster.actions.find((entry) => entry.id === zone.actionId);
  const at = rulesetPositionOf(holder ?? caster);
  // Centred on its maker (1.282), carried as it moves.
  if (action?.around && !action.area && at) {
    return rulesetAroundCells(holder ?? caster, action.around, grid, zone.widened ?? 0);
  }
  if (!action?.area || !at) return [];
  // A line or cone held by its caster points the way it was cast, or last turned (1.182).
  if (action.area.shape === "line" || action.area.shape === "cone") {
    if (!zone.facing) return [];
    const toward = { x: at.x + zone.facing.dx, y: at.y + zone.facing.dy };
    return rulesetAreaCells(action.area.shape, action.area.size, at, toward, grid, action.area.width);
  }
  // Around every cell its caster (or holder) fills (1.194), each cell once, as wide as it has spread
  // (1.637).
  const cells = new Map<string, RulesetCombatCell>();
  for (const from of rulesetFootprint(holder ?? caster)) {
    for (const cell of rulesetAreaCells("burst", action.area.size + (zone.widened ?? 0), from, from, grid))
      cells.set(`${cell.x},${cell.y}`, cell);
  }
  return [...cells.values()];
}

/** Where a zone's light and reach are measured from (1.297): the point it was put at and its copies'
 *  (1.301), whoever carries it (1.301), or its caster. */
export function rulesetZoneMiddles(
  state: RulesetEncounterState,
  caster: RulesetCombatant,
  zone: RulesetCombatZone,
): RulesetCombatCell[] {
  const holder = zone.on ? rulesetCombatant(state, zone.on) : undefined;
  if (holder && rulesetPositionOf(holder)) return rulesetFootprint(holder);
  if (zone.anchor === "point") return zone.at ? [zone.at, ...(zone.also ?? [])] : [];
  return rulesetFootprint(caster);
}

/** The cells where a zone harms this combatant as they come in (an `enter` trigger with damage),
 *  by "x,y": what a walk would rather go round. */
function rulesetHarmfulCells(state: RulesetEncounterState, combatant: RulesetCombatant): Set<string> {
  const cells = new Set<string>();
  for (const caster of state.combatants) {
    for (const zone of caster.zones ?? []) {
      const action = caster.actions.find((entry) => entry.id === zone.actionId);
      if (!action?.damage || !zone.triggers.includes("enter")) continue;
      if (!rulesetZoneCatches(caster, zone, action, combatant)) continue;
      for (const cell of rulesetZoneCells(state, caster, zone)) cells.add(`${cell.x},${cell.y}`);
    }
  }
  return cells;
}

/** Whether a zone's area may catch this combatant at all, as the cast's own area would have: its
 *  own side left out where the entry said so, a mend only for whom it was pointed at, and the caster
 *  never caught by a zone they carry. */
export function rulesetZoneCatches(
  caster: RulesetCombatant,
  zone: RulesetCombatZone,
  action: RulesetCombatAction,
  combatant: RulesetCombatant,
): boolean {
  if (combatant.defeated) return false;
  if (zone.anchor === "caster" && combatant.id === caster.id) return false;
  // Left by an action that never hinders them (1.704): a web, to a spider.
  if (rulesetUnhinderedBy(combatant, [action.id, action.label])) return false;
  const sameSide = combatant.side === caster.side;
  if (action.area?.friendlyFire === false && sameSide) return false;
  // A mend, or a blessing pointed at allies, stays on the caster's own side.
  if ((action.heal || action.targets.side === "ally") && !sameSide) return false;
  return true;
}

/** Whether an action, by its id or label, never hinders this combatant (1.704): Web Walker. */
export function rulesetUnhinderedBy(combatant: RulesetCombatant, action: readonly (string | undefined)[]): boolean {
  return rulesetNamesAction(combatant.unhinderedBy, action);
}

/** Whether a list of names, in lower case, names an action by its id or label (1.704). */
export function rulesetNamesAction(
  names: readonly string[] | undefined,
  action: readonly (string | undefined)[],
): boolean {
  if (!names?.length) return false;
  return action.some((name) => !!name && names.includes(name.trim().toLowerCase()));
}

/** How a zone slows a cell for one mover: the plain steps moving into it costs at least (1.173, 1.175),
 *  and whether speed is halved there on top (1.175). */
export interface RulesetSlowedCell {
  times: number;
  halves: boolean;
  /** Hard going that counts only on a step nearer `at`, its zone's caster (1.182). */
  toward?: Array<{ at: RulesetCombatCell; times: number }>;
}

/** The cells a mover finds hard going because a zone that catches them covers them (1.173): the
 *  slowest of each cell's zones, and halved where any of them halves speed (1.175). */
export function rulesetSlowedCells(
  state: RulesetEncounterState,
  mover: RulesetCombatant,
  /** Walking carefully (1.689): ground that spares slow walkers costs double for them. */
  careful = false,
): Map<string, RulesetSlowedCell> {
  const slowed = new Map<string, RulesetSlowedCell>();
  for (const caster of state.combatants) {
    for (const zone of caster.zones ?? []) {
      const action = caster.actions.find((entry) => entry.id === zone.actionId);
      const rule = action?.zone;
      // Hard going in the stage it is at (1.557).
      const staged = zone.stage !== undefined && !!rule?.stages?.[zone.stage]?.difficult;
      const slowly = careful && !!rule?.spareSlowWalkers;
      if (!rule || !(rule.difficult || rule.costTimes || rule.halvesSpeed || staged || slowly)) continue;
      if (!rulesetZoneCatches(caster, zone, action, mover)) continue;
      // Its hard going easy for them (1.708): Ice Walk in Sleet Storm.
      if (rulesetNamesAction(mover.easyGround, [action.id, action.label])) continue;
      const times = rule.costTimes ?? (rule.difficult || staged ? 2 : 1);
      // Hard going only toward its caster (1.182): kept apart, and priced by the step.
      const from = rule.towardCaster ? rulesetPositionOf(caster) : null;
      if (rule.towardCaster && !from) continue;
      for (const cell of rulesetZoneCells(state, caster, zone)) {
        const key = `${cell.x},${cell.y}`;
        const was = slowed.get(key);
        slowed.set(key, {
          times: Math.max(was?.times ?? 1, from ? 1 : times),
          halves: (was?.halves ?? false) || !!rule.halvesSpeed || slowly,
          ...(from || was?.toward
            ? { toward: [...(was?.toward ?? []), ...(from ? [{ at: { x: from.x, y: from.y }, times }] : [])] }
            : {}),
        });
      }
    }
  }
  return slowed;
}

/** A step into a cell a zone slows costs its times the ground's plain price, without charging again
 *  for ground that was already hard going: difficult terrain does not stack (1.173). Halved speed is
 *  on top of that, as the step costs double again (1.175). Ground hard going only toward a caster
 *  counts when the step, from `from`, brings the mover nearer them (1.182). Ground the mover ignores
 *  was never hard going for them, so an area's is charged in full (1.432). */
export function rulesetSlowedStep(
  grid: TacticalGrid,
  cell: RulesetCombatCell,
  step: number,
  slowed: ReadonlyMap<string, RulesetSlowedCell>,
  from?: RulesetCombatCell,
  mover?: RulesetCombatant,
): number {
  const slow = slowed.get(`${cell.x},${cell.y}`);
  if (!slow) return step;
  let times = slow.times;
  for (const toward of slow.toward ?? []) {
    if (from && rulesetCellDistance(cell, toward.at) < rulesetCellDistance(from, toward.at)) {
      times = Math.max(times, toward.times);
    }
  }
  const hard = step + Math.max(0, times - enterCostFor(grid, cell, mover));
  return slow.halves ? hard * 2 : hard;
}
