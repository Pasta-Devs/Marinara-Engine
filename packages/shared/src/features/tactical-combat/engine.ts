// ──────────────────────────────────────────────
// Tactical Combat — pure engine
// ──────────────────────────────────────────────
// Fire Emblem / FFT style grid battle over the classic `Combatant` model.
// Every function is pure: state in → new state out, never throwing on bad
// input (illegal actions return `{ ok: false, error }`). All randomness flows
// through `deriveSubSeed(state.seed, state.actionCounter++)`, so the same seed +
// same action sequence always reproduces the identical battle (rewind-safe,
// refresh-safe). The LLM only narrates the aftermath via `buildTacticalSummary`.

import type { CombatItemEffect } from "../../types/combat-encounter.js";
import type { Combatant, CombatSkill, CombatStatusEffect, CombatSummary } from "../../types/game.js";
import { CLASS_PROFILES, deriveClass } from "./classes.js";
import { generateGrid, placeSpawns } from "./grid-gen.js";
import {
  clamp,
  computeDamage,
  computeHeal,
  critChance,
  deriveMovement,
  elementMultiplier,
  hitChance,
  hasLineOfSight,
  inBounds,
  isImpassable,
  manhattan,
  terrainInfoAt,
} from "./math.js";
import { deterministicRng } from "./rng.js";
import type {
  ApplyActionResult,
  TacticalAction,
  TacticalCombatState,
  TacticalCoord,
  TacticalDifficulty,
  TacticalEnvironment,
  TacticalEvent,
  TacticalForecast,
  TacticalFormation,
  TacticalInventoryItem,
  TacticalManeuverProposal,
  TacticalUnit,
} from "./types.js";

const DIFFICULTIES: TacticalDifficulty[] = ["casual", "normal", "hard", "brutal"];

function normalizeDifficulty(value: string): TacticalDifficulty {
  return DIFFICULTIES.includes(value as TacticalDifficulty) ? (value as TacticalDifficulty) : "normal";
}

const ENVIRONMENTS: TacticalEnvironment[] = [
  "forest",
  "dungeon",
  "desert",
  "cave",
  "city",
  "ruins",
  "snow",
  "water",
  "castle",
  "wasteland",
  "plains",
  "mountains",
  "swamp",
  "volcanic",
  "spaceship",
  "mansion",
];

const FORMATIONS: TacticalFormation[] = ["line", "ambush", "surrounded", "skirmish", "defense"];

/** Unknown/absent environment strings normalize to undefined (default theming). */
function normalizeEnvironment(value?: string): TacticalEnvironment | undefined {
  return value && ENVIRONMENTS.includes(value as TacticalEnvironment) ? (value as TacticalEnvironment) : undefined;
}

/** Unknown/absent formation strings normalize to "line" (legacy behavior). */
function normalizeFormation(value?: string): TacticalFormation {
  return value && FORMATIONS.includes(value as TacticalFormation) ? (value as TacticalFormation) : "line";
}

// ── Unit construction ──

function combatantToUnit(c: Combatant, side: "party" | "enemy", isBoss: boolean): TacticalUnit {
  const skills = (c.skills ?? []).map((s) => ({ ...s }));
  // Class fixes reach + movement bonus once at creation; both are STORED on the
  // unit so old snapshots (missing unitClass) keep working from their stored values.
  const unitClass = deriveClass(c);
  const profile = CLASS_PROFILES[unitClass];
  return {
    id: c.id,
    name: c.name,
    side,
    hp: c.hp,
    maxHp: c.maxHp,
    mp: c.mp ?? 0,
    maxMp: c.maxMp ?? c.mp ?? 0,
    attack: c.attack,
    defense: c.defense,
    speed: c.speed,
    level: c.level,
    skills,
    statusEffects: (c.statusEffects ?? []).map((e) => ({ ...e })),
    element: c.element,
    sprite: c.sprite,
    isBoss,
    x: 0,
    y: 0,
    unitClass,
    movement: clamp(deriveMovement(c.speed) + profile.moveBonus, 2, 7),
    attackRange: { ...profile.attackRange },
    hasMoved: false,
    hasActed: false,
    defending: false,
    skillCooldowns: {},
  };
}

/**
 * Build a fresh tactical battle. Seeded: same (party, enemies, seed, difficulty)
 * always yields the identical grid + spawns. Cursor 0 of the rng stream is
 * reserved for setup; gameplay draws start at cursor 1.
 */
export function createTacticalCombat(
  party: Combatant[],
  enemies: Combatant[],
  opts: {
    seed: number;
    difficulty: string;
    environment?: string;
    formation?: string;
    inventory?: TacticalInventoryItem[];
    itemEffects?: CombatItemEffect[];
  },
): TacticalCombatState {
  const difficulty = normalizeDifficulty(opts.difficulty);
  const environment = normalizeEnvironment(opts.environment);
  const formation = normalizeFormation(opts.formation);
  const seed = opts.seed >>> 0;

  // Heuristic boss: strongest enemy when the pack is 2+ deep.
  let bossId: string | null = null;
  if (enemies.length >= 2) {
    let bestScore = -Infinity;
    for (const e of enemies) {
      const score = e.maxHp + e.level * 10 + e.attack;
      if (score > bestScore) {
        bestScore = score;
        bossId = e.id;
      }
    }
  }

  const units: TacticalUnit[] = [
    ...party.map((c) => combatantToUnit(c, "party", false)),
    ...enemies.map((c) => combatantToUnit(c, "enemy", c.id === bossId)),
  ];

  const setupRng = deterministicRng(seed, 0);
  const grid = generateGrid(units.length, setupRng, environment);
  placeSpawns(grid, units, formation, setupRng);

  const state: TacticalCombatState = {
    schemaVersion: 1,
    grid,
    units,
    phase: "player",
    round: 1,
    seed,
    actionCounter: 1,
    log: [{ kind: "phase", text: "Player Phase — Round 1", phase: "player" }],
    difficulty,
    inventory: (opts.inventory ?? [])
      .filter((item) => item && typeof item.name === "string" && item.name.trim() && item.quantity > 0)
      .map((item) => ({ name: item.name.trim(), quantity: Math.max(0, Math.floor(item.quantity)) })),
    itemEffects: (opts.itemEffects ?? []).map((effect) => ({ ...effect })),
    hazards: [],
    formation,
    ...(environment ? { environment } : {}),
  };
  return state;
}

// ── Lookups ──

export function getUnit(state: TacticalCombatState, id: string): TacticalUnit | undefined {
  return state.units.find((u) => u.id === id);
}

function aliveUnits(state: TacticalCombatState, side?: "party" | "enemy"): TacticalUnit[] {
  return state.units.filter((u) => u.hp > 0 && (side ? u.side === side : true));
}

function occupantAt(state: TacticalCombatState, x: number, y: number, exceptId?: string): TacticalUnit | undefined {
  return state.units.find((u) => u.hp > 0 && u.x === x && u.y === y && u.id !== exceptId);
}

// ── Movement ──

