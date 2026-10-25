import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  characterDataSchema,
  resolveMacros,
  type AgentContext,
  type MacroContext,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-world-clock-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";

const { default: Fastify } = await import("../../packages/server/node_modules/fastify/fastify.js");
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { generateRoutes } = await import("../../packages/server/src/routes/generate.routes.js");
const { chatsRoutes } = await import("../../packages/server/src/routes/chats.routes.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createGameStateStorage } = await import("../../packages/server/src/services/storage/game-state.storage.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { createCharactersStorage } = await import("../../packages/server/src/services/storage/characters.storage.js");
const { createPromptsStorage } = await import("../../packages/server/src/services/storage/prompts.storage.js");
const { buildPromptMacroContext } = await import("../../packages/server/src/services/prompt/macro-context.js");
const { assemblePrompt } = await import("../../packages/server/src/services/prompt/assembler.js");
const { renderAgentPromptTemplate } = await import("../../packages/server/src/services/agents/agent-executor.js");

const db = await getDB();
const app = Fastify();
app.decorate("db", db);
app.decorate("activeGenerations", new Map());
await app.register(generateRoutes, { prefix: "/api/generate" });
await app.register(chatsRoutes, { prefix: "/api/chats" });

const template = "{{date.world_state}}|{{time.world_state}}|{{weekday.world_state}}";
const base: MacroContext = { user: "Mari", char: "Doctor", characters: ["Doctor"], variables: {} };
const tracked = { date: "2026-10-24", time: "22:10" };
const sent: string[] = [];
const provider = createServer(async (request, response) => {
  let raw = "";
  for await (const chunk of request) raw += chunk;
  sent.push(JSON.stringify(JSON.parse(raw).messages));
  const part = { choices: [{ index: 0, delta: { content: "The story continues." }, finish_reason: null }] };
  const stop = { choices: [{ index: 0, delta: {}, finish_reason: "stop" }] };
  response.writeHead(200, { "content-type": "text/event-stream" });
  response.end(`data: ${JSON.stringify(part)}\n\ndata: ${JSON.stringify(stop)}\n\ndata: [DONE]\n\n`);
});

try {
  assert.equal(resolveMacros(template, { ...base, worldState: tracked }), "2026-10-24|22:10|Saturday");
  assert.equal(resolveMacros(template, base), "||");
  assert.equal(resolveMacros("{{DATE.WORLD_STATE}}", { ...base, worldState: tracked }), tracked.date);
  assert.equal(
    resolveMacros('{{#if weekday.world_state == "Saturday"}}weekend{{else}}weekday{{/if}}', {
      ...base,
      worldState: tracked,
    }),
    "weekend",
  );
  assert.equal(
    resolveMacros('{{#if time.world_state == "22:10"}}night{{/if}}', { ...base, worldState: tracked }),
    "night",
  );
  for (const date of ["2026-02-30", "Year 6, Moon 2", "", null]) {
    assert.equal(resolveMacros("{{weekday.world_state}}", { ...base, worldState: { date } }), "");
  }
  assert.equal(
    resolveMacros("{{weekday.world_state}}", { ...base, worldState: { date: "monday, the third of Frostfall" } }),
    "Monday",
  );
  for (const fields of [
    [{ name: "Day of Week", value: "Moonwake" }],
    JSON.stringify([{ name: "Weekday", value: "Moonwake" }]),
  ]) {
    assert.equal(
      resolveMacros(template, { ...base, worldState: { date: "Year 6", time: "Dusk", worldCustomFields: fields } }),
      "Year 6|Dusk|Moonwake",
    );
  }
  assert.match(resolveMacros("{{date}}", { ...base, worldState: { date: "Fictional" } }), /^\d{4}-\d{2}-\d{2}$/u);
  const injected = { ...base, variables: {}, worldState: { date: "{{setvar::injected::yes}}", time: "$&" } };
  assert.equal(resolveMacros("{{date.world_state}}|{{time.world_state}}", injected), "{{setvar::injected::yes}}|$&");
  assert.deepEqual(injected.variables, {}, "Tracked text cannot execute macro writes");
  assert.equal(
    resolveMacros(template, {
      ...base,
      agentData: { director: "not the tracked date" },
      outlets: { clock: "not the tracked time" },
      lorebookEntryCounts: { book: 7 },
      worldState: {
        date: "{{agent::director}}",
        time: "{{outlet::clock}}",
        worldCustomFields: [{ name: "Weekday", value: "{{lorebooksize::book}}" }],
      },
    }),
    "{{agent::director}}|{{outlet::clock}}|{{lorebooksize::book}}",
    "Tracked values stay literal through late read passes too",
  );

  await new Promise<void>((done) => provider.listen(0, "127.0.0.1", done));
  const address = provider.address();
  assert(address && typeof address === "object");
  const connection = await createConnectionsStorage(db).create({
    name: "Clock fixture",
    provider: "custom",
    baseUrl: `http://127.0.0.1:${address.port}/v1`,
    model: "fixture",
    apiKey: "fixture",
    maxContext: 8192,
    maxTokensOverride: 256,
  });
  const prompts = createPromptsStorage(db);
  const preset = await prompts.create({ name: "Clock fixture", parameters: { maxTokens: 256, maxContext: 8192 } });
  await prompts.createSection({ presetId: preset.id, identifier: "clock", name: "Clock", content: template });
  await prompts.createSection({
    presetId: preset.id,
    identifier: "history",
    name: "History",
    isMarker: true,
    markerConfig: { type: "chat_history" },
  });
  const chats = createChatsStorage(db);
  const chat = await chats.create({
    name: "World clock",
    mode: "roleplay",
    characterIds: [],
    connectionId: connection.id,
    promptPresetId: preset.id,
    personaId: null,
    groupId: null,
  });
  await chats.createMessage({ chatId: chat.id, role: "user", content: "Continue." });
  const message = await chats.createMessage({ chatId: chat.id, role: "assistant", content: "First timeline." });
  const states = createGameStateStorage(db);
  const snapshot = {
    chatId: chat.id,
    messageId: message.id,
    swipeIndex: 0,
    ...tracked,
    location: null,
    weather: null,
    temperature: null,
    presentCharacters: [],
    recentEvents: [],
    playerStats: null,
    personaStats: null,
    committed: true,
  };
  await states.create(snapshot);
  await chats.addSwipe(message.id, "Other timeline.");
  await states.create({ ...snapshot, swipeIndex: 1, date: "2026-10-25", time: "07:00", committed: false });
  const contextArgs = { db, characterIds: [], personaName: "Mari", chatId: chat.id };
  assert.equal(resolveMacros(template, await buildPromptMacroContext(contextArgs)), "2026-10-24|22:10|Saturday");
  assert.equal(resolveMacros(template, await buildPromptMacroContext({ ...contextArgs, worldState: null })), "||");

  const assemblyPreset = await prompts.getById(preset.id);
  assert(assemblyPreset);
  const assemblyInput: Parameters<typeof assemblePrompt>[0] = {
    db,
    preset: assemblyPreset,
    sections: await prompts.listSections(preset.id),
    groups: [],
    choiceBlocks: [],
    chatChoices: {},
    chatId: chat.id,
    characterIds: [],
    personaName: "Mari",
    personaDescription: "",
    chatMessages: [],
    disableLorebooks: true,
  };
  const assembledText = (value: Awaited<ReturnType<typeof assemblePrompt>>) =>
    value.messages.map((message) => message.content).join("\n");
  assert.ok(
    assembledText(await assemblePrompt(assemblyInput)).includes("2026-10-24|22:10|Saturday"),
    "Assembly-only preview callers load the stored scene clock when neither state input is supplied",
  );
  for (const empty of [{ worldState: null }, { gameState: null }]) {
    const text = assembledText(await assemblePrompt({ ...assemblyInput, ...empty }));
    assert.ok(text.includes("||") && !text.includes(tracked.date), "Explicit empty state suppresses the lookup");
  }

  const agentContext = {
    chatId: chat.id,
    chatMode: "roleplay",
    recentMessages: [],
    mainResponse: null,
    characters: [],
    persona: null,
    gameState: { id: "fixture", createdAt: "2026-01-01", ...snapshot },
    memory: {},
    writableLorebookIds: null,
    chatSummary: null,
  } satisfies AgentContext;
  assert.equal(renderAgentPromptTemplate(template, {}, agentContext), "2026-10-24|22:10|Saturday");
  assert.equal(
    renderAgentPromptTemplate(
      "{{time.world_state}}",
      {},
      {
        ...agentContext,
        gameState: { ...agentContext.gameState, time: "<dusk>&night" },
      },
      { escapeValues: true },
    ),
    "&lt;dusk&gt;&amp;night",
  );

  const dry = async (expected: string) => {
    const response = await app.inject({
      method: "POST",
      url: "/api/generate/dryRun",
      payload: { chatId: chat.id, returnPrompt: true },
    });
    assert.equal(response.statusCode, 200, response.body);
    const text = response
      .json()
      .prompt.messages.map((entry: { content: string }) => entry.content)
      .join("\n");
    assert.ok(text.includes(expected), text);
    assert.ok(!text.includes(".world_state}}"), text);
    const peek = await app.inject({ method: "POST", url: `/api/chats/${chat.id}/peek-prompt`, payload: {} });
    assert.equal(peek.statusCode, 200, peek.body);
    assert.ok(JSON.stringify(peek.json()).includes(expected), peek.body);
  };
  await chats.setActiveSwipe(message.id, 1);
  await dry("2026-10-25|07:00|Sunday");
  await chats.setActiveSwipe(message.id, 0);
  await dry("2026-10-24|22:10|Saturday");

  const characters = createCharactersStorage(db);
  const roster = await Promise.all(
    ["Mira", "Quinn"].map((name) =>
      characters.create(
        characterDataSchema.parse({
          name,
          description: "The scene date is {{date.world_state}}.",
        }),
      ),
    ),
  );
  const cases: Array<{
    mode: "conversation" | "roleplay" | "game";
    groupMode?: "merged" | "individual";
    speaker?: number;
  }> = [
    { mode: "conversation" },
    { mode: "roleplay" },
    { mode: "game" },
    { mode: "roleplay", groupMode: "merged" },
    { mode: "roleplay", groupMode: "individual", speaker: 0 },
    { mode: "roleplay", groupMode: "individual", speaker: 1 },
  ];
  for (const row of cases) {
    const target = await chats.create({
      name: `Clock ${row.mode} ${row.groupMode ?? "single"} ${row.speaker ?? ""}`,
      mode: row.mode,
      characterIds: (row.groupMode ? roster : roster.slice(0, 1)).map((character) => character.id),
      connectionId: connection.id,
      promptPresetId: row.mode === "roleplay" ? preset.id : null,
    });
    await chats.patchMetadata(target.id, {
      enableAgents: false,
      enableTools: false,
      enableMemoryRecall: false,
      customSystemPrompt: template,
      gameSystemPrompt: template,
      ...(row.groupMode ? { groupChatMode: row.groupMode, groupResponseOrder: "manual" } : {}),
    });
    const prior = await chats.createMessage({ chatId: target.id, role: "assistant", content: "We pause." });
    await states.create({ ...snapshot, chatId: target.id, messageId: prior.id });
    await chats.createMessage({ chatId: target.id, role: "user", content: "Continue." });
    const before = sent.length;
    const response = await app.inject({
      method: "POST",
      url: "/api/generate/",
      payload: {
        chatId: target.id,
        ...(row.speaker === undefined ? {} : { forCharacterId: roster[row.speaker]!.id }),
      },
    });
    assert.equal(response.statusCode, 200, response.body);
    assert.ok(!response.body.includes('"type":"error"'), response.body);
    assert.ok(sent.length > before, `${target.name}: provider received a prompt`);
    for (const prompt of sent.slice(before)) {
      assert.ok(prompt.includes("2026-10-24|22:10|Saturday"), `${target.name}: ${prompt}`);
      assert.ok(!prompt.includes(".world_state}}"), `${target.name}: ${prompt}`);
    }
  }
  console.log(
    "World-state clock macros: literal/conditional, agent, stored-state, and selected-swipe preview checks passed",
  );
} finally {
  if (provider.listening) await new Promise<void>((done) => provider.close(() => done()));
  await app.close();
  await closeDB();
  rmSync(dataDir, { recursive: true, force: true });
}
