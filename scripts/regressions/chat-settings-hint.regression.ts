// Chat Settings tips are chat-local presentation state and travel with settings profiles.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-chat-settings-hint-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";

const { default: Fastify } = await import("../../packages/server/node_modules/fastify/fastify.js");
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { chatsRoutes } = await import("../../packages/server/src/routes/chats.routes.js");
const { chatPresetsRoutes } = await import("../../packages/server/src/routes/chat-presets.routes.js");
const app = Fastify();
app.decorate("db", await getDB());
await app.register(chatsRoutes, { prefix: "/api/chats" });
await app.register(chatPresetsRoutes, { prefix: "/api/chat-presets" });

try {
  const createChat = async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/chats",
      payload: { name: "Hint persistence", mode: "roleplay", characterIds: [] },
    });
    assert.equal(response.statusCode, 200);
    return response.json().id as string;
  };
  const metadata = async (chatId: string) => {
    const response = await app.inject({ method: "GET", url: `/api/chats/${chatId}` });
    assert.equal(response.statusCode, 200);
    return response.json().metadata as Record<string, unknown>;
  };
  const firstChat = await createChat();
  assert.notEqual((await metadata(firstChat)).chatSettingsHintDismissed, true);
  const dismissed = await app.inject({
    method: "PATCH",
    url: `/api/chats/${firstChat}/metadata`,
    payload: { chatSettingsHintDismissed: true },
  });
  assert.equal(dismissed.statusCode, 200);
  assert.equal((await metadata(firstChat)).chatSettingsHintDismissed, true, "dismissal survives a fresh read");
  const secondChat = await createChat();
  assert.notEqual((await metadata(secondChat)).chatSettingsHintDismissed, true, "new chats still show tips");

  const profile = await app.inject({
    method: "POST",
    url: "/api/chat-presets",
    payload: { name: "Hidden tips", mode: "roleplay" },
  });
  assert.equal(profile.statusCode, 200);
  const profileId = profile.json().id;
  const saved = await app.inject({
    method: "PUT",
    url: `/api/chat-presets/${profileId}/settings`,
    payload: { metadata: await metadata(firstChat) },
  });
  assert.equal(saved.statusCode, 200);
  assert.equal(saved.json().settings.metadata.chatSettingsHintDismissed, true, "profile snapshots retain dismissal");
  const exported = await app.inject({ method: "GET", url: `/api/chat-presets/${profileId}/export` });
  assert.equal(exported.statusCode, 200);
  const imported = await app.inject({ method: "POST", url: "/api/chat-presets/import", payload: exported.json() });
  assert.equal(imported.statusCode, 200);
  assert.equal(imported.json().settings.metadata.chatSettingsHintDismissed, true, "export/import retains dismissal");
  const apply = async (id: string) => {
    const response = await app.inject({ method: "POST", url: `/api/chat-presets/${id}/apply/${secondChat}` });
    assert.equal(response.statusCode, 200);
  };
  await apply(imported.json().id);
  assert.equal(
    (await metadata(secondChat)).chatSettingsHintDismissed,
    true,
    "an applied profile can hide new-chat tips",
  );

  const legacy = await app.inject({
    method: "POST",
    url: "/api/chat-presets/import",
    payload: {
      type: "marinara_chat_preset",
      data: { name: "Legacy profile", mode: "roleplay", settings: { metadata: { enableAgents: false } } },
    },
  });
  assert.equal(legacy.statusCode, 200);
  await apply(legacy.json().id);
  assert.equal((await metadata(secondChat)).chatSettingsHintDismissed, false, "older profiles show tips by default");
  await apply(imported.json().id);
  const profiles = await app.inject({ method: "GET", url: "/api/chat-presets?mode=roleplay" });
  const defaultProfile = profiles.json().find((entry: { isDefault: boolean }) => entry.isDefault);
  assert.ok(defaultProfile);
  await apply(defaultProfile.id);
  assert.equal((await metadata(secondChat)).chatSettingsHintDismissed, false, "Default restores tips");
  assert.equal((await metadata(firstChat)).chatSettingsHintDismissed, true, "other chats retain their dismissal");

  const invalid = await app.inject({
    method: "PUT",
    url: `/api/chat-presets/${profileId}/settings`,
    payload: { metadata: { chatSettingsHintDismissed: "true" } },
  });
  assert.equal(invalid.statusCode, 200);
  assert.equal(invalid.json().settings.metadata.chatSettingsHintDismissed, false, "only a boolean true dismisses tips");
  console.info("Chat Settings hint persistence and profile regressions passed.");
} finally {
  await app.close();
  await closeDB();
  rmSync(dataDir, { recursive: true, force: true });
}
