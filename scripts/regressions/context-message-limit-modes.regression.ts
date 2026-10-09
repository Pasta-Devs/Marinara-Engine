// #7321: Limit Context Messages trims the history in Conversation, Game and Roleplay. In a
// Roleplay chat with Advanced Memory Recall on, Advanced Memory sizes the history with its own
// token cap instead, so Chat Settings must say the limit is not used there.
//
// Driven through /api/generate/dryRun, the same path Peek Prompt uses.
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const previousDataDir = process.env.DATA_DIR;
const previousFileStorageDir = process.env.FILE_STORAGE_DIR;
const dataDir = mkdtempSync(join(tmpdir(), "marinara-context-message-limit-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";

const { default: Fastify } = await import("../../packages/server/node_modules/fastify/fastify.js");
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { generateRoutes } = await import("../../packages/server/src/routes/generate.routes.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createCharactersStorage } = await import("../../packages/server/src/services/storage/characters.storage.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { characterDataSchema, DEFAULT_ADVANCED_MEMORY_SETTINGS } = await import("../../packages/shared/src/index.js");

const db = await getDB();
const app = Fastify();
app.decorate("db", db);
app.decorate("activeGenerations", new Map());
await app.register(generateRoutes, { prefix: "/api/generate" });

try {
  const connection = await createConnectionsStorage(db).create({
    name: "Context limit fixture",
    provider: "custom",
    baseUrl: "http://127.0.0.1:1/v1",
    model: "fixture",
    apiKey: "fixture",
    maxContext: 64_000,
    maxTokensOverride: 256,
  });
  assert.ok(connection);
  const character = await createCharactersStorage(db).create(characterDataSchema.parse({ name: "Pantalone" }));
  assert.ok(character);
  const chats = createChatsStorage(db);

  const createChat = async (mode: "conversation" | "game" | "roleplay") => {
    const chat = await chats.create({
      name: `Context limit ${mode}`,
      mode,
      characterIds: [character.id],
      connectionId: connection.id,
      personaId: null,
      groupId: null,
    });
    assert.ok(chat);
    for (let index = 0; index < 12; index++)
      await chats.createMessage({
        chatId: chat.id,
        role: index % 2 ? "assistant" : "user",
        characterId: index % 2 ? character.id : null,
        content: `HISTORY_${index}_END`,
      });
    await chats.patchMetadata(chat.id, { enableAgents: false, contextMessageLimit: 3 });
    return chat.id;
  };
  const sentHistory = async (chatId: string) => {
    const dry = await app.inject({
      method: "POST",
      url: "/api/generate/dryRun",
      payload: { chatId, returnPrompt: true },
    });
    assert.equal(dry.statusCode, 200, dry.body);
    return [...new Set(Array.from(dry.body.matchAll(/HISTORY_(\d+)_END/gu), (match) => Number(match[1])))];
  };

  for (const mode of ["conversation", "game", "roleplay"] as const) {
    assert.deepEqual(await sentHistory(await createChat(mode)), [9, 10, 11], `${mode} sends only the last 3 messages`);
  }

  const advancedChatId = await createChat("roleplay");
  await chats.patchMetadata(advancedChatId, {
    advancedMemory: {
      ...DEFAULT_ADVANCED_MEMORY_SETTINGS,
      enabled: true,
      knowledgeStarts: { [character.id]: null },
      knowledgeConfirmed: true,
    },
  });
  assert.equal(
    (await sentHistory(advancedChatId)).length,
    12,
    "Advanced Memory keeps the whole chat while it fits its token cap, so the message limit is not used",
  );

  // Chat Settings tells the user that, next to the limit.
  // ponytail: a source check like floating-window.regression.ts uses for the drawer; it breaks if the
  // prop or the note's markup is renamed or wrapped. Upgrade path: render AdvancedParametersSection once a client
  // component harness (QueryClient + i18n) exists for regressions.
  const repositoryRoot = join(import.meta.dirname, "../..");
  const drawer = readFileSync(
    join(repositoryRoot, "packages/client/src/components/chat/ChatSettingsDrawer.tsx"),
    "utf8",
  );
  assert.ok(
    drawer.includes("advancedMemoryManagesHistory={advancedMemoryEnabled}"),
    "the drawer tells Advanced Parameters when Advanced Memory sizes the history",
  );
  const section = readFileSync(
    join(repositoryRoot, "packages/client/src/features/chat-settings/sections/AdvancedParametersSection.tsx"),
    "utf8",
  );
  assert.match(
    section,
    /\{contextMessageLimit && advancedMemoryManagesHistory && \(\s*<p[^>]*>\s*\{localizeUi\("ui\.chatSettings\.advancedparameterssection\.contextMessageLimitAdvancedMemory"\)\}/u,
    "the note shows only while both the limit and Advanced Memory are on",
  );
  const english = JSON.parse(
    readFileSync(join(repositoryRoot, "packages/client/src/localization/locales/en.json"), "utf8"),
  ) as Record<string, string>;
  assert.ok(english["ui.chatSettings.advancedparameterssection.contextMessageLimitAdvancedMemory"]);

  console.info("Context message limit regressions passed.");
} finally {
  await app.close();
  await closeDB();
  rmSync(dataDir, { recursive: true, force: true });
  if (previousDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = previousDataDir;
  if (previousFileStorageDir === undefined) delete process.env.FILE_STORAGE_DIR;
  else process.env.FILE_STORAGE_DIR = previousFileStorageDir;
}
