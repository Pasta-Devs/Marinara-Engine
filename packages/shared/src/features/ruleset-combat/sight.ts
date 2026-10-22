/**
 * Who sees whom (Capability API 1.178; senses conditions and items give, and conditions that give
 * away the unseen, 1.180).
 *
 * Off a board everybody sees everybody, as before. On one, a viewer does not see somebody it has no
 * line to (walls and solid ground), somebody standing in, behind or beyond an obscuring zone from
 * where it stands, or somebody a condition hides (5e's invisible), unless one of the viewer's senses
 * pierces that, within that sense's range. A viewer whose conditions take away its eyes (the
 * `combat.sight.eyes` sense) sees only by a `blind` sense. Nothing here changes the fight: attacks
 * read it for their roll's mode, and "a creature you can see" reads it for who may be picked.
 */
import type { RulesetDefinition } from "../../schemas/ruleset.schema.js";
import {
  rulesetActiveConditions,
  rulesetCheckAbility,
  rulesetCheckMode,
  rulesetCheckSkill,
  rulesetCheckTakenModes,
  rulesetCombatConditions,
  rulesetSizeRank,
} from "./encounter.js";
import {
  rulesetInCells,
  rulesetLineOfSight,
  rulesetPositionOf,
  rulesetZoneCells,
  rulesetZoneMiddles,
  rulesetFootprint,
  rulesetGap,
} from "./grid.js";
import type { RulesetLightRadius } from "../../schemas/ruleset.schema.js";
import type {
  RulesetBoardLight,
  RulesetCombatant,
  RulesetCombatCell,
  RulesetEncounterState,
  RulesetHidingTraits,
} from "./types.js";
import type { TacticalGrid } from "../tactical-combat/types.js";
import type { RulesetSheetItem } from "../rulesets/sheet-math.js";
import { rulesetDroppedItems, rulesetItemOn } from "./ammo.js";
import { rulesetStandingZones } from "./zones.js";

/** How far each of the fight's senses reaches for this combatant, in cells: a creature's off its
 *  block, anybody else's as it was read off their sheet when the fight began. What their conditions
 *  and items give now (1.180) reaches further where it is longer: 5e's Darkvision spell, goggles of
 *  night, True Seeing. */
export function rulesetSenseRanges(
  definition: RulesetDefinition,
  combatant: RulesetCombatant,
  state?: RulesetEncounterState,
): Record<string, number> {
  const block = combatant.block?.senses;
  const perCell = definition.combat?.distance?.perCell;
  const ranges: Record<string, number> =
    block && perCell !== undefined
      ? Object.fromEntries(Object.entries(block).map(([id, range]) => [id, rulesetInCells(range, perCell)]))
      : { ...(combatant.senses ?? {}) };
  const combat = definition.combat;
  if (!combat || perCell === undefined) return ranges;
  // What is added (1.182) is added to the holder's own range, never to what another grant gave.
  const own = { ...ranges };
  for (const source of rulesetActiveConditions(definition, combat, combatant, state)) {
    for (const [id, grant] of Object.entries(source.senses ?? {})) {
      const range =
        typeof grant === "number"
          ? rulesetInCells(grant, perCell)
          : (own[id] ?? 0) + rulesetInCells(grant.add, perCell);
      ranges[id] = Math.max(ranges[id] ?? 0, range);
    }
  }
  return ranges;
}

/** Every cell a straight line from one cell's middle to another's passes through, both ends included. */
function cellsBetween(a: RulesetCombatCell, b: RulesetCombatCell): RulesetCombatCell[] {
  const steps = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y)) * 2;
  const cells: RulesetCombatCell[] = [];
  const seen = new Set<string>();
  for (let step = 0; step <= steps; step++) {
    const t = steps === 0 ? 0 : step / steps;
    const x = Math.round(a.x + (b.x - a.x) * t);
    const y = Math.round(a.y + (b.y - a.y) * t);
    const key = `${x},${y}`;
    if (seen.has(key)) continue;
    seen.add(key);
    cells.push({ x, y });
  }
  return cells;
}

/** The cells magical darkness covers now (1.299). */
function magicalDarkness(state: RulesetEncounterState): Set<string> {
  const cells = new Set<string>();
  for (const caster of state.combatants) {
    for (const zone of caster.zones ?? []) {
      const rule = zone.obscures ?? caster.actions.find((entry) => entry.id === zone.actionId)?.zone?.obscures;
      if (!rule?.darkness) continue;
      for (const cell of rulesetZoneCells(state, caster, zone)) cells.add(`${cell.x},${cell.y}`);
    }
  }
  return cells;
}

