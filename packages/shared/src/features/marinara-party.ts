// ──────────────────────────────────────────────
// Game: a party on Classic Marinara (Marinara's own classes)
//
// What a game keeps of each party member: their progression, on the game's own card (never the
// library card), the primary tree read from the card, and the fighter a fight builds from both.
// Foes are read from what the fight's setup wrote of them: a tier and an archetype where it gave
// them, else read off what it said (a boss, a named leader, a mage).
// ──────────────────────────────────────────────

import {
  MARINARA_ARCHETYPES,
  MARINARA_LEVEL_CAP,
  MARINARA_PROMOTION_LEVEL,
  MARINARA_STATS,
  MARINARA_XP_PER_LEVEL,
  awardMarinaraXp,
  createMarinaraProgression,
  isMarinaraPartyTemperament,
  marinaraClass,
  marinaraClassBody,
  type MarinaraArchetype,
  type MarinaraPartyTemperament,
  type MarinaraProgression,
  type MarinaraStat,
  type MarinaraStats,
} from "./marinara-classes.js";
import {
  MARINARA_COMPANION,
  marinaraCompanionBonus,
  MARINARA_ENEMY_TIERS,
  MARINARA_ENEMY_TIERS_LIST,
  buildMarinaraEnemy,
  buildMarinaraPartyFighter,
  fitMarinaraEncounter,
  marinaraEncounterBudget,
  marinaraPartyLevel,
  type MarinaraEnemySpec,
  type MarinaraEnemyTier,
  type MarinaraFighter,
  type MarinaraFighterGear,
} from "./marinara-combat.js";
import {
  marinaraGearBonus,
  marinaraWornEquipment,
  marinaraTierForLevel,
  type MarinaraEquipment,
} from "./marinara-items.js";
import {
  marinaraEnemyFamily,
  marinaraEnemyName,
  marinaraEnemySpec,
  marinaraFamilyAttackType,
  marinaraFitEncounter,
  MARINARA_TIER_RULES,
  type MarinaraBestiarySetting,
  type MarinaraEncounterDifficulty,
  type MarinaraEncounterFoe,
} from "./marinara-bestiary.js";

/** A party member's Classic Marinara record on their game card. */
export interface MarinaraCardProgression extends MarinaraProgression {
  equipment?: MarinaraEquipment;
  /** The Classic row the player put them in; unset, their class's own row. */
  row?: "front" | "back";
  /** Fell for good in a game with permadeath on. */
  fallen?: boolean;
  /** The beasts they tamed (Tracker, Alyssa 2026-11-01 23:31): a stable of up to
   *  MARINARA_COMPANION_STABLE, kept between fights. */
  companions?: MarinaraCompanion[];
  /** The one active companion's id: only it gives its bonus and answers Sic. Switched outside fights. */
  activeCompanion?: string;
  /** A beast tamed with the stable full, waiting on the player to release one (it or an old one).
   *  Never answered, it goes free when the next one is tamed; it gives nothing meanwhile. */
  pendingCompanion?: MarinaraCompanion;
}

/** How many tamed beasts a character keeps: one for each stat, if they like. */
export const MARINARA_COMPANION_STABLE = 8;

/** A tamed beast: no fighter of its own, a stat boost to its keeper (and Sic's strike). */
export interface MarinaraCompanion {
  id: string;
  name: string;
  /** The stat it is strongest in, which it raises. */
  stat: MarinaraStat;
  familyId?: string;
  /** The level and rank it was tamed at: it doesn't grow, so a stronger catch is the upgrade. */
  level?: number;
  tier?: MarinaraEnemyTier;
}

/** Words that point at each archetype, strongest first within each. */
const ARCHETYPE_WORDS: Record<MarinaraArchetype, readonly string[]> = {
  guard: [
    "paladin",
    "guardian",
    "knight",
    "defender",
    "bodyguard",
    "sentinel",
    "protector",
    "templar",
    "tank",
    "shield",
    "warden",
  ],
  blade: [
    "swordsman",
    "swordswoman",
    "warrior",
    "fighter",
    "samurai",
    "berserker",
    "barbarian",
    "duelist",
    "mercenary",
    "soldier",
    "gladiator",
    "brawler",
    "monk",
    "sword",
    "blade",
  ],
  scout: [
    "rogue",
    "thief",
    "assassin",
    "ninja",
    "scout",
    "spy",
    "infiltrator",
    "smuggler",
    "pirate",
    "burglar",
    "trickster",
    "dagger",
  ],
  marksman: [
    "archer",
    "gunslinger",
    "sniper",
    "ranger",
    "hunter",
    "gunner",
    "marksman",
    "markswoman",
    "crossbow",
    "bow",
    "rifle",
    "pistol",
    "gun",
  ],
  channeler: [
    "mage",
    "wizard",
    "sorcerer",
    "sorceress",
    "elementalist",
    "magician",
    "netrunner",
    "psychic",
    "psion",
    "arcanist",
    "spellcaster",
    "pyromancer",
    "cryomancer",
    "esper",
    "magic",
  ],
  hexer: [
    "warlock",
    "necromancer",
    "witch",
    "hexer",
    "occultist",
    "curse",
    "shadow",
    "voodoo",
    "demonologist",
    "cultist",
  ],
  mender: [
    "healer",
    "cleric",
    "priest",
    "priestess",
    "medic",
    "doctor",
    "nurse",
    "druid",
    "shaman",
    "alchemist",
    "apothecary",
    "saint",
  ],
  herald: [
    "bard",
    "commander",
    "captain",
    "leader",
    "noble",
    "diplomat",
    "tactician",
    "singer",
    "idol",
    "performer",
    "officer",
    "merchant",
    "prince",
    "princess",
  ],
};