/**
 * Dijkstra over terrain move-costs. Can pass THROUGH living allies but never
 * enemies or impassable terrain, and cannot END on an occupied tile. Always
 * includes the unit's own tile (staying put).
 */
export function getMovementRange(state: TacticalCombatState, unitId: string): TacticalCoord[] {
  const unit = getUnit(state, unitId);
  if (!unit || unit.hp <= 0) return [];
  const { grid } = state;

  const cost = new Map<string, number>();
  const start = `${unit.x},${unit.y}`;
  cost.set(start, 0);
  const frontier = new Set<string>([start]);

  while (frontier.size) {
    // Extract the lowest-cost frontier node.
    let bestKey = "";
    let bestCost = Infinity;
    for (const key of frontier) {
      const c = cost.get(key)!;
      if (c < bestCost) {
        bestCost = c;
        bestKey = key;
      }
    }
    frontier.delete(bestKey);
    const [cx, cy] = bestKey.split(",").map(Number) as [number, number];

    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (!inBounds(grid, nx, ny) || isImpassable(grid, nx, ny)) continue;
      const blocker = occupantAt(state, nx, ny, unit.id);
      // Enemy units block traversal entirely.
      if (blocker && blocker.side !== unit.side) continue;
      const enterCost = terrainInfoAt(grid, nx, ny).moveCost;
      const newCost = bestCost + enterCost;
      if (newCost > unit.movement) continue;
      const key = `${nx},${ny}`;
      if (newCost < (cost.get(key) ?? Infinity)) {
        cost.set(key, newCost);
        frontier.add(key);
      }
    }
  }

  const out: TacticalCoord[] = [];
  for (const [key, c] of cost) {
    if (c > unit.movement) continue;
    const [x, y] = key.split(",").map(Number) as [number, number];
    // Cannot end on a tile occupied by another living unit (own tile is fine).
    if (occupantAt(state, x, y, unit.id)) continue;
    out.push({ x, y });
  }
  return out;
}

function canReach(state: TacticalCombatState, unit: TacticalUnit, to: TacticalCoord): boolean {
  if (unit.x === to.x && unit.y === to.y) return true;
  return getMovementRange(state, unit.id).some((c) => c.x === to.x && c.y === to.y);
}

// ── Targeting ──

/** Enemy-side unit ids within basic-attack range from `fromTile` (or the unit's tile). */
export function getTargetsInRange(state: TacticalCombatState, unitId: string, fromTile?: TacticalCoord): string[] {
  const unit = getUnit(state, unitId);
  if (!unit || unit.hp <= 0) return [];
  const from = fromTile ?? { x: unit.x, y: unit.y };
  return aliveUnits(state)
    .filter((t) => t.side !== unit.side)
    .filter((t) => {
      const d = manhattan(from, t);
      return d >= unit.attackRange.min && d <= unit.attackRange.max && (d <= 1 || hasLineOfSight(state.grid, from, t));
    })
    .map((t) => t.id);
}

// ── Forecast ──

function forecastFrom(
  state: TacticalCombatState,
  attacker: TacticalUnit,
  defender: TacticalUnit,
  from: TacticalCoord,
  opts: { power?: number; element?: string; hitPenalty?: number } = {},
): { damage: number; hitChance: number; critChance: number } {
  // Temporarily view the attacker as standing on `from` for terrain-independent math
  // (attacker terrain doesn't affect its own outgoing hit/damage, so position only
  // matters for range — computeDamage reads defender terrain from real coords).
  const stagedAttacker = { ...attacker, x: from.x, y: from.y };
  const hc = Math.max(0, hitChance(state.grid, stagedAttacker, defender) - (opts.hitPenalty ?? 0));
  const cc = critChance(stagedAttacker, defender);
  const dmg = computeDamage({
    grid: state.grid,
    attacker: stagedAttacker,
    defender,
    roll: 1,
    crit: false,
    difficulty: state.difficulty,
    power: opts.power,
    element: opts.element,
  });
  return { damage: dmg, hitChance: hc, critChance: cc };
}

/** FE-style forecast from the attacker's CURRENT tile. Matches `applyAction` statistically. */
export function forecastAttack(state: TacticalCombatState, attackerId: string, defenderId: string): TacticalForecast {
  const attacker = getUnit(state, attackerId);
  const defender = getUnit(state, defenderId);
  if (!attacker || !defender || attacker.side === defender.side) {
    return { damage: 0, hitChance: 0, critChance: 0, hits: 0 };
  }
  const distance = manhattan(attacker, defender);
  if (
    distance < attacker.attackRange.min ||
    distance > attacker.attackRange.max ||
    (distance > 1 && !hasLineOfSight(state.grid, attacker, defender))
  ) {
    return { damage: 0, hitChance: 0, critChance: 0, hits: 0 };
  }
  const main = forecastFrom(state, attacker, defender, { x: attacker.x, y: attacker.y });
  const forecast: TacticalForecast = { ...main, hits: 1 };

  // Counter: defender survives an expected hit and can reach back at basic range.
  const expected = defender.hp - main.damage;
  const dist = manhattan(attacker, defender);
  if (
    expected > 0 &&
    dist >= defender.attackRange.min &&
    dist <= defender.attackRange.max &&
    (dist <= 1 || hasLineOfSight(state.grid, defender, attacker))
  ) {
    forecast.counter = {
      ...forecastFrom(state, defender, attacker, { x: defender.x, y: defender.y }, { hitPenalty: 10 }),
    };
  }
  return forecast;
}

export function forecastSkill(
  state: TacticalCombatState,
  attackerId: string,
  defenderId: string,
  skillName: string,
): TacticalForecast {
  const attacker = getUnit(state, attackerId);
  const defender = getUnit(state, defenderId);
  const skill = attacker ? findSkill(attacker, skillName) : undefined;
  if (!attacker || !defender || !skill || skill.type !== "attack") {
    return { damage: 0, hitChance: 0, critChance: 0, hits: 0 };
  }
  const distance = manhattan(attacker, defender);
  const maxRange = Math.max(attacker.attackRange.max, 2);
  if (
    attacker.side === defender.side ||
    distance < 1 ||
    distance > maxRange ||
    (distance > 1 && !hasLineOfSight(state.grid, attacker, defender))
  ) {
    return { damage: 0, hitChance: 0, critChance: 0, hits: 0 };
  }
  const main = forecastFrom(
    state,
    attacker,
    defender,
    { x: attacker.x, y: attacker.y },
    {
      power: Math.max(1, skill.power),
      element: skill.element,
    },
  );
  const forecast: TacticalForecast = { ...main, hits: 1 };
  const expected = defender.hp - main.damage;
  if (expected > 0 && canCounter(state, attacker, defender)) {
    forecast.counter = {
      ...forecastFrom(state, defender, attacker, { x: defender.x, y: defender.y }, { hitPenalty: 10 }),
    };
  }
  return forecast;
}

// ── Resolution (consumes rng) ──

interface HitOptions {
  power?: number;
  element?: string;
  hitPenalty?: number;
  skillName?: string;
  isCounter?: boolean;
  statusEffect?: string;
  cooldownForStatus?: number;
}

