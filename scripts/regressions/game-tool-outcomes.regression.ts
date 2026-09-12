import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { GameState } from "../../packages/shared/src/types/game-state.js";
const dir = mkdtempSync(join(tmpdir(), "marinara-tool-outcomes-"));
process.env.DATA_DIR = dir;
process.env.FILE_STORAGE_DIR = join(dir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";
const requireServer = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const Fastify = requireServer("fastify") as typeof import("fastify").default;
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { generateRoutes } = await import("../../packages/server/src/routes/generate.routes.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { createGameStateStorage } = await import("../../packages/server/src/services/storage/game-state.storage.js");
const { executeToolCalls } = await import("../../packages/server/src/services/tools/tool-executor.js");
const { worldTrackerLockKey } = await import("../../packages/shared/src/index.js");
const { OpenAIProvider } = await import("../../packages/server/src/services/llm/providers/openai.provider.js");
const db = await getDB();
const chats = createChatsStorage(db);
const states = createGameStateStorage(db);
const app = Fastify();
app.decorate("db", db);
await app.register(generateRoutes, { prefix: "/api/generate" });
const call = (type = "location_change", value = "Harbor") => ({
  id: "change",
  type: "function" as const,
  function: { name: "update_game_state", arguments: JSON.stringify({ type, value }) },
});
const original = OpenAIProvider.prototype.chatComplete;
let activeChatId = "";
let expectedSuccess = true;
let requestedLocation = "Harbor";
let failBeforeSave = false;
let lockBeforeSave = false;
let emptyFollowup = false;
let lockedSnapshotId: string | undefined;
OpenAIProvider.prototype.chatComplete = async (messages) => {
  const result = messages.findLast((message) => message.role === "tool");
  if (!result)
    return { content: null, toolCalls: [call("location_change", requestedLocation)], finishReason: "tool_calls" };
  const receipt = JSON.parse(result.content);
  assert.notEqual(receipt.applied, true, "the model must not receive an applied receipt before its message is saved");
  if (expectedSuccess) assert.equal(receipt.pending, true);
  else assert.match(receipt.error, /locked/);
  if (failBeforeSave) throw new Error("Fixture narration failed before save");
  if (lockBeforeSave) {
    const baseline = (await states.getForGeneration(activeChatId))!;
    lockedSnapshotId = baseline.id;
    await states._applyUpdate(baseline, { fieldLocks: { [worldTrackerLockKey("location")]: true } });
  }
  return {
    content: emptyFollowup ? "" : expectedSuccess ? "The party reaches the harbor." : "The location stays unchanged.",
    toolCalls: [],
    finishReason: "stop",
  };
};
try {
  const connection = await createConnectionsStorage(db).create({
    name: "Fixture",
    provider: "openai",
    model: "fixture",
    apiKey: "synthetic",
  });
  const chat = (await chats.create({
    name: "Receipts",
    mode: "game",
    characterIds: [],
    connectionId: connection.id,
    promptPresetId: null,
  }))!;
  activeChatId = chat.id;
  await chats.patchMetadata(chat.id, { enableAgents: false, enableTools: true, activeToolIds: ["update_game_state"] });
  await states.create({
    chatId: chat.id,
    messageId: "",
    swipeIndex: 0,
    date: "Day 1",
    time: "10:00",
    location: "Square",
    weather: "Clear",
    temperature: "Mild",
    worldCustomFields: [],
    presentCharacters: [],
    recentEvents: [],
    playerStats: null,
    personaStats: null,
    fieldLocks: null,
    committed: true,
  } as Omit<GameState, "id" | "createdAt">);
  const fixtureTarget = { messageId: "", swipeIndex: 0, baseSnapshot: (await states.getLatest(chat.id))! };
  const context = {
    applyGameStateUpdate: ({ type, value }: { type: string; value: string }) =>
      states.updateFromTool(chat.id, type === "location_change" ? "location" : "time", value, false, fixtureTarget),
  };
  const [unavailable] = await executeToolCalls([call()]);
  assert.equal(unavailable?.success, false, "no persistence host means no applied receipt");
  assert.doesNotMatch(unavailable!.result, /"applied":true/);
  const [unsupported] = await executeToolCalls([call("inventory_add", "Sword")], context);
  assert.equal(unsupported?.success, false);
  const [empty] = await executeToolCalls([call("time_advance", "  ")], context);
  assert.equal(empty?.success, false);
  const [changed] = await executeToolCalls([call("time_advance", "18:00")], context);
  assert.equal(changed?.success, true);
  assert.equal((await states.getLatest(chat.id))?.time, "18:00");
  await assert.rejects(
    () => states.updateFromTool(chat.id, "location", "Forest", true, fixtureTarget),
    /Spatial Context/,
  );
  assert.equal((await states.getLatest(chat.id))?.location, "Square");
  await assert.rejects(
    () => states.updateFromTool("missing-chat", "time", "12:00", false, { ...fixtureTarget, baseSnapshot: null }),
    /No game-state snapshot/,
  );
  const [failedWrite] = await executeToolCalls([call()], {
    applyGameStateUpdate: async () => {
      throw new Error("Storage failed");
    },
  });
  assert.equal(failedWrite?.success, false);
  assert.match(failedWrite!.result, /Storage failed/);
  const [falseReceipt] = await executeToolCalls([call()], {
    applyGameStateUpdate: async () => ({ location: "Elsewhere" }),
  });
  assert.equal(falseReceipt?.success, false);
  const projectedMessage = (await chats.createMessage({
    chatId: chat.id,
    role: "assistant",
    content: "At the harbor.",
  }))!;
  const projectedTarget = {
    messageId: projectedMessage.id,
    swipeIndex: 0,
    baseSnapshot: { ...fixtureTarget.baseSnapshot, location: "World > Harbor" },
    compatibilityLocation: "World > Harbor",
  };
  await states.updateFromTool(chat.id, "time", "19:00", true, projectedTarget);
  const projectedSnapshot = (await states.getByChatAndMessage(chat.id, projectedMessage.id, 0))!;
  assert.equal(
    projectedSnapshot.location,
    "World > Harbor",
    "a clock-only write must preserve the authoritative projected location when cloning",
  );
  assert.equal((await states.getById(fixtureTarget.baseSnapshot.id, chat.id))?.location, "Square");
  await states._applyUpdate(projectedSnapshot, { location: "World > Pier" });
  await states.updateFromTool(chat.id, "time", "20:00", true, projectedTarget);
  assert.equal(
    (await states.getByChatAndMessage(chat.id, projectedMessage.id, 0))?.location,
    "World > Pier",
    "compatibility location seeds only a new snapshot",
  );
  for (const locked of [false, true]) {
    expectedSuccess = !locked;
    await states.updateLatest(chat.id, {
      location: "Square",
      fieldLocks: locked ? { [worldTrackerLockKey("location")]: true } : null,
    });
    const previousSnapshot = (await states.getLatest(chat.id))!;
    await chats.createMessage({ chatId: chat.id, role: "user", content: "Go to the harbor." });
    const response = await app.inject({
      method: "POST",
      url: "/api/generate/",
      payload: { chatId: chat.id, streaming: true },
    });
    assert.equal(response.statusCode, 200, response.body);
    assert.ok(!response.body.includes('"type":"error"'), response.body);
    assert.match(response.body, new RegExp('"success":' + String(!locked)));
    assert.equal(
      (await states.getById(previousSnapshot.id, chat.id))?.location,
      "Square",
      "a new turn must not rewrite the previous snapshot",
    );
    const saved = (await chats.listMessages(chat.id)).at(-1)!;
    if (!locked)
      assert.equal((await states.getByChatAndMessage(chat.id, saved.id, saved.activeSwipeIndex))?.location, "Harbor");
    assert.equal((await states.getLatest(chat.id))?.location, locked ? "Square" : "Harbor");
    if (locked) assert.doesNotMatch(response.body, /"type":"game_state_patch"/);
    else {
      const events = response.body
        .split("\n")
        .filter((line) => line.startsWith("data: "))
        .map((line) => JSON.parse(line.slice(6)));
      const receipts = events
        .filter((event) => event.type === "tool_result")
        .map((event) => JSON.parse(event.data.result));
      assert.equal(receipts[0].pending, true);
      assert.equal(receipts.at(-1).applied, true);
      assert.ok(
        response.body.indexOf('"type":"game_state_patch"') < response.body.lastIndexOf('"type":"tool_result"'),
        "storage precedes the final applied receipt",
      );
      requestedLocation = "Forest";
      const regenerated = await app.inject({
        method: "POST",
        url: "/api/generate/",
        payload: { chatId: chat.id, regenerateMessageId: saved.id, streaming: true },
      });
      assert.equal(regenerated.statusCode, 200, regenerated.body);
      assert.ok(!regenerated.body.includes('"type":"error"'), regenerated.body);
      assert.equal(
        (await states.getByChatAndMessage(chat.id, saved.id, 0))?.location,
        "Harbor",
        "regeneration preserves the previous swipe's snapshot",
      );
      assert.equal((await states.getByChatAndMessage(chat.id, saved.id, 1))?.location, "Forest");
      requestedLocation = "Tower";
      const continued = await app.inject({
        method: "POST",
        url: "/api/generate/",
        payload: { chatId: chat.id, continueMessageId: saved.id, streaming: true },
      });
      assert.equal(continued.statusCode, 200, continued.body);
      assert.ok(!continued.body.includes('"type":"error"'), continued.body);
      assert.equal((await states.getByChatAndMessage(chat.id, saved.id, 0))?.location, "Harbor");
      assert.equal(
        (await states.getByChatAndMessage(chat.id, saved.id, 1))?.location,
        "Tower",
        "continuation updates only its own swipe",
      );
      requestedLocation = "Harbor";
    }
  }
  expectedSuccess = true;
  await states.updateLatest(chat.id, { location: "Square", fieldLocks: null });
  const beforeFailure = (await states.getLatest(chat.id))!;
  failBeforeSave = true;
  await chats.createMessage({ chatId: chat.id, role: "user", content: "Try to move." });
  const failed = await app.inject({
    method: "POST",
    url: "/api/generate/",
    payload: { chatId: chat.id, streaming: true },
  });
  assert.match(failed.body, /Fixture narration failed before save/);
  assert.equal((await states.getLatest(chat.id))?.id, beforeFailure.id);
  assert.equal(
    (await states.getLatest(chat.id))?.location,
    "Square",
    "an unsaved response cannot apply a queued write",
  );
  failBeforeSave = false;
  lockBeforeSave = true;
  await chats.createMessage({ chatId: chat.id, role: "user", content: "Try again." });
  const refused = await app.inject({
    method: "POST",
    url: "/api/generate/",
    payload: { chatId: chat.id, streaming: true },
  });
  assert.match(refused.body, /"success":false/);
  assert.match(refused.body, /locked/);
  assert.doesNotMatch(refused.body, /"type":"game_state_patch"/);
  assert.equal((await states.getLatest(chat.id))?.location, "Square", "a new lock is rechecked at persistence");
  lockBeforeSave = false;
  await states._applyUpdate((await states.getById(lockedSnapshotId!, chat.id))!, { fieldLocks: null });
  await states.updateLatest(chat.id, { fieldLocks: null });
  emptyFollowup = true;
  await chats.createMessage({ chatId: chat.id, role: "user", content: "Move without narration." });
  const commandOnly = await app.inject({
    method: "POST",
    url: "/api/generate/",
    payload: { chatId: chat.id, streaming: true },
  });
  assert.ok(!commandOnly.body.includes('"type":"error"'), commandOnly.body);
  const anchor = (await chats.listMessages(chat.id)).at(-1)!;
  assert.equal(JSON.parse(anchor.extra!).hiddenFromUser, true);
  assert.equal((await states.getByChatAndMessage(chat.id, anchor.id, anchor.activeSwipeIndex))?.location, "Harbor");
  assert.equal((await states.getById(beforeFailure.id, chat.id))?.location, "Square");
} finally {
  OpenAIProvider.prototype.chatComplete = original;
  await app.close();
  await closeDB();
  rmSync(dir, { recursive: true, force: true });
}
console.log(
  "Game-state tools report only stored updates and refuse unavailable, locked, or Spatial Context-owned writes.",
);
