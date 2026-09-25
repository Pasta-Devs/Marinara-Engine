import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-hybrid-terrain-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");

const { default: Fastify } = await import("../../packages/server/node_modules/fastify/fastify.js");
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { gameRoutes } = await import("../../packages/server/src/routes/game.routes.js");
const { validateTacticalEncounterBlueprint } =
  await import("../../packages/server/src/services/game/tactical-battlefield.service.js");
const { injectGameGmPromptRuntime } =
  await import("../../packages/server/src/services/generation/game-gm-prompt-runtime.js");
const { summarizeTacticalBattlefield } = await import("../../packages/shared/src/index.js");

const db = await getDB();
const app = Fastify();
app.decorate("db", db);
await app.register(gameRoutes, { prefix: "/api/game" });

const setupConfig = {
  genre: "Fantasy",
  setting: "A ruined keep split by a flooded courtyard",
  tone: "Adventurous",
  difficulty: "normal",
  combatStyle: "tactical",
  playerGoals: "Cross the courtyard",
  gmMode: "standalone",
  rating: "sfw",
  partyCharacterIds: [],
  tacticalBattlefield: {
    seed: 0,
    size: "large",
    instructions: "Keep the flooded courtyard central.",
  },
};

const party = [
  { id: "hero", name: "Hero", hp: 20, maxHp: 20, attack: 8, defense: 5, speed: 6, level: 1, movementMode: "fly" },
];
const enemies = [{ id: "guard", name: "Guard", hp: 12, maxHp: 12, attack: 6, defense: 4, speed: 4, level: 1 }];

async function resolvePromptContext(chatMetadata: Record<string, unknown>) {
  const runtime = await injectGameGmPromptRuntime({
    messages: [{ role: "system", content: "placeholder" }],
    chatId: "prompt-style-regression",
    chat: {},
    chatMetadata,
    characterIds: [],
    chars: {
      getById: async () => null,
      getPersona: async () => null,
    },
    chats: {
      getById: async () => null,
      updateMetadata: async () => undefined,
    },
    selectedGameStateSnapshotPromise: Promise.resolve(null),
    mappedMessages: [],
    personaName: "Hero",
    resolvePromptMacros: (value) => value,
  });
  return runtime.gmCtx;
}

