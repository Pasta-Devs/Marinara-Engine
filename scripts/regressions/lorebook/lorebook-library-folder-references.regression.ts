import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import { join } from "node:path";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-lorebook-library-folders-"));
const previous = {
  DATA_DIR: process.env.DATA_DIR,
  FILE_STORAGE_DIR: process.env.FILE_STORAGE_DIR,
  MARINARA_FILE_STORAGE_DIR: process.env.MARINARA_FILE_STORAGE_DIR,
};
let closeStorage: (() => Promise<void>) | null = null;
let closeApp: (() => Promise<void>) | null = null;

try {
  const fileStorageDir = join(dataDir, "file-storage");
  process.env.DATA_DIR = dataDir;
  process.env.FILE_STORAGE_DIR = fileStorageDir;
  process.env.MARINARA_FILE_STORAGE_DIR = fileStorageDir;

  const [{ createFileNativeDB }, { lorebooksRoutes }, { libraryFoldersRoutes }, { createLibraryFoldersStorage }] =
    await Promise.all([
      import("../../../packages/server/src/db/file-backed-store.js"),
      import("../../../packages/server/src/routes/lorebooks.routes.js"),
      import("../../../packages/server/src/routes/library-folders.routes.js"),
      import("../../../packages/server/src/services/storage/library-folders.storage.js"),
    ]);
  const db = await createFileNativeDB();
  closeStorage = () => db._fileStore.close();
  const Fastify = createRequire(new URL("../../../packages/server/package.json", import.meta.url))("fastify");
  const app = Fastify();
  app.decorate("db", db);
  await app.register(lorebooksRoutes, { prefix: "/api/lorebooks" });
  await app.register(libraryFoldersRoutes, { prefix: "/api/library-folders" });
  closeApp = () => app.close();

  const request = async (method: string, url: string, payload?: unknown, status = 200): Promise<any> => {
    const response = await app.inject({ method, url, payload });
    assert.equal(response.statusCode, status, `${method} ${url} -> ${response.statusCode} ${response.body}`);
    return response.body ? response.json() : null;
  };
  const folderItems = async (scope: string, id: string): Promise<string[]> => {
    const folders = (await request("GET", `/api/library-folders/${scope}`)) as Array<{ id: string; itemIds: string[] }>;
    return folders.find((folder) => folder.id === id)!.itemIds;
  };

  const firstBook = await request("POST", "/api/lorebooks", { name: "First" });
  const secondBook = await request("POST", "/api/lorebooks", { name: "Second" });
  const thirdBook = await request("POST", "/api/lorebooks", { name: "Third" });
  const rootBook = await request("POST", "/api/lorebooks", { name: "Unfoldered" });
  const firstFolder = await request("POST", "/api/library-folders/lorebooks", { name: "One" });
  const secondFolder = await request("POST", "/api/library-folders/lorebooks", { name: "Two" });
  const presetFolder = await request("POST", "/api/library-folders/presets", { name: "Preset" });
  await request("PATCH", `/api/library-folders/lorebooks/${firstFolder.id}`, {
    itemIds: [secondBook.id, firstBook.id, thirdBook.id],
  });
  await request("PATCH", `/api/library-folders/lorebooks/${secondFolder.id}`, {
    itemIds: [thirdBook.id, firstBook.id],
  });
  await request("PATCH", `/api/library-folders/presets/${presetFolder.id}`, {
    itemIds: [firstBook.id, "preset-id"],
  });

  await request("DELETE", `/api/lorebooks/${rootBook.id}`, undefined, 204);
  assert.deepEqual(await folderItems("lorebooks", firstFolder.id), [secondBook.id, firstBook.id, thirdBook.id]);

  await request("DELETE", `/api/lorebooks/${firstBook.id}`, undefined, 204);
  assert.deepEqual(await folderItems("lorebooks", firstFolder.id), [secondBook.id, thirdBook.id]);
  assert.deepEqual(await folderItems("lorebooks", secondFolder.id), [thirdBook.id]);
  assert.deepEqual(await folderItems("presets", presetFolder.id), [firstBook.id, "preset-id"]);
  const liveBookIds = new Set((await request("GET", "/api/lorebooks")).map((book: { id: string }) => book.id));
  assert.equal(liveBookIds.has(firstBook.id), false);
  assert.equal((await folderItems("lorebooks", firstFolder.id)).filter((id) => liveBookIds.has(id)).length, 2);

  await request("PATCH", `/api/library-folders/lorebooks/${firstFolder.id}`, {
    itemIds: ["missing-a", secondBook.id, "missing-b", thirdBook.id],
  });
  await request("PATCH", `/api/library-folders/lorebooks/${secondFolder.id}`, {
    itemIds: [thirdBook.id, "missing-a"],
  });
  const folders = createLibraryFoldersStorage(db);
  assert.equal(await folders.pruneMissingLorebookItemIds(), 2);
  assert.deepEqual(await folderItems("lorebooks", firstFolder.id), [secondBook.id, thirdBook.id]);
  assert.deepEqual(await folderItems("lorebooks", secondFolder.id), [thirdBook.id]);
  assert.deepEqual(await folderItems("presets", presetFolder.id), [firstBook.id, "preset-id"]);
  const generation = db._fileStore.getTableWriteGeneration("library_folders");
  assert.equal(await folders.pruneMissingLorebookItemIds(), 0);
  assert.equal(db._fileStore.getTableWriteGeneration("library_folders"), generation);
} finally {
  await closeApp?.();
  await closeStorage?.();
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key as keyof typeof previous];
    else process.env[key as keyof typeof previous] = value;
  }
  rmSync(dataDir, { recursive: true, force: true });
}
