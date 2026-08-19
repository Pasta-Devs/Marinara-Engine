import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildPreparedBackupDownloadUrl,
  isPreparedBackupDownloadTokenValid,
} from "../../packages/server/src/routes/backup.routes.js";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
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
assert.match(handlerSource, /window\.location\.assign\(status\.downloadUrl\)/u);
assert.doesNotMatch(handlerSource, /\.blob\(\)|createObjectURL|showSaveFilePicker/u);

console.log("Backup download handoff regression passed.");
