// ──────────────────────────────────────────────
// Game: Marinara's own items and gear (Classic Marinara)
//
// The weapons, armour, accessories and consumables a game on Marinara's own rules (no ruleset) is
// equipped and stocked from, in every combat mode (Classic menu battles and Tactical boards), and the
// loot, steal and shop tables that hand them out. Pure data and math: nothing here reads storage or
// calls a model.
//
//   - Six power tiers, one per five levels (T1 = levels 1-5 ... T6 = 26-30), shared with the
//     bestiary: what a fight drops and a town sells follows the party's tier.
//   - Gear stays inside the class lab's budget (TUNING.powerPerLevel 0.2: about +1 power a tier, +6
//     at level 30), so equipping it does not move class balance. A tier's weapons trade might for
//     hit, crit and weight around that budget, Fire Emblem style; armour adds about a tier's worth
//     of Defense and Resistance between them.
//   - Every item has a name in each setting family the Engine knows (fantasy, scifi, modern, wuxia,
//     jazz_age, wasteland) and a neutral one; an item that does not belong in a setting is left
//     out of it (`settings`, `excludeKits`). A game may rename anything in its own words.
//   - Weapons follow the overhaul's rule that the equipped weapon decides the physical damage type;
//     coatings and enchantments ride on top (`MARINARA_WEAPON_COATINGS`).
//
// Names are original: nothing is lifted from another game's item list (no borrowed material ladders,
// potion grades or named weapons). Alyssa 2026-10-31: western take on traditional JRPG.
// ──────────────────────────────────────────────

import {
  MARINARA_DAMAGE_TYPES,
  MARINARA_LEVEL_CAP,
  MARINARA_PHYSICAL_TYPES,
  MARINARA_STATS,
  MARINARA_WEAPON_COATINGS,
  expectedMarinaraStats,
  marinaraClass,
  marinaraRandom,
  marinaraWeaponTypes,
  type MarinaraAffinities,
  type MarinaraAffinity,
  type MarinaraArchetype,
  type MarinaraDamageType,
  type MarinaraStat,
  type MarinaraStats,
} from "./marinara-classes.js";

// ── Tiers ──

export const MARINARA_TIERS = [1, 2, 3, 4, 5, 6] as const;
export type MarinaraTier = (typeof MARINARA_TIERS)[number];
/** Levels per tier: T1 is levels 1-5, T6 is 26-30. */
export const MARINARA_LEVELS_PER_TIER = 5;

export function marinaraTierForLevel(level: number): MarinaraTier {
  const at = Math.max(1, Math.min(MARINARA_LEVEL_CAP, Math.floor(level)));
  return Math.min(6, Math.ceil(at / MARINARA_LEVELS_PER_TIER)) as MarinaraTier;
}

const clampTier = (tier: number): MarinaraTier => Math.max(1, Math.min(6, Math.round(tier))) as MarinaraTier;

// ── Settings ──

/** The setting families items are named for: the Engine's art families (world/art-family.ts). */
export const MARINARA_ITEM_SETTINGS = ["fantasy", "scifi", "modern", "wuxia", "jazz_age", "wasteland"] as const;
export type MarinaraItemSetting = (typeof MARINARA_ITEM_SETTINGS)[number];
/** A name for every setting family, and a neutral one for a game whose genre names none. */
export type MarinaraNames = Record<MarinaraItemSetting | "neutral", string>;

/** The starter kits' setting families (world/starter-kits.ts), so a kit id or a family both work. */
export const MARINARA_KIT_SETTINGS: Readonly<Record<string, MarinaraItemSetting>> = {
  high_fantasy: "fantasy",
  wuxia_xianxia: "wuxia",
  modern_day: "modern",
  modern_supernatural: "modern",
  the_1920s: "jazz_age",
  cyberpunk: "scifi",
  space_opera: "scifi",
  post_apocalyptic: "wasteland",
};

/** Where a game's items come from: its setting family (null: neutral) and its kit, if any. */
export interface MarinaraItemPlace {
  setting: MarinaraItemSetting | null;
  kit?: string | null;
}

/** A game's item place from its kit id or art family; anything unknown is neutral. */
export function marinaraItemPlace(kitOrFamily: string | null | undefined): MarinaraItemPlace {
  if (!kitOrFamily) return { setting: null };
  if ((MARINARA_ITEM_SETTINGS as readonly string[]).includes(kitOrFamily))
    return { setting: kitOrFamily as MarinaraItemSetting };
  const setting = MARINARA_KIT_SETTINGS[kitOrFamily];
  return setting ? { setting, kit: kitOrFamily } : { setting: null };
}

/** Setting limits any item may carry. */
export interface MarinaraItemLimits {
  /** Only in these setting families (never in a neutral game). Absent: everywhere. */
  settings?: readonly MarinaraItemSetting[];
  /** Never in these starter kits (modern_day has no holy water or grave dirt that does anything). */
  excludeKits?: readonly string[];
}

export function marinaraItemAllowed(limits: MarinaraItemLimits, place: MarinaraItemPlace): boolean {
  if (limits.settings && (!place.setting || !limits.settings.includes(place.setting))) return false;
  if (limits.excludeKits && place.kit && limits.excludeKits.includes(place.kit)) return false;
  return true;
}

const names = (
  neutral: string,
  fantasy: string,
  scifi: string,
  modern: string,
  wuxia: string,
  jazz_age: string,
  wasteland: string,
): MarinaraNames => ({ neutral, fantasy, scifi, modern, wuxia, jazz_age, wasteland });

/**
 * The grade words that tell a weapon's or armour's tier, per setting: a game's T3 sword is a
 * "Bluesteel Broadsword" in a fantasy game and a "Carbide Vibro-sabre" in a science-fiction one.
 */
export const MARINARA_GRADES: Readonly<Record<MarinaraItemSetting | "neutral", readonly string[]>> = {
  neutral: ["Plain", "Sturdy", "Fine", "Superb", "Masterful", "Peerless"],
  fantasy: ["Bog-iron", "Hammered", "Bluesteel", "Emberforged", "Skyglass", "Heartwrought"],
  scifi: ["Surplus", "Mil-spec", "Carbide", "Phase-tuned", "Prototype", "Singularity-forged"],
  modern: ["Hardware-store", "Duty", "Tactical", "Competition", "Custom-built", "One-of-a-kind"],
  wuxia: ["Village-forged", "Sect-issued", "Cold-iron", "Spirit-tempered", "Heaven-quenched", "Immortal-grade"],
  jazz_age: ["Pawnshop", "Catalog", "Gunsmith's", "Engraved", "Bespoke", "Heirloom"],
  wasteland: ["Scrap", "Patched", "Rebuilt", "Old-World", "Cache-sealed", "Relic"],
};

// ── Statuses ──

/** The statuses the overhaul's fights lay (class lab), which items cure or guard against. */
export const MARINARA_STATUSES = [
  "sleep",
  "stun",
  "confuse",
  "slow",
  "poison",
  "bleed",
  "burn",
  "freeze",
  "shock",
  "entangle",
  "crumble",
  "soak",
  "rend",
  "windswept",
  "sear",
  "wither",
  "wound",
  "doom",
] as const;
export type MarinaraStatus = (typeof MARINARA_STATUSES)[number];

// ── Gear effects ──

/**
 * What a piece of gear does beyond its plain numbers. Each key matches a modifier the class lab
 * already runs (passive hooks, effect fields), so the Engine adds them the same way skills add theirs.
 */
export interface MarinaraGearEffects {
  /** Added to hit chance and crit chance (percentage points). */
  hit?: number;
  crit?: number;
  /** Share of the target's Defense a weapon hit ignores (blunt weapons crush armour). */
  pierce?: number;
  /** Classic: melee into the back row deals this share instead of MARINARA_BACK_ROW_MELEE_PCT.
   *  Tactical: strikes from two squares away. */
  reachPct?: number;
  /** Damage dealt, as a share (0.1 = +10%). */
  damagePct?: number;
  damageBelowHalfPct?: number;
  /** Element (MARINARA_ELEMENTS) spell damage. */
  elementDamagePct?: number;
  /** Healing done. */
  healPct?: number;
  /** MP cost of magic skills (−0.2 = 20% cheaper). */
  mpCostPct?: number;
  /** Chance a status lands, added (0.15 = +15 points). */
  statusChance?: number;
  /** Turns added to every damage-over-time status the wearer lays. */
  dotTurns?: number;
  /** Share of damage dealt healed back. */
  lifestealPct?: number;
  /** Share of max HP healed at the start of each of the wearer's turns. */
  regenPct?: number;
  /** Allies' damage while the wearer stands. */
  partyDamagePct?: number;
  /** Magic damage the party takes while the wearer stands (−0.1 = 10% less). */
  partyMagicTakenPct?: number;
  /** Max HP, MP and stamina, as shares. */
  hpPct?: number;
  mpPct?: number;
  staminaPct?: number;
  /** Chance a hit also steals (as the Scout's Steal), and bonus to Steal itself. */
  stealOnHit?: number;
  stealChance?: number;
  /** Gold from fights. Does not stack: the best one counts. */
  goldPct?: number;
  /** The wearer's first hit of each fight is a critical. */
  firstHitCrit?: boolean;
  /** Acts early in round 1 (as Hold the Line's Vanguard). */
  vanguard?: boolean;
  /** Each healing skill also cures one status. */
  cleanseOnHeal?: boolean;
  /** A weapon hit may lay a status. */
  onHit?: { status: MarinaraStatus; chance: number; turns: number };
}

const NUMERIC_EFFECTS = [
  "hit",
  "crit",
  "pierce",
  "damagePct",
  "damageBelowHalfPct",
  "elementDamagePct",
  "healPct",
  "mpCostPct",
  "statusChance",
  "dotTurns",
  "lifestealPct",
  "regenPct",
  "partyDamagePct",
  "partyMagicTakenPct",
  "hpPct",
  "mpPct",
  "staminaPct",
  "stealOnHit",
  "stealChance",
] as const satisfies ReadonlyArray<keyof MarinaraGearEffects>;

// ── Weapons ──

/**
 * A weapon family: one shape of weapon (a broadsword, a bow), which archetypes carry it, and how it
 * trades against the tier's budget. A family comes in every tier (`<family>-t<tier>`).
 *
 *   power on a weapon hit = tier + might   (null: the weapon adds nothing to weapon hits)
 *   power on a spell      = tier + spell   (null: nothing to spells; only foci carry magic)
 *   speed lost            = floor(max(0, weight − floor(Strength / 2)) / 2)   (MARINARA_WEIGHT)
 *
 * `hit` and `crit` add to the wielder's chances. A family's numbers are balanced against the
 * standard (longblade: might 0, hit 0, crit 0, weight 5): +1 might is worth about 10 hit, 5 crit or
 * 3 weight. Hit here is relative to the formula's own base (80), not Fire Emblem's absolute hit.
 */
export interface MarinaraWeaponFamily extends MarinaraItemLimits {
  id: string;
  type: MarinaraDamageType;
  range: "melee" | "ranged";
  archetypes: readonly MarinaraArchetype[];
  might: number | null;
  spell: number | null;
  hit: number;
  crit: number;
  weight: number;
  effects?: MarinaraGearEffects;
  names: MarinaraNames;
  summary: string;
}

const weapon = (row: MarinaraWeaponFamily) => row;

