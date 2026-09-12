import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createFileNativeDB } from "../../packages/server/src/db/file-backed-store.js";
import { eq } from "../../packages/server/src/db/file-query.js";
import { characterGroups, characters, chats } from "../../packages/server/src/db/schema/index.js";
import { createCharactersStorage } from "../../packages/server/src/services/storage/characters.storage.js";

// Issue #6084: deleting a character card must remove its id from EVERY chat's member list, not
// only Game chats (#6026 covered those), and from character groups; chats that never held the
// card are left untouched.

const storageRoot = mkdtempSync(join(tmpdir(), "marinara-character-delete-membership-"));
const previousStorageRoot = process.env.FILE_STORAGE_DIR;
process.env.FILE_STORAGE_DIR = storageRoot;

const now = "2026-09-12T00:00:00.000Z";
const characterRow = (id: string) => ({
  id,
  data: JSON.stringify({ name: id }),
  comment: "",
  avatarPath: null,
  spriteFolderPath: null,
  createdAt: now,
  updatedAt: now,
});
const chatRow = (
  id: string,
  mode: "conversation" | "roleplay" | "game",
  memberIds: string[],
  metadata: Record<string, unknown> = {},
) => ({
  id,
  name: id,
  mode,
  characterIds: JSON.stringify(memberIds),
  metadata: JSON.stringify(metadata),
  createdAt: now,
  updatedAt: now,
});
const memberIdsOf = async (db: Awaited<ReturnType<typeof createFileNativeDB>>, id: string) => {
  const [row] = await db.select().from(chats).where(eq(chats.id, id));
  assert.ok(row, `chat ${id} still exists`);
  return {
    ids: JSON.parse(row.characterIds) as string[],
    metadata: JSON.parse(row.metadata) as Record<string, unknown>,
    updatedAt: row.updatedAt,
  };
};

const db = await createFileNativeDB();
try {
  await db.insert(characters).values([characterRow("kept"), characterRow("deleted")]);
  await db.insert(chats).values([
    chatRow("roleplay-both", "roleplay", ["kept", "deleted"]),
    chatRow("conversation-only-deleted", "conversation", ["deleted"]),
    chatRow("game-both", "game", ["kept", "deleted"], {
      gamePartyCharacterIds: ["kept", "deleted"],
      gameSetupConfig: { partyCharacterIds: ["kept", "deleted"], gmCharacterId: "deleted" },
    }),
    chatRow("roleplay-untouched", "roleplay", ["kept"]),
  ]);
  await db.insert(characterGroups).values({
    id: "group-both",
    name: "Group",
    description: "",
    avatarPath: null,
    characterIds: JSON.stringify(["kept", "deleted"]),
    createdAt: now,
    updatedAt: now,
  });

  await createCharactersStorage(db).remove("deleted");

  assert.deepEqual((await memberIdsOf(db, "roleplay-both")).ids, ["kept"], "Roleplay chat drops the deleted card");
  assert.deepEqual(
    (await memberIdsOf(db, "conversation-only-deleted")).ids,
    [],
    "Conversation chat drops the deleted card",
  );

  const game = await memberIdsOf(db, "game-both");
  assert.deepEqual(game.ids, ["kept"], "Game chat drops the deleted card");
  assert.deepEqual(game.metadata.gamePartyCharacterIds, ["kept"], "Game party drops the deleted card");
  const setup = game.metadata.gameSetupConfig as Record<string, unknown>;
  assert.deepEqual(setup.partyCharacterIds, ["kept"], "Game setup party drops the deleted card");
  assert.equal(setup.gmCharacterId, null, "Game setup GM is cleared when it was the deleted card");

  const untouched = await memberIdsOf(db, "roleplay-untouched");
  assert.deepEqual(untouched.ids, ["kept"]);
  assert.equal(untouched.updatedAt, now, "a chat that never held the card is not rewritten");

  const [group] = await db.select().from(characterGroups).where(eq(characterGroups.id, "group-both"));
  assert.deepEqual(JSON.parse(group.characterIds), ["kept"], "character group drops the deleted card");

  const remaining = await db.select().from(characters);
  assert.deepEqual(
    remaining.map((row) => row.id),
    ["kept"],
    "only the deleted card is gone",
  );
  console.log("character-delete-chat-membership: ok");
} finally {
  if (previousStorageRoot === undefined) delete process.env.FILE_STORAGE_DIR;
  else process.env.FILE_STORAGE_DIR = previousStorageRoot;
  rmSync(storageRoot, { recursive: true, force: true });
}
