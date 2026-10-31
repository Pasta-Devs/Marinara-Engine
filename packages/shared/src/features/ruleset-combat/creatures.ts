// Bestiaries: finding an opponent a ruleset ships, and pulling one nobody wrote onto its scale.
//
// A bestiary catalog holds creatures instead of rows. Everything here turns one of those entries
// into the stat block the resolver already takes, or takes a block somebody proposed and clamps it
// into the ruleset's own threat scale, so nothing a Game Master invents lands off it.
//
// Pure, like the rest of the fight: no I/O, nothing thrown, and a clamp that says in plain words
// what it changed so a log can print the line.

import { RULESET_DAMAGE_MAX_PLUS } from "../../schemas/ruleset.schema.js";
import type {
  RulesetCatalogEntriesById,
  RulesetCatalogEntry,
  RulesetCombatThreatTier,
  RulesetCreature,
  RulesetCreatureAction,
  RulesetDefinition,
  RulesetProposedCreature,
} from "../../schemas/ruleset.schema.js";
import { withoutTrailingKind } from "../../utils/trailing-kind.js";
import { rulesetCatalogIdsForBuild } from "../rulesets/scaled-rows.js";
import { parseRulesetCombatDice, rulesetAverageAmount, rulesetAverageDamage } from "./dice.js";
import type {
  RulesetCombatAmount,
  RulesetCombatDamage,
  RulesetCombatCharge,
  RulesetCombatDamageClause,
  RulesetCombatRider,
  RulesetPlainStatBlock,
  RulesetReactionAlso,
  RulesetStatBlock,
  RulesetStatBlockAction,
} from "./types.js";

import { rulesetInCells } from "./grid.js";

/** What narrows one moment of a reaction: what it answers, the kind of blow (1.118), and whether its
 *  holder must see the source (1.118). */
type RulesetMomentNarrowing = Omit<RulesetReactionAlso, "on">;

/** What a reaction answers, copied so whoever holds it owns its own lists: what narrows its first
 *  moment, and the moments it is `also` taken at (1.117), each with what narrows it. */
export function rulesetReactionAnswers(
  reaction: RulesetMomentNarrowing & { also?: ReadonlyArray<RulesetReactionAlso> },
  perCell?: number,
): RulesetMomentNarrowing & { also?: RulesetReactionAlso[] } {
  const narrowing = (moment: RulesetMomentNarrowing): RulesetMomentNarrowing => ({
    ...(moment.against
      ? {
          against: {
            ...(moment.against.catalogs ? { catalogs: [...moment.against.catalogs] } : {}),
            ...(moment.against.actions ? { actions: [...moment.against.actions] } : {}),
            ...(moment.against.qualities ? { qualities: [...moment.against.qualities] } : {}),
            ...(moment.against.entries ? { entries: [...moment.against.entries] } : {}),
          },
        }
      : {}),
    ...(moment.for ? { for: moment.for } : {}),
    ...(moment.within !== undefined
      ? {
          within:
            perCell === undefined ? moment.within : moment.within === 0 ? 0 : rulesetInCells(moment.within, perCell),
        }
      : {}),
    ...(moment.blow ? { blow: moment.blow } : {}),
    ...(moment.seesSource ? { seesSource: true as const } : {}),
    ...(moment.by ? { by: moment.by } : {}),
    ...(moment.weapon ? { weapon: true as const } : {}),
    ...(moment.names ? { names: [...moment.names] } : {}),
    ...(moment.budget ? { budget: moment.budget } : {}),
    ...(moment.freeSlot ? { freeSlot: moment.freeSlot } : {}),
    ...(moment.missed ? { missed: true as const } : {}),
    ...(moment.sourceIs ? { sourceIs: structuredClone(moment.sourceIs) } : {}),
    ...(moment.forHolds ? { forHolds: [...moment.forHolds] } : {}),
  });
  return {
    ...narrowing(reaction),
    ...(reaction.also ? { also: reaction.also.map((moment) => ({ on: moment.on, ...narrowing(moment) })) } : {}),
  };
}

/** How many actions survive a clamp. A proposal with more than this is a creature nobody could read
 *  at the table, whatever the numbers say. */
export const RULESET_CLAMP_MAX_ACTIONS = 6;

/** How far above the tier's own number a clamped block may sit. One rung of a scale is a range, not
 *  a line, so a creature at the top of its tier is still on it. */
export const RULESET_CLAMP_HEADROOM = 2;

/** A name matched the way a Game Master writes it: case and punctuation are not the point, the word
 *  is. "Ash-hound", "ash hound" and "Ash Hound" are one creature. */
