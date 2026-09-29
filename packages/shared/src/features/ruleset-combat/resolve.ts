// Resolving a fight: one choice at a time, and the bookkeeping between turns.
//
// Nothing here throws. A choice the rules do not allow returns the state it was given, untouched,
// and one `refused` event saying why, so a Game Master's fiction can be corrected rather than
// silently accepted. Everything a party member spends, loses or gains goes through
// `applyRulesetSheetOp`, so a fight can never write something the sheet would refuse from the
// player or from the Game Master.

import type { RulesetCombat, RulesetDefinition } from "../../schemas/ruleset.schema.js";
import { readRulesetLive, type RulesetSheetOp } from "../rulesets/live-state.js";
import { parseRulesetCombatDice, rollRulesetDice, sumOf } from "./dice.js";
import {
  rulesetCombatIsPool,
  rulesetCombatPenalty,
  rulesetSoakOf,
  throwRulesetCombatPool,
  throwRulesetDamageDice,
  type RulesetCombatPoolThrow,
} from "./pool.js";
import {
  currentRulesetActor,
  refreshRulesetBudgets,
  refreshRulesetMovement,
  rulesetCombatant,
  rulesetCombatConditions,
  rulesetCombatEffects,
  rulesetCombatFailsSave,
  rulesetCombatDamageKind,
  rulesetCombatHealth,
  rulesetCombatStanding,
  rulesetCheckMode,
  rulesetInitiativeModifierNow,
  rulesetInitiativeOrder,
  rulesetPoolInitiative,
  throwInitiativeDice,
  rulesetConditionModifiers,
  rulesetMovementAllowance,
  rulesetSaveMode,
  rulesetImmuneToCondition,
  writeRulesetSheet,
  type RulesetConditionModifier,
} from "./encounter.js";
import {
  rulesetAreaCells,
  rulesetCellDistance,
  rulesetCellEnterCost,
  rulesetOpportunityAttack,
  rulesetPositionOf,
  rulesetPushPath,
  rulesetStepLeavesReach,
  rulesetThreateningEnemies,
} from "./grid.js";
import {
  RULESET_MOVE_OPTION,
  RULESET_PASS_OPTION,
  RULESET_STAND_OPTION,
  planRulesetCombatCost,
  rulesetActionAvailable,
  rulesetAimLegal,
  rulesetAreaTargets,
  rulesetAttackMode,
  rulesetCombatOptions,
  rulesetContestCheck,
  rulesetCostSteps,
  rulesetCriticalFromAdjacent,
  rulesetDefenseAgainst,
  rulesetFreeStrike,
  rulesetGrantedStandard,
  rulesetOptionTargets,
  rulesetProneCondition,
  rulesetReactionPointsAtSource,
  rulesetReactionsAt,
  rulesetSequenceCanHappen,
  rulesetSequencePartAvailable,
  rulesetSignatureOptions,
  rulesetStandCost,
  rulesetStandardBudget,
  rulesetStandardName,
  rulesetTargetRefusal,
  rulesetWindowMoment,
  rulesetWindowOptions,
  countRulesetSpend,
  rulesetActionTakesStyle,
  rulesetAttackStyles,
  type RulesetInitiativeStyle,
} from "./options.js";
import type {
  RulesetActionResume,
  RulesetCombatAction,
  RulesetCombatAmount,
  RulesetCombatApplies,
  RulesetCombatCell,
  RulesetCombatChoice,
  RulesetCombatEvent,
  RulesetCombatOption,
  RulesetCombatPoolRoll,
  RulesetCombatRefusal,
  RulesetCombatRider,
  RulesetCombatRollMode,
  RulesetCombatRoller,
  RulesetCombatStep,
  RulesetCombatWindow,
  RulesetCombatant,
  RulesetConditionBonus,
  RulesetConditionEnding,
  RulesetContestSide,
  RulesetEncounterOutcome,
  RulesetEncounterState,
  RulesetEncounterSummary,
  RulesetHeldAttack,
  RulesetTrackedCondition,
  RulesetWalkResume,
  RulesetWindowResume,
  RulesetWindowTrigger,
} from "./types.js";

/** Everything one step of the fight needs: the rules, the state it is changing, its dice and the
 *  events it has produced so far. */
interface RulesetCombatContext {
  definition: RulesetDefinition;
  combat: RulesetCombat;
  state: RulesetEncounterState;
  roll: RulesetCombatRoller;
  events: RulesetCombatEvent[];
  /** Combatants a blow could find no box for on a wound track that refuses when full. In the
   *  systems that keep such a track that is what being taken out IS, so the blow puts them down;
   *  without it a fight on one could never end. Read, and cleared, when the blow is finished. */
  overwhelmed: Set<string>;
}

/** A working copy, plus a roller that counts its dice so the state's cursor stays exact. */
function begin(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  state: RulesetEncounterState,
  roller: RulesetCombatRoller,
): { ctx: RulesetCombatContext; finish: () => RulesetCombatStep } {
  const next = structuredClone(state);
  let rolls = 0;
  const ctx: RulesetCombatContext = {
    definition,
    combat,
    state: next,
    roll: (sides) => {
      rolls += 1;
      return roller(sides);
    },
    events: [],
    overwhelmed: new Set(),
  };
  return {
    ctx,
    finish: () => {
      next.cursor = state.cursor + rolls;
      return { state: next, events: ctx.events };
    },
  };
}

function matches(list: readonly string[] | undefined, type: string): boolean {
  return !!list?.some((entry) => entry.trim().toLowerCase() === type);
}

// ── Health ──

function healthOf(ctx: RulesetCombatContext, combatant: RulesetCombatant) {
  return rulesetCombatHealth(ctx.definition, ctx.combat, combatant);
}

/** One amount rolled: the dice as they fell, the flat part, and the total. `extra` is what a higher
 *  payment adds, rolled as its own dice so a step of another die size is still exact. */
function rollAmount(
  ctx: RulesetCombatContext,
  amount: RulesetCombatAmount,
  extra?: { amount: RulesetCombatAmount; times: number },
): { rolls: number[]; flat: number; total: number } {
  const rolls = rollRulesetDice(ctx.roll, amount.count, amount.sides);
  let flat = amount.flat;
  if (extra && extra.times > 0) {
    rolls.push(...rollRulesetDice(ctx.roll, extra.amount.count * extra.times, extra.amount.sides));
    flat += extra.amount.flat * extra.times;
  }
  return { rolls, flat, total: sumOf(rolls) + flat };
}

/**
 * One amount of harm in a `dice-pool` fight: its dice (and the extra dice a hit earned, and what a
 * higher payment adds) thrown against the damage target, its flat part added as automatic successes,
 * and what the target soaks of its kind taken off. Soak that is thrown is thrown the same way and
 * takes one off for each success; soak that is not comes off the dice before they are thrown. Either
 * way nothing goes below zero, and automatic successes are soaked like any other.
 */
function throwHarm(
  ctx: RulesetCombatContext,
  target: RulesetCombatant,
  amount: RulesetCombatAmount,
  damageType: string | undefined,
  extraDice: number,
  extra?: { amount: RulesetCombatAmount; times: number },
  /** Whether the target's soak is taken off at all. A spending blow's harm is never soaked. */
  withSoak = true,
): {
  rolls: number[];
  flat: number;
  total: number;
  pool: NonNullable<RulesetDamageInput["pool"]>;
} {
  const kind = ctx.combat.damageKinds ? rulesetCombatDamageKind(ctx.combat, damageType) : undefined;
  const soak = withSoak ? rulesetSoakOf(target, kind) : 0;
  const rule = ctx.combat.pool?.soak;
  let dice = amount.count + extraDice + (extra && extra.times > 0 ? extra.amount.count * extra.times : 0);
  const flat = amount.flat + (extra && extra.times > 0 ? extra.amount.flat * extra.times : 0);
  let soaked: { value: number; rolls?: number[]; taken: number } | undefined;
  if (rule && !rule.roll && soak > 0) {
    const taken = Math.min(Math.max(0, dice), soak);
    dice -= taken;
    soaked = { value: soak, taken };
  }
  const thrown = throwRulesetDamageDice(ctx.definition, ctx.combat, ctx.roll, dice);
  const counted = thrown.successes + Math.max(0, flat);
  let total = counted;
  // Nothing to take off is nothing to throw for.
  if (rule?.roll && soak > 0 && total > 0) {
    const soakThrow = throwRulesetDamageDice(ctx.definition, ctx.combat, ctx.roll, soak);
    const taken = Math.min(total, soakThrow.successes);
    total -= taken;
    soaked = { value: soak, rolls: soakThrow.rolls, taken };
  }
  return {
    rolls: thrown.rolls,
    flat: Math.max(0, flat),
    total,
    pool: { target: thrown.target, successes: counted, ...(soaked ? { soak: soaked } : {}) },
  };
}

/** What a critical hit adds, by the rule the ruleset declared: the same dice thrown again, or their
 *  highest faces added once. */
function criticalExtra(
  ctx: RulesetCombatContext,
  amount: RulesetCombatAmount,
  extra?: { amount: RulesetCombatAmount; times: number },
): { rolls: number[]; flat: number } {
  const rule = ctx.combat.attackRoll?.critical ?? "none";
  const dice: Array<{ count: number; sides: number }> = [{ count: amount.count, sides: amount.sides }];
  if (extra && extra.times > 0) {
    dice.push({ count: extra.amount.count * extra.times, sides: extra.amount.sides });
  }
  if (rule === "double-dice") {
    return { rolls: dice.flatMap((entry) => rollRulesetDice(ctx.roll, entry.count, entry.sides)), flat: 0 };
  }
  if (rule === "max-dice") {
    return { rolls: [], flat: dice.reduce((total, entry) => total + entry.count * entry.sides, 0) };
  }
  return { rolls: [], flat: 0 };
}

interface RulesetDamageInput {
  sourceId?: string;
  label?: string;
  damageType?: string;
  rolls: number[];
  flat: number;
  amount: number;
  saved?: boolean;
  critical?: boolean;
  /** Under `dice-pool`: what the damage dice counted, and what soak took off before `amount`. */
  pool?: Extract<RulesetCombatEvent, { type: "damage" }>["pool"];
}

/**
 * ONE amount off a target, with their own hide read first: immune takes none, resistant takes half
 * rounded down and vulnerable takes double. Temporary points go first, which is the sheet's own rule.
 *
 * A blow may be several of these, one for the first amount and one for every clause beside it, so
 * what follows a blow (the conditions damage ends, concentration, going down) is `afterBlow`'s, and
 * is done once for the lot.
 */
function applyDamage(
  ctx: RulesetCombatContext,
  target: RulesetCombatant,
  input: RulesetDamageInput,
  deferWound = false,
): number {
  const before = healthOf(ctx, target);
  const type = input.damageType?.trim().toLowerCase();
  let dealt = Math.max(0, Math.floor(input.amount));
  let adjust: "none" | "resist" | "vulnerable" | "immune" = "none";
  if (type && target.block) {
    if (matches(target.block.immune, type)) {
      dealt = 0;
      adjust = "immune";
    } else if (matches(target.block.resist, type)) {
      dealt = Math.floor(dealt / 2);
      adjust = "resist";
    } else if (matches(target.block.vulnerable, type)) {
      dealt *= 2;
      adjust = "vulnerable";
    }
  }
  // And then what a condition says about every kind of harm at once. Read after the hide underneath
  // and cancelling against it the way advantage and disadvantage cancel: resistant stays resistant,
  // immune stays immune, and something both resistant to everything and open to this one kind takes
  // it as it comes.
  if (rulesetCombatEffects(ctx.definition, ctx.combat, target, ctx.state).has("resist-all")) {
    if (adjust === "none") {
      dealt = Math.floor(dealt / 2);
      adjust = "resist";
    } else if (adjust === "vulnerable") {
      dealt = Math.floor(dealt / 2);
      adjust = "none";
    }
  }
  const toTemp = Math.min(before.temp, dealt);
  if (dealt > 0) {
    if (target.sheet) {
      if (!deferWound) writeHealthLoss(ctx, target, dealt, input.damageType);
    } else if (target.health) {
      target.health.temp = before.temp - toTemp;
      target.health.value = Math.max(0, before.value - (dealt - toTemp));
    }
  }
  const after = healthOf(ctx, target);
  ctx.events.push({
    type: "damage",
    targetId: target.id,
    ...(input.sourceId ? { sourceId: input.sourceId } : {}),
    ...(input.label ? { label: input.label } : {}),
    ...(input.damageType ? { damageType: input.damageType } : {}),
    rolls: input.rolls,
    flat: input.flat,
    amount: Math.max(0, Math.floor(input.amount)),
    dealt,
    adjust,
    ...(input.saved ? { saved: true } : {}),
    toTemp,
    health: after.value,
    maxHealth: after.max,
    ...(input.critical ? { critical: true } : {}),
    ...(input.pool ? { pool: input.pool } : {}),
  });
  return dealt;
}

/**
 * What a whole blow does once every amount on it has landed: the conditions any damage ends, ONE
 * check against concentration for the summed damage, and one check for going down.
 *
 * Whether the target was already down is read off the combatant here, before this changes it. Going
 * down only ever happens in this function, so every clause of one blow reads the same answer and a
 * second clause cannot be read as a second blow at somebody who is already on the ground; and
 * somebody a blow took out with boxes still clear counts as down though their health is not zero.
 */
function afterBlow(ctx: RulesetCombatContext, target: RulesetCombatant, dealt: number, critical: boolean): void {
  const overwhelmed = ctx.overwhelmed.delete(target.id);
  if (dealt <= 0) return;
  const wasDown = !!target.down;
  endConditionsOnDamage(ctx, target);
  const after = healthOf(ctx, target);
  const out = after.value <= 0 || overwhelmed || wasDown;
  // A blow that leaves somebody standing tests their concentration. One that takes them out does
  // not: going down ends it outright (`dropToZero`), so nothing is rolled for it.
  if (!out) concentrationFromDamage(ctx, target, dealt);
  if (out) {
    if (!wasDown) dropToZero(ctx, target);
    else if (target.dying && !target.defeated) {
      // Already down: a blow while down costs the rule's own number of failures.
      const rule = critical ? ctx.combat.dying?.criticalWhileDown : ctx.combat.dying?.damageWhileDown;
      // A stable member who is hurt is no longer stable: the count starts again with this blow.
      if (rule && rule !== "none") target.stable = false;
      if (rule === "one-failure") addDeathFailures(ctx, target, 1);
      else if (rule === "two-failures") addDeathFailures(ctx, target, 2);
    }
  }
}

/**
 * What a landing blow does to the sheet's health, whichever shape it takes.
 *
 * A POOL loses the points, temporary buffer first, exactly as it always has.
 *
 * A WOUND TRACK is marked by the rule its ruleset declared in `combat.damageKinds.marks`, because
 * the two honest answers are opposite ones. Where a damage roll counts health levels, a blow for
 * three ticks three boxes (`per-point`), which is how the tracked systems are played and the whole
 * reason soaking a blow down matters. Where a blow simply lands or does not, it ticks one box
 * however hard it hit (`per-blow`). Either way the rolled amount still decides whether the blow
 * lands AT ALL, so a miss and a blow softened to nothing mark nothing. Which KIND it marks is the
 * same block's own answer, never a guess.
 *
 * Resistances, vulnerabilities and immunities are not in the picture here: they are read off the
 * block before this is reached (see `applyDamage`), so a creature whose entry carries both a sheet
 * and a hide has the blow softened first and marked after, and one it is immune to marks nothing.
 */
