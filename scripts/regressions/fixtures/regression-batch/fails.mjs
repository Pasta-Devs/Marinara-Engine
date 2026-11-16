// A batch member whose check fails as it loads.
import assert from "node:assert/strict";

assert.equal(1, 2, "planted failure");
