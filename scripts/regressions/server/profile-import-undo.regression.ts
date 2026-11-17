// Import Profile saves a full safety copy before it overwrites anything, refuses to import when the copy
// can't be saved, and "Undo Last Import" puts back only what the last import wrote. The Undo record
// lives in the database and commits with the import, so it always describes the last finished import.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = await fs.mkdtemp(join(tmpdir(), "marinara-profile-import-undo-"));
process.env.DATA_DIR = root;
process.env.FILE_STORAGE_DIR = join(root, "storage");
const backups = join(root, "backups");
const UNDO_SETTING = "profile_import_undo";

// The free-space check reads statfs; the first import runs on a "full disk".
const originalStatfs = fs.statfs;
let freeBytes = 0;
// Windows refuses to delete a file another program holds open; one case makes removing a copy fail.
const originalRm = fs.rm;
let copyBusy = false;
Object.assign(fs, {
  statfs: async (path: string) => ({ ...(await originalStatfs(path)), bsize: 1, bavail: freeBytes }),
  rm: async (path: string, options?: Parameters<typeof originalRm>[1]) => {
    if (copyBusy && /marinara-before-import-.*\.zip$/u.test(String(path))) {
      throw Object.assign(new Error("resource busy"), { code: "EBUSY" });
    }
    return originalRm(path, options);
  },
});
syncBuiltinESMExports();

const { getDB, closeDB } = await import("../../../packages/server/src/db/connection.js");
const { backupRoutes } = await import("../../../packages/server/src/routes/backup.routes.js");
const { createCharactersStorage } = await import("../../../packages/server/src/services/storage/characters.storage.js");
const { createChatsStorage } = await import("../../../packages/server/src/services/storage/chats.storage.js");
const { createLorebooksStorage } = await import("../../../packages/server/src/services/storage/lorebooks.storage.js");
const appSettingsModule = await import("../../../packages/server/src/services/storage/app-settings.storage.js");
const { default: Fastify } = await import("../../../packages/server/node_modules/fastify/fastify.js");

const db = await getDB();
const characters = createCharactersStorage(db);
const settings = appSettingsModule.createAppSettingsStorage(db);
const app = Fastify();
app.decorate("db", db);
await app.register(backupRoutes, { prefix: "/api/backup" });
await app.ready();

const descriptionOf = async (id: string) => JSON.parse((await characters.getById(id))!.data as string).description;
const setDescription = (id: string, description: string) => characters.update(id, { description } as any);
const sources = join(root, "knowledge-sources");
const readSource = (name: string) => fs.readFile(join(sources, name), "utf8");
const writeSource = (name: string, text: string) => fs.writeFile(join(sources, name), text);
const backupFiles = async () => (await fs.readdir(backups).catch(() => [] as string[])).sort();
const undoRecord = async () => JSON.parse((await settings.get(UNDO_SETTING)) ?? "null");
const undoOffer = async () => (await app.inject({ method: "GET", url: "/api/backup/import-profile/undo" })).json();
const undo = () => app.inject({ method: "POST", url: "/api/backup/import-profile/undo" });
const deleteCopy = () => app.inject({ method: "DELETE", url: "/api/backup/import-profile/undo" });
let lastPreview: any;
/** `keep` is the "Keep my current versions, only add what's missing" switch. */
const importProfile = async (profile: string, keep = false) => {
  const preview = await app.inject({
    method: "POST",
    url: `/api/backup/import-profile?preview=true${keep ? "&keepExisting=true" : ""}`,
    headers: { "content-type": "application/json" },
    payload: profile,
  });
  assert.equal(preview.statusCode, 200, preview.body);
  lastPreview = preview.json();
  assert.equal(lastPreview.undoable, !keep, "a current profile can be undone, unless it only adds");
  assert.equal(lastPreview.keepsExisting, keep, "the preview says whether current versions are kept");
  return app.inject({
    method: "POST",
    url: `/api/backup/import-profile${keep ? "?keepExisting=true" : ""}`,
    headers: { "x-profile-preview-token": lastPreview.previewToken },
  });
};