function writeHealthLoss(
  ctx: RulesetCombatContext,
  target: RulesetCombatant,
  dealt: number,
  damageType: string | undefined,
): void {
  const health = ctx.combat.health;
  if (!("track" in health)) {
    writeRulesetSheet(ctx.definition, target, { op: "damage", pool: health.pool, amount: dealt });
    return;
  }
  // On an indexed track a blow names the box it lands on rather than how many it fills: its damage
  // under `per-point`, the first box under `per-blow`.
  const perPoint = ctx.combat.damageKinds?.marks === "per-point" ? Math.max(1, Math.floor(dealt)) : 1;
  const indexed = ctx.definition.sheet.live.tracks.find((track) => track.id === health.track)?.fill === "indexed";
  markWound(ctx, target, {
    op: "damage",
    track: health.track,
    kind: rulesetCombatDamageKind(ctx.combat, damageType),
    ...(indexed ? { amount: 1, box: perPoint } : { amount: perPoint }),
  });
}

/** A mark a fight writes. The fight's own kinds are the track's (checked at import) and its amounts
 *  are whole and positive, so the one refusal left is a track with no box free for it. */
function markWound(ctx: RulesetCombatContext, target: RulesetCombatant, op: RulesetSheetOp): void {
  if (!writeRulesetSheet(ctx.definition, target, op)) ctx.overwhelmed.add(target.id);
}

/** And the other way: a pool gets the points back, a wound track has ONE mark cleared, lightest
 *  first, by the same rule the player's own sheet clears one. It names no kind, because a heal that
 *  named one would clear only that kind. */
function writeHealthGain(ctx: RulesetCombatContext, target: RulesetCombatant, amount: number): void {
  const health = ctx.combat.health;
  if (!("track" in health)) {
    writeRulesetSheet(ctx.definition, target, { op: "restore", pool: health.pool, amount });
    return;
  }
  writeRulesetSheet(ctx.definition, target, {
    op: "damage",
    track: health.track,
    kind: "",
    amount: -1,
  });
}

function dealHeal(
  ctx: RulesetCombatContext,
  target: RulesetCombatant,
  input: { sourceId?: string; rolls: number[]; flat: number; amount: number },
): void {
  const before = healthOf(ctx, target);
  const amount = Math.max(0, Math.floor(input.amount));
  if (amount > 0) {
    if (target.sheet) writeHealthGain(ctx, target, amount);
    else if (target.health) target.health.value = Math.min(target.health.max, before.value + amount);
  }
  const after = healthOf(ctx, target);
  ctx.events.push({
    type: "heal",
    targetId: target.id,
    ...(input.sourceId ? { sourceId: input.sourceId } : {}),
    rolls: input.rolls,
    flat: input.flat,
    amount,
    health: after.value,
    maxHealth: after.max,
  });
  // Back up when the heal gave them something back: from nothing, or, for somebody taken out with
  // boxes still clear, a mark cleared.
  if (target.down && !target.defeated && after.value > 0 && after.value > before.value) revive(ctx, target);
}

/** Temporary points never stack: the bigger buffer is the one that stands. */
function grantTemporary(
  ctx: RulesetCombatContext,
  target: RulesetCombatant,
  input: { sourceId?: string; rolls: number[]; flat: number; amount: number },
): void {
  const amount = Math.max(0, Math.floor(input.amount));
  const before = healthOf(ctx, target);
  // A wound track carries no buffer, and there is nothing sensible a temporary point could be on
  // one, so a ruleset whose health is a track is refused a `temporary` at IMPORT. This branch is
  // what makes that refusal honest at runtime too: nothing is written and nothing is invented.
  const health = ctx.combat.health;
  if (amount > before.temp && !("track" in health)) {
    if (target.sheet) writeRulesetSheet(ctx.definition, target, { op: "temp", pool: health.pool, amount });
    else if (target.health) target.health.temp = amount;
  }
  ctx.events.push({
    type: "temporary",
    targetId: target.id,
    ...(input.sourceId ? { sourceId: input.sourceId } : {}),
    rolls: input.rolls,
    flat: input.flat,
    amount,
  });
}

// ── Going down, and coming back ──

/** The conditions this one was holding up by still being on their feet. A charm ends when whoever
 *  cast it goes down, if the ruleset said so, wherever it landed. */
function endConditionsFromSource(ctx: RulesetCombatContext, source: RulesetCombatant): void {
  const ending = new Set(
    (ctx.combat.conditions ?? []).filter((entry) => entry.endsWhenSourceDown).map((entry) => entry.condition),
  );
  if (ending.size === 0) return;
  for (const combatant of ctx.state.combatants) {
    for (const entry of [...combatant.tracked]) {
      if (entry.source === source.id && ending.has(entry.condition)) {
        removeCondition(ctx, combatant, entry.condition, "expired");
      }
    }
  }
}

function dropToZero(ctx: RulesetCombatContext, target: RulesetCombatant): void {
  target.down = true;
  endConcentration(ctx, target, "down");
  endConditionsFromSource(ctx, target);
  if (target.side === "enemy") {
    target.defeated = true;
    ctx.events.push({ type: "defeated", actorId: target.id });
    return;
  }
  const dying = ctx.combat.dying;
  target.dying = !!dying;
  target.stable = false;
  if (dying?.condition)
    applyConditionId(ctx, target, dying.condition, { condition: dying.condition, duration: "instant" });
  ctx.events.push({ type: "down", actorId: target.id, dying: !!dying });
}

function trackValue(ctx: RulesetCombatContext, combatant: RulesetCombatant, track: string): number {
  if (!combatant.sheet) return 0;
  const live = readRulesetLive(ctx.definition, combatant.sheet.build, combatant.sheet.live);
  return live.tracks.find((entry) => entry.id === track)?.value ?? 0;
}

/** The top of a track as this combatant's own sheet has it, since a plain track's maximum may be a
 *  value the sheet works out. A combatant with no sheet has no track to fill. */
function trackMax(ctx: RulesetCombatContext, combatant: RulesetCombatant, track: string): number {
  if (!combatant.sheet) return 0;
  const live = readRulesetLive(ctx.definition, combatant.sheet.build, combatant.sheet.live);
  return live.tracks.find((entry) => entry.id === track)?.max ?? 0;
}

/** Back on their feet: the fight's own bookkeeping is cleared, and so are the tracks the rules
 *  counted the rolls on. */
/** Both counts back to where they start. Reviving does it, and so does becoming stable: the count
 *  is over once it is decided, and a stable member who is hurt again starts a fresh one. */
function clearDyingTracks(ctx: RulesetCombatContext, target: RulesetCombatant): void {
  const dying = ctx.combat.dying;
  if (!dying) return;
  for (const track of [dying.successes, dying.failures]) {
    const declared = ctx.definition.sheet.live.tracks.find((entry) => entry.id === track);
    writeRulesetSheet(ctx.definition, target, { op: "track", track, to: declared?.default ?? declared?.min ?? 0 });
  }
}

function revive(ctx: RulesetCombatContext, target: RulesetCombatant): void {
  target.down = false;
  target.dying = false;
  target.stable = false;
  const dying = ctx.combat.dying;
  if (dying) {
    clearDyingTracks(ctx, target);
    if (dying.condition) removeCondition(ctx, target, dying.condition, "revived");
  }
  ctx.events.push({ type: "revived", actorId: target.id, health: healthOf(ctx, target).value });
}

function addDeathFailures(ctx: RulesetCombatContext, target: RulesetCombatant, amount: number): void {
  const dying = ctx.combat.dying;
  if (!dying) return;
  writeRulesetSheet(ctx.definition, target, { op: "track", track: dying.failures, by: amount });
  const failures = trackValue(ctx, target, dying.failures);
  const successes = trackValue(ctx, target, dying.successes);
  if (failures < trackMax(ctx, target, dying.failures)) return;
  target.defeated = true;
  target.dying = false;
  ctx.events.push({
    type: "dying",
    actorId: target.id,
    rolls: [],
    kept: 0,
    difficulty: dying.succeedAt,
    successes,
    failures,
    result: "dead",
  });
}

/** The roll a character makes at the start of their turn while they are down. */
function deathSave(ctx: RulesetCombatContext, actor: RulesetCombatant): void {
  const dying = ctx.combat.dying;
  if (!dying) return;
  const rolls = rollRulesetDice(ctx.roll, dying.dice.count, dying.dice.sides);
  const kept = sumOf(rolls);
  const single = dying.dice.count === 1;
  const top = single && kept === dying.dice.sides;
  const bottom = single && kept === 1;
  const say = (result: "success" | "failure" | "stable" | "dead" | "revived") =>
    ctx.events.push({
      type: "dying",
      actorId: actor.id,
      rolls,
      kept,
      difficulty: dying.succeedAt,
      successes: trackValue(ctx, actor, dying.successes),
      failures: trackValue(ctx, actor, dying.failures),
      result,
    });

  if (top && dying.naturals.max === "revive-1") {
    dealHeal(ctx, actor, { rolls: [], flat: 1, amount: 1 });
    say("revived");
    return;
  }
  let failures = 0;
  let successes = 0;
  if (bottom && dying.naturals.min === "two-failures") failures = 2;
  else if (bottom && dying.naturals.min === "one-failure") failures = 1;
  else if (top && dying.naturals.max === "success") successes = 1;
  else if (kept >= dying.succeedAt) successes = 1;
  else failures = 1;

  if (failures > 0) {
    const before = actor.defeated;
    addDeathFailures(ctx, actor, failures);
    if (!before && actor.defeated) return;
    say("failure");
    return;
  }
  writeRulesetSheet(ctx.definition, actor, { op: "track", track: dying.successes, by: successes });
  if (trackValue(ctx, actor, dying.successes) >= trackMax(ctx, actor, dying.successes)) {
    actor.stable = true;
    say("stable");
    clearDyingTracks(ctx, actor);
    return;
  }
  say("success");
}

// ── Saves ──

function rollSave(
  ctx: RulesetCombatContext,
  combatant: RulesetCombatant,
  save: string,
  difficulty: number,
  sourceId?: string,
): boolean {
  const modifier = combatant.saves[save] ?? 0;
  // A condition that fails this save takes the roll away entirely, rather than rolling and ignoring
  // the dice, so a log never shows a number that decided nothing.
  if (rulesetCombatFailsSave(ctx.definition, ctx.combat, combatant, save, ctx.state)) {
    ctx.events.push({
      type: "save",
      actorId: combatant.id,
      ...(sourceId ? { sourceId } : {}),
      save,
      rolls: [],
      kept: 0,
      modifier,
      total: 0,
      difficulty,
      success: false,
      automatic: true,
    });
    spendConditions(ctx, combatant, "own-save");
    return false;
  }
  const mode = rulesetSaveMode(ctx.definition, ctx.combat, combatant, save, ctx.state);
  if (rulesetCombatIsPool(ctx.combat)) {
    // The save's number is its pool, and its difficulty the successes it needs, never fewer than one.
    const bonuses = rollBonuses(
      ctx,
      rulesetConditionModifiers(ctx.definition, ctx.combat, combatant, "saves", ctx.state, save),
    );
    const needed = Math.max(1, difficulty);
    const thrown = throwPool(ctx, combatant, modifier + bonusTotal(bonuses), mode);
    const success = !thrown.botch && thrown.successes >= needed;
    ctx.events.push({
      type: "save",
      actorId: combatant.id,
      ...(sourceId ? { sourceId } : {}),
      save,
      ...(mode === "normal" ? {} : { mode }),
      rolls: thrown.rolls,
      kept: thrown.successes,
      modifier,
      ...(bonuses.length > 0 ? { bonuses } : {}),
      total: thrown.successes,
      difficulty: needed,
      success,
      pool: poolRecord(thrown),
    });
    spendConditions(ctx, combatant, "own-save");
    return success;
  }
  // Rolled twice and one kept when a condition says so, exactly as an attack is. A roll that leans
  // no way says nothing about how it was made, so a fight with no such condition logs what it
  // always logged.
  const dice = ctx.combat.attackRoll!.dice;
  const first = rollRulesetDice(ctx.roll, dice.count, dice.sides);
  const second = mode === "normal" ? null : rollRulesetDice(ctx.roll, dice.count, dice.sides);
  const kept = second
    ? mode === "advantage"
      ? Math.max(sumOf(first), sumOf(second))
      : Math.min(sumOf(first), sumOf(second))
    : sumOf(first);
  // What the saver's conditions add, rolled after the save's own dice.
  const bonuses = rollBonuses(
    ctx,
    rulesetConditionModifiers(ctx.definition, ctx.combat, combatant, "saves", ctx.state, save),
  );
  const total = kept + modifier + bonusTotal(bonuses);
  const success = total >= difficulty;
  ctx.events.push({
    type: "save",
    actorId: combatant.id,
    ...(sourceId ? { sourceId } : {}),
    save,
    ...(mode === "normal" ? {} : { mode }),
    rolls: second ? [...first, ...second] : first,
    kept,
    modifier,
    ...(bonuses.length > 0 ? { bonuses } : {}),
    total,
    difficulty,
    success,
  });
  spendConditions(ctx, combatant, "own-save");
  return success;
}

/** A pool thrown to act, with the thrower's wound penalty in it: what a `dice-pool` fight throws for
 *  an attack, a save and a side of a contest. The penalty is dice off the pool, under the ruleset's
 *  own floor, exactly as it is on a check. */
function throwPool(
  ctx: RulesetCombatContext,
  who: RulesetCombatant,
  dice: number,
  mode: RulesetCombatRollMode,
): RulesetCombatPoolThrow & { penalty: number } {
  const penalty = rulesetCombatPenalty(ctx.definition, who);
  return { ...throwRulesetCombatPool(ctx.definition, ctx.roll, dice + penalty, mode), penalty };
}

/** What an event says about one pool it threw. */
function poolRecord(thrown: RulesetCombatPoolThrow & { penalty: number }): RulesetCombatPoolRoll {
  return {
    dice: thrown.dice,
    target: thrown.target,
    ...(thrown.penalty < 0 ? { penalty: thrown.penalty } : {}),
    ...(thrown.botch ? { botch: true } : {}),
  };
}

/** What conditions add to one roll, each rolled now: a flat number as it is, dice thrown (and taken
 *  away where the modifier says `minus`). */
function rollBonuses(ctx: RulesetCombatContext, modifiers: RulesetConditionModifier[]): RulesetConditionBonus[] {
  return modifiers.map(({ condition, level, derived, modifier }) => {
    let value = modifier.flat ?? 0;
    const dice = modifier.dice ? parseRulesetCombatDice(modifier.dice) : null;
    const rolls = dice ? rollRulesetDice(ctx.roll, dice.count, dice.sides) : undefined;
    if (dice && rolls) value += (modifier.minus ? -1 : 1) * (sumOf(rolls) + dice.flat);
    return {
      condition,
      ...(level !== undefined ? { level } : {}),
      ...(derived ? { derived } : {}),
      value,
      ...(rolls ? { rolls } : {}),
    };
  });
}

function bonusTotal(bonuses: readonly RulesetConditionBonus[]): number {
  return bonuses.reduce((total, bonus) => total + bonus.value, 0);
}

/** Conditions that last one use, taken off once it has happened to their holder. */
function spendConditions(ctx: RulesetCombatContext, combatant: RulesetCombatant, ending: RulesetConditionEnding): void {
  spendOneUse(ctx, combatant, oneUseConditions(combatant, ending));
}

function oneUseConditions(combatant: RulesetCombatant, ending: RulesetConditionEnding): RulesetTrackedCondition[] {
  return combatant.tracked.filter((entry) => entry.endsAfter === ending);
}

/** Takes off exactly these, if they are still on. One the same blow put on afresh is a new one, not
 *  the one that was used, so it stays. */
function spendOneUse(ctx: RulesetCombatContext, combatant: RulesetCombatant, used: RulesetTrackedCondition[]): void {
  for (const entry of used) {
    if (combatant.tracked.includes(entry)) removeCondition(ctx, combatant, entry.condition, "spent");
  }
}

