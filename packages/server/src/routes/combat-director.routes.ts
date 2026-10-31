import { createGameStateStorage, parseStoredRulesetLive } from "../services/storage/game-state.storage.js";
import {
  normalizeGameDifficulty,
  COMBAT_START_PLACES,
  COMBAT_ADJECTIVES,
  DECISION_TIMEOUT_MS,
  combatWeatherSchema,
  applyGameInventoryOps,
  applyRulesetFightItemChanges,
  gameInventoryCountItems,
  gameInventoryItemsOwnNamed,
  gameInventoryKeptByCurse,
  gameInventoryUsableStack,
  drawGameInventoryFightItem,
  normalizeGameInventoryStacks,
  rulesetFightItemChanges,
  rulesetCarriedLeft,
  gameWorldElementSet,
  worldElementSetSchema,
  WORLD_DEFAULT_BATTLEFIELDS,
  gameWorldBattlefields,
  worldSceneLike,
  type CombatItemEffect,
} from "@marinara-engine/shared";
import {
  applyGameInventoryChangeHeld,
  loadGameFightItems,
  loadGameFightUseEffects,
  loadGameInventoryItemBook,
} from "../services/game/game-inventory.service.js";
import { resolveCombatWeather } from "../services/game/weather.service.js";
import { gameClockMinutes } from "../services/game/time.service.js";
import { addGameLoot, planGameVictoryLoot } from "../services/game/game-loot.service.js";
import { rollDieSecurely } from "../services/game/dice-rng.js";
import { rollGameFightItemGate } from "../services/game/game-item-use.service.js";
import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  assignCombatTactics,
  TERRAIN_DATA,
  tacticalOutsideValid,
  combatBossSchema,
  combatInterruptFields,
  combatOrdersSchema,
  type CombatOrders,
  normalizeCharacterLookupName,
  combatTacticsSchema,
  combatAiHintsSchema,
  rulesetBestiarySheetCatalogIds,
  rulesetCardHolder,
  rulesetCardItems,
  rulesetReadsItems,
  rulesetCatalogIdsForBuild,
  rulesetCellBlocked,
  rulesetSheetBuildsByName,
  rulesetBudgetLevel,
  rulesetBudgetStandIns,
  rulesetSheetDead,
  rulesetEncounterBudget,
  type Combatant,
  type DirectedCombatView,
  type DirectedCommand,
  type RulesetCatalogEntriesById,
  type RulesetDefinition,
  type RulesetLiveStates,
} from "@marinara-engine/shared";
import { createCharactersStorage } from "../services/storage/characters.storage.js";
import { createChatsStorage, withChatMetadataPatchQueue } from "../services/storage/chats.storage.js";
import { createGameEngineStateStorage } from "../services/storage/game-engine-state.storage.js";
import {
  createCombatDirector,
  combatDirectorView,
  commandCombatDirector,
  type CombatDirectorState,
} from "../services/game/combat-director.service.js";
import { chooseGmCombatOption } from "../services/game/combat-boss.service.js";
import {
  commandRulesetCombatDirector,
  rulesetDecisionUnderWindow,
  createRulesetFight,
  directedRulesetView,
  releaseRulesetHeldGround,
  rulesetBeginFight,
  rulesetCommandRefusal,
  rulesetCompanionIds,
  rulesetDeployers,
  rulesetUnitPlayer,
  RULESET_ROOM_HOST,
  type RulesetFightCommander,
  rulesetDirectorStage,
  rulesetFightLiveStates,
  rulesetFightReturningFoes,
  rulesetBringBackFoe,
  rulesetReturningFoeKey,
  rulesetReturningFoeMarked,
  rulesetReturningFoeReworded,
  syncRulesetCombatants,
  RULESET_COMBAT_EVENT_LIMIT,
  RULESET_COMBAT_REASON_LIMIT,
  type RulesetFightState,
  type RulesetReturningFoe,
} from "../services/game/ruleset-combat-director.service.js";
import { loadRulesetRegistry, resolveGameRuleset } from "../services/game/ruleset-registry.service.js";
import { loadRulesetCatalogEntries } from "../services/game/ruleset-catalog.service.js";
import { resolveTacticalStartPreferences } from "../services/game/tactical-battlefield.service.js";
import { gameBattlefieldHere } from "../services/game/made-battlefield.service.js";
import { checkStoryItemUse, keepStorySpendWhile, storyUseOfOption } from "../services/game/story-item-uses.service.js";
import {
  heldGroundReleaseDueInFight,
  keepHeldGroundReleasedWhile,
} from "../services/game/story-held-ground.service.js";
import { gameNoncombatants, gamePartyLevel } from "../services/game/experience-companions.service.js";
import {
  latestStoryFight,
  latestStoryFightAdjusts,
  latestStoryHeldGround,
  storyFightAdjustsFor,
} from "../services/game/story-fight.service.js";
import { buildPartyNpcId } from "../services/generation/game-party-utils.js";
import { gamePartyRoster } from "../services/game/ruleset-sheet-turn.service.js";
import {
  ROOM_GUEST_FIGHT_CONTROLLER,
  roomFightPlayers,
  roomPlayersByName,
} from "../services/multiplayer/fight-players.js";
import { logger } from "../lib/logger.js";
import { resolveVisibleGameStateAnchor } from "./generate/generate-route-utils.js";

/** Where a chat keeps who plays each of its party in a fight (the player or the Engine). */
const COMBAT_CONTROLLERS_KEY = "combatControllers";

/** Where a chat keeps the standing orders the player gave each companion, for its next fights too
 *  (laptop playtest 2026-10-25: orders set back to none at every fight). */
const COMBAT_ORDERS_KEY = "combatOrders";

function rememberedOrders(meta: Record<string, unknown>): Record<string, CombatOrders> {
  const kept = meta[COMBAT_ORDERS_KEY];
  if (!kept || typeof kept !== "object" || Array.isArray(kept)) return {};
  return Object.fromEntries(
    Object.entries(kept as Record<string, unknown>).flatMap(([id, orders]) => {
      const parsed = combatOrdersSchema.safeParse(orders);
      return parsed.success ? [[id, parsed.data] as const] : [];
    }),
  );
}

function rememberedControllers(meta: Record<string, unknown>): Record<string, "manual" | "ai"> {
  const kept = meta[COMBAT_CONTROLLERS_KEY];
  if (!kept || typeof kept !== "object" || Array.isArray(kept)) return {};
  return Object.fromEntries(
    Object.entries(kept as Record<string, unknown>).filter(
      (entry): entry is [string, "manual" | "ai"] => entry[1] === "manual" || entry[1] === "ai",
    ),
  );
}

// Host-owned Experience namespace: existing branch/checkpoint/export paths preserve these rows,
// while turn-game readers and resets already exclude the entire experience: prefix.
export const COMBAT_DIRECTOR_NAMESPACE = "experience:marinara-engine.combat";
/** The most rounds anything in a fight counts down from. */
const COMBAT_DIRECTOR_MOST_ROUNDS = 100;
/** The most power an item's effect is read at. */
const COMBAT_DIRECTOR_MOST_POWER = 100;
const key = z
  .string()
  .min(1)
  .max(256)
  .refine((v) => !["__proto__", "constructor", "prototype"].includes(v));
const num = z.number().finite().min(0).max(1000000);
/** A count of rounds carried in from the story: a potion that lasts an hour is 600 of them. More than
 *  a fight's most is the rest of the fight, never a reason to refuse the fight. */
const rounds = z
  .number()
  .int()
  .min(0)
  .transform((value) => Math.min(value, COMBAT_DIRECTOR_MOST_ROUNDS));
const slots = z.record(z.string().regex(/^[1-9]$/), z.number().int().min(0).max(100));
const skill = z.object({
  id: key,
  name: z.string().min(1).max(200),
  // A word the Engine has none of is an attack, never a refused fight (laptop playtest 2026-10-25).
  type: z.enum(["attack", "heal", "buff", "debuff"]).catch("attack"),
  mpCost: num,
  power: num.max(20),
  cooldown: rounds.optional(),
  description: z.string().max(3000).optional(),
  element: z.string().max(100).optional(),
  statusEffect: z.string().max(200).optional(),
  ...combatInterruptFields,
});
const directedCombatantFields = z.object({
  id: key,
  name: z.string().min(1).max(200),
  side: z.enum(["player", "enemy"]),
  /** Caught unaware as the fight begins: a ruleset fight reads it (1.237), and elsewhere an opponent caught so checks its morale first (combat AI E1). */
  surprised: z.boolean().optional(),
  /** Fights in its own lair (1.315): read by a ruleset fight only. */
  inLair: z.boolean().optional(),
  /** Where the Game Master starts it on the board (2026-10-24): read by a ruleset fight only. */
  start: z.enum(COMBAT_START_PLACES).optional().catch(undefined),
  /** What it set up before the fight, standing as it begins (1.462): read by a ruleset fight only. */
  standing: z
    .array(
      z
        .object({
          entry: z.string().min(1).max(200),
          at: z.enum(["self", "between"]).optional().catch(undefined),
          stores: z.string().min(1).max(200).optional(),
          on: z.array(z.string().min(1).max(200)).max(12).optional(),
          kind: z.string().min(1).max(80).optional(),
          mode: z.string().min(1).max(200).optional(),
          into: z.string().min(1).max(200).optional(),
          spares: z.array(z.string().min(1).max(80)).max(8).optional(),
          tag: z.string().min(1).max(80).optional(),
          kinds: z.array(z.string().min(1).max(80)).max(16).optional(),
        })
        .strict(),
    )
    .max(6)
    .optional(),
  hp: num,
  maxHp: num.min(1),
  mp: num.optional(),
  maxMp: num.optional(),
  attack: num,
  defense: num,
  speed: num,
  level: num.min(1),
  boss: combatBossSchema.optional(),
  spellSlots: slots.optional(),
  skills: z.array(skill).max(64).optional(),
  tactics: combatTacticsSchema.optional(),
  aiHints: combatAiHintsSchema.optional(),
  controller: z.enum(["manual", "ai"]).optional().catch(undefined),
  orders: combatOrdersSchema.optional(),
  skillCooldowns: z.record(z.string(), rounds).optional(),
  statusEffects: z
    .array(
      z.object({
        name: z.string().max(200),
        modifier: z.number().finite().min(-100000).max(100000),
        stat: z.enum(["hp", "attack", "defense", "speed"]).catch("attack"),
        turnsLeft: rounds,
      }),
    )
    .max(64)
    .optional(),
  projectile: z.boolean().optional(),
  requiresSight: z.boolean().optional(),
  combatClass: z.string().max(100).optional(),
  movementMode: z.enum(["walk", "fly", "teleport"]).optional().catch(undefined),
  element: z.string().max(100).optional(),
  sprite: z.string().max(3000).optional(),
});
const resourcePools = (v: { hp: number; maxHp: number; mp?: number; maxMp?: number }) =>
  v.hp <= v.maxHp && (v.mp ?? 0) <= (v.maxMp ?? v.mp ?? 0);
export const directedCombatantSchema = directedCombatantFields.refine(resourcePools, "Invalid resource pool.");
/** An opponent of a ruleset fight. The Engine's own numbers still ride along, because the recap,
 *  the journal and the client's own end-of-battle path read them; what the fight is RESOLVED by is
 *  the creature, the tier or the proposal beside them, and the server decides which. */
const rulesetOpponentSchema = directedCombatantFields
  .extend({
    creature: z.string().min(1).max(200).optional(),
    /** What an invented one is, by the ruleset's creature type id. */
    creatureType: z.string().min(1).max(80).optional(),
    tier: key.optional(),
    /** A stat block in the shared creature form. Checked when the fight is built, so a malformed
     *  one costs its opponent its proposal rather than costing the whole battle. */
    proposed: z.unknown().optional(),
    /** What the Game Master gave it to have on it (1.795): the ruleset's items, one a line, by name
     *  or reference; read when the fight is built, and one it has no such item of is told. */
    carrying: z.array(z.string().min(1).max(200)).max(16).optional(),
  })
  .refine(resourcePools, "Invalid resource pool.");
