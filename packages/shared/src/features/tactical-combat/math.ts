// ──────────────────────────────────────────────
// Tactical Combat — pure combat math
// ──────────────────────────────────────────────
// Stateless helpers: distance, terrain lookups, stat-derived movement / range,
// the element multiplier table (mirrors the classic element wheel, simplified
// to strong 1.5x / weak 0.5x per the plan), and the hit / crit / damage
// formulas. Kept separate from engine.ts so both the resolver and the forecast
// compute from the exact same primitives (forecast MUST match applyAction
// statistically).

import type { CombatStatusEffect } from "../../types/game.js";
import { CLASS_PROFILES } from "./classes.js";
import {
  TERRAIN_DATA,
  type TacticalCoord,
  type TacticalDifficulty,
  type TacticalGrid,
  type TacticalTerrain,
  type TacticalUnit,
} from "./types.js";

export function clamp(value: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, value));
}

export function manhattan(a: TacticalCoord, b: TacticalCoord): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export function inBounds(grid: TacticalGrid, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < grid.width && y < grid.height;
}

export function terrainAt(grid: TacticalGrid, x: number, y: number): TacticalTerrain {
  if (!inBounds(grid, x, y)) return "wall";
  return grid.tiles[y]![x]!;
}

export function terrainInfoAt(grid: TacticalGrid, x: number, y: number) {
  return TERRAIN_DATA[terrainAt(grid, x, y)];
}

export function isImpassable(grid: TacticalGrid, x: number, y: number): boolean {
  return !!terrainInfoAt(grid, x, y).impassable;
}

export function hasLineOfSight(grid: TacticalGrid, from: TacticalCoord, to: TacticalCoord): boolean {
  let x = from.x;
  let y = from.y;
  const dx = Math.abs(to.x - from.x);
  const dy = Math.abs(to.y - from.y);
  const stepX = from.x < to.x ? 1 : -1;
  const stepY = from.y < to.y ? 1 : -1;
  let error = dx - dy;
  while (x !== to.x || y !== to.y) {
    const doubled = error * 2;
    if (doubled > -dy) {
      error -= dy;
      x += stepX;
    }
    if (doubled < dx) {
      error += dx;
      y += stepY;
    }
    if (x === to.x && y === to.y) return true;
    const terrain = terrainAt(grid, x, y);
    if (terrain === "wall" || terrain === "mountain") return false;
  }
  return true;
}

/** Movement points per turn from speed (class moveBonus is applied at unit creation). */
export function deriveMovement(speed: number): number {
  return clamp(3 + Math.floor(speed / 10), 3, 6);
}

// ── Difficulty ──

/** Classic combat difficulty multipliers (combat.service.ts). Applied to ENEMY damage in tactical. */
export const DIFFICULTY_DAMAGE_MULT: Record<TacticalDifficulty, number> = {
  casual: 0.6,
  normal: 1.0,
  hard: 1.3,
  brutal: 1.6,
};

// ── Elements ──
// Simplified wheel over the classic six elements. Fire/Ice/Lightning form a
// rock-paper-scissors trio; Holy and Shadow are mutually super-effective;
// Poison is neutral. strong = 1.5x, weak = 0.5x, otherwise 1.0x.

const STRONG_AGAINST: Record<string, string[]> = {
  fire: ["ice"],
  ice: ["lightning"],
  lightning: ["fire"],
  holy: ["shadow"],
  shadow: ["holy"],
  poison: [],
};

const WEAK_AGAINST: Record<string, string[]> = {
  fire: ["lightning"],
  ice: ["fire"],
  lightning: ["ice"],
  holy: [],
  shadow: [],
  poison: [],
};

export function elementMultiplier(attackElement?: string, defenderElement?: string): number {
  if (!attackElement || !defenderElement) return 1;
  const a = attackElement.toLowerCase();
  const d = defenderElement.toLowerCase();
  if (a === d) return 1;
  if (STRONG_AGAINST[a]?.includes(d)) return 1.5;
  if (WEAK_AGAINST[a]?.includes(d)) return 0.5;
  return 1;
}

// ── Status-effect derived stats ──

export function activeEffects(unit: TacticalUnit): CombatStatusEffect[] {
  return (unit.statusEffects ?? []).filter((e) => e.turnsLeft > 0);
}