// ── Conditions ──

function applyConditionId(
  ctx: RulesetCombatContext,
  target: RulesetCombatant,
  condition: string,
  applies: RulesetCombatApplies,
  extra: { sourceId?: string; difficulty?: number; concentration?: boolean } = {},
): void {
  if (rulesetImmuneToCondition(target, condition)) {
    ctx.events.push({ type: "condition", targetId: target.id, condition, active: false, reason: "immune" });
    return;
  }
  if (target.sheet) writeRulesetSheet(ctx.definition, target, { op: "condition", condition, active: true });
  const rounds = typeof applies.duration === "object" ? applies.duration.rounds : null;
  const clock = typeof applies.duration === "object" ? applies.duration.at : undefined;
  target.tracked = target.tracked.filter((entry) => entry.condition !== condition);
  target.tracked.push({
    condition,
    rounds,
    ...(clock ? { clock } : {}),
    ...(applies.endsAfter ? { endsAfter: applies.endsAfter } : {}),
    ...(applies.saveEnds ? { saveEnds: applies.saveEnds } : {}),
    ...(extra.difficulty !== undefined ? { difficulty: extra.difficulty } : {}),
    ...(extra.sourceId ? { source: extra.sourceId } : {}),
    ...(extra.concentration ? { concentration: true } : {}),
  });
  ctx.events.push({ type: "condition", targetId: target.id, condition, active: true, reason: "applied" });
}

function removeCondition(
  ctx: RulesetCombatContext,
  target: RulesetCombatant,
  condition: string,
  reason: "save" | "expired" | "damage" | "concentration" | "revived" | "contest" | "spent" | "recovered",
): void {
  target.tracked = target.tracked.filter((entry) => entry.condition !== condition);
  if (target.sheet) writeRulesetSheet(ctx.definition, target, { op: "condition", condition, active: false });
  ctx.events.push({ type: "condition", targetId: target.id, condition, active: false, reason });
}

/** Conditions the ruleset says any damage ends. */
function endConditionsOnDamage(ctx: RulesetCombatContext, target: RulesetCombatant): void {
  const ending = new Set(
    (ctx.combat.conditions ?? [])
      .filter((entry) => entry.effects.includes("ends-on-damage"))
      .map((entry) => entry.condition),
  );
  if (ending.size === 0) return;
  for (const condition of rulesetCombatConditions(ctx.definition, target)) {
    if (ending.has(condition)) removeCondition(ctx, target, condition, "damage");
  }
}

/** The saves that repeat, and the clocks that run out. Both belong to the affected combatant's own
 *  turn, so a condition lasts the same time whoever put it on. */
function tickConditions(ctx: RulesetCombatContext, actor: RulesetCombatant, at: "turn-start" | "turn-end"): void {
  for (const entry of [...actor.tracked]) {
    // A save with nothing to be rolled against is not rolled: the condition runs on its clock.
    if (entry.saveEnds?.at === at && entry.difficulty !== undefined) {
      const ended = rollSave(ctx, actor, entry.saveEnds.save, entry.difficulty, entry.source);
      if (ended) {
        removeCondition(ctx, actor, entry.condition, "save");
        continue;
      }
    }
    // A clock counts the holder's turns down as each one ends, or, where it says so, as each begins.
    if (entry.rounds === null || at !== (entry.clock ?? "turn-end")) continue;
    entry.rounds -= 1;
    if (entry.rounds <= 0) removeCondition(ctx, actor, entry.condition, "expired");
  }
}

// ── Concentration ──

function endConcentration(
  ctx: RulesetCombatContext,
  actor: RulesetCombatant,
  reason: "replaced" | "damage" | "down",
): void {
  const held = actor.concentrating;
  if (!held) return;
  actor.concentrating = null;
  const concentration = ctx.combat.concentration;
  if (concentration) writeRulesetSheet(ctx.definition, actor, { op: "note", field: concentration.text, value: "" });
  // Whatever the concentration was holding up goes with it, wherever it landed.
  for (const combatant of ctx.state.combatants) {
    for (const entry of [...combatant.tracked]) {
      if (entry.concentration && entry.source === actor.id) {
        removeCondition(ctx, combatant, entry.condition, "concentration");
      }
    }
  }
  ctx.events.push({ type: "concentration", actorId: actor.id, label: held.label, state: "ended", reason });
}

function startConcentration(ctx: RulesetCombatContext, actor: RulesetCombatant, action: RulesetCombatAction): void {
  if (actor.concentrating) endConcentration(ctx, actor, "replaced");
  actor.concentrating = { actionId: action.id, label: action.label };
  const concentration = ctx.combat.concentration;
  if (concentration) {
    writeRulesetSheet(ctx.definition, actor, { op: "note", field: concentration.text, value: action.label });
  }
  ctx.events.push({ type: "concentration", actorId: actor.id, label: action.label, state: "started" });
}

function concentrationFromDamage(ctx: RulesetCombatContext, target: RulesetCombatant, dealt: number): void {
  const concentration = ctx.combat.concentration;
  if (!concentration || !target.concentrating) return;
  const difficulty = Math.max(concentration.floor, Math.floor(dealt * concentration.fromDamage));
  if (rollSave(ctx, target, concentration.save, difficulty)) {
    ctx.events.push({ type: "concentration", actorId: target.id, label: target.concentrating.label, state: "kept" });
    return;
  }
  endConcentration(ctx, target, "damage");
}

// ── One choice ──

function refusal(
  state: RulesetEncounterState,
  actorId: string,
  reason: RulesetCombatRefusal,
  optionId?: string,
): RulesetCombatStep {
  return { state, events: [{ type: "refused", actorId, ...(optionId ? { optionId } : {}), reason }] };
}

/** Who a choice may be pointed at, checked against the very list `rulesetOptionTargets` offers, so
 *  the menu and the resolution can never disagree. `null` is a refusal: one target too many, one of
 *  the wrong side, or one the fight is over for. */
function pickTargets(
  definition: RulesetDefinition,
  state: RulesetEncounterState,
  actor: RulesetCombatant,
  option: { id: string; targets: RulesetCombatAction["targets"] },
  targetIds: readonly string[],
): RulesetCombatant[] | RulesetCombatRefusal {
  if (option.targets.count <= 0) return [];
  const ids = [...new Set(targetIds)];
  if (ids.length < 1 || ids.length > option.targets.count) return "bad-target";
  const legal = new Set(rulesetOptionTargets(definition, state, actor.id, option));
  const targets: RulesetCombatant[] = [];
  for (const id of ids) {
    // A target the rules would allow if only it were closer is told exactly that, rather than being
    // lumped in with one of the wrong side or one the fight is over for.
    if (!legal.has(id)) return rulesetTargetRefusal(state, actor.id, option.id, id) ?? "bad-target";
    targets.push(rulesetCombatant(state, id)!);
  }
  return targets;
}

/** What using an action costs the actor in its own bookkeeping: one of its uses, and, for an action
 *  that recharges, its availability until the dice bring it back. */
function spendAvailability(ctx: RulesetCombatContext, actor: RulesetCombatant, action: RulesetCombatAction): void {
  if (action.uses) {
    const left = Math.max(0, (actor.uses[action.id] ?? 0) - 1);
    actor.uses[action.id] = left;
    ctx.events.push({
      type: "uses",
      actorId: actor.id,
      optionId: action.id,
      label: action.label,
      left,
      of: action.uses.count,
    });
  }
  if (action.recharge && !actor.spent.includes(action.id)) actor.spent.push(action.id);
}

/** Why an option the caller named is not on the menu, as precisely as the rules can say. */
function whyNotOffered(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  actor: RulesetCombatant,
  optionId: string,
): RulesetCombatRefusal {
  // The two a positioned fight adds. Off the menu, they are movement that cannot be paid for.
  if (optionId === RULESET_MOVE_OPTION || optionId === RULESET_STAND_OPTION) return "unreachable";
  const action = actor.actions.find((entry) => entry.id === optionId);
  if (action) {
    // Something free, or a strike out of what a spend already bought, never fell short of a budget.
    if (action.free || rulesetFreeStrike(actor, action)) return "insufficient";
    if ((actor.budgets[action.budget] ?? 0) < 1) return "no-budget";
    return "insufficient";
  }
  if (optionId.startsWith("standard:")) {
    const granted = rulesetGrantedStandard(definition, actor, optionId);
    const standard = rulesetStandardName(optionId);
    if ((combat.standard ?? []).some((entry) => entry === standard)) {
      const budget = granted ? granted.budget : rulesetStandardBudget(combat);
      if (optionId.includes("@") && !granted) {
        // Told apart, because they are different answers: an ability that grants this really is on
        // the sheet but has nothing left or cannot pay, versus no such permission at all.
        const spent = actor.actions.some(
          (entry) =>
            entry.standard?.budget === optionId.slice(optionId.indexOf("@") + 1) &&
            entry.standard.actions.includes(standard),
        );
        return spent ? "insufficient" : "unknown-option";
      }
      return (actor.budgets[budget] ?? 0) < 1 ? "no-budget" : "unknown-option";
    }
  }
  return "unknown-option";
}

/**
 * One choice from the menu, resolved. Never throws: an illegal choice comes back with the state it
 * was given and one `refused` event.
 *
 * The dice are injected, so the same state, the same choice and the same rolls always produce the
 * same events. `payWith` pays the price out of a higher pool of the same family, under the rule the
 * sheet's own `use` command already follows.
 */
export function applyRulesetCombatChoice(
  definition: RulesetDefinition,
  state: RulesetEncounterState,
  choice: RulesetCombatChoice,
  roller: RulesetCombatRoller,
): RulesetCombatStep {
  const combat = definition.combat;
  if (!combat) return refusal(state, choice.actorId, "encounter-over", choice.optionId);
  if (rulesetEncounterOutcome(state) !== "ongoing") {
    return refusal(state, choice.actorId, "encounter-over", choice.optionId);
  }
  const actor = rulesetCombatant(state, choice.actorId);
  if (!actor) return refusal(state, choice.actorId, "unknown-actor", choice.optionId);
  // A window holds the whole fight: while one is open the only thing that moves it is the answer of
  // the one combatant it is asking, and every other choice is refused rather than queued.
  if (state.window) return applyInWindow(definition, combat, state, state.window, actor, choice, roller);
  // An answer to a window that has already closed is NOT a turn's choice. Letting it fall through
  // would spend on a turn what was written for a moment the fight has moved past, which is the one
  // thing the window's id is carried to prevent.
  if (choice.window !== undefined) return refusal(state, choice.actorId, "stale-window", choice.optionId);
  // Points, not a budget, and bought between one turn and the next rather than on anybody's: a
  // signature action off its own window is refused here, so nothing buys one mid-turn.
  const signature = actor.actions.find((entry) => entry.id === choice.optionId && entry.signature);
  if (signature) return refusal(state, choice.actorId, "not-your-turn", choice.optionId);
  if (currentRulesetActor(state)?.id !== actor.id)
    return refusal(state, choice.actorId, "not-your-turn", choice.optionId);
  // Ending a turn is always allowed, down or not: a character lying at zero still has a turn, and
  // it is the one their roll against death happens on.
  if (choice.optionId === "end-turn") return advanceRulesetTurn(definition, state, roller);
  if (!rulesetCombatStanding(actor)) return refusal(state, choice.actorId, "down", choice.optionId);

  const option = rulesetCombatOptions(definition, state, actor.id).find((entry) => entry.id === choice.optionId);
  if (!option) {
    if (rulesetCombatEffects(definition, combat, actor, state).has("cannot-act")) {
      return refusal(state, choice.actorId, "cannot-act", choice.optionId);
    }
    return refusal(state, choice.actorId, whyNotOffered(definition, combat, actor, choice.optionId), choice.optionId);
  }

  // Walking, and getting back up: a positioned fight's own two options. Neither spends a budget.
  if (option.kind === "move") {
    const cell = option.id === RULESET_MOVE_OPTION ? destinationOf(option, choice.to) : null;
    if (option.id === RULESET_MOVE_OPTION && !cell) return refusal(state, choice.actorId, "unreachable", option.id);
    const { ctx, finish } = begin(definition, combat, state, roller);
    const walking = rulesetCombatant(ctx.state, actor.id)!;
    if (cell) resolveMove(ctx, walking, cell);
    else resolveStand(ctx, walking, option);
    const ended = rulesetEncounterOutcome(ctx.state);
    if (ended !== "ongoing") pushOutcome(ctx, ended);
    return finish();
  }

  // An area lands on a CELL, and everybody standing in the shape is caught by it. Its own
  // `targetCount` says nothing here: the shape decides how many it reaches.
  const area = positionedArea(state, actor, option);
  if (area && !(choice.at && rulesetAimLegal(state, actor.id, option.id, choice.at))) {
    return refusal(state, choice.actorId, "bad-cell", option.id);
  }
  // Targets, checked against the side and the count the option itself declared.
  const targets = area
    ? rulesetAreaTargets(state, actor.id, option.id, choice.at!).map((id) => rulesetCombatant(state, id)!)
    : pickTargets(definition, state, actor, option, choice.targetIds);
  if (!Array.isArray(targets)) return refusal(state, choice.actorId, targets, option.id);
  if (choice.payWith !== undefined && !(option.payWith ?? []).includes(choice.payWith)) {
    return refusal(state, choice.actorId, "bad-pool", option.id);
  }

  const { ctx, finish } = begin(definition, combat, state, roller);
  const working = rulesetCombatant(ctx.state, actor.id)!;
  const workingTargets = targets.map((target) => rulesetCombatant(ctx.state, target.id)!);

  // The budget goes first: what a turn may hold is not a matter of how the dice fall.
  const budget = option.budget;
  if (budget) {
    working.budgets[budget] = Math.max(0, (working.budgets[budget] ?? 0) - 1);
    ctx.events.push({ type: "budget", actorId: working.id, budget, left: working.budgets[budget]! });
  }

  if (option.kind === "standard") {
    // A standard action an ability allowed is paid for as that ability is: the budget it named,
    // just spent, and whatever the ability itself costs off the sheet.
    const granted = rulesetGrantedStandard(definition, working, option.id);
    if (granted) {
      const price = planRulesetCombatCost(definition, working, granted.action);
      if (!price) return refusal(state, choice.actorId, "insufficient", option.id);
      if (price.live && working.sheet) working.sheet.live = price.live;
      countRulesetSpend(working, price.cost);
      for (const entry of price.cost) {
        ctx.events.push({
          type: "spend",
          actorId: working.id,
          pool: entry.pool,
          label: entry.label,
          amount: entry.amount,
        });
      }
      spendAvailability(ctx, working, granted.action);
    }
    resolveStandard(ctx, working, rulesetStandardName(option.id), workingTargets[0]);
    return finish();
  }

  // Strikes: one spend of a source that declares them buys several, and the rest wait in hand until
  // the turn ends. Taking one with any in hand spends no budget at all, which is why this reads
  // what the option said rather than the budget it would otherwise have named.
  const striking = working.actions.find((entry) => entry.id === option.id);
  const inHand = working.strikesLeft ?? 0;
  // A spend that buys ONE strike is the spend every fight has always made, so it puts nothing in
  // hand and says nothing: a ruleset whose list declares one strike a spend reads as it always did.
  if (striking?.strikes !== undefined && (inHand > 0 || striking.strikes > 1)) {
    const left = inHand > 0 ? inHand - 1 : striking.strikes - 1;
    if (left > 0) working.strikesLeft = left;
    else delete working.strikesLeft;
    ctx.events.push({ type: "strikes", actorId: working.id, optionId: striking.id, label: striking.label, left });
  }

  if (area && choice.at) {
    ctx.events.push({
      type: "area",
      actorId: working.id,
      optionId: option.id,
      label: option.label,
      at: { ...choice.at },
      cells: areaCellsFor(ctx.state, working, option.id, choice.at),
    });
  }

  const action = working.actions.find((entry) => entry.id === option.id)!;
  // Where initiative is a number attacks move, the style it is made in: the one asked for, which has
  // to be one this attack is offered in, or the first when none was asked for.
  const offeredStyles = rulesetAttackStyles(combat, working, action);
  if (choice.style !== undefined && !offeredStyles.some((style) => style.id === choice.style)) {
    return refusal(state, choice.actorId, "unknown-style", option.id);
  }
  const chosenStyle = offeredStyles.find((style) => style.id === choice.style) ?? offeredStyles[0];
  const styleId = chosenStyle?.id;
  // A spending blow throws the number its maker has as they make it, whatever a window does to it.
  const spend = chosenStyle?.spends ? working.initiative : undefined;
  const paid = planRulesetCombatCost(definition, working, action, choice.payWith);
  if (!paid) {
    // The menu said it was affordable, so only a `payWith` the sheet refuses can land here.
    return refusal(state, choice.actorId, "insufficient", option.id);
  }
  if (paid.live && working.sheet) working.sheet.live = paid.live;
  countRulesetSpend(working, paid.cost);
  for (const entry of paid.cost) {
    ctx.events.push({ type: "spend", actorId: working.id, pool: entry.pool, label: entry.label, amount: entry.amount });
  }
  spendAvailability(ctx, working, action);
  // A contest is settled between the two of them on the spot, and opens no window: nobody else is
  // asked about it.
  if (action.contest) {
    resolveContest(ctx, working, action, action.contest, workingTargets[0]!);
    noteOutcome(ctx);
    return finish();
  }
  // Paid for, and then held for everybody it is aimed at who has something that answers being
  // aimed at. What it cost is spent either way: an answer that calls it off stops it from
  // happening, not from having been bought.
  const resume: RulesetActionResume = {
    kind: "action",
    actorId: working.id,
    optionId: action.id,
    targetIds: workingTargets.map((target) => target.id),
    ...(choice.payWith !== undefined ? { payWith: choice.payWith } : {}),
    ...(styleId ? { style: styleId } : {}),
    ...(spend !== undefined ? { spend } : {}),
  };
  // Somebody on the other side may answer the USE first, wherever it is aimed; then the ones it is
  // aimed at get their own say. Whatever is held resolves once the last window has closed.
  const held =
    openMoment(
      ctx,
      {
        kind: "used",
        sourceId: working.id,
        optionId: action.id,
        label: action.label,
        ...(action.catalog ? { catalog: action.catalog } : {}),
      },
      ctx.state.combatants,
      resume,
    ) || openAimed(ctx, resume, action.label, action.catalog);
  if (!held) {
    harmedBy(ctx, working, action, resume, () =>
      resolveAction(ctx, working, action, workingTargets, choice.payWith, undefined, styleId, spend),
    );
  }
  noteOutcome(ctx);
  return finish();
}