const coord = z.object({ x: z.number().int().min(0).max(63), y: z.number().int().min(0).max(63) });
const itemEffect = z.object({
  name: key,
  target: z.enum(["self", "ally", "enemy", "any"]).catch("any"),
  type: z.enum(["heal", "damage", "buff", "debuff", "status", "utility"]).catch("utility"),
  description: z.string().max(3000),
  // An item's power past the most a fight reads is that most, as a long duration is.
  power: num.transform((value) => Math.min(value, COMBAT_DIRECTOR_MOST_POWER)).optional(),
  element: z.string().max(100).optional(),
  consumes: z.boolean().optional(),
  status: z
    .object({
      name: key,
      emoji: z.string().max(30),
      // A status carried in from the story may have run down to 0 turns; it is applied for the
      // default length, as a missing one is.
      duration: rounds,
      modifier: z.number().finite().min(-100000).max(100000).optional(),
      stat: z.enum(["hp", "attack", "defense", "speed"]).optional().catch(undefined),
    })
    .optional(),
});
const classicAction = z.discriminatedUnion("type", [
  z.object({ type: z.literal("item"), itemId: key, targetId: key.optional() }),
  z.object({ type: z.literal("attack"), targetId: key }),
  z.object({ type: z.literal("skill"), skillId: key, targetId: key }),
  z.object({ type: z.literal("defend") }),
  z.object({ type: z.literal("flee") }),
]);
const tacticalAction = z.discriminatedUnion("type", [
  z.object({ type: z.literal("attack"), unitId: key, targetId: key, to: coord.optional() }),
  z.object({
    type: z.literal("skill"),
    unitId: key,
    skillName: z.string().max(200),
    targetId: key,
    to: coord.optional(),
  }),
  z.object({ type: z.literal("item"), unitId: key, itemName: key, targetId: key, to: coord.optional() }),
  z.object({ type: z.literal("move"), unitId: key, to: coord }),
  z.object({ type: z.literal("defend"), unitId: key, to: coord.optional() }),
  z.object({ type: z.literal("wait"), unitId: key, to: coord.optional() }),
  z.object({ type: z.literal("endTurn") }),
  z.object({ type: z.literal("flee") }),
]);
const command = z.discriminatedUnion("type", [
  z.object({ type: z.literal("begin"), unitId: key }),
  z.object({ type: z.literal("classic"), action: classicAction }),
  z.object({ type: z.literal("tactical"), action: tacticalAction }),
  z.object({
    type: z.literal("ruleset"),
    optionId: key,
    targetIds: z.array(key).max(20),
    payWith: key.optional(),
    style: key.optional(),
    /** The weapon's mode, checked against the menu by the resolver. */
    mode: key.optional(),
    /** Where the `move` option walks to, and the cell a shape is aimed at. Both are checked against
     *  the menu by the resolver; this only bounds them to a board's own size. */
    to: coord.optional(),
    at: coord.optional(),
    /** How a wall is laid (1.177) and where further copies go (1.178), checked by the resolver. */
    toward: coord.optional(),
    side: z.enum(["near", "far"]).optional(),
    ring: z.boolean().optional(),
    also: z.array(coord).max(9).optional(),
    /** A wall's section struck at instead of a creature (1.200), checked by the resolver. */
    wall: coord.optional(),
    /** A lasting area ended instead of a creature (1.427), checked by the resolver. */
    dispel: z.object({ casterId: key, actionId: key }).strict().optional(),
    /** A condition struck at to cut it away (1.531), checked against the menu by the resolver. */
    cut: z.object({ holderId: key, condition: key }).strict().optional(),
    /** Which of its target's conditions it ends (1.427), checked by the resolver. */
    ends: z.array(key).max(16).optional(),
    /** Who goes along on a teleport (1.276), checked against the menu by the resolver. */
    carries: z.array(key).max(8).optional(),
    /** Whom a layered wall spares (1.492), checked against the menu by the resolver. */
    designates: z.array(key).max(20).optional(),
    /** The kinds its zone strikes (1.753), checked against the menu by the resolver. */
    kinds: z.array(key).max(40).optional(),
    /** Stored instead of done (1.524), in a place the menu offers, checked by the resolver. */
    storesIn: z
      .object({ holderId: key, item: z.number().int().min(0).max(500).optional() })
      .strict()
      .optional(),
    /** How many uses it spends (1.251), checked against the menu by the resolver. */
    amount: z.number().int().min(1).max(1000).optional(),
    /** How many levels up a target moved to `to` is lifted (1.565), checked by the resolver. */
    rises: z.number().int().min(0).max(100).optional(),
    /** The alterations it is used with (1.253), checked against the action by the resolver. */
    alters: z.array(z.string().min(1).max(200)).max(8).optional(),
    /** Who of its user's side it spares (1.254), checked against the alterations by the resolver. */
    spares: z.array(z.string().min(1).max(200)).max(20).optional(),
    /** Who it heightens (1.255), checked against the alterations by the resolver. */
    heightens: z.string().min(1).max(200).optional(),
  }),
  z.object({ type: z.literal("choose"), candidateId: key }),
  z.object({ type: z.literal("deploy"), unitId: key, to: coord }),
  z.object({ type: z.literal("deployed") }),
  z.object({ type: z.literal("continue") }),
  z.object({ type: z.literal("fallback") }),
  z.object({ type: z.literal("flee") }),
  z.object({ type: z.literal("yield") }),
  z.object({ type: z.literal("control"), unitId: key, controller: z.enum(["manual", "ai"]) }),
  z.object({ type: z.literal("controlCompanions"), controller: z.enum(["manual", "ai"]) }),
  /** A carried weapon or shield taken in hand, and the stack a weapon shoots first (2026-10-26), by
   *  places in the party member's items: checked against what they carry by the resolver. */
  z.object({ type: z.literal("draw"), unitId: key, item: z.number().int().min(0).max(10000) }),
  z.object({
    type: z.literal("ammo"),
    unitId: key,
    weapon: z.number().int().min(0).max(10000),
    stack: z.number().int().min(0).max(10000),
  }),
  z.object({ type: z.literal("orders"), unitId: key, orders: combatOrdersSchema.nullable() }),
  z.object({ type: z.literal("spends"), choose: z.boolean() }),
]);
const queues = new Map<string, Promise<unknown>>();
async function serialized<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const previous = queues.get(key) ?? Promise.resolve();
  const run = previous.catch(() => {}).then(fn);
  queues.set(key, run);
  try {
    return await run;
  } finally {
    if (queues.get(key) === run) queues.delete(key);
  }
}
/** What a ruleset fight is resolved by, or the plain sentence saying why it cannot be. */
type RulesetSession = { definition: RulesetDefinition; packageId: string | null } | { unavailable: string };

/** The creatures a fight may meet, and the catalogs their sheets read their lists out of. A creature
 *  described by a sheet takes its spells or tricks from the ruleset's other catalogs, the way a
 *  character does, so those are loaded too; a bestiary with no sheets in it loads nothing more. A
 *  Game Master's invented sheet names its rows rather than marking them, so every catalog feeding a
 *  list one of those fills is loaded for it as well. */
async function loadBestiary(
  packageId: string | null,
  definition: RulesetDefinition,
  proposedLists: ReadonlySet<string>,
): Promise<RulesetCatalogEntriesById> {
  const creatures = await loadFightCatalogs(packageId, definition, (c) => c.holds === "creatures");
  const marked = new Set(rulesetBestiarySheetCatalogIds(definition, creatures));
  // A proposal that sets fields reads them off the entries that set them (a class), whatever list
  // those feed (cloud re-test 2026-10-25: an invented Cleric 5 never loaded the classes catalog), so
  // every catalog of rows is loaded for it.
  const wanted = (c: NonNullable<RulesetDefinition["catalogs"]>[number]) =>
    marked.has(c.id) ||
    (c.feeds ?? []).some((list) => proposedLists.has(list)) ||
    (proposedLists.has(RULESET_PROPOSED_FIELDS) && c.holds !== "items" && c.holds !== "creatures");
  if (marked.size === 0 && proposedLists.size === 0) return creatures;
  return { ...creatures, ...(await loadFightCatalogs(packageId, definition, wanted)) };
}

/** Among `proposedSheetLists`: some proposal sets fields, so the entries that set them are wanted. No
 *  list id has a colon in it. */
const RULESET_PROPOSED_FIELDS = ":fields";

/** The lists the Game Master's invented sheets fill, read off the raw proposals: which catalogs a
 *  fight needs is decided before any proposal is parsed. Every list a creature CHOOSES from is among
 *  them too, whether a proposal wrote it or not, because its open choices are filled from there. */
export function proposedSheetLists(
  definition: RulesetDefinition,
  enemies: ReadonlyArray<{
    proposed?: unknown;
    attacks?: ReadonlyArray<{ reaction?: unknown; kind?: unknown; spell?: unknown }>;
    /** The Game Master's own skills, which become its attacks: one not an attack is a kind. */
    skills?: ReadonlyArray<{ reaction?: unknown; type?: unknown; spell?: unknown }>;
  }>,
): Set<string> {
  const lists = new Set<string>();
  for (const given of enemies) {
    // Read as the fight reads them (cloud re-test 2026-10-26: a Cult Healer written with skills had
    // no class list loaded, so its Cure Wounds was dropped as beyond its sheet).
    const enemy = {
      ...given,
      attacks: [
        ...(given.attacks ?? []),
        ...(given.skills ?? []).map((skill) => ({
          reaction: skill.reaction,
          kind: skill.type !== "attack" ? skill.type : undefined,
          spell: skill.spell,
        })),
      ],
    };
    // A reaction it was given by name may be an entry of the ruleset's own (a Counterspell that is a
    // spell), read off whichever list that entry's catalog feeds; and so may a spell or a feature
    // written beside the attacks of one with no sheet, which it is given a sheet for, with a class.
    // One written with numbers and no sheet is given one as well (laptop pass 6 2026-10-26).
    const proposedSheet = (enemy.proposed as { sheet?: unknown } | undefined)?.sheet;
    const sheetless =
      (enemy.proposed === undefined || proposedSheet === undefined) &&
      !!enemy.attacks?.some((attack) => attack.kind || attack.spell);
    if (sheetless || enemy.attacks?.some((attack) => attack.reaction))
      for (const list of definition.sheet.lists) lists.add(list.id);
    if (sheetless) {
      lists.add(RULESET_PROPOSED_FIELDS);
      for (const catalog of definition.catalogs ?? [])
        if (catalog.holds !== "items" && catalog.holds !== "creatures")
          for (const list of catalog.feeds ?? []) lists.add(list);
    }
    const sheet = (enemy.proposed as { sheet?: { lists?: unknown } } | undefined)?.sheet;
    if (!sheet || typeof sheet !== "object") continue;
    if (sheet.lists && typeof sheet.lists === "object") for (const id of Object.keys(sheet.lists)) lists.add(id);
    // A level it gives itself is read off the entry that sets it (a class), which may set more.
    const fields = (sheet as { fields?: unknown }).fields;
    // A parsed catalog of rows says so (`holds: "rows"`), so it is told apart from items and creatures.
    // One with rows and no fields may be given a class to cast them (cloud re-test 2026-10-25), so it
    // reads them too.
    const rows = sheet.lists && typeof sheet.lists === "object" && Object.keys(sheet.lists).length > 0;
    if (rows || (fields && typeof fields === "object" && Object.keys(fields).length > 0)) {
      lists.add(RULESET_PROPOSED_FIELDS);
      for (const catalog of definition.catalogs ?? [])
        if (catalog.holds !== "items" && catalog.holds !== "creatures")
          for (const list of catalog.feeds ?? []) lists.add(list);
    }
    for (const source of definition.combat?.abilities ?? []) if (source.onlyWhen) lists.add(source.list);
  }
  return lists;
}

