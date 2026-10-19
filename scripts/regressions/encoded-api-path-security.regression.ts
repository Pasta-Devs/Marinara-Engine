import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { request as httpRequest } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Fastify from "../../packages/server/node_modules/fastify/fastify.js";
import multipart from "../../packages/server/node_modules/@fastify/multipart/index.js";

// The router decodes percent-escapes before matching, so "/%61pi/..." reaches
// an "/api/..." handler. API-only hooks must not decide on the raw URL alone.
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const dataDir = mkdtempSync(join(tmpdir(), "marinara-encoded-api-path-"));
process.on("exit", () => rmSync(dataDir, { recursive: true, force: true }));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "file-storage");
process.env.MARINARA_FILE_STORAGE_DIR = join(dataDir, "file-storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.HOST = "0.0.0.0";
delete process.env.CSRF_TRUSTED_ORIGINS;
delete process.env.MARINARA_E2E_DISABLE_RATE_LIMIT;

const { csrfProtectionHook } = await import("../../packages/server/src/middleware/csrf-protection.js");
const { BACKUP_RATE_LIMIT, rateLimitHook, resetRateLimitBucketsForTests } =
  await import("../../packages/server/src/middleware/rate-limit.js");
const { isApiRequest } = await import("../../packages/server/src/utils/api-request.js");
const { CSRF_HEADER, CSRF_HEADER_VALUE } = await import("../../packages/server/src/utils/security.js");

const host = "127.0.0.1:7860";
const crossSite = { host, origin: "https://elsewhere.example", "sec-fetch-site": "cross-site" };
const sameOrigin = {
  host,
  origin: `http://${host}`,
  "sec-fetch-site": "same-origin",
  [CSRF_HEADER]: CSRF_HEADER_VALUE,
};
const encodedPrefixes = ["/%61pi", "/a%70i", "/ap%69", "/%61%70%69"];

function multipartBody() {
  const boundary = "----marinara-regression";
  return {
    headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
    payload:
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="card.json"\r\n` +
      `Content-Type: application/json\r\n\r\n{"name":"card"}\r\n--${boundary}--\r\n`,
  };
}

let imports = 0;
let backups = 0;
const apiVerdicts = new Map<string, boolean>();
const app = Fastify();
app.addHook("onRequest", (request, _reply, done) => {
  apiVerdicts.set(request.url, isApiRequest(request));
  done();
});
app.addHook("onRequest", rateLimitHook);
app.addHook("onRequest", csrfProtectionHook);
await app.register(multipart);
await app.register(
  async (scope) => {
    scope.post("/st-character", async (request) => {
      await (await request.file())?.toBuffer();
      imports += 1;
      return { ok: true };
    });
  },
  { prefix: "/api/import" },
);
await app.register(
  async (scope) => {
    scope.post("/", async () => {
      backups += 1;
      return { ok: true };
    });
  },
  { prefix: "/api/backup" },
);
app.get("/assets/app.js", async () => "asset");

try {
  for (const prefix of ["/api", ...encodedPrefixes]) {
    const url = `${prefix}/import/st-character`;
    const upload = multipartBody();
    const response = await app.inject({
      method: "POST",
      url,
      headers: { ...crossSite, ...upload.headers },
      payload: upload.payload,
      remoteAddress: "127.0.0.1",
    });
    assert.equal(response.statusCode, 403, `${url} must reject a cross-site upload`);
    assert.equal(response.json().code, "CSRF_CROSS_SITE");

    const bodiless = await app.inject({
      method: "POST",
      url: `${prefix}/backup/`,
      headers: crossSite,
      remoteAddress: "127.0.0.1",
    });
    assert.equal(bodiless.statusCode, 403, `${prefix}/backup/ must reject a cross-site request`);
  }
  assert.equal(imports, 0, "no cross-site upload may reach the handler");
  assert.equal(backups, 0, "no cross-site request may reach the handler");

  const ownUpload = multipartBody();
  const legitimate = await app.inject({
    method: "POST",
    url: "/api/import/st-character",
    headers: { ...sameOrigin, ...ownUpload.headers },
    payload: ownUpload.payload,
    remoteAddress: "127.0.0.1",
  });
  assert.equal(legitimate.statusCode, 200, "the app's own uploads keep working");
  assert.equal(imports, 1);

  const scriptClient = await app.inject({ method: "POST", url: "/api/backup/", remoteAddress: "127.0.0.1" });
  assert.equal(scriptClient.statusCode, 200, "header-less local clients keep working");

  const crossSiteToMissingPage = await app.inject({
    method: "POST",
    url: "/not-a-route",
    headers: crossSite,
    remoteAddress: "127.0.0.1",
  });
  assert.equal(crossSiteToMissingPage.statusCode, 403, "the Origin check does not depend on the request path");

  resetRateLimitBucketsForTests();
  for (let attempt = 0; attempt < BACKUP_RATE_LIMIT.max; attempt += 1) {
    const prefix = attempt % 2 === 0 ? "/api" : encodedPrefixes[attempt % encodedPrefixes.length]!;
    const response = await app.inject({
      method: "POST",
      url: `${prefix}/backup/`,
      headers: sameOrigin,
      remoteAddress: "127.0.0.2",
    });
    assert.equal(response.statusCode, 200);
    assert.equal(
      response.headers["ratelimit-limit"],
      String(BACKUP_RATE_LIMIT.max),
      `${prefix}/backup/ is rate limited as a backup route`,
    );
  }
  const throttled = await app.inject({
    method: "POST",
    url: "/%61pi/backup/",
    headers: sameOrigin,
    remoteAddress: "127.0.0.2",
  });
  assert.equal(throttled.statusCode, 429, "plain and encoded paths share one rate-limit bucket");

  assert.equal(apiVerdicts.get("/%61pi/backup/"), true, "an encoded API path is still an API request");
  assert.equal(apiVerdicts.get("/api/backup/"), true);
  await app.inject({ method: "GET", url: "/assets/app.js", remoteAddress: "127.0.0.1" });
  assert.equal(apiVerdicts.get("/assets/app.js"), false, "static files are not API requests");
} finally {
  resetRateLimitBucketsForTests();
  await app.close();
}

// The production app's no-store and JSON compression hooks apply to an encoded
// API path too. Compression needs a real socket: app.inject() replies stay plain.
const { buildApp } = await import("../../packages/server/src/app.js");
const productionApp = await buildApp();
try {
  await productionApp.listen({ port: 0, host: "127.0.0.1" });
  const { port } = productionApp.server.address() as AddressInfo;
  for (const path of ["/api/prompts", "/%61pi/prompts"]) {
    const headers = await new Promise<Record<string, string | string[] | undefined>>((resolveHeaders, reject) => {
      const req = httpRequest({ host: "127.0.0.1", port, path, headers: { "accept-encoding": "br" } }, (res) => {
        assert.equal(res.statusCode, 200, `${path} must reach the prompts route`);
        res.resume();
        res.on("end", () => resolveHeaders(res.headers));
      });
      req.on("error", reject);
      req.end();
    });
    assert.equal(headers["cache-control"], "no-store", `${path} must not be cached`);
    assert.equal(headers["content-encoding"], "br", `${path} JSON must be compressed`);
  }
} finally {
  await productionApp.close().catch(() => {});
}

const sources = {
  "packages/server/src/app.ts": readFileSync(join(repositoryRoot, "packages/server/src/app.ts"), "utf8"),
  "packages/server/src/middleware/compress-json.ts": readFileSync(
    join(repositoryRoot, "packages/server/src/middleware/compress-json.ts"),
    "utf8",
  ),
  "packages/server/src/middleware/rate-limit.ts": readFileSync(
    join(repositoryRoot, "packages/server/src/middleware/rate-limit.ts"),
    "utf8",
  ),
  "packages/server/src/middleware/csrf-protection.ts": readFileSync(
    join(repositoryRoot, "packages/server/src/middleware/csrf-protection.ts"),
    "utf8",
  ),
};
for (const [file, source] of Object.entries(sources)) {
  assert.doesNotMatch(
    source,
    /\b(?:req|request)\.url\.startsWith\("\/api\/"\)/u,
    `${file} must not gate on the raw URL`,
  );
}

console.log("Encoded API path security regressions passed.");