function plainly(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/** The entry a `{ catalogId, entryId }` reference names, and nothing else. */
export function findRulesetCreatureEntry(
  catalogs: RulesetCatalogEntriesById,
  ref: { catalogId: string; entryId: string },
): RulesetCatalogEntry | null {
  const entry = catalogs[ref.catalogId]?.find((candidate) => candidate.id === ref.entryId);
  return entry?.creature ? entry : null;
}

/**
 * The creature a Game Master named, looked up three ways and no more: the exact
 * `<catalogId>/<entryId>`, then a label or an id that matches once case and punctuation are set
 * aside (with any tag or kind said beside the name, too), then nothing. Never fuzzy beyond that, because a fight built on a near miss is worse than
 * one the Engine says it could not build.
 */
export function findRulesetCreature(
  catalogs: RulesetCatalogEntriesById,
  query: string,
): { catalogId: string; entry: RulesetCatalogEntry } | null {
  const wanted = query.trim();
  if (!wanted) return null;
  const slash = wanted.indexOf("/");
  if (slash > 0) {
    const catalogId = wanted.slice(0, slash);
    const entryId = wanted.slice(slash + 1);
    const exact = findRulesetCreatureEntry(catalogs, { catalogId, entryId });
    if (exact) return { catalogId, entry: exact };
  }
  // A tag or a kind said beside the name is no part of it (laptop 2026-10-26: "Giant Crocodile [cr_5]",
  // "Reef Shark, Beast", "Wolf (Beast)").
  const bare = withoutTrailingKind(wanted.replace(/\[[^\][]*\]/gu, " "));
  // Nor is a leading "the" (laptop 2026-10-26: "the Giant Crocodile from the river").
  const unarticled = bare.replace(/^the\s+/iu, "");
  for (const plain of [...new Set([plainly(wanted), plainly(bare), plainly(unarticled)])]) {
    if (!plain) continue;
    for (const [catalogId, entries] of Object.entries(catalogs)) {
      for (const entry of entries) {
        if (!entry.creature) continue;
        if (plainly(entry.label) === plain || plainly(entry.id) === plain) return { catalogId, entry };
      }
    }
  }
  return null;
}

/**
 * The type of `combat.creatureTypes` a writer said an opponent is: one named by its id or label, else
 * the first named as a whole word among other words ("undead (skeleton)", "a skeletal undead",
 * "constructs"). Undefined where it names none, or the ruleset has no creature types.
 */
export function rulesetSaidCreatureType(definition: RulesetDefinition, said: string | undefined): string | undefined {
  const kinds = definition.combat?.creatureTypes?.types ?? [];
  const words = (text: string) =>
    text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim();
  const text = words(said ?? "");
  if (!text || kinds.length === 0) return undefined;
  const exact = kinds.find((one) => [one.id, one.label].some((name) => words(name) === text));
  if (exact) return exact.id;
  const padded = ` ${text} `;
  let best: { at: number; id: string } | undefined;
  for (const one of kinds)
    for (const name of [one.id, one.label]) {
      const word = words(name);
      if (!word) continue;
      const at = [` ${word} `, ` ${word}s `].map((form) => padded.indexOf(form)).find((found) => found >= 0);
      if (at !== undefined && (!best || at < best.at)) best = { at, id: one.id };
    }
  return best?.id;
}

/** How many bestiary creatures `rulesetBestiaryNamedIn` names at most. */
export const RULESET_BESTIARY_NAMED_MOST = 3;

/**
 * The bestiary creatures some words name, by label as whole words with case aside (a plural's s or es
 * on the last word too), longest names first and each once, up to `most`: the player's "the Giant
 * Crocodile from the river" names the Giant Crocodile, and not the Crocodile inside it. What lets the
 * Game Master use the entry rather than invent one (laptop 2026-10-26: an "Enraged River Queen" was
 * made up for the SRD's own Giant Crocodile).
 */
export function rulesetBestiaryNamedIn(
  catalogs: RulesetCatalogEntriesById,
  texts: ReadonlyArray<string | undefined>,
  most = RULESET_BESTIARY_NAMED_MOST,
): Array<{ label: string; tier?: string }> {
  const words = (text: string) =>
    text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim();
  let padded = texts
    .filter((text): text is string => !!text?.trim())
    .map((text) => ` ${words(text)} `)
    .join(" | ");
  if (!padded.trim()) return [];
  const labels = new Map<string, { label: string; tier?: string; plain: string }>();
  for (const entries of Object.values(catalogs))
    for (const entry of entries) {
      if (!entry.creature) continue;
      const plain = words(entry.label).replace(/^the /u, "");
      if (plain.length >= 3 && !labels.has(plain))
        labels.set(plain, { label: entry.label, plain, ...(entry.creature.tier ? { tier: entry.creature.tier } : {}) });
    }
  const found: Array<{ label: string; tier?: string }> = [];
  for (const one of [...labels.values()].sort((a, b) => b.plain.length - a.plain.length)) {
    if (found.length >= most) break;
    const forms = [one.plain, `${one.plain}s`, `${one.plain}es`];
    const form = forms.find((each) => padded.includes(` ${each} `));
    if (!form) continue;
    found.push({ label: one.label, ...(one.tier ? { tier: one.tier } : {}) });
    // Its words are spent, so a shorter name inside it is not named again.
    padded = padded.split(` ${form} `).join(" | ");
  }
  return found;
}

/** A creature's amount as the fight rolls it: the dice text plus whatever flat part sits beside it. */
function amountOf(input: { dice?: string; flat?: number } | undefined): RulesetCombatAmount | null {
  if (!input) return null;
  const dice = input.dice ? parseRulesetCombatDice(input.dice) : null;
  if (!dice && input.flat === undefined) return null;
  return { count: dice?.count ?? 0, sides: dice?.sides ?? 0, flat: (dice?.flat ?? 0) + (input.flat ?? 0) };
}

/** The clauses beside a blow's first amount. A clause with a save of its own falls back to the
 *  action's number when it named none, and a block has no other number to reach for. */
function clausesOf(
  action: RulesetCreatureAction,
  plus = action.damage?.plus,
  fallback = action.save?.difficulty ?? action.saveDifficulty ?? 0,
): RulesetCombatDamageClause[] | null {
  const clauses = (plus ?? []).flatMap((clause) => {
    const amount = amountOf(clause);
    if (!amount) return [];
    return [
      {
        ...amount,
        ...(clause.type ? { type: clause.type } : {}),
        ...(clause.targetIs ? { targetIs: clause.targetIs } : {}),
        ...(clause.save
          ? {
              save: {
                save: clause.save.save,
                onSuccess: clause.save.onSuccess,
                difficulty: clause.save.difficulty ?? fallback,
              },
            }
          : {}),
      },
    ];
  });
  return clauses.length > 0 ? clauses : null;
}

/** A charge as a block carries it (1.186): its clauses' saves fall back to the charge's own number. */
function chargeOf(
  action: RulesetCreatureAction,
  charge: NonNullable<RulesetCreatureAction["charge"]>,
): RulesetCombatCharge {
  const plus = clausesOf(
    action,
    charge.plus,
    charge.save?.difficulty ?? action.save?.difficulty ?? action.saveDifficulty ?? 0,
  );
  return {
    atLeast: charge.atLeast,
    ...(plus ? { plus } : {}),
    ...(charge.save ? { save: { ...charge.save } } : {}),
    ...(charge.push !== undefined ? { push: charge.push } : {}),
    ...(charge.applies ? { applies: charge.applies.map((entry) => ({ ...entry })) } : {}),
    ...(charge.then ? { then: structuredClone(charge.then) } : {}),
  };
}

function creatureAction(action: RulesetCreatureAction): RulesetStatBlockAction {
  const damage = amountOf(action.damage);
  const heal = amountOf(action.heal);
  const plus = clausesOf(action);
  const alternatives = (action.damage?.alternatives ?? []).flatMap((alternative) => {
    const amount = amountOf(alternative);
    return amount ? [{ ...amount, when: structuredClone(alternative.when) }] : [];
  });
  return {
    id: action.id,
    name: action.name,
    budget: action.budget,
    ...(action.toHit !== undefined ? { toHit: action.toHit } : {}),
    ...(action.upgrades ? { upgrades: action.upgrades } : {}),
    ...(action.autoHit ? { autoHit: true } : {}),
    ...(action.needs ? { needs: [...action.needs] } : {}),
    ...(action.needs && action.needsAny ? { needsAny: true as const } : {}),
    ...(action.seen ? { seen: true as const } : {}),
    ...(action.components ? { components: [...action.components] } : {}),
    ...(damage
      ? {
          damage: {
            ...damage,
            ...(action.damage?.type ? { type: action.damage.type } : {}),
            ...(plus ? { plus } : {}),
            ...(action.damage?.qualities?.length ? { qualities: [...action.damage.qualities] } : {}),
            ...(alternatives.length ? { alternatives } : {}),
          } as RulesetCombatDamage,
        }
      : {}),
    ...(heal ? { heal } : {}),
    ...(action.ends ? { ends: structuredClone(action.ends) } : {}),
    ...(action.qualities ? { qualities: [...action.qualities] } : {}),
    ...(action.targets ? { targets: action.targets } : {}),
    ...(action.save ? { save: { ...action.save } } : {}),
    ...(action.saveDifficulty !== undefined ? { saveDifficulty: action.saveDifficulty } : {}),
    ...(action.applies?.length ? { applies: action.applies.map((entry) => ({ ...entry })) } : {}),
    // Held by the creature's concentration (1.307).
    ...(action.concentration ? { concentration: true as const } : {}),
    // At the dying, and deadly to them (1.311): a will-o'-wisp's Consume Life.
    ...(action.dyingOnly ? { dyingOnly: true as const } : {}),
    ...(action.inShape ? { inShape: [...action.inShape] } : {}),
    ...(action.whileFlying ? { whileFlying: true as const } : {}),
    ...(action.castsOne ? { castsOne: true as const } : {}),
    ...(action.slaysOnFailedSave ? { slaysOnFailedSave: true as const } : {}),
    ...(action.slaysHealthAtMost !== undefined ? { slaysHealthAtMost: action.slaysHealthAtMost } : {}),
    ...(action.dropsOnFailedSave ? { dropsOnFailedSave: true as const } : {}),
    // Never on the same creature again (1.674): Frightful Presence.
    ...(action.oncePerTarget ? { oncePerTarget: { ...action.oncePerTarget } } : {}),
    ...(action.healsOnSlay && amountOf(action.healsOnSlay) ? { healsOnSlay: amountOf(action.healsOnSlay)! } : {}),
    // Who it fells on Held Ground stays down (1.323).
    ...(action.reaps ? { reaps: true as const } : {}),
    ...(action.targetCount !== undefined ? { targetCount: action.targetCount } : {}),
    ...(action.reach !== undefined ? { reach: action.reach } : {}),
    // In the ruleset's distance, as reach is: the encounter turns both into cells (1.184).
    ...(action.push !== undefined ? { push: action.push } : {}),
    ...(action.pull !== undefined ? { pull: action.pull } : {}),
    ...(action.onFell ? { onFell: structuredClone(action.onFell) } : {}),
    // A roar louder each time (1.687).
    ...(action.byUse ? { byUse: [...action.byUse] } : {}),
    // A Harpoon's contest (1.695).
    ...(action.contest ? { contest: structuredClone(action.contest) } : {}),
    // Only on a target small enough (1.698).
    ...(action.ridersIs ? { ridersIs: structuredClone(action.ridersIs) } : {}),
    // Etherealness (1.685).
    ...(action.dismisses ? { dismisses: structuredClone(action.dismisses) } : {}),
    // What its attack is made with (1.189), so changes narrowed to an ability reach it.
    ...(action.ability ? { ability: action.ability } : {}),
    ...(action.reducesMax ? { reducesMax: { ...action.reducesMax } } : {}),
    // On a called creature (1.586): Arcane Hand's fist, with no modifier and more for each slot.
    ...(action.callerAdds === false ? { callerAdds: false as const } : {}),
    ...(action.perCallerStep && amountOf(action.perCallerStep)
      ? { perCallerStep: amountOf(action.perCallerStep)! }
      : {}),
    // What it dealt comes back to it (1.281): an aboleth's Psychic Drain.
    ...(action.drain ? { drain: { ...action.drain } } : {}),
    ...(action.targetHolds ? { targetHolds: structuredClone(action.targetHolds) } : {}),
    ...(action.unlessImposing ? { unlessImposing: [...action.unlessImposing] } : {}),
    ...(action.range !== undefined ? { range: action.range } : {}),
    ...(action.area ? { area: { ...action.area } } : {}),
    ...(action.uses ? { uses: { ...action.uses } } : {}),
    ...(action.recharge
      ? {
          recharge: {
            dice: { ...action.recharge.dice },
            from: action.recharge.from,
            ...(action.recharge.group ? { group: action.recharge.group } : {}),
          },
        }
      : {}),
    ...(action.charge ? { charge: chargeOf(action, action.charge) } : {}),
    ...(action.sequence ? { sequence: action.sequence.map((step) => ({ ...step })) } : {}),
    ...(action.signature ? { signature: { ...action.signature } } : {}),
    ...(action.lair ? { lair: true as const } : {}),
    ...(action.reaction
      ? {
          reaction: {
            ...action.reaction,
            ...(action.reaction.cancelSave ? { cancelSave: { ...action.reaction.cancelSave } } : {}),
            ...rulesetReactionAnswers(action.reaction),
          },
        }
      : {}),
    ...(action.self ? { self: true as const } : {}),
    // Free, and only before its first attack of its own turn (1.606): Reckless.
    ...(action.free ? { free: true as const } : {}),
    ...(action.beforeAttack ? { beforeAttack: true as const } : {}),
    // In the ruleset's distance, as push is (1.276): the encounter turns it into cells.
    ...(action.teleport ? { teleport: { ...action.teleport } } : {}),
    // In the ruleset's distance too (1.283).
    ...(action.move ? { move: { ...action.move } } : {}),
    ...(action.casting ? { casting: { ...action.casting } } : {}),
    ...(action.search ? { search: true as const } : {}),
    // Its light lit or put out (1.296).
    ...(action.sheds !== undefined ? { sheds: action.sheds === "out" ? ("out" as const) : { ...action.sheds } } : {}),
    // Standard actions with its own budget (1.291): Nimble Escape.
    ...(action.standard ? { standard: structuredClone(action.standard) } : {}),
    // The area it leaves standing, and the ground it changes (1.324).
    ...(action.zone ? { zone: structuredClone(action.zone) } : {}),
    ...(action.ground ? { ground: structuredClone(action.ground) } : {}),
    // Whoever it lands on walks toward it (1.326).
    ...(action.draws ? { draws: { ...action.draws } } : {}),
    // Engulf and Whelm (1.403).
    ...(action.engulf ? { engulf: structuredClone(action.engulf) } : {}),
    // Deadly Leap (1.725).
    ...(action.leapsOnto ? { leapsOnto: { ...action.leapsOnto } } : {}),
    // Luring Song (1.727).
    ...(action.sustains ? { sustains: { budget: action.sustains.budget } } : {}),
    // Aimed only at whoever is this, and what a sequence does once all of it hit (1.405).
    ...(action.targetTypes ? { targetTypes: structuredClone(action.targetTypes) } : {}),
    ...(action.allHit ? { allHit: structuredClone(action.allHit) } : {}),
    // The Hour Bell, and the Litany broken (1.327).
    ...(action.actedOnly ? { actedOnly: true as const } : {}),
    ...(action.brokenNextLair ? { brokenNextLair: action.brokenNextLair } : {}),
    // The forms it changes into (1.392), found in the bestiary as the fight begins.
    ...(action.forms ? { forms: structuredClone(action.forms) } : {}),
    // Who it calls into the fight (1.325), found in the bestiary as the fight begins.
    // A printed chance (1.441): a demon's summoning.
    ...(action.chance ? { chance: { ...action.chance } } : {}),
    // Or its options, for rounds and bound to its caller (1.446): Summon Demon.
    ...(action.calls && (action.calls.options || (action.calls.creature && amountOf(action.calls.count)))
      ? {
          calls: {
            ...(action.calls.creature ? { creature: action.calls.creature, count: amountOf(action.calls.count)! } : {}),
            ...(action.calls.options ? { options: structuredClone(action.calls.options) } : {}),
            ...(action.calls.initiative ? { initiative: action.calls.initiative } : {}),
            ...(action.calls.rounds ? { rounds: action.calls.rounds } : {}),
            ...(action.calls.endsWithCaller ? { endsWithCaller: action.calls.endsWithCaller } : {}),
            ...(action.calls.cantCall ? { cantCall: true as const } : {}),
            ...(action.calls.dismissible ? { dismissible: structuredClone(action.calls.dismissible) } : {}),
            ...(action.calls.leash ? { leash: action.calls.leash } : {}),
            // Set down within so far of it, seen (1.621): Animate Trees.
            ...(action.calls.within ? { within: { ...action.calls.within } } : {}),
            ...(action.calls.onlyWhere ? { onlyWhere: structuredClone(action.calls.onlyWhere) } : {}),
            ...(action.calls.arrivesIn && amountOf(action.calls.arrivesIn)
              ? { arrivesIn: amountOf(action.calls.arrivesIn)! }
              : {}),
            ...(action.calls.atCorpse ? { atCorpse: structuredClone(action.calls.atCorpse) } : {}),
            ...(action.calls.atMost ? { atMost: action.calls.atMost } : {}),
            // Commanded, with their caller's own attack (1.707): a solar's Flying Sword.
            ...(action.calls.commandedWith ? { commandedWith: action.calls.commandedWith } : {}),
            ...(action.calls.commandedBy ? { commandedBy: { action: action.calls.commandedBy.action } } : {}),
            ...(action.calls.fromCaller ? { fromCaller: { action: action.calls.fromCaller.action } } : {}),
          },
        }
      : {}),
  };
}

/**
 * The stat block a bestiary entry stands for, ready for `createRulesetEncounter`. Dice health is
 * carried as both: the average, which is what a forecast reads, and the dice the encounter throws
 * when it builds the fight.
 *
 * Only the actions this ruleset can still price survive, because a catalog checked against one
 * version of a ruleset may be read by another: an action spending a budget the economy no longer
 * declares would sit on the menu and never be affordable.
 */
export function rulesetCreatureBlock(
  definition: RulesetDefinition,
  entry: RulesetCatalogEntry | null | undefined,
): RulesetStatBlock | null {
  const creature = entry?.creature;
  if (!creature) return null;
  return rulesetStatBlockFromCreature(definition, creature);
}

/**
 * The catalogs the creatures of a bestiary read their sheets' lists out of. A creature described by
 * a sheet takes the abilities on its lists from the ruleset's other catalogs, exactly as a
 * character's sheet does, so a fight needs those to hand as well as the bestiary itself. Bounded by
 * catalogs rather than creatures. Spells cast without slots also need their entry catalogs (1.123).
 */
export function rulesetBestiarySheetCatalogIds(
  definition: RulesetDefinition,
  bestiary: RulesetCatalogEntriesById,
): string[] {
  const ids = new Set<string>();
  for (const entries of Object.values(bestiary)) {
    for (const entry of entries) {
      const sheet = entry.creature?.sheet;
      for (const spell of entry.creature?.spellcasting?.spells ?? []) {
        const id = spell.entry.split("/")[0]!;
        if (!(id in bestiary)) ids.add(id);
      }
      if (!sheet) continue;
      for (const id of rulesetCatalogIdsForBuild(definition, sheet)) {
        if (!(id in bestiary)) ids.add(id);
      }
    }
  }
  return [...ids];
}

/** A creature the Game Master invented for one fight, read as the plain block it always is, ready to
 *  be clamped onto the threat scale. Null when the ruleset cannot resolve a fight at all. */
export function rulesetProposedStatBlock(
  definition: RulesetDefinition,
  creature: RulesetProposedCreature,
): RulesetPlainStatBlock | null {
  const block = rulesetStatBlockFromCreature(definition, creature);
  if (block && creature.tracks && Object.keys(creature.tracks).length) block.tracks = { ...creature.tracks };
  return block && isRulesetPlainStatBlock(block) ? block : null;
}

/** A block that carries its own numbers and no sheet, which is the only kind the clamp can hold to a
 *  tier. A proposal's schema makes every one of them so; this is what lets the types say it too. */
export function isRulesetPlainStatBlock(block: RulesetStatBlock): block is RulesetPlainStatBlock {
  return (
    !block.sheet && block.health !== undefined && block.defense !== undefined && block.initiativeModifier !== undefined
  );
}

/** The same reading, for a creature that came from somewhere other than a catalog: an opponent the
 *  Game Master proposed for this one fight, in the shared creature form and clamped afterwards. */
export function rulesetStatBlockFromCreature(
  definition: RulesetDefinition,
  creature: RulesetCreature,
): RulesetStatBlock | null {
  const combat = definition.combat;
  if (!combat) return null;
  return blockFromCreature(creature, new Set(combat.economy.budgets.map((budget) => budget.id)));
}

/**
 * An opponent nobody wrote: the rung of the scale it was asked for, read as a stat block. Health is
 * the middle of the tier's band, defense and to-hit are the tier's own, and its one action deals the
 * middle of the tier's damage band flat and untyped, because a tier says how hard a creature hits
 * and nothing at all about what dice it hits with.
 *
 * Null when the ruleset declares no threat scale: then there is nothing to build a block out of, and
 * the caller has to say so rather than invent numbers.
 */
export function rulesetTierStatBlock(
  definition: RulesetDefinition,
  tierId: string | undefined,
  /** What the Game Master called its attacks, each one the tier's numbers under that name (laptop
   *  playtest 2026-10-25: an invented duelist's Rapier and Dagger both read "Attack"). */
  names: readonly string[] = [],
): { block: RulesetStatBlock; tier: RulesetCombatThreatTier } | null {
  const combat = definition.combat;
  const tiers = combat?.threat?.tiers ?? [];
  if (!combat || tiers.length === 0) return null;
  // The first tier declared is the bottom of the scale, which is where an opponent nobody can place
  // belongs: too weak is a disappointing fight, too strong is a dead party.
  const tier = tiers.find((entry) => entry.id === tierId) ?? tiers[0]!;
  const middle = (band: readonly [number, number]) => Math.floor((band[0] + band[1]) / 2);
  const named = [...new Set(names.map((name) => name.trim()).filter(Boolean))].slice(0, RULESET_TIER_ATTACK_NAMES_MAX);
  return {
    tier,
    block: {
      health: Math.max(1, middle(tier.health)),
      defense: tier.defense,
      initiativeModifier: 0,
      tier: tier.id,
      actions: (named.length > 0 ? named : ["Attack"]).map((name, index) => ({
        id: index === 0 ? "strike" : `strike-${index + 1}`,
        // Its own name is on the log beside it already: "Orc Raider 2 readies Orc Raider 2: attack".
        name,
        budget: combat.economy.budgets[0]!.id,
        toHit: tier.toHit,
        damage: { count: 0, sides: 0, flat: Math.max(1, middle(tier.damagePerRound)) },
      })),
    },
  };
}

/** How many named attacks an opponent built off its tier keeps. */
export const RULESET_TIER_ATTACK_NAMES_MAX = 4;

/** An invented action as its writer said it: its name, the words they wrote of it, and whether they
 *  marked it as reaching an area. */
export interface RulesetWrittenAttack {
  name: string;
  description?: string;
  area?: boolean;
}

/** What a breath that lands in an area comes back on when no creature of the ruleset says: 5 or 6 on a d6. */
const RULESET_AREA_RECHARGE_USUAL = { dice: { count: 1, sides: 6 }, from: 5 } as const;

/**
 * Whether an invented action lands in an area, by its writer's words (laptop playtest 2026-10-26: an
 * invented young red dragon's Rot Breath rolled to hit one hero every round): a breath by its name, a
 * cone or a line by its name or what was written of it, or one marked as an area. The shape it was
 * said to take; null for a blow at one.
 */
export function rulesetWrittenArea(written: RulesetWrittenAttack): { breath: boolean; shape?: "cone" | "line" } | null {
  const words = `${written.name} ${written.description ?? ""}`.toLowerCase().split(/[^\p{L}\p{N}]+/u);
  const breath = words.some((word) => /^breath(e|es|ed|ing|s)?$/.test(word));
  // A line in its description only as a shape ("in a line", "a 30-foot line"), never a line of soldiers.
  const lined =
    written.name
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .includes("line") || /\b(?:in a|\d+[- ]?(?:foot|feet|ft\.?)) line\b/i.test(written.description ?? "");
  const shape = words.includes("cone") ? "cone" : lined ? "line" : undefined;
  if (!breath && !shape && !written.area) return null;
  return { breath, ...(shape ? { shape } : {}) };
}

/**
 * An invented action its writer said lands in an area, built as this ruleset's bestiary builds its
 * breaths: the bestiary's own area action nearest it (the same shape, one that recharges, a breath
 * for a breath, then the nearest tier) lends its shape, size, save, recharge and how many it catches
 * off a board, and the tier its difficulty. Half on a success; its damage is halved for the area, and it
 * no longer rolls to hit. With no such action in the bestiary, a cone of three cells against the save its
 * creatures roll most, back on what their recharges usually are, else a 5 or 6. Null where it cannot be
 * one: it deals no damage, already lands in an area or asks for a save, or the sheet has no save to roll.
 */
export function rulesetWrittenAreaAction<
  T extends {
    name: string;
    damage?: unknown;
    area?: unknown;
    save?: unknown;
    sequence?: unknown;
    casting?: unknown;
    reaction?: unknown;
    heal?: unknown;
    self?: unknown;
  },
>(
  definition: RulesetDefinition,
  catalogs: RulesetCatalogEntriesById,
  action: T,
  said: { breath: boolean; shape?: "cone" | "line" },
  tierId: string | undefined,
): T | null {
  if (!action.damage || action.area || action.save || action.sequence || action.casting || action.reaction) return null;
  if (action.heal !== undefined || action.self) return null;
  const saves = new Set(definition.sheet.saves.map((save) => save.id));
  if (saves.size === 0) return null;
  const scale = definition.combat?.threat?.tiers ?? [];
  const rung = (id: string | undefined) => scale.findIndex((tier) => tier.id === id);
  const at = rung(tierId);
  type Model = { action: RulesetCreatureAction; rung: number };
  const models: Model[] = [];
  const counted = new Map<string, number>();
  const recharges = new Map<string, { count: number; recharge: NonNullable<RulesetCreatureAction["recharge"]> }>();
  for (const entries of Object.values(catalogs))
    for (const entry of entries)
      for (const one of entry.creature?.actions ?? []) {
        if (one.reaction || one.lair || one.signature) continue;
        if (one.save && saves.has(one.save.save)) counted.set(one.save.save, (counted.get(one.save.save) ?? 0) + 1);
        if (one.recharge) {
          const key = `${one.recharge.dice.count}d${one.recharge.dice.sides}:${one.recharge.from}`;
          recharges.set(key, { count: (recharges.get(key)?.count ?? 0) + 1, recharge: one.recharge });
        }
        const area = one.area;
        if (!area || area.around || area.aroundProp || area.shape === "wall" || !one.save || !one.damage) continue;
        if (!saves.has(one.save.save)) continue;
        models.push({ action: one, rung: rung(entry.creature?.tier) });
      }
  const breathy = (one: RulesetCreatureAction) => rulesetWrittenArea({ name: one.name })?.breath === true;
  // The one nearest what was said: its shape first, then a recharge, a breath for a breath, the tier.
  const score = (model: Model) => [
    said.shape && model.action.area!.shape !== said.shape ? 1 : 0,
    model.action.recharge ? 0 : 1,
    said.breath && !breathy(model.action) ? 1 : 0,
    at < 0 || model.rung < 0 ? 0 : Math.abs(model.rung - at),
  ];
  const model = models
    .map((one) => ({ one, by: score(one) }))
    .sort((left, right) => {
      for (let index = 0; index < left.by.length; index++)
        if (left.by[index] !== right.by[index]) return left.by[index]! - right.by[index]!;
      return 0;
    })[0]?.one.action;
  const borrowed = model && (!said.shape || model.area!.shape === said.shape) ? model : undefined;
  const most = [...counted.entries()].sort((left, right) => right[1] - left[1])[0]?.[0];
  const save = model?.save?.save ?? most ?? definition.sheet.saves[0]!.id;
  const usual = [...recharges.values()].sort((left, right) => right.count - left.count)[0]?.recharge;
  const recharge = model?.recharge ?? usual ?? RULESET_AREA_RECHARGE_USUAL;
  const tier = scale[at];
  const difficulty = tier?.saveDifficulty ?? model?.save?.difficulty ?? 10;
  const perCell = definition.combat?.distance?.perCell ?? 1;
  const shape = said.shape ?? model?.area!.shape ?? "cone";
  const {
    toHit: _toHit,
    autoHit: _autoHit,
    upgrades: _upgrades,
    range: _range,
    targetCount: _count,
    ...rest
  } = action as T & { toHit?: unknown; autoHit?: unknown; upgrades?: unknown; range?: unknown; targetCount?: unknown };
  return {
    ...rest,
    ...(rest.damage !== undefined
      ? {
          damage: halvedForArea(
            rest.damage,
            parseRulesetCombatDice((model?.damage as { dice?: unknown } | undefined)?.dice)?.sides || 6,
          ),
        }
      : {}),
    area: borrowed
      ? {
          shape,
          size: borrowed.area!.size,
          ...(borrowed.area!.width !== undefined ? { width: borrowed.area!.width } : {}),
          ...(borrowed.area!.friendlyFire !== undefined ? { friendlyFire: borrowed.area!.friendlyFire } : {}),
        }
      : { shape, size: 3 * perCell },
    // A burst lent from a creature that aims it somewhere is aimed as far; a cone or a line from where it stands.
    ...(borrowed?.range !== undefined && shape === "burst" ? { range: borrowed.range } : {}),
    save: { save, difficulty, onSuccess: "half" },
    recharge: { dice: { ...recharge.dice }, from: recharge.from },
    ...(model?.targetCount !== undefined ? { targetCount: model.targetCount } : { targetCount: 2 }),
  } as unknown as T;
}

/** An invented area's damage as half what it was written or built at for one target: a tier's damage
 *  a round counts what reaches more than one on two of them (laptop re-test 2026-10-26: a breath built
 *  at CR 3's single-target round dealt 37 to each of three heroes against a round of 43). Dice first,
 *  then the flat part; each amount keeps at least what it rolls once. A flat amount (a tier's numbers)
 *  is rolled as the dice its model breath rolls, about the same on average (cloud re-test 2026-10-26: a
 *  flat 28 every time). */
function halvedForArea<D>(damage: D, sides: number): D {
  const half = (amount: unknown): unknown => {
    if (!amount || typeof amount !== "object") return amount;
    const one = amount as { count?: unknown; sides?: unknown; flat?: unknown; dice?: unknown; plus?: unknown };
    // A block as written says its dice ("4d6+2"); a built one counts them.
    const written = typeof one.dice === "string" ? parseRulesetCombatDice(one.dice) : null;
    if (!written && (typeof one.count !== "number" || typeof one.sides !== "number" || typeof one.flat !== "number"))
      return amount;
    const next = written ?? { count: one.count as number, sides: one.sides as number, flat: one.flat as number };
    const want = rulesetAverageAmount(next) / 2;
    while (rulesetAverageAmount(next) > want) {
      if (next.count > 1 && next.sides > 0) next.count -= 1;
      else if (next.flat > (next.count > 0 && next.sides > 0 ? 0 : 1)) next.flat -= 1;
      else break;
    }
    if ((next.count === 0 || next.sides === 0) && next.flat >= (sides + 1) / 2) {
      const count = Math.max(1, Math.floor(next.flat / ((sides + 1) / 2)));
      next.flat = Math.round(next.flat - (count * (sides + 1)) / 2);
      next.count = count;
      next.sides = sides;
    }
    const plus = Array.isArray(one.plus) ? { plus: one.plus.map(half) } : {};
    if (written) {
      const dice = next.count > 0 && next.sides > 0 ? `${next.count}d${next.sides}` : "";
      const flat = next.flat === 0 && dice ? "" : dice && next.flat > 0 ? `+${next.flat}` : `${next.flat}`;
      return { ...one, dice: `${dice}${flat}`, ...plus };
    }
    return { ...one, ...next, ...plus };
  };
  return half(damage) as D;
}

/**
 * A reaction a creature of this ruleset's bestiaries has, found by its name, as a stat block takes it
 * (laptop playtest 2026-10-25: the Game Master gave an invented duelist a "Parry", which nothing in the
 * fight could read). The first creature holding one of that name lends it; null when none does.
 */
export function rulesetBestiaryReaction(
  definition: RulesetDefinition,
  catalogs: RulesetCatalogEntriesById,
  name: string,
): RulesetStatBlockAction | null {
  const combat = definition.combat;
  const wanted = plainly(name);
  if (!combat || !wanted) return null;
  const budgets = new Set(combat.economy.budgets.map((budget) => budget.id));
  for (const entries of Object.values(catalogs))
    for (const entry of entries)
      for (const action of entry.creature?.actions ?? [])
        if (
          action.reaction &&
          budgets.has(action.budget) &&
          (plainly(action.name) === wanted || plainly(action.id) === wanted)
        )
          return creatureAction(action);
  return null;
}

/**
 * An action a creature of this ruleset's bestiaries has, found by its name as its writer gave it (laptop
 * level-4 pass 2026-10-26: a boss's "Terrifying Glare" priced out of its points). Neither a reaction nor
 * a lair's, and in a budget this ruleset has; null when no creature holds one of that name.
 */
export function rulesetBestiaryActionNamed(
  definition: RulesetDefinition,
  catalogs: RulesetCatalogEntriesById,
  name: string,
): RulesetCreatureAction | null {
  const wanted = plainly(name);
  const budgets = new Set(definition.combat?.economy.budgets.map((budget) => budget.id) ?? []);
  if (!wanted) return null;
  for (const entries of Object.values(catalogs))
    for (const entry of entries)
      for (const action of entry.creature?.actions ?? [])
        if (
          !action.reaction &&
          !action.lair &&
          budgets.has(action.budget) &&
          (plainly(action.name) === wanted || plainly(action.id) === wanted)
        ) {
          const { inShape: _shape, signature: _signature, ...rest } = structuredClone(action);
          return rest as RulesetCreatureAction;
        }
  return null;
}

/** The names of the reactions this ruleset's bestiaries hold, once each, for the Game Master. */
export function rulesetBestiaryReactionNames(catalogs: RulesetCatalogEntriesById, max = 40): string[] {
  const names = new Map<string, string>();
  for (const entries of Object.values(catalogs))
    for (const entry of entries)
      for (const action of entry.creature?.actions ?? [])
        if (action.reaction && !names.has(plainly(action.name)) && names.size < max)
          names.set(plainly(action.name), action.name);
  return [...names.values()].sort((a, b) => a.localeCompare(b));
}

/** What one of a creature's actions deals on average, its first amount: written as dice (`{ dice: "2d6" }`)
 *  or as a tier's block writes it (`{ count, sides, flat }`). 0 for one that deals nothing. */
export function rulesetActionAverage(action: { damage?: unknown }): number {
  const damage = action.damage as ({ dice?: string; flat?: number } & Partial<RulesetCombatAmount>) | undefined;
  if (!damage) return 0;
  const amount = typeof damage.count === "number" ? (damage as RulesetCombatAmount) : amountOf(damage);
  return amount ? rulesetAverageAmount(amount) : 0;
}

/**
 * The most legendary points a creature may have at each tier of the ruleset's threat scale: the most
 * any bestiary creature of that tier or below has, so none below the lowest that has any (room playtest
 * 2026-10-30: an invented CR 1/2 elemental with legendary actions 3 of 3). Undefined when the scale is
 * missing or no bestiary creature has any, which says nothing about where they start.
 */
export function rulesetTierPointCaps(
  definition: RulesetDefinition,
  catalogs: RulesetCatalogEntriesById,
): Map<string, number> | undefined {
  const tiers = definition.combat?.threat?.tiers ?? [];
  if (tiers.length === 0) return undefined;
  const at = new Map(tiers.map((tier, index) => [tier.id, index]));
  const most = tiers.map(() => 0);
  let any = false;
  for (const entries of Object.values(catalogs)) {
    for (const entry of entries) {
      const points = entry.creature?.signaturePoints ?? 0;
      const index = entry.creature?.tier !== undefined ? at.get(entry.creature.tier) : undefined;
      if (points <= 0 || index === undefined) continue;
      most[index] = Math.max(most[index]!, points);
      any = true;
    }
  }
  if (!any) return undefined;
  const caps = new Map<string, number>();
  let running = 0;
  tiers.forEach((tier, index) => {
    running = Math.max(running, most[index]!);
    caps.set(tier.id, running);
  });
  return caps;
}

/**
 * What a boss given points with nothing priced out of them buys with those points (laptop level-4 pass
 * 2026-10-26: a "Lich Morrigast" asked for as the SRD lich, a Pale Master and a Big Grakka each fought
 * with none): the legendary actions of the bestiary creature its name names ("Lich" in "Lich
 * Morrigast", the longest name that fits), or else its own, a cantrip where it casts, a move, its
 * weakest attack at 1 and its best at 2. None costs more than it has, none is a lair's, and the boss's
 * tier holds them with the rest of it afterwards, so a lich's numbers on a lesser boss are that boss's.
 */
export function rulesetUnpricedLegendary(
  definition: RulesetDefinition,
  catalogs: RulesetCatalogEntriesById,
  boss: {
    name: string;
    points: number;
    budget: string;
    casts: boolean;
    actions: readonly RulesetCreatureAction[];
  },
): { from?: string; actions: RulesetCreatureAction[] } {
  const budgets = new Set(definition.combat?.economy.budgets.map((budget) => budget.id) ?? []);
  const words = ` ${boss.name
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()} `;
  const spoken = words.trim().split(" ");
  let best: { label: string; length: number; actions: RulesetCreatureAction[] } | undefined;
  for (const entries of Object.values(catalogs))
    for (const entry of entries) {
      const own = (entry.creature?.actions ?? []).filter((action) => action.signature && !action.lair);
      if (own.length === 0) continue;
      const label = entry.label
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, " ")
        .trim();
      // A one-word name also fits a word that ends in it, its label 4 letters or more (cloud re-test
      // 2026-10-26: an "Archlich" found no lich).
      const fitsName =
        words.includes(` ${label} `) ||
        (label.length >= 4 && !label.includes(" ") && spoken.some((word) => word.endsWith(label)));
      if (label && fitsName && label.length > (best?.length ?? 0))
        best = { label: entry.label, length: label.length, actions: own };
    }
  const taken = new Set(boss.actions.map((action) => action.id));
  const named = (id: string) => {
    let one = id.startsWith("legendary_") ? id : `legendary_${id}`;
    for (let count = 2; taken.has(one); count++) one = `legendary_${id}_${count}`;
    taken.add(one);
    return one;
  };
  const fits = (action: RulesetCreatureAction) =>
    (action.signature?.cost ?? 1) <= boss.points && budgets.has(action.budget) && (boss.casts || !action.casting);
  if (best) {
    const borrowed = best.actions.filter(fits).map((action) => {
      // Another creature's shapes are not this one's.
      const { inShape: _shape, ...rest } = structuredClone(action);
      return { ...rest, id: named(action.id) } as RulesetCreatureAction;
    });
    if (borrowed.length > 0) return { from: best.label, actions: borrowed };
  }
  const bought: RulesetCreatureAction[] = [];
  if (boss.casts)
    bought.push({
      id: named("cantrip"),
      name: "Cantrip",
      budget: boss.budget,
      casting: { cantripsOnly: true },
      signature: { cost: 1 },
    } as RulesetCreatureAction);
  bought.push({
    id: named("move"),
    name: "Move",
    budget: boss.budget,
    move: { share: 0.5 },
    signature: { cost: 1 },
  } as RulesetCreatureAction);
  const attacks = boss.actions
    .filter(
      (action) =>
        !action.signature &&
        !action.reaction &&
        !action.lair &&
        !action.casting &&
        !action.sequence &&
        !action.charge &&
        // One that waits on a recharge or a count of uses is that one action, never a second copy with
        // its own (laptop 2026-10-26: a dragon's bought Fire Breath ignored its breath's recharge).
        !action.recharge &&
        !(action as { uses?: unknown }).uses &&
        budgets.has(action.budget) &&
        (action.toHit !== undefined || action.autoHit || !!action.damage),
    )
    .sort((a, b) => rulesetActionAverage(a) - rulesetActionAverage(b));
  const weakest = attacks[0];
  const strongest = attacks.length > 1 ? attacks[attacks.length - 1] : undefined;
  if (weakest) bought.push({ ...structuredClone(weakest), id: named(weakest.id), signature: { cost: 1 } });
  if (strongest && boss.points >= 2)
    bought.push({ ...structuredClone(strongest), id: named(strongest.id), signature: { cost: 2 } });
  return { actions: bought };
}

