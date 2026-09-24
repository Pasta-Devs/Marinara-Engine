// Bestiaries: finding an opponent a ruleset ships, and pulling one nobody wrote onto its scale.
//
// A bestiary catalog holds creatures instead of rows. Everything here turns one of those entries
// into the stat block the resolver already takes, or takes a block somebody proposed and clamps it
// into the ruleset's own threat scale, so nothing a Game Master invents lands off it.
//
// Pure, like the rest of the fight: no I/O, nothing thrown, and a clamp that says in plain words
// what it changed so a log can print the line.

import { RULESET_DAMAGE_MAX_PLUS } from "../../schemas/ruleset.schema.js";
import type {
  RulesetCatalogEntriesById,
  RulesetCatalogEntry,
  RulesetCombatThreatTier,
  RulesetCreature,
  RulesetCreatureAction,
  RulesetDefinition,
  RulesetProposedCreature,
} from "../../schemas/ruleset.schema.js";
import { rulesetCatalogIdsForBuild } from "../rulesets/scaled-rows.js";
import { parseRulesetCombatDice, rulesetAverageAmount, rulesetAverageDamage } from "./dice.js";
import type {
  RulesetCombatAmount,
  RulesetCombatDamage,
  RulesetCombatDamageClause,
  RulesetCombatRider,
  RulesetPlainStatBlock,
  RulesetStatBlock,
  RulesetStatBlockAction,
} from "./types.js";

/** How many actions survive a clamp. A proposal with more than this is a creature nobody could read
 *  at the table, whatever the numbers say. */
export const RULESET_CLAMP_MAX_ACTIONS = 6;

/** How far above the tier's own number a clamped block may sit. One rung of a scale is a range, not
 *  a line, so a creature at the top of its tier is still on it. */
export const RULESET_CLAMP_HEADROOM = 2;

/** A name matched the way a Game Master writes it: case and punctuation are not the point, the word
 *  is. "Ash-hound", "ash hound" and "Ash Hound" are one creature. */
