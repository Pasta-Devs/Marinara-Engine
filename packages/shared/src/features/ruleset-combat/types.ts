// The shapes a ruleset fight is made of: what goes in, what the state holds, what the menu offers
// and what every resolved step reports.
//
// The state is a plain serialisable object on purpose: no Maps, no class instances and no
// functions, so a later slice can persist a fight as JSON and read it back exactly.

import type {
  RulesetCatalogItem,
  RulesetCatalogEntriesById,
  RulesetCatalogZone,
  RulesetCreatureGround,
  RulesetCreatureHideEntry,
  RulesetCreature,
  RulesetLightRadius,
  RulesetSheetBuild,
  RulesetTargetIs,
  RulesetValueRef,
} from "../../schemas/ruleset.schema.js";
import type { RulesetLiveState } from "../rulesets/live-state.js";
import type { RulesetSheetItem } from "../rulesets/sheet-math.js";
import type { TacticalBattlefieldProvenance, TacticalGrid, TacticalTerrain } from "../tactical-combat/types.js";

/** A die roller: one call, one die, a face from 1 to `sides`. Every random number a fight needs
 *  comes through one of these, so a scripted sequence reproduces a fight exactly. */
export type RulesetCombatRoller = (sides: number) => number;

export type RulesetCombatSide = "party" | "enemy";

/** Dice plus a flat adjustment, as a fight rolls them. */
/** A menu heading a ruleset names for abilities from one of its lists (1.378): the list's tab, and
 *  the heading of the row's place in it, with that place's number to order by. */
export interface RulesetCombatMenuGroup {
  label: string;
  sub?: { label: string; order: number };
}

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

/** A damage pool as thrown, including its floor and target's chosen wound kind. */
export interface RulesetCombatDamagePool {
  target: number;
  successes: number;
  soak?: { value: number; rolls?: number[]; taken: number };
  minimum?: number;
  kind?: string;
  remappedFrom?: string;
}

/** One more amount on the same blow, rolled and typed on its own. A clause never rolls to hit: it
 *  rides the blow that carried it, and a critical doubles its dice exactly as it doubles the first
 *  amount's. */
export interface RulesetCombatDamageClause extends RulesetCombatAmount {
  type?: string;
  save?: RulesetCombatClauseSave;
  /** Dealt only to a target that is this (1.168). */
  targetIs?: RulesetTargetIs;
  /** Dealt only on a critical hit (1.169): a sword of sharpness's extra. */
  onCritical?: true;
  /** Dealt only while this item of its holder's (its place in `sheet.items`) is switched on (1.170). */
  whileOn?: number;
  /** Not dealt to a target that is this (1.187). */
  not?: RulesetTargetIs;
  /** Dealt only on a blow struck in reach, or thrown or shot (1.187). */
  blow?: RulesetBlowKind;
  /** Its maker gains temporary points equal to what it dealt (1.187). */
  tempHp?: true;
  /** Dealt only to a target carrying this condition from its maker (1.189). */
  marked?: string;
}

/** An amount of damage, and what kind it is. The type is matched without case against a stat
 *  block's resistances, so "Fire" and "fire" are one thing. */
export interface RulesetCombatDamage extends RulesetCombatAmount {
  type?: string;
  /** What gets it past a resistance or an immunity that names an exception: the tags of the weapon
   *  item it is dealt with. */
  qualities?: string[];
  /** More amounts on the same blow. Each is rolled, typed and saved against on its own; the blow
   *  they make together is ONE check against concentration and one check for going down. */
  plus?: RulesetCombatDamageClause[];
  /** The least the first amount deals on a hit, before a resistance halves it: a pool fight's harm
   *  after soak, a summed fight's damage. A spending blow throws its maker's number and is never
   *  raised to it. */
  floor?: number;
  /** Minimum dice after soak, before counting successes (1.146). */
  minimum?: number;
  /** The first amount's own dice at or below this are thrown again once, the new face standing: a
   *  weapon wielded two-handed by a fighter whose sheet gives it (1.98, 5e's Great Weapon Fighting). */
  reroll?: number;
  /** What the first amount is instead while something the fight reads holds, the first that holds
   *  winning (1.102): a creature's longsword with both hands, a swarm at half its health. */
  alternatives?: RulesetCombatDamageAlternative[];
}

/** One amount a creature's action deals in place of its first, and when. */
export interface RulesetCombatDamageAlternative extends RulesetCombatAmount {
  when: "twoHanded" | { selfHealthAtMost: number };
}

/** A save that ends a condition: at a turn's start or end, or on damage. Counted (1.258), it ends
 *  only after `successes` of them, and after `failures.count` failures `becomes` another condition. */
export interface RulesetCombatSaveEnds {
  save: string;
  /** `action` (1.264): rolled when its holder spends their action on it. */
  at: "turn-end" | "turn-start" | "damaged" | "action";
  successes?: number;
  failures?: { count: number; becomes: string };
  /** Rolled only while its holder cannot see whoever put it on (1.266). */
  unseen?: true;
  /** Rolled with this lean while its holder can see whoever put it on (1.268). */
  seenLean?: "advantage" | "disadvantage";
  /** Rolled only while its holder stands farther than this from whoever put it on (1.270), in the
   *  ruleset's distance. */
  beyond?: number;
  /** With `at: "damaged"`, rolled only on harm from whoever put it on (1.274): Sympathy. */
  bySource?: true;
}

/** One thing a combatant let fall (1.266). */
export interface RulesetDroppedThing {
  key: string;
  label: string;
  at?: RulesetCombatCell;
  /** The budget picking it up costs; without one, the turn's one free pick-up. */
  pickUp?: string;
}

/** A condition a hit or a failed save puts on its target. */
export interface RulesetCombatApplies {
  condition: string;
  /** The creature type its user named as they used it (1.270), remembered by what it puts on. */
  kind?: string;
  duration:
    "instant" | "until-save" | "this-action" | { rounds: number; at?: "turn-start"; of?: "source"; untilLair?: true };
  /** Its source holds no more than this many with it at once (1.320). */
  heldAtMost?: number;
  saveEnds?: RulesetCombatSaveEnds;
  endsAfter?: RulesetConditionEnding;
  /** It comes off once its holder attacks, or casts from one of these catalogs (1.180). */
  endsWhenHolder?: { attacks?: true; casts?: string[]; moves?: true; acts?: true; uses?: string[] };
  /** It comes off once its holder is this far from whoever put it on, and, with `unseen`, out of
   *  their sight (1.310): Eyebite's panic. */
  endsAway?: { beyond: number; unseen?: true };
  /** What breaking free of it is rolled against, in place of the holder's own side of the contest
   *  (1.103): 5e's "grappled (escape DC 13)"; `"save"` is the applier's save difficulty (1.174). */
  escapeDc?: number | "save";
  /** The contest checks that may break it, in place of the contest's own (1.175). */
  escapeChecks?: string[];
  /** It goes on only while this value off its applier's sheet stands within the bounds (1.167). */
  when?: RulesetSheetBounds;
  /** It goes on only a target that is this (1.168). */
  targetIs?: RulesetTargetIs;
  /** It ends whenever this other condition put on with it ends (1.202). */
  endsWith?: string;
  /** A check its holder may spend the standard budget on to end it (1.313): Maze's way out. */
  checkEnds?: { check: string; difficulty: number; passes?: RulesetTargetIs };
  /** More of what the condition harms with for each step of a higher cost it was put on with (1.255). */
  harmsPerCostStep?: { dice?: string; flat?: number };
  /** A creature of one of these threat tiers or below is destroyed in its place (1.266). */
  destroysUpTo?: Array<{ tier: string; when?: RulesetSheetBounds }>;
  /** A number off its applier's sheet, fixed as it goes on, for the condition's `temporary` (1.274). */
  value?: RulesetValueRef;
}

/** A value read off a sheet and the bounds it must stand within: one bound or both. */
export interface RulesetSheetBounds {
  value: RulesetValueRef;
  atLeast?: number;
  atMost?: number;
}

/** What takes a condition off after it has been used once: the holder's own next attack roll, the
 *  next attack roll made against the holder, or the holder's own next save. */
export type RulesetConditionEnding = "own-attack" | "attacked" | "own-save";

/** One side of a contest as it was thrown: the check it added, and, when a condition made it more or
 *  less than one throw or changed the number, how. */
export interface RulesetContestSide {
  check: string;
  rolls: number[];
  modifier: number;
  total: number;
  mode?: RulesetCombatRollMode;
  bonuses?: RulesetConditionBonus[];
  /** Under `dice-pool`: the pool as it was thrown, and `total` is its net successes. */
  pool?: RulesetCombatPoolRoll;
}

/** One pool a `dice-pool` fight threw to act: how many dice went in after everything that adds or
 *  takes them away (the ruleset's own floor and ceiling included), the per-die target, the wound
 *  penalty it took, and whether it botched. The event's `modifier` is the number it started from and
 *  its `total` the net successes. */
export interface RulesetCombatPoolRoll {
  dice: number;
  target: number;
  /** Dice the wound penalty took off, as a negative number. Absent when it took none. */
  penalty?: number;
  botch?: boolean;
  /** A `symbol-pool` fight's throw (1.382): the symbols left after cancelling, by id, and the dice
   *  that went in. `dice` is then the thrower's own dice, `upgrades` how many were upgraded, and
   *  `difficulty` the dice thrown against them. */
  symbols?: Record<string, number>;
  upgrades?: number;
  difficulty?: number;
  boost?: number;
  setback?: number;
}

/** What one condition (or a level of a track or a derived value) added to, or took from, one roll or
 *  number. `level` is set when it came from a level, and then `condition` is the track's id, or the
 *  derived value's where `derived` is set. Dice it rolled are kept, so the log can say what was thrown. */
export interface RulesetConditionBonus {
  condition: string;
  level?: number;
  derived?: true;
  /** Set on what an item added, whose `condition` is then the stack's name. */
  item?: true;
  value: number;
  rolls?: number[];
  /** Added after the roll fell short (1.249). */
  rescue?: true;
  /** Added by one of its holder's own entries (1.256), whose `condition` is then that entry's name. */
  entry?: true;
}

export interface RulesetCombatSaveRider {
  save: string;
  difficulty: number;
  onSuccess: "none" | "half" | "negates";
  /** Cover does not help the target with this save (combat C6a-2). */
  ignoresCover?: true;
  /** What else it counts as being against, for a save modifier's `against` (1.181). */
  against?: { conditions?: string[]; damage?: string[] };
  /** Who succeeds without rolling (1.181): immune to one of these damage types or conditions, or
   *  one that is this. */
  succeeds?: { immune?: string[]; conditionImmune?: string[]; is?: RulesetTargetIs };
  /** A target that is this rolls it twice, the better or the worse kept (1.185). */
  modes?: Array<{ is: RulesetTargetIs; mode: "advantage" | "disadvantage" }>;
  /** Its user's own side fails it without rolling (1.278): Calm Emotions. */
  alliesMayFail?: true;
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
  /** Actions of one block naming the same group are spent together and come back on one roll (1.186):
   *  a metallic dragon's two breaths. */
  group?: string;
}

/** What a blow adds after its maker ran straight at the one it hit this turn (1.186): a minotaur's
 *  Charge. More damage, then a save, and on a failed one (or with no save) a push and conditions. */
export interface RulesetCombatCharge {
  /** How far the run toward the target must be: the ruleset's distance on a block, cells in a fight. */
  atLeast: number;
  plus?: RulesetCombatDamageClause[];
  save?: { save: string; difficulty: number };
  /** The ruleset's distance on a block, cells in a fight. */
  push?: number;
  applies?: RulesetCombatApplies[];
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
  /** Any-of: one of them being true is enough. "ally-adjacent-no-disadvantage" (Capability API
   *  1.126) also needs the roll's final mode not to be disadvantage. */
  when?: Array<"advantage" | "ally-adjacent" | "ally-adjacent-no-disadvantage">;
  oncePer: "turn" | "round";
  amount: RulesetCombatAmount;
  type?: string;
}

/** A teleport (1.276): its user goes at once to a free place within `distance`, one they can see
 *  with `seen`, taking up to `carries` willing creatures of their side no bigger than them from
 *  within `carriesWithin` (touching when left out), who land as near them as there is room. */
/** A legendary move (1.283). `noOpportunity`: nobody strikes at it leaving. `untouchable`: nothing
 *  harms or holds it on the way (a mummy lord's Whirlwind of Sand). */
export interface RulesetCombatMove {
  share?: number;
  distance?: number;
  noOpportunity?: true;
  untouchable?: true;
  /** The one way of moving it uses (1.285). */
  speed?: RulesetMoveMode;
}

/** What an obscuring zone does to sight (1.178, 1.286). */
export interface RulesetObscures {
  pierced: string[];
  light?: true;
  /** Ended by a wind at once, or only once it has stood in one this many whole rounds (1.289). */
  dispersed?: true | { after: number };
  /** Magical darkness, which a zone that `dispelsDark` ends (1.297). */
  darkness?: true;
}

