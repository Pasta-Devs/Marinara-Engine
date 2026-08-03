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

const { corsDelegate } = await import("../../packages/server/src/config/cors-config.js");
const { hostValidationHook, parseRequestHostname } =
  await import("../../packages/server/src/middleware/host-validation.js");

assert.equal(parseRequestHostname("192.168.1.50:7860"), "192.168.1.50");
assert.equal(parseRequestHostname("[fd7a:115c:a1e0::1]:7860"), "fd7a:115c:a1e0::1");
assert.equal(parseRequestHostname("Mari-Box.local.:7860"), "mari-box.local");
assert.equal(parseRequestHostname("attacker.example/path"), null);
assert.equal(parseRequestHostname("attacker.example:0"), null);
assert.equal(parseRequestHostname("attacker.example:99999"), null);
assert.equal(parseRequestHostname("attacker.example, localhost:7860"), null);

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
} finally {
  delete process.env.TRUSTED_HOSTS;
  delete process.env.CSRF_TRUSTED_ORIGINS;
  await app.close();
}

console.log("Request Host security regressions passed.");
