// A native lorebook export names characters, personas and chats of the install that made it. On import
// only the ones that exist here are kept, so a "specific chats" lorebook from another install still works.
import assert from "node:assert/strict";
import { characterDataSchema } from "../../packages/shared/dist/index.js";
import { closeDB, getDB } from "../../packages/server/src/db/connection.js";
import { importMarinara } from "../../packages/server/src/services/import/marinara.importer.js";
import { createCharactersStorage } from "../../packages/server/src/services/storage/characters.storage.js";
import { createChatsStorage } from "../../packages/server/src/services/storage/chats.storage.js";
import { createLorebooksStorage } from "../../packages/server/src/services/storage/lorebooks.storage.js";

const db = await getDB();
const characters = createCharactersStorage(db);
const chats = createChatsStorage(db);
const lorebooks = createLorebooksStorage(db);

const importBook = async (lorebook: Record<string, unknown>) => {
  const envelope = {
    type: "marinara_lorebook",
    version: 1,
    exportedAt: new Date().toISOString(),
    data: { lorebook, entries: [{ name: "Fact", content: "Shared fact", keys: ["fact"] }] },
  };
  const result = await importMarinara(envelope as never, db);
  assert.equal(result.success, true, JSON.stringify(result));
  return (await lorebooks.getById(result.id!))!;
};

try {
  const character = (await characters.create(characterDataSchema.parse({ name: "Local owner" })))!;
  const persona = (await characters.createPersona("Local persona", "Here"))!;
  const chat = (await chats.create({
    name: "Local chat",
    mode: "roleplay",
    characterIds: [character.id],
    personaId: null,
    promptPresetId: null,
    connectionId: null,
    groupId: null,
  }))!;

  const foreign = await importBook({
    name: "From another install",
    characterIds: ["foreign-character"],
    characterId: "foreign-character",
    personaIds: ["foreign-persona"],
    chatId: "foreign-chat",
    scope: { mode: "specific", chatIds: ["foreign-chat"] },
  });
  assert.deepEqual(foreign.characterIds, [], "unknown character links are dropped");
  assert.deepEqual(foreign.personaIds, [], "unknown persona links are dropped");
  assert.equal(foreign.chatId, null, "an unknown chat is dropped");
  assert.deepEqual(foreign.scope, { mode: "all", chatIds: [] }, "a scope left with no chats applies to all chats");
  const attached = await lorebooks.listActiveEntries({ activeLorebookIds: [foreign.id], chatId: chat.id });
  assert.ok(
    attached.some((entry) => entry.lorebookId === foreign.id),
    "the imported lorebook works once added to a chat",
  );

  const globalForeign = await importBook({
    name: "Global in a few chats elsewhere",
    isGlobal: true,
    scope: { mode: "specific", chatIds: ["foreign-chat"] },
  });
  assert.equal(globalForeign.isGlobal, false, "a global book whose chats are all gone is imported as non-global");
  const unrelated = await lorebooks.listActiveEntries({ chatId: chat.id, characterIds: [character.id] });
  assert.ok(
    !unrelated.some((entry) => entry.lorebookId === globalForeign.id),
    "so it does not join chats it was never added to",
  );
  const globalHere = await importBook({
    name: "Global in a chat here",
    isGlobal: true,
    scope: { mode: "specific", chatIds: [chat.id] },
  });
  assert.equal(globalHere.isGlobal, true, "a global book that keeps a local chat stays global");

  const restored = await importBook({
    name: "Restored here",
    characterIds: [character.id, "foreign-character"],
    personaId: persona.id,
    chatId: chat.id,
    scope: { mode: "specific", chatIds: ["foreign-chat", chat.id] },
  });
  assert.deepEqual(restored.characterIds, [character.id], "links to rows of this install are kept");
  assert.deepEqual(restored.personaIds, [persona.id]);
  assert.equal(restored.chatId, chat.id);
  assert.deepEqual(restored.scope, { mode: "specific", chatIds: [chat.id] });

  const disabled = await importBook({ name: "Disabled", scope: { mode: "disabled", chatIds: ["foreign-chat"] } });
  assert.deepEqual(disabled.scope, { mode: "disabled", chatIds: [] }, "a disabled scope stays disabled");
} finally {
  await closeDB();
}
