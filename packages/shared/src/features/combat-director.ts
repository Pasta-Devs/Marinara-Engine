import type { CombatWeather } from "./combat-conditions.js";
import { z } from "zod";
import type { Combatant, CombatPlayerAction, CombatSummary } from "../types/game.js";
import type {
  RulesetCombatEvent,
  RulesetCombatOption,
  RulesetCombatSide,
  RulesetEncounterSummary,
} from "./ruleset-combat/types.js";
import type { TacticalAction, TacticalCombatState, TacticalTerrain } from "./tactical-combat/types.js";

/** Explicit capabilities: names and prose never grant interrupts or boss privileges. */
export const combatBossSchema = z.object({
  points: z.number().int().min(0).max(6),
  anticipation: z.boolean().default(true),
  attackCost: z.number().int().min(1).max(6).optional(),
  defendCost: z.number().int().min(1).max(6).optional(),
  moveCost: z.number().int().min(1).max(6).optional(),
});
export type CombatBoss = z.infer<typeof combatBossSchema>;
export const combatInterruptFields = {
  projectile: z.boolean().optional(),
  requiresSight: z.boolean().optional(),
  spell: z.boolean().optional(),
  areaRadius: z.number().int().min(0).max(3).optional(),
  friendlyFire: z.boolean().optional(),
  targetScope: z.enum(["single", "all-enemies"]).optional(),
  reaction: z.enum(["counterspell", "guard"]).optional(),
  range: z.number().int().min(1).max(12).optional(),
  slotLevel: z.number().int().min(1).max(9).optional(),
  legendaryCost: z.number().int().min(1).max(6).optional(),
};
export type DirectedCommand =
  | { type: "begin"; unitId: string }
  | { type: "classic"; action: CombatPlayerAction }
  | { type: "tactical"; action: TacticalAction }
  /** One choice off the ruleset fight's own menu, for the actor whose turn it is. `to` is where the
   *  `move` option walks to and `at` is the cell an area is aimed at; both are ignored by a fight
   *  that has no board. */
  | {
      type: "ruleset";
      optionId: string;
      targetIds: string[];
      payWith?: string;
      to?: { x: number; y: number };
      at?: { x: number; y: number };
    }
  | { type: "choose"; candidateId: string }
  | { type: "continue" }
  | { type: "fallback" }
  | { type: "control"; unitId: string; controller: "manual" | "ai" }
  | { type: "flee" };
export interface CombatDecisionOption {
  id: string;
  kind: "attack" | "skill" | "move" | "defend" | "wait" | "pass";
  actorId: string;
  targetId?: string;
  skillName?: string;
  to?: { x: number; y: number };
  mpCost: number;
  slotLevel?: number;
  legendaryCost: number;
  /** What a ruleset fight's own menu called this candidate. Absent for the other two styles: a
   *  window is one shape, and the boss picks an id from it whatever the fight is resolved by. */
  optionId?: string;
  targetIds?: string[];
  label?: string;
  payWith?: string;
  /** Where a ruleset fight's own shape is aimed. `to` above is where the actor walks first, which
   *  a positioned candidate may carry too. */
  at?: { x: number; y: number };
}
export interface CombatDecisionWindow {
  id: string;
  kind: "ordinary" | "anticipation" | "legendary" | "reaction";
  actorId: string;
  triggerActorId?: string;
  triggerSkillName?: string;
  controller: "gm" | "manual";
  options: CombatDecisionOption[];
  requestedAt?: number;
}
/** Optional on old snapshots; text remains the fallback and GM narration source. */
export interface CombatLogMessage {
  key: string;
  suffixKey?: string;
  params?: Record<string, string | number>;
}
/** One combatant of a ruleset fight, as a screen reads them. A PROJECTION, never the encounter's
 *  own record: a party member's sheet build, their live blob and the catalogs their rows came from
 *  stay on the server, because none of them changes while the fight runs and all of them are large. */