export interface RulesetTeleport {
  distance: number;
  seen?: true;
  carries?: number;
  carriesWithin?: number;
  /** Only those its user sees go along (1.279). */
  carriesSeen?: true;
  /** It may take its user, and those along, out of the fight (1.279). */
  leaves?: true;
  /** A cloud on the cell left and the cell landed in, until the end of its user's next turn (1.279). */
  smoke?: { pierced?: string[]; light?: true; dispersed?: true | { after: number } };
  /** A creature's (1.280): one of its own actions, by id, it may make once before or after the
   *  teleport as part of the same action. A blink dog's bite. */
  strike?: string;
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
  /** In a `symbol-pool` fight, how many of the `toHit` dice are upgraded ones (1.382). */
  upgrades?: number;
  autoHit?: boolean;
  /** Senses a target must have for this to affect it (Capability API 1.127). */
  needs?: string[];
  /** Any one of `needs` is enough (1.267). */
  needsAny?: true;
  /** Only a creature its maker can see may be picked (1.178). */
  seen?: true;
  /** What using it needs, by the ids of `combat.components` (1.179). */
  components?: string[];
  damage?: RulesetCombatDamage;
  heal?: RulesetCombatAmount;
  /** What it is (1.262): `["magical"]`, a deva's Healing Touch. */
  qualities?: string[];
  /** The conditions it ends on each target (1.261): Healing Touch. */
  ends?: { conditions: string[]; count?: number; from?: RulesetTargetIs };
  targets?: "ally" | "any";
  save?: RulesetCombatSaveRider;
  /** Pushed this far straight away from the creature, in the ruleset's own distance, on a failed save
   *  when it has one (1.184). */
  push?: number;
  /** The creature teleports, in the ruleset's own distance (1.276). */
  teleport?: RulesetTeleport;
  /** A move bought with points (1.283): `share` of its speed or `distance` in the ruleset's own unit. */
  move?: RulesetCombatMove;
  /** A spell cast with points between turns (1.284): its own spellcasting, or cantrips only. */
  casting?: { cantripsOnly?: true };
  /** It looks for whoever is hiding (1.287): a legendary Detect. */
  search?: true;
  /** The light it sheds from now on, or "out" (1.296), in the ruleset's distance. */
  sheds?: RulesetLightRadius | "out";
  /** An area that stays where its area is aimed (1.324), as a catalog entry's. */
  zone?: RulesetCatalogZone;
  /** What it does to the ground its area covers, for good (1.324). */
  ground?: RulesetCreatureGround;
  /** Whoever it lands on walks toward it on their own budget (1.326): Whisper a Name. */
  draws?: { spends: string };
  /** Only at somebody who has taken their turn this round (1.327): the Hour Bell. */
  actedOnly?: true;
  /** Its concentration broken, this lair action is its next (1.327): the Litany of Keeping. One of a
   *  list, its runner picking (1.336). */
  brokenNextLair?: string | string[];
  /** Creatures it calls into the fight (1.325), by bestiary entry, `count` of them. */
  calls?: { creature: string; count: RulesetCombatAmount; initiative?: "roll" | "after" };
  /** A permission (1.291): these standard actions taken with this action's budget, only while it
   *  stands obscured where it says so. 5e's Nimble Escape, Cunning Action, Shadow Stealth. */
  standard?: { actions: string[]; while?: "obscured" };
  /** The ability its attack is made with (1.189), so changes narrowed to an ability reach it. */
  ability?: string;
  /** Its damage lowers the health maximum (1.203): on a failed save of its own, on a failed save of
   *  the action's (`onFailedSave`), or on every blow (1.235); only `damageType`'s, healing its maker
   *  with `heals`. */
  reducesMax?: {
    save?: string;
    difficulty?: number;
    onFailedSave?: true;
    damageType?: string;
    heals?: true;
    lasting?: true;
  };
  /** Its maker regains health by `share` (1 when left out) of the damage dealt, only `damageType`'s
   *  when named (1.281). */
  drain?: { share?: number; damageType?: string };
  /** Offered only on a target holding one of these, or one of `fromSelf` its maker put on (1.235). */
  targetHolds?: { conditions?: string[]; fromSelf?: string[] };
  /** What it adds after a straight run at its target this turn (1.186). */
  charge?: RulesetCombatCharge;
  /** What a save that ENDS one of `applies` is rolled against, when the action has no save of its
   *  own to borrow the number from. */
  saveDifficulty?: number;
  applies?: RulesetCombatApplies[];
  /** Held by its maker's concentration (1.307). */
  concentration?: true;
  /** Only at somebody at no health and still alive; a failed save kills them, and its maker gains
   *  `healsOnSlay` for each (1.311): Consume Life. */
  dyingOnly?: true;
  slaysOnFailedSave?: true;
  healsOnSlay?: RulesetCombatAmount;
  /** Who it fells on Held Ground is reaped (1.323). */
  reaps?: true;
  targetCount?: number;
  reach?: number;
  range?: number | RulesetCombatRange;
  /** The shape it lands in, in the ruleset's own distance unit. */
  area?: {
    shape: RulesetCombatArea["shape"];
    size: number;
    width?: number;
    friendlyFire?: boolean;
    around?: true;
    throughWalls?: true;
    aroundProp?: string;
  };
  uses?: RulesetCombatUses;
  recharge?: RulesetCombatRecharge;
  /** Other actions of this block, in order. ONE budget pays for the lot, and each part takes its
   *  own targets: this is how a creature that strikes twice in one action is written. */
  sequence?: Array<{ action: string; times: number }>;
  /** Bought out of the block's own `signaturePoints` instead of a budget. */
  signature?: { cost: number };
  /** A lair action (1.315), taken on the block's `lairInitiative` while it fights in its lair. */
  lair?: true;
  /** Taken at a moment rather than on a turn, as a catalog entry's reaction is. */
  reaction?: {
    on: RulesetReactionMoment;
    at?: "source" | "chosen" | "target";
    cancels?: true;
    cancelSave?: { save: string; dc: number };
    for?: "self" | "ally" | "any";
    within?: number;
    against?: RulesetReactionAgainst;
    /** More moments it is taken at, each with its own `against` (1.117). */
    also?: RulesetReactionAlso[];
    /** Only a blow of this kind opens its `hit` moment (1.118). */
    blow?: RulesetBlowKind;
    /** Only while its holder sees whoever caused the moment (1.118). */
    seesSource?: true;
    /** It stops only what was paid no higher up its family than itself (1.116). */
    upTo?: "paid";
    /** Above that, a check (its own number, `{ "const": n }`) against `dc` plus the level. */
    above?: { check: { const?: number }; dc: number };
  };
  /** It lands on the creature itself. */
  self?: true;
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
  /** Its own rolls twice on some checks, where it says (1.291): keen senses, sensitivity to light,
   *  camouflage. */
  checkModes?: RulesetCheckModeRule[];
  /** The light it sheds (1.294), in the ruleset's distance. */
  light?: RulesetLightRadius;
  /** It begins the fight with its light out (1.296). */
  unlit?: true;
  /** Its own light out while one of these conditions is on it (1.298). */
  lightOutWhile?: string[];
  /** Its own attacks rolled twice, where it says (1.293): sensitivity to sunlight. */
  attackModes?: RulesetAttackModeRule[];
  /** Its passive Perception as printed (1.291), where it is not the ruleset's passive plus its check. */
  passive?: number;
  /** Its own ways of hiding and finding (1.292), in the ruleset's distance. */
  hiding?: RulesetHidingTraits;
  /** Spells cast without slots, kept beside the block's own actions (1.123). */
  spellcasting?: RulesetCreature["spellcasting"];
  /** The creature described in the ruleset's OWN terms: a character sheet, as partial as it likes,
   *  keyed by the ids the ruleset declares. An opponent built from one is built the way a party
   *  member is, so its health, defense, saves, speed, initiative and the abilities on its lists all
   *  come from what the ruleset declares rather than from the numbers above, which it then does
   *  not carry. Its own `actions` still add to what the sheet gives it. */
  sheet?: RulesetSheetBuild;
  /** Thrown once when the encounter is created, in place of the flat number. */
  healthDice?: RulesetCombatAmount;
  speed?: number;
  /** How fast it moves other than on foot, in the ruleset's own distance (1.113). `speed` is its walk. */
  speeds?: RulesetMoveSpeeds;
  /** It flies without needing to keep moving, so nothing knocks it out of the air (1.113). */
  hover?: true;
  /** Its hands are full, so a `twoHanded` alternative never holds (1.102). */
  shield?: true;
  /** One of `combat.sizes`, by id (1.103). */
  size?: string;
  /** One of `combat.creatureTypes.types`, and its tags (1.168): what a target test reads. */
  type?: string;
  tags?: string[];
  /** Ability scores by the ruleset's own ability ids. Carried for the Game Master, not resolved. */
  abilities?: Record<string, number>;
  /** Save modifiers by the ruleset's own save ids. A save it does not name reads as zero. */
  saves?: Record<string, number>;
  /** What it adds in a contest, by the ids of `combat.checks`. One it does not name reads as zero. */
  checks?: Record<string, number>;
  /** Damage types, matched without case: half damage, double damage, none at all. A resistance or an
   *  immunity may name the item tags a blow gets through it with. */
  resist?: RulesetCreatureHideEntry[];
  vulnerable?: string[];
  immune?: RulesetCreatureHideEntry[];
  /** Conditions it shrugs off, and tracks whose levels it never suffers (1.115). */
  conditionImmunities?: string[];
  /** Conditions it has on through every fight (1.263): an aura it spreads. */
  keepsOn?: string[];
  /** What it holds that is no action of its own (1.267): a printed shield, let fall by its tags. */
  held?: { label: string; tags: string[]; defense?: number }[];
  /** How far it senses with each of `combat.senses`, in the ruleset's distance (1.178). */
  senses?: Record<string, number>;
  /** Where its live tracks stand as the fight begins (1.115). */
  tracks?: Record<string, number>;
  /** What it soaks in a `dice-pool` fight, for any harm and by kind of the health track. */
  soak?: RulesetCombatSoak;
  /** A spending blow whose dice are below this lands and does nothing. */
  hardness?: number;
  /** The threat tier a bestiary filed it under, read when creatures are clamped to the scale. */
  tier?: string;
  /** Lines the Game Master is shown and nothing resolves. */
  traits?: Array<{ name: string; text: string }>;
  /** Points given back at the start of its own turn, spent on `signature` actions. */
  signaturePoints?: number;
  /** The count its lair actions are taken on (1.315), losing ties; 20 when left out. */
  lairInitiative?: number;
  /** How many failed saves it may turn into successes (1.317): 5e's Legendary Resistance (3/Day). */
  legendaryResistance?: number;
  /** Dropping to 0, it is left at 1 instead this many times (1.320), with a turn straight after where
   *  it says: the Miller's Hourglass. */
  hangsOn?: { uses: number; extraTurn?: true; label?: string };
  /** It does not move while any of its cells is in one of these lights (1.319): Lantern-Shy. */
  stillIn?: RulesetBoardLight[];
  /** What this creature adds to the first qualifying hit of a period, all by itself. */
  riders?: RulesetCombatRider[];
}

/** What a combatant soaks: `all` for any harm, and `byKind` for one kind of the health track. */
export interface RulesetCombatSoak {
  all?: number;
  byKind?: Record<string, number>;
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
      /** The items they hold as the fight starts, which an `itemStat` on their sheet reads. */
      items?: ReadonlyArray<RulesetSheetItem>;
    }
  | { id: string; name: string; side: "enemy"; block: RulesetStatBlock }
  /** An opponent out of a bestiary, looked up in the catalogs the encounter was handed. */
  | {
      id: string;
      name: string;
      side: "enemy";
      creature: { catalogId: string; entryId: string };
      /** Where its live tracks stand as the fight begins (1.115), as a bestiary creature has none. */
      tracks?: Record<string, number>;
      /** Its stat block as this fight has it (1.363): a story fight's Legendary Resistance and health. */
      adjust?: { legendaryResistance?: number; health?: number; calls?: Array<{ action: string; creature: string }> };
    };

/** One thing a combatant may do, with every number already read off the sheet or the stat block.
 *  Resolved once, when the fight begins: armour and bonuses do not change mid-fight in this kind. */
