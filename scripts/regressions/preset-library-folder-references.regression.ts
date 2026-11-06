import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-preset-library-folders-"));
const previous = {
  DATA_DIR: process.env.DATA_DIR,
  FILE_STORAGE_DIR: process.env.FILE_STORAGE_DIR,
  MARINARA_FILE_STORAGE_DIR: process.env.MARINARA_FILE_STORAGE_DIR,
};
let closeStorage: (() => Promise<void>) | undefined;

try {
  process.env.DATA_DIR = dataDir;
  process.env.FILE_STORAGE_DIR = join(dataDir, "file-storage");
  process.env.MARINARA_FILE_STORAGE_DIR = process.env.FILE_STORAGE_DIR;
  const [{ createFileNativeDB }, { createPromptsStorage }, { createLibraryFoldersStorage }, { libraryFolders }] =
    await Promise.all([
      import("../../packages/server/src/db/file-backed-store.js"),
      import("../../packages/server/src/services/storage/prompts.storage.js"),
      import("../../packages/server/src/services/storage/library-folders.storage.js"),
      import("../../packages/server/src/db/schema/index.js"),
    ]);
  const db = await createFileNativeDB();
  closeStorage = () => db._fileStore.close();
  const presets = createPromptsStorage(db);
  const folders = createLibraryFoldersStorage(db);
  const first = (await presets.create({ name: "First" }))!;
  const second = (await presets.create({ name: "Second" }))!;
  const third = (await presets.create({ name: "Third" }))!;
  const kept = (await presets.create({ name: "Kept" }))!;
  const root = (await presets.create({ name: "Unfoldered" }))!;
  const one = (await folders.create("presets", { name: "One" }))!;
  const two = (await folders.create("presets", { name: "Two" }))!;
  const lorebookFolder = (await folders.create("lorebooks", { name: "Lorebook" }))!;
  const agentFolder = (await folders.create("agents", { name: "Agent" }))!;
  await folders.update("presets", one.id, { itemIds: [second.id, first.id, third.id, kept.id] });
  await folders.update("presets", two.id, { itemIds: [first.id, kept.id] });
  for (const folder of [lorebookFolder, agentFolder]) {
    await folders.update(folder.scope, folder.id, { itemIds: [first.id, "missing-a"] });
  }
  const unrelatedFolders = await Promise.all(
    [lorebookFolder, agentFolder].map((folder) => folders.getById(folder.scope, folder.id)),
  );
  const members = async (id: string) => (await folders.getById("presets", id))!.itemIds;

  await presets.remove(root.id);
  assert.deepEqual(await members(one.id), [second.id, first.id, third.id, kept.id]);
  await presets.remove(first.id);
  assert.equal(await presets.getById(first.id), null);
  assert.deepEqual(await members(one.id), [second.id, third.id, kept.id]);
  assert.deepEqual(await members(two.id), [kept.id]);

  // The panel's bulk action issues concurrent single-preset deletions.
  const results = await Promise.allSettled([second.id, third.id].map((id) => presets.remove(id)));
  assert.ok(results.every((result) => result.status === "fulfilled"));
  assert.deepEqual(await members(one.id), [kept.id]);
  assert.equal(await presets.getById(second.id), null);
  assert.equal(await presets.getById(third.id), null);

  // Fail folder cleanup after the delete to prove both changes roll back together.
  const failingDb = new Proxy(db, {
    get(target, property, receiver) {
      if (property !== "transaction") return Reflect.get(target, property, receiver);
      return (callback: Parameters<typeof db.transaction>[0]) =>
        db.transaction((tx) =>
          callback(
            new Proxy(tx, {
              get(transaction, key, proxy) {
                if (key !== "update") return Reflect.get(transaction, key, proxy);
                return (table: unknown) => {
                  if (table === libraryFolders) throw new Error("injected folder cleanup failure");
                  return transaction.update(table as Parameters<typeof transaction.update>[0]);
                };
              },
            }),
          ),
        );
    },
  });
  await assert.rejects(createPromptsStorage(failingDb).remove(kept.id), /injected folder cleanup failure/);
  assert.ok(await presets.getById(kept.id));
  assert.deepEqual(await members(one.id), [kept.id]);
  assert.deepEqual(await members(two.id), [kept.id]);

  await folders.update("presets", one.id, { itemIds: ["missing-a", kept.id, "missing-b"] });
  await folders.update("presets", two.id, { itemIds: [kept.id, "missing-a"] });
  assert.equal(await folders.pruneMissingPresetItemIds(), 2);
  assert.deepEqual(await members(one.id), [kept.id]);
  assert.deepEqual(await members(two.id), [kept.id]);
  assert.ok(await presets.getById(kept.id));
  const generation = db._fileStore.getTableWriteGeneration("library_folders");
  assert.equal(await folders.pruneMissingPresetItemIds(), 0);
  assert.equal(db._fileStore.getTableWriteGeneration("library_folders"), generation);
  assert.deepEqual(
    await Promise.all([lorebookFolder, agentFolder].map((folder) => folders.getById(folder.scope, folder.id))),
    unrelatedFolders,
  );
} finally {
  await closeStorage?.();
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key as keyof typeof previous];
    else process.env[key as keyof typeof previous] = value;
  }
  rmSync(dataDir, { recursive: true, force: true });
}
