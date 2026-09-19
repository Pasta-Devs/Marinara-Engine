// Resolving a fight: one choice at a time, and the bookkeeping between turns.
//
// Nothing here throws. A choice the rules do not allow returns the state it was given, untouched,
// and one `refused` event saying why, so a Game Master's fiction can be corrected rather than
// silently accepted. Everything a party member spends, loses or gains goes through
// `applyRulesetSheetOp`, so a fight can never write something the sheet would refuse from the
// player or from the Game Master.

import type { RulesetCombat, RulesetDefinition } from "../../schemas/ruleset.schema.js";
import { readRulesetLive } from "../rulesets/live-state.js";
import {
  currentRulesetActor,
  refreshRulesetBudgets,
  rollRulesetDice,
  rulesetCombatant,
  rulesetCombatConditions,
  rulesetCombatEffects,
  rulesetCombatFailsSave,
  rulesetCombatHealth,
  rulesetCombatStanding,
  sumOf,
  writeRulesetSheet,
} from "./encounter.js";
import {
  planRulesetCombatCost,
  rulesetAttackMode,
  rulesetCombatOptions,
  rulesetCostSteps,
  rulesetStandardBudget,
} from "./options.js";
import type {
  RulesetCombatAction,
  RulesetCombatAmount,
  RulesetCombatant,
  RulesetCombatApplies,
  RulesetCombatChoice,
  RulesetCombatEvent,
  RulesetCombatRefusal,
  RulesetCombatRoller,
  RulesetCombatStep,
  RulesetEncounterOutcome,
  RulesetEncounterState,
  RulesetEncounterSummary,
} from "./types.js";

/** Everything one step of the fight needs: the rules, the state it is changing, its dice and the
 *  events it has produced so far. */