/** A sequence's steps with some left out (1.643), a step made after another's hit still pointing at
 *  that step's new place, and gone with it when it went. */
export function rulesetKeptSteps<T extends { ifHit?: number }>(steps: readonly T[], keep: (step: T) => boolean): T[] {
  const places = new Map<number, number>();
  const kept: T[] = [];
  steps.forEach((step, index) => {
    if (!keep(step)) return;
    const after = step.ifHit === undefined ? undefined : places.get(step.ifHit);
    if (step.ifHit !== undefined && after === undefined) return;
    places.set(index, kept.length);
    kept.push(after === undefined ? step : { ...step, ifHit: after });
  });
  return kept;
}

/** How many strikes a sequence step makes on average (1.643): its dice's average where it rolls. */
export function rulesetStepAverageTimes(step: { times: number; dice?: { count: number; sides: number } }): number {
  return step.dice ? (step.dice.count * (step.dice.sides + 1)) / 2 : step.times;
}

function blockFromCreature(creature: RulesetCreature, budgets: ReadonlySet<string>): RulesetStatBlock {
  const kept = creature.actions.filter((action) => budgets.has(action.budget));
  const ids = new Set(kept.map((action) => action.id));
  const actions = kept.map((action) => {
    const built = creatureAction(action);
    if (!built.sequence) return built;
    const steps = rulesetKeptSteps(built.sequence, (step) => ids.has(step.action));
    // A sequence whose parts are all gone is an action that would spend a budget and do nothing.
    if (steps.length === 0) return null;
    return { ...built, sequence: steps };
  });
  // A creature with a sheet has none of these: the sheet says them in the ruleset's own terms.
  const dice = creature.health === undefined || typeof creature.health === "number" ? null : amountOf(creature.health);
  return {
    ...(dice
      ? { health: Math.floor(rulesetAverageAmount(dice)), healthDice: dice }
      : typeof creature.health === "number"
        ? { health: creature.health }
        : {}),
    ...(creature.defense !== undefined ? { defense: creature.defense } : {}),
    ...(creature.initiativeModifier !== undefined ? { initiativeModifier: creature.initiativeModifier } : {}),
    ...(creature.sheet ? { sheet: structuredClone(creature.sheet) } : {}),
    ...(creature.spellcasting ? { spellcasting: structuredClone(creature.spellcasting) } : {}),
    ...(creature.stores ? { stores: structuredClone(creature.stores) } : {}),
    // What it does as it dies (1.540), last among them and never on its menu.
    actions: [
      ...actions.filter((action): action is RulesetStatBlockAction => action !== null),
      ...(creature.onDeath ? [{ ...creatureAction(creature.onDeath), onDeath: true as const }] : []),
    ],
    ...(creature.speed !== undefined ? { speed: creature.speed } : {}),
    ...(creature.speeds ? { speeds: { ...creature.speeds } } : {}),
    ...(creature.hover ? { hover: true as const } : {}),
    ...(creature.mountIndependent ? { mountIndependent: true as const } : {}),
    ...(creature.mountCarries ? { mountCarries: { ...creature.mountCarries } } : {}),
    ...(creature.abilities ? { abilities: { ...creature.abilities } } : {}),
    ...(creature.saves ? { saves: { ...creature.saves } } : {}),
    ...(creature.checks ? { checks: { ...creature.checks } } : {}),
    // Keen senses, sensitivity to light, camouflage (1.291); a printed passive Perception.
    ...(creature.checkModes ? { checkModes: structuredClone(creature.checkModes) } : {}),
    ...(creature.passive !== undefined ? { passive: creature.passive } : {}),
    // Its own ways of hiding and finding (1.292); its own modes on attacks (1.293).
    ...(creature.hiding ? { hiding: structuredClone(creature.hiding) } : {}),
    ...(creature.attackModes ? { attackModes: structuredClone(creature.attackModes) } : {}),
    // The light it sheds (1.294).
    ...(creature.light ? { light: { ...creature.light } } : {}),
    ...(creature.unlit ? { unlit: true as const } : {}),
    ...(creature.lightOutWhile ? { lightOutWhile: [...creature.lightOutWhile] } : {}),
    ...(creature.resist ? { resist: [...creature.resist] } : {}),
    ...(creature.vulnerable ? { vulnerable: [...creature.vulnerable] } : {}),
    ...(creature.immune ? { immune: [...creature.immune] } : {}),
    ...(creature.healedBy ? { healedBy: [...creature.healedBy] } : {}),
    ...(creature.doubleToObjects ? { doubleToObjects: true as const } : {}),
    ...(creature.wears ? { wears: [...creature.wears] } : {}),
    ...(creature.jump ? { jump: { ...creature.jump } } : {}),
    ...(creature.passableBy ? { passableBy: { ...creature.passableBy } } : {}),
    ...(creature.fillsSpace === false ? { fillsSpace: false as const } : {}),
    ...(creature.languages ? { languages: [...creature.languages] } : {}),
    ...(creature.conditionImmunities ? { conditionImmunities: [...creature.conditionImmunities] } : {}),
    ...(creature.keepsOn ? { keepsOn: [...creature.keepsOn] } : {}),
    ...(creature.held ? { held: creature.held.map((thing) => ({ ...thing, tags: [...thing.tags] })) } : {}),
    ...(creature.senses ? { senses: { ...creature.senses } } : {}),
    ...(creature.hardness !== undefined ? { hardness: creature.hardness } : {}),
    ...(creature.shield ? { shield: true as const } : {}),
    ...(creature.size !== undefined ? { size: creature.size } : {}),
    ...(creature.type !== undefined ? { type: creature.type } : {}),
    ...(creature.tags ? { tags: [...creature.tags] } : {}),
    ...(creature.alignment !== undefined ? { alignment: creature.alignment } : {}),
    // How much thought it puts into a fight (1.761), and its nerve (1.762).
    ...(creature.mind !== undefined ? { mind: creature.mind } : {}),
    ...(creature.behavior ? { behavior: structuredClone(creature.behavior) } : {}),
    ...(creature.morale !== undefined ? { morale: creature.morale } : {}),
    ...(creature.leader ? { leader: true as const } : {}),
    ...(creature.soak
      ? {
          soak: {
            ...(creature.soak.all !== undefined ? { all: creature.soak.all } : {}),
            ...(creature.soak.byKind ? { byKind: { ...creature.soak.byKind } } : {}),
          },
        }
      : {}),
    tier: creature.tier,
    ...(creature.traits ? { traits: creature.traits.map((trait) => ({ ...trait })) } : {}),
    ...(creature.signaturePoints !== undefined ? { signaturePoints: creature.signaturePoints } : {}),
    ...(creature.lairInitiative !== undefined ? { lairInitiative: creature.lairInitiative } : {}),
    ...(creature.legendaryResistance !== undefined ? { legendaryResistance: creature.legendaryResistance } : {}),
    ...(creature.stillIn ? { stillIn: [...creature.stillIn] } : {}),
    ...(creature.hangsOn ? { hangsOn: structuredClone(creature.hangsOn) } : {}),
    ...(creature.splits ? { splits: structuredClone(creature.splits) } : {}),
    ...(creature.whenHarmedBy ? { whenHarmedBy: structuredClone(creature.whenHarmedBy) } : {}),
    ...(creature.rollsAtTurnStart ? { rollsAtTurnStart: structuredClone(creature.rollsAtTurnStart) } : {}),
    ...(creature.rampage ? { rampage: { ...creature.rampage } } : {}),
    ...(creature.refillsEveryTurn ? { refillsEveryTurn: [...creature.refillsEveryTurn] } : {}),
    ...(creature.heads ? { heads: structuredClone(creature.heads) } : {}),
    ...(creature.corrodesWeapons ? { corrodesWeapons: structuredClone(creature.corrodesWeapons) } : {}),
    ...(creature.regenerates ? { regenerates: structuredClone(creature.regenerates) } : {}),
    ...(creature.riders?.length ? { riders: creature.riders.flatMap((rider) => riderOf(rider, ids)) } : {}),
  };
}