/**
 * One signature action, bought with the actor's own points. It spends no budget and takes no turn:
 * it is what a creature does while somebody else is acting, which is why the actor whose turn it is
 * has none to spend. The window between two turns is where it is offered (`openSignatureWindow`);
 * the price, the refusals and the resolution are all here.
 */
/**
 * One contest: both sides throw the fight's own attack dice and add the best check they may use here;
 * the higher total wins and a tie goes where the contest says. Winning ends, applies and
 * pushes what the contest names, in that order, with the winner as the source of what it applies, so
 * a hold ends when the holder goes down. Losing does nothing at all, which is what a failed grab is.
 */
function resolveContest(
  ctx: RulesetCombatContext,
  actor: RulesetCombatant,
  action: RulesetCombatAction,
  contest: NonNullable<RulesetCombatAction["contest"]>,
  target: RulesetCombatant,
): void {
  // Each side thrown as its own conditions say: twice with one kept, and whatever they add rolled
  // after the dice. A side nothing leans or adds to is written exactly as it always was. In a pool
  // fight each side throws its check as a pool and the one with more net successes wins.
  const thrown = (who: RulesetCombatant, check: string, modifier: number): RulesetContestSide => {
    const mode = rulesetCheckMode(ctx.definition, ctx.combat, who, ctx.state);
    if (rulesetCombatIsPool(ctx.combat)) {
      const bonuses = rollBonuses(ctx, rulesetConditionModifiers(ctx.definition, ctx.combat, who, "checks", ctx.state));
      const pool = throwPool(ctx, who, modifier + bonusTotal(bonuses), mode);
      return {
        check,
        rolls: pool.rolls,
        modifier,
        total: pool.botch ? 0 : pool.successes,
        ...(mode === "normal" ? {} : { mode }),
        ...(bonuses.length > 0 ? { bonuses } : {}),
        pool: poolRecord(pool),
      };
    }
    const { count, sides } = ctx.combat.attackRoll!.dice;
    const first = rollRulesetDice(ctx.roll, count, sides);
    const second = mode === "normal" ? null : rollRulesetDice(ctx.roll, count, sides);
    const kept = second
      ? mode === "advantage"
        ? Math.max(sumOf(first), sumOf(second))
        : Math.min(sumOf(first), sumOf(second))
      : sumOf(first);
    const bonuses = rollBonuses(ctx, rulesetConditionModifiers(ctx.definition, ctx.combat, who, "checks", ctx.state));
    return {
      check,
      rolls: second ? [...first, ...second] : first,
      modifier,
      total: kept + modifier + bonusTotal(bonuses),
      ...(mode === "normal" ? {} : { mode }),
      ...(bonuses.length > 0 ? { bonuses } : {}),
    };
  };
  const mine = rulesetContestCheck(actor, contest, "attacker");
  const theirs = rulesetContestCheck(target, contest, "defender");
  const attacker = thrown(actor, mine.check, mine.modifier);
  const defender = thrown(target, theirs.check, theirs.modifier);
  const margin = attacker.total - defender.total;
  const winner = margin > 0 || (margin === 0 && contest.ties === "attacker") ? "actor" : "target";
  ctx.events.push({
    type: "contest",
    actorId: actor.id,
    targetId: target.id,
    optionId: action.id,
    label: action.label,
    attacker,
    defender,
    winner,
  });
  if (winner !== "actor") return;
  for (const entry of contest.ends ?? []) {
    const on = entry.on === "actor" ? actor : target;
    if (rulesetCombatConditions(ctx.definition, on).includes(entry.condition)) {
      removeCondition(ctx, on, entry.condition, "contest");
    }
  }
  for (const entry of contest.applies ?? []) {
    applyConditionId(
      ctx,
      target,
      entry.condition,
      { condition: entry.condition, duration: entry.rounds !== undefined ? { rounds: entry.rounds } : "instant" },
      { sourceId: actor.id },
    );
  }
  if (contest.push !== undefined) {
    const path = rulesetPushPath(ctx.state, actor.id, target.id, contest.push);
    const from = rulesetPositionOf(target);
    const to = path[path.length - 1];
    if (from && to) {
      target.x = to.x;
      target.y = to.y;
      ctx.events.push({ type: "pushed", actorId: actor.id, targetId: target.id, from, to: { ...to }, path });
    }
  }
}

/** The outcome, said once. The window path ends a fight in more than one place, and a log that
 *  said so twice would read as two endings. */
function noteOutcome(ctx: RulesetCombatContext): void {
  const outcome = rulesetEncounterOutcome(ctx.state);
  if (outcome === "ongoing") return;
  if (ctx.events[ctx.events.length - 1]?.type === "outcome") return;
  pushOutcome(ctx, outcome);
}

/** The fight is over: whatever it lifts as it ends, then the outcome. Every way a fight ends says so
 *  through here, so none of them leaves anybody crashed. */
function pushOutcome(ctx: RulesetCombatContext, outcome: Exclude<RulesetEncounterOutcome, "ongoing">): void {
  ctx.events.push(...liftRulesetCrashes(ctx.definition, ctx.state));
  ctx.events.push({ type: "outcome", outcome });
}

/**
 * Nobody is crashed once the fight is over, however it ended: the number attacks move means nothing
 * outside it, and a crash condition left on a sheet would outlast the fight it belonged to. Returns
 * what came off, for a log that is still being written.
 */
export function liftRulesetCrashes(definition: RulesetDefinition, state: RulesetEncounterState): RulesetCombatEvent[] {
  const condition = definition.combat?.initiative.resource?.crash?.condition;
  const events: RulesetCombatEvent[] = [];
  for (const combatant of state.combatants) {
    if (combatant.crashedTurns === undefined) continue;
    delete combatant.crashedTurns;
    if (!condition || !rulesetCombatConditions(definition, combatant).includes(condition)) continue;
    combatant.tracked = combatant.tracked.filter((entry) => entry.condition !== condition);
    if (combatant.sheet) writeRulesetSheet(definition, combatant, { op: "condition", condition, active: false });
    events.push({ type: "condition", targetId: combatant.id, condition, active: false, reason: "recovered" });
  }
  return events;
}

/**
 * One answer to the open window, from the one combatant it is asking. Anybody else is refused: a
 * window is not a free-for-all, and an answer that arrived while somebody else was still being
 * asked would spend a budget against a fight that had already moved.
 */
function applyInWindow(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  state: RulesetEncounterState,
  window: RulesetCombatWindow,
  actor: RulesetCombatant,
  choice: RulesetCombatChoice,
  roller: RulesetCombatRoller,
): RulesetCombatStep {
  // An answer that names a window is checked against the open one. One that names none is taken as
  // meant for whatever is open, which is how a caller that never saves an answer may stay simple.
  if (choice.window !== undefined && choice.window !== window.id) {
    return refusal(state, choice.actorId, "stale-window", choice.optionId);
  }
  if (window.waiting[0] !== actor.id) return refusal(state, choice.actorId, "window-open", choice.optionId);

  if (choice.optionId === RULESET_PASS_OPTION) {
    const { ctx, finish } = begin(definition, combat, state, roller);
    ctx.events.push({ type: "pass", actorId: actor.id, window: window.id });
    goOn(definition, combat, ctx);
    noteOutcome(ctx);
    return finish();
  }

  const option = rulesetWindowOptions(definition, state, actor.id).find((entry) => entry.id === choice.optionId);
  if (!option) return refusal(state, choice.actorId, "unknown-option", choice.optionId);
  if (window.kind === "signature") {
    const action = actor.actions.find((entry) => entry.id === choice.optionId && entry.signature);
    if (!action) return refusal(state, choice.actorId, "unknown-option", choice.optionId);
    return applySignature(definition, combat, state, actor, action, choice, roller);
  }

  const trigger = window.trigger;
  // A strike at somebody walking away, taken rather than made for them. It costs and resolves
  // exactly as the automatic one did: the same budget, the same books, the same dice.
  if (trigger.kind === "leaves-reach") {
    const { ctx, finish } = begin(definition, combat, state, roller);
    const striker = rulesetCombatant(ctx.state, actor.id)!;
    const mover = rulesetCombatant(ctx.state, trigger.moverId);
    if (mover) opportunityStrike(ctx, striker, mover, combat.opportunity!.budget);
    goOn(definition, combat, ctx);
    noteOutcome(ctx);
    return finish();
  }
  if (trigger.kind === "between-turns") return refusal(state, choice.actorId, "unknown-option", choice.optionId);

  // A reaction taken at its own moment. It is an ordinary action, paid for and resolved exactly as
  // it would be on a turn; the only thing the moment adds is whom it is aimed at, and whether
  // taking it calls off what the window was holding.
  return takeReaction(definition, combat, state, window, actor, choice, roller);
}

/** One reaction, taken at the moment it waits for. */
function takeReaction(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  state: RulesetEncounterState,
  window: RulesetCombatWindow,
  actor: RulesetCombatant,
  choice: RulesetCombatChoice,
  roller: RulesetCombatRoller,
): RulesetCombatStep {
  const trigger = window.trigger;
  if (trigger.kind !== "aimed" && trigger.kind !== "hit" && trigger.kind !== "harmed" && trigger.kind !== "used") {
    return refusal(state, choice.actorId, "unknown-option", choice.optionId);
  }
  const declared = actor.actions.find((entry) => entry.id === choice.optionId && entry.reaction);
  const offered = rulesetWindowOptions(definition, state, actor.id).find((entry) => entry.id === choice.optionId);
  if (!declared || !offered) return refusal(state, choice.actorId, "unknown-option", choice.optionId);
  // Filled in rather than picked, unless the entry says its holder picks: aimed back at whoever
  // caused the moment, or, for something its holder does to THEMSELVES, at its holder. Bracing
  // yourself is not aimed at anybody, and pointing it at whoever hurt you would hand them what it
  // gives.
  const source = rulesetCombatant(state, trigger.sourceId);
  const targets = !rulesetReactionPointsAtSource(declared)
    ? declared.targets.side === "self"
      ? [actor]
      : pickTargets(definition, state, actor, declared, choice.targetIds)
    : // Still a target, checked the same way the menu checks it: an answer before this one may have
      // taken the source out, and a blow aimed at somebody the fight is over for lands on nobody.
      source && rulesetOptionTargets(definition, state, actor.id, declared).includes(source.id)
      ? [source]
      : "bad-target";
  if (!Array.isArray(targets)) return refusal(state, choice.actorId, targets, choice.optionId);

  // The menu is the only source of legality here as well: a pool it did not offer is refused as the
  // wrong pool, and before anything is spent rather than after.
  if (choice.payWith !== undefined && !(offered.payWith ?? []).includes(choice.payWith)) {
    return refusal(state, choice.actorId, "bad-pool", choice.optionId);
  }

  const { ctx, finish } = begin(definition, combat, state, roller);
  const taking = rulesetCombatant(ctx.state, actor.id)!;
  const action = taking.actions.find((entry) => entry.id === declared.id)!;
  // The OPTION says whether a budget is spent, exactly as it does on a turn: an entry marked free
  // carries none, and reading the action's own budget would refuse it for want of something it
  // never asked for.
  const budget = offered.budget;
  if (budget !== undefined) {
    if ((taking.budgets[budget] ?? 0) < 1) return refusal(state, choice.actorId, "no-budget", choice.optionId);
    taking.budgets[budget] = Math.max(0, (taking.budgets[budget] ?? 0) - 1);
    ctx.events.push({ type: "budget", actorId: taking.id, budget, left: taking.budgets[budget]! });
  }
  const paid = planRulesetCombatCost(definition, taking, action, choice.payWith);
  if (!paid) return refusal(state, choice.actorId, "insufficient", choice.optionId);
  if (paid.live && taking.sheet) taking.sheet.live = paid.live;
  countRulesetSpend(taking, paid.cost);
  for (const entry of paid.cost) {
    ctx.events.push({ type: "spend", actorId: taking.id, pool: entry.pool, label: entry.label, amount: entry.amount });
  }
  spendAvailability(ctx, taking, action);
  // Calling it off happens BEFORE this one's own dice: what was held never lands, so nothing it
  // would have done can change what this reaction is resolved against.
  if (action.reaction?.cancels && ctx.state.window?.resume?.kind === "action") {
    const stopped = ctx.state.window.resume;
    stopped.cancelled = true;
    // Nobody else is asked: the question was what to do about something that is now not going to
    // happen. Withdrawing it is not the same as everybody passing, so no moment is let go either;
    // the rest simply keep what they were holding.
    ctx.state.window.waiting = [];
    ctx.events.push({
      type: "cancelled",
      actorId: stopped.actorId,
      optionId: stopped.optionId,
      label: trigger.kind === "aimed" || trigger.kind === "used" ? trigger.label : action.label,
      byId: taking.id,
    });
  }
  const workingTargets = targets.map((target) => rulesetCombatant(ctx.state, target.id)!);
  resolveAction(ctx, taking, action, workingTargets, choice.payWith);
  goOn(definition, combat, ctx);
  noteOutcome(ctx);
  return finish();
}

