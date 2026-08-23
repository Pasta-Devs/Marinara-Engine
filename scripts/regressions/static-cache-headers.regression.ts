import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClientStaticOptions } from "../../packages/server/src/config/client-static-config.js";

const requireFromServer = createRequire(
  new URL("../../packages/server/package.json", import.meta.url),
);
const fastifyStatic = requireFromServer("@fastify/static");
const Fastify = requireFromServer("fastify");

const clientDist = mkdtempSync(join(tmpdir(), "marinara-static-cache-"));
mkdirSync(join(clientDist, "assets"));
writeFileSync(join(clientDist, "index.html"), "<!doctype html><script src=\"/assets/index-AbCdEf12.js\"></script>");
writeFileSync(join(clientDist, "manifest.json"), "{}");
writeFileSync(join(clientDist, "sw.js"), "// service worker");
writeFileSync(join(clientDist, "registerSW.js"), "// registration helper");
writeFileSync(join(clientDist, "favicon.png"), "not fingerprinted");
writeFileSync(join(clientDist, "assets", "index-AbCdEf12.js"), "export {};");

const app = Fastify({ logger: false });

try {
  await app.register(fastifyStatic, createClientStaticOptions(clientDist));
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
  assert.equal(fingerprintedAsset.headers["cache-control"], "public, max-age=31536000, immutable");

  const unfingerprintedAsset = await app.inject({ method: "GET", url: "/favicon.png" });
  assert.equal(unfingerprintedAsset.statusCode, 200);
  assert.equal(unfingerprintedAsset.headers["cache-control"], undefined);

  console.info("Static client cache-header regression passed.");
} finally {
  await app.close();
  rmSync(clientDist, { recursive: true, force: true });
}
