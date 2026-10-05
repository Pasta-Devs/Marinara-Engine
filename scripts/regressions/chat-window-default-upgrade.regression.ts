// Startup carries the old toolbar forward once, without replacing saved or deliberately cleared defaults.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  getChatWindowDefaultSettingsKey,
  getLegacyChatWindowLayout,
  parseChatWindowDefault,
  type ChatMode,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-window-default-upgrade-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";

const { default: Fastify } = await import("../../packages/server/node_modules/fastify/fastify.js");
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { chats, appSettings } = await import("../../packages/server/src/db/schema/index.js");
const { chatsRoutes } = await import("../../packages/server/src/routes/chats.routes.js");
const { appSettingsRoutes } = await import("../../packages/server/src/routes/app-settings.routes.js");
const { createAppSettingsStorage } = await import("../../packages/server/src/services/storage/app-settings.storage.js");
const { CHAT_WINDOW_DEFAULT_UPGRADE_KEY } =
  await import("../../packages/server/src/services/storage/chat-window-defaults.js");
const db = await getDB();
const settings = createAppSettingsStorage(db);
const modes: ChatMode[] = ["conversation", "roleplay", "game"];
let app = Fastify();
let sequence = 0;

async function resetInstall() {
  await app.close();
  await db.delete(chats);
  await db.delete(appSettings);
}
async function boot() {
  await app.close();
  app = Fastify();
  app.decorate("db", db);
  // Match production ordering: all route registration finishes before requests are served.
  await app.register(chatsRoutes, { prefix: "/api/chats" });
  await app.register(appSettingsRoutes, { prefix: "/api/app-settings" });
  await app.ready();
}
async function seedChat(mode: ChatMode, metadata: unknown, year = 2020) {
  const id = `upgrade-${++sequence}`;
  const timestamp = `${year}-01-01T00:00:00.000Z`;
  await db.insert(chats).values({
    id,
    name: id,
    mode,
    characterIds: "[]",
    metadata: metadata as string,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  return id;
}
async function readDefault(mode: ChatMode) {
  const response = await app.inject({
    method: "GET",
    url: `/api/app-settings/${getChatWindowDefaultSettingsKey(mode)}`,
  });
  assert.equal(response.statusCode, 200);
  return parseChatWindowDefault(response.json().value);
}
async function newChatMetadata(mode: ChatMode) {
  const response = await app.inject({
    method: "POST",
    url: "/api/chats",
    payload: { name: "After startup", mode, characterIds: [] },
  });
  assert.equal(response.statusCode, 200);
  const chat = await app.inject({ method: "GET", url: `/api/chats/${response.json().id}` });
  assert.equal(chat.statusCode, 200);
  return chat.json().metadata as Record<string, unknown>;
}

try {
  // Empty/new installs never gain an upgrade default, even when old chats are imported later.
  await seedChat("conversation", JSON.stringify({ windowLayout: null }));
  await seedChat("roleplay", "{broken");
  await seedChat("game", "[]");
  await boot();
  for (const mode of modes) assert.equal(await readDefault(mode), null);
  assert.equal(await settings.get(CHAT_WINDOW_DEFAULT_UPGRADE_KEY), "1");
  await seedChat("roleplay", JSON.stringify({ enableAgents: true }));
  await boot();
  for (const mode of modes)
    assert.equal(await readDefault(mode), null, "later imports do not turn a fresh install into an upgrade");
  assert.equal((await newChatMetadata("roleplay")).windowLayout, null);

  // Use the newest eligible chat per mode; modes not previously used receive their old defaults too.
  await resetInstall();
  await seedChat("conversation", { enableAgents: false }); // Older stores may already contain parsed metadata.
  await seedChat("roleplay", JSON.stringify({ enableAgents: true }), 2020);
  const representative = { enableAgents: false, chatSettingsHintDismissed: true, chatSettingsMoveTipDismissed: true };
  const legacyId = await seedChat("roleplay", JSON.stringify(representative), 2021);
  await seedChat("roleplay", JSON.stringify({ enableAgents: true, windowLayout: null }), 2022);
  await seedChat("roleplay", JSON.stringify({ enableAgents: true, multiplayer: { sessionId: "shared" } }), 2023);
  await boot();
  for (const mode of modes) {
    const expected = {
      windowLayout: getLegacyChatWindowLayout(mode, mode === "roleplay" ? representative : { enableAgents: true }),
      chatSettingsHintDismissed: mode === "roleplay",
    };
    assert.deepEqual(await readDefault(mode), expected, `${mode} keeps the old toolbar for future chats`);
    const metadata = await newChatMetadata(mode);
    assert.deepEqual(metadata.windowLayout, expected.windowLayout);
    assert.equal(metadata.chatSettingsHintDismissed, expected.chatSettingsHintDismissed);
    assert.equal(metadata.chatSettingsMoveTipDismissed, undefined, "the global launcher hint is never copied");
  }
  const legacyResponse = await app.inject({ method: "GET", url: `/api/chats/${legacyId}` });
  assert.equal(
    Object.hasOwn(legacyResponse.json().metadata, "windowLayout"),
    false,
    "startup does not rewrite old chats",
  );
  const conversationDefault = await readDefault("conversation");
  const cleared = await app.inject({
    method: "PUT",
    url: `/api/app-settings/${getChatWindowDefaultSettingsKey("roleplay")}`,
    payload: { value: "null" },
  });
  assert.equal(cleared.statusCode, 200);
  await seedChat("roleplay", JSON.stringify({ enableAgents: true }), 2024);
  await boot();
  assert.equal(await readDefault("roleplay"), null, "manual clear is not reversed on restart");
  assert.deepEqual(await readDefault("conversation"), conversationDefault);
  assert.equal((await newChatMetadata("roleplay")).windowLayout, null);

  // Existing favorites, deliberately cleared values, and even corrupt saved values are not overwritten.
  await resetInstall();
  await seedChat("roleplay", JSON.stringify({ enableAgents: true }));
  const saved = JSON.stringify({ windowLayout: null, chatSettingsHintDismissed: true });
  await settings.set(getChatWindowDefaultSettingsKey("conversation"), saved);
  await settings.set(getChatWindowDefaultSettingsKey("roleplay"), "null");
  await settings.set(getChatWindowDefaultSettingsKey("game"), "{do-not-replace");
  await boot();
  assert.equal(await settings.get(getChatWindowDefaultSettingsKey("conversation")), saved);
  assert.equal(await settings.get(getChatWindowDefaultSettingsKey("roleplay")), "null");
  assert.equal(await settings.get(getChatWindowDefaultSettingsKey("game")), "{do-not-replace");

  // Shared sessions alone do not mark a private-chat upgrade.
  await resetInstall();
  await seedChat("roleplay", JSON.stringify({ multiplayer: { sessionId: "shared" } }));
  await seedChat("game", JSON.stringify({ multiplayerSetup: true }));
  await boot();
  for (const mode of modes) assert.equal(await readDefault(mode), null);
  assert.equal(await settings.get(CHAT_WINDOW_DEFAULT_UPGRADE_KEY), "1");
  console.info("Chat window upgrade defaults, fresh installs, restart and saved-choice regressions passed.");
} finally {
  await app.close();
  await closeDB();
  rmSync(dataDir, { recursive: true, force: true });
}
