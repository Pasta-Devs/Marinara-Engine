// Automatic backups through the real backup routes: a backup that won't fit is refused up front and keeps the previous
// archive, the hourly check never starts a second backup while one is running, a missing archive is made again as
// soon as the settings are saved, and a data-folder file that disappears mid-backup is left out instead of failing it.
import assert from "node:assert/strict";
import AdmZip from "adm-zip";
import fs from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mock } from "node:test";
import Fastify from "../../../packages/server/node_modules/fastify/fastify.js";

const root = await fs.mkdtemp(join(tmpdir(), "marinara-backup-space-"));
const oldDataDir = process.env.DATA_DIR;
const oldStorageDir = process.env.FILE_STORAGE_DIR;
process.env.DATA_DIR = root;
process.env.FILE_STORAGE_DIR = join(root, "storage");
const originalStatfs = fs.statfs;
let freeBytes = 0;
let spaceChecks = 0;
// The free-space check runs after the backup has listed its files and before it writes any of them.
let onSpaceCheck: (() => Promise<unknown>) | undefined;
Object.assign(fs, {
  statfs: async (path: string) => {
    assert.equal(path, join(root, "backups"));
    spaceChecks++;
    await onSpaceCheck?.();
    const actual = await originalStatfs(path);
    return { ...actual, bsize: 1, bavail: freeBytes };
  },
});
syncBuiltinESMExports();
const app = Fastify();
let closeDb: (() => Promise<void>) | undefined;
try {
  const { getDB, closeDB } = await import("../../../packages/server/src/db/connection.js");
  closeDb = closeDB;
  app.decorate("db", await getDB());
  const { backupRoutes } = await import("../../../packages/server/src/routes/backup.routes.js");
  const { AUTOMATIC_BACKUP_FREE_SPACE_HEADROOM_BYTES } =
    await import("../../../packages/server/src/services/backup/automatic-backup-retention.js");
  const backups = join(root, "backups");
  await fs.mkdir(backups, { recursive: true });
  const previousPath = join(backups, "marinara-automatic-backup.zip");
  const previous = new AdmZip();
  previous.addFile("RESTORE.txt", Buffer.from("Previous backup"));
  const previousBytes = previous.toBuffer();
  await fs.writeFile(previousPath, previousBytes);
  const avatars = join(root, "avatars");
  await fs.mkdir(avatars, { recursive: true });
  const steadyBytes = Buffer.from("steady avatar");
  await fs.writeFile(join(avatars, "steady.png"), steadyBytes);
  const changingPath = join(avatars, "changing.png");
  await fs.writeFile(changingPath, Buffer.from("avatar that is deleted mid-backup"));
  // The hourly check is a timer, so the test fires it by hand.
  mock.timers.enable({ apis: ["setInterval"] });
  await app.register(backupRoutes, { prefix: "/api/backup" });
  await app.ready();
  const settings = async () => (await app.inject({ method: "GET", url: "/api/backup/automatic" })).json();
  const enable = async (enabled: boolean) => {
    const response = await app.inject({
      method: "PUT",
      url: "/api/backup/automatic",
      payload: { enabled, frequency: "daily", retentionCount: 1 },
    });
    assert.equal(response.statusCode, 200, response.body);
  };
  const waitFor = async (predicate: (value: any) => boolean) => {
    for (let attempt = 0; attempt < 100; attempt++) {
      const value = await settings();
      if (predicate(value)) return value;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    assert.fail("Automatic backup did not settle");
  };

  // Hold the first backup at its free-space check, then fire the hourly check while it waits there.
  let releaseSpaceCheck = () => {};
  const spaceCheckHeld = new Promise<void>((resolve) => (releaseSpaceCheck = resolve));
  onSpaceCheck = () => spaceCheckHeld;
  await enable(true);
  for (let attempt = 0; spaceChecks === 0; attempt++) {
    if (attempt === 400) assert.fail("The first automatic backup never reached its free-space check");
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  mock.timers.tick(60 * 60 * 1000);
  // Give a second backup, if one started, time to queue behind the first.
  await new Promise((resolve) => setTimeout(resolve, 50));
  onSpaceCheck = undefined;
  releaseSpaceCheck();
  await waitFor((value) => typeof value.lastError === "string");
  // Saving settings waits behind any backup still queued, so the count below is final.
  await enable(false);
  assert.equal(spaceChecks, 1, "the hourly check must not start a second backup while one is running");
  spaceChecks = 0;

  await enable(true);
  const refused = await waitFor((value) => typeof value.lastError === "string");
  assert.match(refused.lastError, /Not enough free space/u);
  assert.equal(refused.lastBackupAt, null);
  assert.equal(refused.backupExists, true);
  assert.equal(spaceChecks, 1);
  assert.deepEqual(await fs.readFile(previousPath), previousBytes);
  assert.deepEqual(
    await fs.readdir(backups),
    ["marinara-automatic-backup.zip"],
    "no partial archive or rotation after refusal",
  );

  await enable(false);
  freeBytes = 1024 ** 4;
  await enable(true);
  const saved = await waitFor((value) => !!value.lastBackupAt);
  assert.equal(saved.lastError, null);
  assert.equal(saved.backupExists, true);
  assert.equal(spaceChecks, 2);
  const archives = await fs.readdir(backups);
  assert.equal(archives.length, 1);
  const bytes = await fs.readFile(join(backups, archives[0]!));
  assert.equal(bytes.readUInt32LE(0), 0x04034b50, "available space permits a real ZIP write");
  assert.notDeepEqual(bytes, previousBytes);
  assert.ok(new AdmZip(bytes).getEntries().some((entry) => entry.entryName.endsWith("/RESTORE.txt")));

  await enable(false);
  freeBytes = bytes.length + AUTOMATIC_BACKUP_FREE_SPACE_HEADROOM_BYTES - 1;
  await enable(true);
  const boundaryRefusal = await waitFor((value) => typeof value.lastError === "string");
  assert.match(boundaryRefusal.lastError, /Not enough free space/u);
  assert.equal(spaceChecks, 3);
  assert.deepEqual(await fs.readFile(join(backups, archives[0]!)), bytes, "metadata counts toward the space budget");
  assert.deepEqual(await fs.readdir(backups), archives, "boundary refusal leaves no pending ZIP or rotation");

  // Backups are still on and the last one is recent, so none is due. Deleting the archive makes saving the settings
  // run one at once. During it, an avatar is deleted after the backup listed it.
  freeBytes = 1024 ** 4;
  await fs.rm(join(backups, archives[0]!));
  onSpaceCheck = () => fs.rm(changingPath);
  await enable(true);
  const repaired = await waitFor(
    (value) => value.lastBackupAt !== saved.lastBackupAt || typeof value.lastError === "string",
  );
  onSpaceCheck = undefined;
  assert.equal(repaired.lastError, null, "a file deleted mid-backup must not fail the backup");
  assert.equal(repaired.backupExists, true, "a missing archive is made again when the settings are saved");
  assert.deepEqual(repaired.lastOmittedEntries, ["marinara-automatic-backup/avatars/changing.png"]);
  assert.equal(spaceChecks, 4);
  const repairedBytes = await fs.readFile(join(backups, archives[0]!));
  const repairedZip = new AdmZip(repairedBytes);
  assert.equal(repairedZip.getEntry("marinara-automatic-backup/avatars/changing.png"), null);
  const steady = repairedZip.getEntry("marinara-automatic-backup/avatars/steady.png");
  assert.ok(steady);
  assert.deepEqual(steady.getData(), steadyBytes);
  // A data-folder file's size and checksum are written after its data, from the bytes actually read. ZIP flag bit 3
  // tells readers to look there, in both the file's own header and the archive's directory.
  assert.equal(repairedBytes.readUInt16LE(steady.header.offset + 6) & 0x08, 0x08, "local header flag bit 3");
  assert.equal(steady.header.flags & 0x08, 0x08, "directory flag bit 3");
  console.info(
    "Automatic backup includes ZIP metadata in its space budget, preserves the previous archive, succeeds after space is freed, never overlaps, remakes a missing archive and survives a file deleted mid-backup.",
  );
} finally {
  await app.close();
  await closeDb?.();
  mock.timers.reset();
  Object.assign(fs, { statfs: originalStatfs });
  syncBuiltinESMExports();
  if (oldDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = oldDataDir;
  if (oldStorageDir === undefined) delete process.env.FILE_STORAGE_DIR;
  else process.env.FILE_STORAGE_DIR = oldStorageDir;
  await fs.rm(root, { recursive: true, force: true });
}