interface HitOutcome {
  hit: boolean;
  crit: boolean;
  damage: number;
  defeated: boolean;
}

function applyStatus(target: TacticalUnit, effect: CombatStatusEffect): void {
  const existing = target.statusEffects.find((e) => e.name.toLowerCase() === effect.name.toLowerCase());
  if (existing) {
    existing.turnsLeft = Math.max(existing.turnsLeft, effect.turnsLeft);
    existing.modifier = effect.modifier;
    existing.stat = effect.stat;
  } else {
    target.statusEffects.push({ ...effect });
  }
}

/** Resolve one strike (attacker → defender). Mutates state (hp, log, actionCounter). */
function resolveHit(
  state: TacticalCombatState,
  attacker: TacticalUnit,
  defender: TacticalUnit,
  opts: HitOptions,
  events: TacticalEvent[],
): HitOutcome {
  const rng = deterministicRng(state.seed, state.actionCounter++);
  const label = opts.skillName ? `${attacker.name}'s ${opts.skillName}` : `${attacker.name}`;
  const verb = opts.isCounter ? "counters" : opts.skillName ? "strikes" : "attacks";

  const hc = Math.max(0, hitChance(state.grid, attacker, defender) - (opts.hitPenalty ?? 0));
  if (rng() * 100 >= hc) {
    events.push({
      kind: "miss",
      text: `${label} ${verb} ${defender.name} — but misses!`,
      actorId: attacker.id,
      targetId: defender.id,
      isMiss: true,
      skillName: opts.skillName,
    });
    return { hit: false, crit: false, damage: 0, defeated: false };
  }

  const cc = critChance(attacker, defender);
  const crit = rng() * 100 < cc;
  const roll = 0.9 + rng() * 0.2;
  const element = opts.element ?? attacker.element;
  const damage = computeDamage({
    grid: state.grid,
    attacker,
    defender,
    roll,
    crit,
    difficulty: state.difficulty,
    power: opts.power,
    element,
  });

  defender.hp = Math.max(0, defender.hp - damage);
  const mult = elementMultiplier(element, defender.element);
  const elementNote = mult > 1 ? " (super effective!)" : mult < 1 ? " (resisted)" : "";

  if (crit) {
    events.push({
      kind: "crit",
      text: `Critical hit! ${label} ${verb} ${defender.name} for ${damage}${elementNote}`,
      actorId: attacker.id,
      targetId: defender.id,
      amount: damage,
      isCrit: true,
      skillName: opts.skillName,
      element,
    });
  } else {
    events.push({
      kind: opts.isCounter ? "counter" : "damage",
      text: `${label} ${verb} ${defender.name} for ${damage} damage${elementNote}`,
      actorId: attacker.id,
      targetId: defender.id,
      amount: damage,
      skillName: opts.skillName,
      element,
    });
  }

  if (opts.statusEffect) {
    const status: CombatStatusEffect = {
      name: opts.statusEffect,
      modifier: -2,
      stat: "defense",
      turnsLeft: Math.max(1, opts.cooldownForStatus ?? 2),
    };
    applyStatus(defender, status);
    events.push({
      kind: "status",
      text: `${defender.name} is afflicted with ${opts.statusEffect}!`,
      targetId: defender.id,
      statusName: opts.statusEffect,
    });
  }

  const defeated = defender.hp <= 0;
  if (defeated) {
    events.push({
      kind: "defeat",
      text: `${defender.name} is defeated!`,
      targetId: defender.id,
    });
  }
  return { hit: true, crit, damage, defeated };
}

/** True if `defender` can retaliate against `attacker` after surviving a strike. */
function canCounter(state: TacticalCombatState, attacker: TacticalUnit, defender: TacticalUnit): boolean {
  if (defender.hp <= 0) return false;
  const d = manhattan(attacker, defender);
  return (
    d >= defender.attackRange.min &&
    d <= defender.attackRange.max &&
    (d <= 1 || hasLineOfSight(state.grid, defender, attacker))
  );
}

function skillReady(unit: TacticalUnit, skill: CombatSkill): boolean {
  const cd = unit.skillCooldowns[skill.name] ?? 0;
  return cd <= 0 && unit.mp >= skill.mpCost;
}

function findSkill(unit: TacticalUnit, skillName: string): CombatSkill | undefined {
  return unit.skills.find((s) => s.name.toLowerCase() === skillName.toLowerCase());
}

function resolveMovementReactions(
  state: TacticalCombatState,
  mover: TacticalUnit,
  from: TacticalCoord,
  destination: TacticalCoord,
  events: TacticalEvent[],
): void {
  for (const opponent of aliveUnits(state).filter((unit) => unit.side !== mover.side)) {
    if (mover.hp <= 0) return;
    const originDistance = manhattan(from, opponent);
    const wasInReactionRange = originDistance >= opponent.attackRange.min && originDistance <= opponent.attackRange.max;
    const movesAway = manhattan(destination, opponent) > 1;
    if (originDistance === 1 && wasInReactionRange && movesAway) {
      resolveHit(state, opponent, mover, { isCounter: true, hitPenalty: 10 }, events);
      continue;
    }
    const overwatch = opponent.statusEffects.find((effect) => effect.name === "Overwatch" && effect.turnsLeft > 0);
    const distance = manhattan(destination, opponent);
    if (
      overwatch &&
      distance >= opponent.attackRange.min &&
      distance <= opponent.attackRange.max &&
      hasLineOfSight(state.grid, opponent, destination)
    ) {
      resolveHit(state, opponent, mover, { isCounter: true, hitPenalty: 5 }, events);
      opponent.statusEffects = opponent.statusEffects.filter((effect) => effect !== overwatch);
    }
  }
}

export function getTurnSkipReason(unit: TacticalUnit): string | null {
  const status = unit.statusEffects.find((effect) =>
    ["frozen", "stunned", "imprisoned"].includes(effect.name.trim().toLowerCase()),
  );
  if (status) return `${unit.name} is ${status.name} and loses this turn.`;
  const effective =
    unit.speed +
    unit.statusEffects.filter((effect) => effect.stat === "speed").reduce((sum, effect) => sum + effect.modifier, 0);
  return effective <= 0 ? `${unit.name} cannot move and loses this turn.` : null;
}

function findItemEffect(state: TacticalCombatState, itemName: string): CombatItemEffect | undefined {
  return state.itemEffects?.find((effect) => effect.name.trim().toLowerCase() === itemName.trim().toLowerCase());
}

function findInventoryItem(state: TacticalCombatState, itemName: string): TacticalInventoryItem | undefined {
  return state.inventory?.find((item) => item.name.trim().toLowerCase() === itemName.trim().toLowerCase());
}

function itemTargetAllowed(effect: CombatItemEffect, actor: TacticalUnit, target: TacticalUnit): boolean {
  if (effect.target === "self") return actor.id === target.id;
  if (effect.target === "ally") return actor.side === target.side;
  if (effect.target === "enemy") return actor.side !== target.side;
  return true;
}