export const MARINARA_WEAPON_FAMILIES: readonly MarinaraWeaponFamily[] = [
  // Blade and Herald: the standard sword everything else is measured against.
  weapon({
    id: "longblade",
    type: "slash",
    range: "melee",
    archetypes: ["blade", "herald"],
    might: 0,
    spell: null,
    hit: 0,
    crit: 0,
    weight: 5,
    names: names("Sword", "Broadsword", "Vibro-sabre", "Machete", "Dao", "Cane Sword", "Rebar Blade"),
    summary: "The standard blade: no strengths, no gaps.",
  }),
  weapon({
    id: "greatblade",
    type: "slash",
    range: "melee",
    archetypes: ["blade"],
    might: 2,
    spell: null,
    hit: -10,
    crit: 0,
    weight: 9,
    names: names(
      "Greatsword",
      "Claymore",
      "Vibro-claymore",
      "Replica Claymore",
      "Zhanmadao",
      "Highland Claymore",
      "Scrap Greatsword",
    ),
    summary: "Heavy two-hander: hits hardest, misses more, slows a weak arm.",
  }),
  weapon({
    id: "rapier",
    type: "pierce",
    range: "melee",
    archetypes: ["blade", "scout", "herald"],
    might: -1,
    spell: null,
    hit: 10,
    crit: 5,
    weight: 3,
    names: names("Rapier", "Rapier", "Needle-foil", "Bayonet", "Jian", "Dueling Foil", "Sharpened Spike"),
    summary: "Light thrusting blade: accurate and quick, a little less bite.",
  }),
  weapon({
    id: "knife",
    type: "slash",
    range: "melee",
    archetypes: ["scout"],
    might: -1,
    spell: null,
    hit: 5,
    crit: 15,
    weight: 2,
    names: names(
      "Knife",
      "Hook-knife",
      "Mono-knife",
      "Switchblade",
      "Butterfly Swords",
      "Straight Razor",
      "Scrap Knife",
    ),
    summary: "Short slashing blade: weak per hit, finds the crit.",
  }),
  weapon({
    id: "stiletto",
    type: "pierce",
    range: "melee",
    archetypes: ["scout", "hexer"],
    might: -2,
    spell: -3,
    hit: 10,
    crit: 15,
    weight: 2,
    names: names("Stiletto", "Misericorde", "Injector Spike", "Stiletto", "Emei Piercers", "Ice Pick", "Screwdriver"),
    summary: "Thin piercing dagger: a Hexer's ritual knife too (a little spell power).",
  }),
  weapon({
    id: "spear",
    type: "pierce",
    range: "melee",
    archetypes: ["guard", "blade", "herald"],
    might: 0,
    spell: null,
    hit: -5,
    crit: 0,
    weight: 6,
    effects: { reachPct: 0.75 },
    names: names("Spear", "Boar Spear", "Mag-spear", "Boat Hook", "Red-Tassel Spear", "Harpoon", "Sharpened Pipe"),
    summary: "Reach: melee into the Classic back row at 75% (not 50%); two squares in Tactical.",
  }),
  weapon({
    id: "pike",
    type: "pierce",
    range: "melee",
    archetypes: ["guard"],
    might: 2,
    spell: null,
    hit: -10,
    crit: 0,
    weight: 9,
    effects: { reachPct: 0.75 },
    names: names("Halberd", "Halberd", "Breach Lance", "Pike Pole", "Ji", "Bargepole Hook", "Lamp-post Lance"),
    summary: "Heavy polearm with reach: the Guard's big hitter.",
  }),
  weapon({
    id: "mace",
    type: "blunt",
    range: "melee",
    archetypes: ["guard", "mender"],
    might: 0,
    spell: 0,
    hit: -5,
    crit: 0,
    weight: 7,
    effects: { pierce: 0.15 },
    names: names("Mace", "Flanged Mace", "Stun Baton", "Crowbar", "Iron Rod", "Billy Club", "Pipe Wrench"),
    summary: "Crushes armour (ignores 15% Defense); a Mender's battle mace keeps some spell power.",
  }),
  weapon({
    id: "maul",
    type: "blunt",
    range: "melee",
    archetypes: ["guard"],
    might: 2,
    spell: null,
    hit: -15,
    crit: 0,
    weight: 10,
    effects: { pierce: 0.2 },
    names: names(
      "Maul",
      "War Maul",
      "Pneumatic Maul",
      "Sledgehammer",
      "Meteor Hammer",
      "Railway Sledge",
      "Engine-block Hammer",
    ),
    summary: "The heaviest thing a Guard can lift: crushes armour, often misses.",
  }),
  weapon({
    id: "staff",
    type: "blunt",
    range: "melee",
    archetypes: ["channeler", "hexer", "mender"],
    might: null,
    spell: 0,
    hit: 0,
    crit: 0,
    weight: 3,
    names: names(
      "Staff",
      "Runed Staff",
      "Psi-amp Rod",
      "Carved Walking Stick",
      "Fly-whisk",
      "Silver-tipped Cane",
      "Antenna Staff",
    ),
    summary: "The standard focus: spell power for every caster.",
  }),
  weapon({
    id: "wand",
    type: "blunt",
    range: "melee",
    archetypes: ["hexer", "channeler"],
    might: null,
    spell: -1,
    hit: 0,
    crit: 0,
    weight: 1,
    effects: { statusChance: 0.1 },
    names: names("Wand", "Bone Wand", "Neural Scrambler", "Pendulum", "Talisman Brush", "Tarot Deck", "Geiger Wand"),
    summary: "Light focus: a little less power, curses and statuses land 10 points more often.",
  }),
  weapon({
    id: "censer",
    type: "blunt",
    range: "melee",
    archetypes: ["mender"],
    might: null,
    spell: -1,
    hit: 0,
    crit: 0,
    weight: 2,
    effects: { healPct: 0.1 },
    names: names(
      "Censer",
      "Swinging Censer",
      "Med-emitter",
      "Rosary",
      "Prayer Beads",
      "Saint's Medallion",
      "Clinic Bell",
    ),
    summary: "Healer's focus: heals 10% more, spells a little weaker.",
  }),
  weapon({
    id: "bow",
    type: "pierce",
    range: "ranged",
    archetypes: ["marksman"],
    might: 0,
    spell: null,
    hit: 0,
    crit: 5,
    weight: 4,
    names: names("Bow", "Longbow", "Needle Rifle", "Pistol", "Recurve Bow", "Revolver", "Pipe Pistol"),
    summary: "The standard ranged weapon.",
  }),
  weapon({
    id: "greatbow",
    type: "pierce",
    range: "ranged",
    archetypes: ["marksman"],
    might: 2,
    spell: null,
    hit: -10,
    crit: 0,
    weight: 9,
    names: names(
      "Crossbow",
      "Arbalest",
      "Rail Rifle",
      "Hunting Rifle",
      "Repeating Crossbow",
      "Drum-fed Carbine",
      "Pipe Rifle",
    ),
    summary: "Heavy ranged weapon: more power, less accuracy, slower.",
  }),
  weapon({
    id: "sling",
    type: "blunt",
    range: "ranged",
    archetypes: ["marksman"],
    might: -1,
    spell: null,
    hit: 10,
    crit: 0,
    weight: 2,
    effects: { pierce: 0.1 },
    names: names(
      "Sling",
      "Staff Sling",
      "Stun Launcher",
      "Beanbag Shotgun",
      "Pellet Bow",
      "Lead Slingshot",
      "Slingshot",
    ),
    summary: "Blunt ranged weapon for foes that shrug off arrows; light and accurate.",
  }),
];

export function marinaraWeaponFamily(id: string): MarinaraWeaponFamily | undefined {
  return MARINARA_WEAPON_FAMILIES.find((family) => family.id === id);
}

// ── Armour ──

/**
 * Body armour: one piece, worn by the archetypes listed. Between Defense and Resistance it adds
 * about the tier's number (plate a little more, paid in weight), so a T3 wearer has about +3.
 */
export interface MarinaraArmourFamily extends MarinaraItemLimits {
  id: string;
  archetypes: readonly MarinaraArchetype[];
  /** Defense and Resistance as shares of the tier (rounded). */
  defense: number;
  resistance: number;
  weight: number;
  effects?: MarinaraGearEffects;
  names: MarinaraNames;
  summary: string;
}

export const MARINARA_ARMOUR_FAMILIES: readonly MarinaraArmourFamily[] = [
  {
    id: "plate",
    archetypes: ["guard"],
    defense: 1.5,
    resistance: 0,
    weight: 3,
    names: names(
      "Plate",
      "Plate Harness",
      "Hardsuit",
      "Riot Armour",
      "Lamellar Armour",
      "Steel Vest",
      "Car-door Plate",
    ),
    summary: "Heaviest Defense, nothing against magic, slows the wearer.",
  },
  {
    id: "mail",
    archetypes: ["blade", "guard", "herald", "marksman"],
    defense: 1,
    resistance: 0.34,
    weight: 2,
    names: names(
      "Mail",
      "Mail Hauberk",
      "Flak Weave",
      "Plate Carrier",
      "Scale Coat",
      "Padded Greatcoat",
      "Tire-tread Mail",
    ),
    summary: "Solid Defense with a little Resistance.",
  },
  {
    id: "leathers",
    archetypes: ["blade", "scout", "marksman", "herald", "hexer"],
    defense: 0.5,
    resistance: 0.5,
    weight: 0,
    names: names(
      "Leathers",
      "Studded Leathers",
      "Mesh Suit",
      "Motorcycle Jacket",
      "Wrapped Silk Garb",
      "Leather Duster",
      "Road Leathers",
    ),
    summary: "Light and even: no weight at all.",
  },
  {
    id: "robes",
    archetypes: ["channeler", "hexer", "mender", "herald"],
    defense: 0,
    resistance: 1,
    weight: 0,
    effects: { mpPct: 0.05 },
    names: names(
      "Robes",
      "Warded Robes",
      "Psi-weave Cloak",
      "Long Coat",
      "Daoist Robes",
      "Tailored Suit",
      "Rad Poncho",
    ),
    summary: "Resistance and a little more MP; nothing against blades.",
  },
];

export function marinaraArmourFamily(id: string): MarinaraArmourFamily | undefined {
  return MARINARA_ARMOUR_FAMILIES.find((family) => family.id === id);
}

// ── Accessories ──

/**
 * Two accessory slots. Most come in ranks I-III (rank r is first found at tier 2r − 1); wards and
 * status guards have one rank. A shield is an accessory only Guards can use.
 */
export interface MarinaraAccessoryDef extends MarinaraItemLimits {
  id: string;
  /** The tier it first drops or is sold at. */
  tier: MarinaraTier;
  rank: 1 | 2 | 3;
  stats?: Partial<MarinaraStats>;
  affinities?: MarinaraAffinities;
  immune?: readonly MarinaraStatus[];
  effects?: MarinaraGearEffects;
  weight?: number;
  /** Only these archetypes may wear it. */
  archetypes?: readonly MarinaraArchetype[];
  /** Never sold: found only. */
  found?: boolean;
  names: MarinaraNames;
  summary: string;
}

/** The noun each setting calls a worn trinket. */
const ACCESSORY_NOUN: MarinaraNames = names("Charm", "Charm", "Mod", "Keepsake", "Jade Pendant", "Pin", "Trinket");
const RANK_MARK = ["", " II", " III"] as const;
const accessoryNames = (word: string, rank: 1 | 2 | 3): MarinaraNames =>
  Object.fromEntries(
    Object.entries(ACCESSORY_NOUN).map(([setting, noun]) => [setting, `${word} ${noun}${RANK_MARK[rank - 1]}`]),
  ) as MarinaraNames;

const STAT_WORDS: Partial<Record<MarinaraStat, string>> = {
  strength: "Ox",
  magic: "Spark",
  skill: "Steady-hand",
  speed: "Hare",
  defense: "Shell",
  resistance: "Hush",
  luck: "Clover",
};

const ranked = (
  id: string,
  word: string,
  summary: (rank: number) => string,
  build: (rank: 1 | 2 | 3) => Partial<MarinaraAccessoryDef>,
): MarinaraAccessoryDef[] =>
  ([1, 2, 3] as const).map((rank) => ({
    id: `${id}-${rank}`,
    tier: (rank * 2 - 1) as MarinaraTier,
    rank,
    names: accessoryNames(word, rank),
    summary: summary(rank),
    ...build(rank),
  }));

const ELEMENT_WARDS: ReadonlyArray<[MarinaraDamageType, string]> = [
  ["fire", "Fireproof"],
  ["ice", "Frostproof"],
  ["lightning", "Grounding"],
  ["wood", "Barkward"],
  ["earth", "Bedrock"],
  ["water", "Waterproof"],
  ["metal", "Ironskin"],
  ["wind", "Windbreak"],
  ["light", "Shade"],
  ["dark", "Dawn"],
];
const STATUS_GUARDS: ReadonlyArray<[MarinaraStatus, string]> = [
  ["sleep", "Wakeful"],
  ["stun", "Steady-foot"],
  ["confuse", "Clear-mind"],
  ["slow", "Quickstep"],
  ["poison", "Antitoxin"],
  ["bleed", "Clotting"],
  ["wither", "Unwithering"],
  ["wound", "Mending"],
];

