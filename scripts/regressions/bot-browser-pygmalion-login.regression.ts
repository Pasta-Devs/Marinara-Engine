import assert from "node:assert/strict";
import { promises as dns } from "node:dns";
import { createRequire } from "node:module";
import { Writable } from "node:stream";
import { inspect } from "node:util";
import { logger } from "../../packages/server/src/lib/logger.js";
import { errorHandler } from "../../packages/server/src/middleware/error-handler.js";
import { botBrowserPygmalionRoutes } from "../../packages/server/src/routes/bot-browser-pygmalion.routes.js";

// Pygmalion token login (#7074). Every upstream call is stubbed: no DNS, no real Pygmalion traffic.
const requireFromServer = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const Fastify = requireFromServer("fastify");
const pino = requireFromServer("pino");

const API_HOST = "server.pygmalion.chat";
const ASSETS_HOST = "assets.pygmalion.chat";
const GOOD = "PYG-good.7074_tok~en+/=";
const REJECTED = "PYG-rejected-7074";
const BUSY = "PYG-busy-7074";
const LEAKY = "PYG-leaky-7074";
const SECRETS = [
  "PYG-good",
  "PYG-rejected",
  "PYG-busy",
  "PYG-leaky",
  "PYG-CR",
  "PYG-NUL",
  "PYG-TAB",
  "PYG-LF",
  "PYG SP",
];
const PNG = Buffer.from(
  "89504e470d0a1a0a0000000d4948445200000001000000010806000000" +
    "1f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082",
  "hex",
);

type Mode = "ok" | "unauthorized" | "forbidden" | "redirect" | "throw";
let mode: Mode = "ok";
const requests: Array<{ url: URL; authorization: string | null }> = [];

async function upstream(url: URL, authorization: string | null): Promise<Response> {
  if (url.hostname === ASSETS_HOST && url.pathname === "/avatars/moved.png") {
    return new Response(null, { status: 302, headers: { location: "/avatars/a.png" } });
  }
  if (url.hostname === ASSETS_HOST && url.pathname === "/avatars/away.png") {
    return new Response(null, { status: 302, headers: { location: "https://evil.example/x.png" } });
  }
  if (url.hostname === ASSETS_HOST || url.hostname === "evil.example") {
    return new Response(PNG, { headers: { "content-type": "image/png" } });
  }
  if (url.hostname !== API_HOST) return new Response("not found", { status: 404 });
  const token = authorization?.replace(/^Bearer /, "") ?? "";
  if (mode === "throw" || token === LEAKY) {
    // Mirrors undici, whose errors can quote the rejected header value.
    throw new TypeError(`fetch failed: invalid header value "${authorization}"`);
  }
  if (mode === "redirect") {
    return new Response(null, { status: 307, headers: { location: "https://evil.example/steal" } });
  }
  if (mode === "unauthorized" || token === REJECTED) {
    return Response.json({ code: "unauthenticated", message: `bad token ${token}` }, { status: 401 });
  }
  if (mode === "forbidden") return Response.json({ code: "permission_denied" }, { status: 403 });
  if (token === BUSY) return Response.json({ code: "unavailable" }, { status: 503 });
  return Response.json({ characters: [], totalItems: "0", character: { id: "c1" } });
}

// Follows redirects the way fetch does unless the caller asked for manual handling.
async function stubFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const url = new URL(input instanceof Request ? input.url : String(input));
  const headers = new Headers(init.headers);
  const authorization = headers.get("authorization");
  requests.push({ url, authorization });
  const response = await upstream(url, authorization);
  const location = response.headers.get("location");
  if (init.redirect !== "manual" && location && response.status >= 300 && response.status < 400) {
    const next = new URL(location, url);
    if (next.origin !== url.origin) headers.delete("authorization");
    return stubFetch(next, { ...init, headers });
  }
  return response;
}

const logLines: string[] = [];
const sink = new Writable({
  write(chunk, _encoding, callback) {
    logLines.push(String(chunk));
    callback();
  },
});
for (const level of ["trace", "debug", "info", "warn", "error", "fatal"] as const) {
  const original = logger[level].bind(logger);
  (logger as unknown as Record<string, unknown>)[level] = (...args: unknown[]) => {
    logLines.push(inspect(args, { depth: 6 }));
    return (original as (...a: unknown[]) => void)(...args);
  };
}

const originalFetch = globalThis.fetch;
const originalLookup = dns.lookup;
dns.lookup = (async () => [{ address: "93.184.216.34", family: 4 }]) as unknown as typeof dns.lookup;
globalThis.fetch = stubFetch as typeof fetch;

const app = Fastify({ loggerInstance: pino({ level: "trace" }, sink) });
app.setErrorHandler(errorHandler);
await app.register(botBrowserPygmalionRoutes, { prefix: "/api/bot-browser" });

const call = async (method: "GET" | "POST", path: string, payload?: object) => {
  const response = await app.inject({ method, url: `/api/bot-browser/pygmalion${path}`, payload });
  return { status: response.statusCode, body: response.body };
};
const setToken = (token: string) => call("POST", "/set-token", { token });
const sessionActive = async () => JSON.parse((await call("GET", "/session")).body).active as boolean;
const assertNoSecret = (text: string, label: string) => {
  for (const secret of SECRETS) assert.ok(!text.includes(secret), `${label} must not contain the token: ${text}`);
};
const login = async () => {
  mode = "ok";
  const response = await setToken(GOOD);
  assert.equal(response.status, 200, response.body);
  assert.equal(await sessionActive(), true);
};

