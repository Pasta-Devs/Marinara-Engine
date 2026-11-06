// What a positioned ruleset fight's board shows, with no React in it.
//
// The server sends the whole board: the terrain, where everybody stands, which cells the walk may
// end on and what each one costs, who a path would be struck at by, who an option may be pointed
// at, and which cells a shape may be aimed at with everybody each aim would catch. Nothing here
// measures a distance, decides who may be hit or works out whether a step is legal: it reads the
// view, indexes it by cell, and hands a component one row per square.
//
// The one number this file turns into another is the ruleset's own: a count of cells becomes the
// ruleset's own distance by its own `perCell`, so the screen says "20 ft" or "8 paces" rather than
// a cell count nobody at the table would recognise.
//
// The one shape it draws is an aimed area's template, with the Engine's own pure shape function: the
// view sends the shape in cells so the template can be drawn before the cast, and who it would catch
// still comes from the server's own aim entries.
import type {
  DirectedRulesetCombatant,
  DirectedRulesetOption,
  DirectedRulesetView,
  RulesetCombatCell,
  TacticalTerrain,
} from "@marinara-engine/shared";
import { rulesetAreaCells, rulesetWallShape, TERRAIN_DATA, type TacticalGrid } from "@marinara-engine/shared";
import type { TFunction } from "i18next";
import type { RulesetAimLay, RulesetMenuStep } from "./ruleset-combat-menu";

/** What this ruleset calls one cell's worth of distance. */
export type RulesetBoardDistance = { label: string; perCell: number };

/** One square of a board, ready to draw. Every flag came off the view. */
export interface RulesetBoardCell {
  x: number;
  y: number;
  terrain: TacticalTerrain;
  /** Nothing walks into it and nothing sees through it. From the Engine's own terrain table, which
   *  is the same table the server's own reachable cells were worked out from. */
  solid: boolean;
  /** How high the cell stands (combat C6b), 0 on level ground. */
  height: number;
  /** Off the map (2026-10-24): beyond the board's outline, drawn as nothing. */
  outside?: true;
  /** Who is standing here, defeated or not: on every cell they fill (1.194). */
  occupant?: DirectedRulesetCombatant;
  /** The cell their token is drawn from, the top-left one they fill (1.194). */
  anchor?: true;
  /** Set while a walk is being chosen: what ending here costs of the allowance, in cells, and the
   *  ids of the standing enemies the path would be struck at by. */
  reach?: { cost: number; provokes: string[] };
  /** Set while a target is being chosen and a legal one stands here. */
  targetable?: boolean;
  /** Set while a shape is being aimed: the ids this aim would catch, which may be nobody. */
  aim?: { targetIds: string[]; teleport?: true; carry?: true };
  /** A cell the shape being laid has already been set down on (1.177, 1.178). */
  laid?: true;
  /** The labels of the lasting areas covering it (1.172), first cast first. */
  zones?: string[];
  /** Which of the board's area tints each of them takes, once each, first cast first: each kind of area
   *  its own, so a Spirit Guardians never reads as the same thing as a Web, nor as water, and where two
   *  overlap both show. */
  zoneTints?: number[];
  /** What a spell called up that strikes from here (a Spiritual Weapon), by label. */
  summons?: string[];
  /** Their looks in the board's pack (1.333), first cast first, for those that have one. */
  zoneArt?: string[];
  /** A wall's section standing here (1.200): whose wall, and what it has left of what; 0 is broken. */
  section?: { wall: string; health: number; max: number };
  /** Growth here (1.318): hard going, lightly obscuring. */
  growth?: true;
  /** The season on this cell (1.318), when it has one of its own. */
  season?: string;
  /** A prop standing here (1.316): what it is, and what it has left of what; 0 is broken. */
  prop?: {
    label: string;
    health: number;
    max: number;
    /** Its sprite (1.333), and where this cell sits in the box its cells fill, from its top-left. */
    art?: string;
    dx: number;
    dy: number;
  };
  /** Set while a target is being chosen and the attack may strike the section here (1.200). */
  strikable?: true;
  /** The light here when it is not bright: sunlight, dim light or darkness. */
  light?: "sunlight" | "dim" | "dark";
  /** A fog or haze covering it: heavy unless it only lightly obscures. */
  fog?: "light" | "heavy";
}

