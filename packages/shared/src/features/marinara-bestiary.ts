// ──────────────────────────────────────────────
// Game: Classic Marinara's bestiary (the foes a game on Marinara's own rules fights)
//
// So the Game Master picks designed enemies instead of inventing them (Alyssa 2026-10-31): a western
// take on the early console role-playing games, with the setting kits in mind. Pure data and math.
//
//   - A family is one kind of foe (a pack of hounds, a road bandit, a clay warder). It names the
//     settings it lives in, and in each its own names by level band: the same beast grows into a
//     stronger cousin as the party does, the way old games recoloured their monsters. A family that
//     has no names for a setting never appears there.
//   - Every foe is built from the same tables as the party: a humanoid follows a class line of the
//     class trees, a monster an archetype's expected stats scaled per stat (`statScale`). So a level
//     12 foe is measured against a level 12 party without anyone writing a number.
//   - A foe's tier (minion, standard, elite, boss) sizes its HP and stats (the Engine's
//     MARINARA_ENEMY_TIERS) and what it may do: hard control, area breath and Doom need the tier and
//     level the ability names, so a level 2 rat never puts the party to sleep.
//   - Threat: what a foe is worth in an encounter budget, measured in the class lab (scripts/class-lab/
//     bestiary-lab.ts) rather than guessed. A party's budget for a difficulty is its size times the
//     difficulty's share; a GM-built fight is checked against it the same way (strict: Alyssa
//     2026-10-30, dying to a bad roll is fine, dying to a badly built fight is not).
// ──────────────────────────────────────────────

import {
  MARINARA_LEVEL_CAP,
  MARINARA_PROMOTION_LEVEL,
  type MarinaraAffinities,
  type MarinaraArchetype,
  type MarinaraDamageType,
  type MarinaraSkillDamage,
  type MarinaraStat,
  type MarinaraStats,
} from "./marinara-classes.js";
import type { CombatMind, CombatTemperament } from "./combat-minds.js";
import {
  MARINARA_ENEMY_TIERS_LIST,
  MARINARA_ELEMENT_PHASE,
  MARINARA_WUXING_FED_BY,
  MARINARA_WUXING_OVERCOMES,
  type MarinaraEffect,
  type MarinaraEnemySpec,
  type MarinaraEnemyTier,
} from "./marinara-combat.js";
import { MARINARA_BESTIARY_THREAT } from "./marinara-bestiary-threat.js";

// ── Settings ──

/** The settings the bestiary knows: the Engine's starter kits (packages/shared/src/features/world/
 *  starter-kits.ts). A game whose kit or genre names none of them gets the setting-free families only. */
export const MARINARA_BESTIARY_SETTINGS = [
  "high_fantasy",
  "wuxia_xianxia",
  "modern_day",
  "modern_supernatural",
  "the_1920s",
  "cyberpunk",
  "space_opera",
  "post_apocalyptic",
] as const;
export type MarinaraBestiarySetting = (typeof MARINARA_BESTIARY_SETTINGS)[number];

/** Each setting's art family (world/art-family.ts), for tables keyed by family (loot, gear). */
export const MARINARA_BESTIARY_SETTING_FAMILY: Record<MarinaraBestiarySetting, string> = {
  high_fantasy: "fantasy",
  wuxia_xianxia: "wuxia",
  modern_day: "modern",
  modern_supernatural: "modern",
  the_1920s: "jazz_age",
  cyberpunk: "scifi",
  space_opera: "scifi",
  post_apocalyptic: "wasteland",
};

/** The setup wizard's genres and the setting each names, most specific first (as world/loot.ts). */
const GENRE_SETTINGS: Array<[RegExp, MarinaraBestiarySetting]> = [
  [/\bcyberpunk\b/i, "cyberpunk"],
  [/\bpost-?apocalyptic\b|\bwasteland\b/i, "post_apocalyptic"],
  [/\bwuxia\b|\bxianxia\b|\bcultivation\b|\bmartial arts\b/i, "wuxia_xianxia"],
  [/\b1920s\b|\bnoir\b|\bjazz age\b|\bprohibition\b/i, "the_1920s"],
  [/\bfantasy\b/i, "high_fantasy"],
  [/\bsci-?fi\b|\bscience fiction\b|\bspace\b/i, "space_opera"],
  [/\bhorror\b|\bsupernatural\b|\burban fantasy\b/i, "modern_supernatural"],
  [/\bmodern\b|\bslice of life\b|\bcontemporary\b/i, "modern_day"],
];

/** A game's bestiary setting: its kit's id when that is a starter kit, else what its genre names. */
export function marinaraBestiarySetting(
  kitId: string | null | undefined,
  genre: string | null | undefined,
): MarinaraBestiarySetting | null {
  if (kitId && (MARINARA_BESTIARY_SETTINGS as readonly string[]).includes(kitId))
    return kitId as MarinaraBestiarySetting;
  if (!genre) return null;
  return GENRE_SETTINGS.find(([pattern]) => pattern.test(genre))?.[1] ?? null;
}

// ── Tiers ──

/**
 * What a tier is worth in a budget compared with a standard foe of the same family and level
 * (measured in the bestiary lab against the Engine's MARINARA_ENEMY_TIERS sizes), and the lowest level
 * it may appear at. A boss below level 5 would be the "CR ½ with legendary actions" the 5e playtest
 * caught (Alyssa 2026-10-30).
 */
export const MARINARA_TIER_RULES: Record<MarinaraEnemyTier, { threat: number; minLevel: number; maxPerFight: number }> =
  {
    minion: { threat: 0.45, minLevel: 1, maxPerFight: 6 },
    standard: { threat: 1, minLevel: 1, maxPerFight: 6 },
    elite: { threat: 2.2, minLevel: 3, maxPerFight: 3 },
    boss: { threat: 5.5, minLevel: 5, maxPerFight: 1 },
  };

/**
 * Foes grow a little past their expected stats with level (HP and offence, a share per level above 1):
 * a party's later classes, carried skills and gear outgrow a foe's plain expected stats, and without
 * it a level 28 foe is worth half a level 4 one, so a high-level fight would need more foes than a
 * battle has room for. Measured in the bestiary lab so a standard foe stays worth about the same.
 */
export const MARINARA_FOE_LEVEL_GROWTH = {
  hp: 0.03,
  offense: 0.015,
  /** Magic grows slower: the party's low Resistance already lets spells keep pace. */
  magic: 0.006,
};

/** The stat scale a foe gets from its level, on top of its family's own. */
export function marinaraFoeLevelScale(level: number): Partial<MarinaraStats> {
  const above = Math.max(0, Math.min(MARINARA_LEVEL_CAP, level) - 1);
  const offense = 1 + MARINARA_FOE_LEVEL_GROWTH.offense * above;
  return {
    hp: 1 + MARINARA_FOE_LEVEL_GROWTH.hp * above,
    strength: offense,
    skill: offense,
    magic: 1 + MARINARA_FOE_LEVEL_GROWTH.magic * above,
  };
}

// ── Abilities ──

export interface MarinaraEnemyAbility {
  id: string;
  /** A label for the log and the GM; a game may rename it in its setting's words. */
  label: string;
  summary: string;
  effect: MarinaraEffect;
  /** The lowest tier and level it may be used at (hard control, area breath, Doom). */
  minTier?: MarinaraEnemyTier;
  minLevel?: number;
  /** Not ready on the foe's first turn: the pack circles before it leaps (playtest b57, reasons log
   *  on: four Pounces on a full-HP back-row Mender before she could act). */
  opensCold?: boolean;
}

const strike = (power: number, extra: Partial<MarinaraEffect> = {}): MarinaraEffect => ({
  kind: "damage",
  target: "enemy",
  scales: "strength",
  damage: "physical",
  power,
  ...extra,
});
const spell = (power: number, type: MarinaraSkillDamage, extra: Partial<MarinaraEffect> = {}): MarinaraEffect => ({
  kind: "damage",
  target: "enemy",
  scales: "magic",
  damage: "magic",
  ranged: true,
  power,
  type,
  ...extra,
});
const ability = (
  id: string,
  label: string,
  summary: string,
  effect: MarinaraEffect,
  gate: { minTier?: MarinaraEnemyTier; minLevel?: number; opensCold?: boolean } = {},
): MarinaraEnemyAbility => ({ id, label, summary, effect, ...gate });

/**
 * Every foe ability. Damage over time is a share of max HP a turn (Bleed and Wither pure, Poison a
 * type that can be resisted); hard control (sleep, stun, confuse) is elite-only, from level 8, on a
 * cooldown of 5 and a coin flip at best (chances are shares, 0.45 = 45%); area damage spreads at 60% per foe as party area attacks do.
 */
