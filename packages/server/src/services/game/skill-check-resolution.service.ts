// ──────────────────────────────────────────────
// Service: Skill Check Resolution (chat-scoped)
//
// The modifier lookup a check needs — the skill bonus
// from the game-state snapshot and the governing
// attribute from either playerStats or the player's
// character sheet — used to be 27 lines inlined in the
// POST /game/skill-check handler, so nothing else could
// roll a check the way the shipped endpoint rolls one.
// It lives here now: the endpoint is a thin caller, and
// generation post-processing rolls the GM's sparse tags
// through the same path.
// ──────────────────────────────────────────────

import {
  applyRulesetSheetOp,
  planRulesetUse,
  rulesetEntryNamed,
  createSkillCheckTagRegex,
  formatPoolSlotName,
  readGmTagAttributes,
  isEngineRollableSkillCheckTag,
  parseSkillCheckTagBody,
  serializeResolvedSkillCheckTag,
  serializeSparseSkillCheckTag,
  defaultRulesetSheetBuild,
  evaluateRulesetSheet,
  matchRulesetCheckTarget,
  parseDiceNotation,
  readRulesetWoundPenalty,
  rollDicePoolCheck,
  resolveRulesetValueRef,
  RULESET_POOL_MAX_DICE,
  rulesetCheckAdjust,
  rulesetDifficultyStep,
  rulesetDifficultyStepDc,
  rulesetLadderTargetFor,
  rulesetPoolMaxSuccesses,
  rollDiceSumCheck,
  rulesetCheckModifier,
  rulesetSheetEnvelopeSchema,
  type EvaluatedRulesetSheet,
  type RPGAttributes,
  type RulesetCatalogEntriesById,
  type RulesetDefinition,
  type RulesetLiveState,
  type RulesetLiveStates,
  type RulesetSheetBuild,
  type RulesetValueRef,
  type SkillCheckResult,
  type SkillCheckTag,
} from "@marinara-engine/shared";
import type { DB } from "../../db/connection.js";
import { logger } from "../../lib/logger.js";
// Type-only, deliberately: the pool service imports this module for the resolver and the
// modifier context, so a value import here would close the cycle.
import type { GameDicePoolSession } from "./dice-pool.service.js";
import { logPoolDcFit } from "./dice-pool.service.js";
import { createCharactersStorage } from "../storage/characters.storage.js";
import { createChatsStorage } from "../storage/chats.storage.js";
import { createGameStateStorage, parseStoredRulesetLive } from "../storage/game-state.storage.js";
import { rollDieSecurely } from "./dice-rng.js";
import { normalizeCharacterLookupName } from "./name-normalization.js";
import { loadRulesetRegistry, resolveGameRuleset } from "./ruleset-registry.service.js";
import {
  attributeModifier,
  getGoverningAttribute,
  mapSheetAttributesToRPG,
  readContextAttributeScore,
  resolveSkillCheck,
} from "./skill-check.service.js";

/** A check that names its difficulty only by a ladder step no ladder here has, so there is no number
 *  to roll it against. Its own class so the endpoint can answer it as the caller's mistake. */
export class SkillCheckDifficultyError extends Error {
  constructor(skill: string) {
    super(`The check ${skill} names no difficulty this game's rules can read`);
    this.name = "SkillCheckDifficultyError";
  }
}

/** Longest skill name a check may name — matches the POST /game/skill-check schema. */
export const SKILL_CHECK_MAX_SKILL_LENGTH = 100;
/** DC bounds — likewise the endpoint's, so both paths refuse the same tags. */
export const SKILL_CHECK_MIN_DC = 1;
export const SKILL_CHECK_MAX_DC = 40;

/**
 * Everything a chat contributes to a check's modifiers, read once.
 *
 * Resolving N checks in one narration must not mean N snapshot reads, and the
 * checks in one turn must all see the same sheet.
 */
export interface SkillCheckModifierContext {
  /** `playerStats.skills` from the latest game-state snapshot, when it parsed. */
  skills: Record<string, unknown> | null;
  /** `playerStats.attributes` — engine shape, never seeded today but preferred when present. */
  attributes: Record<string, unknown> | null;
  /** The player card's free-form `rpgStats.attributes`, mapped to the strict shape. */
  sheetAttributes: Partial<RPGAttributes>;
  /**
   * Present only when the game pinned a ruleset the install can honour. Every check then comes
   * from the ruleset's resolution kind and the party's ruleset sheets, and nothing above is read.
   * Absent is `engine-legacy`: the arithmetic this service has always done.
   */
  ruleset?: SkillCheckRulesetContext;
}

export interface SkillCheckRulesetContext {
  definition: RulesetDefinition;
  /** Normalized card name of the player, whose sheet answers a check that names nobody. */
  playerKey: string | null;
  /** Evaluated sheet per normalized card name. */
  sheets: Map<string, EvaluatedRulesetSheet>;
  /** The BUILD behind each of those sheets, which `applyRulesetSheetOp` needs to pay a spend.
   *  Kept beside the evaluated sheet rather than re-read, so one turn sees one sheet throughout. */
  builds: Map<string, RulesetSheetBuild>;
  /** The live state this turn started with, keyed the same way. A spend is applied on top of it,
   *  and `spentLive` is what the caller writes back. */
  live: RulesetLiveStates;
  /** The ruleset's catalog entries, when a tag on this turn named one with `use=` and the caller
   *  could fetch them. Empty otherwise, which reads exactly as a character having no such entry:
   *  the Engine cannot know what a charm costs, and guessing would apply it for free. */
  catalogs: RulesetCatalogEntriesById;
  /** What the wound track named by `resolution.penaltyFrom` costs each card's rolls, per normalized
   *  card name. Always negative or 0, worked out once per turn like the sheets beside it. Empty for
   *  a ruleset that names no penalty track, which is every ruleset written before they existed. */
  penalties: Map<string, number>;
  /** The ruleset's blank default build, for a party member (or a player) who has no sheet yet.
   *  It is what setup would have copied for them. A `who=` that names NOBODY in the party does
   *  not get this: it rolls with no modifier at all, because a ruleset's defaults are not neutral
   *  in every system and the Engine knows nothing about a stranger. */
  blank: EvaluatedRulesetSheet;
}

export interface SkillCheckRequest {
  skill: string;
  /** The difficulty to roll against. Absent only while a `difficulty=` ask has not been read against
   *  the ruleset's ladder yet; nothing rolls a request that still has none. */
  dc?: number;
  /** `difficulty=`: a ladder step picked by name. It supplies `dc` when none was written, and on a
   *  pool its per-die target. Ruleset games only. */
  difficulty?: string;
  /** `explode=` and `double=`: the face a pool rule the ruleset lets a check move fires on. */
  explode?: number;
  double?: number;
  /** `reroll=`: one of the ruleset's standing re-throws, by its id. */
  reroll?: string;
  advantage?: boolean;
  disadvantage?: boolean;
  preRolledD20?: number;
  /** The party member to roll for, in a game with a pinned ruleset. Absent means the player. */
  who?: string;
  /** `with=`: roll the skill or save with another ability than its own. Ruleset games only. */
  withAbility?: string;
  /** `threshold=`: the per-die target a pool check counts with, where the ruleset lets it move. */
  threshold?: number;
  /** `bonus=`: dice a pool check adds or takes, where the ruleset declares situational dice. */
  bonusDice?: number;
  /** `spend=`: what the player said they were spending on this check, where the ruleset offers
   *  such a purchase. The Engine decides what it costs and what it buys. */
  spend?: { pool: string; amount: number };
  /** `use=`: a catalog entry the character has, whose `mechanics.check` changes this roll. */
  useEntry?: string;
}

function parsePlayerStats(raw: unknown, chatId: string): Record<string, unknown> | null {
  if (!raw) return null;
  if (typeof raw !== "string") return typeof raw === "object" ? (raw as Record<string, unknown>) : null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch (err) {
    // Unparseable player stats cost the check its modifiers, never the turn.
    logger.warn(err, "[game/skill-check] Unparseable playerStats for chat %s; resolving without modifiers", chatId);
    return null;
  }
}

function parseChatMetadata(raw: unknown, chatId: string): Record<string, unknown> {
  if (typeof raw !== "string") return raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch (err) {
    logger.warn(err, "[game/skill-check] Unparseable chat metadata for chat %s", chatId);
    return {};
  }
}

function readTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * The player's card, found by who the player IS rather than where they sit.
 *
 * `gameCharacterCards[0]` used to be the answer, and position is not identity.
 * The setup prompt asks the model for the player's card first and the party's
 * after it, which is a convention the model usually follows, not a guarantee
 * anything enforces: the array is the model's own emission order from setup (and
 * from any later setup-style rewrite), and nothing in the engine pins the player
 * to the front. The moment an emission leads with someone else, every check silently
 * starts scoring against a *party member's* sheet — a wrong DEX quietly changes
 * whether the player got past the guard, and nothing in the turn says so.
 *
 * What the setup data actually marks the player with is the name: the persona's
 * name is what `characterCards` is told to use for the player's entry, and the
 * chat carries the persona id. So the persona's card is looked up by name.
 *
 * The first card stays the last resort, unchanged, for the chats that give this
 * nothing to match on — no persona set, a persona that no longer exists, or a
 * game whose cards never included one for the player. Those were served by
 * position before and still are; the fix is that a chat which CAN say who the
 * player is no longer guesses.
 */
