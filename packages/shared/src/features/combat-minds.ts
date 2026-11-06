/**
 * How much thought a combatant puts into a fight, read off what it is rather than what it looks like:
 * `mindless` (a zombie, a golem, an ooze) goes at whoever is nearest and never gives ground;
 * `instinct` (a wolf, a bear) fights by its nature, the weakest and nearest first, and runs when hurt;
 * `cunning` (a goblin, an ogre) knows the basics; `tactical` plays the fight; `genius` (a lich, an
 * ancient dragon) plays it best of all. On its own so the ruleset schema may read it.
 */
export const COMBAT_MINDS = ["mindless", "instinct", "cunning", "tactical", "genius"] as const;
export type CombatMind = (typeof COMBAT_MINDS)[number];

/**
 * Its mind once the story has had its say: what the story says (a dominated or maddened creature)
 * where its own data says nothing, or where the story puts less thought in it than its data does. A
 * stray hint never makes a wolf a tactician.
 */
export function combatMindWithHint(hint: CombatMind | undefined, own: CombatMind | undefined): CombatMind | undefined {
  if (hint === undefined) return own;
  if (own === undefined) return hint;
  return COMBAT_MINDS.indexOf(hint) < COMBAT_MINDS.indexOf(own) ? hint : own;
}

/** How a combatant that thinks at all goes about a fight: what weighs most with it. */
export const COMBAT_TEMPERAMENTS = [
  "reckless",
  "cautious",
  "opportunistic",
  "protective",
  "supportive",
  "disciplined",
  "cowardly",
  "patient",
  "methodical",
  "coordinated",
  // Never dealt by chance: only where its data or the story names it (combat AI T2, 1.778).
  "fanatical",
  // Never dealt by chance: it holds back until the fight proves serious (combat AI T5, 1.780).
  "arrogant",
  // Never dealt by chance: it keeps to its ground (combat AI T4, 1.781).
  "territorial",
  // Never dealt by chance, and strikes the fallen only where the game allows it (combat AI T3, 1.782).
  "cruel",
  // Never dealt by chance: it fights fair, one on one, and spares the beaten (combat AI T6, 1.783).
  "honourable",
  // Never dealt by chance: a predator that takes one victim and drags it off (combat AI T8, 1.784).
  "hungry",
] as const;
export type CombatTemperament = (typeof COMBAT_TEMPERAMENTS)[number];
/** The temperaments a combatant has only where its data or the story names them, never dealt by
 *  chance: a fanatic never breaks (combat AI T2). */
export const COMBAT_NAMED_TEMPERAMENTS: readonly CombatTemperament[] = [
  "fanatical",
  "arrogant",
  "territorial",
  "cruel",
  "honourable",
  "hungry",
];

/** What turns a combatant's temperament into another, once (combat AI T7): hurt below half its
 *  health, one of its side down, its leader down, or cornered (below a quarter, an opponent beside it
 *  and nowhere to run). */
export const COMBAT_SHIFT_TRIGGERS = ["bloodied", "ally-down", "leader-down", "cornered"] as const;
export type CombatShiftTrigger = (typeof COMBAT_SHIFT_TRIGGERS)[number];

/** What a combatant is for in a fight. */
export const COMBAT_ROLES = [
  "bruiser",
  "bulwark",
  "skirmisher",
  "marksman",
  "spellcaster",
  "supporter",
  "controller",
  /** One that fights a whole side alone (1.776): a dragon, a lich, a kraken, with moves of its own
   *  between turns. It spends what it has, area first, and never trades blow for blow. */
  "solo",
] as const;
export type CombatRole = (typeof COMBAT_ROLES)[number];
