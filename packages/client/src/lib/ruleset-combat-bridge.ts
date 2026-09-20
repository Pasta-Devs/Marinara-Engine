// Whose sheet is whose, when a battle starts and when it ends.
//
// The arithmetic belongs to the shared combat bridge: it seeds a combatant from a sheet, turns
// catalog-marked rows into the Engine's own combat skills, and works out what a fight has to write
// back. This file only decides which party combatant reads which card, folds the results into the
// party the battle starts with, and merges every member's outcome into the one live object a game
// stores. None of it needs React, so the client-lane regression drives it directly.
//
// A game with no ruleset, or one whose ruleset has no `battle` block, never reaches any of it: the
// party handed in is the party handed back, combatant references included.
//
// It also holds the one decision that says whether a fight is the ruleset's own, and the recap such
// a fight hands the Game Master. Both are pure, and both belong beside the bridge they switch off.
import {
  applyCombatResultToLive,
  combatSkillsFromSheet,
  normalizeCharacterLookupName,
  rulesetSheetBuildsByName,
  seedCombatantFromSheet,
  sheetOpsFromCombatResult,
  type Combatant,
  type CombatSkill,
  type CombatSummary,
  type RulesetCatalogEntriesById,
  type RulesetCombatSeed,
  type RulesetDefinition,
  type RulesetEncounterSummary,
  type RulesetLiveStates,
  type RulesetSheetOp,
  type RulesetSheetRefusal,
} from "@marinara-engine/shared";

/** What each seeded member started a battle with, keyed the way live state is keyed. */
export type RulesetCombatSeeds = Record<string, RulesetCombatSeed>;

/**
 * Whether this game's next fight is resolved by the ruleset itself.
 *
 * All three have to hold: the combat director is on for this game, the ruleset the game resolved
 * declares a `combat` block, and there is a message for the fight to hang off. Without the director
 * there is no server session to resolve anything; without `combat` the ruleset never said how a
 * fight goes; without an anchor no directed screen mounts at all and the fight is Marinara's own.
 *
 * The decision is read off the BLOCKS, never off `coverage.combat`: that flag is what the author
 * says the file covers, and a fight has to be decided by what the file actually declares.
 */
export function isRulesetCombatFight(input: {
  combatDirector: boolean;
  definition: RulesetDefinition | null | undefined;
  anchor: string | null | undefined;
}): boolean {
  return Boolean(input.combatDirector && input.definition?.combat && input.anchor);
}

/**
 * The recap a ruleset fight hands the Game Master, in the ruleset's own pool and its own condition
 * names. Plain English, like every other line of a recap: it is a prompt, not UI copy.
 *
 * It replaces the share-of-maximum lines a bridged battle writes, because here the numbers ARE the
 * sheet's: the server wrote every accepted step to the live state as it happened, which is what the
 * last line tells the Game Master so it does not decide to spend anything again.
 */