async function findPlayerCharacterCard(
  db: DB,
  cards: Array<Record<string, unknown>>,
  chatPersonaId: unknown,
  meta: Record<string, unknown>,
  chatId: string,
): Promise<Record<string, unknown> | undefined> {
  if (cards.length === 0) return undefined;
  const setupConfig =
    meta.gameSetupConfig && typeof meta.gameSetupConfig === "object" && !Array.isArray(meta.gameSetupConfig)
      ? (meta.gameSetupConfig as Record<string, unknown>)
      : null;
  const personaId = readTrimmedString(chatPersonaId) || readTrimmedString(setupConfig?.personaId);
  if (!personaId) return cards[0];

  let personaName = "";
  try {
    const persona = await createCharactersStorage(db).getPersona(personaId);
    personaName = readTrimmedString(persona?.name);
  } catch (err) {
    // An unreadable persona costs the check its identity lookup, never the turn.
    logger.warn(err, "[game/skill-check] Could not read the persona for chat %s; using the first card", chatId);
    return cards[0];
  }
  if (!personaName) return cards[0];

  const wanted = normalizeCharacterLookupName(personaName);
  const playerCard = cards.find((card) => normalizeCharacterLookupName(readTrimmedString(card.name)) === wanted);
  if (playerCard) return playerCard;

  logger.debug("[game/skill-check] Chat %s has no card for the player; using the first card's sheet", chatId);
  return cards[0];
}

/**
 * Read the chat's modifier sources: the game-state snapshot's playerStats, and
 * the player character card's sheet attributes as the fallback the shipped
 * endpoint has always used (playerStats.attributes is never seeded today).
 */
export async function loadSkillCheckModifierContext(
  db: DB,
  chatId: string,
  /**
   * The live state this TURN starts from, when the caller knows it. A generating turn does: it is
   * the row the turn follows, or a continuation's own row, and it is what the sheet-command pass
   * later starts from too. Without it this reads the newest row instead, which is a different
   * balance whenever the turn does not follow the newest one — a regenerate or a swipe — and the
   * two passes of one turn would then spend from two different starting points. Left out, the
   * newest stored state stands, which is right for a caller with no turn of its own, such as the
   * `POST /game/skill-check` endpoint.
   */
  turnStartLive?: RulesetLiveStates | null,
): Promise<SkillCheckModifierContext> {
  const stateStore = createGameStateStorage(db);
  const snapshot = await stateStore.getLatest(chatId);
  const playerStats = parsePlayerStats(snapshot?.playerStats, chatId);

  const skills =
    playerStats?.skills && typeof playerStats.skills === "object"
      ? (playerStats.skills as Record<string, unknown>)
      : null;
  const attributes =
    playerStats?.attributes && typeof playerStats.attributes === "object"
      ? (playerStats.attributes as Record<string, unknown>)
      : null;

  // The chat is read even when playerStats already carries engine-shape attributes (which are
  // never seeded today), because the chat is also where a pinned ruleset lives.
  const chats = createChatsStorage(db);
  const chat = await chats.getById(chatId);
  const meta = chat ? parseChatMetadata(chat.metadata, chatId) : {};
  const cards = Array.isArray(meta.gameCharacterCards)
    ? (meta.gameCharacterCards as Array<Record<string, unknown>>)
    : [];

  if (meta.gameRuleset != null) {
    const pinned = resolveGameRuleset(meta, await loadRulesetRegistry());
    if (pinned.status === "ok") {
      const playerCard = await findPlayerCharacterCard(db, cards, chat?.personaId, meta, chatId);
      return {
        skills: null,
        attributes: null,
        sheetAttributes: {},
        // The live state of this chat's sheets: it is where a wound track's marks live, and a
        // check cannot know what a wound costs without them. The turn's own starting state when
        // the caller handed one over, and otherwise the snapshot read above.
        ruleset: buildSkillCheckRulesetContext(
          pinned.definition,
          cards,
          playerCard,
          turnStartLive === undefined ? parseStoredRulesetLive(snapshot?.rulesetLive) : turnStartLive,
        ),
      };
    }
    // A pin the install cannot honour must not be answered with another system's arithmetic.
    // Throwing here is what makes the tag driver save the checks sparse, still owing a roll.
    throw new Error(
      `Chat ${chatId} is pinned to ruleset ${pinned.status === "unavailable" ? (pinned.ref?.id ?? "(unreadable)") : ""}, which is not available (${pinned.status === "unavailable" ? pinned.reason : pinned.status})`,
    );
  }

  if (attributes) return { skills, attributes, sheetAttributes: {} };
  const playerCard = await findPlayerCharacterCard(db, cards, chat?.personaId, meta, chatId);
  const rpgStats = playerCard?.rpgStats as { attributes?: Array<{ name: string; value: number }> } | undefined;

  return { skills, attributes: null, sheetAttributes: mapSheetAttributesToRPG(rpgStats?.attributes) };
}

/** Evaluate every party card's ruleset sheet once, so all the checks in a turn see one sheet. */
export function buildSkillCheckRulesetContext(
  definition: RulesetDefinition,
  cards: ReadonlyArray<Record<string, unknown>>,
  playerCard: Record<string, unknown> | undefined,
  /** The game's live sheet state, keyed by normalized card name. Absent means nobody is marked,
   *  which is what a game whose ruleset has no wound track always looks like. */
  live?: RulesetLiveStates | null,
  /** The ruleset's catalog entries, for a check that names one with `use=`. */
  catalogs?: RulesetCatalogEntriesById | null,
): SkillCheckRulesetContext {
  const blankBuild = defaultRulesetSheetBuild(definition);
  const sheets = new Map<string, EvaluatedRulesetSheet>();
  const builds = new Map<string, RulesetSheetBuild>();
  const penalties = new Map<string, number>();
  const penaltyTrack = definition.resolution.penaltyFrom;
  const playerKeyForCards = playerCard ? normalizeCharacterLookupName(readTrimmedString(playerCard.name)) : "";
  // Two cards that normalize to one name: `who=` cannot say which, so neither sheet answers it and
  // the check rolls unmodified. The player's own card is the exception; a name they share stays theirs.
  const ambiguous = new Set<string>();
  for (const card of cards) {
    const key = normalizeCharacterLookupName(readTrimmedString(card.name));
    if (!key || ambiguous.has(key)) continue;
    if (sheets.has(key)) {
      if (key === playerKeyForCards) {
        if (card !== playerCard) continue;
      } else {
        // Everything read under this name goes, not just the sheet: a build or a wound penalty
        // left behind would still be applied to a name the Engine has just decided it cannot tell
        // apart, which is the opposite of rolling it unmodified.
        sheets.delete(key);
        builds.delete(key);
        penalties.delete(key);
        ambiguous.add(key);
        logger.warn("[game/skill-check] Two party cards are named %s; checks for that name roll unmodified", key);
        continue;
      }
    }
    const envelope = rulesetSheetEnvelopeSchema.safeParse(card.rulesetSheet);
    if (card.rulesetSheet != null && !envelope.success) {
      logger.warn("[game/skill-check] The ruleset sheet for %s is unreadable; rolling on a blank sheet", key);
    }
    const cardBuild = envelope.success ? envelope.data.build : blankBuild;
    sheets.set(key, evaluateRulesetSheet(definition, cardBuild));
    builds.set(key, cardBuild);
    if (penaltyTrack) {
      const penalty = readRulesetWoundPenalty(definition, live?.[key], penaltyTrack);
      if (penalty !== 0) penalties.set(key, penalty);
    }
  }
  return {
    definition,
    playerKey: playerKeyForCards || null,
    sheets,
    builds,
    live: live ?? {},
    catalogs: catalogs ?? {},
    penalties,
    blank: evaluateRulesetSheet(definition, blankBuild),
  };
}

// ── What a check may BUY ──
//
// Some systems let a player spend a resource to change a roll they are about to make: a point of
// will for an automatic success. It cannot be two tags in one reply, because the dice are thrown
// before the `[sheet: ...]` commands are applied and there would be nothing left to change. So the
// check tag carries what was spent and ONE resolution does both.
//
// All or nothing, exactly as `planRulesetUse` already is: a spend the pool cannot cover buys
// nothing and costs nothing. The model names what the player said they were spending; the Engine
// decides what it costs and what it does, and never takes the model's word for the dice.

export interface RulesetCheckPurchase {
  /** What really left the sheet, for the record. */
  spent?: { pool: string; amount: number };
  /** What it bought, for the roller. */
  bought: {
    dice?: number;
    successes?: number;
    threshold?: number;
    reroll?: { upTo: number; mode: "once" | "until" };
    explode?: number;
    double?: number;
  };
  /** The entry it came out of, when it came out of one, by the label the ruleset gives it. */
  used?: string;
  /** The roller's own key, and the live state with the cost taken out of it. */
  key: string;
  live: RulesetLiveState;
}

/** How many times over one check may buy an entry's effect, whatever an entry's own cost is. The
 *  same reason `perCheck` exists on a standing spend: a full pool must not buy an unlosable roll. */
