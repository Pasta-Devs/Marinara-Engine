import assert from "node:assert/strict";
import Fastify from "../../packages/server/node_modules/fastify/fastify.js";
import { characterDataSchema } from "../../packages/shared/dist/index.js";
import { closeDB, getDB } from "../../packages/server/src/db/connection.js";
import { eq } from "../../packages/server/src/db/file-query.js";
import { lorebookCharacterLinks } from "../../packages/server/src/db/schema/index.js";
import { charactersRoutes } from "../../packages/server/src/routes/characters.routes.js";
import { embedLorebookIntoCharacter } from "../../packages/server/src/services/lorebook/character-book-sync.js";
import { createCharactersStorage } from "../../packages/server/src/services/storage/characters.storage.js";
import { createLorebooksStorage } from "../../packages/server/src/services/storage/lorebooks.storage.js";

const db = await getDB();
const characters = createCharactersStorage(db);
const lorebooks = createLorebooksStorage(db);
const app = Fastify();
app.decorate("db", db);
await app.register(charactersRoutes, { prefix: "/api/characters" });
try {
  const character = (await characters.create(characterDataSchema.parse({ name: "Reimport owner" })))!;
  const book = (await lorebooks.create({ name: "Embedded lore", characterIds: [character.id] }))!;
  const original = (await lorebooks.createEntry({ lorebookId: book.id, name: "Fact", content: "Embedded fact" }))!;
  await embedLorebookIntoCharacter(db, character.id, book.id);
  await lorebooks.update(book.id, { characterIds: [] });
  assert.deepEqual((await lorebooks.getById(book.id))!.characterIds, []);

  const response = await app.inject({
    method: "POST",
    url: `/api/characters/${character.id}/embedded-lorebook/import`,
  });
  assert.equal(response.statusCode, 200, response.body);
  assert.equal(response.json().reimported, true);
  assert.equal(response.json().lorebookId, book.id);
  const restored = (await lorebooks.getById(book.id))!;
  assert.deepEqual(restored.characterIds, [character.id], "reimport restores the character link");
  assert.equal(restored.characterId, character.id, "legacy link matches the restored character");
  assert.equal(restored.generatedBy, "import", "reimport keeps the existing importer provenance behavior");
  const entries = await lorebooks.listEntries(book.id);
  assert.equal(entries.length, 1);
  assert.notEqual(entries[0]!.id, original.id, "reimport replaces the original entries");
  assert.equal(entries[0]!.content, "Embedded fact");

  const other = (await characters.create(characterDataSchema.parse({ name: "Other linked character" })))!;
  for (const legacyOnly of [false, true]) {
    await lorebooks.update(book.id, { characterIds: legacyOnly ? [other.id] : [character.id, other.id] });
    if (legacyOnly) {
      await db.delete(lorebookCharacterLinks).where(eq(lorebookCharacterLinks.lorebookId, book.id));
    }
    const sharedReimport = await app.inject({
      method: "POST",
      url: `/api/characters/${character.id}/embedded-lorebook/import`,
    });
    assert.equal(sharedReimport.statusCode, 200, sharedReimport.body);
    assert.deepEqual(
      new Set((await lorebooks.getById(book.id))!.characterIds),
      new Set([character.id, other.id]),
      `reimport restores its owner without removing an existing ${legacyOnly ? "legacy" : "shared"} link`,
    );
  }

  // The card book's own settings carry over on import, and a reimport keeps the user's lorebook settings.
  const tuned = (await characters.create(
    characterDataSchema.parse({
      name: "Alice",
      character_book: {
        name: "Alice World",
        description: "Card author book description",
        scan_depth: 6,
        token_budget: 4096,
        recursive_scanning: true,
        entries: [{ keys: ["alice"], content: "Alice fact" }],
      },
    }),
  ))!;
  const tunedImport = await app.inject({ method: "POST", url: `/api/characters/${tuned.id}/embedded-lorebook/import` });
  assert.equal(tunedImport.statusCode, 200, tunedImport.body);
  const tunedId = tunedImport.json().lorebookId as string;
  const expectSettings = async (label: string) => {
    const lorebook = (await lorebooks.getById(tunedId))!;
    assert.equal(lorebook.description, "Card author book description", `${label}: description`);
    assert.equal(lorebook.scanDepth, 6, `${label}: scan depth`);
    assert.equal(lorebook.tokenBudget, 4096, `${label}: token budget`);
    assert.equal(lorebook.recursiveScanning, true, `${label}: recursion`);
    const cardBook = JSON.parse((await characters.getById(tuned.id))!.data).character_book;
    assert.equal(cardBook.description, "Card author book description", `${label}: card description`);
    assert.equal(cardBook.scan_depth, 6, `${label}: card scan depth`);
    assert.equal(cardBook.token_budget, 4096, `${label}: card token budget`);
    assert.equal(cardBook.recursive_scanning, true, `${label}: card recursion`);
    return lorebook;
  };
  await expectSettings("import");
  await lorebooks.update(tunedId, { name: "My renamed book", category: "character", maxRecursionDepth: 5 });
  const tunedReimport = await app.inject({
    method: "POST",
    url: `/api/characters/${tuned.id}/embedded-lorebook/import`,
  });
  assert.equal(tunedReimport.statusCode, 200, tunedReimport.body);
  assert.equal(tunedReimport.json().reimported, true);
  const afterReimport = await expectSettings("reimport");
  assert.equal(afterReimport.name, "My renamed book", "reimport keeps the user's lorebook name");
  assert.equal(afterReimport.category, "character", "reimport keeps the user's category");
  assert.equal(afterReimport.maxRecursionDepth, 5, "reimport keeps a setting the card book does not carry");
} finally {
  await app.close();
  await closeDB();
}