/** One rider of a block, with its amount read as dice. A rider that names only actions this block
 *  no longer has would never fire, so it is dropped rather than carried. */
function riderOf(rider: NonNullable<RulesetCreature["riders"]>[number], ids: ReadonlySet<string>) {
  const amount = amountOf(rider.amount);
  if (!amount) return [];
  const actions = rider.actions?.filter((id) => ids.has(id));
  if (rider.actions && (!actions || actions.length === 0)) return [];
  return [
    {
      id: rider.id,
      label: rider.name,
      on: rider.on,
      ...(actions?.length ? { actions } : {}),
      ...(rider.when?.length ? { when: [...rider.when] } : {}),
      oncePer: rider.oncePer,
      amount,
      ...(rider.type ? { type: rider.type } : {}),
    } satisfies RulesetCombatRider,
  ];
}

// ── The clamp ──

/** What a proposed block became, and every change in words a log can print. */
export interface RulesetClampedStatBlock {
  block: RulesetPlainStatBlock;
  adjusted: string[];
}

/** What one action deals on average, per target: the whole blow, clauses and all. */
function damageAverage(action: RulesetStatBlockAction | undefined): number {
  return action?.damage ? Math.max(0, rulesetAverageDamage(action.damage)) : 0;
}

/** Every amount one action's blow is made of, heaviest first: the first amount and every clause. A
 *  clamp shaves the heaviest of them, so a creature whose weight sits in a clause loses it there. */