try {
  assert.deepEqual(await undoOffer(), { available: false });
  assert.equal((await undo()).statusCode, 404);

  // Last week's profile has Ada's old description and an old notes file. Since then both were
  // edited and Bea was created.
  const ada = (await characters.create({ name: "Ada", description: "old" } as any))!.id;
  await fs.mkdir(sources, { recursive: true });
  await writeSource("notes.txt", "old");
  const exported = await app.inject({ method: "GET", url: "/api/backup/export-profile" });
  assert.equal(exported.statusCode, 200, exported.body);
  await setDescription(ada, "new");
  await writeSource("notes.txt", "new");
  const bea = (await characters.create({ name: "Bea", description: "before import" } as any))!.id;

  // No room for the safety copy: nothing is imported and no partial copy is left behind.
  const refused = await importProfile(exported.body);
  assert.notEqual(refused.statusCode, 200, "an import without a safety copy must not succeed");
  assert.match(refused.json().message, /Nothing was imported, because a safety copy could not be saved first/u);
  assert.match(refused.json().message, /Not enough free space for a safety copy/u);
  assert.equal(await descriptionOf(ada), "new", "the refused import changed nothing");
  assert.deepEqual(await backupFiles(), [], "no safety copy or partial file");

  // With room, the import reverts Ada, and the copy from just before it is offered for undo.
  freeBytes = 1024 ** 4;
  assert.equal((await importProfile(exported.body)).statusCode, 200);
  assert.equal(await descriptionOf(ada), "old", "the import replaced the newer version");
  assert.equal(await readSource("notes.txt"), "old", "the import replaced the newer file");
  const offered = await undoOffer();
  assert.equal(offered.available, true);
  assert.ok(!Number.isNaN(Date.parse(offered.savedAt)), "savedAt is a date");
  const firstCopies = await backupFiles();
  assert.equal(firstCopies.length, 1);
  assert.equal((await undoRecord()).copy, firstCopies[0], "the record names the copy");

  // A later import refused for space leaves this import's undo in place.
  freeBytes = 0;
  assert.notEqual((await importProfile(exported.body)).statusCode, 200);
  assert.deepEqual(await undoOffer(), offered, "a refused import keeps the previous undo");
  freeBytes = 1024 ** 4;

  // So does one that fails after saving its own copy: a row without an id passes the preview and
  // fails the import. Its rollback keeps the previous record, and its own copy is removed.
  const broken = JSON.parse(exported.body);
  broken.data.fileStorage.tables.characters = [...(broken.data.fileStorage.tables.characters ?? []), { name: "No id" }];
  assert.notEqual((await importProfile(JSON.stringify(broken))).statusCode, 200);
  assert.deepEqual(await undoOffer(), offered, "a failed import keeps the previous undo");
  assert.deepEqual(await backupFiles(), firstCopies, "the failed import's own copy is removed");

  // A second import replaces the record, and the copy the old record named goes. other.txt is in
  // that copy but not in the file, so the import doesn't write it. The file also carries a planted
  // Undo record, which must not reach this install.
  await setDescription(ada, "newer");
  await writeSource("notes.txt", "newer");
  await writeSource("other.txt", "before import");
  const planted = JSON.parse(exported.body);
  const plantedValue = JSON.stringify({ copy: firstCopies[0], rows: { characters: [bea] }, files: [] });
  planted.data.fileStorage.tables.app_settings = [
    ...(planted.data.fileStorage.tables.app_settings ?? []),
    { key: UNDO_SETTING, value: plantedValue, updatedAt: "2000-01-01T00:00:00.000Z" },
  ];
  assert.equal((await importProfile(JSON.stringify(planted))).statusCode, 200);
  assert.equal(await descriptionOf(ada), "old");
  assert.equal(await readSource("notes.txt"), "old");
  const secondCopies = await backupFiles();
  assert.equal(secondCopies.length, 1, "the replaced copy is removed");
  assert.notEqual(secondCopies[0], firstCopies[0]);
  const secondRecord = await undoRecord();
  assert.equal(secondRecord.copy, secondCopies[0], "the planted record was ignored");
  assert.ok(!(secondRecord.rows.app_settings ?? []).includes(UNDO_SETTING), "the planted row isn't listed");
  const reexported = await app.inject({ method: "GET", url: "/api/backup/export-profile" });
  assert.ok(!reexported.body.includes(UNDO_SETTING), "the Undo record is never exported");

  // Bea and other.txt were not in the file. Edits to them after the import must survive the undo.
  await setDescription(bea, "edited after import");
  await writeSource("other.txt", "edited after import");
  const undone = await undo();
  assert.equal(undone.statusCode, 200, undone.body);
  assert.equal(await descriptionOf(ada), "newer", "undo put back what the last import replaced");
  assert.equal(await readSource("notes.txt"), "newer", "undo put back the file the last import replaced");
  assert.equal(await descriptionOf(bea), "edited after import", "undo left items the import didn't write alone");
  assert.equal(await readSource("other.txt"), "edited after import", "undo left files the import didn't write alone");

  // Two undos at once (a double-click, two tabs) both read the record first; only one may restore.
  await setDescription(ada, "between undos");
  assert.equal((await importProfile(exported.body)).statusCode, 200);
  const both = await Promise.all([undo(), undo()]);
  assert.deepEqual(
    both.map((response) => response.statusCode === 200).sort(),
    [false, true],
    "only one of two simultaneous undos runs",
  );
  assert.equal(await descriptionOf(ada), "between undos", "the undo that ran restored the rows once");
  await setDescription(ada, "newer");

  // Undo works once: a second one would put the same rows back over anything edited since.
  assert.deepEqual(await undoOffer(), { available: false });
  assert.equal(await undoRecord(), null, "the undo cleared the record");
  assert.deepEqual(await backupFiles(), [], "the used safety copy is removed");
  assert.equal((await undo()).statusCode, 404);

  // If the used copy can't be removed, the undo still worked and says so. It isn't offered again,
  // because its record is gone, but the leftover copy can still be deleted.
  assert.equal((await importProfile(exported.body)).statusCode, 200);
  copyBusy = true;
  const undoneBusy = await undo();
  copyBusy = false;
  assert.equal(undoneBusy.statusCode, 200, undoneBusy.body);
  assert.equal(await descriptionOf(ada), "newer", "the undo put the rows back");
  const leftover = await undoOffer();
  assert.equal(leftover.available, false, "an undo whose copy stays isn't offered again");
  assert.ok(!Number.isNaN(Date.parse(leftover.savedAt)), "the leftover copy is still reported");
  assert.equal((await deleteCopy()).statusCode, 200);
  assert.deepEqual(await backupFiles(), [], "Delete removes the leftover copy");

  // A copy newer than the one the record names means an import stopped while saving: the record no
  // longer describes the last import, so Undo is withheld. Delete still removes everything,
  // half-written copies included, and changes no data.
  assert.equal((await importProfile(exported.body)).statusCode, 200);
  const [recorded] = await backupFiles();
  const stopped = "marinara-before-import-9999-12-31T23-59-59-999Z-ffffffff.zip";
  await fs.copyFile(join(backups, recorded), join(backups, stopped));
  await fs.writeFile(join(backups, `${stopped.replace("ffffffff", "eeeeeeee")}.pending`), "partial");
  const withheld = await undoOffer();
  assert.equal(withheld.available, false, "Undo is withheld when a newer copy exists");
  assert.ok(!Number.isNaN(Date.parse(withheld.savedAt)), "the newer copy is reported for deleting");
  assert.equal((await undo()).statusCode, 404);
  assert.equal((await deleteCopy()).statusCode, 200);
  assert.deepEqual(await backupFiles(), [], "Delete removes every copy and half-written copy");
  assert.equal(await undoRecord(), null, "Delete removes the record");
  assert.deepEqual(await undoOffer(), { available: false });
  assert.equal(await descriptionOf(ada), "old", "deleting the copies changed no data");

  // A tampered record can't point the next import's clean-up at a file outside backups/.
  const outside = join(root, "keep-me.txt");
  await fs.writeFile(outside, "keep");
  await settings.set(UNDO_SETTING, JSON.stringify({ copy: "../keep-me.txt", rows: {}, files: [] }));
  assert.deepEqual(await undoOffer(), { available: false }, "a malformed record offers nothing");
  assert.equal((await importProfile(exported.body)).statusCode, 200);
  assert.equal(
    await fs.readFile(outside, "utf8").catch(() => "deleted"),
    "keep",
    "the file the record named outside backups/ stays",
  );
  assert.equal((await undoOffer()).available, true, "the import replaced the malformed record");
  assert.equal((await deleteCopy()).statusCode, 200);

  // A record whose copy is gone offers nothing.
  assert.equal((await importProfile(exported.body)).statusCode, 200);
  await fs.rm(join(backups, (await backupFiles())[0]));
  assert.deepEqual(await undoOffer(), { available: false });
  assert.equal((await undo()).statusCode, 404);
  assert.equal((await deleteCopy()).statusCode, 200);

  // "Keep my current versions, only add what's missing": the full profile has Ada, notes.txt, Cy,
  // gone.txt and a chat with two messages. Since then Ada, notes.txt and the first message were
  // edited, and Cy, gone.txt and the second message deleted. A normal import before that left an Undo.
  const chats = createChatsStorage(db);
  const chat = (await chats.create({ name: "Kept chat", mode: "conversation", characterIds: [] } as any))!;
  const editedMessage = (await chats.createMessage({
    chatId: chat.id,
    role: "user",
    characterId: null,
    content: "old",
  } as any))!;
  const deletedMessage = (await chats.createMessage({
    chatId: chat.id,
    role: "assistant",
    characterId: null,
    content: "deleted later",
  } as any))!;
  const cy = (await characters.create({ name: "Cy", description: "deleted later" } as any))!.id;
  await writeSource("gone.txt", "deleted later");
  // Saving a lorebook's links re-creates them with new ids, so the file's link to Ada clashes with
  // today's on the lorebook+character rule, not on its id. It must be kept, not fail the import.
  const lorebooks = createLorebooksStorage(db);
  const book = (await lorebooks.create({ name: "Linked", characterIds: [ada] } as any))!;
  const full = await app.inject({ method: "GET", url: "/api/backup/export-profile" });
  assert.equal(full.statusCode, 200, full.body);
  assert.equal((await importProfile(exported.body)).statusCode, 200);
  const undoBefore = { offer: await undoOffer(), record: await undoRecord(), copies: await backupFiles() };
  assert.equal(undoBefore.offer.available, true);
  await setDescription(ada, "mine");
  await writeSource("notes.txt", "mine");
  await chats.updateMessageContent(editedMessage.id, "mine");
  await chats.removeMessage(deletedMessage.id);
  await characters.remove(cy);
  await fs.rm(join(sources, "gone.txt"));
  await lorebooks.update(book.id, { characterIds: [ada] } as any);

  const kept = await importProfile(full.body, true);
  assert.equal(kept.statusCode, 200, kept.body);
  assert.equal(lastPreview.imported.characters, 1, "the preview counts only what is missing");
  assert.equal(lastPreview.imported.messages, 0, "the preview doesn't count messages it can't check");
  assert.equal(kept.json().imported.messages, 1, "the result counts the message added back");
  assert.equal(await descriptionOf(ada), "mine", "an item already here keeps its current version");
  assert.equal(await readSource("notes.txt"), "mine", "a file already here keeps its current version");
  assert.equal((await chats.getMessage(editedMessage.id))?.content, "mine", "a message already here is kept");
  assert.equal(await descriptionOf(cy), "deleted later", "a missing item is added back");
  assert.equal(await readSource("gone.txt"), "deleted later", "a missing file is added back");
  assert.equal(
    (await chats.getMessage(deletedMessage.id))?.content,
    "deleted later",
    "a missing message is added back",
  );
  assert.deepEqual(
    { offer: await undoOffer(), record: await undoRecord(), copies: await backupFiles() },
    undoBefore,
    "an import that replaces nothing saves no copy and leaves the previous Undo as it was",
  );

  // A profile from a much older version (no storage snapshot) always adds next to existing items, so
  // with the switch on its preview must not promise that current versions are kept.
  const legacyPreview = await app.inject({
    method: "POST",
    url: "/api/backup/import-profile?preview=true&keepExisting=true",
    headers: { "content-type": "application/json" },
    payload: JSON.stringify({ type: "marinara_profile", version: 1, data: { characters: [{ name: "Old" }] } }),
  });
  assert.equal(legacyPreview.statusCode, 200, legacyPreview.body);
  assert.equal(legacyPreview.json().keepsExisting, false, "an older profile can't keep current versions");
  assert.equal(legacyPreview.json().undoable, false, "an older profile only adds");
} finally {
  Object.assign(fs, { statfs: originalStatfs, rm: originalRm });
  syncBuiltinESMExports();
  await app.close();
  await closeDB();
  await fs.rm(root, { recursive: true, force: true });
}

console.info("Profile import undo regressions passed.");