export const MARINARA_BESTIARY_ABILITIES: readonly MarinaraEnemyAbility[] = [
  // The class lab's four, so foes and the lab share them.
  ability(
    "rend",
    "Rend",
    "A tearing blow: the target bleeds 5% of max HP a turn for 3.",
    strike(5, {
      applies: { status: "bleed", duration: 3, power: 0.05 },
      cooldown: 3,
    }),
  ),
  ability(
    "sunder",
    "Sunder",
    "An armour-breaking blow: −25% Defense for 2 turns.",
    strike(5, {
      onHit: { stat: "defense", pct: -0.25, duration: 2 },
      cooldown: 3,
    }),
  ),
  ability(
    "venom-arrow",
    "Venom Arrow",
    "A poisoned shot: 6% of max HP a turn for 3.",
    strike(4, {
      ranged: true,
      type: "pierce",
      applies: { status: "poison", duration: 3, power: 0.06 },
      cooldown: 3,
    }),
  ),
  ability("curse", "Curse", "Wound (healing received halved for 3 turns) and −20% damage dealt for 2.", {
    kind: "debuff",
    target: "enemy",
    stat: "damage",
    pct: -0.2,
    duration: 2,
    ranged: true,
    applies: { status: "wound", duration: 3 },
    cooldown: 3,
  }),
  // Beasts and brutes
  ability("maul", "Maul", "A heavy blow that slows the user's next turn.", strike(6, { weight: 1.3, cooldown: 2 })),
  ability(
    "gore",
    "Gore",
    "Lowers its head for a turn, then charges: a hit it telegraphs.",
    strike(8, {
      charge: true,
      cooldown: 4,
    }),
    { minLevel: 3 },
  ),
  ability(
    "pounce",
    "Pounce",
    "Leaps over the front row: full damage to anyone. Not on its first turn: the pack circles first.",
    strike(5, { ranged: true, cooldown: 2 }),
    { opensCold: true },
  ),
  ability(
    "gnaw",
    "Gnaw",
    "Worrying bites: the target bleeds 4% a turn for 2.",
    strike(2, {
      applies: { status: "bleed", duration: 2, power: 0.04 },
      cooldown: 3,
    }),
  ),
  ability("swarm-bite", "Swarm Bite", "Three quick bites.", strike(0, { hits: 3, cooldown: 2 }), { minLevel: 8 }),
  ability(
    "venom-fang",
    "Venom Fang",
    "A poisoned bite: 5% of max HP a turn for 3.",
    strike(3, {
      type: "pierce",
      applies: { status: "poison", duration: 3, power: 0.05 },
      cooldown: 3,
    }),
  ),
  ability(
    "constrict",
    "Constrict",
    "Coils round the target: it is slowed for 2 turns.",
    strike(4, {
      type: "blunt",
      applies: { status: "slow", duration: 2, chance: 0.7 },
      cooldown: 4,
    }),
    { minLevel: 5 },
  ),
  ability(
    "tail-sweep",
    "Tail Sweep",
    "Sweeps the whole front row.",
    strike(6, { target: "front-row", spread: 0.6, cooldown: 3 }),
    {
      minTier: "standard",
      minLevel: 6,
    },
  ),
  ability(
    "trample",
    "Trample",
    "Charges through the whole party.",
    strike(6, { target: "all-enemies", spread: 0.6, weight: 1.3, cooldown: 4 }),
    {
      minTier: "elite",
      minLevel: 8,
    },
  ),
  ability(
    "dive",
    "Dive",
    "Drops from above on anyone, then climbs again.",
    strike(4, { ranged: true, critBonus: 10, cooldown: 2 }),
  ),
  ability(
    "shriek",
    "Shriek",
    "A piercing cry: the party is slowed for 2 turns (half resist).",
    {
      kind: "status",
      target: "all-enemies",
      status: "slow",
      chance: 0.5,
      duration: 2,
      ranged: true,
      cooldown: 5,
    },
    { minLevel: 5 },
  ),
  ability("web", "Web", "Binds one target: slowed for 2 turns.", {
    kind: "status",
    target: "enemy",
    status: "slow",
    chance: 0.7,
    duration: 2,
    ranged: true,
    cooldown: 3,
  }),
  ability(
    "spore-cloud",
    "Spore Cloud",
    "Spores over the party: poison, 4% a turn for 3.",
    {
      kind: "status",
      target: "all-enemies",
      status: "poison",
      chance: 0.7,
      duration: 3,
      ranged: true,
      power: 0.04,
      cooldown: 5,
    },
    { minLevel: 6 },
  ),
  ability(
    "acid-spit",
    "Acid Spit",
    "Corrodes armour: −20% Defense for 2 turns.",
    spell(4, "poison", {
      onHit: { stat: "defense", pct: -0.2, duration: 2 },
      cooldown: 3,
    }),
  ),
  ability("harden", "Harden", "Hardens its hide: +40% Defense until its next two turns pass.", {
    kind: "buff",
    target: "self",
    stat: "defense",
    pct: 0.4,
    duration: 2,
    cooldown: 4,
  }),
  ability(
    "regenerate",
    "Regenerate",
    "Knits its wounds: 3% of max HP a turn (at most 35) for 3.",
    {
      kind: "status",
      target: "self",
      status: "regen",
      duration: 3,
      power: 0.03,
      cooldown: 5,
    },
    { minLevel: 5 },
  ),
  ability(
    "devour",
    "Devour",
    "Bites into the fallen and the near-fallen: wounds the target (healing halved for 3).",
    strike(6, {
      applies: { status: "wound", duration: 3 },
      cooldown: 3,
    }),
    { minLevel: 4 },
  ),
  ability(
    "hurl-boulder",
    "Hurl Boulder",
    "Throws rubble at anyone, with a turn's wind-up: earth damage.",
    strike(5, {
      ranged: true,
      type: "earth",
      charge: true,
      cooldown: 4,
    }),
    { minLevel: 6 },
  ),
  // Breath and spirits
  ability("ember", "Ember", "A spit of flame.", spell(5, "fire")),
  ability("rime", "Rime", "A shard of frost.", spell(5, "ice")),
  ability("spark", "Spark", "A lash of lightning.", spell(5, "lightning")),
  ability("bramble", "Bramble", "A lash of thorned vines.", spell(5, "wood")),
  ability("clod", "Clod", "A fist of packed earth.", spell(5, "earth", { ranged: false })),
  ability("torrent", "Torrent", "A jet of water.", spell(5, "water")),
  ability("gust", "Gust", "A cutting gust of wind.", spell(5, "wind")),
  ability(
    "fair-wind",
    "Fair Wind",
    "Its side gains +20% Speed for 2 turns.",
    {
      kind: "buff",
      target: "party",
      stat: "speed",
      pct: 0.2,
      duration: 2,
      ranged: true,
      cooldown: 5,
    },
    { minLevel: 6 },
  ),
  ability("shrapnel", "Shrapnel", "A spray of metal splinters: two quick hits.", spell(3, "metal", { hits: 2 })),
  ability(
    "root-snare",
    "Root Snare",
    "Roots burst up round one target: slowed for 2 turns.",
    {
      kind: "status",
      target: "enemy",
      status: "slow",
      chance: 0.7,
      duration: 2,
      ranged: true,
      cooldown: 4,
    },
    { minLevel: 5 },
  ),
  ability(
    "undertow",
    "Undertow",
    "Drags at the front row: water damage, and each may be slowed for a turn.",
    spell(5, "water", {
      target: "front-row",
      spread: 0.6,
      applies: { status: "slow", chance: 0.5, duration: 1 },
      cooldown: 4,
    }),
    { minLevel: 6 },
  ),
  ability(
    "edge-wind",
    "Edge Wind",
    "A wind of blades: metal damage, and −20% Defense for 2 turns.",
    spell(5, "metal", {
      onHit: { stat: "defense", pct: -0.2, duration: 2 },
      cooldown: 3,
    }),
    { minLevel: 6 },
  ),
  ability(
    "fire-breath",
    "Fire Breath",
    "Breathes fire over the party, with a turn's wind-up.",
    spell(9, "fire", {
      target: "all-enemies",
      spread: 0.6,
      charge: true,
      cooldown: 4,
    }),
    { minTier: "elite", minLevel: 8 },
  ),
  ability(
    "frost-breath",
    "Frost Breath",
    "Breathes frost over the party, with a turn's wind-up.",
    spell(9, "ice", {
      target: "all-enemies",
      spread: 0.6,
      charge: true,
      cooldown: 4,
    }),
    { minTier: "elite", minLevel: 8 },
  ),
  ability(
    "storm-breath",
    "Storm Breath",
    "Breathes lightning over the party, with a turn's wind-up.",
    spell(9, "lightning", {
      target: "all-enemies",
      spread: 0.6,
      charge: true,
      cooldown: 4,
    }),
    { minTier: "elite", minLevel: 8 },
  ),
  ability(
    "thorn-storm",
    "Thorn Storm",
    "Whips a storm of thorns over the party, with a turn's wind-up.",
    spell(9, "wood", {
      target: "all-enemies",
      spread: 0.6,
      charge: true,
      cooldown: 4,
    }),
    { minTier: "elite", minLevel: 8 },
  ),
  ability(
    "quake",
    "Quake",
    "Splits the ground under the party, with a turn's wind-up.",
    spell(9, "earth", {
      target: "all-enemies",
      spread: 0.6,
      charge: true,
      cooldown: 4,
    }),
    { minTier: "elite", minLevel: 8 },
  ),
  ability(
    "tidal-wave",
    "Tidal Wave",
    "Brings a wave down on the party, with a turn's wind-up.",
    spell(9, "water", {
      target: "all-enemies",
      spread: 0.6,
      charge: true,
      cooldown: 4,
    }),
    { minTier: "elite", minLevel: 8 },
  ),
  ability(
    "blade-storm",
    "Blade Storm",
    "A whirl of edges over the party, with a turn's wind-up.",
    spell(9, "metal", {
      target: "all-enemies",
      spread: 0.6,
      charge: true,
      cooldown: 4,
    }),
    { minTier: "elite", minLevel: 8 },
  ),
  ability(
    "cyclone",
    "Cyclone",
    "Spins a cyclone through the party, with a turn's wind-up.",
    spell(9, "wind", {
      target: "all-enemies",
      spread: 0.6,
      charge: true,
      cooldown: 4,
    }),
    { minTier: "elite", minLevel: 8 },
  ),
  ability(
    "chill-touch",
    "Chill Touch",
    "A dead hand's touch: Wither, 5% of max HP a turn for 3.",
    spell(3, "dark", {
      ranged: false,
      applies: { status: "wither", duration: 3, power: 0.05 },
      cooldown: 3,
    }),
  ),
  ability(
    "wail",
    "Wail",
    "A grieving cry: the party deals 15% less damage for 2 turns.",
    {
      kind: "debuff",
      target: "all-enemies",
      stat: "damage",
      pct: -0.15,
      duration: 2,
      ranged: true,
      cooldown: 5,
    },
    { minLevel: 6 },
  ),
  ability(
    "dread-gaze",
    "Dread Gaze",
    "Fixes one target with its eyes: asleep for 2 turns (half the time).",
    {
      kind: "status",
      target: "enemy",
      status: "sleep",
      chance: 0.45,
      duration: 2,
      ranged: true,
      cooldown: 5,
    },
    { minTier: "elite", minLevel: 8 },
  ),
  ability(
    "bewitch",
    "Bewitch",
    "Turns a mind: confused for 2 turns (under half the time).",
    {
      kind: "status",
      target: "enemy",
      status: "confuse",
      chance: 0.4,
      duration: 2,
      ranged: true,
      cooldown: 5,
    },
    { minTier: "elite", minLevel: 8 },
  ),
  ability(
    "stagger",
    "Stagger",
    "A ringing blow: stunned for a turn (a third of the time).",
    strike(6, {
      type: "blunt",
      applies: { status: "stun", chance: 0.35, duration: 1 },
      cooldown: 5,
    }),
    { minTier: "elite", minLevel: 8 },
  ),
  ability(
    "doom-mark",
    "Doom Mark",
    "Marks a target: in 3 turns it loses 40% of max HP unless cleansed.",
    {
      kind: "status",
      target: "enemy",
      status: "doom",
      chance: 0.6,
      duration: 3,
      ranged: true,
      cooldown: 6,
    },
    { minTier: "boss", minLevel: 15 },
  ),
  ability("life-sap", "Life Sap", "Drains a little life: dark damage.", spell(5, "dark", { cooldown: 2 })),
  ability("smite", "Smite", "A zealot's blow of light.", spell(6, "light", { ranged: false, cooldown: 2 })),
  // People and machines
  ability(
    "war-cry",
    "War Cry",
    "Its side deals 15% more damage for 3 turns.",
    {
      kind: "buff",
      target: "party",
      stat: "damage",
      pct: 0.15,
      duration: 3,
      ranged: true,
      cooldown: 5,
    },
    { minLevel: 4 },
  ),
  ability(
    "rally",
    "Rally",
    "Its side gains +20% Speed for 2 turns.",
    {
      kind: "buff",
      target: "party",
      stat: "speed",
      pct: 0.2,
      duration: 2,
      ranged: true,
      cooldown: 5,
    },
    { minLevel: 8 },
  ),
  ability("mend", "Mend", "Heals an ally.", {
    kind: "heal",
    target: "ally",
    scales: "magic",
    power: 6,
    ranged: true,
    cooldown: 2,
  }),
  ability(
    "shield-ally",
    "Shield Ally",
    "Throws up a barrier on an ally that soaks damage.",
    {
      kind: "shield",
      target: "ally",
      scales: "magic",
      power: 8,
      ranged: true,
      cooldown: 4,
    },
    { minLevel: 5 },
  ),
  ability(
    "mark-target",
    "Mark Target",
    "Paints a target: everyone deals 20% more to it for 2 turns.",
    {
      kind: "debuff",
      target: "enemy",
      stat: "damage-taken",
      pct: 0.2,
      duration: 2,
      ranged: true,
      cooldown: 4,
    },
    { minLevel: 6 },
  ),
  ability(
    "dirty-trick",
    "Dirty Trick",
    "Sand in the eyes or a low blow: −25% Skill for 2 turns.",
    strike(3, {
      onHit: { stat: "skill", pct: -0.25, duration: 2 },
      cooldown: 3,
    }),
  ),
  ability(
    "suppressing-fire",
    "Suppressing Fire",
    "Sprays the whole party with fire: light damage to each.",
    strike(4, {
      target: "all-enemies",
      ranged: true,
      type: "pierce",
      spread: 0.6,
      cooldown: 3,
    }),
    { minLevel: 6 },
  ),
  ability(
    "grenade",
    "Grenade",
    "A thrown charge with a fuse: fire over the party.",
    strike(8, {
      target: "all-enemies",
      ranged: true,
      type: "fire",
      spread: 0.6,
      charge: true,
      cooldown: 5,
    }),
    { minTier: "elite", minLevel: 8 },
  ),
  ability(
    "taser",
    "Shock Prod",
    "A jolt that may stun for a turn (a third of the time).",
    strike(4, {
      type: "lightning",
      applies: { status: "stun", chance: 0.35, duration: 1 },
      cooldown: 5,
    }),
    { minTier: "elite", minLevel: 8 },
  ),
  ability(
    "self-repair",
    "Self-Repair",
    "Patches itself: 3% of max HP a turn (at most 35) for 3.",
    {
      kind: "status",
      target: "self",
      status: "regen",
      duration: 3,
      power: 0.03,
      cooldown: 5,
    },
    { minLevel: 5 },
  ),
  ability("run-hot", "Run Hot", "Runs hot: +30% Speed for 2 turns.", {
    kind: "buff",
    target: "self",
    stat: "speed",
    pct: 0.3,
    duration: 2,
    cooldown: 4,
  }),
  ability(
    "lock-on",
    "Lock On",
    "Aims for a turn, then a heavy shot at anyone.",
    strike(6, {
      ranged: true,
      charge: true,
      hitBonus: 20,
      cooldown: 4,
    }),
    { minLevel: 5 },
  ),
];

const ABILITY_BY_ID = new Map(MARINARA_BESTIARY_ABILITIES.map((each) => [each.id, each]));
export function marinaraBestiaryAbility(id: string): MarinaraEnemyAbility | undefined {
  return ABILITY_BY_ID.get(id);
}

const TIER_ORDER: Record<MarinaraEnemyTier, number> = { minion: 0, standard: 1, elite: 2, boss: 3 };

/** Whether a foe of this tier and level may use the ability. */
export function marinaraAbilityAllowed(abilityId: string, tier: MarinaraEnemyTier, level: number): boolean {
  const def = ABILITY_BY_ID.get(abilityId);
  if (!def) return false;
  if (def.minTier && TIER_ORDER[tier] < TIER_ORDER[def.minTier]) return false;
  return level >= (def.minLevel ?? 1);
}

// ── Families ──

export type MarinaraEnemyKind =
  | "beast"
  | "vermin"
  | "plant"
  | "ooze"
  | "undead"
  | "spirit"
  | "elemental"
  | "fiend"
  | "dragon"
  | "giant"
  | "humanoid"
  | "construct"
  | "machine";

/** The kinds of land and place a foe lives in, for location spawn tables: a region's ground maps onto one
 *  (the Overworld's region bands), and a site (a cave, a crypt, a ruin) onto ruins or underground. */
export const MARINARA_HABITATS = [
  "grassland",
  "forest",
  "desert",
  "snow",
  "swamp",
  "mountain",
  "coast",
  "ruins",
  "underground",
  "urban",
] as const;
export type MarinaraHabitat = (typeof MARINARA_HABITATS)[number];

/** What a foe does in a fight, which decides its row and how the GM should use it. */
export type MarinaraEnemyRole =
  | "brute"
  | "tank"
  | "skirmisher"
  | "shooter"
  | "caster"
  | "hexer"
  | "healer"
  | "leader"
  | "swarm"
  /** A rare encounter worth a windfall (see `windfall`): never built into ordinary fights. */
  | "treasure";

/** A name for one band of levels: the family's look from `from` up to the next band. */
export interface MarinaraEnemyName {
  from: number;
  name: string;
}

export interface MarinaraEnemyFamily {
  id: string;
  kind: MarinaraEnemyKind;
  role: MarinaraEnemyRole;
  /** Where it lives in the world (location spawns): the habitats whose region and site tables hold it.
   *  Absent (the treasure foes) is never in a table; they turn up only through the rare roll. */
  habitats?: readonly MarinaraHabitat[];
  /** One line for the GM: what it is and how it fights. */
  summary: string;
  mind: CombatMind;
  /** The temperaments it may have (fanatical, territorial and hungry are foe-only). */
  temperaments: readonly CombatTemperament[];
  /** A humanoid's class line (base, advanced, master) from the class trees. */
  classLine?: readonly [string, string, string];
  /** A monster's stat basis: an archetype's expected stats at its level, scaled per stat. */
  archetype?: MarinaraArchetype;
  statScale?: Partial<MarinaraStats>;
  /** Its basic attack's type (a monster's claws, a machine's guns); a humanoid's follows its weapon. */
  attackType?: MarinaraDamageType;
  rangedBasic?: boolean;
  row: "front" | "back";
  affinities?: MarinaraAffinities;
  /** Abilities it gains at a level (beasts, spirits, machines: bestiary abilities). */
  abilities: ReadonlyArray<{ id: string; from: number }>;
  /** A humanoid's carried class skills, from a level (Alyssa 2026-11-02: humanoids fight with their
   *  class kit plus real carried skills, never bestiary-only tricks). Promoted foes also carry their
   *  earlier classes' actives, as a player does. */
  carries?: ReadonlyArray<{ id: string; from: number }>;
  levels: readonly [number, number];
  tiers: readonly MarinaraEnemyTier[];
  /** Its names in each setting it lives in, by level band. */
  names: Partial<Record<MarinaraBestiarySetting, readonly MarinaraEnemyName[]>>;
  /** A treasure foe's windfall: what beating it pays, as multiples of a standard foe of its level
   *  (its XP, its coin drop), and how many rounds it stays before it flees with all of it (at the end of that round). */
  windfall?: { xp: number; gold: number; fleeAfterRounds: number };
  /** Everything it deals is scaled by this (a treasure foe barely fights back); 1 when absent. */
  damageScale?: number;
}

/** "Mire Gel", "Bile Gel@11", "Quickglass Gel@21" → bands; a bare "@11" ends the last band at 10. */
const n = (...entries: string[]): MarinaraEnemyName[] =>
  entries.map((entry) => {
    const [name, from] = entry.split("@");
    return { name: name!.trim(), from: from ? Number(from) : 1 };
  });
const at = (...pairs: Array<[string, number]>) => pairs.map(([id, from]) => ({ id, from }));

const ALL_TIERS = ["minion", "standard", "elite", "boss"] as const;
const LOW_TIERS = ["minion", "standard", "elite"] as const;
const BIG_TIERS = ["standard", "elite", "boss"] as const;

// Physical resistances that recur: bone breaks under a hammer, plate turns a blade.
const BONE: MarinaraAffinities = { blunt: "weak", pierce: "resist", light: "weak", dark: "absorb", poison: "immune" };
// Machines short out in water and shrug off splinters.
const MACHINE: MarinaraAffinities = { lightning: "weak", water: "weak", poison: "immune", pierce: "resist" };
/**
 * The wuxing wheel for foes (Alyssa 2026-11-02: wood foes are weak to fire, fire does little to water
 * foes). Each phase is strong against the one it overcomes and the one that feeds it, and resisted by the
 * one that overcomes it and the one it feeds:
 *   fire beats metal and wood, water beats fire and metal, earth beats water and fire,
 *   wood beats earth and water, metal beats wood and earth.
 * Ice is of water's phase, lightning and wind of wood's (MARINARA_ELEMENT_PHASE). A foe of an element
 * drinks that element, resists the rest of its phase, is weak to two phases and resists two.
 * Light and dark sit outside the phases and are weak only to each other.
 */
