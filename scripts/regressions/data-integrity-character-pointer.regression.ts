import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "marinara-character-pointer-"));
process.env.DATA_DIR = dir;
process.env.FILE_STORAGE_DIR = join(dir, "storage");
process.env.MARINARA_ENV_FILE = join(dir, ".env");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const schema = await import("../../packages/server/src/db/schema/index.js");
const { importSTCharacter } = await import("../../packages/server/src/services/import/st-character.importer.js");
const { createCharactersStorage } = await import("../../packages/server/src/services/storage/characters.storage.js");
const { createLorebooksStorage } = await import("../../packages/server/src/services/storage/lorebooks.storage.js");
const db = await getDB();
const characters = createCharactersStorage(db);
const books = createLorebooksStorage(db);
const card = {
  spec: "chara_card_v2",
  spec_version: "2.0",
  data: {
    name: "Pointer owner",
    character_book: {
      name: "Facts",
      entries: [{ keys: ["fact"], content: "Saved fact", enabled: true, insertion_order: 0, extensions: {} }],
    },
  },
};

async function snapshot() {
  return Promise.all([
    db.select().from(schema.characters),
    db.select().from(schema.characterCardVersions),
    db.select().from(schema.lorebooks),
    db.select().from(schema.lorebookEntries),
    db.select().from(schema.lorebookCharacterLinks),
  ]);
}

try {
  const normal = await importSTCharacter(structuredClone(card), db);
  assert.equal(normal.success, true);
  assert.ok(normal.characterId && normal.lorebook?.lorebookId);
  const saved = JSON.parse((await characters.getById(normal.characterId))!.data);
  assert.equal(saved.extensions.importMetadata.embeddedLorebook.lorebookId, normal.lorebook.lorebookId);
  assert.equal(saved.character_book.entries[0].content, "Saved fact");
  assert.deepEqual((await books.getById(normal.lorebook.lorebookId))!.characterIds, [normal.characterId]);
  assert.equal((await books.listEntries(normal.lorebook.lorebookId)).length, 1);
  console.log("PASS normal character import preserves pointer, link and embedded mirror");

  const before = await snapshot();
  const existingIds = new Set(before[0]!.map((row) => row.id));
  const original = db.transaction;
  let deletedId: string | undefined;
  let admitted = false;
  // Delete through real storage BEFORE the import transaction takes its snapshot.
  // Deleting inside that transaction would incorrectly let rollback resurrect the character.
  db.transaction = (async (operation: Parameters<typeof db.transaction>[0]) => {
    if (!admitted) {
      admitted = true;
      const fresh = (await db.select().from(schema.characters)).find((row) => !existingIds.has(row.id));
      assert.ok(fresh);
      deletedId = fresh.id;
      await characters.remove(deletedId);
      assert.equal(await characters.getById(deletedId), null);
    }
    return original(operation);
  }) as typeof db.transaction;
  let failure: unknown;
  try {
    await importSTCharacter(structuredClone(card), db);
  } catch (error) {
    failure = error;
  } finally {
    db.transaction = original;
  }
  assert.ok(deletedId, "deletion at the transaction admission boundary was reached");
  console.log("Missing-character outcome", {
    rejected: failure instanceof Error,
    characterAbsent: (await characters.getById(deletedId)) === null,
    extraBooks: (await db.select().from(schema.lorebooks)).length - before[2]!.length,
    extraEntries: (await db.select().from(schema.lorebookEntries)).length - before[3]!.length,
  });
  assert.ok(failure instanceof Error && /Character no longer exists/.test(failure.message));
  assert.equal(await characters.getById(deletedId), null, "rollback must not resurrect the deleted character");
  assert.deepEqual(await snapshot(), before, "no new book, entries, links or versions may survive");
  console.log("PASS missing character rejects import without orphan rows or resurrection");
} finally {
  await closeDB();
  rmSync(dir, { recursive: true, force: true });
}