/** The cells obscuring zones cover now, each with the senses that see through it. */
function obscured(state: RulesetEncounterState): Array<{ cells: Set<string>; pierced: string[]; light?: true }> {
  // What lies on the ground (1.318): growth lightly obscures, and a fog of its own as it says.
  const lightly = new Set<string>();
  const heavily = new Set<string>();
  for (const [at, here] of Object.entries(state.board?.grid.ground ?? {})) {
    if (here.obscured === "heavy") heavily.add(at);
    else if (here.obscured === "light" || here.growth) lightly.add(at);
  }
  const ground = [
    ...(heavily.size ? [{ cells: heavily, pierced: [] as string[] }] : []),
    ...(lightly.size ? [{ cells: lightly, pierced: [] as string[], light: true as const }] : []),
  ];
  return ground.concat(
    state.combatants.flatMap((caster) =>
      (caster.zones ?? []).flatMap((zone) => {
        const rule = zone.obscures ?? caster.actions.find((entry) => entry.id === zone.actionId)?.zone?.obscures;
        if (!rule) return [];
        const cells = new Set(rulesetZoneCells(state, caster, zone).map((cell) => `${cell.x},${cell.y}`));
        return cells.size > 0
          ? [{ cells, pierced: rule.pierced, ...(rule.light ? { light: true as const } : {}) }]
          : [];
      }),
    ),
  );
}

/**
 * Whether somebody stands lightly or heavily obscured now (1.291): in a fog or a haze, or on a
 * board fought in dim light or darkness; where the dark is real (1.294), in dim light or darkness
 * where they stand, past what anybody's light reaches. What a creature may do only out of sight
 * reads this.
 */
export function rulesetStandsObscured(
  state: RulesetEncounterState,
  who: RulesetCombatant,
  definition?: RulesetDefinition,
): boolean {
  const board = state.board;
  if (!board?.grid) return false;
  const footprint = rulesetFootprint(who);
  if (definition?.combat?.sight?.darkness) {
    if (footprint.some((cell) => !brightLight(rulesetLightAt(definition, state, cell)))) return true;
  } else if (board.light === "dim" || board.light === "dark") return true;
  const cells = footprint.map((cell) => `${cell.x},${cell.y}`);
  return obscured(state).some((fog) => cells.some((key) => fog.cells.has(key)));
}

function brightLight(light: RulesetBoardLight): boolean {
  return light === "bright" || light === "sunlight";
}

/** Light shed from where somebody stands (1.294), in cells. */
interface LightSource {
  cells: RulesetCombatCell[];
  bright: number;
  /** How far the dim light reaches, from the same cells. */
  edge: number;
  /** How far its bright light shows the invisible (1.297). */
  reveals?: number;
  /** The only cells it lights, a zone's own (1.297). */
  only?: Set<string>;
  /** How far its bright light is sunlight (1.298). */
  sunlight?: number;
  /** How far its magical light reaches (1.299), the only light in magical darkness. */
  magic?: { bright: number; edge: number };
  /** It sheds shade (1.319): dim light out to `edge`, however bright it is there. */
  shade?: true;
}

/**
 * The light somebody sheds now where the dark is real (1.294), in cells: the farthest-reaching of
 * their block's, their conditions' and items', and the light the ruleset says everybody fighting
 * from a sheet carries unless they see in the dark. Null when they shed none.
 */
