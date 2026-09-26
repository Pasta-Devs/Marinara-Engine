// The shapes a ruleset fight is made of: what goes in, what the state holds, what the menu offers
// and what every resolved step reports.
//
// The state is a plain serialisable object on purpose: no Maps, no class instances and no
// functions, so a later slice can persist a fight as JSON and read it back exactly.

import type { RulesetCatalogEntriesById, RulesetSheetBuild } from "../../schemas/ruleset.schema.js";
import type { RulesetLiveState } from "../rulesets/live-state.js";
import type { TacticalBattlefieldProvenance, TacticalGrid } from "../tactical-combat/types.js";

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

/** The save one damage clause asks its target for, resolved to a number when the fight began.
 *  `onSuccess` says what a success leaves of THIS clause: nothing at all, or half of it. */
export interface RulesetCombatClauseSave {
  save: string;
  difficulty: number;
  onSuccess: "none" | "half";
}

/** One more amount on the same blow, rolled and typed on its own. A clause never rolls to hit: it
 *  rides the blow that carried it, and a critical doubles its dice exactly as it doubles the first
 *  amount's. */
export interface RulesetCombatDamageClause extends RulesetCombatAmount {
  type?: string;
  save?: RulesetCombatClauseSave;
}

/** An amount of damage, and what kind it is. The type is matched without case against a stat
 *  block's resistances, so "Fire" and "fire" are one thing. */
