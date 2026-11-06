import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Regenerating an impersonated turn impersonates the persona again, with the direction it was written with, and
// saves the swipe and its reasoning on that user message. A persona's turn with no stored impersonation is rewritten
// as the persona's. In an Individual group both failed with "Regenerated message is missing character" (#8682).
// Single-character and Merged chats, and a character's own regeneration, are unchanged.
const dir = mkdtempSync(join(tmpdir(), "marinara-impersonation-group-regeneration-"));
process.env.DATA_DIR = dir;
process.env.FILE_STORAGE_DIR = join(dir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";
// The stub runs on 127.0.0.1; nothing leaves the machine.
process.env.PROVIDER_LOCAL_URLS_ENABLED = "true";
const requireServer = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const Fastify = requireServer("fastify") as typeof import("fastify").default;
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { generateRoutes } = await import("../../packages/server/src/routes/generate.routes.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { createCharactersStorage } = await import("../../packages/server/src/services/storage/characters.storage.js");
const { createPromptsStorage } = await import("../../packages/server/src/services/storage/prompts.storage.js");
const { characterDataSchema } = await import("../../packages/shared/dist/index.js");

const bodies: Array<Record<string, any>> = [];
let reply = { text: "", reasoning: "" };
const provider = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  bodies.push(JSON.parse(Buffer.concat(chunks).toString()));
  const send = (delta: object, finish: string | null = null) =>
    response.write(`data: ${JSON.stringify({ choices: [{ index: 0, delta, finish_reason: finish }] })}\n\n`);
  response.writeHead(200, { "content-type": "text/event-stream" });
  send({ reasoning_content: reply.reasoning });
  send({ content: reply.text });
  send({}, "stop");
  response.end("data: [DONE]\n\n");
});
const db = await getDB();
const chats = createChatsStorage(db);
const app = Fastify();
app.decorate("db", db);
await app.register(generateRoutes, { prefix: "/api/generate" });
try {
  await new Promise<void>((done) => provider.listen(0, "127.0.0.1", done));
  const address = provider.address();
  assert(address && typeof address === "object");
  const connection = await createConnectionsStorage(db).create({
    name: "Impersonation fixture",
    provider: "openrouter",
    baseUrl: `http://127.0.0.1:${address.port}/openrouter.ai/api/v1`,
    model: "meta-llama/llama-3.3-70b-instruct",
    apiKey: "fixture",
    maxContext: 32768,
    maxTokensOverride: 512,
  });
  assert(connection);
  const characters = createCharactersStorage(db);
  const alice = await characters.create(characterDataSchema.parse({ name: "Alice" }));
  const bob = await characters.create(characterDataSchema.parse({ name: "Bob" }));
  assert(alice && bob);
  const presets = createPromptsStorage(db);
  const preset = await presets.create({
    name: "Impersonation fixture",
    parameters: { maxTokens: 512, maxContext: 32768 },
    wrapFormat: "xml",
  });
  assert(preset);
  await presets.createSection({ presetId: preset.id, identifier: "rules", name: "Rules", content: "Rules." });
  await presets.createSection({
    presetId: preset.id,
    identifier: "history",
    name: "Chat History",
    isMarker: true,
    markerConfig: { type: "chat_history" },
  });

  const generate = async (label: string, payload: Record<string, unknown>, next: typeof reply) => {
    reply = next;
    bodies.length = 0;
    const response = await app.inject({
      method: "POST",
      url: "/api/generate/",
      payload: { streaming: true, ...payload },
    });
    assert.equal(response.statusCode, 200, response.body);
    assert(!response.body.includes('"type":"error"'), `${label}: ${response.body}`);
    assert.equal(bodies.length, 1, `${label} sends one request`);
    return JSON.stringify(bodies[0]!.messages);
  };

  for (const [label, characterIds, groupChatMode] of [
    ["single character", [alice.id], "individual"],
    ["Merged group", [alice.id, bob.id], "merged"],
    ["Individual group", [alice.id, bob.id], "individual"],
  ] as const) {
    const chat = await chats.create({
      name: label,
      mode: "roleplay",
      characterIds: [...characterIds],
      connectionId: connection.id,
      promptPresetId: preset.id,
    });
    assert(chat);
    await chats.patchMetadata(chat.id, {
      enableAgents: false,
      enableTools: false,
      groupChatMode,
      groupTurnPromptEnabled: true,
    });
    const typed = await chats.createMessage({ chatId: chat.id, role: "user", content: "I knock." });
    const answer = await chats.createMessage({
      chatId: chat.id,
      role: "assistant",
      characterId: alice.id,
      content: "Alice opens the door.",
    });
    assert(typed && answer);

    await generate(
      `${label} impersonation`,
      { chatId: chat.id, impersonate: true, userMessage: "wave at Alice" },
      { text: "I wave at Alice.", reasoning: "FIRST_REASONING" },
    );
    const impersonated = (await chats.listMessages(chat.id)).at(-1)!;
    assert.equal(impersonated.role, "user", `${label}: the impersonated turn is the persona's`);
    assert.equal(impersonated.characterId, null);
    assert.equal(impersonated.content, "I wave at Alice.");

    const sent = await generate(
      `${label} impersonated regeneration`,
      { chatId: chat.id, regenerateMessageId: impersonated.id },
      { text: "I wave again.", reasoning: "SECOND_REASONING" },
    );
    assert(sent.includes("You are now writing as"), `${label}: the regeneration impersonates the persona again`);
    assert(sent.includes("wave at Alice"), `${label}: with the direction the turn was written with`);
    assert(!sent.includes("Respond ONLY as"), `${label}: not as a character's turn`);
    const regenerated = await chats.getMessage(impersonated.id);
    assert.equal(regenerated?.role, "user");
    assert.equal(regenerated?.characterId, null);
    assert.equal(regenerated?.content, "I wave again.", `${label}: saved as the turn's new swipe`);
    assert.equal(regenerated?.activeSwipeIndex, 1);
    const extra = JSON.parse(regenerated!.extra as string);
    assert.equal(extra.thinking, "SECOND_REASONING", `${label}: the swipe keeps its reasoning`);
    assert.equal(extra.generationReplay?.impersonate, true, `${label}: and still regenerates as impersonation`);
    assert.equal(extra.generationReplay?.userMessage, "wave at Alice");
    assert.equal((await chats.listMessages(chat.id)).length, 3, `${label}: no message is added`);

    // A persona's turn without a stored impersonation (typed, saved before replays existed, or copied by a branch,
    // which drops the replay and keeps the reasoning) is rewritten as the persona's, not as a character's turn.
    await chats.updateMessageExtra(impersonated.id, { generationReplay: null });
    for (const persona of [typed, impersonated]) {
      const nextSwipe = (await chats.getMessage(persona.id))!.activeSwipeIndex + 1;
      const rewritten = await generate(
        `${label} persona rewrite`,
        { chatId: chat.id, regenerateMessageId: persona.id },
        { text: "I knock twice.", reasoning: "REWRITE_REASONING" },
      );
      assert(!rewritten.includes("Respond ONLY as"), `${label}: a persona's turn is not a character's`);
      const swipe = await chats.getMessage(persona.id);
      assert.equal(swipe?.role, "user");
      assert.equal(swipe?.characterId, null);
      assert.equal(swipe?.content, "I knock twice.", `${label}: saved as the persona's new swipe`);
      assert.equal(swipe?.activeSwipeIndex, nextSwipe);
      assert.equal(JSON.parse(swipe!.extra as string).thinking, "REWRITE_REASONING");
    }
    assert.equal((await chats.listMessages(chat.id)).length, 3, `${label}: no message is added`);

    // A character's own reply still regenerates as that character.
    const characterSent = await generate(
      `${label} character regeneration`,
      { chatId: chat.id, regenerateMessageId: answer.id },
      { text: "Alice opens the door wide.", reasoning: "" },
    );
    assert(!characterSent.includes("You are now writing as"), `${label}: a character's reply is not impersonated`);
    if (groupChatMode === "individual" && characterIds.length > 1)
      assert(characterSent.includes("Respond ONLY as Alice."), `${label}: Alice regenerates her own reply`);
    const characterSwipe = await chats.getMessage(answer.id);
    assert.equal(characterSwipe?.role, "assistant");
    assert.equal(characterSwipe?.characterId, alice.id);
    assert.equal(characterSwipe?.content, "Alice opens the door wide.");
  }
  console.log("Impersonation group regeneration regression passed.");
} finally {
  await app.close();
  provider.closeAllConnections();
  await new Promise<void>((done) => provider.close(() => done()));
  await closeDB();
  rmSync(dir, { recursive: true, force: true });
}
