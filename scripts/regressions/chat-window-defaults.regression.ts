// Mode defaults seed only new chats; saved profiles can replace their layout without changing the default.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  getChatWindowDefaultSettingsKey,
  parseChatWindowDefault,
  type ChatMode,
  type ChatWindowDefault,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-chat-window-defaults-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";

const { default: Fastify } = await import("../../packages/server/node_modules/fastify/fastify.js");
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { chatsRoutes } = await import("../../packages/server/src/routes/chats.routes.js");
const { chatPresetsRoutes } = await import("../../packages/server/src/routes/chat-presets.routes.js");
const { appSettingsRoutes } = await import("../../packages/server/src/routes/app-settings.routes.js");
const { createAppSettingsStorage } = await import("../../packages/server/src/services/storage/app-settings.storage.js");
const db = await getDB();
const app = Fastify();
app.decorate("db", db);
await app.register(chatsRoutes, { prefix: "/api/chats" });
await app.register(chatPresetsRoutes, { prefix: "/api/chat-presets" });
await app.register(appSettingsRoutes, { prefix: "/api/app-settings" });

const modes: ChatMode[] = ["conversation", "roleplay", "game"];
const makeLayout = (x: number) => ({
  version: 1,
  windows: { "chat-settings": { x, y: 80, width: 400, height: 500, pinned: true, locked: false } },
  detached: ["drawer:chat-settings:chat-name"],
  bubbles: { "chat-settings": { x, y: 48 } },
  phoneBubbles: { "chat-settings": { x: 30, y: 48 } },
});
const favorite = (mode: ChatMode): ChatWindowDefault => ({
  windowLayout: makeLayout(50 + modes.indexOf(mode) * 100),
  chatSettingsHintDismissed: mode !== "conversation",
});
const settingsUrl = (mode: ChatMode) => `/api/app-settings/${getChatWindowDefaultSettingsKey(mode)}`;
const createChat = async (mode: ChatMode) => {
  const response = await app.inject({
    method: "POST",
    url: "/api/chats",
    payload: { name: `${mode} default layout`, mode, characterIds: [] },
  });
  assert.equal(response.statusCode, 200);
  return response.json().id as string;
};
const metadata = async (id: string) => {
  const response = await app.inject({ method: "GET", url: `/api/chats/${id}` });
  assert.equal(response.statusCode, 200);
  return response.json().metadata as Record<string, unknown>;
};
const readDefault = async (mode: ChatMode) => {
  const response = await app.inject({ method: "GET", url: settingsUrl(mode) });
  assert.equal(response.statusCode, 200);
  return parseChatWindowDefault(response.json().value);
};
const saveDefault = (mode: ChatMode, value: unknown) =>
  app.inject({
    method: "PUT",
    url: settingsUrl(mode),
    payload: { value: JSON.stringify(value) },
  });