export const MARINARA_ACCESSORIES: readonly MarinaraAccessoryDef[] = [
  ...Object.entries(STAT_WORDS).flatMap(([stat, word]) =>
    ranked(
      `charm-${stat}`,
      word!,
      (rank) => `+${rank} ${stat[0]!.toUpperCase()}${stat.slice(1)}.`,
      (rank) => ({ stats: { [stat]: rank } as Partial<MarinaraStats> }),
    ),
  ),
  ...ranked(
    "charm-vigor",
    "Heart",
    (rank) => `+${5 + rank * 5}% max HP.`,
    (rank) => ({ effects: { hpPct: (5 + rank * 5) / 100 } }),
  ),
  ...ranked(
    "charm-deepwell",
    "Deepwell",
    (rank) => `+${rank * 10}% max MP.`,
    (rank) => ({ effects: { mpPct: rank / 10 } }),
  ),
  ...ranked(
    "charm-second-wind",
    "Long-breath",
    (rank) => `+${rank * 15}% max stamina.`,
    (rank) => ({ effects: { staminaPct: (rank * 15) / 100 } }),
  ),
  ...ranked(
    "charm-hawkeye",
    "Hawk-eye",
    (rank) => `+${rank * 5} hit.`,
    (rank) => ({ effects: { hit: rank * 5 } }),
  ),
  ...ranked(
    "charm-keen",
    "Keen",
    (rank) => `+${rank * 4} crit.`,
    (rank) => ({ effects: { crit: rank * 4 } }),
  ),
  ...ranked(
    "shield",
    "Shield",
    (rank) => `Guards only: +${rank * 2} Defense, +${rank} Resistance, weight 2.`,
    (rank) => ({
      stats: { defense: rank * 2, resistance: rank },
      weight: 2,
      archetypes: ["guard"],
      names: Object.fromEntries(
        Object.entries(
          names(
            "Shield",
            "Kite Shield",
            "Energy Buckler",
            "Riot Shield",
            "Rattan Shield",
            "Manhole Cover",
            "Stop-sign Shield",
          ),
        ).map(([setting, noun]) => [setting, `${noun}${RANK_MARK[rank - 1]}`]),
      ) as MarinaraNames,
    }),
  ),
  ...ELEMENT_WARDS.map(([element, word]): MarinaraAccessoryDef => ({
    id: `ward-${element}`,
    tier: 2,
    rank: 1,
    affinities: { [element]: "resist" },
    names: accessoryNames(word, 1),
    summary: `Resist ${element} (half damage).`,
    ...(element === "light" || element === "dark" ? { excludeKits: ["modern_day"] } : {}),
  })),
  ...STATUS_GUARDS.map(([status, word]): MarinaraAccessoryDef => ({
    id: `guard-${status}`,
    tier: 2,
    rank: 1,
    immune: [status],
    names: accessoryNames(word, 1),
    summary: `Immune to ${status}.`,
  })),
  {
    id: "charm-early-riser",
    tier: 3,
    rank: 1,
    effects: { vanguard: true },
    names: accessoryNames("Early-riser", 1),
    summary: "Acts early in the first round of every fight.",
  },
  {
    id: "charm-lucky-coin",
    tier: 2,
    rank: 1,
    effects: { goldPct: 0.25 },
    names: names(
      "Lucky Coin",
      "Lucky Coin",
      "Bounty Tracker",
      "Lucky Penny",
      "Fortune Coin",
      "Lucky Silver Dollar",
      "Lucky Bottlecap",
    ),
    summary: "+25% gold from fights (the best one in the party counts, they don't stack).",
  },
  {
    id: "charm-light-fingers",
    tier: 2,
    rank: 1,
    effects: { stealChance: 0.25 },
    names: accessoryNames("Light-finger", 1),
    summary: "Steal works 25 points more often.",
  },
  {
    id: "charm-evergreen",
    tier: 5,
    rank: 1,
    found: true,
    effects: { regenPct: 0.03 },
    names: accessoryNames("Evergreen", 1),
    summary: "Heals 3% max HP at the start of each of the wearer's turns. Found, never sold.",
  },
];

export function marinaraAccessory(id: string): MarinaraAccessoryDef | undefined {
  return MARINARA_ACCESSORIES.find((def) => def.id === id);
}

// ── Unique gear ──

/**
 * Named gear: two per tree, found only (boss drops, quest rewards), never sold. Each belongs to the
 * settings it has a name in; a game outside them never sees it. Its base is a family at a tier, and
 * its own numbers are added on top.
 */
export interface MarinaraUniqueDef extends MarinaraItemLimits {
  id: string;
  slot: "weapon" | "armour" | "accessory";
  /** The weapon or armour family it is built on (accessories have none). */
  family?: string;
  tier: MarinaraTier;
  /** Extra might/spell on a weapon, on top of its family's. */
  might?: number;
  spell?: number;
  stats?: Partial<MarinaraStats>;
  affinities?: MarinaraAffinities;
  immune?: readonly MarinaraStatus[];
  effects?: MarinaraGearEffects;
  /** The tree it was made for (it can still be worn by anyone who can use its family). */
  tree: MarinaraArchetype;
  names: Partial<MarinaraNames>;
  summary: string;
}

export const MARINARA_UNIQUES: readonly MarinaraUniqueDef[] = [
  {
    id: "moonwake",
    slot: "weapon",
    family: "longblade",
    tier: 5,
    tree: "blade",
    effects: { crit: 15, damagePct: 0.1 },
    settings: ["fantasy", "wuxia"],
    names: { fantasy: "Moonwake", wuxia: "Moon-Drinking Dao" },
    summary: "+15 crit, +10% damage.",
  },
  {
    id: "hangmans-answer",
    slot: "weapon",
    family: "greatblade",
    tier: 6,
    tree: "blade",
    might: 1,
    effects: { damageBelowHalfPct: 0.25 },
    settings: ["fantasy", "scifi", "wasteland"],
    names: { fantasy: "Hangman's Answer", scifi: "Severance Protocol", wasteland: "Final Notice" },
    summary: "+1 might; +25% damage while its wielder is below half HP.",
  },
  {
    id: "bellwether",
    slot: "accessory",
    tier: 4,
    tree: "guard",
    stats: { defense: 4, resistance: 3 },
    effects: { partyMagicTakenPct: -0.1 },
    settings: ["fantasy", "wuxia", "modern"],
    names: { fantasy: "Bellwether Shield", wuxia: "Turtle-Shell Gate", modern: "Precinct Door" },
    summary: "Guards only (a shield): +4 Defense, +3 Resistance, party takes 10% less magic damage.",
  },
  {
    id: "stillwater-plate",
    slot: "armour",
    family: "plate",
    tier: 6,
    tree: "guard",
    affinities: { fire: "resist", ice: "resist", lightning: "resist" },
    settings: ["fantasy", "scifi", "wasteland"],
    names: { fantasy: "Stillwater Plate", scifi: "Null-field Hardsuit", wasteland: "Reactor Shielding" },
    summary: "Resists fire, ice and lightning.",
  },
  {
    id: "magpies-kiss",
    slot: "weapon",
    family: "knife",
    tier: 4,
    tree: "scout",
    effects: { crit: 10, stealOnHit: 0.15 },
    settings: ["fantasy", "jazz_age", "modern"],
    names: { fantasy: "Magpie's Kiss", jazz_age: "Pickpocket's Razor", modern: "Finders Keepers" },
    summary: "+10 crit; 15% of hits also steal.",
  },
  {
    id: "nightjar",
    slot: "weapon",
    family: "stiletto",
    tier: 6,
    tree: "scout",
    effects: { firstHitCrit: true, crit: 5 },
    settings: ["fantasy", "scifi", "wuxia"],
    names: { fantasy: "Nightjar", scifi: "Blind Spot", wuxia: "Shadowless Needle" },
    summary: "The first hit of every fight is a critical; +5 crit.",
  },
  {
    id: "longsight",
    slot: "weapon",
    family: "greatbow",
    tier: 5,
    tree: "marksman",
    effects: { hit: 20, pierce: 0.2 },
    settings: ["fantasy", "scifi", "jazz_age", "wasteland"],
    names: {
      fantasy: "Longsight Arbalest",
      scifi: "Horizon Rail",
      jazz_age: "Rooftop Carbine",
      wasteland: "Watchtower Rifle",
    },
    summary: "+20 hit; ignores 20% of Defense.",
  },
  {
    id: "thunderclap",
    slot: "weapon",
    family: "sling",
    tier: 4,
    tree: "marksman",
    effects: { onHit: { status: "stun", chance: 0.1, turns: 1 } },
    settings: ["fantasy", "modern"],
    names: { fantasy: "Thunderclap Sling", modern: "Wake-up Call" },
    summary: "10% of hits stun for a turn.",
  },
  {
    id: "cinderheart",
    slot: "weapon",
    family: "staff",
    tier: 5,
    tree: "channeler",
    spell: 1,
    effects: { elementDamagePct: 0.15 },
    settings: ["fantasy", "wuxia", "scifi"],
    names: { fantasy: "Cinderheart Staff", wuxia: "Three-Furnace Whisk", scifi: "Overclocked Amp" },
    summary: "+1 spell power; element spells deal 15% more.",
  },
  {
    id: "quiet-star",
    slot: "weapon",
    family: "staff",
    tier: 6,
    tree: "channeler",
    effects: { mpCostPct: -0.2 },
    settings: ["fantasy", "wuxia", "scifi"],
    names: { fantasy: "The Quiet Star", wuxia: "Starless Night Whisk", scifi: "Zero-draw Focus" },
    summary: "Spells cost 20% less MP.",
  },
  {
    id: "witchknot",
    slot: "weapon",
    family: "wand",
    tier: 4,
    tree: "hexer",
    effects: { statusChance: 0.15, dotTurns: 1 },
    settings: ["fantasy", "jazz_age", "wuxia"],
    names: { fantasy: "Witchknot Wand", jazz_age: "The Marked Deck", wuxia: "Curse-Writing Brush" },
    summary: "Statuses land 15 points more often; damage-over-time lasts a turn longer.",
  },
  {
    id: "hollow-circlet",
    slot: "accessory",
    tier: 6,
    tree: "hexer",
    effects: { lifestealPct: 0.15 },
    settings: ["fantasy", "scifi", "wasteland"],
    names: { fantasy: "Hollow Circlet", scifi: "Leech Implant", wasteland: "Bloodbag Collar" },
    summary: "Heals 15% of the damage its wearer deals.",
  },
  {
    id: "dawnbell",
    slot: "weapon",
    family: "censer",
    tier: 5,
    tree: "mender",
    effects: { healPct: 0.1, cleanseOnHeal: true },
    settings: ["fantasy", "wuxia", "jazz_age"],
    names: { fantasy: "Dawnbell", wuxia: "Morning Bell Beads", jazz_age: "Night Nurse's Lamp" },
    summary: "Heals 10% more (20% with the censer's own); every heal also cures one status.",
  },
  {
    id: "evergreen-vestments",
    slot: "armour",
    family: "robes",
    tier: 6,
    tree: "mender",
    effects: { regenPct: 0.05 },
    settings: ["fantasy", "wuxia", "scifi"],
    names: { fantasy: "Evergreen Vestments", wuxia: "Thousand-Year Pine Robe", scifi: "Bio-gel Suit" },
    summary: "Heals 5% max HP at the start of each of the wearer's turns.",
  },
  {
    id: "hearthbanner",
    slot: "weapon",
    family: "spear",
    tier: 5,
    tree: "herald",
    effects: { partyDamagePct: 0.1 },
    settings: ["fantasy", "scifi", "wuxia", "wasteland"],
    names: {
      fantasy: "Hearthbanner Spear",
      scifi: "Command Beacon Pike",
      wuxia: "Clan-Banner Spear",
      wasteland: "Flagpole of Home",
    },
    summary: "Allies deal 10% more damage while its bearer stands.",
  },
  {
    id: "courtiers-point",
    slot: "weapon",
    family: "rapier",
    tier: 4,
    tree: "herald",
    effects: { hit: 10, crit: 5, vanguard: true },
    settings: ["fantasy", "jazz_age"],
    names: { fantasy: "Courtier's Point", jazz_age: "Toastmaster's Foil" },
    summary: "+10 hit, +5 crit; acts early in the first round.",
  },
];

export function marinaraUnique(id: string): MarinaraUniqueDef | undefined {
  return MARINARA_UNIQUES.find((def) => def.id === id);
}

// ── Consumables ──

/** What using a consumable does. Percentages are of the target's max (fight) HP, MP or stamina. */
export type MarinaraConsumableEffect =
  | { kind: "heal"; pct: number; target: "ally" | "party" }
  | { kind: "mp"; pct: number }
  | { kind: "stamina"; pct: number }
  | { kind: "revive"; pct: number }
  | { kind: "cleanse"; statuses: readonly MarinaraStatus[] | "all" }
  | { kind: "coat"; rider: MarinaraDamageType }
  /** Marksman ammunition (Alyssa 2026-11-01): owning it lets a Marksman's bow or gun shoot this type,
   *  loaded by hand mid-fight (an AI-run one loads the best). Not spent: owning it is having it. */
  | { kind: "ammo"; type: MarinaraDamageType; wounds?: true }
  /** Magic damage of `type`, cast as if by a caster with `marinaraBombMagic(tier)` Magic and
   *  this power; on several foes each takes MARINARA area share (60%). */
  | { kind: "bomb"; type: MarinaraDamageType; power: number; area: boolean }
  | { kind: "buff"; stat: "damage" | "damage-taken" | "hit"; pct: number; turns: number; target: "ally" | "party" }
  | { kind: "shield"; pctOfMax: number }
  | { kind: "escape" }
  /** Permanent +amount to a stat, at most MARINARA_BOON_CAP times per stat per character. */
  | { kind: "boon"; stat: MarinaraStat; amount: number };

