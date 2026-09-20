import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createClientNotFoundHandler,
  createClientStaticOptions,
} from "../../packages/server/src/config/client-static-config.js";

const requireFromServer = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const fastifyStatic = requireFromServer("@fastify/static");
const Fastify = requireFromServer("fastify");

const clientDist = mkdtempSync(join(tmpdir(), "marinara-static-cache-"));
mkdirSync(join(clientDist, "assets"));
writeFileSync(join(clientDist, "index.html"), '<!doctype html><script src="/assets/index-AbCdEf12.js"></script>');
writeFileSync(join(clientDist, "manifest.json"), "{}");
writeFileSync(join(clientDist, "sw.js"), "// service worker");
writeFileSync(join(clientDist, "registerSW.js"), "// registration helper");
writeFileSync(join(clientDist, "favicon.png"), "not fingerprinted");
writeFileSync(join(clientDist, "assets", "index-AbCdEf12.js"), "export {};");

const app = Fastify({ logger: false });

try {
  await app.register(fastifyStatic, createClientStaticOptions(clientDist));
  app.setNotFoundHandler(createClientNotFoundHandler(join(clientDist, "index.html")));
  await app.ready();

  for (const route of ["/", "/index.html"]) {
    const response = await app.inject({ method: "GET", url: route });
    assert.equal(response.statusCode, 200);
    assert.equal(response.headers["cache-control"], "no-cache, must-revalidate");
  }

  for (const route of ["/manifest.json", "/sw.js", "/registerSW.js"]) {
    const response = await app.inject({ method: "GET", url: route });
    assert.equal(response.statusCode, 200);
    assert.equal(response.headers["cache-control"], "no-store, no-cache, must-revalidate");
  }

  const fingerprintedAsset = await app.inject({ method: "GET", url: "/assets/index-AbCdEf12.js" });
  assert.equal(fingerprintedAsset.statusCode, 200);
  assert.match(fingerprintedAsset.headers["content-type"], /javascript/);
  assert.equal(fingerprintedAsset.headers["cache-control"], "public, max-age=31536000, immutable");

  writeFileSync(join(clientDist, "assets", "index-NewBuild34.js"), "export const rebuilt = true;");
  const rebuiltAsset = await app.inject({ method: "GET", url: "/assets/index-NewBuild34.js" });
  assert.equal(rebuiltAsset.statusCode, 200);
  assert.match(rebuiltAsset.body, /rebuilt = true/);
  assert.match(rebuiltAsset.headers["content-type"] ?? "", /javascript/i);
  assert.equal(rebuiltAsset.headers["cache-control"], "public, max-age=31536000, immutable");

  const unfingerprintedAsset = await app.inject({ method: "GET", url: "/favicon.png" });
  assert.equal(unfingerprintedAsset.statusCode, 200);
  assert.equal(unfingerprintedAsset.headers["cache-control"], undefined);

  for (const route of [
    "/assets/vendor-icons-stale.js",
    "/assets/missing.css?v=1",
    "/sw-missing.js",
    "/api/missing",
    "/api",
  ]) {
    const response = await app.inject({ method: "GET", url: route });
    assert.equal(response.statusCode, 404, route);
    assert.equal(response.headers["cache-control"], "no-store");
    assert.doesNotMatch(response.headers["content-type"], /html/);
  }
  for (const method of ["GET", "POST"] as const) {
    for (const accept of [
      "",
      "application/json",
      "application/json, text/html;q=0",
      "text/html;q=0.000",
      "text/html;q=.5",
      "text/html;q=+0.5",
      "text/html;q=0.0001",
    ]) {
      const response = await app.inject({
        method,
        url: "/unknown",
        headers: { accept, "sec-fetch-dest": "document" },
      });
      assert.equal(response.statusCode, 404);
      assert.doesNotMatch(response.headers["content-type"], /html/);
    }
  }
  for (const destination of ["empty", "script", "style", "image", "worker"]) {
    const response = await app.inject({
      method: "GET",
      url: "/unknown",
      headers: { accept: "text/html", "sec-fetch-dest": destination },
    });
    assert.equal(response.statusCode, 404, destination);
    assert.equal(response.headers["cache-control"], "no-store");
    assert.doesNotMatch(response.headers["content-type"], /html/);
  }
  for (const headers of [
    { accept: "text/html;q=0.9" },
    { "sec-fetch-dest": "document" },
    ...["document", "iframe", "frame"].map((destination) => ({
      accept: "text/html",
      "sec-fetch-dest": destination,
    })),
  ]) {
    const navigation = await app.inject({
      method: "GET",
      url: "/some/navigation?query=example.js",
      headers,
    });
    assert.equal(navigation.statusCode, 200);
    assert.match(navigation.headers["content-type"], /html/);
    assert.equal(navigation.headers["cache-control"], "no-cache, must-revalidate");
  }

  console.info("Static client cache-header regression passed.");
} finally {
  await app.close();
  rmSync(clientDist, { recursive: true, force: true });
}