export interface RulesetCombatAction {
  /** The entry's qualities, even without damage, for saves against magic (1.134). */
  qualities?: string[];
  /** A catalog attack or debuff targets harmfully even if it deals no damage (1.125). */
  harmful?: true;
  id: string;
  /** `reload` fills a weapon's clip: it has no target and does nothing else. `item` is using an
   *  item the fighter holds. */
  kind: "attack" | "ability" | "block" | "contest" | "reload" | "item" | "switch";
  label: string;
  budget: string;
  /** Who it may be pointed at, relative to the actor: "enemy" is the other side. */
  /** `repeat`: the same target may be named more than once, each its own attack (1.305). */
  targets: { side: "enemy" | "ally" | "self" | "any"; count: number; repeat?: true };
  /** The ability actually used for the attack roll (Capability API 1.133). A plain stat-block
   *  action has none; a weapon offering several keeps the first best one, as its roll does. */
  ability?: string;
  /** Its damage lowers the health maximum (1.203): on a failed save of its own, on a failed save of
   *  the action's (`onFailedSave`), or on every blow (1.235); only `damageType`'s, healing its maker
   *  with `heals`. */
  reducesMax?: {
    save?: string;
    difficulty?: number;
    onFailedSave?: true;
    damageType?: string;
    heals?: true;
    lasting?: true;
  };
  /** Its maker regains health by `share` (1 when left out) of the damage dealt, only `damageType`'s
   *  when named (1.281). */
  drain?: { share?: number; damageType?: string };
  /** Offered only on a target holding one of these, or one of `fromSelf` its maker put on (1.235). */
  targetHolds?: { conditions?: string[]; fromSelf?: string[] };
  toHit?: number;
  /** In a `symbol-pool` fight, how many of the `toHit` dice are upgraded ones (1.382). */
  upgrades?: number;
  /** The per-die target a pool fight throws this attack against, where the ruleset lets it move: a
   *  weapon's own. Without one the attack is thrown against the pool's usual target. */
  target?: number;
  autoHit?: boolean;
  /** Senses a target must have for this to affect it (Capability API 1.127). */
  needs?: string[];
  /** Any one of `needs` is enough (1.267). */
  needsAny?: true;
  /** Cells its targets must all stand within of each other (1.267): Command. */
  targetsWithin?: number;
  /** Only a creature its maker can see may be picked (1.178). */
  seen?: true;
  /** What using it needs, by the ids of `combat.components` (1.179). */
  components?: string[];
  /** Offered only while this reads within its bounds off the holder's sheet (Capability API 1.166). */
  usableWhen?: RulesetSheetBounds;
  /** Who it may be pointed at or catch, by what they are (Capability API 1.168). */
  targetTypes?: {
    is?: RulesetTargetIs;
    not?: RulesetTargetIs;
    /** Ability scores at most these, and not immune to these conditions (1.185). */
    abilityAtMost?: Record<string, number>;
    abilityAtLeast?: Record<string, number>;
    notImmuneTo?: string[];
  };
  /** Dealt at its most to a target that is this (1.185). */
  maxAgainst?: RulesetTargetIs;
  damage?: RulesetCombatDamage;
  heal?: RulesetCombatAmount;
  temporary?: RulesetCombatAmount;
  /** Health shared out among its targets, least health first (1.196); the rest are left alone. */
  healthPool?: RulesetCombatAmount;
  /** Whom the pool passes over (1.199): holders of these conditions, and those who cannot see its
   *  maker when `unseeing`. */
  healthPoolSkips?: { conditions?: string[]; unseeing?: true };
  /** Affects only a target with this much health or less (1.196). */
  healthAtMost?: number;
  /** Kills outright whoever it affects (1.196). */
  kills?: true;
  /** A pool of each target's sheet this gives back some of: an item's `restore`. */
  /** `overMax` (1.252): it may go past the pool's maximum, as Font of Magic's slots do. */
  restore?: { pool: string; amount: RulesetCombatAmount; overMax?: true };
  /** Conditions it takes off its target, in the order named, at most `count` of them (1.176); with
   *  `from`, only what a creature that is that put on (1.236). */
  ends?: { conditions: string[]; count?: number; from?: RulesetTargetIs };
  /** Offered only while its user holds this condition, which gave it to them (1.236). */
  whileHolds?: string;
  /** What it adds for each step of the cost the condition giving it was put on with (1.300), once
   *  for every `every` steps: Flame Blade's 1d6 for every two slot levels above 2nd. */
  heldSteps?: { amount: RulesetCombatAmount; every?: number; max?: number };
  /** Used, it ends this condition on its user (1.236): Dispel Evil and Good's Dismissal ends the
   *  spell. */
  endsCondition?: string;
  /** Used only while its user stands in one of these lights (1.303). */
  usableIn?: { light: RulesetBoardLight[] };
  /** Only within `within` cells of a standing prop named `prop` by id or label (1.332). */
  usableNear?: { prop: string; within: number };
  /** Whoever it lands on leaves the fight (1.236): for good, or only while they hold `while`, put on
   *  by the same use; with `gone`, one that is that stays gone if `while` ran its whole time. */
  dismisses?: true | { while: string; gone?: RulesetTargetIs; turns?: true };
  /** It steadies a dying target: no more dying rolls (1.176). */
  stabilizes?: boolean;
  /** Live tracks it moves on whoever it lands on and who does not save, by levels (1.201). */
  tracks?: Array<{ track: string; by: number }>;
  /** It gives back the health only a rest would (1.201). */
  unseals?: true;
  /** It does one of its cures, not all (1.204): the mode picked, else the first the target needs. */
  cureOneOf?: true;
  /** Its user names a creature type as they use it (1.270), one of `modes`. */
  kindChoice?: true;
  /** Taken as its holder's own attack hits, its damage joins that blow (1.241): Divine Smite. */
  addsToBlow?: true;
  /** Taken as somebody else's attack hits, these dice come off the roll (1.250): Cutting Words. */
  lowersRoll?: { count: number; sides: number; flat: number; also?: Array<"checks" | "damage"> };
  /** Its user chooses how many uses one use spends, and it heals that many times over (1.251). */
  usesChosen?: true;
  /** Changes how another action is used, chosen with it and paid for with this one's uses (1.253):
   *  5e's Metamagic. Never on a menu of its own. */
  alters?: RulesetCombatAlter;
  /** Its price in uses is the level the action it alters is paid at, at least one (1.253). */
  usesSpentByLevel?: true;
  /** What the alterations it was used with left on it to do as it resolves (1.253). */
  altered?: {
    spares?: number;
    spared?: string[];
    rerolls?: number;
    heightens?: true;
    /** Who Heightened gives disadvantage, as its user picked them (1.255). */
    heightened?: string;
    subtle?: true;
  };
  /** A miss deals half its damage, and nothing else it does on a hit (1.255). */
  halfOnMiss?: true;
  /** The alterations already set on it (1.253), so they are never set twice. */
  alteredWith?: string[];
  /** The tags of the held weapon it is made with (1.246), for what comes after the attack action. */
  itemTags?: string[];
  /** A failed save drops its target to 0 health instead of the amount (1.245). */
  dropsOnFailedSave?: true;
  /** Only at somebody at no health and still alive (1.311). */
  dyingOnly?: true;
  /** A failed save kills its target, and its user regains this for each one (1.311): Consume Life. */
  slaysOnFailedSave?: true;
  healsOnSlay?: RulesetCombatAmount;
  /** Who it fells on Held Ground is reaped there and then (1.323): a Reaping Hook. */
  reaps?: true;
  /** Offered only once the attack action has been taken this turn (1.242): Flurry of Blows. */
  afterAttack?: RulesetAfterAttack;
  /** Offered only on its holder's own turn before they have attacked in it (1.247): Reckless Attack. */
  beforeAttack?: true;
  /** Spent when its holder's own roll of this kind has failed (1.249): Indomitable, Stroke of Luck. */
  rescue?: RulesetCombatRescue;
  /** Never pointed at its own user (1.256): Bardic Inspiration's "one creature other than you". */
  notSelf?: true;
  /** Pointed only at a creature no bigger than this size (1.314): Resilient Sphere's "Large or
   *  smaller". */
  targetsUpTo?: string;
  /** Takes growth off the cells its area covers (1.318). */
  clears?: "growth";
  /** Puts a weapon in its user's hand, the one its mode names (1.306): Pact of the Blade. What each
   *  mode makes is the combatant's `conjurable`. */
  conjures?: true;
  /** Not used on the same creature again until its user takes this rest (1.304): Chains of Carceri. */
  oncePerTarget?: { until: string };
  /** Its damage never takes a target below this much health (1.235). */
  leavesAtLeast?: number;
  /** It brings back a target that died no more than `withinRounds` rounds ago, at `amount` (1.176). */
  revives?: { withinRounds: number; amount: RulesetCombatAmount };
  save?: RulesetCombatSaveRider;
  /** The source's own save difficulty, for a save-ends on an action with no save of its own. */
  saveDifficulty?: number;
  applies?: RulesetCombatApplies[];
  /** What it puts on its own user as it is made (1.307): Sunbeam's mote. */
  appliesSelf?: RulesetCombatApplies[];
  /** Standard actions its user takes with it (1.313): Expeditious Retreat's Dash. */
  takes?: Array<"dash" | "disengage" | "dodge">;
  /** The same made again while its user concentrates on this one (1.310): Vampiric Touch. This is
   *  the cast; `again` marks the copy offered on `budget`. */
  repeats?: { budget: string; notSaved?: true; sameTargets?: true; group?: string };
  /** A concentration entry's effect made again (1.310): offered only while its user concentrates on
   *  `of`, costing nothing off the sheet, at what the cast was paid at. */
  again?: { of: string; notSaved?: true; sameTargets?: true; group?: string };
  concentration?: boolean;
  /** How the price is paid. The name is what the sheet's own `use` command knows the row by, and
   *  the pool and its family are what a higher-pool payment is measured against. */
  use?: {
    name: string;
    pool?: string;
    group?: string;
    perCostStep?: RulesetCombatAmount;
    /** More targets for each step of a higher cost (1.171). */
    targetsPerStep?: number;
    /** The most steps of a higher cost that count (1.241). */
    stepsMax?: number;
    /** `perCostStep` once for every this many steps (1.300). */
    stepsEvery?: number;
    /** How many of the row's uses one use spends (1.245). */
    count?: number;
    /** `name` is another entry's counter (1.239 `usesOf`): only that counter is spent, and the price
     *  is this entry's own cost, never the other entry's. */
    usesOf?: { cost: Array<{ pool: string; amount: number }> };
  };
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
  standard?: { actions: string[]; budget: string; while?: "obscured" };
  /** Its holder's own ways of hiding and finding (1.292), `aware` in cells. A permission. */
  hiding?: RulesetHidingTraits;
  /** The other actions this one resolves, in order, for one budget. */
  sequence?: RulesetCombatSequenceStep[];
  /** Bought with the actor's own points at the end of somebody else's turn, not with a budget. */
  signature?: { cost: number };
  /** A lair action (1.315): on its maker's lair count, once a round, while it fights in its lair. */
  lair?: true;
  /** Taken at a MOMENT rather than on a turn: which moment, whom it may be aimed at, and whether
   *  taking it stops what opened the window. On no turn's menu, ever. */
  reaction?: {
    on: RulesetReactionMoment;
    at: "source" | "chosen" | "target";
    cancels?: true;
    cancelSave?: { save: string; dc: number };
    for?: "self" | "ally" | "any";
    within?: number;
    /** Only an action from an entry of one of these catalogs, or one of these entries, opens its
     *  moment for this reaction. */
    against?: RulesetReactionAgainst;
    /** More moments it is taken at, each with its own `against` (1.117). */
    also?: RulesetReactionAlso[];
    /** Only a blow of this kind opens its `hit` moment (1.118). */
    blow?: RulesetBlowKind;
    /** Only while its holder sees whoever caused the moment (1.118). */
    seesSource?: true;
    /** Its holder's own attack hitting, aimed at whoever it hit (1.241). */
    by?: "self";
    /** Only a weapon's blow opens it (1.241). */
    weapon?: true;
    /** Only a hit by an attack named so (1.245). */
    names?: string[];
    /** Only a hit by a strike paid for from this budget (1.248). */
    budget?: string;
    /** Only one of its holder's answers sharing this name is taken at each of their hits (1.248). */
    oneOf?: string;
    /** Only a hit with the item at this place in its holder's items (1.273): charges spent on it. */
    item?: number;
    /** It stops only what was paid for no higher up its pool family than this was (1.116). */
    upTo?: "paid";
    /** Above that, a check, read once as the fight began, against `dc` plus the level of what it
     *  answers. */
    above?: { modifier: number; dc: number };
  };
  /** The catalog of the entry this action was built from, when it was built from one. A weapon row,
   *  a stat block's own action, a contest and a standard action have none. */
  catalog?: string;
  /** The catalog an item's use casts from (1.180), as a scroll does: casting, without being an entry. */
  casts?: string;
  /** And the entry itself, as `<catalog>/<entry>` (1.117): what a reaction or a condition that names
   *  one entry reads. */
  entry?: string;
  /** IN CELLS, resolved once when the fight began, and read only by a positioned fight. An action
   *  with neither reaches one cell, which is the smallest step a board has. */
  reach?: number;
  range?: RulesetCombatRange;
  /** The level of a spell cast without slots, and the base it scales from (1.123). */
  innate?: { level: number; baseLevel: number; coven?: { id: string; size: number; within: number } };
  /** What this leaves to strike on later turns (1.122), with distances already in cells. */
  summons?: { budget: string; rounds: number; move?: number; reach?: number };
  /** The area stays (1.172): for how many of its caster's turns, where it is held, and when it does
   *  its effect again. */
  zone?: RulesetCombatZoneRule;
  /** Cells whoever it lands on and does not save against is pushed straight away from its maker
   *  (1.182): 5e's Gust of Wind. */
  push?: number;
  /** Its user teleports (1.276): in the ruleset's distance on a block, in cells in a fight. */
  teleport?: RulesetTeleport;
  /** A move bought with points between turns (1.283), to a cell picked from the option's `cells`:
   *  `share` of its speed, or `distance` (in cells in a fight), its own speed with neither. */
  move?: RulesetCombatMove;
  /** A spell cast with points between turns (1.284). */
  casting?: { cantripsOnly?: true };
  /** It looks for whoever is hiding (1.287), and does nothing else: a legendary Detect. */
  search?: true;
  /** The light its user sheds from now on, or "out" (1.296), and nothing else: a magmin ablaze. */
  sheds?: RulesetLightRadius | "out";
  /** What it does to the ground its area covers, for good (1.324): a bonfire guttering, ice cracking. */
  ground?: RulesetCreatureGround;
  /** Whoever it lands on spends `spends` to walk up to their speed toward its user (1.326). */
  draws?: { spends: string };
  /** Only at somebody who has taken their turn this round (1.327). */
  actedOnly?: true;
  /** Its concentration broken, this lair action of its user's is the next they take (1.327), or one of
   *  a list (1.336). */
  brokenNextLair?: string | string[];
  /** Creatures it calls into the fight on its user's side (1.325), their block found as the fight
   *  began: Jars Burst's zombies. */
  calls?: {
    block: RulesetStatBlock;
    name: string;
    /** Its bestiary entry, which a called one is drawn as. */
    creature: { catalogId: string; entryId: string };
    count: RulesetCombatAmount;
    after?: true;
  };
  /** A burst centred on its user, never aimed (1.282): everybody within `size` cells of them is
   *  caught, they are not, behind walls too with `throughWalls`, their own side not with
   *  `friendlyFire: false`. Off a board, everybody. */
  around?: { size: number; throughWalls?: true; friendlyFire?: false };
  /** Made, it lets its user make this other action once more this turn for nothing (1.280): a blink
   *  dog's bite after its teleport, or its teleport after the bite. */
  followUp?: string;
  /** Built for a creature's teleport that strikes first (1.280): the actions it is made out of, whose
   *  uses and recharge it shares. */
  pairedWith?: string[];
  /** What it adds after a straight run at its target this turn, in cells (1.186). */
  charge?: RulesetCombatCharge;
  /** The shape this one covers, in cells, aimed at a cell rather than at anybody. */
  area?: RulesetCombatArea;
  /** What a contest rolls and what winning it does, on an action of kind `contest`. */
  contest?: RulesetCombatContest;
  /** What a weapon shoots: `per` of the holder's carried items with this tag each attack, and the
   *  share of what was shot that comes back after a fight the party wins. */
  ammo?: { tag: string; per: number; recover?: number };
  /** The loaded count a weapon keeps on itself: which of the holder's items it is (its place in
   *  `sheet.items`) and how many it holds. An attack spends what is loaded; a `reload` fills it. */
  clip?: { item: number; max: number };
  /** Turning one of the holder's items on or off (1.170): its place in `sheet.items`. */
  /** What it turns: an item (1.170), or the light its holder carries (1.295). */
  switches?: { item: number } | { carried: true } | { conjured: string };
  /** What turning it on and off is called (1.378): a hooded lantern's "Raise the hood". */
  switchLabels?: { on?: string; off?: string };
  /** The menu heading it sits under, from its list's `display` (1.378): "Spells", and the row's
   *  split under it, "1st level". */
  menuGroup?: RulesetCombatMenuGroup;
  /** Other ways to make this attack, chosen with it like an initiative style. */
  modes?: RulesetCombatMode[];
  /** How many one attack shoots when a mode says so, in place of its ammunition's own. */
  shots?: number;
  /** An off-hand weapon's own attack: attacking with it this turn lets another off-hand weapon strike
   *  on the off-hand budget. The item's place in `sheet.items`. */
  pairs?: number;
  /** The second attack, on the off-hand budget, made with the weapon at this place in `sheet.items`
   *  after its holder attacked with another off-hand weapon this turn. */
  offHandOf?: number;
  /** What a hit sets off around whoever it hit (1.312), from the mode it was made in. */
  aroundHit?: RulesetCombatAroundHit;
  /** Conditions the target takes when the harm this blow dealt reached a number. */
  onHit?: Array<{
    condition: string;
    atLeast: number;
    rounds?: number;
    /** The target saves against it, and a success keeps it off (1.169). */
    save?: { save: string; difficulty: number };
    /** It lasts until its holder makes this save at a turn's start or end (1.169). */
    saveEnds?: { save: string; difficulty: number; at: "turn-start" | "turn-end" | "damaged" };
    /** Only on a target that is this (1.187). */
    targetIs?: RulesetTargetIs;
    /** At most once in any one turn (1.187). */
    oncePerTurn?: true;
  }>;
  /** More to hit against a target that is this (1.187), or that carries a condition its maker put on
   *  it (`marked`, 1.189), and how else an attack on it is made (1.189). */
  against?: RulesetCombatAgainst[];
  /** A hit that leaves its target low enough kills it outright (1.187); `charges` is what it spends of
   *  the item at this place in `sheet.items` when it does, out of `max`. */
  slay?: Array<{
    when?: "always" | "critical";
    is?: RulesetTargetIs;
    not?: RulesetTargetIs;
    immuneTo?: string[];
    healthAtMost?: number;
    save?: { save: string; difficulty: number };
    charges?: { cost: number; max: number; item: number };
    /** What a made save leaves instead (1.192). */
    saved?: RulesetCombatApplies[];
  }>;
  /** Its damage ignores resistance to its own type (1.192): a vorpal sword. */
  ignoresResistance?: true;
  /** What its damage takes off comes back only with a rest (1.193): a sword of wounding. */
  healedOnlyByRest?: true;
  /** While a creature its wielder marked with `condition` stands, their attacks with every other
   *  weapon (the ranged ones with `ranged`) roll with `mode` (1.192). `item` is this weapon's place
   *  in `sheet.items`. */
  othersWhileMarked?: { condition: string; mode: "advantage" | "disadvantage"; ranged?: true; item: number };
  /** Using an item: which of the holder's items it is (its place in `sheet.items`), and what using
   *  it spends of it: one off the stack, or some of its charges. */
  itemUse?: {
    item: number;
    /** A fake used (Capability API 1.79): its true name, and what its true item does in place of what
     *  the action says (`rulesetActionAsUsed`), or `dud` where it does nothing a fight can use, so the
     *  use is spent for nothing. The fight says what it really was once it is spent. */
    fake?: { name: string; dud?: true; does?: Partial<RulesetCombatAction> };
    consumes?: true;
    charges?: {
      cost: number;
      max: number;
      /** Its last charge's die (1.271: `regains` on a high face, `atMost` optional). */
      breaksOn?: {
        die: number;
        atMost?: number;
        regains?: { atLeast: number; amount: RulesetCombatAmount };
        /** What it becomes in place of breaking (1.272), "<catalog>/<entry>". */
        becomes?: string;
      };
      /** More charges its user may spend, each a step of a higher cost (1.269), and farther pushed for
       *  each, in cells (1.271). */
      step?: { max: number; amount?: RulesetCombatAmount; targets?: number; push?: number };
    };
    /** Its `gate`, read off the user's sheet as the fight began: what is rolled (a skill's id when it
     *  is one, so what is narrowed to it counts), the sheet's number for it, and the difficulty. No
     *  gate here when the user's sheet was high enough to skip it. */
    /** `ability` is the one the check is made with (1.188), so a change narrowed to it counts. */
    gate?: { check: string; skill?: string; ability?: string; modifier: number; difficulty: number };
  };
}

/** One other way to make an attack: how many it shoots, what it adds to hit (dice in a pool fight),
 *  how far it moves a pool fight's per-die target, and how many it may be aimed at. */
export interface RulesetCombatMode {
  id: string;
  label: string;
  ammo?: number;
  toHit?: number;
  target?: number;
  targets?: number;
  /** Its own reach in cells (1.190): a javelin of lightning's bolt. */
  range?: { normal: number; long?: number };
  /** More on a hit in this mode (1.190). */
  plus?: RulesetCombatDamageClause[];
  /** What everybody between the wielder and the target saves against first (1.190). */
  line?: RulesetCombatModeLine;
  /** The item's charges one attack in this mode spends (1.190), at this place in `sheet.items`. */
  charges?: { cost: number; max: number; item: number };
  /** The one cure a cure that does one of them does in this mode (1.204). */
  cure?: { ends?: string; track?: { track: string; by: number }; unseals?: true };
  /** The creature type named in this mode (1.270), remembered by what it puts on. */
  kind?: string;
  /** What a hit in this mode sets off around whoever it hit (1.312), `within` in cells. */
  aroundHit?: RulesetCombatAroundHit;
}

/** A Hammer of Thunderbolts' clap (1.312): everybody within `within` cells of the one hit saves or
 *  takes `condition`. */
export interface RulesetCombatAroundHit {
  within: number;
  save: { save: string; difficulty: number };
  condition: string;
  rounds?: number;
  of?: "source";
}

/** A bolt on the way to a mode's target (1.190). */
export interface RulesetCombatModeLine {
  amount: RulesetCombatAmount;
  type?: string;
  save: { save: string; difficulty: number; onSuccess: "none" | "half" };
}

/** A contest as the fight resolves it: the check each side adds, who takes a tie, and what winning
 *  does. Both sides throw the fight's own attack dice. */
export interface RulesetCombatContest {
  /** The contest's own id in `combat.contests`. */
  id: string;
  /** It takes the place of one strike of an attack, so a cap on attacks counts it as one. */
  strike?: true;
  /** Each side rolls the best of the checks it may use here. */
  attacker: string[];
  defender: string[];
  ties: "defender" | "attacker";
  /** Aimed only at whoever put this condition on the actor, and offered only while it holds. */
  from?: string;
  /** Offered only while that hold names an escape DC (1.175). */
  escapable?: true;
  /** Not taken against a target more than this many of `combat.sizes` larger than the actor (1.103). */
  maxSizeAbove?: number;
  applies?: Array<{ condition: string; rounds?: number }>;
  ends?: Array<{ condition: string; on: "actor" | "target" }>;
  /** How far the loser is pushed straight away, IN CELLS. Read only by a positioned fight. */
  push?: number;
  /** A fixed number the actor meets to win, with nobody rolling against it (1.193). */
  difficulty?: number;
  /** Offered only on a target holding this, or only on one dying and not stable (1.193). */
  targetHolds?: string;
  targetDying?: true;
  /** Winning stabilizes a dying target (1.193). */
  stabilizes?: true;
}

