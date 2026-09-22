import { combatWeatherEffects, normalizeGameDifficulty } from "../combat-conditions.js";
import { chooseCombatCandidate, type CombatAiCandidate } from "../combat-ai.js";
import { aliveUnits, canTraverseTile, forecastFrom, getMovementRange, occupantAt, skillReady } from "./engine.js";
import { computeHeal, manhattan, terrainInfoAt } from "./math.js";
import type { TacticalAction, TacticalCombatState, TacticalCoord, TacticalUnit } from "./types.js";

/** Mindless pursuit ranks spatial steps; other profiles also consider movement costs. */
export function pursueOpponent(
  state: TacticalCombatState,
  unit: TacticalUnit,
): { target: TacticalUnit; to: TacticalCoord } | null {
  const targets = aliveUnits(state)
    .filter((t) => t.side !== unit.side)
    .sort((a, b) => manhattan(unit, a) - manhattan(unit, b) || a.id.localeCompare(b.id));
  const key = (p: TacticalCoord) => p.y * state.grid.width + p.x;
  const origin = key(unit);
  const distances = new Map<number, number>([[origin, 0]]);
  const parents = new Map<number, TacticalCoord>();
  const frontier: TacticalCoord[] = [{ x: unit.x, y: unit.y }];
  let goal: { target: TacticalUnit; tile: TacticalCoord } | undefined;
  while (frontier.length) {
    // Mindless ignores terrain/weather in route choice, but still pays for each move below.
    frontier.sort((a, b) => distances.get(key(a))! - distances.get(key(b))!);
    const tile = frontier.shift()!;
    if (!occupantAt(state, tile.x, tile.y, unit.id)) {
      const target = targets.find(
        (t) => manhattan(tile, t) >= unit.attackRange.min && manhattan(tile, t) <= unit.attackRange.max,
      );
      if (target) {
        goal = { target, tile };
        break;
      }
    }
    const radius = unit.movementMode === "teleport" ? unit.movement : 1;
    for (let dy = -radius; dy <= radius; dy++)
      for (let dx = -radius; dx <= radius; dx++) {
        const length = Math.abs(dx) + Math.abs(dy);
        if (length === 0 || length > radius) continue;
        const next = { x: tile.x + dx, y: tile.y + dy };
        if (!canTraverseTile(state, unit, next)) continue;
        const stepCost =
          unit.tactics?.adjective === "mindless" || unit.movementMode === "fly" || unit.movementMode === "teleport"
            ? length
            : terrainInfoAt(state.grid, next.x, next.y).moveCost + combatWeatherEffects(state.weather).walkingCost;
        const distance = distances.get(key(tile))! + stepCost;
        if (distance >= (distances.get(key(next)) ?? Infinity)) continue;
        const seen = distances.has(key(next));
        distances.set(key(next), distance);
        parents.set(key(next), tile);
        if (!seen) frontier.push(next);
      }
  }
  if (!goal) return null;
  const route: TacticalCoord[] = [];
  let cursor = goal.tile;
  while (key(cursor) !== origin) {
    route.unshift(cursor);
    cursor = parents.get(key(cursor))!;
  }
  let budget = unit.hasMoved ? 0 : unit.movement;
  let to: TacticalCoord = { x: unit.x, y: unit.y };
  let previous: TacticalCoord = unit;
  for (const tile of route) {
    budget -=
      unit.movementMode === "fly" || unit.movementMode === "teleport"
        ? manhattan(previous, tile)
        : terrainInfoAt(state.grid, tile.x, tile.y).moveCost + combatWeatherEffects(state.weather).walkingCost;
    if (budget < 0) break;
    previous = tile;
    if (!occupantAt(state, tile.x, tile.y, unit.id)) to = tile;
  }
  return { target: goal.target, to };
}

