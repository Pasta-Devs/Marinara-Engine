// Wrong Basic Auth passwords are counted per client address on every path, not
// only under /api where the general rate limits apply. After
// BASIC_AUTH_FAILURE_LIMIT different wrong passwords within the window, that
// address gets 429 with Retry-After, even for the right password, until the
// window ends. A correct password clears the count, a browser resending one
// saved wrong password counts once, and loopback, IP_ALLOWLIST and the local
// proxy rules keep working as before. A browser that signed in on /login keeps a
// random session token whose hash the server stores, so visitors sharing a local
// proxy's address cannot lock the owner out.
import assert from "node:assert/strict";
import { createHmac, randomBytes } from "node:crypto";
import Fastify from "../../packages/server/node_modules/fastify/fastify.js";
import type { FastifyRequest } from "fastify";
import {
  BASIC_AUTH_FAILURE_LIMIT,
  BASIC_AUTH_FAILURE_WINDOW_MS,
  basicAuthHook,
  loginRoutes,
  isBasicAuthSatisfied,
} from "../../packages/server/src/middleware/basic-auth.js";
import { hostValidationHook } from "../../packages/server/src/middleware/host-validation.js";
import { ipAllowlistHook } from "../../packages/server/src/middleware/ip-allowlist.js";
import { rateLimitHook } from "../../packages/server/src/middleware/rate-limit.js";
import { logger } from "../../packages/server/src/lib/logger.js";

const ENV_KEYS = [
  "ALLOW_UNAUTHENTICATED_PRIVATE_NETWORK",
  "ALLOW_UNAUTHENTICATED_REMOTE",
  "BASIC_AUTH_PASS",
  "BASIC_AUTH_USER",
  "BYPASS_AUTH_DOCKER",
  "BYPASS_AUTH_TAILSCALE",
  "ENCRYPTION_KEY",
  "IP_ALLOWLIST",
  "IP_ALLOWLIST_ENABLED",
  "MARINARA_DOCKER",
  "REQUIRE_AUTH_FOR_LOOPBACK_PROXY",
  "TRUSTED_HOSTS",
  "TRUSTED_PRIVATE_NETWORKS",
] as const;
const originalEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
for (const key of ENV_KEYS) delete process.env[key];
process.env.BASIC_AUTH_USER = "mari";
process.env.BASIC_AUTH_PASS = "secret";
process.env.TRUSTED_HOSTS = "chat.example.com";
const SERVER_KEY = "ab".repeat(32);
process.env.ENCRYPTION_KEY = SERVER_KEY;

const basic = (password: string) => `Basic ${Buffer.from(`mari:${password}`, "utf8").toString("base64")}`;
const RIGHT = basic("secret");
const HOST = { host: "chat.example.com" };

const warnings: unknown[][] = [];
const priorWarn = logger.warn;
logger.warn = ((...args: unknown[]) => warnings.push(args)) as typeof logger.warn;
const realNow = Date.now;

const app = Fastify();
// The same onRequest order as app.ts.
app.addHook("onRequest", hostValidationHook);
app.addHook("onRequest", ipAllowlistHook);
app.addHook("onRequest", rateLimitHook);
app.addHook("onRequest", basicAuthHook);
app.get("/", async () => "<!doctype html><title>Marinara</title>");
app.get("/api/chats", async () => [{ id: "private-chat" }]);
await app.register(loginRoutes);
app.get("/api/health", async (request: FastifyRequest) => ({
  status: "ok",
  ...(isBasicAuthSatisfied(request) ? { sidecars: {} } : {}),
}));

function get(url: string, remoteAddress: string, authorization?: string, headers: Record<string, string> = HOST) {
  return app.inject({
    method: "GET",
    url,
    remoteAddress,
    headers: authorization ? { ...headers, authorization } : headers,
  });
}

function signIn(remoteAddress: string, headers: Record<string, string> = HOST, password = "secret") {
  return app.inject({
    method: "POST",
    url: "/login",
    remoteAddress,
    headers: { ...headers, "content-type": "application/x-www-form-urlencoded" },
    payload: `user=mari&password=${encodeURIComponent(password)}`,
  });
}

async function guessWrong(url: string, remoteAddress: string, count: number, label: string) {
  for (let index = 0; index < count; index += 1) {
    const response = await get(url, remoteAddress, basic(`${label}-${index}`));
    assert.notEqual(response.statusCode, 429, `${label}: guess ${index + 1} is still answered`);
  }
}