type WuxingPhase = keyof typeof MARINARA_WUXING_OVERCOMES;
type PhasedElement = keyof typeof MARINARA_ELEMENT_PHASE;
const PHASED = Object.keys(MARINARA_ELEMENT_PHASE) as PhasedElement[];
const PHASES = Object.keys(MARINARA_WUXING_OVERCOMES) as WuxingPhase[];
function wuxingFoe(element: PhasedElement): MarinaraAffinities {
  const phase = MARINARA_ELEMENT_PHASE[element];
  const overcomer = PHASES.find((other) => MARINARA_WUXING_OVERCOMES[other] === phase)!;
  const fed = PHASES.find((other) => MARINARA_WUXING_FED_BY[other] === phase)!;
  const weak = new Set<WuxingPhase>([overcomer, fed]);
  const resist = new Set<WuxingPhase>([phase, MARINARA_WUXING_OVERCOMES[phase], MARINARA_WUXING_FED_BY[phase]]);
  const affinities: MarinaraAffinities = {};
  for (const each of PHASED) {
    const of = MARINARA_ELEMENT_PHASE[each];
    if (each === element) affinities[each] = "absorb";
    else if (weak.has(of)) affinities[each] = "weak";
    else if (resist.has(of)) affinities[each] = "resist";
  }
  return affinities;
}
// Plate is metal: fire and water (rust) get through it, wood, lightning and wind glance off.
const PLATE: MarinaraAffinities = {
  ...wuxingFoe("metal"),
  metal: "resist",
  slash: "resist",
  pierce: "resist",
  blunt: "weak",
};
const GHOST: MarinaraAffinities = {
  slash: "immune",
  pierce: "immune",
  blunt: "immune",
  light: "weak",
  poison: "immune",
  dark: "resist",
};

