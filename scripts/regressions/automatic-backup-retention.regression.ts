import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  AUTOMATIC_BACKUP_FILENAME,
  automaticBackupArchiveFilename,
  isAutomaticBackupFilename,
  listAutomaticBackupFiles,
  normalizeAutomaticBackupRetentionCount,
  parseAutomaticBackupRetentionCount,
  pruneAutomaticBackupFiles,
} from "../../packages/server/src/services/backup/automatic-backup-retention.js";

assert.equal(parseAutomaticBackupRetentionCount(1), 1);
assert.equal(parseAutomaticBackupRetentionCount(9_999), 9_999);
assert.equal(parseAutomaticBackupRetentionCount(0), null);
assert.equal(parseAutomaticBackupRetentionCount(10_000), null);
assert.equal(parseAutomaticBackupRetentionCount(3.5), null);
assert.equal(parseAutomaticBackupRetentionCount("3"), null);
assert.equal(normalizeAutomaticBackupRetentionCount(undefined), 1);
assert.equal(normalizeAutomaticBackupRetentionCount(0), 1);
assert.equal(normalizeAutomaticBackupRetentionCount(10_000), 9_999);
assert.equal(normalizeAutomaticBackupRetentionCount(3.9), 3);

const backupRouteSource = await readFile(
  new URL("../../packages/server/src/routes/backup.routes.ts", import.meta.url),
  "utf8",
);
assert.match(
  backupRouteSource,
  /withAutomaticBackupLifecycleLock\(\(\) =>\s*writeAutomaticBackup\(app, settings\.retentionCount\)/u,
);
assert.match(
  backupRouteSource,
  /withAutomaticBackupLifecycleLock\(\(\) =>\s*pruneAutomaticBackupFiles\(backupsRoot, next\.retentionCount\)/u,
);

const timestampedName = automaticBackupArchiveFilename(new Date("2026-07-27T20:00:00.000Z"));
assert.equal(timestampedName, "marinara-automatic-backup-2026-07-27T20-00-00-000Z.zip");
assert.equal(isAutomaticBackupFilename(AUTOMATIC_BACKUP_FILENAME), true);
assert.equal(isAutomaticBackupFilename(timestampedName), true);
assert.equal(
  isAutomaticBackupFilename(automaticBackupArchiveFilename(new Date("2026-07-27T20:00:00.000Z"), "a1b2c3d4")),
  true,
);
assert.equal(isAutomaticBackupFilename(`${AUTOMATIC_BACKUP_FILENAME}.pending`), false);
assert.equal(isAutomaticBackupFilename("marinara-backup-manual.zip"), false);

const fixtureRoot = await mkdtemp(join(tmpdir(), "marinara-automatic-retention-regression-"));
try {
  const automaticFiles = [
    AUTOMATIC_BACKUP_FILENAME,
    automaticBackupArchiveFilename(new Date("2026-07-26T20:00:00.000Z")),
    automaticBackupArchiveFilename(new Date("2026-07-25T20:00:00.000Z")),
    automaticBackupArchiveFilename(new Date("2026-07-24T20:00:00.000Z")),
    automaticBackupArchiveFilename(new Date("2026-07-23T20:00:00.000Z")),
  ];
  for (const [index, filename] of automaticFiles.entries()) {
    const path = join(fixtureRoot, filename);
    await writeFile(path, filename, "utf8");
    const modifiedAt = new Date(Date.UTC(2026, 6, 27 - index, 20, 0, 0));
    await utimes(path, modifiedAt, modifiedAt);
  }

  const manualFile = join(fixtureRoot, "marinara-backup-manual.zip");
  const pendingFile = join(fixtureRoot, `${AUTOMATIC_BACKUP_FILENAME}.pending`);
  const manualDirectory = join(fixtureRoot, "marinara-backup-2026-07-27");
  await writeFile(manualFile, "manual", "utf8");
  await writeFile(pendingFile, "pending", "utf8");
  await mkdir(manualDirectory);
  await writeFile(join(manualDirectory, "RESTORE.txt"), "manual directory backup", "utf8");

  const removed = await pruneAutomaticBackupFiles(fixtureRoot, 3);
  assert.deepEqual(
    removed.sort(),
    automaticFiles.slice(3).sort(),
    "only the oldest excess automatic archives should be pruned",
  );
  assert.deepEqual(
    (await listAutomaticBackupFiles(fixtureRoot)).map((file) => file.filename),
    automaticFiles.slice(0, 3),
  );
  assert.equal(await readFile(manualFile, "utf8"), "manual");
  assert.equal(await readFile(pendingFile, "utf8"), "pending");
  assert.equal(await readFile(join(manualDirectory, "RESTORE.txt"), "utf8"), "manual directory backup");
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}

console.log("Automatic backup retention regression passed.");