const MAX_ENTRY_CHECK_STEPS = 5;

/**
 * What the catalog entry the Game Master named with `use=` does to this check, and what it costs.
 *
 * The entry is matched by `planRulesetUse`'s own rules, through `planRulesetUse` itself, so one
 * name means the same thing here as it does in a `[sheet:]` command: the name the sheet shows a
 * row under, or the label of the entry it came from, and an ambiguous one is refused rather than
 * guessed at. What it COSTS is the plan's own steps, which is the same machinery that upcasts a
 * spell, so nothing about paying for something is reinvented here.
 *
 * `spend=` beside `use=` is what pays for a HIGHER use of it, exactly as a spell paid out of a
 * bigger slot: an entry that declares `perCostStep` scales with how many times over the price was
 * paid, and one that does not is bought once however much was offered.
 *
 * Null for every reason there is, and in every one of them the roll is the one it would have been
 * and nothing is deducted: the ruleset has no catalogs here, the character does not have the entry,
 * the entry says nothing about checks, its kind cannot honour what it says, or the sheet cannot pay.
 */
function planRulesetEntryCheck(
  ruleset: SkillCheckRulesetContext,
  name: string | undefined,
  asked: { pool: string; amount: number } | undefined,
  who: string | undefined,
): RulesetCheckPurchase | null {
  const wanted = name?.trim();
  if (!wanted || ruleset.definition.resolution.kind !== "dice-pool") return null;
  const key = who ? normalizeCharacterLookupName(who) : ruleset.playerKey;
  const build = key ? ruleset.builds.get(key) : undefined;
  if (!key || !build) return null;

  // The SAME matcher the payment uses, so the effect and the cost can never come from two different
  // entries: a row answers to its name on the sheet as well as to the catalog's label, and a name
  // two rows answer to is refused here exactly as it is refused there.
  const found = rulesetEntryNamed(ruleset.definition, build, ruleset.catalogs, wanted);
  if (!found.ok) return null;
  const entry = found.entry;
  // The entry has to say something about checks, or using it here would spend for nothing.
  const effect = entry.mechanics?.check;
  if (!effect) return null;

  // How many times over the price was paid. One use unless the entry scales and the Game Master
  // said more was spent, and never past the Engine's own ceiling.
  const cost = entry.mechanics?.cost ?? [];
  const price = cost.length === 1 ? cost[0]! : null;
  const offered = asked && price && price.pool.trim().toLowerCase() === asked.pool.trim().toLowerCase() ? asked : null;
  const scales = !!entry.mechanics?.perCostStep;
  const steps =
    scales && offered && price && price.amount > 0 && offered.amount % price.amount === 0
      ? Math.max(1, Math.min(MAX_ENTRY_CHECK_STEPS, offered.amount / price.amount))
      : 1;

  // Paid through the same plan a `[sheet:]` `use` goes through, so an entry's counters and its
  // pool cost come off together and a price the sheet would refuse is refused here too.
  let live: RulesetLiveState = ruleset.live[key] ?? {};
  let paidPool = "";
  let paidAmount = 0;
  for (let step = 0; step < steps; step++) {
    const plan = planRulesetUse(ruleset.definition, build, live, ruleset.catalogs, { op: "use", name: wanted });
    if (!plan.ok) return null;
    for (const planned of plan.steps) {
      const applied = applyRulesetSheetOp(ruleset.definition, build, live, planned.op);
      // All or nothing: the first refusal takes the whole purchase with it.
      if (!applied.ok) return null;
      live = applied.live;
      if ("pool" in planned.op && planned.op.op === "spend") {
        if (!paidPool) paidPool = planned.op.pool;
        if (planned.op.pool === paidPool) paidAmount += planned.op.amount;
      }
    }
  }
  return {
    ...(paidPool ? { spent: { pool: paidPool, amount: paidAmount } } : {}),
    bought: {
      ...(effect.dice ? { dice: effect.dice * steps } : {}),
      ...(effect.successes ? { successes: effect.successes * steps } : {}),
      ...(effect.threshold !== undefined ? { threshold: effect.threshold } : {}),
      ...(effect.reroll ? { reroll: effect.reroll } : {}),
      ...(effect.explode !== undefined ? { explode: effect.explode } : {}),
      ...(effect.double !== undefined ? { double: effect.double } : {}),
    },
    used: entry.label,
    key,
    live,
  };
}

/**
 * What the Game Master's `spend=` actually buys on this check, and what it costs.
 *
 * Null whenever nothing is bought, for every reason there is: the ruleset offers no such purchase,
 * the tag named another pool, the points are not a whole number of purchases, or the pool cannot
 * cover it. In all of them the roll happens exactly as it would have without the tag's `spend=`,
 * and nothing is deducted.
 *
 * The number of purchases is CLAMPED to the ruleset's own `perCheck` rather than refused, the way
 * `threshold=` and `bonus=` are clamped: a player asking for more than the rules allow still gets
 * the roll, and pays only for what they got.
 */
export function planRulesetCheckPurchase(
  ruleset: SkillCheckRulesetContext,
  asked: { pool: string; amount: number } | undefined,
  who?: string,
  /** The check's own dice, before anything was added or taken: what a `"pool"` limit reads. */
  base = 0,
): RulesetCheckPurchase | null {
  const offers = ruleset.definition.resolution.spend;
  if (!asked || !offers || offers.length === 0) return null;
  const wanted = asked.pool.trim().toLowerCase();
  const offer = offers.find((entry) => {
    if (entry.pool.toLowerCase() === wanted) return true;
    const pool = ruleset.definition.sheet.live.pools.find((candidate) => candidate.id === entry.pool);
    return pool?.label.trim().toLowerCase() === wanted;
  });
  if (!offer) return null;
  // Whole purchases only. Half a point of will buys half a success in no system.
  if (!Number.isInteger(asked.amount) || asked.amount < offer.amount || asked.amount % offer.amount !== 0) return null;

  const key = who ? normalizeCharacterLookupName(who) : ruleset.playerKey;
  const build = key ? ruleset.builds.get(key) : undefined;
  // A stranger has no sheet to spend from, so there is nothing to pay with and nothing is bought.
  if (!key || !build) return null;
  const times = Math.min(rulesetSpendCap(ruleset, offer.perCheck, key, build, base), asked.amount / offer.amount);
  // A limit the sheet sets can be nothing for this character, and then nothing is bought.
  if (times < 1) return null;
  const cost = times * offer.amount;
  const paid = applyRulesetSheetOp(ruleset.definition, build, ruleset.live[key], {
    op: "spend",
    pool: offer.pool,
    amount: cost,
  });
  // `spend` refuses rather than floors when the pool is short, which is exactly the all-or-nothing
  // this needs: the effect does not apply and nothing is deducted.
  if (!paid.ok) return null;
  return {
    spent: { pool: offer.pool, amount: cost },
    bought: {
      ...(offer.dice ? { dice: offer.dice * times } : {}),
      ...(offer.successes ? { successes: offer.successes * times } : {}),
      // Bought once however many purchases were made: a die thrown again twice is one re-throw.
      ...(offer.reroll ? { reroll: offer.reroll } : {}),
    },
    key,
    live: paid.live,
  };
}

/** How many purchases of a spend one check may make, for this character on this check: the number
 *  the ruleset wrote, the value its sheet works out, or the check's own dice. Whole, never below
 *  none, and never past the most dice one pool may hold. */
function rulesetSpendCap(
  ruleset: SkillCheckRulesetContext,
  perCheck: number | "pool" | RulesetValueRef,
  key: string,
  build: RulesetSheetBuild,
  base: number,
): number {
  if (typeof perCheck === "number") return perCheck;
  const raw =
    perCheck === "pool"
      ? base
      : resolveRulesetValueRef(
          ruleset.definition,
          build,
          perCheck,
          ruleset.sheets.get(key) ?? evaluateRulesetSheet(ruleset.definition, build),
        );
  return Math.max(0, Math.min(RULESET_POOL_MAX_DICE, Math.floor(raw)));
}

/** The request with the number its named ladder step stands for, where it wrote no `dc=` of its own
 *  and the ruleset's ladder has that step. Anything else comes back exactly as it was, so a caller
 *  can read every request through this once the ruleset is in hand. */
export function readRulesetDifficulty(request: SkillCheckRequest, definition?: RulesetDefinition): SkillCheckRequest {
  if (request.dc !== undefined || !definition) return request;
  const step = rulesetDifficultyStep(definition, request.difficulty);
  return step ? { ...request, dc: rulesetDifficultyStepDc(step) } : request;
}

/** What the roller's wound track costs this check. Always negative or 0, and 0 for a stranger, a
 *  ruleset that names no penalty track and anybody who is not marked. */
export function rulesetCheckPenaltyFor(ruleset: SkillCheckRulesetContext, who?: string): number {
  const key = who ? normalizeCharacterLookupName(who) : ruleset.playerKey;
  return (key ? ruleset.penalties.get(key) : undefined) ?? 0;
}

/** The sheet modifier a ruleset game applies for `who` (or the player) on the named check. Under
 *  `dice-pool` this is not a modifier but the size of the pool; the caller's kind decides. */