/**
 * The archetype a card's class, abilities and description point at: the first strong word in the
 * class wins, then the abilities, then the description. A card that says nothing a fight can read
 * fights as a Blade.
 */
export function guessMarinaraArchetype(card: {
  class?: string;
  abilities?: readonly string[];
  shortDescription?: string;
}): MarinaraArchetype {
  const sources = [card.class ?? "", (card.abilities ?? []).join(" "), card.shortDescription ?? ""];
  for (const source of sources) {
    const found = marinaraArchetypeInText(source);
    if (found) return found;
  }
  return "blade";
}

/** The archetype the earliest tree word in a text points at, or null when it names none (the library
 *  card's Game Mode section shows what an Auto starting tree would read). */
export function marinaraArchetypeInText(source: string): MarinaraArchetype | null {
  const text = ` ${source.toLowerCase()} `;
  let best: { archetype: MarinaraArchetype; at: number } | null = null;
  for (const archetype of MARINARA_ARCHETYPES) {
    for (const word of ARCHETYPE_WORDS[archetype]) {
      const at = text.search(new RegExp(`[^a-z]${word}`));
      if (at >= 0 && (!best || at < best.at)) best = { archetype, at };
    }
  }
  return best?.archetype ?? null;
}

/** How a card's RPG attributes lean each stat (−1 to 1), for the hidden aptitudes. */
export function marinaraLeanFromCard(card: {
  rpgStats?: { attributes: Array<{ name: string; value: number }> };
}): Partial<Record<keyof MarinaraStats, number>> {
  const attributes = card.rpgStats?.attributes ?? [];
  if (!attributes.length) return {};
  const values = attributes.map((a) => a.value);
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const spread = Math.max(1, Math.max(...values) - Math.min(...values));
  const lean: Partial<Record<keyof MarinaraStats, number>> = {};
  const map: Record<string, keyof MarinaraStats> = {
    str: "strength",
    strength: "strength",
    con: "hp",
    constitution: "hp",
    vit: "hp",
    vitality: "hp",
    endurance: "hp",
    dex: "skill",
    dexterity: "skill",
    agi: "speed",
    agility: "speed",
    spd: "speed",
    speed: "speed",
    int: "magic",
    intelligence: "magic",
    mag: "magic",
    magic: "magic",
    wis: "resistance",
    wisdom: "resistance",
    spirit: "resistance",
    cha: "luck",
    charisma: "luck",
    luck: "luck",
    lck: "luck",
    def: "defense",
    defense: "defense",
  };
  for (const attribute of attributes) {
    const stat = map[attribute.name.trim().toLowerCase()];
    if (!stat) continue;
    lean[stat] = Math.max(-1, Math.min(1, ((attribute.value - mean) / spread) * 2));
  }
  return lean;
}

/**
 * What the author set for Classic games on the library card (Game Mode section, owner's pick 2026-11-05):
 * the starting tree, unset for the guess from the game card, and up to two stats the character is
 * strong in and one they are weak in. These lean the hidden aptitudes; the numbers stay the Engine's.
 */
export interface MarinaraCardClassic {
  tree?: MarinaraArchetype;
  strong?: MarinaraStat[];
  weak?: MarinaraStat;
  /** Set once the card's guided MRPG builder was finished, so the card shows its picks and not the
   *  builder, even when every pick was left on Auto. */
  built?: true;
}

export const MARINARA_CLASSIC_STRONG_PICKS = 2;

