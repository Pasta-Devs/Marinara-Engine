// A settings profile can hold starting picks: a persona, lorebooks to switch on and a background.
// Applying the profile by hand copies them into the chat; chats that follow the profile never
// receive them, and a profile without picks leaves the chat's persona and lorebooks alone.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-chat-profile-picks-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";

const { default: Fastify } = await import("../../packages/server/node_modules/fastify/fastify.js");
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { chatsRoutes } = await import("../../packages/server/src/routes/chats.routes.js");
const { chatPresetsRoutes } = await import("../../packages/server/src/routes/chat-presets.routes.js");
const { createCharactersStorage } = await import("../../packages/server/src/services/storage/characters.storage.js");

const db = await getDB();
const app = Fastify();
app.decorate("db", db);
await app.register(chatsRoutes, { prefix: "/api/chats" });
await app.register(chatPresetsRoutes, { prefix: "/api/chat-presets" });

try {
  const persona = await createCharactersStorage(db).createPersona("Rowan", "A cartographer");
  assert.ok(persona);
  const inject = async (method: "GET" | "POST" | "PATCH", url: string, payload?: unknown) => {
    const response = await app.inject({ method, url, payload: payload as never });
    assert.ok(response.statusCode < 300, `${method} ${url} -> ${response.statusCode} ${response.body}`);
    return response.json();
  };
  const createChat = async (name: string) =>
    (await inject("POST", "/api/chats", { name, mode: "roleplay", characterIds: [] })).id as string;
  const getChat = async (id: string) => {
    const chat = await inject("GET", `/api/chats/${id}`);
    return { ...chat, metadata: typeof chat.metadata === "string" ? JSON.parse(chat.metadata) : chat.metadata };
  };

  const profile = await inject("POST", "/api/chat-presets", {
    name: "Slow-burn fantasy",
    mode: "roleplay",
    settings: {
      personaId: persona.id,
      lorebookIds: ["lore-a", "lore-a", "lore-b"],
      metadata: { background: "rainy-tavern.png" },
    },
  });
  assert.equal(profile.settings.personaId, persona.id, "the profile stores its persona pick");
  assert.deepEqual(profile.settings.lorebookIds, ["lore-a", "lore-b"], "lorebook picks are stored once each");

  // A hand apply copies the picks and keeps the chat's own lorebooks.
  const chatId = await createChat("Elara");
  await inject("PATCH", `/api/chats/${chatId}/metadata`, { activeLorebookIds: ["own-lore"] });
  await inject("POST", `/api/chat-presets/${profile.id}/apply/${chatId}`);
  const applied = await getChat(chatId);
  assert.equal(applied.personaId, persona.id, "applying copies the persona");
  assert.deepEqual(applied.metadata.activeLorebookIds, ["own-lore", "lore-a", "lore-b"], "lorebooks are added");
  assert.equal(applied.metadata.background, "rainy-tavern.png", "applying copies the background");

  // Not linked: a follower update never pulls the picks back in.
  await inject("PATCH", `/api/chats/${chatId}/metadata`, { activeLorebookIds: [], background: "own.png" });
  await inject("POST", `/api/chat-presets/${profile.id}/apply-to-followers`, { exceptChatId: null });
  const followed = await getChat(chatId);
  assert.deepEqual(followed.metadata.activeLorebookIds, [], "a follower keeps its own lorebooks");
  assert.equal(followed.metadata.background, "own.png", "a follower keeps its own background");

  // A profile without picks behaves as before: persona and lorebooks stay the chat's own.
  const plain = await inject("POST", "/api/chat-presets", { name: "Plain", mode: "roleplay", settings: {} });
  const otherId = await createChat("Kael");
  await inject("PATCH", `/api/chats/${otherId}`, { personaId: persona.id });
  await inject("PATCH", `/api/chats/${otherId}/metadata`, { activeLorebookIds: ["kept"] });
  await inject("POST", `/api/chat-presets/${plain.id}/apply/${otherId}`);
  const untouched = await getChat(otherId);
  assert.equal(untouched.personaId, persona.id, "an old profile keeps the chat's persona");
  assert.deepEqual(untouched.metadata.activeLorebookIds, ["kept"], "an old profile keeps the chat's lorebooks");

  // Exports leave the install-local persona and lorebook ids out.
  const exported = await app.inject({ method: "GET", url: `/api/chat-presets/${profile.id}/export` });
  const exportedSettings = exported.json().data.settings;
  assert.equal(exportedSettings.personaId, undefined, "export drops the persona id");
  assert.equal(exportedSettings.lorebookIds, undefined, "export drops the lorebook ids");

  console.info("Settings profile starting picks passed.");
} finally {
  await app.close();
  await closeDB();
  rmSync(dataDir, { recursive: true, force: true });
}