function blowAmounts(action: RulesetStatBlockAction): RulesetCombatAmount[] {
  if (!action.damage) return [];
  return [action.damage, ...(action.damage.plus ?? [])].sort(
    (left, right) => rulesetAverageAmount(right) - rulesetAverageAmount(left),
  );
}

/** The id a block action answers to, with the same fallback the encounter builds its menu with, so
 *  a hand-written block without ids is read here exactly as it is read there. */
function actionId(action: RulesetStatBlockAction, index: number): string {
  return action.id ?? `block:${index}`;
}

/** The best a block can do in one round: its heaviest sequence, or its heaviest single action, and
 *  the action that round belongs to. Measured against ONE target, because a tier's band is what a
 *  creature does to somebody, not the sum of everyone it can reach. */
interface RulesetBestRound {
  average: number;
  action: RulesetStatBlockAction | null;
  parts: string[];
  /** The heaviest rider this block carries, which adds itself once to that round. */
  rider: RulesetCombatRider | null;
}

/** The rider that says most. A rider fires once in its period, so one of them rides the best round
 *  and the rest do not: counting them all would measure a creature nobody could play. */
export function heaviestRider(riders: readonly RulesetCombatRider[] | undefined): RulesetCombatRider | null {
  let best: RulesetCombatRider | null = null;
  for (const rider of riders ?? []) {
    if (!best || rulesetAverageAmount(rider.amount) > rulesetAverageAmount(best.amount)) best = rider;
  }
  return best;
}