function itemStatus(effect: CombatItemEffect, fallbackName: string, positive: boolean): CombatStatusEffect {
  return {
    name: effect.status?.name || fallbackName,
    modifier: effect.status?.modifier ?? (positive ? 2 : -2),
    stat: effect.status?.stat ?? "defense",
    turnsLeft: Math.max(1, Math.floor(effect.status?.duration ?? 2)),
  };
}

interface ManeuverRoll {
  cursor: number;
  roll: number;
  success: boolean;
  partial: boolean;
  scale: number;
}

function rollManeuver(state: TacticalCombatState, actor: TacticalUnit, difficulty: number): ManeuverRoll {
  const cursor = state.actionCounter++;
  const roll = deterministicRng(state.seed, cursor)();
  const advantage = clamp((actor.speed - 5) * 0.01, -0.12, 0.12);
  const success = roll >= difficulty - advantage;
  const partial = !success && roll >= difficulty - advantage - 0.2;
  return { cursor, roll, success, partial, scale: success ? 1 : partial ? 0.5 : 0 };
}

/** Nearest living opponent the actor could actually reach this turn. */
function nearestReachableFoe(state: TacticalCombatState, actor: TacticalUnit): TacticalUnit | undefined {
  const reach = Math.max(2, actor.attackRange.max);
  return aliveUnits(state, actor.side === "party" ? "enemy" : "party")
    .filter((unit) => manhattan(actor, unit) <= reach)
    .sort((a, b) => manhattan(actor, a) - manhattan(actor, b))[0];
}

/**
 * Keyword resolution: the deterministic reading of the player's own words.
 * It runs when no GM proposal exists and when a proposal produced nothing the
 * board could accept, so `precomputed` lets the caller reuse its roll instead
 * of rolling the same maneuver twice.
 */
function resolveManeuver(
  state: TacticalCombatState,
  actor: TacticalUnit,
  action: Extract<TacticalAction, { type: "maneuver" }>,
  events: TacticalEvent[],
  precomputed?: ManeuverRoll,
): void {
  const picked = action.targetId ? getUnit(state, action.targetId) : undefined;
  const instruction = action.instruction.trim();
  const outcome = precomputed ?? rollManeuver(state, actor, picked?.isBoss ? 0.62 : 0.52);
  const { roll, success, partial, scale } = outcome;
  const lower = instruction.toLowerCase();
  const label = `${actor.name}'s maneuver`;
  const startLength = events.length;
  // Freeform maneuvers usually arrive with no target picked. A self-heal or
  // self-shield still has to land on the actor, and an offensive one falls back
  // to the nearest foe already inside the actor's reach.
  const target = picked ?? actor;
  const foe = picked ?? nearestReachableFoe(state, actor);

  if (scale > 0 && action.tile && /break|destroy|collapse|ignite|burn|freeze|flood/.test(lower)) {
    const current = state.grid.tiles[action.tile.y]?.[action.tile.x];
    const terrain = /freeze/.test(lower) && current === "water" ? "plains" : "ruin";
    state.grid.tiles[action.tile.y]![action.tile.x] = terrain;
    events.push({
      kind: "terrain",
      text: `${label} changes the terrain at (${action.tile.x}, ${action.tile.y}).`,
      actorId: actor.id,
      to: action.tile,
    });
    if (/ignite|burn|electr|poison|flood/.test(lower)) {
      state.hazards = [
        ...(state.hazards ?? []).filter((hazard) => hazard.x !== action.tile!.x || hazard.y !== action.tile!.y),
        {
          id: `hazard-${state.actionCounter}-${action.tile.x}-${action.tile.y}`,
          name: /poison/.test(lower) ? "Poison Cloud" : /electr/.test(lower) ? "Electrified Ground" : "Burning Ground",
          x: action.tile.x,
          y: action.tile.y,
          damage: Math.max(1, Math.floor(actor.attack * 0.2)),
          duration: success ? 3 : 1,
          element: /electr/.test(lower) ? "lightning" : /poison/.test(lower) ? "poison" : "fire",
        },
      ];
    }
  } else if (scale > 0 && /heal|aid|rescue|restore|tend/.test(lower)) {
    const amount = Math.max(1, Math.floor(target.maxHp * 0.2 * scale));
    const before = target.hp;
    target.hp = Math.min(target.maxHp, target.hp + amount);
    events.push({
      kind: "heal",
      text: `${label} restores ${target.hp - before} HP to ${target.name}.`,
      actorId: actor.id,
      targetId: target.id,
      amount: target.hp - before,
    });
  } else if (scale > 0 && /cover|guard|protect|shield|brace/.test(lower)) {
    const status: CombatStatusEffect = {
      name: "Maneuver Guard",
      modifier: 2,
      stat: "defense",
      turnsLeft: success ? 2 : 1,
    };
    applyStatus(target, status);
    events.push({
      kind: "status",
      text: `${label} grants ${target.name} cover.`,
      actorId: actor.id,
      targetId: target.id,
      statusName: status.name,
    });
  } else if (scale > 0 && foe && /stun|freeze|bind|trip|root|immobil/.test(lower)) {
    const status: CombatStatusEffect = {
      name: success ? "Stunned" : "Hindered",
      modifier: -999,
      stat: "speed",
      turnsLeft: success ? 1 : 1,
    };
    applyStatus(foe, status);
    events.push({
      kind: "status",
      text: `${label} leaves ${foe.name} ${status.name.toLowerCase()}.`,
      actorId: actor.id,
      targetId: foe.id,
      statusName: status.name,
    });
  } else if (scale > 0 && foe && /push|shove|knock|force|reposition/.test(lower)) {
    const dx = Math.sign(foe.x - actor.x) || 1;
    const dy = Math.sign(foe.y - actor.y);
    const destination = { x: foe.x + dx, y: foe.y + dy };
    if (
      inBounds(state.grid, destination.x, destination.y) &&
      !isImpassable(state.grid, destination.x, destination.y) &&
      !occupantAt(state, destination.x, destination.y, foe.id)
    ) {
      const from = { x: foe.x, y: foe.y };
      foe.x = destination.x;
      foe.y = destination.y;
      events.push({
        kind: "move",
        text: `${label} repositions ${foe.name}.`,
        actorId: actor.id,
        targetId: foe.id,
        from,
        to: destination,
      });
    } else {
      events.push({
        kind: "maneuver",
        text: `${label} cannot move ${foe.name} from that position.`,
        actorId: actor.id,
        targetId: foe.id,
      });
    }
  } else if (scale > 0 && foe) {
    const damage = Math.max(1, Math.floor(Math.max(actor.attack, foe.maxHp) * 0.35 * scale));
    foe.hp = Math.max(0, foe.hp - damage);
    events.push({
      kind: "damage",
      text: `${label} deals ${damage} damage to ${foe.name}.`,
      actorId: actor.id,
      targetId: foe.id,
      amount: damage,
    });
    if (foe.hp <= 0) events.push({ kind: "defeat", text: `${foe.name} is defeated!`, targetId: foe.id });
  }

  const changedSomething = events.length > startLength;
  events.push({
    kind: "maneuver",
    text:
      scale > 0 && !changedSomething
        ? `${label} plays out, but nothing on the field changes: ${instruction}`
        : success
          ? `${label} succeeds: ${instruction}`
          : partial
            ? `${label} partially succeeds: ${instruction}`
            : `${label} fails: ${instruction}`,
    actorId: actor.id,
    roll: { kind: "maneuver", value: roll, cursor: outcome.cursor },
  });
}

