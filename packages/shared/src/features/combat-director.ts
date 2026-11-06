import type { RulesetCheckSource } from "./rulesets/check-effects.js";
import type { RulesetItemEffectFact } from "./rulesets/item-book.js";
import type { CombatWeather } from "./combat-conditions.js";
import type { CombatOrders } from "./combat-ai.js";
import { z } from "zod";
import type { Combatant, CombatPlayerAction, CombatSummary } from "../types/game.js";
import type {
  RulesetCombatCell,
  RulesetCombatEvent,
  RulesetCombatOption,
  RulesetCombatSide,
  RulesetEncounterSummary,
  RulesetUnansweredBecause,
} from "./ruleset-combat/types.js";
import type { RulesetInHand } from "./ruleset-combat/in-hand.js";
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
 *  replayed save still refuses an ability out of bounds. A word or a flag it cannot read (a
 *  `reaction: "counterattack"` for a duelist's Parry, laptop playtest 2026-10-25) is left out
 *  rather than refusing the whole fight. */
export const lenientCombatInterruptFields = {
  ...combatInterruptFields,
  projectile: combatInterruptFields.projectile.catch(undefined),
  requiresSight: combatInterruptFields.requiresSight.catch(undefined),
  spell: combatInterruptFields.spell.catch(undefined),
  friendlyFire: combatInterruptFields.friendlyFire.catch(undefined),
  targetScope: combatInterruptFields.targetScope.catch(undefined),
  reaction: combatInterruptFields.reaction.catch(undefined),
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
      /** A lasting area ended instead of a creature (1.427): one of the option's `dispels`. */
      dispel?: { casterId: string; actionId: string };
      /** A condition struck at and cut away instead of a creature (1.531): one of the option's `cuts`. */
      cut?: { holderId: string; condition: string };
      /** Which of its target's conditions it ends (1.427), from the option's `endsChoices`. */
      ends?: string[];
      /** Who goes along on a teleport (1.276): ids its option's `teleport.carries` offers. */
      carries?: string[];
      /** Whom a layered wall spares (1.492): ids its option's `designates` offers. */
      designates?: string[];
      /** The kinds its zone strikes (1.753): ids its option's `kindsOf` offers. */
      kinds?: string[];
      /** Stored instead of done (1.524). */
      storesIn?: { holderId: string; item?: number };
      /** How many levels up a target moved to `to` is lifted (1.565): Telekinesis. */
      rises?: number;
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
  /** A party member the player plays set down before the first turn (2026-10-24), on one of the
   *  view's `deploy.cells`; `deployed` begins the fight. */
  | { type: "deploy"; unitId: string; to: { x: number; y: number } }
  | { type: "deployed" }
  | { type: "continue" }
  | { type: "fallback" }
  | { type: "control"; unitId: string; controller: "manual" | "ai" }
  /** Every companion at once, all but the one the player plays as their own (a ruleset fight's). */
  | { type: "controlCompanions"; controller: "manual" | "ai" }
  /** A ruleset fight's party member takes a carried weapon or shield in hand on their own turn
   *  (2026-10-26), by its place in their items: `DirectedRulesetCombatant.hands.carried`. */
  | { type: "draw"; unitId: string; item: number }
  /** Which stack a ruleset fight's party member's weapon shoots first, by places in their items:
   *  `DirectedRulesetCombatant.hands.ammo`. */
  | { type: "ammo"; unitId: string; weapon: number; stack: number }
  /** A companion's standing orders, or none to go back to its default. */
  | { type: "orders"; unitId: string; orders: CombatOrders | null }
  /** Whether the player chooses what their own symbol throws buy (1.382) rather than the Engine. */
  | { type: "spends"; choose: boolean }
  | { type: "flee" }
  /** The party gives itself up to opponents who are all honourable (combat AI T6): a ruleset fight's. */
  | { type: "yield" };
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
  /** Where the Engine's own tactics rank it among its top picks for this turn, and why in a few
   *  words, shown to a Game Master deciding for the same unit. */
  suggested?: { rank: number; reason: string };
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
  /** How much of `defense` is the cover it stands in (laptop playtest 2026-10-24: a War-Chief's 21
   *  with nothing to say 2 of it was cover); left out with none. */
  cover?: number;
  /** `trait` marks one only what they are or carry keeps on them for the whole fight (a halfling's
   *  Lucky, a worn ring's): it is listed, never badged, so it does not hide what the fight did.
   *  `icons`: the art icons it may be drawn with (1.338), first found first, for a token's badge. */
  conditions: Array<{ id: string; label: string; rounds?: number; trait?: true; icons?: string[] }>;
  /** What a standard action left them doing until their next turn: dodging, hidden, disengaged or
   *  with something readied. Not conditions, so a screen names them in its own words. */
  stances?: Array<"dodging" | "hidden" | "disengaged" | "readied" | "praying">;
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
  /** Gave itself up (1.762): out of the fight, but still standing where it gave up, a prisoner. */
  surrendered?: true;
  /** Gone of its own accord, by a teleport that leaves the fight (1.279). */
  left?: true;
  /** Caught unaware (1.237): their first turn is only ended, and they answer nothing until then. */
  surprised?: true;
  /** What an opponent still has on it of what it began the fight with (1.795), by name. */
  carrying?: Array<{ name: string; count: number }>;
  /** A party member's hands (2026-10-26): what they hold, what they carry that could go in them, and
   *  what each weapon shoots first. Absent for one with no weapon among their items. */
  hands?: RulesetInHand;
  /** The two counts of the ruleset's dying rule, for a member the fight is still rolling for. */
  deathTrack?: { successes: number; failures: number; successesMax: number; failuresMax: number };
  /** The points it buys its legendary actions with between turns, as they stand. */
  legendary?: { points: number; max: number };
  /** What this combatant is holding together, when the ruleset has concentration. */
  concentrating?: string;
  /** A party member's pools their actions spend, as they stand (spell slots, ki): the fight's HUD. */
  /** `unit` is what one of it is called (1.378). */
  pools?: Array<{ id: string; label: string; value: number; max: number; unit?: string }>;
  /** An opponent's rung of the threat scale, and the lines the Game Master is shown. */
  tier?: string;
  traits?: Array<{ name: string; text: string }>;
  /** What it is, in the ruleset's words (1.168): its creature type and tags, read by target tests.
   *  A creature's own tags only, with its alignment as it is written (1.378). */
  kind?: { type?: string; tags?: string[]; alignment?: string };
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
  /** Art and marks only (1.786): the options it casts by praying (the ruleset's
   *  `combat.poses.divine`), and that it is hidden, so it sneaks as it moves. */
  prays?: string[];
  hidden?: true;
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
  | { type: "reasoning"; actorId: string; reasons: DirectedRulesetReason[] }
  /** A companion the Engine plays says what it just set up for its side (Alyssa 2026-10-24): an
   *  opponent whose every blow from beside it is a critical, or one open to attack. Always shown. */
  | { type: "callout"; actorId: string; targetId: string; way: DirectedRulesetCalloutWay };

/** What a call-out tells the rest of the side: blows from beside the target land as criticals, or
 *  attacks against it have advantage. */
export type DirectedRulesetCalloutWay = "critical" | "advantage";

/** A set-up its side can still use, for the player's turn to show as a follow-up: who set it up,
 *  on whom, and what it opens. */
export interface DirectedRulesetCallout {
  by: string;
  targetId: string;
  way: DirectedRulesetCalloutWay;
}

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
 *   - `sparing`: told to spare them, it ended its turn, since every blow it had might kill.
 *   - `noWay`: what it meant to do could not be carried out from where it got to, so it ended its turn.
 *   - `holding`: told to hold or fall back, it stayed where it was with nothing in reach.
 *   - `leavesHarm`: with nothing worth doing, it stepped out of a lasting area striking it there.
 *   - `focus`: its target is the one its side most wants down (one dropping areas on it).
 *   - `mostInNeed`: the friend it picked is the one of its side most in need of it.
 *   - `keptBack`: an item's healing it weighed and kept for later (`label`, for `targetId`).
 *   - `routed`: its morale broke, so its turn is getting away off the field.
 *   - `liesInWait`: it keeps still, hidden where it can, until its prey comes to it.
 *   - `stops`: an answer that stops what `targetId` was about to do (a Counterspell).
 *   - `takesTurn`: it keeps `targetId` from acting, taking its turns away (a stun, a hold).
 *   - `letGo`: in a window, nothing it could answer with was worth its price, so it let it go by.
 *   - `wards`: an answer that turns aside what was coming at it (a Shield, an Uncanny Dodge).
 *   - `spread`: it stopped apart from its own side rather than nearest, out of an opponent's blast.
 *   - `pressCaster`: nothing to do yet, so it closed on the one dropping areas on its side from out
 *     of reach.
 *   - `guarding`: nothing in reach, and it stays beside `targetId`, whom its orders keep it near.
 *   - `gmPick`: the Game Master chose it for an opponent it plays, `rank` the Engine's suggestion it
 *     took, if it took one.
 */
export type DirectedRulesetReason =
  | {
      why: "damage";
      targetId?: string;
      strength: "heavy" | "solid" | "some";
      /** Why it is worth more against the target than its forecast says (I1): a damage type it is
       *  vulnerable to, one that stops it regenerating, or a clause dealt only to what it is. */
      edge?: { way: "vulnerable" | "stops" | "suits"; damageType: string };
    }
  | {
      why:
        | "finish"
        | "healing"
        | "support"
        | "setup"
        | "protection"
        | "coordination"
        | "focus"
        | "mostInNeed"
        | "takesTurn";
      targetId?: string;
    }
  | { why: "pressCaster"; targetId: string }
  | { why: "guarding"; targetId: string }
  | { why: "stops"; targetId?: string }
  | { why: "risk" | "cost" }
  | { why: "walked"; cells: number }
  | { why: "approach"; targetId?: string; sprinted?: true }
  | { why: "driven" }
  | {
      why:
        | "nothingWorth"
        | "sparing"
        | "spareYields"
        | "cannotAct"
        | "noWay"
        | "holding"
        | "leavesHarm"
        | "spread"
        | "routed"
        | "cornered"
        | "liesInWait"
        | "wards"
        | "harmless"
        | "letGo";
    }
  | { why: "keptBack"; label: string; targetId?: string }
  /** An answer it held to an opponent using something, which it could not give (laptop party A
   *  2026-10-25): a Counterspell out of reach, or with no line to the caster. */
  | { why: "couldNotAnswer"; label: string; because: RulesetUnansweredBecause }
  /** The Game Master's own pick: which of the Engine's suggestions it was, and, when it was not the
   *  first, what the first was (laptop pass 5 2026-10-26: "choice number 3" told the player nothing). */
  | { why: "gmPick"; rank?: number; over?: { label: string; targetId?: string; ends?: true } };
/** One option of the legal menu, with the combatants it may be pointed at right now. */
export interface DirectedRulesetOption extends RulesetCombatOption {
  targetIds: string[];
  /** What it is expected to do against each of `targetIds`, where there is more than one to
   *  choose between: the target step shows each one's odds. */
  forecastFor?: Record<string, { hitChance?: number; averageDamage?: number }>;
  /** For an answer to a held hit: the defense the hit is checked against once it is taken, where it
   *  raises it, and whether the hit then misses. */
  raisesDefense?: { to: number; misses?: true };
  /** For an answer to a held hit that halves its harm instead: about what the hit comes to then. */
  halvesTo?: number;
  /** For an option that lands as a shape: the cells it may be aimed at, and who each aim would
   *  catch, so a board can draw the template before the choice is confirmed. */
  aim?: Array<{ x: number; y: number; targetIds: string[] }>;
  /** What the sheet calls each pool `payWith` names, by pool id: "3rd-level slots", not "slots_3". */
  payLabels?: Record<string, string>;
  /** An answer that stops what is held only up to its own level (1.116): Counterspell. `sure` when
   *  it stops it outright; else the check it needs, its modifier against `dc`, and with neither it
   *  cannot stop it at all. */
  counter?: { sure?: true; level: number; dc?: number; modifier?: number };
  /** An attack's chance to land on each of `targetIds`, by id: the forecast reads only the first,
   *  and a player picking a target wants the odds for the one they pick. */
  hitChances?: Record<string, number>;
  /** The chance each target fails the option's save, for one that calls for a save (playtest). */
  saveChances?: Record<string, number>;
  /** How far each of `targetIds` is, in cells, on a board (2026-10-25). */
  distances?: Record<string, number>;
  /** Whom it would be pointed at but cannot be now, and why: too far (how far, and its reach, in
   *  cells), no line to them, or not seen (laptop 2026-10-25: "Nobody in reach" at 61 ft of 60). */
  beyond?: Array<{ id: string; why: "out-of-reach" | "no-line-of-sight" | "unseen"; cells?: number; reach?: number }>;
  /** The level it is paid at as it is, and at each pool `payWith` offers, where a level changes
   *  what it does (Sculpt Spells spares one more a level). */
  levels?: { base: number; pay: Record<string, number> };
}
/** The room player a party member of a shared room's fight belongs to (2026-10-26). */
export interface DirectedRulesetPlayer {
  participantId: string;
  /** The player's display name, for "played by". */
  name: string;
  /** The room's host, who also commands every party member no other player plays. */
  host?: true;
}
export interface DirectedRulesetView {
  /** What the fight is resolved by, as the game pinned it. */
  ruleset: { id: string; version: number };
  round: number;
  /** Every opponent still standing is honourable (combat AI T6): the party may yield to them. */
  canYield?: true;
  /** Why the party may not yield, when honour is in the fight: the standing opponents who are not
   *  honourable now (a captain turned methodical once bloodied). */
  yieldRefusedBy?: string[];
  order: string[];
  /** The party member the player plays as their own character; the others may be the Engine's. */
  lead?: string;
  /** A shared room's fight (2026-10-26): the room player whose own character each party member is,
   *  by combatant id, and whoever one of them called to the party's side. `name` is the player's
   *  display name. Absent outside a room. */
  players?: Record<string, DirectedRulesetPlayer>;
  /** In a shared room's fight, the party members the one viewing may command: their own character,
   *  and for the host every member no other player plays. Absent outside a room, where the viewer
   *  commands the whole party. */
  yours?: string[];
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
    /** Cells off the map (2026-10-24), outside[y][x]: drawn as nothing. Absent on a box. */
    outside?: boolean[][];
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
  /** Before the first turn (2026-10-24): whom the player sets down, and the squares they may. */
  deploy?: { ids: string[]; cells: Array<{ x: number; y: number }> };
  actorId?: string;
  /** Who plays the actor whose turn it is. */
  controller: "manual" | "ai" | "gm";
  /** The set-ups the party's companions called out that still stand (Alyssa 2026-10-24), for the
   *  player's turn to offer as follow-ups. Absent when there are none. */
  callouts?: DirectedRulesetCallout[];
  combatants: DirectedRulesetCombatant[];
  /** What spells called up that strike from a square of their own (Spiritual Weapon): whose, what,
   *  and where it is. Only on a board. */
  summons?: Array<{ casterId: string; label: string; x: number; y: number }>;
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
    kind: "reaction" | "signature" | "spend";
    /** For a `spend` window (1.382): the side being asked spends for, and whether the throw landed. */
    spend?: { by: "attacker" | "target"; hit: boolean };
    /** Which moment, for the ones a reaction waits for, and what is happening at it. */
    moment?: "aimed" | "hit" | "harmed" | "used" | "falls" | "turn-start" | "caught" | "attacked";
    targetIds?: string[];
    label?: string;
    /** What is held while they answer, where it is something being used: the level it was paid at
     *  (0 for what costs nothing of a family, a cantrip), the cell an area was aimed at. */
    /** What is held for the answer: the level it is cast at, where its area was aimed, whom it
     *  would catch or was aimed at, and the cells of that area for a board to draw. */
    held?: { level: number; at?: RulesetCombatCell; targetIds?: string[]; cells?: RulesetCombatCell[] };
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
    /** What a readied action waited for, for a window it opened (1.288): `sourceId` coming in reach,
     *  or acting. */
    readied?: "comes" | "acts";
    /** Who answers it: the same three the fight has everywhere else. */
    controller: "manual" | "ai" | "gm";
    /** The cells an area being aimed covers, so a board can show who it would catch before anybody
     *  answers. Present only for a held area on a board. */
    cells?: Array<{ x: number; y: number }>;
  };
  /** A fight in symbol dice (1.382): whether the player chooses their own spends. */
  spends?: { choose: boolean };
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
  /** `deploy`: before a ruleset fight's first turn, while the player sets their party down (2026-10-24). */
  stage: "select" | "action" | "decision" | "deploy" | "finished";
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
