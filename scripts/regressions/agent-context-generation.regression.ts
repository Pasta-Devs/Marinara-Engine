import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "marinara-context-turn-"));
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
const { createAgentsStorage } = await import("../../packages/server/src/services/storage/agents.storage.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { createGameStateStorage } = await import("../../packages/server/src/services/storage/game-state.storage.js");
const { applyTrackerFieldLocksToGameStatePatch, replaceBuiltInAgentDefinitions, worldCustomFieldTrackerLockKey } =
  await import("../../packages/shared/dist/index.js");
const { parseGameStateRow } = await import("../../packages/server/src/routes/generate/generate-route-utils.js");
const prompts: string[] = [];
const trackerPrompts: string[] = [];
const mainPrompts: string[] = [];
let trackerOutputs: Record<string, unknown> = {};

const provider = createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const body = JSON.parse(Buffer.concat(chunks).toString());
  const prompt = body.messages.map((message: { content: unknown }) => JSON.stringify(message.content)).join("\n");
  const isAgent = prompt.includes("CONTEXT_FIXTURE");
  if (isAgent) prompts.push(prompt);
  const trackerType = Object.keys(trackerOutputs).find((type) => prompt.includes(`TRACKER_FIXTURE_${type}`));
  if (trackerType) trackerPrompts.push(prompt);
  if (!isAgent && !trackerType) mainPrompts.push(prompt);
  const trackerOutput = prompt.includes("<agent_task ") ? trackerOutputs : trackerOutputs[trackerType ?? ""];
  const content = trackerType
    ? JSON.stringify(trackerOutput)
    : isAgent
      ? JSON.stringify({ text: "Public hint", "agent-context": `SECRET_${prompts.length}` })
      : "The story continues.";
  if (body.stream) {
    res.writeHead(200, { "content-type": "text/event-stream" });
    res.end(
      `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content }, finish_reason: null }] })}\n\ndata: ${JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: "stop" }] })}\n\ndata: [DONE]\n\n`,
    );
  } else {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({ choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }] }),
    );
  }
});
const db = await getDB();
const chats = createChatsStorage(db);
const agents = createAgentsStorage(db);
const app = Fastify();
app.decorate("db", db);
await app.register(generateRoutes, { prefix: "/api/generate" });
try {
  await new Promise<void>((done) => provider.listen(0, "127.0.0.1", done));
  const address = provider.address();
  assert.ok(address && typeof address === "object");
  const connection = await createConnectionsStorage(db).create({
    name: "Local fixture",
    provider: "custom",
    baseUrl: `http://127.0.0.1:${address.port}/v1`,
    model: "fixture",
    apiKey: "fixture",
  });
  const agent = await agents.create({
    type: "custom-context-fixture",
    name: "Context fixture",
    phase: "pre_generation",
    connectionId: connection.id,
    promptTemplate: "CONTEXT_FIXTURE prior: {{agent::custom-context-fixture}}",
    settings: { resultType: "context_injection", contextSources: { previousOutput: true }, jsonContextOutput: true },
  });
  assert.ok(agent);
  const chat = await chats.create({
    name: "Context turn",
    mode: "roleplay",
    characterIds: [],
    connectionId: connection.id,
    promptPresetId: null,
  });
  assert.ok(chat);
  await chats.patchMetadata(chat.id, { enableAgents: true, activeAgentIds: [agent.type] });
  const generate = async (regenerateMessageId?: string) => {
    const response = await app.inject({
      method: "POST",
      url: "/api/generate/",
      payload: { chatId: chat.id, regenerateMessageId },
    });
    assert.equal(response.statusCode, 200, response.body);
    assert.ok(!response.body.includes('"type":"error"'), response.body);
  };
  await chats.createMessage({ chatId: chat.id, role: "user", content: "Begin." });
  await generate();
  assert.equal(prompts.length, 1);
  const first = (await chats.listMessages(chat.id)).find((message) => message.role === "assistant");
  assert.ok(first);
  const runs = await agents.listCustomRunsForChat(chat.id);
  assert.equal(
    runs[0]?.messageId,
    first.id,
    "Successful pre-generation context belongs to the assistant turn, not its user prompt",
  );
  await chats.createMessage({ chatId: chat.id, role: "user", content: "Continue." });
  await generate();
  const second = (await chats.listMessages(chat.id)).filter((message) => message.role === "assistant").at(-1);
  assert.ok(second);
  assert.ok(prompts[1]?.includes("SECRET_1"));
  await generate(second.id);
  assert.equal(prompts.length, 2, "Preserve the existing cached pre-generation behavior on regeneration");
  assert.equal(
    ((await agents.getPreviousOutput(agent.id, chat.id)) as Record<string, unknown>)["agent-context"],
    "SECRET_1",
    "An inactive assistant swipe must not supply private context",
  );
  await chats.setActiveSwipe(second.id, 0);
  assert.equal(
    ((await agents.getPreviousOutput(agent.id, chat.id)) as Record<string, unknown>)["agent-context"],
    "SECRET_2",
  );
  await chats.removeMessage(second.id);
  assert.equal(
    ((await agents.getPreviousOutput(agent.id, chat.id)) as Record<string, unknown>)["agent-context"],
    "SECRET_1",
  );
  await chats.createMessage({ chatId: chat.id, role: "user", content: "Continue after rewind." });
  await generate();
  assert.ok(prompts[2]?.includes("SECRET_1"));
  assert.ok(
    !prompts[2]?.includes("SECRET_2"),
    "The next iteration must not read the discarded turn's pre-generation context",
  );
  const summary = `SUMMARY_CONTEXT_SENTINEL ${"Earlier story details. ".repeat(1000)}`;
  for (const phase of ["pre_generation", "parallel"] as const) {
    await agents.update(agent.id, {
      phase,
      settings: {
        resultType: "context_injection",
        contextSize: 5,
        contextSources: { chatHistory: true, chatSummary: true },
        jsonContextOutput: true,
      },
    });
    for (const attachSummariesToAgents of [undefined, false, true]) {
      const summaryChat = await chats.create({
        name: `Summary policy ${phase} ${attachSummariesToAgents}`,
        mode: "roleplay",
        characterIds: [],
        connectionId: connection.id,
        promptPresetId: null,
      });
      await chats.patchMetadata(summaryChat.id, {
        enableAgents: true,
        activeAgentIds: [agent.type],
        summary,
        attachSummariesToAgents,
      });
      for (let index = 0; index < 7; index++) {
        await chats.createMessage({
          chatId: summaryChat.id,
          role: index % 2 === 0 ? "user" : "assistant",
          content: `SUMMARY_HISTORY_${index}`,
        });
      }
      const before = prompts.length;
      const response = await app.inject({
        method: "POST",
        url: "/api/generate/",
        payload: { chatId: summaryChat.id },
      });
      assert.equal(response.statusCode, 200, response.body);
      assert.ok(!response.body.includes('"type":"error"'), response.body);
      assert.equal(prompts.length, before + 1);
      const prompt = prompts.at(-1)!;
      assert.equal(prompt.includes("SUMMARY_CONTEXT_SENTINEL"), attachSummariesToAgents === true, phase);
      assert.ok(prompt.includes("SUMMARY_HISTORY_6"));
      assert.ok(!prompt.includes("SUMMARY_HISTORY_0"), "summary policy preserves the five-message limit");
      assert.ok(mainPrompts.at(-1)?.includes("SUMMARY_CONTEXT_SENTINEL"), "main generation keeps its summary");
      assert.equal(JSON.parse((await chats.getById(summaryChat.id))!.metadata).summary, summary);
    }
  }
  // The same real provider/route harness exercises ordinary batched tracking and manual retry.
  const trackerTypes = ["world-state", "character-tracker", "inventory-tracker", "custom-tracker"];
  replaceBuiltInAgentDefinitions(
    trackerTypes.map((type) => ({
      id: type,
      name: type,
      description: "Synthetic tracker",
      phase: "post_processing" as const,
      enabledByDefault: false,
      category: "tracker" as const,
      defaultTools: [],
      defaultPromptTemplate: `TRACKER_FIXTURE_${type} Return JSON.`,
    })),
  );
  for (const type of trackerTypes) {
    await agents.create({
      type,
      name: type,
      phase: "post_processing",
      connectionId: connection.id,
      promptTemplate: `TRACKER_FIXTURE_${type} Return JSON.`,
    });
  }
  const trackerChat = await chats.create({
    name: "Incremental tracker fixture",
    mode: "roleplay",
    characterIds: [],
    connectionId: connection.id,
    promptPresetId: null,
  });
  await chats.patchMetadata(trackerChat.id, { enableAgents: true, activeAgentIds: trackerTypes, summary });
  const priorMessage = await chats.createMessage({
    chatId: trackerChat.id,
    role: "assistant",
    content: "Two guards carry a rope and map.",
  });
  const stateStore = createGameStateStorage(db);
  const detailedRope = { name: "Rope", description: "Braided hemp", location: "Backpack" };
  const detailedCompass = { name: "Compass", description: "Points north", location: "Pouch" };
  const initialState = {
    chatId: trackerChat.id,
    messageId: priorMessage.id,
    swipeIndex: 0,
    date: null,
    time: null,
    location: "Lab",
    weather: "Clear",
    temperature: null,
    worldCustomFields: [
      { name: "Moon", value: "Full", icon: "moon" },
      { name: "Note", value: "Low", icon: "tag" },
      { name: "Locked", value: "kept", icon: "tag" },
    ],
    presentCharacters: [
      { characterId: "a", name: "Alice", mood: "calm", outfit: "coat" },
      { characterId: "b", name: "Bob", mood: "calm" },
    ],
    recentEvents: [],
    personaStats: null,
    playerStats: {
      stats: [],
      attributes: null,
      skills: {},
      inventory: [],
      activeQuests: [],
      status: "",
      inventoryTrackerInventory: [{ ...detailedRope, qty: 3 }, { name: "Map" }, detailedCompass],
      customTrackerFields: [
        { name: "Clue", value: "south" },
        { name: "Mood", value: "calm" },
        { name: "Luck", value: "5" },
      ],
    },
    fieldLocks: { [worldCustomFieldTrackerLockKey({ name: "Locked" }, "value", 2)]: true },
  };
  const priorStateId = await stateStore.create(initialState);
  const priorState = await stateStore.getById(priorStateId);
  assert.ok(priorState);
  await stateStore.commit(priorState.id, trackerChat.id);
  await chats.createMessage({
    chatId: trackerChat.id,
    role: "user",
    content: "Bob leaves; the rope is used and the map discarded.",
  });
  trackerOutputs = {
    "world-state": {
      weather: "Rain",
      worldCustomFields: { updates: [{ name: "Note", value: "High" }], removed: ["Moon", "Locked"] },
    },
    "character-tracker": { presentCharacters: { updates: [{ characterId: "a", mood: "alert" }], removed: ["b"] } },
    "inventory-tracker": { inventory: { updates: [{ name: "Rope", qty: 1, location: "Belt" }], removed: ["Map"] } },
    "custom-tracker": { updates: [{ name: "Clue", value: "north" }], removed: ["Mood"] },
  };
  const generated = await app.inject({ method: "POST", url: "/api/generate/", payload: { chatId: trackerChat.id } });
  assert.equal(generated.statusCode, 200, generated.body);
  assert.ok(!generated.body.includes('"type":"error"'), generated.body);
  assert.ok(!trackerPrompts.at(-1)?.includes("SUMMARY_CONTEXT_SENTINEL"), "omitted setting excludes summaries");
  const target = (await chats.listMessages(trackerChat.id)).filter((message) => message.role === "assistant").at(-1)!;
  assert.notEqual(target.id, priorMessage.id);
  const readTarget = async () => {
    const row = await stateStore.getByChatAndMessage(trackerChat.id, target.id, 0);
    assert.ok(row);
    return parseGameStateRow(row as Record<string, unknown>);
  };
  const normalState = await readTarget();
  assert.deepEqual(
    normalState.presentCharacters.map(({ name, mood, outfit }) => ({ name, mood, outfit })),
    [{ name: "Alice", mood: "alert", outfit: "coat" }],
  );
  assert.deepEqual(normalState.playerStats?.inventoryTrackerInventory, [
    { ...detailedRope, location: "Belt" },
    detailedCompass,
  ]);
  const inventoryEvent = generated.body
    .split("\n")
    .filter((line) => line.startsWith("data: "))
    .map((line) => JSON.parse(line.slice(6)))
    .find((event) => event.type === "game_state_patch" && event.data.playerStats?.inventoryTrackerInventory);
  assert.deepEqual(
    inventoryEvent?.data.playerStats.inventoryTrackerInventory,
    normalState.playerStats?.inventoryTrackerInventory,
  );
  assert.deepEqual(normalState.playerStats?.customTrackerFields, [
    { name: "Clue", value: "north" },
    { name: "Luck", value: "5" },
  ]);
  assert.deepEqual(
    normalState.worldCustomFields.map((field) => field.name),
    ["Note", "Locked"],
  );
  const worldEvent = generated.body
    .split("\n")
    .filter((line) => line.startsWith("data: "))
    .map((line) => JSON.parse(line.slice(6)))
    .find((event) => event.type === "game_state_patch" && event.data.worldCustomFields);
  assert.ok(worldEvent, generated.body);
  assert.deepEqual(
    worldEvent.data.worldCustomFields.removed,
    ["Moon"],
    "the SSE patch excludes rejected locked removals",
  );
  assert.deepEqual(
    applyTrackerFieldLocksToGameStatePatch(worldEvent.data, parseGameStateRow(priorState as Record<string, unknown>))
      .worldCustomFields,
    normalState.worldCustomFields,
  );
  assert.deepEqual(
    applyTrackerFieldLocksToGameStatePatch(worldEvent.data, null).worldCustomFields,
    normalState.worldCustomFields,
  );
  trackerOutputs = {
    "world-state": { worldCustomFields: { removed: ["Note"] } },
    "character-tracker": { presentCharacters: { removed: ["a"] } },
    "inventory-tracker": { inventory: { removed: ["Rope"] } },
    "custom-tracker": { removed: ["Clue"] },
  };
  const retry = async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/generate/retry-agents",
      payload: { chatId: trackerChat.id, agentTypes: trackerTypes, forMessageId: target.id },
    });
    assert.equal(response.statusCode, 200, response.body);
    assert.ok(!response.body.includes('"type":"error"'), response.body);
    return readTarget();
  };
  await chats.patchMetadata(trackerChat.id, { attachSummariesToAgents: false });
  const retried = await retry();
  assert.ok(!trackerPrompts.at(-1)?.includes("SUMMARY_CONTEXT_SENTINEL"), "manual grouped retry excludes summaries");
  assert.deepEqual(retried.presentCharacters, []);
  assert.deepEqual(retried.playerStats?.inventoryTrackerInventory, [detailedCompass]);
  assert.deepEqual(retried.playerStats?.customTrackerFields, [{ name: "Luck", value: "5" }]);
  assert.deepEqual(
    retried.worldCustomFields.map((field) => field.name),
    ["Locked"],
  );
  trackerOutputs = {
    "world-state": { weather: "Sun" },
    "character-tracker": { presentCharacters: [{ characterId: "legacy", name: "Legacy", mood: "calm" }] },
    "inventory-tracker": { inventory: [{ name: "Lantern", description: "Oil lamp", location: "Pack" }] },
    "custom-tracker": { fields: [{ name: "Full", value: "legacy" }] },
  };
  await chats.patchMetadata(trackerChat.id, { attachSummariesToAgents: true });
  const legacy = await retry();
  assert.ok(trackerPrompts.at(-1)?.includes("SUMMARY_CONTEXT_SENTINEL"), "manual grouped retry restores summaries");
  assert.equal(legacy.weather, "Sun");
  assert.deepEqual(legacy.playerStats?.inventoryTrackerInventory, [
    { name: "Lantern", description: "Oil lamp", location: "Pack" },
  ]);
  assert.deepEqual(legacy.playerStats?.customTrackerFields, [{ name: "Full", value: "legacy" }]);
  assert.equal(legacy.presentCharacters[0]?.name, "Legacy");
  assert.ok(trackerPrompts.length >= 3);
  assert.ok(
    trackerPrompts.some((prompt) => prompt.includes("<agent_task ")),
    "normal trackers share the real batch path",
  );
  assert.deepEqual(
    parseGameStateRow((await stateStore.getById(priorState.id))! as Record<string, unknown>).playerStats,
    initialState.playerStats,
    "tracker writes must not change the preceding snapshot",
  );
  for (const prompt of trackerPrompts) assert.ok(prompt.includes("tracker_incremental_updates: supported"));
  await chats.patchMetadata(trackerChat.id, { attachSummariesToAgents: false });
  await chats.createMessage({ chatId: trackerChat.id, role: "user", content: "Continue without agent summaries." });
  const withoutSummaries = await app.inject({
    method: "POST",
    url: "/api/generate/",
    payload: { chatId: trackerChat.id },
  });
  assert.equal(withoutSummaries.statusCode, 200, withoutSummaries.body);
  assert.ok(!withoutSummaries.body.includes('"type":"error"'), withoutSummaries.body);
  assert.ok(trackerPrompts.at(-1)?.includes("<agent_task "), "off policy still uses grouped tracking");
  assert.ok(!trackerPrompts.at(-1)?.includes("SUMMARY_CONTEXT_SENTINEL"), "normal grouped tracking excludes summaries");
  assert.ok(
    mainPrompts.at(-1)?.includes("SUMMARY_CONTEXT_SENTINEL"),
    "main summary is independent of the agent toggle",
  );
} finally {
  provider.closeAllConnections();
  await new Promise<void>((done) => provider.close(() => done()));
  await app.close();
  await closeDB();
  rmSync(dir, { recursive: true, force: true });
}
console.log(
  "Real generation/retry preserve tracker increments, explicit removals, locks, legacy arrays, and prior context.",
);
