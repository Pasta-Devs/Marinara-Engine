/**
 * Lasting areas (Capability API 1.172): what a zone covers now, and whom it may catch.
 *
 * A zone held at a point keeps the cells it was cast on. One held by its caster is a burst worked
 * out around them wherever they stand, so it goes where they go. Nothing here changes the fight;
 * the resolver decides when a zone catches somebody and does it.
 */
import { rulesetCombatant } from "./encounter.js";
import {
  rulesetCellDistance,
  rulesetFootprint,
  rulesetPositionOf,
  rulesetZoneCatches,
  rulesetZoneCells,
} from "./grid.js";
import type {
  RulesetBoardProp,
  RulesetCombatAction,
  RulesetCombatant,
  RulesetCombatCell,
  RulesetCombatZone,
  RulesetEncounterState,
  RulesetReachableCell,
} from "./types.js";

// Worked out beside the walking they slow (1.173), and said here too, where a zone is read.
export { rulesetZoneCatches, rulesetZoneCells, rulesetZoneMiddles } from "./grid.js";

/** Every zone standing, with whose it is. */
export function rulesetStandingZones(
  state: RulesetEncounterState,
): Array<{ caster: RulesetCombatant; zone: RulesetCombatZone; action: RulesetCombatAction }> {
  return state.combatants.flatMap((caster) =>
    (caster.zones ?? []).flatMap((zone) => {
      const action = caster.actions.find((entry) => entry.id === zone.actionId);
      return action ? [{ caster, zone, action }] : [];
    }),
  );
}

/** The light a zone sheds now (1.297): what it `becomes` sheds once it has gone off (1.453). */
export function rulesetZoneLights(
  zone: RulesetCombatZone,
  action: RulesetCombatAction,
): NonNullable<RulesetCombatAction["zone"]>["lights"] {
  return zone.became ? action.zone?.detonates?.becomes?.lights : action.zone?.lights;
}

/** A zone's cells, and for a wall laid as a ring (1.603) every cell it rings: Forcecage's cage. */
export function rulesetZoneHold(
  state: RulesetEncounterState,
  caster: RulesetCombatant,
  zone: RulesetCombatZone,
  action: RulesetCombatAction,
): Set<string> {
  const hold = new Set(rulesetZoneCells(state, caster, zone).map((cell) => `${cell.x},${cell.y}`));
  const ring = action.area?.ring;
  const grid = state.board?.grid;
  if (!zone.ringed || !zone.at || !ring || !grid) return hold;
  const radius = Math.max(1, Math.round(ring / 2));
  for (let y = Math.max(0, zone.at.y - radius); y <= Math.min(grid.height - 1, zone.at.y + radius); y++) {
    for (let x = Math.max(0, zone.at.x - radius); x <= Math.min(grid.width - 1, zone.at.x + radius); x++) {
      if (rulesetCellDistance(zone.at, { x, y }) < radius) hold.add(`${x},${y}`);
    }
  }
  return hold;
}

/** Whether a cell is one of a zone's. */
export function rulesetZoneHolds(cells: readonly RulesetCombatCell[], cell: RulesetCombatCell | null): boolean {
  return !!cell && cells.some((one) => one.x === cell.x && one.y === cell.y);
}

/** Whether a zone's cells hold any cell somebody fills (1.194). */
export function rulesetZoneHoldsOne(cells: readonly RulesetCombatCell[], combatant: RulesetCombatant): boolean {
  return rulesetFootprint(combatant).some((cell) => rulesetZoneHolds(cells, cell));
}

/** Who a zone has inside it now, among those it may catch. */
export function rulesetZoneOccupants(
  state: RulesetEncounterState,
  caster: RulesetCombatant,
  zone: RulesetCombatZone,
  action: RulesetCombatAction,
): string[] {
  const cells = rulesetZoneCells(state, caster, zone);
  return state.combatants
    .filter((one) => rulesetZoneCatches(caster, zone, action, one) && rulesetZoneHoldsOne(cells, one))
    .map((one) => one.id);
}

