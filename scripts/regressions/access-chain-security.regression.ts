// Runs the real buildApp() onRequest chain, so removing an access hook from app.ts fails here.
// With no login, allowlist or opt-in, a remote client must be locked out of every route kind.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-access-chain-"));
process.on("exit", () => rmSync(dataDir, { recursive: true, force: true }));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "file-storage");
process.env.MARINARA_FILE_STORAGE_DIR = join(dataDir, "file-storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.MARINARA_ENV_FILE = join(dataDir, ".env");
process.env.HOST = "0.0.0.0";

const ENV_KEYS = [
  "ALLOW_UNAUTHENTICATED_PRIVATE_NETWORK",
  "BASIC_AUTH_PASS",
  "BASIC_AUTH_USER",
  "BYPASS_AUTH_DOCKER",
  "BYPASS_AUTH_TAILSCALE",
  "IP_ALLOWLIST",
  "IP_ALLOWLIST_ENABLED",
  "MARINARA_DOCKER",
  "REQUIRE_AUTH_FOR_LOOPBACK_PROXY",
  "TRUSTED_HOSTS",
  "TRUSTED_PRIVATE_NETWORKS",
] as const;
function resetEnv() {
  for (const key of ENV_KEYS) delete process.env[key];
}
resetEnv();

const { buildApp } = await import("../../packages/server/src/app.js");

const REMOTE = "192.168.1.50";
const app = await buildApp();
await app.ready();

function get(url: string, remoteAddress = REMOTE, headers: Record<string, string> = {}) {
  return app.inject({ method: "GET", url, remoteAddress, headers: { host: "192.168.1.20:7860", ...headers } });
}

async function assertRemoteLockedOut(label: string) {
  for (const url of ["/api/chats", "/api/avatars/none.png", "/api/backgrounds/none.png", "/", "/no/such/path"]) {
    assert.equal((await get(url)).statusCode, 403, `${label}: GET ${url}`);
  }
  const generate = await app.inject({
    method: "POST",
    url: "/api/generate",
    remoteAddress: REMOTE,
    headers: { host: "192.168.1.20:7860", "content-type": "application/json" },
    payload: {},
  });
  assert.equal(generate.statusCode, 403, `${label}: POST /api/generate`);
}

try {
  // Default: nothing configured.
  await assertRemoteLockedOut("default");
  assert.equal((await get("/api/health")).statusCode, 200, "health stays reachable");
  assert.equal(
    (await get("/api/chats", "127.0.0.1", { host: "127.0.0.1:7860" })).statusCode,
    200,
    "loopback gets through",
  );
  assert.notEqual(
    (await get("/", "127.0.0.1", { host: "127.0.0.1:7860" })).statusCode,
    403,
    "loopback gets the app shell",
  );

  // Partial or invalid config must not broaden access.
  const cases: Array<[string, Record<string, string>]> = [
    ["only BASIC_AUTH_USER", { BASIC_AUTH_USER: "mari" }],
    ["only BASIC_AUTH_PASS", { BASIC_AUTH_PASS: "secret" }],
    ["empty IP_ALLOWLIST", { IP_ALLOWLIST: "" }],
    ["invalid-only IP_ALLOWLIST", { IP_ALLOWLIST: "not-an-ip,999.1.1.1/40" }],
    ["allowlist without the client", { IP_ALLOWLIST: "10.9.9.9" }],
    ["malformed BYPASS_AUTH_DOCKER", { BYPASS_AUTH_DOCKER: "maybe" }],
    ["malformed BYPASS_AUTH_TAILSCALE", { BYPASS_AUTH_TAILSCALE: "maybe" }],
  ];
  for (const [label, env] of cases) {
    resetEnv();
    Object.assign(process.env, env);
    await assertRemoteLockedOut(label);
  }

  // Valid credentials must not get past the allowlist: only ipAllowlistHook can deny this client.
  resetEnv();
  Object.assign(process.env, { BASIC_AUTH_USER: "mari", BASIC_AUTH_PASS: "secret", IP_ALLOWLIST: "10.9.9.9" });
  const authorization = `Basic ${Buffer.from("mari:secret").toString("base64")}`;
  assert.equal(
    (await get("/api/chats", "10.9.9.9", { authorization })).statusCode,
    200,
    "allowlisted client with valid login",
  );
  assert.equal(
    (await get("/api/chats", REMOTE, { authorization })).statusCode,
    403,
    "valid login outside the allowlist",
  );

  resetEnv();
  // let the 2 s login-file cache recheck
  await new Promise((r) => setTimeout(r, 2_100));
  writeFileSync(join(dataDir, ".remote-login.json"), "{ not json");
  await assertRemoteLockedOut("damaged login file");
  rmSync(join(dataDir, ".remote-login.json"));

  // Documented limit (docs/REMOTE_ACCESS.md): a same-host relay with no forwarding headers is indistinguishable
  // from a local browser, so pin that it is treated as local.
  resetEnv();
  assert.notEqual((await get("/api/chats", "127.0.0.1", { host: "127.0.0.1:7860" })).statusCode, 403);

  console.info("Access chain regressions passed.");
} finally {
  resetEnv();
  await app.close();
}
