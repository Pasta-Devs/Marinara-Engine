// A card's embedded lorebook keeps its entry settings. An Outlet entry stays at position 7 through a
// card save, a skip-lorebook import and a reimport. A SillyTavern card keeps each entry's settings under
// `extensions`: they are read on import and written back there, where SillyTavern reads them.
import assert from "node:assert/strict";
import Fastify from "../../packages/server/node_modules/fastify/fastify.js";
import { characterDataSchema, updateCharacterSchema } from "../../packages/shared/dist/index.js";
import { closeDB, getDB } from "../../packages/server/src/db/connection.js";
import { charactersRoutes } from "../../packages/server/src/routes/characters.routes.js";
import { importSTCharacter } from "../../packages/server/src/services/import/st-character.importer.js";
import { embedLorebookIntoCharacter } from "../../packages/server/src/services/lorebook/character-book-sync.js";
import { createCharactersStorage } from "../../packages/server/src/services/storage/characters.storage.js";
import { createLorebooksStorage } from "../../packages/server/src/services/storage/lorebooks.storage.js";

const db = await getDB();
const characters = createCharactersStorage(db);
const lorebooks = createLorebooksStorage(db);
const app = Fastify();
app.decorate("db", db);
await app.register(charactersRoutes, { prefix: "/api/characters" });

const cardBook = async (id: string) => JSON.parse((await characters.getById(id))!.data).character_book;
const importEmbedded = async (id: string) => {
  const response = await app.inject({ method: "POST", url: `/api/characters/${id}/embedded-lorebook/import` });
  assert.equal(response.statusCode, 200, response.body);
  return (await lorebooks.listEntries(response.json().lorebookId)) as Array<Record<string, unknown>>;
};
const stCard = (name: string, entries: unknown[]) => ({
  spec: "chara_card_v2",
  spec_version: "2.0",
  data: { name, character_book: { entries } },
});

try {
  // ── Outlet entries stay Outlet entries ──
  const outlet = { keys: ["scene"], content: "Outlet lore", position: 7, outletName: "scene" };
  const parsedUpdate = updateCharacterSchema.parse({ data: { character_book: { entries: [outlet] } } });
  assert.equal(parsedUpdate.data.character_book?.entries?.[0]?.position, 7, "a card update keeps position 7");
  const parsedCard = characterDataSchema.parse({ name: "Outlet card", character_book: { entries: [outlet] } });
  assert.equal(parsedCard.character_book?.entries[0]?.position, 7, "a card keeps position 7");

  const owner = (await characters.create(characterDataSchema.parse({ name: "Outlet owner" })))!;
  const book = (await lorebooks.create({ name: "Outlet lore", characterIds: [owner.id] }))!;
  await lorebooks.createEntry({
    lorebookId: book.id,
    name: "Scene",
    content: "Outlet lore",
    position: 7,
    outletName: "scene",
  });
  await embedLorebookIntoCharacter(db, owner.id, book.id);
  // The character editor saves the whole card, embedded book included.
  const data = JSON.parse((await characters.getById(owner.id))!.data);
  const saved = await app.inject({ method: "PATCH", url: `/api/characters/${owner.id}`, payload: { data } });
  assert.equal(saved.statusCode, 200, saved.body);
  assert.equal((await cardBook(owner.id)).entries[0].position, 7, "a card save keeps the Outlet position");
  const [reimported] = await importEmbedded(owner.id);
  assert.equal(reimported!.position, 7, "a reimport after a card save keeps the Outlet position");
  assert.equal(reimported!.outletName, "scene");

  const skipped = await importSTCharacter(stCard("Skipped outlet", [outlet]), db, { importEmbeddedLorebook: false });
  const skippedBook = await cardBook(skipped.characterId!);
  assert.equal(skippedBook.entries[0].position, 7, "a skip-lorebook import keeps the Outlet position");
  assert.equal(skippedBook.entries[0].outletName, "scene", "and its outlet name");
  const [laterImported] = await importEmbedded(skipped.characterId!);
  assert.equal(laterImported!.position, 7);
  assert.equal(laterImported!.outletName, "scene");

  // ── SillyTavern entry settings under `extensions` ──
  // SillyTavern exports top-level position only as before_char/after_char; the real values are here.
  const stAtDepth = {
    keys: ["harbor"],
    secondary_keys: ["night"],
    content: "Harbor lore",
    comment: "Harbor",
    insertion_order: 100,
    enabled: true,
    position: "after_char",
    extensions: {
      position: 4,
      depth: 2,
      role: 1,
      probability: 30,
      useProbability: true,
      selectiveLogic: 2,
      sticky: 3,
      group: "docks",
      group_weight: 70,
      case_sensitive: true,
      prevent_recursion: false,
    },
  };
  const expectEntry = (entry: Record<string, unknown>, label: string) => {
    assert.equal(entry.position, 2, `${label}: @D is At Depth`);
    assert.equal(entry.depth, 2, `${label}: depth`);
    assert.equal(entry.role, "user", `${label}: role`);
    assert.equal(entry.probability, 30, `${label}: probability`);
    assert.equal(entry.selectiveLogic, "not", `${label}: NOT ANY`);
    assert.equal(entry.sticky, 3, `${label}: sticky`);
    assert.equal(entry.group, "docks", `${label}: group`);
    assert.equal(entry.groupWeight, 70, `${label}: group weight`);
    assert.equal(entry.caseSensitive, true, `${label}: case sensitive`);
    assert.equal(entry.preventRecursion, false, `${label}: recursion`);
  };

  const imported = await importSTCharacter(stCard("Harbor", [stAtDepth]), db);
  const [harbor] = (await lorebooks.listEntries(imported.lorebook!.lorebookId!)) as Array<Record<string, unknown>>;
  expectEntry(harbor!, "card import");
  // The synced card book writes the settings back where SillyTavern reads them.
  const synced = (await cardBook(imported.characterId!)).entries[0];
  assert.equal(synced.position, 4);
  assert.deepEqual(
    {
      position: synced.extensions.position,
      depth: synced.extensions.depth,
      role: synced.extensions.role,
      probability: synced.extensions.probability,
      useProbability: synced.extensions.useProbability,
      selectiveLogic: synced.extensions.selectiveLogic,
      sticky: synced.extensions.sticky,
      group: synced.extensions.group,
      group_weight: synced.extensions.group_weight,
      case_sensitive: synced.extensions.case_sensitive,
      prevent_recursion: synced.extensions.prevent_recursion,
    },
    stAtDepth.extensions,
  );
  const [roundTripped] = await importEmbedded(imported.characterId!);
  expectEntry(roundTripped!, "reimport of the synced book");

  const skippedSt = await importSTCharacter(stCard("Skipped harbor", [stAtDepth]), db, {
    importEmbeddedLorebook: false,
  });
  const [laterHarbor] = await importEmbedded(skippedSt.characterId!);
  expectEntry(laterHarbor!, "import after a skip-lorebook import");

  // A top-level position that disagrees with the SillyTavern one was set later, and wins.
  const edited = await importSTCharacter(stCard("Edited", [{ ...stAtDepth, position: "before_char" }]), db);
  const [editedEntry] = (await lorebooks.listEntries(edited.lorebook!.lorebookId!)) as Array<Record<string, unknown>>;
  assert.equal(editedEntry!.position, 0);
} finally {
  await app.close();
  await closeDB();
}
