import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Fastify from "../../packages/server/node_modules/fastify/fastify.js";
import fastifyStatic from "../../packages/server/node_modules/@fastify/static/index.js";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const temporaryDirectory = mkdtempSync(join(tmpdir(), "marinara-scene-video-range-"));
const filename = "scene.mp4";
const contents = Buffer.from(Array.from({ length: 1_024 }, (_value, index) => index % 256));
writeFileSync(join(temporaryDirectory, filename), contents);

const app = Fastify();

try {
  await app.register(fastifyStatic, { serve: false });
  app.get("/scene.mp4", async (_request, reply) =>
    reply
      .header("Content-Type", "video/mp4")
      .sendFile(filename, temporaryDirectory, { maxAge: "1y", immutable: true }),
  );
  await app.ready();

  const full = await app.inject({ method: "GET", url: "/scene.mp4" });
  assert.equal(full.statusCode, 200);
  assert.deepEqual(full.rawPayload, contents);
  assert.equal(full.headers["accept-ranges"], "bytes");
  assert.equal(full.headers["content-length"], String(contents.length));
  assert.equal(full.headers["content-type"], "video/mp4");
  assert.equal(full.headers["cache-control"], "public, max-age=31536000, immutable");

  const fixedRange = await app.inject({
    method: "GET",
    url: "/scene.mp4",
    headers: { range: "bytes=0-9" },
  });
  assert.equal(fixedRange.statusCode, 206);
  assert.deepEqual(fixedRange.rawPayload, contents.subarray(0, 10));
  assert.equal(fixedRange.headers["content-range"], `bytes 0-9/${contents.length}`);
  assert.equal(fixedRange.headers["content-length"], "10");

  const suffixRange = await app.inject({
    method: "GET",
    url: "/scene.mp4",
    headers: { range: "bytes=-10" },
  });
  assert.equal(suffixRange.statusCode, 206);
  assert.deepEqual(suffixRange.rawPayload, contents.subarray(contents.length - 10));
  assert.equal(suffixRange.headers["content-range"], `bytes 1014-1023/${contents.length}`);

  const openEndedRange = await app.inject({
    method: "GET",
    url: "/scene.mp4",
    headers: { range: "bytes=100-" },
  });
  assert.equal(openEndedRange.statusCode, 206);
  assert.deepEqual(openEndedRange.rawPayload, contents.subarray(100));
  assert.equal(openEndedRange.headers["content-range"], `bytes 100-1023/${contents.length}`);

  const invalidRange = await app.inject({
    method: "GET",
    url: "/scene.mp4",
    headers: { range: "bytes=2048-" },
  });
  assert.equal(invalidRange.statusCode, 416);
  assert.equal(invalidRange.headers["content-range"], `bytes */${contents.length}`);

  const head = await app.inject({ method: "HEAD", url: "/scene.mp4" });
  assert.equal(head.statusCode, 200);
  assert.equal(head.rawPayload.length, 0);
  assert.equal(head.headers["accept-ranges"], "bytes");
  assert.equal(head.headers["content-length"], String(contents.length));

  for (const routePath of [
    "packages/server/src/routes/gallery.routes.ts",
    "packages/server/src/routes/game.routes.ts",
  ]) {
    const routeSource = readFileSync(join(repositoryRoot, routePath), "utf8");
    const routeStart = routeSource.indexOf('"/scene-videos/file/:chatId/:filename"');
    const routeEnd = routeSource.indexOf("app.post", routeStart);
    const fileHandlerSource = routeSource.slice(routeStart, routeEnd);
    assert.ok(routeStart >= 0 && routeEnd > routeStart, `${routePath} scene-video file route must be present`);
    assert.match(fileHandlerSource, /\.sendFile\(filename, join\(GAME_SCENE_VIDEOS_ROOT, chatId\)/u);
    assert.doesNotMatch(fileHandlerSource, /\.send\(readFileSync\(filePath\)\)/u);
  }

  const appSource = readFileSync(join(repositoryRoot, "packages/server/src/app.ts"), "utf8");
  const decoratorRegistration = appSource.indexOf("await app.register(fastifyStatic, { serve: false });");
  assert.ok(decoratorRegistration >= 0);
  assert.ok(
    decoratorRegistration < appSource.indexOf("await registerRoutes(app);"),
    "sendFile must be decorated before API routes register, including API-only startup",
  );
} finally {
  await app.close();
  rmSync(temporaryDirectory, { recursive: true, force: true });
}

console.log("Scene-video range regressions passed.");