export interface MarinaraConsumableDef extends MarinaraItemLimits {
  id: string;
  /** The tier it first drops or is sold at; its price follows it. */
  tier: MarinaraTier;
  effect: MarinaraConsumableEffect;
  /** Never sold: found, stolen or given only. */
  found?: boolean;
  /** Price multiplier on the tier's consumable price (default 1). */
  priceMult?: number;
  names: MarinaraNames;
  summary: string;
}

export const MARINARA_BOON_CAP = 3;
/** Using an item is an action (the Apothecary's Item Savant makes items 50% stronger). */
export const MARINARA_ITEM_SAVANT_PCT = 0.5;

const consumable = (def: MarinaraConsumableDef) => def;

const COATING_NAMES: Record<string, MarinaraNames> = {
  "venom-vial": names(
    "Venom Vial",
    "Venom Vial",
    "Neurotoxin Cartridge",
    "Rat Poison",
    "Five-Venom Paste",
    "Arsenic Tin",
    "Sump Sludge",
  ),
  "fire-oil": names(
    "Fire Oil",
    "Fire Oil",
    "Thermite Gel",
    "Lighter Fluid",
    "Fire-Cloud Oil",
    "Bootleg Moonshine",
    "Gasoline Rag",
  ),
  "frost-salts": names(
    "Frost Salts",
    "Frost Salts",
    "Cryo Canister",
    "Freeze Spray",
    "Cold-Jade Powder",
    "Icebox Salts",
    "Coolant",
  ),
  "storm-flask": names(
    "Storm Flask",
    "Storm Flask",
    "Arc Coil",
    "Taser Cartridge",
    "Thunder Talisman",
    "Battery Clamps",
    "Jury-rigged Battery",
  ),
  "holy-water": names(
    "Holy Water",
    "Holy Water",
    "Hallowed Charge",
    "Holy Water",
    "Yang Talisman",
    "Holy Water",
    "Blessed Ash",
  ),
  "grave-dust": names(
    "Grave Dust",
    "Grave Dust",
    "Void Residue",
    "Grave Dirt",
    "Yin Talisman",
    "Graveyard Dirt",
    "Crater Ash",
  ),
};

/** Marksman ammunition, by the type it shoots, per setting. */
const AMMO_NAMES: Record<Exclude<MarinaraDamageType, "arcane">, MarinaraNames> = {
  slash: names(
    "Broadhead Ammo",
    "Broadhead Arrows",
    "Flechette Rounds",
    "Hollow-Point Rounds",
    "Crescent Arrows",
    "Dum-Dum Rounds",
    "Scrap-Blade Bolts",
  ),
  pierce: names(
    "Piercing Ammo",
    "Bodkin Arrows",
    "Penetrator Rounds",
    "Armor-Piercing Rounds",
    "Needle Arrows",
    "Steel-Core Rounds",
    "Rebar Bolts",
  ),
  blunt: names(
    "Blunt Ammo",
    "Blunt Arrows",
    "Kinetic Slugs",
    "Rubber Rounds",
    "Knob-Head Arrows",
    "Lead Slugs",
    "Bolt-Nut Shot",
  ),
  fire: names(
    "Fire Ammo",
    "Fire Arrows",
    "Plasma Cells",
    "Incendiary Rounds",
    "Fire-Crow Arrows",
    "Tracer Rounds",
    "Burning Bolts",
  ),
  ice: names(
    "Frost Ammo",
    "Frost Arrows",
    "Cryo Cells",
    "Cryo Rounds",
    "Cold-Jade Arrows",
    "Icebox Rounds",
    "Coolant Darts",
  ),
  lightning: names(
    "Storm Ammo",
    "Storm Arrows",
    "Arc Cells",
    "Taser Rounds",
    "Thunder Arrows",
    "Live-Wire Rounds",
    "Battery Bolts",
  ),
  light: names(
    "Holy Ammo",
    "Blessed Arrows",
    "Photon Cells",
    "Silver Rounds",
    "Yang Arrows",
    "Silver Bullets",
    "Glowstone Shot",
  ),
  wood: names(
    "Wood Ammo",
    "Thornwood Arrows",
    "Bio-Seed Cells",
    "Splinter Rounds",
    "Green-Bamboo Arrows",
    "Hickory Slugs",
    "Thorn Darts",
  ),
  earth: names(
    "Earth Ammo",
    "Stoneheart Arrows",
    "Regolith Slugs",
    "Frangible Clay Rounds",
    "Mountain-Stone Arrows",
    "Birdshot Shells",
    "Rock-Salt Shells",
  ),
  water: names(
    "Water Ammo",
    "Tideborn Arrows",
    "Hydro Cells",
    "Gel Rounds",
    "River-Spirit Arrows",
    "Brine Slugs",
    "Sludge Darts",
  ),
  metal: names(
    "Metal Ammo",
    "Ironheart Arrows",
    "Rail Slugs",
    "Steel-Core Rounds",
    "Golden-Edge Arrows",
    "Steel-Jacket Rounds",
    "Rebar Bolts",
  ),
  wind: names(
    "Wind Ammo",
    "Galefeather Arrows",
    "Vortex Cells",
    "Airburst Rounds",
    "Crane-Feather Arrows",
    "Whistler Rounds",
    "Kite-Fin Darts",
  ),
  dark: names(
    "Shadow Ammo",
    "Shadow Arrows",
    "Void Cells",
    "Cursed Rounds",
    "Yin Arrows",
    "Graveyard Rounds",
    "Crater-Ash Shot",
  ),
  poison: names(
    "Venom Ammo",
    "Venom Arrows",
    "Toxin Darts",
    "Tranquilizer Darts",
    "Five-Venom Arrows",
    "Arsenic Rounds",
    "Sump Darts",
  ),
};

const BOMB_ELEMENT_WORDS: Record<string, MarinaraNames> = {
  fire: names("Fire", "Fire", "Incendiary", "Fire", "Fire", "Fire", "Fire"),
  ice: names("Frost", "Frost", "Cryo", "Freeze", "Frost", "Icebox", "Coolant"),
  lightning: names("Storm", "Storm", "Arc", "Shock", "Thunder", "Spark", "Shock"),
  light: names("Sun", "Sun", "Photon", "Flash", "Sun", "Flash", "Flare"),
  dark: names("Shadow", "Shadow", "Void", "Shadow", "Shadow", "Shadow", "Shadow"),
  wood: names("Thorn", "Thorn", "Bio", "Thorn", "Wood", "Briar", "Thorn"),
  earth: names("Quake", "Quake", "Seismic", "Concussion", "Earth", "Rockfall", "Rubble"),
  water: names("Tide", "Tide", "Hydro", "Water", "Water", "Flood", "Bilge"),
  metal: names("Shrapnel", "Shrapnel", "Flechette", "Frag", "Metal", "Shrapnel", "Nail"),
  wind: names("Gale", "Gale", "Vortex", "Blast", "Wind", "Cyclone", "Dust-Devil"),
};
const BOMB_NOUNS: Record<MarinaraItemSetting | "neutral", readonly [string, string, string]> = {
  neutral: ["Bomb", "Grenade", "Great Bomb"],
  fantasy: ["Pot", "Grenado", "Great Grenado"],
  scifi: ["Charge", "Grenade", "Cluster Grenade"],
  modern: ["Cocktail", "Grenade", "Charge Pack"],
  wuxia: ["Paper Talisman", "Talisman Bundle", "Heaven Talisman"],
  jazz_age: ["Bottle", "Pineapple", "Satchel Charge"],
  wasteland: ["Jar", "Pipe Bomb", "Barrel Bomb"],
};
/** Bomb ranks: one foe at T1, every foe at T3, every foe harder at T5. */
const BOMB_RANKS = [
  { rank: 1, tier: 1, power: 8, area: false },
  { rank: 2, tier: 3, power: 8, area: true },
  { rank: 3, tier: 5, power: 14, area: true },
] as const;

const BOON_NOUNS: MarinaraNames = names(
  "Boon",
  "Tincture",
  "Gene-tweak",
  "Training Regimen",
  "Marrow-Washing Pill",
  "Correspondence Course",
  "Mutagen",
);
const statLabel = (stat: MarinaraStat) => (stat === "hp" ? "HP" : `${stat[0]!.toUpperCase()}${stat.slice(1)}`);

