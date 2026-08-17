import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Fastify from "../../packages/server/node_modules/fastify/fastify.js";
import cors from "../../packages/server/node_modules/@fastify/cors/index.js";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
process.env.HOST = "0.0.0.0";
delete process.env.TRUSTED_HOSTS;
delete process.env.CSRF_TRUSTED_ORIGINS;
delete process.env.CORS_ORIGINS;
delete process.env.MARINARA_E2E_DISABLE_RATE_LIMIT;

const { corsDelegate } = await import("../../packages/server/src/config/cors-config.js");
const { getCsrfTrustedOrigins } = await import("../../packages/server/src/config/runtime-config.js");
const { hostValidationHook, parseRequestHostname } =
  await import("../../packages/server/src/middleware/host-validation.js");
const { AVATAR_STORAGE_RATE_LIMIT, BACKUP_RATE_LIMIT, rateLimitHook, resetRateLimitBucketsForTests } =
  await import("../../packages/server/src/middleware/rate-limit.js");

process.env.CSRF_TRUSTED_ORIGINS = "null";
assert.deepEqual(getCsrfTrustedOrigins(), [], "a literal null CSRF origin is treated as unset");
process.env.CSRF_TRUSTED_ORIGINS = "NULL, https://proxy.example.com";
assert.deepEqual(
  getCsrfTrustedOrigins(),
  ["https://proxy.example.com"],
  "a null sentinel does not discard configured trusted origins",
);
delete process.env.CSRF_TRUSTED_ORIGINS;

assert.equal(parseRequestHostname("192.168.1.50:7860"), "192.168.1.50");
assert.equal(parseRequestHostname("[fd7a:115c:a1e0::1]:7860"), "fd7a:115c:a1e0::1");
assert.equal(parseRequestHostname("Mari-Box.local.:7860"), "mari-box.local");
assert.equal(parseRequestHostname("attacker.example/path"), null);
assert.equal(parseRequestHostname("attacker.example:0"), null);
assert.equal(parseRequestHostname("attacker.example:99999"), null);
assert.equal(parseRequestHostname("attacker.example, localhost:7860"), null);

const rateLimitedApp = Fastify();
rateLimitedApp.addHook("onRequest", rateLimitHook);
rateLimitedApp.post("/api/backup/", async () => ({ ok: true }));
rateLimitedApp.post("/api/admin/avatar-storage/cleanup", async () => ({ ok: true }));
try {
  for (let requestNumber = 1; requestNumber <= BACKUP_RATE_LIMIT.max; requestNumber += 1) {
    const response = await rateLimitedApp.inject({ method: "POST", url: "/api/backup/" });
    assert.equal(response.statusCode, 200, `backup request ${requestNumber} remains within its explicit limit`);
  }
  const rejectedBackup = await rateLimitedApp.inject({ method: "POST", url: "/api/backup/" });
  assert.equal(
    rejectedBackup.statusCode,
    429,
    `expensive backup routes are capped at ${BACKUP_RATE_LIMIT.max} requests per minute and IP`,
  );
  for (let requestNumber = 1; requestNumber <= AVATAR_STORAGE_RATE_LIMIT.max; requestNumber += 1) {
    const response = await rateLimitedApp.inject({
      method: "POST",
      url: "/api/admin/avatar-storage/cleanup",
    });
    assert.equal(response.statusCode, 200, `avatar storage request ${requestNumber} remains within its explicit limit`);
  }
  const rejectedAvatarCleanup = await rateLimitedApp.inject({
    method: "POST",
    url: "/api/admin/avatar-storage/cleanup",
  });
  assert.equal(
    rejectedAvatarCleanup.statusCode,
    429,
    "avatar storage maintenance is capped at 20 requests per minute and IP",
  );
} finally {
  await rateLimitedApp.close();
  resetRateLimitBucketsForTests();
}

const app = Fastify();
app.addHook("onRequest", hostValidationHook);
await app.register(cors, () => corsDelegate);
app.get("/api/chats", async () => [{ id: "private-chat" }]);
app.get("/api/backup/export-profile", async () => ({ profile: "private-profile" }));