/** What a square's light and fog are called, said aloud and in its tooltip. */
export const RULESET_BOARD_LIGHT_KEYS = {
  sunlight: "game.combat.ruleset.board.light.sunlight",
  dim: "game.combat.ruleset.board.light.dim",
  dark: "game.combat.ruleset.board.light.dark",
} as const;
export const RULESET_BOARD_FOG_KEYS = {
  light: "game.combat.ruleset.board.fog.light",
  heavy: "game.combat.ruleset.board.fog.heavy",
} as const;

export const rulesetCellKey = (cell: { x: number; y: number }): string => `${cell.x},${cell.y}`;

/** Whether taking this option on a board asks the player to aim it at a cell rather than at anybody.
 *  Every shape does, one with nowhere to land included: the server refuses a shape sent with no
 *  cell, so the step opens and says nobody would be caught instead of sending a choice that fails. */
/** How many tints the board draws lasting areas in. */
export const RULESET_ZONE_TINTS = 5;

/** The tint an area takes, by its name: the same kind of area is always the same colour. */
export function rulesetZoneTint(label: string): number {
  let hash = 0;
  for (const char of label) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash % RULESET_ZONE_TINTS;
}

export function rulesetOptionNeedsAim(option: DirectedRulesetOption): boolean {
  // A teleport is aimed at where it goes (1.276).
  return !!option.area || (option.teleport?.cells.length ?? 0) > 0;
}

/** Where an option that moves its target may set that target down (1.565), once it is picked. */
export function rulesetCarryCells(option: DirectedRulesetOption, targets: readonly string[]): RulesetCombatCell[] {
  const target = targets[0];
  return target !== undefined ? (option.movesTarget?.cells[target] ?? []) : [];
}

/** Whether a shape has any square it may be aimed at right now. */
export function rulesetOptionHasAim(option: DirectedRulesetOption): boolean {
  return (option.aim?.length ?? 0) > 0;
}

/** What an aimed shape sends: where it lands, and how it is laid (1.177, 1.178). */
export interface RulesetAimChoice {
  at: RulesetCombatCell;
  toward?: RulesetCombatCell;
  side?: "near" | "far";
  ring?: boolean;
  also?: RulesetCombatCell[];
}

/** The cells a choice made on the board carries: where a walk goes, or where a shape lands and how
 *  it is laid. */
export type RulesetCellChoice = {
  to?: RulesetCombatCell;
  wall?: RulesetCombatCell;
  /** A lasting area ended instead of a creature (1.427). */
  dispel?: { casterId: string; actionId: string };
  /** A condition struck at to cut it away (1.531). */
  cut?: { holderId: string; condition: string };
  /** Which of its target's conditions it ends (1.427). */
  ends?: string[];
  /** Who goes along on a teleport (1.276). */
  carries?: string[];
  /** Whom a layered wall spares (1.492). */
  designates?: string[];
  /** Stored instead of done (1.524). */
  storesIn?: { holderId: string; item?: number };
  /** How many levels up a target moved to `to` is lifted (1.565). */
  rises?: number;
} & Partial<RulesetAimChoice>;

/** Whether a wall being aimed has been set down and waits for the way it runs: any cell picks it. */
export function rulesetAimTurning(option: DirectedRulesetOption, lay: RulesetAimLay | undefined): boolean {
  return option.area?.shape === "wall" && !lay?.ring && !!lay?.at;
}

/** Whether a pick that sends this shape is the last of several that laid it (a wall's way, a copy
 *  after the first), which its prompts already name as the confirming one. A ring chosen in the menu
 *  has no square yet: its first pick only shows who it catches, like any single-pick aim. */
export function rulesetAimLaidOverPicks(lay: RulesetAimLay | undefined): boolean {
  return !!lay?.at;
}