export function rulesetLightOf(
  definition: RulesetDefinition,
  who: RulesetCombatant,
  state?: RulesetEncounterState,
): {
  bright: number;
  dim: number;
  reveals?: number;
  sunlight?: number;
  /** The part of it that is magical (1.299), which alone lights magical darkness. */
  magic?: { bright: number; dim: number };
  /** How far the shade it sheds reaches (1.319), in cells. */
  shade?: { reach: number };
} | null {
  const combat = definition.combat;
  const darkness = combat?.sight?.darkness;
  const perCell = combat?.distance?.perCell;
  if (!combat || !darkness || perCell === undefined) return null;
  const active = rulesetActiveConditions(definition, combat, who, state);
  // Its own light hidden with it (1.298): a will-o'-wisp's while it is invisible.
  const hidden = who.block?.lightOutWhile?.some((id) => active.some((source) => source.condition === id));
  // A condition's light is a spell's (1.299), and magical.
  const spelled = active.flatMap((source) => (source.light && !source.item ? [source.light] : []));
  const all = [...(hidden ? [] : ownLight(who)), ...spelled, ...itemLights(who)];
  if (darkness.carried && !who.doused && !daylit(who, state) && rulesetCarriesLight(definition, who, state))
    all.push(darkness.carried);
  // Shade (1.319) is its own: it darkens what the rest lights.
  const shades = all.filter((one) => one.shade);
  const shade = shades.length
    ? { reach: Math.max(...shades.map((one) => rulesetInCells(one.dim, perCell))) }
    : undefined;
  const radii = all.filter((one) => !one.shade);
  if (radii.length === 0) return shade ? { bright: 0, dim: 0, shade } : null;
  // No bright light at all is none, not the one cell a distance rounds up to (1.296).
  const bright = Math.max(...radii.map((one) => (one.bright > 0 ? rulesetInCells(one.bright, perCell) : 0)));
  const edge = Math.max(...radii.map((one) => rulesetInCells(one.bright + one.dim, perCell)));
  // Its bright light showing the invisible (1.297): a lantern of revealing's own reach.
  const revealing = radii.filter((one) => one.reveals && one.bright > 0);
  const reveals = revealing.length
    ? Math.max(...revealing.map((one) => rulesetInCells(one.bright, perCell)))
    : undefined;
  // Its bright light the sun's (1.298): a sun blade's.
  const sunny = radii.filter((one) => one.sunlight && one.bright > 0);
  const sunlight = sunny.length ? Math.max(...sunny.map((one) => rulesetInCells(one.bright, perCell))) : undefined;
  const magical = [...spelled, ...radii.filter((one) => one.magical && !spelled.includes(one))];
  const magicBright = magical.length
    ? Math.max(...magical.map((one) => (one.bright > 0 ? rulesetInCells(one.bright, perCell) : 0)))
    : 0;
  const magicEdge = magical.length
    ? Math.max(...magical.map((one) => rulesetInCells(one.bright + one.dim, perCell)))
    : 0;
  return {
    bright,
    dim: Math.max(0, edge - bright),
    ...(magical.length ? { magic: { bright: magicBright, dim: Math.max(0, magicEdge - magicBright) } } : {}),
    ...(reveals !== undefined ? { reveals } : {}),
    ...(sunlight !== undefined ? { sunlight } : {}),
    ...(shade ? { shade } : {}),
  };
}

/** Whether somebody stands where nobody would light a torch: in bright light or sunlight of the
 *  ground's own, or in shade on a board fought in sunlight, a barn at noon. Dark of the ground's own
 *  is lit whatever the board's. */
function daylit(who: RulesetCombatant, state: RulesetEncounterState | undefined): boolean {
  const at = rulesetPositionOf(who);
  if (!state?.board || !at) return false;
  const ambient = state.board.light ?? "bright";
  const own = state.board.grid.ground?.[`${at.x},${at.y}`]?.light ?? ambient;
  return own === "bright" || own === "sunlight" || (own === "dim" && ambient === "sunlight");
}

/** A creature's own light (1.294): as its block says, out while it begins `unlit`, and as its own
 *  actions last lit or put it out (1.296). */
function ownLight(who: RulesetCombatant): RulesetLightRadius[] {
  const now = who.shedding ?? (who.block?.unlit ? "out" : who.block?.light);
  return now && now !== "out" ? [now] : [];
}

/** Whether somebody carries the ruleset's `carried` light (1.294), lit or put out (1.295): they fight
 *  from a sheet and no sense of theirs sees in the dark. */
export function rulesetCarriesLight(
  definition: RulesetDefinition,
  who: RulesetCombatant,
  state?: RulesetEncounterState,
): boolean {
  const darkness = definition.combat?.sight?.darkness;
  if (!darkness?.carried || who.block) return false;
  const ranges = rulesetSenseRanges(definition, who, state);
  return !darkness.seeIn.some((sense) => (ranges[sense] ?? 0) > 0);
}

/** The light their items shed (1.294): a worn item's `worn` effect and any other's `carried` one,
 *  not where it was dropped, and one with a switch only while it is on (1.295). */
function itemLights(who: RulesetCombatant): RulesetLightRadius[] {
  const items = who.sheet?.items ?? [];
  if (items.length === 0) return [];
  const dropped = rulesetDroppedItems(who);
  return items.flatMap((held, index) => {
    if (dropped.has(index)) return [];
    // Switched off, only what it sheds while off (1.296): a hooded lantern's hood down.
    const off = !!held.item.toggle && !rulesetItemOn(who, index);
    const light = off ? held.item.toggle?.offLight : (held.worn ? held.item.worn : held.item.carried)?.light;
    return light ? [light] : [];
  });
}

