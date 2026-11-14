/**
 * GET /api/themes tags the list with an ETag and "private, no-cache": a client that already holds the same
 * list gets a 304 with no body (themes carry their pictures, several MB), and any change to a theme gives a
 * new tag, so the full list comes back.
 */
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-theme-etag-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
process.env.LOG_LEVEL = "silent";
const { default: Fastify } = await import("../../../packages/server/node_modules/fastify/fastify.js");
const { getDB, closeDB } = await import("../../../packages/server/src/db/connection.js");
const { themesRoutes } = await import("../../../packages/server/src/routes/themes.routes.js");

try {
  const app = Fastify();
  app.decorate("db", await getDB());
  await app.register(themesRoutes, { prefix: "/api/themes" });

  const first = await app.inject({ method: "GET", url: "/api/themes" });
  assert.equal(first.statusCode, 200);
  assert.deepEqual(first.json(), []);
  const etag = first.headers.etag;
  assert.ok(typeof etag === "string" && etag.length > 2, "the list has an ETag");
  assert.equal(first.headers["cache-control"], "private, no-cache");

  const same = await app.inject({ method: "GET", url: "/api/themes", headers: { "if-none-match": etag } });
  assert.equal(same.statusCode, 304, "an unchanged list is not sent again");
  assert.equal(same.body, "");
  const weak = await app.inject({ method: "GET", url: "/api/themes", headers: { "if-none-match": `W/${etag}` } });
  assert.equal(weak.statusCode, 304, "a weak tag from a proxy still matches");

  const created = await app.inject({
    method: "POST",
    url: "/api/themes",
    payload: { name: "Etag check", css: ":root { --x: 1; }" },
  });
  assert.equal(created.statusCode, 200, created.body);

  const changed = await app.inject({ method: "GET", url: "/api/themes", headers: { "if-none-match": etag } });
  assert.equal(changed.statusCode, 200, "a changed list is sent in full");
  assert.notEqual(changed.headers.etag, etag);
  assert.equal(changed.json().length, 1);
  await app.close();
} finally {
  await closeDB();
  rmSync(dataDir, { recursive: true, force: true });
}

console.log("theme list ETag regression passed");