export const MARINARA_BESTIARY: readonly MarinaraEnemyFamily[] = [
  // ── Vermin and beasts ──
  {
    id: "gnawer",
    kind: "vermin",
    role: "swarm",
    habitats: ["grassland", "forest", "swamp", "ruins", "underground", "urban"],
    summary: "Rats and their cousins: weak alone, come in numbers, worry wounds open.",
    mind: "instinct",
    temperaments: ["hungry", "cowardly", "opportunistic"],
    archetype: "scout",
    statScale: { hp: 0.6, strength: 0.85, defense: 0.6, resistance: 0.5, speed: 1.1 },
    attackType: "pierce",
    row: "front",
    affinities: { fire: "weak" },
    abilities: at(["gnaw", 1], ["swarm-bite", 11]),
    levels: [1, 24],
    tiers: ["minion", "standard"],
    names: {
      high_fantasy: n("Burrow Rat", "Tunnel Gnawer@9", "Ossuary Gnawer@17"),
      wuxia_xianxia: n("Granary Rat", "Tomb Gnawer@9", "Thousand-Tooth Rat@17"),
      modern_day: n("Alley Rat", "@9"),
      modern_supernatural: n("Witch's Rat", "Charnel Rat@9", "Swarmmother's Brood@17"),
      the_1920s: n("Dock Rat", "Cellar Swarm@9"),
      cyberpunk: n("Vent Rat", "Wire Gnawer@9", "Glitch Swarm@17"),
      space_opera: n("Hull Mite", "Cargo Gnawer@9", "Bulkhead Swarm@17"),
      post_apocalyptic: n("Ruin Rat", "Ash Gnawer@9", "Tunnel Brood@17"),
    },
  },
  {
    id: "hound",
    kind: "beast",
    role: "skirmisher",
    habitats: ["grassland", "forest", "snow", "mountain", "desert"],
    summary: "A pack hunter: quick, goes for the weakest, leaps the line at a back-row target.",
    mind: "instinct",
    temperaments: ["hungry", "opportunistic", "coordinated", "reckless"],
    archetype: "scout",
    statScale: { hp: 0.9, strength: 1.05, defense: 0.8, resistance: 0.6 },
    attackType: "pierce",
    row: "front",
    affinities: { fire: "weak" },
    abilities: at(["pounce", 1], ["rend", 6], ["shriek", 14]),
    levels: [1, 30],
    tiers: ALL_TIERS,
    names: {
      high_fantasy: n("Ditch Cur", "Moor Hound@9", "Ashmane Hound@17", "Hearthless Sire@25"),
      wuxia_xianxia: n("Hill Jackal", "Grave-Mound Wolf@9", "Moon-Howling Wolf@17", "Heavenly Dog@25"),
      modern_day: n("Stray Dog", "Guard Dog@6", "Fighting Dog@12", "Police K-9@20"),
      modern_supernatural: n(
        "Black-Eyed Stray",
        "Moonstruck Hound@9",
        "Gloaming Hound@17",
        "Hound of the Last Gate@25",
      ),
      the_1920s: n("Junkyard Dog", "Rail Yard Hound@8"),
      cyberpunk: n("Gutter Mutt", "Chromejaw@9", "Leashless Hunter@17"),
      space_opera: n("Scrub Lurcher", "Dune Lurcher@9", "Void Lurcher@17", "Lurcher Alpha@25"),
      post_apocalyptic: n("Feral Dog", "Ashland Hound@9", "Scorchfang@17", "Pack-Mother@25"),
    },
  },
  {
    id: "tusker",
    kind: "beast",
    role: "brute",
    habitats: ["grassland", "forest", "swamp"],
    summary: "A boar or grazer that charges: lowers its head for a turn, then hits like a cart.",
    mind: "instinct",
    temperaments: ["reckless", "territorial"],
    archetype: "blade",
    statScale: { hp: 1.25, strength: 1.1, skill: 0.8, speed: 0.85, resistance: 0.6 },
    attackType: "pierce",
    row: "front",
    abilities: at(["gore", 3], ["trample", 12]),
    levels: [2, 30],
    tiers: ALL_TIERS,
    names: {
      high_fantasy: n("Bristleback", "Thornhide Boar@9", "Ironbristle@17", "Oldtusk the Unfelled@25"),
      wuxia_xianxia: n("Mountain Boar", "Stone-Tusk Boar@9", "Hundred-Year Boar@17", "Mountain-Splitting Boar@25"),
      modern_day: n("Wild Boar", "@11"),
      modern_supernatural: n("Barrow Boar", "Corpse-Fed Boar@9", "Moonhide Boar@17"),
      space_opera: n("Dust Grazer", "Ridge Tusker@9", "Hullbreaker Tusker@17", "Herd Sovereign@25"),
      post_apocalyptic: n("Scrap Boar", "Gutter Tusk@9", "Furnace Hog@17", "Iron-Hide Patriarch@25"),
    },
  },
  {
    id: "great-beast",
    kind: "beast",
    role: "tank",
    habitats: ["forest", "mountain", "snow"],
    summary: "A bear, ape or ox of a thing: soaks blows, mauls, shrugs off small hurts.",
    mind: "instinct",
    temperaments: ["territorial", "protective", "reckless"],
    archetype: "guard",
    statScale: { hp: 1.2, strength: 1.2, speed: 0.8, resistance: 0.7 },
    attackType: "slash",
    row: "front",
    affinities: { fire: "weak", blunt: "resist" },
    abilities: at(["maul", 1], ["regenerate", 10], ["stagger", 18]),
    levels: [3, 30],
    tiers: BIG_TIERS,
    names: {
      high_fantasy: n("Barrow Bear", "Cragback@11", "Stonepelt Elder@21"),
      wuxia_xianxia: n("Black Ridge Bear", "Iron-Palm Ape@11", "White Ape of the Peaks@21"),
      modern_day: n("Black Bear", "@14"),
      space_opera: n("Bramble Ox", "Ridge Hulk@11", "Mountain-Back@21"),
      post_apocalyptic: n("Rubble Bear", "Ashback@11", "Cinder Hulk@21"),
    },
  },
  {
    id: "raptor",
    kind: "beast",
    role: "skirmisher",
    habitats: ["mountain", "coast", "grassland", "desert"],
    summary: "A flier: hangs back out of reach and dives on anyone, then climbs again.",
    mind: "instinct",
    temperaments: ["opportunistic", "hungry", "cautious"],
    archetype: "scout",
    statScale: { hp: 0.8, strength: 1.0, speed: 1.2, defense: 0.7 },
    attackType: "slash",
    rangedBasic: true,
    row: "back",
    affinities: { pierce: "weak", metal: "weak", wind: "resist", lightning: "resist", earth: "resist" },
    abilities: at(["dive", 1], ["gust", 4], ["shriek", 9], ["storm-breath", 21]),
    levels: [1, 30],
    tiers: ALL_TIERS,
    names: {
      high_fantasy: n("Crag Kite", "Stormwing@11", "Thundercrest@21"),
      wuxia_xianxia: n("Red Kite", "Bladefeather Crane@11", "Sunfall Crane@21"),
      modern_day: n("Angry Goose", "Territorial Swan@4", "@9"),
      modern_supernatural: n("Omen Crow", "Pallbearer Crow@11", "Storm-Rook@21"),
      space_opera: n("Skimmer", "Vane Glider@11", "Stormskimmer@21"),
      post_apocalyptic: n("Carrion Buzzard", "Ash Vulture@11", "Firestorm Vulture@21"),
    },
  },
  {
    id: "stinger",
    kind: "vermin",
    role: "skirmisher",
    habitats: ["forest", "swamp", "desert", "underground", "ruins"],
    summary: "Wasps, centipedes, ticks, spiders: venom that keeps hurting after the bite.",
    mind: "instinct",
    temperaments: ["hungry", "territorial", "opportunistic"],
    archetype: "scout",
    statScale: { hp: 0.75, strength: 0.9, defense: 0.9, resistance: 0.6 },
    attackType: "pierce",
    row: "front",
    affinities: { fire: "weak", ice: "weak", poison: "immune" },
    abilities: at(["venom-fang", 1], ["web", 6], ["spore-cloud", 16]),
    levels: [1, 28],
    tiers: ALL_TIERS,
    names: {
      high_fantasy: n("Mire Tick", "Bloodwasp@9", "Queen-Guard Wasp@17"),
      wuxia_xianxia: n("Jade Centipede", "Hundred-Leg@9", "Golden Centipede@17"),
      modern_day: n("Hornet Swarm", "@9"),
      modern_supernatural: n("Cellar Weaver", "Shroud Spider@9", "Mourning Weaver@17"),
      space_opera: n("Chitin Picker", "Hive Lancer@9", "Hive Matron@17"),
      post_apocalyptic: n("Glass Roach", "Ash Scuttler@9", "Hive Warden@17"),
    },
  },
  {
    id: "serpent",
    kind: "beast",
    role: "brute",
    habitats: ["swamp", "coast", "desert", "forest"],
    summary: "A snake or eel: poisons, then coils and holds a target down.",
    mind: "instinct",
    temperaments: ["patient", "hungry", "territorial"],
    archetype: "blade",
    statScale: { hp: 1.0, strength: 1.0, speed: 1.05, resistance: 0.7 },
    attackType: "pierce",
    row: "front",
    affinities: { earth: "weak", water: "resist", ice: "resist", poison: "resist" },
    abilities: at(["venom-fang", 1], ["constrict", 5], ["tail-sweep", 14]),
    levels: [1, 30],
    tiers: ALL_TIERS,
    names: {
      high_fantasy: n("Fen Adder", "Mire Python@11", "Old Coil of the Marsh@21"),
      wuxia_xianxia: n("Bamboo Viper", "White Silk Snake@11", "Thousand-Year Python@21"),
      space_opera: n("Sump Eel", "Lash Coil@11", "Deep Coil@21"),
      post_apocalyptic: n("Dust Viper", "Sand Coil@11", "Dune Swallower@21"),
    },
  },
  {
    id: "stalker",
    kind: "beast",
    role: "skirmisher",
    habitats: ["forest", "mountain", "snow", "desert", "underground"],
    summary: "An ambush predator: picks one victim, tears it open and won't let go.",
    mind: "cunning",
    temperaments: ["hungry", "patient", "opportunistic"],
    archetype: "scout",
    statScale: { hp: 0.95, strength: 1.15, skill: 1.1, defense: 0.8 },
    attackType: "slash",
    row: "front",
    affinities: { light: "weak", fire: "weak" },
    abilities: at(["pounce", 1], ["rend", 4], ["devour", 10], ["dread-gaze", 18]),
    levels: [4, 30],
    tiers: BIG_TIERS,
    names: {
      space_opera: n("Vent Larva", "Hullshadow@11", "Brood Apex@21"),
      modern_supernatural: n("Moonsick Stray", "Half-Turned@11", "Night Alpha@21"),
      high_fantasy: n("Moonsick Woodsman", "Full-Moon Brute@11", "Pack Sire of the Long Night@21"),
      post_apocalyptic: n("Tunnel Lurker", "Pale Stalker@11", "Deep Hunter@21"),
    },
  },
  // ── Plants and oozes ──
  {
    id: "gel",
    kind: "ooze",
    role: "tank",
    habitats: ["swamp", "underground", "ruins", "urban"],
    summary: "A mindless blob: steel sinks into it, fire and frost do not; corrodes armour.",
    mind: "mindless",
    temperaments: ["reckless"],
    archetype: "guard",
    statScale: { hp: 1.3, strength: 0.9, speed: 0.6, skill: 0.7, defense: 0.5, resistance: 1.0, luck: 0.4 },
    attackType: "blunt",
    row: "front",
    affinities: {
      slash: "resist",
      pierce: "resist",
      fire: "weak",
      earth: "weak",
      water: "resist",
      ice: "resist",
      poison: "immune",
    },
    abilities: at(["acid-spit", 1], ["regenerate", 12]),
    levels: [1, 30],
    tiers: ALL_TIERS,
    names: {
      high_fantasy: n("Mire Gel", "Bile Gel@11", "Quickglass Gel@21"),
      wuxia_xianxia: n("Paddy Leech", "Blood Leech@11", "Corpse Leech@21"),
      modern_supernatural: n("Ectoplasm Pool", "Hungry Residue@11", "Weeping Residue@21"),
      cyberpunk: n("Biowaste Sludge", "Nanite Sludge@11", "Grey Bloom@21"),
      space_opera: n("Hull Slick", "Reactor Gel@11", "Brood Gel@21"),
      post_apocalyptic: n("Tar Crawler", "Sump Sludge@11", "Toxic Bloom@21"),
    },
  },
  {
    id: "thornling",
    kind: "plant",
    role: "hexer",
    habitats: ["forest", "swamp", "ruins"],
    summary: "A rooted thing: stays back, snares with vines and clouds the air with spores.",
    mind: "mindless",
    temperaments: ["territorial", "patient"],
    archetype: "hexer",
    statScale: { hp: 1.1, magic: 0.9, speed: 0.7, defense: 1.0 },
    attackType: "poison",
    rangedBasic: true,
    row: "back",
    affinities: { ...wuxingFoe("wood"), poison: "immune", blunt: "resist" },
    abilities: at(["web", 1], ["bramble", 3], ["spore-cloud", 6], ["life-sap", 12]),
    levels: [1, 30],
    tiers: ALL_TIERS,
    names: {
      high_fantasy: n("Brambleling", "Hedgewarden@11", "Old Thornwood@21"),
      wuxia_xianxia: n("Spirit Herb Sprite", "Vine Demon@11", "Thousand-Year Ginseng@21"),
      modern_supernatural: n("Gallows Vine", "Graveyard Briar@11", "Hanging Tree@21"),
      space_opera: n("Snap Pod", "Lure Bloom@11", "Jungle Maw@21"),
      post_apocalyptic: n("Rot Cap", "Spore Shambler@11", "Bloom Mother@21"),
    },
  },
  // ── The dead and the bodiless ──
  {
    id: "bones",
    kind: "undead",
    role: "brute",
    habitats: ["ruins", "underground"],
    summary: "A walking skeleton or stiff corpse: never breaks, never runs; a hammer undoes it.",
    mind: "mindless",
    temperaments: ["reckless", "fanatical"],
    archetype: "blade",
    statScale: { hp: 0.95, speed: 0.85, resistance: 0.8 },
    attackType: "slash",
    row: "front",
    affinities: BONE,
    abilities: at(["sunder", 4], ["stagger", 16]),
    levels: [1, 30],
    tiers: ALL_TIERS,
    names: {
      high_fantasy: n("Barrow Bones", "Grave Legionary@11", "Ossuary Knight@21"),
      wuxia_xianxia: n("Stiff Corpse", "Iron Corpse@11", "Bronze Armour Corpse@21"),
      modern_supernatural: n("Gravewalker", "Charnel Walker@11", "Mausoleum Knight@21"),
    },
  },
  {
    id: "gorger",
    kind: "undead",
    role: "brute",
    habitats: ["ruins", "underground", "swamp"],
    summary: "A corpse-eater: its bite festers, so healing barely takes.",
    mind: "cunning",
    temperaments: ["hungry", "cruel", "cowardly"],
    archetype: "blade",
    statScale: { hp: 1.05, strength: 1.05, defense: 0.8, resistance: 0.8 },
    attackType: "slash",
    row: "front",
    affinities: { light: "weak", fire: "weak", poison: "immune", dark: "resist" },
    abilities: at(["devour", 4], ["chill-touch", 8], ["dread-gaze", 18]),
    levels: [3, 30],
    tiers: ALL_TIERS,
    names: {
      high_fantasy: n("Ditch Ghoul", "Crypt Gorger@11", "Mound Glutton@21"),
      wuxia_xianxia: n("Corpse-Eating Ghoul", "Flesh-Hungry Ghost@11", "Bone-Gnawing Fiend@21"),
      modern_supernatural: n("Carrion Thing", "Morgue Eater@11", "Vault Gorger@21"),
    },
  },
  {
    id: "shade",
    kind: "spirit",
    role: "caster",
    habitats: ["ruins", "underground"],
    summary: "A ghost: steel passes through it; only light, magic and blessed weapons bite.",
    mind: "cunning",
    temperaments: ["cruel", "territorial", "patient"],
    archetype: "hexer",
    statScale: { hp: 0.75, magic: 1.0, defense: 0.6, resistance: 1.2, speed: 1.05 },
    attackType: "dark",
    rangedBasic: true,
    row: "back",
    affinities: GHOST,
    abilities: at(["chill-touch", 1], ["wail", 6], ["bewitch", 12], ["doom-mark", 18]),
    levels: [2, 30],
    tiers: ALL_TIERS,
    names: {
      high_fantasy: n("Marsh Light", "Weeping Shade@11", "Bell-Tolled Wraith@21"),
      wuxia_xianxia: n("Hungry Ghost", "Vengeful Bride@11", "Ghost General@21"),
      modern_supernatural: n("Cold Spot", "Echo Shade@11", "Drowned Bride@21"),
      space_opera: n("Static Ghost", "Hull Echo@11", "Derelict Choir@21"),
    },
  },
  {
    id: "grave-duelist",
    kind: "undead",
    role: "tank",
    habitats: ["ruins", "underground"],
    summary: "A dead knight or swordsman still keeping an oath: fights fair, guards its own, hard to put down.",
    mind: "tactical",
    temperaments: ["honourable", "fanatical", "protective"],
    classLine: ["guard", "sentinel", "stonewall"],
    row: "front",
    affinities: { ...BONE, slash: "resist" },
    abilities: [],
    carries: at(["power-strike", 1], ["reckless-swing", 12]),
    levels: [5, 30],
    tiers: BIG_TIERS,
    names: {
      high_fantasy: n("Oathbroken Squire", "Grave Sentinel@11", "Barrow King's Champion@21"),
      wuxia_xianxia: n("Lingering Blade", "Grave Duelist@11", "Unburied Master@21"),
      modern_supernatural: n("Restless Duelist", "Gallows Knight@11", "Midnight Cavalier@21"),
    },
  },
  {
    id: "cinder-spirit",
    kind: "elemental",
    role: "caster",
    habitats: ["desert", "mountain", "underground"],
    summary:
      "Living fire: drinks flame, shrugs off wood and metal, quenched by water and frost, smothered by earth; burns the whole party when grown.",
    mind: "instinct",
    temperaments: ["reckless", "territorial"],
    archetype: "channeler",
    statScale: { hp: 0.9, defense: 0.7 },
    attackType: "fire",
    rangedBasic: true,
    row: "back",
    affinities: { ...wuxingFoe("fire"), poison: "immune", slash: "resist" },
    abilities: at(["ember", 1], ["fire-breath", 12]),
    levels: [2, 30],
    tiers: ALL_TIERS,
    names: {
      high_fantasy: n("Ember Mote", "Blaze Spirit@11", "Pyre Colossus@21"),
      wuxia_xianxia: n("Foxfire Wisp", "Fire Crow Spirit@11", "Samadhi Flame@21"),
      modern_supernatural: n("Hearth Sprite", "Arson Spirit@11", "Bonfire Saint@21"),
      post_apocalyptic: n("Burn Wisp", "Firestorm Spirit@11", "Ground Zero Flame@21"),
    },
  },
  {
    id: "rime-spirit",
    kind: "elemental",
    role: "caster",
    habitats: ["snow", "mountain"],
    summary:
      "Living frost, of water's phase: drinks cold, shrugs off fire and metal, cracks under earth, wood and hammers.",
    mind: "instinct",
    temperaments: ["patient", "territorial"],
    archetype: "channeler",
    statScale: { hp: 0.95, defense: 0.9, speed: 0.9 },
    attackType: "ice",
    rangedBasic: true,
    row: "back",
    affinities: { ...wuxingFoe("ice"), blunt: "weak", poison: "immune" },
    abilities: at(["rime", 1], ["harden", 6], ["frost-breath", 12]),
    levels: [2, 30],
    tiers: ALL_TIERS,
    names: {
      high_fantasy: n("Rime Mote", "Hoarfrost Spirit@11", "Glacier Colossus@21"),
      wuxia_xianxia: n("Snow Maiden Wisp", "Frost Lotus Spirit@11", "Ninth-Winter Spirit@21"),
      modern_supernatural: n("Window Frost", "Grave-Chill Spirit@11", "Winter's Widow@21"),
    },
  },
  {
    id: "storm-spirit",
    kind: "elemental",
    role: "caster",
    habitats: ["mountain", "coast", "grassland"],
    summary:
      "Living lightning, of wood's phase: quick, drinks the storm, shrugs off earth and water, cut by metal and burnt out by fire.",
    mind: "instinct",
    temperaments: ["reckless", "opportunistic"],
    archetype: "channeler",
    statScale: { hp: 0.8, speed: 1.2, defense: 0.6 },
    attackType: "lightning",
    rangedBasic: true,
    row: "back",
    affinities: { ...wuxingFoe("lightning"), blunt: "weak", poison: "immune", pierce: "resist" },
    abilities: at(["spark", 1], ["run-hot", 6], ["storm-breath", 12]),
    levels: [2, 30],
    tiers: ALL_TIERS,
    names: {
      high_fantasy: n("Spark Mote", "Thunder Spirit@11", "Tempest Colossus@21"),
      wuxia_xianxia: n("Thunder Sprite", "Lightning Tribulation Spirit@11", "Ninefold Tribulation@21"),
      cyberpunk: n("Live Wire", "Grid Ghost@11", "Blackout Storm@21"),
      space_opera: n("Plasma Mote", "Ion Spirit@11", "Corona Colossus@21"),
    },
  },
  // The wuxing four beside fire (Alyssa 2026-11-02). Each drinks its own element, falls to the one that
  // overcomes it (wood parts earth, earth dams water, water quenches fire, fire melts metal, metal fells wood)
  // and shrugs off the one it overcomes.
  {
    id: "grove-spirit",
    kind: "elemental",
    role: "caster",
    habitats: ["forest"],
    summary:
      "Living wood: drinks growth, roots a target in place, shrugs off earth and water, felled by metal and burnt by fire; whips thorns over the party when grown.",
    mind: "instinct",
    temperaments: ["patient", "territorial"],
    archetype: "channeler",
    statScale: { hp: 1.05, defense: 0.8, speed: 0.85 },
    attackType: "wood",
    rangedBasic: true,
    row: "back",
    affinities: { ...wuxingFoe("wood"), poison: "immune" },
    abilities: at(["bramble", 1], ["root-snare", 5], ["regenerate", 9], ["thorn-storm", 12]),
    levels: [2, 30],
    tiers: ALL_TIERS,
    names: {
      high_fantasy: n("Sapling Mote", "Briarheart Spirit@11", "Elderbough Colossus@21"),
      wuxia_xianxia: n("Bamboo Wisp", "Thousand-Root Spirit@11", "Spring-Emperor Grove@21"),
      modern_supernatural: n("Ivy Haunt", "Overgrowth Spirit@11", "Greenwood Matron@21"),
      post_apocalyptic: n("Creeper Wisp", "Reclaimer Bloom@11", "Overgrown City@21"),
    },
  },
  {
    id: "clay-spirit",
    kind: "elemental",
    role: "brute",
    habitats: ["mountain", "underground", "desert"],
    summary:
      "Living earth: slow and heavy at the front, drinks stone, shrugs off water and fire, split by wood, lightning, wind and metal; shakes the ground when grown.",
    mind: "instinct",
    temperaments: ["patient", "territorial"],
    archetype: "guard",
    statScale: { hp: 1.1, defense: 1.15, speed: 0.75, resistance: 0.8 },
    attackType: "earth",
    row: "front",
    affinities: { ...wuxingFoe("earth"), poison: "immune", slash: "resist" },
    abilities: at(["clod", 1], ["harden", 6], ["quake", 12]),
    levels: [2, 30],
    tiers: ALL_TIERS,
    names: {
      high_fantasy: n("Pebble Mote", "Bedrock Spirit@11", "Mountain's Heart@21"),
      wuxia_xianxia: n("Clay Sprite", "Yellow Loess Spirit@11", "Five-Peaks Ancestor@21"),
      modern_supernatural: n("Cellar Clod", "Foundation Spirit@11", "Fault-Line Saint@21"),
      post_apocalyptic: n("Dust Wisp", "Rubble Spirit@11", "Crater Colossus@21"),
    },
  },
  {
    id: "tide-spirit",
    kind: "elemental",
    role: "caster",
    habitats: ["coast", "swamp", "underground"],
    summary:
      "Living water: drinks the flood, drags the front row down, shrugs off fire and metal, dammed by earth and drunk by wood; brings a wave over the party when grown.",
    mind: "instinct",
    temperaments: ["patient", "opportunistic"],
    archetype: "channeler",
    statScale: { hp: 0.95, defense: 0.8 },
    attackType: "water",
    rangedBasic: true,
    row: "back",
    affinities: { ...wuxingFoe("water"), poison: "immune", blunt: "resist" },
    abilities: at(["torrent", 1], ["undertow", 6], ["tidal-wave", 12]),
    levels: [2, 30],
    tiers: ALL_TIERS,
    names: {
      high_fantasy: n("Dew Mote", "Undertow Spirit@11", "Tidewrack Colossus@21"),
      wuxia_xianxia: n("Spring Sprite", "Black River Spirit@11", "Four-Seas Sovereign@21"),
      modern_supernatural: n("Storm-Drain Wisp", "Drowned Spirit@11", "Flood Widow@21"),
      post_apocalyptic: n("Runoff Wisp", "Floodwater Spirit@11", "Drowned Coast@21"),
    },
  },
  {
    id: "edge-spirit",
    kind: "elemental",
    role: "skirmisher",
    habitats: ["mountain", "underground", "ruins"],
    summary:
      "Living metal: quick splinters and edges that strip armour, drinks iron, shrugs off wood and earth, melted by fire and rusted by water; a whirl of blades when grown.",
    mind: "instinct",
    temperaments: ["reckless", "disciplined"],
    archetype: "channeler",
    statScale: { hp: 0.85, defense: 1.1, speed: 1.05, resistance: 0.8 },
    attackType: "metal",
    rangedBasic: true,
    row: "back",
    affinities: { ...wuxingFoe("metal"), slash: "resist", pierce: "resist", poison: "immune" },
    abilities: at(["shrapnel", 1], ["edge-wind", 6], ["blade-storm", 12]),
    levels: [2, 30],
    tiers: ALL_TIERS,
    names: {
      high_fantasy: n("Filing Mote", "Swordsong Spirit@11", "Anvil Colossus@21"),
      wuxia_xianxia: n("Bronze Bell Sprite", "Thousand-Edge Spirit@11", "White Gold Sovereign@21"),
      cyberpunk: n("Chrome Gremlin", "Razorwire Ghost@11", "Foundry Saint@21"),
      post_apocalyptic: n("Rust Wisp", "Scrapstorm Spirit@11", "Junkyard Colossus@21"),
    },
  },
  // Wind (Alyssa 2026-11-02), of wood's phase.
  {
    id: "gale-spirit",
    kind: "elemental",
    role: "skirmisher",
    habitats: ["mountain", "grassland", "coast", "desert"],
    summary:
      "Living wind, of wood's phase: the quickest spirit, drinks the gale, rides over earth and water, cut by metal and burnt out by fire; a cyclone when grown.",
    mind: "instinct",
    temperaments: ["reckless", "opportunistic"],
    archetype: "channeler",
    statScale: { hp: 0.8, speed: 1.25, defense: 0.6 },
    attackType: "wind",
    rangedBasic: true,
    row: "back",
    affinities: { ...wuxingFoe("wind"), poison: "immune", pierce: "resist" },
    abilities: at(["gust", 1], ["fair-wind", 6], ["cyclone", 12]),
    levels: [2, 30],
    tiers: ALL_TIERS,
    names: {
      high_fantasy: n("Breeze Mote", "Galeborn Spirit@11", "Skyrend Colossus@21"),
      wuxia_xianxia: n("Willow-Wind Sprite", "Nine-Gale Spirit@11", "Heaven-Sweeping Wind@21"),
      modern_supernatural: n("Draught Haunt", "Rooftop Gale@11", "Hurricane Widow@21"),
      space_opera: n("Vent Mote", "Decompression Spirit@11", "Solar Wind Colossus@21"),
    },
  },
  {
    id: "fiend",
    kind: "fiend",
    role: "hexer",
    habitats: ["ruins", "underground"],
    summary: "A small bargaining devil that grows into a great one: curses, bewitches, burns.",
    mind: "tactical",
    temperaments: ["cruel", "arrogant", "opportunistic"],
    archetype: "hexer",
    statScale: { hp: 0.9, speed: 1.1 },
    attackType: "fire",
    rangedBasic: true,
    row: "back",
    affinities: { fire: "resist", water: "weak", light: "weak", dark: "resist", poison: "immune" },
    abilities: at(["ember", 1], ["curse", 4], ["bewitch", 10], ["doom-mark", 18]),
    levels: [2, 30],
    tiers: ALL_TIERS,
    names: {
      high_fantasy: n("Ash Imp", "Brimstone Fiend@11", "Sulfur Duke@21"),
      wuxia_xianxia: n("Fox Spirit", "Silver Fox Spirit@11", "Ninefold Fox@21"),
      modern_supernatural: n("Contract Imp", "Bargain Fiend@11", "Crossroads Duke@21"),
    },
  },
  {
    id: "drake",
    kind: "dragon",
    role: "brute",
    habitats: ["mountain", "underground", "desert"],
    summary: "Dragonkind: claws for the front, a wind-up breath over the party once grown.",
    mind: "cunning",
    temperaments: ["territorial", "arrogant", "hungry"],
    archetype: "blade",
    statScale: { hp: 1.15, strength: 1.1, magic: 1.6, defense: 1.15, resistance: 1.1 },
    attackType: "slash",
    row: "front",
    affinities: { ice: "weak", water: "weak", fire: "resist" },
    abilities: at(["tail-sweep", 6], ["fire-breath", 8]),
    levels: [4, 30],
    tiers: BIG_TIERS,
    names: {
      high_fantasy: n("Hatchling Drake", "Crag Drake@11", "Sky-Tyrant Drake@21"),
      wuxia_xianxia: n("River Serpent", "Flood Jiao@11", "Storm Dragon of the Nine Rivers@21"),
      post_apocalyptic: n("Scorch Lizard", "Kiln Lizard@11", "Crater Wyrm@21"),
    },
  },
  {
    id: "lout",
    kind: "giant",
    role: "brute",
    habitats: ["mountain", "forest", "snow", "underground"],
    summary: "A hulking brute: slow, throws rubble at the back row, flattens the front.",
    mind: "cunning",
    temperaments: ["reckless", "arrogant", "hungry"],
    archetype: "blade",
    statScale: { hp: 1.4, strength: 1.2, skill: 0.75, speed: 0.7, defense: 1.0, resistance: 0.5, luck: 0.6 },
    attackType: "blunt",
    row: "front",
    affinities: { pierce: "weak", wood: "weak", blunt: "resist", earth: "resist" },
    abilities: at(["maul", 1], ["hurl-boulder", 6], ["trample", 14]),
    levels: [4, 30],
    tiers: BIG_TIERS,
    names: {
      high_fantasy: n("Hill Lout", "Boulder-Thrower@11", "Peak Colossus@21"),
      wuxia_xianxia: n("Bronze-Skin Brute", "Mountain Yaksha@11", "Heaven-Shaking Yaksha@21"),
      modern_supernatural: n("Under-Bridge Lout", "Tunnel Brute@11", "Hill Sleeper@21"),
      space_opera: n("Heavyworlder", "Gravity Brute@11", "Titan-Born@21"),
      post_apocalyptic: n("Lumbering Mutant", "Ruin Brute@11", "Ruin Colossus@21"),
    },
  },
  {
    id: "night-courtier",
    kind: "undead",
    role: "skirmisher",
    habitats: ["ruins", "urban"],
    summary: "A blood-drinking noble and its thralls: fast, drains life, bewitches the weak-willed.",
    mind: "genius",
    temperaments: ["arrogant", "cruel", "patient"],
    classLine: ["scout", "shade", "shroud"],
    row: "front",
    affinities: { light: "weak", fire: "weak", dark: "absorb", poison: "immune" },
    abilities: [],
    carries: at(["siphon", 6], ["wither", 12]),
    levels: [4, 30],
    tiers: ALL_TIERS,
    names: {
      modern_supernatural: n("Thrall", "Night Courtier@11", "Elder of the Court@21"),
      high_fantasy: n("Pale Thrall", "Blood Courtier@11", "Count of the Long Night@21"),
    },
  },
  // ── People ──
  {
    id: "cutpurse",
    kind: "humanoid",
    role: "skirmisher",
    habitats: ["urban", "ruins", "forest", "grassland"],
    summary: "A thief or raider: dirty tricks, quick knives, runs when the fight turns.",
    mind: "cunning",
    temperaments: ["opportunistic", "cowardly", "cruel"],
    classLine: ["scout", "rogue", "phantom"],
    row: "front",
    abilities: [],
    carries: at(["weaken", 1], ["mark-prey", 12]),
    levels: [1, 30],
    tiers: ALL_TIERS,
    names: {
      high_fantasy: n("Footpad", "Roadknife@11", "Shadow of the Pass@21"),
      wuxia_xianxia: n("Mountain Bandit", "Black Wind Robber@11", "Masked Night-Thief@21"),
      modern_day: n("Pickpocket", "Mugger@5", "Cat Burglar@12", "Master Thief@20"),
      modern_supernatural: n("Purse-Snatcher", "Fence's Knife@11"),
      the_1920s: n("Pickpocket", "Stick-up Man@9", "Second-Story Ghost@17"),
      cyberpunk: n("Ripcord Kid", "Chopshop Cutter@11", "Ghost Fixer@21"),
      space_opera: n("Dock Thief", "Corsair Cutter@11", "Void Corsair@21"),
      post_apocalyptic: n("Scavenger", "Highway Raider@11", "Dust Marauder@21"),
    },
  },
  {
    id: "sellsword",
    kind: "humanoid",
    role: "brute",
    habitats: ["grassland", "forest", "desert", "mountain", "ruins", "urban"],
    summary: "A hired fighter or enforcer: hits hard, gets meaner as it bleeds.",
    mind: "cunning",
    temperaments: ["reckless", "cruel", "arrogant", "disciplined"],
    classLine: ["blade", "bloodsworn", "cleaver"],
    row: "front",
    abilities: [],
    carries: at(["flurry", 6], ["rally", 12]),
    levels: [1, 30],
    tiers: ALL_TIERS,
    names: {
      high_fantasy: n("Hired Blade", "Red-Debt Mercenary@11", "Warband Chief@21"),
      wuxia_xianxia: n("Wandering Swordsman", "Blood Saber@11", "Saber Tyrant@21"),
      modern_day: n("Brawler", "Street Fighter@6", "Underground Champion@14", "Cage Legend@22"),
      modern_supernatural: n("Hired Muscle", "Order Enforcer@11", "Order Executioner@21"),
      the_1920s: n("Bruiser", "Enforcer@9", "Made Man@17"),
      cyberpunk: n("Chrome Brawler", "Razor Enforcer@11", "Corporate Executioner@21"),
      space_opera: n("Hired Gun", "Boarding Cutter@11", "Warlord's Champion@21"),
      post_apocalyptic: n("Pit Fighter", "Arena Butcher@11", "Warlord@21"),
    },
  },
  {
    id: "shieldbearer",
    kind: "humanoid",
    role: "tank",
    habitats: ["urban", "ruins", "grassland"],
    summary: "A guard or trooper: holds the line, covers its friends, breaks armour.",
    mind: "tactical",
    temperaments: ["disciplined", "protective", "honourable"],
    classLine: ["guard", "sentinel", "stonewall"],
    row: "front",
    affinities: {},
    abilities: [],
    carries: at(["power-strike", 4], ["spellguard", 12]),
    levels: [1, 30],
    tiers: ALL_TIERS,
    names: {
      high_fantasy: n("Town Watch", "Shieldsworn@11", "Gate Captain@21"),
      wuxia_xianxia: n("Escort Agency Guard", "Iron Shirt Monk@11", "Golden Bell Abbot@21"),
      modern_day: n("Security Guard", "Riot Officer@8", "Tactical Officer@16", "Response Team Lead@24"),
      modern_supernatural: n("Night Watchman", "Order Warden@11", "Order Bastion@21"),
      the_1920s: n("Beat Cop", "Dry Agent@9", "Bureau Captain@17"),
      cyberpunk: n("Corp Security", "Riot Trooper@11", "Tower Guard Captain@21"),
      space_opera: n("Patrol Trooper", "Line Marine@11", "Bulwark Sergeant@21"),
      post_apocalyptic: n("Hold Guard", "Wall Keeper@11", "Gate Captain of the Hold@21"),
    },
  },
  {
    id: "shooter",
    kind: "humanoid",
    role: "shooter",
    habitats: ["forest", "grassland", "mountain", "desert", "ruins", "urban"],
    summary: "An archer or gunner: stays back, picks off the weak, poisons or pins.",
    mind: "tactical",
    temperaments: ["patient", "cautious", "opportunistic"],
    classLine: ["marksman", "sharpshooter", "farshot"],
    row: "back",
    abilities: [],
    carries: at(["wither", 6], ["volley", 12]),
    levels: [1, 30],
    tiers: ALL_TIERS,
    names: {
      high_fantasy: n("Poacher", "Longbowman@11", "Crow's-Eye Archer@21"),
      wuxia_xianxia: n("Crossbow Bandit", "Flying Dagger Thrower@11", "Hundred-Step Archer@21"),
      modern_supernatural: n("Hunter Initiate", "Silver Shooter@11", "Order Marksman@21"),
      the_1920s: n("Gunsel", "Drum-Gun Man@9", "Rooftop Rifleman@17"),
      cyberpunk: n("Gang Shooter", "Optic-Wired Gunner@11", "Rooftop Ghost@21"),
      space_opera: n("Blaster Trooper", "Rail Gunner@11", "Ghost Sniper@21"),
      post_apocalyptic: n("Junk Shooter", "Watchtower Rifle@11", "Longshot Hermit@21"),
    },
  },
  {
    id: "adept",
    kind: "humanoid",
    role: "caster",
    habitats: ["urban", "ruins", "underground"],
    summary: "A spellcaster, psion or hacker: elemental bolts from the back row, area fire once grown.",
    mind: "tactical",
    temperaments: ["arrogant", "methodical", "cautious"],
    classLine: ["channeler", "elementalist", "stormcaller"],
    row: "back",
    abilities: [],
    carries: at(["barrier", 6], ["starfall", 14]),
    levels: [1, 30],
    tiers: ALL_TIERS,
    names: {
      high_fantasy: n("Hedge Mage", "Storm Adept@11", "Tower Magister@21"),
      wuxia_xianxia: n("Talisman Adept", "Thunder Seal Master@11", "Cloud-Riding Elder@21"),
      modern_supernatural: n("Coven Initiate", "Coven Witch@11", "Coven Matriarch@21"),
      cyberpunk: n("Script Kid", "Wire Burner@11", "Daemon Weaver@21"),
      space_opera: n("Psi Cadet", "Void Adept@11", "Rift Magister@21"),
      post_apocalyptic: n("Spark Tinker", "Arc Welder@11", "Lightning Priest@21"),
    },
  },
  {
    id: "cultist",
    kind: "humanoid",
    role: "hexer",
    habitats: ["ruins", "underground", "urban", "swamp"],
    summary: "A zealot of something dark: curses, rot and wither, never surrenders.",
    mind: "tactical",
    temperaments: ["fanatical", "cruel", "methodical"],
    classLine: ["hexer", "witch", "carrion-lord"],
    row: "back",
    abilities: [],
    carries: at(["shadowstep", 6], ["siphon", 12]),
    levels: [1, 30],
    tiers: ALL_TIERS,
    names: {
      high_fantasy: n("Hooded Acolyte", "Rot Preacher@11", "Choir Hierarch@21"),
      wuxia_xianxia: n("Demonic Sect Disciple", "Blood Sect Elder@11", "Sect Patriarch@21"),
      modern_supernatural: n("Cult Initiate", "Grave Hierophant@11", "Night Court Hierarch@21"),
      cyberpunk: n("Chrome Cultist", "Firmware Preacher@11", "Uplink Prophet@21"),
      space_opera: n("Void Cultist", "Null Preacher@11", "Starless Hierarch@21"),
      post_apocalyptic: n("Ash Cultist", "Cinder Preacher@11", "Last-Fire Prophet@21"),
    },
  },
  {
    id: "field-medic",
    kind: "humanoid",
    role: "healer",
    habitats: ["urban", "ruins", "grassland"],
    summary: "A healer on the wrong side: patches its friends; take it down first or the fight drags.",
    mind: "tactical",
    temperaments: ["supportive", "cautious", "fanatical"],
    classLine: ["mender", "cleric", "saint"],
    row: "back",
    abilities: [],
    carries: at(["barrier", 8], ["starfall", 12]),
    levels: [1, 30],
    tiers: LOW_TIERS,
    names: {
      high_fantasy: n("Camp Healer", "War Priest@11", "Mercy Abbess@21"),
      wuxia_xianxia: n("Herbalist Disciple", "Sect Physician@11", "Divine Physician@21"),
      modern_supernatural: n("Hedge Healer", "Order Chaplain@11"),
      modern_day: n("First Aider", "Paramedic@10", "Trauma Surgeon@20"),
      the_1920s: n("Back-Alley Doc", "Mob Doctor@9"),
      cyberpunk: n("Street Medic", "Chop Clinic Surgeon@11", "Black-Clinic Chief@21"),
      space_opera: n("Corpsman", "Combat Medic@11", "Fleet Surgeon@21"),
      post_apocalyptic: n("Patch-Up", "Hold Doctor@11", "Old Mother of the Hold@21"),
    },
  },
  {
    id: "captain",
    kind: "humanoid",
    role: "leader",
    habitats: ["urban", "ruins", "grassland", "mountain"],
    summary: "Whoever gives the orders: rallies and speeds its side; drop it and the rest waver.",
    mind: "tactical",
    temperaments: ["coordinated", "disciplined", "arrogant"],
    classLine: ["herald", "field-captain", "marshal"],
    row: "back",
    abilities: [],
    carries: at(["swift-refrain", 8], ["mark-prey", 12]),
    levels: [4, 30],
    tiers: BIG_TIERS,
    names: {
      high_fantasy: n("Banner Bearer", "War Drummer@11", "Field Marshal of the March@21"),
      wuxia_xianxia: n("Sect Herald", "Gong Master@11", "Alliance Leader@21"),
      modern_day: n("Crew Boss", "Syndicate Lieutenant@12", "Syndicate Head@22"),
      the_1920s: n("Mob Lieutenant", "Underboss@9", "Boss of the Ward@17"),
      cyberpunk: n("Gang Lieutenant", "Crew Boss@11", "Kingpin@21"),
      space_opera: n("Squad Leader", "Deck Officer@11", "Fleet Captain@21"),
      post_apocalyptic: n("Raider Herald", "Road Boss@11", "Warlord's Voice@21"),
    },
  },
  {
    id: "brawler",
    kind: "humanoid",
    role: "skirmisher",
    habitats: ["urban", "mountain", "grassland"],
    summary: "A martial artist: fast hands, acts often, hits where it hurts.",
    mind: "tactical",
    temperaments: ["honourable", "arrogant", "disciplined"],
    classLine: ["scout", "skirmisher", "harrier"],
    row: "front",
    abilities: [],
    carries: at(["power-strike", 1], ["flurry", 10]),
    levels: [1, 30],
    tiers: ALL_TIERS,
    names: {
      wuxia_xianxia: n("Outer Disciple", "Inner Disciple@11", "Sect Elder@21"),
      modern_day: n("Dojo Rival", "Tournament Champion@8", "Grandmaster@18", "Living Legend@26"),
      the_1920s: n("Prize Fighter", "Ring Champion@9"),
      modern_supernatural: n("Hunter Brawler", "Silver-Knuckle Hunter@11"),
      cyberpunk: n("Pit Boxer", "Wired Fighter@11", "Reflex Champion@21"),
    },
  },
  // ── Constructs and machines ──
  {
    id: "warder",
    kind: "construct",
    role: "tank",
    habitats: ["ruins", "underground"],
    summary: "A made guardian: armour like a wall, no mind to scare, falls to the right hammer or spell.",
    mind: "mindless",
    temperaments: ["territorial"],
    archetype: "guard",
    statScale: { hp: 1.2, strength: 1.0, speed: 0.6, skill: 0.8, defense: 0.9, resistance: 0.6, luck: 0.3 },
    attackType: "blunt",
    row: "front",
    affinities: { ...PLATE, poison: "immune" },
    abilities: at(["harden", 1], ["stagger", 10], ["self-repair", 14]),
    levels: [2, 30],
    tiers: ALL_TIERS,
    names: {
      high_fantasy: n("Clay Warder", "Bronze Warder@11", "Runeforged Colossus@21"),
      wuxia_xianxia: n("Wooden Sparring Man", "Bronze Arhat@11", "Jade Guardian Lion@21"),
      cyberpunk: n("Lobby Bulkbot", "Riot Mech@11", "Tower Sentinel@21"),
      space_opera: n("Service Frame", "War Frame@11", "Siege Walker@21"),
      post_apocalyptic: n("Scrap Golem", "Old-World Sentry@11", "War Machine Relic@21"),
    },
  },
  {
    id: "drone",
    kind: "machine",
    role: "shooter",
    habitats: ["urban", "ruins", "desert", "grassland"],
    summary: "A flying machine: stays back, shoots anyone, paints targets for the others.",
    mind: "mindless",
    temperaments: ["coordinated", "patient"],
    archetype: "marksman",
    statScale: { hp: 0.7, speed: 1.15, defense: 0.9, resistance: 0.5 },
    attackType: "pierce",
    rangedBasic: true,
    row: "back",
    affinities: MACHINE,
    abilities: at(["mark-target", 6], ["run-hot", 10], ["suppressing-fire", 14]),
    levels: [1, 30],
    tiers: ALL_TIERS,
    names: {
      cyberpunk: n("Gnatcam", "Hornet-Kite@11", "Halo Overseer@21"),
      space_opera: n("Picket Mote", "Cutter Drone@11", "Lattice Node@21"),
      post_apocalyptic: n("Junk Rotor", "Old-War Drone@11", "Sky-Warden Relic@21"),
      modern_day: n("Backyard Buzzer", "Watchlist Drone@8", "@17"),
    },
  },
  {
    id: "turret",
    kind: "machine",
    role: "shooter",
    habitats: ["urban", "ruins", "underground"],
    summary: "A fixed gun: never moves, never misses its arc, heavy aimed shots with a warning.",
    mind: "mindless",
    temperaments: ["territorial", "patient"],
    archetype: "marksman",
    statScale: { hp: 1.0, speed: 0.6, defense: 1.3, resistance: 0.6, luck: 0.3 },
    attackType: "pierce",
    rangedBasic: true,
    row: "back",
    affinities: { ...MACHINE, blunt: "weak" },
    abilities: at(["lock-on", 5], ["suppressing-fire", 9]),
    levels: [3, 30],
    tiers: LOW_TIERS,
    names: {
      cyberpunk: n("Doorframe Gun", "Tollgate Turret@11", "Citadel Gunwall@21"),
      space_opera: n("Hull Popgun", "Rail Picket@11", "Lance Battery@21"),
      post_apocalyptic: n("Scrap Turret", "Bunker Gun@11", "Fortress Battery@21"),
    },
  },
  // ── Treasure: the rare encounter worth a windfall (Alyssa, 11-01) ──
  // Tiny, slippery and quick to bolt: almost every blow glances off or misses, and it flees after a
  // few turns with all of it. Beaten, it pays many times a normal foe. Never in ordinary fights:
  // marinaraRollRareEncounter() puts one or a few in a random encounter now and then.
  {
    id: "glimmerling",
    kind: "spirit",
    role: "treasure",
    summary: "A rare, skittish thing that bolts within a few turns; beaten, it is worth a great deal of experience.",
    mind: "instinct",
    temperaments: ["cowardly"],
    archetype: "scout",
    statScale: { hp: 0.2, strength: 0.4, magic: 0.4, skill: 0.8, speed: 1.6, defense: 2.5, resistance: 2.5, luck: 3.5 },
    attackType: "blunt",
    row: "front",
    affinities: { poison: "immune" },
    abilities: [],
    levels: [1, 30],
    tiers: ["standard"],
    windfall: { xp: 12, gold: 1, fleeAfterRounds: 3 },
    damageScale: 0.25,
    names: {
      high_fantasy: n("Quicksilver Bead", "Quicksilver Puddle@11", "Quicksilver Pool@21"),
      wuxia_xianxia: n("Qi-Pearl Hopper", "Qi-Pearl Leaper@11", "Thousand-Year Qi Pearl@21"),
      modern_day: n("Sterling Squirrel", "Sterling Hare@11", "Sterling Stag@21"),
      modern_supernatural: n("Remembering Light", "Lore Moth@11", "Moth of Old Secrets@21"),
      the_1920s: n("Tip-Off Kid", "Wire Man's Runner@11", "Ledger Runner@21"),
      cyberpunk: n("Data Mite", "Cache Leech@11", "Zero-Day Ghost@21"),
      space_opera: n("Prism Mite", "Prism Skitter@11", "Prism Seraph@21"),
      post_apocalyptic: n("Glow Grub", "Glow Hopper@11", "Glow Matriarch@21"),
    },
  },
  {
    id: "hoardling",
    kind: "vermin",
    role: "treasure",
    summary: "A rare, hoarding thing that bolts within a few turns; beaten, it spills a fortune in coin.",
    mind: "instinct",
    temperaments: ["cowardly"],
    archetype: "scout",
    statScale: { hp: 0.2, strength: 0.4, magic: 0.3, skill: 0.8, speed: 1.5, defense: 2.2, resistance: 2.2, luck: 3 },
    attackType: "blunt",
    row: "front",
    affinities: { poison: "immune" },
    abilities: [],
    levels: [1, 30],
    tiers: ["standard"],
    windfall: { xp: 2, gold: 15, fleeAfterRounds: 3 },
    damageScale: 0.25,
    names: {
      high_fantasy: n("Gilt Gloop", "Gilded Ooze@11", "Crown-Gold Ooze@21"),
      wuxia_xianxia: n("Copper-Cash Toad", "Silver-Ingot Toad@11", "Golden Toad of Fortune@21"),
      modern_day: n("Coin-Hoarding Magpie", "Jackpot Magpie@11", "Kingpin's Magpie@21"),
      modern_supernatural: n("Wishing-Well Sprite", "Wishing-Well Warden@11", "Wishing-Well Sovereign@21"),
      the_1920s: n("Bagman", "Payroll Courier@11", "Bank Messenger@21"),
      cyberpunk: n("Cred-Chip Courier", "Black-Card Courier@11", "Vault Key Courier@21"),
      space_opera: n("Ore Tick", "Platinum Tick@11", "Iridium Tick@21"),
      post_apocalyptic: n("Scrap-Gold Beetle", "Brass Beetle@11", "Reactor-Gold Beetle@21"),
    },
  },
];

