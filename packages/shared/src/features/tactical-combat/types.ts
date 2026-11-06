import type { CombatWeather, CombatAttackTraits, GameDifficulty } from "../combat-conditions.js";
import type { CombatController, CombatOrders, CombatTactics } from "../combat-ai.js";
import type { WorldElementSet } from "../world/elements.js";
// ──────────────────────────────────────────────
// Tactical Combat — shared types
// ──────────────────────────────────────────────
// A Fire Emblem / Final Fantasy Tactics style grid battle that runs entirely
// off the existing `Combatant` model (stats + skills). The engine (engine.ts)
// is a set of pure functions; the client renders and animates, the LLM only
// narrates the aftermath from `buildTacticalSummary`.

import type { CombatSkill, CombatStatusEffect } from "../../types/game.js";

// Re-export the style union so consumers can `import { GameCombatStyle } from ".../tactical-combat"`.
export type { GameCombatStyle } from "../../types/game.js";

// ── Terrain ──

export type { TacticalTerrain } from "./environments.js";
import type { TacticalTerrain, TacticalEnvironment } from "./environments.js";
import type { TacticalBoardOutline } from "./board-outline.js";

/** Fixed board sizes for procedural tactical encounters, smallest first: 12x8, 13x9, 14x10, and
 *  (2026-10-24) 24x16 for a great hall, 40x26 for a lair, 64x40 for a war's battlefield. */
export const TACTICAL_BATTLEFIELD_SIZES = ["small", "medium", "large", "huge", "vast", "colossal"] as const;
export type TacticalBattlefieldSize = (typeof TACTICAL_BATTLEFIELD_SIZES)[number];

/** Setup-owned preferences for newly-created tactical encounters. */
export interface TacticalBattlefieldSetup {
  seed?: number;
  size?: TacticalBattlefieldSize;
  instructions?: string;
}

/** How a unit traverses the battlefield. Missing values retain walk-only rules. */
export type TacticalMovementMode = "walk" | "fly" | "teleport";

/** A bounded, directional landmark request for procedural terrain generation. */
export interface TacticalBattlefieldFeature {
  terrain: TacticalTerrain;
  placement: "center" | "north" | "south" | "east" | "west";
  shape: "patch" | "barrier";
}

/**
 * Structured terrain input for a generated battlefield. It cannot express
 * arbitrary coordinates; an exact board is painted by hand for a world's place
 * instead (`TacticalMadeBattlefield`).
 */
export interface TacticalBattlefieldBrief {
  exposure?: CombatWeather["exposure"];
  size?: TacticalBattlefieldSize;
  /** The outline it is cut to (2026-10-24); its place's when none is named. */
  outline?: TacticalBoardOutline;
  features?: TacticalBattlefieldFeature[];
  /** A share of the open ground (0.05 to 0.6) turned into one terrain, scattered over the board
   *  (laptop playtest 2026-10-30: a brief of "every other cell deep water" came out mostly plains). */
  scatter?: { terrain: Exclude<TacticalTerrain, "plains">; share: number };
}

/** Saved provenance for a grid: generated from a brief, or painted by hand for a world's place (worldgen
 *  W9g). `grid` remains the resolved authority. */
export type TacticalBattlefieldProvenance =
  | {
      kind: "generated";
      /** 1: flat; 2: with foothills (combat C6b); 3: cut to an outline and sized past large
       *  (2026-10-24). A saved fight keeps the board it was fought on. */
      generatorVersion: 1 | 2 | 3;
      size: TacticalBattlefieldSize;
      /** The outline it was cut to, when it is not a box. */
      outline?: TacticalBoardOutline;
      brief?: TacticalBattlefieldBrief;
    }
  | { kind: "hand-made"; size: TacticalBattlefieldSize; id: string; name: string; scene: TacticalEnvironment };

/** A board painted by hand (worldgen W9g), already checked: one of the standard sizes, its deployment
 *  strips plains and every tile a fighter can stand on connected. Used exactly as painted. */
