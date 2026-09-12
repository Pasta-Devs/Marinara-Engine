import assert from "node:assert/strict";
import AdmZip from "adm-zip";
import fs from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Fastify from "../../packages/server/node_modules/fastify/fastify.js";

const root = await fs.mkdtemp(join(tmpdir(), "marinara-backup-space-"));
const oldDataDir = process.env.DATA_DIR;
const oldStorageDir = process.env.FILE_STORAGE_DIR;
process.env.DATA_DIR = root;
process.env.FILE_STORAGE_DIR = join(root, "storage");
const originalStatfs = fs.statfs;
let freeBytes = 0;
let spaceChecks = 0;
Object.assign(fs, {
  statfs: async (path: string) => {
    assert.equal(path, join(root, "backups"));
    spaceChecks++;
    const actual = await originalStatfs(path);
    return { ...actual, bsize: 1, bavail: freeBytes };
  },
});
syncBuiltinESMExports();
const app = Fastify();
let closeDb: (() => Promise<void>) | undefined;
try {
  const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
  closeDb = closeDB;
  app.decorate("db", await getDB());
  const { backupRoutes } = await import("../../packages/server/src/routes/backup.routes.js");
  const backups = join(root, "backups");
  await fs.mkdir(backups, { recursive: true });
  const previousPath = join(backups, "marinara-automatic-backup.zip");
  const previous = new AdmZip();
  previous.addFile("RESTORE.txt", Buffer.from("Previous backup"));
  const previousBytes = previous.toBuffer();
  await fs.writeFile(previousPath, previousBytes);
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
  console.info(
    "Automatic backup refuses insufficient space, preserves the previous archive, and succeeds after space is freed.",
  );
} finally {
  await app.close();
  await closeDb?.();
  Object.assign(fs, { statfs: originalStatfs });
  syncBuiltinESMExports();
  if (oldDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = oldDataDir;
  if (oldStorageDir === undefined) delete process.env.FILE_STORAGE_DIR;
  else process.env.FILE_STORAGE_DIR = oldStorageDir;
  await fs.rm(root, { recursive: true, force: true });
}
