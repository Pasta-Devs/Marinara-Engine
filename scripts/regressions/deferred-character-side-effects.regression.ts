import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveDeferredCharacterMacros, resolveMacros } from "../../packages/shared/src/utils/macro-engine.js";

// Resolving a deferred name must not rerun already-injected Post History Instructions.
const postHistory =
  "{{setvar::hangover_die::{{random::PROMISE::BEGINNING}}}}" +
  '{{#if {{getvar::hangover_die}} == "PROMISE"}}{{setvar::hangover_clue_promise::FIRED}}Memory: PROMISE.' +
  "{{else}}{{setvar::hangover_clue_beginning::FIRED}}Memory: BEGINNING.{{/if}}";
const context = {
  user: "Mari",
  char: "Hangover",
  characters: ["Hangover", "Witness"],
  variables: {},
  localVariables: {} as Record<string, string>,
};
const originalRandom = Math.random;
let rolls = 0;
try {
  Math.random = () => (rolls++ === 0 ? 0 : 0.999);
  const injected = resolveMacros(postHistory, context);
  assert.equal(injected, "Memory: PROMISE.");
  const name = resolveMacros("Answer as {{char}}.", context, { deferCharacterMacros: "all" });
  assert.equal(
    resolveDeferredCharacterMacros(name, { name: "Hangover", postHistoryInstructions: postHistory }, context),
    "Answer as Hangover.",
  );
  assert.deepEqual(context.localVariables, { hangover_die: "PROMISE", hangover_clue_promise: "FIRED" });
  assert.equal(rolls, 1, "the deferred name must not reroll a memory already sent in the prompt");
} finally {
  Math.random = originalRandom;
}

for (const [field, macro] of [
  ["description", "description"],
  ["personality", "personality"],
  ["backstory", "backstory"],
  ["appearance", "appearance"],
  ["scenario", "scenario"],
  ["example", "example"],
  ["systemPrompt", "charSysInfo"],
  ["postHistoryInstructions", "charPostHistory"],
] as const) {
  const scoped = { ...context, localVariables: {} };
  const deferred = resolveMacros(`{{${macro}}}|{{${macro}}}`, scoped, { deferCharacterMacros: "all" });
  assert.equal(
    resolveDeferredCharacterMacros(deferred, { name: "Hangover", [field]: `{{incvar::${field}}}` }, scoped),
    "1|1",
    "a requested field resolves once and replaces all of its tokens",
  );
  assert.deepEqual(scoped.localVariables, { [field]: "1" });
}