export interface TacticalMadeBattlefield {
  id: string;
  name: string;
  size: TacticalBattlefieldSize;
  /** The battlefield it looks like: its colours, and the weather's reach. */
  scene: TacticalEnvironment;
  grid: TacticalGrid;
  /** What stands on it that may be broken (Capability API 1.316), as painted. */
  props?: Array<{
    id: string;
    label: string;
    cells: Array<{ x: number; y: number }>;
    health: number;
    defense?: number;
    resist?: string[];
    vulnerable?: string[];
    immune?: string[];
    blocks?: { move?: boolean; sight?: boolean };
    fragile?: boolean;
    relight?: { light: "bright" | "dim" | "sunlight"; squares: number; budget?: string };
    /** Its sprite in the board's pack (1.333). */
    art?: string;
  }>;
  /** The board pack it is drawn with (1.333), by id; none for its scene's. */
  pack?: string;
  /** What it does on its own each round (Capability API 1.318), as painted. */
  events?: Array<{
    id: string;
    label?: string;
    at: "round-start" | "round-end";
    from?: number;
    every?: number;
    until?: number;
    where:
      | { cells: Array<{ x: number; y: number }> }
      | { block: { x: number; y: number; w: number; h: number } }
      | { ring: { x: number; y: number; start: number; step: number; filled?: true } }
      | { sweep: { from: "north" | "south" | "east" | "west"; start: number; step: number; filled?: true } }
      | { spread: "growth" };
    onlyOn?: TacticalTerrain[];
    change: {
      terrain?: TacticalTerrain;
      height?: number;
      light?: "bright" | "dim" | "dark" | "sunlight" | "clear";
      obscured?: "light" | "heavy" | "clear";
      growth?: boolean;
      season?: string | null;
      rotate?: 1 | 2 | 3;
      /** Whoever stands on it carried toward an edge (1.329): a millrace. */
      push?: { toward: "north" | "south" | "east" | "west"; squares: number };
      /** What obscures carried toward an edge (1.329): a snow drift. */
      drift?: { toward: "north" | "south" | "east" | "west"; squares: number };
      tell?: string;
    };
  }>;
  /** The cells growth lies on from the start (1.318), as painted. */
  growth?: Array<{ x: number; y: number }>;
  /** The season on each cell, by "x,y" (shared with the season work of 1.364). */
  seasons?: Record<string, string>;
  /** What standing in some light does here (Capability API 1.319): Noonfield's bright light. */
  lightRule?: {
    label?: string;
    in?: Array<"sunlight" | "bright" | "dim" | "dark">;
    rounds?: number;
    tracks?: Array<{ track: string; by: number; upTo?: number }>;
    applies?: string[];
    spares?: { types?: string[]; tags?: string[] };
    /** A save that escapes it this time (1.321). */
    save?: { save: string; difficulty: number; against?: { conditions?: string[]; damage?: string[] } };
  };
}

export interface TerrainInfo {
  /** Movement points required to ENTER this tile. */
  moveCost: number;
  /** Flat defense bonus (added into mitigation, scaled x2 in the damage formula). */
  defenseBonus: number;
  /** Percentage points subtracted from an attacker's hit chance against a unit standing here. */
  avoidBonus: number;
  /** Units may never enter or stop on this tile. */
  impassable?: boolean;
  /** Nothing is seen through it (combat C6): a wall, a mountain. Water and woods are seen across. */
  blocksSight?: true;
  label: string;
}

export const TERRAIN_DATA: Record<TacticalTerrain, TerrainInfo> = {
  plains: { moveCost: 1, defenseBonus: 0, avoidBonus: 0, label: "Plains" },
  forest: { moveCost: 2, defenseBonus: 1, avoidBonus: 15, label: "Forest" },
  mountain: { moveCost: 99, defenseBonus: 0, avoidBonus: 0, impassable: true, blocksSight: true, label: "Mountain" },
  ruin: { moveCost: 1, defenseBonus: 1, avoidBonus: 10, label: "Ruins" },
  water: { moveCost: 99, defenseBonus: 0, avoidBonus: 0, impassable: true, label: "Water" },
  wall: { moveCost: 99, defenseBonus: 0, avoidBonus: 0, impassable: true, blocksSight: true, label: "Wall" },
};

// ── Environment & formation ──
// Round 2: the scene leading into combat themes the battlefield. `environment`
// steers terrain-blob weights (grid-gen) + client palette; `formation` steers
// spawn placement (grid-gen placeSpawns). Both are optional on state so old
// snapshots (schemaVersion 1) keep working; unknown strings normalize away.

