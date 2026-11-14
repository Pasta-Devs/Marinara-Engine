// Classic Marinara at a fight's start (combat overhaul, Alyssa 2026-10-31): every party member fights
// with the class progression kept on their game card, made the first time they fight from their card and
// the temperament kept there; every opponent is read as a tier and an archetype, and the fight is kept
// within the game's encounter budget unless the story wrote it.

import {
  awardMarinaraXp,
  createMarinaraCardProgression,
  marinaraClassBlock,
  marinaraEnemyFamily,
  marinaraEnemyName,
  marinaraFoeAiHints,
  marinaraFoeXp,
  marinaraRandom,
  marinaraRollRareEncounter,
  scaleMarinaraXp,
  MARINARA_CLASSES,
  type MarinaraBestiarySetting,
  type MarinaraEncounterDifficulty,
  type MarinaraEncounterFoe,
  type MarinaraFightGrowth,
  gameCardTemperament,
  marinaraFoeFighters,
  marinaraPartyFighter,
  normalizeCharacterLookupName,
  normalizeGameDifficulty,
  type MarinaraCardClassic,
  partyTemperamentFallback,
  readMarinaraCardProgression,
  type Combatant,
  type MarinaraCardProgression,
  type MarinaraFighter,
  type MarinaraFoeBrief,
  type MarinaraPartyTemperament,
  type MarinaraDamageType,
  marinaraAddCompanion,
  marinaraApplyCompanions,
} from "@marinara-engine/shared";
import { gameCardFor } from "./party-temperament.service.js";
import { marinaraCombatant, type MarinaraDirectorState } from "./marinara-director.service.js";

export interface MarinaraFightStart {
  party: Combatant[];
  enemies: Combatant[];
  fighters: MarinaraFighter[];
  /** The game's cards with new progressions written on, where any was made. */
  cards: Record<string, unknown>[] | null;
  notes: string[];
}

/** What the Engine keeps of a fight's own unit on the Classic Marinara one it becomes. */
function kept(unit: Combatant): Partial<Combatant> {
  const {
    id: _id,
    name: _n,
    side: _s,
    hp: _h,
    maxHp: _mh,
    mp: _m,
    maxMp: _mm,
    attack: _a,
    defense: _d,
    speed: _sp,
    level: _l,
    skills: _sk,
    statusEffects: _st,
    ...rest
  } = unit as Combatant & { statusEffects?: unknown };
  return rest;
}

/** A place's roster as the fight's foes: named as the setting names them, lettered where they repeat. */
function placeBriefs(foes: readonly MarinaraEncounterFoe[], setting: MarinaraBestiarySetting): MarinaraFoeBrief[] {
  const names = foes.map((foe) => {
    const family = marinaraEnemyFamily(foe.familyId);
    return (family && marinaraEnemyName(family, setting, foe.level)) ?? foe.familyId;
  });
  const seen = new Map<string, number>();
  return foes.map((foe, index) => {
    const name = names[index]!;
    const repeats = names.filter((one) => one === name).length > 1;
    const nth = (seen.get(name) ?? 0) + 1;
    seen.set(name, nth);
    return {
      id: `place-${index + 1}`,
      name: repeats ? `${name} ${String.fromCharCode(64 + nth)}` : name,
      ...(foe.tier === "boss" ? { boss: true } : {}),
      marinara: { family: { familyId: foe.familyId, tier: foe.tier, level: foe.level }, region: true },
    };
  });
}