try {
  const created = await app.inject({
    method: "POST",
    url: "/api/game/create",
    payload: { name: "Hybrid terrain regression", setupConfig },
  });
  assert.equal(created.statusCode, 200, created.body);
  const session = created.json().sessionChat;
  for (const controlledId of ["guard", "missing", "dead"]) {
    const invalidControl = await app.inject({
      method: "POST",
      url: "/api/game/combat/round",
      payload: {
        chatId: session.id,
        round: 1,
        combatants: [
          { ...party[0], side: "player" },
          { ...party[0], id: "dead", hp: 0, side: "player" },
          { ...enemies[0], side: "enemy" },
        ],
        controlledId,
        playerAction: { type: "defend" },
      },
    });
    assert.equal(invalidControl.statusCode, 400, "Invalid controlled units must be rejected");
  }
  for (const commands of [
    {},
    { controlledId: "hero", playerAction: { type: "defend" } },
    { partyActions: { hero: { type: "defend" } } },
  ]) {
    const response = await app.inject({
      method: "POST",
      url: "/api/game/combat/round",
      payload: { chatId: session.id, round: 1, combatants: [...party, ...enemies], ...commands },
    });
    assert.equal(
      response.statusCode,
      Object.keys(commands).length ? 400 : 200,
      "Omitted-side legacy rounds remain accepted, but new party commands require an explicit player side",
    );
  }
  const setWeather = (type: string) =>
    app.inject({
      method: "POST",
      url: "/api/game/weather/update",
      payload: { chatId: session.id, action: "set", location: "forest", type },
    });
  const rainy = await setWeather("rainy");
  assert.equal(rainy.statusCode, 200, rainy.body);
  assert.equal(rainy.json().weather.type, "rain");
  assert.equal(rainy.json().weather.visibility, "reduced");
  const storm = await setWeather("stormy");
  assert.equal(storm.json().weather.type, "storm");
  assert.equal(storm.json().weather.visibility, "poor");
  assert.equal((await setWeather("constructor")).json().changed, false);
  for (const weather of [
    null,
    { version: 1, type: "rain", wind: "windy", visibility: "reduced", exposure: "exposed" },
  ]) {
    const restart = await app.inject({
      method: "POST",
      url: "/api/game/combat/tactical/start",
      payload: { chatId: session.id, party, enemies, seed: 12, weather },
    });
    assert.equal(restart.statusCode, 200, restart.body);
    assert.deepEqual(
      restart.json().state.weather,
      weather ?? undefined,
      "Restart accepts saved weather or neutral legacy absence instead of changed campaign weather",
    );
  }
  const metadata = JSON.parse(session.metadata);
  for (const id of ["missing", "guard", "constructor", "__proto__"]) {
    const invalidOrders = await app.inject({
      method: "POST",
      url: "/api/game/combat/round",
      payload: {
        chatId: session.id,
        round: 1,
        combatants: [
          { ...party[0], side: "player" },
          { ...enemies[0], side: "enemy" },
        ],
        partyActions: Object.fromEntries([[id, { type: "defend" }]]),
      },
    });
    assert.equal(invalidOrders.statusCode, 400, `Invalid order actor ${id} must be rejected`);
  }
  assert.deepEqual(metadata.gameSetupConfig.tacticalBattlefield, setupConfig.tacticalBattlefield);

  const started = await app.inject({
    method: "POST",
    url: "/api/game/combat/tactical/start",
    payload: {
      chatId: session.id,
      party,
      enemies,
      seed: 99,
      environment: "ruins",
      battlefield: {
        size: "small",
        features: [{ terrain: "forest", placement: "center", shape: "patch" }],
      },
    },
  });
  assert.equal(started.statusCode, 200, started.body);
  const state = started.json().state;
  assert.equal(state.seed, 99, "Obsolete setup seeds never override an encounter or restart seed");
  assert.equal(state.grid.width, 14, "Configured size overrides the encounter brief");
  assert.equal(state.grid.height, 10);
  assert.equal(state.units[0].movementMode, "fly");
  assert.deepEqual(state.battlefield, {
    kind: "generated",
    generatorVersion: 1,
    size: "large",
    brief: {
      size: "large",
      features: [{ terrain: "forest", placement: "center", shape: "patch" }],
    },
  });
  assert.match(summarizeTacticalBattlefield(state) ?? "", /Accepted features: forest center patch/);
  assert.match(summarizeTacticalBattlefield(state) ?? "", /Resolved terrain:/);

  const activeContext = await resolvePromptContext({
    gameActiveState: "combat",
    gameCombatStyle: "classic",
    gameCombatState: { combatStyle: "tactical" },
    gameTacticalCombatSnapshot: state,
  });
  assert.equal(
    activeContext.combatStyle,
    "tactical",
    "An active encounter's pinned style wins over the next-battle setting",
  );
  assert.match(activeContext.tacticalBattlefieldContext ?? "", /Accepted features: forest center patch/);
  const classicContext = await resolvePromptContext({
    gameActiveState: "combat",
    gameCombatStyle: "tactical",
    gameCombatState: { combatStyle: "classic" },
    gameTacticalCombatSnapshot: state,
  });
  assert.equal(classicContext.combatStyle, "classic");
  assert.equal(
    classicContext.tacticalBattlefieldContext,
    undefined,
    "A pinned classic encounter must ignore retained tactical terrain",
  );
  assert.equal(
    (
      await resolvePromptContext({
        gameActiveState: "combat",
        gameCombatStyle: "classic",
        gameCombatState: {},
        gameTacticalCombatSnapshot: state,
      })
    ).combatStyle,
    "tactical",
    "A legacy active tactical snapshot supplies the missing style pin",
  );
  const explorationContext = await resolvePromptContext({
    gameActiveState: "exploration",
    gameCombatStyle: "classic",
    gameCombatState: { combatStyle: "tactical" },
    gameTacticalCombatSnapshot: state,
  });
  assert.equal(
    explorationContext.combatStyle,
    "classic",
    "Outside combat, the runtime setting continues to select the next battle style",
  );
  assert.equal(
    explorationContext.tacticalBattlefieldContext,
    undefined,
    "Exploration must not receive stale battlefield context",
  );

  const invalidModelMovement = validateTacticalEncounterBlueprint({
    party: [{ movementMode: "swim" }],
    enemies: [],
    battlefield: {},
  });
  assert.equal(invalidModelMovement.ok, false);
  if (!invalidModelMovement.ok) assert.match(invalidModelMovement.error, /movementMode/);

  const invalidTerrainInput = Object.freeze({
    party: [{ movementMode: "walk" }],
    enemies: [],
    battlefield: Object.freeze({
      terrainBrief: { features: [{ terrain: "forest", placement: "center", shape: "barrier" }] },
      terrainBriefError: "model-authored spoof",
    }),
  });
  const invalidTerrainSnapshot = structuredClone(invalidTerrainInput);
  const recoverableTerrain = validateTacticalEncounterBlueprint(invalidTerrainInput);
  assert.deepEqual(invalidTerrainInput, invalidTerrainSnapshot);
  assert.equal(recoverableTerrain.ok, true);
  if (recoverableTerrain.ok) {
    assert.equal(recoverableTerrain.blueprint.battlefield?.terrainBrief, undefined);
    assert.match(recoverableTerrain.blueprint.battlefield?.terrainBriefError ?? "", /barrier features/i);
    assert.notEqual(recoverableTerrain.blueprint.battlefield, invalidTerrainInput.battlefield);
  }
  assert.equal(invalidTerrainInput.battlefield.terrainBriefError, "model-authored spoof");
  assert.equal(invalidTerrainInput.battlefield.terrainBrief.features.length, 1);

  const validTerrainInput = Object.freeze({
    party: [{ movementMode: "walk" }],
    enemies: [],
    battlefield: Object.freeze({
      terrainBrief: { features: [{ terrain: "ruin", placement: "north", shape: "patch" }] },
      terrainBriefError: "model-authored spoof",
    }),
  });
  const validTerrainSnapshot = structuredClone(validTerrainInput);
  const validTerrain = validateTacticalEncounterBlueprint(validTerrainInput);
  assert.deepEqual(validTerrainInput, validTerrainSnapshot);
  assert.equal(validTerrain.ok, true);
  if (validTerrain.ok) {
    assert.deepEqual(validTerrain.blueprint.battlefield?.terrainBrief, {
      features: [{ terrain: "ruin", placement: "north", shape: "patch" }],
    });
    assert.equal(validTerrain.blueprint.battlefield?.terrainBriefError, undefined);
    assert.notEqual(validTerrain.blueprint.battlefield, validTerrainInput.battlefield);
  }
  assert.equal(validTerrainInput.battlefield.terrainBriefError, "model-authored spoof");

  const invalidProfile = structuredClone(state);
  invalidProfile.units[0].tactics.category = "beast";
  invalidProfile.units[0].tactics.adjective = "cautious";
  const rejectedProfile = await app.inject({
    method: "POST",
    url: "/api/game/combat/tactical/action",
    payload: { chatId: session.id, state: invalidProfile, action: { type: "wait", unitId: "hero" } },
  });
  assert.equal(rejectedProfile.statusCode, 400);
  assert.match(rejectedProfile.json().error, /Mindless/);
  const invalidController = await app.inject({
    method: "POST",
    url: "/api/game/combat/tactical/action",
    payload: { chatId: session.id, state, action: { type: "control", unitId: "hero", controller: "remote" } },
  });
  assert.equal(invalidController.statusCode, 400);
  const automatedLeader = await app.inject({
    method: "POST",
    url: "/api/game/combat/tactical/action",
    payload: { chatId: session.id, state, action: { type: "control", unitId: "hero", controller: "ai" } },
  });
  assert.equal(automatedLeader.statusCode, 400);
  assert.match(automatedLeader.json().error, /leader stays under player control/);
  const classicParty = { ...party[0], side: "player", tactics: state.units[0].tactics, skillCooldowns: { heal: 2 } };
  const classicEnemy = { ...enemies[0], side: "enemy", hp: 5000, maxHp: 5000, tactics: state.units[1].tactics };
  const classic = await app.inject({
    method: "POST",
    url: "/api/game/combat/round",
    payload: {
      chatId: session.id,
      combatants: [classicParty, classicEnemy],
      round: 4,
      controlledId: "hero",
      partyActions: { hero: { type: "defend" } },
    },
  });
  assert.equal(classic.statusCode, 200, classic.body);
  assert.deepEqual(classic.json().combatants[0].tactics, classicParty.tactics);
  assert.equal(classic.json().combatants[0].skillCooldowns.heal, 1);

  const legacyState = structuredClone(state);
  for (const unit of legacyState.units) delete unit.movementMode;
  const legacyAction = await app.inject({
    method: "POST",
    url: "/api/game/combat/tactical/action",
    payload: {
      chatId: session.id,
      state: legacyState,
      action: { type: "wait", unitId: "hero" },
    },
  });
  assert.equal(legacyAction.statusCode, 200, legacyAction.body);

  const invalidMovementState = structuredClone(state);
  invalidMovementState.units[0].movementMode = "noclip";
  const invalidMovementAction = await app.inject({
    method: "POST",
    url: "/api/game/combat/tactical/action",
    payload: {
      chatId: session.id,
      state: invalidMovementState,
      action: { type: "wait", unitId: "hero" },
    },
  });
  assert.equal(invalidMovementAction.statusCode, 400, invalidMovementAction.body);
  assert.match(invalidMovementAction.json().error, /movementMode/);

  for (const seed of [-1, 1.5, 0x1_0000_0000]) {
    const rejected = await app.inject({
      method: "POST",
      url: "/api/game/create",
      payload: {
        name: "Invalid terrain seed",
        setupConfig: { ...setupConfig, tacticalBattlefield: { ...setupConfig.tacticalBattlefield, seed } },
      },
    });
    assert.equal(rejected.statusCode, 400, rejected.body);
    assert.match(rejected.json().error, /battlefield seed/i);
  }

  const invalidBrief = await app.inject({
    method: "POST",
    url: "/api/game/combat/tactical/start",
    payload: {
      chatId: session.id,
      party,
      enemies,
      battlefield: {
        features: [{ terrain: "forest", placement: "center", shape: "barrier" }],
      },
    },
  });
  assert.equal(invalidBrief.statusCode, 400, invalidBrief.body);
  assert.match(invalidBrief.json().error, /barrier features/i);

  const legacyCreated = await app.inject({
    method: "POST",
    url: "/api/game/create",
    payload: {
      name: "Legacy tactical game",
      setupConfig: { ...setupConfig, tacticalBattlefield: undefined },
    },
  });
  assert.equal(legacyCreated.statusCode, 200, legacyCreated.body);
  const legacyStarted = await app.inject({
    method: "POST",
    url: "/api/game/combat/tactical/start",
    payload: { chatId: legacyCreated.json().sessionChat.id, party, enemies, seed: 0 },
  });
  assert.equal(legacyStarted.statusCode, 200, legacyStarted.body);
  assert.equal(legacyStarted.json().state.seed, 0);
  assert.equal(legacyStarted.json().state.grid.width, 12, "Legacy callers retain unit-count sizing");
} finally {
  await app.close();
  await closeDB();
  rmSync(dataDir, { recursive: true, force: true });
}

console.log("Hybrid tactical terrain route regression checks passed.");