/** Whether any of these held items sheds shade as its stack keeps it now (1.365), outside a fight: a
 *  Lantern of Dusk carried lit. One with a switch counts only while it is on, unless it sheds shade off. */
export function rulesetItemsShedShade(items: readonly RulesetSheetItem[]): boolean {
  return items.some((held) => {
    const off = !!held.item.toggle && held.on !== true;
    const light = off ? held.item.toggle?.offLight : (held.worn ? held.item.worn : held.item.carried)?.light;
    return light?.shade === true;
  });
}

function lightSources(definition: RulesetDefinition, state: RulesetEncounterState): LightSource[] {
  if (!definition.combat?.sight?.darkness) return [];
  const shed = state.combatants.flatMap((one): LightSource[] => {
    if (one.defeated || !rulesetPositionOf(one)) return [];
    const light = rulesetLightOf(definition, one, state);
    if (!light) return [];
    const shade: LightSource[] = light.shade
      ? [
          {
            cells: rulesetFootprint(one),
            bright: 0,
            edge: light.shade.reach,
            shade: true,
          },
        ]
      : [];
    return light.bright + light.dim > 0
      ? [
          ...shade,
          {
            cells: rulesetFootprint(one),
            bright: light.bright,
            edge: light.bright + light.dim,
            ...(light.reveals !== undefined ? { reveals: light.reveals } : {}),
            ...(light.sunlight !== undefined ? { sunlight: light.sunlight } : {}),
            ...(light.magic
              ? { magic: { bright: light.magic.bright, edge: light.magic.bright + light.magic.dim } }
              : {}),
          },
        ]
      : shade;
  });
  // A zone's light (1.297), over its own cells from its middle: a point's, or its caster's.
  const zones = rulesetStandingZones(state).flatMap(({ caster, zone, action }): LightSource[] => {
    const lights = action.zone?.lights;
    if (!lights) return [];
    const middle = rulesetZoneMiddles(state, caster, zone);
    const only = new Set(rulesetZoneCells(state, caster, zone).map((cell) => `${cell.x},${cell.y}`));
    if (middle.length === 0 || only.size === 0) return [];
    return [
      {
        cells: middle,
        bright: lights.bright,
        edge: lights.bright + lights.dim,
        only,
        ...(lights.reveals && lights.bright > 0 ? { reveals: lights.bright } : {}),
        ...(lights.sunlight && lights.bright > 0 ? { sunlight: lights.bright } : {}),
        ...(lights.shade ? { shade: true as const } : {}),
        // A spell's light is magical (1.299).
        magic: { bright: lights.bright, edge: lights.bright + lights.dim },
      },
    ];
  });
  return [...shed, ...zones];
}

/** Whether `seen` stands in the bright light of something that shows the invisible (1.297). */
function revealedByLight(sources: LightSource[], grid: TacticalGrid, seen: RulesetCombatant): boolean {
  const theirs = rulesetFootprint(seen);
  return sources.some(
    (source) =>
      source.reveals !== undefined &&
      theirs.some(
        (cell) =>
          (!source.only || source.only.has(`${cell.x},${cell.y}`)) &&
          source.cells.some(
            (from) =>
              Math.max(Math.abs(from.x - cell.x), Math.abs(from.y - cell.y)) <= source.reveals! &&
              rulesetLineOfSight(grid, from, cell),
          ),
      ),
  );
}

/** The light on a cell from these sources, over a board fought in `base` (1.294). Light goes no
 *  further than a line from where it is shed reaches: walls keep it out. */
function lightFrom(
  sources: LightSource[],
  grid: TacticalGrid,
  cell: RulesetCombatCell,
  base: RulesetBoardLight,
  /** In magical darkness (1.299): only magical light reaches it. */
  magicDark = false,
): RulesetBoardLight {
  let light = base;
  for (const source of sources) {
    if (source.only && !source.only.has(`${cell.x},${cell.y}`)) continue;
    const reach = magicDark ? source.magic : source;
    if (!reach) continue;
    for (const from of source.cells) {
      const away = Math.max(Math.abs(from.x - cell.x), Math.abs(from.y - cell.y));
      if (away > reach.edge || !rulesetLineOfSight(grid, from, cell)) continue;
      // Sunlight outshines any other bright light (1.298), so the search goes on past one.
      if (source.sunlight !== undefined && away <= Math.min(source.sunlight, reach.bright)) return "sunlight";
      if (reach.bright > 0 && away <= reach.bright) light = "bright";
      else if (light === "dark") light = "dim";
    }
  }
  return light;
}