function resolveProposedManeuver(
  state: TacticalCombatState,
  actor: TacticalUnit,
  action: Extract<TacticalAction, { type: "maneuver" }>,
  proposal: TacticalManeuverProposal,
  events: TacticalEvent[],
): void {
  const difficulty = clamp(Number(proposal.difficulty) || 0.52, 0.05, 0.95);
  const outcome = rollManeuver(state, actor, difficulty);
  const { cursor, roll, success, scale } = outcome;
  const applied: TacticalEvent[] = [];
  // Reasons the board refused an effect, so the player learns why part of a
  // maneuver did nothing instead of just reading "fails".
  const dropped: string[] = [];
  const nearby = (tile: TacticalCoord) => manhattan(actor, tile) <= Math.max(3, actor.movement);

  if (scale > 0) {
    for (const effect of proposal.effects.slice(0, 6)) {
      const target = effect.targetId ? getUnit(state, effect.targetId) : undefined;
      if (effect.targetId && !target) {
        dropped.push("one target was not on the battlefield");
        continue;
      }
      if (effect.type === "damage" && target && target.hp > 0 && target.side !== actor.side) {
        const distance = manhattan(actor, target);
        if (distance > Math.max(2, actor.attackRange.max)) {
          dropped.push(`${target.name} was out of reach`);
          continue;
        }
        if (distance > 1 && !hasLineOfSight(state.grid, actor, target)) {
          dropped.push(`${target.name} was out of sight`);
          continue;
        }
        const cap = Math.max(1, Math.floor(Math.max(actor.attack, target.maxHp * 0.25)));
        const amount = Math.max(1, Math.floor(clamp(Number(effect.amount) || cap * 0.5, 1, cap) * scale));
        target.hp = Math.max(0, target.hp - amount);
        applied.push({
          kind: "damage",
          text: `${actor.name}'s maneuver deals ${amount} damage to ${target.name}.`,
          actorId: actor.id,
          targetId: target.id,
          amount,
        });
        if (target.hp <= 0) applied.push({ kind: "defeat", text: `${target.name} is defeated!`, targetId: target.id });
        continue;
      }
      if (effect.type === "heal" && target && target.hp > 0 && target.side === actor.side) {
        if (manhattan(actor, target) > 2) {
          dropped.push(`${target.name} was too far away to heal`);
          continue;
        }
        const cap = Math.max(1, Math.floor(Math.max(actor.attack, target.maxHp * 0.25)));
        const requested = Math.max(1, Math.floor(clamp(Number(effect.amount) || cap * 0.5, 1, cap) * scale));
        const before = target.hp;
        target.hp = Math.min(target.maxHp, target.hp + requested);
        const amount = target.hp - before;
        if (amount > 0) {
          applied.push({
            kind: "heal",
            text: `${actor.name}'s maneuver restores ${amount} HP to ${target.name}.`,
            actorId: actor.id,
            targetId: target.id,
            amount,
          });
        }
        continue;
      }
      if (effect.type === "status" && target && target.hp > 0 && effect.status) {
        if (manhattan(actor, target) > 2) {
          dropped.push(`${target.name} was too far away to affect`);
          continue;
        }
        const status: CombatStatusEffect = {
          name: effect.status.name.trim().slice(0, 80) || "Maneuver Effect",
          modifier: clamp(Number(effect.status.modifier) || 0, -5, 5),
          stat: effect.status.stat,
          turnsLeft: Math.max(1, Math.min(3, Math.floor(effect.status.turnsLeft || 1))),
        };
        if (target.side === actor.side && status.modifier < 0) status.modifier = 0;
        if (target.side !== actor.side && status.modifier > 0) status.modifier = 0;
        applyStatus(target, status);
        applied.push({
          kind: "status",
          text: `${actor.name}'s maneuver applies ${status.name} to ${target.name}.`,
          actorId: actor.id,
          targetId: target.id,
          statusName: status.name,
        });
        continue;
      }
      if (effect.type === "move" && target && target.hp > 0 && effect.tile && nearby(effect.tile)) {
        const destination = effect.tile;
        if (
          manhattan(target, destination) <= 2 &&
          inBounds(state.grid, destination.x, destination.y) &&
          !isImpassable(state.grid, destination.x, destination.y) &&
          !occupantAt(state, destination.x, destination.y, target.id)
        ) {
          const from = { x: target.x, y: target.y };
          target.x = destination.x;
          target.y = destination.y;
          applied.push({
            kind: "move",
            text: `${actor.name}'s maneuver repositions ${target.name}.`,
            actorId: actor.id,
            targetId: target.id,
            from,
            to: destination,
          });
        } else {
          dropped.push(`${target.name} could not be moved there`);
        }
        continue;
      }
      if ((effect.type === "cover" || effect.type === "terrain") && effect.tile && nearby(effect.tile)) {
        const tile = effect.tile;
        if (!inBounds(state.grid, tile.x, tile.y) || occupantAt(state, tile.x, tile.y)) {
          dropped.push(`the tile at (${tile.x}, ${tile.y}) was not clear`);
          continue;
        }
        const terrain = effect.type === "cover" ? "forest" : effect.terrain;
        if (!terrain) {
          dropped.push("a terrain change had no terrain to apply");
          continue;
        }
        state.grid.tiles[tile.y]![tile.x] = terrain;
        applied.push({
          kind: "terrain",
          text: `${actor.name}'s maneuver changes the terrain at (${tile.x}, ${tile.y}) to ${terrain}.`,
          actorId: actor.id,
          to: tile,
        });
        continue;
      }
      // Objective progress is reconciled against the session's objective list,
      // so an id the player never tapped is safe to forward: only a real active
      // objective can consume it.
      if (effect.type === "objective" && effect.objectiveId) {
        applied.push({
          kind: "objective",
          text: `${actor.name}'s maneuver advances ${effect.objectiveId}.`,
          actorId: actor.id,
          objectiveId: effect.objectiveId,
          objectiveProgress: scale,
        });
        continue;
      }
      dropped.push(`a ${effect.type} effect did not fit the battlefield`);
    }
  }

  if (applied.length === 0 && scale > 0) {
    // The roll landed but nothing the GM proposed could touch the board. Read
    // the player's own words instead of reporting a failure they cannot learn
    // from, reusing this maneuver's roll so the turn is decided only once.
    resolveManeuver(state, actor, action, events, outcome);
    return;
  }

  const actualOutcome = applied.length > 0 ? (success ? "succeeds" : "partially succeeds") : "fails";
  events.push(...applied, {
    kind: "maneuver",
    text:
      applied.length > 0 && proposal.narration.trim()
        ? `${actor.name}'s maneuver ${actualOutcome}: ${proposal.narration.trim()}`
        : `${actor.name}'s maneuver ${actualOutcome}: ${action.instruction}`,
    actorId: actor.id,
    roll: { kind: "maneuver", value: roll, cursor },
  });
  if (dropped.length > 0) {
    events.push({
      kind: "maneuver",
      text: `Part of the maneuver could not take effect: ${dropped[0]}.`,
      actorId: actor.id,
    });
  }
}

