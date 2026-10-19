// A reverse proxy or tunnel on the same computer connects to Marinara from
// 127.0.0.1, so every visitor it relays has a loopback socket address. Such a
// request must not inherit the passwordless trust meant for the person sitting
// at this computer: it carries proxy forwarding headers and must pass the same
// Basic Auth, IP allowlist, admin-secret and loopback-only checks as any other
// remote client. Direct loopback traffic and the server's own internal calls
// stay passwordless.
import assert from "node:assert/strict";
import Fastify from "../../packages/server/node_modules/fastify/fastify.js";
import type { FastifyReply, FastifyRequest } from "fastify";
import { basicAuthHook } from "../../packages/server/src/middleware/basic-auth.js";
import { csrfProtectionHook } from "../../packages/server/src/middleware/csrf-protection.js";
import { hostValidationHook } from "../../packages/server/src/middleware/host-validation.js";
import { ipAllowlistHook, isLoopbackRequest } from "../../packages/server/src/middleware/ip-allowlist.js";
import { requirePrivilegedAccess } from "../../packages/server/src/middleware/privileged-gate.js";
import { forwardPromptPreview } from "../../packages/server/src/routes/generate/prompt-preview.js";

const ENV_KEYS = [
  "ADMIN_SECRET",
  "ALLOW_UNAUTHENTICATED_PRIVATE_NETWORK",
  "ALLOW_UNAUTHENTICATED_REMOTE",
  "BASIC_AUTH_PASS",
  "BASIC_AUTH_USER",
  "BYPASS_AUTH_DOCKER",
  "BYPASS_AUTH_TAILSCALE",
  "CORS_ORIGINS",
  "CSRF_TRUSTED_ORIGINS",
  "HOST",
  "IP_ALLOWLIST",
  "IP_ALLOWLIST_ENABLED",
  "MARINARA_DOCKER",
  "MARINARA_REQUIRE_ADMIN_SECRET_ON_LOOPBACK",
  "REQUIRE_AUTH_FOR_LOOPBACK_PROXY",
  "TRUSTED_HOSTS",
  "TRUSTED_PRIVATE_NETWORKS",
] as const;
const originalEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
for (const key of ENV_KEYS) delete process.env[key];

const BASIC = `Basic ${Buffer.from("mari:secret", "utf8").toString("base64")}`;
const LOCAL_HOST = { host: "127.0.0.1:7860" };
const PROXIED = { ...LOCAL_HOST, "x-forwarded-for": "203.0.113.66", "x-forwarded-proto": "https" };
let innerPreviewHeaders: Record<string, unknown> | undefined;

const app = Fastify();
// The same onRequest order as app.ts.
app.addHook("onRequest", hostValidationHook);
app.addHook("onRequest", ipAllowlistHook);
app.addHook("onRequest", basicAuthHook);
app.addHook("onRequest", csrfProtectionHook);
app.get("/api/chats", async () => [{ id: "private-chat" }]);
app.post("/api/chats", async () => ({ created: true }));
app.post("/api/backup/download", async (request: FastifyRequest, reply: FastifyReply) => {
  if (!requirePrivilegedAccess(request, reply, { feature: "Backup download" })) return reply;
  return { backup: true };
});
app.post("/api/updates/apply", async (request: FastifyRequest, reply: FastifyReply) => {
  if (!requirePrivilegedAccess(request, reply, { feature: "Update apply", loopbackOnly: true })) return reply;
  return { applied: true };
});
app.post("/api/generate/dryRun", async (request: FastifyRequest) => {
  innerPreviewHeaders = { ...request.headers };
  return { prompt: { messages: [] } };
});
app.post("/api/chats/:id/peek-prompt", async (request: FastifyRequest, reply: FastifyReply) => {
  const preview = await forwardPromptPreview(app, request, { chatId: "chat" });
  return reply.status(preview.statusCode).send(preview.body);
});

function inject(method: "GET" | "POST", url: string, headers: Record<string, string>, remoteAddress = "127.0.0.1") {
  return app.inject({ method, url, headers, remoteAddress, ...(method === "POST" ? { payload: {} } : {}) });
}

