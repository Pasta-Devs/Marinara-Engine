import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "marinara-whisper-"));
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
const { createCharactersStorage } = await import("../../packages/server/src/services/storage/characters.storage.js");
const { createPromptsStorage } = await import("../../packages/server/src/services/storage/prompts.storage.js");
const { characterDataSchema, getRoleplayWhispers } = await import("../../packages/shared/dist/index.js");
const prompts: string[] = [];
let outputs: string[] = [];
const provider = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const body = JSON.parse(Buffer.concat(chunks).toString());
  prompts.push(JSON.stringify(body.messages));
  const content = outputs.shift();
  assert.notEqual(content, undefined, "unexpected provider request");
  response.writeHead(200, { "content-type": "text/event-stream" });
  // Split every character, including command prefixes, escaped quotes and brackets.
  for (const character of content!)
    response.write(
      `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: character }, finish_reason: null }] })}\n\n`,
    );
  response.end(
    `data: ${JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: "stop" }] })}\n\ndata: [DONE]\n\n`,
  );
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
    name: "Whisper fixture",
    provider: "custom",
    baseUrl: `http://127.0.0.1:${address.port}/v1`,
    model: "fixture",
    apiKey: "fixture",
    maxContext: 32768,
    maxTokensOverride: 512,
  });
  assert(connection);
  const participants = await Promise.all(
    ["Alice", "Bob", "Narrator"].map((name) => characters.create(characterDataSchema.parse({ name }))),
  );
  const [alice, bob, narrator] = participants;
  assert(alice && bob && narrator);
  const persona = await characters.createPersona("Mari", "The player.");
  assert(persona);
  const presets = createPromptsStorage(db);
  const preset = await presets.create({
    name: "Whisper fixture",
    parameters: { maxTokens: 512, maxContext: 32768, strictRoleFormatting: true },
    wrapFormat: "xml",
  });
  assert(preset);
  await presets.createSection({
    presetId: preset.id,
    identifier: "rules",
    name: "Rules",
    content: "Respond as {{char}}.",
  });
  await presets.createSection({
    presetId: preset.id,
    identifier: "history",
    name: "Chat History",
    isMarker: true,
    markerConfig: { type: "chat_history" },
  });
  const chat = await chats.create({
    name: "Whisper proof",
    mode: "roleplay",
    characterIds: [alice.id, bob.id, narrator.id],
    personaId: persona.id,
    connectionId: connection.id,
    promptPresetId: preset.id,
  });
  assert(chat);
  await chats.patchMetadata(chat.id, {
    enableAgents: false,
    enableTools: false,
    enableMemoryRecall: false,
    roleplayCommandsEnabled: true,
    roleplayCommandToggles: { whisper: true },
    roleplayCommandNarratorId: narrator.id,
    groupChatMode: "individual",
    groupResponseOrder: "manual",
  });
  await chats.createMessage({ chatId: chat.id, role: "user", content: "Begin." });
  const generate = async (output: string, forCharacterId = alice.id, options: Record<string, unknown> = {}) => {
    outputs = [output];
    const response = await app.inject({
      method: "POST",
      url: "/api/generate/",
      payload: { chatId: chat.id, forCharacterId, ...options },
    });
    assert.equal(response.statusCode, 200, response.body);
    assert(!response.body.includes('"type":"error"'), response.body);
    assert.equal(outputs.length, 0);
    return response;
  };
  const preview = async (forCharacterId: string, options: Record<string, unknown> = {}) => {
    const response = await app.inject({
      method: "POST",
      url: "/api/generate/dryRun",
      payload: { chatId: chat.id, forCharacterId, returnPrompt: true, ...options },
    });
    assert.equal(response.statusCode, 200, response.body);
    return JSON.stringify(response.json().prompt.messages);
  };
  const first = await generate(
    'Before. [whisper: character="Bob" text="BOB_ONLY_SECRET"] After. [whisper: character="Mari" text="PERSONA_ONLY_SECRET"]',
  );
  const tokens = first.body
    .split("\n")
    .filter((line) => line.startsWith("data: "))
    .flatMap((line) => {
      try {
        const event = JSON.parse(line.slice(6));
        return event.type === "token" ? [event.data] : [];
      } catch {
        return [];
      }
    })
    .join("");
  assert(tokens.includes("Before.") && tokens.includes("After."), "the stream proof includes real public tokens");
  assert(
    !tokens.includes("SECRET") && !tokens.includes("[whisper"),
    "streamed narration never contains private command text",
  );
  const saved = (await chats.listMessages(chat.id)).at(-1)!;
  assert.equal(saved.content, "Before.  After.");
  const whispers = getRoleplayWhispers(JSON.parse(saved.extra));
  assert.equal(whispers.length, 2);
  assert.deepEqual(whispers[0]!.recipient, { id: bob.id, kind: "character" });
  assert.deepEqual(whispers[1]!.recipient, { id: persona.id, kind: "persona" });
  assert.equal(whispers[0]!.activity.contentOffset, "Before.".length);
  for (const id of [alice.id, bob.id, narrator.id]) {
    await generate("Public reply.", id);
    const live = prompts.at(-1)!;
    const dry = await preview(id);
    for (const content of [live, dry]) {
      assert.equal(
        content.includes("BOB_ONLY_SECRET"),
        id === bob.id || id === narrator.id,
        "recipient and narrator alone get the character secret",
      );
      assert.equal(
        content.includes("PERSONA_ONLY_SECRET"),
        id === narrator.id,
        "the sender does not gain recipient knowledge",
      );
    }
  }
  await generate("I acknowledge the vision.", alice.id, { impersonate: true });
  for (const content of [prompts.at(-1)!, await preview(alice.id, { impersonate: true })]) {
    assert(content.includes("PERSONA_ONLY_SECRET"));
    assert(!content.includes("BOB_ONLY_SECRET"));
  }
  await chats.updateMessageExtra(saved.id, { hiddenFromAICharacterIds: [bob.id] });
  assert(!(await preview(bob.id)).includes("BOB_ONLY_SECRET"));
  assert((await preview(narrator.id)).includes("BOB_ONLY_SECRET"));
  await chats.updateMessageExtra(saved.id, { hiddenFromAICharacterIds: [], hiddenFromAI: true });
  assert(!(await preview(narrator.id)).includes("BOB_ONLY_SECRET"));
  await chats.updateMessageExtra(saved.id, { hiddenFromAI: false });
  await generate("A different public reply.", alice.id, { regenerateMessageId: saved.id });
  assert(!prompts.at(-1)!.includes("BOB_ONLY_SECRET"));
  assert(!(await preview(narrator.id)).includes("BOB_ONLY_SECRET"), "the active swipe owns its secrets");
  await chats.setActiveSwipe(saved.id, 0);
  assert((await preview(bob.id)).includes("BOB_ONLY_SECRET"));

  await generate('[whisper: character="Bob" text="WHISPER_WITHOUT_PROSE"]');
  assert((await preview(bob.id)).includes("WHISPER_WITHOUT_PROSE"), "secret-only messages survive history shaping");
  assert(!(await preview(alice.id)).includes("WHISPER_WITHOUT_PROSE"));
  await generate('Continued. [whisper: character="Bob" text="CONTINUED_SECRET"]', alice.id, {
    continueMessageId: saved.id,
  });
  assert((await preview(bob.id)).includes("CONTINUED_SECRET"));
  assert(!(await preview(bob.id, { regenerateMessageId: saved.id })).includes("CONTINUED_SECRET"));

  await chats.patchMetadata(chat.id, { roleplayWhisperAudience: "narrator" });
  await generate('Ignored. [whisper: character="Bob" text="UNAUTHORIZED_SECRET"]');
  assert(!prompts.at(-1)!.includes("[whisper:"));
  assert(!(await preview(bob.id)).includes("UNAUTHORIZED_SECRET"));
  await generate('Allowed. [whisper: character="Bob" text="NARRATOR_SECRET"]', narrator.id);
  assert((await preview(bob.id)).includes("NARRATOR_SECRET"));
  await generate('Invalid. [whisper: character="Unknown" text="INVALID_TARGET_SECRET"]', narrator.id);
  assert(!(await preview(narrator.id)).includes("INVALID_TARGET_SECRET"));
  await chats.patchMetadata(chat.id, { roleplayWhisperAudience: "all", groupResponseOrder: "sequential" });
  outputs = [
    'Alice speaks. [whisper: character="Bob" text="SAME_TURN_SECRET"]',
    'Bob answers. [whisper: character="Mari" text="SAME_TURN_PERSONA_SECRET"]',
    "The narrator continues.",
  ];
  const turnStart = prompts.length;
  const group = await app.inject({ method: "POST", url: "/api/generate/", payload: { chatId: chat.id } });
  assert.equal(group.statusCode, 200, group.body);
  assert(!group.body.includes('"type":"error"'), group.body);
  assert.equal(outputs.length, 0);
  assert.equal(prompts.length - turnStart, 3);
  assert(!prompts[turnStart]!.includes("SAME_TURN_SECRET"));
  assert(
    prompts[turnStart + 1]!.includes("SAME_TURN_SECRET"),
    "later recipients receive whispers within the same turn",
  );
  assert(prompts[turnStart + 2]!.includes("SAME_TURN_PERSONA_SECRET"), "the narrator sees the latest in-turn secrets");
  await chats.patchMetadata(chat.id, { groupChatMode: "merged", roleplayWhisperAudience: "all" });
  assert(!(await preview(bob.id)).includes("BOB_ONLY_SECRET"), "merged voices must not receive private knowledge");
  await generate('Merged. [whisper: character="Bob" text="MERGED_SECRET"]');
  assert(!prompts.at(-1)!.includes("[whisper:"));
  assert.equal(getRoleplayWhispers(JSON.parse((await chats.listMessages(chat.id)).at(-1)!.extra)).length, 0);
  console.log(
    "Roleplay whisper generation passed: streamed privacy, recipient/narrator/persona prompts, preview parity, visibility, swipes, continuation and permissions.",
  );
} finally {
  await app.close();
  provider.closeAllConnections();
  await new Promise<void>((done) => provider.close(() => done()));
  await closeDB();
  rmSync(dir, { recursive: true, force: true });
}