/** The light on a cell where shade reaches it (1.319): dim, however bright or dark it was. Magical
 *  darkness it never reaches. */
function shadedLight(
  sources: LightSource[],
  grid: TacticalGrid,
  cell: RulesetCombatCell,
  light: RulesetBoardLight,
): RulesetBoardLight {
  const shaded = sources.some(
    (source) =>
      source.shade &&
      (!source.only || source.only.has(`${cell.x},${cell.y}`)) &&
      source.cells.some(
        (from) =>
          Math.max(Math.abs(from.x - cell.x), Math.abs(from.y - cell.y)) <= source.edge &&
          rulesetLineOfSight(grid, from, cell),
      ),
  );
  return shaded ? "dim" : light;
}

/**
 * The light on a cell of the board now (1.294): the light the fight is fought in, raised where the
 * dark is real by whatever light somebody sheds there. Bright light when nothing says otherwise.
 */
export function rulesetLightAt(
  definition: RulesetDefinition,
  state: RulesetEncounterState,
  cell: RulesetCombatCell,
): RulesetBoardLight {
  const grid = state.board?.grid;
  // A cell with its own light (1.318) is in it, whatever the board's.
  const base = grid?.ground?.[`${cell.x},${cell.y}`]?.light ?? state.board?.light ?? "bright";
  if (!definition.combat?.sight?.darkness || !grid) return base;
  const sources = lightSources(definition, state);
  // Magical darkness (1.299): dark whatever the fight is fought in, lit only by magical light.
  if (magicalDarkness(state).has(`${cell.x},${cell.y}`)) {
    return lightFrom(sources, grid, cell, "dark", true);
  }
  if (base === "sunlight") return shadedLight(sources, grid, cell, base);
  // Bright light already: only a light that is sunlight changes it (1.298).
  if (base === "bright") {
    const sunlit = sources.filter((source) => source.sunlight !== undefined);
    return shadedLight(sources, grid, cell, sunlit.length ? lightFrom(sunlit, grid, cell, base) : base);
  }
  return shadedLight(sources, grid, cell, lightFrom(sources, grid, cell, base));
}

/**
 * What the fight board shows of light and fog now, cell by cell ("x,y"): the light on each cell
 * that is not bright, and each cell a fog or haze covers, `heavy` unless it only lightly obscures.
 * Cells in bright light and clear air are left out; a board without a grid shows nothing.
 */
export function rulesetBoardShading(
  definition: RulesetDefinition,
  state: RulesetEncounterState,
): { light: Record<string, RulesetBoardLight>; fog: Record<string, "light" | "heavy"> } {
  const light: Record<string, RulesetBoardLight> = {};
  const fog: Record<string, "light" | "heavy"> = {};
  const grid = state.board?.grid;
  if (!grid) return { light, fog };
  const base = state.board?.light ?? "bright";
  const real = !!definition.combat?.sight?.darkness;
  const sources = real ? lightSources(definition, state) : [];
  const sunlit = sources.filter((source) => source.sunlight !== undefined);
  const dark = real ? magicalDarkness(state) : new Set<string>();
  for (let y = 0; y < grid.height; y += 1) {
    for (let x = 0; x < grid.width; x += 1) {
      const key = `${x},${y}`;
      const cell = { x, y };
      // A cell's own light (1.318), as rulesetLightAt reads it.
      const own = grid.ground?.[key]?.light ?? base;
      let here: RulesetBoardLight = own;
      if (real) {
        if (dark.has(key)) here = lightFrom(sources, grid, cell, "dark", true);
        else if (own === "bright") here = sunlit.length ? lightFrom(sunlit, grid, cell, own) : own;
        else if (own !== "sunlight") here = lightFrom(sources, grid, cell, own);
        if (!dark.has(key)) here = shadedLight(sources, grid, cell, here);
      }
      if (here !== "bright") light[key] = here;
    }
  }
  for (const one of obscured(state)) {
    for (const key of one.cells) {
      if (one.light) fog[key] ??= "light";
      else fog[key] = "heavy";
    }
  }
  return { light, fog };
}

/**
 * Whether `viewer` sees `seen` now. Yourself you always see. Off a board, or without anybody's
 * position, everybody sees everybody: nothing measures anything there.
 */
