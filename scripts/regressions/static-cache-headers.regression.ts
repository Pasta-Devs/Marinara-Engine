import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { brotliDecompressSync, gunzipSync } from "node:zlib";
import { precompressDirectory } from "../../packages/client/scripts/precompress.mjs";
import {
  createClientNotFoundHandler,
  createClientStaticOptions,
} from "../../packages/server/src/config/client-static-config.js";
import { securityHeadersHook } from "../../packages/server/src/middleware/security-headers.js";

const requireFromServer = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const fastifyStatic = requireFromServer("@fastify/static");
const Fastify = requireFromServer("fastify");

const clientDist = mkdtempSync(join(tmpdir(), "marinara-static-cache-"));
mkdirSync(join(clientDist, "assets"));
// Text of 1 KiB or more gets .br/.gz copies; smaller text, images and dot folders do not.
const filler = "compressible text ".repeat(100);
mkdirSync(join(clientDist, ".vite"));
writeFileSync(
  join(clientDist, "index.html"),
  `<!doctype html><script src="/assets/index-AbCdEf12.js"></script><!-- ${filler} -->`,
);
writeFileSync(join(clientDist, "manifest.json"), "{}");
writeFileSync(join(clientDist, "sw.js"), `// service worker ${filler}`);
writeFileSync(join(clientDist, "registerSW.js"), "// registration helper");
writeFileSync(join(clientDist, "favicon.png"), `not fingerprinted ${filler}`);
writeFileSync(join(clientDist, "assets", "index-AbCdEf12.js"), `export {}; // ${filler}`);
writeFileSync(join(clientDist, ".vite", "manifest.json"), JSON.stringify({ filler }));

const app = Fastify({ logger: false });

try {
  await precompressDirectory(clientDist);
  const copied = ["index.html", "sw.js", "assets/index-AbCdEf12.js"];
  for (const file of [...copied, "manifest.json", "registerSW.js", "favicon.png", ".vite/manifest.json"]) {
    for (const extension of [".br", ".gz"]) {
      assert.equal(existsSync(join(clientDist, file + extension)), copied.includes(file), file + extension);
    }
  }
  app.addHook("onRequest", securityHeadersHook);
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
    assert.equal(navigation.headers["x-robots-tag"], "noindex, nofollow");
  }
  assert.equal(fingerprintedAsset.headers["x-robots-tag"], "noindex, nofollow");

  // Precompressed copies keep the plain file's type and cache policy, and fall back to it when not accepted.
  const decoders = { br: brotliDecompressSync, gzip: gunzipSync } as const;
  for (const [route, file, type, cacheControl] of [
    ["/", "index.html", /html/, "no-cache, must-revalidate"],
    ["/index.html", "index.html", /html/, "no-cache, must-revalidate"],
    ["/sw.js", "sw.js", /javascript/, "no-store, no-cache, must-revalidate"],
    ["/assets/index-AbCdEf12.js", "assets/index-AbCdEf12.js", /javascript/, "public, max-age=31536000, immutable"],
  ] as const) {
    const plain = readFileSync(join(clientDist, file));
    for (const [acceptEncoding, encoding] of [
      ["br", "br"],
      ["gzip, deflate, br", "br"],
      ["br;q=0, gzip", "gzip"],
      ["*", "gzip"],
      ["identity", undefined],
      [undefined, undefined],
    ] as const) {
      for (const method of ["GET", "HEAD"] as const) {
        const label = `${method} ${route} ${acceptEncoding}`;
        const response = await app.inject({
          method,
          url: route,
          headers: acceptEncoding === undefined ? {} : { "accept-encoding": acceptEncoding },
        });
        assert.equal(response.statusCode, 200, label);
        assert.equal(response.headers["content-encoding"], encoding, label);
        assert.equal(response.headers.vary, "accept-encoding", label);
        assert.match(String(response.headers["content-type"]), type, label);
        assert.equal(response.headers["cache-control"], cacheControl, label);
        assert.equal(response.headers["x-robots-tag"], "noindex, nofollow", label);
        const sent = encoding ? `${file}.${encoding === "br" ? "br" : "gz"}` : file;
        assert.equal(Number(response.headers["content-length"]), statSync(join(clientDist, sent)).size, label);
        if (method === "GET") {
          assert.deepEqual(encoding ? decoders[encoding](response.rawPayload) : response.rawPayload, plain, label);
        }
      }
    }
  }

  // A file without a copy falls back to the plain file.
  for (const route of ["/favicon.png", "/registerSW.js"]) {
    const response = await app.inject({ method: "GET", url: route, headers: { "accept-encoding": "br, gzip" } });
    assert.equal(response.statusCode, 200, route);
    assert.equal(response.headers["content-encoding"], undefined, route);
    assert.equal(response.headers.vary, "accept-encoding", route);
  }
  assert.equal(
    (await app.inject({ method: "GET", url: "/registerSW.js", headers: { "accept-encoding": "br" } })).headers[
      "cache-control"
    ],
    "no-store, no-cache, must-revalidate",
  );

  // Media-style ranges (Chrome sends identity only) still get plain bytes.
  const assetBytes = readFileSync(join(clientDist, "assets", "index-AbCdEf12.js"));
  for (const headers of [{}, { "accept-encoding": "identity;q=1, *;q=0" }]) {
    const range = await app.inject({
      method: "GET",
      url: "/assets/index-AbCdEf12.js",
      headers: { ...headers, range: "bytes=0-9" },
    });
    assert.equal(range.statusCode, 206);
    assert.equal(range.headers["content-encoding"], undefined);
    assert.equal(range.headers["content-range"], `bytes 0-9/${assetBytes.length}`);
    assert.deepEqual(range.rawPayload, assetBytes.subarray(0, 10));
  }

  // The copies are not routes of their own.
  for (const route of ["/index.html.br", "/assets/index-AbCdEf12.js.gz"]) {
    const response = await app.inject({ method: "GET", url: route, headers: { "accept-encoding": "br" } });
    assert.equal(response.statusCode, 404, route);
    assert.doesNotMatch(String(response.headers["content-type"]), /html/, route);
  }

  // The SPA fallback serves the plain index.html.
  const deepLink = await app.inject({
    method: "GET",
    url: "/chat/deep-link",
    headers: { accept: "text/html", "accept-encoding": "br, gzip" },
  });
  assert.equal(deepLink.statusCode, 200);
  assert.equal(deepLink.headers["content-encoding"], undefined);
  assert.deepEqual(deepLink.rawPayload, readFileSync(join(clientDist, "index.html")));

  console.info("Static client cache-header and precompressed-copy regression passed.");
} finally {
  await app.close();
  rmSync(clientDist, { recursive: true, force: true });
}