export function rulesetCheckModifierFor(
  ruleset: SkillCheckRulesetContext,
  skill: string,
  who?: string,
  withAbility?: string,
): number {
  const target = matchRulesetCheckTarget(ruleset.definition, skill, withAbility);
  if (who) {
    // A name that matches nobody (or two cards at once) is a stranger: no modifier at all.
    const named = ruleset.sheets.get(normalizeCharacterLookupName(who));
    return named ? rulesetCheckModifier(named, target) : 0;
  }
  const player = ruleset.playerKey ? ruleset.sheets.get(ruleset.playerKey) : undefined;
  return rulesetCheckModifier(player ?? ruleset.blank, target);
}

/** What the sheet's own `resolution.adjust` adds to or takes off `who`'s check (or the player's), on
 *  the same terms as the modifier beside it: a stranger has no sheet, so nothing. */
export function rulesetCheckAdjustFor(
  ruleset: SkillCheckRulesetContext,
  skill: string,
  who?: string,
  withAbility?: string,
): number {
  const { definition } = ruleset;
  if (!definition.resolution.adjust?.length) return 0;
  const target = matchRulesetCheckTarget(definition, skill, withAbility);
  if (who) {
    const key = normalizeCharacterLookupName(who);
    const evaluated = ruleset.sheets.get(key);
    const build = ruleset.builds.get(key);
    return evaluated && build ? rulesetCheckAdjust(definition, build, evaluated, target) : 0;
  }
  const key = ruleset.playerKey;
  const evaluated = (key ? ruleset.sheets.get(key) : undefined) ?? ruleset.blank;
  const build = (key ? ruleset.builds.get(key) : undefined) ?? defaultRulesetSheetBuild(definition);
  return rulesetCheckAdjust(definition, build, evaluated, target);
}

/** One of the ruleset's standing re-throws, by the id the Game Master named with `reroll=`, matched
 *  without case. Null for a name nothing answers to, and on a summed ruleset, which has none. */
export function rulesetStandingReroll(
  definition: RulesetDefinition,
  name: string | undefined,
): { id: string; upTo: number; mode: "once" | "until" } | null {
  const wanted = name?.trim().toLowerCase();
  if (!wanted || definition.resolution.kind !== "dice-pool") return null;
  return definition.resolution.reroll?.find((entry) => entry.id.toLowerCase() === wanted) ?? null;
}

/** One re-throw per roll: of two that would apply, the one that reaches more faces, and `until`
 *  over `once` where they reach the same. Two re-throws of the same dice are not a rule anywhere. */
function widerReroll<T extends { upTo: number; mode: "once" | "until" }>(first?: T | null, second?: T | null) {
  if (!first) return second ?? undefined;
  if (!second) return first;
  if (first.upTo !== second.upTo) return first.upTo > second.upTo ? first : second;
  return second.mode === "until" && first.mode !== "until" ? second : first;
}

function resolveRulesetSkillCheck(
  ruleset: SkillCheckRulesetContext,
  request: SkillCheckRequest,
  rollD20?: () => number,
  /** Called with the live state a purchase paid out of, so the caller can write it back. Absent on
   *  every path that does not persist, which then rolls exactly as it would have with no spend. */
  onSpend?: (key: string, live: RulesetLiveState) => void,
): SkillCheckResult {
  const { definition } = ruleset;
  const resolution = definition.resolution;
  const target = matchRulesetCheckTarget(definition, request.skill, request.withAbility);
  // An ability nobody on this sheet answers to is ignored rather than refused, so the check still
  // happens with the skill's own ability. Said once, here, where the ruleset is actually in hand.
  // On an ability check it is also ignored wherever the ruleset does not add two abilities together.
  if (request.withAbility && target && !target.withAbility) {
    logger.debug(
      "[game/skill-check] %s does nothing on %s in ruleset %s; rolling it as named",
      request.withAbility,
      request.skill,
      definition.id,
    );
  }
  // The ladder step a name picks, when the Game Master named one. `dc=` still wins where both were
  // written; the step's own target applies either way. A name no step answers to is ignored, the way
  // an unknown `with=` is.
  const step = rulesetDifficultyStep(definition, request.difficulty);
  if (request.difficulty && !step) {
    logger.debug(
      "[game/skill-check] No difficulty named %s in ruleset %s; ignoring it",
      request.difficulty,
      definition.id,
    );
  }
  const askedDc = request.dc ?? (step ? rulesetDifficultyStepDc(step) : undefined);
  // Every caller reads the ask against the ladder before it gets here, so this is a check nobody
  // could have rolled: thrown, so the turn saves it as the ask it still is.
  if (askedDc === undefined) throw new SkillCheckDifficultyError(request.skill);
  const modifier = rulesetCheckModifierFor(ruleset, request.skill, request.who, request.withAbility);
  // What the roller's wounds cost this check. It is applied the way the kind understands a number:
  // `dice-sum` adds it to the roll, `dice-pool` takes that many dice off the pool and the roller's
  // own clamp holds it at `pool.min`. Both go through the same `modifier` input, so there is one
  // place a wound can be forgotten rather than two.
  const penalty = rulesetCheckPenaltyFor(ruleset, request.who);
  // And what the sheet itself adds or takes on this check, applied in the same place for the same
  // reason, and said beside the wound penalty on the record.
  const adjust = rulesetCheckAdjustFor(ruleset, request.skill, request.who, request.withAbility);
  // What the check buys, worked out and PAID before the dice are thrown, so a roll can never be
  // changed by something that turned out to be unaffordable. A caller that cannot persist the cost
  // buys nothing: the roll is then the one it would have been without the tag's `spend=`.
  // An entry the player used outranks the ruleset's own standing spend, because it is the more
  // specific thing the Game Master named. Only ONE of the two is ever bought on one check: two
  // purchases out of one `spend=` would pay for it twice.
  // And when a name WAS given, it is the only thing that can be bought. Beside a `use=`, the
  // `spend=` is that entry's own price, which is what pays for a higher use of it; buying the
  // ruleset's standing spend with it instead would take the points for an effect nobody asked for,
  // on a check where the named charm did nothing.
  const purchase = !onSpend
    ? null
    : request.useEntry?.trim()
      ? planRulesetEntryCheck(ruleset, request.useEntry, request.spend, request.who)
      : planRulesetCheckPurchase(ruleset, request.spend, request.who, modifier);
  if (purchase) onSpend!(purchase.key, purchase.live);
  // A standing re-throw the Game Master named. It costs nothing, so it needs no persisting caller;
  // beside one that was bought, the wider of the two is the one thrown.
  const standing = rulesetStandingReroll(definition, request.reroll);
  if (request.reroll && !standing) {
    logger.debug("[game/skill-check] No re-throw named %s in ruleset %s; ignoring it", request.reroll, definition.id);
  }
  const reroll = widerReroll(purchase?.bought.reroll, standing);
  const bought = purchase || reroll ? { ...(purchase?.bought ?? {}), ...(reroll ? { reroll } : {}) } : undefined;
  // What the record may say about `with=`: the ability's own label, and only when the swap
  // happened. An ability check has no other ability to swap in, and an unknown name was ignored.
  // On an ability check it is the second ability added, which is only ever set where the ruleset adds two.
  const swapped = target?.withAbility
    ? definition.sheet.abilities.find((ability) => ability.id === target.withAbility)?.label
    : undefined;
  const applied = {
    ...(swapped ? { withAbility: swapped } : {}),
    // Said even on a summed check, where it is also inside `modifier`: "-2 because you are Wounded"
    // is not something a player can read out of one number.
    ...(penalty !== 0 ? { penalty } : {}),
    ...(adjust !== 0 ? { adjust } : {}),
    ...(purchase?.spent ? { spent: purchase.spent } : {}),
    ...(purchase?.used ? { used: purchase.used } : {}),
  };
  // The injected d20 (tests, the sighted pool) stands in only where a d20 is what is rolled.
  const rollDie = (sides: number) => (sides === 20 && rollD20 ? rollD20() : rollDieSecurely(sides));
  const isSave = target?.type === "save";

  if (resolution.kind === "dice-pool") {
    // The DC is a count of successes, so its ceiling is what the largest roll could count. Clamped
    // rather than refused:
    // the sighted pool's own bound is applied before any ruleset is loaded, so this is the only
    // place that knows what this ruleset's ceiling is.
    const dc = Math.min(rulesetPoolMaxSuccesses(resolution), Math.max(1, Math.round(askedDc)));
    // The per-die target the ladder means, where the Game Master did not set one: the named step's,
    // or else the one step that needs exactly this many successes. A ladder step that names no
    // target leaves the ruleset's default.
    const ladderTarget =
      request.threshold === undefined
        ? step && "successes" in step
          ? step.target
          : rulesetLadderTargetFor(definition, dc)
        : undefined;
    const rolled = rollDicePoolCheck(
      definition,
      {
        // Dice off the pool. The roller clamps into `pool`, so a large penalty stops at `pool.min`
        // rather than at no dice at all, which is the ruleset's own floor for an empty pool.
        modifier: modifier + penalty + adjust,
        required: dc,
        isSave,
        threshold: request.threshold ?? ladderTarget,
        bonusDice: request.bonusDice,
        explode: request.explode,
        double: request.double,
        ...(bought ? { bought } : {}),
      },
      rollDie,
    );
    return {
      skill: request.skill,
      dc,
      // The sheet's number bought the dice; nothing is added to the count of successes.
      modifier: 0,
      resolution: "successes",
      ...rolled,
      // The roller reports 0 where nothing was added; a record says nothing about that.
      bonusDice: rolled.bonusDice || undefined,
      autoSuccesses: rolled.autoSuccesses || undefined,
      rerolled: rolled.rerolled || undefined,
      // A face is said only where the check moved it off the ruleset's own, so a record of an ordinary
      // roll reads exactly as it always has.
      explodeFrom: rolled.explodeFrom !== resolution.explode?.from ? rolled.explodeFrom : undefined,
      doubleFrom: rolled.doubleFrom !== resolution.double?.from ? rolled.doubleFrom : undefined,
      complication: rolled.complication || undefined,
      // Named only when it was the standing one that was thrown, and it actually threw something.
      reroll: standing && reroll === standing && rolled.rerolled > 0 ? standing.id : undefined,
      ...applied,
      ...(request.who ? { who: request.who } : {}),
    };
  }

  const { sides, count } = resolution.dice;
  // A flat modifier on the roll, which is what a penalty IS in a summed system, so it belongs in
  // the number the record adds up rather than beside it.
  const summed = modifier + penalty + adjust;
  const rolled = rollDiceSumCheck(
    definition,
    {
      modifier: summed,
      dc: askedDc,
      isSave,
      advantage: request.advantage,
      disadvantage: request.disadvantage,
      preRolled: sides === 20 && count === 1 ? request.preRolledD20 : undefined,
    },
    rollDie,
  );
  return {
    skill: request.skill,
    dc: askedDc,
    modifier: summed,
    resolution: "sum",
    ...rolled,
    ...applied,
    ...(request.who ? { who: request.who } : {}),
  };
}

