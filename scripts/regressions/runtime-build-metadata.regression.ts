import assert from "node:assert/strict";
import { isRuntimeBuildCurrent } from "../../packages/client/src/lib/runtime-build.js";

assert.equal(isRuntimeBuildCurrent("2.4.6", "2.4.6", { version: "2.4.6", build: "2.4.6+abc" }), true);
assert.equal(isRuntimeBuildCurrent("2.4.6", "2.4.6", { version: "2.4.7", build: "2.4.7+abc" }), false);
assert.equal(isRuntimeBuildCurrent("2.4.6", "2.4.6+old", { version: "2.4.6", build: "2.4.6+new" }), false);
assert.equal(isRuntimeBuildCurrent("2.4.6", "2.4.6+abc", { version: "2.4.6" }), true);
