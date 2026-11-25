// Downloading a backup: the server prepares the archive as a job, the Settings panel polls its status and hands the
// browser a one-time link, and the file downloads once. Closing the server while a job is still preparing waits for
// it, then removes its temporary files. The Settings panel side and the HEAD rule read source.
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import AdmZip from "adm-zip";
import Fastify from "../../../packages/server/node_modules/fastify/fastify.js";
import { createImageTagDatasetStore } from "../../../packages/server/src/services/image-tags/datasets.js";
import {
  cleanupStagedProfileAssets,
  promoteStagedProfileAssets,
  stageProfileImportAssets,
} from "../../../packages/server/src/services/import/profile-import-assets.js";
import { getDataDir } from "../../../packages/server/src/utils/data-dir.js";
import {
  backupRoutes,
  buildPreparedBackupDownloadUrl,
  isPreparedBackupDownloadTokenValid,
} from "../../../packages/server/src/routes/backup.routes.js";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const jobId = "job/id";
const token = "token+value";

assert.equal(buildPreparedBackupDownloadUrl(jobId, token), "/api/backup/download/file/job%2Fid?token=token%2Bvalue");
assert.equal(isPreparedBackupDownloadTokenValid(token, token), true);
assert.equal(isPreparedBackupDownloadTokenValid(token, "wrong-token"), false);
assert.equal(isPreparedBackupDownloadTokenValid(token, undefined), false);

const settingsPanelSource = readFileSync(
  join(repositoryRoot, "packages/client/src/components/panels/SettingsPanel.tsx"),
  "utf8",
);
const backupRoutesSource = readFileSync(join(repositoryRoot, "packages/server/src/routes/backup.routes.ts"), "utf8");
assert.match(
  backupRoutesSource,
  /"\/download\/file\/:jobId",\s*\{ exposeHeadRoute: false,/u,
  "HEAD requests must not consume the one-time prepared backup job",
);
const handlerStart = settingsPanelSource.indexOf("const handleCreateBackup = async () =>");
const handlerEnd = settingsPanelSource.indexOf("const { data: backups }", handlerStart);
assert.ok(handlerStart >= 0 && handlerEnd > handlerStart);
const handlerSource = settingsPanelSource.slice(handlerStart, handlerEnd);
assert.match(handlerSource, /\/backup\/download\/status\/\$\{encodeURIComponent\(started\.jobId\)\}/u);
assert.match(handlerSource, /window\.location\.assign\(status\.downloadUrl\)/u);
assert.doesNotMatch(handlerSource, /\.blob\(\)|createObjectURL|showSaveFilePicker/u);

// Each job prepares its archive in its own temporary folder.
const jobFolders = () => readdirSync(tmpdir()).filter((name) => name.startsWith("marinara-backup-download-"));
const { getDB, closeDB } = await import("../../../packages/server/src/db/connection.js");
const app = Fastify();
let preparingFolder: string | undefined;
try {
  app.decorate("db", await getDB());
  await app.register(backupRoutes, { prefix: "/api/backup" });
  await app.ready();

  const datasets = createImageTagDatasetStore(getDataDir());
  const imported = await datasets.importCsv(Buffer.from("cat_ears,0,10,nekomimi\npainter,1,5,"), {
    originalName: "backup-tags.csv",
  });
  const savedDataset = await datasets.update(imported.id, { enabled: false, enabledCategories: [0] });
  const datasetPath = `image-tag-datasets/${imported.id}.json`;
  const datasetBytes = readFileSync(join(getDataDir(), datasetPath));

  const started = await app.inject({ method: "POST", url: "/api/backup/download/start" });
  assert.equal(started.statusCode, 202, started.body);
  const { jobId: startedJobId } = started.json() as { jobId: string };
  let status: { status: string; downloadUrl?: string; error?: string } = { status: "preparing" };
  for (let attempt = 0; attempt < 400 && status.status === "preparing"; attempt += 1) {
    if (attempt > 0) await new Promise((done) => setTimeout(done, 50));
    const response = await app.inject({
      method: "GET",
      url: `/api/backup/download/status/${encodeURIComponent(startedJobId)}`,
    });
    assert.equal(response.statusCode, 200, response.body);
    status = response.json();
  }
  assert.equal(status.status, "ready", JSON.stringify(status));
  assert.ok(status.downloadUrl, "a ready job gives the browser its download link");

  const file = await app.inject({ method: "GET", url: status.downloadUrl });
  assert.equal(file.statusCode, 200, file.body);
  assert.equal(file.headers["content-type"], "application/zip");
  assert.equal(file.rawPayload.subarray(0, 2).toString("latin1"), "PK", "the download is a ZIP archive");

  // The real streamed backup includes the source artifact, and profile-asset staging restores its switches too.
  const archive = new AdmZip(file.rawPayload);
  const datasetEntry = archive.getEntries().find((entry) => entry.entryName.endsWith(`/${datasetPath}`));
  assert.ok(datasetEntry, "downloaded backups include image tag datasets");
  assert.deepEqual(datasetEntry.getData(), datasetBytes);
  const restoredDataDir = mkdtempSync(join(tmpdir(), "marinara-backup-tags-restored-"));
  try {
    const staged = await stageProfileImportAssets(
      restoredDataDir,
      [
        {
          path: datasetPath,
          expectedSize: datasetBytes.length,
          read: () => datasetEntry.getData(),
        },
      ],
      1024 * 1024,
    );
    try {
      assert.deepEqual(staged.skipped, []);
      await promoteStagedProfileAssets(staged);
      const restoredDatasets = createImageTagDatasetStore(restoredDataDir);
      assert.deepEqual(await restoredDatasets.list(), { sources: [savedDataset], unavailableSources: [] });
      assert.equal((await restoredDatasets.search({ queries: ["cat"] })).status, "disabled");
      await restoredDatasets.update(imported.id, { enabled: true });
      const searched = await restoredDatasets.search({ queries: ["nekomimi", "painter"], mode: "exact" });
      assert.equal(searched.results[0]?.matches[0]?.canonicalName, "cat_ears");
      assert.equal(searched.results[1]?.totalMatches, 0, "the restored disabled artist category stays excluded");
    } finally {
      await cleanupStagedProfileAssets(staged);
    }
  } finally {
    rmSync(restoredDataDir, { recursive: true, force: true });
  }

  const again = await app.inject({ method: "GET", url: status.downloadUrl });
  assert.equal(again.statusCode, 404, "a prepared backup downloads only once");

  // Only this job's folder counts: another download on this machine can add or remove folders with the same prefix.
  const foldersBefore = new Set(jobFolders());
  const preparing = await app.inject({ method: "POST", url: "/api/backup/download/start" });
  assert.equal(preparing.statusCode, 202, preparing.body);
  assert.equal((preparing.json() as { status: string }).status, "preparing");
  const newFolders = jobFolders().filter((name) => !foldersBefore.has(name));
  assert.equal(newFolders.length, 1, `the preparing job made one temporary folder: ${newFolders.join(", ")}`);
  preparingFolder = newFolders[0];
} finally {
  await app.close();
  await closeDB();
}
assert.equal(
  jobFolders().includes(preparingFolder!),
  false,
  "closing the server waits for the preparing job, then removes its temporary folder",
);

console.log("Backup download handoff regression passed.");
