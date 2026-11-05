// Starting a fight, and the small reads every later step shares.
//
// Everything a combatant can do is resolved ONCE, here: an attack row becomes a to-hit number and a
// damage roll, a catalog-marked ability row becomes what its `mechanics` says it does, and an
// opponent's block is read as it stands. The build does not move mid-fight in this kind, so nothing
// re-reads it afterwards; health, conditions and resources are the parts that change, and those are
// read through the sheet's own helpers every time they are touched. What a condition does to a
// number is added where the number is used, never written into the combatant.

import {
  RULESET_CATALOG_ROW_KEY,
  rulesetRowEntryRef,
  RULESET_ITEM_CHARGES_MAX,
  rulesetSheetBuildSchema,
  type RulesetCatalogEntriesById,
  type RulesetCatalogEntry,
  type RulesetCatalogItem,
  type RulesetCatalogMechanics,
  type RulesetCatalogCalls,
  type RulesetCallWhere,
  type RulesetCatalogFrom,
  type RulesetRegeneration,
  type RulesetHangsOn,
  type RulesetCatalogZone,
  type RulesetItemUse,
  type RulesetCombat,
  type RulesetCombatAbilitySource,
  type RulesetCombatAttackSource,
  type RulesetCombatCondition,
  type RulesetConditionAura,
  type RulesetCombatDistanceSource,
  type RulesetCreatureHideEntry,
  type RulesetDefinition,
  type RulesetSheetBuild,
  type RulesetTargetIs,
  type RulesetValueRef,
  RULESET_DEFIABLE_EFFECTS,
} from "../../schemas/ruleset.schema.js";
import type { TacticalGrid, TacticalGroundCell } from "../tactical-combat/types.js";
import { elevationAt } from "../tactical-combat/math.js";
import { TACTICAL_TERRAINS } from "../tactical-combat/environments.js";
import {
  pickRulesetSymbolSpends,
  rulesetChosenSymbolSpends,
  rulesetSymbolSpendChoices,
  rulesetSymbolsLeft,
  type RulesetSymbolSpend,
  type RulesetSymbolSpendBudget,
  type RulesetSymbolSpendPick,
} from "./symbols.js";
import { BOARD_PROP_ART } from "../world/board-pack.js";
import { rulesetBoardEvents, rulesetRunBoardEvents, type RulesetBoardEventInput } from "./board-events.js";
import {
  applyRulesetSheetOp,
  evaluateRulesetSheetLive,
  readRulesetLive,
  rulesetLiveWornOff,
  rulesetItemNeedsMet,
  rulesetItemsMeetingNeeds,
  rulesetTrackHealth,
  type RulesetLiveState,
  type RulesetSheetOp,
} from "../rulesets/live-state.js";
import {
  rulesetSaveAgainstMatches,
  type RulesetSaveAgainst,
  rulesetItemGateCheck,
  rulesetItemSources,
  rulesetSheetHideSources,
  rulesetTierAddsProficiency,
  type RulesetCheckSource,
} from "../rulesets/check-effects.js";
import { rulesetItemGateDifficulty, rulesetItemGateLabel } from "../rulesets/item-book.js";
import { rulesetCatalogEntriesByRef } from "../rulesets/scaled-rows.js";
import { rulesetPlanMemo, withRulesetPlanMemo } from "../rulesets/plan-memo.js";
import {
  lookupStepTable,
  resolveRulesetValueRef,
  resolveRulesetAbilityValues,
  rulesetCheckAdjust,
  rulesetCheckModifier,
  type EvaluatedRulesetSheet,
  type RulesetCheckTarget,
  type RulesetItemCallRoll,
  type RulesetSheetItem,
  type RulesetStoredEntry,
  rulesetAbilityModifier,
  rulesetChangedAbilityScores,
  rulesetFormedItem,
  rulesetHeldItemDoes,
  defaultRulesetSheetBuild,
} from "../rulesets/sheet-math.js";
import {
  findRulesetCreatureEntry,
  isRulesetPlainStatBlock,
  rulesetCreatureBlock,
  rulesetKeptSteps,
  rulesetReactionAnswers,
} from "./creatures.js";
import {
  parseRulesetCombatDice,
  rollRulesetDice,
  rulesetAverageDamage,
  rulesetCombatRoller,
  rulesetMoreUsesOf,
  rulesetOwnUsesMax,
  sumOf,
} from "./dice.js";
import {
  rulesetCellBlocked,
  rulesetCellSolidFor,
  rulesetCellDistance,
  rulesetFills,
  rulesetFootprint,
  rulesetFootprintAt,
  rulesetFootprintsSee,
  rulesetGap,
  rulesetInCells,
  rulesetPositionOf,
  rulesetNamesAction,
  rulesetSpanOf,
  rulesetZoneCells,
} from "./grid.js";
import { rulesetCombatAdvantage, rulesetCombatIsPool, rulesetPoolDie, throwRulesetCombatPool } from "./pool.js";
import { rulesetActionItemIndex, rulesetDroppedItems, rulesetHeldDrawPlan, rulesetHeldReady } from "./ammo.js";
import { rulesetMountLoad, rulesetPaidLevel, rulesetReactionsAt, rulesetSheetWithin } from "./options.js";
import { rulesetCanSee, rulesetHidingTraits, rulesetLightAt, rulesetStaysHidden } from "./sight.js";
import { RULESET_MOVE_MODES } from "./types.js";
import type {
  RulesetBoardLight,
  RulesetBoardLightRule,
  RulesetHeldGround,
  RulesetBoardProp,
  RulesetCheckModeRule,
  RulesetMoveMode,
  RulesetMoveSpeeds,
  RulesetCombatAction,
  RulesetCombatAmount,
  RulesetCombatant,
  RulesetCombatSequenceStep,
  RulesetEngulf,
  RulesetCombatantInput,
  RulesetCombatBoard,
  RulesetCombatDamage,
  RulesetSlotsFreedDamage,
  RulesetCombatDamageAlternative,
  RulesetCombatDamageClause,
  RulesetCombatMode,
  RulesetCombatEvent,
  RulesetCombatRider,
  RulesetCombatRoller,
  RulesetCombatSoak,
  RulesetCombatZone,
  RulesetEncounterState,
  RulesetHeldAttack,
  RulesetStatBlockAction,
  RulesetStatBlock,
  RulesetTeleport,
} from "./types.js";

/** The dice of a catalog entry's `amount`, which the schema already holds to `<count>d<sides>`. */
function amountOf(amount: RulesetCatalogMechanics["amount"]): RulesetCombatAmount | null {
  if (!amount) return null;
  const dice = amount.dice ? parseRulesetCombatDice(amount.dice) : null;
  if (!dice && amount.flat === undefined) return null;
  return {
    count: dice?.count ?? 0,
    sides: dice?.sides ?? 0,
    flat: (dice?.flat ?? 0) + (amount.flat ?? 0),
  };
}

// ── Reading a combatant ──

/** A stat block as one fight has it (1.363): its Legendary Resistance and its health (a fixed number, its
 *  dice no longer thrown) in place of its own, and the type its writer said it is. */
function rulesetAdjustedBlock(
  block: RulesetStatBlock,
  adjust: {
    legendaryResistance?: number;
    health?: number;
    calls?: Array<{ action: string; creature: string }>;
    legendary?: { points: number; actions: RulesetStatBlockAction[] };
    type?: string;
  },
): RulesetStatBlock {
  const adjusted: RulesetStatBlock = { ...block };
  if (adjust.type !== undefined) adjusted.type = adjust.type;
  // Made a boss with points and none of its own to spend them on: what they buy, beside the rest.
  if (adjust.legendary?.actions.length && !block.actions.some((action) => action.signature)) {
    adjusted.actions = [...block.actions, ...adjust.legendary.actions];
    adjusted.signaturePoints = adjust.legendary.points;
  }
  // Whom an action calls (1.371): the Shelves Lean calls a wraith once the party is high enough.
  if (adjust.calls?.length) {
    const key = (text: string) => text.trim().toLowerCase();
    adjusted.actions = block.actions.map((action) => {
      const call = [...adjust.calls!]
        .reverse()
        .find((each) => key(each.action) === key(action.id ?? "") || key(each.action) === key(action.name));
      return call && action.calls ? { ...action, calls: { ...action.calls, creature: call.creature } } : action;
    });
  }
  if (adjust.legendaryResistance !== undefined) {
    if (adjust.legendaryResistance > 0) adjusted.legendaryResistance = adjust.legendaryResistance;
    else delete adjusted.legendaryResistance;
  }
  if (adjust.health !== undefined) {
    adjusted.health = adjust.health;
    delete adjusted.healthDice;
  }
  return adjusted;
}

/** A bestiary reference as the fight keeps it: out of a borrowed catalog (1.220), it also names the
 *  lender's ruleset and catalog, which is what the creature's art is matched by. */
function creatureRef(
  definition: RulesetDefinition,
  ref: { catalogId: string; entryId: string },
): NonNullable<RulesetCombatant["creature"]> {
  const from = definition.catalogs?.find((catalog) => catalog.id === ref.catalogId)?.from;
  return { catalogId: ref.catalogId, entryId: ref.entryId, ...(from ? { from: { ...from } } : {}) };
}

/**
 * The round whose lair action this combatant may take right now (Capability API 1.315), or null.
 * Its lair's count comes once a round, after everybody at that count or above it and before
 * anybody below it: between the two turns it falls between, before the very first turn when
 * everybody is below it, or after the last when nobody is. A round that throws initiative again
 * has no order yet as it begins, so its lair's count comes as it does. Never twice in a round.
 */
export function rulesetLairRound(
  definition: RulesetDefinition,
  state: RulesetEncounterState,
  combatant: RulesetCombatant,
): number | null {
  const lair = combatant.lair;
  if (!lair) return null;
  const trigger = state.window?.trigger;
  let round: number | null = null;
  if (trigger?.kind === "between-turns" && trigger.opening) {
    const first = rulesetCombatant(state, state.order[state.turn] ?? "");
    if (first && first.initiative < lair.at) round = state.round;
  } else {
    const current = rulesetCombatant(state, state.order[state.turn] ?? "");
    let turn = state.turn;
    let wraps = false;
    let next: RulesetCombatant | undefined;
    for (let step = 0; step < state.order.length; step++) {
      if (turn + 1 >= state.order.length) wraps = true;
      turn = turn + 1 >= state.order.length ? 0 : turn + 1;
      const candidate = rulesetCombatant(state, state.order[turn]!);
      if (candidate && lairTurnTaker(candidate)) {
        next = candidate;
        break;
      }
    }
    if (!current || !next) return null;
    if (!wraps) {
      if (current.initiative >= lair.at && next.initiative < lair.at) round = state.round;
    } else if (definition.combat?.initiative.each === "round" || definition.combat?.initiative.resource) {
      round = state.round + 1;
    } else if (current.initiative >= lair.at) round = state.round;
    else if (next.initiative < lair.at) round = state.round + 1;
  }
  return round === null || lair.last?.round === round ? null : round;
}

function lairTurnTaker(combatant: RulesetCombatant): boolean {
  if (combatant.defeated) return !!(combatant.away?.blinked || (combatant.away?.turns && combatant.away.while));
  return !combatant.down || (combatant.dying && !combatant.stable);
}

export function rulesetCombatant(state: RulesetEncounterState, id: string): RulesetCombatant | undefined {
  const found = state.combatants.find((combatant) => combatant.id === id);
  if (found) fightOf.set(found, state);
  return found;
}

/** The fight each combatant was last read from (1.755), for a target test that asks where they stand
 *  when nothing else hands it the fight. */
const fightOf = new WeakMap<RulesetCombatant, RulesetEncounterState>();

/** Notes every combatant of this fight as being in it (1.755). */
export function rulesetNoteFight(state: RulesetEncounterState): void {
  for (const combatant of state.combatants) fightOf.set(combatant, state);
}

/** Whether this combatant stands in a zone one of these entries left (1.755), by id or name. */
function standsInZoneOf(combatant: RulesetCombatant, names: readonly string[]): boolean {
  const state = fightOf.get(combatant);
  if (!state) return false;
  const wanted = names.map((name) => name.trim().toLowerCase());
  const at = rulesetPositionOf(combatant);
  const grid = state.board?.grid;
  return state.combatants.some((caster) =>
    (caster.zones ?? []).some((zone) => {
      const action = caster.actions.find((entry) => entry.id === zone.actionId);
      // By its entry's id (`<catalog>/<entry>` or the entry alone), or its name.
      const ids = [zone.actionId, action?.entry ?? "", action?.label ?? zone.label].map((one) =>
        one.trim().toLowerCase(),
      );
      if (!ids.some((one) => wanted.includes(one) || wanted.some((name) => one.endsWith(`/${name}`)))) return false;
      return grid && at
        ? rulesetZoneCells(state, caster, zone).some((cell) => rulesetFills(combatant, cell))
        : !!zone.held?.includes(combatant.id);
    }),
  );
}

export function currentRulesetActor(state: RulesetEncounterState): RulesetCombatant | undefined {
  const id = state.order[state.turn];
  return id === undefined ? undefined : rulesetCombatant(state, id);
}

/** Whether it is this combatant's own turn, which is where a cap on attacks a turn counts. */
export function rulesetOnOwnTurn(state: RulesetEncounterState, combatant: RulesetCombatant): boolean {
  return state.order[state.turn] === combatant.id;
}

/** Whether an action is an attack, as a cap on attacks counts them: it rolls to hit, it is a sequence
 *  of them, or it is a contest that takes the place of a strike (a grapple, a shove). */
/** How many times a sequence step strikes (1.550): once per head its maker has now for `perHead`. */
export function rulesetStepTimes(actor: RulesetCombatant, step: RulesetCombatSequenceStep): number {
  if (!step.perHead) return step.times;
  return step.times * Math.max(0, actor.heads?.count ?? actor.block?.heads?.count ?? 1);
}

export function rulesetIsAttack(action: RulesetCombatAction): boolean {
  return action.toHit !== undefined || !!action.sequence || !!action.contest?.strike;
}

export interface RulesetCombatHealth {
  value: number;
  max: number;
  temp: number;
}

/**
 * Health as it stands. A party member's lives in their sheet, so it is read from there every time
 * rather than copied into the encounter, and a reload mid-fight is exact.
 *
 * A WOUND TRACK is reported as the levels it has LEFT: `value` is how many boxes are still clear
 * and `max` is the track's length. A plain track that fills up (1.383) is read the same way: the
 * room left above its value, out of its length from floor to maximum. That is deliberate and it
 * is what keeps the rest of the fight written in its own words: "down" is a combatant at zero,
 * and a full track is a combatant with no boxes left, so `dropToZero`, the dying rules, the recap
 * and the screen all keep asking the one question they already ask. A track carries no buffer, so `temp` is always 0 on one.
 */
export function rulesetCombatHealth(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  combatant: RulesetCombatant,
): RulesetCombatHealth {
  // Once a planning pass (see `withRulesetPlanMemo`), and a copy every time.
  return {
    ...rulesetPlanMemo(["rulesetCombatHealth", definition, combat, combatant], () =>
      combatHealth(definition, combat, combatant),
    ),
  };
}

function combatHealth(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  combatant: RulesetCombatant,
): RulesetCombatHealth {
  // In a form with health of its own (1.392), that is their health while it lasts.
  if (combatant.shape?.health) return { ...combatant.shape.health };
  // A copy, always: an opponent's health lives in the state, and a caller that read it before a
  // blow has to still be holding what it was before. An opponent without a sheet is written in
  // plain numbers whichever shape the party's health takes; one with a sheet is read below, exactly
  // as a party member is.
  if (!combatant.sheet) {
    const health = { ...(combatant.health ?? { value: 0, max: 0, temp: 0 }) };
    // Raised while what raises it holds (1.473): Aid.
    const raised = combatant.tracked.reduce((total, entry) => total + (entry.raisedMax ?? 0), 0);
    if (raised > 0) health.max += raised;
    return halvedHealth(definition, combat, combatant, health);
  }
  const live = readRulesetLive(definition, combatant.sheet.build, combatant.sheet.live, combatant.sheet.items);
  const health = combat.health;
  if ("track" in health) {
    const track = live.tracks.find((entry) => entry.id === health.track);
    return track ? rulesetTrackHealth(track) : { value: 0, max: 0, temp: 0 };
  }
  const pool = live.pools.find((entry) => !entry.listId && entry.key === health.pool);
  return pool
    ? halvedHealth(definition, combat, combatant, { value: pool.value, max: pool.max, temp: pool.temp })
    : { value: 0, max: 0, temp: 0 };
}

/** Health in points as what the holder suffers halves its maximum (1.115), 5e's fourth level of
 *  exhaustion: the maximum rounded down, never below 1, and what they have held to it. A wound track
 *  has boxes rather than a maximum, so nothing halves it. */
function halvedHealth(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  combatant: RulesetCombatant,
  health: RulesetCombatHealth,
): RulesetCombatHealth {
  const halves = rulesetConditionModifiers(definition, combat, combatant, "health-max").length;
  if (halves === 0 || health.max <= 0) return health;
  const max = Math.max(1, Math.floor(health.max / 2 ** halves));
  return { ...health, max, value: Math.min(health.value, max) };
}

/**
 * Where a combatant's size sits among `combat.sizes`, 0 for the smallest (Capability API 1.103), or
 * undefined when the ruleset has no sizes or nothing says this one's.
 */
export function rulesetSizeRank(combat: RulesetCombat, combatant: RulesetCombatant): number | undefined {
  if (!combat.sizes || combatant.size === undefined) return undefined;
  const rank = combat.sizes.order.findIndex((size) => size.id === combatant.size);
  return rank < 0 ? undefined : rank;
}

/** A size read off a sheet: 1 is the first of `combat.sizes`, rounded and held to the list. */
function sheetSize(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  build: RulesetSheetBuild,
  evaluated: Parameters<typeof resolveRulesetValueRef>[3],
): string | undefined {
  const sizes = combat.sizes;
  if (!sizes) return undefined;
  if (!sizes.sheet) return sizes.default;
  const read = Math.round(resolveRulesetValueRef(definition, build, sizes.sheet, evaluated));
  if (!Number.isFinite(read) || read < 1) return sizes.default;
  return sizes.order[Math.min(read, sizes.order.length) - 1]!.id;
}

/**
 * The damage an action deals as it stands now (Capability API 1.102). A creature's action may name
 * amounts it deals instead of its first while something holds, the first that holds winning: a
 * `twoHanded` one unless the creature carries a shield, a `selfHealthAtMost` one while its health is
 * at most that share of its most (a wound track counts the levels it has left). Only the dice and
 * the flat part change; the type, the clauses, the qualities and the rest stay the action's own.
 * Damage with no alternative that holds comes back as it was given.
 */
export function rulesetDamageInEffect(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  actor: RulesetCombatant,
  damage: RulesetCombatDamage,
): RulesetCombatDamage {
  if (!damage.alternatives?.length) return damage;
  let share: number | undefined;
  const holds = (when: RulesetCombatDamageAlternative["when"]) => {
    if (when === "twoHanded") return !actor.block?.shield;
    if (share === undefined) {
      const health = rulesetCombatHealth(definition, combat, actor);
      share = health.max > 0 ? health.value / health.max : 1;
    }
    return share <= when.selfHealthAtMost;
  };
  const chosen = damage.alternatives.find((alternative) => holds(alternative.when));
  return chosen ? { ...damage, count: chosen.count, sides: chosen.sides, flat: chosen.flat } : damage;
}

/**
 * Which kind of mark this fight's damage is, on a ruleset whose health is a wound track.
 *
 * The mapping is the ruleset's own and nothing here guesses: a type it names lands as the kind it
 * named, and everything else, a blow with no type included, lands as the declared `default`. The
 * match ignores case, exactly as a creature's resistances and the block's own `damageTypes` do.
 *
 * The empty string is returned only for a ruleset whose health is a pool, where nobody asks.
 */
export function rulesetCombatDamageKind(combat: RulesetCombat, damageType: string | undefined): string {
  const kinds = combat.damageKinds;
  if (!kinds) return "";
  const wanted = damageType?.trim().toLowerCase();
  if (!wanted) return kinds.default;
  for (const [type, kind] of Object.entries(kinds.byType ?? {})) {
    if (type.trim().toLowerCase() === wanted) return kind;
  }
  return kinds.default;
}

/** A fight rule's value on this sheet as it stands now. A plain block can only supply a constant. */
export function rulesetCombatValue(
  definition: RulesetDefinition,
  actor: RulesetCombatant,
  ref: RulesetValueRef,
): number | undefined {
  const sheet = actor.sheet;
  const value = sheet
    ? resolveRulesetValueRef(
        definition,
        sheet.build,
        ref,
        evaluateRulesetSheetLive(definition, sheet.build, sheet.live, sheet.items, actor.abilityConditions),
      )
    : ref.const;
  return value !== undefined && Number.isFinite(value) ? value : undefined;
}

/** Minimum dice belongs to the weapon when it says so, otherwise to the attacker's sheet. */
export function rulesetDamageMinimum(
  definition: RulesetDefinition,
  actor: RulesetCombatant,
  damage: RulesetCombatDamage,
): number | undefined {
  const ref = definition.combat?.damage?.minimum;
  const value = damage.minimum ?? (ref ? rulesetCombatValue(definition, actor, ref) : undefined);
  if (value === undefined || definition.resolution.kind !== "dice-pool") return undefined;
  return Math.max(0, Math.min(definition.resolution.pool.max, Math.floor(value)));
}

/** Remaps are ordered, not chained. The original type still decides resistance; the kind decides soak and marks. */
export function rulesetTargetDamageKind(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  target: RulesetCombatant,
  damageType: string | undefined,
  tags?: readonly string[],
): { kind: string; remappedFrom?: string } {
  const kind = rulesetCombatDamageKind(combat, damageType);
  for (const rule of combat.damageKinds?.remap ?? []) {
    if (rule.from !== kind || (rule.tags && !rule.tags.some((tag) => tags?.includes(tag)))) continue;
    const when = rulesetCombatValue(definition, target, rule.when);
    if (when !== undefined && when !== 0) return { kind: rule.to, remappedFrom: kind };
  }
  return { kind };
}

/** One command through the sheet's own rules. A refusal changes nothing and says so, exactly as it
 *  does for the player's own buttons and the Game Master's commands. */
export function writeRulesetSheet(
  definition: RulesetDefinition,
  combatant: RulesetCombatant,
  op: RulesetSheetOp,
): boolean {
  if (!combatant.sheet) return false;
  const result = applyRulesetSheetOp(
    definition,
    combatant.sheet.build,
    combatant.sheet.live,
    op,
    undefined,
    combatant.sheet.items,
  );
  if (!result.ok) return false;
  combatant.sheet.live = result.live;
  return true;
}

/** Every condition on this combatant. A party member's are the sheet's own, so one they walked into
 *  the fight with counts from the first turn and one the fight applied is still there afterwards. */
export function rulesetCombatConditions(
  definition: RulesetDefinition,
  combatant: RulesetCombatant,
  /** What the zones they stand in suppress (1.521). */
  hush?: { catalogs: Set<string>; tags: Set<string> } | null,
): string[] {
  // Put on only by entries of a catalog suppressed here (1.521): a spell's, in an antimagic field.
  const tracked = hush?.catalogs.size
    ? combatant.tracked.filter(
        (entry) =>
          !(entry.catalog && hush.catalogs.has(entry.catalog)) ||
          combatant.tracked.some(
            (other) => other.condition === entry.condition && !(other.catalog && hush.catalogs.has(other.catalog)),
          ),
      )
    : combatant.tracked;
  const ids = new Set(tracked.map((entry) => entry.condition));
  if (combatant.sheet) {
    const live = readRulesetLive(definition, combatant.sheet.build, combatant.sheet.live, combatant.sheet.items);
    for (const condition of live.conditions) if (condition.active) ids.add(condition.id);
    // And what their items keep on them (1.513), for as long as each is worn or carried.
    if (combatant.sheet.items?.length)
      for (const source of heldSources(definition, combatant, hush)) for (const id of source.keepsOn ?? []) ids.add(id);
  }
  // What its rider's horseshoes keep on a mount (1.717).
  for (const id of combatant.mountWears ?? []) ids.add(id);
  return [...ids];
}

/**
 * Whether whoever put this condition on somebody is still in their sight.
 *
 * A condition nobody applied, one whose source has left the fight, and every fight with no board at
 * all all read as "yes": a fight that measures nothing has no line for anything to break.
 */
function sourceInSight(
  definition: RulesetDefinition,
  combatant: RulesetCombatant,
  condition: string,
  state: RulesetEncounterState | undefined,
): boolean {
  const sourceId = combatant.tracked.find((entry) => entry.condition === condition)?.source;
  const grid = state?.board?.grid;
  if (!sourceId || !state || !grid) return true;
  const source = rulesetCombatant(state, sourceId);
  if (!source || !rulesetPositionOf(combatant) || !rulesetPositionOf(source)) return true;
  // Any cell of one to any cell of the other (1.194).
  if (!rulesetFootprintsSee(grid, combatant, source)) return false;
  // And seen with the holder's own eyes and senses (1.277): blindness, a fog, the dark past what
  // they see in, or a source unseen to them break it as a wall does. What they see with is read off
  // their conditions, which is what is being gated here, so while that is read the line is enough.
  if (sightGated.has(combatant.id)) return true;
  sightGated.add(combatant.id);
  try {
    return rulesetCanSee(definition, state, combatant, source);
  } finally {
    sightGated.delete(combatant.id);
  }
}
/** Holders whose sight a gate is reading right now, so reading it never asks itself again. */
const sightGated = new Set<string>();

/** Whether somebody sees an ally of theirs standing within this distance (1.682). Off a board, any
 *  ally standing will do: a fight that measures nothing gates nothing but having one. */
function allySeenWithin(
  definition: RulesetDefinition,
  combatant: RulesetCombatant,
  state: RulesetEncounterState | undefined,
  combat: RulesetCombat,
  distance: number,
): boolean {
  if (!state) return true;
  const allies = state.combatants.filter(
    (one) => one.id !== combatant.id && one.side === combatant.side && rulesetCombatStanding(one) && !one.defeated,
  );
  const grid = state.board?.grid;
  if (!grid || !combat.distance || !rulesetPositionOf(combatant)) return allies.length > 0;
  const reach = rulesetInCells(distance, combat.distance.perCell);
  return allies.some((ally) => {
    if (!rulesetPositionOf(ally) || rulesetGap(combatant, ally) > reach) return false;
    if (!rulesetFootprintsSee(grid, combatant, ally)) return false;
    // What they see with is read off their conditions, this one among them: the line is enough then.
    if (sightGated.has(combatant.id)) return true;
    sightGated.add(combatant.id);
    try {
      return rulesetCanSee(definition, state, combatant, ally);
    } finally {
      sightGated.delete(combatant.id);
    }
  });
}

/** Whether whoever applied a condition stands within this distance of its holder (1.275). Without
 *  a board, or a source to measure to, it is near: a fight that measures nothing gates nothing. */
function sourceWithin(
  combatant: RulesetCombatant,
  condition: string,
  state: RulesetEncounterState | undefined,
  combat: RulesetCombat,
  distance: number,
): boolean {
  const sourceId = combatant.tracked.find((entry) => entry.condition === condition)?.source;
  if (!sourceId || !state?.board || !combat.distance) return true;
  const source = rulesetCombatant(state, sourceId);
  if (!source || !rulesetPositionOf(combatant) || !rulesetPositionOf(source)) return true;
  return rulesetGap(combatant, source) <= rulesetInCells(distance, combat.distance.perCell);
}

/** Whether somebody stands within `within` of a standing prop named `prop`, by id or label (1.331). A fight with
 *  no board, or somebody off it, counts as near. */
function nearProp(
  combatant: RulesetCombatant,
  state: RulesetEncounterState | undefined,
  combat: RulesetCombat,
  gate: { prop: string; within: number },
): boolean {
  if (!state?.board || !combat.distance || !rulesetPositionOf(combatant)) return true;
  return rulesetNearProp(state, combatant, gate.prop, rulesetInCells(gate.within, combat.distance.perCell));
}

/** Whether somebody stands on one of these terrains, or the board's environment is one (1.478).
 *  Never off a board. */
/** Set while the light a condition holds only in is read (1.605), so that light, which reads what
 *  everybody holds, never reads it again. */
let readingLight = false;

/** Whether its holder stands in one of these lights (1.605). */
function heldInLight(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  combatant: RulesetCombatant,
  state: RulesetEncounterState | undefined,
  light: NonNullable<RulesetCheckModeRule["light"]>,
): boolean {
  readingLight = true;
  try {
    return rulesetModeRuleHolds(definition, combat, combatant, state, { mode: "disadvantage", light });
  } finally {
    readingLight = false;
  }
}

function onTerrain(
  combatant: RulesetCombatant,
  state: RulesetEncounterState | undefined,
  terrains: readonly string[],
): boolean {
  const board = state?.board;
  if (!board) return false;
  if (board.environment !== undefined && terrains.includes(board.environment)) return true;
  if (!board.grid || combatant.x === undefined || combatant.y === undefined) return false;
  const tile = board.grid.tiles[combatant.y]?.[combatant.x];
  return tile !== undefined && terrains.includes(tile);
}

/** Whether somebody stands on ground one of these names (1.714): a tile or the board's place, as
 *  `onTerrain` reads them, or a lasting area left by an action named by id or label. */
function onGroundNamed(
  combatant: RulesetCombatant,
  state: RulesetEncounterState | undefined,
  names: readonly string[],
): boolean {
  if (!state?.board) return false;
  if (onTerrain(combatant, state, names)) return true;
  const lower = names.map((name) => name.trim().toLowerCase());
  const feet = rulesetFootprint(combatant);
  if (feet.length === 0) return false;
  return state.combatants.some((caster) =>
    (caster.zones ?? []).some((zone) => {
      const action = caster.actions.find((one) => one.id === zone.actionId);
      if (!action || !rulesetNamesAction(lower, [action.id, action.label])) return false;
      const cells = rulesetZoneCells(state, caster, zone);
      return feet.some((foot) => cells.some((cell) => cell.x === foot.x && cell.y === foot.y));
    }),
  );
}

/** What each mount wears of its rider's (1.717): the conditions the rider's worn items `wornBy` a
 *  mount keep on, read afresh as riders mount and dismount. */
function syncMountWears(definition: RulesetDefinition, state: RulesetEncounterState): void {
  for (const mount of state.combatants) {
    const rider = mount.riddenBy ? state.combatants.find((one) => one.id === mount.riddenBy) : undefined;
    const sheet = rider?.sheet;
    const dropped = rider ? rulesetDroppedItems(rider) : new Set<number>();
    const ids = (sheet?.items ?? []).flatMap((held, index) => {
      const worn = held.worn && !dropped.has(index) ? rulesetHeldItemDoes(held).worn : undefined;
      if (worn?.wornBy !== "mount") return [];
      return (worn.keepsOn ?? []).flatMap((kept) =>
        typeof kept === "string"
          ? [kept]
          : resolveRulesetValueRef(definition, sheet!.build, kept.when) > 0
            ? [kept.condition]
            : [],
      );
    });
    if (ids.length) mount.mountWears = [...new Set(ids)];
    else delete mount.mountWears;
  }
}

/** A prop's label or id loosely: lower case, a leading "the" dropped, and only letters and digits
 *  kept, so "Year-Wheel", "year wheel" and "The Year-Wheel" are one prop (1.332). */
function looseProp(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/^the\s+/, "")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

/** Whether a board prop is the one a ruleset names: by its id, or by its label read loosely. */
export function rulesetPropNamed(prop: { id: string; label: string }, name: string): boolean {
  const loose = looseProp(name);
  return prop.id === name.trim() || (loose.length > 0 && looseProp(prop.label) === loose);
}

/** Whether somebody stands within `cells` of a standing prop of the board named `prop`, by its id or
 *  its label (1.331, 1.332). Never off a board. */
export function rulesetNearProp(
  state: RulesetEncounterState,
  combatant: RulesetCombatant,
  prop: string,
  cells: number,
): boolean {
  const near = (state.board?.props ?? [])
    .filter((one) => one.health > 0 && rulesetPropNamed(one, prop))
    .flatMap((one) => one.cells);
  return rulesetFootprint(combatant).some((mine) => near.some((cell) => rulesetCellDistance(mine, cell) <= cells));
}

/**
 * The condition entries that are ON this combatant right now, with their gates read.
 *
 * One place, because everything a condition does reads it: what it stops, what it makes harder, and
 * which saves it is about. `state` is what a gate that measures anything needs; without it a gated
 * condition simply counts, which is what it does in a fight with no board anyway.
 */
/** Who is breaking what a condition commands (1.644), and which conditions: what they stop, stops
 *  nothing for that one while the choice is offered or worked out. */
let defying: { actorId: string; conditions: ReadonlySet<string> } | undefined;

/** `work` done as `actorId` breaks what `conditions` command (1.644): 5e's Geas. */
export function rulesetDefying<T>(actorId: string, conditions: readonly string[], work: () => T): T {
  const before = defying;
  defying = { actorId, conditions: new Set(conditions) };
  try {
    return work();
  } finally {
    defying = before;
  }
}

/** Who is breaking what a condition commands right now (1.644), if anybody. */
export function rulesetDefiance(): typeof defying {
  return defying;
}

/** The conditions on this combatant whose commands they may break at a cost (1.644). */
export function rulesetDefiableConditions(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  combatant: RulesetCombatant,
  state?: RulesetEncounterState,
): string[] {
  if (!combat.conditions?.some((one) => one.harms?.at === "defies")) return [];
  return rulesetActiveConditions(definition, combat, combatant, state).flatMap((entry) =>
    entry.harms?.at === "defies" ? [entry.condition] : [],
  );
}

/** A condition whose commands are being broken (1.644), with nothing it stops. */
function brokenCommand<T extends RulesetCombatCondition>(entry: T): T {
  const broken: T = {
    ...entry,
    effects: entry.effects.filter((one) => !(RULESET_DEFIABLE_EFFECTS as readonly string[]).includes(one)),
  };
  delete broken.forbids;
  delete broken.behavior;
  return broken;
}

export function rulesetActiveConditions(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  combatant: RulesetCombatant,
  state?: RulesetEncounterState,
  rawLevels = false,
): RulesetActiveCondition[] {
  // Once a planning pass (see `withRulesetPlanMemo`) for where they stand, a fresh list every time.
  // A read on its own is a pass of its own: every level it reaches asks the holder's immunities, which
  // read its conditions again, and each of those read the same sheet.
  return withRulesetPlanMemo(() => [
    ...rulesetPlanMemo(
      ["rulesetActiveConditions", definition, combat, combatant, state, rawLevels, combatant.x, combatant.y],
      () => activeConditions(definition, combat, combatant, state, rawLevels),
    ),
  ]);
}

function activeConditions(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  combatant: RulesetCombatant,
  state?: RulesetEncounterState,
  rawLevels = false,
): RulesetActiveCondition[] {
  // What an antimagic zone they stand in suppresses (1.521).
  const hush = rulesetSuppressedOn(state, combatant);
  const active = new Set(rulesetCombatConditions(definition, combatant, hush));
  // Standing in a zone that says so (1.179): its conditions are on whoever is there, and what it
  // keeps off or stops reads as one more source, named for the zone.
  // Nor through a sphere (1.314), into it or out of it: read off what holds each of them, as a zone's
  // own conditions could never seal anybody.
  const inside = state
    ? zonesStoodIn(state, combatant).filter(
        ({ caster }) =>
          caster.id === combatant.id ||
          (!sealedByOwn(definition, combat, combatant) && !sealedByOwn(definition, combat, caster)),
      )
    : [];
  for (const { rule, zone } of inside) {
    if (!insideWorksOn(definition, combatant, zone, rule)) continue;
    for (const condition of rule.inside?.conditions ?? []) active.add(condition);
  }
  const zoned = inside.flatMap(({ label, rule, zone }): RulesetActiveCondition[] => {
    const works = insideWorksOn(definition, combatant, zone, rule);
    return (works && rule.inside?.immune) || rule.forbids?.components || rule.forbids?.casts
      ? [
          {
            condition: label,
            zone: true,
            effects: [],
            ...(works && rule.inside?.immune ? { immune: [...rule.inside.immune] } : {}),
            ...(rule.forbids?.components || rule.forbids?.casts
              ? {
                  forbids: {
                    ...(rule.forbids.components ? { components: [...rule.forbids.components] } : {}),
                    ...(rule.forbids.casts ? { casts: [...rule.forbids.casts] } : {}),
                  },
                }
              : {}),
          },
        ]
      : [];
  });
  const conditions = (combat.conditions ?? []).flatMap((given): RulesetActiveCondition[] => {
    if (!active.has(given.condition)) return [];
    // Its commands being broken (1.644): it stops nothing.
    const entry =
      defying?.actorId === combatant.id && defying.conditions.has(given.condition) ? brokenCommand(given) : given;
    // Stopped by damage until their next turn (1.514).
    if (combatant.harmStopped?.includes(entry.condition)) return [];
    if (entry.whileNearProp && !nearProp(combatant, state, combat, entry.whileNearProp)) return [];
    if (entry.whileOffTerrain && onTerrain(combatant, state, entry.whileOffTerrain)) return [];
    // Only in the light it names (1.605): a shadow's Sunlight Weakness. Read while no light is being
    // worked out, since the light itself reads what everybody holds.
    if (
      entry.heldOnlyIn?.light &&
      !readingLight &&
      !heldInLight(definition, combat, combatant, state, entry.heldOnlyIn.light)
    )
      return [];
    // Only on ground it names (1.714): a vampire in running water.
    if (entry.heldOnlyIn?.ground && !onGroundNamed(combatant, state, entry.heldOnlyIn.ground)) return [];
    // Only while an ally is seen near (1.682): a bearded devil's Steadfast.
    if (
      entry.heldOnlyIn?.allySeenWithin !== undefined &&
      !allySeenWithin(definition, combatant, state, combat, entry.heldOnlyIn.allySeenWithin)
    )
      return [];
    const gate = entry.whileSourceInSight;
    if (!gate || sourceInSight(definition, combatant, entry.condition, state)) return [entry];
    // Or near enough, seen or not (1.275): Antipathy's 60 feet.
    if (
      entry.orSourceWithin !== undefined &&
      sourceWithin(combatant, entry.condition, state, combat, entry.orSourceWithin)
    )
      return [entry];
    // Out of sight: `true` takes the whole condition off, and a list takes off only what it names,
    // so an effect nobody has to see to suffer stays.
    if (gate === true) return [];
    // A list gates the effects it NAMES and nothing else. `failsSaves` and `saves` are not effects
    // and were never named, so the entry stays even when the gate took every effect it had: a
    // fright you fail a save against whether or not you can see it is exactly what the list is for.
    return [{ ...entry, effects: entry.effects.filter((effect) => !gate.includes(effect)) }];
  });
  // Held off while its holder holds another, or another does what it names (1.528): Cloak of
  // Displacement's, while they are restrained or cannot move. Read off the others before any is.
  if (conditions.some((entry) => entry.heldOffWhile)) {
    const others = [...conditions];
    for (let at = conditions.length - 1; at >= 0; at -= 1) {
      const rule = conditions[at]!.heldOffWhile;
      if (!rule) continue;
      const own = conditions[at]!.condition;
      const off = others.some(
        (other) =>
          other.condition !== own &&
          !other.heldOffWhile &&
          (rule.conditions?.includes(other.condition) ||
            other.effects.some((effect) => rule.effects?.includes(effect))),
      );
      if (off) conditions.splice(at, 1);
    }
  }
  const held = heldSources(definition, combatant, hush);
  // Held off, not ended, by another that holds (1.275): Calm Emotions' charm and fright. Or by an
  // item (1.477): the Periapt of Health's diseases.
  const suppressed = new Set([...conditions, ...held].flatMap((entry) => entry.suppresses ?? []));
  if (suppressed.size) {
    for (let at = conditions.length - 1; at >= 0; at -= 1) {
      // By its id, or by a kind it is of (1.484): the Periapt's every disease.
      const one = conditions[at]!;
      // Or by one it counts as (1.585): Calm Emotions' charm, on Enthrall.
      if (
        suppressed.has(one.condition) ||
        one.kinds?.some((kind) => suppressed.has(kind)) ||
        one.countsAs?.some((other) => suppressed.has(other))
      )
        conditions.splice(at, 1);
    }
  }
  const levels = combat.levels?.length ? activeLevels(definition, combat, combatant, rawLevels) : [];
  // And what the fighter's items do, each named for the stack, as a level is named for its track.
  const items = held.map((source): RulesetActiveCondition => ({
    condition: source.name,
    item: true,
    effects: [...(source.effects ?? [])] as RulesetCombatCondition["effects"],
    ...(source.modifiers ? { modifiers: [...source.modifiers] } : {}),
    ...(source.failsSaves ? { failsSaves: [...source.failsSaves] } : {}),
    ...(source.saves ? { saves: [...source.saves] } : {}),
    ...(source.skills ? { skills: [...source.skills] } : {}),
    ...(source.resist ? { resist: [...source.resist] } : {}),
    ...(source.vulnerable ? { vulnerable: [...source.vulnerable] } : {}),
    ...(source.immune ? { immune: [...source.immune] } : {}),
    ...(source.conditionImmunities ? { conditionImmunities: [...source.conditionImmunities] } : {}),
    ...(source.senses ? { senses: { ...source.senses } } : {}),
    ...(source.light ? { light: { ...source.light } } : {}),
    ...(source.alerts ? { alerts: source.alerts } : {}),
    ...(source.drawsAim ? { drawsAim: { ...source.drawsAim } } : {}),
    ...(source.fallsSafely
      ? {
          fallsSafely:
            source.fallsSafely === true
              ? (true as const)
              : {
                  upTo: source.fallsSafely.upTo,
                  ...(source.fallsSafely.unless ? { unless: [...source.fallsSafely.unless] } : {}),
                },
        }
      : {}),
    ...(source.suppresses ? { suppresses: [...source.suppresses] } : {}),
    ...(source.conditionImmunitiesFrom
      ? { conditionImmunitiesFrom: source.conditionImmunitiesFrom.map((ward) => ({ ...ward })) }
      : {}),
    ...(source.speedKeptFrom ? { speedKeptFrom: { catalogs: [...source.speedKeptFrom.catalogs] } } : {}),
    ...(source.ignoresHardGround ? { ignoresHardGround: true as const } : {}),
    ...(source.jumps
      ? {
          jumps: {
            ...(source.jumps.times !== undefined ? { times: source.jumps.times } : {}),
            ...(source.jumps.plus ? { plus: { ...source.jumps.plus } } : {}),
          },
        }
      : {}),
    ...(source.slipsFree
      ? {
          slipsFree: {
            cost: source.slipsFree.cost,
            conditions: [...source.slipsFree.conditions],
            ...(source.slipsFree.unlessCatalogs ? { unlessCatalogs: [...source.slipsFree.unlessCatalogs] } : {}),
          },
        }
      : {}),
  }));
  const all = [...conditions, ...levels, ...items, ...zoned];
  // Held off while its holder has something it names (1.417), a condition or what one does.
  if (!all.some((entry) => entry.notWhile)) return all;
  const has = new Set<string>([...active, ...all.flatMap((entry) => entry.effects)]);
  return all.filter((entry) => !entry.notWhile?.some((one) => has.has(one)));
}

/** The standing zones whose cells this combatant is in now, or that hold them off a board (1.179). */
/** Whether a condition of this combatant's own seals them (1.314), zones aside. */
function sealedByOwn(definition: RulesetDefinition, combat: RulesetCombat, combatant: RulesetCombatant): boolean {
  if (!combat.conditions?.some((entry) => entry.sealed)) return false;
  const own = new Set(rulesetCombatConditions(definition, combatant));
  return combat.conditions.some((entry) => entry.sealed && own.has(entry.condition));
}

/** Whether what a zone does inside works on this one (1.460): one it matches, who has not shrugged it off. */
function insideWorksOn(
  definition: RulesetDefinition | undefined,
  combatant: RulesetCombatant,
  zone: RulesetCombatZone,
  rule: NonNullable<RulesetCombatAction["zone"]>,
): boolean {
  if (zone.shrugged?.includes(combatant.id)) return false;
  // Whom it was cast to work on (1.466), else whom it names.
  const is = zone.insideIs ?? rule.inside?.is;
  return !is || (!!definition && rulesetTargetIs(definition, combatant, is));
}

function zonesStoodIn(
  state: RulesetEncounterState,
  combatant: RulesetCombatant,
): Array<{
  key: string;
  label: string;
  rule: NonNullable<RulesetCombatAction["zone"]>;
  caster: RulesetCombatant;
  zone: RulesetCombatZone;
}> {
  const at = rulesetPositionOf(combatant);
  const grid = state.board?.grid;
  return state.combatants.flatMap((caster) =>
    (caster.zones ?? []).flatMap((zone) => {
      const rule = caster.actions.find((entry) => entry.id === zone.actionId)?.zone;
      if (!rule || (!rule.inside && !rule.forbids && !rule.wards && !rule.suppresses)) return [];
      // Any cell they fill (1.194).
      const inIt =
        grid && at
          ? rulesetZoneCells(state, caster, zone).some((cell) => rulesetFills(combatant, cell))
          : !!zone.held?.includes(combatant.id);
      return inIt ? [{ key: `${caster.id}/${zone.actionId}`, label: zone.label, rule, caster, zone }] : [];
    }),
  );
}

/** The conditions standing zones put on this combatant now (1.179): Silence's deafened. Only one it
 *  works on (1.460), read by `definition`. */
export function rulesetZoneConditions(
  state: RulesetEncounterState,
  combatant: RulesetCombatant,
  definition?: RulesetDefinition,
): string[] {
  return [
    ...new Set(
      zonesStoodIn(state, combatant).flatMap(({ rule, zone }) =>
        insideWorksOn(definition, combatant, zone, rule) ? (rule.inside?.conditions ?? []) : [],
      ),
    ),
  ];
}

/** What the zones they stand in suppress (1.521): conditions off these catalogs, items with these tags.
 *  Null when they stand in none that does. */
export function rulesetSuppressedOn(
  state: RulesetEncounterState | undefined,
  combatant: RulesetCombatant,
): { catalogs: Set<string>; tags: Set<string> } | null {
  if (!state) return null;
  const rules = zonesStoodIn(state, combatant).flatMap(({ rule }) => (rule.suppresses ? [rule.suppresses] : []));
  if (rules.length === 0) return null;
  return {
    catalogs: new Set(rules.flatMap((rule) => rule.catalogs ?? [])),
    tags: new Set(rules.flatMap((rule) => rule.tags ?? [])),
  };
}

/** The zone that sets this called creature aside where it stands (1.533), if any: one that suppresses
 *  the catalog of the entry that called it. Antimagic Field's summons. */
export function rulesetSetAsideBy(
  state: RulesetEncounterState,
  combatant: RulesetCombatant,
): { caster: RulesetCombatant; label: string } | undefined {
  const from = combatant.calledFrom;
  if (from === undefined) return undefined;
  const found = zonesStoodIn(state, combatant).find(
    ({ rule }) => rule.suppresses?.setsAsideCalled && rule.suppresses.catalogs?.includes(from),
  );
  return found ? { caster: found.caster, label: found.label } : undefined;
}

/** Whether an item is suppressed where its holder stands (1.521): any of its tags is. */
export function rulesetItemSuppressed(
  hush: { tags: Set<string> } | null | undefined,
  item: Pick<RulesetCatalogItem, "tags"> | undefined,
): boolean {
  return !!hush && hush.tags.size > 0 && !!item?.tags?.some((tag) => hush.tags.has(tag));
}

/** The zones warding whoever stands in them (1.179), each by its caster and action, with what it
 *  keeps out. */
export function rulesetWardsOn(
  state: RulesetEncounterState,
  combatant: RulesetCombatant,
): Array<{
  key: string;
  wards: NonNullable<NonNullable<RulesetCombatAction["zone"]>["wards"]>;
  caster: RulesetCombatant;
  zone: RulesetCombatZone;
}> {
  return zonesStoodIn(state, combatant).flatMap(({ key, rule, caster, zone }) =>
    rule.wards ? [{ key, wards: rule.wards, caster, zone }] : [],
  );
}

/** A condition can take away a sense an effect needs (1.127), so its holder is left out entirely. */
export function rulesetTargetHasSenses(
  definition: RulesetDefinition,
  state: RulesetEncounterState,
  target: RulesetCombatant,
  needs: readonly string[] | undefined,
  /** Any one of them is enough (1.267): "can see or hear you". */
  any?: boolean,
): boolean {
  const combat = definition.combat;
  if (!combat || !needs?.length) return true;
  const lacked = new Set(
    rulesetActiveConditions(definition, combat, target, state).flatMap((entry) => entry.lacks ?? []),
  );
  return any ? needs.some((sense) => !lacked.has(sense)) : !needs.some((sense) => lacked.has(sense));
}

/** What a combatant is (1.168): a creature's own type and tags, or else a character's type read off
 *  `combat.creatureTypes.field`, or the ruleset's `default`. Nothing without creature types. */
export function rulesetCreatureKind(
  definition: RulesetDefinition,
  combatant: RulesetCombatant,
): { type?: string; tags: string[] } {
  const kinds = definition.combat?.creatureTypes;
  if (!kinds) return { tags: [] };
  const block = combatant.block;
  if (block?.type !== undefined || block?.tags || block?.alignment !== undefined) {
    const named = rulesetTagsNamed(definition, block.alignment);
    return {
      ...(block.type !== undefined ? { type: block.type } : {}),
      tags: [...new Set([...(block.tags ?? []), ...named])],
    };
  }
  if (!combatant.sheet) return { tags: [] };
  const read = kinds.field ? combatant.sheet.build.fields?.[kinds.field] : undefined;
  const type = typeof read === "string" && kinds.types.some((one) => one.id === read) ? read : kinds.default;
  // Its tags in the words of a field (1.699): "Lawful Good"; of each of several (1.713): its race too.
  const fields = kinds.tagsFrom === undefined ? [] : Array.isArray(kinds.tagsFrom) ? kinds.tagsFrom : [kinds.tagsFrom];
  const tags = fields.flatMap((field) => rulesetTagsNamed(definition, combatant.sheet!.build.fields?.[field]));
  return { ...(type !== undefined ? { type } : {}), tags: [...new Set(tags)] };
}

/** The creature tags some words name (1.699), by label or id as whole words ignoring case, never one
 *  named after "non-" or "not": "lawful evil" names `lawful` and `evil`, "any non-good alignment"
 *  names nothing. */
export function rulesetTagsNamed(definition: RulesetDefinition, words: unknown): string[] {
  if (typeof words !== "string" || !words.trim()) return [];
  const names = (phrase: string) => {
    const escaped = phrase
      .trim()
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      .replace(/[\s_]+/g, "[\\s_]+");
    // A word joined to another by a hyphen is another word: a half-elf is not an elf.
    return new RegExp(`(?<!non[-\\s]?|not\\s+)(?<![\\p{L}-])${escaped}(?![\\p{L}-])`, "iu").test(words);
  };
  return (definition.combat?.creatureTypes?.tags ?? [])
    .filter((tag) => names(tag.label) || names(tag.id))
    .map((tag) => tag.id);
}

/** The words these text or enum fields of a holder's sheet hold (1.429), comma-separated, trimmed and
 *  lowercased: the favored enemies a ranger chose, a sorcerer's ancestry damage type. A holder with no
 *  sheet chose nothing. */
export function rulesetSheetChoices(combatant: RulesetCombatant, fields: readonly string[] | undefined): string[] {
  const read = combatant.sheet?.build.fields;
  if (!read || !fields?.length) return [];
  return fields.flatMap((id) => {
    const value = read[id];
    return typeof value === "string"
      ? value
          .split(",")
          .map((word) => word.trim().toLowerCase())
          .filter(Boolean)
      : [];
  });
}

/** Whether a combatant's type or one of its tags is among a holder's chosen words (1.429), by id or by
 *  the type's label, without case: Foe Slayer's favored enemies. */
export function rulesetChosenKind(
  definition: RulesetDefinition,
  holder: RulesetCombatant,
  fields: readonly string[] | undefined,
  combatant: RulesetCombatant,
): boolean {
  const chosen = new Set(rulesetSheetChoices(holder, fields));
  if (chosen.size === 0) return false;
  const kind = rulesetCreatureKind(definition, combatant);
  const label = definition.combat?.creatureTypes?.types.find((one) => one.id === kind.type)?.label;
  return (
    (kind.type !== undefined && chosen.has(kind.type.toLowerCase())) ||
    (label !== undefined && chosen.has(label.toLowerCase())) ||
    kind.tags.some(
      (tag) =>
        chosen.has(tag.toLowerCase()) ||
        chosen.has((definition.combat?.creatureTypes?.tags?.find((one) => one.id === tag)?.label ?? tag).toLowerCase()),
    )
  );
}

/** Whether a combatant is what a target test asks (1.168): any of its types or tags. No test passes. */
export function rulesetTargetIs(
  definition: RulesetDefinition,
  combatant: RulesetCombatant,
  test: RulesetTargetIs | undefined,
): boolean {
  if (!test) return true;
  // Never what it excepts (1.530), and anybody else when that is all it says.
  if (test.except && rulesetTargetIs(definition, combatant, test.except)) return false;
  // One of these at least (1.555); a flier; holding one of these conditions.
  if (test.anyOf && !test.anyOf.some((one) => rulesetTargetIs(definition, combatant, one))) return false;
  if (test.flying && !combatant.speeds?.fly) return false;
  // Standing in a zone of these entries, or not (1.755): Magic Jar, never into a magic circle.
  if (test.insideZoneOf && !standsInZoneOf(combatant, test.insideZoneOf)) return false;
  if (test.outsideZoneOf && standsInZoneOf(combatant, test.outsideZoneOf)) return false;
  const holding = test.holding;
  if (holding && !rulesetCombatConditions(definition, combatant).some((id) => holding.includes(id))) return false;
  // Wearing something of these tags (1.711): an item worn on its sheet, or what a creature wears.
  const wears = test.wears?.tags;
  if (
    wears &&
    !combatant.sheet?.items?.some((held) => held.worn && held.item.tags?.some((tag) => wears.includes(tag))) &&
    !combatant.block?.wears?.some((tag) => wears.includes(tag))
  )
    return false;
  // Of a size (1.403), as well as whatever else it asks.
  if (
    test.types === undefined &&
    test.tags === undefined &&
    test.upToSize === undefined &&
    test.atLeastSize === undefined
  )
    return true;
  if (test.upToSize !== undefined || test.atLeastSize !== undefined) {
    const combat = definition.combat;
    const rank = combat ? rulesetSizeRank(combat, combatant) : undefined;
    const order = combat?.sizes?.order ?? [];
    if (rank !== undefined) {
      if (test.upToSize !== undefined && rank > order.findIndex((size) => size.id === test.upToSize)) return false;
      if (test.atLeastSize !== undefined && rank < order.findIndex((size) => size.id === test.atLeastSize))
        return false;
    }
    if (test.types === undefined && test.tags === undefined) return true;
  }
  const kind = rulesetCreatureKind(definition, combatant);
  return (
    (kind.type !== undefined && !!test.types?.includes(kind.type)) ||
    kind.tags.some((tag) => !!test.tags?.includes(tag))
  );
}

/** Whether somebody has begun their turn this round (1.327), the one going on included. */
export function rulesetActedThisRound(state: RulesetEncounterState, id: string): boolean {
  return !!state.acted?.includes(id);
}

/** Whether an action may be pointed at or catch this combatant, by what it is (1.168). */
export function rulesetTargetTypesAllow(
  definition: RulesetDefinition,
  combatant: RulesetCombatant,
  targetTypes:
    | {
        is?: RulesetTargetIs;
        not?: RulesetTargetIs;
        abilityAtMost?: Record<string, number>;
        abilityAtLeast?: Record<string, number>;
        notImmuneTo?: string[];
        calledBySelf?: true;
        understands?: true;
        uncontrolled?: true;
      }
    | undefined,
  /** Who it is pointed by (1.487), for `calledBySelf`: nobody given, nobody passes it. */
  by?: RulesetCombatant,
): boolean {
  if (!targetTypes) return true;
  // Only one its user called (1.487): Find Familiar's own familiar.
  // Never one that turned on them (1.538).
  if (targetTypes.calledBySelf && (!by || combatant.calledBy !== by.id || combatant.calledTurned)) return false;
  // Under nobody else's control (1.633): uncalled, its user's own, wild or turned on its caller.
  if (
    targetTypes.uncontrolled &&
    combatant.calledBy !== undefined &&
    combatant.calledBy !== by?.id &&
    !combatant.calledWild &&
    !combatant.calledTurned
  )
    return false;
  // Only one that understands a language its user speaks (1.561): Suggestion. Either one's languages
  // not written down keeps nobody out.
  if (targetTypes.understands && by && by.id !== combatant.id) {
    // Nothing understood, or everything (1.648): Feeblemind and Tongues, on either side. Or every
    // language understood by the target (1.734): Comprehend Languages, which does nothing for its
    // holder being understood.
    const held = [rulesetHeldLanguages(definition, combatant), rulesetHeldLanguages(definition, by)];
    if (held.includes("none")) return false;
    const theirs = rulesetLanguages(definition, combatant);
    const ours = rulesetLanguages(definition, by);
    if (
      !held.includes("all") &&
      held[0] !== "understands" &&
      theirs &&
      ours &&
      !theirs.some((one) => ours.includes(one))
    )
      return false;
  }
  if (targetTypes.is && !rulesetTargetIs(definition, combatant, targetTypes.is)) return false;
  if (targetTypes.not && rulesetTargetIs(definition, combatant, targetTypes.not)) return false;
  // Its ability scores at most these (1.185); a score nobody wrote down keeps nobody out.
  for (const [ability, most] of Object.entries(targetTypes.abilityAtMost ?? {})) {
    const score = rulesetAbilityScore(definition, combatant, ability);
    if (score !== undefined && score > most) return false;
  }
  // And at least these (1.191), read the same way.
  for (const [ability, least] of Object.entries(targetTypes.abilityAtLeast ?? {})) {
    const score = rulesetAbilityScore(definition, combatant, ability);
    if (score !== undefined && score < least) return false;
  }
  // And not immune to any of these conditions (1.185).
  if (targetTypes.notImmuneTo?.length) {
    const immune = rulesetCombatHide(definition, combatant).conditionImmunities.map((id) => id.trim().toLowerCase());
    if (targetTypes.notImmuneTo.some((id) => immune.includes(id.trim().toLowerCase()))) return false;
  }
  return true;
}

/** An item's rolled call as it stands (1.591): as this fight changed it, else as its stack kept it.
 *  An Efreeti Bottle's kept roll, its openings, and whether it is spent for good. */
export function rulesetItemCallRoll(combatant: RulesetCombatant, item: number): RulesetItemCallRoll {
  return combatant.callRolls?.[item] ?? combatant.sheet?.items?.[item]?.callRoll ?? {};
}

/** What a condition its holder holds says they understand (1.648): `none` over `all`, and `all` over
 *  `understands` (1.734). */
export function rulesetHeldLanguages(
  definition: RulesetDefinition,
  combatant: RulesetCombatant,
): "none" | "all" | "understands" | undefined {
  const combat = definition.combat;
  if (!combat?.conditions?.some((entry) => entry.languages)) return undefined;
  const held = rulesetActiveConditions(definition, combat, combatant).map((one) => one.languages);
  return held.includes("none")
    ? "none"
    : held.includes("all")
      ? "all"
      : held.includes("understands")
        ? "understands"
        : undefined;
}

/** The languages a combatant understands (1.561), lower case: off their sheet's `combat.languages`
 *  list, each row split on its `split` (1.589), or as their stat block writes them. Undefined where
 *  nothing says, a sheet with no such row among them (1.589). */
export function rulesetLanguages(definition: RulesetDefinition, combatant: RulesetCombatant): string[] | undefined {
  const plain = (one: string) => one.trim().toLowerCase();
  if (combatant.sheet) {
    const rule = definition.combat?.languages;
    if (!rule) return undefined;
    const prefix = rule.prefix ? plain(rule.prefix) : "";
    const separators = (rule.split ?? []).map((one) => one.toLowerCase());
    const rows = combatant.sheet.build.lists?.[rule.list] ?? [];
    const names = rows.flatMap((row) => {
      const value = row[rule.column];
      if (typeof value !== "string") return [];
      const said = plain(value);
      if (prefix && !said.startsWith(prefix)) return [];
      let parts = [said.slice(prefix.length)];
      for (const separator of separators) parts = parts.flatMap((part) => part.split(separator));
      return parts.map(plain).filter((name) => name.length > 0);
    });
    return names.length > 0 ? names : undefined;
  }
  return combatant.block?.languages?.map(plain);
}

/** One of a combatant's ability scores (1.185): off their sheet, or as their stat block writes it.
 *  Undefined for a creature written without it. */
export function rulesetAbilityScore(
  definition: RulesetDefinition,
  combatant: RulesetCombatant,
  ability: string,
): number | undefined {
  if (combatant.sheet) {
    if (!definition.sheet.abilities.some((entry) => entry.id === ability)) return undefined;
    // As the conditions they hold in the fight change it (1.515).
    if (combatant.abilityConditions?.length)
      return evaluateRulesetSheetLive(
        definition,
        combatant.sheet.build,
        combatant.sheet.live,
        combatant.sheet.items,
        combatant.abilityConditions,
      ).abilityScores[ability];
    return resolveRulesetValueRef(definition, combatant.sheet.build, { abilityScore: ability } as RulesetValueRef);
  }
  return combatant.abilityScores?.[ability] ?? combatant.block?.abilities?.[ability];
}

/** What a fighter's items do, as they hold them in this fight: see `rulesetItemSources`. A requirement
 *  reads the sheet with the live state as it stands. Nothing for a fighter with no sheet or no items. */
function heldSources(
  definition: RulesetDefinition,
  combatant: RulesetCombatant,
  /** What the zones they stand in suppress (1.521): an item with a tag of these does nothing. */
  hush?: { tags: Set<string> } | null,
): RulesetCheckSource[] {
  const sheet = combatant.sheet;
  if (!sheet?.items?.length) return [];
  // What lies where it was dropped (1.266) does nothing for them, nor what is suppressed (1.521).
  const dropped = rulesetDroppedItems(combatant);
  const items = (
    dropped.size || hush?.tags.size
      ? sheet.items.filter((held, index) => !dropped.has(index) && !rulesetItemSuppressed(hush, held.item))
      : sheet.items
  ).map((held) => {
    // What holds only while charges or uses are left reads them as this fight left them (1.732).
    const index = sheet.items!.indexOf(held);
    const does = held.truly?.item ?? held.item;
    if (!does.worn?.whileLeft && !does.carried?.whileLeft) return held;
    const usesLeft = { ...held.usesLeft };
    for (const [key, value] of Object.entries(combatant.usesLeft ?? {})) {
      const [at, more] = key.split(":");
      if (Number(at) === index && more !== undefined) usesLeft[more] = value;
    }
    return { ...held, charges: combatant.charges?.[index] ?? held.charges, usesLeft };
  });
  let evaluated: EvaluatedRulesetSheet | undefined;
  return rulesetItemSources(
    definition,
    sheet.build,
    items,
    () =>
      (evaluated ??= evaluateRulesetSheetLive(definition, sheet.build, sheet.live, items, combatant.abilityConditions)),
  );
}

/** What a fighter's hide is made of, including conditions, levels and sheet rows (Capability API 1.132). */
export function rulesetCombatHide(
  definition: RulesetDefinition,
  combatant: RulesetCombatant,
  state?: RulesetEncounterState,
  rawLevels = false,
): {
  resist: RulesetCreatureHideEntry[];
  vulnerable: string[];
  immune: RulesetCreatureHideEntry[];
  conditionImmunities: string[];
} {
  const sources = definition.combat
    ? rulesetActiveConditions(definition, definition.combat, combatant, state, rawLevels)
    : heldSources(definition, combatant);
  const all = [...sources, ...(combatant.sheet ? rulesetSheetHideSources(definition, combatant.sheet.build) : [])];
  return {
    resist: [
      ...(combatant.block?.resist ?? []),
      ...all.flatMap((source) => source.resist ?? []),
      // What the holder's sheet chose (1.429): Elemental Affinity's ancestry type.
      ...all.flatMap((source) => ("resistIn" in source ? rulesetSheetChoices(combatant, source.resistIn) : [])),
    ],
    vulnerable: [...(combatant.block?.vulnerable ?? []), ...all.flatMap((source) => source.vulnerable ?? [])],
    immune: [...(combatant.block?.immune ?? []), ...all.flatMap((source) => source.immune ?? [])],
    conditionImmunities: [
      ...(combatant.block?.conditionImmunities ?? []),
      ...all.flatMap((source) => source.conditionImmunities ?? []),
    ],
  };
}

/** A condition entry that is on somebody right now: one of the fight's own conditions, a level of a
 *  live track or a derived value, or what an item does, each of which reads exactly like one. `level`
 *  is set only on a level, whose `condition` is then the track's id, or the derived value's where
 *  `derived` is set (the two may share an id). `item` is set on an item's, whose `condition` is then
 *  the stack's name. */
export type RulesetActiveCondition = RulesetCombatCondition & {
  level?: number;
  derived?: true;
  item?: true;
  /** A level that takes its holder out of the fight (1.115). */
  defeats?: true;
  /** What standing in a zone does (1.179), named for the zone. */
  zone?: true;
};

/** The levels of the holder's own tracks, and of their derived values, that are reached. A sheet has
 *  both; a combatant written in plain numbers has only the tracks it was given (1.115). A derived
 *  value is worked out with the live state as it stands and what they held as the fight began. A
 *  track the holder is immune to has no levels on them at all. */
function activeLevels(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  combatant: RulesetCombatant,
  rawLevels = false,
): RulesetActiveCondition[] {
  if (!combat.levels?.length) return [];
  const sheet = combatant.sheet;
  if (!sheet && !combatant.tracks) return [];
  const live = sheet ? readRulesetLive(definition, sheet.build, sheet.live, sheet.items) : undefined;
  let derived: Record<string, number> | undefined;
  // Even the non-recursive read must honor the creature's and items' existing track immunities.
  const baseImmunities = rawLevels
    ? [
        ...(combatant.block?.conditionImmunities ?? []),
        ...heldSources(definition, combatant).flatMap((source) => source.conditionImmunities ?? []),
      ].map((id) => id.trim().toLowerCase())
    : [];
  return combat.levels.flatMap((level) => {
    if (level.derived !== undefined && !sheet) return [];
    if (
      level.track !== undefined &&
      (rawLevels
        ? baseImmunities.includes(level.track.trim().toLowerCase())
        : rulesetImmuneToCondition(combatant, level.track, definition))
    )
      return [];
    const value =
      level.derived !== undefined
        ? ((derived ??= evaluateRulesetSheetLive(
            definition,
            sheet!.build,
            sheet!.live,
            sheet!.items,
            combatant.abilityConditions,
          ).derived)[level.derived] ?? 0)
        : live
          ? (live.tracks.find((track) => track.id === level.track)?.value ?? 0)
          : (combatant.tracks?.[level.track!] ?? 0);
    if (value < level.at) return [];
    return [
      {
        ...(level.resist ? { resist: level.resist } : {}),
        ...(level.vulnerable ? { vulnerable: level.vulnerable } : {}),
        ...(level.immune ? { immune: level.immune } : {}),
        ...(level.conditionImmunities ? { conditionImmunities: level.conditionImmunities } : {}),
        condition: level.track ?? level.derived!,
        level: level.at,
        ...(level.derived !== undefined ? { derived: true as const } : {}),
        effects: level.effects,
        ...(level.modifiers ? { modifiers: level.modifiers } : {}),
        ...(level.failsSaves ? { failsSaves: level.failsSaves } : {}),
        ...(level.saves ? { saves: level.saves } : {}),
        ...(level.skills ? { skills: level.skills } : {}),
        ...(level.evasion ? { evasion: level.evasion } : {}),
        ...(level.regenerates ? { regenerates: level.regenerates } : {}),
        ...(level.hangsOn ? { hangsOn: level.hangsOn } : {}),
        ...(level.rerollsFace ? { rerollsFace: level.rerollsFace } : {}),
        ...(level.fellsGrant ? { fellsGrant: level.fellsGrant } : {}),
        ...(level.notWhile ? { notWhile: level.notWhile } : {}),
        ...(level.whenSeen ? { whenSeen: true as const } : {}),
        ...(level.checkFloor ? { checkFloor: level.checkFloor } : {}),
        ...(level.strikesAgain ? { strikesAgain: level.strikesAgain } : {}),
        ...(level.ignoresHardGround ? { ignoresHardGround: true as const } : {}),
        ...(level.runsAcross ? { runsAcross: true as const } : {}),
        ...(level.passesCreatures ? { passesCreatures: level.passesCreatures } : {}),
        ...(level.shapeKeeps ? { shapeKeeps: level.shapeKeeps } : {}),
        ...(level.waives ? { waives: level.waives } : {}),
        ...(level.rowsWhere ? { rowsWhere: level.rowsWhere } : {}),
        ...(level.defeats ? { defeats: true as const } : {}),
      },
    ];
  });
}

/** One number one condition changes, with the condition it came from. */
export interface RulesetConditionModifier {
  condition: string;
  level?: number;
  derived?: true;
  item?: true;
  modifier: NonNullable<RulesetCombatCondition["modifiers"]>[number];
}

/**
 * Everything this combatant's conditions (and levels) do to one number. For a save, a change that
 * names its saves (its own, else its condition's) changes only those; everything else it changes
 * whatever the roll is for. A change to checks narrowed to some skills reaches a fight only on a check
 * that names one of them (an item's gate), since its contests roll the fight's own checks; a change
 * that only rolls twice adds nothing here.
 */
export function rulesetConditionModifiers(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  combatant: RulesetCombatant,
  to: NonNullable<RulesetCombatCondition["modifiers"]>[number]["to"],
  state?: RulesetEncounterState,
  /** The save rolled, for modifiers to saves; the skill rolled, for modifiers to checks, so what is
   *  narrowed to it counts (a contest names none, and reads only what is narrowed to nothing). */
  save?: string,
  against?: RulesetSaveAgainst,
  /** The ability an attack or a check is made with (1.188), so what is narrowed to it counts; with
   *  none, a change narrowed to an ability reads nothing. */
  ability?: string,
  /** Only the changes held back until a roll falls short (1.249), rather than only the others. */
  rescue = false,
): RulesetConditionModifier[] {
  // A ruleset with no items and no condition or level that changes a number has nothing to read. One
  // with items reads them once, below, with everything else that is on the combatant.
  if (
    !definition.items &&
    !combat.conditions?.some((entry) => entry.modifiers) &&
    !combat.levels?.some((level) => level.modifiers)
  ) {
    return [];
  }
  return rulesetActiveConditions(definition, combat, combatant, state).flatMap((entry) => {
    return (entry.modifiers ?? [])
      .filter((modifier) => {
        if (modifier.to !== to || !rulesetSaveAgainstMatches(modifier.against, against)) return false;
        if (!!modifier.rescue !== rescue) return false;
        if (
          modifier.flat === undefined &&
          modifier.dice === undefined &&
          modifier.times === undefined &&
          modifier.diceTimes === undefined &&
          modifier.criticalDice === undefined &&
          modifier.atLeast === undefined &&
          modifier.add === undefined
        )
          return false;
        const skills = modifier.skills ?? entry.skills;
        if (to === "checks" && skills && !(save !== undefined && skills.includes(save))) return false;
        // Only for a purpose the Game Master names (1.752), which none of a fight's checks has.
        if (to === "checks" && modifier.for) return false;
        // Only a skill its holder adds their whole proficiency to (1.429): Natural Explorer.
        if (modifier.proficient && !rulesetTrainedIn(definition, combatant, save)) return false;
        if (!rulesetAbilityNarrowing(modifier, to, ability)) return false;
        const saves = modifier.saves ?? entry.saves;
        return !(to === "saves" && save !== undefined && saves && !saves.includes(save));
      })
      .map((modifier) => ({
        condition: entry.condition,
        ...(entry.level !== undefined ? { level: entry.level } : {}),
        ...(entry.derived ? { derived: entry.derived } : {}),
        ...(entry.item ? { item: entry.item } : {}),
        modifier,
      }));
  });
}

/** Whether a combatant adds their whole proficiency to this skill (1.429): one with a sheet, trained in
 *  it. A creature with no sheet, and a check with no skill, are not. */
function rulesetTrainedIn(
  definition: RulesetDefinition,
  combatant: RulesetCombatant,
  skill: string | undefined,
): boolean {
  const sheet = combatant.sheet;
  if (!sheet || skill === undefined) return false;
  const tier = evaluateRulesetSheetLive(definition, sheet.build, sheet.live, sheet.items, combatant.abilityConditions)
    .skillTiers[skill];
  return rulesetTierAddsProficiency(definition, tier);
}

/** What those conditions DO, as the closed effect list. */
export function rulesetCombatEffects(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  combatant: RulesetCombatant,
  state?: RulesetEncounterState,
): Set<string> {
  const effects = new Set<string>();
  for (const entry of rulesetActiveConditions(definition, combat, combatant, state)) {
    for (const effect of entry.effects) effects.add(effect);
  }
  // Caught unaware (1.237): no reaction until their first turn ends.
  if (combatant.surprised) effects.add("cannot-react");
  return effects;
}

/** The condition holding this combatant out of time (1.647), if any: 5e's Sequester. */
export function rulesetStasis(
  definition: RulesetDefinition,
  combatant: RulesetCombatant,
  state?: RulesetEncounterState,
): string | undefined {
  const combat = definition.combat;
  if (!combat?.conditions?.some((entry) => entry.stasis)) return undefined;
  return rulesetActiveConditions(definition, combat, combatant, state).find((one) => one.stasis)?.condition;
}

/** What shuts this combatant away from everybody else (1.314): the `sealed` of a condition that holds
 *  on them, with that condition's name. */
export function rulesetSealed(
  definition: RulesetDefinition,
  combatant: RulesetCombatant,
  state?: RulesetEncounterState,
): (NonNullable<RulesetCombatCondition["sealed"]> & { condition: string }) | undefined {
  const combat = definition.combat;
  if (!combat?.conditions?.some((entry) => entry.sealed)) return undefined;
  const entry = rulesetActiveConditions(definition, combat, combatant, state).find((one) => one.sealed);
  return entry?.sealed ? { ...entry.sealed, condition: entry.condition } : undefined;
}

/** Whether a sphere stands between these two (1.314): either is sealed, and they are not the same.
 *  Nothing of one reaches the other. */
export function rulesetSealedApart(
  definition: RulesetDefinition,
  state: RulesetEncounterState,
  one: RulesetCombatant,
  other: RulesetCombatant,
): boolean {
  if (one.id === other.id) return false;
  // Inside somebody (1.403): apart from everybody but them and whoever else they hold.
  if (one.insideOf !== undefined || other.insideOf !== undefined) {
    const together =
      one.insideOf === other.id ||
      other.insideOf === one.id ||
      (one.insideOf !== undefined && one.insideOf === other.insideOf);
    if (!together) return true;
  }
  return !!rulesetSealed(definition, one, state) || !!rulesetSealed(definition, other, state);
}

/** Whether an engulf (1.403) takes this one in as its maker moves into them: standing, inside
 *  nobody, and no bigger than it holds. One with no size is never too big. */
export function rulesetEngulfable(
  definition: RulesetDefinition,
  actor: RulesetCombatant,
  engulf: RulesetEngulf,
  combatant: RulesetCombatant,
): boolean {
  if (combatant.id === actor.id || combatant.insideOf !== undefined || !rulesetCombatStanding(combatant)) return false;
  const combat = definition.combat;
  if (!combat?.sizes) return true;
  const rank = rulesetSizeRank(combat, combatant);
  return rank === undefined || rank <= combat.sizes.order.findIndex((size) => size.id === engulf.upToSize);
}

/** Whether a condition makes this save fail without rolling. */
export function rulesetCombatFailsSave(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  combatant: RulesetCombatant,
  save: string,
  state?: RulesetEncounterState,
): boolean {
  return rulesetActiveConditions(definition, combat, combatant, state).some(
    (entry) => entry.failsSaves?.includes(save) === true,
  );
}

/** How this combatant's own saves are rolled: the conditions on them, narrowed to the ones that
 *  are about THIS save, with advantage and disadvantage cancelling each other out exactly as they
 *  do on an attack. A ruleset that never rolls twice keeps its single roll. */
export function rulesetSaveMode(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  combatant: RulesetCombatant,
  save: string,
  state?: RulesetEncounterState,
  against?: RulesetSaveAgainst,
  /** What the save itself says about who rolls it twice (1.185): Sunbeam, against an undead. */
  lean?: "advantage" | "disadvantage",
  /** Whether its holder can see what the save is against (1.417); a save with no source is seen. */
  seen = true,
): "normal" | "advantage" | "disadvantage" {
  if (!rulesetCombatAdvantage(combat)) return "normal";
  let advantage = lean === "advantage";
  let disadvantage = lean === "disadvantage";
  for (const entry of rulesetActiveConditions(definition, combat, combatant, state)) {
    // Only against what its holder can see (1.417): Danger Sense.
    if (entry.whenSeen && !seen) continue;
    // A change to saves that rolls twice counts like the effect, narrowed by its own saves first.
    for (const modifier of entry.modifiers ?? []) {
      const saves = modifier.saves ?? entry.saves;
      if (modifier.to !== "saves" || !modifier.mode || (saves && !saves.includes(save))) continue;
      if (!rulesetSaveAgainstMatches(modifier.against, against)) continue;
      if (modifier.mode === "advantage") advantage = true;
      else disadvantage = true;
    }
    if (entry.saves && !entry.saves.includes(save)) continue;
    if (entry.effects.includes("own-saves-advantage")) advantage = true;
    if (entry.effects.includes("own-saves-disadvantage")) disadvantage = true;
  }
  // Dodging is not only about being harder to hit: where the ruleset says so, the saves that are
  // about getting out of the way are rolled with advantage too, for as long as the dodge lasts.
  if (combatant.flags.dodging && combat.standardEffects?.dodge?.saves.includes(save)) advantage = true;
  if (advantage === disadvantage) return "normal";
  return advantage ? "advantage" : "disadvantage";
}

/** Whether a change narrowed to an ability reaches a roll made with this one (1.188): attacks by
 *  `ability`, checks by `abilities`. A roll that names no ability reaches only what is not narrowed. */
export function rulesetAbilityNarrowing(
  modifier: { to: string; ability?: string; abilities?: string[] },
  to: string,
  ability: string | undefined,
): boolean {
  if (to === "attacks" && modifier.ability !== undefined) return modifier.ability === ability;
  if (to === "checks" && modifier.abilities) return ability !== undefined && modifier.abilities.includes(ability);
  return true;
}

/** The ability a check is made with (1.188): an ability by its own id, a skill's ability, or the one
 *  a fight's check reads its number off. Nothing when none of them says. */
export function rulesetCheckAbility(definition: RulesetDefinition, check: string | undefined): string | undefined {
  if (!check) return undefined;
  const { sheet } = definition;
  if (sheet.abilities.some((ability) => ability.id === check)) return check;
  const skill = sheet.skills.find((entry) => entry.id === check);
  if (skill) return skill.ability;
  const value = definition.combat?.checks?.find((entry) => entry.id === check)?.value as
    { abilityMod?: string; skillMod?: string } | undefined;
  if (value?.abilityMod) return value.abilityMod;
  return value?.skillMod ? sheet.skills.find((entry) => entry.id === value.skillMod)?.ability : undefined;
}

/** The skill a check of the fight's is rolled with (1.290): a skill itself, or a `combat.checks`
 *  entry read off one (`skillMod`), so what is narrowed to that skill counts on it: 5e's Stealth in
 *  heavy armor. */
export function rulesetCheckSkill(definition: RulesetDefinition, check: string | undefined): string | undefined {
  if (!check) return undefined;
  if (definition.sheet.skills.some((entry) => entry.id === check)) return check;
  const value = definition.combat?.checks?.find((entry) => entry.id === check)?.value as
    { skillMod?: string } | undefined;
  return value?.skillMod;
}

/** The modes `holder` puts on checks made to find them (1.290), with the skill rolled: 5e's Cloak
 *  of Elvenkind, disadvantage on Perception to see its wearer. */
export function rulesetCheckTakenModes(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  holder: RulesetCombatant,
  state: RulesetEncounterState | undefined,
  skill: string | undefined,
): { advantage: boolean; disadvantage: boolean } {
  const modes = { advantage: false, disadvantage: false };
  if (!rulesetCombatAdvantage(combat)) return modes;
  for (const entry of rulesetActiveConditions(definition, combat, holder, state)) {
    for (const modifier of entry.modifiers ?? []) {
      if (modifier.to !== "checks-taken" || !modifier.mode) continue;
      const skills = modifier.skills ?? entry.skills;
      if (skills && !(skill !== undefined && skills.includes(skill))) continue;
      modes[modifier.mode] = true;
    }
  }
  return modes;
}

/** The ability an item's gate is rolled with (1.188): a raw ability check's own, or a skill's as it is
 *  rolled. A value off the sheet names none. */
function gateAbility(target: RulesetCheckTarget | null | undefined): string | undefined {
  if (target?.type === "ability") return target.id;
  return target?.type === "skill" ? (target.withAbility ?? target.ability) : undefined;
}

/** How this combatant's own side of a contest is thrown: the check effects of their conditions and
 *  their changes to checks that roll twice, cancelling each other out as they do on an attack. What is
 *  narrowed to some skills stays out, since a contest rolls the fight's own checks. A ruleset that never
 *  rolls twice keeps its single throw. */
export function rulesetCheckMode(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  combatant: RulesetCombatant,
  state?: RulesetEncounterState,
  /** The skill rolled, where a check names one (an item's gate), so what is narrowed to it counts. */
  skill?: string,
  /** The ability the check is made with (1.188), so what is narrowed to it counts. */
  ability?: string,
  /** What whoever it is made against puts on it (1.290): `rulesetCheckTakenModes`. */
  taken?: { advantage: boolean; disadvantage: boolean },
  /** Whom it is made to find (1.567), so what is narrowed to anybody but a condition's source counts. */
  perceiving?: string,
): "normal" | "advantage" | "disadvantage" {
  if (!rulesetCombatAdvantage(combat)) return "normal";
  let advantage = !!taken?.advantage;
  let disadvantage = !!taken?.disadvantage;
  const narrowedAway = (skills: readonly string[] | undefined) =>
    !!skills && !(skill !== undefined && skills.includes(skill));
  for (const entry of rulesetActiveConditions(definition, combat, combatant, state)) {
    for (const modifier of entry.modifiers ?? []) {
      if (modifier.to !== "checks" || !modifier.mode || narrowedAway(modifier.skills ?? entry.skills)) continue;
      if (!rulesetAbilityNarrowing(modifier, "checks", ability)) continue;
      // Only for a purpose the Game Master names (1.752).
      if (modifier.for) continue;
      // Only in looking for anybody but whoever put it on (1.567): Enthrall.
      if (
        modifier.exceptSource &&
        (perceiving === undefined ||
          combatant.tracked.some((held) => held.condition === entry.condition && held.source === perceiving))
      )
        continue;
      if (modifier.mode === "advantage") advantage = true;
      else disadvantage = true;
    }
    if (narrowedAway(entry.skills)) continue;
    if (entry.effects.includes("own-checks-advantage")) advantage = true;
    if (entry.effects.includes("own-checks-disadvantage")) disadvantage = true;
  }
  // A creature's own (1.291): keen senses, sensitivity to light, camouflage, where they hold.
  for (const rule of combatant.block?.checkModes ?? []) {
    if (skill === undefined || !rule.skills.includes(skill)) continue;
    if (!rulesetModeRuleHolds(definition, combat, combatant, state, rule)) continue;
    if (rule.mode === "advantage") advantage = true;
    else disadvantage = true;
  }
  if (advantage === disadvantage) return "normal";
  return advantage ? "advantage" : "disadvantage";
}

/** Whether a creature's own mode on checks (1.291) or attacks (1.293) holds where it is now: it can see, where `sight`
 *  says so; the light it stands in is one `light` names; it stands on a tile, or the board is a
 *  place, `terrain` names. Off a board, only `sight` can hold. */
export function rulesetModeRuleHolds(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  combatant: RulesetCombatant,
  state: RulesetEncounterState | undefined,
  rule: Omit<RulesetCheckModeRule, "skills">,
): boolean {
  if (rule.sight) {
    const eyes = combat.sight?.eyes;
    const own = new Set(rulesetCombatConditions(definition, combatant));
    if (
      eyes !== undefined &&
      (combat.conditions ?? []).some((one) => own.has(one.condition) && one.lacks?.includes(eyes))
    )
      return false;
  }
  const board = state?.board;
  // The light where it stands, where the dark is real (1.294); else the board's.
  const at = rulesetPositionOf(combatant);
  const here = state && at ? rulesetLightAt(definition, state, at) : board?.light;
  if (rule.light && !rule.light.some((light) => rulesetLightMatches(here, light))) return false;
  if (rule.terrain) {
    const tile =
      board?.grid && combatant.x !== undefined && combatant.y !== undefined
        ? board.grid.tiles[combatant.y]?.[combatant.x]
        : undefined;
    if (!rule.terrain.some((one) => one === tile || (board?.environment !== undefined && one === board.environment)))
      return false;
  }
  return true;
}

/** The rounds left of `condition` on `holder` from when it last came off before it ran out (1.616),
 *  counted down a round each round since; undefined when it never did. */
/** What a worn item makes creatures of some bestiary entries leave its wearer alone (1.619): the
 *  `ignoredBy` of each item they wear and have not dropped. */
function wornIgnoredBy(wearer: RulesetCombatant): Array<{ entries: string[]; untilHarmed?: true }> {
  const items = wearer.sheet?.items;
  if (!items?.length) return [];
  const dropped = rulesetDroppedItems(wearer);
  return items.flatMap((held, index) => {
    const rule = held.worn && !dropped.has(index) ? rulesetHeldItemDoes(held).worn?.ignoredBy : undefined;
    return rule ? [rule] : [];
  });
}

/** Whether `creature` leaves `wearer` alone for what they wear (1.619): it was made from an entry
 *  one of their items names, and has not been attacked, harmed or forced to save by them when that
 *  item says `untilHarmed`. The Pipes of the Sewers' rats. */
export function rulesetIgnoredByCreature(wearer: RulesetCombatant, creature: RulesetCombatant): boolean {
  if (!creature.creature || wearer.id === creature.id) return false;
  const ref = `${creature.creature.catalogId}/${creature.creature.entryId}`;
  return wornIgnoredBy(wearer).some(
    (rule) => rule.entries.includes(ref) && !(rule.untilHarmed && wearer.provoked?.includes(creature.id)),
  );
}

/** Whoever a wearer's worn item leaves them alone by (1.619), and whom they just attacked, harmed or
 *  forced to save, noted so those leave them alone no more. */
export function rulesetNoteProvoked(state: RulesetEncounterState, wearerId: string, targetId: string): void {
  const wearer = rulesetCombatant(state, wearerId);
  const target = rulesetCombatant(state, targetId);
  if (!wearer || !target?.creature || wearerId === targetId) return;
  const ref = `${target.creature.catalogId}/${target.creature.entryId}`;
  if (!wornIgnoredBy(wearer).some((rule) => rule.untilHarmed && rule.entries.includes(ref))) return;
  if (!wearer.provoked?.includes(targetId)) (wearer.provoked ??= []).push(targetId);
}

/** Whether a called creature's caller can command it now (1.620): standing, able to act, and within
 *  its `calledCommandWithin` of it where there is a board. One with no such reach always can. */
export function rulesetCommandReaches(
  definition: RulesetDefinition,
  state: RulesetEncounterState,
  called: RulesetCombatant,
): boolean {
  if (called.calledCommandWithin === undefined) return true;
  const caller = called.calledBy ? rulesetCombatant(state, called.calledBy) : undefined;
  if (!caller || !rulesetCombatStanding(caller) || caller.away) return false;
  const combat = definition.combat;
  if (
    combat &&
    rulesetActiveConditions(definition, combat, caller, state).some((entry) => entry.effects.includes("cannot-act"))
  )
    return false;
  if (!state.board?.grid || !rulesetPositionOf(caller) || !rulesetPositionOf(called)) return true;
  return rulesetGap(caller, called) <= called.calledCommandWithin;
}

export function rulesetConditionLeft(
  state: RulesetEncounterState,
  holder: RulesetCombatant,
  condition: string,
): number | undefined {
  const left = holder.conditionLeft?.[condition];
  return left ? Math.max(0, left.rounds - Math.max(0, state.round - left.round)) : undefined;
}

/** The places a board may be that are indoors (1.614), by the tactical generator's names; any other,
 *  or a board that names none, is outdoors. */
export const RULESET_INDOOR_PLACES: readonly string[] = Object.freeze([
  "dungeon",
  "cave",
  "castle",
  "spaceship",
  "mansion",
]);

/** Whether a call may be made where `caller` stands (1.614): in none of `notLight`, and outdoors or
 *  indoors as it says. Children of the Night. */
export function rulesetCallWhereHolds(
  definition: RulesetDefinition,
  caller: RulesetCombatant,
  state: RulesetEncounterState | undefined,
  where: RulesetCallWhere,
): boolean {
  const combat = definition.combat;
  if (
    combat &&
    where.notLight &&
    rulesetModeRuleHolds(definition, combat, caller, state, { mode: "advantage", light: where.notLight })
  )
    return false;
  const place = state?.board?.environment;
  const indoors = place !== undefined && RULESET_INDOOR_PLACES.includes(place);
  if (where.outdoors && indoors) return false;
  if (where.indoors && !indoors) return false;
  return true;
}

/** Whether the light a board is fought in is `wanted` (1.291): sunlight is bright light too, and a
 *  board that says nothing is in bright light that is not the sun's. */
export function rulesetLightMatches(light: RulesetBoardLight | undefined, wanted: RulesetBoardLight): boolean {
  const is = light ?? "bright";
  return is === wanted || (wanted === "bright" && is === "sunlight");
}

/** A combatant who can still be acted on and still take a turn. */
/** How `combatant` climbs out of whoever it is inside (1.405), once they have fallen: undefined
 *  while they stand, or where what took it in said nothing of it. */
export function rulesetInsideCorpse(
  state: RulesetEncounterState,
  combatant: RulesetCombatant,
): { costs: number; prone?: true } | undefined {
  if (!combatant.insideOf || !combatant.insideCorpse) return undefined;
  const holder = rulesetCombatant(state, combatant.insideOf);
  return holder && rulesetCombatStanding(holder) ? undefined : combatant.insideCorpse;
}

export function rulesetCombatStanding(combatant: RulesetCombatant): boolean {
  return !combatant.defeated && !combatant.down;
}

/** Below its most health (1.393): Colossus Slayer's "below its hit point maximum", Blood Frenzy's
 *  "doesn't have all its hit points". */
export function rulesetCombatHurt(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  combatant: RulesetCombatant,
): boolean {
  const health = rulesetCombatHealth(definition, combat, combatant);
  return health.value < health.max;
}

/** Whether an ally of `actor` who can act stands beside `target` (1.393): Pack Tactics. Without a
 *  board there is no distance to read, so any ally still on their feet is beside them. */
export function rulesetAllyBeside(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  state: RulesetEncounterState | undefined,
  actor: RulesetCombatant,
  target: RulesetCombatant,
): boolean {
  if (!state) return false;
  const positioned = !!state.board?.grid && !!rulesetPositionOf(target);
  return state.combatants.some((combatant) => {
    if (combatant.id === actor.id || combatant.id === target.id || combatant.side !== actor.side) return false;
    if (!rulesetCombatStanding(combatant)) return false;
    if (rulesetCombatEffects(definition, combat, combatant, state).has("cannot-act")) return false;
    if (!positioned) return true;
    return !!rulesetPositionOf(combatant) && rulesetGap(combatant, target) <= 1;
  });
}

/** Who a symbol spend lands on (1.382): the attacker, their target, or the next of either side to
 *  take a turn after the one now, standing and neither of the two. Nobody when that side has nobody
 *  else. */
export function rulesetSymbolSpendHolder(
  state: RulesetEncounterState,
  actor: RulesetCombatant,
  target: RulesetCombatant,
  on: RulesetSymbolSpend["by"] | "attacker-ally" | "target-ally",
): RulesetCombatant | undefined {
  if (on === "attacker") return actor;
  if (on === "target") return target;
  const [of, but] = on === "attacker-ally" ? [actor, target] : [target, actor];
  const order = state.order;
  for (let step = 1; step <= order.length; step++) {
    const one = rulesetCombatant(state, order[(state.turn + step) % order.length]!);
    if (one && one.side === of.side && one.id !== of.id && one.id !== but.id && rulesetCombatStanding(one)) return one;
  }
  return undefined;
}

/** What one attack's symbol spends can do (1.382), kept as they are bought: everybody a spend names
 *  must be there and standing; a condition goes on once per holder and kind on a throw, and not at
 *  all where it is kept off, sealed apart from whoever puts it on, or one of a kind already held; a
 *  track moves only as many whole steps as it has room for that way, room the throw's earlier spends
 *  have used. The fight and its forecast both buy against one of these per throw, so the AI never
 *  prices what the Engine leaves unbought, and no symbol is spent on something that does not land. */
export function rulesetSymbolSpendBudget(
  definition: RulesetDefinition,
  state: RulesetEncounterState,
  actor: RulesetCombatant,
  target: RulesetCombatant,
): RulesetSymbolSpendBudget {
  const conditions = definition.combat?.conditions;
  const kindOf = (condition: string) => {
    const group = conditions?.find((one) => one.condition === condition)?.oneAtATime;
    return group === undefined ? { key: `condition:${condition}`, group } : { key: `kind:${group}`, group };
  };
  const putOn = new Set<string>();
  const tracks = new Map<string, { value: number; min: number; top: number }>();
  const trackOf = (holder: RulesetCombatant, id: string) => {
    const key = `${holder.id}|${id}`;
    const known = tracks.get(key);
    if (known) return known;
    const declared = definition.sheet.live.tracks.find((entry) => entry.id === id)!;
    const live = holder.sheet
      ? readRulesetLive(definition, holder.sheet.build, holder.sheet.live).tracks.find((entry) => entry.id === id)
      : undefined;
    const made = {
      value: live ? live.value : (holder.tracks?.[id] ?? declared.default ?? declared.min),
      min: declared.min,
      top: live ? live.max : typeof declared.max === "number" ? declared.max : 1000,
    };
    tracks.set(key, made);
    return made;
  };
  const copies = (spend: RulesetSymbolSpend): number => {
    for (const on of [spend.condition?.on, spend.track?.on, spend.boost?.on, spend.setback?.on]) {
      if (on === undefined) continue;
      const holder = rulesetSymbolSpendHolder(state, actor, target, on);
      if (!holder || holder.defeated) return 0;
    }
    let times = spend.max;
    if (spend.condition) {
      const holder = rulesetSymbolSpendHolder(state, actor, target, spend.condition.on)!;
      const putter = spend.by === "attacker" ? actor : target;
      const condition = spend.condition.id;
      const kind = kindOf(condition);
      if (putOn.has(`${holder.id}|${kind.key}`)) return 0;
      if (rulesetImmuneToCondition(holder, condition, definition, state, putter)) return 0;
      if (rulesetSealedApart(definition, state, putter, holder)) return 0;
      const held = holder.tracked.some(
        (entry) => conditions?.find((one) => one.condition === entry.condition)?.oneAtATime === kind.group,
      );
      if (kind.group !== undefined && held) return 0;
      times = Math.min(times, 1);
    }
    if (spend.track) {
      const holder = rulesetSymbolSpendHolder(state, actor, target, spend.track.on)!;
      const declared = definition.sheet.live.tracks.find((entry) => entry.id === spend.track!.id);
      if (!declared || declared.kinds) return 0;
      const by = spend.track.by;
      if (by > 0 && rulesetImmuneToCondition(holder, declared.id, definition)) return 0;
      const track = trackOf(holder, declared.id);
      const space = by > 0 ? track.top - track.value : track.value - track.min;
      // Whole steps only: a last step the track has no full room for is not bought.
      times = Math.min(times, Math.max(0, Math.floor(space / Math.abs(by))));
    }
    return times;
  };
  return {
    copies,
    take(spend, times) {
      if (times <= 0) return;
      if (spend.condition) {
        const holder = rulesetSymbolSpendHolder(state, actor, target, spend.condition.on);
        if (holder) putOn.add(`${holder.id}|${kindOf(spend.condition.id).key}`);
      }
      if (spend.track) {
        const holder = rulesetSymbolSpendHolder(state, actor, target, spend.track.on);
        if (holder) {
          const track = trackOf(holder, spend.track.id);
          track.value = Math.min(track.top, Math.max(track.min, track.value + spend.track.by * times));
        }
      }
    },
  };
}

/** Where a held symbol throw (1.382) stands for the side `by` choosing its own spends: what it has
 *  chosen so far, what it may still buy one more of, and the Engine's own pick for what it has not
 *  spent. Read from the fight as it stands, the attacker's spends bought first, exactly as the throw
 *  will be spent once the window closes. */
export function rulesetSymbolSpendStanding(
  definition: RulesetDefinition,
  state: RulesetEncounterState,
  held: RulesetHeldAttack,
  rollerId: string,
  by: RulesetSymbolSpend["by"],
  hit: boolean,
): { chosen: RulesetSymbolSpendPick[]; choices: RulesetSymbolSpend[]; engine: RulesetSymbolSpendPick[] } | undefined {
  const combat = definition.combat;
  const symbols = held.roll.symbols;
  const actor = rulesetCombatant(state, rollerId);
  const target = rulesetCombatant(state, held.targetId);
  if (!combat || !symbols || !actor || !target) return undefined;
  const budget = rulesetSymbolSpendBudget(definition, state, actor, target);
  const spends = held.roll.spends ?? {};
  if (by === "target") {
    if (spends.attacker) rulesetChosenSymbolSpends(combat, symbols, hit, "attacker", spends.attacker, budget);
    else pickRulesetSymbolSpends(combat, symbols, hit, "attacker", budget);
  }
  const chosen = rulesetChosenSymbolSpends(combat, symbols, hit, by, spends[by] ?? [], budget);
  const choices = rulesetSymbolSpendChoices(combat, symbols, hit, by, chosen, budget);
  // The Engine buys the rest as it would have bought all of it, under each spend's `max` less what
  // was already chosen of it.
  const times = (spend: RulesetSymbolSpend) => chosen.find((pick) => pick.spend === spend)?.times ?? 0;
  const engine = pickRulesetSymbolSpends(combat, rulesetSymbolsLeft(symbols, chosen), hit, by, {
    copies: (spend) => Math.min(budget.copies(spend), spend.max - times(spend)),
    take: (spend, count) => budget.take(spend, count),
  });
  return { chosen, choices, engine };
}

// ── Building what a combatant can do ──

const ABILITY_COLUMN_MISS = 0;

/**
 * What `resolution.adjust` adds to one roll a fight makes, as it adds to a check: every entry meant for
 * all rolls, and every one limited to an ability the roll is made with. `rolled` is that roll, a check
 * target or the value reference its number is. A reference to an ability's modifier or score, a
 * skill's or a save's is a roll made with that ability; any other takes only the entries for all rolls.
 */
function fightAdjust(
  definition: RulesetDefinition,
  build: RulesetSheetBuild,
  evaluated: EvaluatedRulesetSheet,
  rolled: RulesetCheckTarget | RulesetValueRef | null | undefined,
): number {
  if (!definition.resolution.adjust?.length) return 0;
  const target = rolled && "type" in rolled ? rolled : refTarget(definition, build, rolled);
  return rulesetCheckAdjust(definition, build, evaluated, target);
}

/** The roll a value reference stands for, where it stands for one. */
function refTarget(
  definition: RulesetDefinition,
  build: RulesetSheetBuild,
  ref: RulesetValueRef | null | undefined,
): RulesetCheckTarget | null {
  if (!ref) return null;
  const field = ref.abilityModFromField !== undefined ? build.fields?.[ref.abilityModFromField] : undefined;
  const abilityId = ref.abilityMod ?? ref.abilityScore ?? (typeof field === "string" ? field : undefined);
  if (abilityId !== undefined) {
    const ability = definition.sheet.abilities.find((entry) => entry.id === abilityId);
    return ability ? { type: "ability", id: ability.id, label: ability.label } : null;
  }
  const trained = ref.skillMod
    ? { type: "skill" as const, entry: definition.sheet.skills.find((skill) => skill.id === ref.skillMod) }
    : ref.saveMod
      ? { type: "save" as const, entry: definition.sheet.saves.find((save) => save.id === ref.saveMod) }
      : null;
  if (!trained?.entry) return null;
  const { entry } = trained;
  return { type: trained.type, id: entry.id, label: entry.label, ...(entry.ability ? { ability: entry.ability } : {}) };
}

function columnValue(row: Record<string, unknown>, column: string | undefined): unknown {
  if (column === undefined) return undefined;
  return Object.prototype.hasOwnProperty.call(row, column) ? row[column] : undefined;
}

/** An ability modifier named by one cell of the row. A value that is not an ability id adds
 *  nothing, exactly as `abilityModFromField` reads one. */
function abilityFromColumn(evaluated: EvaluatedRulesetSheet, row: Record<string, unknown>, column?: string): number {
  const value = columnValue(row, column);
  return typeof value === "string" ? (evaluated.abilityMods[value] ?? ABILITY_COLUMN_MISS) : ABILITY_COLUMN_MISS;
}

function numberFromColumn(row: Record<string, unknown>, column?: string): number {
  const value = columnValue(row, column);
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function textFromColumn(row: Record<string, unknown>, column?: string): string | undefined {
  const value = columnValue(row, column);
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/**
 * One distance of an attack row, in cells: the number in its own column, or the same number on
 * every row. Read only when the fight has a cell size to measure it in.
 *
 * Zero is "this row does not carry that distance", which is what a number column on a sheet reads
 * as when the player left it alone: a sword is not thrown because its range column says 0, and a
 * weapon with no long distance has 0 in that column rather than a second row.
 */
function distanceInCells(
  source: RulesetCombatDistanceSource | undefined,
  row: Record<string, unknown>,
  perCell: number | undefined,
): number | undefined {
  if (!source || perCell === undefined) return undefined;
  const value = "const" in source ? source.const : columnValue(row, source.column);
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return undefined;
  return rulesetInCells(value, perCell);
}

/** What a row adds to hit from its ability and skill columns. A skill adds what a check of that skill
 *  adds, with the row's own ability in place of the skill's when it names one, exactly as a check's
 *  `with=` swaps it; without a skill, the ability alone. A value that names neither adds nothing. */
function rowAbilityAndSkill(
  definition: RulesetDefinition,
  build: RulesetSheetBuild,
  source: RulesetCombatAttackSource,
  row: Record<string, unknown>,
  evaluated: EvaluatedRulesetSheet,
): number {
  return abilityAndSkill(
    definition,
    build,
    evaluated,
    columnValue(row, source.toHit.skill?.column),
    columnValue(row, source.toHit.ability?.column),
  );
}

/** What the sheet adds to hit on this row (1.800): its `sheetBonus`, where the row's `when` column
 *  holds the value it names. Archery's +2 on a bow, and nothing on a thrown dagger. */
function rowSheetBonus(
  definition: RulesetDefinition,
  build: RulesetSheetBuild,
  evaluated: EvaluatedRulesetSheet,
  source: RulesetCombatAttackSource,
  row: Record<string, unknown>,
): number {
  const bonus = source.toHit.sheetBonus;
  if (!bonus || (bonus.when && columnValue(row, bonus.when.column) !== bonus.when.equals)) return 0;
  const value = Math.trunc(resolveRulesetValueRef(definition, build, bonus.value, evaluated));
  return Number.isFinite(value) ? value : 0;
}

/** One attack row with a choice of abilities (1.793) in its ability columns read as the one of them
 *  that adds the most to hit, with the row's skill: a finesse blade swung with the better of
 *  Strength and Dexterity, for its damage too. Any other row is returned as it is. */
function rowAbilityChosen(
  definition: RulesetDefinition,
  build: RulesetSheetBuild,
  evaluated: EvaluatedRulesetSheet,
  source: RulesetCombatAttackSource,
  row: Record<string, unknown>,
): Record<string, unknown> {
  const choices = source.abilityChoices;
  if (!choices) return row;
  const columns = [source.toHit.ability?.column, source.damage.ability?.column].filter((column): column is string => {
    const value = columnValue(row, column);
    return typeof value === "string" && Object.prototype.hasOwnProperty.call(choices, value);
  });
  if (!columns.length) return row;
  const skill = columnValue(row, source.toHit.skill?.column);
  const chosen = new Map<string, string>();
  for (const column of columns) {
    const value = row[column] as string;
    if (chosen.has(value)) continue;
    const best = choices[value]!.reduce((best, one) =>
      abilityAndSkill(definition, build, evaluated, skill, one) >
      abilityAndSkill(definition, build, evaluated, skill, best)
        ? one
        : best,
    );
    chosen.set(value, best);
  }
  return { ...row, ...Object.fromEntries(columns.map((column) => [column, chosen.get(row[column] as string)!])) };
}

/** What an attack adds to hit from one skill and one ability, each an id or anything else, which
 *  names nothing: see `rowAbilityAndSkill`. */
/** In a `symbol-pool` fight (1.382) a to-hit number off a sheet is an ability and a skill's ranks
 *  together. The larger of the two is the dice and the smaller how many of them are upgraded, as the
 *  ruleset's own checks build a pool; an action that names no ability keeps its number as plain dice. */
function splitSymbolDice(
  definition: RulesetDefinition,
  evaluated: EvaluatedRulesetSheet,
  actions: RulesetCombatAction[],
): void {
  const resolution = definition.resolution;
  if (definition.combat?.kind !== "symbol-pool" || resolution.kind !== "symbol-pool") return;
  if (resolution.pool.build === "sum" || !resolution.pool.upgrade) return;
  for (const action of actions) {
    if (action.toHit === undefined || action.upgrades !== undefined || !action.ability) continue;
    const ability = evaluated.abilityMods[action.ability];
    if (ability === undefined || !Number.isFinite(ability)) continue;
    const rest = action.toHit - ability;
    action.toHit = Math.max(ability, rest);
    action.upgrades = Math.max(0, Math.min(ability, rest));
  }
}

function abilityAndSkill(
  definition: RulesetDefinition,
  build: RulesetSheetBuild,
  evaluated: EvaluatedRulesetSheet,
  skillId: unknown,
  ability: unknown,
): number {
  const skill = typeof skillId === "string" ? definition.sheet.skills.find((entry) => entry.id === skillId) : undefined;
  if (!skill) {
    const named =
      typeof ability === "string" ? definition.sheet.abilities.find((entry) => entry.id === ability) : undefined;
    return (
      (named ? (evaluated.abilityMods[named.id] ?? ABILITY_COLUMN_MISS) : ABILITY_COLUMN_MISS) +
      fightAdjust(definition, build, evaluated, named ? { type: "ability", id: named.id, label: named.label } : null)
    );
  }
  const withAbility =
    typeof ability === "string" && ability in evaluated.abilityMods && ability !== skill.ability ? ability : undefined;
  const target: RulesetCheckTarget = {
    type: "skill",
    id: skill.id,
    label: skill.label,
    ...(skill.ability ? { ability: skill.ability } : {}),
    ...(withAbility ? { withAbility } : {}),
  };
  return rulesetCheckModifier(evaluated, target) + fightAdjust(definition, build, evaluated, target);
}

/** What the entries a sheet holds do to its attack rows (1.242). */
type RulesetAttackRowRule = NonNullable<RulesetCatalogMechanics["attackRows"]>[number];

/** Whether an attack is one of these, by the name its row gives it (1.242). */
export function rulesetAttackNamed(label: string, names: readonly string[]): boolean {
  const own = label.trim().toLowerCase();
  return names.some((name) => name.trim().toLowerCase() === own);
}

/** Whether a held weapon, its attack going by `label`, is one of these (1.244): by that name, or by
 *  every one of `tags` and none of `notTags`. */
export function rulesetItemMatches(
  item: { tags?: readonly string[] },
  label: string,
  match: { names?: readonly string[]; tags?: readonly string[]; notTags?: readonly string[] },
): boolean {
  if (match.names && rulesetAttackNamed(label, match.names)) return true;
  if (!match.tags && !match.notTags) return false;
  const tags = item.tags ?? [];
  return (
    (match.tags ?? []).every((tag) => tags.includes(tag)) && !(match.notTags ?? []).some((tag) => tags.includes(tag))
  );
}

/** What a held item's attack goes by: the stack's own name, else its category's. */
function itemAttackLabel(definition: RulesetDefinition, held: RulesetSheetItem): string {
  return (
    held.name ??
    definition.items?.categories.find((category) => category.id === held.item.category)?.label ??
    held.item.category
  );
}

/** Whether a sheet's bounds and weapons let a held entry's rule hold (1.242, 1.244): its `when` on the
 *  sheet, and every weapon held being one of `wielding.only`, or none held at all. */
function rulesetHeldRuleHolds(
  definition: RulesetDefinition,
  build: RulesetSheetBuild,
  evaluated: EvaluatedRulesetSheet,
  items: readonly RulesetSheetItem[] | undefined,
  rule: {
    when?: { value: RulesetValueRef; atLeast?: number; atMost?: number };
    wielding?: { only: { names?: string[]; tags?: string[]; notTags?: string[] } };
  },
): boolean {
  if (rule.when) {
    const value = resolveRulesetValueRef(definition, build, rule.when.value, evaluated);
    if (rule.when.atLeast !== undefined && !(value >= rule.when.atLeast)) return false;
    if (rule.when.atMost !== undefined && !(value <= rule.when.atMost)) return false;
  }
  const only = rule.wielding?.only;
  return (
    !only ||
    (items ?? []).every(
      (held) =>
        !held.worn || !held.item.attack || rulesetItemMatches(held.item, itemAttackLabel(definition, held), only),
    )
  );
}

/**
 * One attack row as the entries its sheet holds change it (1.242), while each one's `when` holds:
 * the best of its own ability and theirs, to hit and, where the row's damage adds the same ability,
 * to damage; their die in place of the row's dice where it is the better; and their qualities.
 */
function applyAttackRowRules(
  definition: RulesetDefinition,
  build: RulesetSheetBuild,
  evaluated: EvaluatedRulesetSheet,
  dice: RulesetCombatAmount,
  action: RulesetCombatAction,
  rules: readonly RulesetAttackRowRule[],
  pooled: boolean,
  /** Whether the blow's damage adds the ability it is made with. */
  dealtWith: (ability: string | undefined) => boolean,
  /** A held weapon's own item, which `items` reads (1.244). */
  item?: RulesetCatalogItem,
): void {
  for (const rule of rules) {
    const named = rule.names !== undefined && rulesetAttackNamed(action.label, rule.names);
    if (!named && !(item && rule.items && rulesetItemMatches(item, action.label, rule.items))) continue;
    const damage = action.damage!;
    if (rule.abilities) {
      const mod = (ability: string | undefined) =>
        ability !== undefined ? (evaluated.abilityMods[ability] ?? ABILITY_COLUMN_MISS) : ABILITY_COLUMN_MISS;
      const best = rule.abilities
        .filter((ability) => ability in evaluated.abilityMods)
        .reduce<string | undefined>(
          (top, ability) => (top === undefined || mod(ability) > mod(top) ? ability : top),
          undefined,
        );
      const delta = best !== undefined ? mod(best) - mod(action.ability) : 0;
      if (best !== undefined && delta > 0) {
        action.toHit = (action.toHit ?? 0) + delta;
        if (dealtWith(action.ability)) {
          if (pooled) damage.count = Math.max(0, damage.count + delta);
          else damage.flat += delta;
        }
        action.ability = best;
      }
    }
    if (rule.die && !pooled) {
      const sides = Math.trunc(
        lookupStepTable(rule.die.table, resolveRulesetValueRef(definition, build, rule.die.from, evaluated)),
      );
      const own = rulesetAverageDamage({ count: dice.count, sides: dice.sides, flat: dice.flat });
      if (sides >= 2 && (sides + 1) / 2 > own) {
        damage.flat -= dice.flat;
        damage.count = 1;
        damage.sides = sides;
        dice = { count: 1, sides, flat: 0 };
      }
    }
    if (rule.qualities) damage.qualities = [...new Set([...(damage.qualities ?? []), ...rule.qualities])];
  }
}

function attackActions(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  source: RulesetCombatAttackSource,
  index: number,
  build: RulesetSheetBuild,
  evaluated: EvaluatedRulesetSheet,
  perCell: number | undefined,
  /** What the entries the sheet holds do to its rows (1.242). */
  rules: readonly RulesetAttackRowRule[] = [],
): RulesetCombatAction[] {
  const own = build.lists?.[source.list];
  // The rows every sheet has (1.244), after its own and only where it has none of the same name.
  const ownNames = new Set(
    (Array.isArray(own) ? own : []).flatMap((row) => {
      const name = row && typeof row === "object" ? textFromColumn(row as Record<string, unknown>, source.name) : "";
      return name ? [name.trim().toLowerCase()] : [];
    }),
  );
  const always = (source.always ?? []).filter((row) => {
    const name = textFromColumn(row, source.name);
    return !!name && !ownNames.has(name.trim().toLowerCase());
  });
  const rows = [...(Array.isArray(own) ? own : []), ...always];
  if (!rows.length) return [];
  // How many strikes one spend of this list's budget buys, read off the sheet once. A number below
  // one is the one strike every spend has always bought, so a sheet left alone changes nothing.
  const strikes = source.strikes
    ? Math.max(1, Math.trunc(resolveRulesetValueRef(definition, build, source.strikes, evaluated)))
    : undefined;
  const actions: RulesetCombatAction[] = [];
  rows.forEach((raw, rowIndex) => {
    if (!raw || typeof raw !== "object") return;
    const row = rowAbilityChosen(definition, build, evaluated, source, raw as Record<string, unknown>);
    const name = textFromColumn(row, source.name);
    const parsed = parseRulesetCombatDice(columnValue(row, source.damage.dice.column));
    // A pool fight counts a damage column's dice, of its own die, and an ability's rating on top: a
    // row with none of its own still has what its hits add past the successes they needed.
    const pooled = rulesetCombatIsPool(combat);
    const dice = pooled ? (parsed ?? { count: 0, sides: rulesetPoolDie(definition), flat: 0 }) : parsed;
    if (!name || !dice) return;
    const proficient = columnValue(row, source.toHit.proficiency?.column) === true;
    const namedAbility = columnValue(row, source.toHit.ability?.column);
    const ability =
      typeof namedAbility === "string" && namedAbility in evaluated.abilityMods
        ? namedAbility
        : definition.sheet.skills.find((entry) => entry.id === columnValue(row, source.toHit.skill?.column))?.ability;
    const reach = distanceInCells(source.reach, row, perCell);
    const normal = distanceInCells(source.range?.normal, row, perCell);
    const long = distanceInCells(source.range?.long, row, perCell);
    const action: RulesetCombatAction = {
      id: `attack:${index}:${rowIndex}`,
      ...(ability ? { ability } : {}),
      kind: "attack",
      label: name,
      budget: source.budget,
      targets: { side: "enemy", count: 1 },
      // A row its own column holds to one strike keeps none in hand: a crossbow is one shot a turn
      // however many attacks its wielder has. Said per ROW, because the count is the list's.
      ...(strikes !== undefined && columnValue(row, source.strikesCappedBy?.column) !== true ? { strikes } : {}),
      ...(reach !== undefined ? { reach } : {}),
      // A row whose long distance came out shorter than its ordinary one is the player's row, not
      // the ruleset's rule, so it is read as having nothing beyond the ordinary one.
      ...(normal !== undefined ? { range: { normal, ...(long !== undefined && long > normal ? { long } : {}) } } : {}),
      toHit:
        rowAbilityAndSkill(definition, build, source, row, evaluated) +
        (proficient ? evaluated.proficiencyBonus : 0) +
        numberFromColumn(row, source.toHit.bonus?.column) +
        rowSheetBonus(definition, build, evaluated, source, row),
      damage: pooled
        ? {
            // Dice of the ruleset's own die: the column's count and the ability's rating. What is
            // added flat is automatic successes, never thrown.
            count: Math.max(0, dice.count + abilityFromColumn(evaluated, row, source.damage.ability?.column)),
            sides: rulesetPoolDie(definition),
            flat: Math.max(0, dice.flat + numberFromColumn(row, source.damage.bonus?.column)),
            ...(textFromColumn(row, source.damage.type?.column)
              ? { type: textFromColumn(row, source.damage.type?.column) }
              : {}),
          }
        : {
            count: dice.count,
            sides: dice.sides,
            flat:
              dice.flat +
              abilityFromColumn(evaluated, row, source.damage.ability?.column) +
              numberFromColumn(row, source.damage.bonus?.column),
            ...(textFromColumn(row, source.damage.type?.column)
              ? { type: textFromColumn(row, source.damage.type?.column) }
              : {}),
          },
    };
    const dealtWith = columnValue(row, source.damage.ability?.column);
    // A row whose ability its ruleset cannot read (a card made on a later version: 5e's "finesse" in a
    // game pinned before it) is read the same to hit and to damage where both read that one column, so
    // a rule's better ability adds to both (laptop playtest 2026-10-24: a monk's shortsword +7, 1d6).
    const unread =
      ability === undefined &&
      dealtWith !== undefined &&
      dealtWith === namedAbility &&
      source.damage.ability?.column === source.toHit.ability?.column;
    const adds = (ability: string | undefined) =>
      dealtWith === ability ||
      (ability === undefined && ((dealtWith === undefined && !!source.damage.ability) || unread));
    if (action.ability !== undefined && adds(action.ability)) action.damageAddsAbility = true;
    if (rules.length) applyAttackRowRules(definition, build, evaluated, dice, action, rules, pooled, adds);
    actions.push(action);
  });
  return actions;
}

/** One value of an item's attack: written as it is, or read off the item's own stat. A stat the item
 *  gives nothing is as if the value were not written. */
function itemAttackValue(item: RulesetCatalogItem, value: unknown): unknown {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return value;
  const stat = (value as { stat?: unknown }).stat;
  if (typeof stat !== "string" || !item.stats || !Object.prototype.hasOwnProperty.call(item.stats, stat)) {
    return undefined;
  }
  return item.stats[stat];
}

/** The abilities an attack value names: a list of them, or the one an enum stat holds. */
function attackAbilities(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((entry): entry is string => typeof entry === "string");
  return typeof value === "string" ? [value] : [];
}

/** What an item adds to hit, read the way an attack row's is: the best of its abilities (with its
 *  skill, the ability swapped in), the proficiency bonus where its `proficiency` reads above 0 off the
 *  holder's sheet, its bonus, and in a pool fight its own per-die target. */
function itemToHit(
  definition: RulesetDefinition,
  build: RulesetSheetBuild,
  evaluated: EvaluatedRulesetSheet,
  item: RulesetCatalogItem,
  toHit: NonNullable<RulesetItemUse["toHit"]>,
  pooled: boolean,
): { toHit: number; target?: number; ability?: string } {
  const read = (value: unknown) => itemAttackValue(item, value);
  const number = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : 0);
  const skill = read(toHit.skill);
  const hitWith = attackAbilities(read(toHit.abilities));
  const ability = hitWith.length
    ? hitWith.reduce((best, one) =>
        abilityAndSkill(definition, build, evaluated, skill, one) >
        abilityAndSkill(definition, build, evaluated, skill, best)
          ? one
          : best,
      )
    : definition.sheet.skills.find((entry) => entry.id === skill)?.ability;
  const base = abilityAndSkill(definition, build, evaluated, skill, ability);
  const proficient =
    toHit.proficiency !== undefined && resolveRulesetValueRef(definition, build, toHit.proficiency, evaluated) > 0;
  const target = read(toHit.target);
  // What the holder brings to it off their own sheet (Capability API 1.95: an archer's +2 to ranged).
  const fromSheet =
    toHit.sheetBonus !== undefined
      ? Math.trunc(resolveRulesetValueRef(definition, build, toHit.sheetBonus, evaluated))
      : 0;
  return {
    ...(ability ? { ability } : {}),
    toHit:
      base +
      (proficient ? evaluated.proficiencyBonus : 0) +
      number(read(toHit.bonus)) +
      (Number.isFinite(fromSheet) ? fromSheet : 0),
    ...(pooled && typeof target === "number" && Number.isFinite(target) ? { target } : {}),
  };
}

/**
 * The items a fighter may use, as actions: each held item with a `use`, from the bag, or worn where it
 * takes a slot or binds. What it does is its use's, read as a catalog entry's mechanics are; its own
 * to-hit and save difficulty stand in for a sheet row's; and it spends one off its stack or some of
 * its charges. One whose charges, or whose save's number, read off a stat it does not give is never
 * used.
 */
function itemUseActions(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  items: readonly RulesetSheetItem[] | undefined,
  build: RulesetSheetBuild,
  evaluated: EvaluatedRulesetSheet,
  perCell: number | undefined,
): RulesetCombatAction[] {
  if (!items?.some((held) => held.item.use || held.item.moreUses)) return [];
  const pooled = rulesetCombatIsPool(combat);
  const actions: RulesetCombatAction[] = [];
  items.forEach((held, index) => {
    const { item } = held;
    if (!item.use && !item.moreUses) return;
    // Its first use, then any more it has (1.267), each its own choice paid from the same charges;
    // only the further ones of an item rolled for (1.749).
    if (item.use) useOf(held, index, `use:${index}`, item.use, item.use.label);
    item.moreUses?.forEach((more, n) =>
      useOf(
        held,
        index,
        `use:${index}:${n + 1}`,
        more.use,
        more.label,
        // Its own count, rolled for its stack where it is (1.536), or another's it spends (1.747).
        (() => {
          const at = more.usesOf ? rulesetMoreUsesOf(item, more) : n;
          const counted = at >= 0 ? item.moreUses![at]!.uses : undefined;
          return counted
            ? { more: at + 1, max: rulesetOwnUsesMax(counted, held.stack?.id, at + 1, item.moreUsesRolled) }
            : undefined;
        })(),
      ),
    );
    // Other uses' effects beside one (1.535), by the ids they were built under: Thunder and Lightning.
    item.moreUses?.forEach((more, n) => {
      if (!more.alongside) return;
      const action = actions.find((one) => one.id === `use:${index}:${n + 1}`);
      if (!action) return;
      const ids = more.alongside.flatMap((label) => {
        const wanted = label.trim().toLowerCase();
        if (item.use?.label?.trim().toLowerCase() === wanted) return [`use:${index}`];
        const at = item.moreUses!.findIndex((other) => other.label.trim().toLowerCase() === wanted);
        return at >= 0 ? [`use:${index}:${at + 1}`] : [];
      });
      const built = ids.filter((id) => actions.some((one) => one.id === id));
      if (built.length) action.alongside = built;
    });
    // What its use rolls for (1.559), each row its own action never on a menu: a Wand of Wonder. A row
    // that does nothing a fight can use is only told.
    const roller = item.use?.rollsTable ? actions.find((one) => one.id === `use:${index}`) : undefined;
    if (roller && item.useTable) {
      roller.rollsAmong = item.useTable.map((row, k) => {
        const id = `use:${index}:t${k + 1}`;
        if (row.use) useOf(held, index, id, row.use, row.label);
        const part = actions.find((one) => one.id === id);
        if (part) part.rolledPart = true;
        return { weight: row.weight, label: row.label, ...(part ? { id } : {}) };
      });
    }
  });
  return actions;

  function useOf(
    held: RulesetSheetItem,
    index: number,
    id: string,
    use: NonNullable<RulesetCatalogItem["use"]>,
    named?: string,
    /** Its own count of uses (1.519). */
    ownUses?: { more: number; max: number },
  ): void {
    const { item } = held;
    // Raising an ability for good is for outside a fight (1.516).
    if (use.raises) return;
    const wearable = Object.values(item.slots ?? {}).some((count) => count > 0) || !!item.binds;
    // Drawn as it is used (1.808): only where it could be drawn now (and is bound, where it binds).
    if (wearable && !held.worn && !(held.drawOnUse && rulesetHeldReady(definition, items!, index))) return;
    const read = (value: unknown) => itemAttackValue(item, value);
    const whole = (value: unknown) =>
      typeof value === "number" && Number.isFinite(value) ? Math.trunc(value) : undefined;
    // A stat holds its own range, so what it gives is held to the most a written count may be.
    const counted = item.charges ? whole(read(item.charges.max)) : undefined;
    const max = counted === undefined ? undefined : Math.min(RULESET_ITEM_CHARGES_MAX, counted);
    if (use.charges !== undefined && !(max !== undefined && max >= 1)) return;
    // Nor one its user does not meet what it asks of them (1.667): a scroll off another class's list.
    if (!rulesetItemNeedsMet(definition, build, evaluated, item.userNeeds, item.userNeedsAny)) return;
    const name =
      held.name ??
      definition.items?.categories.find((category) => category.id === item.category)?.label ??
      item.category;
    // Called what the ruleset calls it in place of the item's name (1.378): "Scatter ball bearings".
    const label = use.title ?? (named ? `${name}: ${named}` : name);
    const action = itemUseMechanics(definition, item, use, { id, label }, build, evaluated, perCell, pooled);
    if (!action) return;
    // A fake (1.79) is offered as what it passes for, aimed, timed and spent as that is, so nothing on
    // the menu tells them apart; what it does is what it truly does. One whose true item does nothing a
    // fight can use is spent for nothing.
    const real = held.truly ? fakeUseAction(definition, held.truly.item, build, evaluated, perCell, pooled) : null;
    // A gate read off a stat the item does not give is a check against nothing, as a save's is.
    const gateDifficulty = use.gate ? rulesetItemGateDifficulty(item, use.gate) : undefined;
    if (use.gate && gateDifficulty === undefined) return;
    const gate =
      use.gate && gateDifficulty !== undefined
        ? rulesetItemGateCheck(definition, build, evaluated, use.gate, gateDifficulty)
        : null;
    // What lasts only while the item is worn (1.664) remembers which stack it is.
    const stackId = held.stack?.id;
    const keptBy = (list: RulesetCombatAction["applies"]) =>
      list && stackId ? list.map((one) => (one.whileItemWorn ? { ...one, wornItem: stackId } : one)) : list;
    if (action.applies?.some((one) => one.whileItemWorn)) action.applies = keptBy(action.applies);
    if (action.appliesSelf?.some((one) => one.whileItemWorn)) action.appliesSelf = keptBy(action.appliesSelf);
    action.itemUse = {
      item: index,
      ...(held.truly ? { fake: { name: held.truly.name, ...(real ? { does: real } : { dud: true as const }) } } : {}),
      ...(use.consumes ? { consumes: true as const } : {}),
      // A chance to backfire on its user (1.630): a Horn of Blasting.
      ...(use.backfires && amountOf(use.backfires.amount)
        ? {
            backfires: {
              chance: use.backfires.chance,
              amount: amountOf(use.backfires.amount)!,
              ...(use.backfires.damageType ? { damageType: use.backfires.damageType } : {}),
              ...(use.backfires.destroys ? { destroys: true as const } : {}),
              ...(use.backfires.instead ? { instead: true as const } : {}),
            },
          }
        : {}),
      // A cost for using it again before a rest (1.744): a Ring of X-ray Vision.
      ...(use.againBeforeRest
        ? {
            againBeforeRest: {
              save: { ...use.againBeforeRest.save },
              ...(use.againBeforeRest.tracks ? { tracks: use.againBeforeRest.tracks.map((one) => ({ ...one })) } : {}),
              ...(use.againBeforeRest.conditions ? { conditions: [...use.againBeforeRest.conditions] } : {}),
            },
          }
        : {}),
      ...(ownUses ? { ownUses } : {}),
      ...(use.charges !== undefined && max !== undefined
        ? {
            charges: {
              cost: use.charges,
              max,
              ...(item.charges?.breaksOn ? { breaksOn: lastChargeDie(item.charges.breaksOn) } : {}),
              ...(item.charges?.overuse ? { overuse: { ...item.charges.overuse } } : {}),
              ...(use.chargeStep
                ? {
                    step: {
                      max: use.chargeStep.max,
                      ...(amountOf(use.chargeStep.amount) ? { amount: amountOf(use.chargeStep.amount)! } : {}),
                      ...(use.chargeStep.targets ? { targets: use.chargeStep.targets } : {}),
                      // Farther pushed a charge (1.271), in cells: a Ring of the Ram's.
                      ...(use.chargeStep.push !== undefined && perCell !== undefined
                        ? { push: rulesetInCells(use.chargeStep.push, perCell) }
                        : {}),
                    },
                  }
                : {}),
            },
          }
        : {}),
      ...(gate
        ? {
            gate: {
              check: rulesetItemGateLabel(definition, use.gate!),
              ...(gate.target?.type === "skill" ? { skill: gate.target.id } : {}),
              ...(gateAbility(gate.target) ? { ability: gateAbility(gate.target) } : {}),
              modifier: gate.modifier,
              difficulty: gate.difficulty,
            },
          }
        : {}),
    };
    actions.push(action);
  }
}

/** An item's last-charge die as a fight holds it (1.271): what breaks it, and what it gives back. */
function lastChargeDie(
  breaks: NonNullable<NonNullable<RulesetCatalogItem["charges"]>["breaksOn"]>,
): NonNullable<NonNullable<NonNullable<RulesetCombatAction["itemUse"]>["charges"]>["breaksOn"]> {
  const regained = breaks.regains ? amountOf(breaks.regains.amount) : null;
  return {
    die: breaks.die,
    ...(breaks.atMost !== undefined ? { atMost: breaks.atMost } : {}),
    ...(breaks.regains && regained ? { regains: { atLeast: breaks.regains.atLeast, amount: regained } } : {}),
    ...(breaks.becomes !== undefined ? { becomes: breaks.becomes } : {}),
  };
}

/** A zone's light (1.297), in cells. */
function zoneLightsInCells(
  lights: NonNullable<RulesetCatalogZone["lights"]>,
  perCell: number | undefined,
): NonNullable<NonNullable<RulesetCombatAction["zone"]>["lights"]> {
  const bright = lights.bright > 0 ? rulesetInCells(lights.bright, perCell ?? 1) : 0;
  return {
    bright,
    dim: Math.max(0, rulesetInCells(lights.bright + lights.dim, perCell ?? 1) - bright),
    ...(lights.reveals ? { reveals: true as const } : {}),
    ...(lights.sunlight ? { sunlight: true as const } : {}),
    ...(lights.shade ? { shade: true as const } : {}),
  };
}

/** A zone as a fight holds it (1.172), in cells: a catalog entry's, an item use's, or a creature
 *  action's (1.324). */
export function rulesetZoneAction(
  zone: RulesetCatalogZone,
  perCell: number | undefined,
): NonNullable<RulesetCombatAction["zone"]> {
  const out: NonNullable<RulesetCombatAction["zone"]> = {
    ...(zone.art ? { art: zone.art } : {}),
    rounds: zone.rounds,
    ...(zone.untilLair ? { untilLair: true as const } : {}),
    ...(zone.outlasts ? { outlasts: true as const } : {}),
    ...(zone.endsWithCaller ? { endsWithCaller: zone.endsWithCaller } : {}),
    anchor: zone.anchor ?? "point",
    ...(zone.carried ? { carried: zone.carried } : {}),
    triggers: [...zone.triggers],
    atCast: zone.atCast !== false,
  };
  const { move, drift, terrain } = zone;
  if (move) {
    out.move = {
      budget: move.budget,
      distance: rulesetInCells(move.distance, perCell ?? 1),
      ...(move.ram ? { ram: true } : {}),
      // Moved on a check by anybody near (1.694).
      ...(move.check
        ? {
            check: {
              check: move.check.check,
              difficulty: move.check.difficulty,
              within: rulesetInCells(move.check.within, perCell ?? 1),
              perCell: perCell ?? 1,
              ...(move.check.distanceBy ? { distanceBy: { ...move.check.distanceBy } } : {}),
              ...(move.check.failsToward !== undefined
                ? { failsToward: rulesetInCells(move.check.failsToward, perCell ?? 1) }
                : {}),
              // What holding a talisman does (1.703).
              ...(move.check.holding ? { holding: structuredClone(move.check.holding) } : {}),
            },
          }
        : {}),
    };
  }
  if (drift) out.drift = rulesetInCells(drift.distance, perCell ?? 1);
  if (zone.turn) out.turn = { budget: zone.turn.budget };
  // Closed by its caster, and widening as it lasts (1.637): an Eversmoking Bottle.
  if (zone.close) out.close = { ...zone.close };
  if (zone.spreads) {
    out.spreads = {
      by: rulesetInCells(zone.spreads.by, perCell ?? 1),
      every: zone.spreads.every,
      upTo: rulesetInCells(zone.spreads.upTo, perCell ?? 1),
    };
  }
  if (terrain?.towardCaster) out.towardCaster = true;
  const { detonates, burns } = zone;
  if (detonates) {
    // What goes off later does nothing as it appears.
    out.atCast = false;
    const grows = amountOf(detonates.grows);
    out.detonates = {
      ...(grows ? { grows } : {}),
      ...(detonates.touched ? { touched: true } : {}),
      // Set off by somebody entering it, and reaching farther than its cells (1.451): a glyph.
      ...(detonates.entered ? { entered: true as const } : {}),
      ...(detonates.by ? { by: structuredClone(detonates.by) } : {}),
      ...(detonates.within !== undefined ? { within: rulesetInCells(detonates.within, perCell ?? 1) } : {}),
      // An entry of its caster's own stored in it (1.454): a spell glyph.
      ...(detonates.stores ? { stores: true as const } : {}),
      // What it stays as once set off (1.453): Symbol's sphere.
      ...(detonates.becomes
        ? {
            becomes: {
              size: rulesetInCells(detonates.becomes.size, perCell ?? 1),
              rounds: detonates.becomes.rounds,
              triggers: [...detonates.becomes.triggers],
              ...(detonates.becomes.lights ? { lights: zoneLightsInCells(detonates.becomes.lights, perCell) } : {}),
            },
          }
        : {}),
    };
  }
  if (burns) {
    const amount = amountOf(burns.amount);
    out.burns = {
      by: [...burns.by],
      ...(amount ? { amount } : {}),
      ...(burns.damageType ? { damageType: burns.damageType } : {}),
    };
  }
  if (terrain?.difficult) out.difficult = true;
  if (terrain?.costTimes !== undefined) out.costTimes = terrain.costTimes;
  if (terrain?.halvesSpeed) out.halvesSpeed = true;
  if (terrain?.slippery) out.slippery = true;
  if (terrain?.spareSlowWalkers) out.spareSlowWalkers = true;
  if (terrain?.endsWalk) out.endsWalk = true;
  if (zone.breaksConcentration) out.breaksConcentration = true;
  if (zone.enterOnlyByMoving) out.enterOnlyByMoving = true;
  if (zone.damageCap !== undefined) out.damageCap = zone.damageCap;
  if (zone.damageType) out.damageType = zone.damageType;
  const sections = zone.sections;
  if (sections) {
    const broken = sections.broken;
    const brokenAmount = broken ? amountOf(broken.amount) : undefined;
    out.sections = {
      every: Math.max(1, rulesetInCells(sections.every, perCell ?? 1)),
      health: sections.health,
      defense: sections.defense,
      ...(sections.vulnerable ? { vulnerable: [...sections.vulnerable] } : {}),
      ...(sections.resist ? { resist: [...sections.resist] } : {}),
      ...(sections.immune ? { immune: [...sections.immune] } : {}),
      ...(broken && brokenAmount
        ? {
            broken: {
              triggers: [...broken.triggers],
              amount: brokenAmount,
              ...(broken.damageType ? { damageType: broken.damageType } : {}),
              ...(broken.save ? { save: broken.save } : {}),
              ...(broken.onSave ? { onSave: broken.onSave } : {}),
              ...(broken.perCostStep && amountOf(broken.perCostStep)
                ? { perCostStep: amountOf(broken.perCostStep)! }
                : {}),
            },
          }
        : {}),
    };
  }
  const blocks = zone.blocks;
  if (blocks?.length) {
    out.blocks = {
      ...(blocks.includes("move") ? { move: true } : {}),
      ...(blocks.includes("sight") ? { sight: true } : {}),
      ...(blocks.includes("spells") ? { spells: true } : {}),
      ...(blocks.includes("ranged") ? { ranged: true } : {}),
    };
  }
  if (zone.material) out.material = { ...zone.material };
  if (zone.cover) out.cover = zone.cover;
  if (zone.turnsShots) out.turnsShots = zone.turnsShots.spares ? { spares: [...zone.turnsShots.spares] } : {};
  // Its stages (1.557), their amounts in the fight's own.
  if (zone.stages) {
    out.stages = zone.stages.map((stage) => {
      const amount = stage.amount ? amountOf(stage.amount) : null;
      return {
        from: stage.from,
        label: stage.label,
        ...(amount ? { amount } : {}),
        ...(stage.damageType ? { damageType: stage.damageType } : {}),
        ...(stage.save ? { save: stage.save } : {}),
        ...(stage.onSave ? { onSave: stage.onSave } : {}),
        ...(stage.count ? { count: stage.count } : {}),
        ...(stage.difficult ? { difficult: true as const } : {}),
        ...(stage.obscures ? { obscures: true as const } : {}),
        ...(stage.noRanged ? { noRanged: true as const } : {}),
        ...(stage.breaksConcentration ? { breaksConcentration: true as const } : {}),
        ...(stage.disperses ? { disperses: true as const } : {}),
      };
    });
  }
  const side = zone.side;
  if (side) {
    out.side = { distance: rulesetInCells(side.distance, perCell ?? 1), triggers: [...side.triggers] };
  }
  if (zone.obscures) {
    out.obscures = {
      pierced: [...(zone.obscures.pierced ?? [])],
      ...(zone.obscures.light ? { light: true as const } : {}),
      ...(zone.obscures.dispersed ? { dispersed: rulesetCopyDispersed(zone.obscures.dispersed) } : {}),
      ...(zone.obscures.darkness ? { darkness: true as const } : {}),
      ...(zone.obscures.notForCaster ? { notForCaster: true as const } : {}),
    };
  }
  // The light it sheds (1.297), in cells; and the magical darkness it ends.
  if (zone.lights) out.lights = zoneLightsInCells(zone.lights, perCell);
  const dispels = zone.dispelsDark;
  if (dispels) {
    out.dispelsDark = {
      upTo: dispels.upTo,
      ...(dispels.within !== undefined ? { within: rulesetInCells(dispels.within, perCell ?? 1) } : {}),
    };
  }
  if (zone.dispelsLight) out.dispelsLight = { upTo: zone.dispelsLight.upTo };
  if (zone.disperses) out.disperses = true;
  if (zone.sealsAir) out.sealsAir = true;
  const inside = zone.inside;
  if (inside) {
    out.inside = {
      ...(inside.conditions ? { conditions: [...inside.conditions] } : {}),
      ...(inside.immune ? { immune: [...inside.immune] } : {}),
      // Whom it works on, and the save that shrugs it off (1.460).
      ...(inside.is ? { is: structuredClone(inside.is) } : {}),
      ...(inside.chooses ? { chooses: inside.chooses } : {}),
      ...(inside.save ? { save: { ...inside.save } } : {}),
    };
  }
  if (zone.forbids) {
    out.forbids = {
      ...(zone.forbids.components ? { components: [...zone.forbids.components] } : {}),
      // No teleporting into, out of or within it (1.467).
      ...(zone.forbids.teleport === true ? { teleport: true as const } : {}),
      // Nobody into it at all (1.753): Forbiddance.
      ...(zone.forbids.teleport === "into" ? { teleport: "into" as const } : {}),
      // Or out of it only past a save (1.603).
      ...(typeof zone.forbids.teleport === "object" ? { teleport: { ...zone.forbids.teleport } } : {}),
      // No casting from these catalogs inside it (1.521): an antimagic field's spells.
      ...(zone.forbids.casts ? { casts: [...zone.forbids.casts] } : {}),
    };
  }
  // What does nothing inside it (1.521): Antimagic Field.
  if (zone.suppresses) {
    out.suppresses = {
      ...(zone.suppresses.catalogs ? { catalogs: [...zone.suppresses.catalogs] } : {}),
      ...(zone.suppresses.tags ? { tags: [...zone.suppresses.tags] } : {}),
      ...(zone.suppresses.setsAsideCalled ? { setsAsideCalled: true as const } : {}),
    };
  }
  if (zone.wards) {
    out.wards = {
      catalogs: [...zone.wards.catalogs],
      maxLevel: zone.wards.maxLevel,
      ...(zone.wards.by ? { by: zone.wards.by } : {}),
      ...(zone.wards.maxLevelPerCostStep ? { maxLevelPerCostStep: zone.wards.maxLevelPerCostStep } : {}),
      // Only some entries (1.645).
      ...(zone.wards.where ? { where: { ...zone.wards.where } } : {}),
      ...(zone.wards.entries ? { entries: [...zone.wards.entries] } : {}),
    };
  }
  // Kinds it keeps out (1.452): Magic Circle, Hallow.
  if (zone.keepsOut) out.keepsOut = structuredClone(zone.keepsOut);
  if (zone.hidden) out.hidden = { check: zone.hidden.check };
  // A trap disarmed with a check (1.669).
  if (zone.disarm) out.disarm = { ...zone.disarm };
  // Layers crossed one at a time, and its flash (1.490): Prismatic Wall.
  const layers = zone.layers;
  if (layers) {
    out.layers = {
      rows: structuredClone(layers.rows),
      ...(layers.spares ? { spares: layers.spares } : {}),
      ...(layers.flash
        ? {
            flash: {
              within: rulesetInCells(layers.flash.within, perCell ?? 1),
              save: layers.flash.save,
              applies: structuredClone(layers.flash.applies),
              triggers: [...layers.flash.triggers],
            },
          }
        : {}),
    };
  }
  const held = zone.whileHeld;
  const heldAmount = held && amountOf(held.amount);
  if (held && heldAmount) {
    out.whileHeld = {
      condition: held.condition,
      amount: heldAmount,
      ...(held.damageType ? { damageType: held.damageType } : {}),
    };
  }
  const harm = terrain?.perDistance && amountOf(terrain.perDistance.amount);
  if (terrain?.perDistance && harm) {
    out.perDistance = {
      every: rulesetInCells(terrain.perDistance.every, perCell ?? 1),
      amount: harm,
      ...(terrain.perDistance.damageType ? { damageType: terrain.perDistance.damageType } : {}),
    };
  }
  return out;
}

/** What one use does, as an action holds it: the parts a fake takes from what it truly is (1.79). */
export const RULESET_FAKE_EFFECT_KEYS = [
  "toHit",
  "ability",
  "target",
  "autoHit",
  "damage",
  "heal",
  "temporary",
  "restore",
  "save",
  "saveDifficulty",
  "applies",
  "concentration",
  // What a scroll's spell leaves behind (1.174) is what it truly does too.
  "zone",
] as const satisfies ReadonlyArray<keyof RulesetCombatAction>;

/** The action a use resolves as: for a fake (1.79), the one offered with what it truly does in place
 *  of what it seemed to, so the menu, the forecast and the aim stay what the real thing's are. */
/** A weapon item's attack made where it is suppressed (1.521), from inside an antimagic zone or at
 *  somebody inside: a plain weapon, without its own bonus, its extra damage or the suppressed tags. */
export function rulesetSuppressedAttack(
  action: RulesetCombatAction,
  hush: { tags: Set<string> } | null,
): RulesetCombatAction {
  if (!action.itemTags?.some((tag) => hush?.tags.has(tag))) return action;
  const bonus = action.itemBonus ?? { toHit: 0, damage: 0 };
  const plain = (damage: NonNullable<RulesetCombatAction["damage"]>) => {
    const { plus: _plus, ...rest } = damage;
    const qualities = rest.qualities?.filter((tag) => !hush!.tags.has(tag));
    return {
      ...rest,
      flat: Math.max(0, rest.flat - bonus.damage),
      ...(qualities ? { qualities } : {}),
    };
  };
  const { itemBonus: _bonus, slay: _slay, ...rest } = action;
  return {
    ...rest,
    ...(rest.toHit !== undefined ? { toHit: rest.toHit - bonus.toHit } : {}),
    ...(rest.damage ? { damage: plain(rest.damage) } : {}),
    itemTags: rest.itemTags!.filter((tag) => !hush!.tags.has(tag)),
  };
}

export function rulesetActionAsUsed(action: RulesetCombatAction): RulesetCombatAction {
  const does = action.itemUse?.fake?.does;
  if (!does) return action;
  const used: RulesetCombatAction = { ...action };
  for (const key of RULESET_FAKE_EFFECT_KEYS) delete used[key];
  return { ...used, ...does };
}

/** What an item's use does, as an action: its own to-hit and save difficulty in place of a sheet row's,
 *  and what it restores. Null for a use no menu holds, or one whose save reads a stat the item does
 *  not give (a save against nothing). */
function itemUseMechanics(
  definition: RulesetDefinition,
  item: RulesetCatalogItem,
  use: NonNullable<RulesetCatalogItem["use"]>,
  from: { id: string; label: string },
  build: RulesetSheetBuild,
  evaluated: EvaluatedRulesetSheet,
  perCell: number | undefined,
  pooled: boolean,
): RulesetCombatAction | null {
  // Its own number, or its holder's read off their sheet (1.269): "using your spell save DC".
  const read = use.sheetDifficulty
    ? resolveRulesetValueRef(definition, build, use.sheetDifficulty, evaluated)
    : itemAttackValue(item, use.saveDifficulty);
  const difficulty = typeof read === "number" && Number.isFinite(read) ? Math.trunc(read) : undefined;
  if ((use.saveDifficulty !== undefined || use.sheetDifficulty) && difficulty === undefined) return null;
  const aim = use.toHit ? itemToHit(definition, build, evaluated, item, use.toHit, pooled) : { toHit: 0 };
  const action = mechanicsAction(definition, use, {
    ...from,
    kind: "item",
    budget: use.budget ?? "",
    toHit: aim.toHit,
    ...(aim.ability ? { ability: aim.ability } : {}),
    ...(difficulty !== undefined ? { saveDifficulty: difficulty } : {}),
    build,
    evaluated,
    perCell,
  });
  if (!action) return null;
  // What the item is, its use is too (1.261): a potion tagged magical heals as magic.
  if (item.tags?.length) action.qualities = [...new Set([...(action.qualities ?? []), ...item.tags])];
  if (aim.target !== undefined) action.target = aim.target;
  if (use.casts) action.casts = use.casts;
  // Read as the entry it casts at a layered wall (1.494): a scroll of Passwall.
  if (action.endsLayers && use.endsLayersAs) action.endsLayers = { ...action.endsLayers, as: use.endsLayersAs };
  const restored = amountOf(use.restore?.amount);
  if (use.restore && restored) action.restore = { pool: use.restore.pool, amount: restored };
  // Spent pools it gives back by itself (1.656): a Pearl of Power.
  if (use.recovers?.count !== undefined) action.recovers = structuredClone(use.recovers);
  // What it puts on lasts while the item's charges do (1.623): the Boots of Speed.
  if (use.chargesPerRound) action.chargesPerRound = true;
  // The level it casts at (1.730): a scroll of Counterspell's 3.
  if (use.level !== undefined) action.castLevel = use.level;
  return action;
}

/** What a fake's use truly does: its true item's use, read off that item, as the parts of an action
 *  in `RULESET_FAKE_EFFECT_KEYS`; null where it does nothing a fight can use (no use, one no menu holds, or a
 *  save whose number reads a stat the item does not give). */
function fakeUseAction(
  definition: RulesetDefinition,
  item: RulesetCatalogItem,
  build: RulesetSheetBuild,
  evaluated: EvaluatedRulesetSheet,
  perCell: number | undefined,
  pooled: boolean,
): Partial<RulesetCombatAction> | null {
  const action = item.use
    ? itemUseMechanics(definition, item, item.use, { id: "fake", label: "" }, build, evaluated, perCell, pooled)
    : null;
  if (!action) return null;
  const does: Partial<RulesetCombatAction> = {};
  for (const key of RULESET_FAKE_EFFECT_KEYS)
    if (action[key] !== undefined) Object.assign(does, { [key]: action[key] });
  return does;
}

/** The switches on a fighter's items (1.170): one of an item with a `toggle` turned on or off, on its
 *  budget. Its place in `sheet.items` is what the fight keeps the state by. */
function itemSwitchActions(items: readonly RulesetSheetItem[] | undefined): RulesetCombatAction[] {
  return (items ?? []).flatMap((held, index): RulesetCombatAction[] => {
    const toggle = held.item.toggle;
    if (!toggle || held.quantity !== 1) return [];
    return [
      {
        id: `switch:${index}`,
        kind: "switch",
        label: `${held.name ?? toggle.label}: ${toggle.label}`,
        budget: toggle.budget,
        targets: { side: "self", count: 0 },
        switches: { item: index },
        ...(toggle.onLabel || toggle.offLabel
          ? {
              switchLabels: {
                ...(toggle.onLabel ? { on: toggle.onLabel } : {}),
                ...(toggle.offLabel ? { off: toggle.offLabel } : {}),
              },
            }
          : {}),
      },
    ];
  });
}

/** Turning an item into each of its other forms (1.575), on its budget: a Rod of Lordly Might's buttons.
 *  One of an item only, as a switch is. */
function itemFormActions(items: readonly RulesetSheetItem[] | undefined): RulesetCombatAction[] {
  return (items ?? []).flatMap((held, index): RulesetCombatAction[] => {
    const forms = held.item.forms;
    if (!forms || held.quantity !== 1) return [];
    const labels = [forms.label, ...forms.into.map((form) => form.label)];
    const now = held.form ?? 0;
    return labels.flatMap((label, to): RulesetCombatAction[] =>
      to === now
        ? []
        : [
            {
              id: `form:${index}:${to}`,
              kind: "switch",
              label: `${held.name ?? forms.label}: ${label}`,
              budget: forms.budget,
              targets: { side: "self", count: 0 },
              switches: { form: { item: index, to } },
            },
          ],
    );
  });
}

/** Taking in hand a weapon a call lends (1.739), on its budget: a goat of terror's horn. */
function lentTakeActions(items: readonly RulesetSheetItem[]): RulesetCombatAction[] {
  return items.flatMap((held, index) =>
    held.lent?.takes !== undefined
      ? [
          {
            id: `take:${index}`,
            kind: "switch" as const,
            label: `Take ${held.name ?? "weapon"}`,
            budget: held.lent.takes,
            targets: { side: "self" as const, count: 0 },
            switches: { take: index },
          },
        ]
      : [],
  );
}

/** Some of a weapon's bonus to its wielder's defense (1.737), each amount its own choice, for nothing
 *  before their first attack with it on a turn: a Defender's. */
function bonusShiftActions(
  combat: RulesetCombat,
  items: readonly RulesetSheetItem[] | undefined,
): RulesetCombatAction[] {
  const first = combat.economy.budgets[0]?.id;
  if (!first) return [];
  return (items ?? []).flatMap((held, index) => {
    const shift = held.item.attack?.bonusToDefense;
    if (!shift || !held.worn) return [];
    const label = shift.label ?? held.name ?? "Weapon";
    return Array.from({ length: shift.upTo }, (_, n) => ({
      id: `shift:${index}:${n + 1}`,
      kind: "switch" as const,
      label: `${label}: ${n + 1} to defense`,
      budget: first,
      free: true as const,
      targets: { side: "self" as const, count: 0 },
      switches: { shift: { item: index, amount: n + 1 } },
    }));
  });
}

/** Pulling one's blows, or no longer (1.720), for nothing once a turn: `combat.dying.knockOut`. */
function knockOutSwitchActions(combat: RulesetCombat): RulesetCombatAction[] {
  const rule = combat.dying?.knockOut;
  const first = combat.economy.budgets[0]?.id;
  if (!rule || !first) return [];
  return [
    {
      id: "knock-out",
      kind: "switch",
      label: rule.label ?? "Knock out",
      budget: first,
      free: true,
      targets: { side: "self", count: 0 },
      switches: { knockOut: true },
    },
  ];
}

/** Putting out and lighting again the light a fighter carries (1.295), on its budget or for nothing.
 *  On the menu only while they carry one. */
function carriedSwitchActions(combat: RulesetCombat): RulesetCombatAction[] {
  const carried = combat.sight?.darkness?.carried;
  const first = combat.economy.budgets[0]?.id;
  if (!carried || (!carried.budget && !first)) return [];
  return [
    {
      id: "light:carried",
      kind: "switch",
      label: carried.label ?? "Light",
      budget: carried.budget ?? first!,
      ...(carried.budget ? {} : { free: true as const }),
      targets: { side: "self", count: 0 },
      switches: { carried: true },
    },
  ];
}

/**
 * The weapons a fighter holds, as attacks: each worn item with an `attack`, read the way an attack
 * row is, with its values in place of columns and each stat it reads off the item itself. It adds
 * to hit the best of its abilities (with its skill, as a row's `with=` swaps one in), deals the best
 * of its damage abilities, and deals its `versatile` dice instead while each slot it takes has room
 * for as much again. What it carries past a resistance is its tags. An item put away offers nothing,
 * unless it is drawn as it is used (1.808) and could be drawn now.
 */
function itemAttackActions(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  items: readonly RulesetSheetItem[] | undefined,
  build: RulesetSheetBuild,
  evaluated: EvaluatedRulesetSheet,
  perCell: number | undefined,
  /** What the entries the sheet holds do to its weapons' attacks (1.244). */
  rules: readonly RulesetAttackRowRule[] = [],
): RulesetCombatAction[] {
  // A weapon drawn as it is used (1.808) is offered while only carried, where it could be drawn now
  // (laptop v3 2026-10-26: a carried Longbow was never offered as an attack).
  const ready = (held: RulesetSheetItem, index: number) =>
    held.worn || (held.drawOnUse === true && rulesetHeldReady(definition, items!, index));
  if (!items?.some((held, index) => held.item.attack && ready(held, index))) return [];
  const pooled = rulesetCombatIsPool(combat);
  // What the fighter's worn items take of each slot, the weapon's own share included.
  // ponytail: an item put on but not yet bound fills its slot and is not counted here, because a
  // fight's items say only whether each is worn; passing "on" through is the upgrade.
  const used: Record<string, number> = {};
  for (const held of items) {
    // Hovering, on (1.706): its slots are free. Lent by a call (1.739), taken only as it comes.
    if (!held.worn || held.lent || (held.on && held.item.toggle?.freesSlots)) continue;
    for (const [slot, count] of Object.entries(held.item.slots ?? {}))
      used[slot] = (used[slot] ?? 0) + count * held.quantity;
  }
  const slotCounts = new Map((definition.items?.slots ?? []).map((slot) => [slot.id, slot.count]));
  const cells = (value: unknown) =>
    typeof value === "number" && Number.isFinite(value) && value > 0 && perCell !== undefined
      ? rulesetInCells(value, perCell)
      : undefined;
  const number = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : 0);
  const actions: RulesetCombatAction[] = [];
  items.forEach((held, index) => {
    const { item } = held;
    const attack = item.attack;
    if (!attack || !ready(held, index)) return;
    const read = (value: unknown) => itemAttackValue(item, value);
    // One not yet drawn (1.808) is weighed as it will be held once drawn: its own share taken, and
    // what is put away for it given back.
    const drawing = held.worn ? undefined : rulesetHeldDrawPlan(definition, items, index);
    const stowed = drawing && "stow" in drawing ? drawing.stow : [];
    const holds = (slot: string) =>
      (used[slot] ?? 0) +
      (drawing ? (item.slots?.[slot] ?? 0) : 0) -
      stowed.reduce((sum, at) => sum + (items[at]!.item.slots?.[slot] ?? 0) * items[at]!.quantity, 0);
    const free =
      attack.versatile !== undefined &&
      Object.entries(item.slots ?? {}).every(([slot, count]) => (slotCounts.get(slot) ?? 0) - holds(slot) >= count);
    // No dice at all (1.511) is a blow of its bonus alone, or of nothing: a blowgun's 1, a net's none.
    const diceless = attack.damage.dice === undefined && !(free && attack.versatile?.dice !== undefined);
    const parsed = diceless
      ? { count: 0, sides: 0, flat: 0 }
      : parseRulesetCombatDice(read(free ? attack.versatile!.dice : attack.damage.dice));
    const dice = pooled ? (parsed ?? { count: 0, sides: rulesetPoolDie(definition), flat: 0 }) : parsed;
    if (!dice) return;
    const aim = itemToHit(definition, build, evaluated, item, attack.toHit, pooled);
    const dealtWith = attackAbilities(read(attack.damage.abilities));
    const damageAbility = dealtWith.length
      ? Math.max(...dealtWith.map((ability) => evaluated.abilityMods[ability] ?? ABILITY_COLUMN_MISS))
      : 0;
    // What the holder brings to the damage off their own sheet (1.97: a duelist's +2), only while the
    // weapon is held in one hand when it says so: a versatile weapon wielded two-handed, or one that
    // takes two of a slot, is not.
    const twoHanded = free || Object.values(item.slots ?? {}).some((count) => count >= 2);
    const sheetDamage =
      attack.damage.sheetBonus !== undefined && !(attack.damage.oneHanded && twoHanded)
        ? Math.trunc(resolveRulesetValueRef(definition, build, attack.damage.sheetBonus, evaluated))
        : 0;
    const ownDamage = number(read(attack.damage.bonus));
    const ownHit = pooled ? 0 : number(read(attack.toHit?.bonus));
    // Less what corrosion took off it for good (1.551).
    const bonus = ownDamage + (Number.isFinite(sheetDamage) ? sheetDamage : 0) - (held.corroded ?? 0);
    const typeRead = read(attack.damage.type);
    const type = typeof typeRead === "string" && typeRead.trim() ? typeRead.trim() : undefined;
    const strikes = attack.strikes
      ? Math.max(1, Math.trunc(resolveRulesetValueRef(definition, build, attack.strikes, evaluated)))
      : undefined;
    const reach = cells(read(attack.reach));
    const normal = attack.range ? cells(read(attack.range.normal)) : undefined;
    const long = attack.range?.long !== undefined ? cells(read(attack.range.long)) : undefined;
    // A clip holds a number of rounds, so one its stat does not give is a weapon that never fires.
    const clipMax = attack.clip ? read(attack.clip.max) : undefined;
    if (attack.clip && !(typeof clipMax === "number" && Number.isFinite(clipMax) && clipMax >= 1)) return;
    const clip = attack.clip ? { item: index, max: Math.trunc(clipMax as number) } : undefined;
    const ammo = attack.ammo
      ? {
          tag: attack.ammo.tag,
          per: attack.ammo.perAttack ?? 1,
          ...(attack.ammo.recover ? { recover: attack.ammo.recover } : {}),
        }
      : undefined;
    const label = itemAttackLabel(definition, held);
    if (clip && attack.clip) {
      actions.push({
        id: `reload:${index}`,
        kind: "reload",
        label,
        budget: attack.clip.reload,
        targets: { side: "self", count: 0 },
        clip,
        ...(ammo ? { ammo } : {}),
      });
    }
    // Low damage dice thrown again once, off the holder's sheet, only while the weapon is wielded
    // two-handed (1.98: Great Weapon Fighting's 1s and 2s). A pool fight's damage is successes, not
    // faces, so it has none.
    const rerollRead =
      !pooled && attack.damage.rerollUpTo !== undefined && twoHanded
        ? Math.trunc(resolveRulesetValueRef(definition, build, attack.damage.rerollUpTo, evaluated))
        : 0;
    const rerollUpTo = Number.isFinite(rerollRead) ? Math.max(0, Math.min(rerollRead, dice.sides - 1)) : 0;
    const minimum = attack.damage.minimum;
    const minimumRead = minimum
      ? "stat" in minimum
        ? read(minimum)
        : resolveRulesetValueRef(definition, build, minimum, evaluated)
      : undefined;
    const floorRead = read(attack.floor);
    const floor = typeof floorRead === "number" && Number.isFinite(floorRead) && floorRead >= 1 ? floorRead : 0;
    // A damage ability read as the off hand reads it where the ruleset says so: added only when it
    // takes something away.
    const damageOf = (ability: number) => ({
      ...(pooled
        ? {
            count: Math.max(0, dice.count + ability),
            sides: rulesetPoolDie(definition),
            flat: Math.max(0, dice.flat + bonus),
          }
        : { count: dice.count, sides: dice.sides, flat: dice.flat + ability + bonus }),
      ...(type ? { type } : {}),
      ...(item.tags?.length ? { qualities: [...item.tags] } : {}),
      ...(floor ? { floor: Math.trunc(floor) } : {}),
      ...(typeof minimumRead === "number" && Number.isFinite(minimumRead)
        ? { minimum: Math.max(0, Math.trunc(minimumRead)) }
        : {}),
      ...(rerollUpTo > 0 ? { reroll: rerollUpTo } : {}),
      ...(plus.length ? { plus: plus.map((clause) => ({ ...clause })) } : {}),
    });
    // More damage on the same blow (1.169), each clause its own dice, type, save and target test. A
    // pool fight throws a clause's count of its own dice, as it throws the weapon's.
    const clausesOf = (clauses: typeof attack.plus) =>
      (clauses ?? []).flatMap((clause): RulesetCombatDamageClause[] => {
        const parsedClause = clause.dice ? parseRulesetCombatDice(clause.dice) : null;
        if (clause.dice && !parsedClause) return [];
        const amount = parsedClause
          ? pooled
            ? {
                count: parsedClause.count,
                sides: rulesetPoolDie(definition),
                flat: parsedClause.flat + (clause.flat ?? 0),
              }
            : { ...parsedClause, flat: parsedClause.flat + (clause.flat ?? 0) }
          : { count: 0, sides: pooled ? rulesetPoolDie(definition) : 0, flat: clause.flat ?? 0 };
        return [
          {
            ...amount,
            ...(clause.type ? { type: clause.type } : {}),
            ...(clause.save ? { save: { ...clause.save } } : {}),
            ...(clause.targetIs ? { targetIs: clause.targetIs } : {}),
            ...(clause.when === "critical" ? { onCritical: true as const } : {}),
            ...(clause.when === "toggled" ? { whileOn: index } : {}),
            ...(clause.not ? { not: clause.not } : {}),
            ...(clause.blow ? { blow: clause.blow } : {}),
            ...(clause.tempHp ? { tempHp: true as const } : {}),
            ...(clause.marked ? { marked: clause.marked } : {}),
          },
        ];
      });
    const plus = clausesOf(attack.plus);
    // Ammunition it shoots with clauses of its own (1.657), each a way to shoot it: an Arrow of
    // Slaying. A clip loads whatever comes first, so only a weapon shot from the bag has them.
    const shots =
      attack.ammo && !attack.clip
        ? items.flatMap((shot, at) =>
            shot.item.ammoRider && shot.item.tags?.includes(attack.ammo!.tag)
              ? [{ at, name: itemAttackLabel(definition, shot), rider: shot.item.ammoRider }]
              : [],
          )
        : [];
    const riders = shots.length
      ? Object.fromEntries(
          shots.map(({ at, rider }) => [
            String(at),
            {
              plus: clausesOf(rider.plus),
              ...(rider.spentOnUse ? { spends: true as const } : {}),
              ...(rider.toHit ? { toHit: rider.toHit } : {}),
            },
          ]),
        )
      : undefined;
    const shotModes: RulesetCombatMode[] = shots.map(({ at, name }) => ({
      id: `shot:${at}`,
      label: name,
      ammoFrom: at,
    }));
    // The item's own charges, which a slay spends (1.187): a stat holds its own range, held to the
    // most a written count may be. One that reads nothing never slays.
    const counted = item.charges ? read(item.charges.max) : undefined;
    const chargesMax =
      typeof counted === "number" && Number.isFinite(counted)
        ? Math.min(RULESET_ITEM_CHARGES_MAX, Math.trunc(counted))
        : undefined;
    const slay = (attack.slay ?? []).flatMap((entry) => {
      if (entry.charges !== undefined && !(chargesMax !== undefined && chargesMax >= 1)) return [];
      const { charges, ...rest } = structuredClone(entry);
      return [
        {
          ...rest,
          ...(charges !== undefined ? { charges: { cost: charges, max: chargesMax!, item: index } } : {}),
        },
      ];
    });
    // A mode's own reach, clauses, bolt and charges (1.190). One that spends charges the item cannot
    // count is never offered; a reach or a bolt needs a board's cells.
    const modeOf = (mode: NonNullable<typeof attack.modes>[number]): RulesetCombatMode[] => {
      if (mode.charges !== undefined && !(chargesMax !== undefined && chargesMax >= 1)) return [];
      const { range, plus: modePlus, line, charges, aroundHit, ...rest } = mode;
      const modeNormal = range ? cells(range.normal) : undefined;
      const modeLong = range?.long !== undefined ? cells(range.long) : undefined;
      const lineDice = line?.dice ? parseRulesetCombatDice(line.dice) : null;
      const moded: RulesetCombatMode = {
        ...rest,
        ...(modeNormal !== undefined
          ? {
              range: {
                normal: modeNormal,
                ...(modeLong !== undefined && modeLong > modeNormal ? { long: modeLong } : {}),
              },
            }
          : {}),
        ...(modePlus?.length ? { plus: clausesOf(modePlus) } : {}),
        ...(line && perCell !== undefined
          ? {
              line: {
                amount: {
                  count: lineDice?.count ?? 0,
                  sides: pooled ? rulesetPoolDie(definition) : (lineDice?.sides ?? 0),
                  flat: (lineDice?.flat ?? 0) + (line.flat ?? 0),
                },
                ...(line.type ? { type: line.type } : {}),
                save: { ...line.save },
              },
            }
          : {}),
        ...(charges !== undefined ? { charges: { cost: charges, max: chargesMax!, item: index } } : {}),
        // Around the one it hit (1.312), measured in cells.
        ...(aroundHit
          ? {
              aroundHit: {
                ...aroundHit,
                save: { ...aroundHit.save },
                within: Math.round(aroundHit.within / (perCell ?? 1)),
              },
            }
          : {}),
      };
      return [moded];
    };
    const offHand = attack.offHand && combat.offHand ? combat.offHand : undefined;
    const weapon: RulesetCombatAction = {
      id: `item:${index}`,
      kind: "attack",
      label,
      budget: attack.budget,
      targets: { side: "enemy", count: 1 },
      ...(strikes !== undefined ? { strikes } : {}),
      ...(reach !== undefined ? { reach } : {}),
      ...(normal !== undefined ? { range: { normal, ...(long !== undefined && long > normal ? { long } : {}) } } : {}),
      ...(aim.ability ? { ability: aim.ability } : {}),
      toHit: aim.toHit,
      ...(aim.target !== undefined ? { target: aim.target } : {}),
      damage: damageOf(damageAbility),
      ...(ammo ? { ammo: riders ? { ...ammo, riders } : ammo } : {}),
      ...(clip ? { clip } : {}),
      ...(attack.modes?.length || shotModes.length
        ? { modes: [...(attack.modes ?? []).flatMap((mode) => modeOf(mode)), ...shotModes] }
        : {}),
      ...(attack.onHit?.length
        ? {
            onHit: attack.onHit.map((entry) => ({
              ...entry,
              ...(entry.save ? { save: { ...entry.save } } : {}),
              ...(entry.saveEnds ? { saveEnds: { ...entry.saveEnds } } : {}),
              ...(entry.checkEnds ? { checkEnds: { ...entry.checkEnds } } : {}),
            })),
          }
        : {}),
      ...(attack.against?.length ? { against: structuredClone(attack.against) } : {}),
      ...(slay.length ? { slay } : {}),
      ...(attack.reaps ? { reaps: true as const } : {}),
      ...(attack.ignoresResistance ? { ignoresResistance: true as const } : {}),
      ...(attack.healedOnlyByRest ? { healedOnlyByRest: true as const } : {}),
      ...(attack.othersWhileMarked ? { othersWhileMarked: { ...attack.othersWhileMarked, item: index } } : {}),
      // What comes after the attack action reads the weapon's tags (1.246).
      ...(item.tags?.length ? { itemTags: [...item.tags] } : {}),
      // Its own bonus, off where it is suppressed (1.521).
      ...(item.tags?.length && (ownHit !== 0 || ownDamage !== 0)
        ? { itemBonus: { toHit: ownHit, damage: ownDamage } }
        : {}),
    };
    // What the sheet's entries do to it (1.244), as they do to a row: a monk's quarterstaff.
    const ruled = (action: RulesetCombatAction, full: boolean) => {
      if (full && action.ability !== undefined && dealtWith.includes(action.ability)) action.damageAddsAbility = true;
      if (rules.length && dice)
        applyAttackRowRules(
          definition,
          build,
          evaluated,
          dice,
          action,
          rules,
          pooled,
          (ability) => full && ability !== undefined && dealtWith.includes(ability),
          item,
        );
      return action;
    };
    // The off hand: the same weapon, struck with again on the off-hand budget: one blow, whatever
    // strikes its main attack buys, and with the damage ability the ruleset lets an off hand keep.
    // The off hand keeps the full ability for a fighter whose sheet says so (1.97: Two-Weapon
    // Fighting), whatever the ruleset's rule for everyone else.
    const clipped =
      !!offHand &&
      offHand.ability === "penalty-only" &&
      !(offHand.fullWhen !== undefined && resolveRulesetValueRef(definition, build, offHand.fullWhen, evaluated) > 0);
    const { strikes: _strikes, ...single } = weapon;
    const off: RulesetCombatAction | undefined = offHand
      ? {
          ...single,
          id: `offhand:${index}`,
          budget: offHand.budget,
          damage: damageOf(clipped ? Math.min(0, damageAbility) : damageAbility),
          offHandOf: index,
        }
      : undefined;
    ruled(weapon, true);
    actions.push(offHand ? { ...weapon, pairs: index } : weapon);
    if (off) actions.push(ruled(off, !clipped));
    // Charges spent once it hits (1.273), each its holder's own answer to a hit with it: more harm
    // with the blow, more for each charge more, and what it puts on the one hit. One the item cannot
    // count charges for is never offered. One that counts its own uses (1.534) spends one of those,
    // and one may put conditions on with no harm of its own.
    attack.spends?.forEach((spend, n) => {
      const amount = spend.amount ? amountOf(spend.amount) : null;
      if (spend.amount ? !amount : !spend.onHit?.length) return;
      if (!spend.uses && !(chargesMax !== undefined && chargesMax >= 1)) return;
      const step = spend.chargeStep ? amountOf(spend.chargeStep.amount) : null;
      const spendType = spend.type ?? type;
      actions.push({
        id: `spend:${index}:${n}`,
        kind: "attack",
        harmful: true,
        label: `${label}: ${spend.label}`,
        budget: attack.budget,
        free: true,
        targets: { side: "enemy", count: 1 },
        reaction: {
          on: "hit",
          at: "target",
          by: "self",
          weapon: true,
          item: index,
          ...(spend.blow ? { blow: spend.blow } : {}),
        },
        addsToBlow: true,
        ...(amount ? { damage: { ...amount, ...(spendType ? { type: spendType } : {}) } } : {}),
        ...(spend.save || spend.drain
          ? {
              addsWith: {
                ...(spend.save ? { save: { ...spend.save } } : {}),
                ...(spend.drain ? { drain: spend.drain.share ?? 1 } : {}),
              },
            }
          : {}),
        ...(spend.onHit?.length
          ? {
              onHit: spend.onHit.map((entry) => ({
                ...entry,
                // Whatever the blow dealt: the hit is what calls for the save.
                atLeast: 0,
                ...(entry.save ? { save: { ...entry.save } } : {}),
                ...(entry.saveEnds ? { saveEnds: { ...entry.saveEnds } } : {}),
              })),
            }
          : {}),
        itemUse: {
          item: index,
          // Its own uses (1.534), kept on the stack under "h" and its place among the spends from 1.
          ...(spend.uses
            ? { ownUses: { more: `h${n + 1}`, max: spend.uses.max } }
            : {
                charges: {
                  cost: spend.charges ?? 1,
                  max: chargesMax!,
                  ...(item.charges?.breaksOn ? { breaksOn: lastChargeDie(item.charges.breaksOn) } : {}),
                  ...(item.charges?.overuse ? { overuse: { ...item.charges.overuse } } : {}),
                  ...(spend.chargeStep && step ? { step: { max: spend.chargeStep.max, amount: step } } : {}),
                },
              }),
        },
      });
    });
  });
  return actions;
}

/** The clauses beside a blow's first amount, with each save's difficulty resolved once: the
 *  clause's own number when it named one, and otherwise the number this source rolls saves against.
 *  A clause with neither dice nor a flat part is refused at import, so nothing here is dropped. */
function clausesOf(
  plus: RulesetCatalogMechanics["plus"] | undefined,
  difficulty: number,
): RulesetCombatDamageClause[] | null {
  if (!plus?.length) return null;
  const clauses = plus.flatMap((clause) => {
    const amount = amountOf(clause);
    if (!amount) return [];
    return [
      {
        ...amount,
        ...(clause.type ? { type: clause.type } : {}),
        ...(clause.targetIs ? { targetIs: clause.targetIs } : {}),
        ...(clause.save
          ? {
              save: {
                save: clause.save.save,
                onSuccess: clause.save.onSuccess,
                difficulty: clause.save.difficulty ?? difficulty,
              },
            }
          : {}),
      },
    ];
  });
  return clauses.length > 0 ? clauses : null;
}

/** More of them as the sheet grows, and the same one more than once (1.305): eldritch blast's beams. */
function grownTargets(
  targets: RulesetCombatAction["targets"],
  mechanics: Pick<RulesetCatalogMechanics, "targetsScale" | "targetsRepeat">,
  resolve: (ref: RulesetValueRef) => number,
): RulesetCombatAction["targets"] {
  const more = mechanics.targetsScale
    ? Math.max(0, Math.trunc(lookupStepTable(mechanics.targetsScale.table, resolve(mechanics.targetsScale.from))))
    : 0;
  if (!more && !mechanics.targetsRepeat) return targets;
  return { ...targets, count: targets.count + more, ...(mechanics.targetsRepeat ? { repeat: true as const } : {}) };
}

/** Who a catalog entry may be pointed at. What it does decides it when the entry says nothing: a
 *  heal or a buff goes to the actor's own side, anything else to the other one. */
function targetsOf(mechanics: RulesetCatalogMechanics): RulesetCombatAction["targets"] {
  // A burst centred on its user (1.282) is pointed at nobody: it catches whom it reaches.
  if (mechanics.area?.around) return { side: "self", count: 0 };
  // A `utility` entry is only ever here because it changes what the turn may hold, and what it
  // changes is the holder's own economy: there is nobody to point it at. One that cures (1.176) is
  // pointed at whom it cures, an ally unless it says otherwise.
  // Moving a track or giving back sealed health is one too (1.201).
  const cures =
    !!mechanics.ends ||
    !!mechanics.endsSpells ||
    !!mechanics.stabilizes ||
    !!mechanics.revives ||
    !!mechanics.tracks ||
    !!mechanics.unseals;
  // One that leaves an area standing (1.178: Fog Cloud, Darkness) is set down wherever its caster
  // likes, and off a board held on whoever it is cast on.
  // So is one that clears growth from an area (1.318): Prune, a pair of shears.
  // As is one that steers a condition at a point (1.464): Compulsion.
  if (mechanics.kind === "utility" && (mechanics.zone || mechanics.clears || mechanics.steers) && mechanics.area) {
    return { side: mechanics.targets ?? "any", count: Math.max(1, mechanics.targetCount ?? 1) };
  }
  // A strike back, or a missed attack sent on (1.422), is at somebody: whoever caused it, or the one
  // its holder picks.
  if (mechanics.kind === "utility" && (mechanics.strikesWith || mechanics.redirects)) {
    // Over an area off a board (1.428), as many as it names: Volley.
    const count = mechanics.area ? Math.max(1, mechanics.targetCount ?? 1) : 1;
    return { side: mechanics.targets ?? (mechanics.redirects ? "any" : "enemy"), count };
  }
  // An item's use rolled for (1.559) is at whom it is aimed, either side unless it says: a Wand of
  // Wonder's "choose a target".
  if (mechanics.kind === "utility" && (mechanics as { rollsTable?: true }).rollsTable) {
    return mechanics.targets === "self"
      ? { side: "self", count: 0 }
      : { side: mechanics.targets ?? "any", count: Math.max(1, mechanics.targetCount ?? 1) };
  }
  if (mechanics.kind === "utility" && !cures) return { side: "self", count: 0 };
  if (mechanics.kind === "utility") {
    return { side: mechanics.targets ?? "ally", count: Math.max(1, mechanics.targetCount ?? 1) };
  }
  // An area catches each creature in it (1.192), so off a board, where it is pointed at people by
  // name, it may be pointed at either side unless it spares its caster's own.
  const side =
    mechanics.targets ??
    (mechanics.kind === "heal" || mechanics.kind === "buff"
      ? "ally"
      : mechanics.area && mechanics.friendlyFire !== false
        ? "any"
        : "enemy");
  return { side, count: Math.max(1, mechanics.targetCount ?? 1) };
}

function abilityAction(
  definition: RulesetDefinition,
  source: RulesetCombatAbilitySource,
  row: Record<string, unknown>,
  sourceIndex: number,
  rowIndex: number,
  name: string,
  entry: RulesetCatalogEntry,
  build: RulesetSheetBuild,
  evaluated: EvaluatedRulesetSheet,
  perCell: number | undefined,
): RulesetCombatAction | null {
  const mechanics = entry.mechanics;
  if (!mechanics) return null;
  const values = resolveRulesetAbilityValues(definition, build, source, row, evaluated);
  const rolled = refTarget(definition, build, values.toHitRef);
  const ability = rolled?.type === "ability" ? rolled.id : rolled?.ability;
  const action = mechanicsAction(definition, mechanics, {
    id: `ability:${sourceIndex}:${rowIndex}`,
    ...(ability ? { ability } : {}),
    kind: "ability",
    label: name,
    budget: mechanics.budget ?? source.budget,
    // An entry that rolls to hit always rolls: a source that names no bonus adds nothing to the dice.
    toHit: values.toHit + fightAdjust(definition, build, evaluated, values.toHitRef),
    ...(values.saveDifficulty !== undefined ? { saveDifficulty: values.saveDifficulty } : {}),
    build,
    evaluated,
    perCell,
  });
  // A priced material (1.790), cast from the sheet's own row: never through an item, a creature or
  // another entry that casts it for nothing.
  if (action && mechanics.material) action.material = structuredClone(mechanics.material);
  return action;
}

/** Whether an action is cast by praying (1.786): one of the ruleset's divine `entries`, or a sheet row
 *  whose divine `column` holds one of its `values` (matched without case). Art and marks only. */
function rulesetDivineAction(
  definition: RulesetDefinition,
  action: Pick<RulesetCombatAction, "entry">,
  row?: Record<string, unknown>,
): boolean {
  const divine = definition.combat?.poses?.divine;
  if (!divine) return false;
  if (action.entry && divine.entries?.includes(action.entry)) return true;
  if (!row || !divine.column || !divine.values) return false;
  const held = row[divine.column];
  const words = (Array.isArray(held) ? held : [held]).filter((one): one is string => typeof one === "string");
  return words.some((word) => divine.values!.some((value) => value.toLowerCase() === word.trim().toLowerCase()));
}

/** A teleport's distances in cells (1.276). */
function rulesetTeleportInCells(teleport: RulesetTeleport, perCell: number): RulesetTeleport {
  return {
    distance: rulesetInCells(teleport.distance, perCell),
    ...(teleport.seen ? { seen: true as const } : {}),
    ...(teleport.carries ? { carries: teleport.carries } : {}),
    ...(teleport.carriesWithin !== undefined ? { carriesWithin: rulesetInCells(teleport.carriesWithin, perCell) } : {}),
    ...(teleport.carriesSeen ? { carriesSeen: true as const } : {}),
    ...(teleport.leaves ? { leaves: true as const } : {}),
    // Its familiarity table (1.670).
    ...(teleport.familiarity ? { familiarity: teleport.familiarity.map((row) => ({ ...row })) } : {}),
    ...(teleport.mishap ? { mishap: { ...teleport.mishap } } : {}),
    ...(teleport.smoke
      ? {
          smoke: {
            ...(teleport.smoke.pierced ? { pierced: [...teleport.smoke.pierced] } : {}),
            ...(teleport.smoke.light ? { light: true as const } : {}),
            ...(teleport.smoke.dispersed ? { dispersed: rulesetCopyDispersed(teleport.smoke.dispersed) } : {}),
          },
        }
      : {}),
  };
}

/**
 * What a catalog entry's `mechanics`, or an item's `use`, does in a fight, as one action: the harm
 * or healing it deals, its save, the conditions it applies, its temporary points, its reach, range
 * and area, and what the turn's economy makes of it. Where it came from says what it is called,
 * which budget it spends, what it adds to hit where it rolls, and what its saves are rolled against.
 */
function mechanicsAction(
  definition: RulesetDefinition,
  mechanics: Partial<RulesetCatalogMechanics> & Pick<RulesetCatalogMechanics, "kind">,
  from: {
    id: string;
    kind: RulesetCombatAction["kind"];
    label: string;
    budget: string;
    toHit: number;
    ability?: string;
    saveDifficulty?: number;
    build: RulesetSheetBuild;
    evaluated: EvaluatedRulesetSheet;
    perCell: number | undefined;
  },
): RulesetCombatAction | null {
  // A reaction answers something, and `reaction: true` says only that much. An entry that names no
  // moment is on no menu at all: not a turn's, because it is not taken on a turn, and not a
  // window's, because nothing here knows which window it belongs in.
  if (mechanics.reaction === true) return null;
  // `false` says the same as leaving it out: not a reaction at all.
  const moment = typeof mechanics.reaction === "object" ? mechanics.reaction : undefined;
  // A `utility` entry has nothing to resolve unless it changes what the turn itself may hold: one
  // that hands a budget back, lets its holder buy a standard action with another one, or stops
  // something from happening at all. Calling something off IS what such an entry does.
  const cancels = moment?.cancels === true;
  // Taking a condition off, steadying the dying or bringing back the dead is something to resolve.
  // Moving a track or giving back sealed health is one too (1.201).
  const cures =
    !!mechanics.ends ||
    !!mechanics.endsSpells ||
    !!mechanics.stabilizes ||
    !!mechanics.revives ||
    !!mechanics.tracks ||
    !!mechanics.unseals;
  // And so is leaving an area standing that only hides or blocks (1.178).
  const places = !!mechanics.zone && !!mechanics.area;
  // Clearing growth from an area is as well (1.318).
  const clears = !!mechanics.clears && !!mechanics.area;
  // Spent when its holder's roll fails is something to resolve too (1.249): Indomitable.
  if (
    mechanics.kind === "utility" &&
    !mechanics.gives &&
    !mechanics.standard &&
    // A way of hiding or finding that is its holder's own (1.292) is read off it.
    !mechanics.hiding &&
    !cancels &&
    !cures &&
    !places &&
    !clears &&
    !mechanics.rescue &&
    !mechanics.alters &&
    !mechanics.conjures &&
    // Making items (1.721): Goodberry.
    !mechanics.makesItems &&
    !mechanics.teleport &&
    // Calling creatures (1.394) is something to resolve: Conjure Animals.
    !mechanics.calls &&
    // So is a strike back, or a missed attack sent on (1.422).
    !mechanics.strikesWith &&
    !mechanics.redirects &&
    // So is stepping in front of an attack (1.509).
    !mechanics.takesAim &&
    // So is keeping a missile caught (1.626).
    !mechanics.keepsCaught &&
    // So is steering a condition (1.464).
    !mechanics.steers &&
    // And casting other entries (1.474): Wish.
    !mechanics.duplicates &&
    // And breaking a layered wall's layer (1.491): Passwall.
    !mechanics.endsLayers &&
    // And an item's use rolled for (1.559): a Wand of Wonder.
    !(mechanics as { rollsTable?: true }).rollsTable &&
    // And ending its user's own condition and nothing else (1.601): Wind Walk's revert.
    !mechanics.endsCondition
  ) {
    return null;
  }
  // Nothing but a wall's layer to break (1.491).
  const onlyEndsLayers =
    !!mechanics.endsLayers &&
    mechanics.kind === "utility" &&
    !mechanics.gives &&
    !mechanics.standard &&
    !mechanics.hiding &&
    !cancels &&
    !cures &&
    !places &&
    !clears &&
    !mechanics.rescue &&
    !mechanics.alters &&
    !mechanics.conjures &&
    !mechanics.teleport &&
    !mechanics.calls &&
    !mechanics.strikesWith &&
    !mechanics.redirects &&
    !mechanics.takesAim &&
    !mechanics.keepsCaught &&
    !mechanics.steers &&
    !mechanics.duplicates;
  const { build, evaluated, perCell } = from;
  const resolve = (ref: RulesetValueRef) => resolveRulesetValueRef(definition, build, ref, evaluated);
  // What the sheet adds to it (1.83), read as the entry is put on the menu: 1d10 plus a level.
  const added = mechanics.amountAdd ? Math.trunc(resolve(mechanics.amountAdd)) : 0;
  const declared = amountOf(mechanics.amount);
  const amount = declared && added ? { ...declared, flat: declared.flat + added } : declared;
  // A scaling amount grows in DICE: the table says how many to add at each step of what it reads.
  const extra = mechanics.scales
    ? Math.max(0, Math.trunc(lookupStepTable(mechanics.scales.table, resolve(mechanics.scales.from))))
    : 0;
  const scaled = amount ? { ...amount, count: amount.count + (amount.count > 0 ? extra : 0) } : null;
  const heals = mechanics.kind === "heal";
  const sourceDifficulty = from.saveDifficulty ?? 0;
  const cost = mechanics.cost?.length === 1 ? mechanics.cost[0]! : undefined;
  const pool = cost ? definition.sheet.live.pools.find((entry2) => entry2.id === cost.pool) : undefined;
  const family = cost ? (pool ? pool.group : cost.pool) : undefined;
  const action: RulesetCombatAction = {
    id: from.id,
    ...(from.ability ? { ability: from.ability } : {}),
    kind: from.kind,
    ...(mechanics.qualities?.length ? { qualities: [...mechanics.qualities] } : {}),
    ...(mechanics.kind === "attack" || mechanics.kind === "debuff" ? { harmful: true as const } : {}),
    label: from.label,
    budget: from.budget,
    targets: grownTargets(targetsOf(mechanics as RulesetCatalogMechanics), mechanics, resolve),
    // Times so many and split among those caught (1.593): the Wand of Wonder's gems.
    ...(mechanics.amountTimes !== undefined ? { damageTimes: mechanics.amountTimes } : {}),
    ...(mechanics.dividedAmong ? { damageDivided: true as const } : {}),
    ...(moment
      ? {
          reaction: {
            on: moment.on,
            // The schema defaults it, but a caller handing entries in unparsed does not, and an
            // `undefined` here would not survive the trip through JSON the state has to make.
            at: moment.at ?? "source",
            ...(moment.cancels ? { cancels: true as const } : {}),
            ...rulesetReactionAnswers(moment, perCell),
            ...(moment.oneOf ? { oneOf: moment.oneOf } : {}),
            ...(moment.cancelSave ? { cancelSave: { ...moment.cancelSave } } : {}),
            ...(moment.upTo ? { upTo: moment.upTo } : {}),
            ...(moment.above
              ? { above: { modifier: Math.trunc(resolve(moment.above.check)), dc: moment.above.dc } }
              : {}),
          },
        }
      : {}),
    // How it is paid for off the sheet: only what a sheet row names is. An item pays with itself.
    ...(from.kind === "ability"
      ? {
          use: {
            // Another entry's uses, by their row's name (1.239): Frenzy spends a rage.
            name: mechanics.usesOf ?? from.label,
            // Paying for it is this entry's own price plus that one counter, not the other entry's.
            ...(mechanics.usesOf
              ? { usesOf: { cost: (mechanics.cost ?? []).map((term) => ({ pool: term.pool, amount: term.amount })) } }
              : {}),
            ...(cost ? { pool: cost.pool } : {}),
            // A cost names a live pool, and then the family is that pool's, or it names the family
            // itself. Left out entirely when there is no family: the state is written as JSON, and a
            // key holding nothing would not survive the trip.
            ...(family ? { group: family } : {}),
            ...(mechanics.perCostStep
              ? { perCostStep: amountOf(mechanics.perCostStep) ?? { count: 0, sides: 0, flat: 0 } }
              : {}),
            ...(mechanics.targetsPerCostStep ? { targetsPerStep: mechanics.targetsPerCostStep } : {}),
            // No more steps count than this (1.241): Divine Smite stops at 5d8.
            ...(mechanics.perCostStepsMax ? { stepsMax: mechanics.perCostStepsMax } : {}),
            // Once for every this many steps (1.300): Flame Blade's two slot levels.
            ...(mechanics.perCostStepsEvery ? { stepsEvery: mechanics.perCostStepsEvery } : {}),
            // More than one of them at once (1.245): Quivering Palm's 3 ki.
            ...(mechanics.usesSpent ? { count: mechanics.usesSpent } : {}),
          },
        }
      : {}),
  };
  const plus = clausesOf(mechanics.plus, sourceDifficulty);
  // All they are missing (1.757), Wish: a heal whatever amount it names.
  if (heals && mechanics.healsAll) {
    action.heal = scaled ?? { count: 0, sides: 0, flat: 0 };
    action.healsAll = true;
  } else if (scaled && heals) action.heal = scaled;
  else if (scaled) {
    action.damage = {
      ...scaled,
      ...(mechanics.damageType ? { type: mechanics.damageType } : {}),
      ...(plus ? { plus } : {}),
      ...(mechanics.qualities?.length ? { qualities: [...mechanics.qualities] } : {}),
    };
  }
  const temporary = amountOf(mechanics.temporary);
  if (temporary) action.temporary = temporary;
  const healthPool = amountOf(mechanics.healthPool);
  if (healthPool) action.healthPool = healthPool;
  if (mechanics.sharesHeal) action.sharesHeal = mechanics.sharesHeal;
  // The one thing it wards off, picked as it is used (1.758): Wish.
  if (mechanics.wardPick && mechanics.applies?.length) action.wardPick = true;
  // Won by a contest of checks, and moved where its user picks (1.565): Telekinesis.
  if (mechanics.contest) {
    action.contested = {
      attacker: [...mechanics.contest.attacker],
      defender: [...mechanics.contest.defender],
      ties: mechanics.contest.ties ?? "defender",
      // What it puts on a target it loses to (1.618): the Pipes of the Sewers' 24 hours unswayed.
      ...(mechanics.contest.onLose ? { onLose: structuredClone(mechanics.contest.onLose) } : {}),
      // What it takes from a target it wins against (1.668): Telekinesis on a held object.
      // Unless it is a mode of its own (1.692), the other mode doing all the rest.
      ...(mechanics.contest.takes && !mechanics.contest.takesMode
        ? { takes: structuredClone(mechanics.contest.takes) }
        : {}),
    };
    if (mechanics.contest.takes && mechanics.contest.takesMode) {
      action.modes = [
        { id: "contest-rest", label: mechanics.contest.takesMode.restLabel },
        {
          id: "contest-takes",
          label: mechanics.contest.takesMode.label,
          takes: structuredClone(mechanics.contest.takes),
        },
      ];
    }
  }
  if (mechanics.movesTarget && from.perCell !== undefined) {
    action.movesTarget = {
      cells: rulesetInCells(mechanics.movesTarget.distance, from.perCell),
      ...(mechanics.movesTarget.up ? { up: true as const } : {}),
    };
  }
  const skips = mechanics.healthPoolSkips;
  if (healthPool && skips) {
    action.healthPoolSkips = {
      ...(skips.conditions ? { conditions: [...skips.conditions] } : {}),
      ...(skips.unseeing ? { unseeing: true } : {}),
    };
  }
  if (mechanics.healthAtMost !== undefined) action.healthAtMost = mechanics.healthAtMost;
  if (mechanics.kills) action.kills = true;
  // Its damage joins its holder's own blow that just hit (1.241).
  if (mechanics.addsToBlow && moment) action.addsToBlow = true;
  // Throws back what its holder just caught (1.416): Deflect Missiles, the missile's own damage.
  // A strike of its holder's own, or a missed attack sent elsewhere (1.422).
  // Or strikes over an area (1.428): Whirlwind Attack, Volley.
  if (mechanics.strikesWith && (moment || mechanics.area)) action.strikesWith = mechanics.strikesWith;
  if (mechanics.redirects && moment) action.redirects = true;
  if (mechanics.takesAim && moment) action.takesAim = true;
  // Keeps the missile caught (1.626): Gloves of Missile Snaring.
  if (mechanics.keepsCaught && moment)
    action.keepsCaught = mechanics.keepsCaught === true ? true : { otherwise: mechanics.keepsCaught.otherwise };
  // Or one die off the sheet where it is the better (1.420): Martial Arts' die.
  if (mechanics.throwsCaught && moment) {
    const die = mechanics.throwsCaught === true ? undefined : mechanics.throwsCaught.die;
    const sides = die ? Math.trunc(lookupStepTable(die.table, resolve(die.from))) : 0;
    action.throwsCaught = sides >= 2 ? { sides } : true;
  }
  // Dice off somebody else's roll that hit (1.250): Cutting Words, its die sized by a level.
  // As many uses as its user chooses, healing that many times over (1.251): Lay on Hands.
  if (mechanics.usesChosen) action.usesChosen = true;
  // Taking rounds to cast (1.461): Symbol's minute.
  if (mechanics.castingRounds) action.castingRounds = mechanics.castingRounds;
  // Set up before a fight only (1.462): Glyph of Warding's hour.
  if (mechanics.beforeFight) action.beforeFight = true;
  // Steering a condition it put on (1.464): Compulsion.
  if (mechanics.steers) action.steers = mechanics.steers;
  // Casting other entries (1.474): Wish.
  if (mechanics.duplicates) action.duplicates = structuredClone(mechanics.duplicates);
  if (mechanics.endsLayers) action.endsLayers = onlyEndsLayers ? { only: true } : {};
  // A ray rolled for each target (1.468): Prismatic Spray.
  if (mechanics.rays) action.rays = structuredClone(mechanics.rays);
  // Changes how another action is used (1.253): Metamagic, its sheet values read now.
  if (mechanics.alters) {
    const alters = mechanics.alters;
    action.alters = {
      catalogs: [...alters.catalogs],
      ...(alters.spares ? { spares: Math.max(0, Math.trunc(resolve(alters.spares))) } : {}),
      ...(alters.range
        ? {
            range: {
              times: alters.range.times,
              ...(alters.range.touch !== undefined && perCell !== undefined
                ? { touch: rulesetInCells(alters.range.touch, perCell) }
                : {}),
            },
          }
        : {}),
      ...(alters.rerolls ? { rerolls: Math.max(0, Math.trunc(resolve(alters.rerolls))) } : {}),
      ...(alters.lasts ? { lasts: alters.lasts } : {}),
      ...(alters.heightens ? { heightens: true as const } : {}),
      ...(alters.budget ? { budget: { ...alters.budget } } : {}),
      ...(alters.drops?.length ? { drops: [...alters.drops] } : {}),
      ...(alters.twins ? { twins: true as const } : {}),
      ...(alters.joins ? { joins: true as const } : {}),
      ...(alters.where ? { where: { ...alters.where } } : {}),
      ...(alters.sparesWhole ? { sparesWhole: true as const } : {}),
      ...(alters.sparesByLevel ? { sparesByLevel: true as const } : {}),
      ...(alters.maximizes ? { maximizes: { ...alters.maximizes } } : {}),
      ...(alters.backlash ? { backlash: { ...alters.backlash } } : {}),
    };
  }
  if (mechanics.usesSpentByLevel) action.usesSpentByLevel = true;
  // Gives back to a pool (1.252): Font of Magic's Sorcery Points, or a slot past its maximum.
  const restored = amountOf(mechanics.restore?.amount);
  if (mechanics.restore && restored) {
    action.restore = {
      pool: mechanics.restore.pool,
      amount: restored,
      ...(mechanics.restore.overMax ? { overMax: true as const } : {}),
    };
  }
  if (mechanics.lowersRoll && moment) {
    const lowers = mechanics.lowersRoll;
    const dice = lowers.dice
      ? parseRulesetCombatDice(lowers.dice)
      : { count: 1, sides: Math.trunc(lookupStepTable(lowers.die!.table, resolve(lowers.die!.from))), flat: 0 };
    if (dice && dice.sides >= 1) {
      action.lowersRoll = {
        count: dice.count,
        sides: dice.sides,
        flat: dice.flat,
        // Off ability checks and damage rolls too (1.257).
        ...(lowers.also ? { also: [...lowers.also] } : {}),
      };
    }
  }
  // A failed save drops its target to 0 instead (1.245): Quivering Palm.
  if (mechanics.dropsOnFailedSave) action.dropsOnFailedSave = true;
  // Only once the attack action has been taken this turn (1.242): Flurry of Blows.
  if (mechanics.afterAttack) action.afterAttack = structuredClone(mechanics.afterAttack);
  // Only before the holder's first attack of their turn (1.247): Reckless Attack.
  if (mechanics.beforeAttack) action.beforeAttack = true;
  // Spent when its holder's own roll has failed, never chosen from a menu (1.249): Indomitable.
  if (mechanics.rescue) {
    const rescue = mechanics.rescue;
    // A die of its own (1.256), sized off its holder's sheet as Martial Arts' is: Peerless Skill.
    const dice = rescue.dice
      ? parseRulesetCombatDice(rescue.dice)
      : rescue.die
        ? { count: 1, sides: Math.trunc(lookupStepTable(rescue.die.table, resolve(rescue.die.from))), flat: 0 }
        : null;
    action.rescue = {
      roll: rescue.roll,
      by: rescue.by,
      ...(rescue.saves ? { saves: [...rescue.saves] } : {}),
      ...(rescue.budget ? { budget: rescue.budget } : {}),
      ...(rescue.against ? { against: structuredClone(rescue.against) } : {}),
      ...(rescue.by === "die" && dice && dice.sides >= 1
        ? { amount: { count: dice.count, sides: dice.sides, flat: dice.flat } }
        : {}),
    };
  }
  // Never on its own user (1.256).
  if (mechanics.notSelf) action.notSelf = true;
  if (mechanics.targetsUpTo) action.targetsUpTo = mechanics.targetsUpTo;
  // Clears growth where it lands (1.318).
  if (mechanics.clears) action.clears = mechanics.clears;
  if (mechanics.oncePerTarget)
    action.oncePerTarget = {
      until: mechanics.oncePerTarget.until,
      ...(mechanics.oncePerTarget.whenSaved ? { whenSaved: true as const } : {}),
    };
  if ("sustains" in mechanics && mechanics.sustains) action.sustains = { budget: mechanics.sustains.budget };
  // Leaving `toHit` unset here would send it down the no-roll path and land it automatically.
  if (mechanics.attackRoll) action.toHit = from.toHit;
  if (mechanics.autoHit) action.autoHit = true;
  // Half its damage on a miss (1.255): Acid Arrow.
  if (mechanics.halfOnMiss && mechanics.attackRoll) action.halfOnMiss = true;
  if (mechanics.needs) action.needs = [...mechanics.needs];
  if (mechanics.needs && mechanics.needsAny) action.needsAny = true;
  if (mechanics.targetsWithin !== undefined && perCell !== undefined) {
    action.targetsWithin = rulesetInCells(mechanics.targetsWithin, perCell);
  }
  if (mechanics.targetsWithinFirst !== undefined && perCell !== undefined) {
    action.targetsWithinFirst = rulesetInCells(mechanics.targetsWithinFirst, perCell);
  }
  if (mechanics.seen) action.seen = true;
  if (mechanics.components) action.components = [...mechanics.components];
  if (mechanics.targetTypes) action.targetTypes = mechanics.targetTypes;
  if (mechanics.maxAgainst) action.maxAgainst = structuredClone(mechanics.maxAgainst);
  // Its roll against a target that is something (1.738): Shocking Grasp at metal armor.
  if (mechanics.against) action.against = structuredClone(mechanics.against);
  const against = mechanics.amountAgainst ? amountOf(mechanics.amountAgainst.amount) : null;
  if (mechanics.amountAgainst && against)
    action.amountAgainst = { is: structuredClone(mechanics.amountAgainst.is), amount: against };
  if (mechanics.usableWhen) action.usableWhen = { ...mechanics.usableWhen };
  if (mechanics.chance) action.chance = structuredClone(mechanics.chance);
  if (mechanics.save) {
    action.save = {
      save: mechanics.save.save,
      onSuccess: mechanics.save.onSuccess,
      difficulty: sourceDifficulty,
      ...(mechanics.save.ignoresCover ? { ignoresCover: true as const } : {}),
      ...(mechanics.save.against ? { against: structuredClone(mechanics.save.against) } : {}),
      ...(mechanics.save.succeeds ? { succeeds: structuredClone(mechanics.save.succeeds) } : {}),
      ...(mechanics.save.modes ? { modes: structuredClone(mechanics.save.modes) } : {}),
      ...(mechanics.save.alliesMayFail ? { alliesMayFail: true as const } : {}),
      ...(mechanics.save.advantageIfFought ? { advantageIfFought: true as const } : {}),
      ...(mechanics.save.or ? { or: mechanics.save.or } : {}),
      ...(mechanics.save.failedBy
        ? {
            failedBy: {
              ...(mechanics.save.failedBy.atLeast !== undefined ? { atLeast: mechanics.save.failedBy.atLeast } : {}),
              ...(mechanics.save.failedBy.resultAtMost !== undefined
                ? { resultAtMost: mechanics.save.failedBy.resultAtMost }
                : {}),
              applies: mechanics.save.failedBy.applies.map((one) => ({ ...one })),
            },
          }
        : {}),
    };
  }
  if (from.saveDifficulty !== undefined) action.saveDifficulty = sourceDifficulty;
  if (mechanics.applies?.length) action.applies = mechanics.applies.map((entry2) => ({ ...entry2 }));
  // What it puts on its own user (1.307): Sunbeam's mote.
  if (mechanics.appliesSelf?.length) action.appliesSelf = mechanics.appliesSelf.map((entry2) => ({ ...entry2 }));
  if (mechanics.appliesSelfSaves && mechanics.appliesSelf?.length) action.appliesSelfSaves = true;
  // The standard actions taken with it (1.313): Expeditious Retreat's Dash.
  if ("takes" in mechanics && mechanics.takes?.length) action.takes = [...mechanics.takes];
  if (mechanics.concentration) action.concentration = true;
  // No concentration from a higher payment up (1.470): Bestow Curse from a 5th-level slot.
  if (mechanics.concentration && mechanics.concentrationBelowStep) {
    action.concentrationBelowStep = mechanics.concentrationBelowStep;
  }
  // What it puts on goes on what it calls (1.479): Antipathy on an object.
  if (mechanics.appliesToCalled) action.appliesToCalled = true;
  if (mechanics.ends) {
    action.ends = {
      // A kind named in place of conditions is every condition of that kind (1.258): one disease.
      conditions: rulesetKindConditions(definition, mechanics.ends.conditions),
      ...(mechanics.ends.count !== undefined ? { count: mechanics.ends.count } : {}),
      ...(mechanics.ends.from ? { from: structuredClone(mechanics.ends.from) } : {}),
      ...(mechanics.ends.chosen ? { chosen: true as const } : {}),
    };
  }
  // Used, it ends a condition on its user (1.236): the spell that gave it.
  // What a catalog's entries put on, ended (1.424): Dispel Magic, its check read off the sheet now.
  if (mechanics.endsSpells) {
    const ends = mechanics.endsSpells;
    action.endsSpells = {
      catalogs: [...ends.catalogs],
      ...(ends.count !== undefined ? { count: ends.count } : {}),
      ...(ends.upTo !== undefined ? { upTo: ends.upTo } : {}),
      ...(ends.above ? { above: { modifier: Math.trunc(resolve(ends.above.check)), dc: ends.above.dc } } : {}),
      ...(ends.chosen ? { chosen: true as const } : {}),
      ...(ends.zones ? { zones: true as const } : {}),
    };
  }
  if (mechanics.endsCondition) action.endsCondition = mechanics.endsCondition;
  // Made again while concentrated on (1.310): Vampiric Touch.
  if ("repeats" in mechanics && mechanics.repeats) action.repeats = { ...mechanics.repeats };
  if (mechanics.usableIn) action.usableIn = { light: [...mechanics.usableIn.light] };
  // Only while its user holds one of these (1.617): the Pipes of the Sewers while played.
  if (mechanics.userHolds) action.userHolds = [...mechanics.userHolds];
  // Only beside a prop (1.332): a verse sung at the Year-Wheel.
  if (mechanics.usableNear && perCell !== undefined)
    action.usableNear = {
      prop: mechanics.usableNear.prop,
      within: rulesetInCells(mechanics.usableNear.within, perCell),
    };
  // Sent out of the fight (1.236): Dismissal, Banishment.
  if (mechanics.dismisses) action.dismisses = structuredClone(mechanics.dismisses);
  // Divine Word (1.450): killed at the lowest health, and only some kinds sent away.
  if (mechanics.killsAtMost !== undefined) action.killsAtMost = mechanics.killsAtMost;
  // Dust at 0 (1.787): Disintegrate.
  if (mechanics.fellsKill) action.fellsKill = true;
  if (mechanics.dismissesIs) action.dismissesIs = structuredClone(mechanics.dismissesIs);
  if (mechanics.stabilizes) action.stabilizes = true;
  if (mechanics.tracks) action.tracks = mechanics.tracks.map((entry) => ({ ...entry }));
  if (mechanics.unseals) action.unseals = true;
  // A lowered maximum, a floor and whom it may be pointed at (1.235): 5e's Harm.
  if (mechanics.reducesMax) action.reducesMax = { ...mechanics.reducesMax };
  // What it dealt comes back to its user (1.281): Vampiric Touch.
  if (mechanics.drain) action.drain = { ...mechanics.drain };
  if (mechanics.leavesAtLeast !== undefined) action.leavesAtLeast = mechanics.leavesAtLeast;
  if (mechanics.targetHolds) action.targetHolds = structuredClone(mechanics.targetHolds);
  // Not while it holds somebody so (1.715): not while grappling.
  if (mechanics.unlessImposing) action.unlessImposing = [...mechanics.unlessImposing];
  // One cure of several (1.204), picked like a weapon's mode: a condition, a track, or the maximum.
  if (mechanics.cureOneOf) {
    action.cureOneOf = true;
    const conditionLabel = (id: string) => definition.sheet.live.conditions.find((one) => one.id === id)?.label ?? id;
    const health = definition.combat?.health;
    const healthLabel =
      health && !("track" in health)
        ? (definition.sheet.live.pools.find((one) => one.id === health.pool)?.label ?? health.pool)
        : "";
    action.modes = [
      ...rulesetKindConditions(definition, mechanics.ends?.conditions ?? []).map((condition) => ({
        id: `ends-${condition}`,
        label: conditionLabel(condition),
        cure: { ends: condition },
      })),
      ...(mechanics.tracks ?? []).map((entry) => ({
        id: `track-${entry.track}`,
        label: definition.sheet.live.tracks.find((one) => one.id === entry.track)?.label ?? entry.track,
        cure: { track: { ...entry } },
      })),
      ...(mechanics.unseals ? [{ id: "unseals", label: healthLabel, cure: { unseals: true as const } }] : []),
    ];
  }
  // One of what it puts on (1.448), picked like a weapon's mode: Primeval Awareness' reach.
  if (mechanics.appliesOneOf && action.applies?.length) {
    action.appliesOneOf = true;
    const conditionLabel = (id: string) => definition.sheet.live.conditions.find((one) => one.id === id)?.label ?? id;
    action.modes = action.applies.map((entry, index) => ({
      id: `applies-${index}`,
      label: conditionLabel(entry.condition),
      appliesPick: index,
    }));
  }
  // A weapon put in hand (1.306): which one is picked as it is used, its modes filled in once the
  // sheet's items and entries are known.
  if (mechanics.conjures) action.conjures = true;
  if (mechanics.makesItems) {
    const lasts = mechanics.makesItems.lasts;
    action.makesItems = {
      ref: mechanics.makesItems.item,
      count: mechanics.makesItems.count,
      // Lasting only so long (1.760): the first unless its user picks another.
      ...(lasts?.length ? { lasts: lasts[0]!.minutes, lasting: true as const } : {}),
    };
    // Picked as it is used where there are several, Creation's materials.
    if (lasts && lasts.length > 1 && !action.modes?.length)
      action.modes = lasts.map((one, index) => ({
        id: `lasts-${index}`,
        label: one.label ?? `${one.minutes}`,
        madeLasts: one.minutes,
      }));
  }
  // A form picked as it is used (1.392), its modes filled in once the fight's bestiary is known.
  if (mechanics.forms) {
    action.shapes = true;
    action.formsOf = structuredClone(mechanics.forms);
  }
  // Creatures it calls (1.394), found once the fight's bestiary is known; options picked as it is used.
  if (mechanics.calls) {
    action.callsOf = structuredClone(mechanics.calls);
    if (mechanics.calls.options) action.callChoice = true;
  }
  // A creature type named as it is used (1.270), picked like a weapon's mode: Antipathy/Sympathy.
  const creatureTypes = definition.combat?.creatureTypes;
  // Or several, the kinds its zone strikes (1.753): Forbiddance.
  // Only among the kinds its targetTypes names, where it names any: Forbiddance's five.
  if (mechanics.kindChoice === "many" && creatureTypes) {
    const among = [...(mechanics.targetTypes?.is?.types ?? []), ...(mechanics.targetTypes?.is?.tags ?? [])];
    action.kindsOf = [...creatureTypes.types, ...(creatureTypes.tags ?? [])]
      .filter((kind) => among.length === 0 || among.includes(kind.id))
      .map((kind) => ({ id: kind.id, label: kind.label }));
  }
  if (mechanics.kindChoice === true && creatureTypes) {
    action.kindChoice = true;
    action.modes = [...creatureTypes.types, ...(creatureTypes.tags ?? [])].map((kind) => ({
      id: `kind-${kind.id}`,
      label: kind.label,
      kind: kind.id,
    }));
  }
  // The damage type named as it is used (1.753), picked like a weapon's mode: Forbiddance's.
  if (mechanics.damageTypeChoice) {
    action.damageTypeChoice = true;
    action.modes = [
      ...(action.modes ?? []),
      ...mechanics.damageTypeChoice.map((type) => ({
        id: `damage-${type
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")}`,
        label: type.trim().charAt(0).toUpperCase() + type.trim().slice(1),
        damageType: type.trim(),
      })),
    ];
  }
  const revival = mechanics.revives && amountOf(mechanics.revives.health);
  if (mechanics.revives && revival) action.revives = { withinRounds: mechanics.revives.withinRounds, amount: revival };
  if (mechanics.summons) {
    const { move, reach, budget, ...summons } = mechanics.summons;
    action.summons = {
      ...summons,
      // One that strikes by itself (1.539) is never commanded, so it spends no budget.
      budget: budget ?? "",
      ...(move !== undefined ? { move: rulesetInCells(move, perCell ?? 1) } : {}),
      ...(reach !== undefined ? { reach: rulesetInCells(reach, perCell ?? 1) } : {}),
    };
  }
  if (mechanics.push !== undefined) action.push = rulesetInCells(mechanics.push, perCell ?? 1);
  if (mechanics.pull !== undefined) action.pull = rulesetInCells(mechanics.pull, perCell ?? 1);
  if (mechanics.pushesOutSaved) action.pushesOutSaved = true;
  // Measured on a board (1.276): a fight without one has nowhere to go, but out of it (1.279).
  if (mechanics.teleport && (perCell !== undefined || mechanics.teleport.leaves)) {
    action.teleport = rulesetTeleportInCells(mechanics.teleport, perCell ?? 1);
    // How well its user knows where it goes (1.670), picked as it is used.
    if (mechanics.teleport.familiarity) {
      action.modes = [
        ...(action.modes ?? []),
        ...mechanics.teleport.familiarity.map((row, index) => ({
          id: `familiar-${row.id}`,
          label: row.label,
          familiar: index,
        })),
      ];
    }
  }
  if (mechanics.zone) action.zone = rulesetZoneAction(mechanics.zone, perCell);
  // What the turn's own economy makes of it: free of a budget, handing budgets back, or letting
  // its holder buy a standard action with a budget other than the main one.
  if (mechanics.free) action.free = true;
  if (mechanics.gives?.length) action.gives = mechanics.gives.map((gift) => ({ ...gift }));
  if (mechanics.standard) {
    action.standard = { actions: [...mechanics.standard.actions], budget: mechanics.standard.budget };
  }
  // Its holder's own ways of hiding and finding (1.292): a permission, its distances in cells.
  if (mechanics.hiding) {
    const { aware, ...rest } = mechanics.hiding;
    action.hiding = {
      ...structuredClone(rest),
      ...(aware
        ? {
            aware: {
              within: rulesetInCells(aware.within, perCell ?? 1),
              ...(aware.lostWith ? { lostWith: [...aware.lostWith] } : {}),
              ...(aware.of ? { of: structuredClone(aware.of) } : {}),
              ...(aware.uncovered ? { uncovered: true as const } : {}),
            },
          }
        : {}),
    };
  }
  // Distance, in the unit this CATALOG declared, or the combat block's when it declared none. A
  // range of zero is self or touch, and touching somebody else is the next cell: a REACH of one,
  // never a range, so the rules for shooting (a foe beside the shooter, long range) do not read it.
  // A shape keeps its range even at zero, because there the number says how far off it may be aimed.
  if (perCell !== undefined) {
    if (mechanics.range === 0 && !mechanics.area) action.reach = 1;
    else if (mechanics.range !== undefined) {
      const normal = rulesetInCells(mechanics.range, perCell);
      // As far again beyond it, made harder as `combat.ranged` says (1.420).
      const long = mechanics.longRange !== undefined ? rulesetInCells(mechanics.longRange, perCell) : undefined;
      action.range = { normal, ...(long !== undefined && long > normal ? { long } : {}) };
    }
    if (mechanics.area && !mechanics.area.around) {
      action.area = {
        shape: mechanics.area.shape,
        // Only its own cell (1.702): a Sphere of Annihilation's 2 feet.
        size: mechanics.area.oneCell ? 0 : rulesetInCells(mechanics.area.size, perCell),
        ...(mechanics.area.width !== undefined ? { width: rulesetInCells(mechanics.area.width, perCell) } : {}),
        ...(mechanics.area.ring !== undefined ? { ring: rulesetInCells(mechanics.area.ring, perCell) } : {}),
        ...(mechanics.area.ringOnly ? { ringOnly: true as const } : {}),
        ...(mechanics.area.copies !== undefined ? { copies: mechanics.area.copies } : {}),
        ...(mechanics.area.copiesWithin !== undefined
          ? { copiesWithin: rulesetInCells(mechanics.area.copiesWithin, perCell) }
          : {}),
        ...(mechanics.area.sizePerCostStep !== undefined
          ? { sizePerCostStep: rulesetInCells(mechanics.area.sizePerCostStep, perCell) }
          : {}),
        ...(mechanics.friendlyFire === false ? { friendlyFire: false } : {}),
      };
    }
  }
  // Centred on its user (1.282), measured with or without a board: off one it catches everybody.
  if (mechanics.area?.around) {
    action.around = {
      size: rulesetInCells(mechanics.area.size, perCell ?? 1),
      ...(mechanics.area.throughWalls ? { throughWalls: true as const } : {}),
      ...(mechanics.friendlyFire === false ? { friendlyFire: false as const } : {}),
    };
  }
  return action;
}

/** Whether one cell of a row says yes. A rider reads a column rather than a word, so a ruleset says
 *  "the rows you can do this with" in its own list without the Engine knowing what a weapon is. */
function truthyColumn(row: Record<string, unknown>, column: string): boolean {
  const value = columnValue(row, column);
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) && value !== 0;
  return typeof value === "string" && value.trim() !== "";
}

/**
 * The attack actions one rider fires on, resolved once when the fight begins.
 *
 * Undefined is "any hit at all", which is what a rider that names neither an attack list, a column
 * nor weapons means. Naming any turns into the ids of the rows and held weapons that qualify, so the
 * resolution never reads a sheet again: the row a rider needs may have been edited by then. A rider
 * that names only weapons fires on no row, and one that names no weapons on no held weapon.
 */
function riderActionIds(
  combat: RulesetCombat,
  build: RulesetSheetBuild,
  rider: NonNullable<RulesetCatalogMechanics["rider"]>,
  items: readonly RulesetSheetItem[] | undefined,
): string[] | undefined {
  if (!rider.sources && !rider.requires && !rider.weapons) return undefined;
  const ids: string[] = [];
  // A held weapon with one of the tags, and its off-hand strike where it has one (`itemAttackActions`'
  // ids).
  items?.forEach((held, index) => {
    if (!rider.weapons || !held.worn || !held.item.attack) return;
    if (!held.item.tags?.some((tag) => rider.weapons!.tags.includes(tag))) return;
    ids.push(`item:${index}`);
    if (held.item.attack.offHand) ids.push(`offhand:${index}`);
  });
  if (!rider.sources && !rider.requires) return ids;
  (combat.attacks ?? []).forEach((source, index) => {
    if (rider.sources && !rider.sources.includes(source.list)) return;
    const rows = build.lists?.[source.list];
    if (!Array.isArray(rows)) return;
    rows.forEach((raw, rowIndex) => {
      if (!raw || typeof raw !== "object") return;
      if (rider.requires && !truthyColumn(raw as Record<string, unknown>, rider.requires.column)) return;
      ids.push(`attack:${index}:${rowIndex}`);
    });
  });
  return ids;
}

/** The name a row answers to: the column the Game Master sees it under, then the entry's label. */
function rowName(definition: RulesetDefinition, listId: string, row: Record<string, unknown>, fallback: string) {
  const list = definition.sheet.lists.find((entry) => entry.id === listId);
  const column =
    definition.gm.sheetSummary.lists.find((entry) => entry.list === listId)?.nameColumn ??
    list?.pools?.nameColumn ??
    list?.columns.find((entry) => entry.type === "text")?.id;
  return textFromColumn(row, column) ?? fallback;
}

/** One rider a catalog entry carries, with its dice grown by the sheet exactly as an amount's are
 *  and the rows and held weapons it fires on already worked out. */
function riderFrom(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  build: RulesetSheetBuild,
  evaluated: EvaluatedRulesetSheet,
  id: string,
  label: string,
  mechanics: RulesetCatalogMechanics,
  items: readonly RulesetSheetItem[] | undefined,
): RulesetCombatRider | null {
  const declared = mechanics.rider;
  const amount = declared ? amountOf(declared.amount) : null;
  if (!declared || !amount) return null;
  const extra = mechanics.scales
    ? Math.max(
        0,
        Math.trunc(
          lookupStepTable(
            mechanics.scales.table,
            resolveRulesetValueRef(definition, build, mechanics.scales.from, evaluated),
          ),
        ),
      )
    : 0;
  const actions = riderActionIds(combat, build, declared, items);
  return {
    id,
    label,
    on: declared.on,
    ...(actions ? { actions } : {}),
    ...(declared.when?.length ? { when: [...declared.when] } : {}),
    oncePer: declared.oncePer,
    amount: { ...amount, count: amount.count + (amount.count > 0 ? extra : 0) },
    ...(declared.type ? { type: declared.type } : {}),
  };
}

function abilityActions(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  source: RulesetCombatAbilitySource,
  index: number,
  build: RulesetSheetBuild,
  catalogs: RulesetCatalogEntriesById,
  evaluated: EvaluatedRulesetSheet,
  perCell: number | undefined,
  items: readonly RulesetSheetItem[] | undefined,
): { actions: RulesetCombatAction[]; riders: RulesetCombatRider[] } {
  const rows = build.lists?.[source.list];
  if (!Array.isArray(rows)) return { actions: [], riders: [] };
  const byRef = rulesetCatalogEntriesByRef(catalogs);
  const listColumns = definition.sheet.lists.find((entry) => entry.id === source.list)?.columns ?? [];
  // Where the menu shows what the list gives (1.378): under the list's own tab, split as it is.
  const display = definition.sheet.lists.find((list) => list.id === source.list)?.display;
  /** A catalog states what its own `range` and `area.size` numbers mean; one that does not is read
   *  in the combat block's own unit. */
  const perCellOf = (ref: string) => {
    if (perCell === undefined) return undefined;
    const catalogId = ref.slice(0, ref.indexOf("/"));
    return definition.catalogs?.find((catalog) => catalog.id === catalogId)?.units?.distance?.perCell ?? perCell;
  };
  const actions: RulesetCombatAction[] = [];
  const riders: RulesetCombatRider[] = [];
  const seen = new Set<string>();
  rows.forEach((raw, rowIndex) => {
    if (!raw || typeof raw !== "object") return;
    const row = raw as Record<string, unknown>;
    // A row that stands for another entry (1.493) is that entry in a fight.
    const ref = rulesetRowEntryRef(row);
    // A hand-typed row says nothing in numbers, so there is nothing to resolve.
    if (typeof ref !== "string" || seen.has(ref)) return;
    const always = source.alwaysWhen && columnValue(row, source.alwaysWhen.column) === source.alwaysWhen.equals;
    if (!always && source.onlyWhen && columnValue(row, source.onlyWhen) !== true) return;
    const entry = byRef.get(ref);
    if (!entry) return;
    const name = rowName(definition, source.list, row, entry.label);
    // A rider is passive: it never becomes an action, and it is carried by whoever holds the row.
    if (entry.mechanics?.kind === "rider") {
      const rider = riderFrom(
        definition,
        combat,
        build,
        evaluated,
        `rider:${index}:${rowIndex}`,
        name,
        entry.mechanics,
        items,
      );
      if (!rider) return;
      seen.add(ref);
      riders.push(rider);
      return;
    }
    // The row it came from (1.437): Druid spells, not a wizard's. A cell the row lacks reads as its
    // column's default (1.438), as a spell the builder added from a catalog carries no class.
    const values: Record<string, string> = {};
    for (const column of listColumns) {
      if (typeof column.default === "string" && column.default.length <= 80) values[column.id] = column.default;
    }
    for (const [key, value] of Object.entries(row)) {
      if (typeof value === "string" && value.length <= 80) values[key] = value;
    }
    // The entry, then each of its variants (1.769): one row of Chromatic Orb is each of its kinds,
    // named by the variant's own label and paid for off the same row.
    const catalogId = ref.slice(0, ref.indexOf("/"));
    const ways = [
      { ref, entry, name, id: `ability:${index}:${rowIndex}` },
      ...(entry.variants ?? []).flatMap((variantId, at) => {
        const variant = byRef.get(`${catalogId}/${variantId}`);
        return variant
          ? [
              {
                ref: `${catalogId}/${variantId}`,
                entry: variant,
                name: variant.label,
                id: `ability:${index}:${rowIndex}:${at}`,
              },
            ]
          : [];
      }),
    ];
    for (const way of ways) {
      const action = abilityAction(
        definition,
        source,
        row,
        index,
        rowIndex,
        name,
        way.entry,
        build,
        evaluated,
        perCellOf(way.ref),
      );
      if (!action) continue;
      action.id = way.id;
      action.label = way.name;
      if (way !== ways[0]) {
        action.variantOf = ways[0]!.id;
        action.variantName = ways[0]!.name;
      }
      // Which catalog it came from, and which entry, which is what a reaction that answers only some
      // entries reads.
      action.catalog = catalogId;
      action.entry = way.ref;
      // Cast by praying (1.786), by the row it came from or its entry.
      if (rulesetDivineAction(definition, action, values)) action.divine = true;
      // What its filters read, for a ward's `where` (1.645): from a catalog file too.
      if (way.entry.filters) action.filters = structuredClone(way.entry.filters);
      action.fromRow = { list: source.list, values: { ...values } };
      if (display?.tab) {
        const place = display.by ? columnValue(row, display.by.column) : undefined;
        const order = typeof place === "number" && Number.isInteger(place) ? place : undefined;
        const sub = order !== undefined ? display.by!.labels[order] : undefined;
        action.menuGroup = { label: display.tab, ...(sub !== undefined ? { sub: { label: sub, order: order! } } : {}) };
      }
      seen.add(way.ref);
      actions.push(action);
    }
    seen.add(ref);
  });
  return { actions, riders };
}

/** Spells a creature casts without paying off a sheet (1.123). The entry still supplies everything
 *  it does; only its numbers, level and remaining uses belong to the creature. */
function innateActions(
  definition: RulesetDefinition,
  block: RulesetStatBlock,
  catalogs: RulesetCatalogEntriesById,
  perCell: number | undefined,
): RulesetCombatAction[] {
  const casting = block.spellcasting;
  if (!casting) return [];
  const build = block.sheet ?? rulesetSheetBuildSchema.parse({});
  const evaluated = evaluateRulesetSheetLive(definition, build, {});
  const byRef = rulesetCatalogEntriesByRef(catalogs);
  return casting.spells.flatMap((spell) => {
    const parent = byRef.get(spell.entry);
    if (!parent) return [];
    const catalogId = spell.entry.split("/")[0]!;
    // The spell, then each of its variants (1.769): Chromatic Orb's kinds, each cast by its own
    // label from the spell's own uses and slots.
    const ways = [
      { ref: spell.entry, entry: parent },
      ...(parent.variants ?? []).flatMap((id) => {
        const variant = byRef.get(`${catalogId}/${id}`);
        return variant ? [{ ref: `${catalogId}/${id}`, entry: variant, variantOf: spell.entry }] : [];
      }),
    ];
    return ways.flatMap(({ ref, entry, ...way }) => {
      if (!entry.mechanics) return [];
      const header = definition.catalogs?.find((catalog) => catalog.id === catalogId);
      const source = definition.combat?.abilities?.find((ability) =>
        entry.rows?.some((row) => row.list === ability.list),
      );
      const resolve = (value: RulesetValueRef) => resolveRulesetValueRef(definition, build, value, evaluated);
      // A spell's own numbers before its trait's (1.642).
      const difficulty =
        spell.saveDifficulty ??
        casting.saveDifficulty ??
        (source?.saveDifficulty ? resolve(source.saveDifficulty) : undefined);
      const action = mechanicsAction(definition, entry.mechanics, {
        id: ref,
        kind: "ability",
        label: entry.label,
        budget: entry.mechanics.budget ?? source?.budget ?? definition.combat!.economy.budgets[0]!.id,
        toHit:
          spell.toHit ??
          casting.toHit ??
          (source?.toHit ? resolve(source.toHit) : 0) + fightAdjust(definition, build, evaluated, source?.toHit),
        ...(difficulty !== undefined ? { saveDifficulty: difficulty } : {}),
        build,
        evaluated,
        perCell: perCell === undefined ? undefined : (header?.units?.distance?.perCell ?? perCell),
      });
      if (!action) return [];
      action.catalog = catalogId;
      action.entry = ref;
      if (rulesetDivineAction(definition, action)) action.divine = true;
      if (ref !== spell.entry && spell.uses) action.usesKey = spell.entry;
      if ("variantOf" in way) {
        action.variantOf = way.variantOf;
        action.variantName = parent.label;
      }
      // What its filters read, for a ward's `where` (1.645): from a catalog file too.
      if (entry.filters) action.filters = structuredClone(entry.filters);
      const baseLevel = rulesetPaidLevel(definition, { sheet: { build, live: {}, catalogs: {} } }, action);
      action.innate = {
        level: spell.level ?? baseLevel,
        baseLevel,
        ...(spell.coven && casting.coven
          ? { coven: { ...casting.coven, within: casting.coven.within / (perCell ?? 1) } }
          : {}),
        // Paid with a slot (1.642).
        ...(casting.slots && !spell.uses && (spell.level ?? baseLevel) >= 1
          ? { slot: spell.level ?? baseLevel, slots: { ...casting.slots } }
          : {}),
      };
      if (spell.uses) action.uses = { ...spell.uses };
      // What casting it this way needs, said by the spell or its trait, in place of the entry's (1.181).
      const components = spell.components ?? casting.components;
      if (components?.length) action.components = [...components];
      else if (components) delete action.components;
      return [action];
    });
  });
}

/** An entry stored in an item or a creature (1.524), cast once from there by its holder for nothing:
 *  at the level it was paid at, with its caster's save difficulty and attack, needing none of its
 *  components. `item` is the item's place on the holder's sheet, none for a creature that stores;
 *  `by` names what it is cast from. Null for an entry with nothing to do in a fight. */
export function rulesetStoredAction(
  definition: RulesetDefinition,
  entry: RulesetCatalogEntry,
  record: RulesetStoredEntry,
  item: number | undefined,
  by: string,
  id: string,
  build: RulesetSheetBuild,
  evaluated: EvaluatedRulesetSheet,
  perCell: number | undefined,
): RulesetCombatAction | null {
  if (!entry.mechanics || !definition.combat) return null;
  const catalogId = record.entry.slice(0, record.entry.indexOf("/"));
  const header = definition.catalogs?.find((catalog) => catalog.id === catalogId);
  const source = definition.combat.abilities?.find((ability) => entry.rows?.some((row) => row.list === ability.list));
  const action = mechanicsAction(definition, entry.mechanics, {
    id,
    kind: "ability",
    label: `${by}: ${entry.label}`,
    budget: entry.mechanics.budget ?? source?.budget ?? definition.combat.economy.budgets[0]!.id,
    toHit: record.toHit ?? 0,
    ...(record.saveDifficulty !== undefined ? { saveDifficulty: record.saveDifficulty } : {}),
    build,
    evaluated,
    perCell: perCell === undefined ? undefined : (header?.units?.distance?.perCell ?? perCell),
  });
  if (!action) return null;
  action.catalog = catalogId;
  action.entry = record.entry;
  // What its filters read, for a ward's `where` (1.645): from a catalog file too.
  if (entry.filters) action.filters = structuredClone(entry.filters);
  const baseLevel = rulesetPaidLevel(definition, { sheet: { build, live: {}, catalogs: {} } }, action);
  action.innate = { level: Math.max(record.level, baseLevel), baseLevel };
  action.uses = { per: "encounter", count: 1 };
  delete action.components;
  action.storedIn = { ...(item !== undefined ? { item } : {}), record: { ...record } };
  return action;
}

/** What is stored in each item a member holds that stores (1.524), as its stack keeps it. */
function storedItemActions(
  definition: RulesetDefinition,
  items: ReadonlyArray<RulesetSheetItem> | undefined,
  byRef: ReturnType<typeof rulesetCatalogEntriesByRef>,
  build: RulesetSheetBuild,
  evaluated: EvaluatedRulesetSheet,
  perCell: number | undefined,
): RulesetCombatAction[] {
  return (items ?? []).flatMap((held, index) =>
    held.item.stores
      ? (held.storedEntries ?? []).flatMap((record, n) => {
          const entry = byRef.get(record.entry);
          const action = entry
            ? rulesetStoredAction(
                definition,
                entry,
                record,
                index,
                held.name ?? held.stack?.ref ?? "",
                `stored:${index}:${n}`,
                build,
                evaluated,
                perCell,
              )
            : null;
          return action ? [action] : [];
        })
      : [],
  );
}

/** What a creature that stores holds as the fight starts (1.524). */
function storedBlockActions(
  definition: RulesetDefinition,
  block: RulesetStatBlock,
  name: string,
  stored: readonly RulesetStoredEntry[] | undefined,
  catalogs: RulesetCatalogEntriesById,
  perCell: number | undefined,
): RulesetCombatAction[] {
  if (!block.stores || !stored?.length) return [];
  const build = block.sheet ?? rulesetSheetBuildSchema.parse({});
  const evaluated = evaluateRulesetSheetLive(definition, build, {});
  const byRef = rulesetCatalogEntriesByRef({
    ...Object.fromEntries((definition.catalogs ?? []).map((catalog) => [catalog.id, catalog.entries ?? []])),
    ...catalogs,
  });
  return stored.slice(0, block.stores.count ?? 20).flatMap((record, n) => {
    const entry = byRef.get(record.entry);
    const action = entry
      ? rulesetStoredAction(definition, entry, record, undefined, name, `stored:self:${n}`, build, evaluated, perCell)
      : null;
    return action ? [action] : [];
  });
}

/** What the conditions of the fight let their holder use while they hold (1.236), put on everybody's
 *  list now and offered only while they hold it: 5e's Dispel Evil and Good, whose Break Enchantment
 *  and Dismissal are its caster's. Their numbers are the holder's own, as their spells' are; a
 *  creature that casts reads its casting's. */
function conditionActions(
  definition: RulesetDefinition,
  combatant: RulesetCombatant,
  byRef: ReturnType<typeof rulesetCatalogEntriesByRef>,
  perCell: number | undefined,
): RulesetCombatAction[] {
  const granting = (definition.combat?.conditions ?? []).filter(
    (condition) => condition.actions?.length || condition.endable,
  );
  if (granting.length === 0) return [];
  const build = combatant.sheet?.build ?? combatant.block?.sheet ?? rulesetSheetBuildSchema.parse({});
  const evaluated = evaluateRulesetSheetLive(definition, build, combatant.sheet?.live ?? {});
  const casting = combatant.block?.spellcasting;
  const resolve = (ref: RulesetValueRef) => resolveRulesetValueRef(definition, build, ref, evaluated);
  return granting
    .flatMap((condition) =>
      (condition.actions ?? []).flatMap((one) => {
        // At numbers of its own (1.634), whatever its holder's: a Potion of Animal Friendship's DC 13.
        const ref = typeof one === "string" ? one : one.entry;
        const fixed = typeof one === "string" ? undefined : one;
        const entry = byRef.get(ref);
        if (!entry?.mechanics) return [];
        const catalogId = ref.slice(0, ref.indexOf("/"));
        const header = definition.catalogs?.find((catalog) => catalog.id === catalogId);
        const source = definition.combat?.abilities?.find((ability) =>
          entry.rows?.some((row) => row.list === ability.list),
        );
        const difficulty =
          fixed?.saveDifficulty ??
          casting?.saveDifficulty ??
          (source?.saveDifficulty ? resolve(source.saveDifficulty) : undefined);
        const action = mechanicsAction(definition, entry.mechanics, {
          id: `granted:${condition.condition}:${ref}`,
          kind: "ability",
          label: entry.label,
          budget: entry.mechanics.budget ?? source?.budget ?? definition.combat!.economy.budgets[0]!.id,
          toHit:
            fixed?.toHit ??
            casting?.toHit ??
            (source?.toHit ? resolve(source.toHit) : 0) + fightAdjust(definition, build, evaluated, source?.toHit),
          ...(difficulty !== undefined ? { saveDifficulty: difficulty } : {}),
          build,
          evaluated,
          perCell: perCell === undefined ? undefined : (header?.units?.distance?.perCell ?? perCell),
        });
        if (!action) return [];
        action.catalog = catalogId;
        action.entry = ref;
        if (rulesetDivineAction(definition, action)) action.divine = true;
        // What its filters read, for a ward's `where` (1.645): from a catalog file too.
        if (entry.filters) action.filters = structuredClone(entry.filters);
        action.whileHolds = condition.condition;
        // Grown by the cost the condition was put on with (1.300), not one of its own.
        const per = action.use?.perCostStep;
        if (per) {
          action.heldSteps = {
            amount: per,
            ...(action.use!.stepsEvery ? { every: action.use!.stepsEvery } : {}),
            ...(action.use!.stepsMax ? { max: action.use!.stepsMax } : {}),
          };
        }
        // Paid for by the condition that gives it: nothing off the sheet.
        delete action.use;
        return [action];
      }),
    )
    .concat(
      // Taken off at will (1.622): the Ring of Invisibility's bonus action to be seen again.
      granting.flatMap((condition) => {
        if (!condition.endable) return [];
        const label = definition.sheet.live.conditions.find((one) => one.id === condition.condition)?.label;
        const action = mechanicsAction(
          definition,
          { kind: "utility", targets: "self", budget: condition.endable.budget, endsCondition: condition.condition },
          {
            id: `end-condition:${condition.condition}`,
            kind: "ability",
            label: `End ${label ?? condition.condition}`,
            budget: condition.endable.budget,
            toHit: 0,
            build,
            evaluated,
            perCell,
          },
        );
        if (!action) return [];
        action.whileHolds = condition.condition;
        // Paid for with its budget alone: nothing off the sheet.
        delete action.use;
        return [action];
      }),
    );
}

/** Only the entries this member's own rows point at, so the state stays small enough to persist
 *  while `use` still knows what every ability costs. */
function narrowCatalogs(build: RulesetSheetBuild, catalogs: RulesetCatalogEntriesById): RulesetCatalogEntriesById {
  const refs = new Set<string>();
  for (const rows of Object.values(build.lists ?? {})) {
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      if (!row || typeof row !== "object") continue;
      // Both the entry a row came from and the one it stands for (1.493).
      for (const ref of [
        columnValue(row as Record<string, unknown>, RULESET_CATALOG_ROW_KEY),
        rulesetRowEntryRef(row as Record<string, unknown>),
      ]) {
        if (typeof ref === "string") refs.add(ref);
      }
    }
  }
  // And every variant of those (1.769), which a row of its parent is used as.
  for (const [catalogId, entries] of Object.entries(catalogs)) {
    for (const entry of entries) {
      if (refs.has(`${catalogId}/${entry.id}`)) for (const id of entry.variants ?? []) refs.add(`${catalogId}/${id}`);
    }
  }
  const narrowed: Record<string, RulesetCatalogEntry[]> = {};
  for (const [catalogId, entries] of Object.entries(catalogs)) {
    const kept = entries.filter((entry) => refs.has(`${catalogId}/${entry.id}`));
    if (kept.length > 0) narrowed[catalogId] = kept;
  }
  return narrowed;
}

/** A legendary move that does nothing else (1.283); one that does something first moves after it
 *  (1.285). */
export function rulesetMovesOnly(action: {
  move?: unknown;
  damage?: unknown;
  heal?: unknown;
  applies?: unknown;
  area?: unknown;
  around?: unknown;
  save?: unknown;
  ends?: unknown;
  push?: unknown;
  pull?: unknown;
  toHit?: unknown;
  autoHit?: unknown;
}): boolean {
  return (
    !!action.move &&
    [
      action.damage,
      action.heal,
      action.applies,
      action.area,
      action.around,
      action.save,
      action.ends,
      action.push,
      action.pull,
      action.toHit,
      action.autoHit,
    ].every((one) => one === undefined || one === false)
  );
}

function blockActions(
  definition: RulesetDefinition,
  block: RulesetStatBlockLike,
  perCell: number | undefined,
): RulesetCombatAction[] {
  const idOf = (index: number) => block.actions[index]?.id ?? `block:${index}`;
  const indexById = new Map(block.actions.map((action, index) => [action.id ?? `block:${index}`, index]));
  /** A block writes its distances in the ruleset's own unit, and a plain number is the ordinary
   *  distance with nothing beyond it. A range of zero is no range at all, as it is on an attack row:
   *  the action is a swing at its reach, never a shot. */
  const rangeOf = (range: RulesetStatBlockAction["range"]) => {
    if (range === undefined || perCell === undefined) return undefined;
    const written = typeof range === "number" ? range : range.normal;
    if (written <= 0) return undefined;
    const normal = rulesetInCells(written, perCell);
    const long =
      typeof range === "number" || range.long === undefined ? undefined : rulesetInCells(range.long, perCell);
    return { normal, ...(long !== undefined && long > normal ? { long } : {}) };
  };
  const built: RulesetCombatAction[] = block.actions.map((action, index) => ({
    id: idOf(index),
    kind: "block" as const,
    label: action.name,
    budget: action.budget,
    ...(action.onDeath ? { onDeath: true as const } : {}),
    // A sequence may be pointed at as many targets as all of its parts together, so a caller can
    // send each strike somewhere else. Fewer is legal too: every part takes the ones it was given.
    // One that lands on the creature itself points at nobody: its effect is its own.
    // So does a teleport (1.276): where it goes is its choice, not whom.
    targets:
      action.self ||
      action.teleport ||
      action.area?.around ||
      rulesetMovesOnly(action) ||
      action.casting ||
      action.search ||
      action.standard ||
      action.sheds !== undefined ||
      // Calling creatures, and nothing aimed (1.325).
      (action.calls && !action.area && !action.damage)
        ? { side: "self" as const, count: 0 }
        : {
            // An area catches each creature in it, the creature's allies too (1.192): off a board it may
            // be pointed at either side, unless it spares its own.
            side: action.targets ?? (action.area && action.area.friendlyFire !== false ? "any" : ("enemy" as const)),
            count: action.sequence
              ? Math.max(
                  1,
                  action.sequence.reduce((total, step) => {
                    const named = block.actions[indexById.get(step.action) ?? -1];
                    // Made at the one an earlier step hit (1.643), it takes no target of its own.
                    if (step.ifHit !== undefined) return total;
                    // Once per head (1.550): as many as it may ever have. Rolled for (1.643): as
                    // many as its dice may come to.
                    const times = step.dice
                      ? step.dice.count * step.dice.sides
                      : step.perHead
                        ? step.times * (block.heads?.max ?? block.heads?.count ?? 1)
                        : step.times;
                    return total + (named ? Math.max(1, named.targetCount ?? 1) * times : 0);
                  }, 0),
                )
              : Math.max(1, action.targetCount ?? 1),
          },
    ...(action.toHit !== undefined ? { toHit: action.toHit } : {}),
    ...(action.upgrades ? { upgrades: action.upgrades } : {}),
    ...(action.autoHit ? { autoHit: true } : {}),
    ...(action.needs ? { needs: [...action.needs] } : {}),
    ...(action.needs && action.needsAny ? { needsAny: true as const } : {}),
    ...(action.seen ? { seen: true as const } : {}),
    ...(action.components ? { components: [...action.components] } : {}),
    ...(action.damage
      ? {
          damage: {
            ...action.damage,
            ...(action.damage.plus ? { plus: action.damage.plus.map((clause) => ({ ...clause })) } : {}),
          },
        }
      : {}),
    ...(action.heal ? { heal: { ...action.heal } } : {}),
    ...(action.qualities ? { qualities: [...action.qualities] } : {}),
    // A kind is every condition of it (1.258), as a catalog entry's cure reads it.
    ...(action.ends
      ? {
          ends: {
            conditions: rulesetKindConditions(definition, action.ends.conditions),
            ...(action.ends.count !== undefined ? { count: action.ends.count } : {}),
            ...(action.ends.from ? { from: structuredClone(action.ends.from) } : {}),
          },
        }
      : {}),
    ...(action.save ? { save: structuredClone(action.save) } : {}),
    ...(action.saveDifficulty !== undefined ? { saveDifficulty: action.saveDifficulty } : {}),
    ...(action.applies?.length ? { applies: action.applies.map((entry) => ({ ...entry })) } : {}),
    // Held by its maker's concentration (1.307): an imp's Invisibility.
    ...(action.concentration ? { concentration: true } : {}),
    // Consume Life (1.311).
    ...(action.dyingOnly ? { dyingOnly: true as const } : {}),
    ...(action.inShape ? { inShape: [...action.inShape] } : {}),
    ...(action.whileFlying ? { whileFlying: true as const } : {}),
    ...(action.castsOne ? { castsOne: true as const } : {}),
    ...(action.slaysOnFailedSave ? { slaysOnFailedSave: true as const } : {}),
    ...(action.slaysHealthAtMost !== undefined ? { slaysHealthAtMost: action.slaysHealthAtMost } : {}),
    ...(action.dropsOnFailedSave ? { dropsOnFailedSave: true as const } : {}),
    // What each use does, in turn (1.687): an androsphinx's Roar.
    ...(action.byUse ? { byUse: action.byUse.filter((id) => indexById.has(id)) } : {}),
    // What goes on after the blow only on a target that is this (1.698): a merrow's Harpoon.
    ...(action.ridersIs ? { ridersIs: structuredClone(action.ridersIs) } : {}),
    // What it puts on waits on a contest it wins (1.695): a merrow's Harpoon.
    ...(action.contest
      ? {
          contested: {
            attacker: [...action.contest.attacker],
            defender: [...action.contest.defender],
            ties: action.contest.ties ?? "defender",
            riders: true as const,
          },
        }
      : {}),
    // Out of the fight, its own creature too (1.685): a ghost's Etherealness.
    ...(action.dismisses
      ? {
          dismisses:
            action.dismisses === true
              ? (true as const)
              : {
                  ...structuredClone(action.dismisses),
                  ...(action.dismisses.carries
                    ? {
                        carries: {
                          ...action.dismisses.carries,
                          within: rulesetInCells(action.dismisses.carries.within, perCell ?? 1),
                        },
                      }
                    : {}),
                },
        }
      : {}),
    // Never on the same creature again (1.674): Frightful Presence.
    ...(action.oncePerTarget ? { sparedAfter: { ...action.oncePerTarget } } : {}),
    ...(action.reaps ? { reaps: true as const } : {}),
    // A printed chance (1.441): a demon's summoning.
    ...(action.chance ? { chance: { ...action.chance } } : {}),
    // An area that stays, and the ground changed (1.324): The Owed's Freezing Fog, a bonfire guttering.
    ...(action.zone ? { zone: rulesetZoneAction(action.zone, perCell) } : {}),
    ...(action.ground ? { ground: structuredClone(action.ground) } : {}),
    // Whisper a Name (1.326).
    ...(action.draws ? { draws: { ...action.draws } } : {}),
    // Engulf and Whelm (1.403).
    ...(action.engulf ? { engulf: structuredClone(action.engulf) } : {}),
    // Deadly Leap (1.725).
    ...(action.leapsOnto ? { leapsOnto: { ...action.leapsOnto } } : {}),
    // Luring Song (1.727).
    ...(action.sustains ? { sustains: { budget: action.sustains.budget } } : {}),
    // Aimed only at whoever is this, and what a sequence does once all of it hit (1.405).
    ...(action.targetTypes ? { targetTypes: structuredClone(action.targetTypes) } : {}),
    ...(action.allHit ? { allHit: structuredClone(action.allHit) } : {}),
    // The Hour Bell, and the Litany broken (1.327).
    ...(action.actedOnly ? { actedOnly: true as const } : {}),
    ...(action.brokenNextLair ? { brokenNextLair: action.brokenNextLair } : {}),
    // Its forms (1.392), found in the bestiary once the fight is built.
    ...(action.forms ? { shapes: true as const, formsOf: structuredClone(action.forms) } : {}),
    ...(action.healsOnSlay ? { healsOnSlay: { ...action.healsOnSlay } } : {}),
    ...(action.uses ? { uses: { ...action.uses } } : {}),
    ...(action.recharge
      ? {
          recharge: {
            dice: { ...action.recharge.dice },
            from: action.recharge.from,
            ...(action.recharge.group ? { group: action.recharge.group } : {}),
          },
        }
      : {}),
    ...(action.sequence
      ? {
          sequence: rulesetKeptSteps(action.sequence, (step) => indexById.has(step.action)).map((step) => ({
            actionId: step.action,
            times: step.times,
            ...(step.perHead ? { perHead: true as const } : {}),
            // Rolled for, after an earlier step's hit, left out at will (1.643).
            ...(step.dice ? { dice: { ...step.dice } } : {}),
            ...(step.ifHit !== undefined ? { ifHit: step.ifHit } : {}),
            ...(step.optional ? { optional: true as const } : {}),
          })),
        }
      : {}),
    ...(action.signature ? { signature: { cost: action.signature.cost } } : {}),
    ...(action.lair ? { lair: true as const } : {}),
    // Free, and only before its first attack of its own turn (1.606): a berserker's Reckless.
    ...(action.free ? { free: true as const } : {}),
    ...(action.beforeAttack ? { beforeAttack: true as const } : {}),
    ...(action.reaction
      ? {
          reaction: {
            on: action.reaction.on,
            at: action.reaction.at ?? "source",
            ...(action.reaction.cancels ? { cancels: true as const } : {}),
            ...rulesetReactionAnswers(action.reaction, perCell),
            ...(action.reaction.cancelSave ? { cancelSave: { ...action.reaction.cancelSave } } : {}),
            ...(action.reaction.upTo ? { upTo: action.reaction.upTo } : {}),
            ...(action.reaction.above
              ? { above: { modifier: action.reaction.above.check.const ?? 0, dc: action.reaction.above.dc } }
              : {}),
          },
        }
      : {}),
    ...(action.ability ? { ability: action.ability } : {}),
    ...(action.reducesMax ? { reducesMax: { ...action.reducesMax } } : {}),
    ...(action.callerAdds === false ? { callerAdds: false as const } : {}),
    ...(action.perCallerStep ? { perCallerStep: { ...action.perCallerStep } } : {}),
    ...(action.drain ? { drain: { ...action.drain } } : {}),
    // A legendary move (1.283): a board's business, so its distance is in cells.
    ...(action.move
      ? {
          move: {
            ...action.move,
            ...(action.move.distance !== undefined
              ? { distance: rulesetInCells(action.move.distance, perCell ?? 1) }
              : {}),
          },
        }
      : {}),
    // A legendary cast (1.284): its maker's own spells, offered between turns.
    ...(action.casting ? { casting: { ...action.casting } } : {}),
    // A legendary Detect (1.287).
    ...(action.search ? { search: true as const } : {}),
    // Its light lit or put out (1.296), in the ruleset's distance as every light is.
    ...(action.sheds !== undefined ? { sheds: action.sheds === "out" ? ("out" as const) : { ...action.sheds } } : {}),
    // A permission (1.291): standard actions taken with this action's own budget.
    ...(action.standard
      ? {
          standard: {
            actions: [...action.standard.actions],
            budget: action.budget,
            ...(action.standard.while ? { while: action.standard.while } : {}),
          },
        }
      : {}),
    ...(action.targetHolds ? { targetHolds: structuredClone(action.targetHolds) } : {}),
    ...(action.unlessImposing ? { unlessImposing: [...action.unlessImposing] } : {}),
    ...(perCell !== undefined && action.push !== undefined ? { push: rulesetInCells(action.push, perCell) } : {}),
    ...(perCell !== undefined && action.pull !== undefined ? { pull: rulesetInCells(action.pull, perCell) } : {}),
    ...(action.onFell ? { onFell: structuredClone(action.onFell) } : {}),
    ...(action.teleport && (perCell !== undefined || action.teleport.leaves)
      ? { teleport: rulesetTeleportInCells(action.teleport, perCell ?? 1) }
      : {}),
    // A run is measured on a board (1.186), so a fight with none never charges.
    ...(perCell !== undefined && action.charge
      ? {
          charge: {
            ...structuredClone(action.charge),
            atLeast: rulesetInCells(action.charge.atLeast, perCell),
            ...(action.charge.push !== undefined ? { push: rulesetInCells(action.charge.push, perCell) } : {}),
          },
        }
      : {}),
    // A reach written as 0 is no reach, exactly as a weapon column reading 0 is: without it a
    // creature that only shoots would be read as swinging, and could strike a passer-by.
    ...(perCell !== undefined && action.reach !== undefined && action.reach > 0
      ? { reach: rulesetInCells(action.reach, perCell) }
      : {}),
    ...(rangeOf(action.range) ? { range: rangeOf(action.range)! } : {}),
    // Centred on the creature itself (1.282): never aimed, so not an area anything is pointed with.
    ...(action.area?.around
      ? {
          around: {
            size: rulesetInCells(action.area.size, perCell ?? 1),
            ...(action.area.throughWalls ? { throughWalls: true as const } : {}),
            ...(action.area.friendlyFire === false ? { friendlyFire: false as const } : {}),
          },
        }
      : {}),
    ...(perCell !== undefined && action.area && !action.area.around
      ? {
          area: {
            shape: action.area.shape,
            size: rulesetInCells(action.area.size, perCell),
            ...(action.area.width !== undefined ? { width: rulesetInCells(action.area.width, perCell) } : {}),
            ...(action.area.ring !== undefined ? { ring: rulesetInCells(action.area.ring, perCell) } : {}),
            ...(action.area.ringOnly ? { ringOnly: true as const } : {}),
            ...(action.area.friendlyFire === false ? { friendlyFire: false } : {}),
            ...(action.area.aroundProp ? { aroundProp: action.area.aroundProp } : {}),
          },
        }
      : {}),
  }));
  // What a use makes by its count (1.687) is never on a menu itself.
  for (const action of built) {
    const parts = (action.byUse ?? []).flatMap((id) => built.find((one) => one.id === id) ?? []);
    for (const part of parts) part.rolledPart = true;
    // Aimed as its parts are: made where it stands when each bursts around its maker or is its
    // maker's own (the Roar), else as far as the first of them that reaches anybody.
    if (parts.length && parts.every((part) => part.around || part.targets.side === "self")) {
      action.targets = { side: "self", count: 0 };
    } else {
      const reach = parts.find((part) => part.range)?.range;
      if (reach && !action.range) action.range = structuredClone(reach);
    }
  }
  // A sequence made without the steps its maker may leave out (1.643), one mode for each way.
  for (const action of built) {
    const optional = (action.sequence ?? []).flatMap((step, index) => (step.optional ? [index] : []));
    if (optional.length === 0) continue;
    const byId = new Map(built.map((one) => [one.id, one]));
    const modes: RulesetCombatMode[] = [];
    for (let mask = 1; mask < 1 << optional.length; mask++) {
      const skips = optional.filter((_, bit) => mask & (1 << bit));
      const targets = action.sequence!.reduce((total, step, index) => {
        if (skips.includes(index) || step.ifHit !== undefined) return total;
        const part = byId.get(step.actionId);
        const times = step.dice
          ? step.dice.count * step.dice.sides
          : step.perHead
            ? step.times * (block.heads?.max ?? block.heads?.count ?? 1)
            : step.times;
        return total + (part ? Math.max(1, part.targets.count) * times : 0);
      }, 0);
      const names = skips.map((index) => byId.get(action.sequence![index]!.actionId)?.label ?? "");
      modes.push({
        id: `without-${skips.join("-")}`,
        label: `without ${names.join(" and ")}`,
        skips,
        targets: Math.max(1, targets),
      });
    }
    action.modes = modes;
  }
  // A teleport with a strike before or after it (1.280): the teleport lets the strike follow, and the
  // strike made first is an action of its own, on the teleport's budget, that lets the teleport follow.
  block.actions.forEach((action, index) => {
    const strikeIndex = action.teleport?.strike ? indexById.get(action.teleport.strike) : undefined;
    const port = built[index]!;
    const strike = strikeIndex === undefined || strikeIndex === index ? undefined : built[strikeIndex];
    // A fight that measures nothing has no teleport to pair the strike with.
    if (!port.teleport || !strike || strike.teleport || strike.sequence || strike.reaction || strike.signature) return;
    port.followUp = strike.id;
    const first: RulesetCombatAction = {
      ...structuredClone(strike),
      id: `${port.id}:first`,
      label: `${strike.label}, then ${port.label}`,
      budget: port.budget,
      pairedWith: [port.id, strike.id],
      followUp: port.id,
    };
    delete first.uses;
    delete first.recharge;
    built.push(first);
  });
  return built;
}

/**
 * A combatant built from a sheet: every number it fights with read off the ruleset's own
 * declarations. A party member is one, and so is an opponent whose creature carries a sheet, which
 * is why this is one function rather than two that could drift apart.
 */
function sheetCombatant(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  input: {
    id: string;
    name: string;
    side: RulesetCombatant["side"];
    /** The initiative dice already thrown, for a ruleset that adds them up; one that throws a pool
     *  throws it here, off the evaluated sheet, with `roll`. */
    initiativeRoll: number[];
    roll: RulesetCombatRoller;
    build: RulesetSheetBuild;
    live: RulesetLiveState;
    catalogs: RulesetCatalogEntriesById;
    perCell: number | undefined;
    items?: ReadonlyArray<RulesetSheetItem>;
    /** Whose bag their items are in (1.721), null for the player's: see the party input's `holder`. */
    holder?: string | null;
    /** Conditions the fight has on them that change their abilities (1.515). */
    conditions?: readonly string[];
  },
): RulesetCombatant {
  const { build, perCell } = input;
  // Against the fighter's live state as the fight found it, so a value that reads a track or a pool
  // (a speed an injury slows) is the one this fight uses; and against what they hold, for a value
  // that reads their items (a defense their armor gives).
  const evaluated = evaluateRulesetSheetLive(definition, build, input.live, input.items, input.conditions);
  const catalogs = narrowCatalogs(build, input.catalogs);
  // Initiative is a roll too, so `resolution.adjust` counts on it as it does on a check.
  const modifier = combat.initiative.modifier
    ? resolveRulesetValueRef(definition, build, combat.initiative.modifier, evaluated) +
      fightAdjust(definition, build, evaluated, combat.initiative.modifier)
    : 0;
  const initiative = combat.initiative.pool
    ? rulesetPoolInitiative(
        definition,
        combat,
        input.roll,
        resolveRulesetValueRef(definition, build, combat.initiative.pool, evaluated) +
          fightAdjust(definition, build, evaluated, combat.initiative.pool),
      )
    : { roll: input.initiativeRoll, modifier, total: sumOf(input.initiativeRoll) + modifier };
  const saves: Record<string, number> = {};
  for (const save of definition.sheet.saves) {
    const target: RulesetCheckTarget = {
      type: "save",
      id: save.id,
      label: save.label,
      ...(save.ability ? { ability: save.ability } : {}),
    };
    saves[save.id] = rulesetCheckModifier(evaluated, target) + fightAdjust(definition, build, evaluated, target);
  }
  // What a contest reads, off the same sheet as everything else. Only when the ruleset has any, so a
  // fight on one that does not carries exactly what it always did.
  const checks = combat.checks?.length
    ? Object.fromEntries(
        combat.checks.map((check) => [
          check.id,
          Math.round(
            resolveRulesetValueRef(definition, build, check.value, evaluated) +
              fightAdjust(definition, build, evaluated, check.value),
          ),
        ]),
      )
    : undefined;
  const abilities = (combat.abilities ?? []).map((source, index) =>
    abilityActions(definition, combat, source, index, build, catalogs, evaluated, perCell, input.items),
  );
  // The entries the sheet's rows came from (1.242): what they do to its attacks, and the strikes they
  // let it buy with another budget.
  const byRef = rulesetCatalogEntriesByRef({
    ...Object.fromEntries((definition.catalogs ?? []).map((catalog) => [catalog.id, catalog.entries ?? []])),
    ...input.catalogs,
  });
  const held = [
    ...new Set(
      Object.values(build.lists ?? {}).flatMap((list) =>
        (Array.isArray(list) ? list : []).flatMap((row) => {
          const ref =
            row && typeof row === "object"
              ? columnValue(row as Record<string, unknown>, RULESET_CATALOG_ROW_KEY)
              : undefined;
          return typeof ref === "string" ? [ref] : [];
        }),
      ),
    ),
  ].flatMap((ref) => {
    const entry = byRef.get(ref);
    return entry?.mechanics ? [entry.mechanics] : [];
  });
  // Only while the sheet and the weapons it holds let each one hold (1.244): read once, for the fight.
  const holds = (rule: Parameters<typeof rulesetHeldRuleHolds>[4]) =>
    rulesetHeldRuleHolds(definition, build, evaluated, input.items, rule);
  const rowRules = held.flatMap((mechanics) => (mechanics.attackRows ?? []).filter(holds));
  const strikeGrants = held.flatMap((mechanics) => {
    if (!mechanics.grantsStrike || !holds(mechanics.grantsStrike)) return [];
    const { when: _when, wielding: _wielding, ...grant } = structuredClone(mechanics.grantsStrike);
    return [grant];
  });
  // What their entries make (1.721), held from the start as none of it, so a cast has its uses ready:
  // in a stack they already carry of it, or in one of its own, in their bag where it is known.
  const heldItems = [...(input.items ?? [])];
  const placeMade = (makes: NonNullable<RulesetCombatAction["makesItems"]>) => {
    const entry = byRef.get(makes.ref);
    // What lasts only so long (1.760) is held in a place of its own, never with what lasts.
    let at = heldItems.findIndex((held) =>
      makes.lasting
        ? held.made === makes.ref && held.madeLasting
        : !held.madeLasting && (held.stack?.ref === makes.ref || held.made === makes.ref),
    );
    if (at < 0 && entry?.item) {
      at = heldItems.length;
      heldItems.push({
        item: entry.item,
        quantity: 0,
        worn: false,
        name: entry.label,
        made: makes.ref,
        ...(makes.lasting ? { madeLasting: true as const } : {}),
        ...(input.holder !== undefined
          ? {
              stack: {
                id: `st-made-${input.id}-${makes.ref.replace(/[^a-zA-Z0-9_-]/g, "-")}${makes.lasting ? "-lasting" : ""}`,
                ref: makes.ref,
                ...(input.holder !== null ? { holder: input.holder } : {}),
              },
            }
          : {}),
      });
    }
    if (at >= 0) makes.at = at;
  };
  for (const action of abilities.flatMap((entry) => entry.actions)) if (action.makesItems) placeMade(action.makesItems);
  // And what an item's use makes (1.745), its place held before the items' own uses are read.
  for (const owned of input.items ?? []) {
    for (const use of [owned.item.use, ...(owned.item.moreUses ?? []).map((more) => more.use)])
      if (use?.makesItems)
        placeMade({
          ref: use.makesItems.item,
          count: use.makesItems.count,
          ...(use.makesItems.lasts?.length ? { lasts: use.makesItems.lasts[0]!.minutes, lasting: true as const } : {}),
        });
  }
  // What an item's call lends its user to wield while it stands (1.739): a goat of terror's horns.
  (input.items ?? []).forEach((owned, index) => {
    const uses = [
      { id: `use:${index}`, use: owned.item.use },
      ...(owned.item.moreUses ?? []).map((more, n) => ({ id: `use:${index}:${n + 1}`, use: more.use })),
    ];
    for (const { id, use } of uses) {
      const lends = use?.wieldsWhileCalled;
      if (!lends) continue;
      for (const ref of lends.items) {
        const entry = byRef.get(ref);
        if (!entry?.item?.attack) continue;
        heldItems.push({
          item: entry.item,
          quantity: 1,
          worn: true,
          name: entry.label,
          lent: { by: id, ...(lends.takes !== undefined ? { takes: lends.takes } : {}) },
        });
      }
    }
  });
  // A weapon both written on the sheet's attacks list and held is one weapon: the held item's attack,
  // which reads all it may be swung with (a finesse blade's better of two), is the one offered, and
  // the row of the same name is left out rather than shown beside it with its one column's ability.
  const heldAttacks = itemAttackActions(definition, combat, heldItems, build, evaluated, perCell, rowRules);
  const heldNames = new Set(heldAttacks.map((action) => action.label.trim().toLowerCase()));
  const actions = [
    ...(combat.attacks ?? []).flatMap((source, index) =>
      attackActions(definition, combat, source, index, build, evaluated, perCell, rowRules).filter(
        (action) => !heldNames.has(action.label.trim().toLowerCase()),
      ),
    ),
    ...heldAttacks,
    ...lentTakeActions(heldItems),
    ...itemSwitchActions(input.items),
    ...itemFormActions(input.items),
    ...bonusShiftActions(combat, input.items),
    ...carriedSwitchActions(combat),
    ...knockOutSwitchActions(combat),
    ...itemUseActions(definition, combat, heldItems, build, evaluated, perCell),
    ...abilities.flatMap((entry) => entry.actions),
    // What the items they hold store (1.524), each cast once.
    ...storedItemActions(definition, input.items, byRef, build, evaluated, perCell),
  ];
  // What an item's use makes (1.745), held a place for as a cast's is: a scroll of Goodberry.
  for (const action of actions)
    if (action.makesItems && action.makesItems.at === undefined) placeMade(action.makesItems);
  // What a spell glyph may store (1.454): each of its caster's own entries paid off the sheet, as a
  // mode; its level, the first or higher and no higher than the glyph is paid at, is checked as it is
  // cast.
  for (const action of actions) {
    if (!action.zone?.detonates?.stores) continue;
    const storable = actions.filter((one) => one.id !== action.id && !!one.use && !one.zone?.detonates?.stores);
    if (storable.length) {
      action.modes = storable.map((one) => ({ id: `stores-${one.id}`, label: one.label, stores: one.id }));
    }
  }
  // What an entry that duplicates others casts (1.474): every other entry of its catalog no higher
  // than its `upTo`, each its own option, with its maker's numbers, paid for as the duplicating entry
  // is and needing none of its components. 5e's Wish; and an item's use (1.640), paid for with the
  // item as that use is: a Ring of Three Wishes.
  for (const wish of [...actions]) {
    const duplicates = wish.duplicates;
    if (!duplicates) continue;
    const header = definition.catalogs?.find((catalog) => catalog.id === duplicates.catalog);
    for (const [ref, entry] of byRef) {
      if (ref !== `${duplicates.catalog}/${entry.id}` || ref === wish.entry || !entry.mechanics) continue;
      if (duplicates.only && !duplicates.only.includes(entry.id)) continue;
      if (entry.mechanics.duplicates || entry.mechanics.kind === "rider" || entry.mechanics.beforeFight) continue;
      const action = mechanicsAction(definition, entry.mechanics, {
        id: `${wish.id}~${ref}`,
        ...(wish.ability ? { ability: wish.ability } : {}),
        kind: "ability",
        label: `${wish.label}: ${entry.label}`,
        budget: wish.budget,
        toHit: wish.toHit ?? 0,
        ...(wish.saveDifficulty !== undefined ? { saveDifficulty: wish.saveDifficulty } : {}),
        build,
        evaluated,
        perCell: perCell === undefined ? undefined : (header?.units?.distance?.perCell ?? perCell),
      });
      if (!action || action.reaction) continue;
      const level = rulesetPaidLevel(definition, { sheet: { build, live: {}, catalogs: {} } }, action);
      if (level < 1 || level > duplicates.upTo) continue;
      action.catalog = duplicates.catalog;
      action.entry = ref;
      // What its filters read, for a ward's `where` (1.645): from a catalog file too.
      if (entry.filters) action.filters = structuredClone(entry.filters);
      if (wish.use) action.use = { ...wish.use };
      else delete action.use;
      if (wish.itemUse) action.itemUse = structuredClone(wish.itemUse);
      delete action.components;
      action.duplicatedBy = wish.id;
      actions.push(action);
    }
  }
  // Whom a zone works on inside, chosen as it is cast (1.466): each of the fight's creature types,
  // as a mode.
  const kinds = definition.combat?.creatureTypes?.types ?? [];
  for (const action of actions) {
    if (!action.zone?.inside?.chooses || !kinds.length) continue;
    action.modes = kinds.map((kind) => ({ id: `kind-${kind.id}`, label: kind.label, insideType: kind.id }));
  }
  // What a conjuring entry puts in hand (1.306), read now like everything else: each weapon it may
  // make, and each held weapon it may bind, as attacks of that entry's, so what amends it amends them.
  const conjurable: NonNullable<RulesetCombatant["conjurable"]> = {};
  for (const action of actions) {
    const conjures = action.conjures && action.entry ? byRef.get(action.entry)?.mechanics?.conjures : undefined;
    if (!conjures) continue;
    const ownership = (made: RulesetCombatAction[]) =>
      made.map((one) => ({
        ...one,
        entry: action.entry,
        ...(one.damage && conjures.qualities
          ? {
              damage: {
                ...one.damage,
                qualities: [...new Set([...(one.damage.qualities ?? []), ...conjures.qualities])],
              },
            }
          : {}),
      }));
    const modes: RulesetCombatMode[] = [];
    conjures.items.forEach((ref, at) => {
      const entry = byRef.get(ref);
      const attack = entry?.item?.attack;
      if (!entry?.item || !attack) return;
      const item = conjures.proficient
        ? { ...entry.item, attack: { ...attack, toHit: { ...attack.toHit, proficiency: { const: 1 } } } }
        : entry.item;
      const made = itemAttackActions(
        definition,
        combat,
        [{ item, quantity: 1, worn: true, name: entry.label }],
        build,
        evaluated,
        perCell,
        rowRules,
      ).filter((one) => one.kind !== "reload");
      if (!made.length) return;
      const mode = `weapon-${at}`;
      modes.push({ id: mode, label: entry.label, targets: 0 });
      const slots = Object.entries(entry.item.slots ?? {}).flatMap(([slot, count]) => (count > 0 ? [slot] : []));
      conjurable[`${action.id}|${mode}`] = {
        item: entry.label,
        actions: ownership(made).map((one) => ({ ...one, id: `conjured:${action.id}:${one.id}` })),
        // What it takes and is, for what makes held things fall, and when it is gone (1.480).
        ...(slots.length ? { slots } : {}),
        ...(entry.item.tags?.length ? { tags: [...entry.item.tags] } : {}),
        ...(conjures.vanishes
          ? {
              vanishes: {
                beyond: rulesetInCells(conjures.vanishes.beyond, combat.distance?.perCell ?? 1),
                rounds: conjures.vanishes.rounds,
              },
            }
          : {}),
      };
    });
    if (conjures.binds) {
      const items = input.items ?? [];
      // Bound out of the fight (1.309): only the weapon its live text names, and none while it is empty.
      const boundName =
        conjures.boundIn !== undefined ? (input.live.text?.[conjures.boundIn] ?? "").trim().toLowerCase() : undefined;
      items.forEach((held, index) => {
        if (!held.worn || !held.item.attack) return;
        if (!rulesetItemMatches(held.item, itemAttackLabel(definition, held), conjures.binds!)) return;
        if (boundName !== undefined && itemAttackLabel(definition, held).trim().toLowerCase() !== boundName) return;
        const made = itemAttackActions(definition, combat, items, build, evaluated, perCell, rowRules).filter(
          (one) => rulesetActionItemIndex(one) === index,
        );
        const mode = `bind-${index}`;
        const name = itemAttackLabel(definition, held);
        modes.push({ id: mode, label: name, targets: 0 });
        conjurable[`${action.id}|${mode}`] = { item: name, actions: ownership(made), bound: index };
      });
    }
    action.modes = modes;
  }
  // An alteration of only the entries its filter reads so (1.414), named now: Sculpt Spells.
  for (const action of actions) {
    const alters = action.alters;
    if (!alters?.where) continue;
    alters.entries = [...byRef.entries()].flatMap(([ref, entry]) =>
      alters.catalogs.includes(ref.slice(0, ref.indexOf("/"))) && rulesetCatalogWhereReads(entry, alters.where!)
        ? [ref]
        : [],
    );
  }
  // Held, what changes one named entry of theirs each time they use it (1.302): 5e's invocations.
  // Since 1.414 also every entry of catalogs a filter reads so: Empowered Evocation, Potent Cantrip.
  const amends = held.flatMap((mechanics) => mechanics.amends ?? []);
  const amended = (amend: (typeof amends)[number], action: RulesetCombatAction) => {
    // Only of the damage type the sheet chose (1.429): Elemental Affinity.
    if (amend.damageTypeIn !== undefined) {
      const chosen = build.fields?.[amend.damageTypeIn];
      const wanted = typeof chosen === "string" ? chosen.trim().toLowerCase() : "";
      const types = [action.damage?.type, ...(action.damage?.plus ?? []).map((one) => one.type)];
      if (!wanted || !types.some((type) => type?.trim().toLowerCase() === wanted)) return false;
    }
    if (amend.entry !== undefined) return action.entry === amend.entry;
    const ref = action.entry;
    if (!ref || !amend.catalogs?.includes(ref.slice(0, ref.indexOf("/")))) return false;
    if (!amend.where) return true;
    const entry = byRef.get(ref);
    return !!entry && rulesetCatalogWhereReads(entry, amend.where);
  };
  const amendAll = (list: RulesetCombatAction[]) => {
    for (const amend of amends) {
      for (const action of list) {
        if (!amended(amend, action)) continue;
        if (amend.damageAdd && action.damage) {
          action.damage.flat += Math.round(resolveRulesetValueRef(definition, build, amend.damageAdd, evaluated));
        }
        // To one damage roll of each use (1.414): Empowered Evocation.
        if (amend.damageOnce && action.damage) {
          action.damageOnce =
            (action.damageOnce ?? 0) +
            Math.round(resolveRulesetValueRef(definition, build, amend.damageOnce, evaluated));
        }
        // Half on a save that would leave nothing (1.414): Potent Cantrip.
        if (amend.halfOnSave && action.damage && action.save?.onSuccess === "negates") {
          action.save = { ...action.save, onSuccess: "half" };
        }
        // Healing at its most (1.415): Supreme Healing.
        if (amend.maxHeal && action.heal) action.healsMax = true;
        // More to each it heals, and its user's own (1.421): Disciple of Life, Blessed Healer.
        for (const key of ["healAdd", "healsSelf"] as const) {
          const adds = amend[key];
          if (!adds || !action.heal) continue;
          (action[key] ??= []).push({
            flat: adds.add ? Math.round(resolveRulesetValueRef(definition, build, adds.add, evaluated)) : 0,
            perLevel: adds.perLevel ?? 0,
            fromLevel: adds.fromLevel ?? 0,
          });
        }
        // More of its own type on a hit (1.306): Lifedrinker.
        if (amend.damagePlus && action.damage) {
          const added = Math.round(resolveRulesetValueRef(definition, build, amend.damagePlus.add, evaluated));
          action.damage.plus = [
            ...(action.damage.plus ?? []),
            {
              count: 0,
              sides: 0,
              flat: Math.max(amend.damagePlus.atLeast ?? 0, added),
              ...(amend.damagePlus.type ? { type: amend.damagePlus.type } : {}),
            },
          ];
        }
        // As many strikes for one spend as it says, where that is more (1.306): Thirsting Blade.
        if (amend.strikes !== undefined && action.damage) action.strikes = Math.max(action.strikes ?? 1, amend.strikes);
        if (amend.range !== undefined && perCell !== undefined) {
          const range = rulesetInCells(amend.range, perCell);
          action.range = action.range
            ? { ...action.range, normal: Math.max(action.range.normal, range) }
            : { normal: range };
        }
      }
    }
    // Pushes last, so one offered without its push carries everything else.
    for (const amend of amends) {
      for (const action of [...list]) {
        if (!amended(amend, action) || action.id.endsWith(":still")) continue;
        if (amend.push !== undefined && perCell !== undefined) {
          // Offered without it too where it says the push is its user's choice.
          if (amend.pushOptional) {
            const still = structuredClone(action);
            still.id = `${action.id}:still`;
            still.label = `${action.label} (no push)`;
            list.splice(list.indexOf(action) + 1, 0, still);
          }
          action.push = (action.push ?? 0) + rulesetInCells(amend.push, perCell);
        }
      }
    }
  };
  amendAll(actions);
  for (const made of Object.values(conjurable)) amendAll(made.actions);
  splitSymbolDice(definition, evaluated, actions);
  for (const made of Object.values(conjurable)) splitSymbolDice(definition, evaluated, made.actions);
  const riders = abilities.flatMap((entry) => entry.riders);
  // What an item becomes on its last charge (1.272), read now with what it would do then.
  // What each item that frees its slots while on changes of the weapons' dice (1.706).
  const slotsFreed: NonNullable<RulesetCombatant["slotsFreed"]> = {};
  input.items?.forEach((held, index) => {
    if (!held.worn || held.quantity !== 1 || !held.item.toggle?.freesSlots) return;
    const as = (on: boolean) =>
      itemAttackActions(
        definition,
        combat,
        input.items!.map((one, at) => {
          if (at !== index) return one;
          const { on: _on, ...rest } = one;
          return on ? { ...rest, on: true as const } : rest;
        }),
        build,
        evaluated,
        perCell,
        rowRules,
      );
    const off = new Map(as(false).map((action) => [action.id, action.damage]));
    const changes: Record<string, { off: RulesetSlotsFreedDamage; on: RulesetSlotsFreedDamage }> = {};
    for (const action of as(true)) {
      const before = off.get(action.id);
      const after = action.damage;
      if (!before || !after) continue;
      const of = (damage: RulesetCombatDamage): RulesetSlotsFreedDamage => ({
        count: damage.count,
        sides: damage.sides,
        flat: damage.flat,
        ...(damage.reroll ? { reroll: damage.reroll } : {}),
      });
      if (JSON.stringify(of(before)) !== JSON.stringify(of(after)))
        changes[action.id] = { off: of(before), on: of(after) };
    }
    if (Object.keys(changes).length) slotsFreed[index] = changes;
  });
  // One left on that stays on only so long starts its clock as the fight does (1.706).
  const onFor = Object.fromEntries(
    (input.items ?? []).flatMap((held, index) =>
      held.on && held.item.toggle?.rounds ? [[String(index), held.item.toggle.rounds]] : [],
    ),
  );
  const becomes: NonNullable<RulesetCombatant["becomes"]> = {};
  input.items?.forEach((held, index) => {
    const ref = held.item.charges?.breaksOn?.becomes;
    const other = ref ? byRef.get(ref) : undefined;
    if (!ref || !other?.item) return;
    const { charges: _charges, ...rest } = held;
    const next: RulesetSheetItem = { ...rest, item: other.item, name: other.label };
    const items = input.items!.map((one, at) => (at === index ? next : one));
    const made = [
      ...itemAttackActions(definition, combat, items, build, evaluated, perCell, rowRules),
      ...itemSwitchActions(items),
      ...itemFormActions(items),
      ...itemUseActions(definition, combat, items, build, evaluated, perCell),
    ].filter((action) => rulesetActionItemIndex(action) === index);
    splitSymbolDice(definition, evaluated, made);
    becomes[index] = { ref, name: other.label, item: other.item, actions: made };
  });
  // Each item with forms in each of them (1.575), read now with what it would do then.
  const itemFormed: NonNullable<RulesetCombatant["itemFormed"]> = {};
  input.items?.forEach((held, index) => {
    const forms = held.item.forms;
    if (!forms || held.quantity !== 1) return;
    const made = (held.form && held.stack ? byRef.get(held.stack.ref)?.item : undefined) ?? held.item;
    itemFormed[index] = [undefined, ...forms.into].map((form, to) => {
      const other = form ? byRef.get(form.item)?.item : undefined;
      const item = other ? rulesetFormedItem(made, other) : made;
      const { form: _form, ...rest } = held;
      const next: RulesetSheetItem = { ...rest, item, ...(to && other ? { form: to } : {}) };
      const items = input.items!.map((one, at) => (at === index ? next : one));
      const actions = [
        ...itemAttackActions(definition, combat, items, build, evaluated, perCell, rowRules),
        ...itemSwitchActions(items),
        ...itemFormActions(items),
        ...itemUseActions(definition, combat, items, build, evaluated, perCell),
      ].filter((action) => rulesetActionItemIndex(action) === index);
      return { item, actions };
    });
  });
  // What they soak and what they may spend, read once like their defense.
  const read = (ref: RulesetValueRef) =>
    Math.max(0, Math.round(resolveRulesetValueRef(definition, build, ref, evaluated)));
  const soakRule = combat.pool?.soak ?? combat.symbols?.soak;
  const soak: RulesetCombatSoak | undefined = soakRule
    ? {
        ...(soakRule.all ? { all: read(soakRule.all) } : {}),
        ...(soakRule.byKind
          ? { byKind: Object.fromEntries(Object.entries(soakRule.byKind).map(([kind, ref]) => [kind, read(ref)])) }
          : {}),
      }
    : undefined;
  const hardness = combat.pool?.hardness ? read(combat.pool.hardness) : 0;
  const limits = combat.spendLimits?.length
    ? Object.fromEntries(
        combat.spendLimits.map((limit) => [limit.pool, { max: read(limit.max), per: limit.per, spent: 0 }]),
      )
    : undefined;
  return {
    id: input.id,
    name: input.name,
    side: input.side,
    initiativeRoll: initiative.roll,
    initiativeModifier: initiative.modifier,
    initiative: initiative.total,
    budgets: fullBudgets(combat),
    actions,
    ...(strikeGrants.length ? { strikeGrants } : {}),
    uses: startingUses(actions),
    spent: [],
    ...(riders.length > 0 ? { riders } : {}),
    tracked: [],
    concentrating: null,
    flags: {},
    down: false,
    dying: false,
    stable: false,
    defeated: false,
    defense: Math.round(resolveRulesetValueRef(definition, build, combat.defense, evaluated)),
    // What each item that may be dropped adds to their defense (1.266), read once without it.
    ...(() => {
      const falls = (combat.conditions ?? []).flatMap((entry) => (entry.behavior?.drops ? [entry.behavior.drops] : []));
      // And one that falls as it stops hovering with no room for it (1.706).
      const hovers = (held: RulesetSheetItem) => !!held.item.toggle?.freesSlots;
      if ((!falls.length && !input.items?.some(hovers)) || !input.items?.length) return {};
      const whole = Math.round(resolveRulesetValueRef(definition, build, combat.defense, evaluated));
      const heldDefense: Record<string, number> = {};
      input.items.forEach((held, index) => {
        if (!held.worn) return;
        const may =
          hovers(held) ||
          falls.some(
            (drops) =>
              drops.slots?.some((slot) => (held.item.slots?.[slot] ?? 0) > 0) ||
              drops.tags?.some((tag) => held.item.tags?.includes(tag)),
          );
        if (!may) return;
        const without = input.items!.filter((_, other) => other !== index);
        const less = Math.round(
          resolveRulesetValueRef(
            definition,
            build,
            combat.defense,
            evaluateRulesetSheetLive(definition, build, input.live, without, input.conditions),
          ),
        );
        if (Number.isFinite(less) && whole - less !== 0) heldDefense[index] = whole - less;
      });
      return Object.keys(heldDefense).length ? { heldDefense } : {};
    })(),
    // A sheet that reads under 2 (a field left at 0 for whoever has no range) is no range at all.
    ...(() => {
      const ref = combat.attackRoll?.criticalFrom;
      const from = ref ? Math.round(resolveRulesetValueRef(definition, build, ref, evaluated)) : NaN;
      return Number.isFinite(from) && from >= 2 ? { criticalFrom: from } : {};
    })(),
    saves,
    ...(checks ? { checks } : {}),
    ...(() => {
      const size = sheetSize(definition, combat, build, evaluated);
      return size !== undefined ? { size } : {};
    })(),
    // How far each of the fight's senses reaches off this sheet (1.178), in cells; nought is none.
    ...(() => {
      const perCell = combat.distance?.perCell;
      if (!combat.senses || perCell === undefined) return {};
      const senses: Record<string, number> = {};
      for (const sense of combat.senses) {
        const range = sense.sheet ? resolveRulesetValueRef(definition, build, sense.sheet, evaluated) : 0;
        if (Number.isFinite(range) && range > 0) senses[sense.id] = rulesetInCells(range, perCell);
      }
      return Object.keys(senses).length > 0 ? { senses } : {};
    })(),
    ...(soak ? { soak } : {}),
    ...(hardness > 0 ? { hardness } : {}),
    ...(limits ? { limits } : {}),
    speed: combat.economy.movement ? resolveRulesetValueRef(definition, build, combat.economy.movement, evaluated) : 0,
    // Ways of moving besides walking, off the same sheet (1.113). Nought is not moving that way.
    ...(() => {
      const speeds: RulesetMoveSpeeds = {};
      for (const mode of RULESET_MOVE_MODES) {
        const ref = combat.economy.movementModes?.[mode];
        const speed = ref ? resolveRulesetValueRef(definition, build, ref, evaluated) : 0;
        if (Number.isFinite(speed) && speed > 0) speeds[mode] = speed;
      }
      return Object.keys(speeds).length > 0 ? { speeds } : {};
    })(),
    sheet: {
      build,
      live: input.live,
      catalogs,
      ...(input.items || heldItems.length ? { items: heldItems } : {}),
    },
    ...(Object.keys(becomes).length ? { becomes } : {}),
    ...(Object.keys(slotsFreed).length ? { slotsFreed } : {}),
    ...(Object.keys(onFor).length ? { onFor } : {}),
    ...(Object.keys(itemFormed).length ? { itemFormed } : {}),
    ...(Object.keys(conjurable).length ? { conjurable } : {}),
  };
}

/**
 * One action per contest the ruleset declares, the same for everybody: whoever is in a fight may grab
 * or shove. A contest that takes the place of a strike buys as many as the actor's own actions on
 * the same budget do, so it is paid for, and paid out of strikes in hand, exactly as they are.
 */
function contestActions(
  combat: RulesetCombat,
  actions: readonly RulesetCombatAction[],
  perCell: number | undefined,
): RulesetCombatAction[] {
  return (combat.contests ?? []).map((contest) => {
    const strikes = contest.strike
      ? Math.max(
          0,
          ...actions.flatMap((action) =>
            action.budget === contest.budget && action.strikes !== undefined ? [action.strikes] : [],
          ),
        )
      : 0;
    return {
      id: `contest:${contest.id}`,
      kind: "contest",
      label: contest.label,
      budget: contest.budget,
      targets: { side: contest.targets ?? "enemy", count: 1 },
      ...(contest.reach !== undefined && perCell !== undefined
        ? { reach: rulesetInCells(contest.reach, perCell) }
        : {}),
      ...(strikes > 0 ? { strikes } : {}),
      contest: {
        id: contest.id,
        ...(contest.strike ? { strike: true as const } : {}),
        attacker: [...contest.attacker.checks],
        defender: [...(contest.defender?.checks ?? [])],
        ...(contest.difficulty !== undefined ? { difficulty: contest.difficulty } : {}),
        ...(contest.targetHolds ? { targetHolds: contest.targetHolds } : {}),
        ...(contest.targetDying ? { targetDying: true as const } : {}),
        ...(contest.pulls ? { pulls: true as const } : {}),
        ...(contest.onWin.stabilizes ? { stabilizes: true as const } : {}),
        ...(contest.targetHeldBySelf ? { targetHeldBySelf: true as const } : {}),
        ...(contest.actorHolds ? { actorHolds: [...contest.actorHolds] } : {}),
        ...(contest.advantageAtMostSize ? { advantageAtMostSize: contest.advantageAtMostSize } : {}),
        ...(contest.onWin.pushRead !== undefined ? { pushRead: structuredClone(contest.onWin.pushRead) } : {}),
        ...(contest.onWin.follows ? { follows: true as const } : {}),
        ...(contest.onWin.both
          ? {
              both: { applies: [...contest.onWin.both.applies], whileTargetHolds: contest.onWin.both.whileTargetHolds },
            }
          : {}),
        ties: contest.ties,
        ...(contest.from ? { from: contest.from.holding } : {}),
        ...(contest.from?.escapable ? { escapable: true as const } : {}),
        ...(contest.maxSizeAbove !== undefined ? { maxSizeAbove: contest.maxSizeAbove } : {}),
        ...(contest.onWin.applies ? { applies: contest.onWin.applies.map((entry) => ({ ...entry })) } : {}),
        ...(contest.onWin.ends ? { ends: contest.onWin.ends.map((entry) => ({ ...entry })) } : {}),
        ...(contest.onWin.push !== undefined && perCell !== undefined
          ? { push: rulesetInCells(contest.onWin.push, perCell) }
          : {}),
      },
    };
  });
}

/** What an action still has left of itself, before anything is spent on it. */
/** What an opponent has on it (1.795), as the fight keeps it for what is left of it at the end. */
function carriedRecord(
  items: ReadonlyArray<{ held: RulesetSheetItem; ref: string }>,
): NonNullable<RulesetCombatant["carried"]> {
  return items.map(({ held, ref }) => ({ ref, name: held.name ?? held.item.category, count: held.quantity }));
}

/**
 * What a stat block with no sheet can use of what it has on it (1.795): each item whose first use is
 * used up in the using and asks nothing of its user's own numbers (a potion, an oil), as many times as
 * it has them. One that rolls to hit, reads its user's stats for its save, has a gate or charges, or
 * asks something of its user needs a sheet to read them off, and is only carried.
 */
function carriedBlockActions(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  items: readonly RulesetSheetItem[],
  perCell: number | undefined,
): RulesetCombatAction[] {
  const build = defaultRulesetSheetBuild(definition);
  const evaluated = evaluateRulesetSheetLive(definition, build, {}, []);
  const pooled = rulesetCombatIsPool(combat);
  return items.flatMap((held, index) => {
    const { item } = held;
    const use = item.use;
    if (
      !use ||
      !use.consumes ||
      use.raises ||
      use.toHit ||
      use.sheetDifficulty ||
      use.gate ||
      use.charges !== undefined
    )
      return [];
    if (item.userNeeds || item.userNeedsAny || held.quantity < 1) return [];
    const wearable = Object.values(item.slots ?? {}).some((count) => count > 0) || !!item.binds;
    if (wearable) return [];
    const name =
      held.name ??
      definition.items?.categories.find((category) => category.id === item.category)?.label ??
      item.category;
    const key = `carried:${index}`;
    const action = itemUseMechanics(
      definition,
      item,
      use,
      { id: key, label: use.title ?? (use.label ? `${name}: ${use.label}` : name) },
      build,
      evaluated,
      perCell,
      pooled,
    );
    if (!action) return [];
    delete action.itemUse;
    return [{ ...action, uses: { per: "encounter" as const, count: held.quantity } }];
  });
}

function startingUses(actions: readonly RulesetCombatAction[]): Record<string, number> {
  const uses: Record<string, number> = {};
  for (const action of actions)
    if (action.uses && !action.innate?.coven) uses[action.usesKey ?? action.id] ??= action.uses.count;
  // A trait's spell slots (1.642), each level once; a coven's are kept by the fight instead.
  for (const action of actions) {
    const innate = action.innate;
    if (!innate?.slots || innate.coven) continue;
    for (const [level, count] of Object.entries(innate.slots)) uses[`slot:${level}`] ??= count;
  }
  return uses;
}

type RulesetStatBlockLike = NonNullable<RulesetCombatant["block"]>;

/** Full budgets, as a fresh turn and a fresh round hand them out: the declared count, and what the
 *  holder's conditions add or take away (combat C6d), never below none. */
export function refreshRulesetBudgets(
  combat: RulesetCombat,
  budgets: Record<string, number>,
  per: "turn" | "round",
  changes?: ReadonlyMap<string, number>,
) {
  for (const budget of combat.economy.budgets) {
    if (budget.per === per) budgets[budget.id] = Math.max(0, budget.count + (changes?.get(budget.id) ?? 0));
  }
}

/** What a combatant's conditions do to their action economy (combat C6d, as Haste and Slow do): turn
 *  budgets added or taken away, what other budgets may be spent on, budgets of which a turn may spend
 *  only one, and the fewest attacks a turn any of them allows. */
export interface RulesetConditionEconomy {
  budgets: Map<string, number>;
  grants: NonNullable<RulesetCombatCondition["grants"]>[];
  exclusive: Array<[string, string]>;
  attacksPerTurn?: number;
}
export function rulesetConditionEconomy(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  combatant: RulesetCombatant,
  state?: RulesetEncounterState,
): RulesetConditionEconomy {
  const economy: RulesetConditionEconomy = { budgets: new Map(), grants: [], exclusive: [] };
  for (const entry of rulesetActiveConditions(definition, combat, combatant, state)) {
    for (const change of entry.budgets ?? []) {
      economy.budgets.set(change.budget, (economy.budgets.get(change.budget) ?? 0) + change.flat);
    }
    if (entry.grants) economy.grants.push(entry.grants);
    if (entry.exclusive) economy.exclusive.push(entry.exclusive);
    if (entry.attacksPerTurn !== undefined) {
      economy.attacksPerTurn = Math.min(economy.attacksPerTurn ?? entry.attacksPerTurn, entry.attacksPerTurn);
    }
  }
  // What the entries their rows came from let them strike with (1.242).
  for (const grant of combatant.strikeGrants ?? []) economy.grants.push({ ...grant, attacks: true });
  return economy;
}

function fullBudgets(combat: RulesetCombat): Record<string, number> {
  const budgets: Record<string, number> = {};
  for (const budget of combat.economy.budgets) budgets[budget.id] = budget.count;
  return budgets;
}

/**
 * How far this combatant may walk in one turn, in CELLS: their own speed in the ruleset's own unit,
 * divided by what a cell is worth and rounded DOWN, and never less than one while they can move at
 * all. A condition that stops them moving makes it nothing.
 *
 * Rounded down rather than up, because a turn's movement is a budget a player spends: rounding it
 * up would quietly hand every fast thing an extra cell it was never given.
 */
export function rulesetMovementAllowance(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  combatant: RulesetCombatant,
  state?: RulesetEncounterState,
  /** One way of moving's own speed (1.113). Their fastest when left out. */
  base: number = rulesetFastestSpeed(combatant),
  /** As though nothing sealed them (1.314): how far rolling a sphere is measured from. */
  unsealed = false,
  /** As though these conditions were off them (1.486): the walk slipping free of them gives back. */
  ignoring?: ReadonlySet<string>,
): number {
  const perCell = combat.distance?.perCell;
  if (perCell === undefined || !(perCell > 0)) return 0;
  if (rulesetSpeedZero(definition, combat, combatant, state, ignoring)) return 0;
  // Shut in a sphere (1.314): it goes only where it is rolled or carried.
  if (!unsealed && rulesetSealed(definition, combatant, state)) return 0;
  // Inside somebody (1.403): it goes only where they go, until they have fallen and it may climb
  // out (1.405).
  if (combatant.insideOf && !(state && rulesetInsideCorpse(state, combatant))) return 0;
  // What a condition does to speed: every flat change first, then halving or doubling, so "10 feet
  // slower, and half speed" is half of what is left.
  // Not lowered by what magic put on them (1.486): Freedom of Movement.
  const kept = speedKeptOff(definition, combat, combatant, state);
  const changes = rulesetConditionModifiers(definition, combat, combatant, "speed", state).filter(
    ({ condition, modifier }) =>
      !ignoring?.has(condition) && !(kept.has(condition) && ((modifier.flat ?? 0) < 0 || (modifier.times ?? 1) < 1)),
  );
  let speed = base;
  for (const { modifier } of changes) speed += modifier.flat ?? 0;
  for (const { modifier } of changes) speed *= modifier.times ?? 1;
  // Bearing more than it carries at its full pace (1.641): half speed, or the speed it keeps then
  // (1.660), a Broom of Flying's 30 feet.
  const carries = combatant.block?.mountCarries;
  if (carries && state && rulesetMountLoad(definition, combat, state, combatant) > carries.weight) {
    speed = carries.slowedSpeed !== undefined ? Math.min(speed, carries.slowedSpeed) : speed / 2;
  }
  if (!Number.isFinite(speed) || speed <= 0) return 0;
  return Math.max(1, Math.floor(speed / perCell));
}

/**
 * The conditions on this combatant that may not lower their speed (1.486): each put on only by
 * entries of the catalogs a `speedKeptFrom` holding on them names. 5e's Freedom of Movement keeps a
 * spell's slowing off their walk, and a net's still holds them.
 */
function speedKeptOff(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  combatant: RulesetCombatant,
  state?: RulesetEncounterState,
): Set<string> {
  const kept = new Set<string>();
  if (!combat.conditions?.some((entry) => entry.speedKeptFrom) && !definition.items) return kept;
  const catalogs = new Set(
    rulesetActiveConditions(definition, combat, combatant, state).flatMap(
      (entry) => entry.speedKeptFrom?.catalogs ?? [],
    ),
  );
  if (!catalogs.size) return kept;
  const fromMagic = new Map<string, boolean>();
  for (const entry of combatant.tracked) {
    const magic = !!entry.catalog && catalogs.has(entry.catalog);
    fromMagic.set(entry.condition, (fromMagic.get(entry.condition) ?? true) && magic);
  }
  for (const [condition, magic] of fromMagic) if (magic) kept.add(condition);
  return kept;
}

/** Whether something holding on this combatant stops them moving at all: a condition that does
 *  "speed-zero", unless all that does is kept off their walk (1.486) or is in `ignoring`. */
export function rulesetSpeedZero(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  combatant: RulesetCombatant,
  state?: RulesetEncounterState,
  ignoring?: ReadonlySet<string>,
): boolean {
  if (!rulesetCombatEffects(definition, combat, combatant, state).has("speed-zero")) return false;
  const kept = speedKeptOff(definition, combat, combatant, state);
  if (!kept.size && !ignoring?.size) return true;
  return rulesetActiveConditions(definition, combat, combatant, state).some(
    (entry) => entry.effects.includes("speed-zero") && !kept.has(entry.condition) && !ignoring?.has(entry.condition),
  );
}

/**
 * The cells of the walk slipping free of `condition` costs this combatant now (1.486), or null when
 * what is left of their walk, with what it would give back, is too little. Nothing in a fight that
 * measures no walk.
 */
export function rulesetSlipCost(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  combatant: RulesetCombatant,
  state: RulesetEncounterState | undefined,
  condition: string,
  cost: number,
): number | null {
  const perCell = combat.distance?.perCell;
  if (combatant.movement === undefined || perCell === undefined || !(perCell > 0)) return 0;
  const cells = Math.ceil(cost / perCell);
  const freed =
    rulesetMovementAllowance(definition, combat, combatant, state, undefined, false, new Set([condition])) -
    rulesetMovementAllowance(definition, combat, combatant, state);
  return (combatant.movementLeft ?? 0) + Math.max(0, freed) >= cells ? cells : null;
}

/** The fastest way this combatant moves, walking included (1.113). */
export function rulesetFastestSpeed(combatant: RulesetCombatant): number {
  return Math.max(
    combatant.noWalk ? 0 : combatant.speed,
    ...Object.values(combatant.speeds ?? {}).map((speed) => speed ?? 0),
  );
}

/** Each way somebody moves besides walking, and walking, as an allowance in cells (1.113). Undefined
 *  for somebody who only walks. */
export function rulesetModeAllowances(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  combatant: RulesetCombatant,
  state?: RulesetEncounterState,
): Partial<Record<RulesetMoveMode, number>> | undefined {
  if (!combatant.speeds) return undefined;
  const allowances: Partial<Record<RulesetMoveMode, number>> = {
    walk:
      combatant.speed > 0 && !combatant.noWalk
        ? rulesetMovementAllowance(definition, combat, combatant, state, combatant.speed)
        : 0,
  };
  for (const mode of RULESET_MOVE_MODES) {
    const speed = combatant.speeds[mode];
    if (speed) allowances[mode] = rulesetMovementAllowance(definition, combat, combatant, state, speed);
  }
  return allowances;
}

/** A turn's allowance on top of what is left: a dash, or a fresh turn from nothing (1.113 adds each
 *  way of moving's own). */
export function grantRulesetMovement(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  combatant: RulesetCombatant,
  state?: RulesetEncounterState,
): void {
  combatant.movementLeft =
    (combatant.movementLeft ?? 0) + rulesetMovementAllowance(definition, combat, combatant, state);
  const modes = rulesetModeAllowances(definition, combat, combatant, state);
  if (!modes) return;
  const left = (combatant.modeLeft ??= {});
  for (const [mode, cells] of Object.entries(modes) as Array<[RulesetMoveMode, number]>) {
    left[mode] = (left[mode] ?? 0) + cells;
  }
}

/** Cells moved, or spent standing up: off the allowance, and off every way of moving alike (1.113). */
export function spendRulesetMovement(combatant: RulesetCombatant, cells: number): void {
  combatant.movementLeft = Math.max(0, (combatant.movementLeft ?? 0) - cells);
  if (!combatant.modeLeft) return;
  for (const mode of Object.keys(combatant.modeLeft) as RulesetMoveMode[]) {
    combatant.modeLeft[mode] = Math.max(0, (combatant.modeLeft[mode] ?? 0) - cells);
  }
}

/** The allowance back to full at the start of the holder's own turn. */
export function refreshRulesetMovement(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  combatant: RulesetCombatant,
  state?: RulesetEncounterState,
): void {
  if (combatant.movement === undefined) return;
  const allowance = rulesetMovementAllowance(definition, combat, combatant, state);
  combatant.movement = allowance;
  combatant.movementLeft = 0;
  if (combatant.modeLeft) combatant.modeLeft = {};
  grantRulesetMovement(definition, combat, combatant, state);
}

// ── Starting the fight ──

export interface RulesetEncounterInput {
  definition: RulesetDefinition;
  seed: number;
  combatants: RulesetCombatantInput[];
  /** The bestiary catalogs an opponent given as `{ creature: ... }` is looked up in. Fetching them
   *  is the caller's job, exactly as it is for a party member's own catalogs. */
  bestiary?: RulesetCatalogEntriesById;
  /** A caller with its own dice. The seeded roller is used when none is given. */
  roller?: RulesetCombatRoller;
  /**
   * The board this fight stands on, and where everybody starts. The grid is the tactical engine's
   * own, generated by the caller: a fight never makes one of its own.
   *
   * A fight is positioned only when the ruleset says what a cell is worth (`combat.distance`) AND
   * every combatant in it has a cell. Anything less and the board is left out entirely, so a fight
   * is never half on a grid.
   */
  board?: {
    grid: TacticalGrid;
    placements: Record<string, { x: number; y: number }>;
    battlefield?: unknown;
    /** The light it is fought in, and the kind of place it is (1.291). */
    light?: RulesetBoardLight;
    environment?: string;
    /** The board pack it is drawn with (1.333), by library id; none for its environment's. */
    pack?: string;
    /** What stands on it that may be broken (1.316): a jar, a lantern, a door. Its cells off the
     *  board are dropped, and one with none on it is left out; its `defense` is 10 when not said. */
    props?: RulesetBoardPropInput[];
    /** What the board does on its own each round (1.318), and what burns and cuts its growth. */
    events?: RulesetBoardEventInput[];
    growth?: { burnedBy?: string[]; cutBy?: string[] };
    /** What lies on its cells from the start (1.318), by "x,y": growth, light, fog, a season. */
    ground?: Record<string, TacticalGroundCell>;
    /** What standing in some light does here (1.319): Noonfield's. Bright light and sunlight, every
     *  round end, when it does not say. */
    lightRule?: Partial<RulesetBoardLightRule>;
  };
  /** Who is caught unaware as it begins (1.237): no move or action on their first turn, and no
   *  reaction until it ends. One whose conditions say they cannot be surprised is not. */
  surprised?: string[];
  /** Who fights in its own lair (1.315): its lair actions are taken on its lair count. A count
   *  above everybody's comes before the first turn: call `rulesetOpenLairWindow` on the new fight
   *  to open it, as the director does. */
  inLair?: string[];
  /** Held Ground (1.323): whoever reaches no health here is felled instead. A `condition` the fight
   *  does not know and `marks` on a track the sheet does not have are dropped. */
  heldGround?: RulesetHeldGround;
}

/** A prop as a fight is handed it (1.316): its health is what it starts with, and at most. */
export interface RulesetBoardPropInput {
  id?: string;
  label: string;
  cells: Array<{ x: number; y: number }>;
  health: number;
  defense?: number;
  resist?: string[];
  vulnerable?: string[];
  immune?: string[];
  blocks?: { move?: boolean; sight?: boolean };
  fragile?: boolean;
  /** Lit again by somebody beside it (1.332): `light` on every cell within `squares` of it, for
   *  `budget` ("action" when not said). */
  relight?: { light: "bright" | "dim" | "sunlight"; squares: number; budget?: string };
  /** Its sprite in the board's pack (1.333), `bp_<name>`; `bp_<name>_broken` once broken. */
  art?: string;
}

/** The props a board is handed (1.316), as a fight keeps them: on the board, each with health. */
export function rulesetBoardProps(grid: TacticalGrid, props: RulesetBoardPropInput[] | undefined): RulesetBoardProp[] {
  const used = new Set<string>();
  const words = (list: string[] | undefined) =>
    Array.isArray(list) ? list.filter((one) => typeof one === "string" && one.trim()) : [];
  return (props ?? []).flatMap((prop, index) => {
    if (!prop || typeof prop.label !== "string" || !prop.label.trim() || !Array.isArray(prop.cells)) return [];
    const seen = new Set<string>();
    const cells = prop.cells.flatMap((cell) => {
      const ok =
        !!cell &&
        Number.isInteger(cell.x) &&
        Number.isInteger(cell.y) &&
        cell.x >= 0 &&
        cell.y >= 0 &&
        cell.x < grid.width &&
        cell.y < grid.height &&
        !seen.has(`${cell.x},${cell.y}`);
      if (ok) seen.add(`${cell.x},${cell.y}`);
      return ok ? [{ x: cell.x, y: cell.y }] : [];
    });
    const health = Math.floor(Number(prop.health));
    if (cells.length === 0 || !Number.isFinite(health) || health < 1) return [];
    let id = typeof prop.id === "string" && prop.id.trim() ? prop.id.trim() : `prop-${index + 1}`;
    while (used.has(id)) id = `${id}-${index + 1}`;
    used.add(id);
    const defense = Number.isFinite(Number(prop.defense)) ? Math.floor(Number(prop.defense)) : 10;
    const resist = words(prop.resist);
    const vulnerable = words(prop.vulnerable);
    const immune = words(prop.immune);
    return [
      {
        id,
        label: prop.label.trim(),
        cells,
        health,
        max: health,
        defense,
        ...(resist.length ? { resist } : {}),
        ...(vulnerable.length ? { vulnerable } : {}),
        ...(immune.length ? { immune } : {}),
        ...(prop.blocks?.move || prop.blocks?.sight
          ? {
              blocks: {
                ...(prop.blocks.move ? { move: true as const } : {}),
                ...(prop.blocks.sight ? { sight: true as const } : {}),
              },
            }
          : {}),
        ...(prop.fragile ? { fragile: true as const } : {}),
        ...(prop.relight &&
        ["bright", "dim", "sunlight"].includes(prop.relight.light) &&
        Number.isInteger(prop.relight.squares) &&
        prop.relight.squares >= 0
          ? {
              relight: {
                light: prop.relight.light,
                squares: Math.min(prop.relight.squares, 12),
                budget:
                  typeof prop.relight.budget === "string" && prop.relight.budget.trim()
                    ? prop.relight.budget.trim()
                    : "action",
              },
            }
          : {}),
        ...(typeof prop.art === "string" && BOARD_PROP_ART.test(prop.art) ? { art: prop.art } : {}),
      },
    ];
  });
}

/**
 * A fight, ready for its first turn. Initiative is rolled once, here, as the kind says: a tie goes
 * to the higher modifier, and then to the order the combatants were handed in, so the same input
 * and the same seed always produce the same order.
 *
 * A ruleset with no `combat` block cannot resolve a fight, so it comes back as an encounter with
 * nobody in it rather than throwing: the caller reads the outcome and falls back to what it did
 * before.
 */
/** A shape change's forms (1.392), each a mode of its action: from the bestiary, the fight's own and
 *  its user's catalogs, kept to what its user's sheet allows them now. */
/** A catalog entry's or an item use's call (1.394), found in `catalogs`: its one creature, or its
 *  options as modes. One nobody can find calls nobody, and an option nobody can find is not offered. */
/** The `"<catalogId>/<entryId>"` of every entry of a catalog that a `from` matches (1.401, 1.402), in
 *  the catalog's order: all of its `filters`, none of its `notFilters`. An entry's value matches any
 *  of what is wanted, without regard to case; a value that is itself a list, any of its own. */
export function rulesetCatalogMatches(catalogs: RulesetCatalogEntriesById, from: RulesetCatalogFrom): string[] {
  const plain = (one: string | number) => String(one).trim().toLowerCase();
  const wanted = (value: string | number | string[] | undefined, want: string | number | Array<string | number>) => {
    if (value === undefined) return false;
    const have = (Array.isArray(value) ? value : [value]).map(plain);
    return (Array.isArray(want) ? want : [want]).some((one) => have.includes(plain(one)));
  };
  // Each once: a catalog the fight's bestiary and the ruleset both carry lists its entries twice.
  const refs = new Set<string>();
  for (const entry of catalogs[from.catalog] ?? []) {
    const filters = entry.filters ?? {};
    if (Object.entries(from.filters ?? {}).some(([id, want]) => !wanted(filters[id], want))) continue;
    if (Object.entries(from.notFilters ?? {}).some(([id, want]) => wanted(filters[id], want))) continue;
    refs.add(`${from.catalog}/${entry.id}`);
  }
  return [...refs];
}

function fillCatalogCalls(
  definition: RulesetDefinition,
  action: RulesetCombatAction,
  catalogs: RulesetCatalogEntriesById,
): void {
  const asTypes = action.callsOf!.asTypes;
  fillCatalogCallsAsWritten(definition, action, catalogs);
  if (!asTypes?.length || action.callsRolled) return;
  // A type picked as well (1.487), each creature once for each: Find Familiar's celestial, fey or
  // fiend in place of a beast.
  const labels = new Map((definition.combat?.creatureTypes?.types ?? []).map((one) => [one.id, one.label]));
  const modes = action.calls ? [{ id: "call", label: action.calls.name, call: action.calls }] : (action.modes ?? []);
  delete action.calls;
  action.modes = modes.flatMap((mode) =>
    mode.call
      ? asTypes.map((type) => ({
          ...mode,
          id: `${mode.id}-as-${type}`,
          label: `${mode.label}, ${labels.get(type) ?? type}`,
          call: { ...mode.call!, block: { ...mode.call!.block, type } },
        }))
      : [mode],
  );
  action.callChoice = true;
}

function fillCatalogCallsAsWritten(
  definition: RulesetDefinition,
  action: RulesetCombatAction,
  catalogs: RulesetCatalogEntriesById,
): void {
  const calls = action.callsOf!;
  delete action.callsOf;
  const found = (
    ref: string,
    written: RulesetCatalogCalls["count"],
    /** More for each step paid, and the steps it needs (1.537). */
    stepped: { perStep?: number; fromStep?: number } = {},
  ): NonNullable<RulesetCombatAction["calls"]> | null => {
    const [catalogId, entryId] = ref.split("/");
    const entry = catalogId && entryId ? findRulesetCreatureEntry(catalogs, { catalogId, entryId }) : null;
    const block = rulesetCreatureBlock(definition, entry);
    const count = amountOf(written);
    if (!entry || !block || !count) return null;
    return {
      block,
      name: entry.label,
      creature: { catalogId: catalogId!, entryId: entryId! },
      count,
      ...(calls.initiative === "after" ? { after: true as const } : {}),
      ...(calls.initiative === "none" ? { turnless: true as const } : {}),
      ...(calls.rounds ? { rounds: calls.rounds } : {}),
      ...(calls.timesPerSteps ? { timesPerSteps: calls.timesPerSteps } : {}),
      ...((stepped.perStep ?? calls.perStep) ? { perStep: stepped.perStep ?? calls.perStep } : {}),
      ...(stepped.fromStep ? { fromStep: stepped.fromStep } : {}),
      ...(calls.hostileOnBreak ? { hostileOnBreak: true as const } : {}),
      ...(calls.fromCaller || calls.callerAction
        ? {
            fromCaller: {
              ...structuredClone(calls.fromCaller ?? {}),
              ...(calls.callerAction ? { action: calls.callerAction } : {}),
            },
          }
        : {}),
      ...(calls.commandedWith ? { commandedWith: calls.commandedWith } : {}),
      ...(calls.commandedBy ? { commandedBy: calls.commandedBy } : {}),
      ...(calls.illusion ? { illusion: true as const } : {}),
      ...(calls.endsWithCaller ? { endsWithCaller: calls.endsWithCaller } : {}),
      ...(calls.endsWhenSpent ? { endsWhenSpent: true as const } : {}),
      ...(calls.cantCall ? { cantCall: true as const } : {}),
      ...(calls.leash ? { leash: calls.leash } : {}),
      ...(calls.commandedWithin ? { commandedWithin: calls.commandedWithin } : {}),
      ...(calls.within ? { within: { ...calls.within } } : {}),
      ...(calls.hostileUnless ? { hostileUnless: { ...calls.hostileUnless } } : {}),
      ...(calls.spendsItemOnDeath ? { spendsItemOnDeath: true as const } : {}),
      ...(calls.becomesItem ? { becomesItem: true as const } : {}),
      ...(calls.side === "none" ? { wild: calls.tamedWhile ? { tamedWhile: calls.tamedWhile } : {} } : {}),
      ...(calls.disobeys ? { disobeys: structuredClone(calls.disobeys) } : {}),
    };
  };
  if (calls.creature && calls.count) {
    const call = found(calls.creature, calls.count);
    if (call) action.calls = call;
    return;
  }
  // Read from a catalog (1.402): each match no higher than `upTo` is one mode to pick among. Where
  // `upTo` rises with each step paid (1.537), one higher still is offered from the steps it needs.
  const matching = (
    from: RulesetCatalogFrom,
    upTo: { filter: string; at: number; perStep?: number } | undefined,
    least = 0,
  ): Array<{ ref: string; fromStep: number }> =>
    rulesetCatalogMatches(catalogs, from).flatMap((ref) => {
      if (!upTo) return [{ ref, fromStep: least }];
      const [catalogId, entryId] = ref.split("/");
      const entry = findRulesetCreatureEntry(catalogs, { catalogId: catalogId!, entryId: entryId! });
      const rank = entry?.filters?.[upTo.filter];
      if (typeof rank !== "number" || rank <= upTo.at) return [{ ref, fromStep: least }];
      if (!upTo.perStep) return [];
      const needs = Math.ceil((rank - upTo.at) / upTo.perStep - 1e-9);
      return needs <= 20 ? [{ ref, fromStep: Math.max(least, needs) }] : [];
    });
  const many = (count: RulesetCatalogCalls["count"]) => (count?.dice ? count.dice : String(count?.flat ?? 1));
  // Rolled among what it reads (1.748), never picked: a bead's Planar Ally, the deity choosing.
  if (calls.from && calls.count && calls.rolled) {
    const rows = matching(calls.from, calls.upTo).flatMap(({ ref }, index) => {
      const call = found(ref, calls.count);
      return call ? [{ weight: 1, label: `${call.name} ×${many(calls.count)}`, call, index: index + 1 }] : [];
    });
    if (rows[0]) {
      delete action.callChoice;
      action.calls = rows[0].call;
      action.callsRolled = rows;
      if (calls.keepsRoll) action.callsRollKept = true;
      if (calls.lifetimeUses !== undefined) action.callsLifetime = calls.lifetimeUses;
    }
    return;
  }
  if (calls.from && calls.count) {
    const count = calls.count;
    action.modes = matching(calls.from, calls.upTo).flatMap(({ ref, fromStep }) => {
      const call = found(ref, count, fromStep ? { fromStep } : {});
      return call ? [{ id: `call-${ref.split("/")[1]}`, label: `${call.name} ×${many(count)}`, call }] : [];
    });
    return;
  }
  // Rolled among as it is used (1.559), never picked: a Bag of Tricks' beasts, an Efreeti Bottle's
  // efreeti. The first that calls anybody stands for the call until the roll says which.
  if (calls.rolled && calls.options) {
    delete action.callChoice;
    const rows = calls.options.map((option, index) => {
      const call = option.creature ? found(option.creature, option.count) : null;
      return {
        weight: option.weight ?? 1,
        label: option.label ?? (call ? `${call.name} ×${many(option.count)}` : `${index + 1}`),
        ...(call ? { call } : {}),
        ...(option.hostile ? { hostile: true as const } : {}),
        // Kept, spent and past its lifetime (1.591): an Efreeti Bottle.
        index: index + 1,
        ...(option.rounds !== undefined ? { rounds: option.rounds } : {}),
        ...(option.spendsItem ? { spendsItem: true as const } : {}),
        ...(option.pastLifetime ? { pastLifetime: true as const } : {}),
      };
    });
    const first = rows.find((row) => row.call);
    if (first?.call) {
      action.calls = first.call;
      action.callsRolled = rows;
      if (calls.keepsRoll) action.callsRollKept = true;
      if (calls.lifetimeUses !== undefined) action.callsLifetime = calls.lifetimeUses;
    }
    return;
  }
  action.modes = (calls.options ?? []).flatMap((option, index) => {
    const stepped = (fromStep: number) => ({
      ...(option.perStep ? { perStep: option.perStep } : {}),
      ...(fromStep ? { fromStep } : {}),
    });
    if (option.from) {
      return matching(option.from, option.upTo, option.fromStep ?? 0).flatMap(({ ref, fromStep }) => {
        const call = found(ref, option.count, stepped(fromStep));
        if (!call) return [];
        if (option.onlyWhere) call.onlyWhere = structuredClone(option.onlyWhere);
        const label = `${call.name} ×${many(option.count)}`;
        return [
          { id: `call-${index}-${ref.split("/")[1]}`, label: option.label ? `${option.label}: ${label}` : label, call },
        ];
      });
    }
    const call = option.creature ? found(option.creature, option.count, stepped(option.fromStep ?? 0)) : null;
    if (!call) return [];
    // Only where it says (1.614): Children of the Night's wolves outdoors.
    if (option.onlyWhere) call.onlyWhere = structuredClone(option.onlyWhere);
    return [{ id: `call-${index}`, label: option.label ?? `${call.name} ×${many(option.count)}`, call }];
  });
}

function fillShapeForms(
  definition: RulesetDefinition,
  combatant: RulesetCombatant,
  action: RulesetCombatAction,
  bestiary: RulesetCatalogEntriesById,
): void {
  const forms = action.formsOf!;
  delete action.formsOf;
  const catalogs: RulesetCatalogEntriesById = { ...bestiary };
  for (const [catalogId, entries] of Object.entries(combatant.sheet?.catalogs ?? {})) {
    catalogs[catalogId] = [...(catalogs[catalogId] ?? []), ...entries];
  }
  const sheet = combatant.sheet;
  let evaluated: ReturnType<typeof evaluateRulesetSheetLive> | undefined;
  const read = (ref: RulesetValueRef) =>
    sheet
      ? resolveRulesetValueRef(
          definition,
          sheet.build,
          ref,
          (evaluated ??= evaluateRulesetSheetLive(
            definition,
            sheet.build,
            sheet.live,
            sheet.items,
            combatant.abilityConditions,
          )),
        )
      : 0;
  const cap = forms.upTo?.at && sheet ? read(forms.upTo.at) : undefined;
  const modes: RulesetCombatMode[] = [];
  // Named ones first, then every match of the catalog `from` reads (1.401), each once.
  const refs = [...(forms.into ?? [])];
  for (const ref of forms.from ? rulesetCatalogMatches(catalogs, forms.from) : []) {
    if (!refs.includes(ref)) refs.push(ref);
  }
  for (const ref of refs) {
    const [catalogId, entryId] = ref.split("/");
    const entry = catalogId && entryId ? findRulesetCreatureEntry(catalogs, { catalogId, entryId }) : null;
    const block = rulesetCreatureBlock(definition, entry);
    if (!entry || !block) continue;
    const ranked = forms.upTo ? entry.filters?.[forms.upTo.filter] : undefined;
    const rank = typeof ranked === "number" ? ranked : undefined;
    if (cap !== undefined && rank !== undefined && rank > cap) continue;
    // A way of moving it may not have yet: no flying before druid level 8.
    if (forms.without?.some((bar) => (block.speeds?.[bar.speed] ?? 0) > 0 && !(bar.unless && read(bar.unless) > 0)))
      continue;
    modes.push({
      id: `form-${catalogId}-${entryId}`,
      label: entry.label,
      form: {
        creature: { catalogId: catalogId!, entryId: entryId! },
        name: entry.label,
        block,
        ...(rank !== undefined ? { rank } : {}),
      },
    });
  }
  action.modes = modes;
  if (forms.upTo?.targetLevel) action.formCap = { filter: forms.upTo.filter, targetLevel: forms.upTo.targetLevel };
}

/** Whether a catalog entry's filter reads as a `where` says (1.414): its word, its number, or one of
 *  its list of words, without case. */
export function rulesetCatalogWhereReads(
  entry: { filters?: Record<string, unknown> },
  where: { filter: string; equals: string | number },
): boolean {
  const value = entry.filters?.[where.filter];
  const wanted = String(where.equals).trim().toLowerCase();
  const reads = (one: unknown) =>
    (typeof one === "string" || typeof one === "number") && String(one).trim().toLowerCase() === wanted;
  return Array.isArray(value) ? value.some(reads) : reads(value);
}

export function createRulesetEncounter(input: RulesetEncounterInput): RulesetEncounterState {
  const { definition, seed } = input;
  const combat = definition.combat;
  const state: RulesetEncounterState = {
    v: 1,
    ruleset: { id: definition.id, version: definition.version },
    seed,
    cursor: 0,
    round: 1,
    turn: 0,
    order: [],
    combatants: [],
    opening: [],
  };
  if (!combat) return state;

  let rolls = 0;
  const roller = input.roller ?? rulesetCombatRoller(seed, 0);
  const roll: RulesetCombatRoller = (sides) => {
    rolls += 1;
    return roller(sides);
  };
  // What every distance in this fight is measured in. Undefined is a ruleset that gives no size to
  // a cell, and then nothing about distance is read at all: the fight is exactly what it was before.
  const perCell = combat.distance?.perCell;

  const refused: RulesetCombatEvent[] = [];
  for (const entry of input.combatants) {
    // A stat block or a bestiary creature is built as one, whichever side it stands on (1.394).
    if (!("build" in entry)) {
      // A bestiary reference that names nothing is left out of the fight rather than walked in with
      // no numbers, and the opening says so.
      const found =
        "block" in entry
          ? entry.block
          : rulesetCreatureBlock(definition, findRulesetCreatureEntry(input.bestiary ?? {}, entry.creature));
      const block = found && "creature" in entry && entry.adjust ? rulesetAdjustedBlock(found, entry.adjust) : found;
      if (!block) {
        refused.push({ type: "refused", actorId: entry.id, reason: "unknown-creature" });
        continue;
      }
      const initiativeRoll = throwInitiativeDice(combat, roll);
      const carriedIn = "carried" in entry && entry.carried?.length ? entry.carried : undefined;
      const carried = carriedIn?.map((one) => one.held);
      if (block.sheet) {
        // Described in the ruleset's own terms, so built exactly as a party member is: its health,
        // defense, saves, speed, initiative and the abilities on its lists all come from what the
        // ruleset declares. The sheet exists for this fight only and is written back nowhere. What
        // the block adds on top (its own actions, points, riders and the damage it shrugs off)
        // is kept beside it.
        const combatant = sheetCombatant(definition, combat, {
          id: entry.id,
          name: entry.name,
          side: entry.side,
          initiativeRoll,
          roll,
          build: block.sheet,
          // A party member who is this creature reads its own (a copy's, 5e's Simulacrum).
          live: "creature" in entry && entry.live !== undefined ? readStoredLive(entry.live) : {},
          catalogs: input.bestiary ?? {},
          perCell,
          // What it has on it (1.795), used as a party member's are.
          ...(carried ? { items: carried } : {}),
        });
        if (carriedIn) combatant.carried = carriedRecord(carriedIn);
        combatant.actions = [
          ...combatant.actions,
          ...blockActions(definition, block, perCell),
          ...innateActions(definition, block, input.bestiary ?? {}, perCell),
          ...storedBlockActions(
            definition,
            block,
            entry.name,
            "stored" in entry ? entry.stored : undefined,
            input.bestiary ?? {},
            perCell,
          ),
        ];
        combatant.uses = startingUses(combatant.actions);
        if (block.signaturePoints !== undefined) {
          combatant.signature = { points: block.signaturePoints, max: block.signaturePoints };
        }
        if (block.riders?.length) {
          combatant.riders = [...(combatant.riders ?? []), ...block.riders.map((rider) => ({ ...rider }))];
        }
        combatant.block = block;
        // A creature that names its size is that size, whatever its sheet reads.
        if (block.size !== undefined && combat.sizes) combatant.size = block.size;
        // And one that names how it moves moves that way, whatever its sheet reads.
        if (block.speeds) combatant.speeds = { ...block.speeds };
        if (block.hover) combatant.hover = true;
        if ("creature" in entry) combatant.creature = creatureRef(definition, entry.creature);
        if ("creature" in entry && entry.live !== undefined) combatant.cardLive = { conditions: [] };
        // A sheet that gives it no health at all is a creature that could never be hurt or ever
        // stand: left out, and the opening says why, rather than walked in as something unkillable.
        const health = rulesetCombatHealth(definition, combat, combatant);
        if (health.max <= 0) {
          refused.push({ type: "refused", actorId: entry.id, reason: "no-health" });
          continue;
        }
        state.combatants.push(combatant);
        continue;
      }
      // A block that is neither: no sheet, and missing a number it cannot fight without. A schema
      // keeps every shipped creature out of here; this keeps a hand-built one out too.
      if (!isRulesetPlainStatBlock(block)) {
        refused.push({ type: "refused", actorId: entry.id, reason: "unknown-creature" });
        continue;
      }
      // A pool's initiative is its own number of dice, thrown before anything else about it.
      const initiative = combat.initiative.pool
        ? rulesetPoolInitiative(definition, combat, roll, block.initiativeModifier)
        : {
            roll: initiativeRoll,
            modifier: block.initiativeModifier,
            total: sumOf(initiativeRoll) + block.initiativeModifier,
          };
      // Dice health is thrown once, here, so the same seed always builds the same opponent.
      const health = block.healthDice
        ? sumOf(rollRulesetDice(roll, block.healthDice.count, block.healthDice.sides)) + block.healthDice.flat
        : block.health;
      const max = Math.max(1, health);
      const actions = [
        ...blockActions(definition, block, perCell),
        ...innateActions(definition, block, input.bestiary ?? {}, perCell),
        ...storedBlockActions(
          definition,
          block,
          entry.name,
          "stored" in entry ? entry.stored : undefined,
          input.bestiary ?? {},
          perCell,
        ),
        ...(carried ? carriedBlockActions(definition, combat, carried, perCell) : []),
      ];
      state.combatants.push({
        id: entry.id,
        name: entry.name,
        side: entry.side,
        ...(carriedIn ? { carried: carriedRecord(carriedIn) } : {}),
        ...("creature" in entry ? { creature: creatureRef(definition, entry.creature) } : {}),
        initiativeRoll: initiative.roll,
        initiativeModifier: initiative.modifier,
        initiative: initiative.total,
        budgets: fullBudgets(combat),
        actions,
        uses: startingUses(actions),
        spent: [],
        ...(block.signaturePoints !== undefined
          ? { signature: { points: block.signaturePoints, max: block.signaturePoints } }
          : {}),
        ...(block.riders?.length ? { riders: block.riders.map((rider) => ({ ...rider })) } : {}),
        // Its heads (1.550), and what it holds while it has more than one.
        ...(block.heads
          ? {
              heads: {
                count: block.heads.count,
                ...(block.heads.opportunityReactions ? { spare: block.heads.count - 1 } : {}),
              },
            }
          : {}),
        tracked: (block.heads?.whileMany ?? []).map((condition) => ({ condition, rounds: null })),
        concentrating: null,
        flags: {},
        down: false,
        dying: false,
        stable: false,
        defeated: false,
        defense: block.defense,
        saves: { ...(block.saves ?? {}) },
        ...(combat.checks?.length
          ? { checks: Object.fromEntries(combat.checks.map((check) => [check.id, block.checks?.[check.id] ?? 0])) }
          : {}),
        ...(block.soak && (rulesetCombatIsPool(combat) || combat.kind === "symbol-pool")
          ? {
              soak: {
                ...(block.soak.all !== undefined ? { all: block.soak.all } : {}),
                ...(block.soak.byKind ? { byKind: { ...block.soak.byKind } } : {}),
              },
            }
          : {}),
        ...(block.hardness && rulesetCombatIsPool(combat) ? { hardness: block.hardness } : {}),
        ...(() => {
          const size = combat.sizes ? (block.size ?? combat.sizes.default) : undefined;
          return size !== undefined ? { size } : {};
        })(),
        speed: block.speed ?? 0,
        ...(block.speeds ? { speeds: { ...block.speeds } } : {}),
        ...(block.hover ? { hover: true as const } : {}),
        ...(() => {
          const tracks = { ...(block.tracks ?? {}), ...("tracks" in entry ? (entry.tracks ?? {}) : {}) };
          return Object.keys(tracks).length ? { tracks } : {};
        })(),
        block,
        health: { value: max, max, temp: 0 },
      });
      // A party member who is this creature (a copy's, 5e's Simulacrum), as its card left it.
      if ("creature" in entry && entry.live !== undefined) keepCardLive(combat, state.combatants.at(-1)!, entry.live);
      continue;
    }
    const initiativeRoll = throwInitiativeDice(combat, roll);
    const combatant = sheetCombatant(definition, combat, {
      id: entry.id,
      name: entry.name,
      side: "party",
      initiativeRoll,
      roll,
      build: entry.build,
      ...(entry.holder !== undefined ? { holder: entry.holder } : {}),
      // What only a worn item kept on (1.664) is off when that item no longer is.
      live: entry.items
        ? rulesetLiveWornOff(
            readStoredLive(entry.live),
            new Set(entry.items.flatMap((held) => (held.worn && held.stack ? [held.stack.id] : []))),
          ).live
        : readStoredLive(entry.live),
      catalogs: entry.catalogs ?? {},
      perCell,
      // Bound without meeting what it asks (1.667), an item is not worn.
      ...(entry.items
        ? { items: [...rulesetItemsMeetingNeeds(definition, entry.build, entry.live, entry.items)] }
        : {}),
    });
    // A member who walked in at zero is already down, which is the honest reading of their sheet.
    const health = rulesetCombatHealth(definition, combat, combatant);
    if (health.value <= 0 && health.max > 0) {
      combatant.down = true;
      combatant.dying = !!combat.dying;
      // Stable as the story or the last fight left them, they roll no saves until hurt again (cheap-GM
      // playtest 2026-10-26: a hero stabilised in the story rolled death saves again in the next fight).
      if (combat.dying && readStoredLive(entry.live).stable === true) combatant.stable = true;
      if (combat.dying?.condition) {
        writeRulesetSheet(definition, combatant, { op: "condition", condition: combat.dying.condition, active: true });
      }
    }
    state.combatants.push(combatant);
  }

  // Every catalog the fight was handed, by entry, read only when something needs it.
  let handedByRef: ReturnType<typeof rulesetCatalogEntriesByRef> | undefined;
  const handed = () => {
    if (handedByRef) return handedByRef;
    const all: Record<string, RulesetCatalogEntry[]> = {};
    const hand = (catalogs: RulesetCatalogEntriesById | undefined) => {
      for (const [catalogId, entries] of Object.entries(catalogs ?? {})) {
        all[catalogId] = [...(all[catalogId] ?? []), ...entries];
      }
    };
    for (const catalog of definition.catalogs ?? []) hand({ [catalog.id]: catalog.entries ?? [] });
    hand(input.bestiary);
    for (const entry of input.combatants) hand("catalogs" in entry ? entry.catalogs : undefined);
    handedByRef = rulesetCatalogEntriesByRef(all);
    return handedByRef;
  };
  // What a condition lets its holder use (1.236).
  if (combat.conditions?.some((condition) => condition.actions?.length || condition.endable)) {
    for (const combatant of state.combatants) {
      combatant.actions = [...combatant.actions, ...conditionActions(definition, combatant, handed(), perCell)];
    }
  }
  // The catalog entries a combatant's sheet rows came from, each once.
  const heldEntries = (combatant: RulesetCombatant): RulesetCatalogEntry[] => {
    const rows = Object.values(combatant.sheet?.build.lists ?? {}).flatMap((list) => (Array.isArray(list) ? list : []));
    const refs = new Set(
      rows.flatMap((row) => {
        const ref =
          row && typeof row === "object"
            ? columnValue(row as Record<string, unknown>, RULESET_CATALOG_ROW_KEY)
            : undefined;
        return typeof ref === "string" ? [ref] : [];
      }),
    );
    return [...refs].flatMap((ref) => handed().get(ref) ?? []);
  };
  // Caught unaware (1.237), unless what they hold says they never are: 5e's Foresight. What shakes it
  // off is read off their own rows: Feral Instinct's rage.
  const surprised: string[] = [];
  const surprise = (id: string) => {
    const combatant = rulesetCombatant(state, id);
    if (!combatant || combatant.surprised) return;
    if (rulesetActiveConditions(definition, combat, combatant, state).some((entry) => entry.cannotBeSurprised)) {
      return;
    }
    combatant.surprised = true;
    surprised.push(id);
    const out = heldEntries(combatant).flatMap((entry) => {
      const by = entry.mechanics?.ignoresSurpriseWith;
      return by ? combatant.actions.filter((action) => action.entry === by).map((action) => action.id) : [];
    });
    if (out.length) combatant.surpriseOut = [...new Set(out)];
  };
  for (const id of input.surprised ?? []) surprise(id);
  // In its lair (1.315), a creature with lair actions takes them on its lair's count.
  for (const id of new Set(input.inLair ?? [])) {
    const combatant = rulesetCombatant(state, id);
    if (!combatant?.actions.some((action) => action.lair)) continue;
    combatant.lair = { at: combatant.block?.lairInitiative ?? 20 };
  }
  // Who a creature's action calls (1.325), found now in the ruleset's catalogs or the fight's
  // bestiary: one nobody can find calls nobody.
  const callable = (): RulesetCatalogEntriesById => {
    const all: RulesetCatalogEntriesById = {};
    for (const catalog of definition.catalogs ?? []) all[catalog.id] = [...(catalog.entries ?? [])];
    for (const [catalogId, entries] of Object.entries(input.bestiary ?? {})) {
      all[catalogId] = [...entries, ...(all[catalogId] ?? [])];
    }
    return all;
  };
  for (const combatant of state.combatants) {
    combatant.block?.actions.forEach((source, index) => {
      if (!source.calls) return;
      const action = combatant.actions.find(
        (one) => one.kind === "block" && one.id === (source.id ?? `block:${index}`),
      );
      // Sent away again as an action (1.449): Summon Demon's "until its summoner dismisses it".
      if (action && source.calls.dismissible) {
        combatant.actions.push({
          id: `dismiss-called:${action.id}`,
          kind: "switch",
          label: action.label,
          // On a budget of its own (1.610): a treant's bonus action.
          budget: typeof source.calls.dismissible === "object" ? source.calls.dismissible.budget : action.budget,
          targets: { side: "self", count: 0 },
          switches: { called: action.id },
        });
      }
      // Its options (1.446), found as a catalog entry's are, below.
      if (source.calls.options) {
        if (!action) return;
        action.callsOf = {
          options: structuredClone(source.calls.options),
          ...(source.calls.initiative ? { initiative: source.calls.initiative } : {}),
          ...(source.calls.rounds ? { rounds: source.calls.rounds } : {}),
          ...(source.calls.endsWithCaller ? { endsWithCaller: source.calls.endsWithCaller } : {}),
          ...(source.calls.cantCall ? { cantCall: true as const } : {}),
          ...(source.calls.leash ? { leash: source.calls.leash } : {}),
          ...(source.calls.within ? { within: { ...source.calls.within } } : {}),
          ...(source.calls.commandedWith ? { commandedWith: source.calls.commandedWith } : {}),
          ...(source.calls.commandedBy ? { commandedBy: source.calls.commandedBy.action } : {}),
          ...(source.calls.fromCaller ? { callerAction: source.calls.fromCaller.action } : {}),
        };
        // They arrive after their caller's turns (1.614), whichever option comes.
        if (source.calls.arrivesIn) action.callsArriveIn = { ...source.calls.arrivesIn };
        action.callChoice = true;
        return;
      }
      if (!source.calls.creature || !source.calls.count) return;
      const [catalogId, entryId] = source.calls.creature.split("/");
      const catalogs = callable();
      const entry = catalogId && entryId ? findRulesetCreatureEntry(catalogs, { catalogId, entryId }) : null;
      const block = rulesetCreatureBlock(definition, entry);
      if (!action || !entry || !block) return;
      action.calls = {
        block,
        name: entry.label,
        creature: { catalogId: catalogId!, entryId: entryId! },
        count: { ...source.calls.count },
        ...(source.calls.initiative === "after" ? { after: true as const } : {}),
        ...(source.calls.initiative === "none" ? { turnless: true as const } : {}),
        ...(source.calls.rounds ? { rounds: source.calls.rounds } : {}),
        ...(source.calls.endsWithCaller ? { endsWithCaller: source.calls.endsWithCaller } : {}),
        ...(source.calls.cantCall ? { cantCall: true as const } : {}),
        ...(source.calls.atCorpse ? { atCorpse: structuredClone(source.calls.atCorpse) } : {}),
        ...(source.calls.atMost ? { atMost: source.calls.atMost } : {}),
        ...(source.calls.leash ? { leash: source.calls.leash } : {}),
        ...(source.calls.within ? { within: { ...source.calls.within } } : {}),
        ...(source.calls.onlyWhere ? { onlyWhere: structuredClone(source.calls.onlyWhere) } : {}),
        ...(source.calls.arrivesIn ? { arrivesIn: { ...source.calls.arrivesIn } } : {}),
        // Commanded, with their caller's own attack (1.707): a solar's Flying Sword.
        ...(source.calls.commandedWith ? { commandedWith: source.calls.commandedWith } : {}),
        ...(source.calls.commandedBy ? { commandedBy: source.calls.commandedBy.action } : {}),
        ...(source.calls.fromCaller ? { fromCaller: { action: source.calls.fromCaller.action } } : {}),
      };
      // Aimed at the corpse it rises from (1.554).
      if (source.calls.atCorpse) action.targets = { side: "any", count: 1 };
    });
  }
  // Who a catalog entry or an item use calls (1.394), the same way; its options as modes.
  for (const combatant of state.combatants) {
    const dismissals: RulesetCombatAction[] = [];
    for (const action of combatant.actions) {
      if (!action.callsOf) continue;
      const dismissible = action.callsOf.dismissible;
      fillCatalogCalls(definition, action, callable());
      // Sent away again (1.613), on its own budget or one it names: a Staff of the Python's bonus action.
      if (dismissible && (action.calls || action.modes?.some((mode) => mode.call) || action.callsRolled)) {
        dismissals.push({
          id: `dismiss-called:${action.id}`,
          kind: "switch",
          label: action.label,
          budget: typeof dismissible === "object" ? dismissible.budget : action.budget,
          targets: { side: "self", count: 0 },
          switches: { called: action.id },
        });
      }
    }
    combatant.actions.push(...dismissals);
  }
  // The forms a shape change offers (1.392), found now in the ruleset's catalogs, the fight's bestiary
  // or the user's own: one nobody can find is not offered, nor one its user may not take yet.
  for (const combatant of state.combatants) {
    for (const action of combatant.actions) {
      if (action.formsOf) fillShapeForms(definition, combatant, action, callable());
    }
  }
  // And what the creatures in it may be turned into: their own number by each filter a form is capped by.
  const capped = new Set(
    state.combatants.flatMap((one) => one.actions.flatMap((action) => (action.formCap ? [action.formCap.filter] : []))),
  );
  if (capped.size) {
    const catalogs = callable();
    for (const combatant of state.combatants) {
      if (!combatant.creature) continue;
      const entry = findRulesetCreatureEntry(catalogs, combatant.creature);
      const ranks = Object.fromEntries(
        [...capped].flatMap((filter) => {
          const value = entry?.filters?.[filter];
          return typeof value === "number" ? [[filter, value] as const] : [];
        }),
      );
      if (Object.keys(ranks).length) combatant.ranks = ranks;
    }
  }
  // Held Ground (1.323): nobody dies here.
  const held = heldGroundOf(definition, input.heldGround);
  if (held) state.heldGround = held;

  // Everybody's contests, last, so one that takes the place of a strike can see what strikes the
  // actor's own actions buy. A ruleset with none adds nothing, and its fights are what they were.
  if (combat.contests?.length) {
    for (const combatant of state.combatants) {
      combatant.actions = [...combatant.actions, ...contestActions(combat, combatant.actions, perCell)];
    }
  }

  // A concentration entry's effect made again (1.310), offered while its user concentrates on it: on
  // its own budget, paid for already, with no concentration of its own and nothing on its user again.
  for (const combatant of state.combatants) {
    const again = combatant.actions.flatMap((action): RulesetCombatAction[] => {
      if (!action.repeats || !action.concentration) return [];
      const copy: RulesetCombatAction = structuredClone(action);
      copy.id = `${action.id}:again`;
      copy.budget = action.repeats.budget;
      copy.again = {
        of: action.id,
        ...(action.repeats.notSaved ? { notSaved: true as const } : {}),
        ...(action.repeats.sameTargets ? { sameTargets: true as const } : {}),
        ...(action.repeats.group ? { group: action.repeats.group } : {}),
        ...(action.repeats.afterTargetDown ? { afterTargetDown: true as const } : {}),
      };
      delete copy.repeats;
      delete copy.concentration;
      delete copy.appliesSelf;
      delete copy.reaction;
      delete copy.free;
      // Paid for by the cast it repeats: no uses or recharge of its own, and an item's use (1.583)
      // spends nothing of the item again: a scroll of Telekinesis is spent once.
      delete copy.uses;
      delete copy.recharge;
      delete copy.itemUse;
      // Grown by what the cast was paid at, as a condition's action grows (1.300).
      const per = copy.use?.perCostStep;
      if (per) {
        copy.heldSteps = {
          amount: per,
          ...(copy.use!.stepsEvery ? { every: copy.use!.stepsEvery } : {}),
          ...(copy.use!.stepsMax ? { max: copy.use!.stepsMax } : {}),
        };
      }
      delete copy.use;
      return [copy];
    });
    if (again.length) combatant.actions = [...combatant.actions, ...again];
  }

  // What an entry put on somebody, kept up on its own budget (1.431): no cost, no save, nothing new.
  for (const combatant of state.combatants) {
    const sustaining = combatant.actions.flatMap((action): RulesetCombatAction[] => {
      if (!action.sustains || !action.applies?.length) return [];
      const rounds: Record<string, number> = {};
      for (const applies of action.applies) {
        if (typeof applies.duration === "object" && typeof applies.duration.rounds === "number")
          rounds[applies.condition] = applies.duration.rounds;
      }
      return [
        {
          id: `${action.id}:sustain`,
          label: action.label,
          kind: action.kind,
          budget: action.sustains.budget,
          // An area's (1.727) keeps up what it put on everybody still holding it, aimed at nobody.
          targets: action.area || action.around ? { side: "self", count: 0 } : { ...action.targets },
          ...(action.range ? { range: { ...action.range } } : {}),
          ...(action.reach !== undefined ? { reach: action.reach } : {}),
          ...(action.catalog ? { catalog: action.catalog } : {}),
          ...(action.entry ? { entry: action.entry } : {}),
          sustain: { of: action.id, rounds },
        } as RulesetCombatAction,
      ];
    });
    if (sustaining.length) combatant.actions = [...combatant.actions, ...sustaining];
  }

  // Kept on through the fight by what they hold or what their block says (1.263): 5e's paladin
  // auras, Holy Nimbus. Held for the whole fight and never written back to a sheet.
  for (const combatant of state.combatants) {
    const kept = [
      // A line with a `when` (1.653) only while it reads above zero off their sheet.
      ...heldEntries(combatant).flatMap((entry) =>
        (entry.mechanics?.keepsOn ?? []).flatMap((kept) =>
          typeof kept === "string"
            ? [kept]
            : combatant.sheet && resolveRulesetValueRef(definition, combatant.sheet.build, kept.when) > 0
              ? [kept.condition]
              : [],
        ),
      ),
      ...(combatant.block?.keepsOn ?? []),
    ];
    for (const condition of new Set(kept)) {
      if (combatant.tracked.some((entry) => entry.condition === condition)) continue;
      if (rulesetImmuneToCondition(combatant, condition, definition, state)) continue;
      combatant.tracked.push({ condition, rounds: null, kept: true });
    }
  }

  // Grown or shrunk by what they held as the fight began (1.195), before anybody is set down.
  rulesetSyncSizes(definition, state);
  // And the ways of moving they were given (1.395).
  rulesetSyncSpeeds(definition, state);
  // And the abilities the conditions they hold change (1.515).
  rulesetSyncAbilities(definition, state, true);
  placeRulesetCombatants(definition, combat, state, input.board);
  // Mounted as the fight began: what the riders' items put on their mounts moves them (1.717).
  if (state.combatants.some((one) => one.riddenBy)) rulesetSyncSpeeds(definition, state);
  // A flier with no walk, or one that hovers, starts in the air (1.354).
  for (const combatant of state.combatants) {
    if (combatant.speeds?.fly && (combatant.speed <= 0 || combatant.hover)) combatant.airborne = true;
  }
  // What auras spread from where everybody stands (1.263).
  rulesetSyncAuras(definition, state);
  // Hidden in plain sight from the start (1.292), from whoever's passive Perception does not beat
  // it: a gelatinous cube's Transparent.
  if (combat.hiding) {
    for (const combatant of state.combatants) {
      const traits = rulesetHidingTraits(definition, combatant);
      const total = traits.starts;
      if (!total) continue;
      const from = state.combatants
        .filter((viewer) => rulesetStaysHidden(definition, state, viewer, combatant, total, true))
        .map((viewer) => viewer.id);
      if (from.length > 0) combatant.hiding = { total, from, plain: true };
      // Unaware of it, caught by surprise (1.309): a gelatinous cube's Transparent.
      if (traits.surprises) for (const id of from) surprise(id);
    }
  }
  // A turn's budgets as conditions held from before the fight change them (combat C6d): the first
  // actor's turn begins now and never passes through the turn's own refill.
  for (const combatant of state.combatants) {
    const economy = rulesetConditionEconomy(definition, combat, combatant, state);
    if (economy.budgets.size) refreshRulesetBudgets(combat, combatant.budgets, "turn", economy.budgets);
  }

  // Initiative thrown twice (1.240), by what the sheet holds or the conditions say of the check it
  // is: Feral Instinct, Foresight. Thrown once more here, after everything they hold is known.
  for (const combatant of state.combatants) {
    const lean = heldEntries(combatant).find((entry) => entry.mechanics?.initiativeMode)?.mechanics?.initiativeMode;
    if (lean) combatant.initiativeLean = lean;
    rulesetThrowInitiativeAgain(definition, combat, combatant, roll, state);
  }

  const leveled = openLevels(definition, combat, state);
  const refilled = openRefills(definition, state);
  state.order = rulesetInitiativeOrder(state.combatants);
  // A second turn this first round (1.238), placed at its own number among everybody's: 5e's
  // Thief's Reflexes. The order holds them twice until the round is over.
  const extraTurns: RulesetCombatEvent[] = [];
  {
    const slots = state.order.map((id) => rulesetCombatant(state, id)!.initiative);
    for (const combatant of state.combatants) {
      if (combatant.defeated) continue;
      const entry = heldEntries(combatant).find(
        (one) =>
          one.mechanics?.extraFirstTurn && !(one.mechanics.extraFirstTurn.unlessSurprised && combatant.surprised),
      );
      if (!entry) continue;
      const at = combatant.initiative + entry.mechanics!.extraFirstTurn!.initiative;
      // After everybody at that number or above it.
      let place = slots.length;
      while (place > 0 && slots[place - 1]! < at) place -= 1;
      state.order.splice(place, 0, combatant.id);
      slots.splice(place, 0, at);
      extraTurns.push({ type: "extraTurn", actorId: combatant.id, initiative: at, label: entry.label });
    }
  }
  state.cursor = rolls;
  // Whoever a level took out never takes the first turn.
  state.turn = Math.max(
    0,
    state.order.findIndex((id) => !rulesetCombatant(state, id)?.defeated),
  );
  const crashed = openCrashes(definition, combat, state);
  state.opening = [
    ...refused,
    {
      type: "initiative",
      entries: [...new Set(state.order)].flatMap((id) => {
        const combatant = rulesetCombatant(state, id);
        return combatant
          ? [
              {
                actorId: id,
                roll: combatant.initiativeRoll,
                modifier: combatant.initiativeModifier,
                total: combatant.initiative,
                ...rulesetInitiativeTwice(combatant),
              },
            ]
          : [];
      }),
    },
    ...leveled,
    ...refilled,
    ...crashed,
    ...(surprised.length ? ([{ type: "surprised", actorIds: surprised }] as RulesetCombatEvent[]) : []),
    ...extraTurns,
    { type: "round", round: 1 },
    // A board event at round 1's start (1.318) happens as the fight begins: a board opening dark.
    ...rulesetRunBoardEvents(state, "round-start", 1),
    ...(state.order[state.turn]
      ? ([{ type: "turn", actorId: state.order[state.turn], round: 1 }] as RulesetCombatEvent[])
      : []),
  ];
  const first = currentRulesetActor(state);
  // Whose turn has begun this round (1.327): the first one's, as the fight begins.
  if (first) state.acted = [first.id];
  if (first) {
    const waiting = [...new Set(state.order)].filter((id) => {
      const holder = rulesetCombatant(state, id);
      return holder && rulesetReactionsAt(definition, combat, state, holder, "turn-start", first.id).length > 0;
    });
    if (waiting.length) {
      state.windows = 1;
      state.window = {
        id: "w1",
        kind: "reaction",
        waiting,
        trigger: { kind: "turn-start", sourceId: first.id, label: first.name },
      };
      state.opening.push({
        type: "window",
        window: "w1",
        kind: "reaction",
        waiting: [...waiting],
        moment: "turn-start",
        sourceId: first.id,
        label: first.name,
      });
    }
  }
  return state;
}

/** Conditions named outright, or by a kind they are (1.258), each once and in the order named; and
 *  with one named outright, those that count as it (1.585). */
export function rulesetKindConditions(definition: RulesetDefinition, names: readonly string[]): string[] {
  const kinds = definition.combat?.conditions ?? [];
  const out: string[] = [];
  for (const name of names) {
    const ofKind = kinds.filter((entry) => entry.kinds?.includes(name)).map((entry) => entry.condition);
    const counting = kinds.filter((entry) => entry.countsAs?.includes(name)).map((entry) => entry.condition);
    for (const condition of ofKind.length > 0 ? ofKind : [name, ...counting])
      if (!out.includes(condition)) out.push(condition);
  }
  return out;
}

/** A condition and those it counts as (1.585): Enthrall's, and charmed. */
export function rulesetConditionKin(definition: RulesetDefinition | undefined, condition: string): string[] {
  const rule = definition?.combat?.conditions?.find((entry) => entry.condition === condition);
  return [condition, ...(rule?.countsAs ?? [])];
}

/** Whether a creature shrugs this condition off, read the same way wherever one is put on. */
export function rulesetImmuneToCondition(
  combatant: RulesetCombatant,
  condition: string,
  /** Given, what the fighter's items keep off counts too. */
  definition?: RulesetDefinition,
  state?: RulesetEncounterState,
  /** Given, who would put it on, which a condition's `conditionImmunitiesFrom` reads (1.191). */
  source?: RulesetCombatant,
  /** Given, the catalog of the entry that would put it on, which its `catalogs` reads (1.476). */
  catalog?: string,
): boolean {
  const wanted = condition.trim().toLowerCase();
  // Read reached levels without asking immunity again: a track's own immunity must not recurse.
  const immunities = definition
    ? rulesetCombatHide(definition, combatant, state, true).conditionImmunities
    : (combatant.block?.conditionImmunities ?? []);
  if (immunities.some((entry) => entry.trim().toLowerCase() === wanted)) return true;
  // Or to a kind it is (1.258): Divine Health, to every disease.
  const kinds = definition?.combat?.conditions?.find((entry) => entry.condition.trim().toLowerCase() === wanted)?.kinds;
  if (kinds?.some((kind) => immunities.some((entry) => entry.trim().toLowerCase() === kind.trim().toLowerCase())))
    return true;
  // Or to one it counts as (1.585): a creature that cannot be charmed, to Enthrall.
  const kin = new Set(rulesetConditionKin(definition, condition).map((one) => one.trim().toLowerCase()));
  if (immunities.some((entry) => kin.has(entry.trim().toLowerCase()))) return true;
  if ((!source && !catalog) || !definition?.combat) return false;
  return rulesetActiveConditions(definition, definition.combat, combatant, state, true).some((entry) =>
    entry.conditionImmunitiesFrom?.some(
      (one) =>
        one.conditions.some((id) => kin.has(id.trim().toLowerCase())) &&
        (one.from === undefined || (!!source && rulesetTargetIs(definition, source, one.from))) &&
        // Put on by an entry of one of these catalogs (1.476): Freedom of Movement against a spell.
        (one.catalogs === undefined || (!!catalog && one.catalogs.includes(catalog))),
    ),
  );
}

/**
 * What the levels each combatant has reached do as the fight begins (1.115): a halved maximum holds
 * the health they bring to it, so a blow is taken off what they really have, and a level that
 * defeats takes them out before anybody moves.
 */
/** What a sheet's entries give back as initiative is rolled to a pool its holder has none of (1.411):
 *  Superior Inspiration's one use of Bardic Inspiration. */
function openRefills(definition: RulesetDefinition, state: RulesetEncounterState): RulesetCombatEvent[] {
  const events: RulesetCombatEvent[] = [];
  for (const combatant of state.combatants) {
    const sheet = combatant.sheet;
    if (!sheet || combatant.defeated) continue;
    const byRef = rulesetCatalogEntriesByRef({
      ...Object.fromEntries((definition.catalogs ?? []).map((catalog) => [catalog.id, catalog.entries ?? []])),
      ...sheet.catalogs,
    });
    const refs = new Set(
      Object.values(sheet.build.lists ?? {}).flatMap((rows) =>
        Array.isArray(rows)
          ? rows.flatMap((row) => {
              const ref =
                row && typeof row === "object" ? (row as Record<string, unknown>)[RULESET_CATALOG_ROW_KEY] : undefined;
              return typeof ref === "string" ? [ref] : [];
            })
          : [],
      ),
    );
    for (const ref of refs) {
      const entry = byRef.get(ref);
      const refill = entry?.mechanics?.refillsAtInitiative;
      if (!entry || !refill) continue;
      const wanted = refill.pool.trim().toLowerCase();
      const pool = readRulesetLive(definition, sheet.build, sheet.live, sheet.items).pools.find(
        (one) => one.key.toLowerCase() === wanted || one.label.trim().toLowerCase() === wanted,
      );
      if (!pool || pool.value > 0) continue;
      const done = applyRulesetSheetOp(
        definition,
        sheet.build,
        sheet.live,
        { op: "restore", pool: pool.key, amount: refill.amount ?? 1 },
        undefined,
        sheet.items,
      );
      if (!done.ok) continue;
      sheet.live = done.live;
      events.push({ type: "refilled", actorId: combatant.id, label: entry.label, pool: pool.label, now: done.now });
    }
  }
  return events;
}

function openLevels(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  state: RulesetEncounterState,
): RulesetCombatEvent[] {
  if (!combat.levels?.some((level) => level.defeats || level.modifiers?.some((one) => one.to === "health-max"))) {
    return [];
  }
  const events: RulesetCombatEvent[] = [];
  for (const combatant of state.combatants) {
    const health = rulesetCombatHealth(definition, combat, combatant);
    // Only the points they bring are held: the stored maximum stays whole, and is halved as it is read.
    if (combatant.health) combatant.health.value = Math.min(combatant.health.value, health.max);
    else if (combatant.sheet && !("track" in combat.health)) {
      const live = readRulesetLive(definition, combatant.sheet.build, combatant.sheet.live, combatant.sheet.items);
      const pool = live.pools.find((entry) => !entry.listId && entry.key === (combat.health as { pool: string }).pool);
      if (pool && pool.value > health.max) {
        writeRulesetSheet(definition, combatant, { op: "spend", pool: pool.key, amount: pool.value - health.max });
      }
    }
    if (rulesetActiveConditions(definition, combat, combatant, state).some((entry) => entry.defeats)) {
      combatant.down = true;
      combatant.dying = false;
      combatant.defeated = true;
      events.push({ type: "defeated", actorId: combatant.id });
    }
  }
  return events;
}

/** Where initiative is a number attacks move, whoever opens at the crash line or below starts the
 *  fight crashed, exactly as if a blow had put them there, only from nobody. */
function openCrashes(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  state: RulesetEncounterState,
): RulesetCombatEvent[] {
  const crash = combat.initiative.resource?.crash;
  if (!crash) return [];
  const events: RulesetCombatEvent[] = [];
  for (const combatant of state.combatants) {
    if (combatant.initiative > crash.at) continue;
    combatant.crashedTurns = 0;
    const condition = crash.condition;
    if (!condition) continue;
    if (rulesetImmuneToCondition(combatant, condition, definition)) {
      events.push({ type: "condition", targetId: combatant.id, condition, active: false, reason: "immune" });
      continue;
    }
    combatant.tracked.push({ condition, rounds: null });
    if (combatant.sheet) writeRulesetSheet(definition, combatant, { op: "condition", condition, active: true });
    events.push({ type: "condition", targetId: combatant.id, condition, active: true, reason: "applied" });
  }
  return events;
}

/** Who acts first: the highest initiative, then the higher modifier, then whoever joined the fight
 *  first. The order a fight opens with, and the one a round that throws initiative again re-sorts to. */
export function rulesetInitiativeOrder(combatants: readonly RulesetCombatant[]): string[] {
  const position = new Map(combatants.map((combatant, index) => [combatant.id, index]));
  return [...combatants]
    .sort(
      (a, b) =>
        b.initiative - a.initiative ||
        b.initiativeModifier - a.initiativeModifier ||
        (position.get(a.id) ?? 0) - (position.get(b.id) ?? 0),
    )
    .map((combatant) => combatant.id);
}

/** A combatant's initiative modifier as it stands now, or the dice of their initiative pool when the
 *  ruleset throws one: off their sheet against its live state, so a wound that slows them counts
 *  when initiative is thrown again, and a block's own number otherwise. */
export function rulesetInitiativeModifierNow(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  combatant: RulesetCombatant,
): number {
  if (!combatant.sheet) return combatant.initiativeModifier;
  const ref = combat.initiative.pool ?? combat.initiative.modifier;
  if (!ref) return 0;
  const evaluated = evaluateRulesetSheetLive(
    definition,
    combatant.sheet.build,
    combatant.sheet.live,
    combatant.sheet.items,
    combatant.abilityConditions,
  );
  return (
    resolveRulesetValueRef(definition, combatant.sheet.build, ref, evaluated) +
    fightAdjust(definition, combatant.sheet.build, evaluated, ref)
  );
}

/** The initiative dice of a ruleset that adds them up, thrown; none for one that throws a pool. */
/** How a combatant's initiative is thrown now (1.240): their sheet's lean, and what their conditions
 *  say of the check it is, cancelling each other out as everywhere else. */
export function rulesetInitiativeMode(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  combatant: RulesetCombatant,
  state?: RulesetEncounterState,
): "normal" | "advantage" | "disadvantage" {
  if (!combat.initiative.dice || combat.initiative.pool || !rulesetCombatAdvantage(combat)) return "normal";
  const checks = combat.initiative.checkAbility
    ? rulesetCheckMode(definition, combat, combatant, state, undefined, combat.initiative.checkAbility)
    : "normal";
  const advantage = checks === "advantage" || combatant.initiativeLean === "advantage";
  const disadvantage = checks === "disadvantage" || combatant.initiativeLean === "disadvantage";
  if (advantage === disadvantage) return "normal";
  return advantage ? "advantage" : "disadvantage";
}

/** The initiative dice thrown once more and the better or the worse kept (1.240), when the
 *  combatant's initiative is thrown twice; their number follows. Nothing is thrown otherwise. */
export function rulesetThrowInitiativeAgain(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  combatant: RulesetCombatant,
  roll: RulesetCombatRoller,
  state?: RulesetEncounterState,
): void {
  delete combatant.initiativeDropped;
  delete combatant.initiativeMode;
  const mode = rulesetInitiativeMode(definition, combat, combatant, state);
  if (mode === "normal") return;
  const again = throwInitiativeDice(combat, roll);
  const better = sumOf(again) > sumOf(combatant.initiativeRoll);
  const keepAgain = mode === "advantage" ? better : sumOf(again) < sumOf(combatant.initiativeRoll);
  const [kept, dropped] = keepAgain ? [again, combatant.initiativeRoll] : [combatant.initiativeRoll, again];
  combatant.initiativeRoll = kept;
  combatant.initiativeDropped = dropped;
  combatant.initiativeMode = mode;
  combatant.initiative = sumOf(kept) + combatant.initiativeModifier;
}

/** What an initiative entry says of a throw made twice (1.240). */
export function rulesetInitiativeTwice(combatant: RulesetCombatant): {
  mode?: "advantage" | "disadvantage";
  dropped?: number[];
} {
  return combatant.initiativeMode && combatant.initiativeDropped
    ? { mode: combatant.initiativeMode, dropped: combatant.initiativeDropped }
    : {};
}

export function throwInitiativeDice(combat: RulesetCombat, roll: RulesetCombatRoller): number[] {
  const dice = combat.initiative.dice;
  return dice ? rollRulesetDice(roll, dice.count, dice.sides) : [];
}

/** Initiative thrown as a pool of `dice` dice: its successes, plus the ruleset's own number. The
 *  pool's size stands in as the modifier, which is what an order tie is broken on. */
export function rulesetPoolInitiative(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  roll: RulesetCombatRoller,
  dice: number,
): { roll: number[]; modifier: number; total: number } {
  const thrown = throwRulesetCombatPool(definition, roll, dice);
  return { roll: thrown.rolls, modifier: dice, total: thrown.successes + (combat.initiative.plus ?? 0) };
}

/** How many cells a side this combatant's size fills (1.194), one when nothing says more. */
export function rulesetSizeSpan(combat: RulesetCombat, combatant: RulesetCombatant): number {
  if (combatant.size === undefined) return 1;
  return combat.sizes?.order.find((size) => size.id === combatant.size)?.cells ?? 1;
}

/** The nearest top-left cell to `at` where `span` cells a side fit (1.194): inside the board, on
 *  nothing solid and on nobody in `taken`. Null when nowhere on the board will do. */
export function rulesetFitCell(
  grid: TacticalGrid,
  at: { x: number; y: number },
  span: number,
  taken: ReadonlySet<string>,
  /** Who stands there, for whom water may be ground to stand on (a swimmer, a flier). */
  mover?: RulesetCombatant,
): { x: number; y: number } | null {
  const fits = (x: number, y: number) => fitsAt(grid, { x, y }, span, taken, mover);
  for (let ring = 0; ring <= Math.max(grid.width, grid.height); ring++) {
    for (let y = at.y - ring; y <= at.y + ring; y++) {
      for (let x = at.x - ring; x <= at.x + ring; x++) {
        if (Math.max(Math.abs(x - at.x), Math.abs(y - at.y)) !== ring) continue;
        if (fits(x, y)) return { x, y };
      }
    }
  }
  return null;
}

function fitsAt(
  grid: TacticalGrid,
  at: { x: number; y: number },
  span: number,
  taken: ReadonlySet<string>,
  mover?: RulesetCombatant,
): boolean {
  return (
    at.x >= 0 &&
    at.y >= 0 &&
    at.x + span <= grid.width &&
    at.y + span <= grid.height &&
    rulesetFootprintAt(at, span).every(
      (cell) =>
        !taken.has(`${cell.x},${cell.y}`) &&
        !(mover ? rulesetCellSolidFor(grid, cell.x, cell.y, mover) : rulesetCellBlocked(grid, cell.x, cell.y)),
    )
  );
}

/**
 * Everybody's size as the conditions they hold now say (1.195): each condition's `size.steps` moves
 * them along `combat.sizes`, never past its ends, and with none they are their own size again.
 *
 * On a board somebody who grows fills their new size over every cell they stood on, where it fits
 * on open ground clear of everybody else, or the biggest size short of it that fits, as 5e's Enlarge
 * grows only as big as there is room for; nobody else is moved to make room. Somebody who shrinks
 * keeps their top-left cell. Returns who changed, each once.
 */
/**
 * What auras spread, brought up to date (Capability API 1.263): on whoever is now near a holder who
 * is up and able to act, off whoever is not. Worked out from scratch each time, so moving, falling
 * or waking says what it should without anybody telling it. A condition an aura spread carries no
 * aura of its own, so nothing here chains. Returns what went on and came off, for a log.
 */
/** Who spreads what right now (1.263): a holder down, out or unable to act spreads nothing. */
export function rulesetAuraSpreaders(
  definition: RulesetDefinition,
  state: RulesetEncounterState,
): Array<{ holder: RulesetCombatant; aura: RulesetConditionAura; condition: string }> {
  const combat = definition.combat;
  if (!combat?.conditions?.some((entry) => entry.auras)) return [];
  return state.combatants.flatMap((holder) => {
    if (holder.defeated || holder.down) return [];
    if (rulesetCombatEffects(definition, combat, holder, state).has("cannot-act")) return [];
    const held = new Set(holder.tracked.filter((entry) => !entry.aura).map((entry) => entry.condition));
    for (const id of rulesetCombatConditions(definition, holder)) {
      if (!holder.tracked.some((entry) => entry.condition === id && entry.aura)) held.add(id);
    }
    return (combat.conditions ?? []).flatMap((rule) =>
      held.has(rule.condition)
        ? (rule.auras ?? [])
            .filter((aura) => rulesetSheetWithin(definition, holder, aura.when))
            .map((aura) => ({ holder, aura, condition: rule.condition }))
        : [],
    );
  });
}

/**
 * Whether one holder's aura reaches this combatant now (1.263): the side it names (the holder only
 * with `self`), within its distance on a board, and with the senses it `needs` (1.265), neither of
 * them standing in a zone that takes those away (Silence). Without a board it reaches its side.
 */
export function rulesetAuraReaches(
  definition: RulesetDefinition,
  state: RulesetEncounterState,
  holder: RulesetCombatant,
  aura: RulesetConditionAura,
  target: RulesetCombatant,
  /** The condition on the holder that spreads it, which a chosen kind is remembered by (1.270). */
  condition?: string,
): boolean {
  if (target.defeated) return false;
  // Only while ridden, and read from the rider's side (1.735): a goat of terror.
  const rider = aura.whileRidden && holder.riddenBy ? rulesetCombatant(state, holder.riddenBy) : undefined;
  if (aura.whileRidden && !rider) return false;
  // Nor through a sphere (1.314), either way.
  if (rulesetSealedApart(definition, state, holder, target)) return false;
  const same = (rider ?? holder).side === target.side;
  if (holder.id === target.id ? !aura.self : aura.side === (same ? "enemies" : "allies")) return false;
  const perCell = definition.combat?.distance?.perCell;
  if (state.board?.grid && perCell !== undefined && holder.id !== target.id) {
    // Past its distance, it still reaches whoever can see its holder where it says so (1.270).
    if (
      rulesetGap(holder, target) > rulesetInCells(rulesetAuraDistance(holder, aura, condition), perCell) &&
      !(aura.orSeen && rulesetCanSee(definition, state, target, holder))
    )
      return false;
  }
  // Only to whoever its holder can see (1.608): a knight's Leadership.
  if (aura.seenByHolder && holder.id !== target.id && !rulesetCanSee(definition, state, holder, target)) return false;
  // Only the kind named as it was put on (1.270): Antipathy/Sympathy's.
  if (aura.chosenKind) {
    const kind = holder.tracked.find((entry) => entry.condition === condition && entry.kind)?.kind;
    const what = rulesetCreatureKind(definition, target);
    if (!kind || (what.type !== kind && !what.tags.includes(kind))) return false;
  }
  if (aura.needs?.length) {
    if (!rulesetTargetHasSenses(definition, state, target, aura.needs)) return false;
    if (zoneTakesSenses(definition, state, holder, aura.needs)) return false;
  }
  // Only who is this (1.268): a sea hag's humanoids.
  if (!rulesetTargetTypesAllow(definition, target, aura.targetTypes, holder)) return false;
  // Only who has put one of these on its holder (1.268): whoever grapples a barbed devil.
  if (aura.sourcesOf?.length) {
    const named = aura.sourcesOf;
    if (!holder.tracked.some((entry) => entry.source === target.id && named.includes(entry.condition))) return false;
  }
  return true;
}

/** How far an aura reaches now (1.320), in the ruleset's distance: grown as its holder's turns
 *  started, to no more than it grows to. */
export function rulesetAuraDistance(
  holder: RulesetCombatant,
  aura: RulesetConditionAura,
  condition: string | undefined,
): number {
  if (!aura.grows || condition === undefined) return aura.distance;
  return Math.min(aura.grows.upTo, aura.distance + aura.grows.by * (holder.auraGrown?.[condition] ?? 0));
}

/** Whether a zone this combatant stands in puts on a condition that takes one of these senses away. */
function zoneTakesSenses(
  definition: RulesetDefinition,
  state: RulesetEncounterState,
  combatant: RulesetCombatant,
  senses: readonly string[],
): boolean {
  const rules = definition.combat?.conditions ?? [];
  return zonesStoodIn(state, combatant).some(({ rule, zone }) =>
    // Only one it works on (1.460).
    (insideWorksOn(definition, combatant, zone, rule) ? (rule.inside?.conditions ?? []) : []).some((condition) =>
      rules.some((one) => one.condition === condition && one.lacks?.some((sense) => senses.includes(sense))),
    ),
  );
}

export function rulesetSyncAuras(
  definition: RulesetDefinition,
  state: RulesetEncounterState,
): Array<{ targetId: string; condition: string; active: boolean; sourceId: string }> {
  const combat = definition.combat;
  const changes: Array<{ targetId: string; condition: string; active: boolean; sourceId: string }> = [];
  if (!combat?.conditions?.some((entry) => entry.auras)) {
    // A ruleset that had auras and lost them leaves nothing spread behind.
    for (const target of state.combatants) {
      if (target.tracked.some((entry) => entry.aura)) target.tracked = target.tracked.filter((entry) => !entry.aura);
    }
    return changes;
  }
  const spreading = rulesetAuraSpreaders(definition, state);
  for (const target of state.combatants) {
    const want = new Map<string, string>();
    // What lingers once its holder parts (1.320), by condition.
    const lingers = new Set<string>();
    if (!target.defeated) {
      for (const { holder, aura, condition: spreads } of spreading) {
        if (aura.lingers) for (const condition of aura.conditions ?? []) lingers.add(condition);
        if (!rulesetAuraReaches(definition, state, holder, aura, target, spreads)) continue;
        for (const condition of aura.conditions ?? []) if (!want.has(condition)) want.set(condition, holder.id);
      }
    }
    for (const entry of [...target.tracked]) {
      // Reached again while it lingers: the aura holds it once more.
      if (entry.lingering && want.has(entry.condition)) {
        delete entry.lingering;
        delete entry.clock;
        entry.rounds = null;
        entry.aura = want.get(entry.condition)!;
        entry.source = entry.aura;
        continue;
      }
      if (!entry.aura || want.get(entry.condition) === entry.aura) continue;
      // Spread by somebody else now, it simply changes hands.
      const by = want.get(entry.condition);
      if (by) {
        entry.aura = by;
        entry.source = by;
        continue;
      }
      // Left on until their next turn starts (1.320): Frost Debt's no healing.
      if (lingers.has(entry.condition) && !target.defeated) {
        delete entry.aura;
        entry.lingering = true;
        entry.rounds = 1;
        entry.clock = "turn-start";
        continue;
      }
      target.tracked = target.tracked.filter((one) => one !== entry);
      changes.push({ targetId: target.id, condition: entry.condition, active: false, sourceId: entry.aura });
    }
    for (const [condition, sourceId] of want) {
      if (target.tracked.some((entry) => entry.condition === condition)) continue;
      const source = rulesetCombatant(state, sourceId);
      if (rulesetImmuneToCondition(target, condition, definition, state, source)) continue;
      target.tracked.push({ condition, rounds: null, source: sourceId, aura: sourceId });
      changes.push({ targetId: target.id, condition, active: true, sourceId });
    }
  }
  return changes;
}

/**
 * Ways of moving given by the conditions each holds (1.395): Fly, Dragon Wings, Levitate. Their own
 * come back as nothing gives them any more. What is left of this turn's movement grows by what a
 * faster way adds, and a new way starts with what is left of the walk. The ids of those whose ways
 * changed.
 */
/** Everything that has this combatant regain health as its turns start (1.396): its conditions' and
 *  levels', and its own block's. */
export function rulesetRegenerations(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  combatant: RulesetCombatant,
  state?: RulesetEncounterState,
): RulesetRegeneration[] {
  return [
    ...rulesetActiveConditions(definition, combat, combatant, state).flatMap((entry) =>
      entry.regenerates ? [entry.regenerates] : [],
    ),
    ...(combatant.block?.regenerates ? [combatant.block.regenerates] : []),
  ];
}

/** Everything that may leave this combatant at 1 instead of 0 (1.320, 1.400), each with the name its
 *  count this fight is kept under: its own block's first, then its conditions' and levels'. */
export function rulesetHangsOn(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  combatant: RulesetCombatant,
  state?: RulesetEncounterState,
): Array<{ from: string | null; hangs: RulesetHangsOn }> {
  return [
    ...(combatant.block?.hangsOn ? [{ from: null, hangs: combatant.block.hangsOn }] : []),
    ...rulesetActiveConditions(definition, combat, combatant, state).flatMap((entry) =>
      entry.hangsOn ? [{ from: entry.condition, hangs: entry.hangsOn }] : [],
    ),
  ];
}

/**
 * The numbers a sheet fighter fights with worked out again as the conditions the fight has on them
 * change their abilities (1.515): a Potion of Giant Strength drunk mid-fight. Their attacks' to-hit,
 * damage, healing and save, their saves, checks and defense are read off the sheet again; health,
 * speed and everything else stay as they are. The ids of those conditions are kept, so nothing is
 * worked out again until they change. Returns whose numbers changed.
 */
export function rulesetSyncAbilities(
  definition: RulesetDefinition,
  state: RulesetEncounterState,
  /** As the fight is made, when a sheet that already held them all was read with them. Never after:
   *  a condition put on in a fight is written onto the sheet too, and must still be worked out. */
  starting = false,
): string[] {
  const combat = definition.combat;
  if (!combat?.conditions?.some((entry) => entry.abilities)) return [];
  const changed: string[] = [];
  for (const combatant of state.combatants) {
    const sheet = combatant.sheet;
    if (!sheet && !combatant.block?.abilities) continue;
    const ids = [
      ...new Set(
        rulesetActiveConditions(definition, combat, combatant, state).flatMap((entry) =>
          entry.abilities && !entry.item ? [entry.condition] : [],
        ),
      ),
    ].sort();
    if (ids.join("|") === (combatant.abilityConditions ?? []).join("|")) continue;
    // A stat block with no sheet (1.515): its scores changed, and its saves and checks by what that
    // does to their modifiers. Feeblemind on a monster.
    if (!sheet) {
      syncBlockAbilities(definition, combat, combatant, ids);
      changed.push(combatant.id);
      continue;
    }
    const before = combatant.abilityConditions;
    if (ids.length) combatant.abilityConditions = ids;
    else delete combatant.abilityConditions;
    // Nothing to work out again at the start of a fight whose sheet already held them all.
    if (
      starting &&
      !before &&
      ids.every((id) =>
        readRulesetLive(definition, sheet.build, sheet.live, sheet.items).conditions.some(
          (one) => one.id === id && one.active,
        ),
      )
    )
      continue;
    const fresh = sheetCombatant(definition, combat, {
      id: combatant.id,
      name: combatant.name,
      side: combatant.side,
      initiativeRoll: combatant.initiativeRoll,
      roll: () => 1,
      build: sheet.build,
      live: sheet.live,
      catalogs: sheet.catalogs,
      perCell: combat.distance?.perCell,
      ...(sheet.items ? { items: sheet.items } : {}),
      conditions: ids,
    });
    combatant.defense = fresh.defense;
    combatant.saves = fresh.saves;
    if (fresh.checks) combatant.checks = fresh.checks;
    for (const action of combatant.actions) {
      const now = fresh.actions.find((one) => one.id === action.id);
      if (!now) continue;
      if (now.toHit !== undefined) action.toHit = now.toHit;
      if (now.damage) action.damage = now.damage;
      if (now.heal) action.heal = now.heal;
      if (now.save) action.save = now.save;
    }
    changed.push(combatant.id);
  }
  return changed;
}

/** A weapon's own actions on its holder's menu: its blows and its reload, by the item's place. */
const HELD_WEAPON_ACTION = /^(?:item|offhand|reload):(\d+)$/;

/**
 * A sheet fighter's weapons read again as what they hold in hand changes on their turn (2026-10-26:
 * the fight screen's In hand row): each item worn as the fight left it (`drawn`), their weapons'
 * blows and reloads built afresh from that, so one taken in hand is offered and one put away is not,
 * and their defense read again, as a shield taken up or put down changes it. Everything else they
 * fight with stays as it is, as `rulesetSyncAbilities` leaves it.
 */
export function rulesetSyncHeldItems(definition: RulesetDefinition, combatant: RulesetCombatant): void {
  const combat = definition.combat;
  const sheet = combatant.sheet;
  if (!combat || !sheet?.items) return;
  // What a call lends (1.739) is lent again as the sheet is read, so it is left out here.
  const items = sheet.items
    .map((held, index) => {
      const worn = combatant.drawn?.[index];
      return worn === undefined || held.lent ? held : { ...held, worn };
    })
    .filter((held) => !held.lent);
  const fresh = sheetCombatant(definition, combat, {
    id: combatant.id,
    name: combatant.name,
    side: combatant.side,
    initiativeRoll: combatant.initiativeRoll,
    roll: () => 1,
    build: sheet.build,
    live: sheet.live,
    catalogs: sheet.catalogs,
    perCell: combat.distance?.perCell,
    items,
    ...(combatant.abilityConditions ? { conditions: combatant.abilityConditions } : {}),
  });
  const owned = (action: RulesetCombatAction) => {
    const match = HELD_WEAPON_ACTION.exec(action.id);
    const index = match ? Number(match[1]) : -1;
    return index >= 0 && !!sheet.items![index] && !sheet.items![index]!.lent;
  };
  const weapons = fresh.actions.filter(owned);
  // In the place the weapons stood on the menu, else ahead of everything else.
  const at = Math.max(0, combatant.actions.findIndex(owned));
  const rest = combatant.actions.filter((action) => !owned(action));
  combatant.actions = [...rest.slice(0, at), ...weapons, ...rest.slice(at)];
  for (const action of weapons) {
    const uses = fresh.uses[action.id];
    if (uses !== undefined && combatant.uses[action.id] === undefined) combatant.uses[action.id] = uses;
  }
  combatant.defense = fresh.defense;
  if (fresh.heldDefense) combatant.heldDefense = fresh.heldDefense;
  else delete combatant.heldDefense;
}

/** A stat block's scores, saves and checks as the conditions `ids` change its abilities (1.515): each
 *  save and each check that reads an ability's modifier moves by as much as that modifier does. */
function syncBlockAbilities(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  combatant: RulesetCombatant,
  ids: string[],
): void {
  const block = combatant.block!;
  const printed = block.abilities ?? {};
  if (ids.length) combatant.abilityConditions = ids;
  else delete combatant.abilityConditions;
  const changes = (combat.conditions ?? []).flatMap((entry) =>
    entry.abilities && ids.includes(entry.condition) ? [entry.abilities] : [],
  );
  const now = rulesetChangedAbilityScores(definition, printed, changes);
  if (ids.length) combatant.abilityScores = now;
  else delete combatant.abilityScores;
  const moved = (ability: string | undefined) =>
    ability !== undefined && printed[ability] !== undefined && now[ability] !== undefined
      ? rulesetAbilityModifier(definition, now[ability]) - rulesetAbilityModifier(definition, printed[ability])
      : 0;
  for (const save of definition.sheet.saves) {
    const by = moved(save.ability);
    if (by !== 0 || block.saves?.[save.id] !== undefined || combatant.saves[save.id] !== undefined) {
      combatant.saves[save.id] = (block.saves?.[save.id] ?? 0) + by;
    }
  }
  if (combatant.checks) {
    for (const check of combat.checks ?? []) {
      combatant.checks[check.id] = (block.checks?.[check.id] ?? 0) + moved(check.value.abilityMod);
    }
  }
}

export function rulesetSyncSpeeds(definition: RulesetDefinition, state: RulesetEncounterState): string[] {
  const combat = definition.combat;
  if (!combat) return [];
  syncMountWears(definition, state);
  const changed: string[] = [];
  for (const combatant of state.combatants) {
    const grants = rulesetActiveConditions(definition, combat, combatant, state).filter(
      (entry) =>
        entry.speeds ||
        entry.hover ||
        entry.levitates ||
        entry.lifts ||
        entry.ignoresHardGround ||
        entry.runsAcross ||
        entry.walksOnLiquid ||
        entry.climbNotOn ||
        entry.passesCreatures ||
        entry.passesObjects ||
        entry.unhinderedBy ||
        entry.easyGround ||
        entry.harmedEntering,
    );
    // Ways over the ground (1.432): held only while what gives them holds.
    if (grants.some((entry) => entry.ignoresHardGround)) combatant.ignoresHardGround = true;
    else delete combatant.ignoresHardGround;
    if (grants.some((entry) => entry.runsAcross)) combatant.runsAcross = true;
    else delete combatant.runsAcross;
    // On water as on ground (1.529).
    if (grants.some((entry) => entry.walksOnLiquid)) combatant.walksOnLiquid = true;
    else delete combatant.walksOnLiquid;
    // Actions that never hinder them (1.704): Web Walker's webs.
    const unhindered = [
      ...new Set(grants.flatMap((entry) => (entry.unhinderedBy ?? []).map((name) => name.trim().toLowerCase()))),
    ];
    if (unhindered.length) combatant.unhinderedBy = unhindered;
    else delete combatant.unhinderedBy;
    // Through others' spaces, and through solid ground (1.495): anybody's over only larger ones.
    const passes = grants.flatMap((entry) => (entry.passesCreatures ? [entry.passesCreatures] : []));
    if (passes.length) combatant.passesCreatures = passes.includes("any") ? "any" : "larger";
    else delete combatant.passesCreatures;
    // Easy going on some tiles, and harm walking into some (1.708): Ice Walk, Water Susceptibility.
    const easyNamed = grants.flatMap((entry) => entry.easyGround ?? []);
    // Anywhere on a board whose place it names: every tile of a snowy board.
    const place = state.board?.environment;
    const easy = [
      ...new Set([
        ...easyNamed,
        ...easyNamed.map((name) => name.trim().toLowerCase()),
        ...(place && easyNamed.includes(place) ? TACTICAL_TERRAINS : []),
      ]),
    ];
    if (easy.length) combatant.easyGround = easy;
    else delete combatant.easyGround;
    const entering = grants.find((entry) => entry.harmedEntering)?.harmedEntering;
    const enteringHarm = entering ? amountOf(entering.harm) : undefined;
    if (entering && enteringHarm) {
      combatant.harmedEntering = {
        terrain: [...(entering.terrain ?? [])],
        zones: (entering.zones ?? []).map((name) => name.trim().toLowerCase()),
        harm: { ...enteringHarm, ...(entering.harm.damageType ? { damageType: entering.harm.damageType } : {}) },
      };
    } else delete combatant.harmedEntering;
    const through = grants.find((entry) => entry.passesObjects)?.passesObjects;
    if (through) {
      const harm = amountOf(through.harm);
      combatant.passesObjects = harm
        ? { harm: { ...harm, ...(through.harm?.damageType ? { damageType: through.harm.damageType } : {}) } }
        : {};
    } else delete combatant.passesObjects;
    // Up as high as what lifts it says (1.566): Reverse Gravity. Down again is the fall its going
    // takes them into, as hover goes with it.
    const lifts = Math.max(0, ...grants.map((entry) => entry.lifts ?? 0));
    const grid = state.board?.grid;
    if (lifts > 0 && grid && typeof combatant.x === "number" && typeof combatant.y === "number") {
      const feetPerLevel = (combat.distance?.perCell ?? 1) * Math.max(1, state.board?.levelCells ?? 1);
      const level = elevationAt(grid, combatant.x, combatant.y) + Math.max(1, Math.round(lifts / feetPerLevel));
      if (combatant.altitude !== level) {
        combatant.altitude = level;
        if (!changed.includes(combatant.id)) changed.push(combatant.id);
      }
    }
    if (!grants.length && !combatant.baseSpeeds && !combatant.levitating) {
      delete combatant.climbNotOn;
      continue;
    }
    const own = combatant.baseSpeeds ?? {
      ...(combatant.speeds ? { speeds: { ...combatant.speeds } } : {}),
      ...(combatant.hover ? { hover: true as const } : {}),
    };
    // Only what it gives (1.555): no walk, and none of their own.
    const only = grants.some((entry) => entry.onlySpeeds && entry.speeds);
    const speeds: RulesetMoveSpeeds = only ? {} : { ...(own.speeds ?? {}) };
    let hover = !!own.hover;
    let levitating = false;
    // A climb kept off some ground (1.671): none on a board whose place it names, and where it is the
    // only climb they have, what it is kept off.
    const environment = state.board?.environment;
    const climbFree = !!speeds.climb;
    const climbKept: { terrain: string[]; slippery?: true } = { terrain: [] };
    let climbKeptBy = 0;
    for (const entry of only ? grants.filter((one) => one.onlySpeeds && one.speeds) : grants) {
      for (const mode of RULESET_MOVE_MODES) {
        const given = entry.speeds?.[mode];
        const notOn = mode === "climb" ? entry.climbNotOn : undefined;
        if (notOn && environment !== undefined && notOn.terrain?.includes(environment)) continue;
        const speed = given === "walk" ? combatant.speed : given;
        if (mode === "climb" && speed) {
          if (notOn) {
            climbKeptBy++;
            climbKept.terrain.push(...(notOn.terrain ?? []));
            if (notOn.slippery) climbKept.slippery = true;
          } else climbKeptBy = -Infinity;
        }
        if (speed && speed > (speeds[mode] ?? 0)) speeds[mode] = speed;
      }
      if (entry.hover || entry.levitates || entry.lifts) hover = true;
      if (entry.levitates) levitating = true;
    }
    const before = {
      speeds: combatant.speeds,
      hover: combatant.hover,
      levitating: combatant.levitating,
      noWalk: combatant.noWalk,
    };
    const fastBefore = rulesetMovementAllowance(definition, combat, combatant, state);
    const modesBefore = rulesetModeAllowances(definition, combat, combatant, state);
    if (Object.keys(speeds).length) combatant.speeds = speeds;
    else delete combatant.speeds;
    if (hover) combatant.hover = true;
    else delete combatant.hover;
    if (levitating) combatant.levitating = true;
    else delete combatant.levitating;
    if (only) combatant.noWalk = true;
    else delete combatant.noWalk;
    if (!climbFree && climbKeptBy > 0) {
      combatant.climbNotOn = {
        terrain: [...new Set(climbKept.terrain)],
        ...(climbKept.slippery ? { slippery: true as const } : {}),
      };
    } else delete combatant.climbNotOn;
    if (grants.length) combatant.baseSpeeds = own;
    else delete combatant.baseSpeeds;
    if (
      JSON.stringify(before) ===
      JSON.stringify({
        speeds: combatant.speeds,
        hover: combatant.hover,
        levitating: combatant.levitating,
        noWalk: combatant.noWalk,
      })
    )
      continue;
    if (!changed.includes(combatant.id)) changed.push(combatant.id);
    if (combatant.movement === undefined) continue;
    // What is left of the turn: more by what a faster way adds, and each new way from the walk left.
    const fastAfter = rulesetMovementAllowance(definition, combat, combatant, state);
    const left = combatant.movementLeft ?? 0;
    const walked = Math.max(0, fastBefore - left);
    combatant.movement = fastAfter;
    combatant.movementLeft = Math.max(0, left + fastAfter - fastBefore);
    const modesAfter = rulesetModeAllowances(definition, combat, combatant, state);
    if (!modesAfter) {
      delete combatant.modeLeft;
      continue;
    }
    const was = combatant.modeLeft ?? {};
    const now: Partial<Record<RulesetMoveMode, number>> = {};
    for (const [mode, cells] of Object.entries(modesAfter) as Array<[RulesetMoveMode, number]>) {
      const had = modesBefore?.[mode];
      now[mode] =
        had !== undefined && was[mode] !== undefined
          ? Math.max(0, was[mode]! + cells - had)
          : Math.max(0, cells - walked);
    }
    combatant.modeLeft = now;
  }
  return changed;
}

export function rulesetSyncSizes(
  definition: RulesetDefinition,
  state: RulesetEncounterState,
): Array<{ targetId: string; size: string; label: string }> {
  const combat = definition.combat;
  const order = combat?.sizes?.order;
  if (!combat || !order) return [];
  const changed: Array<{ targetId: string; size: string; label: string }> = [];
  const grid = state.board?.grid;
  for (const combatant of state.combatants) {
    const own = combatant.baseSize ?? combatant.size ?? combat.sizes!.default;
    const steps = rulesetActiveConditions(definition, combat, combatant, state).reduce(
      (sum, entry) => sum + (entry.size?.steps ?? 0),
      0,
    );
    if (steps === 0 && combatant.baseSize === undefined) continue;
    const from = order.findIndex((size) => size.id === own);
    const now = order.findIndex((size) => size.id === (combatant.size ?? combat.sizes!.default));
    if (from < 0 || now < 0) continue;
    const want = Math.max(0, Math.min(order.length - 1, from + steps));
    let to = want;
    let at = rulesetPositionOf(combatant);
    if (grid && at && want > now) {
      // Growing: over every cell they fill now, the biggest that fits.
      const span = rulesetSpanOf(combatant);
      const taken = new Set(
        state.combatants
          .filter((other) => other !== combatant && !other.defeated)
          .flatMap((other) => rulesetFootprint(other).map((cell) => `${cell.x},${cell.y}`)),
      );
      const start: { x: number; y: number } = at;
      let fit: { x: number; y: number } | null = null;
      for (to = want; to > now && !fit; to--) {
        const grown = order[to]!.cells ?? 1;
        if (grown <= span) {
          fit = start;
          break;
        }
        const room = grown - span;
        for (let shift = 0; shift <= 2 * room && !fit; shift++) {
          for (let dy = 0; dy <= Math.min(shift, room) && !fit; dy++) {
            const dx = shift - dy;
            if (dx > room) continue;
            const anchor = { x: start.x - dx, y: start.y - dy };
            if (fitsAt(grid, anchor, grown, taken)) fit = anchor;
          }
        }
        if (fit) break;
      }
      at = fit ?? start;
    }
    const size = order[to]!;
    if (size.id === (combatant.size ?? combat.sizes!.default)) continue;
    combatant.size = size.id;
    if (to === from) delete combatant.baseSize;
    else combatant.baseSize = own;
    if ((size.cells ?? 1) > 1) combatant.span = size.cells;
    else delete combatant.span;
    if (at && grid) {
      combatant.x = at.x;
      combatant.y = at.y;
    }
    changed.push({ targetId: combatant.id, size: size.id, label: size.label });
  }
  return changed;
}

/**
 * Everybody onto the board, or nobody at all.
 *
 * A fight is positioned only when the ruleset says what a cell is worth and every single combatant
 * has a cell inside the grid. One missing placement leaves the whole fight where it was, because a
 * fight where one combatant has no position is one where nothing about distance can be answered.
 */
function placeRulesetCombatants(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  state: RulesetEncounterState,
  board: RulesetEncounterInput["board"],
): void {
  if (!board || !combat.distance) return;
  const { grid } = board;
  if (!grid || !Number.isInteger(grid.width) || !Number.isInteger(grid.height)) return;
  const placed: Array<{ combatant: RulesetCombatant; at: { x: number; y: number } }> = [];
  for (const combatant of state.combatants) {
    const at = board.placements[combatant.id];
    if (
      !at ||
      !Number.isInteger(at.x) ||
      !Number.isInteger(at.y) ||
      at.x < 0 ||
      at.y < 0 ||
      at.x >= grid.width ||
      at.y >= grid.height
    ) {
      return;
    }
    placed.push({ combatant, at });
  }
  // Somebody bigger than one cell fills as many a side as their size says (1.194), set down where
  // all of them fit: on the board, on open ground and clear of whoever was set down first, the
  // nearest such place to where they were asked to stand.
  // The big are set down first, and anybody of one cell asked to stand inside one of them steps
  // aside to the nearest open cell; nobody else moves from where they were asked to stand.
  // Nobody stands inside a prop that closes its cells (1.316): asked to, they step aside.
  const props = rulesetBoardProps(grid, board.props);
  const taken = new Set<string>(
    props.filter((prop) => prop.blocks?.move).flatMap((prop) => prop.cells.map((cell) => `${cell.x},${cell.y}`)),
  );
  const big = new Set<string>(taken);
  const spans = new Map(placed.map((entry) => [entry, rulesetSizeSpan(combat, entry.combatant)]));
  for (const entry of [...placed].sort((a, b) => spans.get(b)! - spans.get(a)!)) {
    const span = spans.get(entry)!;
    if (span > 1) {
      entry.combatant.span = span;
      // A large swimmer asked to begin in water may (laptop 2026-10-30: Large crocodiles set in the
      // lake were moved back onto the shore).
      entry.at = rulesetFitCell(grid, entry.at, span, taken, entry.combatant) ?? entry.at;
      for (const cell of rulesetFootprintAt(entry.at, span)) big.add(`${cell.x},${cell.y}`);
    } else if (big.has(`${entry.at.x},${entry.at.y}`)) {
      entry.at = rulesetFitCell(grid, entry.at, 1, taken) ?? entry.at;
    }
    for (const cell of rulesetFootprintAt(entry.at, span)) taken.add(`${cell.x},${cell.y}`);
  }
  for (const { combatant, at } of placed) {
    combatant.x = at.x;
    combatant.y = at.y;
    combatant.movement = rulesetMovementAllowance(definition, combat, combatant);
    combatant.movementLeft = 0;
    grantRulesetMovement(definition, combat, combatant);
  }
  const events = rulesetBoardEvents(grid, board.events);
  const words = (list: string[] | undefined, fallback: string[]) =>
    Array.isArray(list)
      ? list.filter((one) => typeof one === "string" && one.trim()).map((one) => one.trim().toLowerCase())
      : fallback;
  state.board = {
    grid,
    ...(props.length ? { props } : {}),
    ...(events.length ? { events } : {}),
    ...(board.growth
      ? { growth: { burnedBy: words(board.growth.burnedBy, ["fire"]), cutBy: words(board.growth.cutBy, ["slashing"]) } }
      : {}),
    ...(lightRuleOf(definition, board.lightRule) ? { lightRule: lightRuleOf(definition, board.lightRule)! } : {}),
    ...(board.battlefield ? { battlefield: board.battlefield as RulesetCombatBoard["battlefield"] } : {}),
    ...(board.light ? { light: board.light } : {}),
    ...(board.environment ? { environment: board.environment } : {}),
    ...(typeof board.pack === "string" && board.pack.trim() ? { pack: board.pack.trim().slice(0, 80) } : {}),
    // What a shot gains from higher ground, as the ruleset said at the start (combat C6b).
    ...(combat.elevation?.rangeBonus ? { rangeBonus: combat.elevation.rangeBonus } : {}),
    // What one level is worth in cells, which is what a flier pays to rise one (1.114).
    ...(combat.elevation && combat.distance
      ? { levelCells: rulesetInCells(combat.elevation.levelHeight, combat.distance.perCell) }
      : {}),
  };
  // What the props close, closed from the start (1.316); a wall cast later is added to it.
  const walls: Record<string, number> = {};
  for (const prop of props) {
    const bits = (prop.blocks?.move ? 1 : 0) | (prop.blocks?.sight ? 2 : 0);
    for (const cell of bits ? prop.cells : [])
      walls[`${cell.x},${cell.y}`] = (walls[`${cell.x},${cell.y}`] ?? 0) | bits;
  }
  if (Object.keys(walls).length > 0) state.board.grid = { ...grid, walls };
  // What lies on the cells from the start (1.318), only on the board and only what a cell holds.
  const ground = groundOf(grid, board.ground);
  if (ground) state.board.grid = { ...state.board.grid, ground };
}

function groundOf(
  grid: TacticalGrid,
  input: Record<string, TacticalGroundCell> | undefined,
): Record<string, TacticalGroundCell> | null {
  const ground: Record<string, TacticalGroundCell> = {};
  for (const [at, here] of Object.entries(input ?? {})) {
    const match = /^(\d+),(\d+)$/.exec(at);
    if (!match || !here || typeof here !== "object") continue;
    const x = Number(match[1]);
    const y = Number(match[2]);
    if (x >= grid.width || y >= grid.height) continue;
    const cell: TacticalGroundCell = {
      ...(here.growth === true ? { growth: true as const } : {}),
      ...(here.light && ["bright", "dim", "dark", "sunlight"].includes(here.light) ? { light: here.light } : {}),
      ...(here.obscured === "light" || here.obscured === "heavy" ? { obscured: here.obscured } : {}),
      ...(typeof here.season === "string" && here.season.trim() ? { season: here.season.trim() } : {}),
    };
    if (Object.keys(cell).length) ground[`${x},${y}`] = cell;
  }
  return Object.keys(ground).length ? ground : null;
}

/** The stored live blob as the encounter keeps it. `applyRulesetSheetOp` already reads a stored
 *  blob tolerantly, so an empty object is a member with nothing spent. */
/** A party member who is a bestiary creature with no sheet: the conditions its card's live state
 *  holds, on with no clock, and the health it was left with, kept in the health pool's place. */
function keepCardLive(combat: RulesetCombat, combatant: RulesetCombatant, stored: unknown): void {
  const live = readStoredLive(stored);
  const conditions = [...new Set((live.conditions ?? []).filter((one) => typeof one === "string"))];
  for (const condition of conditions) {
    if (!combatant.tracked.some((entry) => entry.condition === condition))
      combatant.tracked.push({ condition, rounds: null });
  }
  const pool = "pool" in combat.health ? combat.health.pool : undefined;
  const value = pool !== undefined ? live.pools?.[pool]?.value : undefined;
  if (combatant.health && typeof value === "number" && Number.isFinite(value))
    combatant.health.value = Math.max(0, Math.min(combatant.health.max, Math.round(value)));
  combatant.cardLive = { conditions, ...(pool !== undefined ? { pool } : {}) };
}

function readStoredLive(stored: unknown): RulesetLiveState {
  return stored && typeof stored === "object" && !Array.isArray(stored) ? (stored as RulesetLiveState) : {};
}

/** A copy of what disperses a fog (1.286, 1.289): at once, or after it stands in a wind a while. */
export function rulesetCopyDispersed(dispersed: true | { after: number }): true | { after: number } {
  return dispersed === true ? true : { after: dispersed.after };
}

/** Held Ground as a fight keeps it (1.323): its condition when the fight knows it, and its marks on
 *  tracks the sheet has. */
function heldGroundOf(definition: RulesetDefinition, held: RulesetHeldGround | undefined): RulesetHeldGround | null {
  if (!held || typeof held !== "object") return null;
  const known = new Set(definition.combat?.conditions?.map((one) => one.condition) ?? []);
  const condition = typeof held.condition === "string" && known.has(held.condition) ? held.condition : undefined;
  const marks = (Array.isArray(held.marks) ? held.marks : []).filter(
    (one) =>
      !!one &&
      Number.isInteger(one.by) &&
      one.by !== 0 &&
      definition.sheet.live.tracks.some((track) => track.id === one.track && !track.kinds),
  );
  return {
    ...(typeof held.label === "string" && held.label.trim() ? { label: held.label.trim() } : {}),
    ...(condition ? { condition } : {}),
    ...(marks.length ? { marks: marks.map((one) => ({ track: one.track, by: one.by })) } : {}),
  };
}

/** A board's light rule as a fight keeps it (1.319): one that does something, to the tracks and
 *  conditions the ruleset has. Bright light and sunlight, every round end, when it does not say. */
function lightRuleOf(
  definition: RulesetDefinition,
  rule: Partial<RulesetBoardLightRule> | undefined,
): RulesetBoardLightRule | null {
  if (!rule || typeof rule !== "object") return null;
  const lights = new Set<RulesetBoardLight>(["sunlight", "bright", "dim", "dark"]);
  const inLight = (Array.isArray(rule.in) ? rule.in : ["bright", "sunlight"]).filter((one): one is RulesetBoardLight =>
    lights.has(one as RulesetBoardLight),
  );
  const tracks = (Array.isArray(rule.tracks) ? rule.tracks : []).filter(
    (one) =>
      !!one &&
      Number.isInteger(one.by) &&
      one.by !== 0 &&
      definition.sheet.live.tracks.some((track) => track.id === one.track && !track.kinds),
  );
  const conditions = new Set(definition.combat?.conditions?.map((one) => one.condition) ?? []);
  const applies = (Array.isArray(rule.applies) ? rule.applies : []).filter(
    (one) => typeof one === "string" && conditions.has(one),
  );
  if (!inLight.length || (!tracks.length && !applies.length)) return null;
  const rounds = Number.isInteger(rule.rounds) && rule.rounds! >= 1 ? rule.rounds! : 1;
  // Its save (1.321), against the conditions the fight knows and any damage it names.
  const save =
    rule.save && typeof rule.save.save === "string" && rule.save.save.trim() && Number.isInteger(rule.save.difficulty)
      ? rule.save
      : undefined;
  const againstConditions = (save?.against?.conditions ?? []).filter((one) => conditions.has(one));
  const againstDamage = (save?.against?.damage ?? []).filter((one) => typeof one === "string" && one.trim());
  return {
    ...(typeof rule.label === "string" && rule.label.trim() ? { label: rule.label.trim() } : {}),
    in: [...new Set(inLight)],
    rounds,
    ...(tracks.length
      ? {
          tracks: tracks.map((one) => ({
            track: one.track,
            by: one.by,
            ...(Number.isInteger(one.upTo) ? { upTo: one.upTo } : {}),
          })),
        }
      : {}),
    ...(applies.length ? { applies } : {}),
    ...(rule.spares && (rule.spares.types?.length || rule.spares.tags?.length) ? { spares: rule.spares } : {}),
    ...(save
      ? {
          save: {
            save: save.save.trim(),
            difficulty: save.difficulty,
            ...(againstConditions.length || againstDamage.length
              ? {
                  against: {
                    ...(againstConditions.length ? { conditions: againstConditions } : {}),
                    ...(againstDamage.length ? { damage: againstDamage } : {}),
                  },
                }
              : {}),
          },
        }
      : {}),
  };
}
