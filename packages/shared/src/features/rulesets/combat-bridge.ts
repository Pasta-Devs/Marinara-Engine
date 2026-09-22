// The combat bridge: what a ruleset sheet lends to a battle, and what a battle writes back.
//
// This is NOT a combat adapter. It adds no attack rolls, no saving throws and no concentration, and
// it changes no damage arithmetic: a fight still runs on the Engine's own combat model. All it does
// is move numbers across the seam, both ways, for a ruleset that opted in with a `battle` block.
// Because the damage stays the Engine's, hit points cross as a SHARE of the maximum rather than as
// raw numbers; energy and slots are small counts spent one at a time, so they cross as they are.
//
// Everything here is pure, reads only the definition, the build and the stored live blob, and never
// throws. A ruleset with no `battle` block gets nothing from any of it, so a battle in that game is
// byte for byte the battle it was before.

import type { CombatSkill } from "../../types/game.js";
import {
  catalogRowRef,
  RULESET_CATALOG_ROW_KEY,
  rulesetSheetEnvelopeSchema,
  type RulesetCatalogEntriesById,
  type RulesetCatalogEntry,
  type RulesetCatalogMechanics,
  type RulesetDefinition,
  type RulesetSheetBuild,
} from "../../schemas/ruleset.schema.js";
import { normalizeCharacterLookupName } from "../../utils/character-lookup-name.js";
import {
  applyRulesetSheetOp,
  readRulesetLive,
  type RulesetLiveState,
  type RulesetSheetOp,
  type RulesetSheetRefusal,
} from "./live-state.js";

/** What a party combatant takes from the sheet at the start of a battle. `attack`, `defense`,
 *  `speed` and `level` are deliberately absent: they stay the Engine's own numbers, and so does the
 *  maximum hit points the fight is fought on. */
export interface RulesetCombatSeed {
  /** Combat scale: the share of the Engine's own maximum that the sheet's health pool is at. */
  hp: number;
  /** The Engine's own maximum, carried through untouched. It is the scale the share was taken
   *  against, and the one the write-back converts back from. */
  maxHp: number;
  /** Sheet scale: the health pool when the fight began, and the maximum it is measured against. */
  sheetHp: number;
  sheetMaxHp: number;
  mp?: number;
  maxMp?: number;
  /** Keyed by level as a string, which is how `Combatant.spellSlots` is keyed. */
  spellSlots?: Record<string, number>;
}

/** The same member's numbers when the battle ended, as the Engine's summary reports them, so `hp`
 *  is on the Engine's scale and `mp` and the slots are the sheet's own counts. */
export interface RulesetCombatOutcome {
  hp: number;
  mp?: number;
  spellSlots?: Record<string, number>;
}

export interface RulesetCombatWriteBack {
  /** The new stored blob, or null when no operation applied and the caller should write nothing. */
  live: RulesetLiveState | null;
  refused: Array<{ op: RulesetSheetOp; reason: RulesetSheetRefusal }>;
}

/**
 * Every game card that holds a sheet this version can read, keyed the way live state is keyed.
 *
 * One rule, shared: the bridge matches a battle's combatants to sheets with it, and a fight the
 * ruleset resolves itself matches its party with the same one, so a member is never read by one
 * and missed by the other. A card with no sheet, or one holding a sheet this version cannot read,
 * is absent: there is nothing to read from it and nothing to write back to it.
 */
export function rulesetSheetBuildsByName(cards: unknown, playerName?: string | null): Map<string, RulesetSheetBuild> {
  const player = typeof playerName === "string" ? playerName.trim() : "";
  const builds = new Map<string, RulesetSheetBuild>();
  for (const card of Array.isArray(cards) ? (cards as Array<Record<string, unknown>>) : []) {
    const name = typeof card?.name === "string" ? card.name.trim() : "";
    const key = name ? normalizeCharacterLookupName(name) : "";
    if (!key) continue;
    const envelope = rulesetSheetEnvelopeSchema.safeParse(card.rulesetSheet);
    if (!envelope.success) continue;
    // Setup keeps ONE sheet per normalized name and lets the persona's win a name it shares with a
    // party member, because the persona is the player. The same order holds here.
    if (builds.has(key) && name !== player) continue;
    builds.set(key, envelope.data.build);
  }
  return builds;
}

