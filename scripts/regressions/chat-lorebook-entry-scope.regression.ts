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
const { createChatsStorage, withChatMetadataPatchQueue } =
  await import("../../packages/server/src/services/storage/chats.storage.js");
const { createLorebooksStorage } = await import("../../packages/server/src/services/storage/lorebooks.storage.js");
const { lorebooksRoutes } = await import("../../packages/server/src/routes/lorebooks.routes.js");
const { createCharactersStorage } = await import("../../packages/server/src/services/storage/characters.storage.js");
const { processLorebooks } = await import("../../packages/server/src/services/lorebook/index.js");
const { persistLorebookRuntimeState } =
  await import("../../packages/server/src/services/generation/lorebook-generation-runtime.js");
const { characterDataSchema } = await import("../../packages/shared/src/index.js");
const { chats: chatsTable } = await import("../../packages/server/src/db/schema/index.js");
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
  const scan = async (beforePersist?: () => Promise<void>) => {
    const snapshot = JSON.parse((await chats.getById(a.id))!.metadata);
    const result = await processLorebooks(db, [{ role: "user", content: "dock" }], null, {
      chatId: a.id,
      activeLorebookIds: [book.id],
      entryStateOverrides: snapshot.entryStateOverrides ?? snapshot.lorebookEntryStateOverrides,
      entryTimingStates: snapshot.entryTimingStates ?? snapshot.lorebookEntryTimingStates,
    });
    await beforePersist?.();
    const persisted = await persistLorebookRuntimeState({
      db,
      chats,
      chatId: a.id,
      fallbackMeta: snapshot,
      entryStateOverrides: result.updatedEntryStateOverrides,
      entryTimingStates: result.updatedEntryTimingStates,
    });
    const current = JSON.parse((await chats.getById(a.id))!.metadata);
    for (const [key, value] of Object.entries(persisted)) assert.deepEqual(value, current[key]);
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

  // Real generation persistence must preserve changes accepted after its snapshot.
  await lorebooks.updateEntry(entry.id, { ephemeral: null, sticky: 2 });
  await chats.patchMetadata(a.id, { entryStateOverrides: {}, entryTimingStates: {} });
  await scan(async () => {
    assert.equal((await patch(entry.id, false)).statusCode, 200);
    await chats.patchMetadata(a.id, { lorebookTokenBudget: 900 });
  });
  assert.deepEqual(
    (await overrides())[entry.id],
    { enabled: false },
    "A late off toggle survives a non-countdown scan",
  );
  assert.equal(JSON.parse((await chats.getById(a.id))!.metadata).entryTimingStates[entry.id], undefined);
  assert.equal(JSON.parse((await chats.getById(a.id))!.metadata).lorebookTokenBudget, 900);
  await scan(async () => {
    assert.equal((await patch(entry.id, true)).statusCode, 200);
  });
  assert.equal((await overrides())[entry.id], undefined, "A late on toggle survives the disabled snapshot");
  assert.ok((await scan()).activatedEntryIds.includes(entry.id), "The next scan uses the accepted toggle");

  await lorebooks.updateEntry(entry.id, { ephemeral: 1, sticky: null });
  await chats.patchMetadata(a.id, { entryStateOverrides: {}, entryTimingStates: {} });
  await scan(async () => {
    assert.equal((await patch(entry.id, false)).statusCode, 200);
  });
  assert.deepEqual((await overrides())[entry.id], { enabled: false }, "A late toggle also wins over countdown expiry");
  await patch(entry.id, true);
  await scan(async () => {
    assert.equal((await patch(other.id, false)).statusCode, 200);
  });
  assert.deepEqual(
    (await overrides())[entry.id],
    { ephemeral: 0, enabled: false },
    "Unchanged countdowns still expire",
  );
  assert.deepEqual((await overrides())[other.id], { enabled: false }, "Another entry's toggle is retained");

  await chats.patchMetadata(a.id, {
    entryStateOverrides: undefined,
    lorebookEntryStateOverrides: { [other.id]: { enabled: false } },
  });
  await scan();
  assert.deepEqual((await overrides())[other.id], { enabled: false }, "Legacy switches survive modern runtime writes");
  assert.deepEqual((await overrides())[entry.id], { ephemeral: 0, enabled: false });

  await patch(entry.id, true);
  await scan(async () => {
    await chats.patchMetadata(a.id, { activeLorebookIds: [] });
  });
  assert.equal((await overrides())[entry.id], undefined, "A detached book cannot regain newly computed state");
  await chats.patchMetadata(a.id, {
    activeLorebookIds: [book.id],
    entryStateOverrides: { [entry.id]: { ephemeral: 1 } },
  });
  await scan(async () => {
    await chats.patchMetadata(a.id, { entryStateOverrides: {}, entryTimingStates: {} });
  });
  assert.equal((await overrides())[entry.id], undefined, "Cleared countdown state is not restored by a stale scan");

  const deletedDuringScan = await lorebooks.createEntry({
    lorebookId: book.id,
    name: "Temporary dock lore",
    keys: ["dock"],
    content: "Temporary",
    ephemeral: 1,
    sticky: 2,
  });
  await scan(async () => {
    await lorebooks.removeEntry(deletedDuringScan.id);
  });
  const afterDeletion = JSON.parse((await chats.getById(a.id))!.metadata);
  assert.equal(
    afterDeletion.entryStateOverrides[deletedDuringScan.id],
    undefined,
    "Deleted entries cannot gain a new countdown",
  );
  assert.equal(
    afterDeletion.entryTimingStates[deletedDuringScan.id],
    undefined,
    "Deleted entries cannot gain new sticky state",
  );

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
  await scan(async () => {
    await lorebooks.removeEntry(entry.id);
  });
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

  for (const kind of ["entry", "folder", "book"] as const) {
    const rollbackBook = await lorebooks.create({ name: `Atomic ${kind}` });
    const rollbackFolder = await lorebooks.createFolder(rollbackBook.id, { name: "Atomic folder" });
    const rollbackEntry = await lorebooks.createEntry({
      lorebookId: rollbackBook.id,
      folderId: rollbackFolder!.id,
      name: "Atomic entry",
    });
    await seedRemovedState([rollbackEntry.id]);
    await chats.patchMetadata(a.id, { activeLorebookIds: [rollbackBook.id] });
    const before = await Promise.all([chats.getById(a.id), chats.getById(b.id)]);
    const remove = () =>
      kind === "entry"
        ? lorebooks.removeEntry(rollbackEntry.id)
        : kind === "folder"
          ? lorebooks.removeFolder(rollbackFolder!.id, rollbackBook.id, true)
          : lorebooks.remove(rollbackBook.id);
    const originalUpdate = db.update;
    let metadataWrites = 0;
    db.update = ((table: Parameters<typeof db.update>[0]) => {
      if (table === chatsTable && ++metadataWrites === 2) throw new Error("Injected metadata cleanup failure");
      return originalUpdate.call(db, table);
    }) as typeof db.update;
    try {
      await assert.rejects(remove(), /Injected metadata cleanup failure/);
    } finally {
      db.update = originalUpdate;
    }
    assert.ok(await lorebooks.getById(rollbackBook.id), `${kind}: book deletion rolls back`);
    assert.ok(await lorebooks.getFolder(rollbackFolder!.id, rollbackBook.id), `${kind}: folder deletion rolls back`);
    assert.ok(await lorebooks.getEntry(rollbackEntry.id), `${kind}: entry deletion rolls back`);
    for (const row of before) {
      const after = await chats.getById(row!.id);
      assert.equal(after!.metadata, row!.metadata, `${kind}: earlier metadata writes roll back`);
      assert.equal(after!.writeOrdinalCounter, row!.writeOrdinalCounter);
    }
    await remove();
    await assertRemovedState([rollbackEntry.id]);
    await lorebooks.remove(rollbackBook.id);
  }

  const queuedBook = await lorebooks.create({ name: "Queued deletion" });
  let releaseMetadata = () => {};
  const metadataGate = new Promise<void>((resolve) => {
    releaseMetadata = resolve;
  });
  const queuedEdit = withChatMetadataPatchQueue(a.id, async () => {
    await metadataGate;
    await chats.patchMetadata(a.id, { unrelatedQueuedSetting: "retained" }, { metadataQueueHeld: true });
  });
  let deletionFinished = false;
  const queuedDelete = lorebooks.remove(queuedBook.id).then(() => {
    deletionFinished = true;
  });
  try {
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(deletionFinished, false, "Deletion waits for queued metadata edits");
    const lateEntry = await lorebooks.createEntry({ lorebookId: queuedBook.id, name: "Added while deletion waits" });
    const lateChat = await chats.create({ name: "Added while deletion waits", mode: "roleplay", characterIds: [] });
    assert.ok(lateChat);
    await chats.patchMetadata(lateChat.id, {
      activeLorebookIds: [queuedBook.id],
      entryStateOverrides: { [lateEntry.id]: { enabled: false } },
      entryTimingStates: { [lateEntry.id]: { cooldownRemaining: 1 } },
    });
    releaseMetadata();
    await Promise.all([queuedEdit, queuedDelete]);
    const lateMetadata = JSON.parse((await chats.getById(lateChat.id))!.metadata);
    assert.deepEqual(lateMetadata.activeLorebookIds, []);
    assert.deepEqual(lateMetadata.entryStateOverrides, {});
    assert.deepEqual(lateMetadata.entryTimingStates, {});
    assert.equal(await lorebooks.getEntry(lateEntry.id), null);
    assert.equal(JSON.parse((await chats.getById(a.id))!.metadata).unrelatedQueuedSetting, "retained");
  } finally {
    releaseMetadata();
    await Promise.allSettled([queuedEdit, queuedDelete]);
  }

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
