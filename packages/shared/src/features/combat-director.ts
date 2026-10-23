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
/** A whole number a model writes for an ability, held to its bounds: one out of range (a self
 *  ability's `range: 0`) is pulled to the nearest bound rather than refusing the whole fight's
 *  setup over it (playtest 2026-10-23), and anything that is not a number is left out. */
const boundedAbilityInt = (min: number, max: number) =>
  z
    .preprocess(
      (value) =>
        typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : value,
      z.number().int().min(min).max(max),
    )
    .optional()
    .catch(undefined);
/** The same fields as a model's fight setup reads them. Only the setup is lenient: a turn or a
 *  replayed save still refuses an ability out of bounds. */
export const lenientCombatInterruptFields = {
  ...combatInterruptFields,
  areaRadius: boundedAbilityInt(0, 3),
  range: boundedAbilityInt(1, 12),
  slotLevel: boundedAbilityInt(1, 9),
  legendaryCost: boundedAbilityInt(1, 6),
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
  /** `icons`: the art icons it may be drawn with (1.338), first found first, for a token's badge. */
  conditions: Array<{ id: string; label: string; rounds?: number; icons?: string[] }>;
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
  /** A party member's pools their actions spend, as they stand (spell slots, ki): the fight's HUD. */
  /** `unit` is what one of it is called (1.378). */
  pools?: Array<{ id: string; label: string; value: number; max: number; unit?: string }>;
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
  | { type: "director"; reason: "ruleset-unavailable"; text: string }
  /** Why the Engine played a combatant's step the way it did, right after the step: read back from
   *  its own scoring, never from a model. Shown only with Debug on. */
  | { type: "reasoning"; actorId: string; reasons: DirectedRulesetReason[] };

/**
 * One reason the Engine's AI gives for what a combatant just did, in no ruleset's words: the parts of
 * its scoring that weighed most, largest first, or why it walked where it did.
 *
 *   - `damage`: the harm it expects to do, `heavy`, `solid` or `some` against the side's health.
 *   - `finish`: likely to take its target out of the fight.
 *   - `healing`, `support`: what it gives a friend back, or helps them with.
 *   - `setup`: a condition, a broken hold on a spell, a better position for what comes next.
 *   - `protection`, `coordination`: standing up for a friend, joining its side's attack.
 *   - `risk`, `cost`: what it was willing to pay: danger to itself, or a limited use spent.
 *   - `walked`: it walked so many cells first, to where it could do it from.
 *   - `approach`: nothing in reach, so it closed on the nearest opponent (`sprinted` with a sprint).
 *   - `driven`: a condition drove it toward or away from somebody.
 *   - `nothingWorth`: nothing it could do was worth its price, so it ended its turn.
 */
export type DirectedRulesetReason =
  | { why: "damage"; targetId?: string; strength: "heavy" | "solid" | "some" }
  | { why: "finish" | "healing" | "support" | "setup" | "protection" | "coordination"; targetId?: string }
  | { why: "risk" | "cost" }
  | { why: "walked"; cells: number }
  | { why: "approach"; targetId?: string; sprinted?: true }
  | { why: "driven" }
  | { why: "nothingWorth" };
/** One option of the legal menu, with the combatants it may be pointed at right now. */
export interface DirectedRulesetOption extends RulesetCombatOption {
  targetIds: string[];
  /** What it is expected to do against each of `targetIds`, where there is more than one to
   *  choose between: the target step shows each one's odds. */
  forecastFor?: Record<string, { hitChance?: number; averageDamage?: number }>;
  /** For an answer to a held hit: the defense the hit is checked against once it is taken, where it
   *  raises it, and whether the hit then misses. */
  raisesDefense?: { to: number; misses?: true };
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
    /** For a held hit: about how much its damage comes to, what an answer that stops it saves. */
    stakes?: number;
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
    /** The cells an area being aimed covers, so a board can show who it would catch before anybody
     *  answers. Present only for a held area on a board. */
    cells?: Array<{ x: number; y: number }>;
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
