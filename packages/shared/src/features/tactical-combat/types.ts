// ──────────────────────────────────────────────
// Tactical Combat — shared types
// ──────────────────────────────────────────────
// A Fire Emblem / Final Fantasy Tactics style grid battle that runs entirely
// off the existing `Combatant` model (stats + skills). The engine (engine.ts)
// is a set of pure functions; the client renders and animates, the LLM only
// narrates the aftermath from `buildTacticalSummary`.

import type { CombatItemEffect } from "../../types/combat-encounter.js";
import type { CombatSkill, CombatStatusEffect } from "../../types/game.js";

// Re-export the style union so consumers can `import { GameCombatStyle } from ".../tactical-combat"`.
export type { GameCombatStyle } from "../../types/game.js";

// ── Terrain ──

export type TacticalTerrain = "plains" | "forest" | "mountain" | "ruin" | "water" | "wall";

export interface TerrainInfo {
  /** Movement points required to ENTER this tile. */
  moveCost: number;
  /** Flat defense bonus (added into mitigation, scaled x2 in the damage formula). */
  defenseBonus: number;
  /** Percentage points subtracted from an attacker's hit chance against a unit standing here. */
  avoidBonus: number;
  height: number;
  /** Units may never enter or stop on this tile. */
  impassable?: boolean;
  label: string;
}

export const TERRAIN_DATA: Record<TacticalTerrain, TerrainInfo> = {
  plains: { moveCost: 1, defenseBonus: 0, avoidBonus: 0, height: 0, label: "Plains" },
  forest: { moveCost: 2, defenseBonus: 1, avoidBonus: 15, height: 0, label: "Forest" },
  mountain: { moveCost: 99, defenseBonus: 0, avoidBonus: 0, height: 2, impassable: true, label: "Mountain" },
  ruin: { moveCost: 1, defenseBonus: 1, avoidBonus: 10, height: 1, label: "Ruins" },
  water: { moveCost: 99, defenseBonus: 0, avoidBonus: 0, height: -1, impassable: true, label: "Water" },
  wall: { moveCost: 99, defenseBonus: 0, avoidBonus: 0, height: 2, impassable: true, label: "Wall" },
};

// ── Environment & formation ──
// Round 2: the scene leading into combat themes the battlefield. `environment`
// steers terrain-blob weights (grid-gen) + client palette; `formation` steers
// spawn placement (grid-gen placeSpawns). Both are optional on state so old
// snapshots (schemaVersion 1) keep working; unknown strings normalize away.

export type TacticalEnvironment =
  | "forest"
  | "dungeon"
  | "desert"
  | "cave"
  | "city"
  | "ruins"
  | "snow"
  | "water"
  | "castle"
  | "wasteland"
  | "plains"
  | "mountains"
  | "swamp"
  | "volcanic"
  | "spaceship"
  | "mansion";

export type TacticalFormation = "line" | "ambush" | "surrounded" | "skirmish" | "defense";

// ── Classes ──
// Round 3: each unit resolves to a tactical class (fighter/knight/rogue/archer/
// mage/healer) that fixes its basic-attack reach, a movement bonus, and a crit
// bonus. Derivation + the profile table live in `classes.ts`; this union is the
// only class symbol in types.ts so both the engine and the client can reference
// it without pulling in the derivation logic.

export type TacticalClass = "fighter" | "knight" | "rogue" | "archer" | "mage" | "healer";

// ── Grid ──

export interface TacticalGrid {
  width: number;
  height: number;
  /** tiles[y][x] — row-major. */
  tiles: TacticalTerrain[][];
}

export interface TacticalCoord {
  x: number;
  y: number;
}

export interface TacticalManeuverProposalEffect {
  type: "damage" | "heal" | "status" | "move" | "cover" | "terrain" | "objective";
  targetId?: string;
  tile?: TacticalCoord;
  amount?: number;
  status?: CombatStatusEffect;
  objectiveId?: string;
  terrain?: TacticalTerrain;
}

export interface TacticalManeuverProposal {
  outcome: "success" | "partial" | "failure";
  rationale: string;
  difficulty: number;
  effects: TacticalManeuverProposalEffect[];
  narration: string;
}

// ── Units ──

export type TacticalSide = "party" | "enemy";

export interface TacticalInventoryItem {
  name: string;
  quantity: number;
}

export interface TacticalHazard {
  id: string;
  name: string;
  x: number;
  y: number;
  damage: number;
  duration: number;
  element?: string;
}

export interface TacticalAttackRange {
  min: number;
  max: number;
}

/**
 * A combatant placed on the tactical grid. Carries the source `Combatant`
 * fields verbatim (so summaries + hydration stay lossless) plus grid state.
 */