function bestRound(
  actions: readonly RulesetStatBlockAction[],
  riders?: readonly RulesetCombatRider[],
): RulesetBestRound {
  const byId = new Map(actions.map((action, index) => [actionId(action, index), action]));
  const rider = heaviestRider(riders);
  const carried = rider ? Math.max(0, rulesetAverageAmount(rider.amount)) : 0;
  let best: RulesetBestRound = { average: 0, action: null, parts: [], rider };
  actions.forEach((action, index) => {
    const round: RulesetBestRound = action.sequence
      ? {
          average: action.sequence.reduce(
            (total, step) => total + rulesetStepAverageTimes(step) * damageAverage(byId.get(step.action)),
            0,
          ),
          action,
          parts: action.sequence.map((step) => step.action),
          rider,
        }
      : { average: damageAverage(action), action, parts: [actionId(action, index)], rider };
    // A rider adds itself to whatever the round already was, so it is counted once on top.
    round.average += round.average > 0 ? carried : 0;
    if (round.average > best.average) best = round;
  });
  return best;
}

/** One strike out of a sequence: the last step that happens more than once gives one up, and then
 *  the last step goes entirely. A sequence is never left with nothing. */
function dropOneStrike(sequence: NonNullable<RulesetStatBlockAction["sequence"]>): boolean {
  for (let index = sequence.length - 1; index >= 0; index--) {
    if (sequence[index]!.times > 1) {
      sequence[index]!.times -= 1;
      return true;
    }
  }
  if (sequence.length > 1) {
    sequence.pop();
    return true;
  }
  return false;
}