const FAMILY_BY_ID = new Map(MARINARA_BESTIARY.map((family) => [family.id, family]));

/** A family's natural attack type (a beast's bite or claws), when it names one. */
export function marinaraFamilyAttackType(familyId: string | undefined): MarinaraDamageType | undefined {
  return familyId ? FAMILY_BY_ID.get(familyId)?.attackType : undefined;
}
export function marinaraEnemyFamily(id: string): MarinaraEnemyFamily | undefined {
  return FAMILY_BY_ID.get(id);
}

/** The family's name for a setting at a level, or null where it doesn't live or its bands don't reach. */
export function marinaraEnemyName(
  family: MarinaraEnemyFamily,
  setting: MarinaraBestiarySetting,
  level: number,
): string | null {
  const bands = family.names[setting];
  if (!bands?.length || level < family.levels[0] || level > family.levels[1]) return null;
  let found: MarinaraEnemyName | null = null;
  for (const band of bands) if (band.from <= level) found = band;
  return found?.name || null;
}

/**
 * A boss's name: the family's next, grander band in the setting (a boss Footpad is a Roadknife),
 * or its own band's name when it is already at the top.
 */
export function marinaraEnemyBossName(
  family: MarinaraEnemyFamily,
  setting: MarinaraBestiarySetting,
  level: number,
): string | null {
  const own = marinaraEnemyName(family, setting, level);
  if (!own) return null;
  const bands = family.names[setting] ?? [];
  const next = bands.find((band) => band.from > level);
  return next?.name || own;
}