/** The card's Classic picks, cleaned: unknown trees and stats dropped, a weak stat never also strong. */
export function readMarinaraCardClassic(value: unknown): MarinaraCardClassic | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as { tree?: unknown; strong?: unknown; weak?: unknown; built?: unknown };
  const isStat = (one: unknown): one is MarinaraStat =>
    typeof one === "string" && (MARINARA_STATS as readonly string[]).includes(one);
  const tree =
    typeof raw.tree === "string" && (MARINARA_ARCHETYPES as readonly string[]).includes(raw.tree)
      ? (raw.tree as MarinaraArchetype)
      : undefined;
  const weak = isStat(raw.weak) ? raw.weak : undefined;
  const strong = Array.isArray(raw.strong)
    ? [...new Set(raw.strong.filter(isStat))].filter((stat) => stat !== weak).slice(0, MARINARA_CLASSIC_STRONG_PICKS)
    : [];
  const built = raw.built === true;
  if (!tree && !weak && strong.length === 0 && !built) return undefined;
  return {
    ...(tree ? { tree } : {}),
    ...(strong.length ? { strong } : {}),
    ...(weak ? { weak } : {}),
    ...(built ? { built: true as const } : {}),
  };
}

/** How the card's strong and weak picks lean each stat, for the hidden aptitudes. */
export function marinaraLeanFromClassic(classic: MarinaraCardClassic): Partial<Record<MarinaraStat, number>> {
  const lean: Partial<Record<MarinaraStat, number>> = {};
  for (const stat of classic.strong ?? []) lean[stat] = 1;
  if (classic.weak) lean[classic.weak] = -1;
  return lean;
}

/** A new party member's progression for this game, from their card and the temperament kept on it.
 *  The library card's Classic picks, when it has any, win over the guesses from the game card. */
export function createMarinaraCardProgression(input: {
  gameId: string;
  card: {
    name: string;
    class?: string;
    abilities?: readonly string[];
    shortDescription?: string;
    rpgStats?: { attributes: Array<{ name: string; value: number }> };
  };
  temperament: MarinaraPartyTemperament;
  primary?: MarinaraArchetype;
  classic?: MarinaraCardClassic;
}): MarinaraCardProgression {
  const picked = input.classic && (input.classic.strong?.length || input.classic.weak);
  return createMarinaraProgression({
    seed: `${input.gameId}:${input.card.name}`,
    primary: input.primary ?? input.classic?.tree ?? guessMarinaraArchetype(input.card),
    temperament: isMarinaraPartyTemperament(input.temperament) ? input.temperament : "disciplined",
    lean: picked ? marinaraLeanFromClassic(input.classic!) : marinaraLeanFromCard(input.card),
  });
}

/** How far the Game Master may move a late joiner's stats and growths (owner 2026-11-06). */
export const MARINARA_JOINER_LIMITS = {
  stat: { min: -5, max: 10 },
  growth: { min: -30, max: 50 },
} as const;

/** What the Game Master decided for a late joiner: their level, and stats and growths off the norm. */
export interface MarinaraJoinerTerms {
  level?: number;
  /** Points added to (or taken off) their growth in each stat, in percent: a quick grower's. */
  growths?: Partial<Record<MarinaraStat, number>>;
  /** Points added to (or taken off) each stat from the start. */
  stats?: Partial<Record<MarinaraStat, number>>;
}

/** Reads "strength+30, speed 20, luck-5" (the tag's form) into stat amounts; anything else is dropped. */
export function readMarinaraStatAmounts(text: unknown): Partial<Record<MarinaraStat, number>> | undefined {
  if (typeof text !== "string" || !text.trim()) return undefined;
  const aliases: Record<string, MarinaraStat> = {
    str: "strength",
    mag: "magic",
    skl: "skill",
    spd: "speed",
    def: "defense",
    defence: "defense",
    res: "resistance",
    lck: "luck",
    lk: "luck",
  };
  const out: Partial<Record<MarinaraStat, number>> = {};
  for (const part of text.split(/[,;]/)) {
    const match = /^\s*([a-z]+)\s*[:=]?\s*([+-]?\s*\d+)\s*%?\s*$/i.exec(part);
    if (!match) continue;
    const word = match[1]!.toLowerCase();
    const stat = (MARINARA_STATS as readonly string[]).includes(word) ? (word as MarinaraStat) : aliases[word];
    if (!stat) continue;
    out[stat] = Number(match[2]!.replace(/\s+/g, ""));
  }
  return Object.keys(out).length ? out : undefined;
}

/**
 * A character who joins a game on MRPG classes after it began (owner 2026-11-06): at the level the Game
 * Master gives (FE-style, most come in low and some decent), with any stats and growths it set off the
 * norm. Growths move their hidden aptitudes; stats ride on top of the class body.
 */