/** The catalogs this fight needs: the ones the party's own rows came from, and every bestiary the
 *  ruleset ships. A catalog that cannot be read is logged and left out, which costs an ability its
 *  price or an opponent its stat block rather than costing the battle. */
async function loadFightCatalogs(
  packageId: string | null,
  definition: RulesetDefinition,
  wanted: (catalog: NonNullable<RulesetDefinition["catalogs"]>[number]) => boolean,
): Promise<RulesetCatalogEntriesById> {
  const catalogs: RulesetCatalogEntriesById = {};
  for (const catalog of definition.catalogs ?? []) {
    if (!wanted(catalog)) continue;
    try {
      const read = await loadRulesetCatalogEntries(packageId, definition, catalog);
      if (read.ok) catalogs[catalog.id] = read.entries;
      else
        logger.warn(
          "[game/combat:ruleset] Catalog %s of %s could not be read: %s",
          catalog.id,
          definition.id,
          read.issues.slice(0, 3).join("; "),
        );
    } catch (error) {
      logger.warn(error, "[game/combat:ruleset] Could not read catalog %s of %s", catalog.id, definition.id);
    }
  }
  return catalogs;
}

/** A guest's command for their own party members, as the room hands it to the fight (2026-10-27). */
export interface RoomFightCommandInput {
  anchor: string;
  id: string;
  instanceId: string;
  revision: number;
  command: DirectedCommand;
}

/** What reads and commands a shared room's fight for one of its players (2026-10-27). */
export interface RoomFightBridge {
  /** The room's fight on the board now, as this player is shown it; null when none is. */
  view(chatId: string, viewer: RulesetFightCommander): Promise<{ anchor: string; view: DirectedCombatView } | null>;
  /** Sends one player's command, checked as the host's own are and against whose it is. */
  command(
    chatId: string,
    input: RoomFightCommandInput,
    viewer: RulesetFightCommander,
  ): Promise<{ ok: true } | { ok: false; stale: boolean }>;
}

/** What a shared room gives the fight and takes from it (2026-10-27). */
export interface RoomFightHooks {
  /** The room's players not connected now, by participant id: their characters fight on their own. */
  absent(chatId: string): ReadonlySet<string>;
  /** The fight moved, so the room's players are shown where it is now. */
  changed(chatId: string): void;
  ready(bridge: RoomFightBridge): void;
}