interface RulesetCombatContext {
  definition: RulesetDefinition;
  combat: RulesetCombat;
  state: RulesetEncounterState;
  roll: RulesetCombatRoller;
  events: RulesetCombatEvent[];
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

/** What a critical hit adds, by the rule the ruleset declared: the same dice thrown again, or their
 *  highest faces added once. */
function criticalExtra(
  ctx: RulesetCombatContext,
  amount: RulesetCombatAmount,
  extra?: { amount: RulesetCombatAmount; times: number },
): { rolls: number[]; flat: number } {
  const rule = ctx.combat.attackRoll.critical;
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
}

/** Damage, with the target's own hide read first: immune takes none, resistant takes half rounded
 *  down and vulnerable takes double. Temporary points go first, which is the sheet's own rule. */
function dealDamage(ctx: RulesetCombatContext, target: RulesetCombatant, input: RulesetDamageInput): number {
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
  const toTemp = Math.min(before.temp, dealt);
  if (dealt > 0) {
    if (target.sheet)
      writeRulesetSheet(ctx.definition, target, { op: "damage", pool: ctx.combat.health.pool, amount: dealt });
    else if (target.health) {
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
  });
  if (dealt <= 0) return 0;
  endConditionsOnDamage(ctx, target);
  // A blow that leaves somebody standing tests their concentration. One that takes them to zero
  // does not: going down ends it outright (`dropToZero`), so nothing is rolled for it.
  if (after.value > 0) concentrationFromDamage(ctx, target, dealt);
  if (after.value <= 0) {
    if (before.value > 0) dropToZero(ctx, target);
    else if (target.dying && !target.defeated) {
      // Already down: a blow while down costs the rule's own number of failures.
      const rule = input.critical ? ctx.combat.dying?.criticalWhileDown : ctx.combat.dying?.damageWhileDown;
      // A stable member who is hurt is no longer stable: the count starts again with this blow.
      if (rule && rule !== "none") target.stable = false;
      if (rule === "one-failure") addDeathFailures(ctx, target, 1);
      else if (rule === "two-failures") addDeathFailures(ctx, target, 2);
    }
  }
  return dealt;
}

function dealHeal(
  ctx: RulesetCombatContext,
  target: RulesetCombatant,
  input: { sourceId?: string; rolls: number[]; flat: number; amount: number },
): void {
  const before = healthOf(ctx, target);
  const amount = Math.max(0, Math.floor(input.amount));
  if (amount > 0) {
    if (target.sheet)
      writeRulesetSheet(ctx.definition, target, { op: "restore", pool: ctx.combat.health.pool, amount });
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
  if (before.value <= 0 && after.value > 0 && target.down && !target.defeated) revive(ctx, target);
}

/** Temporary points never stack: the bigger buffer is the one that stands. */
function grantTemporary(
  ctx: RulesetCombatContext,
  target: RulesetCombatant,
  input: { sourceId?: string; rolls: number[]; flat: number; amount: number },
): void {
  const amount = Math.max(0, Math.floor(input.amount));
  const before = healthOf(ctx, target);
  if (amount > before.temp) {
    if (target.sheet) writeRulesetSheet(ctx.definition, target, { op: "temp", pool: ctx.combat.health.pool, amount });
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

function dropToZero(ctx: RulesetCombatContext, target: RulesetCombatant): void {
  target.down = true;
  endConcentration(ctx, target, "down");
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

function trackMax(ctx: RulesetCombatContext, track: string): number {
  return ctx.definition.sheet.live.tracks.find((entry) => entry.id === track)?.max ?? 0;
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
  if (failures < trackMax(ctx, dying.failures)) return;
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
  if (trackValue(ctx, actor, dying.successes) >= trackMax(ctx, dying.successes)) {
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
  if (rulesetCombatFailsSave(ctx.definition, ctx.combat, combatant, save)) {
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
    return false;
  }
  const rolls = rollRulesetDice(ctx.roll, ctx.combat.attackRoll.dice.count, ctx.combat.attackRoll.dice.sides);
  const kept = sumOf(rolls);
  const total = kept + modifier;
  const success = total >= difficulty;
  ctx.events.push({
    type: "save",
    actorId: combatant.id,
    ...(sourceId ? { sourceId } : {}),
    save,
    rolls,
    kept,
    modifier,
    total,
    difficulty,
    success,
  });
  return success;
}

// ── Conditions ──

function applyConditionId(
  ctx: RulesetCombatContext,
  target: RulesetCombatant,
  condition: string,
  applies: RulesetCombatApplies,
  extra: { sourceId?: string; difficulty?: number; concentration?: boolean } = {},
): void {
  if (matches(target.block?.conditionImmunities, condition.trim().toLowerCase())) {
    ctx.events.push({ type: "condition", targetId: target.id, condition, active: false, reason: "immune" });
    return;
  }
  if (target.sheet) writeRulesetSheet(ctx.definition, target, { op: "condition", condition, active: true });
  const rounds = typeof applies.duration === "object" ? applies.duration.rounds : null;
  target.tracked = target.tracked.filter((entry) => entry.condition !== condition);
  target.tracked.push({
    condition,
    rounds,
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
  reason: "save" | "expired" | "damage" | "concentration" | "revived",
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
    if (at !== "turn-end" || entry.rounds === null) continue;
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

/** Why an option the caller named is not on the menu, as precisely as the rules can say. */
function whyNotOffered(combat: RulesetCombat, actor: RulesetCombatant, optionId: string): RulesetCombatRefusal {
  const action = actor.actions.find((entry) => entry.id === optionId);
  if (action) {
    if ((actor.budgets[action.budget] ?? 0) < 1) return "no-budget";
    return "insufficient";
  }
  const standard = optionId.startsWith("standard:") ? optionId.slice("standard:".length) : null;
  if (standard && (combat.standard ?? []).some((entry) => entry === standard)) {
    return (actor.budgets[rulesetStandardBudget(combat)] ?? 0) < 1 ? "no-budget" : "unknown-option";
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
  if (currentRulesetActor(state)?.id !== actor.id)
    return refusal(state, choice.actorId, "not-your-turn", choice.optionId);
  // Ending a turn is always allowed, down or not: a character lying at zero still has a turn, and
  // it is the one their roll against death happens on.
  if (choice.optionId === "end-turn") return advanceRulesetTurn(definition, state, roller);
  if (!rulesetCombatStanding(actor)) return refusal(state, choice.actorId, "down", choice.optionId);

  const option = rulesetCombatOptions(definition, state, actor.id).find((entry) => entry.id === choice.optionId);
  if (!option) {
    if (rulesetCombatEffects(definition, combat, actor).has("cannot-act")) {
      return refusal(state, choice.actorId, "cannot-act", choice.optionId);
    }
    return refusal(state, choice.actorId, whyNotOffered(combat, actor, choice.optionId), choice.optionId);
  }

  // Targets, checked against the side and the count the option itself declared.
  const wanted = option.targets;
  const ids = [...new Set(choice.targetIds)];
  const targets: RulesetCombatant[] = [];
  if (wanted.count > 0) {
    if (ids.length < 1 || ids.length > wanted.count) return refusal(state, choice.actorId, "bad-target", option.id);
    for (const id of ids) {
      const target = rulesetCombatant(state, id);
      // A combatant who is down can still be healed, and can still be hit while they are down. Only
      // one the fight is over for is off the table.
      if (!target || target.defeated) return refusal(state, choice.actorId, "bad-target", option.id);
      const sameSide = target.side === actor.side;
      if (wanted.side === "self" && target.id !== actor.id)
        return refusal(state, choice.actorId, "bad-target", option.id);
      if (wanted.side === "ally" && !sameSide) return refusal(state, choice.actorId, "bad-target", option.id);
      if (wanted.side === "enemy" && sameSide) return refusal(state, choice.actorId, "bad-target", option.id);
      // Helping yourself is not help.
      if (option.id === "standard:help" && target.id === actor.id) {
        return refusal(state, choice.actorId, "bad-target", option.id);
      }
      targets.push(target);
    }
  }
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
    resolveStandard(ctx, working, option.id.slice("standard:".length), workingTargets[0]);
    return finish();
  }

  const action = working.actions.find((entry) => entry.id === option.id)!;
  const paid = planRulesetCombatCost(definition, working, action, choice.payWith);
  if (!paid) {
    // The menu said it was affordable, so only a `payWith` the sheet refuses can land here.
    return refusal(state, choice.actorId, "insufficient", option.id);
  }
  if (paid.live && working.sheet) working.sheet.live = paid.live;
  for (const entry of paid.cost) {
    ctx.events.push({ type: "spend", actorId: working.id, pool: entry.pool, label: entry.label, amount: entry.amount });
  }
  resolveAction(ctx, working, action, workingTargets, choice.payWith);
  const outcome = rulesetEncounterOutcome(ctx.state);
  if (outcome !== "ongoing") ctx.events.push({ type: "outcome", outcome });
  return finish();
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
  else if (action === "dash") actor.flags.dashed = true;
  else if (action === "disengage") actor.flags.disengaged = true;
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

function resolveAction(
  ctx: RulesetCombatContext,
  actor: RulesetCombatant,
  action: RulesetCombatAction,
  targets: RulesetCombatant[],
  payWith?: string,
): void {
  if (action.concentration) startConcentration(ctx, actor, action);
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
  const heal = once(action.heal);
  const temporary = once(action.temporary);

  for (const target of targets) {
    let landed = true;
    let critical = false;
    if (action.toHit !== undefined && !action.autoHit) {
      const mode = rulesetAttackMode(ctx.definition, ctx.combat, actor, target);
      const dice = ctx.combat.attackRoll.dice;
      const first = rollRulesetDice(ctx.roll, dice.count, dice.sides);
      const second = mode === "normal" ? null : rollRulesetDice(ctx.roll, dice.count, dice.sides);
      const kept = second
        ? mode === "advantage"
          ? Math.max(sumOf(first), sumOf(second))
          : Math.min(sumOf(first), sumOf(second))
        : sumOf(first);
      const naturals = ctx.combat.attackRoll.naturals;
      const single = dice.count === 1;
      const total = kept + action.toHit;
      let outcome: "hit" | "miss" | "critical" = total >= target.defense ? "hit" : "miss";
      if (single && kept === dice.sides && naturals.max !== "none") {
        outcome = naturals.max === "critical" ? "critical" : "hit";
      } else if (single && kept === 1 && naturals.min === "miss") outcome = "miss";
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
        total,
        defense: target.defense,
        outcome,
      });
      // Help is spent by the attack it was given for, landed or not.
      actor.flags.helped = false;
      landed = outcome !== "miss";
      critical = outcome === "critical";
    }
    if (!landed) continue;

    let saved = false;
    if (action.save) {
      saved = rollSave(ctx, target, action.save.save, action.save.difficulty, actor.id);
      if (saved && action.save.onSuccess === "negates") continue;
    }
    const halved = saved && action.save?.onSuccess === "half";

    if (damage && action.damage) {
      const rolled = damage();
      const bonus = critical ? criticalExtra(ctx, action.damage, extra) : { rolls: [], flat: 0 };
      const total = rolled.total + sumOf(bonus.rolls) + bonus.flat;
      dealDamage(ctx, target, {
        sourceId: actor.id,
        label: action.label,
        ...(action.damage.type ? { damageType: action.damage.type } : {}),
        rolls: [...rolled.rolls, ...bonus.rolls],
        flat: rolled.flat + bonus.flat,
        amount: halved ? Math.floor(total / 2) : total,
        ...(halved ? { saved: true } : {}),
        ...(critical ? { critical: true } : {}),
      });
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
  }
}

// ── Between turns ──

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

  const { ctx, finish } = begin(definition, combat, state, roller);
  const leaving = currentRulesetActor(ctx.state);
  if (leaving) tickConditions(ctx, leaving, "turn-end");

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
    for (const combatant of ctx.state.combatants) refreshRulesetBudgets(combat, combatant.budgets, "round");
    ctx.events.push({ type: "round", round });
  }

  const actor = currentRulesetActor(ctx.state);
  if (actor) {
    refreshRulesetBudgets(combat, actor.budgets, "turn");
    // A stance lasts until the actor's next turn, and that turn is now. Help was given to somebody
    // else and is spent by their own next attack, so it survives this.
    actor.flags = actor.flags.helped ? { helped: true } : {};
    ctx.events.push({ type: "turn", actorId: actor.id, round });
    tickConditions(ctx, actor, "turn-start");
    if (actor.dying && !actor.stable && !actor.defeated) deathSave(ctx, actor);
  }
  const after = rulesetEncounterOutcome(ctx.state);
  if (after !== "ongoing") ctx.events.push({ type: "outcome", outcome: after });
  return finish();
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