/** What is sent for the shape as it is laid so far, or null while nothing has been set down. */
export function rulesetAimSoFar(lay: RulesetAimLay | undefined): RulesetAimChoice | null {
  if (!lay?.at) return null;
  return {
    at: { ...lay.at },
    ...(lay.side ? { side: lay.side } : {}),
    ...(lay.ring ? { ring: true } : {}),
    ...(lay.also?.length ? { also: lay.also.map((cell) => ({ ...cell })) } : {}),
  };
}

/**
 * Picking a cell while a shape is aimed. Most shapes are sent there and then. A wall is set down on
 * the first cell and turned by the second, which is the cell it runs toward (the first again lays
 * it across its maker's line); a ring is sent at once. A shape set down several times (1.178) takes
 * one cell for each copy, and is sent with the last one it may have.
 */
export function rulesetAimTake(
  option: DirectedRulesetOption,
  lay: RulesetAimLay | undefined,
  cell: RulesetCombatCell,
): { send: RulesetAimChoice } | { lay: RulesetAimLay } {
  const at = { x: cell.x, y: cell.y };
  const area = option.area;
  if (area?.shape === "wall") {
    if (lay?.ring) return { send: { ...rulesetAimSoFar({ ...lay, at })!, ring: true } };
    if (!lay?.at) return { lay: { ...lay, at } };
    const across = lay.at.x === at.x && lay.at.y === at.y;
    return { send: { ...rulesetAimSoFar(lay)!, ...(across ? {} : { toward: at }) } };
  }
  if ((area?.copies ?? 1) > 1) {
    if (!lay?.at) return { lay: { ...lay, at } };
    const taken = [lay.at, ...(lay.also ?? [])].some((one) => one.x === at.x && one.y === at.y);
    if (taken) return { lay };
    const next = { ...lay, also: [...(lay.also ?? []), at] };
    return 1 + next.also.length >= area!.copies! ? { send: rulesetAimSoFar(next)! } : { lay: next };
  }
  return { send: { at } };
}

/**
 * The cells a shape aimed at `at` would cover, with the copies already set down (1.178), so the
 * board draws its template while it is aimed: a Fireball's sphere, a Lightning Bolt's line, a cone,
 * a cube, a wall turned toward `at` once it was set down (1.177). Laid from whichever cell the
 * actor fills nearest the aim (1.194), as the cast is. Empty when nothing is being aimed.
 */
export function rulesetAimTemplate(
  view: DirectedRulesetView,
  step: RulesetMenuStep | null,
  at: RulesetCombatCell | null,
): RulesetCombatCell[] {
  const grid = view.grid as TacticalGrid | undefined;
  const area = step?.stage === "aim" ? step.option.area : undefined;
  const actor = view.combatants.find((combatant) => combatant.id === view.actorId);
  if (!grid || !area || !step || step.option.teleport || typeof actor?.x !== "number" || typeof actor.y !== "number")
    return [];
  const span = Math.max(1, actor.span ?? 1);
  const from = (aim: RulesetCombatCell) => ({
    x: Math.min(Math.max(aim.x, actor.x!), actor.x! + span - 1),
    y: Math.min(Math.max(aim.y, actor.y!), actor.y! + span - 1),
  });
  const lay = step.lay;
  const shapes: RulesetCombatCell[][] = [];
  if (area.shape === "wall") {
    const first = lay?.at ?? at;
    if (!first) return [];
    const turned = lay?.at && at && (at.x !== lay.at.x || at.y !== lay.at.y) ? at : undefined;
    shapes.push(rulesetWallShape(grid, area, first, from(first), turned, undefined, !!lay?.ring).cells);
  } else {
    for (const aim of [lay?.at, ...(lay?.also ?? []), at]) {
      if (aim) shapes.push(rulesetAreaCells(area.shape, area.size, from(aim), aim, grid, area.width));
    }
  }
  const seen = new Map<string, RulesetCombatCell>();
  for (const cell of shapes.flat()) seen.set(rulesetCellKey(cell), cell);
  return [...seen.values()];
}