// ── Core action application (shared by player + AI) ──

/**
 * Apply a single unit action (move+act flow) with NO legality pre-checks beyond
 * the essentials — used internally by both player `applyAction` and the AI.
 * Mutates `state`. Returns events. Assumes `unit` is alive and it's a legal
 * moment for it to act.
 */
function performUnitAction(
  state: TacticalCombatState,
  unit: TacticalUnit,
  action: Extract<TacticalAction, { unitId: string }>,
  events: TacticalEvent[],
  maneuverProposal?: TacticalManeuverProposal,
): void {
  // Optional move-then-act.
  const to = "to" in action ? action.to : undefined;
  if (action.type === "move" || to) {
    const dest = action.type === "move" ? action.to : to!;
    if (dest && (dest.x !== unit.x || dest.y !== unit.y)) {
      const from = { x: unit.x, y: unit.y };
      resolveMovementReactions(state, unit, from, dest, events);
      if (unit.hp <= 0) {
        unit.hasMoved = true;
        unit.hasActed = true;
        return;
      }
      unit.x = dest.x;
      unit.y = dest.y;
      unit.hasMoved = true;
      events.push({
        kind: "move",
        text: `${unit.name} moves to (${dest.x}, ${dest.y}).`,
        actorId: unit.id,
        from,
        to: dest,
      });
    }
  }

  switch (action.type) {
    case "move":
      unit.hasMoved = true;
      return;

    case "wait":
      unit.hasActed = true;
      events.push({ kind: "status", text: `${unit.name} waits.`, actorId: unit.id });
      return;

    case "defend":
      unit.defending = true;
      unit.hasActed = true;
      events.push({ kind: "status", text: `${unit.name} braces for impact (defending).`, actorId: unit.id });
      return;

    case "attack": {
      const target = getUnit(state, action.targetId);
      unit.hasActed = true;
      if (!target || target.hp <= 0) return;
      const outcome = resolveHit(state, unit, target, {}, events);
      // Counterattack.
      if (outcome.hit && !outcome.defeated && canCounter(state, unit, target)) {
        resolveHit(state, target, unit, { isCounter: true, hitPenalty: 10 }, events);
      }
      return;
    }

    case "item": {
      const target = getUnit(state, action.targetId);
      unit.hasActed = true;
      if (!target) return;
      const effect = findItemEffect(state, action.itemName);
      const inventoryItem = findInventoryItem(state, action.itemName);
      if (!effect || !inventoryItem) return;
      if (effect.type === "heal") {
        const power = Math.max(0.05, Math.min(2.5, Number(effect.power) || 0.3));
        const desired = Math.max(1, Math.floor(target.maxHp * power));
        const before = target.hp;
        target.hp = Math.min(target.maxHp, target.hp + desired);
        events.push({
          kind: "heal",
          text: `${unit.name} uses ${action.itemName} on ${target.name}, restoring ${target.hp - before} HP.`,
          actorId: unit.id,
          targetId: target.id,
          amount: target.hp - before,
          element: effect.element,
        });
      } else if (effect.type === "damage") {
        const power = Math.max(0.05, Math.min(2.5, Number(effect.power) || 0.25));
        const damage = Math.max(1, Math.floor(Math.max(unit.attack, target.maxHp) * power));
        target.hp = Math.max(0, target.hp - damage);
        events.push({
          kind: "damage",
          text: `${unit.name} uses ${action.itemName} on ${target.name} for ${damage} damage.`,
          actorId: unit.id,
          targetId: target.id,
          amount: damage,
          element: effect.element,
        });
        if (target.hp <= 0) events.push({ kind: "defeat", text: `${target.name} is defeated!`, targetId: target.id });
      } else if (effect.type === "buff" || effect.type === "debuff" || effect.type === "status") {
        const status = itemStatus(effect, action.itemName, effect.type === "buff");
        applyStatus(target, status);
        events.push({
          kind: "status",
          text: `${unit.name} uses ${action.itemName} on ${target.name}, applying ${status.name}.`,
          actorId: unit.id,
          targetId: target.id,
          statusName: status.name,
        });
      } else {
        events.push({
          kind: "item",
          text: `${unit.name} uses ${action.itemName}.`,
          actorId: unit.id,
          targetId: target.id,
        });
      }
      if (effect.consumes !== false) inventoryItem.quantity = Math.max(0, inventoryItem.quantity - 1);
      return;
    }

    case "overwatch": {
      unit.hasActed = true;
      // Enemy Overwatch is created immediately before the round tick, so it needs
      // one extra duration to remain armed through the following player phase.
      applyStatus(unit, { name: "Overwatch", modifier: 0, stat: "speed", turnsLeft: unit.side === "enemy" ? 2 : 1 });
      events.push({
        kind: "status",
        text: `${unit.name} watches for enemy movement.`,
        actorId: unit.id,
        targetId: unit.id,
        statusName: "Overwatch",
      });
      return;
    }

    case "maneuver": {
      unit.hasActed = true;
      const target = action.targetId ? getUnit(state, action.targetId) : undefined;
      if (maneuverProposal) resolveProposedManeuver(state, unit, action, maneuverProposal, events);
      else resolveManeuver(state, unit, action, events);
      if (target && target.side !== unit.side && target.hp > 0 && canCounter(state, unit, target)) {
        resolveHit(state, target, unit, { isCounter: true, hitPenalty: 15 }, events);
      }
      return;
    }

    case "skill": {
      unit.hasActed = true;
      const skill = findSkill(unit, action.skillName);
      if (!skill) return;
      if (!skillReady(unit, skill)) {
        // Illegal at the AI layer shouldn't happen; fall back to a basic strike is avoided here.
        return;
      }
      unit.mp = Math.max(0, unit.mp - skill.mpCost);
      unit.skillCooldowns[skill.name] = Math.max(1, skill.cooldown ?? 1);

      if (skill.type === "heal") {
        const target = getUnit(state, action.targetId ?? unit.id) ?? unit;
        const amount = computeHeal(unit, skill.power);
        const before = target.hp;
        target.hp = Math.min(target.maxHp, target.hp + amount);
        events.push({
          kind: "heal",
          text: `${unit.name} casts ${skill.name}, healing ${target.name} for ${target.hp - before} HP.`,
          actorId: unit.id,
          targetId: target.id,
          amount: target.hp - before,
          skillName: skill.name,
        });
        return;
      }

      if (skill.type === "buff" || skill.type === "debuff") {
        const target = getUnit(state, action.targetId ?? unit.id) ?? unit;
        const isBuff = skill.type === "buff";
        const status: CombatStatusEffect = {
          name: skill.statusEffect || skill.name,
          modifier: isBuff ? 2 : -2,
          stat: "defense",
          turnsLeft: Math.max(2, skill.cooldown ?? 2),
        };
        applyStatus(target, status);
        events.push({
          kind: "status",
          text: `${unit.name} casts ${skill.name} on ${target.name} (${isBuff ? "buff" : "debuff"}: ${status.name}).`,
          actorId: unit.id,
          targetId: target.id,
          skillName: skill.name,
          statusName: status.name,
        });
        return;
      }

      // Attack skill.
      const target = getUnit(state, action.targetId ?? "");
      if (!target || target.hp <= 0) return;
      const outcome = resolveHit(
        state,
        unit,
        target,
        {
          power: Math.max(1, skill.power),
          element: skill.element,
          skillName: skill.name,
          statusEffect: skill.statusEffect,
          cooldownForStatus: skill.cooldown,
        },
        events,
      );
      if (outcome.hit && !outcome.defeated && canCounter(state, unit, target)) {
        resolveHit(state, target, unit, { isCounter: true, hitPenalty: 10 }, events);
      }
      return;
    }

    default:
      return;
  }
}