/** A shape on the board, in cells. `friendlyFire` false leaves the actor's own side out of it. */
export interface RulesetCombatArea {
  /** `box` is a square `size` a side reaching away from its maker; `wall` a wall `size` long (1.177). */
  shape: "burst" | "cone" | "line" | "box" | "wall";
  size: number;
  /** A line's width, or a wall's thickness, in cells (Capability API 1.128, 1.177). Without it, one. */
  width?: number;
  /** A wall that may be laid instead as a ring this many cells across (1.177). */
  ring?: number;
  /** How many of it may be set down at once, each touching another (1.178): Fire Storm's cubes. */
  copies?: number;
  /** Its copies' middles each within this many CELLS of another's, rather than touching (1.301). */
  copiesWithin?: number;
  /** Cells it grows by for each step of a higher cost it is paid with (1.267): Confusion. */
  sizePerCostStep?: number;
  friendlyFire?: boolean;
  /** Around the standing props with this label instead of where it is aimed (1.331). */
  aroundProp?: string;
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
/** What a weapon does differently against some targets (1.187, 1.189). */
export interface RulesetCombatAgainst {
  is?: RulesetTargetIs;
  marked?: string;
  toHit?: number;
  mode?: RulesetCombatRollMode;
  ignoresCover?: true;
  ignoresLongRange?: true;
}

export interface RulesetTrackedCondition {
  /** Removed once the action that opened its window finishes (1.131). */
  thisAction?: true;
  condition: string;
  /** Turns of the affected combatant left, or null for a condition with no clock of its own. */
  rounds: number | null;
  saveEnds?: RulesetCombatSaveEnds;
  /** When its rounds count down: as each of the holder's turns begins, rather than as each ends. */
  clock?: "turn-start";
  /** Whose turns its rounds count (1.119): whoever put it on, while they are in the fight. */
  clockOf?: "source";
  /** What takes it off after one use, whatever its clock says. */
  endsAfter?: RulesetConditionEnding;
  /** What its holder does that takes it off (1.180): attacking, or casting from these catalogs. */
  endsWhenHolder?: { attacks?: true; casts?: string[]; moves?: true; acts?: true; uses?: string[] };
  /** How far from its putter, and out of their sight, takes it off (1.310). */
  endsAway?: { beyond: number; unseen?: true };
  /** The difficulty the repeated save is rolled against: the one that applied it. */
  difficulty?: number;
  /** The saves that ended it made and failed so far, where they are counted (1.258). */
  passes?: number;
  fails?: number;
  /** Who applied it, and whether their concentration is what holds it. */
  source?: string;
  /** Off as whoever put it on next comes to their lair's count (1.327): the Hour Bell's. */
  untilLair?: true;
  /** Spread by this combatant's aura (1.263): on while they are near, off as they part. */
  aura?: string;
  /** Left on by an aura that lingers (1.320) after its holder parted: off as their next turn starts. */
  lingering?: true;
  /** The aura (`<holder id>/<condition>`) its holder is kept clear of once this ends (1.269). */
  auraSafeOnEnd?: string;
  /** The creature type named as it was put on (1.270): an aura with `chosenKind` reaches only it. */
  kind?: string;
  /** Kept on through the fight by what its holder has (1.263), never written to a sheet. */
  kept?: true;
  /** What the action that put it on is known by (1.191), which a repeated save is against too. */
  action?: string[];
  concentration?: boolean;
  /** What breaking free of it is rolled against, from what applied it (1.103). */
  escapeDc?: number;
  /** The contest checks that may break it (1.175). */
  escapeChecks?: string[];
  /** The condition put on with it that it ends with (1.202). */
  endsWith?: string;
  /** A check its holder may spend the standard budget on to end it (1.313): Maze's way out. */
  checkEnds?: { check: string; difficulty: number; passes?: RulesetTargetIs };
  /** How many times it is on, where the condition stacks (1.189). */
  stacks?: number;
  /** What it harms with on top of the condition's own, from the higher cost it was put on with
   *  (1.255): Acid Arrow's extra 1d4 a slot level. */
  harmsMore?: RulesetCombatAmount;
  /** The number its applier gave it as it went on (1.274): Heroism's spellcasting modifier. */
  value?: number;
  /** The level of the spell that put it on, as it was paid for (1.299): what magical darkness of
   *  that level or more puts its light out by. */
  level?: number;
  /** How many steps above its base cost that spell was paid at (1.300): what an action the condition
   *  gives grows by. */
  steps?: number;
  /** The temporary points it last gave that its holder still had the most of (1.274), lost as it
   *  ends where its rule says so. */
  gaveTemp?: number;
}

export interface RulesetCombatant {
  id: string;
  name: string;
  side: RulesetCombatSide;
  /** The bestiary entry an opponent was made from, when it was made from one: what its art is found by
   *  (design-game-creature-art.md). Never read by the fight's rules. Out of a borrowed catalog (1.220),
   *  `from` names the lender's ruleset and catalog. */
  creature?: { catalogId: string; entryId: string; from?: { ruleset: string; catalog: string } };
  initiative: number;
  initiativeRoll: number[];
  initiativeModifier: number;
  /** The throw an initiative thrown twice did not keep (1.240), and which way it was thrown. */
  initiativeDropped?: number[];
  initiativeMode?: "advantage" | "disadvantage";
  /** What their own sheet says of how initiative is thrown (1.240): Feral Instinct. */
  initiativeLean?: "advantage" | "disadvantage";
  /** What is left of each budget, keyed by budget id. */
  budgets: Record<string, number>;
  actions: RulesetCombatAction[];
  /** How many uses are left of each action that counts them, keyed by action id. */
  uses: Record<string, number>;
  /** The ids of the actions that have been used and are waiting for a recharge roll. */
  spent: string[];
  /** The cells walked this turn, where the walking began first (1.186): what a charge reads. Cleared
   *  as their turn starts. */
  trail?: RulesetCombatCell[];
  /** What this combatant's blows did that may happen once a turn, and in which turn (1.187), as
   *  `<round>:<turn>`: a weapon's wound. */
  oncePerTurn?: { at: string; keys: string[] };
  /** The points a signature action is bought with, when this combatant has any. */
  signature?: { points: number; max: number };
  /** It fights in its lair (1.315): its lair actions are taken, on `lairAt`, losing ties. */
  lair?: {
    at: number;
    last?: { round: number; id: string };
    /** The lair action it must take next (1.327): its Litany broken. A list is one of those (1.336). */
    next?: string | string[];
  };
  /** How many of its block's legendary resistances it has spent (1.317). */
  legendaryResisted?: number;
  /** How many times it has hung on at 1 instead of dropping (1.320). */
  hungOn?: number;
  /** Felled on Held Ground (1.323): out of the fight, never dying, up again later unless `reaped`. */
  felled?: true;
  reaped?: true;
  /** Who called it into the fight (1.325). */
  calledBy?: string;
  /** Strikes in hand: what is left of a spend that bought several. Absent when there are none, and
   *  cleared at the end of the turn they were bought on, so nothing carries into the next one. */
  strikesLeft?: number;
  /** One pending skipped turn. A named condition is owned only if this daze put it on. */
  dazed?: { condition?: string };
  /** Boost and setback dice a symbol spend left for the next roll they make (1.382), spent by it. */
  symbolDice?: { boost?: number; setback?: number };
  /** Strikes the entries their rows came from let them buy with another budget (1.242). */
  strikeGrants?: RulesetStrikeGrant[];
  /** What this combatant adds to a qualifying hit without anybody choosing it. */
  riders?: RulesetCombatRider[];
  /** The riders that have already fired in their period. A "turn" rider is fresh at the start of
   *  every turn, whosever it is; a "round" rider when the round turns over. */
  ridersSpent?: string[];
  tracked: RulesetTrackedCondition[];
  concentrating: {
    actionId: string;
    label: string;
    /** What the cast was paid at above its base, and its level (1.310): what a repeat is made at. */
    steps?: number;
    level?: number;
    /** Whom the cast was aimed at, and who has succeeded on a save against it (1.310). */
    targets?: string[];
    saved?: string[];
  } | null;
  /** Hidden (1.287): the Stealth total it hid with, and the opponents it is hidden from, by id. Gone
   *  once it is hidden from nobody. */
  hiding?: {
    total: number;
    from: string[];
    /** What standing still adds to the total (1.292), taken off once it moves or acts: Hide in
     *  Plain Sight. */
    still?: number;
    /** Hidden in plain sight (1.292): kept from whoever does not beat the total, seen clearly or
     *  not, and lost once it moves. A gelatinous cube, Transparent. */
    plain?: true;
  };
  /** What it readied (1.288), taken with the ruleset's reaction budget when it happens, until the
   *  start of its next turn. */
  readied?: RulesetReadied;
  /** What a standard action left behind. `dodging`, `dashed`, `disengaged`, `hidden` and `ready`
   *  are cleared at the start of the actor's next turn; `helped` is spent by their next attack. */
  flags: {
    /** The light they carry was put out or lit this turn, for nothing (1.295). */
    lightSwitched?: true;
    dodging?: boolean;
    dashed?: boolean;
    disengaged?: boolean;
    hidden?: boolean;
    ready?: boolean;
    helped?: boolean;
    /** The off-hand weapon (its place in `sheet.items`) this turn's attack was made with, which
     *  another off-hand weapon may follow on the off-hand budget. */
    offHand?: number;
    /** Attacks made this turn, which a condition's cap on attacks a turn counts (combat C6d). */
    attacks?: number;
    /** What the attack action was taken with this turn, by name (1.242). */
    attackAction?: string[];
    /** Summons made this turn do not spend a round at its end. */
    freshSummons?: string[];
    /** Zones placed this turn do not spend a round at its end (1.172). */
    freshZones?: string[];
    /** What a condition's table made of this turn (1.264), and whom a `strike` is at. */
    compelled?: "wander" | "wandered" | "nothing" | "strike";
    compelledTarget?: string;
    /** The turn began with nowhere a condition let them walk (1.266). */
    stuck?: boolean;
    /** Something dropped was picked up this turn for nothing (1.266). */
    pickedUp?: boolean;
    /** What an action made this turn lets its user make for nothing (1.280), each once. `paid` when
     *  its uses and recharge were spent with what came first. */
    followUps?: Array<{ id: string; paid?: true }>;
  };
  /** At zero and out of the fight. `dying` is a party member a ruleset with a dying rule still
   *  rolls for; `stable` is one that has stopped rolling; `defeated` is one the fight is over for. */
  down: boolean;
  dying: boolean;
  stable: boolean;
  defeated: boolean;
  /** A wall's section stood in for a blow struck at it (1.200), and gone again as it lands: never
   *  in a fight's list between choices, and asked nothing a creature is asked. */
  object?: true;
  /** Sent out of the fight by somebody (1.236), and `defeated` while away: for good, or until they
   *  no longer hold `while` (5e's Banishment), when they come back where they were. */
  /** `left` (1.279): gone from the fight of its own accord, by a teleport that leaves it. */
  away?: { by: string; label: string; while?: string; gone?: RulesetTargetIs; left?: true; turns?: true };
  /** Caught unaware as the fight began (1.237): no move and no action on their first turn, and no
   *  reaction until it ends. `surpriseOut` are the actions that end it if taken first (Feral
   *  Instinct's rage). */
  surprised?: true;
  surpriseOut?: string[];
  /** How many times each of its auras has grown (1.320), by the condition that spreads it. */
  auraGrown?: Record<string, number>;
  /** Auras whose save they made and are now proof against for the fight (1.265), as
   *  `<holder>/<condition>`. */
  auraSafe?: string[];
  /** Whose gaze they keep their eyes from (1.268): they skip its save and cannot see them. */
  averted?: string[];
  /** What they let fall (1.266), each lying where it fell until they pick it up: a held item by
   *  `item:<its place in sheet.items>`, a stat block action by its id. */
  dropped?: RulesetDroppedThing[];
  /** What each held item adds to their defense, by its place in `sheet.items` (1.266), read as the
   *  fight begins for a ruleset whose conditions make things fall: a dropped shield's share. */
  heldDefense?: Record<string, number>;
  /** The round it was defeated in, which a revive's window is measured from (1.176). */
  diedRound?: number;
  /** Read from the sheet or the block once, when the fight began. */
  defense: number;
  /** The lowest natural attack face that is a critical for this fighter, read off their sheet
   *  (`attackRoll.criticalFrom`, 1.81). The die's highest face when absent. */
  criticalFrom?: number;
  saves: Record<string, number>;
  /** What this combatant adds in a contest, by check id. Present only when the ruleset has checks. */
  checks?: Record<string, number>;
  /** Its size, by the id of one of `combat.sizes`, read once as the fight began (1.103). Absent when
   *  the ruleset has no sizes or nothing says this one's. */
  size?: string;
  /** Their own size while a condition makes them bigger or smaller (1.195); `size` is the one they
   *  are now. Absent while nothing changes it. */
  baseSize?: string;
  /** Who has picked them up while a `sealed` condition holds them (1.314): they go where that one
   *  goes. */
  carriedBy?: string;
  /** How far they sense with each of `combat.senses`, in CELLS, read once as the fight began
   *  (1.178). A creature's comes off its block. Absent when none. */
  senses?: Record<string, number>;
  /** What they soak in a `dice-pool` fight, read once as the fight began. Absent when nothing. */
  soak?: RulesetCombatSoak;
  /** Their hardness, read once as the fight began: a spending blow whose dice are below it lands and
   *  does nothing. Absent when none. */
  hardness?: number;
  /** How many of their own turns they have begun crashed, where initiative is a number attacks move
   *  and the ruleset lets a crash recover. Absent while they are not crashed. */
  crashedTurns?: number;
  /** What a delay held over to their next turn (1.120): the action as it was made, and the budget
   *  completing it takes. Absent while nothing waits. */
  delayed?: RulesetActionResume & { label: string; budget: string };
  /** What the holder's spells left behind (1.122). Distances are in cells. */
  summons?: Array<{
    actionId: string;
    label: string;
    budget: string;
    rounds: number;
    move?: number;
    reach?: number;
    at?: RulesetCombatCell;
    payWith?: string;
  }>;
  /** The areas the holder's spells left standing (1.172). */
  zones?: RulesetCombatZone[];
  /** How much of each limited live pool they may still spend this turn or round, read once as the
   *  fight began and counted down as they pay. Absent for anybody nothing limits. */
  limits?: Record<string, { max: number; per: "turn" | "round"; spent: number }>;
  speed: number;
  /** What the fight has done to the items this fighter holds, each keyed by the item's place in
   *  `sheet.items`: how many of a stack were shot or loaded (`itemsUsed`), what each weapon has loaded
   *  now (`loaded`), and the share of what was shot that comes back after a won fight
   *  (`recoverable`, summed as it is shot and rounded down once). Absent until anything changed. */
  itemsUsed?: Record<string, number>;
  loaded?: Record<string, number>;
  recoverable?: Record<string, number>;
  /** What each item with charges holds now, keyed as the rest are. */
  charges?: Record<string, number>;
  /** The items that broke when their last charge was spent, keyed as the rest are. */
  broken?: Record<string, true>;
  /** What an item becomes on its last charge (1.272), read as the fight began: what it is, its name,
   *  and the actions it is made with then, in place of its own. Keyed as the rest are. */
  becomes?: Record<string, { ref: string; name: string; item: RulesetCatalogItem; actions: RulesetCombatAction[] }>;
  /** The items that became another in this fight (1.272): what each became. */
  became?: Record<string, string>;
  /** Whom an entry used once a creature until a rest went to (1.304), for one without a sheet: keyed
   *  `rest|action`, by name. A sheet keeps it on its live state. */
  usedOn?: Record<string, string[]>;
  /** What each conjuring action makes in each of its modes (1.306), keyed `action|mode`, read as the
   *  fight began: a new weapon's actions, or a held one's, as its own made with the binding. */
  conjurable?: Record<string, { item: string; actions: RulesetCombatAction[]; bound?: number }>;
  /** The mode each conjuring action was last used in (1.306), and a bound weapon's actions as they
   *  were, to give back when another takes its place. */
  conjured?: Record<string, { mode: string; was?: RulesetCombatAction[] }>;
  /** Each item switched on or off in this fight, keyed as the rest are (1.170). */
  on?: Record<string, boolean>;
  /** The light they carry is out (1.295). */
  doused?: true;
  /** The light a creature sheds now, in place of its block's, since one of its actions lit or put
   *  it out (1.296). */
  shedding?: RulesetLightRadius | "out";
  /** A party member's sheet, which is where their health and conditions really live. */
  sheet?: {
    build: RulesetSheetBuild;
    live: RulesetLiveState;
    catalogs: RulesetCatalogEntriesById;
    /** The items they held as the fight started. */
    items?: ReadonlyArray<RulesetSheetItem>;
  };
  /** An opponent's block, and the health the encounter keeps for it. */
  block?: RulesetStatBlock;
  /** `sealed` is what only a rest gives back (1.193), which no heal lifts it past. */
  health?: { value: number; max: number; temp: number; sealed?: number };
  /** Where they stand. Present only in a positioned fight, and then on everybody at once. */
  x?: number;
  y?: number;
  /** The whole allowance this turn and what is left of it, both in CELLS. With other ways of moving
   *  than walking (1.113) these are the fastest one's. */
  movement?: number;
  movementLeft?: number;
  /** How fast they move other than on foot, in the ruleset's own distance, read once as the fight
   *  began (1.113). `speed` is their walk. Absent for somebody who only walks. */
  speeds?: RulesetMoveSpeeds;
  /** A flier that hovers (1.113). */
  hover?: true;
  /** In the air (Capability API 1.354): a flier off the ground, whatever its height. One that only
   *  flies, or hovers, starts so; one takes off with a step only its flight takes or the "Take off"
   *  move, and comes down with "Land" or when it can no longer stay up. Its art is its flying art. */
  airborne?: true;
  /** What is left this turn of each way they move, in CELLS (1.113): every cell moved comes off all
   *  of them, as switching from walking to flying takes what was already walked off the flight.
   *  Absent for somebody who only walks, whose walk is `movementLeft`. */
  modeLeft?: Partial<Record<RulesetMoveMode, number>>;
  /** The level a flier is at, by the board's own levels, while it is up above the ground beneath it
   *  (1.114). Absent on the ground. */
  altitude?: number;
  /** How many cells a side it fills on the board, its own `x`/`y` the top-left one (1.194): its
   *  size's `cells`. Absent for one cell. */
  span?: number;
  /** Where a combatant without a sheet stands on the sheet's live tracks, by track id (1.115): the
   *  levels of `combat.levels` read these as a sheet's are read off its live state. */
  tracks?: Record<string, number>;
}

/** The ways of moving besides walking (1.113). */
export const RULESET_MOVE_MODES = ["fly", "swim", "climb", "burrow"] as const;
export type RulesetMoveMode = "walk" | (typeof RULESET_MOVE_MODES)[number];
export type RulesetMoveSpeeds = Partial<Record<(typeof RULESET_MOVE_MODES)[number], number>>;

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
  /** Where in `order` a turn put in after another stands (1.320), taken out once it is over. */
  interjected?: number;
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
  /** Falls from a step that continued while a window was open, asked one at a time (1.124). */
  pendingFalls?: RulesetFallResume[];
  /** One up per window ever opened in this fight, so no two windows share an id and an answer
   *  written for a closed one is refused rather than spent on the one that replaced it. */
  windows?: number;
  /** Who picks the spends of their own symbol throws (1.382) rather than leaving it to the Engine:
   *  a throw that leaves them something to buy holds the fight in a `spend` window until they have
   *  chosen. The Engine's pick is what everybody else gets. */
  askSpends?: string[];
  /** Remaining uses shared by a coven, keyed by coven id and spell entry (1.123). */
  covenUses?: Record<string, number>;
  /** Held Ground (1.323): nobody here dies at no health; they are felled. */
  heldGround?: RulesetHeldGround;
  /** Who has begun a turn this round (1.327), the one going on included. */
  acted?: string[];
  /** How many creatures have been called into the fight (1.325), for their ids. */
  called?: number;
}