/** Where a shape that may only be aimed at its user's own square lands (Spirit Guardians, a
 *  self-centred burst): there is nothing to place, so it is sent there without a placing step. Null
 *  for anything with a choice of where. */
export function rulesetSelfAim(view: DirectedRulesetView, option: DirectedRulesetOption): RulesetCombatCell | null {
  const aims = option.aim ?? [];
  if (aims.length !== 1 || option.teleport || !option.area) return null;
  if (option.area.shape === "wall" || (option.area.copies ?? 1) > 1) return null;
  const actor = view.combatants.find((one) => one.id === (view.window?.actorId ?? view.actorId));
  if (typeof actor?.x !== "number" || typeof actor.y !== "number") return null;
  const span = Math.max(1, actor.span ?? 1);
  const only = aims[0]!;
  const inside = only.x >= actor.x && only.x < actor.x + span && only.y >= actor.y && only.y < actor.y + span;
  return inside ? { x: only.x, y: only.y } : null;
}

/** The alterations worth offering for an option (1.253): one that only spares its user's side
 *  (Sculpt Spells, Careful Spell) is left out of a shape no aim of which catches anybody of that
 *  side. An option aimed at targets rather than a square keeps them all. One that gives it another
 *  target (Twinned) needs somebody more to aim at, and one that stretches its range (Distant)
 *  somebody beyond its reach (cheap-GM playtest 2026-10-26: every spell asked about Metamagic). */
export function rulesetUsefulAlters(
  view: DirectedRulesetView,
  option: DirectedRulesetOption,
): NonNullable<DirectedRulesetOption["alters"]> {
  const beyondReach = (option.beyond ?? []).some((one) => one.why === "out-of-reach");
  const offers = (option.alters ?? []).filter(
    (offer) =>
      offer.id === option.alterNeeded ||
      ((!offer.twins || option.targetIds.length > option.targets.count) && (!offer.ranges || beyondReach)),
  );
  const sparing = (offer: (typeof offers)[number]) => !!offer.spares && offer.id !== option.alterNeeded;
  // Nothing aimed at a square catches anybody it did not pick: Light has nobody to spare.
  if (!option.area) return offers.filter((offer) => !sparing(offer));
  if (!option.aim || !view.grid) return offers;
  // Its user is not who it spares: a caster in their own blast asked about every Fireball otherwise.
  const actor = view.combatants.find((one) => one.id === (view.window?.actorId ?? view.actorId));
  const own = new Set(
    view.combatants.filter((one) => one.side === actor?.side && one.id !== actor?.id).map((one) => one.id),
  );
  if (option.aim.some((aim) => aim.targetIds.some((id) => own.has(id)))) return offers;
  return offers.filter((offer) => !sparing(offer));
}

/** Who an aim at this cell would catch of the actor's own side, the actor included: what the
 *  board warns about before the cast. */
export function rulesetAimCatchesAllies(
  view: DirectedRulesetView,
  targetIds: readonly string[],
  option?: DirectedRulesetOption,
): string[] {
  const actor = view.combatants.find((combatant) => combatant.id === view.actorId);
  // A ward does nothing to those it catches (Magic Circle): no warning about the caster's own side.
  if (!actor || option?.harmless) return [];
  return targetIds.filter((id) => view.combatants.find((combatant) => combatant.id === id)?.side === actor.side);
}

/** Whether taking this option asks the player to pick a cell to walk to: a walk, or a legendary
 *  move (1.283). Getting back up spends movement and goes nowhere, so it is sent straight off the
 *  menu. */
export function rulesetOptionNeedsCell(option: DirectedRulesetOption): boolean {
  return (option.kind === "move" || !!option.signature) && (option.cells?.length ?? 0) > 0;
}

/**
 * Every square of the board, in reading order, with whatever the half-made choice highlights.
 *
 * `step` is the menu's own half-made choice: while a walk is being chosen the reachable cells carry
 * their cost, while a target is being chosen the cells the legal targets stand on are marked, and
 * while a shape is being aimed every cell it may be aimed at carries who it would catch.
 */
