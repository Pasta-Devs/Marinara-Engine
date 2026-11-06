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
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");

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

  // A profile persona switches who the user plays as Chat Settings does: earlier messages keep the identity they
  // were sent as, and a started chat is told about the change once.
  const startedId = await createChat("Started");
  await inject("POST", `/api/chats/${startedId}/messages`, { role: "user", content: "Hello there." });
  await inject("POST", `/api/chat-presets/${profile.id}/apply/${startedId}`);
  await inject("POST", `/api/chat-presets/${profile.id}/apply/${startedId}`);
  const history = await createChatsStorage(db).listMessages(startedId);
  const extraOf = (extra: unknown) => (typeof extra === "string" ? JSON.parse(extra) : (extra ?? {}));
  assert.equal(
    extraOf(history.find((message) => message.role === "user")!.extra).personaSnapshot?.name,
    "You",
    "a message sent before the switch keeps the identity it was sent as",
  );
  assert.deepEqual(
    history.filter((message) => message.role === "system").map((message) => message.content),
    ["You are now playing as Rowan."],
    "the switch is announced once",
  );
  // Chat Settings (a persona PATCH) keeps doing the same.
  const patchedId = await createChat("Patched");
  await inject("POST", `/api/chats/${patchedId}/messages`, { role: "user", content: "Hi." });
  await inject("PATCH", `/api/chats/${patchedId}`, { personaId: persona.id });
  const patchedHistory = await createChatsStorage(db).listMessages(patchedId);
  assert.equal(extraOf(patchedHistory.find((message) => message.role === "user")!.extra).personaSnapshot?.name, "You");
  assert.deepEqual(
    patchedHistory.filter((message) => message.role === "system").map((message) => message.content),
    ["You are now playing as Rowan."],
  );
  // A PATCH that names one identity field clears the other on the row storage.update writes. The back-fill and the
  // turn must follow that row: a target that kept the omitted field's saved value would see a persona-only PATCH on a
  // chat played as a character as no change (the character wins when both are set) and skip both.
  const { resolveChatUserIdentity } = await import("../../packages/server/src/services/chat-user-identity.js");
  const savedIdentity = async (id: string) => {
    const row = (await createChatsStorage(db).getById(id))!;
    const identity = await resolveChatUserIdentity(createCharactersStorage(db), row);
    return {
      row: { personaId: row.personaId ?? null, personaCharacterId: row.personaCharacterId ?? null },
      identity: identity && { source: identity.source, name: identity.name },
    };
  };
  const pairedSwitch = async (saved: object, patch: object) => {
    const id = await createChat("Paired switch");
    await inject("PATCH", `/api/chats/${id}`, saved);
    const before = await savedIdentity(id);
    // Saved without a snapshot, so the one it ends up with is the switch's back-fill.
    await createChatsStorage(db).createMessage({ chatId: id, role: "user", characterId: null, content: "Before." });
    await inject("PATCH", `/api/chats/${id}`, patch);
    const after = await savedIdentity(id);
    const history = await createChatsStorage(db).listMessages(id);
    const snapshot = extraOf(history.find((message) => message.role === "user")!.extra).personaSnapshot;
    assert.deepEqual(
      snapshot ? { source: snapshot.source, name: snapshot.name } : null,
      before.identity,
      "the earlier message keeps the identity of the row saved before the write",
    );
    assert.deepEqual(
      history
        .filter((message) => message.role === "system")
        .map((message) => ({ content: message.content, event: extraOf(message.extra).identityTransitionEvent })),
      [
        {
          content: `You are now playing as ${after.identity?.name}.`,
          event: { from: before.identity?.name, to: after.identity?.name, source: after.identity?.source },
        },
      ],
      "the turn announces the identity of the row read back after the write",
    );
    return { row: after.row, from: before.identity, to: after.identity };
  };
  const characterId = (asCharacter as { id: string }).id;
  assert.deepEqual(
    await pairedSwitch({ personaId: persona.id }, { personaCharacterId: characterId }),
    {
      row: { personaId: null, personaCharacterId: characterId },
      from: { source: "persona", name: "Rowan" },
      to: { source: "character", name: "Kestrel" },
    },
    "a character-only PATCH clears the persona, and the switch follows that row",
  );
  assert.deepEqual(
    await pairedSwitch({ personaCharacterId: characterId }, { personaId: persona.id }),
    {
      row: { personaId: persona.id, personaCharacterId: null },
      from: { source: "character", name: "Kestrel" },
      to: { source: "persona", name: "Rowan" },
    },
    "a persona-only PATCH clears the character, and the switch follows that row",
  );
  // Quick setup: a persona picked over the profile's stays, and the greeting-only chat hears of no other persona.
  const picked = await createCharactersStorage(db).createPersona("Wren", "A courier");
  const greetedId = await createChat("Greeted");
  await inject("POST", `/api/chats/${greetedId}/messages`, { role: "assistant", content: "Welcome, traveller." });
  await inject("PATCH", `/api/chats/${greetedId}`, { personaId: picked!.id });
  const turnsOf = async (id: string) =>
    (await createChatsStorage(db).listMessages(id)).filter((message) => message.role === "system").length;
  const turnsBefore = await turnsOf(greetedId);
  await inject("POST", `/api/chat-presets/${profile.id}/apply/${greetedId}`, { keepPersona: true });
  assert.equal((await getChat(greetedId)).personaId, picked!.id, "the picked persona stays");
  assert.equal(await turnsOf(greetedId), turnsBefore, "no turn names the profile's persona");

  // A switch whose back-fill fails part way keeps the previous persona saved, so its retry back-fills the rest:
  // every earlier user message keeps the previous persona, through Chat Settings and through a profile.
  const { messages: messageTable } = await import("../../packages/server/src/db/schema/index.js");
  const realUpdate = db.update;
  const retriedSwitch = async (chatId: string, method: "PATCH" | "POST", url: string, payload: object) => {
    const personaBefore = (await getChat(chatId)).personaId ?? null;
    // Messages saved before persona snapshots existed carry none.
    for (const content of ["First.", "Second."]) {
      await createChatsStorage(db).createMessage({ chatId, role: "user", characterId: null, content });
    }
    let messageWrites = 0;
    db.update = ((table: Parameters<typeof db.update>[0]) => {
      if (table === messageTable && ++messageWrites === 2) throw new Error("injected message write failure");
      return realUpdate(table);
    }) as typeof db.update;
    try {
      const failed = await app.inject({ method, url, payload: payload as never });
      assert.equal(failed.statusCode, 500, "the back-fill fails on the second message");
    } finally {
      db.update = realUpdate;
    }
    assert.equal((await getChat(chatId)).personaId ?? null, personaBefore, "a failed back-fill saves no new persona");
    await inject(method, url, payload);
    const after = await createChatsStorage(db).listMessages(chatId);
    return {
      snapshots: after.filter((m) => m.role === "user").map((m) => extraOf(m.extra).personaSnapshot?.name ?? null),
      turns: after.filter((m) => m.role === "system").map((m) => m.content),
    };
  };
  const patchRetryId = await createChat("Patch retry");
  assert.deepEqual(
    await retriedSwitch(patchRetryId, "PATCH", `/api/chats/${patchRetryId}`, { personaId: persona.id }),
    { snapshots: ["You", "You"], turns: ["You are now playing as Rowan."] },
    "a retried Chat Settings switch keeps the previous persona on every earlier message",
  );
  const applyRetryId = await createChat("Apply retry");
  await inject("PATCH", `/api/chats/${applyRetryId}`, { personaId: picked!.id });
  assert.deepEqual(
    await retriedSwitch(applyRetryId, "POST", `/api/chat-presets/${profile.id}/apply/${applyRetryId}`, {}),
    { snapshots: ["Wren", "Wren"], turns: ["You are now playing as Rowan."] },
    "a retried profile apply keeps the previous persona on every earlier message",
  );
  assert.equal((await getChat(applyRetryId)).personaId, persona.id, "the retried apply switches the persona");

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