// ── Round management ──

function tickRound(state: TacticalCombatState, events: TacticalEvent[]): void {
  for (const u of state.units) {
    if (u.hp <= 0) {
      u.statusEffects = [];
      continue;
    }
    // HP-over-time effects, then decrement durations.
    const remaining: CombatStatusEffect[] = [];
    for (const e of u.statusEffects) {
      if (e.stat === "hp") {
        const before = u.hp;
        u.hp = Math.min(u.maxHp, Math.max(0, u.hp + e.modifier));
        if (u.hp !== before) {
          events.push({
            kind: e.modifier < 0 ? "damage" : "heal",
            text: `${u.name} ${e.modifier < 0 ? "takes" : "recovers"} ${Math.abs(u.hp - before)} from ${e.name}.`,
            targetId: u.id,
            amount: Math.abs(u.hp - before),
            statusName: e.name,
          });
        }
      }
      const next = { ...e, turnsLeft: e.turnsLeft - 1 };
      if (next.turnsLeft > 0) remaining.push(next);
    }
    u.statusEffects = remaining;

    // Tick cooldowns.
    for (const key of Object.keys(u.skillCooldowns)) {
      u.skillCooldowns[key] = Math.max(0, (u.skillCooldowns[key] ?? 0) - 1);
      if (u.skillCooldowns[key] === 0) delete u.skillCooldowns[key];
    }

    u.hasMoved = false;
    u.hasActed = false;
    u.defending = false;
  }
  const remainingHazards: NonNullable<TacticalCombatState["hazards"]> = [];
  for (const hazard of state.hazards ?? []) {
    const occupant = occupantAt(state, hazard.x, hazard.y);
    if (occupant) {
      occupant.hp = Math.max(0, occupant.hp - hazard.damage);
      events.push({
        kind: "terrain",
        text: `${occupant.name} takes ${hazard.damage} damage from ${hazard.name}.`,
        targetId: occupant.id,
        amount: hazard.damage,
        element: hazard.element,
        to: { x: hazard.x, y: hazard.y },
      });
    }
    const next = { ...hazard, duration: hazard.duration - 1 };
    if (next.duration > 0) remainingHazards.push(next);
  }
  state.hazards = remainingHazards;
}

export interface TacticalTerminalOptions {
  allowNoEnemies?: boolean;
}

function checkTerminal(
  state: TacticalCombatState,
  events: TacticalEvent[],
  options: TacticalTerminalOptions = {},
): boolean {
  if (state.outcome) return true;
  const partyAlive = aliveUnits(state, "party").length;
  const enemyAlive = aliveUnits(state, "enemy").length;
  if (enemyAlive === 0 && !options.allowNoEnemies) {
    state.outcome = "victory";
    events.push({ kind: "victory", text: "Victory! All enemies have fallen." });
    return true;
  }
  if (partyAlive === 0) {
    state.outcome = "defeat";
    events.push({ kind: "defeat-end", text: "Defeat... the party has been wiped out." });
    return true;
  }
  return false;
}

export function isTerminal(state: TacticalCombatState, options: TacticalTerminalOptions = {}): boolean {
  if (state.outcome) return true;
  return (
    aliveUnits(state, "party").length === 0 || (!options.allowNoEnemies && aliveUnits(state, "enemy").length === 0)
  );
}

// ── Player-facing action entry point ──

// The battle log is UI-only (never read back by engine logic), but the full
// state round-trips through the server, whose request schema bounds the log
// array. Cap it well under that envelope so a marathon battle can never grow
// a state the server would reject.
const MAX_LOG_ENTRIES = 1000;

function appendLog(state: TacticalCombatState, events: TacticalEvent[]): void {
  state.log.push(...events);
  if (state.log.length > MAX_LOG_ENTRIES) {
    state.log = state.log.slice(-MAX_LOG_ENTRIES);
  }
}

function clone(state: TacticalCombatState): TacticalCombatState {
  // State is plain JSON (numbers/strings/arrays/objects) so a JSON round-trip is
  // a safe, deterministic deep clone and avoids depending on structuredClone lib types.
  return JSON.parse(JSON.stringify(state)) as TacticalCombatState;
}

/**
 * Validate + apply a player action. Never throws — illegal input returns
 * `{ ok: false, error }`. On a turn-ending action that leaves every party unit
 * acted, the phase auto-advances to "enemy" (the caller then runs
 * `runEnemyPhase`).
 */