/** The next die down that a table actually owns. A clamp that answers "1d7" is right about the
 *  number and wrong about the game, so the size steps along real dice and only falls back to one
 *  face less for a die that is not among them. */
const RULESET_CLAMP_DICE = [100, 20, 12, 10, 8, 6, 4, 3, 2] as const;
/** The next die down the ladder above, or one face less for a die that is not on it. */
export function smallerDie(sides: number): number {
  return RULESET_CLAMP_DICE.find((size) => size < sides) ?? sides - 1;
}

function knownTypes(definition: RulesetDefinition): ReadonlySet<string> | null {
  const types = definition.combat?.damageTypes;
  return types ? new Set(types.map((type) => type.trim().toLowerCase())) : null;
}

/** Only the names this ruleset has, in the order they were proposed. */
function onlyKnown<T extends string | { type: string }>(
  values: readonly T[] | undefined,
  known: ReadonlySet<string> | null,
): T[] | null {
  if (!values) return null;
  if (!known) return [...values];
  return values.filter((value) => known.has((typeof value === "string" ? value : value.type).trim().toLowerCase()));
}

/**
 * A proposed opponent pulled onto the ruleset's own scale: health into the tier's band, defense,
 * to-hit and save difficulties no more than a little above it, damage scaled down until the best
 * round fits, and every name the ruleset does not have dropped. A tier the ruleset never declared
 * falls back to the bottom of the scale and says so.
 *
 * A ruleset with no threat scale has nothing to clamp to, so the block comes back as it was with
 * one line saying why.
 */