export function rulesetBoardCells(view: DirectedRulesetView, step: RulesetMenuStep | null): RulesetBoardCell[] {
  const grid = view.grid;
  if (!grid) return [];
  const standing = new Map<string, DirectedRulesetCombatant>();
  const fallen = (combatant: DirectedRulesetCombatant) => (combatant.defeated ? 2 : combatant.down ? 1 : 0);
  for (const combatant of view.combatants) {
    if (typeof combatant.x !== "number" || typeof combatant.y !== "number") continue;
    // Sent away (1.236): not on the board at all. One that gave itself up stays where it did, a
    // prisoner beside its captor (re-test 14).
    if (combatant.away && !combatant.surrendered) continue;
    // Every cell they fill (1.194). A creature still up is drawn over one down, and one down over a
    // body, so whoever walks onto a fallen creature's square stays on the board.
    const span = Math.max(1, combatant.span ?? 1);
    for (let dy = 0; dy < span; dy++) {
      for (let dx = 0; dx < span; dx++) {
        const key = rulesetCellKey({ x: combatant.x + dx, y: combatant.y + dy });
        // A prisoner never hides whoever has since walked onto its square.
        if (combatant.away && standing.has(key)) continue;
        const there = standing.get(key);
        if (there && !there.away && fallen(there) < fallen(combatant)) continue;
        standing.set(key, combatant);
      }
    }
  }
  const reach = new Map<string, { cost: number; provokes: string[] }>();
  if (step?.stage === "move") {
    for (const cell of step.option.cells ?? []) {
      reach.set(rulesetCellKey(cell), { cost: cell.cost, provokes: [...cell.provokes] });
    }
  }
  const aims = new Map<string, { targetIds: string[]; teleport?: true; carry?: true }>();
  const laid = new Set<string>();
  if (step?.stage === "aim") {
    // A teleport's cells are where it may go (1.276), not what it would catch.
    const teleport = step.option.teleport ? { teleport: true as const } : {};
    for (const entry of step.option.aim ?? []) {
      aims.set(rulesetCellKey(entry), { targetIds: [...entry.targetIds], ...teleport });
    }
    for (const cell of [step.lay?.at, ...(step.lay?.also ?? [])]) if (cell) laid.add(rulesetCellKey(cell));
  }
  // Where its target may be moved to (1.565): Telekinesis.
  if (step?.stage === "carry") {
    for (const cell of rulesetCarryCells(step.option, step.targets)) {
      aims.set(rulesetCellKey(cell), { targetIds: [], carry: true });
    }
  }
  const targets = new Set(step?.stage === "target" ? step.option.targetIds : []);
  const strikable = new Set(step?.stage === "target" ? (step.option.walls ?? []).map(rulesetCellKey) : []);
  const sections = new Map<string, { wall: string; health: number; max: number }>();
  const props = new Map<string, NonNullable<RulesetBoardCell["prop"]>>();
  for (const prop of view.props ?? []) {
    const [left, top] = [Math.min(...prop.cells.map((cell) => cell.x)), Math.min(...prop.cells.map((cell) => cell.y))];
    for (const cell of prop.cells)
      props.set(rulesetCellKey(cell), {
        label: prop.label,
        health: prop.health,
        max: prop.max,
        ...(prop.art ? { art: prop.art } : {}),
        dx: cell.x - left,
        dy: cell.y - top,
      });
  }
  const zoned = new Map<string, string[]>();
  const zoneArt = new Map<string, string[]>();
  for (const zone of view.zones ?? []) {
    for (const section of zone.sections ?? []) {
      for (const cell of section.cells) {
        sections.set(rulesetCellKey(cell), { wall: zone.label, health: section.health, max: section.max });
      }
    }
    for (const cell of zone.cells) {
      const key = rulesetCellKey(cell);
      zoned.set(key, [...(zoned.get(key) ?? []), zone.label]);
      if (zone.art) zoneArt.set(key, [...(zoneArt.get(key) ?? []), zone.art]);
    }
    // A wall's side (1.177) is drawn as the zone's too: walking there is caught as it says.
    for (const cell of zone.side ?? []) {
      const key = rulesetCellKey(cell);
      zoned.set(key, [...(zoned.get(key) ?? []), zone.label]);
    }
  }
  const summoned = new Map<string, string[]>();
  for (const summon of view.summons ?? []) {
    const key = rulesetCellKey(summon);
    summoned.set(key, [...(summoned.get(key) ?? []), summon.label]);
  }
  const cells: RulesetBoardCell[] = [];
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      // A row the board is shorter than is drawn as plains rather than crashing the screen: the
      // route bounds the saved shape, and a screen is not the place to find out it did not.
      const terrain = grid.tiles[y]?.[x] ?? "plains";
      const key = rulesetCellKey({ x, y });
      const occupant = standing.get(key);
      const aim = aims.get(key);
      cells.push({
        x,
        y,
        terrain,
        // A standing wall that blocks movement is as solid as rock while it stands (1.177).
        solid: TERRAIN_DATA[terrain]?.impassable === true || ((grid.walls?.[key] ?? 0) & 1) === 1,
        height: grid.elevation?.[y]?.[x] ?? 0,
        ...(grid.outside?.[y]?.[x] ? { outside: true as const } : {}),
        ...(occupant ? { occupant } : {}),
        ...(occupant && occupant.x === x && occupant.y === y ? { anchor: true as const } : {}),
        ...(reach.has(key) ? { reach: reach.get(key)! } : {}),
        ...(occupant && targets.has(occupant.id) ? { targetable: true } : {}),
        ...(aim ? { aim } : {}),
        ...(laid.has(key) ? { laid: true as const } : {}),
        ...(zoned.has(key)
          ? { zones: zoned.get(key)!, zoneTints: [...new Set(zoned.get(key)!.map(rulesetZoneTint))] }
          : {}),
        ...(summoned.has(key) ? { summons: summoned.get(key)! } : {}),
        ...(zoneArt.has(key) ? { zoneArt: zoneArt.get(key)! } : {}),
        ...(sections.has(key) ? { section: sections.get(key)! } : {}),
        ...(props.has(key) ? { prop: props.get(key)! } : {}),
        ...(grid.ground?.[key]?.growth ? { growth: true as const } : {}),
        ...(grid.ground?.[key]?.season ? { season: grid.ground[key]!.season! } : {}),
        ...(strikable.has(key) ? { strikable: true as const } : {}),
        ...(grid.light?.[key] ? { light: grid.light[key] } : {}),
        ...(grid.fog?.[key] ? { fog: grid.fog[key] } : {}),
      });
    }
  }
  return cells;
}