/**
 * The highest level a setting's names reach for a family: its top level, or the level before a
 * closing band (a modern-day Wild Boar stops at 10 rather than growing into a level 28 monster).
 */
export function marinaraEnemySettingCap(family: MarinaraEnemyFamily, setting: MarinaraBestiarySetting): number {
  const bands = family.names[setting];
  if (!bands?.length) return 0;
  const last = bands[bands.length - 1]!;
  return last.name ? family.levels[1] : Math.min(family.levels[1], last.from - 1);
}

/** The families a setting may use at a level. */
export function marinaraBestiaryFor(setting: MarinaraBestiarySetting, level: number): MarinaraEnemyFamily[] {
  return MARINARA_BESTIARY.filter(
    (family) =>
      family.role !== "treasure" &&
      marinaraEnemyName(family, setting, level) !== null &&
      level <= marinaraEnemySettingCap(family, setting),
  );
}

/** A humanoid family's class at a level: base, advanced once past the first promotion, master past the second. */
export function marinaraEnemyClassAt(family: MarinaraEnemyFamily, level: number): string | undefined {
  if (!family.classLine) return undefined;
  const [base, advanced, master] = family.classLine;
  return level > MARINARA_PROMOTION_LEVEL.master ? master : level > MARINARA_PROMOTION_LEVEL.advanced ? advanced : base;
}

/** The abilities a foe of this family, tier and level has. */
export function marinaraEnemyAbilities(family: MarinaraEnemyFamily, tier: MarinaraEnemyTier, level: number): string[] {
  return family.abilities
    .filter((each) => each.from <= level && marinaraAbilityAllowed(each.id, tier, level))
    .map((each) => each.id);
}

// ── Building a foe ──

/**
 * The combat AI's hints for a bestiary foe: its family's mind, and one of its family's temperaments
 * drawn with `random`, kept for the fight (Engine review 2026-11-06: the director drew its own, so a
 * sellsword could come out cowardly and run at full HP). `kept` makes the director use exactly it.
 */
export function marinaraFoeAiHints(
  familyId: string,
  random: () => number,
): { mind: CombatMind; temperament: CombatTemperament; kept: true } | undefined {
  const family = FAMILY_BY_ID.get(familyId);
  if (!family?.temperaments.length) return undefined;
  const temperament = family.temperaments[Math.floor(random() * family.temperaments.length)]!;
  return { mind: family.mind, temperament, kept: true };
}

/** Abilities that open cold start on a cooldown that clears after the foe's first turn. */
function openingCooldowns(ids: readonly string[]): { openingCooldowns?: Record<string, number> } {
  const cold = ids.filter((id) => ABILITY_BY_ID.get(id)?.opensCold);
  return cold.length ? { openingCooldowns: Object.fromEntries(cold.map((id) => [`enemy:${id}`, 2])) } : {};
}

/** A bestiary foe: what the Engine's `buildMarinaraEnemy` takes, plus its family and the combat AI's hints. */
export type MarinaraBestiaryFoeSpec = MarinaraEnemySpec & {
  familyId: string;
  mind?: CombatMind;
  temperament?: CombatTemperament;
  /** A treasure foe's windfall (MarinaraEnemyFamily.windfall): what beating it pays, and when it flees. */
  windfall?: { xp: number; gold: number; fleeAfterRounds: number };
  /** Everything it deals is scaled by this (a treasure foe's feeble blows); 1 when absent. */
  damageScale?: number;
};

function combinedScale(a: Partial<MarinaraStats> | undefined, b: Partial<MarinaraStats>): Partial<MarinaraStats> {
  const out: Partial<MarinaraStats> = { ...(a ?? {}) };
  for (const [stat, value] of Object.entries(b) as Array<[MarinaraStat, number]>)
    out[stat] = Math.round((out[stat] ?? 1) * value * 1000) / 1000;
  return out;
}

/** A foe of a family, ready for the Engine to build. Throws where the family can't be used so. */
export function marinaraEnemySpec(input: {
  familyId: string;
  setting: MarinaraBestiarySetting;
  level: number;
  tier: MarinaraEnemyTier;
  id: string;
  temperament?: CombatTemperament;
  /** A name the story gives it (a boss's own name); the family's band name otherwise. */
  name?: string;
}): MarinaraBestiaryFoeSpec {
  const family = FAMILY_BY_ID.get(input.familyId);
  if (!family) throw new Error(`Unknown enemy family ${input.familyId}.`);
  const level = Math.max(1, Math.min(MARINARA_LEVEL_CAP, Math.round(input.level)));
  const bandName = marinaraEnemyName(family, input.setting, level);
  if (!bandName) throw new Error(`${family.id} does not appear in ${input.setting} at level ${level}.`);
  if (!family.tiers.includes(input.tier)) throw new Error(`${family.id} has no ${input.tier} tier.`);
  if (level < MARINARA_TIER_RULES[input.tier].minLevel)
    throw new Error(`A ${input.tier} needs level ${MARINARA_TIER_RULES[input.tier].minLevel} or more.`);
  const temperament =
    input.temperament && family.temperaments.includes(input.temperament) ? input.temperament : family.temperaments[0];
  const classId = marinaraEnemyClassAt(family, level);
  return {
    id: input.id,
    name:
      input.name?.trim() || (input.tier === "boss" ? marinaraEnemyBossName(family, input.setting, level)! : bandName),
    familyId: family.id,
    ...(classId ? { classId } : { archetype: family.archetype }),
    // A treasure foe skips the level growth that keeps fighting foes level with the party: how hard
    // it is to catch was tuned flat across levels.
    statScale:
      family.role === "treasure"
        ? { ...family.statScale }
        : combinedScale(family.statScale, marinaraFoeLevelScale(level)),
    level,
    tier: input.tier,
    row: family.row,
    ...(family.affinities ? { affinities: family.affinities } : {}),
    ...(family.attackType ? { attackType: family.attackType } : {}),
    ...(family.rangedBasic ? { ranged: true } : {}),
    enemySkills: marinaraEnemyAbilities(family, input.tier, level),
    ...openingCooldowns(marinaraEnemyAbilities(family, input.tier, level)),
    ...(classId && family.carries?.length
      ? { carriedSkills: family.carries.filter((each) => each.from <= level).map((each) => each.id) }
      : {}),
    mind: family.mind,
    ...(temperament ? { temperament } : {}),
    ...(family.windfall ? { windfall: family.windfall } : {}),
    ...(family.damageScale !== undefined ? { damageScale: family.damageScale } : {}),
  };
}

// ── Threat and encounter budgets ──

/**
 * Difficulty as a share of the party's size in threat (a party of four's Normal budget is 4): the
 * party should win Easy and Normal fights all but always, Hard ones nearly always with someone
 * downed now and then, and Deadly ones only with luck and good play. Measured in the bestiary lab on
 * encounters the builder makes.
 */
export const MARINARA_ENCOUNTER_BUDGET = {
  easy: 0.7,
  normal: 1,
  hard: 1.15,
  deadly: 1.6,
} as const;
export type MarinaraEncounterDifficulty = keyof typeof MARINARA_ENCOUNTER_BUDGET;

/** What a treasure foe counts for in a budget: next to nothing, it barely fights back. */
export const MARINARA_TREASURE_THREAT = 0.1;

/** A foe's worth changes this much per level it stands above (or below) the party. */
export const MARINARA_LEVEL_GAP_THREAT = 1.12;

/** A boss counts for this much more than its measured worth: one foe carrying the whole fight swings
 *  more from fight to fight (a lucky crit, a missed heal), and boss-led fights won less often than
 *  others at the same rating (playtest: Hard with a boss 65-72% wins at 1.15). */
export const MARINARA_BOSS_THREAT_PREMIUM = 1.3;

/** The threat table is measured on groups of one family; mixed fights the builder makes play harder
 *  than the sum of those worths. Every worth is scaled by this, fitted in the bestiary lab's verify run
 *  (scripts/class-lab/bestiary-verify.ts) so mixed fights hit their difficulty's marks. Re-fit when the
 *  table is re-measured. */