export function rulesetCombatRecapLines(definition: RulesetDefinition, summary: RulesetEncounterSummary): string[] {
  const combat = definition.combat;
  // What this ruleset calls the thing a fight takes away, whichever shape it keeps it in. A wound
  // track's numbers are the levels it has LEFT, which is what the rest of the recap already reads,
  // so the only thing that changes here is the name beside them.
  const health = combat?.health;
  const healthLabel = !health
    ? ""
    : "track" in health
      ? (definition.sheet.live.tracks.find((track) => track.id === health.track)?.label ?? health.track)
      : (definition.sheet.live.pools.find((pool) => pool.id === health.pool)?.label ?? health.pool);
  const conditionLabel = new Map(definition.sheet.live.conditions.map((entry) => [entry.id, entry.label]));
  // Stable outranks dying, because a member who has stopped slipping is not still on the clock, and
  // both outrank plain "down": the ruleset's own dying rule is what put them there.
  const standing = (member: RulesetEncounterSummary["party"][number]) =>
    member.stable ? "stable" : member.dying ? "dying" : member.down ? "down" : "";
  const party = summary.party.map((member) => {
    const notes = [
      standing(member),
      member.temp > 0 ? `${member.temp} temporary` : "",
      member.conditions.length > 0 ? member.conditions.map((id) => conditionLabel.get(id) ?? id).join(", ") : "",
    ].filter(Boolean);
    const suffix = notes.length > 0 ? ` (${notes.join("; ")})` : "";
    return `${member.name}: ${member.health}/${member.maxHealth} ${healthLabel}${suffix}`;
  });
  const lines = [`Party on ${definition.name} rules: ${party.join("; ")}`];
  const alive = summary.enemies.filter((enemy) => !enemy.defeated);
  if (alive.length > 0) {
    const left = alive.map((enemy) => `${enemy.name} (${enemy.health}/${enemy.maxHealth})`).join(", ");
    lines.push(`Still standing: ${left}`);
  }
  lines.push(
    `Sheets: the ${definition.name} sheets were kept up to date while the fight ran, so every cost is already paid. Do not change those numbers again.`,
  );
  // A condition does not expire because the fighting stopped. It is still on the sheet, and the
  // thing that would end it, a spell's own terms, a night's rest, somebody's help, is a ruling
  // rather than arithmetic, so it is the Game Master's to make and they are told they have it.
  // Not the one the ruleset's own dying rule puts on somebody at zero: that comes off when they are
  // healed or stabilised, which the rules already say, and asking the Game Master to rule on it
  // would invite them to wake a dying character by fiat.
  const dyingCondition = combat?.dying?.condition;
  const lingeringOf = (member: RulesetEncounterSummary["party"][number]) =>
    member.conditions.filter((id) => id !== dyingCondition);
  const lingering = summary.party.filter((member) => lingeringOf(member).length > 0);
  if (lingering.length > 0) {
    const who = lingering
      .map(
        (member) =>
          `${member.name} (${lingeringOf(member)
            .map((id) => conditionLabel.get(id) ?? id)
            .join(", ")})`,
      )
      .join("; ");
    lines.push(
      `Still affected: ${who}. These stay until you take them off. Decide whether the fiction ends one, and write [sheet: who="Name" op="condition" condition="Name" state="off"] when it does.`,
    );
  }
  return lines;
}

export interface RulesetBattleParty {
  /** The party the battle starts with, or the very array handed in when nothing was seeded. */
  party: Combatant[];
  seeds: RulesetCombatSeeds;
}

export interface RulesetBattleWriteBack {
  /** The whole `rulesetLive` object to store, or null when no member's sheet moved. */
  live: RulesetLiveStates | null;
  /** The members whose sheet the battle changed, in the order the summary lists them. */
  updated: string[];
  refused: Array<{ name: string; op: RulesetSheetOp; reason: RulesetSheetRefusal }>;
}

/** The catalogs a battle has to fetch: the ones feeding a list `battle.skills` names. A ruleset
 *  that builds no skills from its sheet asks for nothing at all. */
export function rulesetBattleCatalogIds(definition: RulesetDefinition): string[] {
  const lists = new Set((definition.battle?.skills ?? []).map((source) => source.list));
  if (lists.size === 0) return [];
  return (definition.catalogs ?? [])
    .filter((catalog) => catalog.feeds?.some((list) => lists.has(list)))
    .map((catalog) => catalog.id);
}

/** Hit points, energy and slots come from the sheet; everything else on the combatant is the
 *  Engine's and stays, `maxHp` included: the sheet sets only what share of that maximum the fight
 *  starts on. The sheet's skills are ADDED to the ones the card already generated, so a battle never
 *  loses an ability it used to offer. */
function combatantFromSheet(combatant: Combatant, seed: RulesetCombatSeed, skills: CombatSkill[]): Combatant {
  const next: Combatant = { ...combatant, hp: seed.hp };
  if (seed.mp !== undefined) next.mp = seed.mp;
  if (seed.maxMp !== undefined) next.maxMp = seed.maxMp;
  if (seed.spellSlots) next.spellSlots = seed.spellSlots;
  const known = new Set((next.skills ?? []).map((skill) => skill.id));
  const added = skills.filter((skill) => !known.has(skill.id));
  if (added.length > 0) next.skills = [...(next.skills ?? []), ...added];
  return next;
}

