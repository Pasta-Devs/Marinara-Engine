import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "marinara-data-integrity-"));
process.env.DATA_DIR = dir;
process.env.FILE_STORAGE_DIR = join(dir, "storage");
process.env.MARINARA_ENV_FILE = join(dir, ".env");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const schema = await import("../../packages/server/src/db/schema/index.js");
const db = await getDB();

const { default: Fastify } = await import("../../packages/server/node_modules/fastify/fastify.js");
const { lorebooksRoutes } = await import("../../packages/server/src/routes/lorebooks.routes.js");
const { createLorebooksStorage } = await import("../../packages/server/src/services/storage/lorebooks.storage.js");
const { createCharactersStorage } = await import("../../packages/server/src/services/storage/characters.storage.js");
const { characterDataSchema } = await import("../../packages/shared/src/index.js");
const { syncCharacterBookFromLorebook } =
  await import("../../packages/server/src/services/lorebook/character-book-sync.js");
function identified<T>(row: T): T & { id: string } {
  assert.ok(row && typeof row === "object" && "id" in row && typeof row.id === "string");
  return row as T & { id: string };
}
const app = Fastify();
app.decorate("db", db);
await app.register(lorebooksRoutes, { prefix: "/api/lorebooks" });
try {
  const books = createLorebooksStorage(db);
  const book = identified(await books.create({ name: "Embedded" }));
  const character = (await createCharactersStorage(db).create(
    characterDataSchema.parse({
      name: "Host",
      character_book: { name: "Embedded", entries: [] },
      extensions: { importMetadata: { embeddedLorebook: { lorebookId: book.id } } },
    }),
  ))!;
  await books.update(book.id, { characterId: character.id });
  const entry = identified(await books.createEntry({ lorebookId: book.id, name: "Fact", content: "Old" }));
  const originalUpdate = db.update;
  db.update = ((table: any) => {
    if (table === schema.characters) throw new Error("injected embedded card write failure");
    return originalUpdate(table);
  }) as typeof db.update;
  let failed;
  try {
    assert.equal(
      (await syncCharacterBookFromLorebook(db, book.id)).status,
      "failed",
      "Mari's default outcome contract remains intact",
    );
    await assert.rejects(syncCharacterBookFromLorebook(db, book.id, { throwOnError: true }), /synchronization failed/);
    failed = await app.inject({
      method: "PATCH",
      url: `/api/lorebooks/${book.id}/entries/${entry.id}`,
      payload: { content: "New" },
    });
  } finally {
    db.update = originalUpdate;
  }
  assert.equal(failed.statusCode, 500, "a failed derived-card write must not produce a success response");
  const destination = identified(await books.create({ name: "Destination" }));
  const beforeTransfer = await db.select().from(schema.lorebookEntries);
  db.update = ((table: any) => {
    if (table === schema.characters) throw new Error("injected move synchronization failure");
    return originalUpdate(table);
  }) as typeof db.update;
  try {
    const moved = await app.inject({
      method: "POST",
      url: `/api/lorebooks/${book.id}/entries/transfer`,
      payload: { operation: "move", entryIds: [entry.id], targetLorebookId: destination.id },
    });
    assert.equal(moved.statusCode, 500);
  } finally {
    db.update = originalUpdate;
  }
  assert.deepEqual(
    await db.select().from(schema.lorebookEntries),
    beforeTransfer,
    "failed move synchronization rolls back both sides",
  );

  const response = await app.inject({
    method: "PATCH",
    url: `/api/lorebooks/${book.id}/entries/${entry.id}`,
    payload: { content: "New" },
  });
  assert.equal(response.statusCode, 200, response.body);
  const saved = await createCharactersStorage(db).getById(character.id);
  assert.equal(JSON.parse(saved!.data).character_book.entries[0].content, "New");
  const { importSTCharacter } = await import("../../packages/server/src/services/import/st-character.importer.js");
  const beforeCharacters = await db.select().from(schema.characters);
  const beforeBooks = await db.select().from(schema.lorebooks);
  let cardWrites = 0;
  db.update = ((table: any) => {
    if (table === schema.characters && ++cardWrites === 2) throw new Error("injected imported-card sync failure");
    return originalUpdate(table);
  }) as typeof db.update;
  try {
    await assert.rejects(
      importSTCharacter(
        {
          spec: "chara_card_v2",
          spec_version: "2.0",
          data: {
            name: "Imported",
            character_book: {
              name: "Facts",
              entries: [
                { keys: ["fact"], content: "Imported fact", enabled: true, insertion_order: 0, extensions: {} },
              ],
            },
          },
        },
        db,
      ),
      /synchronization failed/,
    );
  } finally {
    db.update = originalUpdate;
  }
  assert.deepEqual(
    await db.select().from(schema.characters),
    beforeCharacters,
    "a failed imported-card sync removes its new character",
  );
  assert.deepEqual(
    await db.select().from(schema.lorebooks),
    beforeBooks,
    "a failed imported-card sync removes its new embedded lorebook",
  );
  const standalone = identified(await books.create({ name: "Standalone" }));
  const skipped = await app.inject({
    method: "PATCH",
    url: `/api/lorebooks/${standalone.id}`,
    payload: { name: "Renamed" },
  });
  assert.equal(skipped.statusCode, 200, "standalone lorebooks still skip embedded synchronization");
} finally {
  await app.close();
  await closeDB();
  rmSync(dir, { recursive: true, force: true });
}
