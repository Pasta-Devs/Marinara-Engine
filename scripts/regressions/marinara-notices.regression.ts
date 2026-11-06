// Marinara notices are remote content from the `notices` branch. Pin the strict
// filter (shape, expiry, version range, link allowlist) and that only the owner
// receives them, never an anonymous remote visitor.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import Fastify from "../../packages/server/node_modules/fastify/fastify.js";
import { noticesRoutes, parseMarinaraNotices, versionInRange } from "../../packages/server/src/routes/notices.routes.js";
import { APP_VERSION } from "../../packages/shared/src/constants/defaults.js";

const ENV_KEYS = ["ADMIN_SECRET", "BASIC_AUTH_USER", "BASIC_AUTH_PASS", "MARINARA_NOTICES_ENABLED", "MARINARA_NOTICES_URL", "IP_ALLOWLIST"];
const originalEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
for (const key of ENV_KEYS) delete process.env[key];

const now = Date.parse("2026-10-21T12:00:00Z");
const valid = {
  id: "2026-10-proxy-auth",
  level: "critical",
  versions: "<=2.5.1",
  title: "Security update available",
  text: "If you use a reverse proxy or tunnel, update now.",
  action: "Update Marinara, or set a password.",
  expires: "2026-12-31",
  link: "https://github.com/Pasta-Devs/Marinara-Engine/releases",
};
const parse = (entries: unknown[], version = "2.5.1") => parseMarinaraNotices(entries, version, now);

const { id, level, title, text, action, link } = valid;
assert.deepEqual(parse([valid]), [{ id, level, title, text, action, link }]);
assert.equal(parse([{ ...valid, action: undefined }]).length, 0, "missing action is dropped");
assert.equal(parse([{ ...valid, expires: undefined }]).length, 0, "missing expires is dropped");
assert.equal(parse([{ ...valid, expires: "2026-10-20" }]).length, 0, "expired notice is dropped");
assert.equal(parse([{ ...valid, expires: "2026-10-21" }]).length, 1, "notice still shows on its expires day");
assert.equal(parse([{ ...valid, level: "info" }]).length, 0, "unknown level is dropped");
assert.equal(parse([valid], "2.5.2").length, 0, "non-matching version is dropped");
assert.equal(parse([{ ...valid, versions: "not a range" }]).length, 0, "invalid range is dropped");
assert.equal(parse([valid, { ...valid, title: "Duplicate" }]).length, 1, "duplicate ids show once");
assert.equal(parseMarinaraNotices({ notices: [valid] }, "2.5.1", now).length, 0, "a non-array file is ignored");
assert.equal(
  parse(Array.from({ length: 21 }, (_, i) => ({ ...valid, id: `n${i}` }))).length,
  0,
  "an oversized file is ignored",
);
assert.equal(parse([{ ...valid, text: "x".repeat(501) }]).length, 0, "over-long text is dropped");

for (const link of [
  "https://evil.example/Pasta-Devs/",
  "https://github.com/someone-else/repo",
  "https://github.com/Pasta-Devs/../evil",
  "http://github.com/Pasta-Devs/Marinara-Engine",
  "javascript:alert(1)",
  "https://evil@github.com/Pasta-Devs/x",
]) {
  assert.equal(parse([{ ...valid, link }])[0]?.link, null, `link ${link} is dropped`);
}
const html = "<b>Update</b> <script>alert(1)</script>";
assert.equal(
  parse([{ ...valid, text: html }])[0]?.text,
  html,
  "HTML stays plain text for the client to render as text",
);

assert.ok(versionInRange("2.5.1", ">=2.4.0 <2.5.2"));
assert.ok(!versionInRange("2.5.2", ">=2.4.0 <2.5.2"));
assert.ok(versionInRange("2.5.1", ">= 2.4.0 < 2.5.2"), "a space after the operator still matches");
assert.ok(!versionInRange("2.5.2", ">= 2.4.0 < 2.5.2"));
assert.ok(versionInRange("2.5.1", "2.4.0 || 2.5.1"));
assert.ok(versionInRange("2.5.1", ">2.5.0"));
assert.ok(!versionInRange("2.5.1", ">2.5.1"));

// ── Owner-only endpoint, fed by a local notices file ──
const fileServer = createServer((_req, res) => res.end(JSON.stringify([{ ...valid, versions: `=${APP_VERSION}` }])));
await new Promise<void>((resolve) => fileServer.listen(0, "127.0.0.1", resolve));
process.env.MARINARA_NOTICES_URL = `http://127.0.0.1:${(fileServer.address() as AddressInfo).port}/notices.json`;
process.env.ADMIN_SECRET = "admin-secret";

const app = Fastify();
await app.register(noticesRoutes, { prefix: "/api/notices" });
const get = async (remoteAddress: string, headers: Record<string, string> = {}) => {
  const res = await app.inject({
    method: "GET",
    url: "/api/notices",
    remoteAddress,
    headers: { host: "127.0.0.1:7860", ...headers },
  });
  assert.equal(res.statusCode, 200);
  return (res.json() as { notices: unknown[] }).notices.length;
};

try {
  await app.ready();
  for (let i = 0; i < 50 && (await get("127.0.0.1")) === 0; i++) await new Promise((r) => setTimeout(r, 50));
  assert.equal(await get("127.0.0.1"), 1, "the local owner sees the notice");
  assert.equal(await get("203.0.113.5"), 0, "an anonymous remote visitor gets no notice data");
  assert.equal(await get("192.168.1.20"), 0, "an anonymous LAN visitor gets no notice data");
  assert.equal(await get("127.0.0.1", { "x-forwarded-for": "203.0.113.5" }), 0, "a proxied visitor is not the owner");
  assert.equal(await get("203.0.113.5", { "x-admin-secret": "admin-secret" }), 1, "the admin secret proves the owner");
  process.env.IP_ALLOWLIST = "192.168.1.20";
  assert.equal(await get("192.168.1.20"), 1, "an IP_ALLOWLIST peer without a password sees the notice");
  delete process.env.IP_ALLOWLIST;
  process.env.MARINARA_NOTICES_ENABLED = "false";
  assert.equal(await get("127.0.0.1"), 0, "the opt-out hides notices");
  console.info("Marinara notices regressions passed.");
} finally {
  await app.close();
  fileServer.close();
  for (const key of ENV_KEYS) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
}
