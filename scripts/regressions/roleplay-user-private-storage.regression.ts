import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "marinara-user-private-storage-"));
process.env.DATA_DIR = dir;
process.env.FILE_STORAGE_DIR = join(dir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createCharactersStorage } = await import("../../packages/server/src/services/storage/characters.storage.js");
const { characterDataSchema, getRoleplayCommandActivity, getRoleplayWhispers } =
  await import("../../packages/shared/dist/index.js");
const extra = (row: { extra: string | null }) => JSON.parse(row.extra ?? "{}");
let db = await getDB();
let chats = createChatsStorage(db);

try {
  const characters = createCharactersStorage(db);
  const alice = await characters.create(characterDataSchema.parse({ name: "Alice" }));
  const bob = await characters.create(characterDataSchema.parse({ name: "Bob" }));
  const narrator = await characters.create(characterDataSchema.parse({ name: "Narrator" }));
  assert(alice && bob && narrator);
  const chat = await chats.create({
    name: "Private user storage",
    mode: "roleplay",
    characterIds: [alice.id, bob.id, narrator.id],
  });
  assert(chat);
  await chats.patchMetadata(chat.id, {
    roleplayCommandsEnabled: true,
    roleplayCommandToggles: { whisper: true, notes: true },
    roleplayCommandNarratorId: narrator.id,
    groupChatMode: "individual",
  });
  const literal = await chats.createMessage({
    chatId: chat.id,
    role: "user",
    content: "An ordinary unfinished bracket [n",
  });
  assert.equal(literal?.content, "An ordinary unfinished bracket [n");
  assert.equal(getRoleplayCommandActivity(extra(literal!)).length, 0);
  const secret = "BOB_SECRET <thought> & ordinary prose";
  const original = await chats.createMessage({
    chatId: chat.id,
    role: "user",
    content: `Before. [whisper: character="Bob" text="${secret}"] After. [notes: content="USER_NOTE"]`,
    extra: { bookmark: true },
  });
  assert(original);
  assert.equal(original.content, "Before.  After. ");
  assert.equal(extra(original).bookmark, true);
  assert.equal(getRoleplayCommandActivity(extra(original)).length, 2);
  assert.deepEqual(getRoleplayWhispers(extra(original))[0]?.recipient, { id: bob.id, kind: "character" });
  assert.equal(getRoleplayWhispers(extra(original))[0]?.command.text, secret, "private leaves stay verbatim");
  const firstSwipe = (await chats.getSwipes(original.id))[0]!;
  assert.equal(firstSwipe.content, original.content);
  assert.deepEqual(getRoleplayCommandActivity(extra(firstSwipe)), getRoleplayCommandActivity(extra(original)));

  await characters.update(bob.id, { name: "Renamed Bob" });
  const edited = await chats.updateMessageContent(original.id, "Public text edited.");
  assert(edited);
  assert.equal(getRoleplayWhispers(extra(edited))[0]?.recipient.id, bob.id, "body edits never re-resolve old names");
  assert.equal(getRoleplayCommandActivity(extra(edited)).length, 2);
  const withNote = await chats.updateMessageContent(original.id, 'Public text edited. [notes: content="NEW_NOTE"]');
  assert(withNote);
  assert.equal(withNote.content, "Public text edited. ");
  assert.equal(getRoleplayCommandActivity(extra(withNote)).length, 3);

  const next = await chats.addSwipe(original.id, 'Alternate. [whisper: character="Alice" text="ALICE_SECRET"]');
  const alternate = await chats.getMessage(original.id);
  assert(alternate);
  assert.equal(alternate.content, "Alternate. ");
  assert.equal(getRoleplayWhispers(extra(alternate))[0]?.recipient.id, alice.id);
  assert.equal(
    getRoleplayCommandActivity(extra(alternate)).length,
    1,
    "fresh swipes do not inherit private activities",
  );
  const firstActivities = getRoleplayCommandActivity(extra(withNote));
  const first = firstActivities[0]!;
  assert.equal(first.command.type, "whisper");
  if (first.command.type === "whisper") first.command.text = "EDITED_BOB_SECRET";
  await chats.updateMessageExtraForSwipe(original.id, 0, { roleplayCommandActivity: firstActivities });
  assert.equal((await chats.getMessage(original.id))!.activeSwipeIndex, next.index);
  assert.equal(getRoleplayWhispers(extra((await chats.getMessage(original.id))!))[0]?.command.text, "ALICE_SECRET");
  const selected = await chats.setActiveSwipe(original.id, 0);
  assert(selected);
  assert.equal(getRoleplayWhispers(extra(selected))[0]?.command.text, "EDITED_BOB_SECRET");
  assert.equal(getRoleplayWhispers(extra(selected))[0]?.recipient.id, bob.id);

  const [savedImport, rawImport] = await chats.createMessagesBatch(chat.id, [
    { role: "user", content: selected.content, extra: extra(selected) },
    {
      role: "user",
      content: 'Imported. [whisper: character="Renamed Bob" text="IMPORTED_SECRET"]',
      activeSwipeIndex: 1,
      swipes: [
        { index: 0, content: 'Older. [notes: content="OLD_IMPORT_NOTE"]' },
        { index: 1, content: 'Imported. [whisper: character="Renamed Bob" text="IMPORTED_SECRET"]' },
      ],
    },
  ]);
  assert(savedImport && rawImport);
  const saved = (await chats.getMessage(savedImport))!;
  assert.equal(getRoleplayWhispers(extra(saved))[0]?.recipient.id, bob.id);
  assert.equal(getRoleplayWhispers(extra((await chats.getSwipes(savedImport))[0]!))[0]?.recipient.id, bob.id);
  const imported = (await chats.getMessage(rawImport))!;
  assert.equal(imported.content, "Imported. ");
  assert.equal(getRoleplayWhispers(extra(imported))[0]?.recipient.id, bob.id);
  const importedSwipes = await chats.getSwipes(rawImport);
  assert.deepEqual(
    importedSwipes.map((swipe) => swipe.content),
    ["Older. ", "Imported. "],
  );
  assert.equal(getRoleplayCommandActivity(extra(importedSwipes[0]!))[0]?.command.type, "notes");
  assert.equal(getRoleplayWhispers(extra(importedSwipes[1]!))[0]?.command.text, "IMPORTED_SECRET");

  await chats.patchMetadata(chat.id, { roleplayCommandsEnabled: false, inactiveCharacterIds: [bob.id] });
  const retained = await chats.updateMessageContent(original.id, "Still public.");
  assert(retained);
  assert.equal(getRoleplayWhispers(extra(retained))[0]?.command.text, "EDITED_BOB_SECRET");
  assert.equal(getRoleplayCommandActivity(extra(retained)).length, 3, "settings never erase private history");
  const disabled = await chats.createMessage({
    chatId: chat.id,
    role: "user",
    content: '[notes: content="DISABLED_SECRET"]',
  });
  assert(disabled);
  assert(!disabled.content.includes("DISABLED_SECRET"), "disabled private commands cannot become public prose");
  assert(getRoleplayCommandActivity(extra(disabled))[0]?.error);

  for (const mode of ["conversation", "game"] as const) {
    const other = await chats.create({ name: mode, mode, characterIds: [] });
    assert(other);
    const content = '[notes: content="literal outside Roleplay"]';
    const message = await chats.createMessage({ chatId: other.id, role: "user", content });
    assert.equal(message?.content, content);
  }
  const assistant = await chats.createMessage({
    chatId: chat.id,
    role: "assistant",
    content: "Assistant public body.",
  });
  assert.equal(assistant?.content, "Assistant public body.");
  await closeDB();
  db = await getDB();
  chats = createChatsStorage(db);
  const reloaded = await chats.getMessage(original.id);
  assert(reloaded);
  assert.equal(reloaded.content, "Still public.");
  assert.equal(getRoleplayWhispers(extra(reloaded))[0]?.command.text, "EDITED_BOB_SECRET");
  assert.deepEqual(
    getRoleplayCommandActivity(extra((await chats.getSwipes(original.id))[0]!)),
    getRoleplayCommandActivity(extra(reloaded)),
  );
  console.log(
    "User Roleplay private commands: durable create/edit/swipe/import, stable recipients and disabled-state retention passed.",
  );
} finally {
  await closeDB();
  rmSync(dir, { recursive: true, force: true });
}