try {
  await app.ready();

  // ── Basic Auth ──
  process.env.BASIC_AUTH_USER = "mari";
  process.env.BASIC_AUTH_PASS = "secret";
  process.env.ADMIN_SECRET = "admin-secret";

  assert.equal((await inject("GET", "/api/chats", LOCAL_HOST)).statusCode, 200, "direct loopback stays passwordless");
  assert.equal(
    (await inject("GET", "/api/chats", PROXIED)).statusCode,
    401,
    "a visitor relayed by a local proxy must log in",
  );
  assert.equal(
    (await inject("GET", "/api/chats", { ...PROXIED, host: "chat.example.com" })).statusCode,
    421,
    "an untrusted public name is still rejected before authentication",
  );
  process.env.TRUSTED_HOSTS = "chat.example.com";
  assert.equal(
    (await inject("GET", "/api/chats", { ...PROXIED, host: "chat.example.com" })).statusCode,
    401,
    "a trusted public proxy name does not skip the login",
  );
  delete process.env.TRUSTED_HOSTS;

  const forwardingHeaders: Array<[string, string]> = [
    ["forwarded", "for=203.0.113.66;proto=https"],
    ["x-forwarded-for", "203.0.113.66"],
    ["x-real-ip", "203.0.113.66"],
    ["x-forwarded-host", "chat.example.com"],
    ["x-forwarded-proto", "https"],
    ["cf-connecting-ip", "203.0.113.66"],
    ["true-client-ip", "203.0.113.66"],
    ["tailscale-user-login", "guest@example.com"],
    ["tailscale-funnel-request", "?1"],
    ["via", "1.1 proxy"],
  ];
  for (const [header, value] of forwardingHeaders) {
    const response = await inject("GET", "/api/chats", { ...LOCAL_HOST, [header]: value });
    assert.equal(response.statusCode, 401, `${header} on a loopback socket must require Basic Auth`);
  }
  assert.equal(
    (await inject("GET", "/api/chats", { ...PROXIED, authorization: BASIC })).statusCode,
    200,
    "a proxied visitor with valid credentials keeps working",
  );

  // ── Admin secret and loopback-only routes ──
  assert.equal(
    (await inject("POST", "/api/backup/download", LOCAL_HOST)).statusCode,
    200,
    "direct loopback keeps privileged access without the admin secret",
  );
  const proxiedBackup = await inject("POST", "/api/backup/download", { ...PROXIED, authorization: BASIC });
  assert.equal(proxiedBackup.statusCode, 403, "a proxied visitor needs the admin secret for privileged routes");
  assert.equal(
    (
      await inject("POST", "/api/backup/download", {
        ...PROXIED,
        authorization: BASIC,
        "x-admin-secret": "admin-secret",
      })
    ).statusCode,
    200,
    "a proxied visitor with credentials and the admin secret may use privileged routes",
  );
  assert.equal((await inject("POST", "/api/updates/apply", LOCAL_HOST)).statusCode, 200);
  assert.equal(
    (
      await inject("POST", "/api/updates/apply", {
        ...PROXIED,
        authorization: BASIC,
        "x-admin-secret": "admin-secret",
      })
    ).statusCode,
    403,
    "loopback-only routes stay unavailable to proxied visitors",
  );

  // ── CSRF loopback-origin shortcut ──
  const localhostOrigin = { origin: "http://localhost:5555", "x-marinara-csrf": "1" };
  assert.equal((await inject("POST", "/api/chats", { ...LOCAL_HOST, ...localhostOrigin })).statusCode, 200);
  assert.equal(
    (await inject("POST", "/api/chats", { ...PROXIED, authorization: BASIC, ...localhostOrigin })).statusCode,
    403,
    "a localhost page on the visitor's own device is not this computer",
  );

  // ── IP allowlist ──
  process.env.IP_ALLOWLIST = "127.0.0.1,10.9.9.9";
  assert.equal((await inject("GET", "/api/chats", LOCAL_HOST)).statusCode, 200);
  assert.equal(
    (await inject("GET", "/api/chats", { ...PROXIED, authorization: BASIC })).statusCode,
    403,
    "a listed loopback address must not admit every visitor of a local proxy",
  );
  delete process.env.IP_ALLOWLIST;

  // ── No auth configured: the remote lockdown applies ──
  delete process.env.BASIC_AUTH_USER;
  delete process.env.BASIC_AUTH_PASS;
  assert.equal((await inject("GET", "/api/chats", LOCAL_HOST)).statusCode, 200);
  assert.equal(
    (await inject("GET", "/api/chats", PROXIED)).statusCode,
    403,
    "an unauthenticated proxy must not expose the app",
  );
  process.env.ALLOW_UNAUTHENTICATED_PRIVATE_NETWORK = "true";
  assert.equal(
    (await inject("GET", "/api/chats", PROXIED)).statusCode,
    403,
    "the private-network opt-in does not cover proxied visitors",
  );
  delete process.env.ALLOW_UNAUTHENTICATED_PRIVATE_NETWORK;
  const lanPage = await inject("GET", "/", { host: "192.168.1.20:7860", accept: "text/html" }, "192.168.1.77");
  assert.equal(lanPage.statusCode, 403);
  assert.match(lanPage.body, /IP_ALLOWLIST=192\.168\.1\.77/u, "a LAN device still gets its allowlist snippet");
  assert.match(lanPage.body, /ALLOW_UNAUTHENTICATED_PRIVATE_NETWORK=true/u);
  const lockdownPage = await inject("GET", "/", { ...PROXIED, accept: "text/html" });
  assert.equal(lockdownPage.statusCode, 403);
  assert.match(
    lockdownPage.body,
    /REQUIRE_AUTH_FOR_LOOPBACK_PROXY=false/u,
    "the lockdown page names the proxy opt-out",
  );
  assert.doesNotMatch(
    lockdownPage.body,
    /IP_ALLOWLIST=127\.0\.0\.1/u,
    "the page must not suggest allowlisting loopback",
  );

  // ── Explicit opt-out for proxies that handle the login themselves ──
  process.env.REQUIRE_AUTH_FOR_LOOPBACK_PROXY = "false";
  assert.equal(
    (await inject("GET", "/api/chats", PROXIED)).statusCode,
    200,
    "REQUIRE_AUTH_FOR_LOOPBACK_PROXY=false restores the legacy proxy trust",
  );
  delete process.env.REQUIRE_AUTH_FOR_LOOPBACK_PROXY;

  // ── Request helper ──
  const fakeRequest = (headers: Record<string, string>, ip = "127.0.0.1") =>
    ({ headers, ip, raw: { socket: { localAddress: "127.0.0.1" } } }) as unknown as FastifyRequest;
  assert.equal(isLoopbackRequest(fakeRequest({})), true);
  assert.equal(isLoopbackRequest(fakeRequest({ "x-forwarded-for": "203.0.113.66" })), false);
  assert.equal(isLoopbackRequest(fakeRequest({ "x-forwarded-for": "   " })), true, "empty headers carry no client");
  assert.equal(isLoopbackRequest(fakeRequest({}, "192.168.1.20")), false);

  // ── The server's own prompt-preview hop stays a trusted local call ──
  process.env.BASIC_AUTH_USER = "mari";
  process.env.BASIC_AUTH_PASS = "secret";
  process.env.IP_ALLOWLIST = "192.168.1.20";
  const preview = await inject(
    "POST",
    "/api/chats/chat/peek-prompt",
    {
      host: "192.168.1.20",
      origin: "https://192.168.1.20",
      "x-marinara-csrf": "1",
      "x-forwarded-proto": "https",
      "x-forwarded-host": "192.168.1.20",
      via: "1.1 lan-proxy",
    },
    "192.168.1.20",
  );
  assert.equal(
    preview.statusCode,
    200,
    `an allowlisted proxy's preview must reach the internal route: ${preview.body}`,
  );
  for (const header of ["x-forwarded-proto", "x-forwarded-host", "via", "origin"]) {
    assert.equal(innerPreviewHeaders?.[header], undefined, `the internal preview hop must not carry ${header}`);
  }

  console.info("Loopback proxy authentication regressions passed.");
} finally {
  await app.close();
  for (const key of ENV_KEYS) {
    const value = originalEnv[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}