export function createMarinaraJoinerProgression(input: {
  gameId: string;
  card: Parameters<typeof createMarinaraCardProgression>[0]["card"];
  temperament: MarinaraPartyTemperament;
  classic?: MarinaraCardClassic;
  terms?: MarinaraJoinerTerms;
}): MarinaraCardProgression {
  const clamp = (value: number, range: { min: number; max: number }) =>
    Math.max(range.min, Math.min(range.max, Math.round(value)));
  let progression = createMarinaraCardProgression({
    gameId: input.gameId,
    card: input.card,
    temperament: input.temperament,
    ...(input.classic ? { classic: input.classic } : {}),
  });
  const growths = input.terms?.growths;
  if (growths) {
    progression = {
      ...progression,
      aptitudes: Object.fromEntries(
        MARINARA_STATS.map((stat) => [
          stat,
          progression.aptitudes[stat] + clamp(growths[stat] ?? 0, MARINARA_JOINER_LIMITS.growth),
        ]),
      ) as MarinaraStats,
    };
  }
  const stats = input.terms?.stats;
  if (stats) {
    const statBonus = Object.fromEntries(
      MARINARA_STATS.flatMap((stat) => (stats[stat] ? [[stat, clamp(stats[stat]!, MARINARA_JOINER_LIMITS.stat)]] : [])),
    ) as Partial<MarinaraStats>;
    if (Object.keys(statBonus).length) progression = { ...progression, statBonus };
  }
  const level = Math.max(1, Math.min(MARINARA_LEVEL_CAP, Math.round(input.terms?.level ?? 1)));
  const grown = awardMarinaraXp(progression, (level - 1) * MARINARA_XP_PER_LEVEL).progression;
  // The body is rolled again from the moved aptitudes and the given stats.
  return { ...grown, ...marinaraClassBody(grown) };
}

/** The level a Legacy party member starts Classic at (owner 2026-11-06): the top of their starting
 *  class, where its promotion opens, whatever their Legacy level was, so no upgraded character
 *  arrives past what a fresh one could have reached in a single class. */
export const MARINARA_LEGACY_UPGRADE_LEVEL = MARINARA_PROMOTION_LEVEL.advanced;

/**
 * A Legacy party member upgraded to Classic classes (owner 2026-11-06): one class, the base class of the
 * primary tree picked (or guessed from their card), the secondary tree from their temperament, at the
 * top of that class (MARINARA_LEGACY_UPGRADE_LEVEL), its XP earned so their stats grow as level-ups would.
 */
export function upgradeMarinaraLegacyCard(input: {
  gameId: string;
  card: Parameters<typeof createMarinaraCardProgression>[0]["card"];
  temperament: MarinaraPartyTemperament;
  primary?: MarinaraArchetype;
  classic?: MarinaraCardClassic;
}): MarinaraCardProgression {
  const fresh = createMarinaraCardProgression({
    gameId: input.gameId,
    card: input.card,
    temperament: input.temperament,
    ...(input.primary ? { primary: input.primary } : {}),
    ...(input.classic ? { classic: input.classic } : {}),
  });
  return awardMarinaraXp(fresh, (MARINARA_LEGACY_UPGRADE_LEVEL - 1) * MARINARA_XP_PER_LEVEL).progression;
}

/** Whether a stored value reads as a progression (written by this Engine). */
export function readMarinaraCardProgression(value: unknown): MarinaraCardProgression | undefined {
  if (!value || typeof value !== "object") return undefined;
  const p = value as Partial<MarinaraCardProgression>;
  if (
    typeof p.primary !== "string" ||
    !(MARINARA_ARCHETYPES as readonly string[]).includes(p.primary) ||
    !isMarinaraPartyTemperament(p.temperament) ||
    typeof p.level !== "number" ||
    typeof p.activeClass !== "string" ||
    !marinaraClass(p.activeClass) ||
    !p.stats ||
    !MARINARA_STATS.every((stat) => typeof p.stats![stat] === "number")
  )
    return undefined;
  const progression = value as MarinaraCardProgression;
  // Saves from before 2026-11-02 grew stats with the character level; the body now follows the
  // active class, so it is recomputed (deterministically) on read.
  if (!p.classLevels || !p.aptitudes || !MARINARA_STATS.every((stat) => typeof p.aptitudes![stat] === "number"))
    return progression;
  return { ...progression, ...marinaraClassBody(progression) };
}

/** What a fighter takes from its gear. */
export function marinaraFighterGear(
  equipment: MarinaraEquipment | undefined,
  strength: number,
): { gear?: MarinaraFighterGear; stats: Partial<MarinaraStats>; ranged?: boolean } {
  if (!equipment || (!equipment.weapon && !equipment.armor && !equipment.accessories?.length)) return { stats: {} };
  const bonus = marinaraGearBonus(equipment, { strength });
  return {
    gear: {
      power: bonus.power,
      spellPower: bonus.spellPower,
      ...(bonus.weaponType ? { weaponType: bonus.weaponType } : {}),
      ...(bonus.effects.hit ? { hit: bonus.effects.hit } : {}),
      ...(bonus.effects.crit ? { crit: bonus.effects.crit } : {}),
      ...(bonus.effects.damagePct ? { damagePct: bonus.effects.damagePct } : {}),
      ...(bonus.effects.lifestealPct ? { lifestealPct: bonus.effects.lifestealPct } : {}),
      ...(bonus.effects.stealChance ? { stealChance: bonus.effects.stealChance } : {}),
      ...(bonus.immune.length ? { immune: [...bonus.immune] } : {}),
    },
    stats: bonus.stats,
    ...(bonus.ranged !== undefined ? { ranged: bonus.ranged } : {}),
  };
}

