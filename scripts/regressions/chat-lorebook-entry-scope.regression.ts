import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "marinara-chat-lore-"));
process.env.DATA_DIR = dir;
process.env.FILE_STORAGE_DIR = join(dir, "storage");
process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "silent";
const requireServer = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const Fastify = requireServer("fastify") as typeof import("fastify").default;
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { chatsRoutes } = await import("../../packages/server/src/routes/chats.routes.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createLorebooksStorage } = await import("../../packages/server/src/services/storage/lorebooks.storage.js");
const { lorebooksRoutes } = await import("../../packages/server/src/routes/lorebooks.routes.js");
const { createCharactersStorage } = await import("../../packages/server/src/services/storage/characters.storage.js");
const { processLorebooks } = await import("../../packages/server/src/services/lorebook/index.js");
const { characterDataSchema } = await import("../../packages/shared/src/index.js");
const db = await getDB();
const chats = createChatsStorage(db);
const lorebooks = createLorebooksStorage(db);
const app = Fastify();
app.decorate("db", db);
await app.register(chatsRoutes, { prefix: "/api/chats" });
await app.register(lorebooksRoutes, { prefix: "/api/lorebooks" });
try {
  const book = await lorebooks.create({ name: "Shared lore" });
  const entry = await lorebooks.createEntry({
    lorebookId: book.id,
    name: "Dockmaster",
    content: "Runs the docks",
    keys: ["dock"],
  });
  const other = await lorebooks.createEntry({
    lorebookId: book.id,
    name: "Innkeeper",
    content: "Runs the inn",
    keys: ["inn"],
  });
  const a = await chats.create({ name: "First game", mode: "game", characterIds: [] });
  const b = await chats.create({ name: "Second game", mode: "game", characterIds: [] });
  assert.ok(a && b && entry && other);
  await chats.patchMetadata(a.id, {
    activeLorebookIds: [book.id],
    entryStateOverrides: { [entry.id]: { ephemeral: 3 }, [other.id]: { enabled: false, ephemeral: 2 } },
  });
  const patch = (entryId: string, enabled: unknown, chatId = a.id) =>
    app.inject({ method: "PATCH", url: `/api/chats/${chatId}/lorebook-entries/${entryId}`, payload: { enabled } });
  const disabled = await patch(entry.id, false);
  assert.equal(disabled.statusCode, 200, disabled.body);
  const overrides = () => chats.getById(a.id).then((chat) => JSON.parse(chat!.metadata).entryStateOverrides);
  assert.deepEqual(await overrides(), {
    [entry.id]: { ephemeral: 3, enabled: false },
    [other.id]: { ephemeral: 2, enabled: false },
  });
  assert.equal((await lorebooks.getEntry(entry.id))?.enabled, true, "global entry remains enabled");
  assert.equal(
    JSON.parse((await chats.getById(b.id))!.metadata).entryStateOverrides,
    undefined,
    "second chat is untouched",
  );
  assert.equal((await patch(entry.id, true)).statusCode, 200);
  assert.deepEqual((await overrides())[entry.id], { ephemeral: 3 });
  await Promise.all([patch(entry.id, false), patch(other.id, true)]);
  assert.deepEqual(await overrides(), {
    [entry.id]: { ephemeral: 3, enabled: false },
    [other.id]: { ephemeral: 2 },
  });
  assert.equal((await patch("missing", true)).statusCode, 404);
  assert.equal((await patch(entry.id, true, "missing")).statusCode, 404);
  assert.equal((await patch(entry.id, "false")).statusCode, 400);
  await lorebooks.updateEntry(entry.id, { enabled: false });
  assert.equal((await patch(entry.id, true)).statusCode, 409, "a chat cannot enable a globally disabled entry");
  assert.equal((await lorebooks.getEntry(entry.id))?.enabled, false);

  await lorebooks.updateEntry(entry.id, { enabled: true, ephemeral: 1 });
  await chats.patchMetadata(a.id, { entryStateOverrides: { [entry.id]: { enabled: false, ephemeral: 0 } } });
  assert.equal((await patch(entry.id, true)).statusCode, 200);
  assert.equal((await overrides())[entry.id], undefined, "Enabling a spent entry resets its authored budget");
  const scan = async () => {
    const result = await processLorebooks(db, [{ role: "user", content: "dock" }], null, {
      chatId: a.id,
      activeLorebookIds: [book.id],
      entryStateOverrides: await overrides(),
    });
    if (result.updatedEntryStateOverrides)
      await chats.patchMetadata(a.id, { entryStateOverrides: result.updatedEntryStateOverrides });
    return result;
  };
  const firstScan = await scan();
  assert.ok(firstScan.activatedEntryIds.includes(entry.id));
  assert.deepEqual((await overrides())[entry.id], { enabled: false, ephemeral: 0 });
  assert.ok(!(await scan()).activatedEntryIds.includes(entry.id), "Re-enabled one-shot fires only once more");
  await lorebooks.updateEntry(entry.id, { ephemeral: 2 });
  await patch(entry.id, true);
  await scan();
  assert.deepEqual((await overrides())[entry.id], { ephemeral: 1 }, "An authored budget change is used on re-enable");

  const chars = createCharactersStorage(db);
  const character = await chars.create(characterDataSchema.parse({ name: "Harbor captain" }));
  const persona = await chars.createPersona("Traveler", "Visits the harbor");
  assert.ok(character && persona);
  await chats.update(a.id, { characterIds: [character.id], personaId: persona.id });
  for (const [label, options, expected] of [
    ["unattached", {}, 404],
    ["global", { isGlobal: true }, 200],
    ["character", { characterIds: [character.id] }, 200],
    ["persona", { personaIds: [persona.id] }, 200],
    ["chat", { chatId: a.id }, 200],
    ["other-chat scope", { isGlobal: true, scope: { mode: "specific", chatIds: [b.id] } }, 404],
    ["disabled scope", { isGlobal: true, scope: { mode: "disabled" } }, 404],
  ] as const) {
    const scopedBook = await lorebooks.create({ name: label, ...options } as Parameters<typeof lorebooks.create>[0]);
    const scopedEntry = await lorebooks.createEntry({ lorebookId: scopedBook.id, name: label, content: label });
    assert.equal((await patch(scopedEntry.id, false)).statusCode, expected, label);
    if (label === "global") {
      await chats.patchMetadata(a.id, { excludedLorebookIds: [scopedBook.id] });
      assert.equal((await patch(scopedEntry.id, false)).statusCode, 404, "Excluded book cannot store new overrides");
      await chats.patchMetadata(a.id, { excludedLorebookIds: [] });
      assert.equal((await overrides())[scopedEntry.id]?.enabled, false, "Temporary exclusions retain existing state");
    }
  }

  await chats.patchMetadata(a.id, { entryTimingStates: { [entry.id]: { cooldownRemaining: 2 } } });
  const detached = await app.inject({
    method: "PATCH",
    url: `/api/chats/${a.id}/metadata`,
    payload: { activeLorebookIds: [] },
  });
  assert.equal(detached.statusCode, 200);
  assert.equal((await overrides())[entry.id], undefined, "Explicit detach clears the book's entry state");
  assert.equal(JSON.parse((await chats.getById(a.id))!.metadata).entryTimingStates[entry.id], undefined);
  await chats.patchMetadata(a.id, { activeLorebookIds: [book.id] });
  assert.equal((await overrides())[entry.id], undefined, "Re-attaching starts with authored entry settings");

  const seedRemovedState = async (ids: string[]) => {
    for (const chat of [a, b])
      await chats.patchMetadata(chat.id, {
        entryStateOverrides: Object.fromEntries([...ids, "retained"].map((id) => [id, { enabled: false }])),
        entryTimingStates: Object.fromEntries(ids.map((id) => [id, { cooldownRemaining: 1 }])),
        lorebookEntryStateOverrides: Object.fromEntries(ids.map((id) => [id, { enabled: false }])),
      });
  };
  const assertRemovedState = async (ids: string[]) => {
    for (const chat of [a, b]) {
      const meta = JSON.parse((await chats.getById(chat.id))!.metadata);
      for (const id of ids) {
        assert.equal(meta.entryStateOverrides[id], undefined);
        assert.equal(meta.entryTimingStates[id], undefined);
        assert.equal(meta.lorebookEntryStateOverrides[id], undefined);
      }
      assert.deepEqual(meta.entryStateOverrides.retained, { enabled: false });
    }
  };
  await seedRemovedState([entry.id]);
  await lorebooks.removeEntry(entry.id);
  await assertRemovedState([entry.id]);
  const folder = await lorebooks.createFolder(book.id, { name: "Cascade" });
  assert.ok(folder);
  const nested = await lorebooks.createEntry({ lorebookId: book.id, folderId: folder.id, name: "Nested" });
  await seedRemovedState([nested.id]);
  await lorebooks.removeFolder(folder.id, book.id, true);
  await assertRemovedState([nested.id]);
  await seedRemovedState([other.id]);
  await lorebooks.remove(book.id);
  await assertRemovedState([other.id]);
  assert.deepEqual(JSON.parse((await chats.getById(a.id))!.metadata).activeLorebookIds, []);

  const searchableBook = await lorebooks.create({ name: "Search" });
  const searchable = await lorebooks.createEntry({
    lorebookId: searchableBook.id,
    name: "ZebraName",
    content: "QUOKKAWORD",
    keys: ["ARMADILLOKEY"],
  });
  for (const query of ["zebraname", "quokkaword", "armadillokey"]) {
    const response = await app.inject({ method: "GET", url: `/api/lorebooks/search/entries?q=${query}` });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(
      response.json().map((row: { id: string }) => row.id),
      [searchable.id],
    );
  }
  for (const query of ["[", '"', "%", "_"]) {
    assert.deepEqual(
      await lorebooks.searchEntries(query),
      [],
      "Search treats keys as values, not JSON or SQL patterns",
    );
  }
} finally {
  await app.close();
  await closeDB();
  rmSync(dir, { recursive: true, force: true });
}
console.log("Chat lorebook toggles preserve global entries, other chats, and ephemeral state.");
