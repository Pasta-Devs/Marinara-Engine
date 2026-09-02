import assert from "node:assert/strict";
import AdmZip from "adm-zip";
import { closeSync, mkdtempSync, openSync, readSync, writeSync } from "node:fs";
import { mkdtemp, mkdir, readFile, rm, stat, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildBackupRestoreNotes,
  inspectStoredBackupArchiveForRegression,
  isPermittedLargeStoredBackupEntry,
  limitAutomaticBackupOmissionHistory,
  readStoredBackupImportForRegression,
  readStoredBackupAssetForRegression,
  writeStoredBackupArchiveForRegression,
} from "../../packages/server/src/routes/backup.routes.js";
import {
  cleanupStagedProfileAssets,
  promoteStagedProfileAssets,
  stageProfileImportAssets,
} from "../../packages/server/src/services/import/profile-import-assets.js";
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
assert.equal(
  limitAutomaticBackupOmissionHistory(Array.from({ length: 1_001 }, (_, index) => `missing-${index}`)).length,
  1_000,
);
assert.deepEqual(limitAutomaticBackupOmissionHistory(["kept", 42, "also-kept"]), ["kept", "also-kept"]);
assert.equal(limitAutomaticBackupOmissionHistory(["x".repeat(256 * 1024 + 1)]).length, 0);

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
assert.equal(
  isPermittedLargeStoredBackupEntry(
    "marinara-automatic-backup/backgrounds/violet night.gif",
    0,
    376_363_985,
    376_363_985,
  ),
  true,
  "a large stored background from Marinara's own streaming backup must remain importable",
);
assert.equal(
  isPermittedLargeStoredBackupEntry(
    "marinara-automatic-backup/profile-tables/messages.jsonl",
    0,
    376_363_985,
    376_363_985,
  ),
  false,
  "large non-media backup entries must keep the untrusted per-entry ceiling",
);
assert.equal(
  isPermittedLargeStoredBackupEntry("marinara-automatic-backup/backgrounds/meta.json", 0, 376_363_985, 376_363_985),
  false,
  "a recognized directory must not make oversized metadata eligible for streaming import",
);
assert.equal(
  isPermittedLargeStoredBackupEntry("marinara-automatic-backup/backgrounds/violet night.gif", 8, 1_024, 376_363_985),
  false,
  "compressed large assets must not bypass ZIP-bomb defenses",
);
const omissionNotes = buildBackupRestoreNotes(["marinara-automatic-backup/backgrounds/missing.gif"]);
assert.match(omissionNotes, /Warning: this backup completed without the following files/u);
assert.match(omissionNotes, /marinara-automatic-backup\/backgrounds\/missing\.gif/u);

