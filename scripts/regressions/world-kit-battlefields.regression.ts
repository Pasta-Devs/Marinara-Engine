/**
 * A setting's battlefields (worldgen W6d).
 *
 *   - A game without a kit (or a kit that names none) is asked for exactly the engine's sixteen scenes,
 *     as before; a kit's scenes are asked for by its own words and laid out like the battlefield each
 *     names, never dropped as unknown.
 *   - The map prompt's examples, the passive perception hints and the board's tile words read the
 *     setting; no game hears war drums it does not have.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  WORLD_DEFAULT_BATTLEFIELDS,
  WORLD_STARTER_KITS,
  createConnectionSchema,
  gameWorldBattlefields,
  parseWorldKit,
  rulesetSheetBuildSchema,
  worldBattlefields,
  worldSceneLike,
} from "../../packages/shared/src/index.js";
import type { DirectedCombatView } from "../../packages/shared/src/features/combat-director.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-world-battlefields-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { default: Fastify } = await import("../../packages/server/node_modules/fastify/fastify.js");
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { createGameRulesetsStorage } =
  await import("../../packages/server/src/services/storage/game-rulesets.storage.js");
const { gameRoutes } = await import("../../packages/server/src/routes/game.routes.js");
const { buildInitPrompt, encounterRoutes } = await import("../../packages/server/src/routes/encounter.routes.js");
const { combatDirectorRoutes } = await import("../../packages/server/src/routes/combat-director.routes.js");
const { injectGameGmPromptRuntime } =
  await import("../../packages/server/src/services/generation/game-gm-prompt-runtime.js");
const { buildGmSceneState } = await import("../../packages/server/src/services/game/gm-prompts.js");
const { buildMapGenerationPrompt } = await import("../../packages/server/src/services/game/map.service.js");
const { generatePerceptionHints } = await import("../../packages/server/src/services/game/perception.service.js");
const { buildWorldKitWritingPrompt } = await import("../../packages/server/src/services/game/world-kit-writer.js");

const kits = WORLD_STARTER_KITS.map((input) => {
  const parsed = parseWorldKit(input);
  assert.ok(parsed.ok, parsed.ok ? "" : parsed.issues.join("; "));
  return parsed.kit;
});
const kitById = (id: string) => kits.find((kit) => kit.id === id)!;
const cyber = worldBattlefields(kitById("cyberpunk"));
const fiveE = JSON.parse(
  readFileSync(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url), "utf8"),
) as Record<string, unknown>;
const fighterBuild = rulesetSheetBuildSchema.parse({
  abilities: { str: 18, dex: 14, con: 16, int: 10, wis: 10, cha: 10 },
  fields: { level: 3, ac: 14, speed: 30, hp_max: 30 },
  lists: { attacks: [{ name: "Longsword", ability: "str", proficient: true, bonus: 0, damage: "1d8" }] },
});

try {
  // ── The engine's own sixteen, as before ──
  assert.equal(worldBattlefields(kitById("high_fantasy")), WORLD_DEFAULT_BATTLEFIELDS);
  assert.equal(gameWorldBattlefields({}), undefined);
  assert.equal(gameWorldBattlefields({ gameWorldKit: kitById("high_fantasy") }), undefined);
  const prompt = (fields?: ReturnType<typeof worldBattlefields>) =>
    buildInitPrompt("Ada", "", "", [], "", "", true, undefined, null, { guess: true, ruleset: [] }, undefined, fields)
      .map((message) => message.content)
      .join("\n");
  assert.match(
    prompt(),
    /"environmentType": "forest\|dungeon\|desert\|cave\|city\|ruins\|snow\|water\|castle\|wasteland\|plains\|mountains\|swamp\|volcanic\|spaceship\|mansion"/,
    "a game without a kit is asked exactly what it always was",
  );

  // ── A kit's scenes by its own words, laid out like the battlefield each names ──
  assert.match(prompt(cyber), /"environmentType": "Neon street\|Rooftop\|Megablock corridor\|/);
  assert.match(
    prompt(cyber),
    /in this setting plains is Open ground, forest is Cover, mountain is Tower, ruin is Debris/,
  );
  assert.doesNotMatch(prompt(), /in this setting/, "a game without a kit has no tile words to learn");
  assert.doesNotMatch(
    prompt(worldBattlefields({ ...kitById("cyberpunk"), tiles: undefined })),
    /in this setting/,
    "nor one whose kit names only scenes",
  );
  assert.equal(worldSceneLike(cyber, "neon STREET"), "city");
  assert.equal(worldSceneLike(cyber, "Rooftop"), "plains");
  assert.equal(worldSceneLike(cyber, "forest"), "forest", "an engine scene is still itself");
  assert.equal(worldSceneLike(cyber, "Moon base"), undefined);
  assert.equal(cyber.tiles.forest, "Cover");
  assert.equal(worldBattlefields({ ...kitById("cyberpunk"), tiles: { forest: "Cover" } }).tiles.wall, "Wall");
  const shallows = { ...kitById("high_fantasy"), tiles: { water: "Shallows" } };
  assert.equal(worldBattlefields(shallows).tiles.water, "Shallows", "a kit may name only its tiles");
  assert.equal(worldBattlefields(shallows).scenes, WORLD_DEFAULT_BATTLEFIELDS.scenes);
  assert.equal(gameWorldBattlefields({ gameWorldKit: shallows })?.tiles.water, "Shallows");

  // ── The map prompt's examples are the setting's places ──
  const plainMap = buildMapGenerationPrompt("overworld", "x");
  assert.match(plainMap, /outdoor areas \(overworld, city, forest, etc\.\)/);
  assert.match(plainMap, /"name": "Dungeon Name"/);
  const cyberMap = buildMapGenerationPrompt("street", "x", cyber);
  assert.match(cyberMap, /outdoor areas \(Neon street, Rooftop, Abandoned factory, etc\.\)/);
  assert.match(cyberMap, /indoor areas \(Megablock corridor, Corporate tower, Undercity tunnels, etc\.\)/);
  assert.doesNotMatch(cyberMap, /Dungeon|Dense Forest/);

  // ── Passive perception reads the setting's places and hears no war drums ──
  const sharp = {
    perceptionMod: 10,
    wisdomScore: 18,
    gameState: "exploration",
    weather: null,
    timeOfDay: null,
    presentNpcNames: [],
  };
  const hints = (location: string, scenes?: typeof cyber.scenes, dangerLevel = 0) =>
    generatePerceptionHints({ ...sharp, location, dangerLevel, ...(scenes ? { scenes } : {}) }).map(
      (hint) => hint.text,
    );
  assert.ok(
    hints("Megablock corridor 7", cyber.scenes).some((text) => /hidden passage/.test(text)),
    "enclosed by its scene",
  );
  assert.ok(!hints("Megablock corridor 7").some((text) => /hidden passage/.test(text)), "not without the setting");
  assert.ok(
    hints("the old sewer").some((text) => /hidden passage/.test(text)),
    "modern words count too",
  );
  assert.ok(hints("Neon street", cyber.scenes).some((text) => /conversation/.test(text)));
  assert.ok(hints("the old wilderness").some((text) => /broken twigs/.test(text)));
  for (const plain of ["a small hamlet", "the barren dunes", "an examined spark"]) {
    assert.deepEqual(hints(plain), [], `${plain} is no kind of place the words name`);
  }
  // Only two hints a turn: a dull ear misses the two milder danger hints and hears this one.
  const dull = generatePerceptionHints({
    ...sharp,
    perceptionMod: 0,
    wisdomScore: 10,
    location: "nowhere",
    dangerLevel: 0.8,
  });
  assert.deepEqual(
    dull.map((hint) => hint.text),
    ["hears distant sounds that suggest danger ahead"],
    "no war drums in a game that has none",
  );

  // ── Through the routes: the model's blueprint and map, a fight's board, a directed fight, a turn ──
  const replies: string[] = [];
  const requests: Array<{ messages: Array<{ role: string; content: string }> }> = [];
  const standIn = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const body = JSON.parse(Buffer.concat(chunks).toString());
    requests.push(body);
    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        id: "stand-in",
        model: body.model,
        choices: [
          { index: 0, finish_reason: "stop", message: { role: "assistant", content: replies.shift() ?? "{}" } },
        ],
      }),
    );
  });
  await new Promise<void>((resolve) => standIn.listen(0, "127.0.0.1", resolve));
  const address = standIn.address();
  assert.ok(address && typeof address !== "string");
  const db = await getDB();
  const app = Fastify();
  app.decorate("db", db);
  await app.register(gameRoutes, { prefix: "/api/game" });
  await app.register(encounterRoutes, { prefix: "/api/encounter" });
  await app.register(combatDirectorRoutes, { prefix: "/api/game/combat/director" });
  try {
    const connection = await createConnectionsStorage(db).create(
      createConnectionSchema.parse({
        name: "Stand-in",
        provider: "custom",
        baseUrl: `http://127.0.0.1:${address.port}/v1`,
        model: "stand-in",
        apiKey: "sk-stand-in",
      }),
    );
    const chats = createChatsStorage(db);
    const game = async (metadata: Record<string, unknown>) => {
      const chat = await chats.create({ name: "Board", mode: "game", characterIds: [], connectionId: connection!.id });
      const anchor = await chats.createMessage({ chatId: chat.id, role: "assistant", content: "[state: combat]" });
      await chats.patchMetadata(chat.id, metadata);
      return { chatId: chat.id, anchor: anchor.id };
    };
    const asked = async (url: string, payload: Record<string, unknown>) => {
      requests.length = 0;
      await app.inject({ method: "POST", url, payload: { ...payload, connectionId: connection!.id } });
      assert.equal(requests.length, 1, `${url} reached the model`);
      return requests[0]!.messages.map((message) => message.content).join("\n");
    };
    const cyberGame = { gameWorldKit: kitById("cyberpunk") };

    // The model building a fight is asked for the setting's scenes; a game without a kit, the sixteen.
    const blueprint = async (metadata: Record<string, unknown>) =>
      asked("/api/encounter/init", { chatId: (await game(metadata)).chatId, settings: {} });
    assert.match(await blueprint(cyberGame), /"environmentType": "Neon street\|Rooftop\|/);
    assert.match(await blueprint({}), /"environmentType": "forest\|dungeon\|desert\|/);

    // A map is drawn with the setting's places as its examples.
    const map = async (metadata: Record<string, unknown>) =>
      asked("/api/game/map/generate", { chatId: (await game(metadata)).chatId, locationType: "street", context: "x" });
    assert.match(await map(cyberGame), /outdoor areas \(Neon street, Rooftop, Abandoned factory, etc\.\)/);
    assert.match(await map({}), /outdoor areas \(overworld, city, forest, etc\.\)/);

    // A tactical fight lays the setting's scene out like the battlefield it names, and its weather
    // knows a rooftop is out in the rain.
    const fighter = (id: string, side: "player" | "enemy") => ({
      id,
      name: id,
      side,
      hp: 30,
      maxHp: 30,
      attack: 5,
      defense: 5,
      speed: 5,
      level: 1,
      skills: [],
    });
    const start = async (metadata: Record<string, unknown>, environment: string) => {
      const response = await app.inject({
        method: "POST",
        url: "/api/game/combat/tactical/start",
        payload: {
          chatId: (await game({ ...metadata, gameWeather: { type: "rain" } })).chatId,
          party: [fighter("Hero", "player")],
          enemies: [fighter("Thug", "enemy")],
          seed: 3,
          environment,
        },
      });
      assert.equal(response.statusCode, 200, response.body);
      return (response.json() as { state: { environment?: string; weather?: { exposure?: string } } }).state;
    };
    const rooftop = await start(cyberGame, "Rooftop");
    assert.equal(rooftop.environment, "plains");
    assert.equal(rooftop.weather?.exposure, "exposed");
    assert.equal((await start(cyberGame, "Megablock corridor")).environment, "dungeon");
    assert.equal((await start({}, "forest")).environment, "forest", "an engine scene without a kit, as before");
    assert.equal(
      (await start({}, "Rooftop")).environment,
      undefined,
      "an unknown word without a kit still normalizes away",
    );

    // A directed fight does the same, on a tactical board and on a ruleset's.
    const directed = async (metadata: Record<string, unknown>, payload: Record<string, unknown>) => {
      const { chatId, anchor } = await game({
        ...metadata,
        gameSetupConfig: { combatDirector: true, tacticalBattlefield: { seed: 9, size: "small" } },
        gameWeather: { type: "rain" },
      });
      const response = await app.inject({
        method: "POST",
        url: "/api/game/combat/director/start",
        payload: { chatId, anchor, ...payload },
      });
      assert.equal(response.statusCode, 200, response.body);
      return response.json().session as DirectedCombatView;
    };
    const corridor = await directed(cyberGame, {
      style: "tactical",
      party: [fighter("Hero", "player")],
      enemies: [fighter("Thug", "enemy")],
      environment: "Megablock corridor",
    });
    assert.equal(corridor.tactical?.environment, "dungeon");
    assert.equal(corridor.weather?.exposure, "sheltered", "a corridor keeps the rain off");
    await createGameRulesetsStorage(db).put({
      rulesetId: "local/5e-board",
      version: 1,
      sourceKind: "local",
      definition: JSON.stringify({ ...fiveE, id: "5e-board" }),
    });
    const board = async (metadata: Record<string, unknown>, environment: string) =>
      (
        await directed(
          {
            ...metadata,
            gameRuleset: { id: "local/5e-board", version: 1, packageId: null, options: {} },
            gameCharacterCards: [{ name: "Brenna", rulesetSheet: { v: 1, build: fighterBuild } }],
          },
          {
            style: "ruleset",
            positioned: true,
            party: [fighter("Brenna", "player")],
            enemies: [{ ...fighter("Lurker", "enemy"), creature: "creatures/thorn-lurker" }],
            environment,
          },
        )
      ).ruleset?.grid?.tiles;
    // A directed fight draws its board's seed at random; the same seed shows what the scene changes.
    const random = Math.random;
    Math.random = () => 0.25;
    try {
      const laidOut = await board(cyberGame, "Megablock corridor");
      assert.ok(laidOut);
      assert.deepEqual(laidOut, await board({}, "dungeon"), "a ruleset board is laid out like the scene's battlefield");
      assert.notDeepEqual(laidOut, await board({}, "Megablock corridor"));
    } finally {
      Math.random = random;
    }

    // A turn's passive perception reads the setting's places. It reaches the GM in the scene state.
    const turn = async (chatMetadata: Record<string, unknown>) => {
      const messages = [{ role: "system", content: "placeholder" }];
      const { gmCtx } = await injectGameGmPromptRuntime({
        messages,
        chatId: "battlefields",
        chat: {},
        chatMetadata,
        characterIds: [],
        chars: { getById: async () => null, getPersona: async () => null },
        chats: { getById: async () => null, updateMetadata: async () => undefined },
        selectedGameStateSnapshotPromise: Promise.resolve({
          playerStats: { skills: { Perception: 10 }, attributes: { wis: 18 } },
          location: "Megablock corridor 7",
          presentCharacters: [],
        }),
        mappedMessages: [],
        personaName: "Player",
        resolvePromptMacros: (value: string) => value,
      } as unknown as Parameters<typeof injectGameGmPromptRuntime>[0]);
      return [...messages.map((message) => message.content), buildGmSceneState(gmCtx)].join("\n");
    };
    assert.match(await turn(cyberGame), /hidden passage/);
    assert.doesNotMatch(await turn({}), /hidden passage/);
  } finally {
    await app.close();
    await closeDB();
    await new Promise<void>((resolve) => standIn.close(() => resolve()));
  }

  // ── A kit's battlefields are checked; the model is asked for them ──
  const base = structuredClone(WORLD_STARTER_KITS.find((kit) => kit.id === "cyberpunk")!);
  assert.ok(
    !parseWorldKit({ ...base, scenes: [{ label: "Moon base", like: "moon" }] }).ok,
    "a scene is like an engine battlefield",
  );
  assert.ok(!parseWorldKit({ ...base, tiles: { lava: "Lava" } }).ok, "only the six tiles");
  // A word the model picks from a list or reads in quotes never holds the list's "|" or a quote.
  for (const bad of ["Roof|top", 'The "Pit"']) {
    assert.ok(!parseWorldKit({ ...base, scenes: [{ label: bad, like: "plains" }] }).ok, `scene ${bad}`);
    assert.ok(!parseWorldKit({ ...base, tiles: { plains: bad } }).ok, `tile ${bad}`);
    assert.ok(!parseWorldKit({ ...base, elements: [{ label: bad }], reactions: undefined }).ok, `element ${bad}`);
  }
  assert.ok(!parseWorldKit({ ...base, scenes: [] }).ok, "a kit that names scenes names one at least");
  const twice = parseWorldKit({
    ...base,
    scenes: [
      { label: "Rooftop", like: "plains" },
      { label: " rooftop", like: "city" },
    ],
  });
  assert.ok(
    !twice.ok && twice.issues.some((issue) => /Two scenes share a name/.test(issue)),
    "a scene's name is its own",
  );
  assert.match(
    buildWorldKitWritingPrompt({ genre: "Cyberpunk", setting: "x", tone: "Gritty" }).system,
    /"scenes" are the kinds of place a fight happens in.*Leave both out to keep the engine's own battlefields/,
  );

  console.log(
    "World kit battlefields: the setting's scenes, tile words, map examples and perception, the engine's own by default.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
