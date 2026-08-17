// ──────────────────────────────────────────────
// Tactical Combat — pure engine
// ──────────────────────────────────────────────
// Fire Emblem / FFT style grid battle over the classic `Combatant` model.
// Every function is pure: state in → new state out, never throwing on bad
// input (illegal actions return `{ ok: false, error }`). All randomness flows
// through `deriveSubSeed(state.seed, state.actionCounter++)`, so the same seed +
// same action sequence always reproduces the identical battle (rewind-safe,
// refresh-safe). The LLM only narrates the aftermath via `buildTacticalSummary`.

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
  opts: { seed: number; difficulty: string; environment?: string; formation?: string },
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
      return d >= unit.attackRange.min && d <= unit.attackRange.max;
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
  const hc = Math.max(0, hitChance(state.grid, attacker, defender) - (opts.hitPenalty ?? 0));
  const cc = critChance(attacker, defender);
  const dmg = computeDamage({
    grid: state.grid,
    attacker,
    defender,
    roll: 1,
    crit: false,
    difficulty: state.difficulty,
    power: opts.power,
    element: opts.element,
  });
  void from;
  return { damage: dmg, hitChance: hc, critChance: cc };
}

/** FE-style forecast from the attacker's CURRENT tile. Matches `applyAction` statistically. */
export function forecastAttack(state: TacticalCombatState, attackerId: string, defenderId: string): TacticalForecast {
  const attacker = getUnit(state, attackerId);
  const defender = getUnit(state, defenderId);
  if (!attacker || !defender) {
    return { damage: 0, hitChance: 0, critChance: 0, hits: 0 };
  }
  const main = forecastFrom(state, attacker, defender, { x: attacker.x, y: attacker.y });
  const forecast: TacticalForecast = { ...main, hits: 1 };

  // Counter: defender survives an expected hit and can reach back at basic range.
  const expected = defender.hp - main.damage;
  const dist = manhattan(attacker, defender);
  if (expected > 0 && dist >= defender.attackRange.min && dist <= defender.attackRange.max) {
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
function canCounter(attacker: TacticalUnit, defender: TacticalUnit): boolean {
  if (defender.hp <= 0) return false;
  const d = manhattan(attacker, defender);
  return d >= defender.attackRange.min && d <= defender.attackRange.max;
}

function skillReady(unit: TacticalUnit, skill: CombatSkill): boolean {
  const cd = unit.skillCooldowns[skill.name] ?? 0;
  return cd <= 0 && unit.mp >= skill.mpCost;
}

function findSkill(unit: TacticalUnit, skillName: string): CombatSkill | undefined {
  return unit.skills.find((s) => s.name.toLowerCase() === skillName.toLowerCase());
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
): void {
  // Optional move-then-act.
  const to = "to" in action ? action.to : undefined;
  if (action.type === "move" || to) {
    const dest = action.type === "move" ? action.to : to!;
    if (dest && (dest.x !== unit.x || dest.y !== unit.y)) {
      const from = { x: unit.x, y: unit.y };
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
      if (outcome.hit && !outcome.defeated && canCounter(unit, target)) {
        resolveHit(state, target, unit, { isCounter: true, hitPenalty: 10 }, events);
      }
      return;
    }

    case "item": {
      const target = getUnit(state, action.targetId);
      unit.hasActed = true;
      if (!target) return;
      const heal = Math.max(1, Math.floor(target.maxHp * 0.3));
      const before = target.hp;
      target.hp = Math.min(target.maxHp, target.hp + heal);
      events.push({
        kind: "heal",
        text: `${unit.name} uses ${action.itemName} on ${target.name}, restoring ${target.hp - before} HP.`,
        actorId: unit.id,
        targetId: target.id,
        amount: target.hp - before,
      });
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
      if (outcome.hit && !outcome.defeated && canCounter(unit, target)) {
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
}

function checkTerminal(state: TacticalCombatState, events: TacticalEvent[]): boolean {
  if (state.outcome) return true;
  const partyAlive = aliveUnits(state, "party").length;
  const enemyAlive = aliveUnits(state, "enemy").length;
  if (enemyAlive === 0) {
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

export function isTerminal(state: TacticalCombatState): boolean {
  if (state.outcome) return true;
  return aliveUnits(state, "party").length === 0 || aliveUnits(state, "enemy").length === 0;
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
export function applyAction(state: TacticalCombatState, action: TacticalAction): ApplyActionResult {
  if (isTerminal(state)) return { ok: false, error: "The battle is already over." };

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
      const d = manhattan(fromTile, target);
      if (d > 2) return { ok: false, error: `${target.name} is out of item range.` };
      break;
    }

    case "defend":
    case "wait":
      break;
  }

  performUnitAction(next, unit, action, events);

  // Terminal check (an attack may have wiped the enemy team mid-phase).
  if (!checkTerminal(next, events)) {
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
        name: u.name,
        hp: u.hp,
        maxHp: u.maxHp,
        ko: u.hp <= 0,
        statusEffects: (u.statusEffects ?? []).map((e) => e.name),
      })),
    enemies: state.units
      .filter((u) => u.side === "enemy")
      .map((u) => ({
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