export const MARINARA_CONSUMABLES: readonly MarinaraConsumableDef[] = [
  // Healing
  consumable({
    id: "heal-1",
    tier: 1,
    effect: { kind: "heal", pct: 0.3, target: "ally" },
    names: names("Tonic", "Hearthroot Tonic", "Med-gel", "First-Aid Kit", "Herbal Salve", "Liniment", "Boiled Rags"),
    summary: "Restores 30% HP to one ally.",
  }),
  consumable({
    id: "heal-2",
    tier: 3,
    effect: { kind: "heal", pct: 0.5, target: "ally" },
    names: names(
      "Restorative",
      "Redcap Draught",
      "Nanite Shot",
      "Trauma Kit",
      "Blood-Restoring Pill",
      "Patent Tonic",
      "Med-Kit",
    ),
    summary: "Restores 50% HP to one ally.",
  }),
  consumable({
    id: "heal-3",
    tier: 5,
    effect: { kind: "heal", pct: 0.8, target: "ally" },
    names: names(
      "Grand Restorative",
      "Lifeblood Cordial",
      "Regen Cascade",
      "Surgeon's Bag",
      "Nine-Turn Golden Pill",
      "Doctor's Bag",
      "Pre-Fall Med-Kit",
    ),
    summary: "Restores 80% HP to one ally.",
  }),
  consumable({
    id: "heal-party",
    tier: 4,
    priceMult: 3,
    effect: { kind: "heal", pct: 0.3, target: "party" },
    names: names(
      "Shared Tonic",
      "Mending Incense",
      "Med-drone",
      "Paramedic Bag",
      "Restoring Incense",
      "Rounds on the House",
      "Clinic Crate",
    ),
    summary: "Restores 30% HP to the whole party.",
  }),
  consumable({
    id: "mp-1",
    tier: 2,
    priceMult: 1.5,
    effect: { kind: "mp", pct: 0.25 },
    names: names(
      "Focus Draught",
      "Wellwater Vial",
      "Psi-booster",
      "Espresso Shot",
      "Qi-Gathering Pill",
      "Cup of Joe",
      "Sugar Ration",
    ),
    summary: "Restores 25% MP (MP does not come back on its own in a fight).",
  }),
  consumable({
    id: "mp-2",
    tier: 4,
    priceMult: 1.5,
    effect: { kind: "mp", pct: 0.5 },
    names: names(
      "Deep Focus Draught",
      "Starwell Draught",
      "Psi-surge Ampoule",
      "Nootropic Shot",
      "Meridian-Opening Pill",
      "Absinthe",
      "Pre-Fall Cola",
    ),
    summary: "Restores 50% MP.",
  }),
  consumable({
    id: "stamina-1",
    tier: 1,
    priceMult: 0.5,
    effect: { kind: "stamina", pct: 0.4 },
    names: names(
      "Trail Ration",
      "Hard-tack",
      "Ration Bar",
      "Energy Bar",
      "Steamed Buns",
      "Ham Sandwich",
      "Canned Food",
    ),
    summary: "Restores 40% stamina.",
  }),
  consumable({
    id: "revive-1",
    tier: 3,
    priceMult: 4,
    effect: { kind: "revive", pct: 0.25 },
    names: names(
      "Waking Draught",
      "Wakeleaf",
      "Restart Ampoule",
      "Adrenaline Shot",
      "Soul-Recalling Pill",
      "Doctor's Brandy",
      "Kick-start Syringe",
    ),
    summary: "Brings a downed ally back at 25% HP.",
  }),
  consumable({
    id: "revive-2",
    tier: 5,
    priceMult: 4,
    effect: { kind: "revive", pct: 0.5 },
    names: names(
      "Rekindling Draught",
      "Dawnbloom",
      "Full-restart Ampoule",
      "Defibrillator",
      "Seven-Lives Pill",
      "Doctor on Call",
      "Jumper Cables",
    ),
    summary: "Brings a downed ally back at 50% HP.",
  }),
  // Cleanses: one per status the overhaul's foes lay, and a cure-all
  consumable({
    id: "cure-bleed",
    tier: 1,
    priceMult: 0.5,
    effect: { kind: "cleanse", statuses: ["bleed"] },
    names: names(
      "Bandage",
      "Linen Bandage",
      "Wound Sealer",
      "Gauze Roll",
      "Silk Binding",
      "Clean Handkerchief",
      "Duct Tape",
    ),
    summary: "Stops bleeding.",
  }),
  consumable({
    id: "cure-poison",
    tier: 1,
    priceMult: 0.5,
    effect: { kind: "cleanse", statuses: ["poison"] },
    names: names(
      "Antidote",
      "Snakeroot",
      "Detox Shot",
      "Antivenom",
      "Toxin-Expelling Pill",
      "Charcoal Tonic",
      "Charcoal Biscuit",
    ),
    summary: "Cures poison.",
  }),
  consumable({
    id: "cure-mind",
    tier: 1,
    priceMult: 0.75,
    effect: { kind: "cleanse", statuses: ["sleep", "confuse", "stun"] },
    names: names(
      "Waking Salts",
      "Sharpmint",
      "Reflex Stim",
      "Ammonia Inhalant",
      "Clear-Mind Incense",
      "Smelling Salts",
      "Cold Water Bucket",
    ),
    summary: "Wakes, steadies and un-stuns one ally.",
  }),
  consumable({
    id: "cure-wither",
    tier: 2,
    priceMult: 0.75,
    effect: { kind: "cleanse", statuses: ["wither"] },
    names: names(
      "Restoring Salt",
      "Greenbud Salve",
      "Cell Stabiliser",
      "Saline Drip",
      "Vitality Pill",
      "Spa Water",
      "Clean Water",
    ),
    summary: "Cures wither.",
  }),
  consumable({
    id: "cure-wound",
    tier: 2,
    priceMult: 0.75,
    effect: { kind: "cleanse", statuses: ["wound"] },
    names: names(
      "Clotting Balm",
      "Knitbone Balm",
      "Coagulant Gel",
      "Suture Kit",
      "Bone-Mending Plaster",
      "Iodine",
      "Superglue",
    ),
    summary: "Cures Wound (healing works fully again).",
  }),
  consumable({
    id: "cure-slow",
    tier: 2,
    priceMult: 0.75,
    effect: { kind: "cleanse", statuses: ["slow"] },
    names: names(
      "Quickening Draught",
      "Quicksilver Tea",
      "Reflex Booster",
      "Caffeine Pills",
      "Wind-Step Pill",
      "Pep Pills",
      "Rust Coffee",
    ),
    summary: "Cures slow.",
  }),
  consumable({
    id: "cure-all",
    tier: 4,
    priceMult: 2,
    effect: { kind: "cleanse", statuses: MARINARA_STATUSES.filter((status) => status !== "doom") },
    names: names(
      "Cure-All",
      "Allheal Draught",
      "Full Purge",
      "ER Kit",
      "Hundred-Herb Pill",
      "Genuine Snake Oil",
      "Clinic Cocktail",
    ),
    summary: "Cures every status but Doom.",
  }),
  consumable({
    id: "cure-doom",
    tier: 5,
    found: true,
    effect: { kind: "cleanse", statuses: ["doom"] },
    excludeKits: ["modern_day"],
    names: names(
      "Unwriting Ink",
      "Unwriting Ink",
      "Probability Reset",
      "Saint's Relic",
      "Fate-Severing Talisman",
      "Fortune-Teller's Refund",
      "Broken Clock",
    ),
    summary: "Lifts Doom before it falls. Found, never sold.",
  }),
  // Coatings (MARINARA_WEAPON_COATINGS): a rider on weapon hits for MARINARA_COATING_TURNS turns.
  ...MARINARA_WEAPON_COATINGS.map((coating) =>
    consumable({
      id: coating.id,
      // Light and dark from T1 too: a party of fighters meeting its first ghost needs an answer.
      tier: 1,
      effect: { kind: "coat", rider: coating.rider },
      ...(coating.rider === "light" || coating.rider === "dark" ? { excludeKits: ["modern_day"] } : {}),
      names: COATING_NAMES[coating.id]!,
      summary: `Coats a weapon: hits carry ${coating.rider} on top (${coating.rider === "poison" ? "poisons" : "40% of the hit"}) for 5 turns.`,
    }),
  ),
  // Ammunition: a Marksman's bow or gun shoots any type the party owns (Alyssa 2026-11-01). Kept, not
  // spent, so it costs more than a use-once item: martial types a little, elements more.
  ...MARINARA_DAMAGE_TYPES.filter((type) => type !== "arcane").map((type) =>
    consumable({
      id: `ammo-${type}`,
      tier: 1,
      effect: { kind: "ammo", type },
      ...(type === "light" || type === "dark" ? { excludeKits: ["modern_day"] } : {}),
      priceMult: (MARINARA_PHYSICAL_TYPES as readonly string[]).includes(type) ? 3 : 5,
      names: AMMO_NAMES[type],
      summary: `Ammunition: a Marksman's bow or gun can shoot ${type} once the party owns it. Loaded by hand mid-fight; never used up.`,
    }),
  ),
  // Serrated ammunition (Alyssa 2026-11-03: the Marksman's anti-heal comes as an ammo type): pierce
  // shots that also open a Wound (healing halved) for 3 turns.
  consumable({
    id: "ammo-serrated",
    tier: 2,
    effect: { kind: "ammo", type: "pierce", wounds: true },
    priceMult: 5,
    names: names(
      "Serrated Ammo",
      "Barbed Arrows",
      "Shredder Flechettes",
      "Serrated Rounds",
      "Wolf-Tooth Arrows",
      "Notched Rounds",
      "Hacksaw Bolts",
    ),
    summary: "Ammunition: a Marksman's pierce shots also open a Wound (healing halved) for 3 turns. Never used up.",
  }),
  // Bombs: elemental damage that runs on no one's stats
  ...Object.keys(BOMB_ELEMENT_WORDS).flatMap((element) =>
    BOMB_RANKS.map((rank) =>
      consumable({
        id: `bomb-${element}-${rank.rank}`,
        tier: rank.tier as MarinaraTier,
        effect: { kind: "bomb", type: element as MarinaraDamageType, power: rank.power, area: rank.area },
        ...(element === "dark" ? { excludeKits: ["modern_day"] } : {}),
        names: Object.fromEntries(
          Object.keys(BOMB_NOUNS).map((setting) => [
            setting,
            `${BOMB_ELEMENT_WORDS[element]![setting as MarinaraItemSetting | "neutral"]} ${BOMB_NOUNS[setting as MarinaraItemSetting | "neutral"][rank.rank - 1]}`,
          ]),
        ) as MarinaraNames,
        summary: `${element[0]!.toUpperCase()}${element.slice(1)} damage to ${rank.area ? "every foe (60% each)" : "one foe"}, as a ${rank.rank === 3 ? "strong" : "plain"} spell.`,
      }),
    ),
  ),
  // Battle tonics
  consumable({
    id: "tonic-might",
    tier: 2,
    effect: { kind: "buff", stat: "damage", pct: 0.2, turns: 3, target: "ally" },
    names: names(
      "Might Tonic",
      "Bull's Blood",
      "Combat Stim",
      "Energy Shot",
      "Tiger-Strength Pill",
      "Hair of the Dog",
      "Battle Jerky",
    ),
    summary: "+20% damage for 3 turns.",
  }),
  consumable({
    id: "tonic-guard",
    tier: 2,
    effect: { kind: "buff", stat: "damage-taken", pct: -0.25, turns: 3, target: "ally" },
    names: names(
      "Ironskin Tonic",
      "Ironbark Tea",
      "Dermal Hardener",
      "Painkillers",
      "Iron-Shirt Pill",
      "Stiff Drink",
      "Scrap Vest Patch",
    ),
    summary: "Takes 25% less damage for 3 turns.",
  }),
  consumable({
    id: "barrier-scroll",
    tier: 3,
    priceMult: 1.5,
    effect: { kind: "shield", pctOfMax: 0.25 },
    names: names(
      "Ward Scroll",
      "Ward Scroll",
      "Shield Projector",
      "Kevlar Blanket",
      "Golden Bell Talisman",
      "Lucky Horseshoe",
      "Hubcap",
    ),
    summary: "A shield worth 25% of the ally's max HP.",
  }),
  consumable({
    id: "smoke-bomb",
    tier: 1,
    effect: { kind: "escape" },
    names: names(
      "Smoke Bomb",
      "Smoke Pot",
      "Chaff Grenade",
      "Smoke Grenade",
      "Smoke Pellet",
      "Spilled Marbles",
      "Dust Flare",
    ),
    summary: "The party flees a fight that isn't a boss fight.",
  }),
  // Boons: permanent, boss drops only
  ...MARINARA_STATS.map((stat) =>
    consumable({
      id: `boon-${stat}`,
      tier: 3,
      found: true,
      effect: { kind: "boon", stat, amount: stat === "hp" ? 3 : 1 },
      names: Object.fromEntries(
        Object.entries(BOON_NOUNS).map(([setting, noun]) => [setting, `${noun} of ${statLabel(stat)}`]),
      ) as MarinaraNames,
      summary: `Permanently +${stat === "hp" ? 3 : 1} ${statLabel(stat)} (at most ${MARINARA_BOON_CAP} per stat per character). Found, never sold.`,
    }),
  ),
];

export function marinaraConsumable(id: string): MarinaraConsumableDef | undefined {
  return MARINARA_CONSUMABLES.find((def) => def.id === id);
}

/** The Magic a bomb of this tier is thrown with: an expected Channeler's at the tier's first level. */
/**
 * The ammunition types the party's bags hold, from their items' names (any setting's name, or the
 * item's id): what a Marksman's bow or gun can load in a fight.
 */
export function marinaraOwnedAmmo(itemNames: readonly string[]): MarinaraDamageType[] {
  const held = new Set(itemNames.map((name) => name.trim().toLowerCase()));
  return MARINARA_CONSUMABLES.flatMap((def) =>
    def.effect.kind === "ammo" &&
    (held.has(def.id) || Object.values(def.names).some((name) => held.has(name.toLowerCase())))
      ? [def.effect.type]
      : [],
  );
}

/** Whether the party's bags hold wounding ammunition (Serrated): its Marksmen's pierce shots wound. */
export function marinaraOwnsWoundingAmmo(itemNames: readonly string[]): boolean {
  const held = new Set(itemNames.map((name) => name.trim().toLowerCase()));
  return MARINARA_CONSUMABLES.some(
    (def) =>
      def.effect.kind === "ammo" &&
      !!def.effect.wounds &&
      (held.has(def.id) || Object.values(def.names).some((name) => held.has(name.toLowerCase()))),
  );
}

export function marinaraBombMagic(tier: MarinaraTier): number {
  return Math.round(expectedMarinaraStats("channeler", (tier - 1) * MARINARA_LEVELS_PER_TIER + 1).magic);
}

// ── Item ids ──

export type MarinaraItemKind = "weapon" | "armour" | "accessory" | "consumable";
export interface MarinaraItemRef {
  id: string;
  kind: MarinaraItemKind;
  tier: MarinaraTier;
  /** Weapon or armour family, for tiered gear and uniques built on one. */
  family?: string;
  unique?: MarinaraUniqueDef;
  accessory?: MarinaraAccessoryDef;
  consumable?: MarinaraConsumableDef;
}

const TIERED = /^([a-z]+)-t([1-6])$/;

/** Reads any item id: `<family>-t<tier>` gear, a unique, an accessory or a consumable. */
export function marinaraItem(id: string): MarinaraItemRef | undefined {
  const tiered = TIERED.exec(id);
  if (tiered) {
    const tier = Number(tiered[2]) as MarinaraTier;
    if (marinaraWeaponFamily(tiered[1]!)) return { id, kind: "weapon", tier, family: tiered[1] };
    if (marinaraArmourFamily(tiered[1]!)) return { id, kind: "armour", tier, family: tiered[1] };
    return undefined;
  }
  const unique = marinaraUnique(id);
  if (unique)
    return {
      id,
      kind: unique.slot === "armour" ? "armour" : unique.slot,
      tier: unique.tier,
      ...(unique.family ? { family: unique.family } : {}),
      unique,
    };
  const accessory = marinaraAccessory(id);
  if (accessory) return { id, kind: "accessory", tier: accessory.tier, accessory };
  const consumable = marinaraConsumable(id);
  if (consumable) return { id, kind: "consumable", tier: consumable.tier, consumable };
  return undefined;
}

/** Whether a game in this place can have the item at all. */
export function marinaraItemInPlace(id: string, place: MarinaraItemPlace): boolean {
  const item = marinaraItem(id);
  if (!item) return false;
  const limits: MarinaraItemLimits =
    item.unique ??
    item.accessory ??
    item.consumable ??
    (item.kind === "weapon" ? marinaraWeaponFamily(item.family!)! : marinaraArmourFamily(item.family!)!);
  if (!marinaraItemAllowed(limits, place)) return false;
  // A unique also needs a name in the setting (and a neutral game has none of them).
  if (item.unique) return Boolean(place.setting && item.unique.names[place.setting]);
  return true;
}

/** An item's name in this place, before the game renames anything. */
export function marinaraItemName(id: string, place: MarinaraItemPlace): string {
  const item = marinaraItem(id);
  if (!item) return id;
  const key = place.setting ?? "neutral";
  if (item.unique) return item.unique.names[key] ?? Object.values(item.unique.names)[0] ?? id;
  if (item.accessory) return item.accessory.names[key];
  if (item.consumable) return item.consumable.names[key];
  const family =
    item.kind === "weapon" ? marinaraWeaponFamily(item.family!)!.names : marinaraArmourFamily(item.family!)!.names;
  return `${MARINARA_GRADES[key][item.tier - 1]} ${family[key]}`;
}

