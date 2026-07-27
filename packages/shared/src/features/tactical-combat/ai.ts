// ──────────────────────────────────────────────
// Tactical Combat — enemy AI (player-phase → enemy-phase resolver)
// ──────────────────────────────────────────────
// Deterministic aggro AI. Each enemy, in speed order, evaluates every
// reachable attack tile against every party target and scores it by expected
// damage minus counter-risk, preferring guaranteed kills. Heal/buff skills are
// used when an ally is hurt; out-of-range enemies approach the nearest target.
// Difficulty scales "greed": lower difficulty occasionally picks a suboptimal
// action (and enemy damage itself is already scaled in computeDamage). All
// randomness is drawn from the seeded stream so an enemy phase replays exactly.

import { effectiveSpeed, hasLineOfSight, manhattan } from "./math.js";
import { deterministicRng } from "./rng.js";
import {
  aliveUnits,
  appendLog,
  checkTerminal,
  clone,
  forecastFrom,
  getTurnSkipReason,
  getMovementRange,
  performUnitAction,
  skillReady,
  tickRound,
  type TacticalTerminalOptions,
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
    opts: { power?: number; element?: string; skillName?: string; rangeMin: number; rangeMax: number },
  ): void => {
    const d = manhattan(tile, target);
    if (d < opts.rangeMin || d > opts.rangeMax) return;
    if (d > 1 && !hasLineOfSight(state.grid, tile, target)) return;
    const fc = forecastFrom(state, unit, target, tile, { power: opts.power, element: opts.element });
    const hitP = fc.hitChance / 100;
    const expValue = hitP * fc.damage;
    const isKill = fc.damage >= target.hp && fc.hitChance >= 50;

    // Counter risk: only if the target would survive an expected strike AND can
    // reach back to `tile` at its own attack range.
    let counterRisk = 0;
    const survives = target.hp - fc.damage > 0;
    const cd = manhattan(tile, target);
    if (
      survives &&
      cd >= target.attackRange.min &&
      cd <= target.attackRange.max &&
      (cd <= 1 || hasLineOfSight(state.grid, target, tile))
    ) {
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
      // Attack skills — always reachable from 1, with a floor of 2 on max.
      for (const skill of unit.skills) {
        if (skill.type !== "attack" || !skillReady(unit, skill)) continue;
        evaluate(tile, target, {
          power: Math.max(1, skill.power),
          element: skill.element,
          skillName: skill.name,
          rangeMin: 1,
          rangeMax: Math.max(unit.attackRange.max, 2),
        });
      }
    }
  }
  return options;
}

function trySupport(state: TacticalCombatState, unit: TacticalUnit): TacticalAction | null {
  const skills = unit.skills.filter((skill) => skill.type !== "attack" && skillReady(unit, skill));
  if (skills.length === 0) return null;
  const tiles = reachTiles(state, unit);
  for (const skill of skills) {
    const targets = aliveUnits(state).filter((target) =>
      skill.type === "debuff" ? target.side !== unit.side : target.side === unit.side,
    );
    const sorted = targets.sort((left, right) => {
      if (skill.type === "heal") return left.hp / left.maxHp - right.hp / right.maxHp;
      return right.level - left.level;
    });
    for (const target of sorted) {
      if (skill.type === "heal" && target.hp / Math.max(1, target.maxHp) > 0.75) continue;
      const tile = tiles
        .filter((candidate) => manhattan(candidate, target) <= 2)
        .sort((left, right) => manhattan(left, target) - manhattan(right, target))[0];
      if (!tile) continue;
      return {
        type: "skill",
        unitId: unit.id,
        skillName: skill.name,
        targetId: target.id,
        ...(tile.x !== unit.x || tile.y !== unit.y ? { to: tile } : {}),
      };
    }
  }
  return null;
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

function decide(state: TacticalCombatState, unit: TacticalUnit, rng: () => number): TacticalAction {
  const greed = GREED[state.difficulty] ?? 0.7;

  // Consider healing a hurt ally before committing to aggression.
  const support = trySupport(state, unit);
  if (support && rng() < greed + 0.1) return support;

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
  if (unit.attackRange.max > 1) return { type: "overwatch", unitId: unit.id };
  return { type: "wait", unitId: unit.id };
}

/**
 * Resolve the entire enemy phase: every living enemy acts (in speed order),
 * then the round ticks (statuses/cooldowns) and play returns to the player.
 * Pure — clones the input state.
 */
export function runEnemyPhase(
  state: TacticalCombatState,
  terminalOptions: TacticalTerminalOptions = {},
): { state: TacticalCombatState; events: TacticalEvent[] } {
  const next = clone(state);
  const events: TacticalEvent[] = [];

  if (next.outcome) return { state: next, events };

  const order = aliveUnits(next, "enemy").sort((a, b) => effectiveSpeed(b) - effectiveSpeed(a));
  for (const enemy of order) {
    if (enemy.hp <= 0 || enemy.hasActed) continue;
    if (aliveUnits(next, "party").length === 0) break;
    const skipReason = getTurnSkipReason(enemy);
    if (skipReason) {
      enemy.hasActed = true;
      events.push({ kind: "status", text: skipReason, actorId: enemy.id });
      continue;
    }
    const rng = deterministicRng(next.seed, next.actionCounter++);
    const action = decide(next, enemy, rng);
    if ("unitId" in action) {
      performUnitAction(next, enemy, action, events);
    }
    if (checkTerminal(next, events, terminalOptions)) break;
  }

  if (!next.outcome) {
    // End of round: tick statuses/cooldowns, reset per-unit flags, hand back to player.
    tickRound(next, events);
    checkTerminal(next, events, terminalOptions);
    if (!next.outcome) {
      next.round += 1;
      next.phase = "player";
      events.push({ kind: "phase", text: `Player Phase — Round ${next.round}`, phase: "player" });
    }
  }

  appendLog(next, events);
  return { state: next, events };
}