/** A place where death is held (1.323), the showcase's valley: whoever reaches no health is felled
 *  instead, out of the fight but never dying and never dead, and gets up again later unless it was
 *  reaped. `condition` goes on the felled, and each one with a sheet moves its `marks` tracks: a
 *  mark of Owing. */
export interface RulesetHeldGround {
  label?: string;
  condition?: string;
  marks?: Array<{ track: string; by: number }>;
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
  /** What this window interrupted, when something waits for it to close. */
  resume?: RulesetWindowResume;
  /** What a hit's own maker has already answered it with (1.241): they are asked again for the rest,
   *  as a paladin smites and stuns with one blow, until they pass. */
  taken?: string[];
  /** The window between turns a legendary cast was bought in (1.284), held behind this one: asked on
   *  from once this one, and everything it led to, has closed. */
  outer?: RulesetCombatWindow;
}

/** What a window is for. `reaction` is somebody spending a budget out of turn; `signature` is a
 *  block buying one of its own actions with its points between two turns; `spend` is somebody
 *  choosing what a symbol throw's leftover symbols buy (1.382). */
export type RulesetWindowKind = "reaction" | "signature" | "spend";

/** What opened the window. The fight reads it to build the menu, and a caller reads it to say why
 *  somebody is being asked. */
export type RulesetWindowTrigger =
  /** A walk left this one's reach. `from` and `to` are the step that did it, not the whole walk. */
  | { kind: "leaves-reach"; moverId: string; from: RulesetCombatCell; to: RulesetCombatCell }
  /** One turn has ended and the next has not begun. */
  /** `opening` (1.315): before the fight's very first turn, which has already been handed out. */
  | { kind: "between-turns"; nextActorId: string; opening?: true }
  /** Something is ABOUT to land on the ones being asked. It is already paid for and is held here
   *  until they have answered, and an answer that cancels stops it from happening at all.
   *  `catalog` is where the entry behind it came from, when there is one. */
  | {
      kind: "aimed";
      targetIds?: string[];
      sourceId: string;
      optionId: string;
      label: string;
      catalog?: string;
      entry?: string;
    }
  /** Somebody on the other side is ABOUT to use something, whoever it is aimed at: held the same
   *  way, for everybody holding an answer that reaches them. */
  | { kind: "used"; sourceId: string; optionId: string; label: string; catalog?: string; entry?: string }
  /** An attack roll has just hit the one being asked, and its damage has not been dealt. What they
   *  take counts for it: the roll (`total`, made against `defense`) is checked again afterwards. */
  | {
      kind: "hit";
      targetIds?: string[];
      sourceId: string;
      optionId: string;
      label: string;
      catalog?: string;
      entry?: string;
      /** Whether the blow was struck in reach or from afar (1.118). */
      blow?: RulesetBlowKind;
      /** Whether it was a weapon's blow (1.241). */
      weapon?: true;
      /** The budget the strike was paid for from (1.248). */
      budget?: string;
      total: number;
      defense: number;
    }
  /** Something has just hurt the ones being asked. It has already happened: nothing answered here
   *  unmakes it, and `sourceId` is whoever dealt it, for a reaction aimed back at them. */
  | { kind: "harmed"; sourceId: string; label: string; catalog?: string; entry?: string }
  /** Somebody is falling, before its damage and prone (1.124). The source is the faller. */
  | { kind: "falls"; sourceId: string; label: "fall"; levels: number; fallerIds?: string[] }
  | { kind: "turn-start"; sourceId: string; label: string }
  /** What somebody readied waits for has happened (1.288): `sourceId` came where it can be reached
   *  (`comes`, before the rest of their walk) or has just used something (`acts`). */
  | { kind: "readied"; sourceId: string; on: RulesetReadyOn }
  /** A symbol throw (1.382) has left the one being asked symbols they may spend: `by` is the side
   *  they spend for, `hit` whether the throw landed. `sourceId` made the throw at `targetIds`. */
  | {
      kind: "spend";
      targetIds: string[];
      sourceId: string;
      optionId: string;
      label: string;
      by: "attacker" | "target";
      hit: boolean;
    };

/** The moments the Engine notices, and opens a window for. `aimed` is before something lands on
 *  the holder, `used` is before somebody on the other side uses something, `hit` is after an attack
 *  roll has hit the holder and before its damage, `harmed` is after something has hurt them, and
 *  `falls` is before a falling creature lands, and `turn-start` before its creature acts (1.131). */
export type RulesetReactionMoment = "aimed" | "hit" | "harmed" | "used" | "falls" | "turn-start";

/** A blow struck in reach (`melee`) or from afar (`ranged`), as a reaction that answers only one
 *  of them reads it (1.118). */
export type RulesetBlowKind = "melee" | "ranged";

/** One more moment a reaction is taken at, narrowed on its own (1.117, 1.118). */
export interface RulesetReactionAlso {
  for?: "self" | "ally" | "any";
  within?: number;
  on: RulesetReactionMoment;
  against?: RulesetReactionAgainst;
  blow?: RulesetBlowKind;
  seesSource?: true;
  /** Its holder's own attack hitting, not one that hits them (1.241). */
  by?: "self";
  /** Only a weapon's blow opens it (1.241). */
  weapon?: true;
  /** Only a hit by an attack named so (1.245). */
  names?: string[];
  /** Only a hit by a strike paid for from this budget (1.248). */
  budget?: string;
  /** Only a hit with the item at this place in its holder's items (1.273). */
  item?: number;
}

/** What caused a moment, as far as a reaction narrows what it answers: the catalog and entry behind
 *  it, and for a hit, the kind of blow. */
export interface RulesetMomentCause {
  targetIds?: string[];
  action?: string;
  catalog?: string;
  entry?: string;
  blow?: RulesetBlowKind;
  /** The blow was a weapon's (1.241). */
  weapon?: boolean;
  /** The name of the attack that hit, when it was no catalog entry's (1.245). */
  attack?: string;
  /** The budget the strike that hit was paid for from (1.248). */
  budget?: string;
  /** The place in its maker's items of the item it was struck with (1.273). */
  item?: number;
}

/** What opens a moment for one reaction: an action from an entry of one of `catalogs`, or one of
 *  `entries` (`<catalog>/<entry>`, 1.117). Either is enough. */
export interface RulesetReactionAgainst {
  actions?: string[];
  catalogs?: string[];
  entries?: string[];
}

/** What the fight goes back to once the window closes. A window opened after something has already
 *  happened carries none: there is nothing to pick up. */
export type RulesetWindowResume = RulesetWalkResume | RulesetActionResume | RulesetFallResume;

/** A fall lands after the answers have put their conditions on its target (1.124). */
export interface RulesetFallResume {
  others?: RulesetFallResume[];
  kind: "fall";
  actorId: string;
  targetId: string;
  levels: number;
}

/** Something paid for and held while everybody it is aimed at is asked. It resolves when the window
 *  closes, from the state as it stands then, unless an answer called it off. */
export interface RulesetActionResume {
  kind: "action";
  actorId: string;
  optionId: string;
  targetIds: string[];
  /** The cell an area was aimed at, which a save against it takes cover from (combat C6a-2). */
  at?: RulesetCombatCell;
  /** Which way a wall runs, and which of its sides it faces (1.177). */
  toward?: RulesetCombatCell;
  side?: "near" | "far";
  ring?: true;
  /** The further cells copies of the area were set down on (1.178). */
  also?: RulesetCombatCell[];
  payWith?: string;
  /** The initiative style it was made in, so a held attack picks up in the same one. */
  style?: string;
  /** The weapon's mode it was made in, so a held attack picks up in the same one. */
  mode?: string;
  /** What a spending blow throws: its maker's number as they made it. */
  spend?: number;
  /** An answer stopped it. What it cost is still spent: it was paid for before the asking. */
  cancelled?: true;
  /** A later strike spends only the summon's budget and never summons again. */
  summon?: true;
  /** The action landed; only its summon awaits the last reaction window. */
  resolved?: true;
  /** Held after one of its attack rolls hit, rather than before anything happened. */
  held?: RulesetHeldAttack;
  /** A strike made in another window, at somebody walking away (1.243): that window, with the
   *  striker already answered, is asked on once this one has landed. */
  outer?: RulesetCombatWindow;
  /** The budget it was paid for from, for an answer to its hit narrowed to one (1.248). */
  budget?: string;
  /** How many uses its user chose to spend on it (1.251). */
  amount?: number;
  /** The alterations it was used with (1.253). */
  alters?: string[];
  /** Who of its user's side it spares, as they were picked (1.254). */
  spares?: string[];
  /** Who Heightened gives disadvantage, as they were picked (1.255). */
  heightens?: string;
}

/** Once the attack action has been taken this turn, with anything or with one of `names` (1.242). */
export type RulesetAfterAttack =
  true | { names?: string[]; items?: { names?: string[]; tags?: string[]; notTags?: string[] } };

/** A strike a held entry lets its holder buy with `budget` (1.242), read as a condition's grant of
 *  attacks is. */
export interface RulesetStrikeGrant {
  budget: string;
  names?: string[];
  melee?: true;
  afterAttack?: RulesetAfterAttack;
}

/** Damage added to a held blow by its maker's answer (1.241), with what a higher payment adds. */
export interface RulesetHeldAddition {
  label: string;
  damage: RulesetCombatDamage;
  extra?: { amount: RulesetCombatAmount; times: number };
  /** Conditions it puts on the one hit (1.273): a Staff of Withering's, against its save. */
  onHit?: NonNullable<RulesetCombatAction["onHit"]>;
}

/** One spend somebody chose for a symbol throw (1.382), by the ruleset's spend id. */
export interface RulesetSymbolSpendChoice {
  spend: string;
  times: number;
}

/** An attack held after its roll hit, while the one it hit is asked. It picks up exactly here: the
 *  same roll against that target, then the rest of this action's targets, then the rest of its parts
 *  when it is one part of an action made of others. */
export interface RulesetHeldAttack {
  /** Its place among the parts of the action it belongs to, when that action is made of others. */
  part?: number;
  targetId: string;
  /** The targets still to come after this one, of the same action or part, in order. */
  rest: string[];
  roll: {
    mode: RulesetCombatRollMode;
    total: number;
    /** What it was rolled against. */
    defense: number;
    critical: boolean;
    /** A natural face decided it, so no change to the defense can turn it. */
    natural: boolean;
    /** What answers took off it after it hit (1.250): Cutting Words. */
    lowered?: number;
    /** A symbol fight's throw (1.382): the symbols it left, spent once it is known to land. */
    symbols?: Record<string, number>;
    /** What each side asked has chosen to buy with them so far, by spend id. A side that is here was
     *  asked, and is never asked again for this throw; one that is not gets the Engine's pick. */
    spends?: { attacker?: RulesetSymbolSpendChoice[]; target?: RulesetSymbolSpendChoice[] };
  };
  /** The attacker's one-use conditions the roll used, spent once the blow is over. */
  mine: string[];
  /** Whoever the action had already hurt before it was held, for the moment after it. */
  hurt: string[];
  /** What its maker added to the blow while it was held (1.241): Divine Smite. */
  adds?: RulesetHeldAddition[];
}

/** A walk stopped in its tracks, with everything needed to finish it exactly as it would have gone:
 *  the cells already crossed, the ones still to cross, what has been paid so far and who has
 *  already struck, so nobody strikes the same passer-by twice. */
/** What a readied option waits for (1.288): an opponent coming where it can reach them, or an
 *  opponent it sees using something. */
export type RulesetReadyOn = "comes" | "acts";

/** Something readied (1.288): the option, what it waits for, and, for a spell readied with
 *  `readying.concentrates`, that it was paid for when readied (with what) and is held by
 *  concentration. */
export interface RulesetReadied {
  optionId: string;
  label: string;
  on: RulesetReadyOn;
  paid?: true;
  payWith?: string;
}

export interface RulesetWalkResume {
  kind: "walk";
  actorId: string;
  from: RulesetCombatCell;
  walked: RulesetCombatCell[];
  path: RulesetCombatCell[];
  /** Everybody already ASKED about this walk, struck or passed: one chance each per walk, so a
   *  long path past the same foe never offers a second. */
  asked: string[];
  /** Whoever was asked already, on this walk, for what they readied (1.288). */
  readyAsked?: string[];
  spent: number;
  /** A legendary move (1.283): what its maker's own allowance was before the one it was lent, put
   *  back when the walk ends, and how the move walks. */
  legendary?: {
    kept: { movementLeft?: number; modeLeft?: Partial<Record<RulesetMoveMode, number>> };
    noOpportunity?: true;
    untouchable?: true;
  };
  /** The window between turns a legendary move was bought in, held behind a strike it provoked and
   *  asked on from once the walk ends. */
  outer?: RulesetCombatWindow;
}

/** The board, as the fight keeps it: the tactical engine's own grid and where it came from. The
 *  fight never generates one of its own. */
/** The light a fight is fought in (1.291): sunlight is bright light that is also the sun's. */
export type RulesetBoardLight = "sunlight" | "bright" | "dim" | "dark";