/**
 * The window, one answer further on. The one who just answered drops off the front, and so does
 * anybody left with nothing to answer with: a window that asked them anyway would hold the fight
 * open for a menu with only a pass on it.
 *
 * When the last of them has answered the window closes and the fight picks up exactly where it was
 * held: the rest of the walk, or the turn that had not yet begun.
 */
function goOn(definition: RulesetDefinition, combat: RulesetCombat, ctx: RulesetCombatContext): void {
  const window = ctx.state.window;
  if (!window) return;
  window.waiting.shift();
  while (window.waiting.length > 0 && rulesetWindowOptions(definition, ctx.state, window.waiting[0]!).length === 0) {
    ctx.events.push({ type: "pass", actorId: window.waiting[0]!, window: window.id });
    window.waiting.shift();
  }
  const over = rulesetEncounterOutcome(ctx.state) !== "ongoing";
  if (window.waiting.length > 0 && !over) return;
  const { resume, trigger } = window;
  ctx.state.window = undefined;
  // A walk is finished even when the last blow ended the fight: its own event says where the walker
  // really stopped, and a fight that ended mid-step would otherwise never say they never left.
  if (resume && (resume.kind === "walk" || rulesetLegacyWalk(resume))) {
    const walker = rulesetCombatant(ctx.state, resume.actorId);
    if (walker) walkOn(ctx, walker, { ...resume, kind: "walk" } as RulesetWalkResume);
    return;
  }
  if (resume?.kind === "action") {
    if (over) return;
    // A use nobody stopped is aimed next: the ones it is aimed at get their own say before it lands.
    if (trigger.kind === "used" && !resume.cancelled && openAimed(ctx, resume, trigger.label, trigger.catalog)) return;
    resumeAction(ctx, resume);
    return;
  }
  if (!over && trigger.kind === "between-turns") beginNextTurn(definition, combat, ctx);
}

function applySignature(
  definition: RulesetDefinition,
  combat: RulesetCombat,
  state: RulesetEncounterState,
  actor: RulesetCombatant,
  action: RulesetCombatAction,
  choice: RulesetCombatChoice,
  roller: RulesetCombatRoller,
): RulesetCombatStep {
  const cost = action.signature?.cost ?? 0;
  const points = actor.signature?.points;
  if (currentRulesetActor(state)?.id === actor.id) {
    return refusal(state, choice.actorId, "not-your-turn", action.id);
  }
  if (!rulesetCombatStanding(actor)) return refusal(state, choice.actorId, "down", action.id);
  if (rulesetCombatEffects(definition, combat, actor, state).has("cannot-act")) {
    return refusal(state, choice.actorId, "cannot-act", action.id);
  }
  // Nothing is paid for a sequence whose parts are all spent: it would buy nothing.
  if (
    points === undefined ||
    points < cost ||
    !rulesetActionAvailable(actor, action) ||
    !rulesetSequenceCanHappen(actor, action)
  ) {
    return refusal(state, choice.actorId, "insufficient", action.id);
  }
  const targets = pickTargets(definition, state, actor, action, choice.targetIds);
  if (!Array.isArray(targets)) return refusal(state, choice.actorId, targets, action.id);

  const { ctx, finish } = begin(definition, combat, state, roller);
  const working = rulesetCombatant(ctx.state, actor.id)!;
  const workingTargets = targets.map((target) => rulesetCombatant(ctx.state, target.id)!);
  const left = Math.max(0, (working.signature?.points ?? 0) - cost);
  if (working.signature) working.signature.points = left;
  ctx.events.push({ type: "signature", actorId: working.id, optionId: action.id, label: action.label, cost, left });
  const workingAction = working.actions.find((entry) => entry.id === action.id)!;
  spendAvailability(ctx, working, workingAction);
  resolveAction(ctx, working, workingAction, workingTargets);
  goOn(definition, combat, ctx);
  noteOutcome(ctx);
  return finish();
}

// ── The board ──

/** Whether this option lands as a shape on the ground rather than on combatants named by id. */
function positionedArea(state: RulesetEncounterState, actor: RulesetCombatant, option: RulesetCombatOption): boolean {
  return !!state.board?.grid && !!actor.actions.find((entry) => entry.id === option.id)?.area;
}

/** The cells the shape covered, read off the same menu rule that offered it. */
function areaCellsFor(
  state: RulesetEncounterState,
  actor: RulesetCombatant,
  optionId: string,
  at: RulesetCombatCell,
): RulesetCombatCell[] {
  const action = actor.actions.find((entry) => entry.id === optionId);
  const grid = state.board?.grid;
  if (!action?.area || !grid || typeof actor.x !== "number" || typeof actor.y !== "number") return [];
  return rulesetAreaCells(action.area.shape, action.area.size, { x: actor.x, y: actor.y }, at, grid);
}

/** The cell the menu offered, or null when the choice named one it did not. The menu is the only
 *  thing that decides where a move may go, exactly as it is for everything else. */
function destinationOf(option: RulesetCombatOption, to: RulesetCombatCell | undefined) {
  if (!to) return null;
  return option.cells?.find((cell) => cell.x === to.x && cell.y === to.y) ?? null;
}

/**
 * Getting back up: half the allowance, and the condition that held them down is gone.
 *
 * It clears the condition on the sheet as well as in the fight, because a party member's conditions
 * are the sheet's own and lying down is one of them.
 */
function resolveStand(ctx: RulesetCombatContext, actor: RulesetCombatant, option: RulesetCombatOption): void {
  const cost = option.movementCost ?? rulesetStandCost(actor);
  actor.movementLeft = Math.max(0, (actor.movementLeft ?? 0) - cost);
  const condition = rulesetProneCondition(ctx.definition, ctx.combat, actor);
  if (condition) removeCondition(ctx, actor, condition, "expired");
  // Movement spent and nowhere gone: the condition lifting is its own event, and this is the price
  // of it, said in the same words every other spent cell is said in.
  const at = { x: actor.x!, y: actor.y! };
  ctx.events.push({
    type: "move",
    actorId: actor.id,
    from: at,
    to: { ...at },
    path: [],
    cost,
    left: actor.movementLeft,
  });
}

/**
 * One walk, cell by cell.
 *
 * A standing enemy whose reach the mover leaves strikes BEFORE they go, with its best melee attack
 * and out of the budget the ruleset says such a strike costs. A strike that drops the mover ends
 * the walk where they fell, which is why the path is walked rather than jumped.
 *
 * The strikes are their own events and the walk's own event comes last, carrying the cells that
 * were really crossed rather than the ones that were meant to be.
 */
function resolveMove(ctx: RulesetCombatContext, actor: RulesetCombatant, destination: { path: RulesetCombatCell[] }) {
  walkOn(ctx, actor, {
    kind: "walk",
    actorId: actor.id,
    from: { x: actor.x!, y: actor.y! },
    walked: [],
    path: [...destination.path],
    asked: [],
    spent: 0,
  });
}

/**
 * A walk, from wherever it left off. Every step is checked for whose reach it leaves, and the first
 * step that leaves somebody's HOLDS THE WALK OPEN: the fight stops where it stands, the window
 * names everybody that step provoked, and the rest of the path waits in the window until they have
 * all answered. `walkOn` is then called again with what the window kept.
 *
 * One chance each for the whole walk, struck or passed, however many times the path leaves the same
 * reach: that is what the menu promised when it listed whom this walk provokes, and a budget of two
 * is two walks, not two strikes at one passer-by.
 *
 * The walk's own event comes last and carries the cells that were really crossed rather than the
 * ones that were meant to be, so a walk cut short by a blow says where it really ended.
 */
function walkOn(ctx: RulesetCombatContext, actor: RulesetCombatant, resume: RulesetWalkResume): void {
  const opportunity = ctx.combat.opportunity;
  const grid = ctx.state.board?.grid;
  const walked = [...resume.walked];
  const asked = new Set(resume.asked);
  let spent = resume.spent;
  let stopped = false;
  let at = walked.length > 0 ? walked[walked.length - 1]! : resume.from;
  const rest = [...resume.path];
  while (rest.length > 0) {
    if (!rulesetCombatStanding(actor)) {
      stopped = true;
      break;
    }
    const cell = rest[0]!;
    // Nobody is asked once the fight is over: the walk simply finishes on the cells it has left.
    if (opportunity && !actor.flags.disengaged && rulesetEncounterOutcome(ctx.state) === "ongoing") {
      const threats = threatsLeaving(ctx, actor, at, cell).filter((enemy) => !asked.has(enemy.id));
      if (threats.length > 0) {
        for (const enemy of threats) asked.add(enemy.id);
        openWindow(ctx, {
          kind: "reaction",
          trigger: { kind: "leaves-reach", moverId: actor.id, from: { ...at }, to: { ...cell } },
          waiting: threats.map((enemy) => enemy.id),
          resume: {
            kind: "walk",
            actorId: actor.id,
            from: resume.from,
            walked,
            path: rest,
            asked: [...asked],
            spent,
          },
        });
        return;
      }
    }
    rest.shift();
    spent += grid ? rulesetCellEnterCost(grid, cell.x, cell.y) : 1;
    walked.push(cell);
    at = cell;
    actor.x = cell.x;
    actor.y = cell.y;
  }
  if (!stopped && !rulesetCombatStanding(actor)) stopped = true;
  actor.movementLeft = Math.max(0, (actor.movementLeft ?? 0) - spent);
  ctx.events.push({
    type: "move",
    actorId: actor.id,
    from: resume.from,
    to: { ...at },
    path: walked,
    cost: spent,
    left: actor.movementLeft,
    ...(stopped ? { stopped: true } : {}),
  });
}

/**
 * The window a moment opens, for everybody who holds something that waits for exactly it.
 *
 * Nobody is asked when nobody could take anything: a window opened for a menu with only a pass on
 * it would hold the fight up to say nothing. Nor does one open INSIDE another, because the fight
 * keeps one window rather than a stack, so a reaction cannot itself be reacted to.
 *
 * ponytail: one window at a time, no nesting. The upgrade path is the bounded stack the combat
 * handoff describes, which needs a parent id on every window and a revalidation pass after each
 * answer; a chain of counters is what it buys, and nothing else here wants it yet.
 */
function openMoment(
  ctx: RulesetCombatContext,
  trigger: Extract<RulesetWindowTrigger, { kind: "aimed" | "harmed" | "used" }>,
  candidates: readonly RulesetCombatant[],
  resume?: RulesetActionResume,
): boolean {
  if (ctx.state.window) return false;
  const moment = rulesetWindowMoment(trigger);
  if (!moment) return false;
  // Being aimed at is about what somebody MEANS to do to you, and a friend healing you or handing
  // you something is not a threat to answer: only the other side opens that moment, and the same
  // for somebody using something at all. Being hurt is a fact about you whoever did it, so it opens
  // for anybody, and a reaction pointed back at the source is still kept off a friend by the same
  // legality every other target goes through.
  const source = rulesetCombatant(ctx.state, trigger.sourceId);
  const waiting = candidates
    .filter((one) => one.id !== trigger.sourceId)
    .filter((one) => moment === "harmed" || !source || one.side !== source.side)
    .filter(
      (one) =>
        rulesetReactionsAt(ctx.definition, ctx.combat, ctx.state, one, moment, trigger.sourceId, trigger.catalog)
          .length > 0,
    )
    .map((one) => one.id);
  if (waiting.length === 0) return false;
  openWindow(ctx, { kind: "reaction", trigger, waiting, ...(resume ? { resume } : {}) });
  return true;
}

/** What a window was holding, once everybody in it has answered. It resolves from the state as it
 *  stands NOW rather than as it stood then: an answer may have taken a target out, and the fight
 *  that resumes is the fight the window left behind. */
/** The moment for the ones something held is aimed at, holding it once more. False when nobody there
 *  has anything to answer it with, and then it simply goes ahead. */
function openAimed(
  ctx: RulesetCombatContext,
  resume: RulesetActionResume,
  label: string,
  catalog: string | undefined,
): boolean {
  const actor = rulesetCombatant(ctx.state, resume.actorId);
  if (!actor || !rulesetCombatStanding(actor)) return false;
  const targets = resume.targetIds
    .map((id) => rulesetCombatant(ctx.state, id))
    .filter((target): target is RulesetCombatant => !!target && !target.defeated);
  return openMoment(
    ctx,
    { kind: "aimed", sourceId: actor.id, optionId: resume.optionId, label, ...(catalog ? { catalog } : {}) },
    targets,
    resume,
  );
}

function resumeAction(ctx: RulesetCombatContext, resume: RulesetActionResume): void {
  const actor = rulesetCombatant(ctx.state, resume.actorId);
  const action = actor?.actions.find((entry) => entry.id === resume.optionId);
  if (!actor || !action) return;
  if (resume.cancelled) return;
  if (!rulesetCombatStanding(actor)) return;
  // What resumes lands on the fight as it stands NOW rather than as it stood when it was aimed, so
  // anybody the fight is already over for is left out, the same way a sequence leaves them out. A
  // ruleset with a dying rule keeps a character on the board at zero, so this is about an opponent
  // taken out by an answer: a creature's own reaction can do that now.
  const targets = resume.targetIds
    .map((id) => rulesetCombatant(ctx.state, id))
    .filter((target): target is RulesetCombatant => !!target && !target.defeated);
  harmedBy(ctx, actor, action, resume, () =>
    resolveAction(ctx, actor, action, targets, resume.payWith, resume.held, resume.style, resume.spend),
  );
}

/** An action, and then the window for everybody it hurt who has something that answers being hurt.
 *  Read off the damage the action itself wrote, so nothing inside the resolver has to know that a
 *  window exists.
 *
 *  An attack may come back HELD instead: one of its rolls hit somebody who holds an answer for being
 *  hit. Then the window for that opens instead, holding the action exactly where it stopped along
 *  with whoever it had already hurt, and being hurt is asked about once it has finished. */
function harmedBy(
  ctx: RulesetCombatContext,
  actor: RulesetCombatant,
  action: RulesetCombatAction,
  resume: RulesetActionResume,
  resolve: () => RulesetHitHold | null,
): void {
  const before = ctx.events.length;
  const hold = resolve();
  const hurt = new Set([
    ...(resume.held?.hurt ?? []),
    ...ctx.events
      .slice(before)
      .filter((event) => event.type === "damage" && event.dealt > 0)
      .map((event) => (event as Extract<RulesetCombatEvent, { type: "damage" }>).targetId),
  ]);
  if (hold) {
    const { label, optionId, catalog, ...held } = hold;
    const { held: _previous, ...base } = resume;
    openWindow(ctx, {
      kind: "reaction",
      trigger: {
        kind: "hit",
        sourceId: actor.id,
        optionId,
        label,
        ...(catalog ? { catalog } : {}),
        total: held.roll.total,
        defense: held.roll.defense,
      },
      waiting: [held.targetId],
      resume: { ...base, held: { ...held, hurt: [...hurt] } },
    });
    return;
  }
  if (rulesetEncounterOutcome(ctx.state) !== "ongoing") return;
  if (hurt.size === 0) return;
  openMoment(
    ctx,
    { kind: "harmed", sourceId: actor.id, label: action.label, ...(action.catalog ? { catalog: action.catalog } : {}) },
    [...hurt].map((id) => rulesetCombatant(ctx.state, id)).filter((one): one is RulesetCombatant => !!one),
  );
}

/** A walk held open by an Engine from before a resume said what kind it was. The walk was the only
 *  thing a window could hold then, so a resume with no kind is one, and a fight saved in the middle
 *  of one is finished rather than left standing on the step it was asked about. */