/**
 * The party a bridged battle starts with, and what each seeded member started from. A member with
 * no readable sheet, an enemy, and every member of a game whose ruleset has no `battle` block are
 * returned exactly as they came in.
 */
export function seedRulesetBattleParty(
  definition: RulesetDefinition,
  cards: unknown,
  live: RulesetLiveStates | null | undefined,
  catalogs: RulesetCatalogEntriesById,
  party: Combatant[],
  playerName?: string | null,
): RulesetBattleParty {
  const seeds: RulesetCombatSeeds = {};
  if (!definition.battle) return { party, seeds };
  const builds = rulesetSheetBuildsByName(cards, playerName);
  if (builds.size === 0) return { party, seeds };

  let seeded = false;
  const next = party.map((combatant) => {
    // Only the party the player fields is on a ruleset; an enemy has no sheet to read.
    if (combatant.side !== "player") return combatant;
    const key = normalizeCharacterLookupName(combatant.name);
    const build = builds.get(key);
    if (!build) return combatant;
    // The Engine's own maximum is what the sheet's share is measured against, so the fight is
    // fought on the numbers the damage arithmetic was built for.
    const seed = seedCombatantFromSheet(definition, build, live?.[key], combatant.maxHp);
    if (!seed) return combatant;
    seeds[key] = seed;
    seeded = true;
    return combatantFromSheet(combatant, seed, combatSkillsFromSheet(definition, build, catalogs));
  });
  return { party: seeded ? next : party, seeds };
}

/**
 * What the sheets look like once the battle is over: one live object for the whole game, built by
 * running each member's own deltas through the same `applyRulesetSheetOp` the player's sheet
 * buttons go through. A member the battle never seeded is left alone, and so is a member whose
 * numbers did not move.
 */
export function applyRulesetBattleResult(
  definition: RulesetDefinition,
  cards: unknown,
  live: RulesetLiveStates | null | undefined,
  /** What this battle's members started from, or null when this session never seeded the battle (it
   *  was restored after a reload) and what the sheets hold now is what the fight began with. */
  seeds: RulesetCombatSeeds | null,
  party: CombatSummary["party"],
  playerName?: string | null,
): RulesetBattleWriteBack {
  const result: RulesetBattleWriteBack = { live: null, updated: [], refused: [] };
  if (!definition.battle) return result;
  const builds = rulesetSheetBuildsByName(cards, playerName);

  let merged: RulesetLiveStates | null = null;
  for (const member of party) {
    const key = normalizeCharacterLookupName(member.name);
    const build = builds.get(key);
    if (!build) continue;
    const current = merged?.[key] ?? live?.[key];
    // Nothing else moves a pool while a battle is on screen, so a fight this session did not seed
    // started from exactly what the sheet holds now, at the share of the maximum the summary still
    // reports for it. A fight it DID seed is measured against the seed, which is what keeps a sheet
    // edited mid-battle from being counted twice, and keeps a member the battle never seeded out of
    // the write-back entirely.
    const before = seeds ? seeds[key] : seedCombatantFromSheet(definition, build, current, member.maxHp);
    if (!before) continue;
    const ops = sheetOpsFromCombatResult(definition, before, {
      hp: member.hp,
      mp: member.mp,
      spellSlots: member.spellSlots,
    });
    if (ops.length === 0) continue;

    const written = applyCombatResultToLive(definition, build, current, ops);
    for (const refusal of written.refused) result.refused.push({ name: member.name, ...refusal });
    if (!written.live) continue;
    merged = { ...(merged ?? live ?? {}) };
    // The same normalisation the in-game sheet applies: a character back at their defaults drops
    // out of the store instead of keeping an empty entry forever.
    if (Object.keys(written.live).length > 0) merged[key] = written.live;
    else delete merged[key];
    result.updated.push(member.name);
  }
  result.live = merged;
  return result;
}