/** What Tame can take of a bestiary foe: wild beasts and vermin, never a boss or treasure. */
function marinaraTameableFor(
  familyId: string,
  setting: MarinaraBestiarySetting,
  level: number,
  tier: MarinaraEnemyTier,
): Pick<MarinaraFighter, "tameable"> {
  const family = marinaraEnemyFamily(familyId);
  if (!family || (family.kind !== "beast" && family.kind !== "vermin") || family.role === "treasure") return {};
  if (tier === "boss") return {};
  const name = marinaraEnemyName(family, setting, level);
  if (!name) return {};
  // Its best stat is the one its family stands out in (HP counts: Alyssa 23:31, one for every stat).
  const stat =
    (Object.entries(family.statScale ?? {}) as Array<[MarinaraStat, number]>).sort((a, b) => b[1] - a[1])[0]?.[0] ??
    "strength";
  return { tameable: { name, stat, familyId } };
}

/** The active companion, if they have one. */
export function marinaraActiveCompanion(progression: MarinaraCardProgression): MarinaraCompanion | undefined {
  return progression.companions?.find((one) => one.id === progression.activeCompanion);
}

/** A beast tamed: into the stable (active when none is), or waiting on a release when it is full. */
export function marinaraAddCompanion(
  progression: MarinaraCardProgression,
  companion: MarinaraCompanion,
): MarinaraCardProgression {
  const stable = progression.companions ?? [];
  if (stable.length >= MARINARA_COMPANION_STABLE) return { ...progression, pendingCompanion: companion };
  const active = marinaraActiveCompanion(progression) ? progression.activeCompanion : companion.id;
  return { ...progression, companions: [...stable, companion], ...(active ? { activeCompanion: active } : {}) };
}

/** Lets one go: a stabled beast (the one waiting takes its place) or the one waiting itself. */
export function marinaraReleaseCompanion(progression: MarinaraCardProgression, id: string): MarinaraCardProgression {
  const { pendingCompanion: pending, ...rest } = progression;
  if (pending?.id === id) return rest;
  const stable = progression.companions ?? [];
  if (!stable.some((one) => one.id === id)) throw new Error("No such companion.");
  const companions = [...stable.filter((one) => one.id !== id), ...(pending ? [pending] : [])];
  const { activeCompanion: _a, companions: _c, ...base } = rest;
  const active = rest.activeCompanion !== id ? rest.activeCompanion : companions[0]?.id;
  return {
    ...base,
    ...(companions.length ? { companions } : {}),
    ...(active ? { activeCompanion: active } : {}),
  };
}

/** Makes a stabled beast the active companion (outside fights only; the route checks that). */
export function marinaraSetActiveCompanion(progression: MarinaraCardProgression, id: string): MarinaraCardProgression {
  if (!progression.companions?.some((one) => one.id === id)) throw new Error("No such companion.");
  return { ...progression, activeCompanion: id };
}

/** The classes a companion's bonus counts in: the Tracker's tree. */
export const MARINARA_COMPANION_CLASSES: readonly string[] = ["tracker", "huntsmaster"];

/**
 * Companions at the start of a fight (Alyssa 2026-11-01): each keeper with a Tracker-tree class active
 * gets +10% to the companion's stat (+20% with Bond), and with Bond the rest of the party gets half
 * that. Stats only: HP follows when the stat is HP.
 */
export function marinaraApplyCompanions(
  party: ReadonlyArray<{ fighter: MarinaraFighter; progression: MarinaraCardProgression }>,
): void {
  const raise = (fighter: MarinaraFighter, stat: MarinaraStat, pct: number) => {
    fighter.stats[stat] = fighter.stats[stat] * (1 + pct);
    if (stat === "hp") {
      const ratio = fighter.maxHp > 0 ? fighter.hp / fighter.maxHp : 1;
      fighter.maxHp = Math.round(fighter.maxHp * (1 + pct));
      fighter.hp = Math.round(fighter.maxHp * ratio);
    }
  };
  for (const { fighter, progression } of party) {
    const companion = marinaraActiveCompanion(progression);
    if (!companion) continue;
    const attackType = marinaraFamilyAttackType(companion.familyId);
    fighter.companion = { name: companion.name, stat: companion.stat, ...(attackType ? { attackType } : {}) };
    if (!MARINARA_COMPANION_CLASSES.includes(progression.activeClass)) continue;
    const bond = fighter.skills.some((skill) => skill.id === "bond");
    const pct = marinaraCompanionBonus(companion) * (bond ? MARINARA_COMPANION.bond : 1);
    raise(fighter, companion.stat, pct);
    // Said at the fight's start (Sonnet panel r6: most testers never noticed the bonus).
    fighter.companion.lends = pct;
    if (bond) fighter.companion.bond = pct * MARINARA_COMPANION.shared;
    if (bond)
      for (const other of party)
        if (other.fighter !== fighter) raise(other.fighter, companion.stat, pct * MARINARA_COMPANION.shared);
  }
}

