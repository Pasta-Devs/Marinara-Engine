import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Gallery art lost its HTTP validators when media serving moved to validated descriptors (ee380d08f9, v2.4.2),
// so every revisit re-downloaded each painting in full. Revisits must be 304s again, without loosening Range or HEAD.
const fixtureDir = mkdtempSync(join(tmpdir(), "marinara-media-cache-"));
process.env.DATA_DIR = fixtureDir;
process.env.FILE_STORAGE_DIR = join(fixtureDir, "storage");
process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "silent";
const requireServer = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const sharp = requireServer("sharp");
const Fastify = requireServer("fastify") as typeof import("fastify").default;
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { globalGalleryRoutes } = await import("../../packages/server/src/routes/global-gallery.routes.js");
const { backgroundsRoutes } = await import("../../packages/server/src/routes/backgrounds.routes.js");

const app = Fastify();
app.decorate("db", await getDB());
await app.register(globalGalleryRoutes, { prefix: "/api/global-gallery" });
await app.register(backgroundsRoutes, { prefix: "/api/backgrounds" });

const painting = (background: string, width = 64) =>
  sharp({ create: { width, height: 96, channels: 3, background } })
    .png()
    .toBuffer() as Promise<Buffer>;

try {
  const galleryDir = join(fixtureDir, "gallery", "global");
  mkdirSync(galleryDir, { recursive: true });
  const file = join(galleryDir, "painting.png");
  const url = "/api/global-gallery/file/painting.png";
  const original = await painting("#164e63");
  writeFileSync(file, original);

  const first = await app.inject(url);
  assert.equal(first.statusCode, 200);
  assert.deepEqual(first.rawPayload, original);
  assert.equal(first.headers["content-type"], "image/png");
  assert.equal(first.headers["cache-control"], "private, max-age=31536000, immutable");
  const etag = String(first.headers.etag);
  const lastModified = String(first.headers["last-modified"]);
  assert.equal(etag, `W/"${original.length}-${statSync(file).mtimeMs}"`);
  assert.equal(lastModified, statSync(file).mtime.toUTCString());

  for (const headers of [
    { "if-none-match": etag },
    { "if-none-match": `"other", ${etag.slice(2)}` },
    { "if-none-match": "*" },
    { "if-modified-since": lastModified },
    { "if-none-match": etag, range: "bytes=0-15" },
  ]) {
    for (const method of ["GET", "HEAD"] as const) {
      const revisit = await app.inject({ method, url, headers });
      assert.equal(revisit.statusCode, 304, `${method} ${JSON.stringify(headers)} must be a 304`);
      assert.equal(revisit.rawPayload.length, 0);
      assert.equal(revisit.headers.etag, etag);
      assert.equal(revisit.headers["cache-control"], "private, max-age=31536000, immutable");
      // Fastify's automatic HEAD route writes Content-Length: 0 for a bodiless reply, which caches ignore on a 304.
      assert.equal(revisit.headers["content-length"], method === "GET" ? undefined : "0", "a 304 has no body length");
      assert.equal(revisit.headers["content-range"], undefined);
    }
  }
  // If-None-Match replaces If-Modified-Since, and an older copy is re-sent in full.
  for (const headers of [
    { "if-none-match": 'W/"stale"', "if-modified-since": lastModified },
    { "if-modified-since": new Date(0).toUTCString() },
    { "if-modified-since": "not a date" },
  ]) {
    const response = await app.inject({ url, headers });
    assert.equal(response.statusCode, 200, JSON.stringify(headers));
    assert.deepEqual(response.rawPayload, original);
  }

  const range = await app.inject({ url, headers: { range: "bytes=0-15" } });
  assert.equal(range.statusCode, 206);
  assert.deepEqual(range.rawPayload, original.subarray(0, 16));
  assert.equal(range.headers["content-range"], `bytes 0-15/${original.length}`);
  assert.equal(range.headers.etag, etag);
  for (const ifRange of [etag, lastModified]) {
    const resumed = await app.inject({ url, headers: { range: "bytes=16-", "if-range": ifRange } });
    assert.equal(resumed.statusCode, 206);
    assert.deepEqual(resumed.rawPayload, original.subarray(16));
  }
  const unsatisfiable = await app.inject({ url, headers: { range: `bytes=${original.length}-` } });
  assert.equal(unsatisfiable.statusCode, 416);
  assert.equal(unsatisfiable.headers["content-range"], `bytes */${original.length}`);

  const head = await app.inject({ method: "HEAD", url });
  assert.equal(head.statusCode, 200);
  assert.equal(head.rawPayload.length, 0);
  assert.equal(head.headers["content-length"], String(original.length));
  assert.equal(head.headers.etag, etag);

  // Different bytes at the same path get new validators, so the browser's copy is replaced.
  const replacement = await painting("#7c2d12", 80);
  writeFileSync(file, replacement);
  utimesSync(file, new Date(Date.now() + 10_000), new Date(Date.now() + 10_000));
  for (const headers of [{ "if-none-match": etag }, { "if-modified-since": lastModified }]) {
    const changed = await app.inject({ url, headers });
    assert.equal(changed.statusCode, 200, `${JSON.stringify(headers)} must not match a changed file`);
    assert.deepEqual(changed.rawPayload, replacement);
    assert.notEqual(changed.headers.etag, etag);
  }
  const staleResume = await app.inject({ url, headers: { range: "bytes=16-", "if-range": etag } });
  assert.equal(staleResume.statusCode, 200, "a stale If-Range gets the whole new file, never a slice of it");
  assert.deepEqual(staleResume.rawPayload, replacement);

  // Backgrounds keep revalidating every use; their ?w= preview gets validators for the preview file itself.
  mkdirSync(join(fixtureDir, "backgrounds"), { recursive: true });
  writeFileSync(join(fixtureDir, "backgrounds", "place.png"), await painting("#14532d", 640));
  const background = await app.inject("/api/backgrounds/file/place.png");
  const preview = await app.inject("/api/backgrounds/file/place.png?w=320");
  for (const response of [background, preview]) {
    assert.equal(response.statusCode, 200);
    assert.equal(response.headers["cache-control"], "no-cache, must-revalidate");
    assert.ok(response.headers.etag && response.headers["last-modified"]);
  }
  assert.equal(preview.headers["content-type"], "image/webp");
  assert.equal(preview.headers["content-length"], String(preview.rawPayload.length));
  assert.notEqual(preview.headers.etag, background.headers.etag, "the preview has its own validator");
  for (const [response, path] of [
    [background, "/api/backgrounds/file/place.png"],
    [preview, "/api/backgrounds/file/place.png?w=320"],
  ] as const) {
    const revisit = await app.inject({ url: path, headers: { "if-none-match": String(response.headers.etag) } });
    assert.equal(revisit.statusCode, 304);
    assert.equal(revisit.rawPayload.length, 0);
  }
} finally {
  await app.close();
  await closeDB();
  rmSync(fixtureDir, { recursive: true, force: true });
}

console.log("Media cache validator regressions passed.");
