import assert from "node:assert/strict";
import Fastify from "../../../packages/server/node_modules/fastify/fastify.js";

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