function own(row: Record<string, unknown>, key: string): unknown {
  return Object.prototype.hasOwnProperty.call(row, key) ? row[key] : undefined;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** A distance in a catalog's own unit, in tactical grid cells. A cell is the smallest step there
 *  is, so anything the author bothered to give a number to reaches at least one. */
function inCells(distance: number, perCell: number): number {
  return Math.max(1, Math.round(distance / perCell));
}

// ── Seeding ──

/** The live pool a `battle` block names, or undefined when this sheet does not have it right now:
 *  a pool whose maximum is zero, or that a `hideWhen` hides, is not a resource the character has.
 *  A declared pool's key is its id, so a list row's pool can never answer here. */
function livePool(live: ReturnType<typeof readRulesetLive>, id: string) {
  return live.pools.find((pool) => !pool.listId && pool.key === id);
}

/**
 * The health a `battle` block names, on whichever shape the ruleset gave it.
 *
 * A pool is its value out of its maximum. A WOUND TRACK is the levels it has LEFT out of its
 * length, which is the only reading that keeps the share honest: a share of a track is a fraction
 * of its length, a full track is zero, and an unmarked one is the whole of it. That is also exactly
 * what `rulesetCombatHealth` reports, so the two seams cannot come to different answers about
 * whether somebody is still standing.
 */
function liveHealth(
  live: ReturnType<typeof readRulesetLive>,
  health: { pool: string } | { track: string },
): { value: number; max: number; temp: number } | undefined {
  if (!("track" in health)) return livePool(live, health.pool);
  const track = live.tracks.find((entry) => entry.id === health.track);
  if (!track?.wound) return undefined;
  return { value: track.wound.levels.length - track.wound.marks.length, max: track.wound.levels.length, temp: 0 };
}

/**
 * The same health, read on the other scale: `value` out of `fromMax`, as a number out of `toMax`.
 *
 * Hit points cross this seam as a SHARE, never as raw numbers. The Engine gives a level 1 combatant
 * around 60 hit points and deals 11 to 15 damage a hit, while a sheet's health pool is on its own
 * scale (9 Grit, 8 hit points for a level 1 wizard). The damage arithmetic stays the Engine's, so
 * lending the raw number would kill a bridged character with the first blow of every fight.
 *
 * Nobody is rounded out of a fight or off a sheet: anything above zero stays above zero, zero stays
 * zero, and a scale with no maximum at all carries the whole amount rather than dividing by nothing.
 */
export function carryHealthShare(value: number, fromMax: number, toMax: number): number {
  if (!(fromMax > 0)) return toMax;
  if (!(value > 0)) return 0;
  return Math.max(1, Math.round((toMax * value) / fromMax));
}

/**
 * What the party combatant for this sheet starts the battle with, or null when the ruleset has no
 * `battle` block or the sheet has no health pool to read.
 *
 * The combatant keeps the maximum hit points the Engine gave it and starts at the share of it the
 * sheet's health pool is at. A member at zero starts the fight down, which is the state a
 * knocked-out member is in for the rest of it: every engine reads `hp > 0` for who may act and who
 * is still standing, and a party whose members are all at zero ends in an immediate defeat. A member
 * above zero never starts below one hit point, so a low share cannot knock somebody out by rounding.
 *
 * Energy and slots are ABSOLUTE, not shares: they are small counts, their costs come off the same
 * sheet, and the Engine spends them one at a time.
 *
 * A temporary buffer is deliberately left behind rather than added on top: the Engine has no
 * temporary hit points, and the write-back's `damage` operation drains the buffer first anyway, so
 * the buffer still absorbs the fight's first hits where it is stored.
 */
export function seedCombatantFromSheet(
  definition: RulesetDefinition,
  build: RulesetSheetBuild,
  storedLive: unknown,
  /** The maximum the Engine built this combatant with. It stays the combatant's own; the sheet
   *  decides only what share of it the fight starts on. */
  engineMaxHp: number,
): RulesetCombatSeed | null {
  const battle = definition.battle;
  if (!battle) return null;
  const live = readRulesetLive(definition, build, storedLive);
  const health = liveHealth(live, battle.health);
  if (!health) return null;

  const seed: RulesetCombatSeed = {
    hp: carryHealthShare(health.value, health.max, engineMaxHp),
    maxHp: engineMaxHp,
    sheetHp: health.value,
    sheetMaxHp: health.max,
  };
  const energy = battle.energy ? livePool(live, battle.energy.pool) : undefined;
  if (energy) {
    seed.mp = energy.value;
    seed.maxMp = energy.max;
  }
  const spellSlots: Record<string, number> = {};
  for (const slot of battle.slots ?? []) {
    const pool = livePool(live, slot.pool);
    // A slot level the character has none of is left out entirely, so the Engine reads "no such
    // thing" rather than "none left" — the same rule the live pools themselves follow.
    if (pool) spellSlots[String(slot.level)] = pool.value;
  }
  if (Object.keys(spellSlots).length > 0) seed.spellSlots = spellSlots;
  return seed;
}

// ── Catalog entries as combat skills ──

/** The average of `2d6`, `1d8+3` or a flat amount, or null when the block carries no number at all.
 *  The dice string was validated as `<count>d<sides>` with one optional adjustment. */
function averageAmount(amount: RulesetCatalogMechanics["amount"]): number | null {
  if (!amount || (amount.dice === undefined && amount.flat === undefined)) return null;
  let total = amount.flat ?? 0;
  if (amount.dice) {
    const parts = /^(\d{1,3})d(\d{1,4})([+-]\d{1,4})?$/.exec(amount.dice);
    if (!parts) return amount.flat ?? null;
    total += Number(parts[1]) * ((Number(parts[2]) + 1) / 2) + Number(parts[3] ?? 0);
  }
  return total;
}

/**
 * Average damage or healing per point of `CombatSkill.power`.
 *
 * `power` is a multiplier on the combatant's own attack stat, not a damage number, so this divisor
 * is a calibration against what the Engine already generates rather than arithmetic. The Engine's
 * own basic skills sit at 1.35 for an attack and 1.15 for a heal (`combatSkillsFromSheet` and
 * `combatSkillsFromGeneratedAttacks` in `GameSurface.tsx`), the encounter prompt asks the model for
 * roughly 1.2 to 1.3, and a generated skill is clamped to 3. At 7 a basic weapon lands where the
 * Engine's basic skills already are (1d8+3 reads 1.07, 2d6+3 reads 1.43) and a third-level area
 * spell reaches the top of that same range (6d6 reads 3.0, and anything bigger clamps there).
 */
const AVERAGE_AMOUNT_PER_POWER = 7;

/** The same ceiling a generated skill gets, so a catalog entry can never hit harder than anything
 *  the Engine itself produces, and the same floor the heal path applies. */
const MIN_POWER = 0.5;
const MAX_POWER = 3;

function powerFromAmount(amount: RulesetCatalogMechanics["amount"]): number {
  const average = averageAmount(amount);
  // No number at all is a plain multiplier of one: the entry says what it does in words, and the
  // Engine's own stats decide how hard it lands.
  if (average === null || !Number.isFinite(average)) return 1;
  return clamp(Math.round((average / AVERAGE_AMOUNT_PER_POWER) * 100) / 100, MIN_POWER, MAX_POWER);
}

/** The whole reach of an area, as the one radius the Engine's grid understands. A cone reaches half
 *  as many units sideways as it does forward, and a line is one cell wide. */
function areaRadius(area: NonNullable<RulesetCatalogMechanics["area"]>, perCell: number): number {
  const cells = inCells(area.size, perCell);
  if (area.shape === "line") return 1;
  return area.shape === "cone" ? Math.max(1, Math.round(cells / 2)) : cells;
}

function combatSkillFromEntry(
  battle: NonNullable<RulesetDefinition["battle"]>,
  entry: RulesetCatalogEntry,
  ref: string,
  perCell: number,
): CombatSkill | null {
  const mechanics = entry.mechanics;
  // `utility` has no Engine action behind it, a `rider` is passive and nobody takes it, and a
  // reaction is a timing window the combat handoff's adapters own. All three are better absent than
  // mapped to something they are not.
  if (!mechanics || mechanics.kind === "utility" || mechanics.kind === "rider" || mechanics.reaction) return null;

  let mpCost = 0;
  let slotLevel: number | undefined;
  let slotTerms = 0;
  let energyTerms = 0;
  for (const cost of mechanics.cost ?? []) {
    if (battle.energy && cost.pool === battle.energy.pool) {
      // Several energy terms are one bill: the Engine spends a single number.
      mpCost += cost.amount;
      energyTerms += 1;
      continue;
    }
    const slot = battle.slots?.find((entrySlot) => entrySlot.pool === cost.pool);
    if (slot) {
      // The Engine spends exactly one slot per use, so only a cost of exactly one slot is carried.
      if (cost.amount !== 1) return null;
      slotLevel = slot.level;
      slotTerms += 1;
      continue;
    }
    // A cost on a pool group, on hit points, or on a class resource the bridge cannot map: the
    // Engine would use the entry for free, so it does not offer it at all.
    return null;
  }
  // A skill with a slot level spends the slot INSTEAD of energy, so two slots, or a slot plus
  // energy, is a price the Engine cannot charge in full. Better absent than cheaper than it says.
  if (slotTerms > 1 || (slotTerms === 1 && energyTerms > 0)) return null;

  const skill: CombatSkill = {
    // The catalog reference is already unique and stable, and it holds a slash, so it can never
    // collide with a generated skill's slug.
    id: ref,
    name: entry.label,
    type: mechanics.kind,
    mpCost,
    power: powerFromAmount(mechanics.amount),
  };
  if (entry.summary) skill.description = entry.summary;
  if (mechanics.range !== undefined) skill.range = inCells(mechanics.range, perCell);
  if (mechanics.area) {
    skill.areaRadius = areaRadius(mechanics.area, perCell);
    // The Engine's only wide scope is "all enemies", which is right for something that harms and
    // badly wrong for a heal or a buff: those stay single-target rather than mending the other side.
    if (mechanics.kind === "attack" || mechanics.kind === "debuff") skill.targetScope = "all-enemies";
  }
  if (mechanics.friendlyFire !== undefined) skill.friendlyFire = mechanics.friendlyFire;
  if (mechanics.damageType) skill.element = mechanics.damageType;
  if (slotLevel !== undefined) {
    skill.slotLevel = slotLevel;
    skill.spell = true;
  }
  return skill;
}

/**
 * The combat skills this sheet brings, built from the rows a catalog wrote and the entry each one
 * came from. A hand-typed row contributes nothing: there is no `mechanics` block behind it, so there
 * is nothing to turn into numbers.
 *
 * `perCostStep`, `save`, `attackRoll` and `concentration` are read by nobody here. They are the
 * facts a real combat adapter needs, and applying them would be a claim this bridge cannot make.
 * `targets` is left out too: the Engine picks who a skill may be pointed at from its type.
 */
export function combatSkillsFromSheet(
  definition: RulesetDefinition,
  build: RulesetSheetBuild,
  catalogs: RulesetCatalogEntriesById,
): CombatSkill[] {
  const battle = definition.battle;
  if (!battle?.skills?.length) return [];

  const byRef = new Map<string, { entry: RulesetCatalogEntry; perCell: number }>();
  for (const [catalogId, entries] of Object.entries(catalogs)) {
    const perCell = definition.catalogs?.find((catalog) => catalog.id === catalogId)?.units?.distance?.perCell;
    for (const entry of entries) {
      byRef.set(catalogRowRef(catalogId, entry.id), { entry, perCell: perCell && perCell > 0 ? perCell : 1 });
    }
  }

  const skills: CombatSkill[] = [];
  const seen = new Set<string>();
  for (const source of battle.skills) {
    const rows = build.lists?.[source.list];
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      if (!row || typeof row !== "object") continue;
      const cells = row as Record<string, unknown>;
      const ref = own(cells, RULESET_CATALOG_ROW_KEY);
      if (typeof ref !== "string" || seen.has(ref)) continue;
      const always = source.alwaysWhen && own(cells, source.alwaysWhen.column) === source.alwaysWhen.equals;
      if (!always && source.onlyWhen && own(cells, source.onlyWhen) !== true) continue;
      const found = byRef.get(ref);
      if (!found) continue;
      const skill = combatSkillFromEntry(battle, found.entry, ref, found.perCell);
      if (!skill) continue;
      seen.add(ref);
      skills.push(skill);
    }
  }
  return skills;
}

