import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DB } from "../../packages/server/src/db/connection.js";

const fixtureRoot = mkdtempSync(join(tmpdir(), "marinara-st-group-import-"));
const dataDir = join(fixtureRoot, "data", "default-user");
const storageDir = join(fixtureRoot, "storage");
process.env.DATA_DIR = join(fixtureRoot, "marinara-data");
process.env.FILE_STORAGE_DIR = storageDir;
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";

let db: DB | null = null;

try {
  mkdirSync(join(dataDir, "characters"), { recursive: true });
  mkdirSync(join(dataDir, "groups"), { recursive: true });
  mkdirSync(join(dataDir, "group chats"), { recursive: true });

  const characterCard = (name: string) => ({
    spec: "chara_card_v2",
    spec_version: "2.0",
    data: { name, description: "", personality: "", scenario: "", first_mes: "", mes_example: "" },
  });
  writeFileSync(join(dataDir, "characters", "Doctor_Dottore.json"), JSON.stringify(characterCard("Il Dottore")));
  writeFileSync(join(dataDir, "characters", "Professor_Mari.json"), JSON.stringify(characterCard("Professor Mari")));
  writeFileSync(
    join(dataDir, "groups", "lab-group.JSON"),
    JSON.stringify({
      id: "lab-group",
      name: "The Laboratory",
      members: ["Doctor_Dottore.png", "Professor_Mari.png"],
      chat_id: "current-chat",
      chats: ["past-chat", "current-chat"],
    }),
  );
  writeFileSync(
    join(dataDir, "group chats", "current-chat.JSONL"),
    [
      { user_name: "unused", character_name: "unused", chat_metadata: {} },
      { name: "Mari", is_user: true, mes: "Begin the experiment." },
      {
        name: "The Doctor",
        original_avatar: "Doctor_Dottore.png",
        is_user: false,
        mes: "Naturally.",
      },
    ]
      .map((line) => JSON.stringify(line))
      .join("\n"),
  );
  writeFileSync(
    join(dataDir, "group chats", "past-chat.jsonl"),
    [
      { user_name: "unused", character_name: "unused", chat_metadata: {} },
      {
        name: "Professor Mari",
        is_user: false,
        mes: "I have the notes.",
      },
    ]
      .map((line) => JSON.stringify(line))
      .join("\n"),
  );

  const { createFileNativeDB } = await import("../../packages/server/src/db/file-backed-store.js");
  const { chats, characters, messages } = await import("../../packages/server/src/db/schema/index.js");
  const { scanSTFolder, runSTBulkImport } =
    await import("../../packages/server/src/services/import/st-bulk.importer.js");
  db = await createFileNativeDB();

  const scan = await scanSTFolder(fixtureRoot);
  assert.equal(scan.groupChats.length, 2);
  for (const groupChat of scan.groupChats) {
    assert.equal(groupChat.groupName, "The Laboratory");
    assert.deepEqual(groupChat.members, ["Doctor_Dottore", "Professor_Mari"]);
  }

  const result = await runSTBulkImport(
    fixtureRoot,
    {
      characters: true,
      chats: false,
      groupChats: true,
      presets: false,
      lorebooks: false,
      backgrounds: false,
      personas: false,
    },
    db,
  );
  assert.equal(result.success, true);
  assert.deepEqual(result.errors, []);
  assert.equal(result.imported.groupChats, 2);

  const importedCharacters = await db.select().from(characters);
  const characterIdsByName = new Map(
    importedCharacters.map((character) => [JSON.parse(character.data).name as string, character.id]),
  );
  const importedChats = await db.select().from(chats);
  assert.equal(importedChats.length, 2);
  assert.equal(new Set(importedChats.map((chat) => chat.groupId)).size, 1);
  for (const importedChat of importedChats) {
    assert.deepEqual(new Set(JSON.parse(importedChat.characterIds)), new Set(characterIdsByName.values()));
  }

  const importedMessages = new Map((await db.select().from(messages)).map((message) => [message.content, message]));
  assert.equal(importedMessages.get("Begin the experiment.")?.role, "user");
  assert.equal(importedMessages.get("Begin the experiment.")?.characterId, null);
  assert.equal(importedMessages.get("Naturally.")?.characterId, characterIdsByName.get("Il Dottore"));
  assert.equal(importedMessages.get("I have the notes.")?.characterId, characterIdsByName.get("Professor Mari"));
} finally {
  await db?._fileStore.close();
  rmSync(fixtureRoot, { recursive: true, force: true });
}

console.log("SillyTavern group import regression checks passed.");