/** The cells a walk to this one passes through, from the one after the actor's own up to it, or an
 *  empty path for a cell the walk was never offered. */
export function rulesetPathTo(step: RulesetMenuStep | null, cell: { x: number; y: number }): RulesetCombatCell[] {
  if (step?.stage !== "move") return [];
  const key = rulesetCellKey(cell);
  return (step.option.cells ?? []).find((entry) => rulesetCellKey(entry) === key)?.path ?? [];
}

/** A count of cells said in the ruleset's own distance: "20 ft", "8 paces". Without a board there
 *  is no unit to say it in, so the count is printed as it stands. */
export function rulesetDistanceText(cells: number, distance: RulesetBoardDistance | undefined, t: TFunction): string {
  if (!distance) return String(cells);
  return t("game.combat.ruleset.board.distance", { amount: cells * distance.perCell, unit: distance.label });
}

/** Why somebody is not offered as a target now (2026-10-25), in words: "Ogre: 61 ft away, reach 60
 *  ft", "Ogre: no line to them", "Ogre: out of sight". */
export function rulesetBeyondText(
  beyond: { why: "out-of-reach" | "no-line-of-sight" | "unseen"; cells?: number; reach?: number },
  name: string,
  distance: RulesetBoardDistance | undefined,
  t: TFunction,
): string {
  const said = (cells: number) => rulesetDistanceText(Math.round(cells * 10) / 10, distance, t);
  if (beyond.why === "unseen") return t("game.combat.ruleset.target.beyondUnseen", { name });
  if (beyond.why === "no-line-of-sight") return t("game.combat.ruleset.target.beyondSight", { name });
  if (beyond.cells !== undefined && beyond.reach !== undefined)
    return t("game.combat.ruleset.target.beyondFar", { name, away: said(beyond.cells), reach: said(beyond.reach) });
  return t("game.combat.ruleset.target.beyondReach", { name });
}

