// A settings profile can hold starting picks: a persona, lorebooks to switch on and a background.
// Applying the profile by hand copies them into the chat; chats that follow the profile never
// receive them, and a profile without picks leaves the chat's persona, lorebooks and background alone.
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
const { saveIntoProfileSettings } = await import("../../packages/client/src/lib/chat-preset-apply.js");
const { createLorebooksStorage } = await import("../../packages/server/src/services/storage/lorebooks.storage.js");

const db = await getDB();
const app = Fastify();
app.decorate("db", db);
await app.register(chatsRoutes, { prefix: "/api/chats" });
await app.register(chatPresetsRoutes, { prefix: "/api/chat-presets" });

try {
  const persona = await createCharactersStorage(db).createPersona("Rowan", "A cartographer");
  assert.ok(persona);
  const books = createLorebooksStorage(db);
  const loreA = (await books.create({ name: "Aeloria" }))!.id;
  const loreB = (await books.create({ name: "Magic" }))!.id;
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
      lorebookIds: [loreA, loreA, loreB, "deleted-lore"],
      metadata: { background: "rainy-tavern.png" },
    },
  });
  assert.equal(profile.settings.personaId, persona.id, "the profile stores its persona pick");
  assert.deepEqual(profile.settings.lorebookIds, [loreA, loreB, "deleted-lore"], "lorebook picks are stored once each");

  // A hand apply copies the picks and keeps the chat's own lorebooks.
  const chatId = await createChat("Elara");
  await inject("PATCH", `/api/chats/${chatId}/metadata`, { activeLorebookIds: ["own-lore"] });
  // The chat plays as a character before the apply; the profile persona must replace that identity.
  const asCharacter = await createCharactersStorage(db).create({ name: "Kestrel", description: "" } as never);
  await inject("PATCH", `/api/chats/${chatId}`, { personaCharacterId: (asCharacter as { id: string }).id });
  await inject("POST", `/api/chat-presets/${profile.id}/apply/${chatId}`);
  const applied = await getChat(chatId);
  assert.equal(applied.personaId, persona.id, "applying copies the persona");
  assert.equal(applied.personaCharacterId ?? null, null, "applying a persona clears the character identity");
  assert.deepEqual(
    applied.metadata.activeLorebookIds,
    ["own-lore", loreA, loreB],
    "lorebooks are added, deleted ones skipped",
  );
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
  await inject("PATCH", `/api/chats/${otherId}/metadata`, { activeLorebookIds: ["kept"], background: "kept.png" });
  await inject("POST", `/api/chat-presets/${plain.id}/apply/${otherId}`);
  const untouched = await getChat(otherId);
  assert.equal(untouched.personaId, persona.id, "an old profile keeps the chat's persona");
  assert.deepEqual(untouched.metadata.activeLorebookIds, ["kept"], "an old profile keeps the chat's lorebooks");
  assert.equal(untouched.metadata.background, "kept.png", "a profile without a background keeps the chat's own");

  // Exports leave the install-local persona and lorebook ids out.
  const exported = await app.inject({ method: "GET", url: `/api/chat-presets/${profile.id}/export` });
  const exportedSettings = exported.json().data.settings;
  assert.equal(exportedSettings.personaId, undefined, "export drops the persona id");
  assert.equal(exportedSettings.lorebookIds, undefined, "export drops the lorebook ids");

  // "Save into profile" takes the chat's background only when the profile has none, and never pulls
  // the chat's persona or lorebooks in.
  const chatSnapshot = { connectionId: "conn", metadata: { background: "chat.png", activeLorebookIds: ["own"] } };
  const noBackground = saveIntoProfileSettings(chatSnapshot, { personaId: "p1", metadata: {} });
  assert.equal(
    noBackground.metadata?.background,
    "chat.png",
    "save into a profile without a background captures the chat's",
  );
  assert.equal(noBackground.personaId, "p1", "save keeps the profile's persona");
  assert.equal(noBackground.lorebookIds, undefined, "save does not pull in the chat's lorebooks");
  const withBackground = saveIntoProfileSettings(chatSnapshot, {
    lorebookIds: ["lb"],
    metadata: { background: "own.png" },
  });
  assert.equal(withBackground.metadata?.background, "own.png", "save keeps the profile's own background");
  assert.deepEqual(withBackground.lorebookIds, ["lb"], "save keeps the profile's lorebooks");

  console.info("Settings profile starting picks passed.");
} finally {
  await app.close();
  await closeDB();
  rmSync(dataDir, { recursive: true, force: true });
}
