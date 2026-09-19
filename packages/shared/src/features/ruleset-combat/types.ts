// The shapes a ruleset fight is made of: what goes in, what the state holds, what the menu offers
// and what every resolved step reports.
//
// The state is a plain serialisable object on purpose: no Maps, no class instances and no
// functions, so a later slice can persist a fight as JSON and read it back exactly.

import type { RulesetCatalogEntriesById, RulesetSheetBuild } from "../../schemas/ruleset.schema.js";
import type { RulesetLiveState } from "../rulesets/live-state.js";

/** A die roller: one call, one die, a face from 1 to `sides`. Every random number a fight needs
 *  comes through one of these, so a scripted sequence reproduces a fight exactly. */
export type RulesetCombatRoller = (sides: number) => number;

export type RulesetCombatSide = "party" | "enemy";

/** Dice plus a flat adjustment, as a fight rolls them. */
export interface RulesetCombatAmount {
  count: number;
  sides: number;
  flat: number;
}

/** An amount of damage, and what kind it is. The type is matched without case against a stat
 *  block's resistances, so "Fire" and "fire" are one thing. */
export interface RulesetCombatDamage extends RulesetCombatAmount {
  type?: string;
}

/** A condition a hit or a failed save puts on its target. */
export interface RulesetCombatApplies {
  condition: string;
  duration: "instant" | "until-save" | { rounds: number };
  saveEnds?: { save: string; at: "turn-end" | "turn-start" };
}

export interface RulesetCombatSaveRider {
  save: string;
  difficulty: number;
  onSuccess: "none" | "half" | "negates";
}

/** One thing a stat block can do. `reach` and `range` are carried and not read: distance starts to
 *  mean something in the slice that gives a fight positions. */
export interface RulesetStatBlockAction {
  /** The block's own id when it has one, so a bestiary keeps its names across a reload. */
  id?: string;
  name: string;
  budget: string;
  toHit?: number;
  autoHit?: boolean;
  damage?: RulesetCombatDamage;
  save?: RulesetCombatSaveRider;
  /** What a save that ENDS one of `applies` is rolled against, when the action has no save of its
   *  own to borrow the number from. */
  saveDifficulty?: number;
  applies?: RulesetCombatApplies[];
  targetCount?: number;
  reach?: number;
  range?: number;
}

/** An opponent's numbers. Written by hand today; a bestiary fills these in a later slice, which is
 *  why everything a hand-written block can do without is optional. */
export interface RulesetStatBlock {
  health: number;
  defense: number;
  initiativeModifier: number;
  actions: RulesetStatBlockAction[];
  speed?: number;
  /** Save modifiers by the ruleset's own save ids. A save it does not name reads as zero. */
  saves?: Record<string, number>;
  /** Damage types, matched without case: half damage, double damage, none at all. */
  resist?: string[];
  vulnerable?: string[];
  immune?: string[];
  conditionImmunities?: string[];
  /** The threat tier a bestiary filed it under, read when creatures are clamped to the scale. */
  tier?: string;
}

/** Who is in the fight. A party member is sheet-backed and reads and writes its numbers through the
 *  sheet's own rules; an opponent carries a stat block and lives inside the encounter only. */
export type RulesetCombatantInput =
  | {
      id: string;
      name: string;
      side: "party";
      build: RulesetSheetBuild;
      /** The stored live blob, read tolerantly exactly as the sheet reads it. */
      live?: unknown;
      /** The catalogs this member's own rows came from, so the fight knows what an ability costs. */
      catalogs?: RulesetCatalogEntriesById;
    }
  | { id: string; name: string; side: "enemy"; block: RulesetStatBlock };

/** One thing a combatant may do, with every number already read off the sheet or the stat block.
 *  Resolved once, when the fight begins: armour and bonuses do not change mid-fight in this kind. */