export const MARINARA_THREAT_CALIBRATION = 1.2;
/** How far a foe's level may stray from the party's: never more than 3 above (a boss 5), and foes
 *  more than 8 below aren't worth a fight. */
// A boss stands no more than 3 levels under the party (Sonnet panel r3, 2026-11-02: a level 13 boss
// against a level 20 party died in a few rounds; past that it is no boss, so it comes as an elite).
export const MARINARA_LEVEL_GAP = { above: 3, bossAbove: 5, below: 8, bossBelow: 3 } as const;

/** A Brutal game breaks the level cap (Alyssa, 11-01): foes may stand this far above the party, and
 *  the builder lifts them up to `lift` levels on its own. Their worth still grows 1.12x a level, so
 *  the budget holds; the fight just has fewer, stronger foes. */
export const MARINARA_LEVEL_GAP_BRUTAL = { above: 6, bossAbove: 8, below: 8, bossBelow: 3, lift: 3 } as const;

/** The level gap rules for a party (Brutal games get the wider ones). */
export function marinaraLevelGap(party: MarinaraEncounterParty): {
  above: number;
  bossAbove: number;
  below: number;
  bossBelow: number;
} {
  return party.brutal ? MARINARA_LEVEL_GAP_BRUTAL : MARINARA_LEVEL_GAP;
}
/** A Classic battle has room for six foes. */
export const MARINARA_MAX_FOES = 6;

/** Roles whose effects stack across copies (a leader's war cry, a healer's mending): one per fight, so
 *  two captains don't double every foe's damage. Measured: stacked captains were the fights that went
 *  furthest past their rating. */
export const MARINARA_ROLE_CAP: Partial<Record<MarinaraEnemyRole, number>> = { leader: 1, healer: 1 };

/** Guard-tree foes taunt: one per fight, so two can't trade Provoke and keep the party locked on a wall
 *  every turn while the foes behind it work (taunt probe 2026-11-03: 2 shieldbearers, a shooter and a
 *  captain won 1 of 15 at L30 Hard). */
export const MARINARA_TAUNTER_CAP = 1;
function capGroup(family: MarinaraEnemyFamily): { group: string; cap: number } | null {
  const roleCap = MARINARA_ROLE_CAP[family.role];
  if (roleCap !== undefined) return { group: family.role, cap: roleCap };
  if (family.classLine?.[0] === "guard") return { group: "taunter", cap: MARINARA_TAUNTER_CAP };
  return null;
}
/**
 * Regenerating foes: room for two a fight, and a regenerating boss takes both (playtest r47, reasons
 * log on: after the 35-a-turn cap, boss fights with several regenerating escorts still ran 28 rounds
 * in Tactical against 12, and the stalls were a 1,500-2,000 HP boss with 2-6 regenerators healing
 * 600-1,000 HP between them).
 */
export const MARINARA_REGENERATOR_CAP = 2;
const REGEN_ABILITIES = new Set(["regenerate", "self-repair"]);
/** How much of the regenerator room a foe takes: 0 if it can't regenerate at its level. */
function regenWeight(foe: MarinaraEncounterFoe): number {
  const family = FAMILY_BY_ID.get(foe.familyId);
  const regenerates = family?.abilities.some((one) => REGEN_ABILITIES.has(one.id) && one.from <= foe.level);
  return regenerates ? (foe.tier === "boss" ? MARINARA_REGENERATOR_CAP : 1) : 0;
}
function regenRoomFor(foes: readonly MarinaraEncounterFoe[], foe: MarinaraEncounterFoe): boolean {
  const weight = regenWeight(foe);
  return !weight || foes.reduce((sum, one) => sum + regenWeight(one), 0) + weight <= MARINARA_REGENERATOR_CAP;
}
function groupCount(foes: readonly MarinaraEncounterFoe[], group: string): number {
  return foes.filter((foe) => {
    const family = FAMILY_BY_ID.get(foe.familyId);
    return family ? capGroup(family)?.group === group : false;
  }).length;
}

function interpolate(levels: Record<number, number>, level: number): number | null {
  const points = Object.entries(levels)
    .map(([at, value]) => [Number(at), value] as const)
    .sort((a, b) => a[0] - b[0]);
  if (!points.length) return null;
  if (level <= points[0]![0]) return points[0]![1];
  if (level >= points[points.length - 1]![0]) return points[points.length - 1]![1];
  for (let i = 1; i < points.length; i++) {
    const [x1, y1] = points[i]!;
    const [x0, y0] = points[i - 1]!;
    if (level <= x1) return y0 + ((y1 - y0) * (level - x0)) / (x1 - x0);
  }
  return null;
}

/**
 * What one foe is worth against a party of `partyLevel`, in party members: its family's measured
 * worth for its tier at its own level, times the level-gap factor. Families measured in no sample
 * for that tier fall back to their standard worth times the tier's rule.
 */
/**
 * Families worth more in a mixed fight than alone: a Guard-tree foe's Challenge, Provoke and Sworn Ward
 * pin the party on it while the foes behind it work, and a captain's orders lift its whole side. The
 * single-family measure misses that (verify 2026-11-03: Hard fights with shieldbearers won 80% against
 * 91% overall, one Hard fight of two shieldbearers, a shooter and a captain 0%).
 */
export const MARINARA_ESCORT_PREMIUM: Partial<Record<string, number>> = {
  shieldbearer: 1.35,
  "grave-duelist": 1.35,
  captain: 1.2,
};

/**
 * Shooters behind a taunter are worth more: the taunt holds the party's single-target attacks on the
 * wall while the shooters fire freely, and a Farshot's Return Fire answers every forced hit (taunt probe
 * 2026-11-03: a shieldbearer, a shooter and a captain at L30 won 35% of Hard fights).
 */
export const MARINARA_COVER_PREMIUM = 1.4;

/**
 * Pack hunters that leap the line are worth more from level 12: their Pounces stack on one back-row
 * target, which the single-family measure against a set party underrates (playtest b57, reasons log
 * on, L12-30 beast-led fights: hounds won 50 of 61 Classic and stalkers 11 of 17, against 100% for
 * standard fights on Normal).
 */
export const MARINARA_PACK_PREMIUM: { from: number; families: Partial<Record<string, number>> } = {
  from: 12,
  families: { hound: 1.2, stalker: 1.25 },
};

/** What a group of foes is worth together: each foe's worth, with shooters behind a taunter at a premium. */
export function marinaraEncounterThreat(foes: readonly MarinaraEncounterFoe[], partyLevel: number): number {
  const covered = foes.some((foe) => {
    const family = FAMILY_BY_ID.get(foe.familyId);
    return family ? capGroup(family)?.group === "taunter" : false;
  });
  return foes.reduce((sum, foe) => {
    const worth = marinaraFoeThreat(foe.familyId, foe.tier, foe.level, partyLevel);
    const shooter = covered && FAMILY_BY_ID.get(foe.familyId)?.role === "shooter";
    return sum + worth * (shooter ? MARINARA_COVER_PREMIUM : 1);
  }, 0);
}

export function marinaraFoeThreat(
  familyId: string,
  tier: MarinaraEnemyTier,
  level: number,
  partyLevel: number,
): number {
  if (FAMILY_BY_ID.get(familyId)?.role === "treasure") return MARINARA_TREASURE_THREAT;
  const measured = MARINARA_BESTIARY_THREAT[familyId];
  let worth = measured?.[tier] ? interpolate(measured[tier]!, level) : null;
  if (worth === null) {
    const standard = measured?.standard ? interpolate(measured.standard, level) : null;
    worth = (standard ?? 1) * MARINARA_TIER_RULES[tier].threat;
  }
  worth *= MARINARA_THREAT_CALIBRATION * (MARINARA_ESCORT_PREMIUM[familyId] ?? 1);
  if (level >= MARINARA_PACK_PREMIUM.from) worth *= MARINARA_PACK_PREMIUM.families[familyId] ?? 1;
  if (tier === "boss") worth *= MARINARA_BOSS_THREAT_PREMIUM;
  return worth * Math.pow(MARINARA_LEVEL_GAP_THREAT, level - partyLevel);
}

export interface MarinaraEncounterParty {
  /** The party's level: the average of its fighters' levels. */
  level: number;
  /** How many can fight. */
  size: number;
  /** The game is on Brutal: foes may break the usual level cap (MARINARA_LEVEL_GAP_BRUTAL). */
  brutal?: boolean;
}

export interface MarinaraEncounterFoe {
  familyId: string;
  tier: MarinaraEnemyTier;
  level: number;
}

/** The difficulty a total threat makes for this party: the highest band it reaches, or "beyond" over Deadly. */
export function marinaraEncounterRating(
  threat: number,
  party: MarinaraEncounterParty,
): MarinaraEncounterDifficulty | "trivial" | "beyond" {
  const share = threat / Math.max(1, party.size);
  if (share > MARINARA_ENCOUNTER_BUDGET.deadly * 1.05) return "beyond";
  if (share > (MARINARA_ENCOUNTER_BUDGET.hard + MARINARA_ENCOUNTER_BUDGET.deadly) / 2) return "deadly";
  if (share > (MARINARA_ENCOUNTER_BUDGET.normal + MARINARA_ENCOUNTER_BUDGET.hard) / 2) return "hard";
  if (share > (MARINARA_ENCOUNTER_BUDGET.easy + MARINARA_ENCOUNTER_BUDGET.normal) / 2) return "normal";
  if (share > MARINARA_ENCOUNTER_BUDGET.easy / 2) return "easy";
  return "trivial";
}

export interface MarinaraEncounterCheck {
  threat: number;
  rating: ReturnType<typeof marinaraEncounterRating>;
  /** Why the fight can't be run as built; empty when it can. */
  problems: string[];
}

/**
 * Checks a fight against the party, strictly (Alyssa 2026-10-30): every foe a family of the setting
 * at a level it lives at, tiers at their minimum levels and counts, levels near the party's, at most
 * six foes with someone in front, and the total within Deadly. `allowed` caps the difficulty the GM
 * asked for; a fight over it is refused, not quietly run harder.
 */
export function marinaraCheckEncounter(input: {
  setting: MarinaraBestiarySetting | null;
  party: MarinaraEncounterParty;
  foes: readonly MarinaraEncounterFoe[];
  allowed?: MarinaraEncounterDifficulty;
}): MarinaraEncounterCheck {
  const problems: string[] = [];
  const { party, foes } = input;
  if (!foes.length) problems.push("No foes.");
  if (foes.length > MARINARA_MAX_FOES)
    problems.push(`${foes.length} foes; a battle has room for ${MARINARA_MAX_FOES}.`);
  const perTier: Partial<Record<MarinaraEnemyTier, number>> = {};
  let threat = 0;
  let front = 0;
  for (const foe of foes) {
    const family = FAMILY_BY_ID.get(foe.familyId);
    if (!family) {
      problems.push(`Unknown family ${foe.familyId}.`);
      continue;
    }
    const label = `${family.id} (${foe.tier}, level ${foe.level})`;
    perTier[foe.tier] = (perTier[foe.tier] ?? 0) + 1;
    if (family.row === "front") front++;
    if (!family.tiers.includes(foe.tier)) problems.push(`${label}: the family has no ${foe.tier} tier.`);
    if (foe.level < MARINARA_TIER_RULES[foe.tier].minLevel)
      problems.push(`${label}: a ${foe.tier} needs level ${MARINARA_TIER_RULES[foe.tier].minLevel} or more.`);
    if (foe.level < family.levels[0] || foe.level > family.levels[1])
      problems.push(`${label}: the family lives at levels ${family.levels[0]}–${family.levels[1]}.`);
    if (input.setting) {
      const named = marinaraEnemyName(family, input.setting, foe.level);
      if (!named || foe.level > marinaraEnemySettingCap(family, input.setting))
        problems.push(`${label}: not found in ${input.setting} at that level.`);
    }
    const gap = marinaraLevelGap(party);
    const above = foe.tier === "boss" ? gap.bossAbove : gap.above;
    if (foe.level > party.level + above) problems.push(`${label}: more than ${above} levels above the party.`);
    if (foe.level < party.level - gap.below)
      problems.push(`${label}: more than ${gap.below} levels below the party; not worth a fight.`);
    else if (foe.tier === "boss" && foe.level < party.level - gap.bossBelow)
      problems.push(`${label}: a boss more than ${gap.bossBelow} levels below the party; make it an elite.`);
  }
  threat = marinaraEncounterThreat(foes, party.level);
  for (const tier of MARINARA_ENEMY_TIERS_LIST)
    if ((perTier[tier] ?? 0) > MARINARA_TIER_RULES[tier].maxPerFight)
      problems.push(`${perTier[tier]} ${tier} foes; at most ${MARINARA_TIER_RULES[tier].maxPerFight}.`);
  for (const [group, cap] of [...Object.entries(MARINARA_ROLE_CAP), ["taunter", MARINARA_TAUNTER_CAP] as const]) {
    const count = groupCount(foes, group);
    if (count > cap!) problems.push(`${count} ${group} foes; at most ${cap}.`);
  }
  const regen = foes.reduce((sum, foe) => sum + regenWeight(foe), 0);
  if (regen > MARINARA_REGENERATOR_CAP)
    problems.push(
      `Too many regenerating foes; at most ${MARINARA_REGENERATOR_CAP}, and a regenerating boss counts as both.`,
    );
  if (foes.length && front === 0) problems.push("Nobody in the front row.");
  const rating = marinaraEncounterRating(threat, party);
  if (rating === "beyond") problems.push(`Threat ${threat.toFixed(1)} is beyond Deadly for this party.`);
  else if (input.allowed) {
    const order = ["trivial", "easy", "normal", "hard", "deadly"] as const;
    if (order.indexOf(rating) > order.indexOf(input.allowed))
      problems.push(`Threat ${threat.toFixed(1)} rates ${rating}; ${input.allowed} was asked for.`);
  }
  return { threat, rating, problems };
}

/** Which families keep company: a fight mixes families of one group. */
const KIND_GROUPS: Record<MarinaraEnemyKind, string> = {
  beast: "wild",
  vermin: "wild",
  plant: "wild",
  ooze: "wild",
  dragon: "wild",
  giant: "wild",
  undead: "dead",
  spirit: "dead",
  fiend: "dead",
  elemental: "elemental",
  humanoid: "people",
  construct: "people",
  machine: "people",
};

/**
 * Builds a fight for a party: a lead family the setting has at the party's level, up to two more of
 * the same company, tiers and counts filled to between 85% and 100% of the difficulty's budget, at
 * least one foe in front. `boss` puts one boss at the head (party level 5 and up). Deterministic for a
 * seed. Returns the foes with their threat; empty when the setting has nothing at that level.
 */