export function rulesetCanSee(
  definition: RulesetDefinition,
  state: RulesetEncounterState,
  viewer: RulesetCombatant,
  seen: RulesetCombatant,
): boolean {
  // Nobody sees somebody hidden from them (1.287).
  if (rulesetHiddenFrom(viewer, seen)) return false;
  return sees(definition, state, viewer, seen, false);
}

/** Whether `seen` is hidden from `viewer` (1.287): they hid, and that opponent has not found them. */
export function rulesetHiddenFrom(viewer: RulesetCombatant, seen: RulesetCombatant | undefined): boolean {
  return !!seen && viewer.id !== seen.id && !!seen.hiding?.from.includes(viewer.id);
}

/**
 * Whether somebody hiding with this Stealth `total` would stay hidden from `viewer` (1.287): an
 * opponent still in the fight that does not see them clearly, and whose passive Perception (the
 * ruleset's `passive` plus its `perception` check, `lightly` less where it sees them only lightly
 * obscured) the total meets. Somebody hidden in `plain` sight (1.292) needs only the passive beaten;
 * one that may hide behind somebody larger is not seen clearly from behind them; and nobody hides
 * from a viewer aware of everybody that near.
 */
export function rulesetStaysHidden(
  definition: RulesetDefinition,
  state: RulesetEncounterState,
  viewer: RulesetCombatant,
  seen: RulesetCombatant,
  total: number,
  plain = !!seen.hiding?.plain,
): boolean {
  const hiding = definition.combat?.hiding;
  if (!hiding || viewer.side === seen.side || viewer.defeated || viewer.id === seen.id) return false;
  if (rulesetAwareOf(definition, state, viewer, seen)) return false;
  let dim = 0;
  if (!plain) {
    if (sees(definition, state, viewer, seen, true)) {
      if (!rulesetHidingTraits(definition, seen).behindLarger || !screenedByLarger(definition, state, viewer, seen))
        return false;
    } else if (sees(definition, state, viewer, seen, false)) dim = hiding.lightly ?? 5;
  }
  // A creature's printed passive, where it has one (1.291).
  const passive = viewer.block?.passive ?? (hiding.passive ?? 10) + (viewer.checks?.[hiding.perception] ?? 0);
  return total >= passive - dim + passiveShift(definition, state, viewer, seen);
}

/** A combatant's own ways of hiding and finding the hidden (1.292), off its abilities and, for a
 *  creature, its block, `aware` in cells. */
export function rulesetHidingTraits(
  definition: RulesetDefinition,
  who: RulesetCombatant,
): {
  behindLarger?: true;
  still?: number;
  stillWhile?: { holds?: string; wall?: true };
  unseenStrikes?: true;
  slow?: "advantage";
  aware: Array<{ within: number; lostWith?: string[] }>;
  starts?: number;
  surprises?: true;
} {
  const traits: ReturnType<typeof rulesetHidingTraits> = { aware: [] };
  const perCell = definition.combat?.distance?.perCell ?? 1;
  const add = (one: RulesetHidingTraits | undefined, inCells: boolean) => {
    if (!one) return;
    if (one.behindLarger) traits.behindLarger = true;
    // The best still, with what that one needs (1.309).
    if (one.still && one.still >= (traits.still ?? 0)) {
      traits.still = one.still;
      if (one.stillWhile) traits.stillWhile = { ...one.stillWhile };
      else delete traits.stillWhile;
    }
    if (one.unseenStrikes) traits.unseenStrikes = true;
    if (one.surprises) traits.surprises = true;
    if (one.slow) traits.slow = one.slow;
    if (one.starts) traits.starts = Math.max(traits.starts ?? 0, one.starts);
    if (one.aware) {
      traits.aware.push({
        within: inCells ? one.aware.within : rulesetInCells(one.aware.within, perCell),
        ...(one.aware.lostWith ? { lostWith: one.aware.lostWith } : {}),
      });
    }
  };
  for (const action of who.actions) add(action.hiding, true);
  add(who.block?.hiding, false);
  return traits;
}

/** Whether `viewer` is aware of `seen` where it stands (1.292): close enough that nobody hides from
 *  it, and without whatever takes that away. A rogue's Blindsense. */
