// ──────────────────────────────────────────────
// Creature Battler Types (generic, franchise-agnostic)
// ──────────────────────────────────────────────

export type CreatureType =
  | "Normal" | "Fire" | "Water" | "Grass" | "Electric" | "Ice"
  | "Fighting" | "Poison" | "Ground" | "Flying" | "Psychic" | "Bug"
  | "Rock" | "Ghost" | "Dragon" | "Dark" | "Steel" | "Fairy";

export type MoveCategory = "Physical" | "Special" | "Status";

export interface CreatureMove {
  name: string;
  type: CreatureType;
  category: MoveCategory;
  power: number | null;      // null for status moves
  accuracy: number | null;   // null for moves that never miss
  pp: number;
  maxPp: number;
}

export interface CreatureStats {
  hp: number;
  attack: number;
  defense: number;
  spAttack: number;
  spDefense: number;
  speed: number;
}

export type CreatureStatus =
  | "none" | "poison" | "burn" | "paralysis" | "sleep" | "freeze" | "confusion";

export interface HeldItem {
  name: string;
  effect: string; // short description for prompt/engine
}

export interface CreatureAbility {
  name: string;
  effect: string;
}

export type BattleSlot = "single" | "double-left" | "double-right";

export interface CreatureInstance {
  id: string;                    // unique instance id
  species: string;
  level: number;
  types: [CreatureType, CreatureType?] | [CreatureType];
  ability: CreatureAbility | null;
  heldItem: HeldItem | null;
  stats: CreatureStats;
  currentHp: number;
  status: CreatureStatus;
  moves: [CreatureMove, CreatureMove, CreatureMove, CreatureMove];
  slot?: BattleSlot;             // for double battles

  // V2 evolution / capture (optional for now)
  experience?: number;
  evolutionStage?: number;
  evolutionTarget?: string;
  captureDate?: string;
  originalTrainerId?: string;
}

export type CreatureActionType = "switch" | "item" | "move";

export interface CreatureAction {
  type: CreatureActionType;
  creatureId: string;
  target?: string;               // for moves/items
  payload?: any;                 // switch target id, item name, move name
}

export interface CreatureBattleState {
  active: boolean;
  round: number;
  party: CreatureInstance[];
  enemies: CreatureInstance[];
  turnOrder: string[];           // creature ids in speed order
  currentTurn?: string;
}
