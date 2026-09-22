import { normalizeGameDifficulty } from "../combat-conditions.js";
import { decideProfileAction } from "./profile-ai.js";
import { applyAction } from "./engine.js";
// ──────────────────────────────────────────────
// Tactical Combat — enemy AI (player-phase → enemy-phase resolver)
// ──────────────────────────────────────────────
// New encounters use saved role/temperament priorities. Snapshots without
// profiles retain the legacy policy below. Both policies use the same resolver;
// AI companions and enemies re-evaluate the accepted state before each action.

import { effectiveSpeed, manhattan } from "./math.js";
import { deterministicRng } from "./rng.js";
import {
  aliveUnits,
  appendLog,
  checkTerminal,
  clone,
  forecastFrom,
  getMovementRange,
  performUnitAction,
  skillReady,
  tickRound,
} from "./engine.js";
import type { TacticalAction, TacticalCombatState, TacticalCoord, TacticalEvent, TacticalUnit } from "./types.js";

const GREED: Record<string, number> = { casual: 0.4, normal: 0.7, hard: 0.9, brutal: 1.0 };

interface AttackOption {
  tile: TacticalCoord;
  targetId: string;
  skillName?: string;
  expValue: number;
  isKill: boolean;
  hitChance: number;
  counterRisk: number;
  score: number;
}

function reachTiles(state: TacticalCombatState, unit: TacticalUnit): TacticalCoord[] {
  if (unit.hasMoved) return [{ x: unit.x, y: unit.y }];
  const tiles = getMovementRange(state, unit.id);
  // getMovementRange already includes the current tile.
  return tiles.length ? tiles : [{ x: unit.x, y: unit.y }];
}

function buildAttackOptions(state: TacticalCombatState, unit: TacticalUnit): AttackOption[] {
  const targets = aliveUnits(state).filter((t) => t.side !== unit.side);
  const tiles = reachTiles(state, unit);
  const options: AttackOption[] = [];

  const evaluate = (
    tile: TacticalCoord,
    target: TacticalUnit,
    opts: {
      power?: number;
      element?: string;
      skillName?: string;
      rangeMin: number;
      rangeMax: number;
      traits?: import("../combat-conditions.js").CombatAttackTraits;
    },
  ): void => {
    const d = manhattan(tile, target);
    if (d < opts.rangeMin || d > opts.rangeMax) return;
    const fc = forecastFrom(state, unit, target, tile, {
      power: opts.power,
      element: opts.element,
      traits: opts.traits,
    });
    const hitP = fc.hitChance / 100;
    const expValue = hitP * fc.damage;
    const isKill = fc.damage >= target.hp && fc.hitChance >= 50;

    // Counter risk: only if the target would survive an expected strike AND can
    // reach back to `tile` at its own attack range.
    let counterRisk = 0;
    const survives = target.hp - fc.damage > 0;
    const cd = manhattan(tile, target);
    if (survives && cd >= target.attackRange.min && cd <= target.attackRange.max) {
      const back = forecastFrom(state, target, unit, { x: target.x, y: target.y }, { hitPenalty: 10 });
      counterRisk = (back.hitChance / 100) * back.damage;
    }

    const score = (isKill ? 1000 : 0) + expValue - counterRisk * 0.75;
    options.push({
      tile,
      targetId: target.id,
      skillName: opts.skillName,
      expValue,
      isKill,
      hitChance: fc.hitChance,
      counterRisk,
      score,
    });
  };

  for (const tile of tiles) {
    for (const target of targets) {
      // Basic attack — bounded by the unit's class reach (archers never strike below min).
      evaluate(tile, target, { rangeMin: unit.attackRange.min, rangeMax: unit.attackRange.max });
      // Attack skills use their authored reach, or the legacy range-two fallback.
      for (const skill of unit.skills) {
        if (skill.reaction || skill.type !== "attack" || !skillReady(unit, skill)) continue;
        evaluate(tile, target, {
          power: Math.max(1, skill.power),
          element: skill.element,
          traits: skill,
          skillName: skill.name,
          rangeMin: 1,
          rangeMax: skill.range ?? Math.max(unit.attackRange.max, 2),
        });
      }
    }
  }
  return options;
}

/** Pick a heal action if a hurt ally is within the skill's support range. */
function tryHeal(state: TacticalCombatState, unit: TacticalUnit): TacticalAction | null {
  const healSkill = unit.skills.find((s) => !s.reaction && s.type === "heal" && skillReady(unit, s));
  if (!healSkill) return null;
  const allies = aliveUnits(state, unit.side);
  const hurt = allies
    .filter((a) => a.hp / Math.max(1, a.maxHp) <= 0.6 && manhattan(unit, a) <= (healSkill.range ?? 2))
    .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
  if (!hurt) return null;
  return { type: "skill", unitId: unit.id, skillName: healSkill.name, targetId: hurt.id };
}

/** Move toward the nearest party unit, ending on the reachable tile closest to it. */
function approach(state: TacticalCombatState, unit: TacticalUnit): TacticalCoord | null {
  const targets = aliveUnits(state).filter((t) => t.side !== unit.side);
  if (!targets.length) return null;
  const nearest = targets.slice().sort((a, b) => manhattan(unit, a) - manhattan(unit, b))[0]!;
  const tiles = reachTiles(state, unit);
  let best: TacticalCoord | null = null;
  let bestDist = Infinity;
  for (const t of tiles) {
    const d = manhattan(t, nearest);
    if (d < bestDist) {
      bestDist = d;
      best = t;
    }
  }
  if (best && (best.x !== unit.x || best.y !== unit.y)) return best;
  return null;
}

