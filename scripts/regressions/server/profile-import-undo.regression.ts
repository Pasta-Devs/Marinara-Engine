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
// Windows refuses to move a file another program holds open; one case makes moving the old copy fail.
const originalRename = fs.rename;
let copyBusy = false;
Object.assign(fs, {
  statfs: async (path: string) => ({ ...(await originalStatfs(path)), bsize: 1, bavail: freeBytes }),
  rename: async (from: string, to: string) => {
    if (copyBusy && String(to).endsWith("marinara-before-import.zip.previous")) {
      throw Object.assign(new Error("resource busy"), { code: "EBUSY" });
    }
    return originalRename(from, to);
  },
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
const sources = join(root, "knowledge-sources");
const readSource = (name: string) => fs.readFile(join(sources, name), "utf8");
const writeSource = (name: string, text: string) => fs.writeFile(join(sources, name), text);
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
  assert.equal(preview.json().undoable, true, "a current profile can be undone");
  return app.inject({
    method: "POST",
    url: "/api/backup/import-profile",
    headers: { "x-profile-preview-token": preview.json().previewToken },
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
  assert.deepEqual(await fs.readdir(backups).catch(() => []), [], "no safety copy or partial file");

  // With room, the import reverts Ada, and the copy from just before it is offered for undo.
  freeBytes = 1024 ** 4;
  assert.equal((await importProfile(exported.body)).statusCode, 200);
  assert.equal(await descriptionOf(ada), "old", "the import replaced the newer version");
  assert.equal(await readSource("notes.txt"), "old", "the import replaced the newer file");
  const offered = await undoOffer();
  assert.equal(offered.available, true);
  assert.ok(!Number.isNaN(Date.parse(offered.savedAt)), "savedAt is a date");

  // A later import refused for space leaves this import's undo in place.
  freeBytes = 0;
  assert.notEqual((await importProfile(exported.body)).statusCode, 200);
  assert.deepEqual(await undoOffer(), offered, "a refused import keeps the previous undo");
  freeBytes = 1024 ** 4;

  // So does one that fails after saving its own copy: a row without an id passes the preview and
  // fails the import. The previous copy and record are back, with nothing set aside left over.
  const broken = JSON.parse(exported.body);
  broken.data.fileStorage.tables.characters = [...(broken.data.fileStorage.tables.characters ?? []), { name: "No id" }];
  assert.notEqual((await importProfile(JSON.stringify(broken))).statusCode, 200);
  assert.deepEqual(await undoOffer(), offered, "a failed import keeps the previous undo");
  assert.deepEqual((await fs.readdir(backups)).sort(), ["marinara-before-import.json", "marinara-before-import.zip"]);

  // So does one whose old copy can't be moved aside after its record was.
  copyBusy = true;
  assert.notEqual((await importProfile(exported.body)).statusCode, 200);
  copyBusy = false;
  assert.deepEqual(await undoOffer(), offered, "an import that can't move the old copy keeps the previous undo");
  assert.deepEqual((await fs.readdir(backups)).sort(), ["marinara-before-import.json", "marinara-before-import.zip"]);

  // The old copy stays on disk until the import finishes, so the space check counts it too. Room for
  // the new copy alone, but not for both, refuses the import.
  const { AUTOMATIC_BACKUP_FREE_SPACE_HEADROOM_BYTES } =
    await import("../../../packages/server/src/services/backup/automatic-backup-retention.js");
  const oldCopyBytes = (await fs.stat(safetyCopy)).size;
  freeBytes = AUTOMATIC_BACKUP_FREE_SPACE_HEADROOM_BYTES + Math.floor(oldCopyBytes * 1.5);
  const tooTight = await importProfile(exported.body);
  assert.match(tooTight.json().message, /Not enough free space for a safety copy/u);
  assert.equal(await descriptionOf(ada), "old", "the refused import changed nothing");
  assert.deepEqual(await undoOffer(), offered, "an import refused for both copies keeps the previous undo");
  freeBytes = 1024 ** 4;

  // A second import replaces the copy (and its record): undo now goes back to just before this one.
  // other.txt is in that copy but not in the file, so the import doesn't write it.
  await setDescription(ada, "newer");
  await writeSource("notes.txt", "newer");
  await writeSource("other.txt", "before import");
  assert.equal((await importProfile(exported.body)).statusCode, 200);
  assert.equal(await descriptionOf(ada), "old");
  assert.equal(await readSource("notes.txt"), "old");
  assert.deepEqual((await fs.readdir(backups)).sort(), ["marinara-before-import.json", "marinara-before-import.zip"]);

  // Bea and other.txt were not in the file. Edits to them after the import must survive the undo.
  await setDescription(bea, "edited after import");
  await writeSource("other.txt", "edited after import");
  const undone = await undo();
  assert.equal(undone.statusCode, 200, undone.body);
  assert.equal(await descriptionOf(ada), "newer", "undo put back what the last import replaced");
  assert.equal(await readSource("notes.txt"), "newer", "undo put back the file the last import replaced");
  assert.equal(await descriptionOf(bea), "edited after import", "undo left items the import didn't write alone");
  assert.equal(await readSource("other.txt"), "edited after import", "undo left files the import didn't write alone");

  // Undo works once: a second one would put the same rows back over anything edited since.
  assert.deepEqual(await undoOffer(), { available: false });
  assert.deepEqual(await fs.readdir(backups), [], "the used safety copy and its record are removed");
  assert.equal((await undo()).statusCode, 404);
  await assert.rejects(fs.stat(safetyCopy));
} finally {
  Object.assign(fs, { statfs: originalStatfs, rename: originalRename });
  syncBuiltinESMExports();
  await app.close();
  await closeDB();
  await fs.rm(root, { recursive: true, force: true });
}

console.info("Profile import undo regressions passed.");