/** What standing in some light does on a board (1.319): every `rounds` round ends a creature spends
 *  wholly in one of these lights, its tracks move and these conditions go on it. Shade (1.319) is dim
 *  light, so a Lantern of Dusk keeps it off whoever stands in its shade. */
export interface RulesetBoardLightRule {
  label?: string;
  in: RulesetBoardLight[];
  rounds: number;
  /** `upTo` is as far as it moves the track (1.321): Noonfield's exhaustion, 3 at most. */
  tracks?: Array<{ track: string; by: number; upTo?: number }>;
  applies?: string[];
  /** Who it never touches: Noonfield's own creatures. */
  spares?: RulesetTargetIs;
  /** A save that escapes it this time (1.321): Noonfield's DC 12 Constitution save. `against` is what
   *  it counts as being against, for a save modifier's `against`: a straw hat's advantage. */
  save?: { save: string; difficulty: number; against?: { conditions?: string[]; damage?: string[] } };
}

/** Ways of hiding and of finding the hidden that are its holder's own (1.292). Distances are in
 *  the ruleset's own unit where a ruleset writes them, and in cells on a combatant's action. */
export interface RulesetHidingTraits {
  /** It may hide behind somebody at least one size larger than it: a halfling's Naturally Stealthy. */
  behindLarger?: true;
  /** Added to its Stealth total while it neither moves nor acts: Hide in Plain Sight's +10. */
  still?: number;
  /** `still` only while it holds this condition and, with `wall`, stands against something that
   *  blocks sight (1.309). */
  stillWhile?: { holds?: string; wall?: true };
  /** Its attacks at whom it cannot see are made as any others (1.309): Feral Senses. */
  unseenStrikes?: true;
  /** Its Hide rolled so, when it has moved no more than half its speed this turn: Supreme Sneak. */
  slow?: "advantage";
  /** Nobody within this distance hides from it, unless it has one of these conditions: Blindsense. */
  aware?: { within: number; lostWith?: string[] };
  /** A creature's (only): it begins the fight hidden with this total, from whoever does not beat it,
   *  until it moves or gives itself away. A gelatinous cube's Transparent, DC 15. */
  starts?: number;
  /** A creature's (only): whoever it starts hidden from begins surprised (1.309). */
  surprises?: true;
}

/** A creature's own roll twice on checks with these skills (1.291), only where it says: 5e's Keen
 *  Sight (seeing), Sunlight Sensitivity (seeing, in sunlight), Stone Camouflage (on rocky ground). */
export interface RulesetCheckModeRule {
  skills: string[];
  mode: "advantage" | "disadvantage";
  /** Only while it can see. */
  sight?: true;
  /** Only in one of these lights where it stands. */
  light?: RulesetBoardLight[];
  /** Only standing on one of these tiles. */
  terrain?: string[];
}

/** A creature's own attack rolls rolled twice (1.293), only where it says, as a mode on its checks
 *  holds: 5e's Sunlight Sensitivity (seeing, in sunlight). */
export type RulesetAttackModeRule = Omit<RulesetCheckModeRule, "skills">;

/**
 * A thing standing on the board that may be broken (Capability API 1.316): a jar, a lantern, a
 * barrel, a door. Struck as a wall's section is, or caught in an area; `fragile`, anything that hits
 * it breaks it. While it stands it closes its cells as `blocks` says. Broken, its `label` is what the
 * fight's summary tells the story.
 */
export interface RulesetBoardProp {
  id: string;
  label: string;
  cells: RulesetCombatCell[];
  health: number;
  max: number;
  defense: number;
  resist?: string[];
  vulnerable?: string[];
  immune?: string[];
  blocks?: { move?: true; sight?: true };
  fragile?: true;
  /** It may be lit again (1.332): somebody beside it spends `budget` and every cell within `squares`
   *  of it is `light` once more. The Owed's bonfire after Bonfire Gutters. */
  relight?: { light: "bright" | "dim" | "sunlight"; squares: number; budget: string };
  /** Its sprite in the board's pack (1.333): `bp_<name>`, and `bp_<name>_broken` once broken. */
  art?: string;
}

/** Where a board event happens (1.318): listed cells, a block, a ring widening from a cell, a line
 *  sweeping from an edge (both by `step` cells each time it happens, `filled` for everything inside
 *  rather than the newest band), or every cell beside growth. */
export type RulesetBoardEventWhere =
  | { cells: RulesetCombatCell[] }
  | { block: { x: number; y: number; w: number; h: number } }
  | { ring: { x: number; y: number; start: number; step: number; filled?: true } }
  | { sweep: { from: "north" | "south" | "east" | "west"; start: number; step: number; filled?: true } }
  | { spread: "growth" };

/** An edge of the board, the way a board event carries things (1.329). */
export type RulesetBoardEdge = "north" | "south" | "east" | "west";

/** What a board event does to its cells (1.318). `rotate` turns a square block a quarter turn
 *  clockwise that many times, with whoever and whatever stands wholly in it. */
export interface RulesetBoardEventChange {
  terrain?: TacticalTerrain;
  height?: number;
  light?: "bright" | "dim" | "dark" | "sunlight" | "clear";
  obscured?: "light" | "heavy" | "clear";
  growth?: boolean;
  season?: string | null;
  rotate?: 1 | 2 | 3;
  /** Whoever stands on its cells, on the ground, is carried `squares` toward that edge (1.329), a
   *  cell at a time until something stops them: the millrace. */
  push?: { toward: RulesetBoardEdge; squares: number };
  /** What obscures its cells is blown `squares` toward that edge (1.329), coming back in at the far
   *  side of its block, or of the board for any other `where`: the Leaffall's drifts. */
  drift?: { toward: RulesetBoardEdge; squares: number };
  /** A line the log and the Game Master are told. */
  tell?: string;
}

/** Something the board does on its own each round (1.318): at the start of round `from` (2 when not
 *  said, the first round's start being the board as set) or the end of round `from` (1), then every
 *  `every` rounds, through `until`. */
export interface RulesetBoardEvent {
  id: string;
  label?: string;
  at: "round-start" | "round-end";
  from: number;
  every: number;
  until?: number;
  where: RulesetBoardEventWhere;
  /** Only cells of these terrains. */
  onlyOn?: TacticalTerrain[];
  change: RulesetBoardEventChange;
}

export interface RulesetCombatBoard {
  grid: TacticalGrid;
  /** What the board does on its own each round (1.318), and how many times each has happened. */
  events?: RulesetBoardEvent[];
  happened?: Record<string, number>;
  /** What burns growth away and what cuts it back (1.318): fire, and slashing, when not said. */
  growth?: { burnedBy: string[]; cutBy: string[] };
  /** What standing in some light does here (1.319): Noonfield's bright light, a level of exhaustion
   *  for every `rounds` round ends spent in it; and how many each has spent in it so far. */
  lightRule?: RulesetBoardLightRule;
  exposed?: Record<string, number>;
  /** What stands on it that may be broken (1.316), broken ones at 0. */
  props?: RulesetBoardProp[];
  /** The labels of what has been broken (1.316), in the order it broke. */
  broken?: string[];
  /** The light the fight is fought in (1.291), all over the board; obscuring zones dim it where
   *  they stand. Bright light when it is not said. */
  light?: RulesetBoardLight;
  /** The kind of place it is (1.291), as the tactical generator names it: snow, cave, mountains. */
  environment?: string;
  /** The board pack it is drawn with (1.333), by library id. */
  pack?: string;
  battlefield?: TacticalBattlefieldProvenance;
  /** Cells a shot carries further down from higher ground (combat C6b), as the ruleset said when the
   *  fight began. */
  rangeBonus?: number;
  /** Cells one level of height is worth (1.114), as the ruleset's `elevation.levelHeight` and cell
   *  said when the fight began. Present only where there are levels, which is where a flier rises. */
  levelCells?: number;
}

/** Why a choice changed nothing. */
export type RulesetCombatRefusal =
  | "encounter-over"
  | "unknown-actor"
  | "not-your-turn"
  | "unknown-option"
  | "cannot-act"
  | "surprised"
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
  | "bad-cell"
  /** An initiative style this attack is not offered in. */
  | "unknown-style"
  /** A way of using a weapon that the option does not offer, or cannot now. */
  | "unknown-mode"
  /** Alterations it cannot be used with, or used without one it needs (1.253). */
  | "bad-alter"
  /** Something a condition that decides this turn does not let it hold (1.264). */
  | "compelled"
  /** What it is made with lies where it was dropped (1.266). */
  | "dropped"
  /** The creatures picked stand too far from each other (1.267). */
  | "targets-apart";

export type RulesetCombatAttackOutcome = "hit" | "miss" | "critical";
export type RulesetCombatRollMode = "normal" | "advantage" | "disadvantage";

/** Everything a step did, with the numbers it did it with, so a log can print "17 + 5 = 22 against
 *  15: hit" without doing any arithmetic of its own. */
