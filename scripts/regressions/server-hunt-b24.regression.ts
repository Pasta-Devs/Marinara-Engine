/**
 * Server hunt batch 24.
 *
 * 1. Translate: a provider that answers 200 with a non-JSON body (a proxy or login page
 *    in front of a self-hosted DeepLX) is a 502 naming the provider, not an opaque 500.
 * 2. Translate: Google sends the text in a POST form body, so long non-Latin text does
 *    not overflow the URL length limit. (Source check: the real host needs the network.)
 * 3. Utility sidecar: model ids that are Object.prototype member names are neither
 *    installed nor accepted, and a rejected selection leaves the saved config untouched.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const dataDir = await mkdtemp(join(tmpdir(), "server-hunt-b24-"));
process.env.DATA_DIR = dataDir;
process.env.LOG_LEVEL = "silent";
process.env.DEEPLX_LOCAL_URLS_ENABLED = "true";

const requireServer = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const Fastify = requireServer("fastify") as typeof import("fastify").default;
const { translateRoutes } = await import("../../packages/server/src/routes/translate.routes.js");
const { errorHandler } = await import("../../packages/server/src/middleware/error-handler.js");
const { UtilitySidecarService, utilitySlotServesAgent } =
  await import("../../packages/server/src/services/utility-sidecar/utility-sidecar.service.js");

try {
  // ── 1. non-JSON 200 from DeepLX ────────────────────────────────────────────
  {
    const upstream = createServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end("<!DOCTYPE html><html><body>Sign in</body></html>");
    });
    await new Promise<void>((done) => upstream.listen(0, "127.0.0.1", done));
    const port = (upstream.address() as AddressInfo).port;

    const app = Fastify({ logger: false });
    app.decorate("db", {} as never);
    app.setErrorHandler(errorHandler);
    await app.register(translateRoutes, { prefix: "/api/translate" });
    try {
      const res = await app.inject({
        method: "POST",
        url: "/api/translate",
        payload: {
          text: "hello",
          provider: "deeplx",
          targetLanguage: "de",
          deeplxUrl: `http://127.0.0.1:${port}`,
        },
      });
      assert.equal(res.statusCode, 502, `non-JSON DeepLX reply must be a 502, got ${res.statusCode}: ${res.body}`);
      assert.match(res.body, /DeepLX returned a non-JSON response/);
    } finally {
      await app.close();
      await new Promise<void>((done) => upstream.close(() => done()));
    }
  }

  // ── 2. Google text travels in the body ─────────────────────────────────────
  {
    const source = readFileSync(join(root, "packages/server/src/services/translation.service.ts"), "utf8");
    const google = source.slice(source.indexOf("async function translateWithGoogle"));
    assert.ok(!/searchParams\.set\("q"/.test(google), "Google text must not be put in the query string");
    assert.match(google, /method: "POST"/);
    assert.match(google, /body: new URLSearchParams\(\{ q: input\.text \}\)/);
  }

  // ── 3. utility sidecar ids ─────────────────────────────────────────────────
  {
    for (const name of ["toString", "constructor", "hasOwnProperty", "__proto__"]) {
      assert.equal(
        utilitySlotServesAgent({ activeModelId: name, models: {}, runtimeInstalled: true }, name),
        false,
        `${name} must not count as an installed model`,
      );
    }

    const service = new UtilitySidecarService();
    const configPath = join(dataDir, "models", "utility", "utility-sidecar-config.json");
    for (const name of ["toString", "hasOwnProperty", "constructor", "__proto__", "prototype"]) {
      await assert.rejects(() => service.setActiveModel(name), `${name} must be rejected`);
      await assert.rejects(() => service.checkForUpdate(name), `${name} has no update to check`);
    }
    assert.equal(service.getConfig().activeModelId, null, "a rejected id must not become the selection");
    assert.ok(!existsSync(configPath), "a rejected id must not be written to disk");
    await assert.rejects(
      () => service.installModel({ modelId: "__proto__", repo: "owner/name", file: "m.gguf" }),
      /Invalid utility model id/,
    );

    const routes = readFileSync(join(root, "packages/server/src/routes/utility-sidecar.routes.ts"), "utf8");
    assert.match(routes, /Object\.hasOwn\(status\.models, agentType\)/);
    assert.match(routes, /"__proto__", "constructor", "prototype"/);
  }

  console.log("server-hunt-b24 regression passed");
} finally {
  await rm(dataDir, { recursive: true, force: true });
}
