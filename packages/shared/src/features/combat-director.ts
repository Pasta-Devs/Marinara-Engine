import type { RulesetCheckSource } from "./rulesets/check-effects.js";
import type { RulesetItemEffectFact } from "./rulesets/item-book.js";
import type { CombatWeather } from "./combat-conditions.js";
import { z } from "zod";
import type { Combatant, CombatPlayerAction, CombatSummary } from "../types/game.js";
import type {
  RulesetCombatEvent,
  RulesetCombatOption,
  RulesetCombatSide,
  RulesetEncounterSummary,
} from "./ruleset-combat/types.js";
import type {
  TacticalAction,
  TacticalCombatState,
  TacticalEnvironment,
  TacticalTerrain,
} from "./tactical-combat/types.js";

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
      /** The initiative style an attack is made in, where initiative is a number attacks move. */
      style?: string;
      /** The weapon's mode an attack is made in. */
      mode?: string;
      to?: { x: number; y: number };
      at?: { x: number; y: number };
      /** How a wall is laid from `at` (1.177): the way it runs, the side it faces, or as a ring. */
      toward?: { x: number; y: number };
      side?: "near" | "far";
      ring?: boolean;
      /** Where further copies of an area that allows them are set down (1.178). */
      also?: Array<{ x: number; y: number }>;
      /** A wall's section struck at instead of a creature (1.200): one of the option's `walls`. */
      wall?: { x: number; y: number };
      /** Who goes along on a teleport (1.276): ids its option's `teleport.carries` offers. */
      carries?: string[];
      /** How many uses it spends, where the option offers an `amount` (1.251): Lay on Hands. */
      amount?: number;
      /** The alterations it is used with (1.253), from the option's `alters`: Metamagic. */
      alters?: string[];
      /** Who of its user's side an alteration that spares some spares (1.254): Careful Spell. */
      spares?: string[];
      /** Who an alteration that heightens gives disadvantage (1.255): Heightened Spell. */
      heightens?: string;
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
  style?: string;
  mode?: string;
  /** Where a ruleset fight's own shape is aimed. `to` above is where the actor walks first, which
   *  a positioned candidate may carry too. */
  at?: { x: number; y: number };
  /** Where a zone its actor moves or turns goes (1.173, 1.182): the choice's own `to`, never the
   *  walk `to` above. */
  zoneTo?: { x: number; y: number };
  /** The altering actions a ruleset candidate is used with (1.253). */
  alters?: string[];
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
  /** The bestiary entry an opponent was made from: what its art is found by (design-game-creature-art.md). */
  creature?: { catalogId: string; entryId: string };
  initiative: number;
  health: { value: number; max: number; temp: number };
  /** What an attack is rolled against. Sent for both sides: every option's forecast already carries
   *  the chance it would land against this combatant, so the number is not a secret to keep. */
  defense: number;
  conditions: Array<{ id: string; label: string; rounds?: number }>;
  /** All active typed defenses, including exceptions (Capability API 1.132). */
  hides?: Pick<RulesetCheckSource, "resist" | "vulnerable" | "immune" | "conditionImmunities">;
  /** Active damage dealt/taken sources (Capability API 1.133), also read by the Game Master. */
  damageModifiers?: Array<{ name: string; facts: RulesetItemEffectFact[] }>;
  /** What is left of each budget this turn, keyed by budget id. */
  budgets: Record<string, number>;
  down: boolean;
  dying: boolean;
  stable: boolean;
  defeated: boolean;
  /** Sent out of the fight, alive (1.236): off the board until it comes back, if it does. */
  away?: true;
  /** Gone of its own accord, by a teleport that leaves the fight (1.279). */
  left?: true;
  /** Caught unaware (1.237): their first turn is only ended, and they answer nothing until then. */
  surprised?: true;
  /** The two counts of the ruleset's dying rule, for a member the fight is still rolling for. */
  deathTrack?: { successes: number; failures: number; successesMax: number; failuresMax: number };
  /** What this combatant is holding together, when the ruleset has concentration. */
  concentrating?: string;
  /** An opponent's rung of the threat scale, and the lines the Game Master is shown. */
  tier?: string;
  traits?: Array<{ name: string; text: string }>;
  /** What it is, in the ruleset's words (1.168): its creature type and tags, read by target tests. */
  kind?: { type?: string; tags?: string[] };
  /** Active save modifiers narrowed by what the roll is against (1.134). */
  saveModifiers?: RulesetItemEffectFact[];
  /** Where they stand and how many cells of this turn's allowance they have left. Present exactly
   *  when the fight is on a board, and then on everybody at once. */
  x?: number;
  y?: number;
  movement?: number;
  movementLeft?: number;
  /** The level a flier is up at (1.114), present only while it is off the ground. */
  altitude?: number;
  /** How many cells a side it fills (1.194), `x`/`y` the top-left one. Absent for one cell. */
  span?: number;
  /** Shown in its flying art (1.352): it flies without walking, hovers, is up in the air, or flew this
   *  turn. Art only. */
  flying?: true;
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
  grid?: {
    width: number;
    height: number;
    tiles: TacticalTerrain[][];
    /** How high each cell stands (combat C6b), elevation[y][x]; absent on a flat board. */
    elevation?: number[][];
    /** Cells standing walls close (1.177), by "x,y": 1 movement, 2 sight, 3 both. */
    walls?: Record<string, number>;
    /** Growth and seasons on its cells (1.318), by "x,y". */
    ground?: Record<string, { growth?: true; season?: string }>;
    distance: { label: string; perCell: number };
    /** The scene a board painted for the place (worldgen W9g) looks like, drawn instead of the fight's own. */
    scene?: TacticalEnvironment;
    /** The board pack it is drawn with (1.333), by library id, and the environment whose pack it falls
     *  back to. */
    pack?: string;
    environment?: string;
    /** The light on each cell that is not bright, by "x,y"; absent when the whole board is bright. */
    light?: Record<string, "sunlight" | "dim" | "dark">;
    /** The cells a fog or haze covers, by "x,y": heavy unless it only lightly obscures. */
    fog?: Record<string, "light" | "heavy">;
  };
  actorId?: string;
  /** Who plays the actor whose turn it is. */
  controller: "manual" | "ai" | "gm";
  combatants: DirectedRulesetCombatant[];
  /** The areas spells left standing (1.172): whose, what, how many of its caster's turns are left,
   *  and the cells it covers now (none off a board). */
  zones?: Array<{
    casterId: string;
    label: string;
    rounds: number;
    cells: Array<{ x: number; y: number }>;
    /** A wall's chosen side (1.177), the cells that catch beside it. */
    side?: Array<{ x: number; y: number }>;
    /** A wall's sections (1.200): their cells and the health each has left; one at 0 is broken. */
    sections?: Array<{ cells: Array<{ x: number; y: number }>; health: number; max: number }>;
    /** How it looks (1.333): a `bz_` tile of the board's pack. */
    art?: string;
  }>;
  /** What stands on the board that may be broken (1.316): its cells, and what it has left of what;
   *  one at 0 is broken. */
  props?: Array<{
    id: string;
    label: string;
    cells: Array<{ x: number; y: number }>;
    health: number;
    max: number;
    /** Its sprite in the board's pack (1.333). */
    art?: string;
  }>;
  /** The legal menu, present only while a human controls the one being asked: the actor whose turn
   *  it is, or, while a window holds the fight open, whoever that window is asking. */
  options?: DirectedRulesetOption[];
  /** The fight held open for somebody who is not the current actor. While it is here the menu above
   *  is theirs rather than the actor's, and letting the moment go by is one of the answers. */
  window?: {
    id: string;
    kind: "reaction" | "signature";
    /** Which moment, for the ones a reaction waits for, and what is happening at it. */
    moment?: "aimed" | "hit" | "harmed" | "used" | "falls" | "turn-start";
    targetIds?: string[];
    label?: string;
    /** For a held hit: what the roll came to, and what it was made against. */
    total?: number;
    defense?: number;
    /** Who caused the moment: whoever aimed the thing, or whoever dealt the damage. Its own field
     *  rather than `moverId`, which is for the walk that opened a window by leaving a reach. */
    sourceId?: string;
    /** Who is being asked. The rest of the queue is not named: a client shows one question at a
     *  time, and everybody after this one is answered after this one. */
    actorId: string;
    /** How many more are still to be asked once this one has answered. */
    waiting: number;
    /** Whose walk opened it, for a window opened by somebody breaking away. */
    moverId?: string;
    /** Who answers it: the same three the fight has everywhere else. */
    controller: "manual" | "ai" | "gm";
  };
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
  /** One line per item, shown by `name`. `ownName` is the item's own name when `name` is a nickname:
   *  what a spend is taken by, so a nickname never spends another item. */
  inventory: Array<{ name: string; quantity: number; description?: string; ownName?: string }>;
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