try {
  await app.ready();
  const reboundHeaders = {
    host: "attacker.example:7860",
    origin: "http://attacker.example:7860",
    "sec-fetch-site": "same-origin",
  };
  for (const url of ["/api/chats", "/api/backup/export-profile"]) {
    const response = await app.inject({ method: "GET", url, headers: reboundHeaders });
    assert.equal(response.statusCode, 421, `${url} must reject an attacker-controlled rebound Host`);
    assert.equal(response.headers["access-control-allow-origin"], undefined);
    assert.doesNotMatch(response.body, /private-(?:chat|profile)/u);
  }

  for (const host of [
    "127.0.0.1:7860",
    "192.168.1.50:7860",
    "100.101.102.103:7860",
    "[fd7a:115c:a1e0::1]:7860",
    "mari-box.local:7860",
    "marinara:7860",
  ]) {
    const origin = `http://${host}`;
    const response = await app.inject({ method: "GET", url: "/api/chats", headers: { host, origin } });
    assert.equal(response.statusCode, 200, `${host} must remain usable from another device`);
    assert.equal(response.headers["access-control-allow-origin"], origin);
  }

  const publicHost = "chat.example.com:7860";
  const rejectedPublic = await app.inject({
    method: "GET",
    url: "/api/chats",
    headers: { host: publicHost, origin: `http://${publicHost}` },
  });
  assert.equal(rejectedPublic.statusCode, 421);

  process.env.TRUSTED_HOSTS = "chat.example.com";
  const explicitlyTrusted = await app.inject({
    method: "GET",
    url: "/api/chats",
    headers: { host: publicHost, origin: `http://${publicHost}` },
  });
  assert.equal(explicitlyTrusted.statusCode, 200, "TRUSTED_HOSTS must hot-allow an intentional public name");

  delete process.env.TRUSTED_HOSTS;
  process.env.CSRF_TRUSTED_ORIGINS = "https://proxy.example.com";
  const trustedOriginCompatibility = await app.inject({
    method: "GET",
    url: "/api/chats",
    headers: { host: "proxy.example.com", origin: "https://proxy.example.com", "x-forwarded-proto": "https" },
  });
  assert.equal(
    trustedOriginCompatibility.statusCode,
    200,
    "Existing CSRF_TRUSTED_ORIGINS reverse-proxy names must remain compatible",
  );

  delete process.env.CSRF_TRUSTED_ORIGINS;
  process.env.CORS_ORIGINS = "https://cors-proxy.example.com";
  const corsOriginCompatibility = await app.inject({
    method: "GET",
    url: "/api/chats",
    headers: {
      host: "cors-proxy.example.com",
      origin: "https://cors-proxy.example.com",
      "x-forwarded-proto": "https",
    },
  });
  assert.equal(
    corsOriginCompatibility.statusCode,
    200,
    "Existing CORS_ORIGINS reverse-proxy names must remain compatible",
  );
  delete process.env.CORS_ORIGINS;

  const appSource = readFileSync(join(repositoryRoot, "packages/server/src/app.ts"), "utf8");
  assert.ok(
    appSource.indexOf('app.addHook("onRequest", hostValidationHook)') <
      appSource.indexOf("await app.register(cors, () => corsDelegate)"),
    "Host validation must run before CORS evaluates same-origin trust",
  );
  assert.doesNotMatch(
    appSource,
    /updateInstalledPackagesToLatest/u,
    "App startup must never download and execute Agent updates without user consent",
  );
  const rateLimitHookIndex = appSource.indexOf('app.addHook("onRequest", rateLimitHook)');
  const androidLocalAuthHookIndex = appSource.indexOf('app.addHook("onRequest", androidLocalAuthHook)');
  assert.ok(rateLimitHookIndex >= 0, "API rate limiting must be registered");
  assert.ok(androidLocalAuthHookIndex >= 0, "Android authorization must be registered");
  assert.ok(rateLimitHookIndex < androidLocalAuthHookIndex, "API rate limiting must run before Android authorization");

  const composeSource = readFileSync(join(repositoryRoot, "docker-compose.yml"), "utf8");
  for (const name of ["TRUSTED_HOSTS", "CORS_ORIGINS", "CSRF_TRUSTED_ORIGINS"]) {
    assert.match(
      composeSource,
      new RegExp(`${name}=\\$\\{${name}:-\\}`),
      `Docker Compose must forward ${name} from the project environment`,
    );
  }

  const dockerfileSource = readFileSync(join(repositoryRoot, "Dockerfile"), "utf8");
  assert.match(dockerfileSource, /apt-get install[\s\S]*\bbubblewrap\b/u, "The official image must install Bubblewrap");
  const dockerBaseStages = dockerfileSource
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => /^FROM\s+/iu.test(line));
  assert.equal(dockerBaseStages.length, 2, "The full image must retain its reviewed build and production stages");
  const pinnedNodeBase = /^FROM\s+node:24-trixie-slim@(sha256:[0-9a-f]{64})(?:\s+AS\s+[a-z0-9_.-]+)?$/iu;
  // Offline evidence recorded from the pinned OCI index. A base-image bump
  // must update this reviewed index -> linux/arm64 manifest relationship.
  const arm64ManifestByIndex = new Map([
    [
      "sha256:0711b541c1c33a8a530ac4f0d391baa9a15b3d804695b1b24a47daa5fb60e74d",
      "sha256:8525258f39fa3365fcf9a9d01e85458c7280ad00bd30c5e67655311262257e9e",
    ],
  ]);
  for (const stage of dockerBaseStages) {
    const match = pinnedNodeBase.exec(stage);
    assert.ok(match, `Every full-image stage must pin node:24-trixie-slim by digest: ${stage}`);
    assert.ok(
      arm64ManifestByIndex.has(match[1]!),
      `The pinned Node manifest must have reviewed linux/arm64 support: ${match[1]}`,
    );
  }
} finally {
  delete process.env.TRUSTED_HOSTS;
  delete process.env.CSRF_TRUSTED_ORIGINS;
  await app.close();
}

console.log("Request Host security regressions passed.");