function rulesetLegacyWalk(resume: RulesetWindowResume): boolean {
  return (resume as { kind?: unknown }).kind === undefined;
}

/** Hold the fight open. The id is one up from every window this fight has opened, so an answer
 *  written for a window that has already closed is refused rather than spent on its successor. */
function openWindow(ctx: RulesetCombatContext, window: Omit<RulesetCombatWindow, "id">): void {
  const serial = (ctx.state.windows ?? 0) + 1;
  ctx.state.windows = serial;
  // In the fight's OWN order, whatever order they were gathered in. Who is asked first decides who
  // answers with the most still on the board, so it is the fight's order rather than the order a
  // walk met them in or the order their damage happened to be written.
  const order = (id: string) => {
    const at = ctx.state.order.indexOf(id);
    return at < 0 ? ctx.state.order.length : at;
  };
  const waiting = [...window.waiting].sort((left, right) => order(left) - order(right));
  ctx.state.window = { id: `w${serial}`, ...window, waiting };
  const moment = rulesetWindowMoment(window.trigger);
  ctx.events.push({
    type: "window",
    window: ctx.state.window.id,
    kind: window.kind,
    // The order the window really holds, not the order it was handed: the two would otherwise
    // disagree about who is asked first, and the log is what a reader believes.
    waiting: [...waiting],
    ...(window.trigger.kind === "leaves-reach" ? { moverId: window.trigger.moverId } : {}),
    ...(moment ? { moment } : {}),
    ...("label" in window.trigger ? { label: window.trigger.label } : {}),
    ...("sourceId" in window.trigger ? { sourceId: window.trigger.sourceId } : {}),
    ...(window.trigger.kind === "hit" ? { total: window.trigger.total, defense: window.trigger.defense } : {}),
  });
}

/** Everybody whose reach this one step leaves, in the order the fight holds them. Re-read at every
 *  step, because a strike on the way may have spent somebody's budget or taken them out. */
function threatsLeaving(
  ctx: RulesetCombatContext,
  mover: RulesetCombatant,
  from: RulesetCombatCell,
  to: RulesetCombatCell,
): RulesetCombatant[] {
  // The same two questions the menu asked when it listed whom a walk provokes, asked again at every
  // step because a strike on the way can change who is still standing and who still has the budget.
  return rulesetThreateningEnemies(ctx.definition, ctx.combat, ctx.state, mover)
    .filter((threat) => rulesetStepLeavesReach(threat, from, to))
    .map((threat) => threat.combatant);
}

/** One strike at somebody walking away. It spends the declared budget and then resolves exactly as
 *  the same attack would on the striker's own turn, dice and all. */
function opportunityStrike(
  ctx: RulesetCombatContext,
  striker: RulesetCombatant,
  mover: RulesetCombatant,
  budget: string,
): void {
  const strike = rulesetOpportunityAttack(striker);
  if (!strike) return;
  striker.budgets[budget] = Math.max(0, (striker.budgets[budget] ?? 0) - 1);
  ctx.events.push({ type: "opportunity", actorId: striker.id, targetId: mover.id, label: strike.label, budget });
  ctx.events.push({ type: "budget", actorId: striker.id, budget, left: striker.budgets[budget]! });
  // A strike made in passing keeps the same books as one made on a turn: a use is a use.
  spendAvailability(ctx, striker, strike);
  resolveAction(ctx, striker, strike, [mover]);
}

function resolveStandard(
  ctx: RulesetCombatContext,
  actor: RulesetCombatant,
  action: string,
  target: RulesetCombatant | undefined,
): void {
  // Hide and Ready are accepted and do nothing yet: one needs sight lines and the other a trigger
  // window, and both arrive with the slices that build them.
  if (action === "dodge") actor.flags.dodging = true;
  else if (action === "dash") {
    actor.flags.dashed = true;
    // The same allowance again, in a fight that has cells to spend it on.
    if (actor.movement !== undefined) {
      actor.movementLeft =
        (actor.movementLeft ?? 0) + rulesetMovementAllowance(ctx.definition, ctx.combat, actor, ctx.state);
    }
  } else if (action === "disengage") actor.flags.disengaged = true;
  else if (action === "hide") actor.flags.hidden = true;
  else if (action === "ready") actor.flags.ready = true;
  else if (action === "help" && target) target.flags.helped = true;
  ctx.events.push({
    type: "standard",
    actorId: actor.id,
    action,
    ...(action === "help" && target ? { targetId: target.id } : {}),
  });
}

/**
 * A sequence: the other actions it names, in order, for the one budget that was already spent.
 *
 * Targets are handed out in order when there are enough for every part, and otherwise every part
 * takes the ones at the front of the list, so a single id sends the whole sequence at one opponent.
 * A part whose target is already down by the time it comes round simply does not land: nothing here
 * picks a new one, because choosing is the caller's job.
 */
function resolveSequence(
  ctx: RulesetCombatContext,
  actor: RulesetCombatant,
  action: RulesetCombatAction,
  targets: RulesetCombatant[],
  held?: RulesetHeldAttack,
  /** The initiative style the whole sequence is made in: every part in it. */
  styleId?: string,
): RulesetHitHold | null {
  const byId = new Map(actor.actions.map((entry) => [entry.id, entry]));
  const parts: RulesetCombatAction[] = [];
  for (const step of action.sequence ?? []) {
    const named = byId.get(step.actionId);
    // A part that names another sequence is refused at import, so this is a hand-written block
    // pointing at nothing, and it costs that part rather than the turn.
    if (!named || named.sequence) continue;
    for (let time = 0; time < step.times; time++) parts.push(named);
  }
  const wanted = parts.reduce((total, part) => total + part.targets.count, 0);
  const enough = targets.length >= wanted;
  let cursor = 0;
  for (const [index, part] of parts.entries()) {
    const count = part.targets.count;
    const chosen = (enough ? targets.slice(cursor, cursor + count) : targets.slice(0, count)).filter(
      (target) => !target.defeated,
    );
    cursor += count;
    // A sequence picked up after one of its parts was held starts at that part, which was paid for
    // and has its roll already: every part before it has happened.
    if (held && index < (held.part ?? 0)) continue;
    const resuming = held && index === (held.part ?? 0) ? held : undefined;
    if (!resuming) {
      // One budget for the whole sequence, and each part still keeps its own books: a part that
      // counts its uses spends one, a part that recharges is spent until its dice bring it back, and
      // a part that has none left simply does not happen.
      if (chosen.length === 0 || !rulesetSequencePartAvailable(actor, part)) continue;
      spendAvailability(ctx, actor, part);
    }
    const hold = resolveAction(ctx, actor, part, chosen, undefined, resuming, styleId);
    if (hold) return { ...hold, part: index };
  }
  return null;
}

/**
 * Budgets handed to somebody the moment they use the thing that hands them over.
 *
 * Capped where they land, at what a turn holds plus the gift, so a budget saved up over three turns
 * and then spent all at once is not a thing this can be used to do.
 */
function grantBudgets(ctx: RulesetCombatContext, actor: RulesetCombatant, action: RulesetCombatAction): void {
  for (const gift of action.gives ?? []) {
    const declared = ctx.combat.economy.budgets.find((budget) => budget.id === gift.budget);
    // A budget the economy no longer declares is a catalog read by a later ruleset: it hands over
    // nothing rather than inventing a budget nothing else in the fight knows about.
    if (!declared) continue;
    const left = Math.min((actor.budgets[gift.budget] ?? 0) + gift.count, declared.count + gift.count);
    actor.budgets[gift.budget] = left;
    ctx.events.push({
      type: "gives",
      actorId: actor.id,
      optionId: action.id,
      label: action.label,
      budget: gift.budget,
      left,
    });
  }
}

/** Whether an ally of this one could help with a blow at that target: standing, able to act, and,
 *  on a board, within one cell of the target. Without a board there is no distance to read, so any
 *  ally still on their feet is beside them as far as the fight is concerned. */
function allyAdjacent(ctx: RulesetCombatContext, actor: RulesetCombatant, target: RulesetCombatant): boolean {
  const at = rulesetPositionOf(target);
  const positioned = !!ctx.state.board?.grid && !!at;
  return ctx.state.combatants.some((combatant) => {
    if (combatant.id === actor.id || combatant.side !== actor.side) return false;
    if (!rulesetCombatStanding(combatant)) return false;
    if (rulesetCombatEffects(ctx.definition, ctx.combat, combatant, ctx.state).has("cannot-act")) return false;
    if (!positioned) return true;
    const cell = rulesetPositionOf(combatant);
    return !!cell && rulesetCellDistance(cell, at!) <= 1;
  });
}

/**
 * The rider that adds itself to this blow, or null.
 *
 * The FIRST qualifying hit of the period takes it: a rider fires once, automatically, and choosing
 * when to spend it is a window, which is a later slice. Marked as fired here, because the blow it
 * joins is the one it fired on.
 */
function firingRider(
  ctx: RulesetCombatContext,
  actor: RulesetCombatant,
  action: RulesetCombatAction,
  target: RulesetCombatant,
  mode: RulesetCombatRollMode,
): RulesetCombatRider | null {
  const spent = actor.ridersSpent ?? [];
  for (const rider of actor.riders ?? []) {
    if (rider.on !== "hit" || spent.includes(rider.id)) continue;
    if (rider.actions && !rider.actions.includes(action.id)) continue;
    // Any-of: one of the things it asked for being true is enough.
    if (
      rider.when?.length &&
      !rider.when.some((when) => (when === "advantage" ? mode === "advantage" : allyAdjacent(ctx, actor, target)))
    ) {
      continue;
    }
    actor.ridersSpent = [...spent, rider.id];
    return rider;
  }
  return null;
}

