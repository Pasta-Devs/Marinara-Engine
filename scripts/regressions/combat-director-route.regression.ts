import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DirectedCombatView, DirectedCommand } from "../../packages/shared/src/features/combat-director.js";
const dataDir = mkdtempSync(join(tmpdir(), "marinara-combat-director-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { default: Fastify } = await import("../../packages/server/node_modules/fastify/fastify.js");
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createGameStateStorage } = await import("../../packages/server/src/services/storage/game-state.storage.js");
const { createGameEngineStateStorage } =
  await import("../../packages/server/src/services/storage/game-engine-state.storage.js");
const { combatDirectorRoutes, COMBAT_DIRECTOR_NAMESPACE } =
  await import("../../packages/server/src/routes/combat-director.routes.js");
const db = await getDB(),
  app = Fastify(),
  chats = createChatsStorage(db),
  store = createGameEngineStateStorage(db);
app.decorate("db", db);
let modelCalls = 0;
let respond: ((id: string) => void) | undefined;
let modelStarted: (() => void) | undefined;
await app.register(combatDirectorRoutes, {
  prefix: "/combat",
  chooseBoss: async () => {
    modelCalls++;
    return new Promise<string>((resolve) => {
      respond = resolve;
      modelStarted?.();
    });
  },
});
const unit = (id: string, side: "player" | "enemy") => ({
  id,
  name: id,
  side,
  hp: 100,
  maxHp: 100,
  mp: 20,
  maxMp: 20,
  attack: 5,
  defense: 20,
  speed: 5,
  level: 1,
  skills: [],
});
const chat = await chats.create({ name: "Director route proof", mode: "game", characterIds: [] });
const message = await chats.createMessage({ chatId: chat.id, role: "assistant", content: "[state: combat]" });
await chats.patchMetadata(chat.id, {
  gameSetupConfig: {
    combatDirector: true,
    gmBossControl: true,
    difficulty: "Hard",
    tacticalBattlefield: { seed: 9, size: "small" },
  },
  gameWeather: { type: "rainy", wind: "windy", visibility: "reduced" },
  gameInventory: [{ name: "Potion", quantity: 2 }],
});
const input = {
  chatId: chat.id,
  anchor: message.id,
  style: "tactical",
  party: [unit("hero", "player")],
  enemies: [{ ...unit("boss", "enemy"), boss: { points: 3, anticipation: true, defendCost: 1 } }],
  itemEffects: [{ name: "Potion", target: "ally", type: "heal", description: "Heal", power: 1 }],
  battlefield: { exposure: "exposed", features: [{ terrain: "forest", placement: "center", shape: "patch" }] },
};
let s: DirectedCombatView;
const post = (url: string, payload: unknown) => app.inject({ method: "POST", url, payload });
const cmd = (command: DirectedCommand, requestId = crypto.randomUUID(), revision = s.revision) =>
  post("/combat/command", {
    chatId: chat.id,
    anchor: message.id,
    id: s.id,
    instanceId: s.instanceId,
    revision,
    requestId,
    command,
  });
async function accept(command: DirectedCommand) {
  const response = await cmd(command);
  assert.equal(response.statusCode, 200, response.body);
  s = response.json().session;
  return s;
}
const read = async () => {
  const response = await app.inject({ url: `/combat/state?chatId=${chat.id}&anchor=${message.id}` });
  assert.equal(response.statusCode, 200, response.body);
  return response.json().session as DirectedCombatView;
};
try {
  for (const style of ["classic", "tactical"] as const) {
    for (const restored of [false, true]) {
      for (const metadataWeather of ["snow", undefined]) {
        const weatherChat = await chats.create({ name: "Weather restore proof", mode: "game", characterIds: [] });
        await chats.patchMetadata(weatherChat.id, {
          gameSetupConfig: { combatDirector: true },
          ...(metadataWeather ? { gameWeather: { type: metadataWeather } } : {}),
        });
        const anchor = await chats.createMessage({
          chatId: weatherChat.id,
          role: restored ? "system" : "assistant",
          content: restored ? "[Checkpoint restored]" : "[state: combat]",
          extra: restored ? { gameStateAnchor: "checkpoint_restore" } : {},
        });
        const states = createGameStateStorage(db);
        const accepted = {
          chatId: weatherChat.id,
          messageId: anchor.id,
          swipeIndex: 0,
          date: "",
          time: "",
          location: "forest",
          weather: "rain",
          temperature: "",
          worldCustomFields: [],
          presentCharacters: [],
          recentEvents: [],
          playerStats: null,
          personaStats: null,
          fieldLocks: {},
          hiddenTrackerFields: [],
          committed: true,
        };
        await states.create(accepted);
        // A fresh weather update can change metadata/the newest unaccepted scene,
        // while the accepted scene still carries earlier weather.
        if (!restored) await states.create({ ...accepted, messageId: null, weather: "snow", committed: false });
        const response = await post("/combat/start", { ...input, chatId: weatherChat.id, anchor: anchor.id, style });
        assert.equal(response.statusCode, 200, response.body);
        assert.equal(
          response.json().session.weather?.type,
          restored || !metadataWeather ? "rain" : metadataWeather,
          `${style}: restored weather wins at a checkpoint; fresh starts prefer current metadata with an accepted-scene fallback`,
        );
      }
    }
  }
  assert.equal((await app.inject({ url: "/combat/state" })).statusCode, 400);
  const bad = await post("/combat/start", { ...input, party: [unit("__proto__", "player")] });
  assert.equal(bad.statusCode, 400);
  const start = await post("/combat/start", input);
  assert.equal(start.statusCode, 200, start.body);
  s = start.json().session;
  assert.equal(s.tactical!.battlefield!.brief!.features![0]!.terrain, "forest");
  assert.equal(s.weather?.type, "rain");
  assert.equal(s.weather?.exposure, "exposed");
  assert.deepEqual(s.tactical!.weather, s.weather);
  assert.equal(s.tactical!.difficulty, "hard");
  await chats.patchMetadata(chat.id, {
    gameWeather: { type: "snow" },
    gameSetupConfig: { combatDirector: true, gmBossControl: true, difficulty: "Casual" },
  });
  assert.deepEqual(
    (await post("/combat/start", input)).json().session,
    s,
    "Reload pins accepted weather and difficulty despite changed campaign settings",
  );
  await accept({ type: "begin", unitId: "hero" });
  assert.equal(s.window?.kind, "anticipation");
  const snapshot = await store.getByChatAndMessage(chat.id, message.id, 0, COMBAT_DIRECTOR_NAMESPACE);
  const forbidden = await cmd({ type: "choose", candidateId: s.window!.options[0]!.id });
  assert.equal(forbidden.statusCode, 400, "browser cannot impersonate a GM candidate decision");
  const wrongMode = await cmd({ type: "classic", action: { type: "defend" } });
  assert.equal(wrongMode.statusCode, 400);
  let called = new Promise<void>((resolve) => {
    modelStarted = resolve;
  });
  const late = cmd({ type: "continue" });
  await called;
  s = await read();
  assert.ok(s.window?.requestedAt);
  const duplicate = await cmd({ type: "continue" });
  assert.equal(duplicate.statusCode, 200);
  assert.equal(modelCalls, 1, "an in-flight window must not issue another provider call");
  await accept({ type: "fallback" });
  assert.equal(s.stage, "action");
  const acceptedRevision = s.revision;
  respond!("0");
  const stale = await late;
  assert.equal(stale.json().session.revision, acceptedRevision, "late provider output cannot overwrite a fallback");
  assert.equal(stale.json().session.budgets.boss.legendary, 3);
  // Item consumption and accepted response are a single save, including a duplicated request.
  const itemRequest = crypto.randomUUID(),
    itemRevision = s.revision;
  const item = await cmd(
    { type: "tactical", action: { type: "item", unitId: "hero", itemName: "Potion", targetId: "hero" } },
    itemRequest,
    itemRevision,
  );
  assert.equal(item.statusCode, 200, item.body);
  s = item.json().session;
  assert.equal(JSON.parse((await chats.getById(chat.id))!.metadata).gameInventory[0].quantity, 1);
  const repeat = await cmd(
    { type: "tactical", action: { type: "item", unitId: "hero", itemName: "Potion", targetId: "hero" } },
    itemRequest,
    itemRevision,
  );
  assert.equal(repeat.json().session.revision, s.revision);
  assert.equal(JSON.parse((await chats.getById(chat.id))!.metadata).gameInventory[0].quantity, 1);
  const reload = await post("/combat/start", { ...input, party: [{ ...unit("hero", "player"), hp: 1 }] });
  assert.deepEqual(reload.json().session, s, "reopening ignores stale client combatants");
  // A checkpoint restore replaces row identity even if its revision/window happen to match.
  await store.create({
    chatId: chat.id,
    messageId: message.id,
    swipeIndex: 0,
    gameType: COMBAT_DIRECTOR_NAMESPACE,
    schemaVersion: 1,
    state: snapshot!.state,
    committed: true,
  });
  s = await read();
  called = new Promise<void>((resolve) => {
    modelStarted = resolve;
  });
  const obsolete = cmd({ type: "continue" });
  await called;
  const job = await store.getByChatAndMessage(chat.id, message.id, 0, COMBAT_DIRECTOR_NAMESPACE);
  await store.create({
    chatId: chat.id,
    messageId: message.id,
    swipeIndex: 0,
    gameType: COMBAT_DIRECTOR_NAMESPACE,
    schemaVersion: 1,
    state: job!.state,
    committed: true,
  });
  respond!("0");
  const restored = await obsolete;
  assert.equal(restored.json().session.budgets.boss.legendary, 3, "restored lineage rejects the old provider action");
  assert.equal(restored.json().session.window.kind, "anticipation");
  const oldInstanceCommand = await cmd({ type: "fallback" }, crypto.randomUUID(), restored.json().session.revision);
  assert.equal(
    oldInstanceCommand.json().session.window.kind,
    "anticipation",
    "old browser cannot spend into a restored row even at the same revision",
  );
  // Clone the accepted snapshot to another anchor; new commands affect only that chat.
  const branch = await chats.create({ name: "Branch", mode: "game", characterIds: [] });
  const branchMessage = await chats.createMessage({ chatId: branch.id, role: "assistant", content: "[state: combat]" });
  await store.create({
    chatId: branch.id,
    messageId: branchMessage.id,
    swipeIndex: 0,
    gameType: COMBAT_DIRECTOR_NAMESPACE,
    schemaVersion: 1,
    state: job!.state,
    committed: true,
  });
  const branchResult = await post("/combat/command", {
    chatId: branch.id,
    anchor: branchMessage.id,
    id: s.id,
    instanceId: (await store.getByChatAndMessage(branch.id, branchMessage.id, 0, COMBAT_DIRECTOR_NAMESPACE))!.id,
    revision: restored.json().session.revision,
    requestId: crypto.randomUUID(),
    command: { type: "fallback" },
  });
  assert.equal(branchResult.statusCode, 200, branchResult.body);
  assert.equal(branchResult.json().session.stage, "action");
  assert.equal((await read()).window?.kind, "anticipation");
  // Exercise the real hard timeout with a provider that never finishes; its eventual reply has no effect.
  const stalled = JSON.parse(snapshot!.state);
  delete stalled.window.requestedAt;
  await store.create({
    chatId: chat.id,
    messageId: message.id,
    swipeIndex: 0,
    gameType: COMBAT_DIRECTOR_NAMESPACE,
    schemaVersion: 1,
    state: JSON.stringify(stalled),
    committed: true,
  });
  s = await read();
  const timeout = await cmd({ type: "continue" });
  assert.equal(timeout.statusCode, 200, timeout.body);
  s = timeout.json().session;
  assert.equal(s.stage, "action");
  assert.ok(s.log.some((e) => e.source === "fallback"));
  const timeoutRevision = s.revision;
  respond!("0");
  assert.equal((await read()).revision, timeoutRevision);
  stalled.gmCalls = 12;
  await store.create({
    chatId: chat.id,
    messageId: message.id,
    swipeIndex: 0,
    gameType: COMBAT_DIRECTOR_NAMESPACE,
    schemaVersion: 1,
    state: JSON.stringify(stalled),
    committed: true,
  });
  s = await read();
  const callsBefore = modelCalls;
  await accept({ type: "continue" });
  assert.equal(modelCalls, callsBefore, "aggregate call cap uses a local pass");
  const rows = await store.listForChat(chat.id, COMBAT_DIRECTOR_NAMESPACE);
  assert.equal(rows.length, 1);
  const invalidSave = JSON.parse(snapshot!.state);
  invalidSave.choices[0].legendaryCost = -1;
  await store.create({
    chatId: chat.id,
    messageId: message.id,
    swipeIndex: 0,
    gameType: COMBAT_DIRECTOR_NAMESPACE,
    schemaVersion: 1,
    state: JSON.stringify(invalidSave),
    committed: true,
  });
  assert.equal(
    (await post("/combat/start", input)).statusCode,
    400,
    "Imported choices cannot grant points with negative costs",
  );
  assert.equal(
    (await app.inject({ url: `/combat/state?chatId=${chat.id}&anchor=${message.id}` })).statusCode,
    400,
    "Malformed imported saves return a recoverable client error",
  );
  for (const legacy of [false, true]) {
    const saved = JSON.parse(snapshot!.state);
    if (legacy) {
      delete saved.weather;
      delete saved.tactical.weather;
    } else saved.tactical.weather.exposure = "sheltered";
    await store.create({
      chatId: chat.id,
      messageId: message.id,
      swipeIndex: 0,
      gameType: COMBAT_DIRECTOR_NAMESPACE,
      schemaVersion: 1,
      state: JSON.stringify(saved),
      committed: true,
    });
    const response = await post("/combat/start", input);
    assert.equal(
      response.statusCode,
      legacy ? 200 : 400,
      "Legacy weather absence stays neutral; contradictory imported weather is refused",
    );
    if (legacy) assert.equal(response.json().session.weather, undefined);
  }
  for (const corrupt of ["{truncated", "null"]) {
    await store.create({
      chatId: chat.id,
      messageId: message.id,
      swipeIndex: 0,
      gameType: COMBAT_DIRECTOR_NAMESPACE,
      schemaVersion: 1,
      state: corrupt,
      committed: true,
    });
    const response = await app.inject({ url: `/combat/state?chatId=${chat.id}&anchor=${message.id}` });
    assert.equal(response.statusCode, 400);
    assert.equal(response.json().error, "Unsupported combat save.");
    assert.equal((await post("/combat/start", input)).json().error, "Unsupported combat save.");
  }
  console.log(
    "Combat director route: authority, idempotency, terrain, atomic item costs, late GM output, restore identity and branch isolation passed.",
  );
} finally {
  await app.close();
  await closeDB();
  rmSync(dataDir, { recursive: true, force: true });
}