// ── Equipping ──

/** What a character wears: item ids (Engine build thread, 2026-10-31: stored on the game card). */
export interface MarinaraEquipment {
  weapon?: string;
  armor?: string;
  accessories?: readonly string[];
}
export const MARINARA_ACCESSORY_SLOTS = 2;

/** Whether a character in this class can equip the item in that slot. */
export function marinaraCanEquip(classId: string, itemId: string, slot: "weapon" | "armor" | "accessory"): boolean {
  const def = marinaraClass(classId);
  const item = marinaraItem(itemId);
  if (!def || !item) return false;
  if (slot === "weapon") {
    if (item.kind !== "weapon") return false;
    const family = marinaraWeaponFamily(item.family!)!;
    if (!marinaraWeaponTypes(classId).includes(family.type)) return false;
    // A class that widens its weapons (Weaponmaster) takes any melee non-focus weapon of those types.
    if (def.weapons && family.range === "melee" && family.might !== null) return true;
    return family.archetypes.includes(def.archetype);
  }
  if (slot === "armor") {
    if (item.kind !== "armour") return false;
    return marinaraArmourFamily(item.family!)!.archetypes.includes(def.archetype);
  }
  if (item.kind !== "accessory") return false;
  const archetypes = item.accessory?.archetypes ?? (item.unique?.id === "bellwether" ? ["guard"] : undefined);
  return !archetypes || archetypes.includes(def.archetype);
}

/** Everything a character's gear adds, for the fight math (marinara-combat.ts) to apply. */
export interface MarinaraGearBonus {
  /** Added to every weapon hit's power (replaces the lab's level × powerPerLevel). */
  power: number;
  /** Added to every spell's power. */
  spellPower: number;
  /** Added to the character's stats; Speed already includes the weight penalty. */
  stats: Partial<MarinaraStats>;
  /** The equipped weapon's damage type, for skills that hit with "weapon". */
  weaponType?: MarinaraDamageType;
  ranged?: boolean;
  affinities?: MarinaraAffinities;
  immune: MarinaraStatus[];
  effects: MarinaraGearEffects;
  weight: number;
}

/** Weight: every `strengthPerPoint` Strength carries a point; each point beyond costs `speedPerPoint` Speed. */
export const MARINARA_WEIGHT = { strengthPerPoint: 2, speedPerPoint: 0.5 } as const;

const AFFINITY_RANK: Record<MarinaraAffinity, number> = { weak: 0, resist: 1, immune: 2, absorb: 3 };

/**
 * What a character's equipment adds. `strength` (the character's own) offsets weight
 * (MARINARA_WEIGHT): every 2 Strength carries a point; past that, 2 points cost 1 Speed.
 */
export function marinaraGearBonus(
  equipment: MarinaraEquipment | null | undefined,
  options: { strength?: number } = {},
): MarinaraGearBonus {
  const out: MarinaraGearBonus = { power: 0, spellPower: 0, stats: {}, immune: [], effects: {}, weight: 0 };
  if (!equipment) return out;
  const addStats = (stats: Partial<MarinaraStats> | undefined) => {
    for (const [stat, value] of Object.entries(stats ?? {}))
      out.stats[stat as MarinaraStat] = (out.stats[stat as MarinaraStat] ?? 0) + (value ?? 0);
  };
  const addEffects = (effects: MarinaraGearEffects | undefined) => {
    if (!effects) return;
    for (const key of NUMERIC_EFFECTS) {
      const value = effects[key];
      if (value) out.effects[key] = (out.effects[key] ?? 0) + value;
    }
    if (effects.reachPct) out.effects.reachPct = Math.max(out.effects.reachPct ?? 0, effects.reachPct);
    if (effects.goldPct) out.effects.goldPct = Math.max(out.effects.goldPct ?? 0, effects.goldPct);
    if (effects.firstHitCrit) out.effects.firstHitCrit = true;
    if (effects.vanguard) out.effects.vanguard = true;
    if (effects.cleanseOnHeal) out.effects.cleanseOnHeal = true;
    if (effects.onHit && (!out.effects.onHit || effects.onHit.chance > out.effects.onHit.chance))
      out.effects.onHit = effects.onHit;
  };
  const addAffinities = (affinities: MarinaraAffinities | undefined) => {
    for (const [type, affinity] of Object.entries(affinities ?? {})) {
      out.affinities ??= {};
      const had = out.affinities[type as MarinaraDamageType];
      if (!had || AFFINITY_RANK[affinity!] > AFFINITY_RANK[had]) out.affinities[type as MarinaraDamageType] = affinity;
    }
  };
  const addImmune = (statuses: readonly MarinaraStatus[] | undefined) => {
    for (const status of statuses ?? []) if (!out.immune.includes(status)) out.immune.push(status);
  };

  const weapon = equipment.weapon ? marinaraItem(equipment.weapon) : undefined;
  if (weapon?.kind === "weapon") {
    const family = marinaraWeaponFamily(weapon.family!)!;
    out.power = family.might === null ? 0 : Math.max(0, weapon.tier + family.might + (weapon.unique?.might ?? 0));
    out.spellPower = family.spell === null ? 0 : Math.max(0, weapon.tier + family.spell + (weapon.unique?.spell ?? 0));
    out.weaponType = family.type;
    out.ranged = family.range === "ranged";
    out.weight += family.weight;
    addEffects({ ...family.effects, hit: family.hit || undefined, crit: family.crit || undefined });
    addEffects(weapon.unique?.effects);
    addStats(weapon.unique?.stats);
    addAffinities(weapon.unique?.affinities);
    addImmune(weapon.unique?.immune);
  }
  const armour = equipment.armor ? marinaraItem(equipment.armor) : undefined;
  if (armour?.kind === "armour") {
    const family = marinaraArmourFamily(armour.family!)!;
    addStats({
      defense: Math.round(armour.tier * family.defense),
      resistance: Math.round(armour.tier * family.resistance),
    });
    out.weight += family.weight;
    addEffects(family.effects);
    addEffects(armour.unique?.effects);
    addStats(armour.unique?.stats);
    addAffinities(armour.unique?.affinities);
    addImmune(armour.unique?.immune);
  }
  for (const id of (equipment.accessories ?? []).slice(0, MARINARA_ACCESSORY_SLOTS)) {
    const item = marinaraItem(id);
    if (item?.kind !== "accessory") continue;
    const def = item.accessory ?? item.unique!;
    addStats(def.stats);
    addEffects(def.effects);
    addAffinities(def.affinities);
    addImmune(def.immune);
    out.weight += item.accessory?.weight ?? (item.unique?.id === "bellwether" ? 2 : 0);
  }
  const carried = Math.floor((options.strength ?? 0) / MARINARA_WEIGHT.strengthPerPoint);
  const slowed = Math.floor(Math.max(0, out.weight - carried) * MARINARA_WEIGHT.speedPerPoint);
  if (slowed) out.stats.speed = (out.stats.speed ?? 0) - slowed;
  return out;
}

/**
 * The gear a character of this archetype is expected to have at a tier: the standard family of its
 * tree at that tier (what the class lab's power budget stands for). Humanoid foes built on the class
 * trees carry it too.
 */
export const MARINARA_STANDARD_GEAR: Readonly<Record<MarinaraArchetype, { weapon: string; armour: string }>> = {
  blade: { weapon: "longblade", armour: "mail" },
  guard: { weapon: "spear", armour: "plate" },
  scout: { weapon: "rapier", armour: "leathers" },
  marksman: { weapon: "bow", armour: "leathers" },
  channeler: { weapon: "staff", armour: "robes" },
  hexer: { weapon: "staff", armour: "robes" },
  mender: { weapon: "staff", armour: "robes" },
  herald: { weapon: "longblade", armour: "mail" },
};

export function marinaraStandardEquipment(archetype: MarinaraArchetype, tier: MarinaraTier): MarinaraEquipment {
  const gear = MARINARA_STANDARD_GEAR[archetype];
  return { weapon: `${gear.weapon}-t${tier}`, armor: `${gear.armour}-t${tier}`, accessories: [] };
}

/**
 * What a fighter wears: its own pieces, and the class's standard kit for its tier in any empty weapon
 * or armour slot, so a looted ring never costs the kit's sword (items playtest I1, 2026-11-01).
 */
export function marinaraWornEquipment(
  archetype: MarinaraArchetype,
  tier: MarinaraTier,
  equipment: MarinaraEquipment | null | undefined,
): MarinaraEquipment {
  const standard = marinaraStandardEquipment(archetype, tier);
  return {
    weapon: equipment?.weapon ?? standard.weapon,
    armor: equipment?.armor ?? standard.armor,
    accessories: [...(equipment?.accessories ?? [])],
  };
}

/**
 * A rough worth of gear for comparing two pieces for one wearer: the power its attacks run on (spell
 * power for a caster, weapon power otherwise; the other is no use to it), plus every stat it gives,
 * the Speed its weight costs at the wearer's Strength included.
 */
export function marinaraGearScore(
  equipment: MarinaraEquipment | null | undefined,
  options: { strength?: number; caster?: boolean } = {},
): number {
  const bonus = marinaraGearBonus(equipment, options.strength === undefined ? {} : { strength: options.strength });
  return (
    (options.caster ? bonus.spellPower : bonus.power) +
    Object.values(bonus.stats).reduce((sum, value) => sum + (value ?? 0), 0)
  );
}

/**
 * Whether a weapon or armour is worth less to this wearer than the standard kit's piece the slot would
 * fall back to. A caster is one whose standard weapon gives more spell power than weapon power.
 */
export function marinaraBelowStandard(
  id: string,
  slot: "weapon" | "armor",
  archetype: MarinaraArchetype,
  tier: MarinaraTier,
  strength?: number,
): boolean {
  const standard = marinaraStandardEquipment(archetype, tier);
  const kit = marinaraGearBonus({ weapon: standard.weapon });
  const options = { ...(strength === undefined ? {} : { strength }), caster: kit.spellPower > kit.power };
  return marinaraGearScore({ [slot]: id }, options) < marinaraGearScore({ [slot]: standard[slot] }, options);
}

// ── Prices ──

/**
 * Prices are in marks, an abstract coin; a setting turns a mark into its own smallest coin
 * (`MARINARA_MARK_VALUE`), so a T1 sword costs about 6 gold in a fantasy kit, 120 dollars in a
 * modern one and 60 scrip in the wasteland, close to what those kits' own shops ask.
 * Everything doubles each tier. A party re-gearing (weapon, armour, half an accessory each) spends
 * about 60% of a tier's fight gold; the rest goes on consumables.
 */
export const MARINARA_PRICES = {
  weapon: 60,
  armour: 50,
  accessory: 40,
  consumable: 8,
  perTier: 2,
  /** Selling gives back this share. */
  sellBack: 0.5,
} as const;

/** Marks to the kit's smallest coin unit (world/starter-kits.ts `money.units`). */
export const MARINARA_MARK_VALUE: Readonly<Record<MarinaraItemSetting | "neutral", number>> = {
  neutral: 1,
  fantasy: 10,
  scifi: 10,
  modern: 200,
  wuxia: 30,
  jazz_age: 25,
  wasteland: 1,
};

const tierPrice = (base: number, tier: number) => base * MARINARA_PRICES.perTier ** (tier - 1);

/** An item's price in marks, or null when it is never sold. */
export function marinaraItemPrice(id: string): number | null {
  const item = marinaraItem(id);
  if (!item || item.unique) return null;
  if (item.kind === "weapon") {
    const family = marinaraWeaponFamily(item.family!)!;
    // Heavier families cost a little more; foci and the light ones a little less.
    return Math.round(tierPrice(MARINARA_PRICES.weapon, item.tier) * (1 + 0.04 * (family.weight - 5)));
  }
  if (item.kind === "armour") return Math.round(tierPrice(MARINARA_PRICES.armour, item.tier));
  if (item.accessory) {
    if (item.accessory.found) return null;
    return Math.round(tierPrice(MARINARA_PRICES.accessory, item.tier) * (item.accessory.rank === 1 ? 1 : 1.2));
  }
  const def = item.consumable!;
  if (def.found) return null;
  return Math.max(1, Math.round(tierPrice(MARINARA_PRICES.consumable, def.tier) * (def.priceMult ?? 1)));
}

/** A price in marks as the place's own smallest coin. */
export function marinaraPriceInCoin(marks: number, place: MarinaraItemPlace): number {
  return Math.round(marks * MARINARA_MARK_VALUE[place.setting ?? "neutral"]);
}

// ── Loot ──

/** How hard a foe is within its tier (the bestiary's ranks), and what it pays out. */
export const MARINARA_FOE_RANKS = ["minion", "standard", "elite", "boss"] as const;
export type MarinaraFoeRank = (typeof MARINARA_FOE_RANKS)[number];