export async function combatDirectorRoutes(
  app: FastifyInstance,
  options: { chooseBoss?: typeof chooseGmCombatOption; room?: RoomFightHooks } = {},
) {
  const chats = createChatsStorage(app.db),
    store = createGameEngineStateStorage(app.db);
  /** The fight each chat last had on screen, which is the one a shared room's players are shown. */
  const roomFights = new Map<string, string>();
  const rememberFight = (chatId: string, anchor: string) => {
    roomFights.delete(chatId);
    roomFights.set(chatId, anchor);
    if (roomFights.size > 200) roomFights.delete(roomFights.keys().next().value!);
  };
  const load = async (chatId: string, anchor: string) => {
    const row = await store.getByChatAndMessage(chatId, anchor, 0, COMBAT_DIRECTOR_NAMESPACE);
    if (!row) return null;
    rememberFight(chatId, anchor);
    let state: CombatDirectorState;
    try {
      state = JSON.parse(row.state) as CombatDirectorState;
    } catch {
      throw new Error("Unsupported combat save.");
    }
    if (!state || state.schemaVersion !== 1 || !Array.isArray(state.tasks) || !Array.isArray(state.requests))
      throw new Error("Unsupported combat save.");
    // Saved blobs can arrive through imports as well as this route. Bound structural data before resuming.
    z.object({
      id: key,
      revision: z.number().int().min(0),
      style: z.enum(["classic", "tactical", "ruleset"]),
      weather: combatWeatherSchema.optional(),
      // The setting's elements (worldgen W6c), checked like the rest a save may bring back.
      elements: worldElementSetSchema.optional(),
      round: z.number().int().min(1),
      party: z.array(directedCombatantSchema).min(1).max(20),
      enemies: z.array(directedCombatantSchema).min(1).max(20),
      budgets: z.record(
        key,
        z.object({ legendary: z.number().int().min(0).max(6), reaction: z.number().int().min(0).max(1) }),
      ),
      pending: z.record(key, z.unknown()).refine((v) => Object.keys(v).length <= 41),
      choices: z
        .array(
          z
            .object({
              id: key,
              actorId: key,
              kind: z.enum(["attack", "skill", "move", "defend", "wait", "pass"]),
              mpCost: num,
              legendaryCost: z.number().int().min(0).max(6),
              action: z
                .object({ unitId: key, classic: classicAction.optional(), tactical: tacticalAction.optional() })
                .optional(),
              // What a ruleset fight's candidate carries. Bounded like the rest, because a save can
              // arrive through an import as well as through this route.
              optionId: key.optional(),
              targetIds: z.array(key).max(40).optional(),
              label: z.string().max(1000).optional(),
            })
            .passthrough(),
        )
        .max(256),
      tasks: z.array(z.unknown()).max(4000),
      requests: z.array(key).max(256),
      // Totals per item, which a player's stacks together may take well past one stack's bound.
      inventory: z
        .array(
          z.object({
            name: key,
            quantity: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
            ownName: key.optional(),
          }),
        )
        .max(200),
      itemSpends: z.record(key, z.number().int().min(0).max(Number.MAX_SAFE_INTEGER)),
      itemDraws: z.record(key, z.number().int().min(0).max(Number.MAX_SAFE_INTEGER)).optional(),
      gmCalls: z.number().int().min(0).max(12),
      // The ruleset fight itself. Its numbers are the ruleset's own and are checked by the resolver
      // that reads them; what is bounded here is the SHAPE and the size, the way the rest is.
      rulesetFight: z
        .object({
          encounter: z
            .object({
              v: z.literal(1),
              ruleset: z.object({ id: key, version: z.number().int().min(1) }),
              seed: z.number().int().min(0).max(0xffffffff),
              cursor: z.number().int().min(0).max(1000000),
              round: z.number().int().min(1).max(10000),
              turn: z.number().int().min(0).max(40),
              order: z.array(key).max(40),
              combatants: z.array(z.object({ id: key, name: z.string().min(1).max(200) }).passthrough()).max(40),
              opening: z.array(z.unknown()).max(RULESET_COMBAT_EVENT_LIMIT),
              // The board, bounded exactly as the tactical style's own is: the same size cap, the
              // same terrain table, and every position inside the grid (checked below, where the
              // grid's own dimensions are known).
              board: z
                .object({
                  grid: z.object({
                    width: z.number().int().min(1).max(64),
                    height: z.number().int().min(1).max(64),
                    tiles: z.array(z.array(z.string())).max(64),
                  }),
                })
                .passthrough()
                .optional(),
            })
            .passthrough(),
          eventSeq: z.number().int().min(0),
          events: z
            .array(z.object({ seq: z.number().int().min(0), event: z.unknown().optional() }))
            // The fight's own and the AI's reasons beside them, each kept to its own window.
            .max(RULESET_COMBAT_EVENT_LIMIT + RULESET_COMBAT_REASON_LIMIT),
          controllers: z.record(key, z.enum(["manual", "ai"])),
          bosses: z.array(key).max(40),
          thinkers: z.array(key).max(40).optional(),
          adjustments: z.array(z.string().max(1000)).max(200),
        })
        .optional(),
    }).parse(state);
    if ((state.style === "tactical") !== !!state.tactical) throw new Error("Invalid combat mode in save.");
    if ((state.style === "ruleset") !== !!state.rulesetFight) throw new Error("Invalid combat mode in save.");
    const board = state.rulesetFight?.encounter.board;
    if (board) {
      const grid = board.grid;
      if (
        grid.tiles.length !== grid.height ||
        grid.tiles.some(
          (row) => row.length !== grid.width || row.some((tile) => !Object.hasOwn(TERRAIN_DATA, tile as string)),
        ) ||
        !tacticalOutsideValid(grid as Parameters<typeof tacticalOutsideValid>[0])
      )
        throw new Error("Invalid battlefield in save.");
      // Everybody on the board or nobody: a fight with one combatant standing nowhere could answer
      // nothing about distance, and the resolver builds one only when it can place them all. Those
      // the resolver itself took off the board stand nowhere: a called creature sent away, a corpse
      // risen as something else (class re-test 2026-10-24: a save refused once a druid's eight horses
      // were sent away).
      const gone = (combatant: { defeated?: boolean; dismissed?: true; corpseRaised?: true }) =>
        !!combatant.defeated && (!!combatant.dismissed || !!combatant.corpseRaised);
      const placed = state.rulesetFight!.encounter.combatants.filter(
        (combatant) => typeof combatant.x === "number" || typeof combatant.y === "number",
      );
      const unplaced = state.rulesetFight!.encounter.combatants.filter((combatant) => !placed.includes(combatant));
      if (unplaced.some((combatant) => !gone(combatant))) throw new Error("Invalid saved position.");
      for (const combatant of placed) {
        if (
          !Number.isInteger(combatant.x) ||
          !Number.isInteger(combatant.y) ||
          combatant.x! < 0 ||
          combatant.y! < 0 ||
          combatant.x! >= grid.width ||
          combatant.y! >= grid.height
        )
          throw new Error("Invalid saved position.");
      }
      // The resolver never puts anybody inside something solid, so a save that says otherwise was
      // not written by it and every distance read off it would be wrong. Two on one cell is NOT
      // refused: a walk may end on a fallen body, and healing that body stands two people on one
      // square, which is the resolver's own doing. Water is not solid to everybody: a swimmer or a
      // flier stands in it, and so does whoever it drags there (re-test 15: a crocodile's prey).
      for (const combatant of placed) {
        if (
          rulesetCellBlocked(grid, combatant.x!, combatant.y!) &&
          grid.tiles[combatant.y!]?.[combatant.x!] !== "water"
        )
          throw new Error("Invalid saved position.");
      }
    } else if (
      // A fight with no board has no cells to stand in, so a saved combatant carrying EITHER
      // coordinate at all, whatever it holds, was not written by the resolver.
      state.rulesetFight?.encounter.combatants.some(
        (combatant) => Object.hasOwn(combatant, "x") || Object.hasOwn(combatant, "y"),
      )
    ) {
      throw new Error("Invalid saved position.");
    }
    if (state.tactical) {
      combatWeatherSchema.optional().parse(state.tactical.weather);
      if (
        JSON.stringify(combatWeatherSchema.optional().parse(state.weather)) !==
        JSON.stringify(combatWeatherSchema.optional().parse(state.tactical.weather))
      )
        throw new Error("Inconsistent weather in combat save.");
      const grid = state.tactical.grid;
      if (
        !grid ||
        !Number.isInteger(grid.width) ||
        !Number.isInteger(grid.height) ||
        grid.width < 1 ||
        grid.height < 1 ||
        grid.width > 64 ||
        grid.height > 64 ||
        grid.tiles.length !== grid.height ||
        grid.tiles.some(
          (row) =>
            !Array.isArray(row) || row.length !== grid.width || row.some((tile) => !Object.hasOwn(TERRAIN_DATA, tile)),
        ) ||
        !tacticalOutsideValid(grid)
      )
        throw new Error("Invalid battlefield in save.");
      if (!Array.isArray(state.tactical.units) || state.tactical.units.length > 40)
        throw new Error("Invalid saved units.");
      for (const u of state.tactical.units) {
        directedCombatantSchema.parse({ ...u, side: u.side === "party" ? "player" : u.side });
        if (
          !Number.isInteger(u.x) ||
          !Number.isInteger(u.y) ||
          u.x < 0 ||
          u.y < 0 ||
          u.x >= grid.width ||
          u.y >= grid.height
        )
          throw new Error("Invalid saved position.");
      }
    }
    state.anchor = anchor;
    state.instanceId = row.id;
    return { row, state };
  };
  /** The rules this chat is on right now, resolved fresh: a fight is only ever resolved by the
   *  ruleset the game actually pins, never by whatever it was started on. */
  const rulesetSessionFor = async (chatId: string, s: CombatDirectorState): Promise<RulesetSession | null> => {
    const fight = s.rulesetFight;
    if (s.style !== "ruleset" || !fight) return null;
    const chat = await chats.getById(chatId);
    const meta = chat ? (JSON.parse(chat.metadata || "{}") as Record<string, unknown>) : {};
    const resolved = resolveGameRuleset(meta, await loadRulesetRegistry());
    const pinned = fight.encounter.ruleset;
    if (resolved.status !== "ok")
      return { unavailable: "This game's ruleset is not available, so the fight could not go on." };
    if (!resolved.definition.combat)
      return { unavailable: "This game's ruleset no longer resolves its own fights, so the fight could not go on." };
    if (resolved.definition.id !== pinned.id || resolved.definition.version !== pinned.version) {
      return {
        unavailable: `This fight was started on ${pinned.id} version ${pinned.version}, and the game is on version ${resolved.definition.version} now, so it could not go on.`,
      };
    }
    return { definition: resolved.definition, packageId: resolved.packageId };
  };
  /** Whose own character each party member of a shared room's fight is, read from the room as it is
   *  now (2026-10-26): a player who left hands theirs back to the host, and a fight outside a room, or
   *  in one that ended, has no players. Set on the fight in hand; saved only with a step. */
  const seatRoomPlayers = async (chatId: string, s: CombatDirectorState) => {
    const fight = s.rulesetFight;
    if (s.style !== "ruleset" || !fight) return;
    const chat = await chats.getById(chatId);
    const meta = chat ? (JSON.parse(chat.metadata || "{}") as Record<string, unknown>) : {};
    const party = fight.encounter.combatants.filter((one) => one.side === "party" && !one.calledBy);
    const players = roomFightPlayers(meta, party);
    if (players) fight.players = players;
    else delete fight.players;
    // A player not connected now (left, or gone quiet) has the Engine play their character, as one
    // absent when the fight began does, until they take it back (laptop room playtest 2026-10-30: a
    // guest who pressed Leave held the fight on their turn).
    const absent = options.room?.absent(chatId);
    for (const [unitId, player] of Object.entries(players ?? {})) {
      if (player.host || !absent?.has(player.participantId) || fight.controllers[unitId] === "ai") continue;
      fight.controllers[unitId] = "ai";
      // The party panel reads the member's own controller.
      const member = s.party.find((one) => one.id === unitId);
      if (member) member.controller = "ai";
    }
  };
  /** The session a client reads. A ruleset fight whose rules are gone comes back finished rather
   *  than resolved by other numbers, and nothing about that is written down: reinstalling the
   *  ruleset picks the same fight up where it was left. */
  const sessionView = (
    s: CombatDirectorState,
    session: RulesetSession | null,
    viewer: RulesetFightCommander = RULESET_ROOM_HOST,
  ): DirectedCombatView => {
    const fight = s.rulesetFight;
    if (s.style !== "ruleset" || !fight) return combatDirectorView(s);
    if (session && "definition" in session) {
      const view = combatDirectorView(s);
      view.stage = rulesetDirectorStage(s);
      view.ruleset = directedRulesetView(session.definition, s, viewer);
      return view;
    }
    const reason = session && "unavailable" in session ? session.unavailable : "This fight's rules could not be read.";
    s.outcome ??= "flee";
    const view = combatDirectorView(s);
    view.ruleset = {
      ruleset: { ...fight.encounter.ruleset },
      round: fight.encounter.round,
      order: [...fight.encounter.order],
      controller: "ai",
      combatants: [],
      events: [
        ...fight.events,
        { seq: fight.eventSeq + 1, event: { type: "director", reason: "ruleset-unavailable", text: reason } },
      ],
      adjustments: [...fight.adjustments],
    };
    return view;
  };
  /** The game state row the in-game sheet shows: the last assistant message's active swipe, the rule
   *  `GET` and `PATCH /chats/:id/game-state` follow. The NEWEST row is not always that one (a player
   *  who swiped back is looking at an older telling), and a fight that read or wrote another row
   *  than the sheet would leave the two disagreeing. */
  const visibleLiveRow = async (chatId: string) => {
    const states = createGameStateStorage(app.db);
    const visibleAnchor = resolveVisibleGameStateAnchor(await chats.listMessages(chatId));
    const row = await states.getForGeneration(chatId, { preferLatestVisible: true, visibleAnchor });
    return { states, visibleAnchor, row };
  };
  /** The party's live sheet state, written where the sheet reads it. Inside the ledger's own save,
   *  so a step either changes both or changes neither. */
  const writeRulesetLive = async (chatId: string, anchor: string, fight: RulesetFightState) => {
    const { states, visibleAnchor, row } = await visibleLiveRow(chatId);
    const next: RulesetLiveStates = { ...(parseStoredRulesetLive(row?.rulesetLive) ?? {}) };
    for (const [name, live] of Object.entries(rulesetFightLiveStates(fight))) {
      // A member back at their defaults drops out of the store, exactly as the in-game sheet leaves
      // them, instead of keeping an empty entry forever.
      if (Object.keys(live).length > 0) next[name] = live;
      else delete next[name];
    }
    // The same order the sheet's own PATCH follows: the visible message's row, then the newest row,
    // and only a game with no row at all gets one on the battle's anchor.
    const written =
      (visibleAnchor
        ? await states.updateByMessage(visibleAnchor.messageId, visibleAnchor.swipeIndex, chatId, { rulesetLive: next })
        : null) ??
      (await states.updateLatest(chatId, { rulesetLive: next })) ??
      (await states.updateByMessage(anchor, 0, chatId, { rulesetLive: next }));
    const stored = parseStoredRulesetLive(written?.rulesetLive) ?? {};
    if (!written || JSON.stringify(stored) !== JSON.stringify(parseStoredRulesetLive(next) ?? {})) {
      throw new Error("The party's sheets could not be written, so the fight did not take that step.");
    }
    return stored;
  };
  const save = async (rowId: string, chatId: string, s: CombatDirectorState, session: RulesetSession | null) => {
    s.revision++;
    combatDirectorView(s);
    let live: RulesetLiveStates | undefined;
    // The ruleset's items as the player uses them, read before the chat's queue is held and only once
    // the fight has spent something: a bound cursed item is one the player cannot use up.
    const rules =
      Object.keys(s.itemSpends).length > 0 || Object.keys(s.itemDraws ?? {}).length > 0
        ? await loadGameInventoryItemBook(app.db, { chatId }, "player")
        : undefined;
    // The step that wins drops the fight's loot, rolled before the queue is held and added with the
    // step: each defeated bestiary opponent's table, or the native tables by how many fell.
    const won = s.outcome === "victory" && s.loot === undefined;
    const encounter = s.style === "ruleset" ? s.rulesetFight?.encounter : undefined;
    const fallen = encounter
      ? encounter.combatants.filter((combatant) => combatant.side === "enemy" && combatant.defeated)
      : [
          ...s.enemies.filter((enemy) => enemy.hp <= 0),
          // One that gave up hands over what it carried (combat AI E1); one that ran takes it along.
          ...(s.gone ?? []).filter((enemy) => enemy.left === "surrendered"),
        ];
    const loot = won
      ? await planGameVictoryLoot(
          app.db,
          chatId,
          {
            tables: fallen.flatMap((enemy) => s.rulesetFight?.lootTables?.[enemy.id] ?? []),
            defeated: fallen.length,
            difficulty: s.difficulty,
            // What the beaten still had on them (1.795); one that ran took its along.
            // Its coins too (laptop playtest 2026-10-25: a thief's stolen 9 gp never came back).
            carried: (encounter?.combatants ?? []).flatMap((combatant) =>
              combatant.side === "enemy" && combatant.defeated && !combatant.away?.left
                ? [...rulesetCarriedLeft(combatant), ...(s.rulesetFight?.purses?.[combatant.id] ?? [])]
                : [],
            ),
          },
          rollDieSecurely,
        )
      : null;
    await withChatMetadataPatchQueue(chatId, () =>
      app.db.transaction(async () => {
        const previous = await load(chatId, s.anchor);
        if (!previous || previous.row.id !== rowId) throw new Error("Battle changed while saving.");
        // Spent by the item's own name, which only ever finds that item, not by a nickname.
        // One of the ruleset's items that holds charges counts uses, and spends charges (#6909): kept
        // apart from a plain item of the same own name, which is taken.
        const spent = new Map<string, { name: string; count: number; charged: boolean }>();
        for (const [name, count] of Object.entries(s.itemSpends)) {
          const more = count - (previous.state.itemSpends[name] ?? 0);
          if (more <= 0) continue;
          const own = s.inventory.find((line) => line.name === name)?.ownName ?? name;
          const charged = s.itemEffects.some((effect) => effect.name === name && effect.charges);
          const key = `${charged ? "charge" : "take"}:${own}`;
          spent.set(key, { name: own, count: (spent.get(key)?.count ?? 0) + more, charged });
        }
        const deltas = [...spent.values()];
        if (deltas.length)
          // Taken by name across every stack and bag of the item, the player's own first, since the
          // fight saw one total per item; the detailed inventory and the journal follow with it. Charges
          // are spent the same way, and an item that may break rolls the Engine's own dice.
          await applyGameInventoryChangeHeld(app.db, chatId, (stacks) => {
            for (const d of deltas) {
              if (d.charged) continue;
              // Counted as the items of that own name, so another item's nickname can never make up the count,
              // and only where the item may be used from, as the fight counted it: worn, and bound where it binds.
              const items = gameInventoryItemsOwnNamed(stacks, d.name);
              const usable = stacks.filter((stack) => gameInventoryUsableStack(stack, rules));
              if (gameInventoryCountItems(usable, items) < d.count)
                throw new Error("Inventory changed. Reload the battle.");
              const free = usable.filter((stack) => !gameInventoryKeptByCurse(stack, rules));
              if (gameInventoryCountItems(free, items) < d.count)
                throw new Error(`${d.name} is cursed and stays with whoever it is bound to, so it cannot be used.`);
            }
            const outcome = applyGameInventoryOps(
              stacks,
              deltas.map((d) =>
                d.charged
                  ? { op: "charge" as const, name: d.name, count: d.count }
                  : { op: "take" as const, name: d.name, count: d.count, as: "used" as const, worn: true as const },
              ),
              undefined,
              rules,
              rollDieSecurely,
            );
            // The step counted on every item it spends: one taken short throws, and the whole step with it.
            if (outcome.results.some((result, i) => !result.ok || result.count !== deltas[i]!.count))
              throw new Error("Inventory changed. Reload the battle.");
            return { stacks: outcome.stacks, journal: outcome.journal, value: null };
          });
        // What was used and is drawn as it is used (1.808) is put on, as a free swap: past what nothing
        // may be put away for, the step is refused, as the fight offered it only while it could be drawn.
        const draws = Object.entries(s.itemDraws ?? {}).flatMap(([name, count]) =>
          count > (previous.state.itemDraws?.[name] ?? 0)
            ? [s.inventory.find((line) => line.name === name)?.ownName ?? name]
            : [],
        );
        if (draws.length)
          await applyGameInventoryChangeHeld(app.db, chatId, (stacks) => {
            let current = stacks;
            for (const name of draws) {
              const drawn = drawGameInventoryFightItem(current, name, rules);
              if ("refused" in drawn)
                throw new Error(
                  drawn.refused === "hands-full"
                    ? `${name} cannot be drawn: its slots are held by ${drawn.by.join(", ")}.`
                    : `${name} cannot be drawn: there are too few of the slots it takes.`,
                );
              current = drawn.stacks;
            }
            return { stacks: current, journal: [], value: null };
          });
        // What a ruleset fight shot, loaded and won back since the last step, onto those very stacks,
        // with the party's sheets: a step either changes both or changes neither.
        const fightItems =
          s.style === "ruleset" && s.rulesetFight
            ? rulesetFightItemChanges(
                previous.state.rulesetFight?.encounter,
                s.rulesetFight.encounter,
                session && "definition" in session ? session.definition.combat?.roundSeconds : undefined,
              )
            : [];
        if (fightItems.length > 0)
          await applyGameInventoryChangeHeld(app.db, chatId, (stacks) => {
            const applied = applyRulesetFightItemChanges(stacks, fightItems);
            if (!applied) throw new Error("Inventory changed. Reload the battle.");
            return { stacks: applied.stacks, journal: applied.journal, value: null };
          });
        if (s.style === "ruleset" && s.rulesetFight) live = await writeRulesetLive(chatId, s.anchor, s.rulesetFight);
        // The fight just ended: one that got away, or won, is remembered by name as it was made, so a later fight
        // that names it brings it back the same; one beaten here is forgotten.
        if (s.style === "ruleset" && s.rulesetFight && s.outcome && !previous.state.outcome) {
          const { fled, beaten } =
            session && "definition" in session
              ? rulesetFightReturningFoes(
                  session.definition,
                  s.rulesetFight,
                  (id) => s.enemies.find((unit) => unit.id === id)?.tactics?.adjective,
                )
              : { fled: [], beaten: [] };
          if (fled.length || beaten.length)
            await chats.patchMetadata(
              chatId,
              (current) => {
                const kept = {
                  ...((current.gameReturningFoes && typeof current.gameReturningFoes === "object"
                    ? current.gameReturningFoes
                    : {}) as Record<string, RulesetReturningFoe>),
                };
                // Each name this fight had starts over: several that got away of one name ("Cult Thug
                // (Scarred)", "Cult Thug (Highwayman)") are kept one after another, as "<name>#2" on.
                const names = new Set([...beaten, ...fled.map((foe) => foe.name)].map(rulesetReturningFoeKey));
                for (const key of Object.keys(kept)) if (names.has(key.replace(/#\d+$/, ""))) delete kept[key];
                // And each that came back in other words, under the name it was kept by, the rest of
                // that name numbered on again.
                const fight = s.rulesetFight!;
                for (const gone of fight.returnedFrom ?? []) {
                  if (!kept[gone]) continue;
                  delete kept[gone];
                  const base = gone.replace(/#\d+$/, "");
                  const rest: RulesetReturningFoe[] = [];
                  const nth = (key: string) => Number(/#(\d+)$/.exec(key)?.[1] ?? 1);
                  for (const key of Object.keys(kept).sort((a, b) => nth(a) - nth(b)))
                    if (key === base || (key.startsWith(`${base}#`) && /^#\d+$/.test(key.slice(base.length)))) {
                      rest.push(kept[key]!);
                      delete kept[key];
                    }
                  rest.forEach((foe, index) => (kept[index === 0 ? base : `${base}#${index + 1}`] = foe));
                }
                // Stamped with the game clock, so the rests it takes before it comes back are counted.
                const clock = gameClockMinutes(current.gameTime);
                const counted = new Map<string, number>();
                for (const foe of fled) {
                  const key = rulesetReturningFoeKey(foe.name);
                  const nth = (counted.get(key) ?? 0) + 1;
                  counted.set(key, nth);
                  kept[nth === 1 ? key : `${key}#${nth}`] = clock === undefined ? foe : { ...foe, clock };
                }
                return { gameReturningFoes: kept };
              },
              { metadataQueueHeld: true, touchUpdatedAt: false },
            );
        }
        // A win already saved has dropped its loot: this one keeps what that one dropped.
        if (won) {
          const dropped = previous.state.loot
            ? null
            : loot
              ? await applyGameInventoryChangeHeld(app.db, chatId, (stacks) => {
                  const added = addGameLoot(stacks, loot);
                  return { stacks: added.stacks, journal: added.journal, value: added.dropped };
                })
              : null;
          s.loot = previous.state.loot ?? dropped?.value ?? [];
        }
        await store.updateStateById(rowId, JSON.stringify(s), true, chatId);
      }),
    );
    return { session: sessionView(s, session), ...(live ? { rulesetLive: live } : {}) };
  };
  app.post("/start", async (req, reply) => {
    const parsed = z
      .object({
        chatId: key,
        anchor: key,
        style: z.enum(["classic", "tactical", "ruleset"]),
        party: z.array(directedCombatantSchema).min(1, "This fight has nobody on the party's side.").max(20),
        enemies: z.array(rulesetOpponentSchema).min(1, "This fight has nobody to fight.").max(20),
        environment: z.string().max(80).optional(),
        formation: z.string().max(80).optional(),
        battlefield: z.unknown().optional(),
        /** The board pack a ruleset fight is drawn with (1.333), by library id. */
        boardPack: z.string().max(80).optional(),
        /** Whether a ruleset fight is fought on a board, which is what the game's Tactical combat
         *  preference asks for. The ruleset still has to say what a cell is worth. */
        positioned: z.boolean().optional(),
        mechanics: z
          .array(
            z.object({
              name: key,
              description: z.string().max(3000),
              ownerName: z.string().max(200).optional(),
              // A trigger the Engine has none of ("charge") goes off as an attack does, never refusing the
              // fight (laptop playtest 2026-10-25).
              trigger: z.enum(["round_interval", "hp_threshold", "on_hit", "on_attack", "passive"]).catch("on_attack"),
              // 0 for a mechanic no interval drives (an hp_threshold one's `interval: 0` refused the
              // whole fight), which every reader takes as none.
              interval: rounds.optional(),
              hpThreshold: z.number().min(0).max(100).optional(),
              counterplay: z.string().max(3000).optional(),
              effectType: z
                .enum(["damage_all", "damage_one", "buff_self", "debuff_party", "status_party", "status_enemy"])
                .optional()
                .catch(undefined),
              power: num.max(20).optional(),
              element: z.string().max(100).optional(),
              status: itemEffect.shape.status,
            }),
          )
          .max(32)
          .default([]),
        itemEffects: z.array(itemEffect).max(200).default([]),
        inventory: z
          .array(
            z.object({
              name: z.string().max(200),
              quantity: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
              description: z.string().max(2000).optional(),
            }),
          )
          .max(200)
          .default([]),
      })
      .safeParse(req.body);
    if (!parsed.success) {
      // Where it went wrong, so a refused fight can be traced to the one value ("Number must be
      // greater than or equal to 1" alone names nothing).
      const issue = parsed.error.issues[0];
      const path = issue?.path.join(".") ?? "";
      logger.warn("[combat-director/start] refused: %s: %s", path || "body", issue?.message ?? "invalid");
      // A nested field is named; a top-level refusal ("This fight has nobody to fight.") reads as is.
      return reply
        .code(400)
        .send({ error: issue && issue.path.length > 1 ? `${path}: ${issue.message}` : issue?.message });
    }
    const input = parsed.data;
    try {
      return await serialized(input.chatId, async () => {
        const chat = await chats.getById(input.chatId);
        if (!chat) return reply.code(404).send({ error: "Chat not found." });
        const anchor = await chats.getMessage(input.anchor);
        if (!anchor || anchor.chatId !== input.chatId)
          return reply.code(400).send({ error: "Battle anchor is not in this chat." });
        const existing = await load(input.chatId, input.anchor);
        if (existing) {
          await seatRoomPlayers(input.chatId, existing.state);
          return { session: sessionView(existing.state, await rulesetSessionFor(input.chatId, existing.state)) };
        }
        const meta = JSON.parse(chat.metadata || "{}"),
          setup = meta.gameSetupConfig ?? {};
        if (setup.combatDirector !== true)
          return reply.code(400).send({ error: "Directed combat is not enabled for this game." });
        // An Experience's companions who never fight (1.360) travel with the party but are not put in its fights.
        // A unit is one of them by its own id alone; only a unit that arrives without one is known by its name.
        const noncombatants = await gameNoncombatants(app.db, input.chatId, meta);
        if (noncombatants.size) {
          const sitsOut = (member: { id: string; name: string }) =>
            noncombatants.has(member.id) || (!member.id.trim() && noncombatants.has(buildPartyNpcId(member.name)));
          const fighting = input.party.filter((member) => !sitsOut(member));
          if (fighting.length) input.party = fighting;
        }
        const all = [...input.party, ...input.enemies];
        if (
          new Set(all.map((u) => u.id)).size !== all.length ||
          input.party.some((u) => u.side !== "player") ||
          input.enemies.some((u) => u.side !== "enemy")
        )
          return reply.code(400).send({ error: "Invalid combat sides or duplicate units." });
        const battlefield = resolveTacticalStartPreferences({
          setup: setup.tacticalBattlefield,
          requestSeed: undefined,
          requestBattlefield: input.battlefield,
          randomSeed: () => Math.floor(Math.random() * 0x100000000),
        });
        if (!battlefield.ok) throw new Error(battlefield.error);
        let checkpointRestore = false;
        try {
          checkpointRestore =
            anchor.role === "system" && JSON.parse(anchor.extra || "{}")?.gameStateAnchor === "checkpoint_restore";
        } catch {
          // Legacy malformed extras do not identify a checkpoint restore.
        }
        const committedWeather = (await createGameStateStorage(app.db).getLatestCommitted(input.chatId))?.weather;
        // Restores rewind the committed scene without rewinding campaign metadata.
        // Fresh starts still prefer metadata, which may be newer than the accepted scene.
        const weatherSource = checkpointRestore
          ? (committedWeather ?? meta.gameWeather)
          : (meta.gameWeather ?? committedWeather);
        // An invented sheet's open choices are filled by how it fights, so it is given its tactics now,
        // from the same unit and seed the fight would later give them from, and both read the same.
        for (const enemy of input.enemies) {
          if ((enemy.proposed as { sheet?: unknown } | undefined)?.sheet) {
            enemy.tactics ??= assignCombatTactics(enemy as Combatant, battlefield.seed);
          }
        }
        // One line per item: a fight neither knows nor cares how the player split their stacks. Each is
        // shown under a name no other line has, and spent by the item's own name; its effect is found
        // under that line's name, or the name it was shown by, or its own name. The ruleset's items do
        // what their `use` says, worked out here rather than taken from the screen, and one with no use
        // is not offered; the rest do what a model guessed, unless the ruleset turns them off.
        const fightItems = await loadGameFightItems(app.db, meta, input.itemEffects);
        const elements = gameWorldElementSet(meta);
        // A board painted for where the fight starts (worldgen W9g), for a fight on a board: fought on as
        // painted, in its own scene; the brief's terrain is not used.
        // A ruleset's fight is on a board only when the game asks for one and the ruleset says what a cell
        // is worth; the ruleset is read once, here.
        const resolved = input.style === "ruleset" ? resolveGameRuleset(meta, await loadRulesetRegistry()) : null;
        // Who plays the other side (1.774), read off the game's ruleset whatever style resolves the fight.
        const rules = resolved ?? (meta.gameRuleset ? resolveGameRuleset(meta, await loadRulesetRegistry()) : null);
        const opposition = rules?.status === "ok" ? rules.definition.gm.opposition : undefined;
        const here =
          input.style === "tactical" ||
          (input.positioned === true && resolved?.status === "ok" && resolved.definition.combat?.distance)
            ? await gameBattlefieldHere(app.db, input.chatId, meta, battlefield.seed)
            : null;
        // A bestiary creature far beyond the party sends lesser ones of its kind instead, swapped before
        // the fight's units are made (Alyssa 2026-10-26: a CR 21 lich for a level 4 party). Never in a
        // story's own fight, which is its author's.
        let standIns: string[] = [];
        if (
          resolved?.status === "ok" &&
          resolved.definition.combat?.threat?.budget &&
          !(await latestStoryFight(app.db, input.chatId, meta))
        ) {
          const definition = resolved.definition;
          const scale = definition.combat!.threat!.budget!;
          // Weighed for those who will fight it: the party sent, and never the dead (laptop v3b 2026-10-26:
          // two survivors were given servants worth a party of four).
          const sent = new Set(input.party.map((member) => normalizeCharacterLookupName(member.name)));
          const living = parseStoredRulesetLive((await visibleLiveRow(input.chatId)).row?.rulesetLive) ?? {};
          const fighting = [...rulesetSheetBuildsByName(definition, meta.gameCharacterCards, null).entries()].filter(
            ([key, build]) => (sent.size === 0 || sent.has(key)) && !rulesetSheetDead(definition, build, living[key]),
          );
          const budget = rulesetEncounterBudget(
            definition,
            fighting.map(([, build]) => rulesetBudgetLevel(scale, build.fields)),
            normalizeGameDifficulty(setup.difficulty),
          );
          if (budget) {
            const swapped = rulesetBudgetStandIns(
              definition,
              await loadFightCatalogs(resolved.packageId, definition, (c) => c.holds === "creatures"),
              input.enemies,
              budget,
            );
            if (swapped.lines.length > 0) {
              input.enemies = swapped.enemies as typeof input.enemies;
              standIns = swapped.lines;
            }
          }
        }
        // A scene in the setting's own words is laid out like the battlefield it names (worldgen W6d).
        const environment =
          here?.scene ??
          worldSceneLike(gameWorldBattlefields(meta) ?? WORLD_DEFAULT_BATTLEFIELDS, input.environment) ??
          input.environment;
        const state = createCombatDirector({
          ...input,
          ...(environment ? { environment } : {}),
          inventory: fightItems.lines.map(({ name, quantity, ownName, item }) => ({
            name,
            quantity,
            ...(ownName ? { ownName } : {}),
            ...(item ? { item } : {}),
          })),
          itemEffects: fightItems.effects,
          party: input.party as Combatant[],
          // What the fight is RESOLVED by is read below and never stored on the Engine's own units.
          enemies: input.enemies.map(({ creature: _c, tier: _t, proposed: _p, ...unit }) => unit) as Combatant[],
          id: randomUUID(),
          // Who the scene caught unaware: an opponent among them checks its morale first (combat AI E1).
          surprised: input.enemies.flatMap((one) => (one.surprised ? [one.id] : [])),
          gm: setup.gmBossControl === true,
          // The named and the brilliant opponents too (combat AI P9), when the game asks for it.
          gmNamed: setup.gmBossControl === true && setup.gmNamedControl === true,
          // A cruel opponent may strike the fallen only where the game allows it (combat AI T3).
          cruel: setup.cruelOpponents === true,
          // Every opponent, where the game's ruleset gives the Game Master the opposition (1.774).
          gmAll: setup.gmBossControl === true && opposition === "game-master",
          difficulty: normalizeGameDifficulty(setup.difficulty),
          weather: resolveCombatWeather(
            weatherSource,
            environment,
            here ? undefined : battlefield.battlefield?.exposure,
          ),
          // The setting's own elements (worldgen W6c), when its kit names them.
          ...(elements ? { elements } : {}),
          seed: battlefield.seed,
          battlefield: here ? undefined : battlefield.battlefield,
          ...(here ? { made: here } : {}),
          // One unit at a time in a rolled order, when the game says so (combat C6c).
          ...((meta.gameTacticalTurnOrder ?? setup.tacticalTurnOrder) === "initiative"
            ? { turnOrder: "initiative" as const }
            : {}),
        });
        let session: RulesetSession | null = null;
        if (input.style === "ruleset" && resolved) {
          if (resolved.status !== "ok")
            return reply.code(400).send({ error: "This game does not pin a ruleset this install can read." });
          const definition = resolved.definition;
          if (!definition.combat)
            return reply.code(400).send({ error: "This game's ruleset does not resolve its own fights." });
          const setupPersonaId = (setup as { personaId?: string | null }).personaId ?? null;
          const personaId = chat.personaId || setupPersonaId;
          const persona = personaId ? await createCharactersStorage(app.db).getPersona(personaId) : null;
          const cards = meta.gameCharacterCards;
          const builds = rulesetSheetBuildsByName(definition, cards, persona?.name ?? null);
          const itemBook = rulesetReadsItems(definition)
            ? await loadGameInventoryItemBook(app.db, { metadata: meta, resolved }, "player")
            : undefined;
          const cardNames = (Array.isArray(cards) ? (cards as Array<Record<string, unknown>>) : []).flatMap((card) =>
            typeof card?.name === "string" && card.name.trim() ? [card.name.trim()] : [],
          );
          const fightItems = itemBook
            ? rulesetCardItems(
                itemBook,
                normalizeGameInventoryStacks(meta.gameInventory),
                cardNames,
                persona?.name ?? null,
              )
            : undefined;
          // Every sheet's lists, since the fight's party is who holds a sheet, whatever names the setup used.
          const partyLists = new Set(
            [...builds.values()].flatMap((build) => rulesetCatalogIdsForBuild(definition, build)),
          );
          // One read of the visible game state, for both its live sheets and its time of day.
          const liveRow = (await visibleLiveRow(input.chatId)).row;
          // How the story fight the latest reply started has its opponents (1.363), by their names.
          // A creature changed from a party level up (1.371) reads the party's level as the Experience counts it.
          const adjusts = await latestStoryFightAdjusts(
            app.db,
            input.chatId,
            meta,
            { definition, packageId: resolved.packageId },
            await gamePartyLevel(app.db, input.chatId, meta, definition),
          );
          const enemyAdjusts = storyFightAdjustsFor(input.enemies, adjusts);
          const storyFight = await latestStoryFight(app.db, input.chatId, meta);
          // Whether death is held where it is fought (1.366): the story's Held Ground (1.323).
          const heldGround = await latestStoryHeldGround(app.db, input.chatId, meta);
          // One that got away from an earlier fight comes back as it was made then, whatever this
          // fight's tag says of it (laptop playtest 2026-10-25: a Cult Mage that fled at CR 3 with 32
          // health came back at CR 4 with 65).
          const returning = (
            meta.gameReturningFoes && typeof meta.gameReturningFoes === "object" ? meta.gameReturningFoes : {}
          ) as Record<string, RulesetReturningFoe>;
          // One of a name comes back once: the second Bandit of a fight where one Bandit got away is a
          // fresh one (cloud re-test 2026-10-25: both came back at 1 of 13).
          // Each kept one of a name goes to one of the fight's of that name: those the Game Master marked
          // ("Cult Thug (Wounded)") first, in order, then the one of its name, or any of a named one's.
          // A nameless one of several unmarked is a fresh one (2026-10-25: of two Cult Guards, neither
          // is the guard that got away before).
          const backAs: Array<RulesetReturningFoe | undefined> = input.enemies.map(() => undefined);
          const keys = [...new Set(input.enemies.map((enemy) => rulesetReturningFoeKey(enemy.name)))];
          for (const key of keys) {
            const stored: RulesetReturningFoe[] = [];
            for (let nth = 1; returning[nth === 1 ? key : `${key}#${nth}`]; nth++)
              stored.push(returning[nth === 1 ? key : `${key}#${nth}`]!);
            if (stored.length === 0) continue;
            const same = input.enemies.flatMap((other, at) => (rulesetReturningFoeKey(other.name) === key ? [at] : []));
            const marked = same.filter((at) => rulesetReturningFoeMarked(input.enemies[at]!.name));
            const plain = same.filter((at) => !marked.includes(at));
            // Several marked of a name not of the story are the Game Master telling a group apart
            // ("Cult Thug (Crossbow)", "Cult Thug (Mace)"), not one coming back: each takes only the
            // kept one written as it is (laptop pass 5 2026-10-26: two of four Cult Thugs linked).
            if (marked.length > 1 && !stored[0]!.named) {
              const left = [...stored];
              for (const at of marked) {
                const same = left.findIndex(
                  (foe) =>
                    normalizeCharacterLookupName(foe.name) === normalizeCharacterLookupName(input.enemies[at]!.name),
                );
                if (same >= 0) backAs[at] = left.splice(same, 1)[0];
              }
              continue;
            }
            const takers = [...marked, ...(same.length === 1 || stored[0]!.named ? plain : [])];
            takers.forEach((at, index) => {
              if (stored[index]) backAs[at] = stored[index];
            });
          }
          // One kept from before and written again in other words, by the Game Master's own words for
          // it, once each (laptop playtest 2026-10-25: "Cult Thug (Highwayman)" came back as "Highwayman
          // Thug" with a fresh sheet). Only one of a name nothing in this fight is called.
          const taken = new Set(backAs.filter((foe): foe is RulesetReturningFoe => !!foe));
          const asked = new Set(keys);
          const others = Object.entries(returning).filter(
            ([key, foe]) => !asked.has(key.replace(/#\d+$/, "")) && !taken.has(foe),
          );
          // Forgotten under its old name once this fight ends, so it never comes back twice.
          const reworded: string[] = [];
          input.enemies.forEach((enemy, at) => {
            if (backAs[at]) return;
            // The first kept that fits, so two that got away of one name ("Cult Druid") come back as the
            // story's two ("Vengeful Cult Druid", "Desperate Cult Druid"), one each.
            const found = others.find(([, foe]) => rulesetReturningFoeReworded(foe.name, enemy.name));
            if (!found) return;
            backAs[at] = found[1];
            reworded.push(found[0]);
            others.splice(others.indexOf(found), 1);
          });
          // The game's whole party fights, not only those the setup named (cheap-GM playtest
          // 2026-10-26: combat:init listed one of three heroes, accepted without a word, and he fought
          // alone): only where its party list can be read, so who left it is known.
          const roster = await gamePartyRoster(app.db, input.chatId, meta, persona?.name ?? null, persona?.id);
          const partyRoster = roster
            ? {
                away: cardNames.filter((name) => !roster.has(normalizeCharacterLookupName(name))),
                sitsOut: cardNames.filter((name) => noncombatants.has(buildPartyNpcId(name))),
                idFor: (name: string) => roster.get(normalizeCharacterLookupName(name)) ?? "",
              }
            : undefined;
          const built = createRulesetFight({
            definition,
            seed: battlefield.seed,
            positioned: input.positioned === true,
            // The player sets the party down before the first turn (2026-10-24).
            deploy: true,
            environment: environment ?? null,
            formation: input.formation ?? null,
            ...(input.boardPack ? { pack: input.boardPack } : {}),
            ...(here ? { made: here } : battlefield.battlefield ? { battlefield: battlefield.battlefield } : {}),
            party: input.party.map((member) => ({
              id: member.id,
              name: member.name,
              ...(member.start ? { start: member.start } : {}),
            })),
            enemies: input.enemies.map((enemy, index) => ({
              id: enemy.id,
              name: enemy.name,
              ...(backAs[index]
                ? {
                    ...(backAs[index]!.creature !== undefined ? { creature: backAs[index]!.creature } : {}),
                    ...(backAs[index]!.tier !== undefined ? { tier: backAs[index]!.tier } : {}),
                    ...(backAs[index]!.proposed !== undefined ? { proposed: backAs[index]!.proposed } : {}),
                    ...(backAs[index]!.coins?.length ? { coins: backAs[index]!.coins } : {}),
                  }
                : {
                    ...(enemy.creature !== undefined ? { creature: enemy.creature } : {}),
                    ...(enemy.tier !== undefined ? { tier: enemy.tier } : {}),
                    ...(enemy.proposed !== undefined ? { proposed: enemy.proposed } : {}),
                  }),
              ...(enemy.creatureType !== undefined ? { creatureType: enemy.creatureType } : {}),
              ...(enemy.tactics ? { tactics: enemy.tactics } : {}),
              ...(enemyAdjusts[index] ? { adjust: enemyAdjusts[index] } : {}),
              boss: !!enemy.boss,
              ...(enemy.aiHints?.named ? { named: true } : {}),
              ...(enemy.aiHints?.mind ? { mind: enemy.aiHints.mind } : {}),
              ...(enemy.aiHints?.leader ? { leader: true } : {}),
              ...(enemy.start ? { start: enemy.start } : {}),
              ...(enemy.carrying ? { items: enemy.carrying } : {}),
              // Its attacks by name, and what may be its reactions, from the Game Master's own skills: a
              // heal names no strike, and a reaction word the Engine has none of ("Parry") is dropped as
              // the blueprint is read, so a skill that is no attack is looked for by name too (laptop
              // 2026-10-25).
              ...(enemy.skills?.length
                ? {
                    attacks: enemy.skills.map((skill) => ({
                      name: skill.name,
                      ...(skill.reaction ? { reaction: skill.reaction } : {}),
                      ...(skill.type !== "attack" ? { kind: skill.type } : {}),
                      ...(skill.spell ? { spell: true as const } : {}),
                      ...(skill.legendaryCost ? { legendary: skill.legendaryCost } : {}),
                      // What reaches more than one, and its own words, so a breath, a cone or a line is
                      // built as an area its targets save against (laptop playtest 2026-10-26).
                      ...(skill.areaRadius || skill.targetScope === "all-enemies" ? { area: true as const } : {}),
                      ...(skill.description ? { description: skill.description } : {}),
                    })),
                  }
                : {}),
              ...(enemy.boss?.points ? { points: enemy.boss.points } : {}),
              // Hurt in the story before the fight, by the hp the Game Master gave it; one that comes back
              // keeps the wounds it left with instead.
              ...(!backAs[index] && enemy.maxHp > 0 && enemy.hp > 0 && enemy.hp < enemy.maxHp
                ? { hurt: enemy.hp / enemy.maxHp }
                : {}),
            })),
            cards,
            playerName: persona?.name ?? null,
            ...(partyRoster ? { roster: partyRoster } : {}),
            // Companions fight on their own unless the game says the player plays them (Alyssa 2026-10-26).
            companionsOnTheirOwn: setup.playerRunsCompanions !== true,
            // In a shared room each player's own character is theirs to play (2026-10-26).
            // One not connected as it starts fights on their own until they take them back (2026-10-27).
            ...((players) =>
              players
                ? {
                    players,
                    othersPlay: ROOM_GUEST_FIGHT_CONTROLLER,
                    absent: [...(options.room?.absent(input.chatId) ?? [])],
                  }
                : {})(roomPlayersByName(meta)),
            live: parseStoredRulesetLive(liveRow?.rulesetLive),
            // What each member holds as the fight starts, when the ruleset's sheet reads items.
            ...(fightItems ? { items: fightItems, holders: rulesetCardHolder(cardNames, persona?.name ?? null) } : {}),
            // The ruleset's items, for what its opponents have on them (1.795).
            ...(itemBook ? { itemBook } : {}),
            partyCatalogs: await loadFightCatalogs(resolved.packageId, definition, (c) => partyLists.has(c.id)),
            bestiary: await loadBestiary(
              resolved.packageId,
              definition,
              proposedSheetLists(
                definition,
                // A foe that comes back is read off the sheet it was made with (laptop playtest
                // 2026-10-25: a returning Kallian's Dagger "in no catalog").
                input.enemies.map((enemy, index) =>
                  backAs[index]?.proposed !== undefined ? { ...enemy, proposed: backAs[index]!.proposed } : enemy,
                ),
              ),
            ),
            // Who the scene caught unaware (1.237).
            surprised: [...input.party, ...input.enemies].flatMap((one) => (one.surprised ? [one.id] : [])),
            // Who fights in its own lair (1.315).
            inLair: input.enemies.flatMap((one) => (one.inLair ? [one.id] : [])),
            // What was set up before it, standing as it begins (1.462).
            standing: [...input.party, ...input.enemies].flatMap((one) =>
              (one.standing ?? []).map((entry) => ({ casterId: one.id, ...entry })),
            ),
            ...(heldGround ? { heldGround } : {}),
            // The scene's time of day, for the light it is fought in (1.291).
            time: liveRow?.time ?? null,
            // The ruleset's encounter budget (1.803), for a fight the Game Master made up: a story's
            // fight is its author's, and one that comes back is as it was.
            ...(storyFight
              ? {}
              : {
                  budget: {
                    difficulty: normalizeGameDifficulty(setup.difficulty),
                    kept: input.enemies.flatMap((enemy, index) => (backAs[index] ? [enemy.id] : [])),
                  },
                }),
          });
          if (!built.ok) return reply.code(400).send({ error: built.error });
          if (standIns.length > 0) built.fight.adjustments.unshift(...standIns);
          if (reworded.length) built.fight.returnedFrom = reworded;
          const clockNow = gameClockMinutes(meta.gameTime);
          backAs.forEach((back, index) => {
            if (!back) return;
            const one = built.fight.encounter.combatants.find((c) => c.id === input.enemies[index]!.id);
            // Still missing what it got away without, never down for it, and its spent slots still
            // spent until it has rested (2026-10-25).
            if (one) rulesetBringBackFoe(definition, one, back, clockNow);
            // With the temperament it had, unless the story gives it another now.
            const unit = state.enemies.find((one) => one.id === input.enemies[index]!.id);
            const temperament = COMBAT_ADJECTIVES.find((word) => word === back.temperament);
            if (unit && temperament && !unit.aiHints?.temperament) {
              unit.aiHints = { ...unit.aiHints, temperament };
              if (unit.tactics) unit.tactics.adjective = temperament;
            }
            built.fight.adjustments.push(`${input.enemies[index]!.name} is the same one the party met before.`);
            logger.info("[combat-director/start] %s comes back as %s", input.enemies[index]!.name, back.name);
          });
          // The Engine's own party array follows the fight's: a sheet the setup left out joins it, a
          // member with no sheet leaves it, and a stand-in carries its card's name (2026-10-23 playtest).
          const fought = new Map(
            built.fight.encounter.combatants.flatMap((one) =>
              one.side === "party" ? [[one.id, one.name] as const] : [],
            ),
          );
          const template = state.party[0];
          state.party = state.party.filter((unit) => fought.has(unit.id));
          for (const unit of state.party) unit.name = fought.get(unit.id) ?? unit.name;
          for (const [id, name] of fought) {
            if (state.party.some((unit) => unit.id === id)) continue;
            state.party.push({
              id,
              name,
              hp: 1,
              maxHp: 1,
              attack: 0,
              defense: 0,
              speed: 0,
              level: 1,
              side: "player",
              ...(template?.controller ? { controller: template.controller } : {}),
            });
          }
          // Who the player last gave the Engine, or kept, in this chat's fights.
          const kept = rememberedControllers(meta);
          for (const id of fought.keys()) {
            const controller = kept[id];
            // What the host chose before never covers another room player's own character.
            const player = rulesetUnitPlayer(built.fight, id);
            if (controller && (!player || player.host)) built.fight.controllers[id] = controller;
          }
          // The one the player plays while their own character is dead is theirs, not the Engine's.
          if (built.standIn) built.fight.controllers[built.standIn] = "manual";
          // And the orders the player last gave each companion, where whom one protects is here too.
          const ordered = rememberedOrders(meta);
          for (const unit of state.party) {
            const orders = ordered[unit.id];
            if (unit.orders || !orders) continue;
            if (orders.protectId !== undefined && !state.party.some((one) => one.id === orders.protectId)) continue;
            unit.orders = orders;
          }
          state.rulesetFight = built.fight;
          // A party the Engine plays all of has nobody for the player to set down.
          if (built.fight.deploy && rulesetDeployers(state, built.fight).length === 0) rulesetBeginFight(built.fight);
          syncRulesetCombatants(definition, state);
          state.stage = rulesetDirectorStage(state);
          session = { definition, packageId: resolved.packageId };
        }
        const rowId = await store.create({
          chatId: input.chatId,
          messageId: input.anchor,
          swipeIndex: 0,
          gameType: COMBAT_DIRECTOR_NAMESPACE,
          schemaVersion: 1,
          state: JSON.stringify(state),
          committed: true,
        });
        state.instanceId = rowId;
        rememberFight(input.chatId, input.anchor);
        options.room?.changed(input.chatId);
        return { session: sessionView(state, session) };
      });
    } catch (err) {
      logger.warn(err, "Unable to start directed combat");
      return reply.code(400).send({ error: err instanceof Error ? err.message : "Invalid combat request." });
    }
  });
  app.get("/state", async (req, reply) => {
    const parsed = z.object({ chatId: key, anchor: key }).safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues[0]?.message });
    const { chatId, anchor } = parsed.data;
    try {
      const found = await load(chatId, anchor);
      if (!found) return reply.code(404).send({ error: "Battle not found." });
      await seatRoomPlayers(chatId, found.state);
      return { session: sessionView(found.state, await rulesetSessionFor(chatId, found.state)) };
    } catch (err) {
      logger.warn(err, "Unable to load directed combat");
      return reply.code(400).send({ error: err instanceof Error ? err.message : "Invalid combat save." });
    }
  });
  /** Held Ground let go in the step a fight just took (1.369): the story's year turns there and then,
   *  as the hymn's last verse is sung or the Year-Wheel breaks, and the felled and the Owing come due
   *  in the same round. The ground let go, for the caller to keep once the step is saved. */
  const letHeldGroundGo = async (
    chatId: string,
    s: CombatDirectorState,
    ruleset: RulesetDefinition | null,
  ): Promise<string | null> => {
    if (!ruleset) return null;
    const release = await heldGroundReleaseDueInFight(app.db, chatId, s);
    if (!release) return null;
    const answered = releaseRulesetHeldGround(ruleset, s, {
      felled: release.felled,
      ...(release.owing ? { owing: release.owing } : {}),
    });
    return answered.ok ? release.id : null;
  };
  /** Saves the step, keeping that it let Held Ground go only while the save does, so the story turn
   *  rolls nothing twice and skips nothing. */
  const saveLettingGo = async (
    rowId: string,
    chatId: string,
    s: CombatDirectorState,
    session: RulesetSession | null,
    ruleset: RulesetDefinition | null,
  ) => {
    const released = await letHeldGroundGo(chatId, s, ruleset);
    if (!released) return save(rowId, chatId, s, session);
    return keepHeldGroundReleasedWhile(app.db, chatId, released, () => save(rowId, chatId, s, session));
  };
  const commandBody = z.object({
    chatId: key,
    anchor: key,
    id: key,
    instanceId: key,
    revision: z.number().int().min(0),
    requestId: key,
    command,
    debugMode: z.boolean().optional(),
  });
  type CommandAnswer = { code: 200 | 400; body: Record<string, unknown> };
  /** One command, from the host's screen or (2026-10-27) a room player's through the room, checked
   *  against whose party member it moves. */
  const runCommand = async (
    input: z.infer<typeof commandBody>,
    commander: RulesetFightCommander,
  ): Promise<CommandAnswer> => {
    // Who the player hands to the Engine, or takes back, is kept for the chat's next fights too
    // (laptop party A 2026-10-25: companions back on Player at every fight).
    let controlled: Array<{ unitId: string; controller: "manual" | "ai" }> | undefined;
    let ordered: { unitId: string; orders: CombatOrders | null } | undefined;
    try {
      const result = await serialized(input.chatId, async () => {
        const found = await load(input.chatId, input.anchor);
        if (!found) throw new Error("Battle not found.");
        const { row, state } = found;
        if (state.id !== input.id) throw new Error("Battle changed. Reload its current state.");
        await seatRoomPlayers(input.chatId, state);
        const session = await rulesetSessionFor(input.chatId, state);
        const ruleset = session && "definition" in session ? session.definition : null;
        // Sent at a fight that has since moved on (another tab, a restart): nothing is done, and the
        // reply says so, so the client takes the fight as it stands rather than its own older copy.
        if (state.instanceId !== input.instanceId)
          return { session: sessionView(state, session, commander), stale: true };
        if (state.requests.includes(input.requestId)) return { session: sessionView(state, session, commander) };
        if (state.revision !== input.revision) return { session: sessionView(state, session, commander), stale: true };
        // A fight whose rules are gone changes nothing at all: it is already finished, and the view
        // says why.
        if (state.style === "ruleset" && !ruleset) return { session: sessionView(state, session, commander) };
        // In a shared room a party member is commanded by its own player only (2026-10-26): the host's
        // come through this route, a guest's through the room (2026-10-27).
        const notTheirs =
          ruleset && state.rulesetFight
            ? rulesetCommandRefusal(state, state.rulesetFight, input.command as DirectedCommand, commander)
            : null;
        if (notTheirs) return { refusal: notTheirs };
        const step = (command: DirectedCommand, source: "gm" | "ai" | "manual" | "fallback" = "manual") => {
          if (!ruleset) {
            commandCombatDirector(state, command, source);
            return null;
          }
          const answered = commandRulesetCombatDirector(ruleset, state, command, source);
          return answered.ok ? null : answered;
        };
        // A Game Master's decision a window waiting on somebody else stands over is put away, not asked.
        if (input.command.type === "continue" && ruleset && rulesetDecisionUnderWindow(state)) {
          step({ type: "continue" });
          state.requests = [...state.requests, input.requestId].slice(-256);
          return await saveLettingGo(row.id, input.chatId, state, session, ruleset);
        }
        const w = state.window;
        if (input.command.type === "continue" && w?.controller === "gm") {
          if (w.requestedAt && Date.now() - w.requestedAt < 12000)
            return { session: sessionView(state, session, commander) };
          if (w.requestedAt || state.gmCalls >= 12) {
            step({ type: "fallback" }, "fallback");
            state.requests = [...state.requests, input.requestId].slice(-256);
            return await saveLettingGo(row.id, input.chatId, state, session, ruleset);
          }
          w.requestedAt = Date.now();
          state.gmCalls++;
          await save(row.id, input.chatId, state, session);
          return { job: { rowId: row.id, state: structuredClone(state), windowId: w.id, revision: state.revision } };
        }
        if (input.command.type === "fallback" && w?.controller !== "gm")
          throw new Error("Only GM decisions use the fallback controller.");
        if (input.command.type === "choose" && w?.controller !== "manual")
          throw new Error("This decision belongs to the boss controller.");
        if (input.command.type === "ruleset" && !ruleset) throw new Error("Action does not match this combat mode.");
        // One of the ruleset's items that asks a check first has it rolled here, for whoever uses it,
        // with their sheet and the Engine's own dice (#6909); the fight is told only when they failed.
        const used =
          input.command.type === "classic" && input.command.action.type === "item"
            ? { name: input.command.action.itemId, unitId: state.actorId, action: input.command.action }
            : input.command.type === "tactical" && input.command.action.type === "item"
              ? {
                  name: input.command.action.itemName,
                  unitId: input.command.action.unitId,
                  action: input.command.action,
                }
              : null;
        const usedLine = used && !ruleset ? state.inventory.find((line) => line.name === used.name) : undefined;
        if (usedLine?.item && state.itemEffects.some((effect) => effect.name === usedLine.name && effect.ruleset)) {
          const who = state.party.find((unit) => unit.id === used!.unitId)?.name ?? "";
          const gate = await rollGameFightItemGate(app.db, input.chatId, who, usedLine.item);
          if (gate && !gate.success) (used!.action as { failed?: string }).failed = gate.line;
        }
        // A use that comes out of a fake does what the fake truly does (1.79); the fight lists it as what
        // it passes for, so only the stack it is spent from says so.
        const usedEffect = usedLine && state.itemEffects.find((effect) => effect.name === usedLine.name);
        if (usedLine && usedEffect) {
          const chat = await chats.getById(input.chatId);
          const uses = chat ? await loadGameFightUseEffects(app.db, JSON.parse(chat.metadata || "{}")) : null;
          const truly = uses?.effectOf(usedLine.ownName ?? usedLine.name, usedEffect);
          if (truly && truly !== usedEffect) (used!.action as { truly?: CombatItemEffect }).truly = truly;
        }
        // An item whose use costs a story number (1.359) is refused while the story cannot pay, and what
        // it spends is kept for the next story turn once the fight has taken it.
        const storyUse =
          ruleset && input.command.type === "ruleset" && state.rulesetFight
            ? storyUseOfOption(ruleset, state.rulesetFight.encounter, input.command.optionId)
            : null;
        let storySpend: Awaited<ReturnType<typeof checkStoryItemUse>> | null = null;
        if (storyUse) {
          const chat = await chats.getById(input.chatId);
          storySpend = await checkStoryItemUse(app.db, input.chatId, JSON.parse(chat?.metadata || "{}"), storyUse);
          if ("refusal" in storySpend) {
            return { refusal: { ok: false as const, error: storySpend.refusal, code: "ruleset_combat_story_cost" } };
          }
        }
        const refused = step(input.command as DirectedCommand);
        // A refusal changed nothing, so nothing is saved and no request id is spent on it.
        if (refused) return { refusal: refused };
        if (input.command.type === "control" && ruleset) controlled = [input.command];
        if (input.command.type === "controlCompanions" && ruleset && state.rulesetFight) {
          const controller = input.command.controller;
          controlled = rulesetCompanionIds(state, state.rulesetFight).map((unitId) => ({ unitId, controller }));
        }
        if (input.command.type === "orders" && ruleset) ordered = input.command;
        state.requests = [...state.requests, input.requestId].slice(-256);
        // What it spends is kept only while the step is saved: a save that fails takes it back.
        if (storySpend && "spend" in storySpend) {
          return await keepStorySpendWhile(app.db, input.chatId, storySpend.spend, () =>
            saveLettingGo(row.id, input.chatId, state, session, ruleset),
          );
        }
        return await saveLettingGo(row.id, input.chatId, state, session, ruleset);
      });
      if (ordered) {
        const { unitId, orders } = ordered;
        await chats
          .patchMetadata(
            input.chatId,
            (current) => {
              const kept: Record<string, CombatOrders> = { ...rememberedOrders(current) };
              if (orders) kept[unitId] = orders;
              else delete kept[unitId];
              return { [COMBAT_ORDERS_KEY]: kept };
            },
            { touchUpdatedAt: false },
          )
          .catch((err) => logger.warn(err, "Unable to remember a companion's orders"));
      }
      if (controlled?.length) {
        const chosen = Object.fromEntries(controlled.map(({ unitId, controller }) => [unitId, controller]));
        await chats
          .patchMetadata(
            input.chatId,
            (current) => ({
              [COMBAT_CONTROLLERS_KEY]: { ...rememberedControllers(current), ...chosen },
            }),
            { touchUpdatedAt: false },
          )
          .catch((err) => logger.warn(err, "Unable to remember a combat controller"));
      }
      if ("refusal" in result && result.refusal)
        return { code: 400, body: { error: result.refusal.error, code: result.refusal.code } };
      options.room?.changed(input.chatId);
      if ("session" in result) return { code: 200, body: result };
      const job = result.job;
      const abort = new AbortController();
      let timer: ReturnType<typeof setTimeout> | undefined;
      let candidateId: string | undefined;
      try {
        candidateId = await Promise.race([
          (options.chooseBoss ?? chooseGmCombatOption)(
            app.db,
            input.chatId,
            job.state,
            input.debugMode === true,
            abort.signal,
          ),
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => {
              abort.abort();
              reject(new Error("Boss decision timed out."));
              // Room for a model that thinks before it answers (2026-10-23 re-test: 10 s fell back).
            }, DECISION_TIMEOUT_MS.thinking);
          }),
        ]);
      } catch (err) {
        logger.warn(err, "Boss decision uses local fallback for chat %s", input.chatId);
      } finally {
        if (timer) clearTimeout(timer);
        abort.abort();
      }
      const answered = await serialized(input.chatId, async () => {
        const current = await load(input.chatId, input.anchor);
        if (!current) throw new Error("Battle no longer exists.");
        const session = await rulesetSessionFor(input.chatId, current.state);
        const ruleset = session && "definition" in session ? session.definition : null;
        // Row identity changes on checkpoint restore/branch; never apply a response from the old lineage.
        if (
          current.row.id !== job.rowId ||
          current.state.revision !== job.revision ||
          current.state.window?.id !== job.windowId ||
          (current.state.style === "ruleset" && !ruleset)
        ) {
          // Said, so a fight that stands still after a Game Master's answer is never a silent one.
          logger.info(
            "[game/combat] A boss decision for chat %s arrived after the fight moved on (revision %d, now %d) and was dropped",
            input.chatId,
            job.revision,
            current.state.revision,
          );
          return { session: sessionView(current.state, session, commander) };
        }
        const answer: DirectedCommand = candidateId ? { type: "choose", candidateId } : { type: "fallback" };
        const source = candidateId ? "gm" : "fallback";
        if (ruleset) {
          // An answer the menu does not hold costs the model its turn, not the fight: the Engine's
          // own picker takes it instead.
          const answered = commandRulesetCombatDirector(ruleset, current.state, answer, source);
          if (!answered.ok) {
            logger.warn(
              "[game/combat] The boss decision %s for chat %s was refused (%s); the Engine's own pick plays it",
              candidateId ?? "fallback",
              input.chatId,
              answered.code,
            );
            const fallback = commandRulesetCombatDirector(ruleset, current.state, { type: "fallback" }, "fallback");
            if (!fallback.ok)
              logger.warn("[game/combat] The fallback for chat %s was refused too (%s)", input.chatId, fallback.code);
          }
        } else commandCombatDirector(current.state, answer, source);
        current.state.requests = [...current.state.requests, input.requestId].slice(-256);
        return await saveLettingGo(current.row.id, input.chatId, current.state, session, ruleset);
      });
      options.room?.changed(input.chatId);
      return { code: 200, body: answered };
    } catch (err) {
      logger.warn(err, "Directed combat command rejected");
      return { code: 400, body: { error: err instanceof Error ? err.message : "Invalid combat action." } };
    }
  };
  app.post("/command", async (req, reply) => {
    const parsed = commandBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues[0]?.message });
    const answer = await runCommand(parsed.data, RULESET_ROOM_HOST);
    return answer.code === 200 ? answer.body : reply.code(400).send(answer.body);
  });
  const roomView: RoomFightBridge["view"] = async (chatId, viewer) => {
    const anchor = roomFights.get(chatId);
    const found = anchor ? await load(chatId, anchor) : null;
    if (!anchor || !found) return null;
    await seatRoomPlayers(chatId, found.state);
    return { anchor, view: sessionView(found.state, await rulesetSessionFor(chatId, found.state), viewer) };
  };
  options.room?.ready({
    view: roomView,
    async command(chatId, input, viewer) {
      let command = input.command;
      // A shape a guest aimed at a cell catches whoever the menu says it catches there.
      if (command.type === "ruleset" && command.at && command.targetIds.length === 0) {
        const { at, optionId } = command;
        const shown = await roomView(chatId, viewer);
        const aim = shown?.view.ruleset?.options
          ?.find((option) => option.id === optionId)
          ?.aim?.find((cell) => cell.x === at.x && cell.y === at.y);
        if (aim) command = { ...command, targetIds: aim.targetIds.slice(0, 20) };
      }
      const parsed = commandBody.safeParse({ chatId, ...input, command, requestId: randomUUID() });
      if (!parsed.success) return { ok: false, stale: false };
      const answer = await runCommand(parsed.data, viewer);
      if (answer.code !== 200) return { ok: false, stale: false };
      return answer.body.stale === true ? { ok: false, stale: true } : { ok: true };
    },
  });
}
