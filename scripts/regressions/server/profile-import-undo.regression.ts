// Import Profile saves a full safety copy before it overwrites anything, refuses to import when the copy
// can't be saved, and "Undo Last Import" puts back only what the last import wrote.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = await fs.mkdtemp(join(tmpdir(), "marinara-profile-import-undo-"));
process.env.DATA_DIR = root;
process.env.FILE_STORAGE_DIR = join(root, "storage");
const backups = join(root, "backups");
const safetyCopy = join(backups, "marinara-before-import.zip");

// The free-space check reads statfs; the first import runs on a "full disk".
const originalStatfs = fs.statfs;
let freeBytes = 0;
Object.assign(fs, {
  statfs: async (path: string) => ({ ...(await originalStatfs(path)), bsize: 1, bavail: freeBytes }),
});
syncBuiltinESMExports();

const { getDB, closeDB } = await import("../../../packages/server/src/db/connection.js");
const { backupRoutes } = await import("../../../packages/server/src/routes/backup.routes.js");
const { createCharactersStorage } = await import("../../../packages/server/src/services/storage/characters.storage.js");
const { default: Fastify } = await import("../../../packages/server/node_modules/fastify/fastify.js");

const db = await getDB();
const characters = createCharactersStorage(db);
const app = Fastify();
app.decorate("db", db);
await app.register(backupRoutes, { prefix: "/api/backup" });
await app.ready();

const descriptionOf = async (id: string) => JSON.parse((await characters.getById(id))!.data as string).description;
const setDescription = (id: string, description: string) => characters.update(id, { description } as any);
const undoOffer = async () => (await app.inject({ method: "GET", url: "/api/backup/import-profile/undo" })).json();
const undo = () => app.inject({ method: "POST", url: "/api/backup/import-profile/undo" });
const importProfile = async (profile: string) => {
  const preview = await app.inject({
    method: "POST",
    url: "/api/backup/import-profile?preview=true",
    headers: { "content-type": "application/json" },
    payload: profile,
  });
  assert.equal(preview.statusCode, 200, preview.body);
  return app.inject({
    method: "POST",
    url: "/api/backup/import-profile",
    headers: { "x-profile-preview-token": preview.json().previewToken },
  });
};

try {
  assert.deepEqual(await undoOffer(), { available: false });
  assert.equal((await undo()).statusCode, 404);

  // Last week's profile has Ada's old description. Since then Ada was edited and Bea was created.
  const ada = (await characters.create({ name: "Ada", description: "old" } as any))!.id;
  const exported = await app.inject({ method: "GET", url: "/api/backup/export-profile" });
  assert.equal(exported.statusCode, 200, exported.body);
  await setDescription(ada, "new");
  const bea = (await characters.create({ name: "Bea", description: "before import" } as any))!.id;

  // No room for the safety copy: nothing is imported and no partial copy is left behind.
  const refused = await importProfile(exported.body);
  assert.notEqual(refused.statusCode, 200, "an import without a safety copy must not succeed");
  assert.match(refused.json().message, /Nothing was imported, because a safety copy could not be saved first/u);
  assert.match(refused.json().message, /Not enough free space for a safety copy/u);
  assert.equal(await descriptionOf(ada), "new", "the refused import changed nothing");
  assert.deepEqual(await fs.readdir(backups).catch(() => []), [], "no safety copy or partial file");

  // With room, the import reverts Ada, and the copy from just before it is offered for undo.
  freeBytes = 1024 ** 4;
  assert.equal((await importProfile(exported.body)).statusCode, 200);
  assert.equal(await descriptionOf(ada), "old", "the import replaced the newer version");
  const offered = await undoOffer();
  assert.equal(offered.available, true);
  assert.ok(!Number.isNaN(Date.parse(offered.savedAt)), "savedAt is a date");

  // A second import replaces the copy (and its record): undo now goes back to just before this one.
  await setDescription(ada, "newer");
  assert.equal((await importProfile(exported.body)).statusCode, 200);
  assert.equal(await descriptionOf(ada), "old");
  assert.deepEqual((await fs.readdir(backups)).sort(), ["marinara-before-import.json", "marinara-before-import.zip"]);

  // Bea was not in the file. An edit to her after the import must survive the undo.
  await setDescription(bea, "edited after import");
  const undone = await undo();
  assert.equal(undone.statusCode, 200, undone.body);
  assert.equal(await descriptionOf(ada), "newer", "undo put back what the last import replaced");
  assert.equal(await descriptionOf(bea), "edited after import", "undo left items the import didn't write alone");

  // Undo works once: a second one would put the same rows back over anything edited since.
  assert.deepEqual(await undoOffer(), { available: false });
  assert.deepEqual(await fs.readdir(backups), [], "the used safety copy and its record are removed");
  assert.equal((await undo()).statusCode, 404);
  await assert.rejects(fs.stat(safetyCopy));
} finally {
  Object.assign(fs, { statfs: originalStatfs });
  syncBuiltinESMExports();
  await app.close();
  await closeDB();
  await fs.rm(root, { recursive: true, force: true });
}

console.info("Profile import undo regressions passed.");