export const MARINARA_LOOT = {
  /** Gold a standard foe drops at T1, in marks; doubles each tier. */
  gold: 12,
  goldRank: { minion: 0.5, standard: 1, elite: 2.5, boss: 8 },
  /** Chance each foe drops a consumable, and gear. */
  consumable: { minion: 0.15, standard: 0.25, elite: 0.5, boss: 1 },
  gear: { minion: 0, standard: 0.04, elite: 0.25, boss: 1 },
  /** A gear drop from an elite or boss is a tier higher this often (never above T6). */
  tierUp: 0.1,
  /** A boss at T4+ drops a unique this often (instead of plain gear); an elite at T5+ rarely. */
  unique: { elite: 0.03, boss: 0.3 },
  /** A boss at T3+ also drops a boon this often. */
  boon: 0.2,
} as const;

/** A foe in a won fight: its rank, its bestiary family id if it has one, and its tier. */
export interface MarinaraLootFoe {
  rank: MarinaraFoeRank;
  family?: string;
  tier?: MarinaraTier;
  /** Beasts and spirits carry no coin: they drop half gold (their hide, a trophy, what they hoarded). */
  carriesCoin?: boolean;
  /** Got away (fled): drops only the coin it lost in the scramble, half its gold, no items. */
  fled?: boolean;
  /** A treasure foe's purse, as multiples of a standard foe's coin (and never halved for no purse). */
  coinScale?: number;
}

/**
 * Signature drops by bestiary family id (marinara-bestiary.ts): what that kind of foe is known for
 * (a stinger's venom, a drake's scales as plate, a sellsword's own blade). The first entry is its
 * common drop (a consumable); the rest is gear. `-t*` takes the foe's tier and `-*` the rank for it
 * (I at T1-2, II at T3-4, III at T5-6, or the highest that exists).
 */
export const MARINARA_FAMILY_DROPS: Readonly<Record<string, readonly string[]>> = {
  gnawer: ["cure-bleed"],
  hound: ["cure-bleed", "leathers-t*"],
  tusker: ["stamina-1", "leathers-t*"],
  "great-beast": ["heal-*", "leathers-t*", "charm-vigor-*"],
  raptor: ["storm-flask", "charm-speed-*"],
  stinger: ["venom-vial", "guard-poison"],
  serpent: ["venom-vial", "leathers-t*", "guard-poison"],
  stalker: ["cure-bleed", "knife-t*", "charm-keen-*"],
  gel: ["cure-poison", "charm-vigor-*"],
  thornling: ["cure-wither", "wand-t*", "guard-poison"],
  bones: ["grave-dust", "greatblade-t*", "mail-t*"],
  gorger: ["grave-dust", "guard-wound"],
  shade: ["grave-dust", "ward-dark", "charm-resistance-*"],
  "grave-duelist": ["grave-dust", "longblade-t*", "rapier-t*", "mail-t*"],
  "cinder-spirit": ["fire-oil", "ward-fire"],
  "rime-spirit": ["frost-salts", "ward-ice"],
  "storm-spirit": ["storm-flask", "ward-lightning"],
  fiend: ["fire-oil", "ward-fire", "wand-t*"],
  drake: ["fire-oil", "ward-fire", "plate-t*"],
  lout: ["stamina-1", "maul-t*", "charm-strength-*"],
  "night-courtier": ["grave-dust", "rapier-t*", "guard-confuse", "charm-luck-*"],
  cutpurse: ["smoke-bomb", "knife-t*", "charm-light-fingers"],
  sellsword: ["tonic-might", "longblade-t*", "greatblade-t*", "mail-t*"],
  shieldbearer: ["tonic-guard", "shield-*", "spear-t*", "plate-t*"],
  shooter: ["venom-vial", "bow-t*", "greatbow-t*", "sling-t*"],
  adept: ["mp-*", "staff-t*", "robes-t*", "charm-magic-*"],
  cultist: ["cure-wound", "wand-t*", "stiletto-t*", "robes-t*"],
  "field-medic": ["heal-*", "censer-t*", "mace-t*"],
  captain: ["tonic-might", "longblade-t*", "spear-t*", "charm-early-riser"],
  brawler: ["stamina-1", "charm-strength-*", "leathers-t*"],
  warder: ["storm-flask", "plate-t*", "charm-defense-*"],
  drone: ["storm-flask", "charm-hawkeye-*"],
  turret: ["storm-flask", "greatbow-t*", "charm-hawkeye-*"],
};

/** A family's signature drops at a tier, resolved to item ids and left out where they don't belong. */
export function marinaraFamilyDrops(
  family: string | undefined,
  tier: MarinaraTier,
  place: MarinaraItemPlace,
): string[] {
  const entries = family ? MARINARA_FAMILY_DROPS[family] : undefined;
  if (!entries) return [];
  const out: string[] = [];
  for (const entry of entries) {
    let id: string | undefined = entry;
    if (entry.endsWith("-t*")) id = `${entry.slice(0, -1)}${tier}`;
    else if (entry.endsWith("-*")) {
      id = undefined;
      for (let rank = Math.min(3, Math.ceil(tier / 2)); rank >= 1 && !id; rank--)
        if (marinaraItem(`${entry.slice(0, -1)}${rank}`)) id = `${entry.slice(0, -1)}${rank}`;
    }
    // Nothing above the foe's tier: a T1 stinger keeps its venom but not the T2 antitoxin charm.
    if (id && marinaraItemInPlace(id, place) && marinaraItem(id)!.tier <= tier) out.push(id);
  }
  return out;
}
/** A foe with a signature list drops from it this often instead of the tier table. */
export const MARINARA_SIGNATURE_CHANCE = 0.5;

/** The consumables a tier's fights drop, weighted (heals and cures most). */
export function marinaraConsumableTable(tier: MarinaraTier, place: MarinaraItemPlace): Array<[string, number]> {
  return MARINARA_CONSUMABLES.filter(
    (def) => !def.found && def.tier <= tier && def.tier >= tier - 2 && marinaraItemAllowed(def, place),
  ).map((def) => {
    const kind = def.effect.kind;
    const weight =
      kind === "heal"
        ? 6
        : kind === "cleanse"
          ? 3
          : kind === "mp" || kind === "stamina"
            ? 4
            : kind === "revive" || kind === "ammo"
              ? 1
              : 2;
    return [def.id, def.tier === tier ? weight * 1.5 : weight];
  });
}

/** Tiered gear that can drop at a tier in this place: every weapon and armour family, and the
 *  accessories of that tier band. */
export function marinaraGearTable(tier: MarinaraTier, place: MarinaraItemPlace): string[] {
  return [
    ...MARINARA_WEAPON_FAMILIES.filter((family) => marinaraItemAllowed(family, place)).map(
      (family) => `${family.id}-t${tier}`,
    ),
    ...MARINARA_ARMOUR_FAMILIES.filter((family) => marinaraItemAllowed(family, place)).map(
      (family) => `${family.id}-t${tier}`,
    ),
    ...MARINARA_ACCESSORIES.filter(
      (def) => def.tier <= tier && def.tier >= tier - 1 && marinaraItemAllowed(def, place),
    ).map((def) => def.id),
  ];
}

const pick = <T>(list: readonly T[], random: () => number): T | undefined =>
  list.length ? list[Math.floor(random() * list.length)] : undefined;
const pickWeighted = (table: Array<[string, number]>, random: () => number): string | undefined => {
  const total = table.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = random() * total;
  for (const [id, weight] of table) if ((roll -= weight) < 0) return id;
  return table.at(-1)?.[0];
};

export interface MarinaraLoot {
  /** In marks; `marinaraPriceInCoin` turns it into the setting's coin. */
  gold: number;
  items: string[];
}

/**
 * What a won fight drops, rolled from a seed so a retried turn drops the same thing. `tier` is the
 * party's; a foe's own tier wins when it has one. `goldPct` is the party's best gold charm.
 */
export function marinaraRollLoot(input: {
  tier: MarinaraTier;
  foes: readonly MarinaraLootFoe[];
  place: MarinaraItemPlace;
  seed: string;
  goldPct?: number;
}): MarinaraLoot {
  const random = marinaraRandom(`loot:${input.seed}`);
  let gold = 0;
  const items: string[] = [];
  for (const foe of input.foes) {
    const tier = foe.tier ?? input.tier;
    const coin = foe.coinScale ?? (foe.carriesCoin === false ? 0.5 : 1) * (foe.fled ? 0.5 : 1);
    gold += tierPrice(MARINARA_LOOT.gold, tier) * MARINARA_LOOT.goldRank[foe.rank] * coin * (0.75 + random() * 0.5);
    if (foe.fled) continue;
    const signature = marinaraFamilyDrops(foe.family, tier, input.place);
    const common = signature.find((id) => marinaraItem(id)?.kind === "consumable");
    if (random() < MARINARA_LOOT.consumable[foe.rank]) {
      const id =
        common && random() < MARINARA_SIGNATURE_CHANCE
          ? common
          : pickWeighted(marinaraConsumableTable(tier, input.place), random);
      if (id) items.push(id);
    }
    if (random() < MARINARA_LOOT.gear[foe.rank]) {
      const uniqueChance =
        foe.rank === "boss" && tier >= 4
          ? MARINARA_LOOT.unique.boss
          : foe.rank === "elite" && tier >= 5
            ? MARINARA_LOOT.unique.elite
            : 0;
      const uniques = MARINARA_UNIQUES.filter(
        (def) => def.tier <= tier + 1 && marinaraItemInPlace(def.id, input.place),
      ).map((def) => def.id);
      const signatureGear = signature.filter((id) => marinaraItem(id)?.kind !== "consumable");
      let id: string | undefined;
      if (uniques.length && random() < uniqueChance) id = pick(uniques, random);
      else if (signatureGear.length && random() < MARINARA_SIGNATURE_CHANCE) id = pick(signatureGear, random);
      else {
        const up = foe.rank !== "standard" && foe.rank !== "minion" && random() < MARINARA_LOOT.tierUp;
        id = pick(marinaraGearTable(clampTier(tier + (up ? 1 : 0)), input.place), random);
      }
      if (id) items.push(id);
    }
    if (foe.rank === "boss" && tier >= 3 && random() < MARINARA_LOOT.boon) {
      const boon = pick(
        MARINARA_CONSUMABLES.filter((def) => def.effect.kind === "boon").map((def) => def.id),
        random,
      );
      if (boon) items.push(boon);
    }
  }
  return { gold: Math.round(gold * (1 + (input.goldPct ?? 0))), items };
}

/**
 * What a Scout's Steal can take from a foe of this rank: its pocket (a consumable of its tier, or
 * its signature drop) most of the time, its coin purse otherwise; an elite or boss's prized item
 * (gear of its tier) rarely. Each foe can be robbed once.
 */
export function marinaraStealTable(
  tier: MarinaraTier,
  rank: MarinaraFoeRank,
  place: MarinaraItemPlace,
  family?: string,
): Array<[string, number]> {
  const signature = marinaraFamilyDrops(family, tier, place);
  const table: Array<[string, number]> = [
    ...marinaraConsumableTable(tier, place),
    ["gold", 8],
    ...signature.filter((id) => marinaraItem(id)?.kind === "consumable").map((id): [string, number] => [id, 10]),
  ];
  if (rank === "elite" || rank === "boss")
    for (const id of marinaraGearTable(tier, place)) table.push([id, rank === "boss" ? 0.6 : 0.3]);
  return table;
}

/** Rolls a steal: an item id, or `gold` worth `gold` marks. */
export function marinaraRollSteal(input: {
  tier: MarinaraTier;
  rank: MarinaraFoeRank;
  place: MarinaraItemPlace;
  family?: string;
  seed: string;
}): { item: string } | { gold: number } {
  const random = marinaraRandom(`steal:${input.seed}`);
  const id = pickWeighted(marinaraStealTable(input.tier, input.rank, input.place, input.family), random)!;
  if (id !== "gold") return { item: id };
  return {
    gold: Math.round(tierPrice(MARINARA_LOOT.gold, input.tier) * MARINARA_LOOT.goldRank[input.rank] * (0.5 + random())),
  };
}

// ── Shops ──

/** How much a place sells: a hamlet's stall, a town's shops, a city's market. */
export type MarinaraShopSize = "small" | "town" | "city";

/**
 * What a shop stocks for a party of this tier. Gear trails a little (a hamlet sells last tier's,
 * a town this tier's and last, a city this tier's in every family); T6 gear, uniques, boons and
 * anything `found` are never sold, so the best gear is won, not bought. Consumables are sold up to
 * the party's tier everywhere (revives and cure-alls only in towns and cities). Rolled from a seed,
 * so a shop keeps its stock between visits until the seed changes (a new day, a new tier).
 */