/** A party member's fighter for a fight. */
export function marinaraPartyFighter(id: string, name: string, progression: MarinaraCardProgression): MarinaraFighter {
  // Until a party member has gear of their own, they fight with their class's standard kit for their
  // level's tier, as the class and bestiary labs measured them (decided 2026-11-01).
  const archetype = marinaraClass(progression.activeClass)?.archetype ?? progression.primary;
  // An empty weapon or armour slot falls back to the kit's piece for their tier (items playtest I1).
  const equipment = marinaraWornEquipment(archetype, marinaraTierForLevel(progression.level), progression.equipment);
  const gear = marinaraFighterGear(equipment, progression.stats.strength);
  return buildMarinaraPartyFighter({
    id,
    name,
    progression,
    ...(progression.row === "front" || progression.row === "back" ? { row: progression.row } : {}),
    gearStats: gear.stats,
    ...(gear.gear ? { gear: gear.gear } : {}),
    ...(gear.ranged !== undefined ? { rangedWeapon: gear.ranged } : {}),
  });
}

/** What a fight's setup said of an opponent, as Classic Marinara reads it. */
export interface MarinaraFoeBrief {
  id: string;
  name: string;
  hp?: number;
  maxHp?: number;
  boss?: unknown;
  /** The tier and archetype the setup gave it, where it gave them. */
  marinara?: Partial<
    Pick<MarinaraEnemySpec, "tier" | "archetype" | "classId" | "row" | "affinities" | "enemySkills" | "statScale">
  > & {
    /** Levels above (or below) the party's. */
    levelOffset?: number;
    /** A bestiary foe (marinara-bestiary.ts): its family, tier and level. */
    family?: { familyId: string; tier?: MarinaraEnemyTier; level?: number };
  };
  combatClass?: string;
  aiHints?: { named?: boolean; leader?: boolean; category?: string };
  skills?: Array<{ name?: string; spell?: boolean; type?: string }>;
}

const CLASS_ARCHETYPES: Record<string, MarinaraArchetype> = {
  fighter: "blade",
  knight: "guard",
  rogue: "scout",
  archer: "marksman",
  mage: "channeler",
  healer: "mender",
};

/** The tier a foe the setup gave none reads as: a boss is a boss, a named leader elite, a weak one
 *  (well under the party's HP) a minion, the rest standard. */
function tierOf(foe: MarinaraFoeBrief, partyHp: number): MarinaraEnemyTier {
  if (foe.marinara?.tier && (MARINARA_ENEMY_TIERS_LIST as readonly string[]).includes(foe.marinara.tier))
    return foe.marinara.tier;
  if (foe.boss) return "boss";
  if (foe.aiHints?.named || foe.aiHints?.leader) return "elite";
  const hp = foe.maxHp ?? foe.hp ?? 0;
  if (partyHp > 0 && hp > 0 && hp < partyHp * 0.5) return "minion";
  return "standard";
}

/**
 * The one ability a foe the Game Master invents (no bestiary family, no class) fights with, by its
 * archetype. Without it such a foe had only its basic attack, and a lone invented boss was won 100% of
 * the time for 3-23% of the party's HP; the Engine-AI balance runs were measured with one ability per
 * foe (playtest 2026-11-01).
 */
export const MARINARA_GENERIC_FOE_SKILL: Record<MarinaraArchetype, string> = {
  blade: "rend",
  scout: "rend",
  guard: "sunder",
  herald: "sunder",
  marksman: "venom-arrow",
  channeler: "curse",
  hexer: "curse",
  mender: "curse",
};

function archetypeOf(foe: MarinaraFoeBrief): MarinaraArchetype {
  if (foe.marinara?.archetype && (MARINARA_ARCHETYPES as readonly string[]).includes(foe.marinara.archetype))
    return foe.marinara.archetype;
  if (foe.marinara?.classId) {
    const def = marinaraClass(foe.marinara.classId);
    if (def) return def.archetype;
  }
  const byClass = foe.combatClass ? CLASS_ARCHETYPES[foe.combatClass.toLowerCase()] : undefined;
  if (byClass) return byClass;
  const guessed = guessMarinaraArchetype({ class: foe.name, abilities: (foe.skills ?? []).map((s) => s.name ?? "") });
  if (guessed !== "blade") return guessed;
  if ((foe.skills ?? []).some((s) => s.spell)) return "channeler";
  return "blade";
}