export function applyAction(
  state: TacticalCombatState,
  action: TacticalAction,
  maneuverProposal?: TacticalManeuverProposal,
  terminalOptions: TacticalTerminalOptions = {},
): ApplyActionResult {
  if (isTerminal(state, terminalOptions)) return { ok: false, error: "The battle is already over." };

  const next = clone(state);
  const events: TacticalEvent[] = [];

  // Phase-level actions.
  if (action.type === "flee") {
    next.outcome = "fled";
    events.push({ kind: "flee", text: "The party retreats from battle." });
    appendLog(next, events);
    return { ok: true, state: next, events };
  }

  if (action.type === "endTurn") {
    if (next.phase !== "player") return { ok: false, error: "Not the player phase." };
    for (const u of aliveUnits(next, "party")) u.hasActed = true;
    next.phase = "enemy";
    events.push({ kind: "phase", text: "Enemy Phase", phase: "enemy" });
    appendLog(next, events);
    return { ok: true, state: next, events };
  }

  // Unit actions.
  if (next.phase !== "player") return { ok: false, error: "Not the player phase." };
  const unit = getUnit(next, action.unitId);
  if (!unit) return { ok: false, error: `Unknown unit: ${action.unitId}` };
  if (unit.hp <= 0) return { ok: false, error: `${unit.name} is defeated.` };
  if (unit.side !== "party") return { ok: false, error: "You can only command party units." };
  if (unit.hasActed) return { ok: false, error: `${unit.name} has already acted this turn.` };

  const skipReason = getTurnSkipReason(unit);
  if (skipReason) {
    unit.hasActed = true;
    events.push({ kind: "status", text: skipReason, actorId: unit.id });
    const anyPending = aliveUnits(next, "party").some((candidate) => !candidate.hasActed);
    if (!anyPending) {
      next.phase = "enemy";
      events.push({ kind: "phase", text: "Enemy Phase", phase: "enemy" });
    }
    appendLog(next, events);
    return { ok: true, state: next, events };
  }

  // Validate optional move (move-then-act) or dedicated move.
  const dest = action.type === "move" ? action.to : "to" in action ? action.to : undefined;
  if (dest && (dest.x !== unit.x || dest.y !== unit.y)) {
    if (unit.hasMoved) return { ok: false, error: `${unit.name} has already moved this turn.` };
    if (!inBounds(next.grid, dest.x, dest.y)) return { ok: false, error: "Destination is off the map." };
    if (!canReach(next, unit, dest)) return { ok: false, error: "That tile is out of movement range." };
  }

  // Effective attacker tile after the optional move.
  const fromTile: TacticalCoord = dest ?? { x: unit.x, y: unit.y };

  switch (action.type) {
    case "move":
      if (!dest) return { ok: false, error: "Move action needs a destination." };
      if (dest.x === unit.x && dest.y === unit.y) return { ok: false, error: "Already on that tile." };
      break;

    case "attack": {
      const target = getUnit(next, action.targetId);
      if (!target || target.hp <= 0) return { ok: false, error: "Invalid attack target." };
      if (target.side === unit.side) return { ok: false, error: "Cannot attack an ally." };
      const d = manhattan(fromTile, target);
      if (d < unit.attackRange.min || d > unit.attackRange.max) {
        return { ok: false, error: `${target.name} is out of attack range.` };
      }
      if (d > 1 && !hasLineOfSight(next.grid, fromTile, target)) {
        return { ok: false, error: `${target.name} is outside line of sight.` };
      }
      break;
    }

    case "skill": {
      const skill = findSkill(unit, action.skillName);
      if (!skill) return { ok: false, error: `Unknown skill: ${action.skillName}` };
      if ((unit.skillCooldowns[skill.name] ?? 0) > 0) return { ok: false, error: `${skill.name} is on cooldown.` };
      if (unit.mp < skill.mpCost) return { ok: false, error: `Not enough MP for ${skill.name}.` };
      if (skill.type === "attack") {
        const target = getUnit(next, action.targetId ?? "");
        if (!target || target.hp <= 0 || target.side === unit.side) {
          return { ok: false, error: "Invalid skill target." };
        }
        const d = manhattan(fromTile, target);
        const max = Math.max(unit.attackRange.max, 2);
        if (d < 1 || d > max) return { ok: false, error: `${target.name} is out of skill range.` };
        if (d > 1 && !hasLineOfSight(next.grid, fromTile, target)) {
          return { ok: false, error: `${target.name} is outside line of sight.` };
        }
      } else {
        // heal/buff/debuff — must target a valid unit (ally for heal/buff, enemy for debuff) within support range.
        const target = getUnit(next, action.targetId ?? unit.id);
        if (!target || target.hp <= 0) return { ok: false, error: "Invalid skill target." };
        const wantAlly = skill.type !== "debuff";
        if (wantAlly && target.side !== unit.side) return { ok: false, error: "That skill targets allies." };
        if (!wantAlly && target.side === unit.side) return { ok: false, error: "That skill targets enemies." };
        const d = manhattan(fromTile, target);
        if (d > 2) return { ok: false, error: `${target.name} is out of support range.` };
      }
      break;
    }

    case "item": {
      const target = getUnit(next, action.targetId);
      if (!target || target.hp <= 0) return { ok: false, error: "Invalid item target." };
      const inventoryItem = findInventoryItem(next, action.itemName);
      if (!inventoryItem || inventoryItem.quantity <= 0)
        return { ok: false, error: `${action.itemName} is not available.` };
      const effect = findItemEffect(next, action.itemName);
      if (!effect) return { ok: false, error: `${action.itemName} has no combat effect.` };
      if (!itemTargetAllowed(effect, unit, target))
        return { ok: false, error: `${action.itemName} cannot target ${target.name}.` };
      const d = manhattan(fromTile, target);
      if (d > 2) return { ok: false, error: `${target.name} is out of item range.` };
      break;
    }

    case "maneuver": {
      if (action.instruction.trim().length < 3) return { ok: false, error: "Describe the maneuver first." };
      if (action.instruction.length > 500) return { ok: false, error: "Maneuver is too long." };
      if (action.targetId) {
        const target = getUnit(next, action.targetId);
        if (!target || target.hp <= 0) return { ok: false, error: "Invalid maneuver target." };
      }
      if (action.tile && !inBounds(next.grid, action.tile.x, action.tile.y)) {
        return { ok: false, error: "That maneuver tile is not usable." };
      }
      break;
    }

    case "defend":
    case "overwatch":
    case "wait":
      break;
  }

  performUnitAction(next, unit, action, events, maneuverProposal);

  // Terminal check (an attack may have wiped the enemy team mid-phase).
  if (!checkTerminal(next, events, terminalOptions)) {
    // Auto-advance to enemy phase once every living party unit has acted.
    const anyPending = aliveUnits(next, "party").some((u) => !u.hasActed);
    if (!anyPending) {
      next.phase = "enemy";
      events.push({ kind: "phase", text: "Enemy Phase", phase: "enemy" });
    }
  }

  appendLog(next, events);
  return { ok: true, state: next, events };
}

// ── Summary ──

/** Post-battle summary in the EXACT classic `CombatSummary` shape (drives GM narration). */
export function buildTacticalSummary(state: TacticalCombatState): CombatSummary {
  const outcome: CombatSummary["outcome"] =
    state.outcome === "fled" ? "flee" : state.outcome === "defeat" ? "defeat" : "victory";
  return {
    outcome,
    rounds: state.round,
    party: state.units
      .filter((u) => u.side === "party")
      .map((u) => ({
        id: u.id,
        name: u.name,
        hp: u.hp,
        maxHp: u.maxHp,
        mp: u.mp,
        maxMp: u.maxMp,
        ko: u.hp <= 0,
        statusEffects: (u.statusEffects ?? []).map((e) => e.name),
      })),
    enemies: state.units
      .filter((u) => u.side === "enemy")
      .map((u) => ({
        id: u.id,
        name: u.name,
        defeated: u.hp <= 0,
        hp: u.hp,
        maxHp: u.maxHp,
      })),
  };
}

// Internal helpers re-exported for the AI module (ai.ts imports these directly,
// NOT via the feature's public index.ts — keeps the shared public surface clean).
export {
  aliveUnits,
  appendLog,
  canCounter,
  checkTerminal,
  clone,
  findSkill,
  forecastFrom,
  performUnitAction,
  skillReady,
  tickRound,
};
