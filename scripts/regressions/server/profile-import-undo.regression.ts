// Import Profile saves a full safety copy before it overwrites anything, refuses to import when the copy
// can't be saved, and "Undo Last Import" puts back what the import replaced.
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
  const nothingYet = await app.inject({ method: "GET", url: "/api/backup/import-profile/undo" });
  assert.deepEqual(nothingYet.json(), { available: false });
  assert.equal((await app.inject({ method: "POST", url: "/api/backup/import-profile/undo" })).statusCode, 404);

  // Last week's profile has the old description; the user has edited it since.
  const created = await characters.create({ name: "Ada", description: "old" } as any);
  const id = created!.id;
  const exported = await app.inject({ method: "GET", url: "/api/backup/export-profile" });
  assert.equal(exported.statusCode, 200, exported.body);
  await characters.update(id, { description: "new" } as any);
  assert.equal(await descriptionOf(id), "new");

  // No room for the safety copy: nothing is imported and no partial copy is left behind.
  const refused = await importProfile(exported.body);
  assert.notEqual(refused.statusCode, 200, "an import without a safety copy must not succeed");
  assert.match(refused.json().message, /Nothing was imported, because a safety copy could not be saved first/u);
  assert.match(refused.json().message, /Not enough free space for a safety copy/u);
  assert.equal(await descriptionOf(id), "new", "the refused import changed nothing");
  assert.deepEqual(await fs.readdir(backups).catch(() => []), [], "no safety copy or partial file");

  // With room, the import reverts the edit, and the copy from just before it is offered for undo.
  freeBytes = 1024 ** 4;
  const imported = await importProfile(exported.body);
  assert.equal(imported.statusCode, 200, imported.body);
  assert.equal(await descriptionOf(id), "old", "the import replaced the newer version");
  const offered = (await app.inject({ method: "GET", url: "/api/backup/import-profile/undo" })).json();
  assert.equal(offered.available, true);
  assert.ok(!Number.isNaN(Date.parse(offered.savedAt)), "savedAt is a date");
  assert.deepEqual(await fs.readdir(backups), ["marinara-before-import.zip"]);
  const copyBeforeUndo = await fs.stat(safetyCopy);

  // Undo brings the edit back and keeps the same safety copy.
  const undone = await app.inject({ method: "POST", url: "/api/backup/import-profile/undo" });
  assert.equal(undone.statusCode, 200, undone.body);
  assert.equal(await descriptionOf(id), "new", "undo put back what the import replaced");
  assert.equal((await fs.stat(safetyCopy)).mtimeMs, copyBeforeUndo.mtimeMs, "undo doesn't rewrite the safety copy");
} finally {
  Object.assign(fs, { statfs: originalStatfs });
  syncBuiltinESMExports();
  await app.close();
  await closeDB();
  await fs.rm(root, { recursive: true, force: true });
}

console.info("Profile import undo regressions passed.");