/**
 * Whether this fight offers nothing that can be pointed at the other side, while the other side is
 * still standing. It is the one line the board says out loud, because a menu with an attack on it
 * that can be pointed at nobody reads as a bug rather than as "you are too far away".
 *
 * Only in a positioned fight, and only about options that COULD reach an opponent: a heal with
 * nobody hurt to point it at says nothing about how far away the enemy is.
 */
export function rulesetNothingInReach(view: DirectedRulesetView): boolean {
  if (!view.grid || !view.options) return false;
  if (!view.combatants.some((combatant) => combatant.side === "enemy" && !combatant.defeated)) return false;
  const offensive = view.options.filter(
    (option) =>
      (option.kind === "attack" ||
        option.kind === "ability" ||
        option.kind === "item" ||
        option.kind === "block" ||
        option.kind === "contest") &&
      (option.targets.side === "enemy" || option.targets.side === "any" || !!option.area),
  );
  if (offensive.length === 0) return false;
  return offensive.every(
    (option) =>
      option.targetIds.length === 0 &&
      (option.aim?.length ?? 0) === 0 &&
      (option.walls?.length ?? 0) === 0 &&
      (option.dispels?.length ?? 0) === 0 &&
      (option.cuts?.length ?? 0) === 0,
  );
}

/** The ids on a line, as names, for the sentences that have to say who. */
export function rulesetNamesOf(view: DirectedRulesetView, ids: readonly string[]): string[] {
  const names = new Map(view.combatants.map((combatant) => [combatant.id, combatant.name]));
  return ids.flatMap((id) => {
    const name = names.get(id);
    return name ? [name] : [];
  });
}

/**
 * What one square says, in whole sentences: the terrain, who is standing on it, and whatever the
 * half-made choice makes of it. It is the square's accessible name and the line under the board at
 * once, so a player reading with their eyes and a player reading with a screen reader are told the
 * same things in the same words.
 *
 * The terrain words are the Tactical board's own, because it is the same terrain of the same
 * battlefield and translating it twice would let the two boards disagree.
 */