// ── Writing the battle back to the sheet ──

/** A pool moved by `delta`, as the sheet's own command. `spend` is refused when the pool is short,
 *  which is why hit points come back as `damage`: a killing blow is still a killing blow. */
function poolOp(pool: string, delta: number, drain: "damage" | "spend"): RulesetSheetOp | null {
  const amount = Math.round(Math.abs(delta));
  if (!Number.isFinite(delta) || amount < 1) return null;
  return delta < 0 ? { op: drain, pool, amount } : { op: "restore", pool, amount };
}

/**
 * The health the battle ended on, written back onto whichever shape the sheet keeps it in.
 *
 * `delta` is in LEVELS LEFT, the same scale the seed carried, so a negative one is harm and marks
 * the track that many times, and a positive one clears that many marks.
 *
 * The kind it marks with is the track's LIGHTEST. That is a choice and it is the only defensible
 * one here: the `battle` block lends the Engine's own combat model the sheet's numbers and that
 * model has no damage types at all, so there is nothing for a mapping to read. Everything an
 * Engine battle does is therefore the mildest harm the ruleset has, which is also what the sheet's
 * own buttons default to. A ruleset that wants a fight to choose the kind declares `combat` and
 * gets `combat.damageKinds`.
 */
function healthOp(
  definition: RulesetDefinition,
  health: { pool: string } | { track: string },
  delta: number,
): RulesetSheetOp | null {
  if (!("track" in health)) return poolOp(health.pool, delta, "damage");
  const amount = Math.round(Math.abs(delta));
  if (!Number.isFinite(delta) || amount < 1) return null;
  const declared = definition.sheet.live.tracks.find((entry) => entry.id === health.track);
  const lightest = [...(declared?.kinds ?? [])].sort((a, b) => a.severity - b.severity)[0];
  if (!lightest) return null;
  // Fewer levels left is harm, so the sign turns over on the way to a number of marks.
  return { op: "damage", track: health.track, kind: lightest.id, amount: delta < 0 ? amount : -amount };
}