export function marinaraFightStart(input: {
  gameId: string;
  cards: readonly Record<string, unknown>[];
  party: readonly Combatant[];
  enemies: readonly Combatant[];
  difficulty: string;
  /** A story's own fight keeps every opponent it wrote. */
  storyFight: boolean;
  /** The game's bestiary setting, for bestiary foes. */
  setting?: MarinaraBestiarySetting | null;
  /** The fight's own difficulty for bestiary foes. */
  encounter?: MarinaraEncounterDifficulty;
  /** A chance encounter: now and then a rare treasure foe turns up in it. */
  chance?: boolean;
  /** The story found a rare treasure foe here. */
  treasure?: boolean;
  /** Seeds the rare encounter roll. */
  seed?: string;
  /** The Classic picks on the party's library cards, by lookup name, for a progression made now. */
  classic?: ReadonlyMap<string, MarinaraCardClassic>;
  /** The ammunition types the party's bags hold, for its Marksmen's bows and guns. */
  ammo?: readonly MarinaraDamageType[];
  /** The party owns wounding ammunition (Serrated): its Marksmen's pierce shots wound. */
  woundingAmmo?: boolean;
  /** Room players' characters whose player isn't here, by lookup name: they sit this fight out. */
  away?: ReadonlySet<string>;
  /** The foes the place itself holds (a dungeon area's roster): they are the fight's foes, at their own
   *  levels, in place of those the setup wrote. Never in a story's own fight. */
  placeFoes?: readonly MarinaraEncounterFoe[];
}): MarinaraFightStart {
  const named = input.cards.filter(
    (card): card is Record<string, unknown> & { name: string } =>
      typeof card.name === "string" && Boolean(card.name.trim()),
  );
  const made = new Map<string, MarinaraCardProgression>();
  const party: Combatant[] = [];
  const fighters: MarinaraFighter[] = [];
  const keepers: Array<{ fighter: MarinaraFighter; progression: MarinaraCardProgression; member: Combatant }> = [];
  for (const member of input.party) {
    const card = gameCardFor(named, member.name);
    let progression = readMarinaraCardProgression(card?.marinara);
    if (card && progression?.fallen) continue;
    if (card && input.away?.has(normalizeCharacterLookupName(card.name))) continue;
    if (!progression) {
      const temperament = (gameCardTemperament(card)?.initial ??
        partyTemperamentFallback(input.gameId, card?.name ?? member.name)) as MarinaraPartyTemperament;
      progression = createMarinaraCardProgression({
        gameId: input.gameId,
        card: (card ?? { name: member.name }) as Parameters<typeof createMarinaraCardProgression>[0]["card"],
        temperament,
        classic: input.classic?.get(normalizeCharacterLookupName(card?.name ?? member.name)),
      });
      // One with no game card (a summoned beast) fights with a progression drawn for this fight alone.
      if (card) made.set(normalizeCharacterLookupName(card.name), progression);
    }
    const fighter = marinaraPartyFighter(member.id, member.name, progression);
    if (input.ammo?.length && fighter.archetype === "marksman") fighter.ammoOwned = [...input.ammo];
    if (input.woundingAmmo && fighter.archetype === "marksman") fighter.ammoWounds = true;
    fighters.push(fighter);
    keepers.push({ fighter, progression, member });
  }
  // Tamed companions (Tracker): their keeper's stat, and with Bond the party's, before anyone is shown.
  marinaraApplyCompanions(keepers);
  for (const { fighter, member } of keepers) party.push(marinaraCombatant(fighter, kept(member)));
  const partyAverageHp = fighters.length ? fighters.reduce((sum, one) => sum + one.maxHp, 0) / fighters.length : 20;
  // A place's own foes stand in for the bestiary foes the setup wrote (dungeon spawns): what the GM may not
  // swap, at the levels the world gave them.
  const placed =
    input.setting && input.placeFoes?.length && !input.storyFight ? placeBriefs(input.placeFoes, input.setting) : null;
  const written = input.enemies as unknown as MarinaraFoeBrief[];
  const foes = marinaraFoeFighters({
    foes: placed ?? written,
    partyLevels: fighters.map((one) => one.level),
    partyAverageHp,
    difficulty: input.difficulty,
    keepAll: input.storyFight,
    ...(input.setting ? { setting: input.setting } : {}),
    ...(input.encounter ? { encounter: input.encounter } : {}),
  });
  // A rare treasure foe (Alyssa 2026-11-01): about 1 chance encounter in 32, or when the story found one.
  // Never in a story's own fight.
  if (input.setting && !input.storyFight && (input.chance || input.treasure)) {
    const levels = fighters.map((one) => one.level);
    const level = levels.length ? levels.reduce((sum, one) => sum + one, 0) / levels.length : 1;
    const rolled = marinaraRollRareEncounter({
      setting: input.setting,
      party: { level, size: Math.max(1, levels.length), ...(input.difficulty === "brutal" ? { brutal: true } : {}) },
      random: marinaraRandom(`${input.gameId}:${input.seed ?? ""}:rare`),
      ...(input.treasure ? { force: true } : {}),
    });
    if (rolled) {
      const letters = "ABC";
      const briefs: MarinaraFoeBrief[] = rolled.map((foe, index) => {
        const family = marinaraEnemyFamily(foe.familyId);
        const name = (family && marinaraEnemyName(family, input.setting!, foe.level)) ?? foe.familyId;
        return {
          id: `treasure-${index + 1}`,
          name: rolled.length > 1 ? `${name} ${letters[index]}` : name,
          marinara: { family: { familyId: foe.familyId, tier: foe.tier, level: foe.level } },
        };
      });
      const extra = marinaraFoeFighters({
        foes: briefs,
        partyLevels: levels,
        partyAverageHp,
        difficulty: input.difficulty,
        keepAll: true,
        setting: input.setting,
      });
      foes.fighters.push(...extra.fighters);
      foes.notes.push(`A rare encounter: ${briefs.map((one) => one.name).join(", ")}.`, ...extra.notes);
    }
  }
  const byId = new Map(input.enemies.map((unit) => [unit.id, unit]));
  const enemies = foes.fighters.map((fighter) => {
    const unit = byId.get(fighter.id);
    const extra: Partial<Combatant> = unit ? kept(unit) : {};
    // A bestiary foe fights with its family's mind and one of its temperaments, unless the story gave one.
    const family = fighter.familyId
      ? marinaraFoeAiHints(fighter.familyId, marinaraRandom(`${input.seed ?? input.gameId}:${fighter.id}:temperament`))
      : undefined;
    if (family && !extra.aiHints?.temperament) extra.aiHints = { ...extra.aiHints, ...family };
    return marinaraCombatant(fighter, extra);
  });
  // Easy games soften bosses (Alyssa 2026-11-06): hits on them can't be walled off or dodged as often.
  if (normalizeGameDifficulty(input.difficulty) === "casual")
    for (const fighter of foes.fighters) if (fighter.tier === "boss") fighter.easyFloors = true;
  fighters.push(...foes.fighters);
  const cards = made.size
    ? input.cards.map((card) => {
        const progression =
          typeof card.name === "string" ? made.get(normalizeCharacterLookupName(card.name)) : undefined;
        return progression ? { ...card, marinara: progression } : card;
      })
    : null;
  return { party, enemies, fighters, cards, notes: foes.notes };
}

