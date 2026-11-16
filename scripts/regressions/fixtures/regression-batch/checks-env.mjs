// Run after changes-env.mjs in one batch: passes only when the batch put the environment and directory back.
import assert from "node:assert/strict";
import { basename } from "node:path";

assert.equal(process.env.REGRESSION_BATCH_PROBE, undefined);
assert.ok(process.env.DATA_DIR, "the runner's throwaway DATA_DIR is back");
assert.equal(basename(process.cwd()), "server", "the working directory is packages/server again");