function plainly(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/** The entry a `{ catalogId, entryId }` reference names, and nothing else. */
export function findRulesetCreatureEntry(
  catalogs: RulesetCatalogEntriesById,
  ref: { catalogId: string; entryId: string },
): RulesetCatalogEntry | null {
  const entry = catalogs[ref.catalogId]?.find((candidate) => candidate.id === ref.entryId);
  return entry?.creature ? entry : null;
}

/**
 * The creature a Game Master named, looked up three ways and no more: the exact
 * `<catalogId>/<entryId>`, then a label or an id that matches once case and punctuation are set
 * aside, then nothing. Never fuzzy beyond that, because a fight built on a near miss is worse than
 * one the Engine says it could not build.
 */
export function findRulesetCreature(
  catalogs: RulesetCatalogEntriesById,
  query: string,
): { catalogId: string; entry: RulesetCatalogEntry } | null {
  const wanted = query.trim();
  if (!wanted) return null;
  const slash = wanted.indexOf("/");
  if (slash > 0) {
    const catalogId = wanted.slice(0, slash);
    const entryId = wanted.slice(slash + 1);
    const exact = findRulesetCreatureEntry(catalogs, { catalogId, entryId });
    if (exact) return { catalogId, entry: exact };
  }
  const plain = plainly(wanted);
  if (!plain) return null;
  for (const [catalogId, entries] of Object.entries(catalogs)) {
    for (const entry of entries) {
      if (!entry.creature) continue;
      if (plainly(entry.label) === plain || plainly(entry.id) === plain) return { catalogId, entry };
    }
  }
  return null;
}

/** A creature's amount as the fight rolls it: the dice text plus whatever flat part sits beside it. */
function amountOf(input: { dice?: string; flat?: number } | undefined): RulesetCombatAmount | null {
  if (!input) return null;
  const dice = input.dice ? parseRulesetCombatDice(input.dice) : null;
  if (!dice && input.flat === undefined) return null;
  return { count: dice?.count ?? 0, sides: dice?.sides ?? 0, flat: (dice?.flat ?? 0) + (input.flat ?? 0) };
}

/** The clauses beside a blow's first amount. A clause with a save of its own falls back to the
 *  action's number when it named none, and a block has no other number to reach for. */
function clausesOf(action: RulesetCreatureAction): RulesetCombatDamageClause[] | null {
  const fallback = action.save?.difficulty ?? action.saveDifficulty ?? 0;
  const clauses = (action.damage?.plus ?? []).flatMap((clause) => {
    const amount = amountOf(clause);
    if (!amount) return [];
    return [
      {
        ...amount,
        ...(clause.type ? { type: clause.type } : {}),
        ...(clause.save
          ? {
              save: {
                save: clause.save.save,
                onSuccess: clause.save.onSuccess,
                difficulty: clause.save.difficulty ?? fallback,
              },
            }
          : {}),
      },
    ];
  });
  return clauses.length > 0 ? clauses : null;
}

function creatureAction(action: RulesetCreatureAction): RulesetStatBlockAction {
  const damage = amountOf(action.damage);
  const plus = clausesOf(action);
  return {
    id: action.id,
    name: action.name,
    budget: action.budget,
    ...(action.toHit !== undefined ? { toHit: action.toHit } : {}),
    ...(action.autoHit ? { autoHit: true } : {}),
    ...(damage
      ? {
          damage: {
            ...damage,
            ...(action.damage?.type ? { type: action.damage.type } : {}),
            ...(plus ? { plus } : {}),
          } as RulesetCombatDamage,
        }
      : {}),
    ...(action.save ? { save: { ...action.save } } : {}),
    ...(action.saveDifficulty !== undefined ? { saveDifficulty: action.saveDifficulty } : {}),
    ...(action.applies?.length ? { applies: action.applies.map((entry) => ({ ...entry })) } : {}),
    ...(action.targetCount !== undefined ? { targetCount: action.targetCount } : {}),
    ...(action.reach !== undefined ? { reach: action.reach } : {}),
    ...(action.range !== undefined ? { range: action.range } : {}),
    ...(action.area ? { area: { ...action.area } } : {}),
    ...(action.uses ? { uses: { ...action.uses } } : {}),
    ...(action.recharge ? { recharge: { dice: { ...action.recharge.dice }, from: action.recharge.from } } : {}),
    ...(action.sequence ? { sequence: action.sequence.map((step) => ({ ...step })) } : {}),
    ...(action.signature ? { signature: { ...action.signature } } : {}),
  };
}

/**
 * The stat block a bestiary entry stands for, ready for `createRulesetEncounter`. Dice health is
 * carried as both: the average, which is what a forecast reads, and the dice the encounter throws
 * when it builds the fight.
 *
 * Only the actions this ruleset can still price survive, because a catalog checked against one
 * version of a ruleset may be read by another: an action spending a budget the economy no longer
 * declares would sit on the menu and never be affordable.
 */
export function rulesetCreatureBlock(
  definition: RulesetDefinition,
  entry: RulesetCatalogEntry | null | undefined,
): RulesetStatBlock | null {
  const creature = entry?.creature;
  if (!creature) return null;
  return rulesetStatBlockFromCreature(definition, creature);
}

/**
 * The catalogs the creatures of a bestiary read their sheets' lists out of. A creature described by
 * a sheet takes the abilities on its lists from the ruleset's other catalogs, exactly as a
 * character's sheet does, so a fight needs those to hand as well as the bestiary itself. Bounded by
 * catalogs rather than creatures: a bestiary with no sheets in it needs nothing more.
 */
export function rulesetBestiarySheetCatalogIds(
  definition: RulesetDefinition,
  bestiary: RulesetCatalogEntriesById,
): string[] {
  const ids = new Set<string>();
  for (const entries of Object.values(bestiary)) {
    for (const entry of entries) {
      const sheet = entry.creature?.sheet;
      if (!sheet) continue;
      for (const id of rulesetCatalogIdsForBuild(definition, sheet)) {
        if (!(id in bestiary)) ids.add(id);
      }
    }
  }
  return [...ids];
}

/** A creature the Game Master invented for one fight, read as the plain block it always is, ready to
 *  be clamped onto the threat scale. Null when the ruleset cannot resolve a fight at all. */
export function rulesetProposedStatBlock(
  definition: RulesetDefinition,
  creature: RulesetProposedCreature,
): RulesetPlainStatBlock | null {
  const block = rulesetStatBlockFromCreature(definition, creature);
  return block && isRulesetPlainStatBlock(block) ? block : null;
}

/** A block that carries its own numbers and no sheet, which is the only kind the clamp can hold to a
 *  tier. A proposal's schema makes every one of them so; this is what lets the types say it too. */
export function isRulesetPlainStatBlock(block: RulesetStatBlock): block is RulesetPlainStatBlock {
  return (
    !block.sheet && block.health !== undefined && block.defense !== undefined && block.initiativeModifier !== undefined
  );
}

/** The same reading, for a creature that came from somewhere other than a catalog: an opponent the
 *  Game Master proposed for this one fight, in the shared creature form and clamped afterwards. */
export function rulesetStatBlockFromCreature(
  definition: RulesetDefinition,
  creature: RulesetCreature,
): RulesetStatBlock | null {
  const combat = definition.combat;
  if (!combat) return null;
  return blockFromCreature(creature, new Set(combat.economy.budgets.map((budget) => budget.id)));
}

/**
 * An opponent nobody wrote: the rung of the scale it was asked for, read as a stat block. Health is
 * the middle of the tier's band, defense and to-hit are the tier's own, and its one action deals the
 * middle of the tier's damage band flat and untyped, because a tier says how hard a creature hits
 * and nothing at all about what dice it hits with.
 *
 * Null when the ruleset declares no threat scale: then there is nothing to build a block out of, and
 * the caller has to say so rather than invent numbers.
 */
export function rulesetTierStatBlock(
  definition: RulesetDefinition,
  tierId: string | undefined,
  name: string,
): { block: RulesetStatBlock; tier: RulesetCombatThreatTier } | null {
  const combat = definition.combat;
  const tiers = combat?.threat?.tiers ?? [];
  if (!combat || tiers.length === 0) return null;
  // The first tier declared is the bottom of the scale, which is where an opponent nobody can place
  // belongs: too weak is a disappointing fight, too strong is a dead party.
  const tier = tiers.find((entry) => entry.id === tierId) ?? tiers[0]!;
  const middle = (band: readonly [number, number]) => Math.floor((band[0] + band[1]) / 2);
  return {
    tier,
    block: {
      health: Math.max(1, middle(tier.health)),
      defense: tier.defense,
      initiativeModifier: 0,
      tier: tier.id,
      actions: [
        {
          id: "strike",
          name: `${name}: attack`,
          budget: combat.economy.budgets[0]!.id,
          toHit: tier.toHit,
          damage: { count: 0, sides: 0, flat: Math.max(1, middle(tier.damagePerRound)) },
        },
      ],
    },
  };
}

function blockFromCreature(creature: RulesetCreature, budgets: ReadonlySet<string>): RulesetStatBlock {
  const kept = creature.actions.filter((action) => budgets.has(action.budget));
  const ids = new Set(kept.map((action) => action.id));
  const actions = kept.map((action) => {
    const built = creatureAction(action);
    if (!built.sequence) return built;
    const steps = built.sequence.filter((step) => ids.has(step.action));
    // A sequence whose parts are all gone is an action that would spend a budget and do nothing.
    if (steps.length === 0) return null;
    return { ...built, sequence: steps };
  });
  // A creature with a sheet has none of these: the sheet says them in the ruleset's own terms.
  const dice = creature.health === undefined || typeof creature.health === "number" ? null : amountOf(creature.health);
  return {
    ...(dice
      ? { health: Math.floor(rulesetAverageAmount(dice)), healthDice: dice }
      : typeof creature.health === "number"
        ? { health: creature.health }
        : {}),
    ...(creature.defense !== undefined ? { defense: creature.defense } : {}),
    ...(creature.initiativeModifier !== undefined ? { initiativeModifier: creature.initiativeModifier } : {}),
    ...(creature.sheet ? { sheet: structuredClone(creature.sheet) } : {}),
    actions: actions.filter((action): action is RulesetStatBlockAction => action !== null),
    ...(creature.speed !== undefined ? { speed: creature.speed } : {}),
    ...(creature.abilities ? { abilities: { ...creature.abilities } } : {}),
    ...(creature.saves ? { saves: { ...creature.saves } } : {}),
    ...(creature.resist ? { resist: [...creature.resist] } : {}),
    ...(creature.vulnerable ? { vulnerable: [...creature.vulnerable] } : {}),
    ...(creature.immune ? { immune: [...creature.immune] } : {}),
    ...(creature.conditionImmunities ? { conditionImmunities: [...creature.conditionImmunities] } : {}),
    tier: creature.tier,
    ...(creature.traits ? { traits: creature.traits.map((trait) => ({ ...trait })) } : {}),
    ...(creature.signaturePoints !== undefined ? { signaturePoints: creature.signaturePoints } : {}),
    ...(creature.riders?.length ? { riders: creature.riders.flatMap((rider) => riderOf(rider, ids)) } : {}),
  };
}

/** One rider of a block, with its amount read as dice. A rider that names only actions this block
 *  no longer has would never fire, so it is dropped rather than carried. */
function riderOf(rider: NonNullable<RulesetCreature["riders"]>[number], ids: ReadonlySet<string>) {
  const amount = amountOf(rider.amount);
  if (!amount) return [];
  const actions = rider.actions?.filter((id) => ids.has(id));
  if (rider.actions && (!actions || actions.length === 0)) return [];
  return [
    {
      id: rider.id,
      label: rider.name,
      on: rider.on,
      ...(actions?.length ? { actions } : {}),
      ...(rider.when?.length ? { when: [...rider.when] } : {}),
      oncePer: rider.oncePer,
      amount,
      ...(rider.type ? { type: rider.type } : {}),
    } satisfies RulesetCombatRider,
  ];
}

// ── The clamp ──

/** What a proposed block became, and every change in words a log can print. */
export interface RulesetClampedStatBlock {
  block: RulesetPlainStatBlock;
  adjusted: string[];
}

/** What one action deals on average, per target: the whole blow, clauses and all. */
function damageAverage(action: RulesetStatBlockAction | undefined): number {
  return action?.damage ? Math.max(0, rulesetAverageDamage(action.damage)) : 0;
}

/** Every amount one action's blow is made of, heaviest first: the first amount and every clause. A
 *  clamp shaves the heaviest of them, so a creature whose weight sits in a clause loses it there. */
function blowAmounts(action: RulesetStatBlockAction): RulesetCombatAmount[] {
  if (!action.damage) return [];
  return [action.damage, ...(action.damage.plus ?? [])].sort(
    (left, right) => rulesetAverageAmount(right) - rulesetAverageAmount(left),
  );
}

/** The id a block action answers to, with the same fallback the encounter builds its menu with, so
 *  a hand-written block without ids is read here exactly as it is read there. */
function actionId(action: RulesetStatBlockAction, index: number): string {
  return action.id ?? `block:${index}`;
}

/** The best a block can do in one round: its heaviest sequence, or its heaviest single action, and
 *  the action that round belongs to. Measured against ONE target, because a tier's band is what a
 *  creature does to somebody, not the sum of everyone it can reach. */
interface RulesetBestRound {
  average: number;
  action: RulesetStatBlockAction | null;
  parts: string[];
  /** The heaviest rider this block carries, which adds itself once to that round. */
  rider: RulesetCombatRider | null;
}

/** The rider that says most. A rider fires once in its period, so one of them rides the best round
 *  and the rest do not: counting them all would measure a creature nobody could play. */
export function heaviestRider(riders: readonly RulesetCombatRider[] | undefined): RulesetCombatRider | null {
  let best: RulesetCombatRider | null = null;
  for (const rider of riders ?? []) {
    if (!best || rulesetAverageAmount(rider.amount) > rulesetAverageAmount(best.amount)) best = rider;
  }
  return best;
}

function bestRound(
  actions: readonly RulesetStatBlockAction[],
  riders?: readonly RulesetCombatRider[],
): RulesetBestRound {
  const byId = new Map(actions.map((action, index) => [actionId(action, index), action]));
  const rider = heaviestRider(riders);
  const carried = rider ? Math.max(0, rulesetAverageAmount(rider.amount)) : 0;
  let best: RulesetBestRound = { average: 0, action: null, parts: [], rider };
  actions.forEach((action, index) => {
    const round: RulesetBestRound = action.sequence
      ? {
          average: action.sequence.reduce(
            (total, step) => total + step.times * damageAverage(byId.get(step.action)),
            0,
          ),
          action,
          parts: action.sequence.map((step) => step.action),
          rider,
        }
      : { average: damageAverage(action), action, parts: [actionId(action, index)], rider };
    // A rider adds itself to whatever the round already was, so it is counted once on top.
    round.average += round.average > 0 ? carried : 0;
    if (round.average > best.average) best = round;
  });
  return best;
}

/** One strike out of a sequence: the last step that happens more than once gives one up, and then
 *  the last step goes entirely. A sequence is never left with nothing. */
function dropOneStrike(sequence: NonNullable<RulesetStatBlockAction["sequence"]>): boolean {
  for (let index = sequence.length - 1; index >= 0; index--) {
    if (sequence[index]!.times > 1) {
      sequence[index]!.times -= 1;
      return true;
    }
  }
  if (sequence.length > 1) {
    sequence.pop();
    return true;
  }
  return false;
}

/** The next die down that a table actually owns. A clamp that answers "1d7" is right about the
 *  number and wrong about the game, so the size steps along real dice and only falls back to one
 *  face less for a die that is not among them. */
const RULESET_CLAMP_DICE = [100, 20, 12, 10, 8, 6, 4, 3, 2] as const;
export function smallerDie(sides: number): number {
  return RULESET_CLAMP_DICE.find((size) => size < sides) ?? sides - 1;
}

function knownTypes(definition: RulesetDefinition): ReadonlySet<string> | null {
  const types = definition.combat?.damageTypes;
  return types ? new Set(types.map((type) => type.trim().toLowerCase())) : null;
}

/** Only the names this ruleset has, in the order they were proposed. */
function onlyKnown(values: readonly string[] | undefined, known: ReadonlySet<string> | null): string[] | null {
  if (!values) return null;
  if (!known) return [...values];
  return values.filter((value) => known.has(value.trim().toLowerCase()));
}

/**
 * A proposed opponent pulled onto the ruleset's own scale: health into the tier's band, defense,
 * to-hit and save difficulties no more than a little above it, damage scaled down until the best
 * round fits, and every name the ruleset does not have dropped. A tier the ruleset never declared
 * falls back to the bottom of the scale and says so.
 *
 * A ruleset with no threat scale has nothing to clamp to, so the block comes back as it was with
 * one line saying why.
 */
export function clampRulesetStatBlock(
  definition: RulesetDefinition,
  proposed: RulesetPlainStatBlock,
  tierId: string,
): RulesetClampedStatBlock {
  const combat = definition.combat;
  const tiers = combat?.threat?.tiers ?? [];
  const block = structuredClone(proposed);
  const adjusted: string[] = [];
  if (!combat || tiers.length === 0) {
    adjusted.push("This ruleset declares no threat scale, so the opponent was used as it was proposed.");
    return { block, adjusted };
  }
  // The first tier declared is the bottom of the scale, which is where an opponent nobody can place
  // belongs: too weak is a disappointing fight, too strong is a dead party.
  const tier: RulesetCombatThreatTier = tiers.find((entry) => entry.id === tierId) ?? tiers[0]!;
  if (tier.id !== tierId) {
    adjusted.push(`The tier "${tierId}" is not on this ruleset's scale, so ${tier.label} was used instead.`);
  }
  block.tier = tier.id;

  // What the ruleset actually has. Anything else is a word the fight could not act on.
  const types = knownTypes(definition);
  const conditions = new Set(definition.sheet.live.conditions.map((condition) => condition.id));
  const saves = new Set(definition.sheet.saves.map((save) => save.id));
  const abilities = new Set(definition.sheet.abilities.map((ability) => ability.id));
  const budgets = combat.economy.budgets.map((budget) => budget.id);
  const mainBudget = budgets[0]!;

  for (const key of ["resist", "vulnerable", "immune"] as const) {
    const kept = onlyKnown(block[key], types);
    if (!kept) continue;
    const dropped = (block[key]?.length ?? 0) - kept.length;
    if (dropped > 0) adjusted.push(`${dropped} damage type this ruleset does not have was dropped from ${key}.`);
    if (kept.length > 0) block[key] = kept;
    else delete block[key];
  }
  if (block.conditionImmunities) {
    const kept = block.conditionImmunities.filter((condition) => conditions.has(condition));
    if (kept.length < block.conditionImmunities.length) {
      adjusted.push("A condition this ruleset does not have was dropped from the immunities.");
    }
    if (kept.length > 0) block.conditionImmunities = kept;
    else delete block.conditionImmunities;
  }
  if (block.saves) {
    const kept = Object.fromEntries(Object.entries(block.saves).filter(([id]) => saves.has(id)));
    if (Object.keys(kept).length < Object.keys(block.saves).length) {
      adjusted.push("A save this ruleset does not have was dropped.");
    }
    if (Object.keys(kept).length > 0) block.saves = kept;
    else delete block.saves;
  }
  // A rider carries a damage type of its own, and a fight reads resistance off the NAME, so a type
  // this ruleset never declared is a word nothing could act on: held to the same names an action's
  // first amount and its clauses are.
  for (const rider of block.riders ?? []) {
    if (rider.type && types && !types.has(rider.type.trim().toLowerCase())) {
      adjusted.push(
        `The damage type "${rider.type}" is not one this ruleset has, so "${rider.label}" deals untyped damage.`,
      );
      delete rider.type;
    }
  }
  if (block.abilities) {
    const kept = Object.fromEntries(Object.entries(block.abilities).filter(([id]) => abilities.has(id)));
    if (Object.keys(kept).length < Object.keys(block.abilities).length) {
      adjusted.push("An ability this ruleset does not have was dropped.");
    }
    if (Object.keys(kept).length > 0) block.abilities = kept;
    else delete block.abilities;
  }

  const health = block.health;
  if (health < tier.health[0] || health > tier.health[1]) {
    block.health = Math.min(tier.health[1], Math.max(tier.health[0], Math.floor(health)));
    // The band is about the number, so once the number is set the dice have nothing left to decide.
    delete block.healthDice;
    adjusted.push(
      `Health ${health} was pulled into the ${tier.health[0]} to ${tier.health[1]} of ${tier.label}, and is now ${block.health}.`,
    );
  }
  const defenseCap = tier.defense + RULESET_CLAMP_HEADROOM;
  if (block.defense > defenseCap) {
    adjusted.push(`Defense ${block.defense} was lowered to ${defenseCap}.`);
    block.defense = defenseCap;
  }

  if (block.actions.length > RULESET_CLAMP_MAX_ACTIONS) {
    adjusted.push(`Only the first ${RULESET_CLAMP_MAX_ACTIONS} of ${block.actions.length} actions were kept.`);
    block.actions = block.actions.slice(0, RULESET_CLAMP_MAX_ACTIONS);
  }
  const ids = new Set(block.actions.map(actionId));
  const sequences = new Set(
    block.actions.flatMap((action, index) => (action.sequence ? [actionId(action, index)] : [])),
  );
  const toHitCap = tier.toHit + RULESET_CLAMP_HEADROOM;
  const difficultyCap = tier.saveDifficulty + RULESET_CLAMP_HEADROOM;
  block.actions = block.actions.flatMap((action) => {
    if (!budgets.includes(action.budget)) {
      adjusted.push(`"${action.name}" spent a budget this ruleset does not have, so it spends ${mainBudget}.`);
      action.budget = mainBudget;
    }
    if (action.toHit !== undefined && action.toHit > toHitCap) {
      adjusted.push(`"${action.name}" now hits at ${toHitCap} instead of ${action.toHit}.`);
      action.toHit = toHitCap;
    }
    if (action.damage?.type && types && !types.has(action.damage.type.trim().toLowerCase())) {
      adjusted.push(
        `The damage type "${action.damage.type}" is not one this ruleset has, so "${action.name}" deals untyped damage.`,
      );
      delete action.damage.type;
    }
    // The clauses beside the first amount, held to the same names and the same ceiling. A clause
    // over the cap is dropped outright: a blow written as a list nobody could read is not a blow.
    if (action.damage?.plus) {
      if (action.damage.plus.length > RULESET_DAMAGE_MAX_PLUS) {
        adjusted.push(
          `"${action.name}" carried more than ${RULESET_DAMAGE_MAX_PLUS} damage clauses, so the rest were dropped.`,
        );
        action.damage.plus = action.damage.plus.slice(0, RULESET_DAMAGE_MAX_PLUS);
      }
      for (const clause of action.damage.plus) {
        if (clause.type && types && !types.has(clause.type.trim().toLowerCase())) {
          adjusted.push(
            `The damage type "${clause.type}" is not one this ruleset has, so a clause of "${action.name}" deals untyped damage.`,
          );
          delete clause.type;
        }
        if (clause.save && !saves.has(clause.save.save)) {
          adjusted.push(
            `A clause of "${action.name}" asked for a save this ruleset does not have, so it simply lands.`,
          );
          delete clause.save;
        }
        if (clause.save && clause.save.difficulty > difficultyCap) {
          // Said out loud like every other clamp: a Game Master who asked for a harder save deserves
          // to be told it was lowered, whether it was the action's own or a clause of it.
          adjusted.push(`The save against a clause of "${action.name}" was lowered to ${difficultyCap}.`);
          clause.save.difficulty = difficultyCap;
        }
      }
    }
    if (action.save && !saves.has(action.save.save)) {
      adjusted.push(`"${action.name}" asked for a save this ruleset does not have, so it simply lands.`);
      delete action.save;
    }
    if (action.save && action.save.difficulty > difficultyCap) {
      adjusted.push(`The save against "${action.name}" was lowered to ${difficultyCap}.`);
      action.save.difficulty = difficultyCap;
    }
    if (action.saveDifficulty !== undefined && action.saveDifficulty > difficultyCap) {
      adjusted.push(`The save against "${action.name}" was lowered to ${difficultyCap}.`);
      action.saveDifficulty = difficultyCap;
    }
    if (action.applies) {
      const difficulty = action.save?.difficulty ?? action.saveDifficulty;
      const kept = action.applies.flatMap((applies) => {
        if (!conditions.has(applies.condition)) {
          adjusted.push(`"${action.name}" applied a condition this ruleset does not have, so it was dropped.`);
          return [];
        }
        // A save that ends it needs a save the sheet has AND a number to roll against, or the
        // condition would never come off.
        if (applies.saveEnds && (!saves.has(applies.saveEnds.save) || difficulty === undefined)) {
          if (applies.duration === "until-save") {
            adjusted.push(
              `"${action.name}" applied ${applies.condition} until a save nothing could roll, so it was dropped.`,
            );
            return [];
          }
          adjusted.push(`The save that ends ${applies.condition} was dropped, so it runs on its own clock.`);
          const { saveEnds: _dropped, ...rest } = applies;
          return [rest];
        }
        return [applies];
      });
      if (kept.length > 0) action.applies = kept;
      else delete action.applies;
    }
    if (action.sequence) {
      const steps = action.sequence.filter((step) => ids.has(step.action) && !sequences.has(step.action));
      if (steps.length === 0) {
        adjusted.push(`"${action.name}" named nothing this block still has, so it was dropped.`);
        return [];
      }
      if (steps.length < action.sequence.length) {
        adjusted.push(`"${action.name}" lost a part that is not on this block.`);
      }
      action.sequence = steps;
    }
    return [action];
  });

  // Damage last, because dropping a save or an action changes what the best round is. Four things
  // come off, in order, from the one that says least about the creature to the one that says most:
  // how many dice it throws, the flat part beside them, how many times a sequence strikes, and only
  // then the size of the die itself. Nothing is ever taken all the way to nothing.
  const cap = tier.damagePerRound[1];
  const byId = new Map(block.actions.map((action, index) => [actionId(action, index), action]));
  let guard = 0;
  let scaled = false;
  let fewer = false;
  while (guard++ < 500) {
    const round = bestRound(block.actions, block.riders);
    if (round.average <= cap) break;
    // The heaviest part of the heaviest round: shaving that is what brings the round down.
    const part = round.parts
      .map((id) => byId.get(id))
      .filter((action): action is RulesetStatBlockAction => !!action?.damage)
      .sort((left, right) => damageAverage(right) - damageAverage(left))[0];
    // The heaviest amount in that round: the first amount of a blow that carries only one, and
    // otherwise whichever of it, its clauses and the rider riding the round says most.
    const damage = [...(part ? blowAmounts(part) : []), ...(round.rider ? [round.rider.amount] : [])].sort(
      (left, right) => rulesetAverageAmount(right) - rulesetAverageAmount(left),
    )[0];
    const rolls = !!damage && damage.count > 0 && damage.sides > 0;
    if (damage && damage.count > 1 && damage.sides > 0) damage.count -= 1;
    else if (damage && damage.flat > (rolls ? 0 : 1)) damage.flat -= 1;
    else if (round.action?.sequence && dropOneStrike(round.action.sequence)) fewer = true;
    else if (damage && rolls && damage.sides > 2) damage.sides = smallerDie(damage.sides);
    else break;
    scaled = true;
  }
  if (fewer) adjusted.push("A creature of this tier does not strike that often, so the sequence lost a strike.");
  if (scaled) {
    const left = Math.round(bestRound(block.actions, block.riders).average * 100) / 100;
    adjusted.push(
      left <= cap
        ? `The damage was scaled down until the best round averages ${left}, inside the ${tier.damagePerRound[0]} to ${cap} of ${tier.label}.`
        : `The damage was scaled down as far as this block goes, and the best round still averages ${left} against the ${cap} of ${tier.label}.`,
    );
  }
  return { block, adjusted };
}
