import { createGameStateStorage, parseStoredRulesetLive } from "../services/storage/game-state.storage.js";
import { normalizeGameDifficulty, combatWeatherSchema } from "@marinara-engine/shared";
import { resolveCombatWeather } from "../services/game/weather.service.js";
import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  TERRAIN_DATA,
  combatBossSchema,
  combatInterruptFields,
  combatTacticsSchema,
  combatAiHintsSchema,
  normalizeCharacterLookupName,
  rulesetBestiarySheetCatalogIds,
  rulesetCatalogIdsForBuild,
  rulesetCellBlocked,
  rulesetSheetBuildsByName,
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
  createRulesetFight,
  directedRulesetView,
  rulesetDirectorStage,
  rulesetFightLiveStates,
  syncRulesetCombatants,
  RULESET_COMBAT_EVENT_LIMIT,
  type RulesetFightState,
} from "../services/game/ruleset-combat-director.service.js";
import { loadRulesetRegistry, resolveGameRuleset } from "../services/game/ruleset-registry.service.js";
import { loadRulesetCatalogEntries } from "../services/game/ruleset-catalog.service.js";
import { resolveTacticalStartPreferences } from "../services/game/tactical-battlefield.service.js";
import { logger } from "../lib/logger.js";
import { resolveVisibleGameStateAnchor } from "./generate/generate-route-utils.js";

// Host-owned Experience namespace: existing branch/checkpoint/export paths preserve these rows,
// while turn-game readers and resets already exclude the entire experience: prefix.
export const COMBAT_DIRECTOR_NAMESPACE = "experience:marinara-engine.combat";
const key = z
  .string()
  .min(1)
  .max(256)
  .refine((v) => !["__proto__", "constructor", "prototype"].includes(v));
const num = z.number().finite().min(0).max(1000000);
const slots = z.record(z.string().regex(/^[1-9]$/), z.number().int().min(0).max(100));
const skill = z.object({
  id: key,
  name: z.string().min(1).max(200),
  type: z.enum(["attack", "heal", "buff", "debuff"]),
  mpCost: num,
  power: num.max(20),
  cooldown: z.number().int().min(0).max(100).optional(),
  description: z.string().max(3000).optional(),
  element: z.string().max(100).optional(),
  statusEffect: z.string().max(200).optional(),
  ...combatInterruptFields,
});
const directedCombatantFields = z.object({
  id: key,
  name: z.string().min(1).max(200),
  side: z.enum(["player", "enemy"]),
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
  controller: z.enum(["manual", "ai"]).optional(),
  skillCooldowns: z.record(z.number().int().min(0).max(100)).optional(),
  statusEffects: z
    .array(
      z.object({
        name: z.string().max(200),
        modifier: z.number().finite().min(-100000).max(100000),
        stat: z.enum(["hp", "attack", "defense", "speed"]),
        turnsLeft: z.number().int().min(0).max(100),
      }),
    )
    .max(64)
    .optional(),
  projectile: z.boolean().optional(),
  requiresSight: z.boolean().optional(),
  combatClass: z.string().max(100).optional(),
  movementMode: z.enum(["walk", "fly", "teleport"]).optional(),
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
    tier: key.optional(),
    /** A stat block in the shared creature form. Checked when the fight is built, so a malformed
     *  one costs its opponent its proposal rather than costing the whole battle. */
    proposed: z.unknown().optional(),
  })
  .refine(resourcePools, "Invalid resource pool.");