try {
  // 1. Characters a token can't contain are rejected before anything is stored or sent.
  for (const bad of ["PYG-CR\rX", "PYG-NUL\u0000X", "PYG-TAB\tX", "PYG-LF\nX", "Bearer PYG SP"]) {
    const response = await setToken(bad);
    assert.equal(response.status, 400, `${JSON.stringify(bad)} should be rejected: ${response.body}`);
    assertNoSecret(response.body, "set-token rejection");
    assert.equal(await sessionActive(), false, `${JSON.stringify(bad)} must not be stored`);
  }
  assert.equal(requests.length, 0, "malformed tokens never reach Pygmalion");

  // 2. A token Pygmalion doesn't accept is never stored, and the reply names a fixed reason.
  for (const [token, reason] of [
    [REJECTED, "rejected"],
    [BUSY, "busy"],
    [LEAKY, "unreachable"],
  ] as const) {
    const response = await setToken(token);
    assert.ok(response.status >= 400, `${token} should fail validation: ${response.body}`);
    assert.equal(JSON.parse(response.body).reason, reason);
    assertNoSecret(response.body, `set-token ${reason}`);
    assert.equal(await sessionActive(), false, `${token} must not be stored`);
    assertNoSecret((await call("GET", "/validate")).body, "validate");
  }

  // 3. A stored token is checked with Pygmalion first, over a pinned, non-redirecting request.
  requests.length = 0;
  await login();
  assert.deepEqual(
    requests.map(({ url, authorization }) => [url.hostname, authorization]),
    [[API_HOST, `Bearer ${GOOD}`]],
  );

  // 4. Errors from requests that carry the token never echo it, in replies or logs.
  mode = "throw";
  for (const path of ["/search?includeSensitive=true", "/character?id=c1", "/validate"]) {
    const response = await call("GET", path);
    assert.match(response.body, /Couldn't reach Pygmalion/, path);
    assertNoSecret(response.body, path);
  }
  assert.equal(await sessionActive(), true, "a network failure keeps the login");

  // 5. Redirects are not followed, so Pygmalion requests reach only Pygmalion's API host.
  mode = "redirect";
  for (const path of ["/search?includeSensitive=true", "/search", "/character?id=c1"]) {
    const response = await call("GET", path);
    assert.notEqual(response.status, 200, `${path} must not follow a redirect: ${response.body}`);
  }
  assert.ok((await setToken(GOOD)).status >= 400, "validation must not follow a redirect");
  assert.deepEqual(
    [...new Set(requests.map(({ url }) => url.hostname))],
    [API_HOST],
    "requests go only to the pinned host",
  );

  // 6. Pygmalion rejecting the stored token on search or detail ends the session.
  for (const path of ["/search?includeSensitive=true", "/character?id=c1"]) {
    await login();
    mode = "unauthorized";
    const response = await call("GET", path);
    assert.equal(response.status, 401, `${path}: ${response.body}`);
    assert.equal(JSON.parse(response.body).sessionExpired, true);
    assertNoSecret(response.body, path);
    assert.equal(await sessionActive(), false, `${path} 401 clears the token`);
  }

  // A 403 is permission_denied for one item, which any page can ask for, so the login stays.
  await login();
  mode = "forbidden";
  const forbidden = await call("GET", "/character?id=private-char");
  assert.notEqual(JSON.parse(forbidden.body).sessionExpired, true, forbidden.body);
  assertNoSecret(forbidden.body, "403 character");
  assert.equal(await sessionActive(), true, "a 403 keeps the login");

  // 7. The avatar proxy fetches only Pygmalion images; relative paths and same-host redirects keep working.
  requests.length = 0;
  const foreign = await call("GET", `/avatar/${encodeURIComponent("https://evil.example/x.png")}`);
  assert.equal(foreign.status, 400, foreign.body);
  for (const path of [
    "avatars/a.png",
    "avatars/moved.png",
    encodeURIComponent(`https://${ASSETS_HOST}/avatars/b.png`),
  ]) {
    const response = await call("GET", `/avatar/${path}`);
    assert.equal(response.status, 200, `${path}: ${response.body}`);
  }
  const away = await call("GET", "/avatar/avatars/away.png");
  assert.notEqual(away.status, 200, `an avatar redirect off Pygmalion must not be followed: ${away.body}`);
  assert.deepEqual(
    [...new Set(requests.map(({ url, authorization }) => `${url.hostname} ${authorization}`))],
    [`${ASSETS_HOST} null`],
    "avatar requests go only to Pygmalion, without the token",
  );

  assertNoSecret(logLines.join("\n"), "server logs");
  console.info("Pygmalion login: token shape, validate-before-store, pinned hosts, expiry and avatars passed.");
} finally {
  await app.close();
  globalThis.fetch = originalFetch;
  dns.lookup = originalLookup;
}