/**
 * A boss the Game Master invents (no bestiary family) past level 20 hits a little softer: the tier's
 * x1.3 on every stat but HP tapers to x1.15 by level 25. On the Engine's AI a party of four beat the
 * full x1.3 boss in only about half of its fights at levels 25-30, against 85-90% at level 20, as
 * promotion skills stop keeping pace with the boss's compounding stats (engine-balance, 2026-11-01).
 * Bestiary bosses keep their own measured threat.
 */
export function marinaraLateBossScale(level: number, scale?: Partial<MarinaraStats>): Partial<MarinaraStats> {
  const full = MARINARA_ENEMY_TIERS.boss.stats;
  const factor = (full - 0.15 * Math.min(1, Math.max(0, (level - 20) / 5))) / full;
  return Object.fromEntries(
    MARINARA_STATS.map((stat) => [stat, (scale?.[stat] ?? 1) * (stat === "hp" ? 1 : factor)]),
  ) as Partial<MarinaraStats>;
}

/**
 * A fight's foes as Classic Marinara fighters, built against the party's level and held to the
 * encounter budget for the party's size and the game's difficulty: over budget, foes drop a tier
 * and, last, the weakest stay out. A story's own fight (`keepAll`) is fought as written.
 */
export function marinaraFoeFighters(input: {
  foes: readonly MarinaraFoeBrief[];
  partyLevels: readonly number[];
  partyAverageHp: number;
  difficulty: string;
  keepAll?: boolean;
  /** The game's bestiary setting, for bestiary foes. */
  setting?: MarinaraBestiarySetting | null;
  /** The fight's own difficulty for bestiary foes (the GM's pick); Normal when none was given. */
  encounter?: MarinaraEncounterDifficulty;
}): { fighters: MarinaraFighter[]; left: string[]; notes: string[] } {
  // Bestiary foes are fitted by the bestiary's measured threat; the rest by tier.
  const bestiary = input.setting ? input.foes.filter((foe) => foe.marinara?.family?.familyId) : [];
  if (bestiary.length) {
    const rest = input.foes.filter((foe) => !bestiary.includes(foe));
    const fromBestiary = marinaraBestiaryFoes({ ...input, foes: bestiary, setting: input.setting! });
    const others = rest.length ? marinaraFoeFighters({ ...input, foes: rest, setting: null }) : null;
    return {
      fighters: [...fromBestiary.fighters, ...(others?.fighters ?? [])],
      left: [...fromBestiary.left, ...(others?.left ?? [])],
      notes: [...fromBestiary.notes, ...(others?.notes ?? [])],
    };
  }
  const level = marinaraPartyLevel(input.partyLevels);
  const tiers = input.foes.map((foe) => tierOf(foe, input.partyAverageHp));
  const fit = input.keepAll
    ? { tiers, dropped: [] as number[], changed: false }
    : fitMarinaraEncounter(tiers, marinaraEncounterBudget(input.partyLevels.length, input.difficulty));
  const notes: string[] = [];
  const fighters: MarinaraFighter[] = [];
  const left: string[] = [];
  input.foes.forEach((foe, index) => {
    if (fit.dropped.includes(index)) {
      left.push(foe.id);
      notes.push(`${foe.name} stays out of the fight (over the encounter budget).`);
      return;
    }
    let tier = fit.tiers[index]!;
    // The bestiary's floors hold for every foe: no boss below level 5, and so on (strict balance rule).
    const foeLevel = Math.max(1, level + (foe.marinara?.levelOffset ?? 0));
    while (tier !== "minion" && foeLevel < MARINARA_TIER_RULES[tier].minLevel)
      tier = tier === "boss" ? "elite" : tier === "elite" ? "standard" : "minion";
    if (tier !== tiers[index])
      notes.push(`${foe.name} fights as ${tier} instead of ${tiers[index]} (encounter budget).`);
    fighters.push(
      buildMarinaraEnemy({
        id: foe.id,
        name: foe.name,
        level: foeLevel,
        tier,
        archetype: archetypeOf(foe),
        ...(foe.marinara?.classId && marinaraClass(foe.marinara.classId) ? { classId: foe.marinara.classId } : {}),
        ...(foe.marinara?.row ? { row: foe.marinara.row } : {}),
        ...(foe.marinara?.affinities ? { affinities: foe.marinara.affinities } : {}),
        ...(foe.marinara?.enemySkills
          ? { enemySkills: foe.marinara.enemySkills }
          : foe.marinara?.classId
            ? {}
            : { enemySkills: [MARINARA_GENERIC_FOE_SKILL[archetypeOf(foe)]] }),
        // No bestiary level growth here: it is measured with the bestiary's own threat fitting, and on the
        // flat tier budget it made level 20+ fights unwinnable on the Engine's AI (engine-balance, 2026-11-01).
        ...(tier === "boss" && foeLevel > 20
          ? { statScale: marinaraLateBossScale(foeLevel, foe.marinara?.statScale) }
          : foe.marinara?.statScale
            ? { statScale: foe.marinara.statScale }
            : {}),
      }),
    );
  });
  return { fighters, left, notes };
}