export interface RulesetCombatAction {
  id: string;
  kind: "attack" | "ability" | "block";
  label: string;
  budget: string;
  /** Who it may be pointed at, relative to the actor: "enemy" is the other side. */
  targets: { side: "enemy" | "ally" | "self" | "any"; count: number };
  toHit?: number;
  autoHit?: boolean;
  damage?: RulesetCombatDamage;
  heal?: RulesetCombatAmount;
  temporary?: RulesetCombatAmount;
  save?: RulesetCombatSaveRider;
  /** The source's own save difficulty, for a save-ends on an action with no save of its own. */
  saveDifficulty?: number;
  applies?: RulesetCombatApplies[];
  concentration?: boolean;
  /** How the price is paid. The name is what the sheet's own `use` command knows the row by, and
   *  the pool and its family are what a higher-pool payment is measured against. */
  use?: { name: string; pool?: string; group?: string; perCostStep?: RulesetCombatAmount };
}

/** A condition the fight is keeping time on. The condition itself lives on the sheet for a party
 *  member, so it outlives the battle; this is the bookkeeping beside it. */
export interface RulesetTrackedCondition {
  condition: string;
  /** Turns of the affected combatant left, or null for a condition with no clock of its own. */
  rounds: number | null;
  saveEnds?: { save: string; at: "turn-end" | "turn-start" };
  /** The difficulty the repeated save is rolled against: the one that applied it. */
  difficulty?: number;
  /** Who applied it, and whether their concentration is what holds it. */
  source?: string;
  concentration?: boolean;
}

export interface RulesetCombatant {
  id: string;
  name: string;
  side: RulesetCombatSide;
  initiative: number;
  initiativeRoll: number[];
  initiativeModifier: number;
  /** What is left of each budget, keyed by budget id. */
  budgets: Record<string, number>;
  actions: RulesetCombatAction[];
  tracked: RulesetTrackedCondition[];
  concentrating: { actionId: string; label: string } | null;
  /** What a standard action left behind. `dodging`, `dashed`, `disengaged`, `hidden` and `ready`
   *  are cleared at the start of the actor's next turn; `helped` is spent by their next attack. */
  flags: {
    dodging?: boolean;
    dashed?: boolean;
    disengaged?: boolean;
    hidden?: boolean;
    ready?: boolean;
    helped?: boolean;
  };
  /** At zero and out of the fight. `dying` is a party member a ruleset with a dying rule still
   *  rolls for; `stable` is one that has stopped rolling; `defeated` is one the fight is over for. */
  down: boolean;
  dying: boolean;
  stable: boolean;
  defeated: boolean;
  /** Read from the sheet or the block once, when the fight began. */
  defense: number;
  saves: Record<string, number>;
  speed: number;
  /** A party member's sheet, which is where their health and conditions really live. */
  sheet?: { build: RulesetSheetBuild; live: RulesetLiveState; catalogs: RulesetCatalogEntriesById };
  /** An opponent's block, and the health the encounter keeps for it. */
  block?: RulesetStatBlock;
  health?: { value: number; max: number; temp: number };
}

export interface RulesetEncounterState {
  /** Bumped when the shape changes, so a persisted fight says what wrote it. */
  v: 1;
  /** The ruleset this fight is resolved by, as the game pinned it. */
  ruleset: { id: string; version: number };
  seed: number;
  /** One tick per die thrown, so a seeded roller picks up exactly where the last step left off. */
  cursor: number;
  round: number;
  /** Where in `order` the turn is. */
  turn: number;
  order: string[];
  combatants: RulesetCombatant[];
  /** The events the fight opened with, so a caller printing a log never rebuilds them. */
  opening: RulesetCombatEvent[];
}

/** Why a choice changed nothing. */
export type RulesetCombatRefusal =
  | "encounter-over"
  | "unknown-actor"
  | "not-your-turn"
  | "unknown-option"
  | "cannot-act"
  | "down"
  | "bad-target"
  | "no-budget"
  | "insufficient"
  | "bad-pool";

export type RulesetCombatAttackOutcome = "hit" | "miss" | "critical";
export type RulesetCombatRollMode = "normal" | "advantage" | "disadvantage";

/** Everything a step did, with the numbers it did it with, so a log can print "17 + 5 = 22 against
 *  15: hit" without doing any arithmetic of its own. */