export interface RulesetCombatDamage extends RulesetCombatAmount {
  type?: string;
  /** More amounts on the same blow. Each is rolled, typed and saved against on its own; the blow
   *  they make together is ONE check against concentration and one check for going down. */
  plus?: RulesetCombatDamageClause[];
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

/** How often something can be done at all, and over what stretch. `day` outlives one fight, so the
 *  encounter only counts down what it was handed. */
export interface RulesetCombatUses {
  per: "encounter" | "day";
  count: number;
}

/** Spent when it is used, and rolled for at the start of its owner's turn: `from` or higher on
 *  these dice brings it back. It starts the fight available. */
export interface RulesetCombatRecharge {
  dice: { count: number; sides: number };
  from: number;
}

/** One step of a sequence: another action of the same block, done this many times. */
export interface RulesetCombatSequenceStep {
  /** The id of the action this step resolves, as the fight knows it. */
  actionId: string;
  times: number;
}

/** How far something is thrown or shot. `long` is what it still carries beyond `normal`, which a
 *  ruleset may make harder through `combat.ranged`. */
export interface RulesetCombatRange {
  normal: number;
  long?: number;
}

/**
 * Something that adds itself to the first qualifying hit of a period, with nobody choosing it.
 *
 * Passive and never on the menu: a rider is one more damage clause of the blow that carried it, so
 * a critical doubles it and the blow it joined is still one concentration check and one check for
 * going down. Which actions it fires on is resolved once, when the fight begins: `actions` is the
 * list of them, and a rider with none fires on any hit its holder lands.
 */
export interface RulesetCombatRider {
  id: string;
  label: string;
  on: "hit";
  actions?: string[];
  /** Any-of: one of them being true is enough. */
  when?: Array<"advantage" | "ally-adjacent">;
  oncePer: "turn" | "round";
  amount: RulesetCombatAmount;
  type?: string;
}

/** One thing a stat block can do. `reach` and `range` are in the ruleset's own distance unit; a
 *  positioned fight turns them into cells when it starts. */
export interface RulesetStatBlockAction {
  /** The block's own id when it has one, so a bestiary keeps its names across a reload. A sequence
   *  names its parts by this id, so a block with sequences needs them. */
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
  range?: number | RulesetCombatRange;
  /** The shape it lands in, in the ruleset's own distance unit. */
  area?: { shape: RulesetCombatArea["shape"]; size: number; friendlyFire?: boolean };
  uses?: RulesetCombatUses;
  recharge?: RulesetCombatRecharge;
  /** Other actions of this block, in order. ONE budget pays for the lot, and each part takes its
   *  own targets: this is how a creature that strikes twice in one action is written. */
  sequence?: Array<{ action: string; times: number }>;
  /** Bought out of the block's own `signaturePoints` instead of a budget. */
  signature?: { cost: number };
}

/** An opponent's numbers. A bestiary entry becomes one of these, and a hand-written one is still
 *  accepted, which is why everything a block can do without is optional. */
export interface RulesetStatBlock {
  /** What it can take. With `healthDice` beside it this is the AVERAGE, which is what a forecast
   *  reads while the dice decide the fight. Absent from a block that carries a `sheet`, which says
   *  it in the ruleset's own terms instead. */
  health?: number;
  defense?: number;
  initiativeModifier?: number;
  actions: RulesetStatBlockAction[];
  /** The creature described in the ruleset's OWN terms: a character sheet, as partial as it likes,
   *  keyed by the ids the ruleset declares. An opponent built from one is built the way a party
   *  member is, so its health, defense, saves, speed, initiative and the abilities on its lists all
   *  come from what the ruleset declares rather than from the numbers above, which it then does
   *  not carry. Its own `actions` still add to what the sheet gives it. */
  sheet?: RulesetSheetBuild;
  /** Thrown once when the encounter is created, in place of the flat number. */
  healthDice?: RulesetCombatAmount;
  speed?: number;
  /** Ability scores by the ruleset's own ability ids. Carried for the Game Master, not resolved. */
  abilities?: Record<string, number>;
  /** Save modifiers by the ruleset's own save ids. A save it does not name reads as zero. */
  saves?: Record<string, number>;
  /** What it adds in a contest, by the ids of `combat.checks`. One it does not name reads as zero. */
  checks?: Record<string, number>;
  /** Damage types, matched without case: half damage, double damage, none at all. */
  resist?: string[];
  vulnerable?: string[];
  immune?: string[];
  conditionImmunities?: string[];
  /** The threat tier a bestiary filed it under, read when creatures are clamped to the scale. */
  tier?: string;
  /** Lines the Game Master is shown and nothing resolves. */
  traits?: Array<{ name: string; text: string }>;
  /** Points given back at the start of its own turn, spent on `signature` actions. */
  signaturePoints?: number;
  /** What this creature adds to the first qualifying hit of a period, all by itself. */
  riders?: RulesetCombatRider[];
}

/** A block with its own numbers and no sheet. What a Game Master invents is always one, and it is
 *  all the clamp can hold to a tier, because it holds a creature there by exactly those numbers. */
export type RulesetPlainStatBlock = RulesetStatBlock & {
  health: number;
  defense: number;
  initiativeModifier: number;
  sheet?: undefined;
};

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
  | { id: string; name: string; side: "enemy"; block: RulesetStatBlock }
  /** An opponent out of a bestiary, looked up in the catalogs the encounter was handed. */
  | { id: string; name: string; side: "enemy"; creature: { catalogId: string; entryId: string } };

/** One thing a combatant may do, with every number already read off the sheet or the stat block.
 *  Resolved once, when the fight begins: armour and bonuses do not change mid-fight in this kind. */
export interface RulesetCombatAction {
  id: string;
  kind: "attack" | "ability" | "block" | "contest";
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
  uses?: RulesetCombatUses;
  recharge?: RulesetCombatRecharge;
  /** How many strikes ONE spend of this action's budget buys, when its source said so. Taking it
   *  with none in hand spends the budget and puts the rest in hand; while any are in hand, every
   *  action that declares this costs no budget at all. */
  strikes?: number;
  /** Costs no budget: whatever else it asks for, a turn may hold as many as it can pay for. */
  free?: true;
  /** Budgets this hands its user the moment it is used, capped where they land so nothing banks. */
  gives?: Array<{ budget: string; count: number }>;
  /** The standard actions its holder may take for THIS budget instead of the main one. The action
   *  itself is a permission: what it grants is on the menu as `standard:<id>@<budget>`. */
  standard?: { actions: string[]; budget: string };
  /** The other actions this one resolves, in order, for one budget. */
  sequence?: RulesetCombatSequenceStep[];
  /** Bought with the actor's own points at the end of somebody else's turn, not with a budget. */
  signature?: { cost: number };
  /** Taken at a MOMENT rather than on a turn: which moment, whom it may be aimed at, and whether
   *  taking it stops what opened the window. On no turn's menu, ever. */
  reaction?: { on: RulesetReactionMoment; at: "source" | "chosen"; cancels?: true };
  /** IN CELLS, resolved once when the fight began, and read only by a positioned fight. An action
   *  with neither reaches one cell, which is the smallest step a board has. */
  reach?: number;
  range?: RulesetCombatRange;
  /** The shape this one covers, in cells, aimed at a cell rather than at anybody. */
  area?: RulesetCombatArea;
  /** What a contest rolls and what winning it does, on an action of kind `contest`. */
  contest?: RulesetCombatContest;
}

/** A contest as the fight resolves it: the check each side adds, who takes a tie, and what winning
 *  does. Both sides throw the fight's own attack dice. */
export interface RulesetCombatContest {
  /** The contest's own id in `combat.contests`. */
  id: string;
  /** Each side rolls the best of the checks it may use here. */
  attacker: string[];
  defender: string[];
  ties: "defender" | "attacker";
  /** Aimed only at whoever put this condition on the actor, and offered only while it holds. */
  from?: string;
  applies?: Array<{ condition: string; rounds?: number }>;
  ends?: Array<{ condition: string; on: "actor" | "target" }>;
  /** How far the loser is pushed straight away, IN CELLS. Read only by a positioned fight. */
  push?: number;
}

/** A shape on the board, in cells. `friendlyFire` false leaves the actor's own side out of it. */
export interface RulesetCombatArea {
  shape: "burst" | "cone" | "line";
  size: number;
  friendlyFire?: boolean;
}

/** One cell of a board, as a fight counts them. */
export interface RulesetCombatCell {
  x: number;
  y: number;
}

/** Where a move could go: what it costs of the allowance, the cells it walks through, and the
 *  standing enemies whose reach it leaves on the way. */
export interface RulesetReachableCell extends RulesetCombatCell {
  cost: number;
  /** From the cell after the actor's own up to and including this one. */
  path: RulesetCombatCell[];
  /** The ids of the enemies this path would be struck at by, in the order it passes them. */
  provokes: string[];
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
  /** How many uses are left of each action that counts them, keyed by action id. */
  uses: Record<string, number>;
  /** The ids of the actions that have been used and are waiting for a recharge roll. */
  spent: string[];
  /** The points a signature action is bought with, when this combatant has any. */
  signature?: { points: number; max: number };
  /** Strikes in hand: what is left of a spend that bought several. Absent when there are none, and
   *  cleared at the end of the turn they were bought on, so nothing carries into the next one. */
  strikesLeft?: number;
  /** What this combatant adds to a qualifying hit without anybody choosing it. */
  riders?: RulesetCombatRider[];
  /** The riders that have already fired in their period. A "turn" rider is fresh at the start of
   *  every turn, whosever it is; a "round" rider when the round turns over. */
  ridersSpent?: string[];
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
  /** What this combatant adds in a contest, by check id. Present only when the ruleset has checks. */
  checks?: Record<string, number>;
  speed: number;
  /** A party member's sheet, which is where their health and conditions really live. */
  sheet?: { build: RulesetSheetBuild; live: RulesetLiveState; catalogs: RulesetCatalogEntriesById };
  /** An opponent's block, and the health the encounter keeps for it. */
  block?: RulesetStatBlock;
  health?: { value: number; max: number; temp: number };
  /** Where they stand. Present only in a positioned fight, and then on everybody at once. */
  x?: number;
  y?: number;
  /** The whole allowance this turn and what is left of it, both in CELLS. */
  movement?: number;
  movementLeft?: number;
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
  /** The board this fight stands on, when it has one. A fight without it is theatre of the mind and
   *  reads nothing about distance at all. */
  board?: RulesetCombatBoard;
  /** The fight held open for somebody who is not the current actor. While it is here NOTHING else
   *  moves: the turn cannot go on, and a choice from anybody but the one being asked is refused. */
  window?: RulesetCombatWindow;
  /** One up per window ever opened in this fight, so no two windows share an id and an answer
   *  written for a closed one is refused rather than spent on the one that replaced it. */
  windows?: number;
}

/** A fight held open between one step and the next, so somebody who is not the current actor may
 *  take something. Every window is answered by exactly one combatant at a time, with an option or
 *  a pass, and the fight picks up where it left off once the last of them has answered.
 *
 *  The window lives IN the state rather than beside it, so a fight saved mid-walk comes back with
 *  the same people still to ask and the same cells still to walk. */
export interface RulesetCombatWindow {
  /** Stable for the life of this window. An answer carrying another one is stale: the window it was
   *  written for has already closed, and applying it now would spend a budget twice. */
  id: string;
  kind: RulesetWindowKind;
  trigger: RulesetWindowTrigger;
  /** Who is still to answer, in the fight's own order. The first is the one being asked; a pass or
   *  a taken option removes them, and the window closes when the list empties. */
  waiting: string[];
  /** The walk this window interrupted, when it interrupted one. */
  resume?: RulesetWindowResume;
}

/** What a window is for. `reaction` is somebody spending a budget out of turn; `signature` is a
 *  block buying one of its own actions with its points between two turns. */
export type RulesetWindowKind = "reaction" | "signature";

/** What opened the window. The fight reads it to build the menu, and a caller reads it to say why
 *  somebody is being asked. */
export type RulesetWindowTrigger =
  /** A walk left this one's reach. `from` and `to` are the step that did it, not the whole walk. */
  | { kind: "leaves-reach"; moverId: string; from: RulesetCombatCell; to: RulesetCombatCell }
  /** One turn has ended and the next has not begun. */
  | { kind: "between-turns"; nextActorId: string }
  /** Something is ABOUT to land on the ones being asked. It is already paid for and is held here
   *  until they have answered, and an answer that cancels stops it from happening at all. */
  | { kind: "aimed"; sourceId: string; optionId: string; label: string }
  /** Something has just hurt the ones being asked. It has already happened: nothing answered here
   *  unmakes it, and `sourceId` is whoever dealt it, for a reaction aimed back at them. */
  | { kind: "harmed"; sourceId: string; label: string };

/** The moments the Engine notices, and opens a window for. `aimed` is before something lands on
 *  the holder, `harmed` is after something has hurt them. */
export type RulesetReactionMoment = "aimed" | "harmed";

/** What the fight goes back to once the window closes. A window opened after something has already
 *  happened carries none: there is nothing to pick up. */
export type RulesetWindowResume = RulesetWalkResume | RulesetActionResume;

/** Something paid for and held while everybody it is aimed at is asked. It resolves when the window
 *  closes, from the state as it stands then, unless an answer called it off. */
export interface RulesetActionResume {
  kind: "action";
  actorId: string;
  optionId: string;
  targetIds: string[];
  payWith?: string;
  /** An answer stopped it. What it cost is still spent: it was paid for before the asking. */
  cancelled?: true;
}

/** A walk stopped in its tracks, with everything needed to finish it exactly as it would have gone:
 *  the cells already crossed, the ones still to cross, what has been paid so far and who has
 *  already struck, so nobody strikes the same passer-by twice. */
export interface RulesetWalkResume {
  kind: "walk";
  actorId: string;
  from: RulesetCombatCell;
  walked: RulesetCombatCell[];
  path: RulesetCombatCell[];
  /** Everybody already ASKED about this walk, struck or passed: one chance each per walk, so a
   *  long path past the same foe never offers a second. */
  asked: string[];
  spent: number;
}

/** The board, as the fight keeps it: the tactical engine's own grid and where it came from. The
 *  fight never generates one of its own. */
export interface RulesetCombatBoard {
  grid: TacticalGrid;
  battlefield?: TacticalBattlefieldProvenance;
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
  | "bad-pool"
  /** A bestiary reference the handed-in catalogs do not hold. */
  | "unknown-creature"
  /** A creature whose sheet gives it no health at all, so it would walk in already out. */
  | "no-health"
  /** A cell this move cannot end on, or cannot pay for. */
  | "unreachable"
  /** The fight is held open for somebody else, and nothing but their answer moves it. */
  | "window-open"
  /** An answer to a window that has already closed. */
  | "stale-window"
  /** A target further away than this reaches or carries. */
  | "out-of-reach"
  /** Something solid stands between the two of them. */
  | "no-line-of-sight"
  /** An area aimed at a cell it may not be aimed at. */
  | "bad-cell";

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
      /** How it was rolled, when a condition made it more or less than one throw. */
      mode?: RulesetCombatRollMode;
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
      reason: "applied" | "immune" | "save" | "expired" | "damage" | "concentration" | "revived" | "down" | "contest";
    }
  | { type: "spend"; actorId: string; pool: string; label: string; amount: number }
  | { type: "budget"; actorId: string; budget: string; left: number }
  | { type: "uses"; actorId: string; optionId: string; label: string; left: number; of: number }
  | {
      type: "recharge";
      actorId: string;
      optionId: string;
      label: string;
      rolls: number[];
      kept: number;
      from: number;
      /** Whether the roll brought it back. */
      back: boolean;
    }
  | { type: "signature"; actorId: string; optionId: string; label: string; cost: number; left: number }
  /** A spend that bought several strikes, and what is left of it after this one. */
  | { type: "strikes"; actorId: string; optionId: string; label: string; left: number }
  /** A budget something handed its user, and what they hold of it now. */
  | { type: "gives"; actorId: string; optionId: string; label: string; budget: string; left: number }
  /** Something that added itself to this blow. The damage it dealt is its own `damage` event, as
   *  every other clause of the blow is. */
  | { type: "rider"; actorId: string; targetId: string; riderId: string; label: string }
  | {
      type: "concentration";
      actorId: string;
      label: string;
      state: "started" | "kept" | "ended";
      reason?: "replaced" | "damage" | "down";
    }
  | { type: "standard"; actorId: string; action: string; targetId?: string }
  | {
      type: "move";
      actorId: string;
      from: RulesetCombatCell;
      to: RulesetCombatCell;
      /** Every cell walked through, the first one after the actor's own. */
      path: RulesetCombatCell[];
      /** In cells of the allowance, and what is left of it afterwards. */
      cost: number;
      left: number;
      /** How far the move got, when a strike on the way stopped it short. */
      stopped?: boolean;
    }
  /** A strike at somebody leaving this combatant's reach. The attack and the damage that follow are
   *  their own events, exactly as they are on a turn. */
  | { type: "opportunity"; actorId: string; targetId: string; label: string; budget: string }
  /** The fight was held open, and for whom. Everything those combatants then take is its own event,
   *  exactly as it is on a turn, so a log reads the window as an interruption rather than a mode. */
  | {
      type: "window";
      window: string;
      kind: RulesetWindowKind;
      waiting: string[];
      moverId?: string;
      /** Which moment opened it, for the ones a reaction waits for, what is happening at it, and
       *  who is doing it. */
      moment?: RulesetReactionMoment;
      label?: string;
      sourceId?: string;
    }
  /** Somebody let their window go by without spending anything. */
  | { type: "pass"; actorId: string; window: string }
  /** Something held open by a window was called off, and never happened. What it cost stays spent:
   *  it was paid for before anybody was asked. */
  | { type: "cancelled"; actorId: string; optionId: string; label: string; byId: string }
  /** Both sides of a contest: what each threw, what it added and the total, and who won. What winning
   *  did follows as its own events (a condition, a push). */
  | {
      type: "contest";
      actorId: string;
      targetId: string;
      optionId: string;
      label: string;
      attacker: { check: string; rolls: number[]; modifier: number; total: number };
      defender: { check: string; rolls: number[]; modifier: number; total: number };
      winner: "actor" | "target";
    }
  /** Somebody pushed across the board by somebody else. Forced, so it spends nothing of their own
   *  allowance and draws no strike on the way. */
  | {
      type: "pushed";
      actorId: string;
      targetId: string;
      from: RulesetCombatCell;
      to: RulesetCombatCell;
      path: RulesetCombatCell[];
    }
  /** What the ground the target stands on added to the defense the next attack is rolled against. */
  | { type: "cover"; targetId: string; bonus: number; defense: number }
  /** Where an area landed, and the cells it covered. */
  | {
      type: "area";
      actorId: string;
      optionId: string;
      label: string;
      at: RulesetCombatCell;
      cells: RulesetCombatCell[];
    }
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
  /** `move` is the one a positioned fight adds: walking, and getting back up. */
  kind: "attack" | "ability" | "block" | "contest" | "standard" | "end-turn" | "move";
  label: string;
  /** Absent on "end turn", which spends nothing, and on anything that costs no budget: something
   *  the entry called free, or a strike taken out of what a spend already bought. */
  budget?: string;
  /** Strikes in hand this one would be taken out of. Present only while it costs no budget. */
  strikes?: number;
  targets: { side: "enemy" | "ally" | "self" | "any"; count: number };
  cost?: Array<{ pool: string; label: string; amount: number }>;
  /** Other pools of the same family this could be paid from instead, in declaration order. */
  payWith?: string[];
  /** What it costs in the actor's own points, and how many they have. A signature option spends no
   *  budget: it is bought at the end of somebody else's turn. */
  signature?: { cost: number; points: number };
  /** How many times this is left, for an action that counts its uses. */
  left?: number;
  /** Whether the amount below is health GIVEN BACK rather than taken off. Without it a menu and an
   *  opponent's own choices cannot tell a heal from a blow, because both are an amount. */
  heals?: boolean;
  /** Expected values, never a future die: `averageDamage` is the average of the amount rolled and
   *  `hitChance` the share of rolls that would land against the first legal target. A sequence
   *  forecasts the sum of its parts' damage and no single chance to hit, because its parts each
   *  roll their own. */
  forecast?: { hitChance?: number; averageDamage?: number };
  /** Where the `move` option may go, with what each cell costs of the allowance and who a path to
   *  it would be struck at by. */
  cells?: RulesetReachableCell[];
  /** What a `move` option that is not a step costs of the allowance: getting back up. */
  movementCost?: number;
  /** The shape this covers, in cells, and how far away it may be aimed. Present only in a
   *  positioned fight, and then the option is aimed at a cell rather than at anybody. */
  area?: { shape: RulesetCombatArea["shape"]; size: number; range: number };
}

export interface RulesetCombatChoice {
  actorId: string;
  optionId: string;
  /** Who it is pointed at. A sequence takes the targets of all its parts in order; hand it fewer
   *  than that and every part takes the ones at the front of the list, so one id is "all of it at
   *  the same target". */
  targetIds: string[];
  /** Pay out of another pool of the same family: the upcast, under the `use` command's own rule. */
  payWith?: string;
  /** Where the `move` option is walking to. */
  to?: RulesetCombatCell;
  /** The cell an area is aimed at. An option with an area takes this instead of target ids. */
  at?: RulesetCombatCell;
  /** The window this answers, when it answers one. An answer carrying the id of a window that has
   *  already closed changes nothing: it was written for a question the fight has moved past. */
  window?: string;
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
    /** Down and no longer being rolled for. A recap that only knew `down` and `dying` could not
     *  tell a member who has stopped slipping from one who is still on the clock. */
    stable: boolean;
    conditions: string[];
  }>;
  enemies: Array<{ id: string; name: string; health: number; maxHealth: number; defeated: boolean }>;
}
