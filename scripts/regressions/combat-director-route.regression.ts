import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
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
const { createGameRulesetsStorage } =
  await import("../../packages/server/src/services/storage/game-rulesets.storage.js");
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
  // Two stacks of one item, as a player who split their potions leaves them.
  gameInventory: [
    { id: "st-first", name: "Potion", quantity: 1 },
    { id: "st-second", name: "Potion", quantity: 1 },
    // Two stacks whose total is past what one stack holds: a fight and its save take the total.
    { id: "st-arrows", name: "Arrow", quantity: 999_999 },
    { id: "st-arrows-2", name: "Arrow", quantity: 500_000 },
  ],
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
  // A mechanic no interval drives may say 0, and a status may have run down to 0 turns: neither
  // refuses the fight (a Treant's hp_threshold "Blighted Sap" with `interval: 0` did). A value that
  // is refused is named where it is.
  const sap = {
    name: "Blighted Sap",
    description: "Sap that corrodes.",
    trigger: "hp_threshold",
    interval: 0,
    hpThreshold: 75,
    effectType: "damage_all",
    power: 0.8,
    status: { name: "Corroded", emoji: "", duration: 0, modifier: -2 },
  };
  const elsewhere = { ...input, chatId: "no-such-chat", mechanics: [sap] };
  assert.equal((await post("/combat/start", elsewhere)).json().error, "Chat not found.");
  const named = await post("/combat/start", { ...elsewhere, mechanics: [{ ...sap, interval: -1 }] });
  assert.equal(named.statusCode, 400);
  assert.match(named.json().error, /^mechanics\.0\.interval: /);
  const start = await post("/combat/start", input);
  assert.equal(start.statusCode, 200, start.body);
  s = start.json().session;
  assert.deepEqual(
    s.inventory.map((item) => [item.name, item.quantity]),
    [
      ["Potion", 2],
      ["Arrow", 1_499_999],
    ],
    "a fight sees one line per item, however its stacks are split",
  );
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
  // Taken from the first stack, which it empties; the second stack keeps its id and its potion.
  assert.deepEqual(JSON.parse((await chats.getById(chat.id))!.metadata).gameInventory, [
    { id: "st-second", name: "Potion", quantity: 1 },
    { id: "st-arrows", name: "Arrow", quantity: 999_999 },
    { id: "st-arrows-2", name: "Arrow", quantity: 500_000 },
  ]);
  const repeat = await cmd(
    { type: "tactical", action: { type: "item", unitId: "hero", itemName: "Potion", targetId: "hero" } },
    itemRequest,
    itemRevision,
  );
  assert.equal(repeat.json().session.revision, s.revision);
  assert.equal(JSON.parse((await chats.getById(chat.id))!.metadata).gameInventory[0].quantity, 1);
  // The spend goes through the same save as every other inventory change, so the journal hears of it
  // once, the duplicated request included.
  assert.deepEqual(
    (JSON.parse((await chats.getById(chat.id))!.metadata).gameJournal?.inventoryLog ?? []).map(
      (entry: { item: string; action: string; quantity: number }) => [entry.item, entry.action, entry.quantity],
    ),
    [["Potion", "used", 1]],
  );
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
  // A line shown by a nickname is spent as the item it is, even when the nickname is another item's
  // own name: a cord the player calls "Potion" is the cord, and the real potion stays.
  {
    const nickChat = await chats.create({ name: "Director nickname proof", mode: "game", characterIds: [] });
    const nickAnchor = await chats.createMessage({
      chatId: nickChat.id,
      role: "assistant",
      content: "[state: combat]",
    });
    await chats.patchMetadata(nickChat.id, {
      gameSetupConfig: { combatDirector: true },
      gameInventory: [
        { id: "st-cord", name: "Cord", nickname: "Potion", quantity: 1 },
        { id: "st-potion", name: "Potion", quantity: 1 },
      ],
    });
    const nickInput = {
      ...input,
      chatId: nickChat.id,
      anchor: nickAnchor.id,
      enemies: [unit("rat", "enemy")],
      itemEffects: [
        ...input.itemEffects,
        // Named as the item is in its own right: the fight finds it for the line shown as "Potion (Cord)".
        { name: "Cord", target: "ally", type: "utility", description: "Tie", power: 1 },
      ],
    };
    const started = await post("/combat/start", nickInput);
    assert.equal(started.statusCode, 200, started.body);
    let n: DirectedCombatView = started.json().session;
    assert.deepEqual(
      n.inventory.map((line) => [line.name, line.quantity, line.ownName ?? null]),
      [
        ["Potion (Cord)", 1, "Cord"],
        ["Potion", 1, null],
      ],
      "two lines never share a name: the nickname another line goes by shows its own name too",
    );
    const nickCmd = async (command: DirectedCommand) => {
      const response = await post("/combat/command", {
        chatId: nickChat.id,
        anchor: nickAnchor.id,
        id: n.id,
        instanceId: n.instanceId,
        revision: n.revision,
        requestId: crypto.randomUUID(),
        command,
      });
      assert.equal(response.statusCode, 200, response.body);
      n = response.json().session;
    };
    await nickCmd({ type: "begin", unitId: "hero" });
    await nickCmd({
      type: "tactical",
      action: { type: "item", unitId: "hero", itemName: "Potion (Cord)", targetId: "hero" },
    });
    assert.deepEqual(JSON.parse((await chats.getById(nickChat.id))!.metadata).gameInventory, [
      { id: "st-potion", name: "Potion", quantity: 1 },
    ]);
  }
  // Once the real potion is gone mid-fight, a cord nicknamed "Potion" never stands in for it: the
  // spend is refused and the cord stays.
  {
    const goneChat = await chats.create({ name: "Director gone item proof", mode: "game", characterIds: [] });
    const goneAnchor = await chats.createMessage({
      chatId: goneChat.id,
      role: "assistant",
      content: "[state: combat]",
    });
    await chats.patchMetadata(goneChat.id, {
      gameSetupConfig: { combatDirector: true },
      gameInventory: [{ id: "st-potion", name: "Potion", quantity: 1 }],
    });
    const started = await post("/combat/start", {
      ...input,
      chatId: goneChat.id,
      anchor: goneAnchor.id,
      enemies: [unit("rat", "enemy")],
    });
    assert.equal(started.statusCode, 200, started.body);
    let g: DirectedCombatView = started.json().session;
    const goneCmd = (command: DirectedCommand) =>
      post("/combat/command", {
        chatId: goneChat.id,
        anchor: goneAnchor.id,
        id: g.id,
        instanceId: g.instanceId,
        revision: g.revision,
        requestId: crypto.randomUUID(),
        command,
      });
    const begun = await goneCmd({ type: "begin", unitId: "hero" });
    assert.equal(begun.statusCode, 200, begun.body);
    g = begun.json().session;
    const cordOnly = [{ id: "st-cord", name: "Cord", nickname: "Potion", quantity: 1 }];
    await chats.patchMetadata(goneChat.id, { gameInventory: cordOnly });
    const refused = await goneCmd({
      type: "tactical",
      action: { type: "item", unitId: "hero", itemName: "Potion", targetId: "hero" },
    });
    assert.equal(refused.statusCode, 400, refused.body);
    assert.match(refused.body, /Inventory changed/);
    assert.deepEqual(JSON.parse((await chats.getById(goneChat.id))!.metadata).gameInventory, cordOnly);
  }
  // A ruleset's item (#6795) is spent in a fight like any other: the fight's check counts the items
  // that have the spent name as their own, a ruleset item among them.
  {
    const kitChat = await chats.create({ name: "Director ruleset item proof", mode: "game", characterIds: [] });
    const kitAnchor = await chats.createMessage({ chatId: kitChat.id, role: "assistant", content: "[state: combat]" });
    await chats.patchMetadata(kitChat.id, {
      gameSetupConfig: { combatDirector: true },
      gameInventory: [{ id: "st-tonic", name: "Potion", item: "kit/warming-tonic", quantity: 2 }],
    });
    const started = await post("/combat/start", {
      ...input,
      chatId: kitChat.id,
      anchor: kitAnchor.id,
      enemies: [unit("rat", "enemy")],
    });
    assert.equal(started.statusCode, 200, started.body);
    let k: DirectedCombatView = started.json().session;
    const kitCmd = async (command: DirectedCommand) => {
      const response = await post("/combat/command", {
        chatId: kitChat.id,
        anchor: kitAnchor.id,
        id: k.id,
        instanceId: k.instanceId,
        revision: k.revision,
        requestId: crypto.randomUUID(),
        command,
      });
      assert.equal(response.statusCode, 200, response.body);
      k = response.json().session;
    };
    await kitCmd({ type: "begin", unitId: "hero" });
    await kitCmd({ type: "tactical", action: { type: "item", unitId: "hero", itemName: "Potion", targetId: "hero" } });
    assert.deepEqual(JSON.parse((await chats.getById(kitChat.id))!.metadata).gameInventory, [
      { id: "st-tonic", name: "Potion", item: "kit/warming-tonic", quantity: 1 },
    ]);
  }
  // A bound cursed item stays with whoever it is bound to (#6801): the fight cannot use up the
  // Widow's ring the player cannot part with, and the step is refused whole, so its effect is never
  // had for nothing. A spare ring in the bag beside it is not worn, so the fight never spends it in the
  // worn one's place (#6909).
  {
    const gravewatch = {
      ...JSON.parse(readFileSync(new URL("../../docs/examples/rulesets/gravewatch.json", import.meta.url), "utf8")),
      id: "gravewatch-fight",
    };
    // A ruleset's item is offered in the Engine's own fights only when it can be used (#6905), so the
    // ring is given a use here.
    gravewatch.catalogs
      .find((catalog: { id: string }) => catalog.id === "kit")
      .entries.find((entry: { id: string }) => entry.id === "widows-ring").item.use = {
      kind: "heal",
      free: true,
      targets: "self",
      amount: { flat: 1 },
      consumes: true,
    };
    await createGameRulesetsStorage(db).put({
      rulesetId: "local/gravewatch-fight",
      version: gravewatch.version,
      sourceKind: "local",
      definition: JSON.stringify(gravewatch),
    });
    const ringChat = await chats.create({ name: "Director cursed item proof", mode: "game", characterIds: [] });
    const ringAnchor = await chats.createMessage({
      chatId: ringChat.id,
      role: "assistant",
      content: "[state: combat]",
    });
    // Worn and bound, as a ring that binds is used (#6909).
    const bound = [
      { id: "st-ring", name: "Widow's ring", item: "kit/widows-ring", quantity: 1, equipped: true, bound: true },
    ];
    await chats.patchMetadata(ringChat.id, {
      gameSetupConfig: { combatDirector: true },
      gameRuleset: { id: "local/gravewatch-fight", version: gravewatch.version, packageId: null, options: {} },
      gameInventory: bound,
    });
    const started = await post("/combat/start", {
      ...input,
      chatId: ringChat.id,
      anchor: ringAnchor.id,
      enemies: [unit("rat", "enemy")],
      itemEffects: [{ name: "Widow's ring", target: "ally", type: "heal", description: "Heal", power: 1 }],
    });
    assert.equal(started.statusCode, 200, started.body);
    let r: DirectedCombatView = started.json().session;
    const ringCmd = (command: DirectedCommand) =>
      post("/combat/command", {
        chatId: ringChat.id,
        anchor: ringAnchor.id,
        id: r.id,
        instanceId: r.instanceId,
        revision: r.revision,
        requestId: crypto.randomUUID(),
        command,
      });
    const begun = await ringCmd({ type: "begin", unitId: "hero" });
    assert.equal(begun.statusCode, 200, begun.body);
    r = begun.json().session;
    const use = {
      type: "tactical",
      action: { type: "item", unitId: "hero", itemName: "Widow's ring", targetId: "hero" },
    } as const;
    const refused = await ringCmd(use);
    assert.equal(refused.statusCode, 400, refused.body);
    assert.match(refused.body, /Widow's ring is cursed/);
    assert.deepEqual(JSON.parse((await chats.getById(ringChat.id))!.metadata).gameInventory, bound);
    const kept = (await store.getByChatAndMessage(ringChat.id, ringAnchor.id, 0, COMBAT_DIRECTOR_NAMESPACE))!;
    assert.equal(JSON.parse(kept.state).revision, r.revision, "the refused step is not saved");
    // A spare in the bag is not the ring being worn, so the step is still refused and both stay.
    const spare = [...bound, { id: "st-spare", name: "Widow's ring", item: "kit/widows-ring", quantity: 1 }];
    await chats.patchMetadata(ringChat.id, { gameInventory: spare });
    const still = await ringCmd(use);
    assert.equal(still.statusCode, 400, still.body);
    assert.match(still.body, /Widow's ring is cursed/);
    assert.deepEqual(JSON.parse((await chats.getById(ringChat.id))!.metadata).gameInventory, spare);
    // Taken off since, it is no longer the ring being used: the step is refused as a change to the
    // inventory, not as the curse.
    const off = [{ ...bound[0]!, equipped: false }, spare[1]!];
    await chats.patchMetadata(ringChat.id, { gameInventory: off });
    const gone = await ringCmd(use);
    assert.equal(gone.statusCode, 400, gone.body);
    assert.match(gone.body, /Inventory changed/);
  }
  // A ruleset that turns Game Mode's own items off (#6822): the fight offers no item and uses none of
  // what a model guessed, and the inventory stays as it was.
  {
    const ember = {
      ...JSON.parse(readFileSync(new URL("../../docs/examples/rulesets/ember-roads.json", import.meta.url), "utf8")),
      id: "ember-fight-no-items",
    };
    ember.items = { ...ember.items, native: false };
    await createGameRulesetsStorage(db).put({
      rulesetId: "local/ember-fight-no-items",
      version: ember.version,
      sourceKind: "local",
      definition: JSON.stringify(ember),
    });
    const noItemsChat = await chats.create({ name: "Director without items", mode: "game", characterIds: [] });
    const noItemsAnchor = await chats.createMessage({
      chatId: noItemsChat.id,
      role: "assistant",
      content: "[state: combat]",
    });
    const potions = [{ id: "st-potion", name: "Potion", quantity: 2 }];
    await chats.patchMetadata(noItemsChat.id, {
      gameSetupConfig: { combatDirector: true },
      gameRuleset: { id: "local/ember-fight-no-items", version: ember.version, packageId: null, options: {} },
      gameInventory: potions,
    });
    const started = await post("/combat/start", {
      ...input,
      chatId: noItemsChat.id,
      anchor: noItemsAnchor.id,
      enemies: [unit("rat", "enemy")],
    });
    assert.equal(started.statusCode, 200, started.body);
    let n: DirectedCombatView = started.json().session;
    assert.deepEqual(n.inventory, [], "no item is offered");
    const saved = (await store.getByChatAndMessage(noItemsChat.id, noItemsAnchor.id, 0, COMBAT_DIRECTOR_NAMESPACE))!;
    assert.deepEqual(JSON.parse(saved.state).itemEffects, [], "nor is a guessed effect kept");
    const noItemsCmd = (command: DirectedCommand) =>
      post("/combat/command", {
        chatId: noItemsChat.id,
        anchor: noItemsAnchor.id,
        id: n.id,
        instanceId: n.instanceId,
        revision: n.revision,
        requestId: crypto.randomUUID(),
        command,
      });
    const begun = await noItemsCmd({ type: "begin", unitId: "hero" });
    assert.equal(begun.statusCode, 200, begun.body);
    n = begun.json().session;
    const refusedPotion = await noItemsCmd({
      type: "tactical",
      action: { type: "item", unitId: "hero", itemName: "Potion", targetId: "hero" },
    });
    assert.equal(refusedPotion.statusCode, 400, refusedPotion.body);
    assert.deepEqual(JSON.parse((await chats.getById(noItemsChat.id))!.metadata).gameInventory, potions);
  }
  // A game set to take turns by initiative (combat C6c) starts its tactical fight with an order; a per-chat
  // choice outweighs the setup's, and a game that says nothing starts by side.
  for (const [setupOrder, chatOrder, expected] of [
    ["initiative", undefined, true],
    ["initiative", "side", false],
    [undefined, "initiative", true],
    [undefined, undefined, false],
  ] as const) {
    const orderChat = await chats.create({ name: "Turn order proof", mode: "game", characterIds: [] });
    const anchor = await chats.createMessage({ chatId: orderChat.id, role: "assistant", content: "[state: combat]" });
    await chats.patchMetadata(orderChat.id, {
      gameSetupConfig: {
        combatDirector: true,
        tacticalBattlefield: { seed: 9, size: "small" },
        ...(setupOrder ? { tacticalTurnOrder: setupOrder } : {}),
      },
      ...(chatOrder ? { gameTacticalTurnOrder: chatOrder } : {}),
    });
    const started = await post("/combat/start", { ...input, chatId: orderChat.id, anchor: anchor.id });
    assert.equal(started.statusCode, 200, started.body);
    const view = started.json().session as DirectedCombatView;
    assert.equal(!!view.tactical?.initiative, expected, `${setupOrder} / ${chatOrder}`);
  }
  console.log(
    "Combat director route: authority, idempotency, terrain, atomic item costs, late GM output, restore identity, branch isolation and turn order passed.",
  );
} finally {
  await app.close();
  await closeDB();
  rmSync(dataDir, { recursive: true, force: true });
}