export function marinaraShopStock(input: {
  tier: MarinaraTier;
  size: MarinaraShopSize;
  place: MarinaraItemPlace;
  seed: string;
}): string[] {
  const random = marinaraRandom(`shop:${input.seed}`);
  const { tier, size, place } = input;
  const gearTiers = size === "small" ? [tier - 1] : size === "town" ? [tier - 1, tier] : [tier - 1, tier];
  const share = size === "small" ? 0.35 : size === "town" ? 0.6 : 1;
  const gear: string[] = [];
  for (const at of new Set(gearTiers.map((value) => clampTier(Math.min(5, value))))) {
    for (const family of MARINARA_WEAPON_FAMILIES)
      if (marinaraItemAllowed(family, place) && random() < share) gear.push(`${family.id}-t${at}`);
    for (const family of MARINARA_ARMOUR_FAMILIES)
      if (marinaraItemAllowed(family, place) && random() < share) gear.push(`${family.id}-t${at}`);
  }
  const accessories = MARINARA_ACCESSORIES.filter(
    (def) =>
      !def.found &&
      def.tier <= tier &&
      (size === "city" || def.rank < 3) &&
      marinaraItemAllowed(def, place) &&
      random() < share * 0.6,
  ).map((def) => def.id);
  const consumables = MARINARA_CONSUMABLES.filter(
    (def) =>
      !def.found &&
      def.tier <= tier &&
      marinaraItemAllowed(def, place) &&
      (size !== "small" || (def.effect.kind !== "revive" && def.id !== "cure-all")),
  ).map((def) => def.id);
  return [...consumables, ...gear, ...(size === "small" ? [] : accessories)];
}

/**
 * What a game's shops sell a party of this tier, with the smallest place that sells it: the fixed
 * counterpart of `marinaraShopStock` for a kit's market, whose shelves are the same every day and are
 * listed to the Game Master each turn, so they stay short. Of a line with ranks (heal-1, heal-2) only
 * the best the tier allows is sold. A hamlet sells consumables and last tier's gear; a town this tier's
 * gear, revives, cure-alls, charms and shields; a city wards, guards and rank-3 charms. Weapons, armour
 * and shields only of kinds one of `wearers` (the party's classes) can wear, when given. T6 gear,
 * uniques, boons and `found` things are never sold.
 */
export function marinaraShopCatalog(
  tier: MarinaraTier,
  place: MarinaraItemPlace,
  wearers?: readonly string[],
): Array<{ id: string; size: MarinaraShopSize }> {
  const out: Array<{ id: string; size: MarinaraShopSize }> = [];
  // The best rank of each ranked line on sale: `heal-2` replaces `heal-1`, `charm-speed-2` `charm-speed-1`.
  const best = (ids: readonly string[]) => {
    const top = new Map<string, number>();
    for (const id of ids) {
      const ranked = /^(.*)-(\d)$/.exec(id);
      if (ranked) top.set(ranked[1]!, Math.max(top.get(ranked[1]!) ?? 0, Number(ranked[2])));
    }
    return (id: string) => {
      const ranked = /^(.*)-(\d)$/.exec(id);
      return !ranked || top.get(ranked[1]!) === Number(ranked[2]);
    };
  };
  const consumables = MARINARA_CONSUMABLES.filter(
    (def) => !def.found && def.tier <= tier && marinaraItemAllowed(def, place),
  );
  const topConsumable = best(consumables.map((def) => def.id));
  for (const def of consumables)
    if (topConsumable(def.id))
      out.push({ id: def.id, size: def.effect.kind === "revive" || def.id === "cure-all" ? "town" : "small" });
  const lower = clampTier(Math.min(5, tier - 1));
  const upper = clampTier(Math.min(5, tier));
  const worn = (id: string, slot: "weapon" | "armor" | "accessory") =>
    !wearers?.length || wearers.some((classId) => marinaraCanEquip(classId, id, slot));
  for (const family of [...MARINARA_WEAPON_FAMILIES, ...MARINARA_ARMOUR_FAMILIES]) {
    if (!marinaraItemAllowed(family, place)) continue;
    const slot = MARINARA_WEAPON_FAMILIES.includes(family as MarinaraWeaponFamily) ? "weapon" : "armor";
    if (!worn(`${family.id}-t${lower}`, slot)) continue;
    out.push({ id: `${family.id}-t${lower}`, size: "small" });
    if (upper !== lower) out.push({ id: `${family.id}-t${upper}`, size: "town" });
  }
  const accessories = MARINARA_ACCESSORIES.filter(
    (def) => !def.found && def.tier <= tier && marinaraItemAllowed(def, place) && worn(def.id, "accessory"),
  );
  const topAccessory = best(accessories.map((def) => def.id));
  for (const def of accessories)
    if (topAccessory(def.id))
      out.push({
        id: def.id,
        size: def.rank >= 3 || def.id.startsWith("ward-") || def.id.startsWith("guard-") ? "city" : "town",
      });
  return out;
}

// ── Checks ──

/** Every item id the tables can produce, for tests and for the Engine's item book. */
export function marinaraAllItemIds(): string[] {
  return [
    ...MARINARA_WEAPON_FAMILIES.flatMap((family) => MARINARA_TIERS.map((tier) => `${family.id}-t${tier}`)),
    ...MARINARA_ARMOUR_FAMILIES.flatMap((family) => MARINARA_TIERS.map((tier) => `${family.id}-t${tier}`)),
    ...MARINARA_ACCESSORIES.map((def) => def.id),
    ...MARINARA_UNIQUES.map((def) => def.id),
    ...MARINARA_CONSUMABLES.map((def) => def.id),
  ];
}

// ── Item facts ──

/** What an item is and does, for the inventory and the gear slots to show before it is worn. */
export interface MarinaraItemFacts {
  kind: MarinaraItemRef["kind"];
  tier: MarinaraTier;
  might?: number;
  spell?: number;
  hit?: number;
  crit?: number;
  range?: "melee" | "ranged";
  defense?: number;
  resistance?: number;
  weight?: number;
  /** The trees whose classes can use it; absent when anyone can. */
  archetypes?: readonly MarinaraArchetype[];
  summary: string;
}

/** An item's numbers as a fighter wearing it gets them (marinaraGearBonus's math), and its summary. */
export function marinaraItemFacts(id: string): MarinaraItemFacts | undefined {
  const item = marinaraItem(id);
  if (!item) return undefined;
  if (item.kind === "weapon") {
    const family = marinaraWeaponFamily(item.family!)!;
    return {
      kind: item.kind,
      tier: item.tier,
      ...(family.might === null ? {} : { might: Math.max(0, item.tier + family.might + (item.unique?.might ?? 0)) }),
      ...(family.spell === null ? {} : { spell: Math.max(0, item.tier + family.spell + (item.unique?.spell ?? 0)) }),
      ...(family.hit ? { hit: family.hit } : {}),
      ...(family.crit ? { crit: family.crit } : {}),
      range: family.range,
      weight: family.weight,
      archetypes: family.archetypes,
      summary: item.unique?.summary ?? family.summary,
    };
  }
  if (item.kind === "armour") {
    const family = marinaraArmourFamily(item.family!)!;
    const defense = Math.round(item.tier * family.defense);
    const resistance = Math.round(item.tier * family.resistance);
    return {
      kind: item.kind,
      tier: item.tier,
      ...(defense ? { defense } : {}),
      ...(resistance ? { resistance } : {}),
      weight: family.weight,
      archetypes: family.archetypes,
      summary: item.unique?.summary ?? family.summary,
    };
  }
  const def = item.accessory ?? item.unique ?? item.consumable!;
  const weight = item.accessory?.weight ?? (item.unique?.id === "bellwether" ? 2 : 0);
  return {
    kind: item.kind,
    tier: item.tier,
    ...(weight ? { weight } : {}),
    ...(item.accessory?.archetypes?.length ? { archetypes: item.accessory.archetypes } : {}),
    summary: def.summary,
  };
}

/** Which item an inventory stack is, by its name in this place (as marinaraOwnedGear matches them). */
export function marinaraItemIdByName(name: string, place: MarinaraItemPlace): string | undefined {
  const wanted = name.trim().toLowerCase();
  if (!wanted) return undefined;
  return marinaraAllItemIds().find(
    (id) => marinaraItemInPlace(id, place) && marinaraItemName(id, place).toLowerCase() === wanted,
  );
}

// ── Legacy gear (owner 2026-11-06) ──
// A Legacy game's weapons and armour are free-text items no MRPG class can wear. The upgrade offers each
// one the nearest MRPG piece: the family its name points at, at the tier of its carrier's level. The
// Legacy name stays on the stack as its nickname, so an heirloom keeps its name and gains MRPG stats.

/** Words a Legacy weapon or armour may be called by, and the family each points at. */
const LEGACY_GEAR_WORDS: ReadonlyArray<readonly [string, string]> = [
  // Every family's own names, in every setting.
  ...MARINARA_WEAPON_FAMILIES.flatMap((family) =>
    Object.values(family.names).map((name) => [name.toLowerCase(), family.id] as const),
  ),
  ...MARINARA_ARMOUR_FAMILIES.flatMap((family) =>
    Object.values(family.names).map((name) => [name.toLowerCase(), family.id] as const),
  ),
  // Common words for them.
  ...([
    ["sword", "longblade"],
    ["blade", "longblade"],
    ["longsword", "longblade"],
    ["shortsword", "longblade"],
    ["sabre", "longblade"],
    ["saber", "longblade"],
    ["scimitar", "longblade"],
    ["cutlass", "longblade"],
    ["falchion", "longblade"],
    ["katana", "longblade"],
    ["axe", "longblade"],
    ["hatchet", "longblade"],
    ["greataxe", "greatblade"],
    ["battleaxe", "greatblade"],
    ["battle axe", "greatblade"],
    ["zweihander", "greatblade"],
    ["two-handed sword", "greatblade"],
    ["estoc", "rapier"],
    ["foil", "rapier"],
    ["dagger", "knife"],
    ["dirk", "knife"],
    ["kris", "knife"],
    ["shiv", "stiletto"],
    ["javelin", "spear"],
    ["trident", "spear"],
    ["lance", "pike"],
    ["glaive", "pike"],
    ["polearm", "pike"],
    ["pike", "pike"],
    ["club", "mace"],
    ["cudgel", "mace"],
    ["flail", "mace"],
    ["morningstar", "mace"],
    ["morning star", "mace"],
    ["hammer", "maul"],
    ["warhammer", "maul"],
    ["quarterstaff", "staff"],
    ["rod", "staff"],
    ["sceptre", "wand"],
    ["scepter", "wand"],
    ["grimoire", "wand"],
    ["spellbook", "wand"],
    ["holy symbol", "censer"],
    ["shortbow", "bow"],
    ["gun", "bow"],
    ["handgun", "bow"],
    ["musket", "greatbow"],
    ["rifle", "greatbow"],
    ["shotgun", "sling"],
    ["breastplate", "plate"],
    ["cuirass", "plate"],
    ["full plate", "plate"],
    ["platemail", "plate"],
    ["plate armor", "plate"],
    ["plate armour", "plate"],
    ["chainmail", "mail"],
    ["chain mail", "mail"],
    ["chain shirt", "mail"],
    ["scale mail", "mail"],
    ["brigandine", "mail"],
    ["armor", "mail"],
    ["armour", "mail"],
    ["leather", "leathers"],
    ["leather armor", "leathers"],
    ["leather armour", "leathers"],
    ["studded leather", "leathers"],
    ["hide armor", "leathers"],
    ["hide armour", "leathers"],
    ["hide", "leathers"],
    ["gambeson", "leathers"],
    ["jerkin", "leathers"],
    ["robe", "robes"],
    ["vestments", "robes"],
  ] as const),
];

/**
 * The MRPG piece nearest a Legacy weapon or armour, by its name: the family the longest gear word in it
 * names, at the tier given, if this place has it. Undefined for anything that is no weapon or armour
 * (a potion, a rope) and for an item that already is an MRPG piece.
 */
export function marinaraLegacyGearFor(
  name: string,
  tier: MarinaraTier,
  place: MarinaraItemPlace,
): { id: string; slot: "weapon" | "armor"; name: string } | undefined {
  const text = ` ${name.toLowerCase().replace(/[^a-z0-9-]+/g, " ")} `;
  if (!text.trim() || marinaraItemIdByName(name, place)) return undefined;
  let best: { word: string; family: string } | undefined;
  for (const [word, family] of LEGACY_GEAR_WORDS) {
    const bare = word.replace(/[^a-z0-9-]+/g, " ").trim();
    if (!bare || (!text.includes(` ${bare} `) && !text.includes(` ${bare}s `))) continue;
    if (!best || bare.length > best.word.length) best = { word: bare, family };
  }
  if (!best) return undefined;
  const id = `${best.family}-t${tier}`;
  if (!marinaraItemInPlace(id, place)) return undefined;
  return { id, slot: marinaraItem(id)!.kind === "weapon" ? "weapon" : "armor", name: marinaraItemName(id, place) };
}