export function marinaraBuildEncounter(input: {
  setting: MarinaraBestiarySetting;
  party: MarinaraEncounterParty;
  difficulty: MarinaraEncounterDifficulty;
  random: () => number;
  boss?: boolean;
  /** Families the story wants (a cult's hideout, a wolf pack); the others are picked at random. */
  families?: readonly string[];
  /** The only families the fight may draw on (a place's spawn table); every family of the setting when absent. */
  pool?: readonly string[];
}): { foes: MarinaraEncounterFoe[]; threat: number } {
  const { party, random } = input;
  const level = Math.max(1, Math.min(MARINARA_LEVEL_CAP, Math.round(party.level)));
  const budget = MARINARA_ENCOUNTER_BUDGET[input.difficulty] * party.size;
  const pool = marinaraBestiaryFor(input.setting, level).filter(
    (family) => !input.pool || input.pool.includes(family.id),
  );
  if (!pool.length) return { foes: [], threat: 0 };
  // A Brutal game lifts the whole fight a few levels above the party, where each family's names reach.
  const lift = party.brutal ? Math.floor(random() * (MARINARA_LEVEL_GAP_BRUTAL.lift + 1)) : 0;
  const foeLevel = (family: MarinaraEnemyFamily) =>
    Math.max(
      level,
      Math.min(level + lift, MARINARA_LEVEL_CAP, family.levels[1], marinaraEnemySettingCap(family, input.setting)),
    );
  const pick = <T>(list: readonly T[]): T => list[Math.floor(random() * list.length)]!;
  const wanted = (input.families ?? [])
    .map((id) => pool.find((family) => family.id === id))
    .filter(Boolean) as MarinaraEnemyFamily[];
  const lead =
    wanted[0] ??
    pick(
      input.boss
        ? pool.filter((family) => family.tiers.includes("boss"))
        : pool.filter((family) => family.role !== "healer"),
    );
  if (!lead) return { foes: [], threat: 0 };
  const company = pool.filter(
    (family) => family !== lead && KIND_GROUPS[family.kind] === KIND_GROUPS[lead.kind] && !wanted.includes(family),
  );
  const families = [lead, ...wanted.slice(1)];
  // A lead that comes one to a fight (a leader, a healer, a taunter) brings a family that can fill it out.
  const regenLead = regenWeight({ familyId: lead.id, tier: "standard", level }) > 0;
  if (families.length === 1 && (capGroup(lead) || regenLead)) {
    const filler = company.filter(
      (family) => !capGroup(family) && !regenWeight({ familyId: family.id, tier: "standard", level }),
    );
    if (filler.length) {
      const next = filler[Math.floor(random() * filler.length)]!;
      company.splice(company.indexOf(next), 1);
      families.push(next);
    }
  }
  while (families.length < 3 && company.length && random() < 0.6) {
    const next = company.splice(Math.floor(random() * company.length), 1)[0]!;
    families.push(next);
  }
  const foes: MarinaraEncounterFoe[] = [];
  let threat = 0;
  const worth = (foe: MarinaraEncounterFoe) => marinaraFoeThreat(foe.familyId, foe.tier, foe.level, level);
  const add = (foe: MarinaraEncounterFoe) => {
    foes.push(foe);
    threat = marinaraEncounterThreat(foes, level);
  };
  const cost = (foe: MarinaraEncounterFoe) => marinaraEncounterThreat([...foes, foe], level) - threat;
  if (input.boss && level >= MARINARA_TIER_RULES.boss.minLevel && lead.tiers.includes("boss")) {
    // A boss asked for (playtest 2026-11-01: dropped when over budget, it came in 3 of 60 Normal fights
    // for a party of 4) comes a level or two lower when that fits, else as an elite of its family to
    // lead the fight; a lone boss rates Deadly for 4 by the bestiary's measure.
    const boss = { familyId: lead.id, tier: "boss" as const, level: foeLevel(lead) };
    const lowest = Math.max(
      lead.levels[0],
      MARINARA_TIER_RULES.boss.minLevel,
      level - marinaraLevelGap(input.party).bossBelow,
    );
    while (worth(boss) > budget && boss.level > lowest) boss.level--;
    const elite = { familyId: lead.id, tier: "elite" as const, level: foeLevel(lead) };
    if (worth(boss) <= budget) add(boss);
    else if (lead.tiers.includes("elite") && worth(elite) <= budget) add(elite);
  }
  // Someone stands in front: unless the boss does, one front-row foe (from a chosen family, else the
  // same company, else any front-row family) is placed before the fill, at the cheapest tier that fits;
  // a back-row boss that leaves no room for one is dropped first.
  const isFront = (family: MarinaraEnemyFamily) => family.row === "front";
  if (!foes.some((foe) => isFront(FAMILY_BY_ID.get(foe.familyId)!))) {
    const chosenFronts = families.filter(isFront);
    const fronts = pool.filter((family) => isFront(family) && KIND_GROUPS[family.kind] === KIND_GROUPS[lead.kind]);
    const stand = chosenFronts.length ? pick(chosenFronts) : fronts.length ? pick(fronts) : pool.find(isFront);
    if (stand && !families.includes(stand)) families.push(stand);
    if (stand) {
      const tiers = (["standard", "minion", "elite"] as const).filter(
        (tier) => stand.tiers.includes(tier) && level >= MARINARA_TIER_RULES[tier].minLevel,
      );
      const fits = () =>
        tiers.find((tier) => {
          const foe = { familyId: stand.id, tier, level: foeLevel(stand) };
          return regenRoomFor(foes, foe) && cost(foe) <= budget - threat;
        });
      if (!fits() && foes.length) {
        foes.pop();
        threat = marinaraEncounterThreat(foes, level);
      }
      const tier = fits();
      if (tier) add({ familyId: stand.id, tier, level: foeLevel(stand) });
    }
  }
  // Fill: try foes from the chosen families at a tier that fits what's left, until nothing fits.
  const tierCount = (tier: MarinaraEnemyTier) => foes.filter((foe) => foe.tier === tier).length;
  const roleFull = (family: MarinaraEnemyFamily) => {
    const capped = capGroup(family);
    return !!capped && groupCount(foes, capped.group) >= capped.cap;
  };
  for (let guard = 0; guard < 40 && foes.length < MARINARA_MAX_FOES; guard++) {
    const left = budget - threat;
    const options: MarinaraEncounterFoe[] = [];
    for (const family of families)
      for (const tier of family.tiers) {
        if (tier === "boss" || level < MARINARA_TIER_RULES[tier].minLevel) continue;
        if (tierCount(tier) >= MARINARA_TIER_RULES[tier].maxPerFight) continue;
        if (roleFull(family)) continue;
        const foe = { familyId: family.id, tier, level: foeLevel(family) };
        if (regenRoomFor(foes, foe) && cost(foe) <= left) options.push(foe);
      }
    if (!options.length) break;
    // Prefer standard foes, an elite now and then, minions to fill the last of the budget.
    const weights = options.map((foe) => (foe.tier === "standard" ? 3 : foe.tier === "elite" ? 1.2 : 1));
    let roll = random() * weights.reduce((sum, w) => sum + w, 0);
    let chosen = options[0]!;
    for (let i = 0; i < options.length; i++) {
      roll -= weights[i]!;
      if (roll <= 0) {
        chosen = options[i]!;
        break;
      }
    }
    add(chosen);
    if (threat >= budget * 0.85 && random() < 0.5) break;
  }
  return { foes, threat };
}

/** How often a random encounter is a rare treasure encounter instead (JRPG-style rare spawn). */
export const MARINARA_RARE_ENCOUNTER_CHANCE = 1 / 32;

/** The treasure families a setting has at a level. */
export function marinaraTreasureFor(setting: MarinaraBestiarySetting, level: number): MarinaraEnemyFamily[] {
  return MARINARA_BESTIARY.filter(
    (family) => family.role === "treasure" && marinaraEnemyName(family, setting, level) !== null,
  );
}

/**
 * Rolls whether a random encounter (never a story fight) is a rare treasure encounter: one to three
 * treasure foes of one family, at the party's level. Null on most rolls. The caller decides which
 * fights count as random encounters; the GM may also ask for one when the story finds one.
 */
export function marinaraRollRareEncounter(input: {
  setting: MarinaraBestiarySetting;
  party: MarinaraEncounterParty;
  random: () => number;
  /** Skip the chance roll: the story has already put one here. */
  force?: boolean;
}): MarinaraEncounterFoe[] | null {
  if (!input.force && input.random() >= MARINARA_RARE_ENCOUNTER_CHANCE) return null;
  const level = Math.max(1, Math.min(MARINARA_LEVEL_CAP, Math.round(input.party.level)));
  const pool = marinaraTreasureFor(input.setting, level);
  if (!pool.length) return null;
  const family = pool[Math.floor(input.random() * pool.length)]!;
  const count = 1 + Math.floor(input.random() * 3);
  return Array.from({ length: count }, () => ({ familyId: family.id, tier: "standard" as const, level }));
}

/** What the GM's fight setup sees: the families the setting has at the party's level, with their
 *  names there and what they do, so it picks designed foes instead of inventing them. */
export function marinaraBestiaryMenu(
  setting: MarinaraBestiarySetting,
  partyLevel: number,
): Array<{
  familyId: string;
  name: string;
  kind: MarinaraEnemyKind;
  role: MarinaraEnemyRole;
  tiers: MarinaraEnemyTier[];
  summary: string;
}> {
  const level = Math.max(1, Math.min(MARINARA_LEVEL_CAP, Math.round(partyLevel)));
  return marinaraBestiaryFor(setting, level).map((family) => ({
    familyId: family.id,
    name: marinaraEnemyName(family, setting, level)!,
    kind: family.kind,
    role: family.role,
    tiers: family.tiers.filter((tier) => level >= MARINARA_TIER_RULES[tier].minLevel),
    summary: family.summary,
  }));
}

const DEMOTE: Record<MarinaraEnemyTier, MarinaraEnemyTier | null> = {
  boss: "elite",
  elite: "standard",
  standard: "minion",
  minion: null,
};

/**
 * Makes the fight the GM asked for fit the rules and the difficulty, changing as little as it can:
 * unknown families and ones the setting lacks are dropped, levels pulled into range, tiers the
 * family lacks or the level doesn't allow lowered, extra foes past the room and tier caps dropped,
 * then, while it rates over `difficulty`, the foe worth most is lowered a tier (or a minion
 * dropped). Every change is listed so the GM can tell the story it makes.
 */
export function marinaraFitEncounter(input: {
  setting: MarinaraBestiarySetting;
  party: MarinaraEncounterParty;
  foes: readonly MarinaraEncounterFoe[];
  difficulty: MarinaraEncounterDifficulty;
  /** Foes from a place's own spawn table (a dungeon, a region): their levels are the place's, fixed when
   *  the world was made, and never pulled toward the party's or lowered a tier. The fight's caps still
   *  hold, and over its budget it shrinks (the boss's escort drops, costliest first); the last foe and a
   *  boss always stay, so a place above the party stays dangerous. */
  fixedLevels?: boolean;
}): { foes: MarinaraEncounterFoe[]; threat: number; changes: string[] } {
  const { setting, party } = input;
  const level = Math.max(1, Math.min(MARINARA_LEVEL_CAP, Math.round(party.level)));
  const changes: string[] = [];
  const foes: MarinaraEncounterFoe[] = [];
  const perTier: Partial<Record<MarinaraEnemyTier, number>> = {};
  for (const asked of input.foes) {
    const family = FAMILY_BY_ID.get(asked.familyId);
    if (!family) {
      changes.push(`Dropped ${asked.familyId}: no such family.`);
      continue;
    }
    const gap = marinaraLevelGap(party);
    const above = asked.tier === "boss" ? gap.bossAbove : gap.above;
    const below = asked.tier === "boss" ? gap.bossBelow : gap.below;
    let foeLevel = input.fixedLevels
      ? Math.max(
          1,
          Math.min(MARINARA_LEVEL_CAP + (party.brutal ? MARINARA_LEVEL_GAP_BRUTAL.lift : 0), Math.round(asked.level)),
        )
      : Math.max(level - below, Math.min(level + above, Math.round(asked.level)));
    foeLevel = Math.max(family.levels[0], Math.min(marinaraEnemySettingCap(family, setting), foeLevel));
    if (!marinaraEnemyName(family, setting, foeLevel)) {
      changes.push(`Dropped ${family.id}: not found in ${setting} near level ${level}.`);
      continue;
    }
    if (foeLevel !== asked.level) changes.push(`${family.id}: level ${asked.level} → ${foeLevel}.`);
    let tier: MarinaraEnemyTier | null = asked.tier;
    while (
      tier &&
      (!family.tiers.includes(tier) ||
        foeLevel < MARINARA_TIER_RULES[tier].minLevel ||
        (tier === "boss" && !input.fixedLevels && foeLevel < level - gap.bossBelow) ||
        (perTier[tier] ?? 0) >= MARINARA_TIER_RULES[tier].maxPerFight)
    )
      tier = DEMOTE[tier];
    if (!tier) {
      changes.push(`Dropped ${family.id} (${asked.tier}): no tier it can take here.`);
      continue;
    }
    if (tier !== asked.tier) changes.push(`${family.id}: ${asked.tier} → ${tier}.`);
    const capped = capGroup(family);
    if (capped && groupCount(foes, capped.group) >= capped.cap) {
      changes.push(`Dropped ${family.id}: at most ${capped.cap} ${capped.group} in a fight.`);
      continue;
    }
    if (foes.length >= MARINARA_MAX_FOES) {
      changes.push(`Dropped ${family.id}: a battle has room for ${MARINARA_MAX_FOES}.`);
      continue;
    }
    if (!regenRoomFor(foes, { familyId: family.id, tier, level: foeLevel })) {
      changes.push(`Dropped ${family.id}: too many regenerating foes in one fight.`);
      continue;
    }
    perTier[tier] = (perTier[tier] ?? 0) + 1;
    foes.push({ familyId: family.id, tier, level: foeLevel });
  }
  const worth = (foe: MarinaraEncounterFoe) => marinaraFoeThreat(foe.familyId, foe.tier, foe.level, level);
  const total = () => marinaraEncounterThreat(foes, level);
  const order = ["trivial", "easy", "normal", "hard", "deadly", "beyond"] as const;
  const over = () => order.indexOf(marinaraEncounterRating(total(), party)) > order.indexOf(input.difficulty);
  for (let guard = 0; guard < 40 && foes.length && over(); guard++) {
    // A place's own foes keep their levels and tiers: the fight shrinks instead, the costliest of the
    // boss's escort first, and the last foe (or a boss) stays however strong it is.
    if (input.fixedLevels) {
      const escort = foes.filter((foe) => foe.tier !== "boss");
      if (foes.length <= 1 || !escort.length) break;
      const top = escort.sort((a, b) => worth(b) - worth(a))[0]!;
      foes.splice(foes.indexOf(top), 1);
      changes.push(`Dropped ${top.familyId} to fit a ${input.difficulty} fight.`);
      continue;
    }
    // A boss the story asked for stays: those around it give way first (playtest 2026-11-01: the boss
    // was the costliest foe, so it was the one cut, and only 5 of 16 boss fights had one).
    const escort = foes.filter((foe) => foe.tier !== "boss");
    const top = [...(escort.length ? escort : foes)].sort((a, b) => worth(b) - worth(a))[0]!;
    const index = foes.indexOf(top);
    const lower = DEMOTE[top.tier];
    const family = FAMILY_BY_ID.get(top.familyId)!;
    if (lower && family.tiers.includes(lower)) {
      foes[index] = { ...top, tier: lower };
      changes.push(`${top.familyId}: ${top.tier} → ${lower} to fit a ${input.difficulty} fight.`);
    } else if (
      top.level > level - marinaraLevelGap(party)[top.tier === "boss" ? "bossBelow" : "below"] &&
      top.level > family.levels[0]
    ) {
      foes[index] = { ...top, level: top.level - 1 };
      changes.push(`${top.familyId}: level ${top.level} → ${top.level - 1} to fit a ${input.difficulty} fight.`);
    } else {
      foes.splice(index, 1);
      changes.push(`Dropped ${top.familyId} to fit a ${input.difficulty} fight.`);
    }
  }
  if (foes.length && !foes.some((foe) => FAMILY_BY_ID.get(foe.familyId)!.row === "front"))
    changes.push("Nobody stands in front: the back row takes melee at full damage.");
  return { foes, threat: total(), changes };
}