export function decideTacticalAction(
  state: TacticalCombatState,
  unit: TacticalUnit,
  rng: () => number = deterministicRng(state.seed, state.actionCounter),
): TacticalAction {
  if (unit.tactics) return decideProfileAction(state, { ...unit, tactics: unit.tactics });
  const greed = GREED[normalizeGameDifficulty(state.difficulty)] ?? 0.7;

  // Consider healing a hurt ally before committing to aggression.
  const heal = tryHeal(state, unit);
  if (heal && rng() < greed + 0.1) return heal;

  const options = buildAttackOptions(state, unit);
  if (options.length) {
    options.sort((a, b) => b.score - a.score);
    let chosen = options[0]!;
    // Low-greed AI sometimes takes a random (still legal) attack instead of the best.
    if (!chosen.isKill && rng() > greed && options.length > 1) {
      const idx = 1 + Math.floor(rng() * (options.length - 1));
      chosen = options[idx]!;
    }
    if (chosen.skillName) {
      return {
        type: "skill",
        unitId: unit.id,
        skillName: chosen.skillName,
        targetId: chosen.targetId,
        to: chosen.tile,
      };
    }
    return { type: "attack", unitId: unit.id, targetId: chosen.targetId, to: chosen.tile };
  }

  // Nothing in reach — approach, then hold.
  const dest = approach(state, unit);
  if (dest) return { type: "wait", unitId: unit.id, to: dest };
  return { type: "wait", unitId: unit.id };
}

/**
 * Resolve the entire enemy phase: every living enemy acts (in speed order),
 * then the round ticks (statuses/cooldowns) and play returns to the player.
 * Pure — clones the input state.
 */
export function runEnemyPhase(state: TacticalCombatState): { state: TacticalCombatState; events: TacticalEvent[] } {
  const next = clone(state);
  const events: TacticalEvent[] = [];

  if (next.outcome) return { state: next, events };

  const order = aliveUnits(next, "enemy").sort((a, b) => effectiveSpeed(b) - effectiveSpeed(a));
  for (const enemy of order) {
    if (enemy.hp <= 0 || enemy.hasActed) continue;
    if (aliveUnits(next, "party").length === 0) break;
    const rng = deterministicRng(next.seed, next.actionCounter++);
    const action = decideTacticalAction(next, enemy, rng);
    if ("unitId" in action) {
      performUnitAction(next, enemy, action, events);
    }
    if (checkTerminal(next, events)) break;
  }

  if (!next.outcome) {
    // End of round: tick statuses/cooldowns, reset per-unit flags, hand back to player.
    tickRound(next, events);
    checkTerminal(next, events);
    if (!next.outcome) {
      next.round += 1;
      next.phase = "player";
      events.push({ kind: "phase", text: `Player Phase — Round ${next.round}`, phase: "player" });
    }
  }

  appendLog(next, events);
  return { state: next, events };
}

/** AI companions act after manual orders, or before an explicit End Turn. */
export function runPartyAiPhase(
  state: TacticalCombatState,
  force = false,
): { state: TacticalCombatState; events: TacticalEvent[] } {
  const next = clone(state);
  const events: TacticalEvent[] = [];
  if (next.outcome || next.phase !== "player") return { state: next, events };
  const leaderId = aliveUnits(next, "party")[0]?.id;
  if (!force && aliveUnits(next, "party").some((u) => !u.hasActed && (u.id === leaderId || u.controller !== "ai")))
    return { state: next, events };
  for (const unit of aliveUnits(next, "party")
    .filter((u) => u.controller === "ai" && u.id !== leaderId)
    .sort((a, b) => effectiveSpeed(b) - effectiveSpeed(a))) {
    if (unit.hp <= 0 || unit.hasActed) continue;
    const action = decideTacticalAction(next, unit, deterministicRng(next.seed, next.actionCounter++));
    if ("unitId" in action) performUnitAction(next, unit, action, events);
    if (checkTerminal(next, events)) break;
  }
  appendLog(next, events);
  return { state: next, events };
}

export function applyTacticalTurn(state: TacticalCombatState, action: TacticalAction) {
  const pre = action.type === "endTurn" ? runPartyAiPhase(state, true) : { state, events: [] as TacticalEvent[] };
  if (pre.state.outcome) return { ok: true as const, ...pre };
  const applied = applyAction(pre.state, action);
  if (!applied.ok) return applied;
  let next = applied.state;
  const events = [...pre.events, ...applied.events];
  if (action.type !== "control") {
    const party = runPartyAiPhase(next);
    next = party.state;
    events.push(...party.events);
    if (!next.outcome && next.phase === "player" && aliveUnits(next, "party").every((u) => u.hasActed)) {
      next.phase = "enemy";
      const phaseEvent: TacticalEvent = { kind: "phase", text: "Enemy Phase", phase: "enemy" };
      events.push(phaseEvent);
      appendLog(next, [phaseEvent]);
    }
  }
  if (!next.outcome && next.phase === "enemy") {
    const enemy = runEnemyPhase(next);
    next = enemy.state;
    events.push(...enemy.events);
  }
  return { ok: true as const, state: next, events };
}