/**
 * The sheet operations that turn the live state the battle started from into the one it ended with.
 * A member whose numbers did not move produces nothing, and so does a battle the caller never
 * seeded. Nothing here is applied: the caller decides whether the fight counts.
 *
 * Hit points went in as a share of the Engine's maximum, so they come back as one. A fight that did
 * not move the combatant's hit points writes no health operation at all, which is what keeps the two
 * roundings from ever moving a sheet on their own. A combatant at zero puts the sheet at zero, and a
 * combatant still standing never puts it below one. Healing past the share the fight began on comes
 * back as `restore`, which `applyRulesetSheetOp` caps at the pool's own maximum.
 */
export function sheetOpsFromCombatResult(
  definition: RulesetDefinition,
  before: RulesetCombatSeed | null,
  after: RulesetCombatOutcome,
): RulesetSheetOp[] {
  const battle = definition.battle;
  if (!battle || !before) return [];

  const ops: RulesetSheetOp[] = [];
  const push = (op: RulesetSheetOp | null) => {
    if (op) ops.push(op);
  };
  if (after.hp !== before.hp) {
    const ended = carryHealthShare(after.hp, before.maxHp, before.sheetMaxHp);
    push(healthOp(definition, battle.health, ended - before.sheetHp));
  }
  if (battle.energy && before.mp !== undefined && after.mp !== undefined) {
    push(poolOp(battle.energy.pool, after.mp - before.mp, "spend"));
  }
  for (const slot of battle.slots ?? []) {
    const level = String(slot.level);
    const spent = before.spellSlots?.[level];
    const left = after.spellSlots?.[level];
    // A level the seed never carried is a level the battle could not spend.
    if (spent === undefined || left === undefined) continue;
    push(poolOp(slot.pool, left - spent, "spend"));
  }
  return ops;
}

/**
 * The stored live state after the battle. Each operation goes through the same `applyRulesetSheetOp`
 * the player's own sheet buttons and the Game Master's `[sheet:]` commands go through, so a battle
 * can never write something the sheet would refuse from anybody else. A refusal changes nothing and
 * is returned, so the caller can say so rather than silently losing the number.
 */
export function applyCombatResultToLive(
  definition: RulesetDefinition,
  build: RulesetSheetBuild,
  storedLive: unknown,
  ops: readonly RulesetSheetOp[],
): RulesetCombatWriteBack {
  let live: RulesetLiveState | null = null;
  const refused: RulesetCombatWriteBack["refused"] = [];
  for (const op of ops) {
    const result = applyRulesetSheetOp(definition, build, live ?? storedLive, op);
    if (result.ok) live = result.live;
    else refused.push({ op, reason: result.reason });
  }
  return { live, refused };
}
