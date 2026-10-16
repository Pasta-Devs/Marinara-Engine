// {{reasoning}} in the routes that build a prompt without sending it: the dry run Peek Prompt
// uses, the chat's live Peek Prompt fallback, and the preset preview. Each must read the
// level its own request would use, and a chat variable named `reasoning` must keep the name.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const previousDataDir = process.env.DATA_DIR;
const previousFileStorageDir = process.env.FILE_STORAGE_DIR;
const dataDir = mkdtempSync(join(tmpdir(), "marinara-reasoning-macro-routes-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";

const { default: Fastify } = await import("../../packages/server/node_modules/fastify/fastify.js");
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { generateRoutes } = await import("../../packages/server/src/routes/generate.routes.js");
const { chatsRoutes } = await import("../../packages/server/src/routes/chats.routes.js");
const { promptsRoutes } = await import("../../packages/server/src/routes/prompts.routes.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createCharactersStorage } = await import("../../packages/server/src/services/storage/characters.storage.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { createPromptsStorage } = await import("../../packages/server/src/services/storage/prompts.storage.js");
const { characterDataSchema } = await import("../../packages/shared/src/index.js");

const db = await getDB();
const app = Fastify();
app.decorate("db", db);
app.decorate("activeGenerations", new Map());
await app.register(generateRoutes, { prefix: "/api/generate" });
await app.register(chatsRoutes, { prefix: "/api/chats" });
await app.register(promptsRoutes, { prefix: "/api/prompts" });

try {
  const connection = await createConnectionsStorage(db).create({
    name: "Reasoning fixture",
    provider: "custom",
    baseUrl: "http://127.0.0.1:1/v1",
    model: "fixture",
    apiKey: "fixture",
    maxContext: 8192,
    maxTokensOverride: 256,
  });
  assert.ok(connection);
  const character = await createCharactersStorage(db).create(characterDataSchema.parse({ name: "Mira" }));
  assert.ok(character);

  const presets = createPromptsStorage(db);
  const preset = await presets.create({
    name: "Reasoning fixture",
    parameters: { maxTokens: 256, maxContext: 8192, reasoningEffort: "high" },
  });
  assert.ok(preset);
  await presets.createSection({
    presetId: preset.id,
    identifier: "level",
    name: "Level",
    content: "Level={{reasoning}}. {{#if reasoning}}THINKING{{else}}NOT_THINKING{{/if}}",
  });
  await presets.createSection({
    presetId: preset.id,
    identifier: "history",
    name: "Chat History",
    isMarker: true,
    markerConfig: { type: "chat_history" },
  });

  const chats = createChatsStorage(db);
  const makeChat = async (mode: string) => {
    const chat = await chats.create({
      name: `Reasoning ${mode}`,
      mode,
      characterIds: [character.id],
      connectionId: connection.id,
      promptPresetId: preset.id,
      personaId: null,
      groupId: null,
    });
    assert.ok(chat);
    await chats.createMessage({ chatId: chat.id, role: "user", content: "Hello there." });
    return chat;
  };
  const text = (messages: Array<{ content: unknown }>) => messages.map((message) => String(message.content)).join("\n");

  // Dry run, preset assembly: the preset's level.
  const roleplay = await makeChat("roleplay");
  const dry = await app.inject({
    method: "POST",
    url: "/api/generate/dryRun",
    payload: { chatId: roleplay.id, returnPrompt: true },
  });
  assert.equal(dry.statusCode, 200, dry.body);
  assert.ok(text(dry.json().prompt.messages).includes("Level=high. THINKING"), dry.body);
  assert.equal(dry.json().parameters.reasoningEffort, "high");

  // Dry run with promptParts in Conversation: the preset's level still reaches the request,
  // so the macro must read it too.
  const conversation = await makeChat("conversation");
  const parts = await app.inject({
    method: "POST",
    url: "/api/generate/dryRun",
    payload: {
      chatId: conversation.id,
      returnPrompt: true,
      promptParts: { presetText: "Parts level={{reasoning}}." },
    },
  });
  assert.equal(parts.statusCode, 200, parts.body);
  assert.equal(parts.json().parameters.reasoningEffort, "high", parts.body);
  assert.ok(text(parts.json().prompt.messages).includes("Parts level=high."), parts.body);

  // A chat variable named `reasoning` keeps the name in the previews too.
  await chats.patchMetadata(roleplay.id, { macroVariables: { reasoning: "no" } });
  const preview = await app.inject({
    method: "POST",
    url: `/api/prompts/${preset.id}/preview`,
    payload: { chatId: roleplay.id },
  });
  assert.equal(preview.statusCode, 200, preview.body);
  assert.ok(text(preview.json().messages).includes("Level=no. NOT_THINKING"), preview.body);

  const peek = await app.inject({ method: "POST", url: `/api/chats/${roleplay.id}/peek-prompt`, payload: {} });
  assert.equal(peek.statusCode, 200, peek.body);
  assert.ok(JSON.stringify(peek.json()).includes("Level=no. NOT_THINKING"), peek.body);

  console.info("reasoning macro route regressions passed.");
} finally {
  await app.close();
  await closeDB();
  rmSync(dataDir, { recursive: true, force: true });
  if (previousDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = previousDataDir;
  if (previousFileStorageDir === undefined) delete process.env.FILE_STORAGE_DIR;
  else process.env.FILE_STORAGE_DIR = previousFileStorageDir;
}