export type { TacticalEnvironment } from "./environments.js";

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
  /** How high each cell stands (combat C6b), elevation[y][x] from 0 to 3. Absent on a flat board, which
   *  every board before it was. */
  elevation?: number[][];
  /** Cells a standing wall closes (Capability API 1.177), by "x,y": 1 nobody moves into, 2 nobody
   *  sees through, 3 both. Only a ruleset fight's zones set it, and they take it away as they end. */
  walls?: Record<string, number>;
  /** What lies on each cell over its terrain (Capability API 1.318), by "x,y": growth (hard going,
   *  lightly obscuring), its own light, a fog, a season. Only a ruleset fight sets it. */
  ground?: Record<string, TacticalGroundCell>;
  /** Cells off the map (2026-10-24), outside[y][x]: beyond the outline a generated board is cut to (a
   *  cavern, a round tower, a ruin). Their tile is a wall, so nothing moves into or sees through them,
   *  as off the board's edge; they are drawn as nothing and never change. Absent on a box. */
  outside?: boolean[][];
}

/** What lies on one cell over its terrain (1.318). */
export interface TacticalGroundCell {
  growth?: true;
  light?: "bright" | "dim" | "dark" | "sunlight";
  obscured?: "light" | "heavy";
  season?: string;
}

export interface TacticalCoord {
  x: number;
  y: number;
}

// ── Units ──

export type TacticalSide = "party" | "enemy";

export interface TacticalAttackRange {
  min: number;
  max: number;
}

/**
 * A combatant placed on the tactical grid. Carries the source `Combatant`
 * fields verbatim (so summaries + hydration stay lossless) plus grid state.
 */
export interface TacticalUnit extends CombatAttackTraits {
  boss?: import("../combat-director.js").CombatBoss;
  spellSlots?: Record<string, number>;
  tactics?: CombatTactics;
  controller?: CombatController;
  /** Its player's standing orders, while the Engine plays it. */
  orders?: CombatOrders;
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
  /** Flight and teleport rules. Absent legacy snapshots walk. */
  movementMode?: TacticalMovementMode;
  hasMoved: boolean;
  hasActed: boolean;
  /** Set when the unit chose Defend last turn — halves incoming damage until its next turn. */
  defending: boolean;
  /** skillName → remaining cooldown rounds (0/absent = ready). */
  skillCooldowns: Record<string, number>;
}

// ── Actions ──

export type TacticalAction =
  | { type: "control"; unitId: string; controller: CombatController }
  /** A companion's standing orders, or none to go back to its default. */
  | { type: "orders"; unitId: string; orders: CombatOrders | null }
  | { type: "move"; unitId: string; to: TacticalCoord }
  | { type: "attack"; unitId: string; targetId: string; to?: TacticalCoord }
  | { type: "skill"; unitId: string; skillName: string; targetId?: string; tile?: TacticalCoord; to?: TacticalCoord }
  | { type: "item"; unitId: string; itemName: string; targetId: string; to?: TacticalCoord }
  | { type: "defend"; unitId: string; to?: TacticalCoord }
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
  | "damage"
  | "heal"
  | "status"
  | "defeat"
  | "crit"
  | "miss"
  | "phase"
  | "terrain"
  | "victory"
  | "defeat-end"
  | "flee";

export interface TacticalEvent {
  message?: import("../combat-director.js").CombatLogMessage;
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
}

// ── State ──

export type TacticalPhase = "player" | "enemy";
/** Who acts when in a tactical fight (combat C6c): the party's phase then the enemies', or one unit at a
 *  time in an order rolled at the start. */
export type TacticalTurnOrder = "side" | "initiative";
export type TacticalOutcome = "victory" | "defeat" | "fled";
export type TacticalDifficulty = GameDifficulty;

export interface TacticalCombatState {
  weather?: CombatWeather;
  /** The game's elements (worldgen W6c); the classic six when absent. */
  elements?: WorldElementSet;
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
  /** Scene-derived battlefield theme (Round 2). Optional — absent on legacy snapshots. */
  environment?: TacticalEnvironment;
  /** Scene-derived spawn arrangement (Round 2). Optional — defaults to "line" behavior when absent. */
  formation?: TacticalFormation;
  /** Provenance for a generated grid. Optional so legacy snapshots remain valid. */
  battlefield?: TacticalBattlefieldProvenance;
  /** Individual initiative (combat C6c): the order units take their turns in every round, rolled once
   *  at the start. The unit whose turn it is is the first standing one in it that has not acted. Absent
   *  on fights by side, which every fight before this was. */
  initiative?: { order: string[] };
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
  { ok: true; state: TacticalCombatState; events: TacticalEvent[] } | { ok: false; error: string };

export type { Combatant } from "../../types/game.js";