const coord = z.object({ x: z.number().int().min(0).max(63), y: z.number().int().min(0).max(63) });
const itemEffect = z.object({
  name: key,
  target: z.enum(["self", "ally", "enemy", "any"]),
  type: z.enum(["heal", "damage", "buff", "debuff", "status", "utility"]),
  description: z.string().max(3000),
  power: num.max(100).optional(),
  element: z.string().max(100).optional(),
  consumes: z.boolean().optional(),
  status: z
    .object({
      name: key,
      emoji: z.string().max(30),
      duration: z.number().int().min(1).max(100),
      modifier: z.number().finite().min(-100000).max(100000).optional(),
      stat: z.enum(["hp", "attack", "defense", "speed"]).optional(),
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
    /** Where the `move` option walks to, and the cell a shape is aimed at. Both are checked against
     *  the menu by the resolver; this only bounds them to a board's own size. */
    to: coord.optional(),
    at: coord.optional(),
  }),
  z.object({ type: z.literal("choose"), candidateId: key }),
  z.object({ type: z.literal("continue") }),
  z.object({ type: z.literal("fallback") }),
  z.object({ type: z.literal("flee") }),
  z.object({ type: z.literal("control"), unitId: key, controller: z.enum(["manual", "ai"]) }),
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
  const wanted = (c: NonNullable<RulesetDefinition["catalogs"]>[number]) =>
    marked.has(c.id) || (c.feeds ?? []).some((list) => proposedLists.has(list));
  if (marked.size === 0 && proposedLists.size === 0) return creatures;
  return { ...creatures, ...(await loadFightCatalogs(packageId, definition, wanted)) };
}

/** The lists the Game Master's invented sheets fill, read off the raw proposals: which catalogs a
 *  fight needs is decided before any proposal is parsed. */
function proposedSheetLists(enemies: ReadonlyArray<{ proposed?: unknown }>): Set<string> {
  const lists = new Set<string>();
  for (const enemy of enemies) {
    const sheet = (enemy.proposed as { sheet?: { lists?: unknown } } | undefined)?.sheet;
    if (sheet?.lists && typeof sheet.lists === "object") for (const id of Object.keys(sheet.lists)) lists.add(id);
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

export async function combatDirectorRoutes(
  app: FastifyInstance,
  options: { chooseBoss?: typeof chooseGmCombatOption } = {},
) {
  const chats = createChatsStorage(app.db),
    store = createGameEngineStateStorage(app.db);
  const load = async (chatId: string, anchor: string) => {
    const row = await store.getByChatAndMessage(chatId, anchor, 0, COMBAT_DIRECTOR_NAMESPACE);
    if (!row) return null;
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
      inventory: z.array(z.object({ name: key, quantity: z.number().int().min(0).max(10000) })).max(200),
      itemSpends: z.record(key, z.number().int().min(0).max(10000)),
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
            .array(z.object({ seq: z.number().int().min(0), event: z.unknown() }))
            .max(RULESET_COMBAT_EVENT_LIMIT),
          controllers: z.record(key, z.enum(["manual", "ai"])),
          bosses: z.array(key).max(40),
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
        )
      )
        throw new Error("Invalid battlefield in save.");
      // Everybody on the board or nobody: a fight with one combatant standing nowhere could answer
      // nothing about distance, and the resolver builds one only when it can place them all.
      const placed = state.rulesetFight!.encounter.combatants.filter(
        (combatant) => typeof combatant.x === "number" || typeof combatant.y === "number",
      );
      if (placed.length !== state.rulesetFight!.encounter.combatants.length) throw new Error("Invalid saved position.");
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
      // square, which is the resolver's own doing.
      for (const combatant of placed) {
        if (rulesetCellBlocked(grid, combatant.x!, combatant.y!)) throw new Error("Invalid saved position.");
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
        )
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
  /** The session a client reads. A ruleset fight whose rules are gone comes back finished rather
   *  than resolved by other numbers, and nothing about that is written down: reinstalling the
   *  ruleset picks the same fight up where it was left. */
  const sessionView = (s: CombatDirectorState, session: RulesetSession | null): DirectedCombatView => {
    const fight = s.rulesetFight;
    if (s.style !== "ruleset" || !fight) return combatDirectorView(s);
    if (session && "definition" in session) {
      const view = combatDirectorView(s);
      view.stage = rulesetDirectorStage(s);
      view.ruleset = directedRulesetView(session.definition, s);
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
    await withChatMetadataPatchQueue(chatId, () =>
      app.db.transaction(async () => {
        const previous = await load(chatId, s.anchor);
        if (!previous || previous.row.id !== rowId) throw new Error("Battle changed while saving.");
        const deltas = Object.entries(s.itemSpends)
          .map(([name, count]) => ({ name, count: count - (previous.state.itemSpends[name] ?? 0) }))
          .filter((d) => d.count > 0);
        if (deltas.length)
          await chats.patchMetadata(
            chatId,
            (meta) => {
              const inventory = Array.isArray(meta.gameInventory)
                ? (structuredClone(meta.gameInventory) as Array<{ name: string; quantity: number }>)
                : [];
              for (const d of deltas) {
                const item = inventory.find((i) => i.name === d.name);
                if (!item || item.quantity < d.count) throw new Error("Inventory changed. Reload the battle.");
                item.quantity -= d.count;
              }
              return { gameInventory: inventory };
            },
            { metadataQueueHeld: true },
          );
        if (s.style === "ruleset" && s.rulesetFight) live = await writeRulesetLive(chatId, s.anchor, s.rulesetFight);
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
        party: z.array(directedCombatantSchema).min(1).max(20),
        enemies: z.array(rulesetOpponentSchema).min(1).max(20),
        environment: z.string().max(80).optional(),
        formation: z.string().max(80).optional(),
        battlefield: z.unknown().optional(),
        /** Whether a ruleset fight is fought on a board, which is what the game's Tactical combat
         *  preference asks for. The ruleset still has to say what a cell is worth. */
        positioned: z.boolean().optional(),
        mechanics: z
          .array(
            z.object({
              name: key,
              description: z.string().max(3000),
              ownerName: z.string().max(200).optional(),
              trigger: z.enum(["round_interval", "hp_threshold", "on_hit", "on_attack", "passive"]),
              interval: z.number().int().min(1).max(100).optional(),
              hpThreshold: z.number().min(0).max(100).optional(),
              counterplay: z.string().max(3000).optional(),
              effectType: z
                .enum(["damage_all", "damage_one", "buff_self", "debuff_party", "status_party", "status_enemy"])
                .optional(),
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
              quantity: z.number().int().min(0).max(10000),
              description: z.string().max(2000).optional(),
            }),
          )
          .max(200)
          .default([]),
      })
      .safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues[0]?.message });
    const input = parsed.data;
    try {
      return await serialized(input.chatId, async () => {
        const chat = await chats.getById(input.chatId);
        if (!chat) return reply.code(404).send({ error: "Chat not found." });
        const anchor = await chats.getMessage(input.anchor);
        if (!anchor || anchor.chatId !== input.chatId)
          return reply.code(400).send({ error: "Battle anchor is not in this chat." });
        const existing = await load(input.chatId, input.anchor);
        if (existing)
          return { session: sessionView(existing.state, await rulesetSessionFor(input.chatId, existing.state)) };
        const meta = JSON.parse(chat.metadata || "{}"),
          setup = meta.gameSetupConfig ?? {};
        if (setup.combatDirector !== true)
          return reply.code(400).send({ error: "Directed combat is not enabled for this game." });
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
        const state = createCombatDirector({
          ...input,
          inventory: Array.isArray(meta.gameInventory) ? meta.gameInventory : [],
          party: input.party as Combatant[],
          // What the fight is RESOLVED by is read below and never stored on the Engine's own units.
          enemies: input.enemies.map(({ creature: _c, tier: _t, proposed: _p, ...unit }) => unit) as Combatant[],
          id: randomUUID(),
          gm: setup.gmBossControl === true,
          difficulty: normalizeGameDifficulty(setup.difficulty),
          weather: resolveCombatWeather(weatherSource, input.environment, battlefield.battlefield?.exposure),
          seed: battlefield.seed,
          battlefield: battlefield.battlefield,
        });
        let session: RulesetSession | null = null;
        if (input.style === "ruleset") {
          const resolved = resolveGameRuleset(meta, await loadRulesetRegistry());
          if (resolved.status !== "ok")
            return reply.code(400).send({ error: "This game does not pin a ruleset this install can read." });
          const definition = resolved.definition;
          if (!definition.combat)
            return reply.code(400).send({ error: "This game's ruleset does not resolve its own fights." });
          const setupPersonaId = (setup as { personaId?: string | null }).personaId ?? null;
          const personaId = chat.personaId || setupPersonaId;
          const persona = personaId ? await createCharactersStorage(app.db).getPersona(personaId) : null;
          const cards = meta.gameCharacterCards;
          const builds = rulesetSheetBuildsByName(cards, persona?.name ?? null);
          const partyLists = new Set(
            input.party.flatMap((member) => {
              const build = builds.get(normalizeCharacterLookupName(member.name));
              return build ? rulesetCatalogIdsForBuild(definition, build) : [];
            }),
          );
          const built = createRulesetFight({
            definition,
            seed: battlefield.seed,
            positioned: input.positioned === true,
            environment: input.environment ?? null,
            formation: input.formation ?? null,
            ...(battlefield.battlefield ? { battlefield: battlefield.battlefield } : {}),
            party: input.party.map((member) => ({ id: member.id, name: member.name })),
            enemies: input.enemies.map((enemy) => ({
              id: enemy.id,
              name: enemy.name,
              ...(enemy.creature !== undefined ? { creature: enemy.creature } : {}),
              ...(enemy.tier !== undefined ? { tier: enemy.tier } : {}),
              ...(enemy.proposed !== undefined ? { proposed: enemy.proposed } : {}),
              boss: !!enemy.boss,
            })),
            cards,
            playerName: persona?.name ?? null,
            live: parseStoredRulesetLive((await visibleLiveRow(input.chatId)).row?.rulesetLive),
            partyCatalogs: await loadFightCatalogs(resolved.packageId, definition, (c) => partyLists.has(c.id)),
            bestiary: await loadBestiary(resolved.packageId, definition, proposedSheetLists(input.enemies)),
          });
          if (!built.ok) return reply.code(400).send({ error: built.error });
          state.rulesetFight = built.fight;
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
      return found
        ? { session: sessionView(found.state, await rulesetSessionFor(chatId, found.state)) }
        : reply.code(404).send({ error: "Battle not found." });
    } catch (err) {
      logger.warn(err, "Unable to load directed combat");
      return reply.code(400).send({ error: err instanceof Error ? err.message : "Invalid combat save." });
    }
  });
  app.post("/command", async (req, reply) => {
    const parsed = z
      .object({
        chatId: key,
        anchor: key,
        id: key,
        instanceId: key,
        revision: z.number().int().min(0),
        requestId: key,
        command,
        debugMode: z.boolean().optional(),
      })
      .safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues[0]?.message });
    const input = parsed.data;
    try {
      const result = await serialized(input.chatId, async () => {
        const found = await load(input.chatId, input.anchor);
        if (!found) throw new Error("Battle not found.");
        const { row, state } = found;
        if (state.id !== input.id) throw new Error("Battle changed. Reload its current state.");
        const session = await rulesetSessionFor(input.chatId, state);
        const ruleset = session && "definition" in session ? session.definition : null;
        if (state.instanceId !== input.instanceId) return { session: sessionView(state, session) };
        if (state.requests.includes(input.requestId)) return { session: sessionView(state, session) };
        if (state.revision !== input.revision) return { session: sessionView(state, session) };
        // A fight whose rules are gone changes nothing at all: it is already finished, and the view
        // says why.
        if (state.style === "ruleset" && !ruleset) return { session: sessionView(state, session) };
        const step = (command: DirectedCommand, source: "gm" | "ai" | "manual" | "fallback" = "manual") => {
          if (!ruleset) {
            commandCombatDirector(state, command, source);
            return null;
          }
          const answered = commandRulesetCombatDirector(ruleset, state, command, source);
          return answered.ok ? null : answered;
        };
        const w = state.window;
        if (input.command.type === "continue" && w?.controller === "gm") {
          if (w.requestedAt && Date.now() - w.requestedAt < 12000) return { session: sessionView(state, session) };
          if (w.requestedAt || state.gmCalls >= 12) {
            step({ type: "fallback" }, "fallback");
            state.requests = [...state.requests, input.requestId].slice(-256);
            return await save(row.id, input.chatId, state, session);
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
        const refused = step(input.command as DirectedCommand);
        // A refusal changed nothing, so nothing is saved and no request id is spent on it.
        if (refused) return { refusal: refused };
        state.requests = [...state.requests, input.requestId].slice(-256);
        return await save(row.id, input.chatId, state, session);
      });
      if ("refusal" in result && result.refusal)
        return reply.code(400).send({ error: result.refusal.error, code: result.refusal.code });
      if ("session" in result) return result;
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
            }, 10000);
          }),
        ]);
      } catch (err) {
        logger.warn(err, "Boss decision uses local fallback for chat %s", input.chatId);
      } finally {
        if (timer) clearTimeout(timer);
        abort.abort();
      }
      return await serialized(input.chatId, async () => {
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
        )
          return { session: sessionView(current.state, session) };
        const answer: DirectedCommand = candidateId ? { type: "choose", candidateId } : { type: "fallback" };
        const source = candidateId ? "gm" : "fallback";
        if (ruleset) {
          // An answer the menu does not hold costs the model its turn, not the fight: the Engine's
          // own picker takes it instead.
          const answered = commandRulesetCombatDirector(ruleset, current.state, answer, source);
          if (!answered.ok) commandRulesetCombatDirector(ruleset, current.state, { type: "fallback" }, "fallback");
        } else commandCombatDirector(current.state, answer, source);
        current.state.requests = [...current.state.requests, input.requestId].slice(-256);
        return await save(current.row.id, input.chatId, current.state, session);
      });
    } catch (err) {
      logger.warn(err, "Directed combat command rejected");
      return reply.code(400).send({ error: err instanceof Error ? err.message : "Invalid combat action." });
    }
  });
}