export function rulesetAwareOf(
  definition: RulesetDefinition,
  state: RulesetEncounterState,
  viewer: RulesetCombatant,
  seen: RulesetCombatant,
): boolean {
  const aware = rulesetHidingTraits(definition, viewer).aware;
  if (aware.length === 0 || !state.board?.grid || !rulesetPositionOf(viewer) || !rulesetPositionOf(seen)) return false;
  const own = new Set(rulesetCombatConditions(definition, viewer));
  const gap = rulesetGap(viewer, seen);
  return aware.some((one) => gap <= one.within && !one.lostWith?.some((condition) => own.has(condition)));
}

/** Whether somebody at least one size larger than `seen` stands between them and `viewer` (1.292),
 *  on every line from the one to the other. */
function screenedByLarger(
  definition: RulesetDefinition,
  state: RulesetEncounterState,
  viewer: RulesetCombatant,
  seen: RulesetCombatant,
): boolean {
  const combat = definition.combat;
  if (!combat || !state.board?.grid) return false;
  const rank = rulesetSizeRank(combat, seen);
  if (rank === undefined) return false;
  const screens = state.combatants.filter((one) => {
    if (one.id === viewer.id || one.id === seen.id || one.defeated || !rulesetPositionOf(one)) return false;
    const theirs = rulesetSizeRank(combat, one);
    return theirs !== undefined && theirs > rank;
  });
  if (screens.length === 0) return false;
  const blocking = new Set(screens.flatMap((one) => rulesetFootprint(one).map((cell) => `${cell.x},${cell.y}`)));
  const theirCells = rulesetFootprint(seen);
  return rulesetFootprint(viewer).every((a) =>
    theirCells.every((b) => cellsBetween(a, b).some((cell) => blocking.has(`${cell.x},${cell.y}`))),
  );
}

/** What a passive Perception gains or loses for the advantage or disadvantage it has (1.290): the
 *  viewer's own, and what the one it looks for puts on looking for them. */
function passiveShift(
  definition: RulesetDefinition,
  state: RulesetEncounterState,
  viewer: RulesetCombatant,
  seen: RulesetCombatant,
): number {
  const combat = definition.combat!;
  const shift = combat.hiding?.passiveMode;
  if (!shift) return 0;
  const check = combat.hiding!.perception;
  const skill = rulesetCheckSkill(definition, check);
  const taken = rulesetCheckTakenModes(definition, combat, seen, state, skill);
  const mode = rulesetCheckMode(
    definition,
    combat,
    viewer,
    state,
    skill,
    rulesetCheckAbility(definition, check),
    taken,
  );
  return mode === "advantage" ? shift : mode === "disadvantage" ? -shift : 0;
}

/**
 * Whether `viewer` sees `seen` only through something that lightly obscures them (1.286): seen,
 * but by no line that is free of it. A sight-based Perception into it is harder.
 */
export function rulesetLightlyObscured(
  definition: RulesetDefinition,
  state: RulesetEncounterState,
  viewer: RulesetCombatant,
  seen: RulesetCombatant,
): boolean {
  if (rulesetHiddenFrom(viewer, seen)) return false;
  return sees(definition, state, viewer, seen, false) && !sees(definition, state, viewer, seen, true);
}