try {
  await app.ready();

  // ── The page and static paths are throttled, not only /api ──
  const pageClient = "203.0.113.10";
  await guessWrong("/", pageClient, BASIC_AUTH_FAILURE_LIMIT, "page");
  const blocked = await get("/", pageClient, RIGHT);
  assert.equal(blocked.statusCode, 429, "after the limit even the right password is refused");
  const retryAfter = Number(blocked.headers["retry-after"]);
  assert.ok(
    retryAfter > 0 && retryAfter <= BASIC_AUTH_FAILURE_WINDOW_MS / 1000,
    `Retry-After is set: ${blocked.headers["retry-after"]}`,
  );
  assert.equal((await get("/api/chats", pageClient, RIGHT)).statusCode, 429, "the block covers /api too");
  assert.equal((await get("/assets/app.js", pageClient)).statusCode, 429, "and requests without a password");
  assert.equal(
    warnings.filter((args) => String(args[0]).includes("Wrong password from") && args[1] === pageClient).length,
    1,
    "the first wrong password from an address is logged once",
  );
  assert.ok(
    warnings.some((args) => String(args[0]).includes("refusing its sign-ins") && args[2] === pageClient),
    "reaching the limit is logged",
  );

  // ── The window ends ──
  Date.now = () => realNow() + BASIC_AUTH_FAILURE_WINDOW_MS + 1_000;
  assert.equal((await get("/", pageClient, RIGHT)).statusCode, 200, "the address may sign in after the window");
  Date.now = realNow;

  // ── A correct password clears the count ──
  const returningClient = "203.0.113.30";
  await guessWrong("/", returningClient, BASIC_AUTH_FAILURE_LIMIT - 1, "typo");
  assert.equal((await get("/", returningClient, RIGHT)).statusCode, 200);
  await guessWrong("/", returningClient, BASIC_AUTH_FAILURE_LIMIT - 1, "typo-again");
  assert.equal((await get("/", returningClient, RIGHT)).statusCode, 200, "earlier typos no longer count");

  // ── One saved wrong password counts once; no password does not count ──
  const staleClient = "203.0.113.20";
  for (let index = 0; index < BASIC_AUTH_FAILURE_LIMIT * 3; index += 1) {
    assert.equal((await get("/", staleClient, basic("old-password"))).statusCode, 401);
    assert.equal((await get("/", staleClient)).statusCode, 401);
  }
  assert.equal((await get("/", staleClient, RIGHT)).statusCode, 200, "a stale saved password does not lock out");

  // ── An IPv6 /64 counts as one client ──
  const half = Math.ceil(BASIC_AUTH_FAILURE_LIMIT / 2);
  await guessWrong("/", "2001:db8:1:2::1", half, "v6-a");
  await guessWrong("/", "2001:db8:1:2::2", BASIC_AUTH_FAILURE_LIMIT - half, "v6-b");
  assert.equal((await get("/", "2001:db8:1:2::3", RIGHT)).statusCode, 429, "the whole /64 is blocked");
  assert.equal((await get("/", "2001:db8:1:3::1", RIGHT)).statusCode, 200, "a neighbouring /64 is not");

  // ── The health probe counts passwords too, and stays open ──
  const healthClient = "203.0.113.50";
  assert.deepEqual((await get("/api/health", healthClient, RIGHT)).json(), { status: "ok", sidecars: {} });
  for (let index = 0; index < BASIC_AUTH_FAILURE_LIMIT; index += 1) {
    const response = await get("/api/health", healthClient, basic(`health-${index}`));
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), { status: "ok" }, "a wrong password gets the public reply");
  }
  assert.deepEqual(
    (await get("/api/health", healthClient, RIGHT)).json(),
    { status: "ok" },
    "a blocked address gets only the public health reply",
  );
  assert.equal((await get("/api/health", healthClient)).statusCode, 200, "uptime checks keep working");
  assert.equal((await get("/", healthClient, RIGHT)).statusCode, 429, "health guesses count everywhere");

  // ── Loopback, allowlisted peers and local proxies ──
  const loopback = { host: "127.0.0.1:7860" };
  const proxied = { ...loopback, "x-forwarded-for": "198.51.100.7" };
  for (let index = 0; index < BASIC_AUTH_FAILURE_LIMIT * 2; index += 1) {
    const response = await get("/", "127.0.0.1", basic(`at-the-computer-${index}`), loopback);
    assert.equal(response.statusCode, 200, "this computer skips the password and the count");
  }
  assert.equal((await get("/", "127.0.0.1", undefined, proxied)).statusCode, 401, "proxied visitors must log in");
  for (let index = 0; index < BASIC_AUTH_FAILURE_LIMIT; index += 1) {
    const response = await get("/", "127.0.0.1", basic(`via-proxy-${index}`), proxied);
    assert.equal(response.statusCode, 401);
  }
  assert.equal(
    (await get("/", "127.0.0.1", RIGHT, proxied)).statusCode,
    429,
    "visitors relayed by a local proxy are throttled",
  );
  assert.equal(
    (await get("/api/chats", "127.0.0.1", undefined, loopback)).statusCode,
    200,
    "this computer itself stays passwordless while its proxy is throttled",
  );

  // ── A browser that signed in before is not locked out by other visitors' guesses ──
  const firstSignIn = await signIn("203.0.113.60");
  assert.equal(firstSignIn.statusCode, 303);
  const setCookie = String(firstSignIn.headers["set-cookie"] ?? "");
  const signedInCookie = setCookie.split(";")[0] ?? "";
  assert.match(signedInCookie, /^marinara_session=[\w-]+$/, "signing in on /login sets the session cookie");
  assert.match(setCookie, /; HttpOnly/);
  assert.doesNotMatch(setCookie, /; Secure/, "a plain HTTP sign-in cannot keep a Secure cookie");
  // A cookie from before server-side sessions signs nobody in.
  const purposeKey = createHmac("sha256", Buffer.from(SERVER_KEY, "hex"))
    .update("basic-auth signed-in browser")
    .digest();
  const oldCookie = `marinara_signed_in=${createHmac("sha256", purposeKey).update(RIGHT).digest("base64url")}`;
  assert.equal(
    (await get("/", "203.0.113.61", undefined, { ...HOST, cookie: oldCookie })).statusCode,
    401,
    "an old signed-in cookie is ignored",
  );
  assert.equal(
    (await get("/", "203.0.113.60", RIGHT, { ...HOST, cookie: signedInCookie })).headers["set-cookie"],
    undefined,
    "a browser that has a session is not given another",
  );
  const owner = { ...proxied, cookie: signedInCookie };
  assert.equal((await get("/", "127.0.0.1", RIGHT, owner)).statusCode, 200, "the owner's browser still gets in");
  assert.equal((await get("/api/chats", "127.0.0.1", RIGHT, owner)).statusCode, 200);
  assert.deepEqual((await get("/api/health", "127.0.0.1", RIGHT, owner)).json(), { status: "ok", sidecars: {} });
  // The cookie is the browser's session: it signs in without a password, and a
  // stale saved password sent next to it is not counted as a guess.
  assert.equal((await get("/", "127.0.0.1", undefined, owner)).statusCode, 200, "the cookie signs the browser in");
  assert.equal(
    (await get("/", "127.0.0.1", basic("stale-saved"), owner)).statusCode,
    200,
    "a stale password next to the cookie is ignored",
  );
  assert.equal(
    (await get("/", "127.0.0.1", RIGHT, { ...proxied, cookie: "marinara_signed_in=made-up" })).statusCode,
    429,
    "a made-up cookie does not count",
  );
  assert.equal(
    (await get("/", "127.0.0.1", RIGHT, proxied)).statusCode,
    429,
    "the owner's visits do not lift the lock for other visitors",
  );

  // ── One proxied visitor signing in does not clear the others' count ──
  Date.now = () => realNow() + BASIC_AUTH_FAILURE_WINDOW_MS + 1_000;
  const httpsSignIn = await signIn("127.0.0.1", { ...proxied, "x-forwarded-proto": "https" });
  assert.equal(httpsSignIn.statusCode, 303);
  assert.match(
    String(httpsSignIn.headers["set-cookie"]),
    /; Secure/,
    "HTTPS through a local proxy gets a Secure cookie",
  );
  for (let index = 0; index < BASIC_AUTH_FAILURE_LIMIT - 1; index += 1) {
    const response = await get("/", "127.0.0.1", basic(`via-proxy-later-${index}`), proxied);
    assert.equal(response.statusCode, 401);
  }
  assert.equal((await get("/", "127.0.0.1", RIGHT, proxied)).statusCode, 200, "a proxied visitor may sign in");
  assert.equal((await get("/", "127.0.0.1", basic("via-proxy-last"), proxied)).statusCode, 401);
  assert.equal(
    (await get("/", "127.0.0.1", RIGHT, proxied)).statusCode,
    429,
    "the shared count kept the earlier guesses",
  );
  assert.equal((await get("/", "127.0.0.1", RIGHT, owner)).statusCode, 200, "the owner's browser still gets in");

  // ── Changing the password retires the cookie ──
  process.env.BASIC_AUTH_PASS = "changed";
  assert.equal(
    (await get("/", "127.0.0.1", basic("changed"), owner)).statusCode,
    429,
    "a cookie from the old password no longer gets through",
  );
  process.env.BASIC_AUTH_PASS = "secret";

  // ── A signed-in browser's health check needs no password, even while its address is locked ──
  const healthOwner = "203.0.113.70";
  const healthOwnerHeaders = { ...HOST, cookie: signedInCookie };
  await guessWrong("/", healthOwner, BASIC_AUTH_FAILURE_LIMIT, "health-owner");
  assert.deepEqual(
    (await get("/api/health", healthOwner, undefined, healthOwnerHeaders)).json(),
    { status: "ok", sidecars: {} },
    "the session gets the details",
  );
  assert.equal((await get("/", healthOwner, RIGHT)).statusCode, 429, "the address itself stays locked");
  // Wrong passwords sent with health checks count too.
  await guessWrong("/api/health", "203.0.113.80", BASIC_AUTH_FAILURE_LIMIT, "health-guess");
  assert.equal((await get("/", "203.0.113.80", RIGHT)).statusCode, 429, "health-check guesses count");

  Date.now = realNow;
  process.env.IP_ALLOWLIST = "192.168.1.20";
  for (let index = 0; index < BASIC_AUTH_FAILURE_LIMIT * 2; index += 1) {
    const response = await get("/api/chats", "192.168.1.20", basic(`allowlisted-${index}`), {
      host: "192.168.1.5:7860",
    });
    assert.equal(response.statusCode, 200, "an allowlisted address skips the password and the count");
  }
  delete process.env.IP_ALLOWLIST;

  // ── Behind a proxy, each browser that opened /login has its own count ──
  Date.now = () => realNow() + 2 * (BASIC_AUTH_FAILURE_WINDOW_MS + 1_000);
  const preAuth = async () => {
    const page = await app.inject({ method: "GET", url: "/login", remoteAddress: "127.0.0.1", headers: proxied });
    assert.equal(page.statusCode, 200);
    const cookie = String(page.headers["set-cookie"] ?? "").split(";")[0] ?? "";
    assert.match(cookie, /^marinara_login_client=[\w-]{22}$/, "the sign-in page gives each browser its own cookie");
    return { ...proxied, cookie };
  };
  const strangerA = await preAuth();
  const deviceB = await preAuth();
  assert.notEqual(strangerA.cookie, deviceB.cookie);
  for (let index = 0; index < BASIC_AUTH_FAILURE_LIMIT; index += 1) {
    assert.equal((await signIn("127.0.0.1", strangerA, `stranger-${index}`)).statusCode, 401);
  }
  assert.equal((await signIn("127.0.0.1", strangerA)).statusCode, 429, "the stranger stays locked");
  assert.equal(
    (await signIn("127.0.0.1", deviceB)).statusCode,
    303,
    "another browser behind the same proxy can still sign in",
  );
  // New cookies cannot buy unlimited guesses: all browsers behind the address share a cap of five times the limit.
  for (let index = 0; index < BASIC_AUTH_FAILURE_LIMIT * 4; index += 1) {
    const fresh = { ...proxied, cookie: `marinara_login_client=${randomBytes(16).toString("base64url")}` };
    assert.equal((await signIn("127.0.0.1", fresh, `dropped-${index}`)).statusCode, 401);
  }
  assert.equal((await signIn("127.0.0.1", await preAuth())).statusCode, 429, "the shared cap holds");
  assert.equal((await get("/", "127.0.0.1", undefined, owner)).statusCode, 200, "a signed-in browser still gets in");

  console.info("Basic Auth wrong-password throttle regressions passed.");
} finally {
  Date.now = realNow;
  logger.warn = priorWarn;
  await app.close();
  for (const key of ENV_KEYS) {
    const value = originalEnv[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}
