import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "marinara-expression-group-"));
process.env.DATA_DIR = dir;
process.env.FILE_STORAGE_DIR = join(dir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";
const requireServer = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const Fastify = requireServer("fastify") as typeof import("fastify").default;
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { generateRoutes } = await import("../../packages/server/src/routes/generate.routes.js");
const { playerTurnAwaitsExpression } =
  await import("../../packages/server/src/routes/generate/expression-agent-utils.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createCharactersStorage } = await import("../../packages/server/src/services/storage/characters.storage.js");
const { createAgentsStorage } = await import("../../packages/server/src/services/storage/agents.storage.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { characterDataSchema, replaceBuiltInAgentDefinitions } = await import("../../packages/shared/dist/index.js");
replaceBuiltInAgentDefinitions([
  {
    id: "expression",
    name: "Expression fixture",
    description: "Synthetic expression selection",
    phase: "post_processing",
    enabledByDefault: false,
    category: "misc",
    defaultTools: [],
    defaultPromptTemplate: "EXPRESSION_GROUP_FIXTURE Return expressions as JSON.",
  },
]);
const spritePrompts: string[] = [];
let expressionOutput: { characterId: string; expression: string }[] = [];
const provider = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const body = JSON.parse(Buffer.concat(chunks).toString());
  const prompt = JSON.stringify(body.messages);
  const expression = prompt.includes("EXPRESSION_GROUP_FIXTURE");
  if (expression) spritePrompts.push(prompt);
  const content = expression ? JSON.stringify({ expressions: expressionOutput }) : "Alice smiles. Bob frowns.";
  if (body.stream) {
    response.writeHead(200, { "content-type": "text/event-stream" });
    response.end(
      `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content }, finish_reason: "stop" }] })}\n\ndata: [DONE]\n\n`,
    );
  } else {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(
      JSON.stringify({ choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }] }),
    );
  }
});
const db = await getDB();
const chats = createChatsStorage(db);
const characters = createCharactersStorage(db);
const app = Fastify();
app.decorate("db", db);
app.decorate("activeGenerations", new Map());
await app.register(generateRoutes, { prefix: "/api/generate" });
try {
  await new Promise<void>((done) => provider.listen(0, "127.0.0.1", done));
  const address = provider.address();
  assert(address && typeof address === "object");
  const connection = await createConnectionsStorage(db).create({
    name: "Expression fixture",
    provider: "custom",
    baseUrl: `http://127.0.0.1:${address.port}/v1`,
    model: "fixture",
    apiKey: "fixture",
    maxContext: 32768,
    maxTokensOverride: 256,
  });
  const roster = await Promise.all(
    ["Alice", "Bob", "Disabled"].map((name) => characters.create(characterDataSchema.parse({ name }))),
  );
  const [alice, bob, disabled] = roster;
  assert(alice && bob && disabled);
  for (const character of roster) {
    const spriteDir = join(dir, "sprites", character.id);
    mkdirSync(spriteDir, { recursive: true });
    for (const expression of ["happy", "sad", "neutral"])
      writeFileSync(join(spriteDir, `${expression}.png`), "fixture");
  }
  await createAgentsStorage(db).create({
    type: "expression",
    name: "Expression fixture",
    phase: "post_processing",
    connectionId: connection.id,
    promptTemplate: "EXPRESSION_GROUP_FIXTURE Return expressions as JSON.",
  });
  const chat = await chats.create({
    name: "Expression group",
    mode: "roleplay",
    characterIds: roster.map((character) => character.id),
    connectionId: connection.id,
    promptPresetId: null,
  });
  await chats.patchMetadata(chat.id, {
    enableAgents: true,
    activeAgentIds: ["expression"],
    enableTools: false,
    enableMemoryRecall: false,
    groupChatMode: "merged",
    groupResponseOrder: "manual",
    inactiveCharacterIds: [disabled.id],
    spriteCharacterIds: roster.map((character) => character.id),
  });
  await chats.createMessage({ chatId: chat.id, role: "user", content: "Continue the scene." });
  expressionOutput = [
    { characterId: alice.id, expression: "happy" },
    { characterId: bob.id, expression: "sad" },
    { characterId: disabled.id, expression: "happy" },
    { characterId: "unknown", expression: "happy" },
  ];
  const run = async (
    expectedIds: string[],
    options: Record<string, unknown> = {},
    retryMessageId?: string,
    completedIds = expectedIds,
  ) => {
    const before = spritePrompts.length;
    const response = await app.inject({
      method: "POST",
      url: retryMessageId ? "/api/generate/retry-agents" : "/api/generate/",
      payload: retryMessageId
        ? { chatId: chat.id, agentTypes: ["expression"], forMessageId: retryMessageId }
        : { chatId: chat.id, ...options },
    });
    assert.equal(response.statusCode, 200, response.body);
    assert(!response.body.includes('"type":"error"'), response.body);
    assert.equal(spritePrompts.length, before + 1, "real Expression Engine request completed");
    const prompt = spritePrompts.at(-1)!;
    const available = prompt.slice(prompt.indexOf("<available_sprites>"), prompt.indexOf("</available_sprites>"));
    for (const character of roster)
      assert.equal(
        available.includes(character.id),
        expectedIds.includes(character.id),
        `${JSON.parse(character.data).name} sprite availability matches this turn`,
      );
    const message = retryMessageId
      ? await chats.getMessage(retryMessageId)
      : (await chats.listMessages(chat.id)).at(-1)!;
    assert(message);
    const extra = JSON.parse(message.extra);
    assert.deepEqual(
      Object.keys(extra.spriteExpressions).sort(),
      [...completedIds].sort(),
      "only allowed expressions survive result validation and persistence",
    );
    assert.deepEqual([...extra.expressionSpriteIds].sort(), [...completedIds].sort());
    return message;
  };
  const merged = await run([alice.id, bob.id]);
  await run([alice.id, bob.id], {}, merged.id);
  await run([alice.id, bob.id], { regenerateMessageId: merged.id });
  await chats.patchMetadata(chat.id, { spriteCharacterIds: [bob.id] });
  const selected = await run([bob.id]);
  await run([bob.id], {}, selected.id);
  await chats.patchMetadata(chat.id, { spriteCharacterIds: [] });
  expressionOutput = [{ characterId: alice.id, expression: "happy" }];
  await chats.patchMetadata(chat.id, { expressionOnlyActiveSprites: true });
  const sparse = await run([alice.id, bob.id], {}, undefined, [alice.id]);
  assert.deepEqual(
    JSON.parse(sparse.extra).expressionSpriteIds,
    [alice.id],
    "eligible cast does not fabricate on-scene presence",
  );
  await run([alice.id, bob.id], {}, sparse.id, [alice.id]);
  expressionOutput = [{ characterId: bob.id, expression: "sad" }];
  const completed = await run([alice.id, bob.id]);
  assert.equal(JSON.parse(completed.extra).spriteExpressions[bob.id], "sad");
  assert(
    ["happy", "sad", "neutral"].includes(JSON.parse(completed.extra).spriteExpressions[alice.id]),
    "the existing author fallback remains required",
  );
  const empty = await chats.createMessage({
    chatId: chat.id,
    role: "assistant",
    content: "The room is empty.",
    extra: { spriteExpressions: { [bob.id]: "neutral" }, expressionSpriteIds: [bob.id] },
  });
  expressionOutput = [];
  const emptyRetry = await app.inject({
    method: "POST",
    url: "/api/generate/retry-agents",
    payload: { chatId: chat.id, agentTypes: ["expression"], forMessageId: empty.id },
  });
  assert.equal(emptyRetry.statusCode, 200, emptyRetry.body);
  assert(!emptyRetry.body.includes('"type":"error"'), emptyRetry.body);
  assert.deepEqual(
    JSON.parse((await chats.getMessage(empty.id))!.extra).expressionSpriteIds,
    [],
    "unowned narration keeps an empty completed set",
  );
  expressionOutput = [
    { characterId: alice.id, expression: "happy" },
    { characterId: bob.id, expression: "sad" },
  ];
  await chats.patchMetadata(chat.id, { groupChatMode: "individual" });
  const individual = await run([bob.id], { forCharacterId: bob.id });
  await run([bob.id], {}, individual.id);
  await chats.update(chat.id, { characterIds: [alice.id] });
  await chats.patchMetadata(chat.id, { groupChatMode: "merged" });
  await run([alice.id]);
  const persona = await characters.createPersona("Mari", "The player.");
  assert(persona);
  const personaSprites = join(dir, "sprites", persona.id);
  mkdirSync(personaSprites, { recursive: true });
  writeFileSync(join(personaSprites, "happy.png"), "fixture");
  await chats.update(chat.id, { personaId: persona.id, characterIds: [alice.id, bob.id] });
  expressionOutput.push({ characterId: persona.id, expression: "happy" });
  for (const impersonate of [false, true]) {
    const before = spritePrompts.length;
    const response = await app.inject({
      method: "POST",
      url: "/api/generate/",
      payload: { chatId: chat.id, impersonate, userMessage: "I smile." },
    });
    assert.equal(response.statusCode, 200, response.body);
    assert(!response.body.includes('"type":"error"'), response.body);
    assert.equal(spritePrompts.length, before + 1);
    const prompt = spritePrompts.at(-1)!;
    const available = prompt.slice(prompt.indexOf("<available_sprites>"), prompt.indexOf("</available_sprites>"));
    assert(available.includes(persona.id), "the active persona keeps its existing expression request");
    for (const character of [alice, bob])
      assert.equal(available.includes(character.id), !impersonate, "impersonation does not request cast expressions");
    if (!impersonate) {
      const latest = (await chats.listMessages(chat.id)).at(-1)!;
      const extra = JSON.parse(latest.extra);
      assert.deepEqual(Object.keys(extra.spriteExpressions).sort(), [alice.id, bob.id].sort());
      assert.deepEqual([...extra.expressionSpriteIds].sort(), [alice.id, bob.id, persona.id].sort());
      const user = (await chats.listMessages(chat.id)).filter((message) => message.role === "user").at(-1)!;
      assert.deepEqual(JSON.parse(user.extra).spriteExpressions, { [persona.id]: "happy" });
    }
  }
  // Replies with no new message from the player leave the persona to the Expression Engine: a persona the model
  // leaves out stays hidden under "Only show active sprites", although an older message of theirs is still in the
  // recent context. The same holds when the Expression Engine is retried on such a reply.
  expressionOutput = expressionOutput.filter((entry) => entry.characterId !== persona.id);
  for (let reply = 0; reply < 2; reply++) {
    const response = await app.inject({ method: "POST", url: "/api/generate/", payload: { chatId: chat.id } });
    assert.equal(response.statusCode, 200, response.body);
    assert(!response.body.includes('"type":"error"'), response.body);
    const latest = (await chats.listMessages(chat.id)).at(-1)!;
    assert.equal(latest.role, "assistant");
    // The first reply still answers the message impersonation wrote for the player; the next one does not.
    assert.equal(
      JSON.parse(latest.extra).expressionSpriteIds.includes(persona.id),
      reply === 0,
      reply === 0
        ? "the reply to the player's message keeps the persona"
        : "a persona who did not write this turn is not added back",
    );
  }
  const quiet = (await chats.listMessages(chat.id)).at(-1)!;
  const quietRetry = await app.inject({
    method: "POST",
    url: "/api/generate/retry-agents",
    payload: { chatId: chat.id, agentTypes: ["expression"], forMessageId: quiet.id },
  });
  assert.equal(quietRetry.statusCode, 200, quietRetry.body);
  assert(!quietRetry.body.includes('"type":"error"'), quietRetry.body);
  assert(
    !JSON.parse((await chats.getMessage(quiet.id))!.extra).expressionSpriteIds.includes(persona.id),
    "retrying the Expression Engine on such a reply does not add the persona either",
  );
  // A retry still finds the player's message when the agents read only one message of context.
  const agentsStore = createAgentsStorage(db);
  const expressionAgent = (await agentsStore.list()).find((agent) => agent.type === "expression")!;
  // Selected sprites leave the persona out, so only the player's turn can offer it to the retry.
  await agentsStore.update(expressionAgent.id, { settings: { contextSize: 1 } });
  await chats.patchMetadata(chat.id, { spriteCharacterIds: [alice.id, bob.id] });
  const answeredTurn = await app.inject({
    method: "POST",
    url: "/api/generate/",
    payload: { chatId: chat.id, userMessage: "I wave from the doorway." },
  });
  assert.equal(answeredTurn.statusCode, 200, answeredTurn.body);
  const answeredReply = (await chats.listMessages(chat.id)).at(-1)!;
  const answeredRetry = await app.inject({
    method: "POST",
    url: "/api/generate/retry-agents",
    payload: { chatId: chat.id, agentTypes: ["expression"], forMessageId: answeredReply.id },
  });
  assert.equal(answeredRetry.statusCode, 200, answeredRetry.body);
  assert(!answeredRetry.body.includes('"type":"error"'), answeredRetry.body);
  assert(
    JSON.parse((await chats.getMessage(answeredReply.id))!.extra).expressionSpriteIds.includes(persona.id),
    "a retried reply to the player's message keeps the persona, even with one message of agent context",
  );
  // A swipe of a reply to the player's message is still that turn, so the persona stays.
  const swiped = await app.inject({
    method: "POST",
    url: "/api/generate/",
    payload: { chatId: chat.id, regenerateMessageId: answeredReply.id },
  });
  assert.equal(swiped.statusCode, 200, swiped.body);
  assert(!swiped.body.includes('"type":"error"'), swiped.body);
  const swipedReply = (await chats.getMessage(answeredReply.id))!;
  assert(
    JSON.parse(swipedReply.extra).expressionSpriteIds.includes(persona.id),
    "a swipe of a reply to the player's message keeps the persona",
  );
  await agentsStore.update(expressionAgent.id, { settings: {} });
  await chats.patchMetadata(chat.id, { spriteCharacterIds: [] });
  // The player's turn lasts until a reply after it has its own Expression Engine result (#7378).
  const shown = JSON.stringify({ expressionSpriteIds: [alice.id] });
  const player = { role: "user", content: "I wave." };
  assert(playerTurnAwaitsExpression([player], 1), "the reply to the player's message");
  assert(playerTurnAwaitsExpression([player, { role: "assistant", extra: "{}" }], 2), "a whole group turn");
  assert(
    !playerTurnAwaitsExpression([player, { role: "assistant", extra: shown }], 2),
    "a later reply, after one that had its own expressions",
  );
  assert(playerTurnAwaitsExpression([player, { role: "assistant", extra: shown }], 1), "a swipe of that first reply");
  assert(!playerTurnAwaitsExpression([{ role: "assistant", extra: "{}" }], 1), "no message from the player");
  for (const mode of ["conversation", "game"] as const) {
    await chats.update(chat.id, { mode, characterIds: [alice.id, bob.id] });
    const before = spritePrompts.length;
    const response = await app.inject({
      method: "POST",
      url: "/api/generate/",
      payload: { chatId: chat.id, forCharacterId: bob.id },
    });
    assert.equal(response.statusCode, 200, response.body);
    assert(!response.body.includes('"type":"error"'), response.body);
    assert.equal(spritePrompts.length, before, `${mode} keeps its existing Expression Engine exclusion`);
  }
  console.log(
    "Expression group generation passed: merged active/selected cast, retry, regeneration, fallback completion, individual, single, persona/impersonation and Conversation/Game controls.",
  );
} finally {
  await app.close();
  provider.closeAllConnections();
  await new Promise<void>((done) => provider.close(() => done()));
  await closeDB();
  rmSync(dir, { recursive: true, force: true });
}