function resolveAction(
  ctx: RulesetCombatContext,
  actor: RulesetCombatant,
  action: RulesetCombatAction,
  targets: RulesetCombatant[],
  payWith?: string,
  /** Picking up an attack held after one of its rolls hit: that roll, then the targets after it. */
  held?: RulesetHeldAttack,
  /** The initiative style it was chosen in. An attack made out of a turn, in a window, is made in the
   *  first style its maker may use. */
  styleId?: string,
  /** The number a spending blow throws, read as it was made. */
  spend?: number,
): RulesetHitHold | null {
  if (action.sequence) {
    return resolveSequence(
      ctx,
      actor,
      action,
      targets,
      held,
      styleId ?? rulesetAttackStyles(ctx.combat, actor, action)[0]?.id,
    );
  }
  const style = attackStyle(ctx, actor, action, styleId);
  if (held) {
    // Everything before the held roll has happened, what the use gives its user included.
    targets = [held.targetId, ...held.rest]
      .map((id) => rulesetCombatant(ctx.state, id))
      .filter((target): target is RulesetCombatant => !!target && !target.defeated);
    // The one it hit is gone before the blow could land: what the roll used is spent all the same.
    if (targets[0]?.id !== held.targetId) {
      spendOneUse(
        ctx,
        actor,
        actor.tracked.filter((entry) => entry.endsAfter === "own-attack" && held.mine.includes(entry.condition)),
      );
    }
  } else {
    if (action.gives) grantBudgets(ctx, actor, action);
    if (action.concentration) startConcentration(ctx, actor, action);
  }
  const steps = payWith ? rulesetCostSteps(ctx.definition, action, payWith) : 0;
  const extra = action.use?.perCostStep && steps > 0 ? { amount: action.use.perCostStep, times: steps } : undefined;

  // An ability that asks for no attack roll (an area everyone saves against, darts that simply hit)
  // rolls its dice ONCE and every target takes that number. One that rolls to hit each target rolls
  // its dice again for each hit, because each of those is its own attack. Either way nothing is
  // rolled until a target actually needs it, so a use that misses everything costs no dice at all.
  type Rolled = { rolls: number[]; flat: number; total: number };
  const perTarget = action.toHit !== undefined && !action.autoHit;
  const once = (amount: RulesetCombatAmount | undefined) => {
    let rolled: Rolled | null = null;
    if (!amount) return null;
    return perTarget ? () => rollAmount(ctx, amount, extra) : () => (rolled ??= rollAmount(ctx, amount, extra));
  };
  const damage = once(action.damage);
  // One roller per clause, read the same way: an ability that lands on several targets without
  // rolling to hit rolls every clause once and everybody takes those numbers.
  const clauses = (action.damage?.plus ?? []).map((clause) => once(clause)!);
  const heal = once(action.heal);
  const temporary = once(action.temporary);

  const pooled = rulesetCombatIsPool(ctx.combat);
  // A spending attack throws the number its maker has as the blow lands, and whether anything landed
  // decides, once every target has been tried, whether the number resets or a miss costs some of it.
  const spends = style?.spends ? { number: spend ?? actor.initiative, landed: false } : null;
  for (const target of targets) {
    let landed = true;
    let critical = false;
    // Under `dice-pool`, the successes a hit had past the ones it needed: each is one more damage die.
    let extraDice = 0;
    // What lasted one attack, on either side of it: noted when the roll is made and spent once this
    // blow is over, landed or not, so it counts for the blow's damage as well as its roll.
    let used: { mine: RulesetTrackedCondition[]; theirs: RulesetTrackedCondition[] } | null = null;
    const spendUsed = () => {
      if (!used) return;
      spendOneUse(ctx, actor, used.mine);
      spendOneUse(ctx, target, used.theirs);
    };
    // How the roll finally leaned, which is one of the things a rider may ask about. An action
    // nobody rolls for leaned no way at all.
    let mode: RulesetCombatRollMode = "normal";
    if (held && target.id === held.targetId) {
      // The roll was made before the one it hit was asked. It is not made again: it is checked
      // against their defense as it stands now, which is what an answer at this moment changes. A
      // natural face decided it whatever the defense.
      const roll = held.roll;
      const guarded = rulesetDefenseAgainst(ctx.definition, ctx.combat, ctx.state, target);
      const landsAt = roll.critical ? "critical" : "hit";
      // A pool's successes meet what the defense now asks, never fewer than one.
      const needed = pooled ? Math.max(1, guarded.defense) : guarded.defense;
      const outcome = roll.natural || roll.total >= needed ? landsAt : "miss";
      if (pooled && outcome !== "miss") extraDice = roll.total - needed;
      if (needed !== roll.defense) {
        ctx.events.push({
          type: "recheck",
          actorId: actor.id,
          targetId: target.id,
          optionId: action.id,
          label: action.label,
          total: roll.total,
          defense: needed,
          ...(guarded.guards.length > 0 ? { guards: guarded.guards } : {}),
          outcome,
        });
      }
      mode = roll.mode;
      // The attacker's are the ones the roll used; the target's are read now, so one they put on as
      // their answer counts for this attack and is spent by it.
      used = {
        mine: actor.tracked.filter((entry) => entry.endsAfter === "own-attack" && held.mine.includes(entry.condition)),
        theirs: oneUseConditions(target, "attacked"),
      };
      landed = outcome !== "miss";
      critical = outcome === "critical";
    } else if (action.toHit !== undefined && !action.autoHit) {
      mode = rulesetAttackMode(ctx.definition, ctx.combat, actor, target, {
        state: ctx.state,
        optionId: action.id,
      });
      // What the ground the target stands on is worth, said out loud before the roll it changed.
      const guarded = rulesetDefenseAgainst(ctx.definition, ctx.combat, ctx.state, target);
      if (guarded.cover > 0) {
        ctx.events.push({ type: "cover", targetId: target.id, bonus: guarded.cover, defense: guarded.defense });
      }
      if (pooled) {
        // The to-hit number is the pool, what the attacker's conditions add is dice, and the
        // defense is the successes it needs, never fewer than one. A botch misses whatever it
        // counted, and there are no criticals: what a strong hit is worth is its extra successes.
        const bonuses = rollBonuses(
          ctx,
          rulesetConditionModifiers(ctx.definition, ctx.combat, actor, "attacks", ctx.state),
        );
        const thrown = throwPool(ctx, actor, action.toHit + bonusTotal(bonuses), mode);
        const needed = Math.max(1, guarded.defense);
        const outcome = !thrown.botch && thrown.successes >= needed ? "hit" : "miss";
        ctx.events.push({
          type: "attack",
          actorId: actor.id,
          targetId: target.id,
          optionId: action.id,
          label: action.label,
          mode,
          rolls: thrown.rolls,
          kept: thrown.successes,
          modifier: action.toHit,
          ...(bonuses.length > 0 ? { bonuses } : {}),
          total: thrown.successes,
          defense: needed,
          ...(guarded.guards.length > 0 ? { guards: guarded.guards } : {}),
          outcome,
          pool: poolRecord(thrown),
          ...(style ? { style: style.id } : {}),
        });
        actor.flags.helped = false;
        used = { mine: oneUseConditions(actor, "own-attack"), theirs: oneUseConditions(target, "attacked") };
        landed = outcome === "hit";
        if (landed) extraDice = thrown.successes - needed;
        if (
          landed &&
          !ctx.state.window &&
          rulesetEncounterOutcome(ctx.state) === "ongoing" &&
          rulesetReactionsAt(ctx.definition, ctx.combat, ctx.state, target, "hit", actor.id, action.catalog).length > 0
        ) {
          return {
            targetId: target.id,
            rest: targets.slice(targets.indexOf(target) + 1).map((one) => one.id),
            roll: { mode, total: thrown.successes, defense: needed, critical: false, natural: false },
            mine: used.mine.map((entry) => entry.condition),
            hurt: [],
            label: action.label,
            optionId: action.id,
            ...(action.catalog ? { catalog: action.catalog } : {}),
          };
        }
      } else {
        const dice = ctx.combat.attackRoll!.dice;
        const first = rollRulesetDice(ctx.roll, dice.count, dice.sides);
        const second = mode === "normal" ? null : rollRulesetDice(ctx.roll, dice.count, dice.sides);
        const kept = second
          ? mode === "advantage"
            ? Math.max(sumOf(first), sumOf(second))
            : Math.min(sumOf(first), sumOf(second))
          : sumOf(first);
        const naturals = ctx.combat.attackRoll!.naturals;
        const single = dice.count === 1;
        // What the attacker's conditions add, rolled after the attack's own dice.
        const bonuses = rollBonuses(
          ctx,
          rulesetConditionModifiers(ctx.definition, ctx.combat, actor, "attacks", ctx.state),
        );
        const total = kept + action.toHit + bonusTotal(bonuses);
        let outcome: "hit" | "miss" | "critical" = total >= guarded.defense ? "hit" : "miss";
        if (single && kept === dice.sides && naturals.max !== "none") {
          outcome = naturals.max === "critical" ? "critical" : "hit";
        } else if (single && kept === 1 && naturals.min === "miss") outcome = "miss";
        // A condition that says a blow from the next cell always tells is read last, so a hit that
        // landed becomes the critical the ruleset promised.
        if (outcome === "hit" && rulesetCriticalFromAdjacent(ctx.definition, ctx.combat, ctx.state, actor, target)) {
          outcome = "critical";
        }
        ctx.events.push({
          type: "attack",
          actorId: actor.id,
          targetId: target.id,
          optionId: action.id,
          label: action.label,
          mode,
          rolls: second ? [...first, ...second] : first,
          kept,
          modifier: action.toHit,
          ...(bonuses.length > 0 ? { bonuses } : {}),
          total,
          defense: guarded.defense,
          ...(guarded.guards.length > 0 ? { guards: guarded.guards } : {}),
          outcome,
        });
        // Help is spent by the attack it was given for, landed or not.
        actor.flags.helped = false;
        used = { mine: oneUseConditions(actor, "own-attack"), theirs: oneUseConditions(target, "attacked") };
        landed = outcome !== "miss";
        critical = outcome === "critical";
        // A hit on somebody who holds an answer for being hit stops here, before its damage: the
        // window asks them, and the attack picks up from this roll once they have answered. Nothing
        // opened inside a window opens another, so an attack made inside one is never held.
        if (
          landed &&
          !ctx.state.window &&
          rulesetEncounterOutcome(ctx.state) === "ongoing" &&
          rulesetReactionsAt(ctx.definition, ctx.combat, ctx.state, target, "hit", actor.id, action.catalog).length > 0
        ) {
          return {
            targetId: target.id,
            rest: targets.slice(targets.indexOf(target) + 1).map((one) => one.id),
            roll: {
              mode,
              total,
              defense: guarded.defense,
              critical,
              natural: single && kept === dice.sides && naturals.max !== "none",
            },
            mine: used.mine.map((entry) => entry.condition),
            hurt: [],
            label: action.label,
            optionId: action.id,
            ...(action.catalog ? { catalog: action.catalog } : {}),
          };
        }
      }
    }
    if (!landed) {
      spendUsed();
      continue;
    }

    let saved = false;
    if (action.save) {
      saved = rollSave(ctx, target, action.save.save, action.save.difficulty, actor.id);
      if (saved && action.save.onSuccess === "negates") {
        spendUsed();
        continue;
      }
    }
    const halved = saved && action.save?.onSuccess === "half";

    // Everything this blow is made of: the first amount, and every clause beside it. Rolled and
    // typed one at a time, taken off one at a time, and finished ONCE at the end: the health the
    // target had before the FIRST of them is what decides whether the blow put them down.
    let before: { value: number } | null = null;
    let dealt = 0;
    const health = ctx.combat.health;
    // A blow marks once at its end where the track counts blows, and where it fills by box, since
    // a hit's box is named by the whole blow rather than by each clause of it.
    const declaredTrack =
      target.sheet && "track" in health
        ? ctx.definition.sheet.live.tracks.find((track) => track.id === health.track)
        : undefined;
    const woundTrack =
      declaredTrack && (ctx.combat.damageKinds?.marks === "per-blow" || declaredTrack.fill === "indexed")
        ? declaredTrack
        : undefined;
    let woundKind: { id: string; severity: number } | undefined;
    const blowEventStart = ctx.events.length;
    // A blow made in a style that takes lands on the target's number instead of their health: each
    // part of it takes its successes off, and the whole blow is settled once every part has landed.
    const takes = style?.takes ? { from: target.initiative, taken: 0 } : null;
    const land = (part: RulesetDamageInput) => {
      if (takes) {
        const amount = Math.max(0, Math.floor(part.amount));
        takes.taken += amount;
        shiftInitiative(ctx, target, -amount, "taken", {
          sourceId: actor.id,
          ...(part.label ? { label: part.label } : {}),
          rolls: part.rolls,
          flat: part.flat,
          ...(part.pool ? { pool: part.pool } : {}),
        });
        return;
      }
      before ??= healthOf(ctx, target);
      const partDealt = applyDamage(ctx, target, part, !!woundTrack);
      dealt += partDealt;
      // A compound hit marks once, using the most severe kind that actually landed.
      if (woundTrack && partDealt > 0) {
        const kind = woundTrack.kinds?.find(
          (entry) => entry.id === rulesetCombatDamageKind(ctx.combat, part.damageType),
        );
        if (kind && (!woundKind || kind.severity > woundKind.severity)) woundKind = kind;
      }
    };
    if (pooled && action.damage && spends) {
      // The maker's own number, thrown as damage dice: nothing the weapon adds, nothing the hit had
      // past its needed successes, and no soak.
      spends.landed = true;
      const thrown = throwHarm(
        ctx,
        target,
        { count: Math.max(0, spends.number), sides: 0, flat: 0 },
        action.damage.type,
        0,
        undefined,
        false,
      );
      land({
        sourceId: actor.id,
        label: action.label,
        ...(action.damage.type ? { damageType: action.damage.type } : {}),
        rolls: thrown.rolls,
        flat: 0,
        amount: halved ? Math.floor(thrown.total / 2) : thrown.total,
        ...(halved ? { saved: true } : {}),
        pool: thrown.pool,
      });
    } else if (pooled && action.damage) {
      // Every target's damage is thrown for them, because what the hit added past its needed
      // successes and what they soak are theirs. The first amount carries the extra dice; each
      // clause and a rider is its own pool of its own kind.
      const first = throwHarm(ctx, target, action.damage, action.damage.type, extraDice, extra);
      land({
        sourceId: actor.id,
        label: action.label,
        ...(action.damage.type ? { damageType: action.damage.type } : {}),
        rolls: first.rolls,
        flat: first.flat,
        amount: halved ? Math.floor(first.total / 2) : first.total,
        ...(halved ? { saved: true } : {}),
        pool: first.pool,
      });
      (action.damage.plus ?? []).forEach((clause) => {
        const own = clause.save ? rollSave(ctx, target, clause.save.save, clause.save.difficulty, actor.id) : false;
        if (own && clause.save?.onSuccess === "none") return;
        const clauseHalved = clause.save ? own : halved;
        const type = clause.type ?? action.damage?.type;
        const thrown = throwHarm(ctx, target, clause, type, 0);
        land({
          sourceId: actor.id,
          label: action.label,
          ...(type ? { damageType: type } : {}),
          rolls: thrown.rolls,
          flat: thrown.flat,
          amount: clauseHalved ? Math.floor(thrown.total / 2) : thrown.total,
          ...(clauseHalved ? { saved: true } : {}),
          pool: thrown.pool,
        });
      });
    } else if (damage && action.damage) {
      const rolled = damage();
      const bonus = critical ? criticalExtra(ctx, action.damage, extra) : { rolls: [], flat: 0 };
      const total = rolled.total + sumOf(bonus.rolls) + bonus.flat;
      land({
        sourceId: actor.id,
        label: action.label,
        ...(action.damage.type ? { damageType: action.damage.type } : {}),
        rolls: [...rolled.rolls, ...bonus.rolls],
        flat: rolled.flat + bonus.flat,
        amount: halved ? Math.floor(total / 2) : total,
        ...(halved ? { saved: true } : {}),
        ...(critical ? { critical: true } : {}),
      });
      (action.damage.plus ?? []).forEach((clause, index) => {
        // A clause with a save of its own asks the TARGET for it, whatever the action already asked.
        const own = clause.save ? rollSave(ctx, target, clause.save.save, clause.save.difficulty, actor.id) : false;
        if (own && clause.save?.onSuccess === "none") return;
        // Halved by its own save when it has one, and by the action's save-for-half when it does not.
        const clauseHalved = clause.save ? own : halved;
        const rolledClause = clauses[index]!();
        const clauseBonus = critical ? criticalExtra(ctx, clause) : { rolls: [], flat: 0 };
        const clauseTotal = rolledClause.total + sumOf(clauseBonus.rolls) + clauseBonus.flat;
        land({
          sourceId: actor.id,
          label: action.label,
          // A clause with no type of its own is the blow's own kind of harm.
          ...((clause.type ?? action.damage?.type) ? { damageType: clause.type ?? action.damage?.type } : {}),
          rolls: [...rolledClause.rolls, ...clauseBonus.rolls],
          flat: rolledClause.flat + clauseBonus.flat,
          amount: clauseHalved ? Math.floor(clauseTotal / 2) : clauseTotal,
          ...(clauseHalved ? { saved: true } : {}),
          ...(critical ? { critical: true } : {}),
        });
      });
    }
    // And whatever adds itself to a hit without anybody choosing it: one more clause of this blow,
    // doubled by a critical exactly as the rest of it is. Only a blow that DEALS something can carry
    // one, because a rider is extra damage on a hit and an action with none never struck for any.
    const rider = action.damage && !spends ? firingRider(ctx, actor, action, target, mode) : null;
    if (rider) {
      ctx.events.push({ type: "rider", actorId: actor.id, targetId: target.id, riderId: rider.id, label: rider.label });
      const type = rider.type ?? action.damage?.type;
      const rolled: { rolls: number[]; flat: number; total: number; pool?: RulesetDamageInput["pool"] } = pooled
        ? throwHarm(ctx, target, rider.amount, type, 0)
        : rollAmount(ctx, rider.amount);
      const bonus = critical ? criticalExtra(ctx, rider.amount) : { rolls: [], flat: 0 };
      const total = rolled.total + sumOf(bonus.rolls) + bonus.flat;
      land({
        sourceId: actor.id,
        label: rider.label,
        ...((rider.type ?? action.damage?.type) ? { damageType: rider.type ?? action.damage?.type } : {}),
        rolls: [...rolled.rolls, ...bonus.rolls],
        flat: rolled.flat + bonus.flat,
        amount: halved ? Math.floor(total / 2) : total,
        ...(halved ? { saved: true } : {}),
        ...(critical ? { critical: true } : {}),
        ...(rolled.pool ? { pool: rolled.pool } : {}),
      });
    }
    if (woundKind && woundTrack && "track" in health) {
      const box = ctx.combat.damageKinds?.marks === "per-point" ? Math.max(1, Math.floor(dealt)) : 1;
      markWound(ctx, target, {
        op: "damage",
        track: health.track,
        kind: woundKind.id,
        amount: 1,
        ...(woundTrack.fill === "indexed" ? { box } : {}),
      });
      const remaining = healthOf(ctx, target).value;
      for (const event of ctx.events.slice(blowEventStart)) {
        if (event.type === "damage" && event.targetId === target.id) event.health = remaining;
      }
    }
    if (before) afterBlow(ctx, target, dealt, critical);
    // What a taking blow took goes to its maker, with what landing one is worth on top; and taking
    // somebody down to the line crashes them, which is worth the crash's own bonus.
    if (takes) {
      shiftInitiative(ctx, actor, takes.taken + (style?.takes?.gain ?? 0), "gained", { sourceId: target.id });
      const line = ctx.combat.initiative.resource?.crash;
      if (line && takes.from > line.at && target.initiative <= line.at) {
        settleCrash(ctx, target, actor.id);
        if (line.bonus > 0) shiftInitiative(ctx, actor, line.bonus, "crash", { sourceId: target.id });
      }
    }
    if (heal) {
      const rolled = heal();
      dealHeal(ctx, target, { sourceId: actor.id, rolls: rolled.rolls, flat: rolled.flat, amount: rolled.total });
    }
    if (temporary) {
      const rolled = temporary();
      grantTemporary(ctx, target, {
        sourceId: actor.id,
        rolls: rolled.rolls,
        flat: rolled.flat,
        amount: rolled.total,
      });
    }
    if (!saved) {
      for (const applies of action.applies ?? []) {
        applyConditionId(ctx, target, applies.condition, applies, {
          sourceId: actor.id,
          // The action's own save when it has one, otherwise what its source says saves are rolled
          // against. Never zero by default: that would let everybody shake a condition off.
          ...(action.save
            ? { difficulty: action.save.difficulty }
            : action.saveDifficulty !== undefined
              ? { difficulty: action.saveDifficulty }
              : {}),
          ...(action.concentration ? { concentration: true } : {}),
        });
      }
    }
    spendUsed();
  }
  // A spending blow that landed spends the whole number, back to the base; one that landed on nobody
  // costs what a miss costs at the number it was made with, which may crash its own maker.
  if (spends && action.toHit !== undefined) {
    const resource = ctx.combat.initiative.resource!;
    if (spends.landed) shiftInitiative(ctx, actor, resource.base - actor.initiative, "spent");
    else {
      const lose = stepValue(style?.spends?.onMiss, spends.number);
      if (lose > 0) shiftInitiative(ctx, actor, -lose, "missed");
    }
  }
  return null;
}

/** The style an attack is made in: the one it was chosen or held in, whatever has happened to its
 *  maker's number since, or, for one made out of a turn, the first its maker may use now. None for
 *  something that is not an attack. */