export type RulesetCombatEvent =
  /** What a condition made its holder let fall (1.266), and picking one thing back up. */
  | { type: "letFall"; actorId: string; condition: string; labels: string[] }
  | { type: "pickedUp"; actorId: string; label: string }
  | { type: "averted"; actorId: string; holderId: string; back?: true }
  /** What a condition's table made of a turn as it began (1.264): the roll, and what it does. */
  | {
      type: "compelled";
      actorId: string;
      condition: string;
      roll: number;
      does: "wander" | "nothing" | "strike" | "normal";
      targetId?: string;
    }
  | {
      type: "initiative";
      entries: Array<{
        actorId: string;
        roll: number[];
        modifier: number;
        total: number;
        /** Thrown twice (1.240): which was kept, and the throw that was not. */
        mode?: "advantage" | "disadvantage";
        dropped?: number[];
      }>;
    }
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
      /** What the attacker's conditions added, already inside `total`. */
      bonuses?: RulesetConditionBonus[];
      total: number;
      defense: number;
      /** What the target's conditions added to its defense, already inside `defense`. */
      guards?: RulesetConditionBonus[];
      /** With `guards`: the defense they rose from, where `defense` is that plus them (#8273). */
      unguarded?: number;
      outcome: RulesetCombatAttackOutcome;
      /** Under `dice-pool`: the pool as it was thrown. `total` is its net successes and `defense` the
       *  successes it needed. */
      pool?: RulesetCombatPoolRoll;
      /** The initiative style it was made in, where initiative is a number attacks move. */
      style?: string;
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
      /** What the saver's conditions added, already inside `total`. */
      bonuses?: RulesetConditionBonus[];
      total: number;
      difficulty: number;
      success: boolean;
      /** A condition that fails this save automatically rolls nothing. */
      automatic?: boolean;
      /** Under `dice-pool`: the pool as it was thrown. `total` is its net successes and `difficulty`
       *  the successes it needed. */
      pool?: RulesetCombatPoolRoll;
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
      /** Under `dice-pool`: `rolls` are the damage dice as they fell, `flat` the automatic successes,
       *  and this is what they counted, against which target, and what soak took off before
       *  `amount`. Soak thrown has its own dice; soak taken off the dice beforehand has none. */
      pool?: RulesetCombatDamagePool;
      /** The weapon's floor, when the blow was raised to it. */
      floor?: number;
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
      /** A condition kept all of it off (1.191): 5e's Chill Touch. */
      blocked?: true;
    }
  | {
      type: "temporary";
      targetId: string;
      sourceId?: string;
      rolls: number[];
      flat: number;
      amount: number;
      /** The points lost instead, as the condition that gave them ended (1.274). */
      lost?: true;
    }
  | {
      type: "restored";
      targetId: string;
      sourceId?: string;
      /** The pool's own label, and where it stands after. */
      pool: string;
      rolls: number[];
      flat: number;
      amount: number;
      value: number;
      max: number;
    }
  | {
      type: "condition";
      targetId: string;
      condition: string;
      active: boolean;
      reason:
        | "applied"
        | "immune"
        | "save"
        | "expired"
        | "damage"
        | "concentration"
        | "revived"
        | "down"
        | "contest"
        | "spent"
        | "recovered"
        | "harmed"
        | "shaken"
        | "cured"
        /** Put on again, one more of it (1.189): `stacks` is how many there are now. */
        | "stacked"
        /** Gone because its source put it on somebody else (1.189). */
        | "moved"
        /** Gone because the condition it was put on with ended (1.202). */
        | "linked"
        /** Not put on: its holder has one of its kind already (1.256). */
        | "already"
        /** Gone for what it becomes after its saves failed often enough (1.258). */
        | "worsened"
        /** Put on by an aura its holder came near, or that came near them (1.263). */
        | "aura"
        /** Gone because its holder is out of the aura that spread it, or it stopped (1.263). */
        | "parted"
        /** Its spell's light put out by magical darkness (1.299). */
        | "dispelled"
        /** Not put on: its source holds as many with it as it may (1.320). */
        | "full";
      stacks?: number;
    }
  /** A number that attacks move: what came off it or went on it, why, and what it is now. A style
   *  that takes carries the damage dice that decided it, as a damage event does. */
  | {
      type: "shift";
      actorId: string;
      amount: number;
      total: number;
      reason: "taken" | "gained" | "crash" | "spent" | "missed" | "recovered";
      sourceId?: string;
      label?: string;
      rolls?: number[];
      flat?: number;
      pool?: RulesetCombatDamagePool;
    }
  | {
      type: "daze";
      targetId: string;
      sourceId: string;
      damage: number;
      over: number;
      condition?: string;
      text?: string;
    }
  | { type: "skip"; actorId: string; reason: "daze" }
  | { type: "spend"; actorId: string; pool: string; label: string; amount: number }
  | { type: "budget"; actorId: string; budget: string; left: number }
  | { type: "uses"; actorId: string; optionId: string; label: string; left: number; of: number }
  /** An item whose last charge was just spent, and whose die said it breaks. */
  | {
      type: "broke";
      actorId: string;
      optionId: string;
      label: string;
      roll: number;
      /** What it became in place of breaking (1.272): its name. */
      becomes?: string;
    }
  /** Its last charge spent, the die gave some back (1.271): a Staff of the Magi's 20. */
  | {
      type: "recharged";
      actorId: string;
      optionId: string;
      label: string;
      roll: number;
      rolls: number[];
      amount: number;
    }
  /** A fake just used, found out (1.79): what it truly was, and whether it did nothing. */
  | { type: "fake"; actorId: string; optionId: string; label: string; truly: string; dud?: true }
  /** A weapon put in hand (1.306): Pact of the Blade's. */
  | {
      type: "conjured";
      actorId: string;
      optionId: string;
      label: string;
      item: string;
      /** Dismissed, or its maker dead (1.308). */
      gone?: true;
    }
  /** An item's gate: the check its user rolled before it could work. A failed one used it up for
   *  nothing. Shaped as a save is, with `check` naming what was rolled. */
  | {
      type: "gate";
      actorId: string;
      optionId: string;
      label: string;
      check: string;
      mode?: RulesetCombatRollMode;
      rolls: number[];
      kept: number;
      modifier: number;
      bonuses?: RulesetConditionBonus[];
      total: number;
      difficulty: number;
      success: boolean;
      pool?: RulesetCombatPoolRoll;
    }
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
  /** A prop struck, caught in an area, or broken (1.316): `dealt` of it, `health` left. */
  | {
      type: "prop";
      actorId: string;
      label: string;
      prop: string;
      outcome: "hit" | "miss" | "critical" | "area";
      dealt: number;
      health: number;
      broken?: true;
    }
  /** A board event happening (1.318): on how many cells, what it says, and who it moved. */
  | {
      type: "boardEvent";
      id: string;
      label?: string;
      tell?: string;
      cells: number;
      moved?: Array<{ id: string; to: RulesetCombatCell }>;
      /** Who it carried and where to (1.329). */
      pushed?: Array<{ id: string; from: RulesetCombatCell; to: RulesetCombatCell }>;
    }
  /** Left at 1 instead of dropping to 0 (1.320), and how many more times it may. */
  | { type: "hangsOn"; actorId: string; label?: string; left: number }
  /** A prop lit again (1.332): who lit it, and how many cells it lights. */
  | { type: "relit"; actorId: string; propId: string; label: string; cells: number }
  /** Held Ground let go mid-fight (1.330): who died of it, and who went down instead. */
  | { type: "heldGroundReleased"; label?: string; died: string[]; down?: string[] }
  /** Marks come due as Held Ground lets go (1.330): one dying save a mark, `bonus` on each. */
  | {
      type: "owing";
      actorId: string;
      rolls: number[];
      bonus: number;
      successes: number;
      failures: number;
      result: "dead" | "safe";
    }
  /** Felled on Held Ground instead of dying or going down (1.323). */
  | { type: "felled"; actorId: string; label?: string }
  /** Reaped as it was felled, by a blow that reaps (1.323): it stays down. */
  | { type: "reaped"; actorId: string; sourceId?: string }
  /** Somebody drawn toward whoever spoke to them (1.326), on their own budget: Whisper a Name. */
  | {
      type: "drawn";
      actorId: string;
      targetId: string;
      from: RulesetCombatCell;
      to: RulesetCombatCell;
      path: RulesetCombatCell[];
    }
  /** Creatures called into the fight (1.325), by whom and with what. */
  | { type: "called"; actorId: string; label: string; ids: string[] }
  /** An aura grown as its holder's turn starts (1.320), and how far it reaches now. */
  | { type: "auraGrows"; actorId: string; condition: string; distance: number }
  /** A board's light rule catching somebody (1.319), after this many round ends in its light. */
  | {
      type: "lightRule";
      actorId: string;
      label?: string;
      light: RulesetBoardLight;
      rounds: number;
      /** The save it allows (1.321), as it went: its total, and whether it was made. */
      save?: { total: number; saved: boolean };
    }
  /** Growth taken off cells (1.318): cut back, burnt, or cleared by something made for it. */
  | { type: "growth"; actorId?: string; label?: string; cells: number; by: "cut" | "burnt" | "cleared" }
  /** A failed save turned into a success by a legendary resistance (1.317), and how many are left. */
  | { type: "legendaryResistance"; actorId: string; save: string; left: number }
  /** A lair action taken on its lair's count (1.315); what it does follows. */
  | { type: "lair"; actorId: string; optionId: string; label: string }
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
      /** `zone`: a zone that breaks concentration caught them and they failed the save (1.174). */
      reason?: "replaced" | "damage" | "down" | "zone" | "spent";
    }
  | {
      type: "standard";
      actorId: string;
      action: string;
      targetId?: string;
      /** A real Hide or Search (1.287): the check thrown, and whom it hid from or found, by id. */
      check?: RulesetContestSide;
      from?: string[];
      found?: string[];
      /** Those looked for with a throw of their own (1.290), where they change how it is thrown. */
      apart?: RulesetSearchApart[];
    }
  /** Something readied (1.288), set off, let go at the start of its holder's turn, or lost with the
   *  concentration holding it. */
  | {
      type: "ready";
      actorId: string;
      label: string;
      on: RulesetReadyOn;
      outcome: "readied" | "released" | "expired" | "lost";
    }
  /** A legendary search (1.287): the check thrown, and whom it found. */
  | {
      type: "search";
      actorId: string;
      label: string;
      check: RulesetContestSide;
      found: string[];
      apart?: RulesetSearchApart[];
    }
  /** Somebody hiding given away to these opponents (1.287): by attacking, by noise, or seen clearly. */
  | {
      type: "revealed";
      actorId: string;
      byIds: string[];
      /** `alerted`: they moved near something that gives the unseen away (1.319), `alertedBy`'s. */
      reason: "attack" | "noise" | "seen" | "moved" | "alerted";
      alertedBy?: string;
    }
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
  /** What a summoned weapon did, from its appearance to its ending (1.122). */
  | { type: "summon"; actorId: string; label: string; outcome: "appeared" | "struck" | "ended" }
  /** A lasting area appearing, ending, or catching somebody at one of its triggers (1.172). */
  | {
      type: "zone";
      actorId: string;
      label: string;
      /** `shoved`: put off a wall that went up where they stood, to `to` (1.177). `turned`: a line
       *  or cone its caster turned to face another way (1.182). */
      outcome:
        | "appeared"
        | "struck"
        | "ended"
        | "moved"
        | "drifted"
        | "shoved"
        | "turned"
        | "detonated"
        | "burning"
        /** Blown away by a wind's zone (1.286). */
        | "dispersed"
        /** Magical darkness ended where a light met it (1.297). */
        | "dispelled";
      targetId?: string;
      /** What caught them: one of the zone's triggers, or walking on its ground (1.173). */
      trigger?: RulesetCombatZoneRule["triggers"][number] | "moving" | "ram";
      /** Where it was centred after moving or drifting (1.173). */
      to?: RulesetCombatCell;
    }
  /** A flier going up or down a level where it stands (1.114), for cells of its allowance. */
  | { type: "flew"; actorId: string; from: number; to: number; cost: number; left: number }
  /** A flier taking off or landing where it stands (1.354). */
  | { type: "lift"; actorId: string; up: boolean }
  /** A strike at somebody leaving this combatant's reach. The attack and the damage that follow are
   *  their own events, exactly as they are on a turn. */
  | { type: "opportunity"; actorId: string; targetId: string; label: string; budget: string }
  /** The fight was held open, and for whom. Everything those combatants then take is its own event,
   *  exactly as it is on a turn, so a log reads the window as an interruption rather than a mode. */
  | {
      type: "window";
      targetIds?: string[];
      window: string;
      kind: RulesetWindowKind;
      waiting: string[];
      moverId?: string;
      /** Which moment opened it, for the ones a reaction waits for, what is happening at it, and
       *  who is doing it. */
      moment?: RulesetReactionMoment;
      /** Opened for what was readied (1.288), and which way it was set off. */
      readied?: RulesetReadyOn;
      label?: string;
      sourceId?: string;
      /** For a held hit: what the roll came to, and what it was made against. */
      total?: number;
      defense?: number;
    }
  /** Somebody let their window go by without spending anything. */
  | { type: "pass"; actorId: string; window: string }
  /** An answer that stops only what was paid no higher than itself (1.116) met something higher:
   *  its level, and the check above it when the answer has one. A `cancelled` follows on a success. */
  | {
      type: "counter";
      actorId: string;
      targetId: string;
      label: string;
      level: number;
      reach: number;
      mode?: RulesetCombatRollMode;
      rolls?: number[];
      kept?: number;
      modifier?: number;
      bonuses?: RulesetConditionBonus[];
      total?: number;
      difficulty?: number;
      success: boolean;
    }
  /** A delay rolled for (1.120): `now` it goes off as made, `held` it waits for its maker's next
   *  turn; then `completed` with that turn's budget, or `lost` when they cannot. */
  | {
      type: "delay";
      actorId: string;
      label: string;
      outcome: "now" | "held" | "completed" | "lost";
      roll?: number;
      needed?: number;
    }
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
      attacker: RulesetContestSide;
      /** With `escapeDc`, nobody threw for the holder: this side is that number and nothing else. */
      defender: RulesetContestSide;
      /** Breaking free of a hold that names what escaping it is rolled against (1.103): the actor wins
       *  on meeting it. */
      escapeDc?: number;
      /** A contest rolled against its own fixed number (1.193), met to win. */
      difficulty?: number;
      winner: "actor" | "target";
    }
  /** Somebody pushed across the board by somebody else. Forced, so it spends nothing of their own
   *  allowance and draws no strike on the way. */
  /** Somebody shoved off a step of two levels or more (combat C6b), before what the fall does. */
  | { type: "fell"; targetId: string; levels: number }
  /** Killed outright by a blow that slays (1.187). */
  | { type: "slain"; actorId: string; targetId: string; label: string }
  /** Dropped to 0 health at once by a failed save (1.245): Quivering Palm. */
  | { type: "dropped"; actorId: string; targetId: string; label: string }
  /** A save made against something that deals half, taken as nothing at all (1.250): Evasion. */
  | { type: "evaded"; targetId: string; label: string }
  /** Used with alterations (1.253): Metamagic. */
  | {
      type: "altered";
      actorId: string;
      optionId: string;
      label: string;
      alters: string[];
    }
  /** Dice an answer took off somebody's attack roll after it hit (1.250): Cutting Words. */
  | {
      type: "lowered";
      actorId: string;
      targetId: string;
      label: string;
      /** The attack it was taken off. */
      to: string;
      /** Off an ability check or a damage roll instead of an attack roll (1.257). */
      roll?: "checks" | "damage";
      rolls: number[];
      by: number;
      total: number;
    }
  /** A failed roll rolled again or turned into a success by what its maker spent (1.249). */
  | { type: "rescued"; actorId: string; optionId: string; label: string; by: RulesetCombatRescue["by"] }
  /** Sent out of the fight (1.236): for good, or for as long as `while` holds. */
  | { type: "dismissed"; actorId: string; targetId: string; label: string; while?: string }
  /** Out of the fight by a teleport that leaves it (1.279), or along with whoever did (`by`). */
  | { type: "left"; actorId: string; label: string; by?: string }
  /** Back from where it was sent (1.236), or, with `gone`, kept there for good. */
  | { type: "returned"; targetId: string; gone?: true }
  /** A check made to end a condition (1.313): Maze's way out, or no roll for one that always makes it. */
  | {
      type: "checkEnded";
      actorId: string;
      condition: string;
      difficulty: number;
      total?: number;
      rolls?: number[];
      success: boolean;
      automatic?: true;
    }
  /** A sphere rolled by the one inside, or picked up or put down by somebody else (1.314). `cells` is
   *  how far rolling it lets them go. */
  | { type: "sphere"; actorId: string; how: "rolled" | "lifted" | "put-down"; targetId?: string; cells?: number }
  /** Caught unaware as the fight began (1.237). */
  | { type: "surprised"; actorIds: string[] }
  /** No longer surprised (1.237): their first turn is over, or `label` shook it off. */
  | { type: "surpriseOver"; actorId: string; label?: string }
  /** A second turn this first round (1.238), at `initiative`, from the entry `label`. */
  | { type: "extraTurn"; actorId: string; initiative: number; label: string }
  /** Its maker adds this to the blow that just hit (1.241): Divine Smite. */
  | { type: "added"; actorId: string; targetId: string; label: string; to: string }
  /** A blow that follows a straight run at its target, before what the charge adds lands (1.186). */
  | {
      type: "charged";
      actorId: string;
      targetId: string;
      label: string;
    }
  /** A pool of health rolled to share out among an action's targets (1.196), and whom it took. */
  | { type: "healthPool"; actorId: string; label: string; rolls: number[]; total: number; affected: string[] }
  /** A wall's section struck at (1.200): by whom, with what, whether it landed, what it took and
   *  what it has left; `broken` when that was the last of it. */
  | {
      type: "section";
      actorId: string;
      label: string;
      wall: string;
      outcome: "hit" | "miss" | "critical";
      dealt: number;
      health: number;
      broken?: true;
    }
  /** Somebody grown or shrunk by a condition (1.195), to the size named, as `label` reads it. */
  | { type: "resized"; targetId: string; size: string; label: string }
  | {
      type: "pushed";
      actorId: string;
      targetId: string;
      from: RulesetCombatCell;
      to: RulesetCombatCell;
      path: RulesetCombatCell[];
    }
  /** Teleported (1.276): the user, or one they carried (`by` names the user then). */
  | {
      type: "teleported";
      actorId: string;
      from: RulesetCombatCell;
      to: RulesetCombatCell;
      label: string;
      by?: string;
    }
  /** A held attack's roll, checked again once the one it hit had answered: against what their
   *  defense then was, and whether it still lands. */
  | {
      type: "recheck";
      actorId: string;
      targetId: string;
      optionId: string;
      label: string;
      total: number;
      defense: number;
      guards?: RulesetConditionBonus[];
      /** With `guards`: the defense they rose from, where `defense` is that plus them (#8273). */
      unguarded?: number;
      outcome: RulesetCombatAttackOutcome;
    }
  /** What the ground the target stands on added to the defense the next attack is rolled against. */
  /** Cover between the target and an attack (`defense` is what it is rolled against now), or between
   *  them and where a save's action came from (`save` is the save it helps). */
  | { type: "cover"; targetId: string; bonus: number; defense?: number; save?: string }
  /** A spending blow whose dice were below the target's hardness: it landed and did nothing. */
  | { type: "hardness"; targetId: string; sourceId: string; label: string; hardness: number; dice: number }
  /** Symbols left over on an attack's roll bought something (1.382): `actorId` chose it, for `times`
   *  of `cost` `symbol` each, on the roll `rollerId` made at `targetId`. What it did follows as its
   *  own events; boost and setback dice wait on `onId`'s next roll. */
  | {
      type: "symbol-spend";
      actorId: string;
      rollerId: string;
      targetId: string;
      spendId: string;
      label: string;
      symbol: string;
      cost: number;
      times: number;
      onId?: string;
      boost?: number;
      setback?: number;
      critical?: true;
    }
  /** A weapon was fired: what it has loaded now (`of` its clip), or, without a clip, how many of
   *  what it shoots its holder still carries. */
  | { type: "shot"; actorId: string; optionId: string; label: string; left: number; of?: number }
  /** A clip filled, with how many of what it shoots went into it when it draws any. */
  | { type: "reload"; actorId: string; optionId: string; label: string; loaded: number; of: number; drew?: number }
  /** An item switched on or off (1.170). */
  | { type: "switch"; actorId: string; optionId: string; label: string; on: boolean }
  /** Won back after the fight: some of what was shot out of one stack. */
  | { type: "recovered"; actorId: string; label: string; count: number }
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
  /** Steadied by somebody's action (1.176): no more dying rolls. */
  | { type: "stabilized"; targetId: string; sourceId: string }
  /** A live track moved by somebody's action (1.201), from one level to another. */
  | { type: "track"; targetId: string; sourceId: string; track: string; label: string; from: number; to: number }
  /** What only a rest would give back, given back by somebody's action (1.201). */
  | { type: "unsealed"; targetId: string; sourceId: string; amount: number; maxHealth: number }
  | { type: "outcome"; outcome: RulesetEncounterOutcome }
  | { type: "refused"; actorId: string; optionId?: string; reason: RulesetCombatRefusal };

/** `fled` (1.279): the party is out of the fight with somebody of it gone from it alive. */
export type RulesetEncounterOutcome = "ongoing" | "victory" | "defeat" | "fled";

/** One legal thing the actor whose turn it is may do right now. Everything a player, an opponent's
 *  own choices and a forecast go through is on this menu: nothing else computes legality. */
/** How an altering action changes another (1.253), its sheet values read as it was built. */
export interface RulesetCombatAlter {
  catalogs: string[];
  spares?: number;
  /** `touch` in cells. */
  range?: { times: number; touch?: number };
  rerolls?: number;
  lasts?: number;
  heightens?: true;
  budget?: { from: string; to: string };
  drops?: string[];
  twins?: true;
  joins?: true;
}

/** What an entry spends itself on once its holder's own roll has failed (1.249): rolled again, a
 *  success, its d20 counted as a 20 (1.256), or a die of its own added (1.256). */
export interface RulesetCombatRescue {
  roll: "attacks" | "saves" | "checks";
  by: "reroll" | "success" | "twenty" | "die";
  /** The die it adds, for `die`, as its holder's sheet sized it. */
  amount?: RulesetCombatAmount;
  /** Only these saves (1.257): a ring of evasion's Dexterity saves. */
  saves?: string[];
  /** The budget spending it takes (1.257): a ring of evasion's reaction. */
  budget?: string;
}

/** An alteration an option may be used with (1.253), and what it costs at the option's own level. */
export interface RulesetCombatAlterOffer {
  id: string;
  label: string;
  cost: number;
  /** Its cost is the level it is paid at, so a higher payment costs more. */
  perLevel?: true;
  twins?: true;
  joins?: true;
  /** The budget it is used with instead. */
  budget?: string;
  /** How many of its user's side it catches it may spare (Careful), each picked by `spares` (1.254). */
  spares?: number;
  /** It gives one it catches disadvantage on their first save (Heightened), picked by `heightens`
   *  (1.255). */
  heightens?: true;
}