function statModifier(unit: TacticalUnit, stat: CombatStatusEffect["stat"]): number {
  return activeEffects(unit)
    .filter((e) => e.stat === stat)
    .reduce((sum, e) => sum + e.modifier, 0);
}

export function effectiveAttack(unit: TacticalUnit): number {
  return Math.max(1, unit.attack + statModifier(unit, "attack"));
}

export function effectiveDefense(unit: TacticalUnit): number {
  return Math.max(0, unit.defense + statModifier(unit, "defense"));
}

export function effectiveSpeed(unit: TacticalUnit): number {
  return Math.max(0, unit.speed + statModifier(unit, "speed"));
}

// ── Hit / crit / damage ──

export function terrainAvoid(grid: TacticalGrid, unit: TacticalUnit): number {
  return terrainInfoAt(grid, unit.x, unit.y).avoidBonus;
}

/** 0–100 chance the attack lands. */
export function hitChance(grid: TacticalGrid, attacker: TacticalUnit, defender: TacticalUnit): number {
  const heightBonus = Math.max(
    -10,
    Math.min(
      10,
      (terrainInfoAt(grid, attacker.x, attacker.y).height - terrainInfoAt(grid, defender.x, defender.y).height) * 10,
    ),
  );
  const raw =
    80 +
    (effectiveSpeed(attacker) - effectiveSpeed(defender)) * 2 -
    terrainAvoid(grid, defender) -
    (defender.defending ? 10 : 0) +
    heightBonus;
  return clamp(Math.round(raw), 30, 100);
}

/** 0–60 chance of a x2 critical. Adds the attacker's class crit bonus (absent class → fighter, +0). */
export function critChance(attacker: TacticalUnit, defender: TacticalUnit): number {
  const critBonus = CLASS_PROFILES[attacker.unitClass ?? "fighter"].critBonus;
  return clamp(Math.round(5 + Math.max(0, effectiveSpeed(attacker) - effectiveSpeed(defender)) + critBonus), 0, 60);
}

export interface DamageInputs {
  grid: TacticalGrid;
  attacker: TacticalUnit;
  defender: TacticalUnit;
  /** Damage roll in [0.9, 1.1]. Use 1.0 for expected/forecast. */
  roll: number;
  crit: boolean;
  difficulty: TacticalDifficulty;
  /** Skill power multiplier against the attack stat (basic attack = 1). */
  power?: number;
  /** Element carried by this strike (skill element overrides unit element). */
  element?: string;
}

/**
 * Damage for a single landed strike. Deterministic given inputs.
 * base = attack*power*roll, scaled by level difference (±50% cap), minus
 * defense*0.6 + terrainDef*2; then element, crit (x2), defending (halve), and
 * enemy-side difficulty multiplier. Floors to >= 1.
 */
export function computeDamage(inp: DamageInputs): number {
  const { grid, attacker, defender, roll, crit, difficulty } = inp;
  const power = inp.power ?? 1;
  const element = inp.element ?? attacker.element;

  const base = effectiveAttack(attacker) * power * roll;
  const levelScale = clamp(1 + (attacker.level - defender.level) * 0.05, 0.5, 1.5);
  const raw = base * levelScale;

  const defTile = terrainInfoAt(grid, defender.x, defender.y);
  const mitigation = effectiveDefense(defender) * 0.6 + defTile.defenseBonus * 2;

  let dmg = raw - mitigation;
  const heightDelta = terrainInfoAt(grid, attacker.x, attacker.y).height - defTile.height;
  if (heightDelta > 0) dmg *= 1 + Math.min(0.25, heightDelta * 0.1);
  dmg *= elementMultiplier(element, defender.element);
  if (crit) dmg *= 2;
  if (defender.defending) dmg *= 0.5;
  if (attacker.side === "enemy") dmg *= DIFFICULTY_DAMAGE_MULT[difficulty];

  return Math.max(1, Math.floor(dmg));
}

/** Heal amount for a heal skill (mirrors classic resolveSkillAction heal math). */
export function computeHeal(caster: TacticalUnit, power: number): number {
  return Math.max(1, Math.floor((effectiveAttack(caster) + caster.level * 2) * Math.max(power, 0.5)));
}