/**
 * How the game's difficulty setting scales a bestiary encounter's budget: it counts the party as this
 * many times its size (decided 2026-11-01, pending the bestiary's measurements). The fight's own
 * difficulty (easy to deadly) is the GM's per-fight pick on top.
 */
export const MARINARA_GAME_DIFFICULTY_SCALE: Record<string, number> = {
  casual: 0.8,
  normal: 1,
  hard: 1.15,
  brutal: 1.3,
};

function marinaraBestiaryFoes(input: {
  foes: readonly MarinaraFoeBrief[];
  partyLevels: readonly number[];
  difficulty: string;
  keepAll?: boolean;
  setting: MarinaraBestiarySetting;
  encounter?: MarinaraEncounterDifficulty;
}): { fighters: MarinaraFighter[]; left: string[]; notes: string[] } {
  const level = marinaraPartyLevel(input.partyLevels);
  const asked: Array<MarinaraEncounterFoe & { brief: MarinaraFoeBrief }> = input.foes.map((brief) => {
    const family = brief.marinara!.family!;
    return {
      brief,
      familyId: family.familyId,
      tier: family.tier ?? brief.marinara?.tier ?? "standard",
      level: family.level ?? level + (brief.marinara?.levelOffset ?? 0),
    };
  });
  const notes: string[] = [];
  let fitted: MarinaraEncounterFoe[] = asked;
  if (!input.keepAll) {
    const fit = marinaraFitEncounter({
      setting: input.setting,
      party: {
        level,
        size: Math.max(1, input.partyLevels.length * (MARINARA_GAME_DIFFICULTY_SCALE[input.difficulty] ?? 1)),
        // Brutal breaks the level cap (Alyssa 2026-11-01).
        ...(input.difficulty === "brutal" ? { brutal: true } : {}),
      },
      foes: asked.map(({ familyId, tier, level }) => ({ familyId, tier, level })),
      difficulty: input.encounter ?? "normal",
    });
    fitted = fit.foes;
    notes.push(...fit.changes);
  }
  // The fitter keeps foes in order and drops some: each fitted foe is the next asked one of its family.
  const fighters: MarinaraFighter[] = [];
  const used = new Set<number>();
  for (const foe of fitted) {
    const index = asked.findIndex((one, i) => !used.has(i) && one.familyId === foe.familyId);
    if (index < 0) continue;
    used.add(index);
    const brief = asked[index]!.brief;
    try {
      const spec = marinaraEnemySpec({
        familyId: foe.familyId,
        setting: input.setting,
        level: foe.level,
        tier: foe.tier,
        id: brief.id,
        name: brief.name,
      });
      const fighter: MarinaraFighter = {
        ...buildMarinaraEnemy({
          id: spec.id,
          name: spec.name,
          ...(spec.classId ? { classId: spec.classId } : { archetype: spec.archetype }),
          level: spec.level,
          tier: spec.tier,
          ...(spec.row ? { row: spec.row } : {}),
          ...(spec.affinities ? { affinities: spec.affinities } : {}),
          ...(spec.attackType ? { attackType: spec.attackType } : {}),
          ...(spec.enemySkills?.length ? { enemySkills: spec.enemySkills } : {}),
          ...(spec.statScale ? { statScale: spec.statScale } : {}),
          ...(spec.ranged ? { ranged: true } : {}),
          ...(spec.carriedSkills?.length ? { carriedSkills: spec.carriedSkills } : {}),
          ...(spec.openingCooldowns ? { openingCooldowns: spec.openingCooldowns } : {}),
        }),
        familyId: foe.familyId,
        ...(spec.windfall ? { windfall: spec.windfall } : {}),
        ...marinaraTameableFor(foe.familyId, input.setting, spec.level, spec.tier),
      };
      // A treasure foe hardly hurts: everything it deals is scaled down for the whole fight.
      if (spec.damageScale !== undefined && spec.damageScale !== 1)
        fighter.mods.push({ stat: "damage", pct: spec.damageScale - 1, turns: 1e9, source: "treasure" });
      fighters.push(fighter);
    } catch (err) {
      notes.push(`${brief.name}: ${err instanceof Error ? err.message : "not in the bestiary"}; fights by tier.`);
      fighters.push(
        ...marinaraFoeFighters({ ...input, foes: [brief], partyAverageHp: 0, keepAll: true, setting: null }).fighters,
      );
    }
  }
  const left = asked.filter((_, i) => !used.has(i)).map((one) => one.brief.id);
  return { fighters, left, notes };
}