const dir = mkdtempSync(join(tmpdir(), "marinara-deferred-side-effects-"));
process.env.DATA_DIR = dir;
process.env.FILE_STORAGE_DIR = join(dir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";
const { default: Fastify } = await import("../../packages/server/node_modules/fastify/fastify.js");
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { generateRoutes } = await import("../../packages/server/src/routes/generate.routes.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { createCharactersStorage } = await import("../../packages/server/src/services/storage/characters.storage.js");
const { createPromptsStorage } = await import("../../packages/server/src/services/storage/prompts.storage.js");
const { createAgentsStorage } = await import("../../packages/server/src/services/storage/agents.storage.js");
const { characterDataSchema, createConnectionSchema } = await import("../../packages/shared/src/index.js");

const prompts: string[] = [];
const agentPrompts: string[] = [];
const provider = createServer(async (request, response) => {
  let raw = "";
  for await (const chunk of request) raw += chunk;
  const body = JSON.parse(raw);
  const prompt = JSON.stringify(body.messages);
  if (prompt.includes("PHR_AUDIT")) {
    agentPrompts.push(prompt);
    response.writeHead(200, { "content-type": "application/json" });
    response.end(
      JSON.stringify({ choices: [{ message: { role: "assistant", content: "{}" }, finish_reason: "stop" }] }),
    );
    return;
  }
  prompts.push(prompt);
  const delta = { choices: [{ index: 0, delta: { content: "I remember the promise." }, finish_reason: null }] };
  const stop = { choices: [{ index: 0, delta: {}, finish_reason: "stop" }] };
  response.writeHead(200, { "content-type": "text/event-stream" });
  response.end(`data: ${JSON.stringify(delta)}\n\ndata: ${JSON.stringify(stop)}\n\ndata: [DONE]\n\n`);
});
const db = await getDB();
const app = Fastify();
app.decorate("db", db);
app.decorate("activeGenerations", new Map());
await app.register(generateRoutes, { prefix: "/api/generate" });
try {
  await new Promise<void>((done) => provider.listen(0, "127.0.0.1", done));
  const address = provider.address();
  assert(address && typeof address === "object");
  const connection = await createConnectionsStorage(db).create(
    createConnectionSchema.parse({
      name: "Deferred memory fixture",
      provider: "custom",
      baseUrl: `http://127.0.0.1:${address.port}/v1`,
      model: "fixture",
      apiKey: "fixture",
      maxContext: 32768,
    }),
  );
  assert(connection);
  const characters = createCharactersStorage(db);
  const hangover = await characters.create(
    characterDataSchema.parse({
      name: "Hangover",
      post_history_instructions:
        '{{addnumvar::phr_calls::1}}{{#if {{getvar::phr_calls}} == "1"}}' +
        "{{setvar::promise::FIRED}}Memory: PROMISE.{{else}}{{setvar::beginning::FIRED}}Memory: BEGINNING.{{/if}}",
    }),
  );
  const witness = await characters.create(characterDataSchema.parse({ name: "Witness" }));
  assert(hangover && witness);
  const agent = await createAgentsStorage(db).create({
    type: "custom-post-history-audit",
    name: "Post-history audit fixture",
    description: "Captures the already-resolved character instructions.",
    imagePath: null,
    phase: "pre_generation",
    connectionId: connection.id,
    promptTemplate: "PHR_AUDIT {{charPostHistory}}",
    settings: { resultType: "context_injection", contextSources: { characters: true } },
  });
  assert(agent);
  const presets = createPromptsStorage(db);
  const preset = await presets.create({ name: "Deferred names", parameters: { maxTokens: 64 } });
  assert(preset);
  await presets.createSection({
    presetId: preset.id,
    identifier: "speaker",
    name: "Speaker",
    content: "Answer as {{char}}.",
  });
  await presets.createSection({
    presetId: preset.id,
    identifier: "history",
    name: "History",
    isMarker: true,
    markerConfig: { type: "chat_history" },
  });
  const chats = createChatsStorage(db);
  for (const [mode, group] of [
    ["roleplay", "individual"],
    ["roleplay", "merged"],
    ["roleplay", null],
    ["conversation", null],
    ["game", null],
  ] as const) {
    prompts.length = 0;
    agentPrompts.length = 0;
    const chat = await chats.create({
      name: `One memory per turn: ${mode} ${group ?? "default"}`,
      mode,
      characterIds: group ? [hangover.id, witness.id] : [hangover.id],
      connectionId: connection.id,
      promptPresetId: group ? preset.id : null,
      groupId: null,
      personaId: null,
    });
    assert(chat);
    await chats.patchMetadata(chat.id, {
      enableAgents: true,
      activeAgentIds: [agent.type],
      enableTools: false,
      enableMemoryRecall: false,
      groupChatMode: group ?? "individual",
      groupResponseOrder: "sequential",
    });
    await chats.createMessage({ chatId: chat.id, role: "user", content: "What do you remember?", characterId: null });
    const response = await app.inject({ method: "POST", url: "/api/generate/", payload: { chatId: chat.id } });
    assert.equal(response.statusCode, 200, response.body);
    assert(!response.body.includes('"type":"error"'), response.body);
    assert.equal(
      prompts.length,
      group === "individual" ? 2 : 1,
      "each responder makes its normal single provider request",
    );
    for (const prompt of prompts) {
      assert.match(prompt, /Memory: PROMISE\./u);
      assert.doesNotMatch(prompt, /Memory: BEGINNING\.|MARINARA_DEFERRED/u);
    }
    assert.equal(agentPrompts.length, 1, "the activated agent reads the derived character profile");
    assert.match(agentPrompts[0]!, /Memory: PROMISE\./u);
    assert.doesNotMatch(agentPrompts[0]!, /Memory: BEGINNING\.|\{\{/u);
    const saved = await chats.getById(chat.id);
    assert(saved);
    assert.deepEqual(JSON.parse(saved.metadata).macroVariables, { phr_calls: "1", promise: "FIRED" }, mode);
    if (mode === "roleplay" && !group) {
      prompts.length = 0;
      agentPrompts.length = 0;
      await chats.createMessage({ chatId: chat.id, role: "user", content: "What else happened?", characterId: null });
      const next = await app.inject({ method: "POST", url: "/api/generate/", payload: { chatId: chat.id } });
      assert.equal(next.statusCode, 200, next.body);
      assert(!next.body.includes('"type":"error"'), next.body);
      assert.equal(prompts.length, 1);
      assert.equal(agentPrompts.length, 1);
      for (const prompt of [...prompts, ...agentPrompts]) assert.match(prompt, /Memory: BEGINNING\./u);
      assert.deepEqual(JSON.parse((await chats.getById(chat.id))!.metadata).macroVariables, {
        phr_calls: "2",
        promise: "FIRED",
        beginning: "FIRED",
      });
    }
  }
  console.info("deferred character side-effect regressions passed.");
} finally {
  await app.close();
  await closeDB();
  await new Promise<void>((done, reject) => provider.close((error) => (error ? reject(error) : done())));
  rmSync(dir, { recursive: true, force: true });
}
