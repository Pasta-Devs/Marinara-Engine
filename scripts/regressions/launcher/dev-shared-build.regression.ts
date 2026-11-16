// Which shared-package build the dev launcher runs: the one that keeps the existing build output when
// DEV_PRESERVE_SHARED_DIST is set.
import assert from "node:assert/strict";
import { resolveDevSharedBuildScript } from "../../dev-shared-build.mjs";

assert.equal(resolveDevSharedBuildScript({ DEV_PRESERVE_SHARED_DIST: "true" }), "build:preserve");
assert.equal(resolveDevSharedBuildScript({}), "build");
