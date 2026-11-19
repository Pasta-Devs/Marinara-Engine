// An incomplete settings blob from the server is rewritten with the newly synced preferences. Reads hook source;
// replacing this needs a browser test.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const settingsSyncSource = readFileSync(
  new URL("../../../packages/client/src/hooks/use-settings-sync.ts", import.meta.url),
  "utf8",
);
assert.match(
  settingsSyncSource,
  /hadMissingSyncedSettings[\s\S]*pickSyncedSettings\(useUIStore\.getState\(\)\)/u,
  "Incomplete server settings blobs must be rewritten with newly synced preferences",
);