export interface DirectedRulesetCombatant {
  id: string;
  name: string;
  side: RulesetCombatSide;
  initiative: number;
  health: { value: number; max: number; temp: number };
  /** What an attack is rolled against. Sent for both sides: every option's forecast already carries
   *  the chance it would land against this combatant, so the number is not a secret to keep. */
  defense: number;
  conditions: Array<{ id: string; label: string; rounds?: number }>;
  /** What is left of each budget this turn, keyed by budget id. */
  budgets: Record<string, number>;
  down: boolean;
  dying: boolean;
  stable: boolean;
  defeated: boolean;
  /** The two counts of the ruleset's dying rule, for a member the fight is still rolling for. */
  deathTrack?: { successes: number; failures: number; successesMax: number; failuresMax: number };
  /** What this combatant is holding together, when the ruleset has concentration. */
  concentrating?: string;
  /** An opponent's rung of the threat scale, and the lines the Game Master is shown. */
  tier?: string;
  traits?: Array<{ name: string; text: string }>;
  /** Where they stand and how many cells of this turn's allowance they have left. Present exactly
   *  when the fight is on a board, and then on everybody at once. */
  x?: number;
  y?: number;
  movement?: number;
  movementLeft?: number;
}
/**
 * What a ruleset fight's log holds: everything the resolver did, plus the few things the DIRECTOR
 * has to say that no step ever produces. One stream, so a screen prints it in one pass.
 */
export type DirectedRulesetEvent =
  | RulesetCombatEvent
  /** The fight could not go on: its ruleset is gone, or the game is on another version of it. */
  | { type: "director"; reason: "ruleset-unavailable"; text: string };
/** One option of the legal menu, with the combatants it may be pointed at right now. */
export interface DirectedRulesetOption extends RulesetCombatOption {
  targetIds: string[];
  /** For an option that lands as a shape: the cells it may be aimed at, and who each aim would
   *  catch, so a board can draw the template before the choice is confirmed. */
  aim?: Array<{ x: number; y: number; targetIds: string[] }>;
}
export interface DirectedRulesetView {
  /** What the fight is resolved by, as the game pinned it. */
  ruleset: { id: string; version: number };
  round: number;
  order: string[];
  /** The board, when the fight is on one, with what this ruleset calls one cell's worth of
   *  distance. Absent from a fight that is theatre of the mind, which is every fight until a
   *  ruleset declares `combat.distance` and the game asks for a positioned one. */
  grid?: { width: number; height: number; tiles: TacticalTerrain[][]; distance: { label: string; perCell: number } };
  actorId?: string;
  /** Who plays the actor whose turn it is. */
  controller: "manual" | "ai" | "gm";
  combatants: DirectedRulesetCombatant[];
  /** The legal menu, present only while a human controls the actor whose turn it is. */
  options?: DirectedRulesetOption[];
  /** The last 200 events, each with a running number so a client prints only what is new. */
  events: Array<{ seq: number; event: DirectedRulesetEvent }>;
  summary?: RulesetEncounterSummary;
  /** Every clamp and every fallback the opponents were built with, in plain words. */
  adjustments: string[];
}
export interface DirectedCombatView {
  weather?: CombatWeather;
  id: string;
  /** Storage row identity changes when a checkpoint is restored or a battle is branched. */
  instanceId?: string;
  revision: number;
  style: "classic" | "tactical" | "ruleset";
  round: number;
  stage: "select" | "action" | "decision" | "finished";
  actorId?: string;
  party: Combatant[];
  enemies: Combatant[];
  inventory: Array<{ name: string; quantity: number; description?: string }>;
  tactical?: TacticalCombatState;
  /** Present exactly when the style is `ruleset`. */
  ruleset?: DirectedRulesetView;
  window?: CombatDecisionWindow;
  budgets: Record<string, { legendary: number; reaction: number }>;
  log: Array<{
    id: number;
    actorId?: string;
    kind: string;
    text: string;
    message?: CombatLogMessage;
    source?: "gm" | "ai" | "manual" | "fallback";
  }>;
  outcome?: "victory" | "defeat" | "flee";
  summary?: CombatSummary;
}