/** Who stands on a wall's chosen side now (1.177), among those it may catch. */
export function rulesetZoneSideOccupants(
  state: RulesetEncounterState,
  caster: RulesetCombatant,
  zone: RulesetCombatZone,
  action: RulesetCombatAction,
): string[] {
  const cells = zone.sideCells ?? [];
  if (cells.length === 0) return [];
  return state.combatants
    .filter((one) => rulesetZoneCatches(caster, zone, action, one) && rulesetZoneHoldsOne(cells, one))
    .map((one) => one.id);
}

/**
 * The cells standing walls close (1.177), written onto the board's grid where moving and seeing read
 * them, and taken off again as each wall ends. Worked out afresh from every standing zone, so a wall
 * that ended however it ended closes nothing any more.
 */
export function rulesetSyncZoneWalls(state: RulesetEncounterState): void {
  const grid = state.board?.grid;
  if (!grid) return;
  const walls: Record<string, number> = {};
  for (const { zone, action } of rulesetStandingZones(state)) {
    const blocks = action.zone?.blocks;
    if (!blocks || zone.anchor !== "point") continue;
    const bits = (blocks.move ? 1 : 0) | (blocks.sight ? 2 : 0);
    // One that blocks only spells (1.602) closes no cell.
    if (bits === 0) continue;
    // A broken section closes nothing (1.200).
    const broken = new Set(
      (zone.sections ?? [])
        .filter((section) => section.health <= 0)
        .flatMap((section) => section.cells.map((cell) => `${cell.x},${cell.y}`)),
    );
    for (const cell of zone.cells ?? []) {
      if (broken.has(`${cell.x},${cell.y}`)) continue;
      const key = `${cell.x},${cell.y}`;
      walls[key] = (walls[key] ?? 0) | bits;
    }
  }
  // A prop closes its cells while it stands (1.316).
  for (const prop of rulesetStandingProps(state)) {
    const bits = (prop.blocks?.move ? 1 : 0) | (prop.blocks?.sight ? 2 : 0);
    if (!bits) continue;
    for (const cell of prop.cells) {
      const key = `${cell.x},${cell.y}`;
      walls[key] = (walls[key] ?? 0) | bits;
    }
  }
  if (Object.keys(walls).length > 0) grid.walls = walls;
  else delete grid.walls;
}

/** The zones a fight shows: each one's caster, label, rounds left and cells, and a wall's side. */
/** Whether a side sees a zone (1.455): its caster's own always, others once one of them found it. */
export function rulesetZoneSeenBy(
  caster: RulesetCombatant,
  zone: RulesetCombatZone,
  action: RulesetCombatAction,
  side: string,
): boolean {
  return !action.zone?.hidden || caster.side === side || !!zone.foundBy?.includes(side);
}

/** The zones a side sees (the party's by default): a hidden one of its foes' only once found (1.455). */
export function rulesetZonesShown(
  state: RulesetEncounterState,
  side = "party",
): Array<{
  casterId: string;
  label: string;
  rounds: number;
  cells: RulesetCombatCell[];
  side?: RulesetCombatCell[];
  sections?: Array<{ cells: RulesetCombatCell[]; health: number; max: number }>;
  /** How it looks (1.333): a `bz_` tile of the board's pack. */
  art?: string;
}> {
  return rulesetStandingZones(state).flatMap(({ caster, zone, action }) =>
    !rulesetZoneSeenBy(caster, zone, action, side)
      ? []
      : [
          {
            casterId: caster.id,
            label: zone.label,
            rounds: zone.rounds,
            ...(action.zone?.art ? { art: action.zone.art } : {}),
            cells: rulesetZoneCells(state, rulesetCombatant(state, caster.id) ?? caster, zone).map((cell) => ({
              ...cell,
            })),
            ...(zone.sideCells?.length ? { side: zone.sideCells.map((cell) => ({ ...cell })) } : {}),
            // Each section and what it has left (1.200).
            ...(zone.sections?.length && action.zone?.sections
              ? {
                  sections: zone.sections.map((section) => ({
                    cells: section.cells.map((cell) => ({ ...cell })),
                    health: Math.max(0, section.health),
                    max: action.zone!.sections!.health,
                  })),
                }
              : {}),
          },
        ],
  );
}