/** Whether a ruleset game rolls this tag: a `sum` check whose dice label, when the GM wrote one,
 *  is exactly what the ruleset throws for that mode. Anything else names another system. */
function isRulesetRollableSkillCheckTag(tag: SkillCheckTag, definition: RulesetDefinition): boolean {
  // A pool ruleset rolls every check it is asked for. The pool comes from the character sheet, so
  // a `dice=` or `resolution=` the model wrote from habit describes nothing the Engine has to
  // honour, and `mode=` names an advantage this kind does not have. All three are ignored, which
  // is safe here and nowhere else: the Engine is not guessing at the rules, it has them.
  if (definition.resolution.kind === "dice-pool") return true;
  // Refused on purpose, exactly as `isEngineRollableSkillCheckTag` refuses it: a tag that declares
  // both modes names no roll, and the guide promises a check is never rolled with both at once.
  if (tag.advantage && tag.disadvantage) return false;
  if (tag.declaredResolution != null && tag.declaredResolution !== "sum") return false;
  if (tag.declaredDice == null) return true;
  const notation = parseDiceNotation(tag.declaredDice);
  if (!notation || notation.dice !== tag.declaredDice) return false;
  const { count, sides } = definition.resolution.dice;
  const sets = definition.resolution.advantage && (tag.advantage || tag.disadvantage) ? 2 : 1;
  return notation.sides === sides && notation.count === count * sets;
}

/** Whether a complete tag's numbers are the ones this ruleset and this sheet would have produced.
 *  A GM that writes its own modifier has not rolled the character's check, however tidy the sum. */
function rulesetVouchesFor(ruleset: SkillCheckRulesetContext, tag: SkillCheckTag): boolean {
  const resolution = ruleset.definition.resolution;
  // A pool is never vouched for. Its numbers are auditable, but a handful of dice has so many
  // consistent outcomes that an audit constrains nothing: the model could pick eight favourable
  // faces and count them correctly. So a pool check is always the Engine's own roll.
  if (resolution.kind === "dice-pool") return false;
  const result = tag.resolvedResult;
  if (!result || result.resolution !== "sum") return false;
  const { count, sides } = resolution.dice;
  if (result.rollMode !== "normal" && !resolution.advantage) return false;
  const sets = result.rollMode === "normal" ? 1 : 2;
  if (result.rolls.length !== count * sets || result.rolls.some((roll) => roll < 1 || roll > sides)) return false;
  // The die that counted has to be the one the mode keeps: the only set, or the higher or lower of two.
  const sum = (set: number[]) => set.reduce((total, roll) => total + roll, 0);
  const first = sum(result.rolls.slice(0, count));
  const kept =
    sets === 1
      ? first
      : result.rollMode === "advantage"
        ? Math.max(first, sum(result.rolls.slice(count)))
        : Math.min(first, sum(result.rolls.slice(count)));
  if (result.usedRoll !== kept) return false;
  // The sheet's own number PLUS what the roller's wounds take off it, because that is the one
  // number a summed check adds to the dice. A GM that wrote the unwounded modifier has not rolled
  // this character's check.
  const expected =
    rulesetCheckModifierFor(ruleset, tag.skill, tag.who, tag.withAbility) +
    rulesetCheckPenaltyFor(ruleset, tag.who) +
    rulesetCheckAdjustFor(ruleset, tag.skill, tag.who, tag.withAbility);
  if (result.modifier !== expected) return false;
  if (result.usedRoll + result.modifier !== result.total) return false;
  const target = matchRulesetCheckTarget(ruleset.definition, tag.skill);
  const policy = target?.type === "save" ? resolution.naturals.save : resolution.naturals.check;
  const single = count === 1;
  const autoSuccess = single && result.usedRoll === sides && (policy === "both" || policy === "max-only");
  const autoFailure = single && result.usedRoll === 1 && (policy === "both" || policy === "min-only");
  if (result.criticalSuccess !== autoSuccess || result.criticalFailure !== autoFailure) return false;
  return result.success === (autoSuccess ? true : autoFailure ? false : result.total >= result.dc);
}

/** Roll one check against an already-loaded chat context. */
export function resolveSkillCheckWithContext(
  context: SkillCheckModifierContext,
  request: SkillCheckRequest,
  rollD20?: () => number,
  onSpend?: (key: string, live: RulesetLiveState) => void,
): SkillCheckResult {
  if (context.ruleset) return resolveRulesetSkillCheck(context.ruleset, request, rollD20, onSpend);
  const skills = context.skills;
  const rawSkillMod = skills ? (skills[request.skill] ?? skills[request.skill.toLowerCase()]) : undefined;
  const skillMod = Number.isFinite(Number(rawSkillMod)) ? Number(rawSkillMod) : 0;

  // The Engine's own rules have no ladder to read a named difficulty off, so an ask with no number is
  // one nothing here can roll. Callers leave such a tag as written; this only guards the door.
  if (request.dc === undefined) throw new SkillCheckDifficultyError(request.skill);
  const attr = getGoverningAttribute(request.skill);
  const attrScore = readContextAttributeScore(context, attr);

  return resolveSkillCheck({
    skill: request.skill,
    dc: request.dc,
    skillModifier: skillMod,
    attributeModifier: attrScore != null ? attributeModifier(attrScore) : 0,
    advantage: request.advantage,
    disadvantage: request.disadvantage,
    preRolledD20: request.preRolledD20,
    rollD20,
  });
}

/** Resolve a single check for a chat — the POST /game/skill-check body. */
export async function resolveChatSkillCheck(
  db: DB,
  chatId: string,
  request: SkillCheckRequest,
  rollD20?: () => number,
): Promise<SkillCheckResult> {
  const context = await loadSkillCheckModifierContext(db, chatId);
  return resolveSkillCheckWithContext(context, request, rollD20);
}

/**
 * Whether a tag names a check this engine will roll.
 *
 * The same bounds the endpoint's schema enforces, so a tag the client would
 * have been unable to POST is left in the prose rather than resolved by a path
 * with looser rules.
 *
 * Exported because the one-request branch arm rolls its own matched check before
 * this function's own caller runs, and a second copy of these bounds is how the
 * two paths would start refusing different tags.
 */
export function isResolvableSkillCheckRequest(request: SkillCheckRequest, definition?: RulesetDefinition): boolean {
  if (!request.skill || request.skill.length > SKILL_CHECK_MAX_SKILL_LENGTH) return false;
  // A difficulty still only named, never read against a ladder, is not a number anything can roll.
  const dc = request.dc;
  if (dc === undefined) return false;
  const resolution = definition?.resolution;
  // A pool check's difficulty is a count of successes, not a target number, so the d20 bounds say
  // nothing about it: it can never need more successes than the largest roll could count.
  if (resolution?.kind === "dice-pool") {
    return Number.isInteger(dc) && dc >= 1 && dc <= rulesetPoolMaxSuccesses(resolution);
  }
  // A ruleset's own difficulty ladder may reach past the Engine's d20 bounds in either direction.
  const ladder = resolution?.difficultyLadder.map((step) => step.dc) ?? [];
  const min = Math.min(SKILL_CHECK_MIN_DC, ...ladder);
  const max = Math.max(SKILL_CHECK_MAX_DC, ...ladder);
  return Number.isInteger(dc) && dc >= min && dc <= max;
}