export interface RulesetCombatOption {
  /** The holder must pass this save to cancel (1.131). */
  cancelSave?: { save: string; dc: number; label: string };
  /** The save whoever it lands on makes against it, in the sheet's own words, and what a made one
   *  leaves: the menu and the aim say it beside the damage. */
  saveAgainst?: { label: string; dc: number; onSuccess: "none" | "half" | "negates" };
  /** Rolling the sphere its actor is shut in (1.314): `condition` is the sphere's. */
  rollsSealed?: { condition: string; label: string };
  /** Picking up somebody shut in a sphere (1.314), or putting them down (`down`). */
  lifts?: { holderId: string; name: string; down?: true };
  /** The prop this lights again (1.332). */
  relights?: { propId: string; label: string };
  /** The holder and condition named by an ally's shake-off option (1.125). */
  shakeOff?: { holderId: string; condition: string; name: string; label: string };
  /** The condition its holder spends this on a save against (1.264). */
  resave?: { condition: string; label: string };
  /** A check that ends a condition its actor holds (1.313): Maze's way out. */
  checkEnds?: { condition: string; label: string };
  id: string;
  /** The icons it may be drawn with, best first (1.338): its catalog entry's. Absent for none. */
  icons?: string[];
  /** `move` is the one a positioned fight adds: walking, and getting back up. `reload` fills a
   *  weapon's clip. */
  kind:
    | "attack"
    | "ability"
    | "block"
    | "contest"
    | "standard"
    | "end-turn"
    | "move"
    | "reload"
    | "item"
    | "switch"
    | "spend";
  label: string;
  /** Absent on "end turn", which spends nothing, and on anything that costs no budget: something
   *  the entry called free, or a strike taken out of what a spend already bought. */
  budget?: string;
  /** Strikes in hand this one would be taken out of. Present only while it costs no budget. */
  strikes?: number;
  /** `repeat`: the same target may be named more than once, each its own attack (1.305). */
  targets: { side: "enemy" | "ally" | "self" | "any"; count: number; repeat?: true };
  /** `unit` and `units` are what one of the pool and more than one are called (1.378). */
  cost?: Array<{ pool: string; label: string; amount: number; unit?: string; units?: string }>;
  /** Other pools of the same family this could be paid from instead, in declaration order. */
  payWith?: string[];
  /** How many uses may be chosen for it, one up to `max` (1.251): Lay on Hands' points. */
  amount?: { max: number };
  /** What it may be used with (1.253): Metamagic. */
  alters?: RulesetCombatAlterOffer[];
  /** Offered only because this alteration makes it usable now (1.253): Quickened with the action
   *  spent, Subtle under Silence. The choice has to carry it. */
  alterNeeded?: string;
  /** Its own pool cannot pay right now, so it is taken only with one of `payWith` (1.171). */
  upcastOnly?: true;
  /** How many targets it takes when paid with each of `payWith`, where that grows (1.171). */
  targetsWith?: Record<string, number>;
  /** The cells of standing wall sections this attack may be pointed at instead (1.200). */
  walls?: RulesetCombatCell[];
  /** Where a teleport may go (1.276), as cells its user's corner would stand on, and who of its
   *  user's side may go along, at most `count` of them. The choice names the cell as `at`. */
  teleport?: { cells: RulesetCombatCell[]; carries?: { count: number; ids: string[] }; leaves?: true };
  /** The second half of an action already made this turn (1.280), and so free. */
  followUp?: true;
  /** What it costs in the actor's own points, and how many they have. A signature option spends no
   *  budget: it is bought at the end of somebody else's turn. */
  signature?: { cost: number; points: number };
  /** A spell a legendary cast offers (1.284): the cast bought, and the option of its maker's own it
   *  casts, as it would be on its turn. */
  castOf?: { actionId: string; optionId: string };
  /** A lair action (1.315): the option of its maker's own it takes, as it would be on its turn. */
  lairOf?: string;
  /** Readying another option (1.288): which, and what it waits for. */
  ready?: { optionId: string; label: string; on: RulesetReadyOn };
  /** What its holder readied, offered when it happens (1.288). */
  readied?: true;
  /** In a `spend` window (1.382): one more of this spend, bought with `cost`, or `engine`, the
   *  Engine's own pick for whatever is still unspent (`picks`). */
  symbolSpend?: { spend?: string; engine?: true; picks?: RulesetSymbolSpendChoice[] };
  /** A legendary action that moves after what it does (1.285): `cells` are where it may then go,
   *  and going nowhere is a choice too. */
  moveAfter?: true;
  /** How many times this is left, for an action that counts its uses. */
  left?: number;
  /** How many of what a weapon shoots its holder carries, for one that shoots something. */
  ammo?: number;
  /** What a weapon with a clip has loaded, on its attack and on its reload. */
  loaded?: { now: number; max: number };
  /** A second attack with a weapon in the off hand, on the ruleset's off-hand budget. */
  offHand?: true;
  /** Whether the item a switch turns is on now (1.170). */
  on?: boolean;
  /** What turning it on and off is called (1.378), where the ruleset names the two. */
  switchLabels?: { on?: string; off?: string };
  /** The menu heading it sits under in place of the kind's own (1.378). */
  menuGroup?: RulesetCombatMenuGroup;
  /** Putting away a weapon put in hand (1.308), named by `label`. */
  dismiss?: true;
  /** A concentration entry's effect made again (1.310), named by `label`. */
  again?: true;
  /** Picking up what its holder dropped (1.266), named by `label`. */
  pickUp?: true;
  /** Averting the eyes from a gaze's holder, named by `label`, or looking at them again (1.268). */
  avert?: { holderId: string; back?: true };
  /** Paid out of a budget a condition grants for an attack of one strike (combat C6d, Haste's extra
   *  action): the strikes the attack would otherwise put in hand are not given. */
  oneStrike?: true;
  /** Held to the weapon's reach (1.239): paid by a grant for a melee strike only, a thrown weapon is
   *  swung, not thrown. */
  range?: { normal: number; long?: number };
  /** Whether the amount below is health GIVEN BACK rather than taken off. Without it a menu and an
   *  opponent's own choices cannot tell a heal from a blow, because both are an amount. */
  heals?: boolean;
  /** The pool of its target's sheet it gives back some of, so a picker can leave a full one alone. */
  restores?: string;
  /** Expected values, never a future die: `averageDamage` is the average of the amount rolled and
   *  `hitChance` the share of rolls that would land against the first legal target. A sequence
   *  forecasts the sum of its parts' damage and no single chance to hit, because its parts each
   *  roll their own. */
  /** `worth` (1.382): in a symbol fight, what a hit is worth in harm with what either side's spends
   *  buy folded in, the misses' share included, so the chance times it is the attack's whole worth. */
  forecast?: { hitChance?: number; averageDamage?: number; worth?: number };
  /** The initiative styles this attack may be made in, each with what it is expected to do: a style
   *  that takes says how much of the target's number it would take (`shift`), one that spends says
   *  the harm its dice would do. Present only where initiative is a number attacks move. */
  styles?: Array<{
    id: string;
    label: string;
    forecast?: { hitChance?: number; averageDamage?: number; shift?: number };
  }>;
  /** Other ways a weapon may be used for this attack, each with what it is expected to do. Only the
   *  ones its holder has the shots for. */
  modes?: Array<{
    id: string;
    label: string;
    targets: number;
    forecast?: { hitChance?: number; averageDamage?: number };
  }>;
  /** Where the `move` option may go, with what each cell costs of the allowance and who a path to
   *  it would be struck at by. */
  cells?: RulesetReachableCell[];
  /** What a `move` option that is not a step costs of the allowance: getting back up. */
  movementCost?: number;
  /** The shape this covers, in cells, and how far away it may be aimed. Present only in a
   *  positioned fight, and then the option is aimed at a cell rather than at anybody. */
  area?: {
    shape: RulesetCombatArea["shape"];
    size: number;
    width?: number;
    /** A wall that may be laid as a ring this many across, and one with a side to choose (1.177). */
    ring?: number;
    sided?: true;
    /** How many times it may be set down at once (1.178). */
    copies?: number;
    range: number;
  };
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
  /** The cell an area is aimed at. An option with an area takes this instead of target ids. Where
   *  a teleport goes (1.276): one of its option's `teleport.cells`. */
  at?: RulesetCombatCell;
  /** Who goes along on a teleport (1.276): ids its option's `teleport.carries` offers. */
  carries?: string[];
  /** Which way a wall runs from `at` (1.177): toward this cell. Across the line to its maker when
   *  left out. A ring ignores it. */
  toward?: RulesetCombatCell;
  /** Which side of a wall its `side` is (1.177): toward its maker or away (inside or outside, for a
   *  ring). Away when left out. */
  side?: "near" | "far";
  /** A wall's section to strike at instead of a creature (1.200): any cell of it, one the option's
   *  `walls` offers. */
  wall?: RulesetCombatCell;
  /** Lay a wall whose area allows it as a ring around `at` instead (1.177). */
  ring?: boolean;
  /** Where further copies of an area that allows them are set down (1.178), each touching the cells
   *  of those before it. At most its `copies` less one. */
  also?: RulesetCombatCell[];
  /** The window this answers, when it answers one. An answer carrying the id of a window that has
   *  already closed changes nothing: it was written for a question the fight has moved past. */
  window?: string;
  /** Which of the ruleset's initiative styles an attack is made in, where initiative is a number
   *  attacks move. The first style when left out; one the option does not offer is refused. */
  style?: string;
  /** Which of a weapon's modes it is used in. The attack as it is when left out; one the option does
   *  not offer is refused. */
  mode?: string;
  /** How many uses it spends, where the option offers an `amount` (1.251). Left out, as many as
   *  heal the first target fully, and never more than are left. */
  amount?: number;
  /** The ids of the altering actions it is used with (1.253), from the option's `alters`. */
  alters?: string[];
  /** Who of its user's side an alteration that spares some (Careful) spares (1.254): no more than
   *  its offer's `spares`, each one it catches. Left out, the first it catches. */
  spares?: string[];
  /** Who an alteration that heightens (Heightened) gives disadvantage on their first save (1.255):
   *  one it catches. Left out, the first it catches. */
  heightens?: string;
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
    /** Gone from the fight alive, by a teleport that leaves it (1.279). */
    left?: true;
  }>;
  enemies: Array<{ id: string; name: string; health: number; maxHealth: number; defeated: boolean; left?: true }>;
  /** What was broken on the board (1.316), by label, in the order it broke. */
  broken?: string[];
}

/** How a lasting area behaves (1.172), as the catalog entry said it. */
export interface RulesetCombatZoneRule {
  /** How it looks on the board (1.333): a `bz_` tile of the board's pack. */
  art?: string;
  /** The light it sheds over its own cells, in CELLS from its middle (1.297). */
  lights?: { bright: number; dim: number; reveals?: true; sunlight?: true; shade?: true };
  /** Spell light of this level or lower it puts out where they meet (1.299): 5e's Darkness. */
  dispelsLight?: { upTo: number };
  /** Magical darkness of this level or lower ends where it meets it (1.297), within this many CELLS
   *  of its middle where it says (1.299). */
  dispelsDark?: { upTo: number; within?: number };
  rounds: number;
  /** It ends as its maker's lair count next comes round (1.324). */
  untilLair?: true;
  anchor: "point" | "caster";
  /** Put on a cell somebody stands on, carried with them (1.301): only its caster (`own`), or anybody. */
  carried?: "own" | "any";
  triggers: Array<"enter" | "turn-start" | "turn-end">;
  atCast: boolean;
  /** Its caster may move it on their turn, spending `budget`, up to `distance` cells (1.173); `ram`
   *  stops it on the first creature it reaches and catches them (1.175). */
  move?: { budget: string; distance: number; ram?: boolean };
  /** Cells it moves straight away from its caster as each of their turns starts (1.173). */
  drift?: number;
  /** A line or cone held by its caster that they may turn to face another way, spending `budget`
   *  (1.182). */
  turn?: { budget: string };
  /** It goes off as it ends, doing its effect once to everybody in it (1.183): `grows` is added to its
   *  amount at the end of each of its caster's turns, and `touched` sets it off when somebody moves
   *  onto its middle and fails its save. */
  detonates?: { grows?: RulesetCombatAmount; touched?: boolean };
  /** Damage of one of these types reaching it sets it alight (1.183); it burns away when its caster's
   *  turn comes round, dealing `amount` to whoever starts a turn in it meanwhile. */
  burns?: { by: string[]; amount?: RulesetCombatAmount; damageType?: string };
  /** Moving into one of its cells costs double (1.173). */
  difficult?: boolean;
  /** Moving into one of its cells costs this many plain steps (1.175). */
  costTimes?: number;
  /** Speed is halved inside it, on top of any hard going (1.175). */
  halvesSpeed?: boolean;
  /** Its hard going counts only for a step that brings the mover nearer its caster (1.182). */
  towardCaster?: boolean;
  /** What moving inside it deals: `amount` for every `every` cells, no save (1.173). */
  perDistance?: { every: number; amount: RulesetCombatAmount; damageType?: string };
  /** Whoever it catches while concentrating saves against its save difficulty or loses it (1.174). */
  breaksConcentration?: boolean;
  /** It ends once it has dealt this much damage in all (1.174). */
  damageCap?: number;
  /** What it deals at its triggers is this type in place of the entry's own (1.198). */
  damageType?: string;
  /** What it deals, with no save and in place of its effect, to whoever starts a turn in it held by
   *  this condition from its caster (1.175). */
  whileHeld?: { condition: string; amount: RulesetCombatAmount; damageType?: string };
  /** A wall nobody moves or sees through (1.177). */
  blocks?: { move?: boolean; sight?: boolean };
  /** A wall's one side (1.177): cells within `distance` of it there catch as `triggers` say. */
  side?: { distance: number; triggers: Array<"enter" | "turn-start" | "turn-end"> };
  /** Sections `every` cells long, each struck at and broken apart (1.200); a broken one stops
   *  blocking and catches whoever is in it at the `broken` triggers. */
  sections?: {
    every: number;
    health: number;
    defense: number;
    vulnerable?: string[];
    resist?: string[];
    immune?: string[];
    broken?: {
      triggers: Array<"enter" | "turn-start" | "turn-end">;
      amount: RulesetCombatAmount;
      damageType?: string;
      save?: string;
      onSave?: "half" | "none";
      /** Added once a step the cast was paid above its base (1.201). */
      perCostStep?: RulesetCombatAmount;
    };
  };
  /** Nobody sees into it, out of it or through it but by one of these senses, in range (1.178);
   *  `light` only makes looking harder, `dispersed` a wind ends it (1.286). */
  obscures?: RulesetObscures;
  /** A wind: obscuring zones it reaches that are `dispersed` end (1.286). */
  disperses?: true;
  /** Conditions on, and damage types kept off, whoever stands in it (1.179). */
  inside?: { conditions?: string[]; immune?: string[] };
  /** Components nothing used from inside it may need (1.179). */
  forbids?: { components: string[] };
  /** Off these catalogs, at this level or lower, nothing from outside reaches inside (1.179). */
  wards?: { catalogs: string[]; maxLevel: number; by?: "base" | "paid"; maxLevelPerCostStep?: number };
}

/** One lasting area standing on the board (1.172). A zone held at a point keeps the cells it was
 *  cast on; one held by its caster is worked out around them wherever they stand. */
export interface RulesetCombatZone {
  actionId: string;
  label: string;
  rounds: number;
  anchor: "point" | "caster";
  triggers: RulesetCombatZoneRule["triggers"];
  /** Where it was centred, for a zone held at a point. */
  at?: RulesetCombatCell;
  /** The middles of its further copies (1.301), which move with it. */
  also?: RulesetCombatCell[];
  /** Whoever carries it (1.301): it is centred on them wherever they go. */
  on?: string;
  /** The way a line or cone held by its caster points from them, a step of -1, 0 or 1 each way
   *  (1.182). */
  facing?: { dx: number; dy: number };
  cells?: RulesetCombatCell[];
  /** A cloud of its own, not its action's zone (1.279): a teleport's smoke. */
  obscures?: RulesetObscures;
  /** The turn ("round:turn") a wind first reached it, for a fog it disperses only after a while
   *  (1.289); gone once no wind reaches it. */
  blown?: string;
  /** The cells on a wall's chosen side that catch as its `side` says (1.177). */
  sideCells?: RulesetCombatCell[];
  payWith?: string;
  /** Who it holds off a board: those it was cast on (1.172). */
  held?: string[];
  /** Who it has already caught, by the turn it caught them on ("round:turn"). */
  struck?: Record<string, string>;
  /** Cells each mover has walked inside it, toward its next `perDistance` harm (1.173). */
  walked?: Record<string, number>;
  /** Damage it has dealt in all, toward its `damageCap` (1.174). */
  dealt?: number;
  /** The turn ("round:turn") it was rammed into somebody, and moves no more in (1.175). */
  rammed?: string;
  /** How many of its caster's turns have ended since it was cast, each adding its `grows` (1.183). */
  grown?: number;
  /** Its sections and the health each has left (1.200); one at 0 is broken. */
  sections?: Array<{ cells: RulesetCombatCell[]; health: number }>;
  /** Set alight, and burning away (1.183). */
  burning?: boolean;
  /** Until its maker's next lair count (1.324). */
  untilLair?: true;
}

/** A Search's own throw for those who change how looking for them is thrown (1.290): 5e's Cloak of
 *  Elvenkind. */
export interface RulesetSearchApart {
  ids: string[];
  check: RulesetContestSide;
}