/**
 * What a fight's end gives the party (decided 2026-11-01, for Alyssa's review): a won fight pays each
 * beaten foe's XP (its tier's), half shared evenly by everyone who fought and half by the share of
 * damage, healing and support each gave; each share is scaled by the foe's level against theirs, with
 * the catch-up for those below the party's average. A foe that surrendered or fled counts as beaten. A lost or fled fight pays nothing. Under
 * permadeath, one down when a won or fled fight ends is gone; a lost fight is left to the story.
 */
export function marinaraFightEnd(input: {
  state: MarinaraDirectorState;
  outcome: string;
  cards: readonly Record<string, unknown>[];
  seed: number;
  permadeath: boolean;
}): { growth: MarinaraFightGrowth[]; cards: Record<string, unknown>[] | null } {
  const party = input.state.fighters.filter((one) => one.side === "party");
  const foes = input.state.fighters.filter((one) => one.side !== "party");
  // Foes that left a won fight alive (surrendered, fled) were driven off: they pay as the beaten do,
  // save a treasure foe, which got away with its windfall.
  const left = (input.state.left ?? []).filter((one) => one.side !== "party" && !one.windfall);
  const named = input.cards.filter(
    (card): card is Record<string, unknown> & { name: string } =>
      typeof card.name === "string" && Boolean(card.name.trim()),
  );
  const beaten = input.outcome === "victory" ? [...foes.filter((foe) => foe.hp <= 0), ...left] : [];
  const shareOf = (id: string) => {
    const credit = input.state.credit[id];
    return credit ? credit.damage + credit.support : 0;
  };
  const total = party.reduce((sum, one) => sum + shareOf(one.id), 0);
  const average = party.length ? party.reduce((sum, one) => sum + one.level, 0) / party.length : 1;
  const growth: MarinaraFightGrowth[] = [];
  const changed = new Map<string, MarinaraCardProgression>();
  for (const fighter of party) {
    const card = gameCardFor(named, fighter.name);
    const progression = readMarinaraCardProgression(card?.marinara);
    if (!card || !progression) continue;
    const share = 0.5 / party.length + (total > 0 ? (0.5 * shareOf(fighter.id)) / total : 0.5 / party.length);
    const xp = beaten.reduce(
      (sum, foe) =>
        sum +
        scaleMarinaraXp({
          // A treasure foe pays its windfall: that many standard foes' XP at its level.
          base: (foe.windfall ? marinaraFoeXp({ tier: "standard" }) * foe.windfall.xp : marinaraFoeXp(foe)) * share,
          level: progression.level,
          foeLevel: foe.level,
          partyAverageLevel: average,
        }),
      0,
    );
    const fell = input.permadeath && fighter.hp <= 0 && input.outcome !== "defeat";
    // A beast this fighter tamed joins their stable, or waits on a release when it is full (Tracker,
    // Alyssa 23:31). Kept even when the fight is then lost: once Tame lands, the beast is theirs (Sonnet
    // panel r6: every tester who lost one hated it; proposed for the owner's call, drop this to revert).
    const beast = [...(input.state.left ?? [])].reverse().find((one) => one.tamedBy === fighter.id && one.tameable);
    const companion = beast?.tameable
      ? {
          id: `${beast.tameable.familyId ?? "beast"}-${beast.id}-${input.seed}`,
          name: beast.tameable.name,
          stat: beast.tameable.stat,
          ...(beast.tameable.familyId ? { familyId: beast.tameable.familyId } : {}),
          level: beast.level,
          tier: beast.tier ?? "standard",
        }
      : undefined;
    if (!xp && !fell && !companion) continue;
    const awarded = xp
      ? awardMarinaraXp(progression, xp, marinaraRandom(`${input.seed}:growth:${card.name}`))
      : { progression, levelUps: [] };
    const grown: MarinaraCardProgression = {
      ...progression,
      ...awarded.progression,
      ...(fell ? { fallen: true } : {}),
    };
    const next = companion ? marinaraAddCompanion(grown, companion) : grown;
    changed.set(normalizeCharacterLookupName(card.name), next);
    const active = next.activeClass;
    growth.push({
      name: fighter.name,
      xp,
      level: next.level,
      classId: active,
      classLevel: next.classLevels[active] ?? 1,
      levelUps: awarded.levelUps,
      ...(MARINARA_CLASSES.some(
        (def) => def.from === active && next.classLevels[def.id] === undefined && !marinaraClassBlock(next, def.id),
      )
        ? { promotionReady: true }
        : {}),
      ...(fell ? { fallen: true } : {}),
      ...(companion ? { tamed: companion.name } : {}),
      ...(companion && next.pendingCompanion?.id === companion.id ? { stableFull: true } : {}),
    });
  }
  const cards = changed.size
    ? input.cards.map((card) => {
        const next = typeof card.name === "string" ? changed.get(normalizeCharacterLookupName(card.name)) : undefined;
        return next ? { ...card, marinara: next } : card;
      })
    : null;
  return { growth, cards };
}