export function clampRulesetStatBlock(
  definition: RulesetDefinition,
  proposed: RulesetPlainStatBlock,
  tierId: string,
): RulesetClampedStatBlock {
  const combat = definition.combat;
  const tiers = combat?.threat?.tiers ?? [];
  const block = structuredClone(proposed);
  const adjusted: string[] = [];
  if (block.spellcasting) {
    delete block.spellcasting;
    adjusted.push("Spellcasting carried a spell list the threat scale cannot bound, so it was dropped.");
  }
  // A threat tier bounds harm, not healing or what an action does to its own side.
  for (const action of block.actions) {
    if (action.heal !== undefined || action.targets !== undefined || action.ends !== undefined) {
      delete action.heal;
      delete action.targets;
      delete action.ends;
      // A cure (1.261) is healing too.
      adjusted.push(`"${action.name}" carried healing or targets the threat scale cannot bound, so they were dropped.`);
    }
  }
  if (!combat || tiers.length === 0) {
    adjusted.push("This ruleset declares no threat scale, so the opponent was used as it was proposed.");
    return { block, adjusted };
  }
  // The first tier declared is the bottom of the scale, which is where an opponent nobody can place
  // belongs: too weak is a disappointing fight, too strong is a dead party.
  const tier: RulesetCombatThreatTier = tiers.find((entry) => entry.id === tierId) ?? tiers[0]!;
  if (tier.id !== tierId) {
    adjusted.push(`The tier "${tierId}" is not on this ruleset's scale, so ${tier.label} was used instead.`);
  }
  block.tier = tier.id;

  // What the ruleset actually has. Anything else is a word the fight could not act on.
  const types = knownTypes(definition);
  const conditions = new Set(definition.sheet.live.conditions.map((condition) => condition.id));
  const saves = new Set(definition.sheet.saves.map((save) => save.id));
  const abilities = new Set(definition.sheet.abilities.map((ability) => ability.id));
  // A budget of no count is one only a condition fills (Haste's extra action), so an action on it
  // would never be on the creature's menu: it is not one an invented creature may spend.
  const budgets = combat.economy.budgets.filter((budget) => budget.count > 0).map((budget) => budget.id);
  const mainBudget = budgets[0] ?? combat.economy.budgets[0]!.id;

  const keepKnown = <K extends "resist" | "vulnerable" | "immune" | "healedBy">(key: K) => {
    const kept = onlyKnown<NonNullable<RulesetStatBlock[K]>[number]>(block[key], types);
    if (!kept) return;
    const dropped = (block[key]?.length ?? 0) - kept.length;
    if (dropped > 0) adjusted.push(`${dropped} damage type this ruleset does not have was dropped from ${key}.`);
    if (kept.length > 0) (block as RulesetStatBlock)[key] = kept as RulesetStatBlock[K];
    else delete block[key];
  };
  keepKnown("resist");
  keepKnown("vulnerable");
  keepKnown("immune");
  keepKnown("healedBy");
  // A track some level reads may be shrugged off as a condition is (1.115).
  const leveled = new Set((combat.levels ?? []).flatMap((level) => (level.track ? [level.track] : [])));
  if (block.conditionImmunities) {
    // Or a kind of them (1.258): immune to disease.
    const kinds = new Set((combat.conditions ?? []).flatMap((entry) => entry.kinds ?? []));
    const kept = block.conditionImmunities.filter(
      (condition) => conditions.has(condition) || leveled.has(condition) || kinds.has(condition),
    );
    if (kept.length < block.conditionImmunities.length) {
      adjusted.push("A condition this ruleset does not have was dropped from the immunities.");
    }
    if (kept.length > 0) block.conditionImmunities = kept;
    else delete block.conditionImmunities;
  }
  // What it keeps on is a written creature's (1.263): an aura spreads harm the scale cannot bound.
  if (block.keepsOn) {
    delete block.keepsOn;
    adjusted.push("Conditions kept on through the fight were dropped: the threat scale cannot bound an aura.");
  }
  // A held thing lets fall only by tags the ruleset has (1.267); a shield's worth is bounded like any defense.
  if (block.held) {
    const tags = new Set((definition.items?.tags ?? []).map((tag) => tag.id));
    const kept = block.held
      .filter((thing) => thing.tags.some((tag) => tags.has(tag)))
      .slice(0, 4)
      .map((thing) => ({
        label: thing.label,
        tags: thing.tags.filter((tag) => tags.has(tag)),
        ...(Number.isFinite(thing.defense) && thing.defense
          ? { defense: Math.max(-20, Math.min(20, Math.round(thing.defense!))) }
          : {}),
      }));
    if (kept.length < block.held.length) adjusted.push("A held thing with no item tag this ruleset has was dropped.");
    if (kept.length) block.held = kept;
    else delete block.held;
  }
  // Senses are the fight's own (1.178); one it does not have is nothing to see by.
  if (block.senses) {
    const known = new Set((combat.senses ?? []).map((sense) => sense.id));
    const kept = Object.fromEntries(
      Object.entries(block.senses).filter(([id, range]) => known.has(id) && Number.isFinite(range) && range > 0),
    );
    if (Object.keys(kept).length < Object.keys(block.senses).length) {
      adjusted.push("A sense this ruleset does not have was dropped.");
    }
    if (Object.keys(kept).length > 0) block.senses = kept;
    else delete block.senses;
  }
  if (block.tracks) {
    const tracks = new Map(definition.sheet.live.tracks.map((track) => [track.id, track]));
    const kept = Object.fromEntries(
      Object.entries(block.tracks).flatMap(([id, value]) => {
        const track = tracks.get(id);
        if (!track) return [];
        // A maximum the sheet works out has no number without a sheet, so only a plain one holds it.
        const top = typeof track.max === "number" ? track.max : value;
        return [[id, Math.min(top, Math.max(typeof track.min === "number" ? track.min : 0, value))]];
      }),
    );
    if (Object.keys(kept).length < Object.keys(block.tracks).length) {
      adjusted.push("A track this ruleset does not have was dropped.");
    }
    if (Object.keys(kept).length > 0) block.tracks = kept;
    else delete block.tracks;
  }
  if (block.saves) {
    const kept = Object.fromEntries(Object.entries(block.saves).filter(([id]) => saves.has(id)));
    if (Object.keys(kept).length < Object.keys(block.saves).length) {
      adjusted.push("A save this ruleset does not have was dropped.");
    }
    if (Object.keys(kept).length > 0) block.saves = kept;
    else delete block.saves;
  }
  // A contest is won with a number added to the same dice an attack throws, so it is held where a
  // blow's chance to land is: a check this ruleset does not have is dropped, and one past the tier's
  // own to-hit (with the same headroom) is brought down to it.
  if (block.checks) {
    const known = new Set((combat.checks ?? []).map((check) => check.id));
    const cap = tier.toHit + RULESET_CLAMP_HEADROOM;
    const kept: Record<string, number> = {};
    for (const [id, value] of Object.entries(block.checks)) {
      if (!known.has(id)) {
        adjusted.push(`The contest check "${id}" is not one this ruleset has, so it was dropped.`);
        continue;
      }
      if (value > cap) adjusted.push(`Its ${id} is now ${cap} instead of ${value}.`);
      kept[id] = Math.min(value, cap);
    }
    if (Object.keys(kept).length > 0) block.checks = kept;
    else delete block.checks;
  }
  // What an invented opponent soaks is nothing the scale can hold it to: a tier says how hard a
  // creature is to hit and how much it can take, not what it shrugs off, so a proposed soak would be
  // toughness no band bounds. It goes, and the fight is told so.
  if (block.soak) {
    delete block.soak;
    adjusted.push("An opponent made up for one fight soaks nothing, so its soak was dropped.");
  }
  // Hardness is the same: toughness no band bounds, and enough of it turns every spending blow.
  if (block.hardness !== undefined) {
    delete block.hardness;
    adjusted.push("An opponent made up for one fight has no hardness, so its hardness was dropped.");
  }
  // A rider carries a damage type of its own, and a fight reads resistance off the NAME, so a type
  // this ruleset never declared is a word nothing could act on: held to the same names an action's
  // first amount and its clauses are.
  for (const rider of block.riders ?? []) {
    if (rider.type && types && !types.has(rider.type.trim().toLowerCase())) {
      adjusted.push(
        `The damage type "${rider.type}" is not one this ruleset has, so "${rider.label}" deals untyped damage.`,
      );
      delete rider.type;
    }
  }
  if (block.abilities) {
    const kept = Object.fromEntries(Object.entries(block.abilities).filter(([id]) => abilities.has(id)));
    if (Object.keys(kept).length < Object.keys(block.abilities).length) {
      adjusted.push("An ability this ruleset does not have was dropped.");
    }
    if (Object.keys(kept).length > 0) block.abilities = kept;
    else delete block.abilities;
  }

  const health = block.health;
  if (health < tier.health[0] || health > tier.health[1]) {
    block.health = Math.min(tier.health[1], Math.max(tier.health[0], Math.floor(health)));
    // The band is about the number, so once the number is set the dice have nothing left to decide.
    delete block.healthDice;
    adjusted.push(
      `Health ${health} was pulled into the ${tier.health[0]} to ${tier.health[1]} of ${tier.label}, and is now ${block.health}.`,
    );
  }
  const defenseCap = tier.defense + RULESET_CLAMP_HEADROOM;
  if (block.defense > defenseCap) {
    adjusted.push(`Defense ${block.defense} was lowered to ${defenseCap}.`);
    block.defense = defenseCap;
  }

  if (block.actions.length > RULESET_CLAMP_MAX_ACTIONS) {
    adjusted.push(`Only the first ${RULESET_CLAMP_MAX_ACTIONS} of ${block.actions.length} actions were kept.`);
    block.actions = block.actions.slice(0, RULESET_CLAMP_MAX_ACTIONS);
  }
  const ids = new Set(block.actions.map(actionId));
  const sequences = new Set(
    block.actions.flatMap((action, index) => (action.sequence ? [actionId(action, index)] : [])),
  );
  const toHitCap = tier.toHit + RULESET_CLAMP_HEADROOM;
  const difficultyCap = tier.saveDifficulty + RULESET_CLAMP_HEADROOM;
  block.actions = block.actions.flatMap((action) => {
    if (!budgets.includes(action.budget)) {
      const declared = combat.economy.budgets.some((budget) => budget.id === action.budget);
      adjusted.push(
        declared
          ? `"${action.name}" spent a budget only a condition fills, so it spends ${mainBudget}.`
          : `"${action.name}" spent a budget this ruleset does not have, so it spends ${mainBudget}.`,
      );
      action.budget = mainBudget;
    }
    if (action.toHit !== undefined && action.toHit > toHitCap) {
      adjusted.push(`"${action.name}" now hits at ${toHitCap} instead of ${action.toHit}.`);
      action.toHit = toHitCap;
      // Never more upgraded dice than it now throws (1.382).
      if (action.upgrades !== undefined && action.upgrades > Math.max(0, toHitCap)) {
        action.upgrades = Math.max(0, toHitCap);
      }
    }
    if (action.damage?.type && types && !types.has(action.damage.type.trim().toLowerCase())) {
      adjusted.push(
        `The damage type "${action.damage.type}" is not one this ruleset has, so "${action.name}" deals untyped damage.`,
      );
      delete action.damage.type;
    }
    // The clauses beside the first amount, held to the same names and the same ceiling. A clause
    // over the cap is dropped outright: a blow written as a list nobody could read is not a blow.
    if (action.damage?.plus) {
      if (action.damage.plus.length > RULESET_DAMAGE_MAX_PLUS) {
        adjusted.push(
          `"${action.name}" carried more than ${RULESET_DAMAGE_MAX_PLUS} damage clauses, so the rest were dropped.`,
        );
        action.damage.plus = action.damage.plus.slice(0, RULESET_DAMAGE_MAX_PLUS);
      }
      for (const clause of action.damage.plus) {
        if (clause.type && types && !types.has(clause.type.trim().toLowerCase())) {
          adjusted.push(
            `The damage type "${clause.type}" is not one this ruleset has, so a clause of "${action.name}" deals untyped damage.`,
          );
          delete clause.type;
        }
        if (clause.save && !saves.has(clause.save.save)) {
          adjusted.push(
            `A clause of "${action.name}" asked for a save this ruleset does not have, so it simply lands.`,
          );
          delete clause.save;
        }
        if (clause.save && clause.save.difficulty > difficultyCap) {
          // Said out loud like every other clamp: a Game Master who asked for a harder save deserves
          // to be told it was lowered, whether it was the action's own or a clause of it.
          adjusted.push(`The save against a clause of "${action.name}" was lowered to ${difficultyCap}.`);
          clause.save.difficulty = difficultyCap;
        }
      }
    }
    if (action.save && !saves.has(action.save.save)) {
      adjusted.push(`"${action.name}" asked for a save this ruleset does not have, so it simply lands.`);
      delete action.save;
    }
    if (action.save && action.save.difficulty > difficultyCap) {
      adjusted.push(`The save against "${action.name}" was lowered to ${difficultyCap}.`);
      action.save.difficulty = difficultyCap;
    }
    if (action.saveDifficulty !== undefined && action.saveDifficulty > difficultyCap) {
      adjusted.push(`The save against "${action.name}" was lowered to ${difficultyCap}.`);
      action.saveDifficulty = difficultyCap;
    }
    if (action.applies) {
      const difficulty = action.save?.difficulty ?? action.saveDifficulty;
      const kept = action.applies.flatMap((applies) => {
        if (!conditions.has(applies.condition)) {
          adjusted.push(`"${action.name}" applied a condition this ruleset does not have, so it was dropped.`);
          return [];
        }
        // A save that ends it needs a save the sheet has AND a number to roll against, or the
        // condition would never come off.
        if (applies.saveEnds && (!saves.has(applies.saveEnds.save) || difficulty === undefined)) {
          if (applies.duration === "until-save") {
            adjusted.push(
              `"${action.name}" applied ${applies.condition} until a save nothing could roll, so it was dropped.`,
            );
            return [];
          }
          adjusted.push(`The save that ends ${applies.condition} was dropped, so it runs on its own clock.`);
          const { saveEnds: _dropped, ...rest } = applies;
          return [rest];
        }
        return [applies];
      });
      if (kept.length > 0) action.applies = kept;
      else delete action.applies;
    }
    if (action.sequence) {
      const steps = rulesetKeptSteps(action.sequence, (step) => ids.has(step.action) && !sequences.has(step.action));
      if (steps.length === 0) {
        adjusted.push(`"${action.name}" named nothing this block still has, so it was dropped.`);
        return [];
      }
      if (steps.length < action.sequence.length) {
        adjusted.push(`"${action.name}" lost a part that is not on this block.`);
      }
      action.sequence = steps;
    }
    return [action];
  });

  // Damage last, because dropping a save or an action changes what the best round is. Four things
  // come off, in order, from the one that says least about the creature to the one that says most:
  // how many dice it throws, the flat part beside them, how many times a sequence strikes, and only
  // then the size of the die itself. Nothing is ever taken all the way to nothing.
  const cap = tier.damagePerRound[1];
  const byId = new Map(block.actions.map((action, index) => [actionId(action, index), action]));
  let guard = 0;
  let scaled = false;
  let fewer = false;
  while (guard++ < 500) {
    const round = bestRound(block.actions, block.riders);
    if (round.average <= cap) break;
    // The heaviest part of the heaviest round: shaving that is what brings the round down.
    const part = round.parts
      .map((id) => byId.get(id))
      .filter((action): action is RulesetStatBlockAction => !!action?.damage)
      .sort((left, right) => damageAverage(right) - damageAverage(left))[0];
    // The heaviest amount in that round: the first amount of a blow that carries only one, and
    // otherwise whichever of it, its clauses and the rider riding the round says most.
    const damage = [...(part ? blowAmounts(part) : []), ...(round.rider ? [round.rider.amount] : [])].sort(
      (left, right) => rulesetAverageAmount(right) - rulesetAverageAmount(left),
    )[0];
    const rolls = !!damage && damage.count > 0 && damage.sides > 0;
    if (damage && damage.count > 1 && damage.sides > 0) damage.count -= 1;
    else if (damage && damage.flat > (rolls ? 0 : 1)) damage.flat -= 1;
    else if (round.action?.sequence && dropOneStrike(round.action.sequence)) fewer = true;
    else if (damage && rolls && damage.sides > 2) damage.sides = smallerDie(damage.sides);
    else break;
    scaled = true;
  }
  if (fewer) adjusted.push("A creature of this tier does not strike that often, so the sequence lost a strike.");
  if (scaled) {
    const left = Math.round(bestRound(block.actions, block.riders).average * 100) / 100;
    adjusted.push(
      left <= cap
        ? `The damage was scaled down until the best round averages ${left}, inside the ${tier.damagePerRound[0]} to ${cap} of ${tier.label}.`
        : `The damage was scaled down as far as this block goes, and the best round still averages ${left} against the ${cap} of ${tier.label}.`,
    );
  }
  return { block, adjusted };
}
