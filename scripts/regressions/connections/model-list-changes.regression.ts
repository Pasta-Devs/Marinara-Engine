import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// A proxy's saved model list remembers what changed since the list before it ("+3 new, 1 gone since Monday"),
// and a refresh that changes nothing keeps that last change.
const dir = mkdtempSync(join(tmpdir(), "marinara-model-list-changes-"));
process.env.DATA_DIR = dir;
process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "silent";

const { withModelListChanges } = await import("../../../packages/server/src/services/storage/connections.storage.js");

const list = (at: string, ids: string[]) => ({ fetchedAt: at, models: ids.map((id) => ({ id, name: id })) });

// The first list has nothing to compare with.
const first = withModelListChanges(null, list("2026-11-16T10:00:00Z", ["a", "b", "c"]));
assert.equal(first.changes, undefined);

// Three new, one gone.
const second = withModelListChanges(first, list("2026-11-23T10:00:00Z", ["a", "b", "d", "e", "f"]));
assert.deepEqual(second.changes, {
  since: "2026-11-16T10:00:00Z",
  at: "2026-11-23T10:00:00Z",
  added: ["d", "e", "f"],
  removed: ["c"],
});

// A quiet refresh keeps the last change.
const third = withModelListChanges(second, list("2026-11-23T16:00:00Z", ["a", "b", "d", "e", "f"]));
assert.deepEqual(third.changes, second.changes);
assert.equal(third.fetchedAt, "2026-11-23T16:00:00Z");

// The next real change replaces it.
const fourth = withModelListChanges(third, list("2026-11-24T10:00:00Z", ["a", "b", "d", "e"]));
assert.deepEqual(fourth.changes, {
  since: "2026-11-23T16:00:00Z",
  at: "2026-11-24T10:00:00Z",
  added: [],
  removed: ["f"],
});

console.log("model list changes: ok");