export type RulesetCombatEvent =
  | { type: "initiative"; entries: Array<{ actorId: string; roll: number[]; modifier: number; total: number }> }
  | { type: "round"; round: number }
  | { type: "turn"; actorId: string; round: number }
  | {
      type: "attack";
      actorId: string;
      targetId: string;
      optionId: string;
      label: string;
      mode: RulesetCombatRollMode;
      rolls: number[];
      kept: number;
      modifier: number;
      total: number;
      defense: number;
      outcome: RulesetCombatAttackOutcome;
    }
  | {
      type: "save";
      actorId: string;
      /** Who forced it, when somebody did. */
      sourceId?: string;
      save: string;
      rolls: number[];
      kept: number;
      modifier: number;
      total: number;
      difficulty: number;
      success: boolean;
      /** A condition that fails this save automatically rolls nothing. */
      automatic?: boolean;
    }
  | {
      type: "damage";
      targetId: string;
      sourceId?: string;
      label?: string;
      damageType?: string;
      rolls: number[];
      flat: number;
      /** Before and after the target's own resistances, and how they changed it. */
      amount: number;
      dealt: number;
      adjust: "none" | "resist" | "vulnerable" | "immune";
      /** Halved because the target saved, which is separate from what its hide is made of. */
      saved?: boolean;
      toTemp: number;
      health: number;
      maxHealth: number;
      critical?: boolean;
    }
  | {
      type: "heal";
      targetId: string;
      sourceId?: string;
      rolls: number[];
      flat: number;
      amount: number;
      health: number;
      maxHealth: number;
    }
  | { type: "temporary"; targetId: string; sourceId?: string; rolls: number[]; flat: number; amount: number }
  | {
      type: "condition";
      targetId: string;
      condition: string;
      active: boolean;
      reason: "applied" | "immune" | "save" | "expired" | "damage" | "concentration" | "revived" | "down";
    }
  | { type: "spend"; actorId: string; pool: string; label: string; amount: number }
  | { type: "budget"; actorId: string; budget: string; left: number }
  | {
      type: "concentration";
      actorId: string;
      label: string;
      state: "started" | "kept" | "ended";
      reason?: "replaced" | "damage" | "down";
    }
  | { type: "standard"; actorId: string; action: string; targetId?: string }
  | {
      type: "dying";
      actorId: string;
      rolls: number[];
      kept: number;
      difficulty: number;
      successes: number;
      failures: number;
      result: "success" | "failure" | "stable" | "dead" | "revived";
    }
  | { type: "down"; actorId: string; dying: boolean }
  | { type: "defeated"; actorId: string }
  | { type: "revived"; actorId: string; health: number }
  | { type: "outcome"; outcome: RulesetEncounterOutcome }
  | { type: "refused"; actorId: string; optionId?: string; reason: RulesetCombatRefusal };

export type RulesetEncounterOutcome = "ongoing" | "victory" | "defeat";

/** One legal thing the actor whose turn it is may do right now. Everything a player, an opponent's
 *  own choices and a forecast go through is on this menu: nothing else computes legality. */
export interface RulesetCombatOption {
  id: string;
  kind: "attack" | "ability" | "block" | "standard" | "end-turn";
  label: string;
  /** Absent on "end turn", which spends nothing. */
  budget?: string;
  targets: { side: "enemy" | "ally" | "self" | "any"; count: number };
  cost?: Array<{ pool: string; label: string; amount: number }>;
  /** Other pools of the same family this could be paid from instead, in declaration order. */
  payWith?: string[];
  /** Expected values, never a future die: `averageDamage` is the average of the damage roll and
   *  `hitChance` the share of rolls that would land against the first legal target. */
  forecast?: { hitChance?: number; averageDamage?: number };
}

export interface RulesetCombatChoice {
  actorId: string;
  optionId: string;
  targetIds: string[];
  /** Pay out of another pool of the same family: the upcast, under the `use` command's own rule. */
  payWith?: string;
}

export interface RulesetCombatStep {
  state: RulesetEncounterState;
  events: RulesetCombatEvent[];
}

export interface RulesetEncounterSummary {
  outcome: RulesetEncounterOutcome;
  rounds: number;
  party: Array<{
    id: string;
    name: string;
    health: number;
    maxHealth: number;
    temp: number;
    down: boolean;
    dying: boolean;
    conditions: string[];
  }>;
  enemies: Array<{ id: string; name: string; health: number; maxHealth: number; defeated: boolean }>;
}