const zipFixtureRoot = mkdtempSync(join(tmpdir(), "marinara-large-backup-regression-"));
try {
  const sourcePath = join(zipFixtureRoot, "large.gif");
  const archivePath = join(zipFixtureRoot, "large.zip");
  const useReportedBackgroundSize = process.env.MARINARA_REAL_LARGE_BACKUP_REGRESSION === "1";
  const entryLimitBytes = useReportedBackgroundSize ? 256 * 1024 * 1024 : 1024 * 1024;
  const logicalSize = useReportedBackgroundSize ? 376_363_985 : entryLimitBytes + 1;
  const descriptor = openSync(sourcePath, "w");
  writeSync(descriptor, Buffer.from("GIF89a", "ascii"), 0, 6, 0);
  writeSync(descriptor, Buffer.from([0]), 0, 1, logicalSize - 1);
  closeSync(descriptor);
  await writeStoredBackupArchiveForRegression(
    archivePath,
    [
      {
        entryName: "marinara-automatic-backup/backgrounds/large.gif",
        filePath: sourcePath,
        size: logicalSize,
        tolerateSourceChanges: true,
      },
    ],
    { entryLimitBytes },
  );
  const archiveSize = (await stat(archivePath)).size;
  assert.ok(archiveSize > logicalSize, "the streamed media entry above the ordinary limit should produce a valid ZIP");
  const archiveHandle = openSync(archivePath, "r");
  const end = Buffer.alloc(22);
  readSync(archiveHandle, end, 0, end.length, archiveSize - end.length);
  closeSync(archiveHandle);
  assert.equal(end.readUInt32LE(0), 0x06054b50);
  assert.equal(end.readUInt16LE(8), 1);
  const restoredAsset = await readStoredBackupAssetForRegression(
    archivePath,
    "marinara-automatic-backup/backgrounds/large.gif",
    entryLimitBytes,
  );
  const restoreRoot = join(zipFixtureRoot, "restored");
  const largeStage = await stageProfileImportAssets(
    restoreRoot,
    [
      {
        path: "backgrounds/large.gif",
        expectedSize: restoredAsset.expectedSize,
        read: restoredAsset.read,
      },
    ],
    logicalSize * 2,
  );
  await promoteStagedProfileAssets(largeStage);
  assert.equal(
    (await stat(join(restoreRoot, "backgrounds", "large.gif"))).size,
    logicalSize,
    "a production backup entry above the ordinary limit must restore through the production streaming importer",
  );
  await cleanupStagedProfileAssets(largeStage);

  const zip64ManifestPath = join(zipFixtureRoot, "marinara-profile.json");
  const zip64RestorePath = join(zipFixtureRoot, "RESTORE.txt");
  const zip64Archive = join(zipFixtureRoot, "full-backup-zip64.zip");
  await writeFile(
    zip64ManifestPath,
    JSON.stringify({
      type: "marinara_profile",
      version: 1,
      exportedAt: "2026-08-13T00:00:00.000Z",
      data: {
        fileStorage: {
          version: 2,
          tables: {},
          files: [{ path: "backgrounds/large.gif", size: logicalSize }],
        },
      },
    }),
  );
  await writeFile(zip64RestorePath, buildBackupRestoreNotes());
  const zip64ManifestSize = (await stat(zip64ManifestPath)).size;
  const zip64RestoreSize = (await stat(zip64RestorePath)).size;
  await writeStoredBackupArchiveForRegression(
    zip64Archive,
    [
      {
        entryName: "marinara-automatic-backup/marinara-profile.json",
        filePath: zip64ManifestPath,
        size: zip64ManifestSize,
      },
      {
        entryName: "marinara-automatic-backup/backgrounds/large.gif",
        filePath: sourcePath,
        size: logicalSize,
        tolerateSourceChanges: true,
      },
      {
        entryName: "marinara-automatic-backup/RESTORE.txt",
        filePath: zip64RestorePath,
        size: zip64RestoreSize,
      },
    ],
    {
      entryLimitBytes: Math.max(zip64ManifestSize, zip64RestoreSize),
      unlimitedArchiveSize: true,
      forceZip64: true,
    },
  );
  const zip64Inspection = await inspectStoredBackupArchiveForRegression(zip64Archive);
  assert.equal(zip64Inspection.isFullBackup, true, "a stored ZIP64 full backup must receive the restore policy");
  assert.equal(zip64Inspection.entries.length, 3);
  assert.equal(
    new AdmZip(zip64Archive).test(),
    true,
    "the streamed ZIP64 backup must be readable by standard ZIP tools",
  );
  const zip64Import = await readStoredBackupImportForRegression(zip64Archive, "backgrounds/large.gif");
  assert.equal(zip64Import.isFullBackup, true);
  assert.ok(zip64Import.asset && !Buffer.isBuffer(zip64Import.asset));
  const zip64Restore = await stageProfileImportAssets(join(zipFixtureRoot, "zip64-restored"), [
    { path: "backgrounds/large.gif", expectedSize: logicalSize, read: () => zip64Import.asset },
  ]);
  try {
    await promoteStagedProfileAssets(zip64Restore);
    assert.equal((await stat(join(zipFixtureRoot, "zip64-restored", "backgrounds", "large.gif"))).size, logicalSize);
  } finally {
    await cleanupStagedProfileAssets(zip64Restore);
  }

  const manyEntriesSource = join(zipFixtureRoot, "empty-entry.json");
  const manyEntriesArchive = join(zipFixtureRoot, "many-entries.zip");
  await writeFile(manyEntriesSource, "");
  await writeStoredBackupArchiveForRegression(
    manyEntriesArchive,
    Array.from({ length: 8_193 }, (_, index) => ({
      entryName: `storage/entries/${String(index).padStart(4, "0")}.json`,
      filePath: manyEntriesSource,
      size: 0,
    })),
  );
  assert.equal(
    (await inspectStoredBackupArchiveForRegression(manyEntriesArchive)).entries.length,
    8_193,
    "profile archives must not fail at the former artificial 8,192-entry ceiling",
  );

  const retainedSource = join(zipFixtureRoot, "retained.gif");
  const missingSource = join(zipFixtureRoot, "missing.gif");
  const partialArchive = join(zipFixtureRoot, "partial.zip");
  const retainedGif = Buffer.concat([Buffer.from("GIF89a", "ascii"), Buffer.alloc(32, 0x2a)]);
  await writeFile(retainedSource, retainedGif);
  const partialResult = await writeStoredBackupArchiveForRegression(
    partialArchive,
    [
      {
        entryName: "marinara-automatic-backup/backgrounds/retained.gif",
        filePath: retainedSource,
        size: retainedGif.length,
      },
      {
        entryName: "marinara-automatic-backup/backgrounds/missing.gif",
        filePath: missingSource,
        size: 10,
        tolerateSourceChanges: true,
      },
      {
        entryName: "marinara-automatic-backup/backgrounds/../invalid.gif",
        filePath: retainedSource,
        size: retainedGif.length,
        tolerateSourceChanges: true,
      },
      {
        entryName: "marinara-automatic-backup/storage/oversized.data",
        filePath: sourcePath,
        size: logicalSize,
        tolerateSourceChanges: true,
      },
    ],
    { skipFailedFileEntries: true, entryLimitBytes },
  );
  assert.deepEqual(partialResult.omittedEntries.sort(), [
    "marinara-automatic-backup/backgrounds/../invalid.gif",
    "marinara-automatic-backup/backgrounds/missing.gif",
    "marinara-automatic-backup/storage/oversized.data",
  ]);
  const partialSize = (await stat(partialArchive)).size;
  const partialHandle = openSync(partialArchive, "r");
  const partialEnd = Buffer.alloc(22);
  readSync(partialHandle, partialEnd, 0, partialEnd.length, partialSize - partialEnd.length);
  closeSync(partialHandle);
  assert.equal(partialEnd.readUInt32LE(0), 0x06054b50);
  assert.equal(
    partialEnd.readUInt16LE(8),
    1,
    "unreadable assets and oversized non-media must be omitted without losing valid entries",
  );
  const retainedAsset = await readStoredBackupAssetForRegression(
    partialArchive,
    "marinara-automatic-backup/backgrounds/retained.gif",
  );
  const partialRestore = await stageProfileImportAssets(
    join(zipFixtureRoot, "partial-restored"),
    [{ path: "backgrounds/retained.gif", expectedSize: retainedAsset.expectedSize, read: retainedAsset.read }],
    1024 * 1024,
  );
  await promoteStagedProfileAssets(partialRestore);
  assert.deepEqual(
    await readFile(join(zipFixtureRoot, "partial-restored", "backgrounds", "retained.gif")),
    retainedGif,
    "a strict file entry must retain a valid single-pass CRC when other sources are omitted",
  );
  await cleanupStagedProfileAssets(partialRestore);
  const mismatchedStoredArchive = join(zipFixtureRoot, "mismatched-stored-size.zip");
  const mismatchedStoredBytes = await readFile(partialArchive);
  const endOffset = mismatchedStoredBytes.length - 22;
  const centralDirectoryOffset = mismatchedStoredBytes.readUInt32LE(endOffset + 16);
  const storedSize = mismatchedStoredBytes.readUInt32LE(centralDirectoryOffset + 20);
  mismatchedStoredBytes.writeUInt32LE(storedSize - 1, centralDirectoryOffset + 20);
  await writeFile(mismatchedStoredArchive, mismatchedStoredBytes);
  await assert.rejects(
    readStoredBackupAssetForRegression(mismatchedStoredArchive, "marinara-automatic-backup/backgrounds/retained.gif"),
    /stored entry size does not match/u,
    "a stored asset must not stream beyond the compressed range declared by its ZIP entry",
  );
  await assert.rejects(
    writeStoredBackupArchiveForRegression(
      join(zipFixtureRoot, "invalid-name.zip"),
      [
        {
          entryName: "marinara-automatic-backup/backgrounds/../invalid.gif",
          filePath: retainedSource,
          size: retainedGif.length,
        },
      ],
      { skipFailedFileEntries: true, entryLimitBytes },
    ),
    /Invalid profile ZIP entry name/u,
    "strict exports must continue rejecting invalid entry names",
  );
  await assert.rejects(
    writeStoredBackupArchiveForRegression(
      join(zipFixtureRoot, "invalid-direct.zip"),
      [
        {
          entryName: "storage/oversized.data",
          filePath: sourcePath,
          size: logicalSize,
        },
      ],
      { entryLimitBytes },
    ),
    /too large for profile ZIP import\/export/u,
    "a strict profile export must fail instead of emitting a non-media entry its importer rejects",
  );
} finally {
  await rm(zipFixtureRoot, { recursive: true, force: true });
}

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