export interface SkillCheckTagResolutionOptions {
  /** Loaded at most once, and only when at least one tag actually needs rolling. */
  loadContext: () => Promise<SkillCheckModifierContext>;
  rollD20?: () => number;
  /** Chat id for logging only. */
  chatId?: string;
  /**
   * True when the chat carries a `gameRuleset` pin. The context, which is where the ruleset
   * actually lives, is loaded lazily and only when a tag owes a roll; this hint is what lets a
   * ruleset game load it for a tag that LOOKS finished too, so the GM's own modifier is checked
   * against the sheet. Absent or false is `engine-legacy`, byte for byte.
   */
  rulesetPinned?: boolean;
  /**
   * The sighted pool, supplied by exactly ONE caller: generation post-processing, for the
   * newly generated segment only.
   *
   * A record the model just wrote and a record read back out of a saved message are the
   * same bytes; no regex, marker or heuristic on the text can tell them apart, and adding
   * one would change how an already-saved transcript reads. So freshness is carried out of
   * band, here. Every other caller — the client's parser, the segment editor, any re-read —
   * passes nothing and behaves byte for byte as it does today.
   */
  pool?: GameDicePoolSession;
  /**
   * The ruleset's catalog entries, fetched lazily and ONLY when a check in this reply names one
   * with `use=`.
   *
   * It is separate from `loadContext` because reading a catalog is file work, and the overwhelming
   * majority of turns never need it. A caller that supplies none, or one whose fetch fails, leaves
   * the context's catalogs empty, which reads as the character not having the entry: the Engine
   * cannot know what a charm costs and will not guess, so the roll is the one it would have been.
   */
  loadCatalogs?: () => Promise<RulesetCatalogEntriesById>;
}

export interface SkillCheckTagResolution {
  content: string;
  /** Newly rolled checks, for narration that must wait for these outcomes. */
  results?: SkillCheckResult[];
  /** How many tags this pass rewrote. */
  resolved: number;
  /** How many tags it left alone because the GM's own numbers held up. */
  trusted: number;
  /**
   * Every tag left standing, for any reason — the numbers held, the engine does
   * not implement the system the tag names, the DC or skill was out of bounds,
   * the body was not readable as a check at all, or the roll could not happen and
   * the tag went back sparse. `resolved + left` is every `[skill_check:]` in the
   * content, so a log line can say what happened to all of them instead of
   * accounting for two of the five cases.
   */
  left: number;
  /**
   * How many tags were rewritten into their honest sparse form because the roll
   * could not happen at all. Counted inside `left` — they owe a roll still — and
   * non-zero only on the failure path.
   */
  sparse: number;
  /**
   * The live sheet state after every purchase this pass paid for, when any did.
   *
   * Absent when nothing was bought, which is every game that does not use `spend=`. The caller
   * hands it to the sheet-command pass as the state THAT turn starts from, so one turn's dice and
   * its bookkeeping are applied in the order they happened: the points are gone before the
   * narration's own `[sheet: ...]` commands run.
   */
  live?: RulesetLiveStates;
}

/**
 * Roll every `[skill_check:]` tag in a narration that still owes a real roll,
 * and rewrite it in place with the resolved form.
 *
 * Two shapes need rolling and both are handled the same way, because the shared
 * reader collapses them: a **sparse** tag (skill + DC, no numbers) and a **full**
 * tag whose plain-d20 arithmetic fails the audit. The second is the case this
 * function exists for — before it, a GM that invented `rolls="7" total="19"` had
 * its numbers corrected on the dice card and left standing in the saved text, so
 * the next turn read back the invention as fact.
 *
 * Idempotent: what it writes parses back as an audited result, so a second pass
 * over the same content rewrites nothing and rolls no dice. The one exception is a
 * `dice-pool` RULESET's check, whose numbers are never vouched for and would be rolled
 * again; generation only ever hands this function a freshly written segment. Pool systems
 * (`resolution="successes"`, non-d20 `dice=`) are never audited and never
 * rewritten — the engine does not implement those rules and will not pretend to.
 * That holds for a malformed pool tag as much as a tidy one: the shared reader
 * refusing to vouch for a pool's numbers is not permission to answer it with a
 * d20, so `isEngineRollableSkillCheckTag` is asked before anything is rolled.
 *
 * **It does not throw, and that is the point.** The failure this owns is the
 * chat's modifiers not loading, and the caller's only two options used to be
 * losing the turn or saving it unchanged — and unchanged means saving the
 * model's invented `rolls="7" total="19"` on a check nobody rolled, which the
 * next turn reads back as fact. That is the exact dishonesty the engine took the
 * die away to end, arrived at through the error path instead of the happy one.
 * So a roll that cannot happen writes the tags back SPARSE: the ask the GM made,
 * the numbers dropped, nothing invented in their place. The turn survives, the
 * transcript stays honest, and the check reads back as still owing a roll — so
 * the client's own fallback can ask for one.
 */
