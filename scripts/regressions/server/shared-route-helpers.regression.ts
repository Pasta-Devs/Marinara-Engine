import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Fastify from "../../../packages/server/node_modules/fastify/fastify.js";
import { z } from "../../../packages/server/node_modules/zod/index.js";

// Shared server helpers keep the exact responses the old hand-written copies sent.
const { notFound } = await import("../../../packages/server/src/utils/not-found.js");

const app = Fastify();
app.get("/missing", async (_req, reply) => notFound(reply, "Folder not found"));
try {
  const response = await app.inject({ method: "GET", url: "/missing" });
  assert.equal(response.statusCode, 404);
  assert.deepEqual(response.json(), { error: "Folder not found" });
} finally {
  await app.close();
}

const { parseJsonArray, parseJsonOrNull, parseJsonRecord } =
  await import("../../../packages/server/src/utils/large-json.js");

// Stored JSON columns: text is parsed, an already-parsed value passes through, anything else falls back.
const record = { a: 1 };
assert.equal(parseJsonRecord(record), record);
assert.deepEqual(parseJsonRecord(' {"a":1} '), { a: 1 });
for (const value of ["", "  ", "[1]", "null", "nope", "4", 4, null, undefined, [1]]) {
  assert.deepEqual(parseJsonRecord(value), {}, `parseJsonRecord(${JSON.stringify(value)})`);
}

const list = [1];
assert.equal(parseJsonArray(list), list);
assert.deepEqual(parseJsonArray(" [1,2] "), [1, 2]);
for (const value of ["", '{"a":1}', "null", "nope", 4, null, undefined, { a: 1 }]) {
  assert.deepEqual(parseJsonArray(value), [], `parseJsonArray(${JSON.stringify(value)})`);
}

assert.deepEqual(parseJsonOrNull('{"a":[1]}'), { a: [1] });
assert.equal(parseJsonOrNull("nope"), null);
assert.equal(parseJsonOrNull(""), null);
assert.equal(parseJsonOrNull(record), record);
assert.equal(parseJsonOrNull(undefined), undefined);

// Atomic writes replace the file whole and leave no temp file behind, also when the rename fails.
const { writeFileAtomic, writeFileAtomicSync } = await import("../../../packages/server/src/utils/atomic-write.js");
const scratch = await mkdtemp(join(tmpdir(), "marinara-atomic-write-"));
try {
  const target = join(scratch, "data.json");
  await writeFileAtomic(target, "old");
  await writeFileAtomic(target, "new", { mode: 0o600 });
  writeFileAtomicSync(join(scratch, "sync.json"), Buffer.from("sync"));
  assert.equal(await readFile(target, "utf8"), "new");
  assert.equal(await readFile(join(scratch, "sync.json"), "utf8"), "sync");
  if (process.platform !== "win32") assert.equal((await stat(target)).mode & 0o777, 0o600);

  const blocked = join(scratch, "blocked");
  await mkdir(blocked);
  await assert.rejects(writeFileAtomic(blocked, "x"));
  assert.throws(() => writeFileAtomicSync(blocked, "x"));
  assert.deepEqual((await readdir(scratch)).sort(), ["blocked", "data.json", "sync.json"]);
} finally {
  await rm(scratch, { recursive: true, force: true });
}

// resolveInside keeps join() results inside the root, with POSIX and Windows separators.
const { resolveInside, toSafeExportName } = await import("../../../packages/server/src/utils/security.js");
const root = join(tmpdir(), "marinara-root");
assert.equal(resolveInside(root, "a", "b.png"), join(root, "a", "b.png"));
assert.equal(resolveInside(root, "a/../b.png"), join(root, "b.png"));
assert.equal(resolveInside(root, "..foo"), join(root, "..foo"));
for (const segments of [[".."], ["../x"], ["a", "../../x"], ["a/../../x"]]) {
  assert.throws(() => resolveInside(root, ...segments), /escapes/, `resolveInside(root, ${segments.join(", ")})`);
}
assert.equal(resolveInside("C:\\data", "a\\b.png"), "C:\\data\\a\\b.png");
for (const segment of ["..\\x", "a\\..\\..\\x", "..\\..\\Windows"]) {
  assert.throws(() => resolveInside("C:\\data", segment), /escapes/, segment);
}

assert.equal(toSafeExportName('  a<b>:c"d/e\\f|g?h*i\u0001  j ', "x"), "a b c d e f g h i j");
assert.equal(toSafeExportName(" /:* ", "fallback"), "fallback");

// sleep resolves after the wait and rejects with AbortError when aborted.
const { sleep } = await import("../../../packages/server/src/utils/sleep.js");
await sleep(1);
const controller = new AbortController();
const waiting = sleep(60_000, controller.signal);
controller.abort();
await assert.rejects(waiting, { name: "AbortError" });
await assert.rejects(sleep(1, AbortSignal.abort()), { name: "AbortError" });

// parseBody sends the old 400 body: the route message and at most 10 Zod issues.
const { parseBody } = await import("../../../packages/server/src/utils/parse-body.js");
const bodyApp = Fastify();
const schema = z.object(Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`f${i}`, z.number()])));
bodyApp.post("/check", async (req, reply) => {
  const input = parseBody(schema, req.body, reply, "Invalid check");
  if (!input) return reply;
  return { sum: Object.values(input).reduce((a, b) => a + b, 0) };
});
try {
  const bad = await bodyApp.inject({ method: "POST", url: "/check", payload: {} });
  assert.equal(bad.statusCode, 400);
  const badBody = bad.json();
  assert.equal(badBody.error, "Invalid check");
  assert.equal(badBody.issues.length, 10);
  assert.deepEqual(Object.keys(badBody), ["error", "issues"]);
  const good = await bodyApp.inject({
    method: "POST",
    url: "/check",
    payload: Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`f${i}`, 1])),
  });
  assert.equal(good.statusCode, 200);
  assert.deepEqual(good.json(), { sum: 12 });
} finally {
  await bodyApp.close();
}