export interface TacticalUnit {
  // ── carried from Combatant ──
  id: string;
  name: string;
  side: TacticalSide;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  attack: number;
  defense: number;
  speed: number;
  level: number;
  skills: CombatSkill[];
  statusEffects: CombatStatusEffect[];
  element?: string;
  sprite?: string;
  portraitUrl?: string;
  spriteUrl?: string;
  isPlayer?: boolean;
  isBoss?: boolean;

  // ── tactical fields ──
  x: number;
  y: number;
  /**
   * Tactical class (Round 3). Fixes the stored attackRange + movement bonus at
   * creation and feeds the crit bonus at resolve time. Optional so legacy
   * snapshots (created before classes existed) still parse — every read site
   * treats an absent value as "fighter".
   */
  unitClass?: TacticalClass;
  /** Tiles this unit can traverse per turn: clamp(deriveMovement(speed) + class moveBonus, 2, 7). */
  movement: number;
  /** Basic-attack reach in Manhattan distance (from the unit's class profile). */
  attackRange: TacticalAttackRange;
  hasMoved: boolean;
  hasActed: boolean;
  /** Set when the unit chose Defend last turn — halves incoming damage until its next turn. */
  defending: boolean;
  /** skillName → remaining cooldown rounds (0/absent = ready). */
  skillCooldowns: Record<string, number>;
}

// ── Actions ──

export type TacticalAction =
  | { type: "move"; unitId: string; to: TacticalCoord }
  | { type: "attack"; unitId: string; targetId: string; to?: TacticalCoord }
  | { type: "skill"; unitId: string; skillName: string; targetId?: string; tile?: TacticalCoord; to?: TacticalCoord }
  | { type: "item"; unitId: string; itemName: string; targetId: string; to?: TacticalCoord }
  | {
      type: "maneuver";
      unitId: string;
      instruction: string;
      targetId?: string;
      tile?: TacticalCoord;
      objectiveId?: string;
      to?: TacticalCoord;
    }
  | { type: "defend"; unitId: string; to?: TacticalCoord }
  | { type: "overwatch"; unitId: string; to?: TacticalCoord }
  | { type: "wait"; unitId: string; to?: TacticalCoord }
  | { type: "endTurn" }
  | { type: "flee" };

// ── Events (animatable + narratable) ──

export type TacticalEventKind =
  | "move"
  | "attack"
  | "counter"
  | "skill"
  | "item"
  | "maneuver"
  | "damage"
  | "heal"
  | "status"
  | "defeat"
  | "crit"
  | "miss"
  | "phase"
  | "terrain"
  | "objective"
  | "victory"
  | "defeat-end"
  | "flee";

export interface TacticalEvent {
  kind: TacticalEventKind;
  /** Human-readable line — drives the combat log, damage popups, and the GM's post-battle report. */
  text: string;
  actorId?: string;
  targetId?: string;
  from?: TacticalCoord;
  to?: TacticalCoord;
  amount?: number;
  isCrit?: boolean;
  isMiss?: boolean;
  skillName?: string;
  element?: string;
  statusName?: string;
  phase?: TacticalPhase;
  roll?: { kind: string; value: number; cursor: number };
  objectiveId?: string;
  objectiveProgress?: number;
}

// ── State ──

export type TacticalPhase = "player" | "enemy";
export type TacticalOutcome = "victory" | "defeat" | "fled";
export type TacticalDifficulty = "casual" | "normal" | "hard" | "brutal";

export interface TacticalCombatState {
  schemaVersion: 1;
  grid: TacticalGrid;
  units: TacticalUnit[];
  phase: TacticalPhase;
  round: number;
  seed: number;
  /** Cursor into the seeded RNG stream. Incremented once per resolved sub-roll. */
  actionCounter: number;
  log: TacticalEvent[];
  outcome?: TacticalOutcome;
  difficulty: TacticalDifficulty;
  inventory?: TacticalInventoryItem[];
  itemEffects?: CombatItemEffect[];
  hazards?: TacticalHazard[];
  /** Scene-derived battlefield theme (Round 2). Optional — absent on legacy snapshots. */
  environment?: TacticalEnvironment;
  /** Scene-derived spawn arrangement (Round 2). Optional — defaults to "line" behavior when absent. */
  formation?: TacticalFormation;
}

// ── Forecast (shown FE-style before confirming an attack) ──

export interface TacticalForecast {
  /** Expected non-crit damage on a hit (roll = 1.0). */
  damage: number;
  /** 0–100. */
  hitChance: number;
  /** 0–100. */
  critChance: number;
  /** Number of strikes (1 for basic attacks). */
  hits: number;
  /** The defender's counterattack forecast, if it could retaliate. */
  counter?: {
    damage: number;
    hitChance: number;
    critChance: number;
  };
}

// ── Results ──

export type ApplyActionResult =
  | { ok: true; state: TacticalCombatState; events: TacticalEvent[] }
  | { ok: false; error: string };

export type { Combatant } from "../../types/game.js";