function attackStyle(
  ctx: RulesetCombatContext,
  actor: RulesetCombatant,
  action: RulesetCombatAction,
  styleId: string | undefined,
): RulesetInitiativeStyle | undefined {
  if (!rulesetActionTakesStyle(action)) return undefined;
  if (styleId === undefined) return rulesetAttackStyles(ctx.combat, actor, action)[0];
  return ctx.combat.initiative.resource?.styles.find((style) => style.id === styleId);
}

/** A number that attacks move, changed and said so. Crossing the crash line either way is settled
 *  here; the bonus for crashing somebody is the attacker's, and is settled where they did it. */
function shiftInitiative(
  ctx: RulesetCombatContext,
  combatant: RulesetCombatant,
  amount: number,
  reason: Extract<RulesetCombatEvent, { type: "shift" }>["reason"],
  extra: Partial<
    Omit<Extract<RulesetCombatEvent, { type: "shift" }>, "type" | "actorId" | "amount" | "total" | "reason">
  > = {},
): void {
  combatant.initiative += amount;
  ctx.events.push({ type: "shift", actorId: combatant.id, amount, total: combatant.initiative, reason, ...extra });
  if (reason !== "taken") settleCrash(ctx, combatant);
}

/** Whether a combatant is crashed, kept in step with their number: crossing to the line or below puts
 *  the ruleset's crash condition on them (from whoever did it, when somebody did), and rising above it
 *  takes it off. `crashedTurns` is what counts their turns towards recovering. */
function settleCrash(ctx: RulesetCombatContext, combatant: RulesetCombatant, sourceId?: string): void {
  const crash = ctx.combat.initiative.resource?.crash;
  if (!crash) return;
  const crashed = combatant.initiative <= crash.at;
  if (crashed && combatant.crashedTurns === undefined) {
    combatant.crashedTurns = 0;
    if (crash.condition) {
      applyConditionId(
        ctx,
        combatant,
        crash.condition,
        { condition: crash.condition, duration: "instant" },
        {
          ...(sourceId ? { sourceId } : {}),
        },
      );
    }
  } else if (!crashed && combatant.crashedTurns !== undefined) {
    delete combatant.crashedTurns;
    if (crash.condition && rulesetCombatConditions(ctx.definition, combatant).includes(crash.condition)) {
      removeCondition(ctx, combatant, crash.condition, "recovered");
    }
  }
}

/** What a step table says at a number: the value of the last step at or below it, and nothing below
 *  the first. */
function stepValue(table: ReadonlyArray<readonly [number, number]> | undefined, at: number): number {
  let value = 0;
  for (const [threshold, step] of table ?? []) if (at >= threshold) value = step;
  return value;
}

/** Where an attack stopped: the held attack's own record, and what its window says about it. */
type RulesetHitHold = RulesetHeldAttack & { label: string; optionId: string; catalog?: string };

// ── Between turns ──

/** The riders whose period has come round again. One that says "round" survives until the round
 *  turns over; one that says "turn" is fresh at the start of every turn there is. */
function clearSpentRiders(combatant: RulesetCombatant, freshRound: boolean): void {
  if (!combatant.ridersSpent?.length) return;
  const period = new Map((combatant.riders ?? []).map((rider) => [rider.id, rider.oncePer]));
  const kept = combatant.ridersSpent.filter((id) => !freshRound && period.get(id) === "round");
  if (kept.length > 0) combatant.ridersSpent = kept;
  else delete combatant.ridersSpent;
}

/** The points a signature action is bought with, back to full at the start of their own turn: they
 *  are what this combatant can spend before their next one comes round. */
function refreshRulesetSignature(actor: RulesetCombatant): void {
  if (actor.signature) actor.signature.points = actor.signature.max;
}

/** The roll an action that recharges makes at the start of its owner's turn. `from` or higher on
 *  its own dice brings it back; anything else leaves it spent and says what it rolled. */
function rollRulesetRecharges(ctx: RulesetCombatContext, actor: RulesetCombatant): void {
  for (const id of [...actor.spent]) {
    const action = actor.actions.find((entry) => entry.id === id);
    // Nothing on this block recharges it any more, so it is simply available again rather than
    // spent forever by a block that changed under it.
    if (!action?.recharge) {
      actor.spent = actor.spent.filter((entry) => entry !== id);
      continue;
    }
    const rolls = rollRulesetDice(ctx.roll, action.recharge.dice.count, action.recharge.dice.sides);
    const kept = sumOf(rolls);
    const back = kept >= action.recharge.from;
    if (back) actor.spent = actor.spent.filter((entry) => entry !== id);
    ctx.events.push({
      type: "recharge",
      actorId: actor.id,
      optionId: id,
      label: action.label,
      rolls,
      kept,
      from: action.recharge.from,
      back,
    });
  }
}

/** Who is next to act: anybody the fight is not over for. A member who is down with nothing left to
 *  roll is stepped over until somebody brings them back. */
function canTakeTurn(combatant: RulesetCombatant): boolean {
  if (combatant.defeated) return false;
  return !combatant.down || (combatant.dying && !combatant.stable);
}

/**
 * The end of one turn and the start of the next: the saves a condition repeats, the clocks it runs
 * on, the budgets a turn or a round gives back, the next actor in the order, and the roll a
 * character makes at the start of their turn while they are down.
 */
export function advanceRulesetTurn(
  definition: RulesetDefinition,
  state: RulesetEncounterState,
  roller: RulesetCombatRoller,
): RulesetCombatStep {
  const combat = definition.combat;
  if (!combat) return { state, events: [] };
  const outcome = rulesetEncounterOutcome(state);
  if (outcome !== "ongoing") return { state, events: [{ type: "outcome", outcome }] };

  if (state.window) return refusal(state, currentRulesetActor(state)?.id ?? "", "window-open", "end-turn");
  const { ctx, finish } = begin(definition, combat, state, roller);
  const leaving = currentRulesetActor(ctx.state);
  if (leaving) {
    tickConditions(ctx, leaving, "turn-end");
    // Strikes a spend bought are for the turn it was spent on. Nothing is carried over.
    delete leaving.strikesLeft;
  }
  // The window BETWEEN two turns: one turn has ended and the next has not begun, which is when a
  // block spends its own points on one of its own actions. The turn begins once they have all
  // answered, so buying one never costs the next actor part of their turn.
  if (openSignatureWindow(ctx)) return finish();
  beginNextTurn(definition, combat, ctx);
  return finish();
}

/** Everybody who could buy a signature action right now, in the fight's own order, and the window
 *  that asks them. Nobody is asked when nobody can afford anything: an empty window would hold the
 *  fight open for an answer with nothing in it. */
function openSignatureWindow(ctx: RulesetCombatContext): boolean {
  const waiting = ctx.state.order.filter((id) => rulesetSignatureOptions(ctx.definition, ctx.state, id).length > 0);
  if (waiting.length === 0) return false;
  // A round that throws initiative again has no next actor until it has been thrown, and that is
  // done once the window has closed, so a window at the end of a round names nobody rather than
  // whoever the old order would have put first.
  const next = nextTurnActor(ctx.state);
  const unknown = next?.wraps && (ctx.combat.initiative.each === "round" || !!ctx.combat.initiative.resource);
  const nextActorId = unknown ? "" : (next?.combatant.id ?? "");
  openWindow(ctx, { kind: "signature", trigger: { kind: "between-turns", nextActorId }, waiting });
  return true;
}

/** Who acts next, read without moving the fight, and whether their turn begins a new round: the
 *  window between two turns says whose turn it is holding up. */
function nextTurnActor(state: RulesetEncounterState): { combatant: RulesetCombatant; wraps: boolean } | null {
  let turn = state.turn;
  let wraps = false;
  for (let step = 0; step < state.order.length; step++) {
    if (turn + 1 >= state.order.length) wraps = true;
    turn = turn + 1 >= state.order.length ? 0 : turn + 1;
    const candidate = rulesetCombatant(state, state.order[turn]!);
    if (candidate && canTakeTurn(candidate)) return { combatant: candidate, wraps };
  }
  return null;
}

/** The next turn, from a fight whose last one has already ended. Split out of `advanceRulesetTurn`
 *  so the window between the two can hold it: the turn-end books are closed either way, and this
 *  runs once, after the window rather than before it. */
function beginNextTurn(definition: RulesetDefinition, combat: RulesetCombat, ctx: RulesetCombatContext): void {
  let turn = ctx.state.turn;
  let round = ctx.state.round;
  let fresh = false;
  for (let step = 0; step < ctx.state.order.length; step++) {
    turn += 1;
    if (turn >= ctx.state.order.length) {
      turn = 0;
      round += 1;
      fresh = true;
    }
    const candidate = rulesetCombatant(ctx.state, ctx.state.order[turn]!);
    if (candidate && canTakeTurn(candidate)) break;
  }
  ctx.state.turn = turn;
  ctx.state.round = round;
  if (fresh) {
    for (const combatant of ctx.state.combatants) {
      refreshRulesetBudgets(combat, combatant.budgets, "round");
      refreshSpendLimits(combatant, "round");
    }
    ctx.events.push({ type: "round", round });
    // A ruleset whose initiative is thrown every round throws it again now, and the round starts at
    // whoever is first in the new order and can take a turn.
    if (combat.initiative.each === "round" || combat.initiative.resource) {
      // A number attacks move is not thrown again: the order simply follows it as it now stands.
      if (combat.initiative.resource) reorderByInitiative(ctx);
      else rethrowInitiative(definition, combat, ctx);
      const first = ctx.state.order.findIndex((id) => {
        const candidate = rulesetCombatant(ctx.state, id);
        return !!candidate && canTakeTurn(candidate);
      });
      ctx.state.turn = Math.max(0, first);
    }
  }
  // A rider fires once in its period. "turn" is fresh at the start of every turn, whosever it is,
  // so a strike made while somebody else is acting can still carry one; "round" waits for the round
  // to turn over. Everybody's, because a rider fires on its holder's blow, not on their turn.
  for (const combatant of ctx.state.combatants) clearSpentRiders(combatant, fresh);

  const actor = currentRulesetActor(ctx.state);
  if (actor) {
    refreshRulesetBudgets(combat, actor.budgets, "turn");
    refreshSpendLimits(actor, "turn");
    // A stance lasts until the actor's next turn, and that turn is now. Help was given to somebody
    // else and is spent by their own next attack, so it survives this.
    actor.flags = actor.flags.helped ? { helped: true } : {};
    refreshRulesetMovement(definition, combat, actor, ctx.state);
    ctx.events.push({ type: "turn", actorId: actor.id, round });
    refreshRulesetSignature(actor);
    rollRulesetRecharges(ctx, actor);
    recoverFromCrash(ctx, actor);
    tickConditions(ctx, actor, "turn-start");
    // A condition that ended as the turn began no longer holds this turn's walk: nothing has been
    // spent yet, so the allowance is simply read again.
    refreshRulesetMovement(definition, combat, actor, ctx.state);
    if (actor.dying && !actor.stable && !actor.defeated) deathSave(ctx, actor);
  }
  const after = rulesetEncounterOutcome(ctx.state);
  if (after !== "ongoing") pushOutcome(ctx, after);
}

/** What a combatant may spend of a limited pool starts again with the period the limit is counted in. */
function refreshSpendLimits(combatant: RulesetCombatant, per: "turn" | "round"): void {
  for (const limit of Object.values(combatant.limits ?? {})) if (limit.per === per) limit.spent = 0;
}

/** A crashed combatant's own turn begins: one more towards recovering, and at the ruleset's count the
 *  number goes back to the base before they act. */
function recoverFromCrash(ctx: RulesetCombatContext, actor: RulesetCombatant): void {
  const crash = ctx.combat.initiative.resource?.crash;
  if (actor.crashedTurns === undefined || !crash?.recoverAfter) return;
  actor.crashedTurns += 1;
  if (actor.crashedTurns < crash.recoverAfter) return;
  shiftInitiative(ctx, actor, ctx.combat.initiative.resource!.base - actor.initiative, "recovered");
}

/** The order sorted again by everybody's number as it stands, which is how a round begins where
 *  initiative is a number attacks move. */
function reorderByInitiative(ctx: RulesetCombatContext): void {
  ctx.state.order = rulesetInitiativeOrder(ctx.state.combatants);
  pushInitiativeOrder(ctx);
}

/** The order as it now stands, said once, for everybody still in the fight. */
function pushInitiativeOrder(ctx: RulesetCombatContext): void {
  ctx.events.push({
    type: "initiative",
    entries: ctx.state.order.flatMap((id) => {
      const combatant = rulesetCombatant(ctx.state, id);
      return combatant && !combatant.defeated
        ? [
            {
              actorId: id,
              roll: combatant.initiativeRoll,
              modifier: combatant.initiativeModifier,
              total: combatant.initiative,
            },
          ]
        : [];
    }),
  });
}

/** Initiative thrown again for everybody still in the fight, with each one's modifier as it stands
 *  now, and the order sorted by the same rules it opened with. Somebody the fight is over for keeps
 *  their old number and simply never takes a turn. */
function rethrowInitiative(definition: RulesetDefinition, combat: RulesetCombat, ctx: RulesetCombatContext): void {
  for (const combatant of ctx.state.combatants) {
    if (combatant.defeated) continue;
    const now = rulesetInitiativeModifierNow(definition, combat, combatant);
    const thrown = combat.initiative.pool
      ? rulesetPoolInitiative(definition, combat, ctx.roll, now)
      : (() => {
          const faces = throwInitiativeDice(combat, ctx.roll);
          return { roll: faces, modifier: now, total: sumOf(faces) + now };
        })();
    combatant.initiativeRoll = thrown.roll;
    combatant.initiativeModifier = thrown.modifier;
    combatant.initiative = thrown.total;
  }
  ctx.state.order = rulesetInitiativeOrder(ctx.state.combatants);
  pushInitiativeOrder(ctx);
}

/** Who won, if anybody has yet. A fight is over for a side when nobody on it is still standing;
 *  victory is read first, so a last blow that takes both sides down is still a win. */
export function rulesetEncounterOutcome(state: RulesetEncounterState): RulesetEncounterOutcome {
  const enemies = state.combatants.filter((combatant) => combatant.side === "enemy");
  const party = state.combatants.filter((combatant) => combatant.side === "party");
  if (enemies.length > 0 && enemies.every((combatant) => !rulesetCombatStanding(combatant))) return "victory";
  if (party.length > 0 && party.every((combatant) => !rulesetCombatStanding(combatant))) return "defeat";
  return "ongoing";
}

/** The fight as it stands, in the ruleset's own numbers. */
export function rulesetEncounterSummary(
  definition: RulesetDefinition,
  state: RulesetEncounterState,
): RulesetEncounterSummary {
  const combat = definition.combat;
  const health = (combatant: RulesetCombatant) =>
    combat ? rulesetCombatHealth(definition, combat, combatant) : { value: 0, max: 0, temp: 0 };
  return {
    outcome: rulesetEncounterOutcome(state),
    rounds: state.round,
    party: state.combatants
      .filter((combatant) => combatant.side === "party")
      .map((combatant) => {
        const now = health(combatant);
        return {
          id: combatant.id,
          name: combatant.name,
          health: now.value,
          maxHealth: now.max,
          temp: now.temp,
          down: combatant.down,
          dying: combatant.dying,
          stable: combatant.stable,
          conditions: rulesetCombatConditions(definition, combatant),
        };
      }),
    enemies: state.combatants
      .filter((combatant) => combatant.side === "enemy")
      .map((combatant) => {
        const now = health(combatant);
        return {
          id: combatant.id,
          name: combatant.name,
          health: now.value,
          maxHealth: now.max,
          defeated: combatant.defeated,
        };
      }),
  };
}
