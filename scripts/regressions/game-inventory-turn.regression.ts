/**
 * The Game Master's `[inventory:]` tags through a real turn: the generate route applies them when it
 * saves the reply, rewrites each one with what happened, saves the stacks and the journal, and tells
 * the client the chat's inventory changed. Nothing in the browser applies them any more, so a reply
 * that finished while nobody was reading it still changes the inventory.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ChatMessage, ChatOptions, LLMUsage } from "../../packages/server/src/services/llm/base-provider.js";

const dir = mkdtempSync(join(tmpdir(), "marinara-inventory-turn-"));
process.env.DATA_DIR = dir;
process.env.FILE_STORAGE_DIR = join(dir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";
const requireServer = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const Fastify = requireServer("fastify") as typeof import("fastify").default;
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { generateRoutes } = await import("../../packages/server/src/routes/generate.routes.js");
const { chatsRoutes } = await import("../../packages/server/src/routes/chats.routes.js");
const { createGameStateStorage } = await import("../../packages/server/src/services/storage/game-state.storage.js");
const { gameInventoryRoutes } = await import("../../packages/server/src/routes/game-inventory.routes.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { gameRoutes } = await import("../../packages/server/src/routes/game.routes.js");
const { createGameRulesetsStorage } =
  await import("../../packages/server/src/services/storage/game-rulesets.storage.js");
const { createCharactersStorage } = await import("../../packages/server/src/services/storage/characters.storage.js");
const {
  normalizeGameInventoryStacks,
  gameInventoryCount,
  readResolvedInventoryTags,
  CHAT_PRESET_EXCLUDED_METADATA_KEYS,
  characterDataSchema,
} = await import("../../packages/shared/src/index.js");
const { ClaudeSubscriptionProvider } =
  await import("../../packages/server/src/services/llm/providers/claude-subscription.provider.js");

const prompts: ChatMessage[][] = [];
let reply = "";
async function* scriptedChat(messages: ChatMessage[], _options: ChatOptions): AsyncGenerator<string, LLMUsage> {
  prompts.push(structuredClone(messages));
  yield reply;
  return { promptTokens: 10, completionTokens: 5, totalTokens: 15, finishReason: "stop" };
}
const originalChat = ClaudeSubscriptionProvider.prototype.chat;
ClaudeSubscriptionProvider.prototype.chat = scriptedChat;

const db = await getDB();
const chats = createChatsStorage(db);
const app = Fastify();
app.decorate("db", db);
await app.register(generateRoutes, { prefix: "/api/generate" });
await app.register(chatsRoutes, { prefix: "/api/chats" });
await app.register(gameInventoryRoutes, { prefix: "/api/game/inventory" });
await app.register(gameRoutes, { prefix: "/api/game" });
try {
  const connection = await createConnectionsStorage(db).create({
    name: "Inventory fixture",
    provider: "claude_subscription",
    model: "fixture",
    apiKey: "synthetic-fixture",
    maxContext: 32768,
  });
  const chat = await chats.create({
    name: "Inventory turn",
    mode: "game",
    characterIds: [],
    connectionId: connection.id,
    promptPresetId: null,
  });
  assert.ok(chat);
  await chats.patchMetadata(chat.id, {
    enableAgents: false,
    enableTools: false,
    // Bram left the party but still carries the arrows, so the Game Master can still name him.
    gameInventory: [
      { id: "st-rope", name: "Rope", quantity: 1 },
      { id: "st-arrows", name: "Arrow", quantity: 10, holder: "Bram" },
    ],
  });
  const readInventory = async () => {
    const row = await chats.getById(chat.id);
    const meta = typeof row!.metadata === "string" ? JSON.parse(row!.metadata) : row!.metadata;
    return { stacks: normalizeGameInventoryStacks(meta.gameInventory), journal: meta.gameJournal };
  };
  const turn = async (text: string, payload: Record<string, unknown> = {}) => {
    reply = text;
    await chats.createMessage({ chatId: chat.id, role: "user", content: "I look around." });
    const response = await app.inject({
      method: "POST",
      url: "/api/generate/",
      payload: { chatId: chat.id, streaming: true, ...payload },
    });
    assert.equal(response.statusCode, 200, response.body);
    assert.ok(!response.body.includes('"type":"error"'), response.body);
    return { response, saved: (await chats.listMessages(chat.id)).at(-1)! };
  };

  // The prompt shows who carries what, since Bram carries something.
  const first = await turn(
    [
      `You find a lantern. [inventory: action="add" item="Lantern"]`,
      `Bram hands over two arrows. [inventory: action="give" item="Arrow" count="2" who="Bram" to="User"]`,
      `The rope snaps. [inventory: action="remove" item="Rope" result="ok"]`,
      `[inventory: action="remove" item="Crown"]`,
    ].join("\n"),
  );
  assert.match(
    prompts
      .at(-1)!
      .map((message) => message.content)
      .join("\n"),
    /PARTY INVENTORY:\n- User: Rope\n- Bram: Arrow ×10/,
  );
  const resolved = readResolvedInventoryTags(first.saved.content);
  assert.deepEqual(
    resolved.map((tag) => `${tag.action} ${tag.item} ${tag.ok ? `ok ${tag.count}->${tag.now}` : tag.reason}`),
    ["add Lantern ok 1->1", "give Arrow ok 2->2", "remove Rope ok 1->0", "remove Crown none-held"],
    "every tag is answered in the saved reply, a forged result included",
  );
  const after = await readInventory();
  assert.equal(gameInventoryCount(after.stacks, "Lantern", {}), 1);
  assert.equal(gameInventoryCount(after.stacks, "Arrow", {}), 2);
  assert.equal(gameInventoryCount(after.stacks, "Arrow", { holder: "Bram" }), 8);
  assert.equal(gameInventoryCount(after.stacks, "Rope"), 0);
  assert.deepEqual(
    (after.journal?.inventoryLog ?? []).map(
      (entry: { item: string; action: string }) => `${entry.action} ${entry.item}`,
    ),
    ["acquired Lantern", "lost Rope"],
  );
  assert.match(first.response.body, /"type":"metadata_patch","data":\{"gameInventory":/, "the client is told");

  // The next turn's prompt carries the answered tags, so the Game Master reads its own refusal.
  const second = await turn(`Nothing else happens.`);
  assert.match(
    prompts
      .at(-1)!
      .map((message) => message.content)
      .join("\n"),
    /item="Crown" count="1" result="refused" reason="none-held"/,
  );
  assert.doesNotMatch(second.response.body, /"type":"metadata_patch","data":\{"gameInventory":/);
  assert.equal(normalizeGameInventoryStacks((await readInventory()).stacks).length, after.stacks.length);

  // An impersonated turn is the player writing: nothing in it is applied.
  reply = `I take the crown. [inventory: action="add" item="Crown"]`;
  const impersonated = await app.inject({
    method: "POST",
    url: "/api/generate/",
    payload: { chatId: chat.id, streaming: true, impersonate: true },
  });
  assert.equal(impersonated.statusCode, 200, impersonated.body);
  assert.equal(gameInventoryCount((await readInventory()).stacks, "Crown"), 0);

  // ── Tellings of one turn never add up (#6774) ──
  {
    const swords = async () => gameInventoryCount((await readInventory()).stacks, "Sword");
    const maps = async () => gameInventoryCount((await readInventory()).stacks, "Map");
    const sword = `A blade in the grass. [inventory: action="add" item="Sword"]`;
    // The turn before carries a detailed inventory, so every telling's own row gets one too.
    const states = createGameStateStorage(db);
    const previous = (await chats.listMessages(chat.id)).filter((message) => message.role === "assistant").at(-1)!;
    await states.create({
      chatId: chat.id,
      messageId: previous.id,
      swipeIndex: previous.activeSwipeIndex ?? 0,
      date: null,
      time: null,
      location: null,
      weather: null,
      temperature: null,
      presentCharacters: [],
      recentEvents: [],
      playerStats: {
        stats: [],
        attributes: null,
        skills: {},
        inventory: [{ name: "Lantern", description: "", quantity: 1, location: "on_person" }],
        activeQuests: [],
        status: "",
      } as never,
      personaStats: null,
    });
    const rowSwords = async (swipe: number) => {
      const row = await states.getByChatAndMessage(chat.id, told.saved.id, swipe);
      const stats = row?.playerStats ? JSON.parse(row.playerStats as string) : null;
      return (stats?.inventory ?? [])
        .filter((item: { name: string }) => item.name === "Sword")
        .reduce((total: number, item: { quantity: number }) => total + item.quantity, 0);
    };
    const told = await turn(sword);
    assert.equal(await swords(), 1);
    assert.equal(await rowSwords(0), 1, "the turn's own row has the sword");
    const regenerate = async (text: string) => {
      reply = text;
      const response = await app.inject({
        method: "POST",
        url: "/api/generate/",
        payload: { chatId: chat.id, streaming: true, regenerateMessageId: told.saved.id },
      });
      assert.equal(response.statusCode, 200, response.body);
      assert.ok(!response.body.includes('"type":"error"'), response.body);
    };
    const showSwipe = async (index: number) => {
      const response = await app.inject({
        method: "PUT",
        url: `/api/chats/${chat.id}/messages/${told.saved.id}/active-swipe`,
        payload: { index },
      });
      assert.equal(response.statusCode, 200, response.body);
    };

    await regenerate(sword);
    assert.equal(await swords(), 1, "the second telling starts where the turn began, not where the first left it");
    // And the Game Master is shown the inventory it starts from, without the first telling's sword.
    const shown = prompts
      .at(-1)!
      .map((message) => message.content)
      .join("\n");
    const inventoryBlock = shown.slice(shown.search(/(PARTY|PLAYER) INVENTORY/));
    assert.match(inventoryBlock, /(PARTY|PLAYER) INVENTORY/);
    assert.doesNotMatch(inventoryBlock.split("\n\n")[0]!, /Sword/);
    assert.equal(await rowSwords(1), 1, "and so does its row, not built on the first telling's");
    await regenerate(`The grass is empty.`);
    assert.equal(await swords(), 0, "a telling with no tags leaves the turn as it began");
    assert.equal(await rowSwords(2), 0);
    // Its row carries the turn's beginning too, rather than being left to whatever it was cloned from.
    const telling2 = await states.getByChatAndMessage(chat.id, told.saved.id, 2);
    assert.deepEqual(
      JSON.parse(telling2!.playerStats as string).inventory.map((item: { name: string }) => item.name),
      ["Lantern"],
    );

    await showSwipe(0);
    assert.equal(await swords(), 1, "swiping back shows what the first telling left");
    await showSwipe(2);
    assert.equal(await swords(), 0);
    await showSwipe(1);
    assert.equal(await swords(), 1);

    // Once the player changes the inventory, nothing they did is thrown away.
    const added = await app.inject({
      method: "POST",
      url: "/api/game/inventory",
      payload: { chatId: chat.id, ops: [{ op: "add", name: "Map", count: 1 }] },
    });
    assert.equal(added.statusCode, 200, added.body);
    await showSwipe(2);
    assert.equal(await swords(), 1, "the sword stays: the stacks are no longer what that telling left");
    assert.equal(await maps(), 1);
    await regenerate(sword);
    assert.equal(await swords(), 2, "and a new telling adds on top of the player's change");
    assert.equal(await maps(), 1);

    // A continuation adds to its own telling, and its row keeps what the first part already wrote.
    reply = `A torch, too. [inventory: action="add" item="Torch"]`;
    const continued = await app.inject({
      method: "POST",
      url: "/api/generate/",
      payload: { chatId: chat.id, streaming: true, continueMessageId: told.saved.id },
    });
    assert.equal(continued.statusCode, 200, continued.body);
    assert.ok(!continued.body.includes('"type":"error"'), continued.body);
    assert.equal(gameInventoryCount((await readInventory()).stacks, "Torch"), 1);
    const active = (await chats.getMessage(told.saved.id))!.activeSwipeIndex ?? 0;
    const row = await states.getByChatAndMessage(chat.id, told.saved.id, active);
    const names = (JSON.parse(row!.playerStats as string).inventory as Array<{ name: string }>).map(
      (item) => item.name,
    );
    assert.ok(
      names.includes("Torch") && names.includes("Sword"),
      `the continued row keeps both parts: ${names.join(", ")}`,
    );
  }

  // ── Branching and deleting tellings keep each telling's result with it (#6774) ──
  {
    const gems = async (chatId = chat.id) => {
      const row = await chats.getById(chatId);
      const meta = typeof row!.metadata === "string" ? JSON.parse(row!.metadata) : row!.metadata;
      return gameInventoryCount(normalizeGameInventoryStacks(meta.gameInventory), "Gem");
    };
    const gem = (count: number) => `A gem glints. [inventory: action="add" item="Gem" count="${count}"]`;
    const told = await turn(gem(1));
    const beforeTurn = (await chats.listMessages(chat.id)).at(-2)!;
    const retell = async (count: number) => {
      reply = gem(count);
      const response = await app.inject({
        method: "POST",
        url: "/api/generate/",
        payload: { chatId: chat.id, streaming: true, regenerateMessageId: told.saved.id },
      });
      assert.equal(response.statusCode, 200, response.body);
      assert.ok(!response.body.includes('"type":"error"'), response.body);
    };
    const show = async (index: number, chatId = chat.id, messageId = told.saved.id) => {
      const response = await app.inject({
        method: "PUT",
        url: `/api/chats/${chatId}/messages/${messageId}/active-swipe`,
        payload: { index },
      });
      assert.equal(response.statusCode, 200, response.body);
    };
    const drop = async (path: string) => {
      const response = await app.inject({
        method: "DELETE",
        url: `/api/chats/${chat.id}/messages/${told.saved.id}/swipes/${path}`,
      });
      assert.equal(response.statusCode, 200, response.body);
    };
    await retell(2);
    await retell(3);
    assert.equal(await gems(), 3, "three tellings, of one, two and three gems, the last one shown");

    // A branch takes the record with its copy of the turn, so the branch's tellings still switch.
    const branch = await app.inject({ method: "POST", url: `/api/chats/${chat.id}/branch`, payload: {} });
    assert.equal(branch.statusCode, 200, branch.body);
    const branchId = branch.json().id as string;
    const branchedTurn = (await chats.listMessages(branchId)).at(-1)!;
    await show(0, branchId, branchedTurn.id);
    assert.equal(await gems(branchId), 1, "the branch shows its copy of the first telling");
    assert.equal(await gems(), 3, "and the chat it came from is untouched");
    // A branch cut before the turn has no copy of it for the record to follow.
    const cut = await app.inject({
      method: "POST",
      url: `/api/chats/${chat.id}/branch`,
      payload: { upToMessageId: beforeTurn.id },
    });
    assert.equal(cut.statusCode, 200, cut.body);
    const cutRow = await chats.getById(cut.json().id);
    const cutMeta = typeof cutRow!.metadata === "string" ? JSON.parse(cutRow!.metadata) : cutRow!.metadata;
    assert.equal(cutMeta.gameInventoryTurn, undefined);

    // Deleting a telling that is not shown: the later ones move down with their results.
    await drop("0");
    assert.equal(await gems(), 3);
    await show(0);
    assert.equal(await gems(), 2, "the telling now first is the one that gave two");
    await show(1);
    assert.equal(await gems(), 3);
    await retell(4);
    assert.equal(await gems(), 4, "a new telling still starts where the turn began");
    // Deleting every other telling, the one shown among them: the telling kept is followed.
    await show(0);
    assert.equal(await gems(), 2);
    await drop("others/2");
    assert.equal(await gems(), 4, "the telling kept is the one that gave four");
    // Deleting the telling that is shown: the one shown next is followed.
    await retell(5);
    assert.equal(await gems(), 5);
    await drop("1");
    assert.equal(await gems(), 4);
  }

  // The next session carries every bag, but not the record of how one of this session's turns was
  // told, and a saved chat profile never takes it either.
  {
    const gameId = "inventory-turn-sessions";
    const previous = await chats.create({
      name: "Inventory turn — Session 1",
      mode: "game",
      characterIds: [],
      groupId: gameId,
    });
    assert.ok(previous);
    const stacks = [
      { id: "st-rope", name: "Rope", quantity: 2 },
      { id: "st-arrows", name: "Arrow", quantity: 10, holder: "Bram" },
    ];
    await chats.patchMetadata(previous.id, {
      gameId,
      gameSessionStatus: "concluded",
      gameSessionNumber: 1,
      gameInventory: stacks,
      gameInventoryTurn: { messageId: "session-one-turn", before: [], swipes: { "0": stacks } },
    });
    const started = await app.inject({ method: "POST", url: "/api/game/session/start", payload: { gameId } });
    assert.equal(started.statusCode, 200, started.body);
    const next = await chats.getById(started.json().sessionChat.id);
    const meta = typeof next!.metadata === "string" ? JSON.parse(next!.metadata) : next!.metadata;
    assert.deepEqual(
      normalizeGameInventoryStacks(meta.gameInventory).map(
        (stack) => `${stack.name} ${stack.quantity} ${stack.holder ?? "player"}`,
      ),
      ["Rope 2 player", "Arrow 10 Bram"],
      "every bag carries over",
    );
    assert.equal(meta.gameInventoryTurn, undefined, "the previous session's turn record stays behind");
    assert.ok(CHAT_PRESET_EXCLUDED_METADATA_KEYS.includes("gameInventoryTurn"));
  }

  // ── A ruleset's items (#6795): the route and a turn read the game's ruleset ──
  {
    const ember = JSON.parse(
      readFileSync(fileURLToPath(new URL("../../docs/examples/rulesets/ember-roads.json", import.meta.url)), "utf8"),
    ) as Record<string, any>;
    // Without carrying: these checks are about which item a name is and how many one stack holds, and
    // carrying has its own section below.
    delete ember.items.carry;
    for (const family of ember.items.currencies ?? []) delete family.perWeight;
    const strict = structuredClone(ember);
    strict.id = "ember-strict";
    strict.items.freeform = "refuse";
    const rulesets = createGameRulesetsStorage(db);
    await rulesets.put({
      rulesetId: "local/ember-roads",
      version: ember.version,
      sourceKind: "local",
      definition: JSON.stringify(ember),
    });
    await rulesets.put({
      rulesetId: "local/ember-strict",
      version: strict.version,
      sourceKind: "local",
      definition: JSON.stringify(strict),
    });
    const connection = (await createConnectionsStorage(db).list())[0]!;
    const rulesetGame = async (id: string) => {
      const game = await chats.create({
        name: `Ruleset items ${id}`,
        mode: "game",
        characterIds: [],
        connectionId: connection.id,
        promptPresetId: null,
      });
      assert.ok(game);
      await chats.patchMetadata(game.id, {
        enableAgents: false,
        enableTools: false,
        gameRuleset: { id, version: ember.version, packageId: null, options: {} },
      });
      return game;
    };
    const stacksOf = async (chatId: string) => {
      const row = await chats.getById(chatId);
      const meta = typeof row!.metadata === "string" ? JSON.parse(row!.metadata) : row!.metadata;
      return normalizeGameInventoryStacks(meta.gameInventory).map(
        (stack) => `${stack.name}${stack.item ? ` <${stack.item}>` : ""} ${stack.quantity}`,
      );
    };
    const change = async (chatId: string, ops: unknown[]) => {
      const response = await app.inject({ method: "POST", url: "/api/game/inventory", payload: { chatId, ops } });
      assert.equal(response.statusCode, 200, response.body);
      return response.json().results as Array<{ ok: boolean; reason?: string }>;
    };

    // The player's typed name is the ruleset's item; one picked adds by its id; arrows stack by 20.
    const roads = await rulesetGame("local/ember-roads");
    await change(roads.id, [
      { op: "add", name: "hand AXE", count: 1 },
      { op: "add", name: "Arrows", item: "outfitter/arrows", count: 30 },
      { op: "add", name: "Rope", count: 1 },
    ]);
    assert.deepEqual(await stacksOf(roads.id), [
      "Hand axe <outfitter/hand-axe> 1",
      "Arrows <outfitter/arrows> 20",
      "Arrows <outfitter/arrows> 10",
      "Rope 1",
    ]);
    // Only its own items, in a ruleset that takes nothing else.
    const strictGame = await rulesetGame("local/ember-strict");
    const refusedPlain = await change(strictGame.id, [
      { op: "add", name: "Rope", count: 1 },
      { op: "add", name: "Road rations", count: 1 },
    ]);
    assert.deepEqual(
      refusedPlain.map((result) => (result.ok ? "ok" : result.reason)),
      ["not-ruleset-item", "ok"],
    );
    assert.deepEqual(await stacksOf(strictGame.id), ["Road rations <outfitter/road-rations> 1"]);
    // Arrows the party carried before the game had its ruleset's items: a plain item of that name.
    const beforeTurn = await chats.getById(strictGame.id);
    const beforeMeta =
      typeof beforeTurn!.metadata === "string" ? JSON.parse(beforeTurn!.metadata) : beforeTurn!.metadata;
    await chats.patchMetadata(strictGame.id, {
      gameInventory: [...beforeMeta.gameInventory, { id: "st-old-arrows", name: "Arrows", quantity: 4 }],
    });

    // The Game Master's name is the ruleset's item too, stacked by 7, and its plain items still land
    // (untyped items are the native switch's, not freeform's).
    reply = `You find food. [inventory: action="add" item="Road rations" count="9"] And a lamp. [inventory: action="add" item="Lamp"] And a fresh quiver. [inventory: action="add" item="Arrows" count="2"]`;
    await chats.createMessage({ chatId: strictGame.id, role: "user", content: "I search the wagon." });
    const gmTurn = await app.inject({
      method: "POST",
      url: "/api/generate/",
      payload: { chatId: strictGame.id, streaming: true },
    });
    assert.equal(gmTurn.statusCode, 200, gmTurn.body);
    const answered = readResolvedInventoryTags((await chats.listMessages(strictGame.id)).at(-1)!.content);
    assert.deepEqual(
      answered.map((tag) => `${tag.item} ${tag.ok ? `ok ${tag.count}->${tag.now}` : tag.reason}`),
      // The ruleset's arrows are another item than the old plain ones, so two are held of them.
      ["Road rations ok 9->10", "Lamp ok 1->1", "Arrows ok 2->2"],
    );
    // The answers streamed before the reply is saved already read the ruleset.
    const streamed = gmTurn.body
      .split("\n")
      .filter((line) => line.startsWith("data: "))
      .map((line) => {
        try {
          return JSON.parse(line.slice("data: ".length)) as { type?: string; data?: unknown };
        } catch {
          return null;
        }
      })
      .find((event) => event?.type === "content_replace");
    assert.match(String(streamed?.data ?? ""), /item="Arrows" count="2" result="ok" now="2"/);
    assert.deepEqual(await stacksOf(strictGame.id), [
      "Road rations <outfitter/road-rations> 7",
      "Arrows 4",
      "Road rations <outfitter/road-rations> 3",
      "Lamp 1",
      "Arrows <outfitter/arrows> 2",
    ]);
    // The next turn's prompt says what the ruleset's item is, and that names become its items.
    reply = "The road goes on.";
    await chats.createMessage({ chatId: strictGame.id, role: "user", content: "I walk on." });
    const next = await app.inject({
      method: "POST",
      url: "/api/generate/",
      payload: { chatId: strictGame.id, streaming: true },
    });
    assert.equal(next.statusCode, 200, next.body);
    const prompt = prompts
      .at(-1)!
      .map((message) => message.content)
      .join("\n");
    assert.match(
      prompt,
      /PLAYER INVENTORY \(Body 0 of 1, Hands 0 of 2\): Road rations ×10 \[Provisions, Common; Bulk 1\]; Arrows ×4; Lamp; Arrows ×2 \[Ammunition, Common; Bulk 1\]/,
    );
    assert.match(prompt, /an item named exactly as one of them becomes that item/);

    // A new session brings back what only the detailed inventory still names, stacked as its item
    // allows: thirty arrows are a stack of twenty and one of ten.
    const gameId = "ruleset-items-sessions";
    const ended = await chats.create({
      name: "Ruleset items — Session 1",
      mode: "game",
      characterIds: [],
      groupId: gameId,
    });
    assert.ok(ended);
    await chats.patchMetadata(ended.id, {
      gameId,
      gameSessionStatus: "concluded",
      gameSessionNumber: 1,
      gameRuleset: { id: "local/ember-roads", version: ember.version, packageId: null, options: {} },
      gameInventory: [],
    });
    const last = await chats.createMessage({ chatId: ended.id, role: "assistant", content: "The road ends here." });
    await createGameStateStorage(db).create({
      chatId: ended.id,
      messageId: last.id,
      swipeIndex: 0,
      date: null,
      time: null,
      location: null,
      weather: null,
      temperature: null,
      presentCharacters: [],
      recentEvents: [],
      playerStats: {
        stats: [],
        attributes: null,
        skills: {},
        inventory: [{ item: "outfitter/arrows", name: "Arrows", description: "", quantity: 30, location: "on_person" }],
        activeQuests: [],
        status: "",
      } as never,
      personaStats: null,
    });
    const carried = await app.inject({ method: "POST", url: "/api/game/session/start", payload: { gameId } });
    assert.equal(carried.statusCode, 200, carried.body);
    assert.deepEqual(await stacksOf(carried.json().sessionChat.id), [
      "Arrows <outfitter/arrows> 20",
      "Arrows <outfitter/arrows> 10",
    ]);
  }

  // ── Wearing and carrying (#6801): the route and a turn read each character's sheet ──
  {
    const read = (name: string) =>
      JSON.parse(
        readFileSync(fileURLToPath(new URL(`../../docs/examples/rulesets/${name}.json`, import.meta.url)), "utf8"),
      ) as Record<string, any>;
    const ember = { ...read("ember-roads"), id: "ember-carry" };
    const gravewatch = { ...read("gravewatch"), id: "gravewatch-kit" };
    const rulesets = createGameRulesetsStorage(db);
    await rulesets.put({
      rulesetId: "local/ember-carry",
      version: ember.version,
      sourceKind: "local",
      definition: JSON.stringify(ember),
    });
    await rulesets.put({
      rulesetId: "local/gravewatch-kit",
      version: gravewatch.version,
      sourceKind: "local",
      definition: JSON.stringify(gravewatch),
    });
    const connection = (await createConnectionsStorage(db).list())[0]!;
    // Bram is a party member, so the Game Master's shared adds may go to him.
    const bram = await createCharactersStorage(db).create(characterDataSchema.parse({ name: "Bram" }));
    const game = async (id: string, version: number, cards: unknown[]) => {
      const made = await chats.create({
        name: `Wearing ${id}`,
        mode: "game",
        characterIds: [],
        connectionId: connection.id,
        promptPresetId: null,
      });
      assert.ok(made);
      await chats.patchMetadata(made.id, {
        enableAgents: false,
        enableTools: false,
        gameRuleset: { id, version, packageId: null, options: {} },
        gameCharacterCards: cards,
        gamePartyCharacterIds: [bram.id],
      });
      return made;
    };
    const stacksOf = async (chatId: string) => {
      const row = await chats.getById(chatId);
      const meta = typeof row!.metadata === "string" ? JSON.parse(row!.metadata) : row!.metadata;
      return normalizeGameInventoryStacks(meta.gameInventory).map(
        (stack) =>
          `${stack.name} ${stack.quantity} ${stack.holder ?? "player"}${stack.equipped ? " worn" : ""}${stack.bound ? " bound" : ""}`,
      );
    };
    const change = async (chatId: string, ops: unknown[]) => {
      const response = await app.inject({ method: "POST", url: "/api/game/inventory", payload: { chatId, ops } });
      assert.equal(response.statusCode, 200, response.body);
      return response.json().results as Array<Record<string, unknown>>;
    };
    const turnIn = async (chatId: string, text: string) => {
      reply = text;
      await chats.createMessage({ chatId, role: "user", content: "We go on." });
      const response = await app.inject({
        method: "POST",
        url: "/api/generate/",
        payload: { chatId, streaming: true },
      });
      assert.equal(response.statusCode, 200, response.body);
      return readResolvedInventoryTags((await chats.listMessages(chatId)).at(-1)!.content).map(
        (tag) => `${tag.action} ${tag.item} ${tag.who ?? "-"} ${tag.ok ? `ok ${tag.count}->${tag.now}` : tag.reason}`,
      );
    };

    // Ember Roads: a traveller carries 6 + Brawn before the road slows them, and 12 at the most. With
    // no persona the first card is the player's: Ada, Brawn 0 (6); Bram, Brawn 3 (9).
    const sheet = (brawn: number) => ({
      v: 1,
      build: { abilities: { brawn, wits: 0, heart: 0 }, fields: {}, lists: {} },
    });
    const road = await game("local/ember-carry", ember.version, [
      { name: "Ada", rulesetSheet: sheet(0) },
      { name: "Bram", rulesetSheet: sheet(3) },
    ]);
    const shared = ["", "Bram"];
    // The coat (Bulk 3) fits Ada. Five rations do not fit her any more, so they all go to Bram.
    await change(road.id, [
      { op: "add", name: "Leather coat", count: 1, among: shared },
      { op: "add", name: "Road rations", count: 5, among: shared },
    ]);
    assert.deepEqual(await stacksOf(road.id), ["Leather coat 1 player", "Road rations 5 Bram"]);
    // Ten arrows fit nobody whole: split by the room each has left (Bram 4, Ada 3), then one at a time
    // to whoever is then least over. The answers say who got how many.
    assert.deepEqual(
      await turnIn(
        road.id,
        `The quartermaster hands over a bundle. [inventory: action="add" item="Arrows" count="10"]`,
      ),
      ["add Arrows - ok 5->5", "add Arrows Bram ok 5->5"],
    );
    // Four bows (Bulk 2) are more than anyone can carry at all: three go, one stays behind.
    assert.deepEqual(await turnIn(road.id, `A rack of bows. [inventory: action="add" item="Hunting bow" count="4"]`), [
      "add Hunting bow - ok 2->2",
      "add Hunting bow Bram ok 1->1",
      "add Hunting bow - too-heavy",
    ]);
    // Past what Bram can carry at all, the player cannot hand him more.
    const savedStacks = async () =>
      normalizeGameInventoryStacks(JSON.parse((await chats.getById(road.id))!.metadata as string).gameInventory);
    const bows = (await savedStacks()).find((stack) => stack.name === "Hunting bow" && !stack.holder)!;
    const coat = (await savedStacks()).find((stack) => stack.name === "Leather coat")!;
    assert.deepEqual(
      (await change(road.id, [{ op: "give", id: bows.id, to: "Bram", count: 1 }])).map((result) => result.reason),
      ["too-heavy"],
    );
    // Slots: the coat takes the body and one bow both hands (taken out of the pair into its own
    // stack), so the other bow finds no hand free.
    assert.deepEqual(
      (
        await change(road.id, [
          { op: "equip", id: coat.id },
          { op: "equip", id: bows.id },
        ])
      ).map((result) => (result.ok ? "ok" : result.reason)),
      ["ok", "ok"],
    );
    const spare = (await savedStacks()).find(
      (stack) => stack.name === "Hunting bow" && !stack.holder && !stack.equipped,
    )!;
    assert.equal(spare.quantity, 1);
    assert.deepEqual(
      (await change(road.id, [{ op: "equip", id: spare.id }])).map((result) => (result.ok ? "ok" : result.reason)),
      ["no-slot"],
    );
    // The next turn's prompt shows each character's load and slots, and what is worn.
    const prompt = async () => {
      reply = "The road is long.";
      await chats.createMessage({ chatId: road.id, role: "user", content: "We walk." });
      const response = await app.inject({
        method: "POST",
        url: "/api/generate/",
        payload: { chatId: road.id, streaming: true },
      });
      assert.equal(response.statusCode, 200, response.body);
      return prompts
        .at(-1)!
        .map((message) => message.content)
        .join("\n");
    };
    const text = await prompt();
    const at = text.indexOf("PARTY INVENTORY:");
    const block = text.slice(at, text.indexOf("\n\n", at));
    assert.match(
      block,
      /- User \(load 12 of 6, most 12, encumbered; Body 1 of 1, Hands 2 of 2\): Leather coat \(1 worn\) \[[^\]]*\]; Arrows ×5 \[[^\]]*\]; Hunting bow ×2 \(1 worn\)/,
    );
    assert.match(block, /- Bram \(load 12 of 9, most 12, encumbered; Body 0 of 1, Hands 0 of 2\): /);
    // And each sheet reads what its character wears (#6826): Guard is 6 + Wits, and Ada's coat adds 1.
    assert.match(text, /\nAda\nBRN \+0, WIT \+0, HRT \+0\nGrit maximum 6, Guard 7\n/);
    assert.match(text, /\nBram\nBRN \+3, WIT \+0, HRT \+0\nGrit maximum \d+, Guard 6\n/);
    // And a check reads it (#6832): the coat Ada wears costs her Sneak 1, and the saved record says so.
    reply = `Ada creeps past the guards. [skill_check: skill="Sneak" dc="8"]`;
    await chats.createMessage({ chatId: road.id, role: "user", content: "I sneak." });
    const sneaked = await app.inject({
      method: "POST",
      url: "/api/generate/",
      payload: { chatId: road.id, streaming: true },
    });
    assert.equal(sneaked.statusCode, 200, sneaked.body);
    const checked = (await chats.listMessages(road.id)).at(-1)!.content;
    assert.match(
      checked,
      // And 12 bulk carried is past the 10 at which the road slows anybody (#6846): a level off a
      // derived value, with nobody ticking a track.
      /\[skill_check: skill="Sneak" dc="8" rolls="\d+\|\d+"[^\]]* effects="-2" from="Bulk carried 10; Leather coat"\]/,
    );
    assert.match(text, /an add with who left out goes to whoever can carry it/);
    // A check the ruleset rolled with its own dice is saved as it rolled it: Bram's Scrap with his
    // Brawn of 3 and his name, never rolled a second time as if nobody's sheet were read.
    reply = `Bram heaves the cart free. [skill_check: skill="Scrap" dc="8" who="Bram"]`;
    await chats.createMessage({ chatId: road.id, role: "user", content: "Bram pushes." });
    const heaved = await app.inject({
      method: "POST",
      url: "/api/generate/",
      payload: { chatId: road.id, streaming: true },
    });
    assert.equal(heaved.statusCode, 200, heaved.body);
    assert.match(
      (await chats.listMessages(road.id)).at(-1)!.content,
      /\[skill_check: skill="Scrap" dc="8" rolls="\d+\|\d+" used="\d+" modifier="3" [^\]]*who="Bram"\]/,
    );
    assert.match(text, /\[inventory: action="equip\|unequip" item=/);

    // Gravewatch: binding up to the bearer's Nerve. Ada has Nerve 1, so the ring binds and the bell
    // cannot. The ring is cursed: the player cannot unbind it, give it or throw it away, and the Game
    // Master can end the curse in the story.
    const watch = await game("local/gravewatch-kit", gravewatch.version, [
      {
        name: "Ada",
        rulesetSheet: { v: 1, build: { abilities: { sinew: 1, nerve: 1, warmth: 1 }, fields: {}, lists: {} } },
      },
    ]);
    await change(watch.id, [
      { op: "add", name: "Widow's ring", count: 1 },
      { op: "add", name: "Dawn bell", count: 1 },
      { op: "add", name: "Grave spade", count: 1 },
    ]);
    const kit = normalizeGameInventoryStacks(
      JSON.parse((await chats.getById(watch.id))!.metadata as string).gameInventory,
    );
    const id = (name: string) => kit.find((stack) => stack.name === name)!.id;
    assert.deepEqual(
      (
        await change(watch.id, [
          { op: "bind", id: id("Widow's ring") },
          { op: "bind", id: id("Dawn bell") },
          { op: "bind", id: id("Grave spade") },
          { op: "unbind", id: id("Widow's ring") },
          { op: "give", id: id("Widow's ring"), to: "Bram" },
          { op: "set", id: id("Widow's ring"), quantity: 0 },
        ])
      ).map((result) => (result.ok ? "ok" : result.reason)),
      ["ok", "binding-full", "not-bindable", "cursed", "cursed", "cursed"],
    );
    assert.deepEqual(
      await turnIn(watch.id, `The priest lifts the curse. [inventory: action="unbind" item="Widow's ring"]`),
      ["unbind Widow's ring - ok 1->0"],
    );
    assert.deepEqual(await stacksOf(watch.id), ["Widow's ring 1 player", "Dawn bell 1 player", "Grave spade 1 player"]);

    // When no card has the player's name, the first card is read for the player, and that card's own
    // bag still reads it too: Bram (Brawn 3) takes all eight rations without strain.
    const firstOnly = await game("local/ember-carry", ember.version, [{ name: "Bram", rulesetSheet: sheet(3) }]);
    await change(firstOnly.id, [{ op: "add", name: "Road rations", count: 8, among: ["Bram", ""] }]);
    assert.deepEqual(await stacksOf(firstOnly.id), ["Road rations 7 Bram", "Road rations 1 Bram"]);
  }

  // ── Invented items (#6814): a turn invents, the game keeps it, the next prompt and session read it ──
  {
    const ember = JSON.parse(
      readFileSync(fileURLToPath(new URL("../../docs/examples/rulesets/ember-roads.json", import.meta.url)), "utf8"),
    ) as Record<string, any>;
    const pin = { id: "local/ember-carry", version: ember.version, packageId: null, options: {} };
    const connection = (await createConnectionsStorage(db).list())[0]!;
    const made = await chats.create({
      name: "Invented items",
      mode: "game",
      characterIds: [],
      connectionId: connection.id,
      promptPresetId: null,
    });
    assert.ok(made);
    await chats.patchMetadata(made.id, { enableAgents: false, enableTools: false, gameRuleset: pin });
    const metaOf = async (chatId: string) => {
      const row = await chats.getById(chatId);
      return (typeof row!.metadata === "string" ? JSON.parse(row!.metadata) : row!.metadata) as Record<string, any>;
    };
    const turnIn = async (text: string, payload: Record<string, unknown> = {}) => {
      reply = text;
      if (!payload.regenerateMessageId) {
        await chats.createMessage({ chatId: made.id, role: "user", content: "I take what she offers." });
      }
      const response = await app.inject({
        method: "POST",
        url: "/api/generate/",
        payload: { chatId: made.id, streaming: true, ...payload },
      });
      assert.equal(response.statusCode, 200, response.body);
      return (await chats.listMessages(made.id)).at(-1)!;
    };

    const told = await turnIn(
      `The widow gives you the blade. [inventory: action="add" item="Mourning Edge" like="outfitter/hand-axe" rarity="storied" stats="guard=4, damage=1d10"]`,
    );
    assert.match(
      told.content,
      /\[inventory: action="add" item="Mourning Edge" count="1" result="ok" now="1" note="Guard is 3 instead of 4, the most at Storied\."\]/,
    );
    const kept = await metaOf(made.id);
    assert.deepEqual(kept.gameInventedItems, [
      {
        id: "mourning-edge",
        name: "Mourning Edge",
        item: {
          category: "weapon",
          rarity: "storied",
          tags: ["thrown"],
          stats: { bulk: 1, damage: "1d10", swing: "brawn", reach: "close", guard: 3 },
          slots: { hands: 1 },
          // Made like the axe, it is a weapon that reads its own damage stat: 1d10.
          attack: {
            budget: "act",
            toHit: { abilities: { stat: "swing" } },
            damage: { dice: { stat: "damage" }, abilities: { stat: "swing" }, type: "cut" },
            reach: 2,
            range: { normal: 10, long: 20 },
          },
        },
        notes: ["Guard is 3 instead of 4, the most at Storied."],
      },
    ]);
    assert.deepEqual(
      normalizeGameInventoryStacks(kept.gameInventory).map((stack) => [stack.name, stack.item, stack.quantity]),
      [["Mourning Edge", "invented:mourning-edge", 1]],
    );

    // Told again with another proposal: the telling starts from before the blade, so nobody holds it,
    // and the retelling's blade is an item of its own, since the first telling still holds the first.
    await turnIn(
      `The widow gives you the blade. [inventory: action="add" item="Mourning Edge" category="weapon" rarity="uncommon" stats="damage=2d6"]`,
      { regenerateMessageId: told.id },
    );
    const retold = await metaOf(made.id);
    assert.deepEqual(
      retold.gameInventedItems.map((item: { id: string; item: { rarity: string; stats: { damage: string } } }) => [
        item.id,
        item.item.rarity,
        item.item.stats.damage,
      ]),
      [
        ["mourning-edge", "storied", "1d10"],
        ["mourning-edge-2", "uncommon", "2d6"],
      ],
    );
    const stacksNow = async () =>
      normalizeGameInventoryStacks((await metaOf(made.id)).gameInventory).map((stack) => [stack.item, stack.quantity]);
    assert.deepEqual(await stacksNow(), [["invented:mourning-edge-2", 1]]);
    // Switched back to the first telling, the stacks hold the first blade, which is still itself; and
    // forward again.
    const showTelling = async (index: number) => {
      const response = await app.inject({
        method: "PUT",
        url: `/api/chats/${made.id}/messages/${told.id}/active-swipe`,
        payload: { index },
      });
      assert.equal(response.statusCode, 200, response.body);
    };
    await showTelling(0);
    assert.deepEqual(await stacksNow(), [["invented:mourning-edge", 1]]);
    assert.equal((await metaOf(made.id)).gameInventedItems[0].item.stats.damage, "1d10");
    await showTelling(1);
    assert.deepEqual(await stacksNow(), [["invented:mourning-edge-2", 1]]);

    // The next turn's prompt reads the invented item like one of the ruleset's own, and shows the
    // proposal form with the ruleset's caps.
    await turnIn("The road goes on.");
    const prompt = prompts
      .at(-1)!
      .map((message) => message.content)
      .join("\n");
    assert.match(prompt, /PLAYER INVENTORY \([^)]*\): Mourning Edge \[Weapon, Uncommon; Damage 2d6\]/);
    assert.match(prompt, /invent one of its items in the add/);
    assert.match(
      prompt,
      /The most at each rarity: common guard 1, worn or carried bonus 1; uncommon guard 2, worn or carried bonus 1; storied guard 3, worn or carried bonus 2\./,
    );

    // A new session keeps the invented items still held and drops the ones nobody holds.
    const gameId = "invented-items-sessions";
    const ended = await chats.create({
      name: "Invented items, Session 1",
      mode: "game",
      characterIds: [],
      groupId: gameId,
    });
    assert.ok(ended);
    await chats.patchMetadata(ended.id, {
      gameId,
      gameSessionStatus: "concluded",
      gameSessionNumber: 1,
      gameRuleset: pin,
      gameInventory: retold.gameInventory,
      gameInventedItems: [
        ...retold.gameInventedItems,
        { id: "lost-charm", name: "Lost Charm", item: { category: "gear", rarity: "common" } },
      ],
    });
    await chats.createMessage({ chatId: ended.id, role: "assistant", content: "The road ends here." });
    const carried = await app.inject({ method: "POST", url: "/api/game/session/start", payload: { gameId } });
    assert.equal(carried.statusCode, 200, carried.body);
    const next = await metaOf(carried.json().sessionChat.id);
    assert.deepEqual(
      next.gameInventedItems.map((item: { id: string }) => item.id),
      ["mourning-edge-2"],
    );
    assert.deepEqual(
      normalizeGameInventoryStacks(next.gameInventory).map((stack) => stack.item),
      ["invented:mourning-edge-2"],
    );
    // A game whose ruleset cannot be read any more keeps them as saved, by the same rule, and
    // anything that is not an invented item at all is dropped.
    const unread = await chats.create({
      name: "Invented items, no ruleset",
      mode: "game",
      characterIds: [],
      groupId: "invented-items-unread",
    });
    assert.ok(unread);
    await chats.patchMetadata(unread.id, {
      gameId: "invented-items-unread",
      gameSessionStatus: "concluded",
      gameSessionNumber: 1,
      gameInventory: retold.gameInventory,
      gameInventedItems: [
        ...retold.gameInventedItems,
        { id: "lost-charm", name: "Lost Charm", item: { category: "gear" } },
        "junk",
        { name: "No id" },
      ],
    });
    await chats.createMessage({ chatId: unread.id, role: "assistant", content: "The road ends here." });
    const unreadNext = await app.inject({
      method: "POST",
      url: "/api/game/session/start",
      payload: { gameId: "invented-items-unread" },
    });
    assert.equal(unreadNext.statusCode, 200, unreadNext.body);
    assert.deepEqual(
      (await metaOf(unreadNext.json().sessionChat.id)).gameInventedItems,
      [retold.gameInventedItems[1]],
      "kept as saved while held, the rest dropped",
    );
    assert.ok(CHAT_PRESET_EXCLUDED_METADATA_KEYS.includes("gameInventedItems"));
  }

  // ── The native switch (#6822): a ruleset without Game Mode's own items ──
  {
    const ember = JSON.parse(
      readFileSync(fileURLToPath(new URL("../../docs/examples/rulesets/ember-roads.json", import.meta.url)), "utf8"),
    ) as Record<string, any>;
    const closed = { ...ember, id: "ember-native" };
    closed.items = { ...ember.items, native: false };
    delete closed.items.carry;
    for (const family of closed.items.currencies ?? []) delete family.perWeight;
    await createGameRulesetsStorage(db).put({
      rulesetId: "local/ember-native",
      version: closed.version,
      sourceKind: "local",
      definition: JSON.stringify(closed),
    });
    const pin = { id: "local/ember-native", version: closed.version, packageId: null, options: {} };
    const connection = (await createConnectionsStorage(db).list())[0]!;
    const made = await chats.create({
      name: "No untyped items",
      mode: "game",
      characterIds: [],
      connectionId: connection.id,
      promptPresetId: null,
    });
    assert.ok(made);
    await chats.patchMetadata(made.id, {
      enableAgents: false,
      enableTools: false,
      gameRuleset: pin,
      gameInventory: [{ id: "st-rope", name: "Rope", quantity: 1 }],
    });
    const stacksOf = async (chatId: string) => {
      const row = await chats.getById(chatId);
      const meta = typeof row!.metadata === "string" ? JSON.parse(row!.metadata) : row!.metadata;
      return normalizeGameInventoryStacks(meta.gameInventory).map(
        (stack) => `${stack.name}${stack.item ? ` <${stack.item}>` : ""} ${stack.quantity}`,
      );
    };

    // The Game Master: a new untyped name is refused; more of what is held, the ruleset's own items and
    // an item it invents all land.
    reply = `The pedlar's cart. [inventory: action="add" item="Lamp"] [inventory: action="add" item="Rope"] [inventory: action="add" item="Hand axe"] [inventory: action="add" item="Moon Charm" category="gear" rarity="common"]`;
    await chats.createMessage({ chatId: made.id, role: "user", content: "I look over the cart." });
    const turn = await app.inject({
      method: "POST",
      url: "/api/generate/",
      payload: { chatId: made.id, streaming: true },
    });
    assert.equal(turn.statusCode, 200, turn.body);
    assert.deepEqual(
      readResolvedInventoryTags((await chats.listMessages(made.id)).at(-1)!.content).map(
        (tag) => `${tag.item} ${tag.ok ? `ok ${tag.count}->${tag.now}` : tag.reason}`,
      ),
      ["Lamp not-ruleset-item", "Rope ok 1->2", "Hand axe ok 1->1", "Moon Charm ok 1->1"],
    );
    // The player's typed-in items still follow freeform, which keeps plain items.
    const typed = await app.inject({
      method: "POST",
      url: "/api/game/inventory",
      payload: { chatId: made.id, ops: [{ op: "add", name: "Candle", count: 1 }] },
    });
    assert.equal(typed.statusCode, 200, typed.body);
    assert.deepEqual(await stacksOf(made.id), [
      "Rope 2",
      "Hand axe <outfitter/hand-axe> 1",
      "Moon Charm <invented:moon-charm> 1",
      "Candle 1",
    ]);
    // And the next turn tells the Game Master so.
    reply = "The road goes on.";
    await chats.createMessage({ chatId: made.id, role: "user", content: "We walk on." });
    const next = await app.inject({
      method: "POST",
      url: "/api/generate/",
      payload: { chatId: made.id, streaming: true },
    });
    assert.equal(next.statusCode, 200, next.body);
    assert.match(
      prompts
        .at(-1)!
        .map((message) => message.content)
        .join("\n"),
      /This ruleset has no untyped items: an add must name one of its items or invent one of its items as below/,
    );

    // A new session brings back a plain item only the detailed inventory still names: the switch is
    // about what the Game Master adds, not about what the party carried.
    const gameId = "native-switch-sessions";
    const ended = await chats.create({
      name: "No untyped items, Session 1",
      mode: "game",
      characterIds: [],
      groupId: gameId,
    });
    assert.ok(ended);
    await chats.patchMetadata(ended.id, {
      gameId,
      gameSessionStatus: "concluded",
      gameSessionNumber: 1,
      gameRuleset: pin,
      gameInventory: [],
    });
    const last = await chats.createMessage({ chatId: ended.id, role: "assistant", content: "The road ends here." });
    await createGameStateStorage(db).create({
      chatId: ended.id,
      messageId: last.id,
      swipeIndex: 0,
      date: null,
      time: null,
      location: null,
      weather: null,
      temperature: null,
      presentCharacters: [],
      recentEvents: [],
      playerStats: {
        stats: [],
        attributes: null,
        skills: {},
        inventory: [{ name: "Old Map", description: "", quantity: 1, location: "on_person" }],
        activeQuests: [],
        status: "",
      } as never,
      personaStats: null,
    });
    const carried = await app.inject({ method: "POST", url: "/api/game/session/start", payload: { gameId } });
    assert.equal(carried.statusCode, 200, carried.body);
    assert.deepEqual(await stacksOf(carried.json().sessionChat.id), ["Old Map 1"]);
  }

  console.info("game inventory turn regressions passed.");
} finally {
  ClaudeSubscriptionProvider.prototype.chat = originalChat;
  await app.close();
  await closeDB();
  rmSync(dir, { recursive: true, force: true });
}
