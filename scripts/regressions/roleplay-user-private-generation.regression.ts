import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "marinara-user-private-"));
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
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { createCharactersStorage } = await import("../../packages/server/src/services/storage/characters.storage.js");
const { createPromptsStorage } = await import("../../packages/server/src/services/storage/prompts.storage.js");
const { characterDataSchema, getRoleplayWhispers } = await import("../../packages/shared/dist/index.js");
const prompts: string[] = [];
let outputs: string[] = [];
let selectorAnswer: string[] = [];
const provider = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const body = JSON.parse(Buffer.concat(chunks).toString());
  prompts.push(JSON.stringify(body.messages));
  if (prompts.at(-1)!.includes("hidden response orchestrator")) {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(
      JSON.stringify({
        choices: [{ message: { role: "assistant", content: JSON.stringify(selectorAnswer) }, finish_reason: "stop" }],
      }),
    );
    return;
  }
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
await app.register(chatsRoutes, { prefix: "/api/chats" });
try {
  await new Promise<void>((done) => provider.listen(0, "127.0.0.1", done));
  const address = provider.address();
  assert(address && typeof address === "object");
  const connection = await createConnectionsStorage(db).create({
    name: "User private fixture",
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
  selectorAnswer = [bob.id];
  const persona = await characters.createPersona("Mari", "The player.");
  assert(persona);
  const presets = createPromptsStorage(db);
  const preset = await presets.create({
    name: "User private fixture",
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
    name: "User private proof",
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
    roleplayCommandToggles: { whisper: true, notes: true },
    roleplayWhisperAudience: "narrator",
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
  const post = await app.inject({
    method: "POST",
    url: `/api/chats/${chat.id}/messages`,
    payload: {
      role: "user",
      content:
        'Before. [whisper: character="Bob" text="USER_WHISPER_SECRET"] After. [notes: content="USER_FIRST_INTENT_SECRET"]',
    },
  });
  assert.equal(post.statusCode, 200, post.body);
  const userMessage = post.json();
  assert.equal(userMessage.content, "Before.  After. ");
  assert.deepEqual(getRoleplayWhispers(JSON.parse(userMessage.extra))[0]?.recipient, { id: bob.id, kind: "character" });
  for (const id of [alice.id, bob.id, narrator.id]) {
    await generate("Public response.", id);
    for (const content of [prompts.at(-1)!, await preview(id)]) {
      assert.equal(
        content.includes("USER_WHISPER_SECRET"),
        id !== alice.id,
        "only bound recipient and appointed narrator receive user whisper",
      );
      assert.equal(
        content.includes("USER_FIRST_INTENT_SECRET"),
        id === narrator.id,
        "user notes belong only to appointed narrator",
      );
      if (id !== alice.id)
        assert(
          content.indexOf("Before.") < content.indexOf("USER_WHISPER_SECRET") &&
            content.indexOf("USER_WHISPER_SECRET") < content.indexOf("After."),
        );
    }
  }
  await generate("Recipient response.", bob.id, {
    userMessage:
      'Public action. [whisper: character="Bob" text="GENERATE_SECRET"] [notes: content="REVISED_USER_PLAN_SECRET"]',
  });
  assert(prompts.at(-1)!.includes("GENERATE_SECRET"));
  assert(!prompts.at(-1)!.includes("REVISED_USER_PLAN_SECRET"));
  const savedUsers = (await chats.listMessages(chat.id)).filter((message) => message.role === "user");
  assert.equal(savedUsers.at(-1)!.content, "Public action.  ");
  const narratorPreview = await preview(narrator.id);
  assert(narratorPreview.includes("REVISED_USER_PLAN_SECRET"));
  assert(!narratorPreview.includes("USER_FIRST_INTENT_SECRET"), "new user notes replace previous intentions");
  for (const id of [alice.id, bob.id, narrator.id]) {
    const content = await preview(id, {
      userMessage: 'Draft. [whisper: character="Bob" text="DRAFT_WHISPER_SECRET"] [notes: content="DRAFT_PLAN_SECRET"]',
    });
    assert.equal(
      content.includes("DRAFT_WHISPER_SECRET"),
      id !== alice.id,
      "unsaved whisper preview uses same audience",
    );
    assert.equal(
      content.includes("DRAFT_PLAN_SECRET"),
      id === narrator.id,
      "unsaved notes preview belongs only to narrator",
    );
  }
  const beforeSmart = prompts.length;
  await generate("Smart answer.", undefined, {
    forCharacterId: undefined,
    smartResponse: true,
    userMessage:
      'Public Smart turn. [whisper: character="Bob" text="SMART_WHISPER_SECRET"] [notes: content="SMART_PLAN_SECRET"]',
  });
  const smartPrompts = prompts.slice(beforeSmart);
  const selector = smartPrompts.find((prompt) => prompt.includes("hidden response orchestrator"));
  assert(selector, "real Smart selector was invoked");
  assert(!selector.includes("SECRET"), "speaker selection never receives private activity");

  await generate('[notes: content="ALICE_PLAN_SECRET"] Alice speaks.', alice.id);
  await generate('[notes: content="BOB_PLAN_SECRET"] Bob speaks.', bob.id);
  await generate('[notes: content="NARRATOR_PLAN_SECRET"] Narrator speaks.', narrator.id);
  for (const content of [await preview(narrator.id)]) {
    for (const secret of ["ALICE_PLAN_SECRET", "BOB_PLAN_SECRET", "NARRATOR_PLAN_SECRET", "SMART_PLAN_SECRET"])
      assert(content.includes(secret), secret);
  }
  await chats.patchMetadata(chat.id, { inactiveCharacterIds: [alice.id] });
  await generate("Narrator follows the active cast.", narrator.id);
  for (const content of [prompts.at(-1)!, await preview(narrator.id)]) {
    assert(!content.includes("ALICE_PLAN_SECRET"), "disabled character notes stay out of narrator context");
    for (const secret of ["BOB_PLAN_SECRET", "NARRATOR_PLAN_SECRET", "SMART_PLAN_SECRET"])
      assert(content.includes(secret), secret);
  }
  await chats.patchMetadata(chat.id, { inactiveCharacterIds: [] });
  assert(
    (await preview(narrator.id)).includes("ALICE_PLAN_SECRET"),
    "re-enabling restores notes without deleting stored state",
  );
  await chats.update(chat.id, { characterIds: [bob.id, narrator.id] });
  await generate("Narrator follows current membership.", narrator.id);
  for (const content of [prompts.at(-1)!, await preview(narrator.id)]) {
    assert(!content.includes("ALICE_PLAN_SECRET"), "removed character notes stay out of narrator context");
    assert(content.includes("BOB_PLAN_SECRET"));
  }
  const invalid = await app.inject({
    method: "POST",
    url: `/api/chats/${chat.id}/messages`,
    payload: {
      role: "user",
      content: 'Visible. [whisper: character="Mari" text="INVALID_PERSONA_SECRET"] [notes: content="UNFINISHED_SECRET',
    },
  });
  assert.equal(invalid.statusCode, 200, invalid.body);
  assert(!invalid.json().content.includes("SECRET"));
  assert(!(await preview(narrator.id)).includes("INVALID_PERSONA_SECRET"));
  const invalidActivity = JSON.parse(invalid.json().extra).roleplayCommandActivity;
  assert(
    invalidActivity.some(
      (item: { error?: string; raw: string }) =>
        item.error === "roleplay.commands.errors.invalidPrivate" && item.raw.includes("UNFINISHED_SECRET"),
    ),
    "unfinished user input is retained for recovery",
  );
  for (const [tag, secret] of [
    ['[notes: wrong="MALFORMED_USER_SECRET"]', "MALFORMED_USER_SECRET"],
    [`[whisper: character="Bob" text="OVERSIZED_USER_SECRET${"x".repeat(32_000)}"]`, "OVERSIZED_USER_SECRET"],
    [
      Array.from({ length: 24 }, () => '[notes: content="allowed note"]').join(" ") +
        ' [notes: content="OVER_LIMIT_USER_SECRET"]',
      "OVER_LIMIT_USER_SECRET",
    ],
  ]) {
    const recovery = await app.inject({
      method: "POST",
      url: `/api/chats/${chat.id}/messages`,
      payload: { role: "user", content: `Public recovery text. ${tag}` },
    });
    assert.equal(recovery.statusCode, 200, recovery.body);
    assert(!recovery.json().content.includes(secret!));
    const activity = JSON.parse(recovery.json().extra).roleplayCommandActivity;
    assert(
      activity.some(
        (item: { error?: string; raw: string }) =>
          item.error === "roleplay.commands.errors.invalidPrivate" && item.raw.includes(secret!),
      ),
      "invalid private text is retained in an error activity",
    );
    assert(!(await preview(narrator.id)).includes(secret!), "invalid command recovery is owner-only");
  }

  await chats.patchMetadata(chat.id, { roleplayCommandsEnabled: false });
  await generate("Public only.", bob.id, {
    userMessage: 'Visible. [whisper: character="Bob" text="DISABLED_SECRET"] [notes: content="DISABLED_NOTES_SECRET"]',
  });
  assert(!prompts.at(-1)!.includes("DISABLED_SECRET"));
  await chats.patchMetadata(chat.id, { roleplayCommandsEnabled: true });
  assert(!(await preview(narrator.id)).includes("DISABLED_NOTES_SECRET"));

  // Legacy raw user rows predate command extraction. They must not acquire a new recipient on read.
  const { messages: messageTable } = await import("../../packages/server/src/db/schema/index.js");
  const { eq } = await import("../../packages/server/src/db/file-query.js");
  await db
    .update(messageTable)
    .set({
      content: 'Old public. [whisper: character="Bob" text="LEGACY_SECRET"] [notes: content="LEGACY_PLAN_SECRET"]',
    })
    .where(eq(messageTable.id, userMessage.id));
  await generate("Legacy-safe reply.", narrator.id);
  for (const content of [prompts.at(-1)!, await preview(narrator.id)]) {
    assert(!content.includes("LEGACY_SECRET") && !content.includes("LEGACY_PLAN_SECRET"));
    assert(content.includes("Old public."));
  }
  console.log(
    "User Roleplay private commands passed: manual/direct generation, recipient and narrator privacy, Smart selection, preview parity, legacy input and active-member notes.",
  );
} finally {
  await app.close();
  provider.closeAllConnections();
  await new Promise<void>((done) => provider.close(() => done()));
  await closeDB();
  rmSync(dir, { recursive: true, force: true });
}