export function rulesetCellSentences(cell: RulesetBoardCell, view: DirectedRulesetView, t: TFunction): string[] {
  const said: string[] = [
    t("game.combat.ruleset.board.terrain", {
      label: t(`ui.game.tacticalcombatui.terrain.${cell.terrain}`, { defaultValue: cell.terrain }),
    }),
  ];
  if (cell.height > 0) said.push(t("game.combat.ruleset.board.height", { height: cell.height }));
  // Water is walked round but seen across; a wall or a mountain is neither (combat C6).
  if (cell.solid)
    said.push(
      t(
        TERRAIN_DATA[cell.terrain]?.blocksSight
          ? "game.combat.ruleset.board.solid"
          : "game.combat.ruleset.board.seenAcross",
      ),
    );
  const who = cell.occupant;
  if (who) {
    // One who is down lies there rather than standing.
    said.push(
      t(who.down || who.defeated ? "game.combat.ruleset.board.whoLying" : "game.combat.ruleset.board.who", {
        name: who.name,
        value: who.health.value,
        max: who.health.max,
      }),
    );
    if (who.altitude !== undefined) said.push(t("game.combat.ruleset.board.flying", { height: who.altitude }));
    if (who.id === view.actorId) said.push(t("game.combat.ruleset.board.onTurn"));
    // Each its own sentence: "Down. Under: Unconscious." never runs on into what holds them.
    if (who.defeated) said.push(t("game.combat.ruleset.board.defeated"));
    else if (who.down) said.push(t("game.combat.ruleset.board.down"));
    // What they are doing, what holds them, and what they hold together: what a token's marks stand
    // for. A trait they carry all fight is the status list's to name, not the square's.
    for (const stance of who.stances ?? []) said.push(t(`game.combat.ruleset.stance.${stance}`));
    const held = who.conditions.filter((condition) => !condition.trait);
    if (held.length > 0)
      said.push(
        t("game.combat.ruleset.board.conditions", {
          list: held
            .map((condition) =>
              condition.rounds !== undefined
                ? t("game.combat.ruleset.board.conditionRounds", { label: condition.label, count: condition.rounds })
                : condition.label,
            )
            .join(", "),
        }),
      );
    if (who.concentrating) said.push(t("game.combat.ruleset.status.concentrating", { label: who.concentrating }));
  }
  if (cell.reach) {
    said.push(
      t("game.combat.ruleset.board.reachable", {
        amount: rulesetDistanceText(cell.reach.cost, view.grid?.distance, t),
      }),
    );
    if (cell.reach.provokes.length > 0) {
      said.push(
        t("game.combat.ruleset.board.provokes", { names: rulesetNamesOf(view, cell.reach.provokes).join(", ") }),
      );
    }
  }
  if (cell.section) {
    said.push(
      cell.section.health > 0
        ? t("game.combat.ruleset.board.section", cell.section)
        : t("game.combat.ruleset.board.sectionBroken", { wall: cell.section.wall }),
    );
  }
  if (cell.growth) said.push(t("game.combat.ruleset.board.growth"));
  if (cell.season) said.push(t("game.combat.ruleset.board.season", { season: cell.season }));
  if (cell.prop) {
    said.push(
      cell.prop.health > 0
        ? t("game.combat.ruleset.board.prop", { label: cell.prop.label, health: cell.prop.health, max: cell.prop.max })
        : t("game.combat.ruleset.board.propBroken", { label: cell.prop.label }),
    );
  }
  if (cell.light) said.push(t(RULESET_BOARD_LIGHT_KEYS[cell.light]));
  if (cell.fog) said.push(t(RULESET_BOARD_FOG_KEYS[cell.fog]));
  if (cell.targetable) said.push(t("game.combat.ruleset.board.targetable"));
  if (cell.strikable) said.push(t("game.combat.ruleset.board.strikable"));
  if (cell.aim?.teleport) said.push(t("game.combat.ruleset.board.teleportable"));
  else if (cell.aim?.carry) said.push(t("game.combat.ruleset.board.carryable"));
  else if (cell.aim) {
    const names = rulesetNamesOf(view, cell.aim.targetIds);
    said.push(
      names.length > 0
        ? t("game.combat.ruleset.board.aimable", { names: names.join(", ") })
        : t("game.combat.ruleset.board.aimableEmpty"),
    );
  }
  return said;
}

/** How full a health bar is drawn, as a percentage. Presentation only: the two numbers were both
 *  sent by the server and neither is changed here. */
export function rulesetHealthPercent(health: { value: number; max: number }): number {
  if (health.max <= 0) return 0;
  return Math.max(0, Math.min(100, (health.value / health.max) * 100));
}

/** Who an area held open for an answer catches: whom the window names, else whoever stands on the
 *  cells it sent. Nothing is measured: the cells are the server's, this only reads who is on them. */
export function rulesetHeldCaught(view: DirectedRulesetView): string[] {
  const window = view.window;
  if (!window) return [];
  if (window.targetIds?.length) return window.targetIds;
  if (!window.cells?.length) return [];
  const covered = new Set(window.cells.map(rulesetCellKey));
  return view.combatants
    .filter((combatant) => {
      if (combatant.defeated || combatant.left || combatant.away) return false;
      if (typeof combatant.x !== "number" || typeof combatant.y !== "number") return false;
      const span = Math.max(1, combatant.span ?? 1);
      for (let dx = 0; dx < span; dx++)
        for (let dy = 0; dy < span; dy++)
          if (covered.has(rulesetCellKey({ x: combatant.x + dx, y: combatant.y + dy }))) return true;
      return false;
    })
    .map((combatant) => combatant.id);
}