/** Whether `viewer` sees `seen`; with `clearly`, a light obscurement counts against it too. */
function sees(
  definition: RulesetDefinition,
  state: RulesetEncounterState,
  viewer: RulesetCombatant,
  seen: RulesetCombatant,
  clearly: boolean,
): boolean {
  if (viewer.id === seen.id) return true;
  const combat = definition.combat;
  if (!combat) return true;
  const ranges = rulesetSenseRanges(definition, viewer, state);
  const blindSenses = new Set((combat.senses ?? []).filter((sense) => sense.blind).map((sense) => sense.id));
  // Conditions read raw, without their gates: a gate may itself ask who sees whom.
  const own = new Set(rulesetCombatConditions(definition, viewer));
  const entries = combat.conditions ?? [];
  const eyes = combat.sight?.eyes;
  // Eyes kept from a gaze's holder (1.268) see nothing of them; a blind sense still does.
  const sightless =
    !!viewer.averted?.includes(seen.id) ||
    (eyes !== undefined && entries.some((entry) => own.has(entry.condition) && entry.lacks?.includes(eyes)));
  const grid = state.board?.grid;
  const from = rulesetPositionOf(viewer);
  const to = rulesetPositionOf(seen);
  const positioned = !!grid && !!from && !!to;
  // Nearest cell to nearest cell (1.194).
  const away = positioned ? rulesetGap(viewer, seen) : 0;
  // A sense that sees past `pierced` reaches this far; a sightless viewer has only its blind ones.
  const pierces = (pierced: readonly string[] | undefined) =>
    (pierced ?? []).some(
      (sense) =>
        (!sightless || blindSenses.has(sense)) && (ranges[sense] ?? 0) >= away && (positioned || ranges[sense]),
    );
  if (sightless) {
    // Without eyes there is only what a blind sense reaches, and off a board nobody measures that.
    // What hides from every sense but those it names still hides from them (below).
    const reach = positioned
      ? [...blindSenses].some((sense) => (ranges[sense] ?? 0) >= away)
      : [...blindSenses].some((sense) => (ranges[sense] ?? 0) > 0);
    if (!reach) return false;
  }
  // Hidden by a condition (5e's invisible) unless a sense sees it, or another of theirs gives them
  // away (1.180: Faerie Fire outlines the invisible).
  const theirs = new Set(rulesetCombatConditions(definition, seen));
  // Or by standing in the bright light of a lantern of revealing (1.297).
  const outlined =
    entries.some((entry) => entry.cancelsUnseen && theirs.has(entry.condition)) ||
    (positioned &&
      entries.some((entry) => entry.unseen && theirs.has(entry.condition)) &&
      revealedByLight(lightSources(definition, state), grid, seen));
  for (const entry of entries) {
    if (!outlined && entry.unseen && theirs.has(entry.condition) && !pierces(entry.unseen.pierced)) return false;
  }
  if (!positioned) return true;
  // A light obscurement hides nobody (1.286): it only keeps them from being seen clearly.
  const fogs = obscured(state).filter((fog) => clearly || !fog.light);
  // The dark (1.294), for eyes: nobody in darkness is seen, nor anybody in dim light clearly, but by
  // a sense that sees in the dark (one step brighter) or whatever the light, within its range.
  const darkness = combat.sight?.darkness;
  const base = state.board?.light ?? "bright";
  // A cell's own light (1.318) and shade (1.319) may make a bright board dark or dim somewhere.
  const sources = darkness && !sightless ? lightSources(definition, state) : [];
  const ground = grid.ground ?? {};
  const darkens =
    !brightLight(base) ||
    Object.values(ground).some((here) => here.light && !brightLight(here.light)) ||
    sources.some((source) => source.shade);
  const dark =
    darkness && !sightless && darkens
      ? {
          sources,
          anyway: [...blindSenses, ...(darkness.pierced ?? [])].some((sense) => (ranges[sense] ?? 0) >= away),
          seeIn: darkness.seeIn.some((sense) => (ranges[sense] ?? 0) >= away),
        }
      : null;
  const lit = (b: RulesetCombatCell) => {
    if (!dark || dark.anyway) return true;
    const own = ground[`${b.x},${b.y}`]?.light ?? base;
    const light = shadedLight(dark.sources, grid, b, brightLight(own) ? own : lightFrom(dark.sources, grid, b, own));
    if (brightLight(light)) return true;
    if (light === "dim") return dark.seeIn || !clearly;
    return dark.seeIn && !clearly;
  };
  // Any cell the viewer fills to any cell the seen one does (1.194): one clear line is enough.
  const clear = (a: RulesetCombatCell, b: RulesetCombatCell) => {
    if (!rulesetLineOfSight(grid, a, b) || !lit(b)) return false;
    if (fogs.length === 0) return true;
    const line = cellsBetween(a, b).map((cell) => `${cell.x},${cell.y}`);
    return fogs.every((fog) => !line.some((key) => fog.cells.has(key)) || pierces(fog.pierced));
  };
  const theirCells = rulesetFootprint(seen);
  return rulesetFootprint(viewer).some((a) => theirCells.some((b) => clear(a, b)));
}

/**
 * Whether `viewer` sees a cell of the board (1.276): as they would see somebody of one cell standing
 * there with nothing about them hidden, so what keeps their own eyes from it (blindness, a fog, a
 * wall, the dark past what their senses reach) keeps the cell from them too.
 */
export function rulesetSeesCell(
  definition: RulesetDefinition,
  state: RulesetEncounterState,
  viewer: RulesetCombatant,
  cell: RulesetCombatCell,
): boolean {
  if (rulesetFootprint(viewer).some((one) => one.x === cell.x && one.y === cell.y)) return true;
  const there = {
    id: "\u0000cell",
    name: "",
    side: viewer.side,
    tracked: [],
    flags: {},
    x: cell.x,
    y: cell.y,
  } as unknown as RulesetCombatant;
  return rulesetCanSee(definition, state, viewer, there);
}
