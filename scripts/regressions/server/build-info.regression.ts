// Build info: reading the commit and branch a build records, and which branch an install reports.
import assert from "node:assert/strict";
import { parseBuildMeta, resolveBuildBranch } from "../../../packages/server/src/config/build-info.js";

const validBuildMeta = parseBuildMeta('{"commit":"abcdef123456","branch":"staging"}');
assert.deepEqual(validBuildMeta, { commit: "abcdef123456", branch: "staging" });
assert.equal(parseBuildMeta('{"commit":"abcdef123456","branch":42}'), null);
assert.equal(parseBuildMeta(undefined), null);
assert.equal(resolveBuildBranch(undefined, validBuildMeta?.branch, "main"), "staging");
assert.equal(
  resolveBuildBranch(undefined, parseBuildMeta(undefined)?.branch, "refs/heads/feature/test"),
  "feature/test",
);
