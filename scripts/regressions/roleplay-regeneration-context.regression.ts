import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "marinara-roleplay-regeneration-"));
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
const { characterDataSchema, DEFAULT_ADVANCED_MEMORY_SETTINGS } = await import("../../packages/shared/dist/index.js");
const requests: Array<Record<string, any>> = [];
let outputs: Array<{ content: string; tool_calls?: unknown[] }> = [];
const provider = createServer(async (request, response) => {
  if (request.url?.endsWith("/api/extra/abort")) {
    response.writeHead(200, { "content-type": "application/json" }).end("{}");
    return;
  }
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const body = JSON.parse(Buffer.concat(chunks).toString());
  requests.push(body);
  const output = outputs.shift();
  assert(output, "unexpected provider request");
  assert(request.url?.endsWith("/messages"), "use the real Anthropic endpoint");
  assert.equal(body.stream, true);
  response.writeHead(200, { "content-type": "text/event-stream" });
  const send = (type: string, value: object) =>
    response.write(`event: ${type}\ndata: ${JSON.stringify({ type, ...value })}\n\n`);
  send("message_start", {
    message: {
      id: "fixture",
      type: "message",
      role: "assistant",
      model: body.model,
      content: [],
      usage: { input_tokens: 100, output_tokens: 0 },
    },
  });
  send("content_block_start", { index: 0, content_block: { type: "text", text: "" } });
  send("content_block_delta", { index: 0, delta: { type: "text_delta", text: output.content } });
  send("content_block_stop", { index: 0 });
  for (const [index, call] of ((output.tool_calls as any[]) ?? []).entries()) {
    send("content_block_start", {
      index: index + 1,
      content_block: { type: "tool_use", id: call.id, name: call.function.name, input: {} },
    });
    send("content_block_delta", {
      index: index + 1,
      delta: { type: "input_json_delta", partial_json: call.function.arguments },
    });
    send("content_block_stop", { index: index + 1 });
  }
  send("message_delta", {
    delta: { stop_reason: output.tool_calls ? "tool_use" : "end_turn" },
    usage: { output_tokens: 20 },
  });
  send("message_stop", {});
  response.end();
});
const db = await getDB();
const chats = createChatsStorage(db);
const app = Fastify();
app.decorate("db", db);
await app.register(generateRoutes, { prefix: "/api/generate" });
await app.register(chatsRoutes, { prefix: "/api/chats" });
try {
  await new Promise<void>((done) => provider.listen(0, "127.0.0.1", done));
  const address = provider.address();
  assert(address && typeof address === "object");
  const connection = await createConnectionsStorage(db).create({
    name: "Regeneration fixture",
    provider: "anthropic",
    baseUrl: `http://127.0.0.1:${address.port}/v1`,
    model: "claude-opus-5-5",
    apiKey: "fixture",
    maxContext: 8192,
    maxTokensOverride: 512,
  });
  assert(connection);
  const character = await createCharactersStorage(db).create(characterDataSchema.parse({ name: "Narrator" }));
  assert(character);
  const other = await createCharactersStorage(db).create(characterDataSchema.parse({ name: "Other" }));
  assert(other);
  const presets = createPromptsStorage(db);
  const preset = await presets.create({
    name: "Regeneration fixture",
    parameters: { maxTokens: 512, maxContext: 8192 },
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
  const generate = async (chatId: string, sequence: typeof outputs, input: Record<string, unknown> = {}) => {
    outputs = [...sequence];
    const start = requests.length;
    const response = await app.inject({
      method: "POST",
      url: "/api/generate/",
      payload: { chatId, forCharacterId: character.id, streaming: true, ...input },
    });
    assert.equal(response.statusCode, 200, response.body);
    assert(!response.body.includes('"type":"error"'), response.body);
    if (input.regenerateMessageId)
      assert.match(response.body, /reused-swipe-memory/u, "a swipe reuses recall while rebuilding current notes");
    assert.equal(outputs.length, 0, "all planned provider rounds ran");
    return requests.slice(start);
  };
  for (const [native, lastSpeakerId] of [
    [false, character.id],
    [true, character.id],
    [true, other.id],
  ] as const) {
    const chat = await chats.create({
      name: "Regeneration proof",
      mode: "roleplay",
      characterIds: [character.id, other.id],
      connectionId: connection.id,
      promptPresetId: preset.id,
    });
    assert(chat);
    await chats.patchMetadata(chat.id, {
      enableAgents: false,
      enableMemoryRecall: false,
      roleplayCommandsEnabled: true,
      roleplayCommandToggles: { notes: true, roll: true },
      roleplayCommandNarratorId: character.id,
      groupChatMode: "individual",
      groupResponseOrder: "manual",
      groupSpeakerNamesInHistory: true,
      groupTurnPromptEnabled: false,
      advancedMemory: {
        ...DEFAULT_ADVANCED_MEMORY_SETTINGS,
        enabled: true,
        maxContextTokens: 8192,
        summaryBudgetTokens: 512,
        knowledgeStarts: { [character.id]: null, [other.id]: null },
        knowledgeConfirmed: true,
        sceneCheckInterval: 100,
      },
    });
    await chats.createMessage({ chatId: chat.id, role: "user", content: "PREVIOUS_USER_ACTION: Approach the door." });
    await generate(chat.id, [
      { content: 'PREVIOUS_NARRATION. [notes: content="OLD_PERSONAL_NOTE: keep the visitor away"]' },
    ]);
    const noteMessage = (await chats.listMessages(chat.id)).at(-1)!;
    await chats.createMessage({
      chatId: chat.id,
      role: "assistant",
      characterId: lastSpeakerId,
      content: "CURRENT_CHARACTER_ACTION: Try the lock.",
    });
    await chats.patchMetadata(chat.id, {
      advancedMemoryState: {
        contextStarts: [
          {
            messageId: noteMessage.id,
            sceneStartMessageId: noteMessage.id,
            audienceCharacterIds: [],
            manualStartMessageId: null,
          },
        ],
      },
    });
    const rollArgs = { notation: "1d6", character: "Narrator", reason: "OLD_ROLL_REASON" };
    const firstRound = native
      ? {
          content: "DISCARDED_BEFORE_ROLL.",
          tool_calls: [
            {
              id: "discarded-roll",
              type: "function",
              function: { name: "roll_dice", arguments: JSON.stringify(rollArgs) },
            },
          ],
        }
      : { content: 'DISCARDED_BEFORE_ROLL. [roll: notation="1d6" character="Narrator" reason="OLD_ROLL_REASON"]' };
    const firstRequests = await generate(chat.id, [firstRound, { content: "DISCARDED_AFTER_ROLL." }]);
    assert.equal(firstRequests.length, 2);
    assert(
      JSON.stringify(firstRequests[1]).includes("DISCARDED_BEFORE_ROLL"),
      "the current turn's follow-up needs its own prefix",
    );
    const target = (await chats.listMessages(chat.id)).at(-1)!;
    const edited = await app.inject({
      method: "PATCH",
      url: `/api/chats/${chat.id}/messages/${noteMessage.id}/extra?swipeIndex=0`,
      payload: {
        roleplayCommandActivity: [
          {
            command: { type: "notes", content: "EDITED_PERSONAL_NOTE: introduce the new visitor" },
            raw: '[notes: content="OLD_PERSONAL_NOTE: keep the visitor away"]',
          },
        ],
        roleplayPrivateCommands: null,
        roleplayDocuments: null,
      },
    });
    assert.equal(edited.statusCode, 200, edited.body);
    const regenerated = await generate(
      chat.id,
      [
        { content: 'REGENERATED_BEFORE_ROLL. [roll: notation="1d6" character="Narrator" reason="NEW_ROLL_REASON"]' },
        { content: "REGENERATED_NARRATION." },
      ],
      { regenerateMessageId: target.id },
    );
    const prompt = JSON.stringify(regenerated);
    assert(
      !prompt.includes("DISCARDED_"),
      `${native ? "native" : "textual"}: discarded swipe leaked into regeneration`,
    );
    assert(!prompt.includes("OLD_ROLL_REASON"));
    assert(prompt.includes("PREVIOUS_NARRATION"));
    assert(prompt.includes("CURRENT_CHARACTER_ACTION"));
    assert(prompt.includes("EDITED_PERSONAL_NOTE"), "regeneration must read the saved Personal Notes edit");
    assert(!prompt.includes("OLD_PERSONAL_NOTE"), "regeneration must not replay stale Personal Notes");
    const peek = await app.inject({
      method: "POST",
      url: `/api/chats/${chat.id}/peek-prompt`,
      payload: { messageId: target.id },
    });
    assert.equal(peek.statusCode, 200);
    assert(
      !peek.body.includes("DISCARDED_"),
      "Peek Prompt must show the regenerated swipe, not the discarded tool turn",
    );
    assert(peek.body.includes("EDITED_PERSONAL_NOTE"));
    assert(!peek.body.includes("OLD_PERSONAL_NOTE"));
    await chats.removeMessage(target.id);
    const fresh = await generate(chat.id, [{ content: "FRESH_RESPONSE_AFTER_DELETION." }]);
    assert(JSON.stringify(fresh).includes("EDITED_PERSONAL_NOTE"));
    assert(!JSON.stringify(fresh).includes("OLD_PERSONAL_NOTE"));
  }
  console.log("Roleplay regeneration context regression passed.");
} finally {
  await app.close();
  provider.closeAllConnections();
  await new Promise<void>((done) => provider.close(() => done()));
  await closeDB();
  rmSync(dir, { recursive: true, force: true });
}