export async function resolveSkillCheckTagsInContent(
  content: string,
  options: SkillCheckTagResolutionOptions,
): Promise<SkillCheckTagResolution> {
  if (!content || !/\[skill_check\b/i.test(content)) {
    return { content, resolved: 0, trusted: 0, left: 0, sparse: 0 };
  }

  const pending: Array<{
    start: number;
    end: number;
    request: SkillCheckRequest;
    tag: SkillCheckTag;
    /** Set only for a tag the pool spends for, carrying the body the audit reads. */
    poolBody?: string;
  }> = [];
  /** Ruleset games only: tags whose fate depends on the ruleset, decided once it is loaded. */
  const deferred: Array<{ start: number; end: number; tag: SkillCheckTag }> = [];
  /** Live state after the purchases this pass paid for. Built up across the checks in one turn, so
   *  two checks that both spend from one pool cannot both see the value the turn started with. */
  let spentLive: RulesetLiveStates | null = null;
  /** The context's own live map moves with it, so a second check in the same turn spends from what
   *  the first one left rather than from the value the turn started with. */
  let spendContext: SkillCheckRulesetContext | null = null;
  const onSpend = (key: string, live: RulesetLiveState) => {
    spentLive = { ...(spentLive ?? {}), [key]: live };
    if (spendContext) spendContext.live = { ...spendContext.live, [key]: live };
  };
  /** Set once a ruleset context is in hand, so every rewrite keeps the `who=` it rolled for. */
  // Starts from the hint, so a context that fails to load on ANY path (the pool's included) still
  // saves the sparse ask with the name it was for, instead of handing the check to the player.
  let keepWho = options.rulesetPinned === true;
  // The ask a rewrite keeps when the numbers go: who it was for, and the two per-check freedoms a
  // ruleset may grant. All three are only ever written by a ruleset game, so nothing else changes.
  // Only a SPARSE rewrite uses this: nothing was rolled, so the ask is all there is, and whoever
  // rolls it later should roll it as the Game Master set it. A resolved record is written from the
  // result instead, which holds what the roll actually applied: the ruleset's clamp of the
  // threshold and of the bonus dice, and the other ability only when the swap happened.
  const askExtras = (tag: SkillCheckTag) => {
    if (!keepWho) return undefined;
    const extras = {
      ...(tag.threshold != null && Number.isFinite(tag.threshold) ? { threshold: tag.threshold } : {}),
      ...(tag.who ? { who: tag.who } : {}),
      ...(tag.withAbility ? { with: tag.withAbility } : {}),
      ...(tag.bonusDice != null ? { bonus: tag.bonusDice } : {}),
      ...(tag.difficulty ? { difficulty: tag.difficulty } : {}),
      ...(tag.explode != null ? { explode: tag.explode } : {}),
      ...(tag.double != null ? { double: tag.double } : {}),
      ...(tag.reroll ? { reroll: tag.reroll } : {}),
    };
    return Object.keys(extras).length > 0 ? extras : undefined;
  };
  // A difficulty named by its ladder step is read here, once the ruleset is in hand, so everything
  // after this sees a number. Without the ruleset the ask keeps whatever `dc=` it wrote, which for a
  // tag that named only a step is none, and nothing rolls it.
  const toRequest = (tag: SkillCheckTag, definition?: RulesetDefinition): SkillCheckRequest =>
    readRulesetDifficulty(
      {
        skill: tag.skill,
        ...(tag.dc !== undefined ? { dc: tag.dc } : {}),
        ...(tag.difficulty ? { difficulty: tag.difficulty } : {}),
        ...(tag.explode != null ? { explode: tag.explode } : {}),
        ...(tag.double != null ? { double: tag.double } : {}),
        ...(tag.reroll ? { reroll: tag.reroll } : {}),
        advantage: tag.advantage,
        disadvantage: tag.disadvantage,
        preRolledD20: tag.preRolledD20,
        who: tag.who,
        withAbility: tag.withAbility,
        threshold: tag.threshold,
        bonusDice: tag.bonusDice,
        ...(tag.spend ? { spend: tag.spend } : {}),
        ...(tag.useEntry ? { useEntry: tag.useEntry } : {}),
      },
      definition,
    );
  /** Pool checks the resolver could not roll, written back without the numbers they claimed. */
  const stripped: Array<{ start: number; end: number; replacement: string }> = [];
  let trusted = 0;
  let left = 0;

  /** Splice one replacement per pending tag, in reading order, keeping the prose between them. */
  const rewrite = (replace: (entry: (typeof pending)[number]) => string): string => {
    const edits = [
      ...pending.map((entry) => ({ start: entry.start, end: entry.end, text: () => replace(entry) })),
      ...stripped.map((entry) => ({ start: entry.start, end: entry.end, text: () => entry.replacement })),
    ].sort((a, b) => a.start - b.start);
    let out = "";
    let cursor = 0;
    for (const edit of edits) {
      out += content.slice(cursor, edit.start) + edit.text();
      cursor = edit.end;
    }
    return out + content.slice(cursor);
  };

  try {
    const regex = createSkillCheckTagRegex();
    for (let match = regex.exec(content); match; match = regex.exec(content)) {
      const tag = parseSkillCheckTagBody(match[1] ?? "");
      // Not a check at all (no skill or DC) — leave whatever the model wrote.
      if (!tag) {
        left += 1;
        continue;
      }
      // ── The sighted pool's attachment point ──
      // Placed BEFORE the two short-circuits below on purpose. A pool tag arrives either
      // complete (its own numbers, which are never believed) or sparse with a `rolls=` the
      // sparse path would otherwise adopt as a player-submitted die. Both readers return
      // before any injected roller for exactly the shape the pool prompt asks for, so a
      // branch placed after them would never run at all.
      if (options.pool && tag.poolDeclared && isEngineRollableSkillCheckTag(tag)) {
        const request = boundPoolCheckRequest(tag);
        if (request) {
          pending.push({
            start: match.index,
            end: match.index + match[0].length,
            request,
            tag,
            poolBody: match[1] ?? "",
          });
          continue;
        }
        // Unrollable, and written with `pool=`: whatever numbers it carries are a claim the
        // pool never validated, so the tag is written back without them rather than left as
        // the model wrote it. The ask survives; the claimed outcome does not.
        stripped.push({
          start: match.index,
          end: match.index + match[0].length,
          replacement: stripPoolClaims(match[1] ?? ""),
        });
        logger.debug(
          "[game/skill-check] Dropping the claims off an unrollable pool check for chat %s",
          options.chatId ?? "unknown",
        );
        left += 1;
        continue;
      }
      if (options.rulesetPinned) {
        deferred.push({ start: match.index, end: match.index + match[0].length, tag });
        continue;
      }
      if (tag.resolvedResult) {
        trusted += 1;
        left += 1;
        continue;
      }
      // A system this engine does not implement — a success pool, or a die that is
      // not the d20 the resolver throws. Its numbers did not survive the audit (or
      // it never wrote any), but rolling a d20 here would not repair the tag, it
      // would replace the GM's rules with ours in the text about to be saved.
      if (!isEngineRollableSkillCheckTag(tag)) {
        logger.debug(
          "[game/skill-check] Leaving a check the engine does not roll for chat %s (resolution=%s dice=%s)",
          options.chatId ?? "unknown",
          tag.declaredResolution ?? "none",
          tag.declaredDice ?? "none",
        );
        left += 1;
        continue;
      }
      // A difficulty named by its ladder step, with no number beside it, needs a ruleset's ladder to
      // mean anything, and this game has none. Left exactly as written.
      if (tag.dc === undefined) {
        logger.debug(
          "[game/skill-check] Leaving a check that names only a difficulty unresolved for chat %s",
          options.chatId ?? "unknown",
        );
        left += 1;
        continue;
      }
      const request: SkillCheckRequest = {
        skill: tag.skill,
        dc: tag.dc,
        advantage: tag.advantage,
        disadvantage: tag.disadvantage,
        preRolledD20: tag.preRolledD20,
      };
      if (!isResolvableSkillCheckRequest(request)) {
        logger.debug(
          "[game/skill-check] Leaving out-of-bounds check tag unresolved for chat %s (dc=%d)",
          options.chatId ?? "unknown",
          tag.dc,
        );
        left += 1;
        continue;
      }
      pending.push({ start: match.index, end: match.index + match[0].length, request, tag });
    }

    let loadedContext: SkillCheckModifierContext | null = null;
    if (deferred.length > 0) {
      try {
        loadedContext = await options.loadContext();
      } catch (err) {
        // The ruleset could not be loaded, so nothing can vouch for these tags. Every check the
        // ruleset might have rolled goes back sparse through the catch below; a tag that names
        // another system outright is left exactly as written.
        for (const entry of deferred) {
          if (entry.tag.declaredResolution != null && entry.tag.declaredResolution !== "sum") left += 1;
          else pending.push({ start: entry.start, end: entry.end, request: toRequest(entry.tag), tag: entry.tag });
        }
        keepWho = true;
        throw err;
      }
      // A check that names an entry needs the ruleset's catalogs, and nothing else on this path
      // does, so they are fetched here and only here. A failure costs the effect, never the turn.
      if (loadedContext.ruleset && options.loadCatalogs && deferred.some((entry) => entry.tag.useEntry)) {
        try {
          loadedContext.ruleset.catalogs = await options.loadCatalogs();
        } catch (err) {
          logger.warn(err, "[game/skill-check] Could not read the catalogs for chat %s", options.chatId ?? "unknown");
        }
      }
      const ruleset = loadedContext.ruleset;
      keepWho = !!ruleset;
      for (const entry of deferred) {
        const { tag } = entry;
        const request = toRequest(tag, ruleset?.definition);
        const owesRoll = ruleset
          ? !rulesetVouchesFor(ruleset, tag) && isRulesetRollableSkillCheckTag(tag, ruleset.definition)
          : !tag.resolvedResult && isEngineRollableSkillCheckTag(tag);
        if (owesRoll && isResolvableSkillCheckRequest(request, ruleset?.definition)) {
          pending.push({ start: entry.start, end: entry.end, request, tag });
        } else if (owesRoll && tag.resolvedResult) {
          // This ruleset's own kind of check, carrying numbers the sheet does not vouch for, that
          // cannot be rolled either (an out-of-bounds DC, say). The ask survives; the claimed
          // outcome does not, exactly as a roll that could not happen is saved.
          stripped.push({
            start: entry.start,
            end: entry.end,
            replacement: serializeSparseSkillCheckTag(
              {
                skill: tag.skill,
                dc: tag.dc,
                advantage: tag.advantage,
                disadvantage: tag.disadvantage,
                declaredDice: tag.declaredDice,
              },
              askExtras(tag),
            ),
          });
          left += 1;
        } else {
          if (tag.resolvedResult) trusted += 1;
          left += 1;
        }
      }
    }

    if (pending.length === 0) {
      if (stripped.length === 0) return { content, resolved: 0, trusted, left, sparse: 0 };
      return { content: rewrite(() => ""), resolved: 0, trusted, left, sparse: stripped.length };
    }

    const context = loadedContext ?? (await options.loadContext());
    keepWho = !!context.ruleset;
    spendContext = context.ruleset ?? null;
    const results: SkillCheckResult[] = [];
    // The pool holds d20s. A ruleset that rolls anything else gets an ordinary Engine roll for its
    // checks, so a pool value is never spent on, or recorded against, a roll it did not decide.
    // That covers both other shapes: a `dice-sum` ruleset whose dice are not one d20, and a
    // `dice-pool` ruleset, which throws a handful of its own die and would otherwise be handed a
    // d20 face to count as one of them.
    const rulesetResolution = context.ruleset?.definition.resolution;
    const poolServesChecks =
      !rulesetResolution ||
      (rulesetResolution.kind === "dice-sum" &&
        rulesetResolution.dice.count === 1 &&
        rulesetResolution.dice.sides === 20);
    let poolTagIndex = 0;
    // Pool checks the allotment could not serve. Saved sparse, so they are counted with the
    // sparse tags rather than the resolved ones: a caller reading `resolved` as "rolled"
    // would otherwise count a check that has no number yet.
    let overflowed = 0;
    // Pool checks that named only a ladder step nobody here has. Saved sparse, like an overflow.
    let unread = 0;
    const rolled = rewrite((entry) => {
      // A pool check bound before the ruleset was loaded may have named its difficulty by a ladder
      // step; it is read now, with the ruleset in hand, so the pool serves it like any other check.
      const request =
        entry.poolBody != null ? readRulesetDifficulty(entry.request, context.ruleset?.definition) : entry.request;
      if (request.dc === undefined) {
        unread += 1;
        return serializeSparseSkillCheckTag(
          {
            skill: request.skill,
            advantage: request.advantage,
            disadvantage: request.disadvantage,
            declaredDice: entry.tag.declaredDice,
          },
          askExtras(entry.tag),
        );
      }
      if (entry.poolBody != null && options.pool && poolServesChecks) {
        // A ruleset that has no advantage rolls one die whatever the tag asked for, so only one
        // pool value may be reserved and recorded for it.
        const poolRequest =
          rulesetResolution && rulesetResolution.kind === "dice-sum" && !rulesetResolution.advantage
            ? { ...request, advantage: false, disadvantage: false }
            : request;
        const spent = resolvePoolCheckTag(options.pool, context, poolRequest, entry.tag, entry.poolBody, poolTagIndex);
        poolTagIndex += 1;
        if (spent) {
          results.push(spent.result);
          return spent.record;
        }
        // Overflow: no value exists, so nothing is written. The ask is kept, every number
        // is dropped, and the outcome is owed to the next turn — never a second request.
        overflowed += 1;
        return serializeSparseSkillCheckTag(
          {
            skill: request.skill,
            dc: entry.request.dc,
            advantage: request.advantage,
            disadvantage: request.disadvantage,
            declaredDice: entry.tag.declaredDice,
          },
          askExtras(entry.tag),
        );
      }
      const result = resolveSkillCheckWithContext(context, request, options.rollD20, onSpend);
      results.push(result);
      // The result carries what the roll applied (who, the other ability, the dice added), so a
      // saved turn says exactly that. None of it is set outside a ruleset game, byte for byte.
      return serializeResolvedSkillCheckTag(result);
    });
    return {
      content: rolled,
      results,
      resolved: pending.length - overflowed - unread,
      trusted,
      left: left + overflowed + unread,
      sparse: overflowed + unread + stripped.length,
      ...(spentLive ? { live: spentLive } : {}),
    };
  } catch (err) {
    // The log itself must not be a second way to fail: a rejected value with a
    // throwing getter would otherwise escape this catch and take the turn down.
    try {
      logger.error(
        err,
        "[game/skill-check] Could not roll %d check tag(s) for chat %s; saving them sparse rather than as written",
        pending.length,
        options.chatId ?? "unknown",
      );
    } catch {
      logger.error(
        "[game/skill-check] Could not roll %d check tag(s); the failure also refused to serialize",
        pending.length,
      );
    }
    // Nothing was found to owe a roll before this failed, so there is nothing to
    // strip and the text stands as the model wrote it — the same outcome the
    // caller's own catch used to reach, kept only for the case where this
    // function never got far enough to know better.
    if (pending.length === 0) {
      if (stripped.length === 0) return { content, resolved: 0, trusted, left, sparse: 0 };
      return { content: rewrite(() => ""), resolved: 0, trusted, left, sparse: stripped.length };
    }
    // Otherwise: pure string work over tags already parsed above, so the honest
    // path cannot fail its way back into saving the model's numbers.
    const honest = rewrite((entry) =>
      serializeSparseSkillCheckTag(
        {
          skill: entry.request.skill,
          dc: entry.request.dc,
          advantage: entry.request.advantage,
          disadvantage: entry.request.disadvantage,
          preRolledD20: entry.request.preRolledD20,
          declaredDice: entry.tag.declaredDice,
        },
        askExtras(entry.tag),
      ),
    );
    return {
      content: honest,
      resolved: 0,
      trusted,
      left: left + pending.length,
      sparse: pending.length + stripped.length,
    };
  }
}

/** The attributes a check tag keeps when its numbers are dropped: the ask, never the answer. */
const POOL_CLAIM_KEPT_ATTRIBUTES = new Set([
  "skill",
  "dc",
  "difficulty",
  "mode",
  "dice",
  "resolution",
  "threshold",
  "explode",
  "double",
  "reroll",
]);

/**
 * Write an unrollable pool check back without the numbers the model claimed for it.
 *
 * The attributes that describe the ask are kept exactly as written; `rolls=`, `used=`,
 * `modifier=`, `total=`, `result=` and `pool=` are dropped, so nothing the pool never
 * validated reaches the saved turn. The resolver cannot roll the tag, so this is the one
 * honest shape left for it: an ask with no answer, which the next turn narrates blind.
 */
export function stripPoolClaims(body: string): string {
  const kept = readGmTagAttributes(body)
    .filter((attribute) => POOL_CLAIM_KEPT_ATTRIBUTES.has(attribute.key.toLowerCase()))
    .map((attribute) => `${attribute.key}=${attribute.rawValue}`);
  return `[skill_check: ${kept.join(" ")}]`;
}

/**
 * A pool check's request, with the DC bounded rather than the tag refused.
 *
 * The numeric bound does not exist today for a written tag: `isResolvableSkillCheckRequest`
 * is only applied to tags entering the roll list, and a tag the reader trusted never gets
 * there. Under the pool the model chooses the DC after seeing the die, which makes an
 * unbounded DC the sharpest of its freedoms, so the bound is restored here — as a clamp
 * rather than a refusal, because refusing would leave the ask unrolled for a number the
 * model wrote rather than for anything the engine could not do.
 *
 * Returns null only for a skill this path would never roll at all.
 */
export function boundPoolCheckRequest(tag: SkillCheckTag): SkillCheckRequest | null {
  if (!tag.skill || tag.skill.length > SKILL_CHECK_MAX_SKILL_LENGTH) return null;
  // A difficulty named only by its ladder step has no number yet. It is read off the ladder when the
  // pool is spent, which is after the ruleset is loaded; a tag with neither has nothing to roll against.
  if (tag.dc === undefined && !tag.difficulty) return null;
  // ponytail: the pool clamps to the Engine's own DC bounds even in a ruleset game whose ladder
  // reaches further, because the pool is bound before the ruleset is loaded. Widen it if a ruleset
  // with a wider ladder is ever played with the sighted pool on.
  const dc =
    tag.dc === undefined ? undefined : Math.min(SKILL_CHECK_MAX_DC, Math.max(SKILL_CHECK_MIN_DC, Math.round(tag.dc)));
  return {
    skill: tag.skill,
    ...(dc !== undefined ? { dc } : {}),
    advantage: tag.advantage,
    disadvantage: tag.disadvantage,
    // Read only by a ruleset game; the Engine's own rules ignore them and write the same bytes.
    // The three per-check freedoms ride along so the roll applies exactly what the record will
    // say it applied, whether the pool serves the check or the Engine rolls it blind.
    who: tag.who,
    withAbility: tag.withAbility,
    threshold: tag.threshold,
    bonusDice: tag.bonusDice,
    // The step a difficulty was named by still sets a pool's target, and the faces a check moved
    // are the same ask, so whichever path rolls it rolls what the tag asked for.
    ...(tag.difficulty ? { difficulty: tag.difficulty } : {}),
    ...(tag.explode != null ? { explode: tag.explode } : {}),
    ...(tag.double != null ? { double: tag.double } : {}),
    ...(tag.reroll ? { reroll: tag.reroll } : {}),
    // Deliberately no `preRolledD20`: under the pool a number in `rolls=` is the model's
    // claim about a slot, not a die the player threw, and adopting it would be obeying
    // the one field the authority rule says is never obeyed.
  };
}

/**
 * Spend the pool for one d20 check and re-derive every number in its record.
 *
 * The engine COMPUTES the record here rather than checking it. It spends the next
 * unconsumed d20 value in reading order — two under advantage or disadvantage, which is
 * the same count the shipped roller throws — applies the sheet modifier through the same
 * resolver every other check uses, and re-serializes. What the model wrote in `pool=` and
 * `rolls=` is compared against what was spent and recorded as a mismatch, and never obeyed.
 *
 * Null means overflow: the allotment is exhausted and no value exists. The caller writes
 * the tag back sparse; nothing is invented and no second request is made.
 */
export function resolvePoolCheckTag(
  pool: GameDicePoolSession,
  context: SkillCheckModifierContext,
  request: SkillCheckRequest,
  tag: SkillCheckTag,
  /** The tag body as written, so the audit can read the model's own `rolls=`. */
  body: string,
  tagIndex: number,
): { result: SkillCheckResult; record: string } | null {
  const needed = request.advantage !== request.disadvantage && (request.advantage || request.disadvantage) ? 2 : 1;
  const spent = pool.spend("d20", needed, tagIndex);
  if (!spent) {
    pool.recordOverflow("no d20 value left", `${tag.skill} dc=${request.dc}`);
    return null;
  }

  const queue = spent.map((entry) => entry.value);
  let cursor = 0;
  const result = resolveSkillCheckWithContext(context, request, () => queue[cursor++] ?? queue[queue.length - 1]!);
  pool.audit(spent, {
    // The raw name is carried even when it did not parse, because "written and
    // unreadable" is the same disagreement as "written and wrong".
    ...(tag.poolRaw !== undefined ? { rawPool: tag.poolRaw } : {}),
    ...(tag.poolSlots ? { slots: tag.poolSlots.slots } : {}),
    // The model's OWN `rolls=`, read straight from the body: the result's rolls are the
    // engine's, so comparing those against themselves would never find an invented number.
    values: readClaimedRolls(body),
  });
  logPoolDcFit(pool, result.dc, result.usedRoll, result.modifier);
  return {
    result,
    record: serializeResolvedSkillCheckTag(result, {
      pool: formatPoolSlotName(
        "d20",
        spent.map((entry) => entry.slot),
      ),
    }),
  };
}

/** The numbers the model wrote in `rolls=`, for the pool audit. Never used as a roll. */
function readClaimedRolls(body: string): number[] {
  const raw = readGmTagAttributes(body).find((attribute) => attribute.key.toLowerCase() === "rolls")?.rawValue;
  if (!raw) return [];
  return raw
    .trim()
    .replace(/^["']|["']$/g, "")
    .split(/[|,]/)
    .map((entry) => Number.parseInt(entry.trim(), 10))
    .filter((entry) => Number.isFinite(entry));
}
