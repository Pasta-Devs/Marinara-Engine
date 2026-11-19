// Backup route limits: the 2 GiB profile import and uncompressed size limits, the capped omission history, and
// failure reporting that survives a failing settings write. Reads route source because these need 2 GiB archives or a
// failing store to reach.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const backupRoutesSource = readFileSync(
  new URL("../../../packages/server/src/routes/backup.routes.ts", import.meta.url),
  "utf8",
);
assert.match(backupRoutesSource, /PROFILE_IMPORT_ARCHIVE_LIMIT_BYTES = 2 \* 1024 \* 1024 \* 1024/u);
assert.match(backupRoutesSource, /PROFILE_ARCHIVE_TOTAL_UNCOMPRESSED_LIMIT_BYTES = 2 \* 1024 \* 1024 \* 1024/u);
assert.match(
  backupRoutesSource,
  /lastOmittedEntries: limitAutomaticBackupOmissionHistory\(settings\.lastOmittedEntries\)/u,
);
assert.match(
  backupRoutesSource,
  /catch \(error\) \{\s*const message = getBackupErrorMessage[\s\S]*try \{[\s\S]*await saveAutomaticBackupSettings[\s\S]*catch \(settingsError\)[\s\S]*Could not persist the automatic backup failure state/u,
  "automatic-backup error reporting must not reject when its settings write also fails",
);