/** What still stands on the board that may be broken (1.316). */
export function rulesetStandingProps(state: RulesetEncounterState): RulesetBoardProp[] {
  return (state.board?.props ?? []).filter((prop) => prop.health > 0);
}

/** The standing sections of walls that may be struck (1.200), each with its zone. */
export function rulesetStandingSections(state: RulesetEncounterState): Array<{
  caster: RulesetCombatant;
  zone: RulesetCombatZone;
  action: RulesetCombatAction;
  section: { cells: RulesetCombatCell[]; health: number };
}> {
  return rulesetStandingZones(state).flatMap(({ caster, zone, action }) =>
    action.zone?.sections
      ? (zone.sections ?? [])
          .filter((section) => section.health > 0)
          .map((section) => ({ caster, zone, action, section }))
      : [],
  );
}

/** Every layered wall standing (1.490), with its cells: struck at, it stands in for one blow. */
export function rulesetStandingLayers(state: RulesetEncounterState): Array<{
  caster: RulesetCombatant;
  zone: RulesetCombatZone;
  action: RulesetCombatAction;
  cells: RulesetCombatCell[];
}> {
  if (!state.board?.grid) return [];
  return rulesetStandingZones(state).flatMap(({ caster, zone, action }) =>
    action.zone?.layers ? [{ caster, zone, action, cells: rulesetZoneCells(state, caster, zone) }] : [],
  );
}

/** Where a zone may be moved to (1.173): any cell of the board within its `move` distance of where
 *  it is centred, its own cell aside. Priced as the distance, so a board draws it as a walk. */
export function rulesetZoneMoveCells(
  state: RulesetEncounterState,
  zone: RulesetCombatZone,
  distance: number,
): RulesetReachableCell[] {
  const grid = state.board?.grid;
  if (!grid || !zone.at) return [];
  const cells: RulesetReachableCell[] = [];
  for (let y = Math.max(0, zone.at.y - distance); y <= Math.min(grid.height - 1, zone.at.y + distance); y++) {
    for (let x = Math.max(0, zone.at.x - distance); x <= Math.min(grid.width - 1, zone.at.x + distance); x++) {
      const away = rulesetCellDistance(zone.at, { x, y });
      if (away > 0) cells.push({ x, y, cost: away, path: [], provokes: [] });
    }
  }
  return cells;
}

/** The ways a line or cone its caster carries may be turned to face (1.182): toward any cell next
 *  to them on the board but the one it faces now, each a step away. */
export function rulesetZoneTurnCells(
  state: RulesetEncounterState,
  caster: RulesetCombatant,
  zone: RulesetCombatZone,
): RulesetReachableCell[] {
  const grid = state.board?.grid;
  const at = rulesetPositionOf(caster);
  if (!grid || !at || !zone.facing) return [];
  const cells: RulesetReachableCell[] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if ((dx === 0 && dy === 0) || (dx === zone.facing.dx && dy === zone.facing.dy)) continue;
      const x = at.x + dx;
      const y = at.y + dy;
      if (x < 0 || y < 0 || x >= grid.width || y >= grid.height) continue;
      cells.push({ x, y, cost: 1, path: [], provokes: [] });
    }
  }
  return cells;
}

/** Where a drifting zone goes next (1.173): `distance` cells straight away from its caster, stopping
 *  at the board's edge. A zone centred on its caster's own cell has no "away" and stays. */
export function rulesetZoneDriftCell(
  state: RulesetEncounterState,
  caster: RulesetCombatant,
  zone: RulesetCombatZone,
  distance: number,
): RulesetCombatCell | null {
  const grid = state.board?.grid;
  const from = rulesetPositionOf(caster);
  if (!grid || !zone.at || !from) return null;
  const dx = Math.sign(zone.at.x - from.x);
  const dy = Math.sign(zone.at.y - from.y);
  if (dx === 0 && dy === 0) return null;
  const x = Math.min(grid.width - 1, Math.max(0, zone.at.x + dx * distance));
  const y = Math.min(grid.height - 1, Math.max(0, zone.at.y + dy * distance));
  return x === zone.at.x && y === zone.at.y ? null : { x, y };
}