export function decideProfileAction(
  state: TacticalCombatState,
  unit: TacticalUnit & { tactics: NonNullable<TacticalUnit["tactics"]> },
): TacticalAction {
  const opponents = aliveUnits(state).filter((t) => t.side !== unit.side);
  const allies = aliveUnits(state, unit.side);
  const pursuit = pursueOpponent(state, unit);
  if (unit.tactics.adjective === "mindless") {
    if (!pursuit) return { type: "wait", unitId: unit.id };
    const distance = manhattan(pursuit.to, pursuit.target);
    return distance >= unit.attackRange.min && distance <= unit.attackRange.max
      ? { type: "attack", unitId: unit.id, targetId: pursuit.target.id, to: pursuit.to }
      : { type: "wait", unitId: unit.id, to: pursuit.to };
  }
  const tiles = unit.hasMoved ? [{ x: unit.x, y: unit.y }] : getMovementRange(state, unit.id);
  const protectee = allies
    .filter((a) => a.id !== unit.id)
    .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp || a.id.localeCompare(b.id))[0];
  const candidates: CombatAiCandidate<TacticalAction>[] = [];
  const dangerAt = new Map<string, number>();
  const danger = (tile: TacticalCoord) => {
    const key = `${tile.x},${tile.y}`;
    if (dangerAt.has(key)) return dangerAt.get(key)!;
    const value = opponents.reduce((sum, enemy) => {
      // Observable one-activation reach estimate. No future rolls or player command.
      if (manhattan(enemy, tile) > enemy.movement + enemy.attackRange.max) return sum;
      const forecast = forecastFrom(state, enemy, { ...unit, ...tile }, enemy);
      return sum + (forecast.damage * forecast.hitChance) / 100 / Math.max(1, unit.hp);
    }, 0);
    dangerAt.set(key, value);
    return value;
  };
  for (const tile of tiles) {
    const risk = danger(tile);
    const protection = protectee ? 1 / (1 + manhattan(tile, protectee)) : 0;
    for (const target of opponents) {
      const distance = manhattan(tile, target);
      for (const skill of [
        undefined,
        ...unit.skills.filter((s) => !s.reaction && s.type === "attack" && skillReady(unit, s)),
      ]) {
        if (
          distance < (skill ? 1 : unit.attackRange.min) ||
          distance > (skill ? (skill.range ?? Math.max(2, unit.attackRange.max)) : unit.attackRange.max)
        )
          continue;
        const fc = forecastFrom(state, unit, target, tile, {
          power: skill ? Math.max(1, skill.power) : undefined,
          element: skill?.element,
          traits: skill ?? unit,
        });
        const counter = forecastFrom(state, target, { ...unit, ...tile }, target, { hitPenalty: 10 });
        const counterRisk =
          target.hp > fc.damage && distance >= target.attackRange.min && distance <= target.attackRange.max
            ? ((((fc.hitChance / 100) * counter.hitChance) / 100) * counter.damage) / Math.max(1, unit.hp)
            : 0;
        const area = skill?.areaRadius
          ? aliveUnits(state).filter(
              (t) =>
                manhattan(target, t.id === unit.id ? { ...t, ...tile } : t) <= skill.areaRadius! &&
                (skill.friendlyFire || t.side !== unit.side),
            )
          : [target];
        const areaDamage = area.reduce((sum, t) => {
          const hit = forecastFrom(state, unit, t, tile, {
            power: skill ? Math.max(1, skill.power) : undefined,
            element: skill?.element,
            traits: skill ?? unit,
          });
          return sum + ((t.side === unit.side ? -2 : 1) * hit.damage * hit.hitChance) / 100 / Math.max(1, t.maxHp);
        }, 0);
        candidates.push({
          action: skill
            ? { type: "skill", unitId: unit.id, skillName: skill.name, targetId: target.id, to: tile }
            : { type: "attack", unitId: unit.id, targetId: target.id, to: tile },
          targetId: target.id,
          damage: areaDamage,
          finish: fc.damage >= target.hp ? fc.hitChance / 100 : 0,
          risk: risk + (skill?.areaRadius ? 0 : counterRisk),
          cost: skill?.slotLevel
            ? 1 / Math.max(1, unit.spellSlots?.[String(skill.slotLevel)] ?? 0)
            : (skill?.mpCost ?? 0) / Math.max(1, unit.maxMp),
          protection: protectee ? protection + 1 / (1 + manhattan(target, protectee)) : 0,
          coordination: allies.some((a) => a.id !== unit.id && a.tactics?.targetId === target.id) ? 0.5 : 0,
        });
      }
    }
    for (const skill of unit.skills.filter((s) => !s.reaction && s.type !== "attack" && skillReady(unit, s))) {
      for (const target of skill.type === "debuff" ? opponents : allies) {
        if (manhattan(tile, target) > (skill.range ?? 2)) continue;
        const status = skill.statusEffect || skill.name;
        const active = target.statusEffects.some((s) => s.name === status && s.turnsLeft > 1);
        const healing =
          skill.type === "heal"
            ? Math.min(target.maxHp - target.hp, computeHeal(unit, skill.power)) / Math.max(1, target.maxHp)
            : 0;
        if ((skill.type === "heal" && healing === 0) || (skill.type !== "heal" && active)) continue;
        candidates.push({
          action: { type: "skill", unitId: unit.id, skillName: skill.name, targetId: target.id, to: tile },
          targetId: skill.type === "debuff" ? target.id : undefined,
          healing: healing * (target.hp / target.maxHp < 0.4 ? 2 : 1),
          support: skill.type === "buff" ? 0.5 : 0,
          setup: skill.type === "debuff" ? 0.6 : 0,
          coordination: skill.type === "debuff" && allies.some((a) => a.id !== unit.id && !a.hasActed) ? 0.5 : 0,
          risk,
          protection: target.id === protectee?.id ? 0.6 : protection,
          cost: skill.slotLevel
            ? 1 / Math.max(1, unit.spellSlots?.[String(skill.slotLevel)] ?? 0)
            : skill.mpCost / Math.max(1, unit.maxMp),
        });
      }
    }
  }
  // Only hold once consecutively when an attack is possible; no endless patient stalemate.
  const holdTile =
    unit.tactics.adjective === "cowardly" ? (tiles.slice().sort((a, b) => danger(a) - danger(b))[0] ?? unit) : unit;
  candidates.push({
    action: { type: "defend", unitId: unit.id, to: { x: holdTile.x, y: holdTile.y } },
    hold: true,
    risk: danger(holdTile) * 0.5,
  });
  if (pursuit && !candidates.some((c) => c.damage !== undefined || c.healing)) {
    candidates.push({
      action: { type: "wait", unitId: unit.id, to: pursuit.to },
      damage: 0.4,
      risk: danger(pursuit.to) * 0.1,
    });
  }
  const progressing =
    (unit.tactics.holds ?? 0) >= 1 && candidates.some((c) => !c.hold) ? candidates.filter((c) => !c.hold) : candidates;
  return chooseCombatCandidate(
    unit,
    progressing,
    state.round,
    unit.side === "enemy" ? normalizeGameDifficulty(state.difficulty) : "normal",
  );
}