try {
  const existing = new Map<ChatMode, string>();
  const seeded = new Map<ChatMode, string>();
  for (const mode of modes) {
    existing.set(mode, await createChat(mode));
    assert.equal((await metadata(existing.get(mode)!)).windowLayout, null);
    const saved = await saveDefault(mode, {
      ...favorite(mode),
      characterIds: ["private-card"],
      authorNote: "private note",
    });
    assert.equal(saved.statusCode, 200);
    assert.deepEqual(JSON.parse(saved.json().value), favorite(mode), "only reusable presentation fields are saved");
    assert.deepEqual(await readDefault(mode), favorite(mode));
  }
  for (const mode of modes) {
    const id = await createChat(mode);
    seeded.set(mode, id);
    const meta = await metadata(id);
    assert.deepEqual(meta.windowLayout, favorite(mode).windowLayout, `${mode} uses only its own mode default`);
    assert.equal(meta.chatSettingsHintDismissed, favorite(mode).chatSettingsHintDismissed);
    assert.equal(meta.authorNote, undefined);
    assert.equal(
      (await metadata(existing.get(mode)!)).windowLayout,
      null,
      "saving a default leaves existing chats alone",
    );
  }

  const profile = await app.inject({
    method: "POST",
    url: "/api/chat-presets",
    payload: { name: "Profile layout", mode: "roleplay" },
  });
  assert.equal(profile.statusCode, 200);
  const profileId = profile.json().id;
  const profileLayout = makeLayout(600);
  const saveProfile = (meta: Record<string, unknown>) =>
    app.inject({
      method: "PUT",
      url: `/api/chat-presets/${profileId}/settings`,
      payload: { metadata: meta },
    });
  const applyProfile = async (id: string) => {
    const response = await app.inject({ method: "POST", url: `/api/chat-presets/${profileId}/apply/${id}` });
    assert.equal(response.statusCode, 200);
  };
  assert.equal((await saveProfile({ windowLayout: profileLayout, chatSettingsHintDismissed: false })).statusCode, 200);
  await applyProfile(seeded.get("roleplay")!);
  assert.deepEqual((await metadata(seeded.get("roleplay")!)).windowLayout, profileLayout, "profile layout wins");
  assert.equal((await metadata(seeded.get("roleplay")!)).chatSettingsHintDismissed, false);
  assert.deepEqual(
    await readDefault("roleplay"),
    favorite("roleplay"),
    "applying a profile does not change the default",
  );

  const legacyTarget = await createChat("roleplay");
  assert.equal((await saveProfile({ enableAgents: false })).statusCode, 200);
  await applyProfile(legacyTarget);
  assert.deepEqual(
    (await metadata(legacyTarget)).windowLayout,
    favorite("roleplay").windowLayout,
    "legacy profiles preserve the seeded layout",
  );
  assert.equal((await saveProfile({ windowLayout: null })).statusCode, 200);
  await applyProfile(legacyTarget);
  assert.equal(
    (await metadata(legacyTarget)).windowLayout,
    null,
    "an explicit profile reset still overrides the default",
  );

  const invalidValues = [
    "{broken",
    "[]",
    "false",
    "{}",
    JSON.stringify({ windowLayout: null, chatSettingsHintDismissed: "true" }),
    JSON.stringify({ windowLayout: { version: 2, windows: {} }, chatSettingsHintDismissed: true }),
    JSON.stringify({ windowLayout: { version: 1, windows: [] }, chatSettingsHintDismissed: true }),
    JSON.stringify({ windowLayout: { version: 1, windows: {}, detached: [42] }, chatSettingsHintDismissed: true }),
  ];
  for (const value of invalidValues) {
    assert.equal(parseChatWindowDefault(value), null);
    const response = await app.inject({ method: "PUT", url: settingsUrl("roleplay"), payload: { value } });
    assert.equal(response.statusCode, 400, "invalid saves are rejected");
    assert.deepEqual(
      await readDefault("roleplay"),
      favorite("roleplay"),
      "invalid saves leave the previous default intact",
    );
  }

  for (const mode of modes) {
    assert.equal((await saveDefault(mode, null)).statusCode, 200);
    assert.equal(await readDefault(mode), null);
    const meta = await metadata(await createChat(mode));
    assert.equal(meta.windowLayout, null, "clearing the default restores future chats' starting layout");
    assert.notEqual(meta.chatSettingsHintDismissed, true);
    assert.deepEqual(
      (await metadata(seeded.get(mode)!)).windowLayout,
      mode === "roleplay" ? profileLayout : favorite(mode).windowLayout,
      "clearing the default does not alter existing chats",
    );
  }
  assert.equal((await saveDefault("game", { windowLayout: null, chatSettingsHintDismissed: true })).statusCode, 200);
  const nullLayout = await metadata(await createChat("game"));
  assert.equal(nullLayout.windowLayout, null);
  assert.equal(nullLayout.chatSettingsHintDismissed, true, "a favorite may deliberately use the starting layout");

  for (const value of invalidValues) {
    await createAppSettingsStorage(db).set(getChatWindowDefaultSettingsKey("conversation"), value);
    assert.equal(
      (await metadata(await createChat("conversation"))).windowLayout,
      null,
      "corrupt stored defaults do not break chat creation",
    );
  }
  assert.equal(
    (await app.inject({ method: "GET", url: "/api/app-settings/chat-window-default-unknown" })).statusCode,
    404,
  );
  console.info("Chat window mode defaults, profile precedence and corrupt-value regressions passed.");
} finally {
  await app.close();
  await closeDB();
  rmSync(dataDir, { recursive: true, force: true });
}
