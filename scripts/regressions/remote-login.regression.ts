// Remote login (#7912): a login saved in the app protects remote access like the
// .env pair, browsers sign in on /login instead of the Basic Auth dialog and get a
// server-side session, scripts keep sending Basic Authorization, and the first
// login can be set from the Docker host with a one-time setup code from the log.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  unlinkSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import Fastify from "../../packages/server/node_modules/fastify/fastify.js";

const ENV_KEYS = [
  "ADMIN_SECRET",
  "ALLOW_UNAUTHENTICATED_PRIVATE_NETWORK",
  "ALLOW_UNAUTHENTICATED_REMOTE",
  "BASIC_AUTH_PASS",
  "BASIC_AUTH_USER",
  "BYPASS_AUTH_DOCKER",
  "BYPASS_AUTH_TAILSCALE",
  "DATA_DIR",
  "ENCRYPTION_KEY",
  "IP_ALLOWLIST",
  "MARINARA_DOCKER",
  "REQUIRE_AUTH_FOR_LOOPBACK_PROXY",
  "TRUSTED_HOSTS",
  "TRUSTED_PRIVATE_NETWORKS",
] as const;
const originalEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
// The runner gives each file its own DATA_DIR; a direct run must not touch real data.
const ownDataDir = process.env.DATA_DIR ? null : mkdtempSync(join(tmpdir(), "marinara-remote-login-"));
for (const key of ENV_KEYS) if (key !== "DATA_DIR") delete process.env[key];
if (ownDataDir) process.env.DATA_DIR = ownDataDir;
process.env.TRUSTED_HOSTS = "chat.example.com";
process.env.ENCRYPTION_KEY = "ab".repeat(32);

// Imported after the env is set: DATA_DIR is read once at import.
const credential = await import("../../packages/server/src/config/login-credential.js");
const { BASIC_AUTH_FAILURE_LIMIT, PAIRING_CODE_TTL_MS, basicAuthHook, loginRoutes } =
  await import("../../packages/server/src/middleware/basic-auth.js");
const { csrfProtectionHook } = await import("../../packages/server/src/middleware/csrf-protection.js");
const { hostValidationHook } = await import("../../packages/server/src/middleware/host-validation.js");
const { ipAllowlistHook } = await import("../../packages/server/src/middleware/ip-allowlist.js");
const { rateLimitHook } = await import("../../packages/server/src/middleware/rate-limit.js");
const { accessStatusRoutes } = await import("../../packages/server/src/routes/access-status.routes.js");
const { logger } = await import("../../packages/server/src/lib/logger.js");
const { DATA_DIR } = await import("../../packages/server/src/utils/data-dir.js");

const warnings: unknown[][] = [];
const priorWarn = logger.warn;
logger.warn = ((...args: unknown[]) => warnings.push(args)) as typeof logger.warn;
const realNow = Date.now;

// The same onRequest order as app.ts.
const app = Fastify();
app.addHook("onRequest", hostValidationHook);
app.addHook("onRequest", ipAllowlistHook);
app.addHook("onRequest", rateLimitHook);
app.addHook("onRequest", basicAuthHook);
app.addHook("onRequest", csrfProtectionHook);
app.get("/", async (_request, reply) => reply.type("text/html").send("<!doctype html><title>Marinara</title>"));
app.get("/api/chats", async () => [{ id: "private-chat" }]);
await app.register(loginRoutes);
await app.register(accessStatusRoutes, { prefix: "/api/access" });

const REMOTE = "203.0.113.10";
const HOST = { host: "chat.example.com" };
const LOCAL = { host: "127.0.0.1:7860" };
const LOGIN_FILE = join(DATA_DIR, ".remote-login.json");
const SESSIONS_FILE = join(DATA_DIR, ".remote-sessions.json");
const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

const basic = (user: string, pass: string) => `Basic ${Buffer.from(`${user}:${pass}`, "utf8").toString("base64")}`;
const get = (url: string, remoteAddress: string, headers: Record<string, string> = {}) =>
  app.inject({ method: "GET", url, remoteAddress, headers: { ...HOST, ...headers } });
const local = (method: "GET" | "DELETE", url: string, headers: Record<string, string> = {}) =>
  app.inject({ method, url, remoteAddress: "127.0.0.1", headers: { ...LOCAL, ...headers } });
const putLogin = (remoteAddress: string, body: Record<string, string>, headers: Record<string, string> = {}) =>
  app.inject({
    method: "PUT",
    url: "/api/access/login",
    remoteAddress,
    headers: { ...(remoteAddress === "127.0.0.1" ? LOCAL : HOST), "content-type": "application/json", ...headers },
    payload: JSON.stringify(body),
  });
const signIn = (remoteAddress: string, fields: Record<string, string>, headers: Record<string, string> = {}) =>
  app.inject({
    method: "POST",
    url: "/login",
    remoteAddress,
    headers: { ...HOST, "content-type": "application/x-www-form-urlencoded", ...headers },
    payload: new URLSearchParams(fields).toString(),
  });
const cookieOf = (response: { headers: Record<string, unknown> }) =>
  String(response.headers["set-cookie"] ?? "").split(";")[0] ?? "";
const loginSource = async () => (await local("GET", "/api/access/status")).json().loginSource;
const lastSetupCode = () =>
  String(warnings.filter((args) => String(args[0]).includes("setup code:")).at(-1)?.[1] ?? "");

try {
  await app.ready();

  // ── Session store: per login, capped at 50, 365 days ──
  const tokens = Array.from({ length: 51 }, () => credential.createSession("login-a", ""));
  assert.equal(credential.findSession("login-a", tokens[0]!), null, "the oldest session drops out at 50");
  assert.ok(credential.findSession("login-a", tokens[50]!));
  assert.equal(credential.listSessions("login-a").length, 50);
  assert.equal(credential.findSession("login-b", tokens[50]!), null, "a new login ends older sessions");
  assert.ok(!readFileSync(SESSIONS_FILE, "utf8").includes(tokens[50]!), "only token hashes are saved");
  if (process.platform !== "win32") assert.equal(statSync(SESSIONS_FILE).mode & 0o777, 0o600, "sessions are 0600");
  Date.now = () => realNow() + credential.SESSION_MAX_AGE_SECONDS * 1000 + 1_000;
  assert.equal(credential.findSession("login-a", tokens[50]!), null, "a session ends after 365 days");
  Date.now = realNow;
  writeFileSync(SESSIONS_FILE, "{ damaged");
  Date.now = () => realNow() + 2_001;
  assert.equal(credential.findSession("login-a", tokens[50]!), null, "a damaged file means no sessions");
  Date.now = realNow;
  credential.deleteAllSessions();

  // ── First login from the Docker host, with the one-time setup code ──
  assert.equal(credential.getLoginConfig(), null);
  credential.enableLoginSetupCode();
  const code = lastSetupCode();
  assert.match(
    code,
    /^[2-9A-HJKMNP-Z]{4}(-[2-9A-HJKMNP-Z]{4}){3}$/,
    "with no login, the setup code is in the server log",
  );

  // The host browser arrives as a remote peer that may open the app but has no ADMIN_SECRET.
  process.env.ALLOW_UNAUTHENTICATED_REMOTE = "true";
  const first = { user: "owner", password: "first-password" };
  assert.equal((await putLogin(REMOTE, first)).statusCode, 403, "a remote caller needs ADMIN_SECRET or the code");
  assert.equal((await putLogin(REMOTE, { ...first, setupCode: "0".repeat(24) })).statusCode, 403, "a wrong code fails");
  assert.equal((await putLogin(REMOTE, { ...first, password: "too-short", setupCode: code })).statusCode, 400);
  assert.equal((await putLogin(REMOTE, { ...first, user: "a:b", setupCode: code })).statusCode, 400);
  const setFirst = await putLogin(REMOTE, { ...first, setupCode: code });
  assert.equal(setFirst.statusCode, 200, "the setup code stands in for ADMIN_SECRET for the first login");
  assert.deepEqual(setFirst.json(), { loginSource: "app" });
  const setupSession = cookieOf(setFirst);
  assert.match(setupSession, /^marinara_session=[\w-]{43}$/, "the browser that set the login stays signed in");
  assert.equal((await get("/api/chats", REMOTE, { cookie: setupSession })).statusCode, 200);

  // ── The saved login: hashed, 0600, read back ──
  assert.ok(!readFileSync(LOGIN_FILE, "utf8").includes("first-password"), "only a hash is saved");
  if (process.platform !== "win32") assert.equal(statSync(LOGIN_FILE).mode & 0o777, 0o600, "the file is owner-only");
  const stored = credential.getLoginConfig();
  if (stored?.source !== "app") throw new Error("expected the app login");
  assert.equal(await credential.verifyStoredPassword(stored, "owner", "first-password"), true);
  assert.equal(await credential.verifyStoredPassword(stored, "owner", "wrong-password"), false);
  assert.equal(await credential.verifyStoredPassword(stored, "someone", "first-password"), false);
  assert.equal(await loginSource(), "app");

  // With a login set, the code is gone and the open remote opt-in no longer applies.
  const right = basic("owner", "first-password");
  const again = await putLogin(
    REMOTE,
    { user: "intruder", password: "intruder-password", setupCode: code },
    { authorization: right },
  );
  assert.equal(again.statusCode, 403, "the code no longer works once a login exists");
  assert.equal((await get("/api/chats", "203.0.113.11")).statusCode, 401, "a login closes the open remote opt-in");
  delete process.env.ALLOW_UNAUTHENTICATED_REMOTE;

  // ── Browsers get the login page; scripts keep Basic ──
  const page = await get("/chats/1?tab=a", REMOTE, { accept: "text/html" });
  assert.equal(page.statusCode, 302, "a browser page load is sent to /login");
  assert.equal(page.headers.location, `/login?next=${encodeURIComponent("/chats/1?tab=a")}`);
  const api = await get("/api/chats", REMOTE, { accept: "text/html" });
  assert.equal(api.statusCode, 401, "API calls keep the 401 challenge");
  assert.match(String(api.headers["www-authenticate"]), /^Basic realm=/);
  assert.equal(
    (await get("/logout", REMOTE, { accept: "text/html" })).statusCode,
    302,
    "only POST /logout skips the login",
  );
  const form = await get("/login?next=%2Fchats", REMOTE, { accept: "text/html" });
  assert.equal(form.statusCode, 200);
  assert.match(form.body, /<form[^>]+method="post" action="\/login"/);
  assert.match(form.body, /name="next" value="\/chats"/);
  assert.equal((await get("/api/chats", "203.0.113.11", { authorization: right })).statusCode, 200, "Basic works");
  assert.equal((await get("/api/chats", "203.0.113.11", { authorization: right })).statusCode, 200, "and again");

  // ── Sign in on the page ──
  const wrong = await signIn("203.0.113.20", { user: "owner", password: "not-the-password", next: "/chats" });
  assert.equal(wrong.statusCode, 401);
  assert.match(wrong.body, /Wrong username or password/);
  assert.equal(wrong.headers["set-cookie"], undefined);
  const crossSite = await signIn(
    "203.0.113.20",
    { user: "owner", password: "first-password" },
    { origin: "https://evil.example", "sec-fetch-site": "cross-site" },
  );
  assert.equal(crossSite.statusCode, 403, "another site cannot post the form");
  const noFetchSite = await signIn(
    "203.0.113.20",
    { user: "owner", password: "first-password" },
    { origin: "https://chat.example.com" },
  );
  assert.equal(noFetchSite.statusCode, 403, "without Sec-Fetch-Site the usual Origin check applies");
  const plainHttp = await signIn(
    "203.0.113.20",
    { user: "owner", password: "not-the-password" },
    { origin: "http://chat.example.com" },
  );
  assert.equal(plainHttp.statusCode, 401, "plain HTTP sends no Sec-Fetch-Site; the server's own Origin passes");
  const loginPage = await get("/login", "203.0.113.20", { accept: "text/html" });
  assert.match(loginPage.body, /<meta name="referrer" content="same-origin" \/>/, "so the form posts a real Origin");
  const signedIn = await signIn(
    "203.0.113.20",
    { user: "owner", password: "first-password", next: "/chats" },
    { origin: "https://chat.example.com", "sec-fetch-site": "same-origin" },
  );
  assert.equal(signedIn.statusCode, 303, "the form works on a named host without CSRF_TRUSTED_ORIGINS");
  assert.equal(signedIn.headers.location, "/chats");
  const setCookie = String(signedIn.headers["set-cookie"]);
  assert.match(setCookie, /; Path=\/; HttpOnly; SameSite=Lax; Max-Age=31536000$/, "a long-lived HttpOnly session");
  const session = cookieOf(signedIn);
  assert.equal((await get("/api/chats", "203.0.113.21", { cookie: session })).statusCode, 200, "the cookie signs in");
  const madeUp = `marinara_session=${"A".repeat(43)}`;
  assert.equal((await get("/api/chats", "203.0.113.21", { cookie: madeUp })).statusCode, 401);

  // `next` never leaves this server.
  const offsite = [
    "//evil.example/x",
    "https://evil.example/x",
    "/\\evil.example",
    "javascript:alert(1)",
    "/.//evil.example",
    "/..//evil.example",
    "/%2e//evil.example",
    "/a/..//evil.example",
  ];
  for (const next of offsite) {
    const response = await signIn("203.0.113.20", { user: "owner", password: "first-password", next });
    assert.equal(response.headers.location, "/", `POST next=${next} stays here`);
    const redirect = await get(`/login?next=${encodeURIComponent(next)}`, "203.0.113.21", { cookie: session });
    assert.equal(redirect.headers.location, "/", `GET next=${next} stays here`);
  }

  // ── Signed-in browsers: list, sign out one, sign out all, log out ──
  const phone = cookieOf(await signIn("203.0.113.22", { ...first }, { "user-agent": IPHONE }));
  const listed = await local("GET", "/api/access/sessions", { cookie: phone });
  assert.equal(listed.statusCode, 200);
  const sessions = listed.json().sessions as Array<Record<string, unknown>>;
  const mine = sessions.find((entry) => entry.current);
  assert.equal(mine?.label, "Safari on iPhone");
  assert.deepEqual(Object.keys(mine ?? {}).sort(), ["createdAt", "current", "id", "label", "lastSeenAt", "method"]);
  assert.equal(sessions.filter((entry) => entry.current).length, 1);
  const hashes = (JSON.parse(readFileSync(SESSIONS_FILE, "utf8")).sessions as Array<{ hash: string }>).map(
    (entry) => entry.hash,
  );
  assert.ok(!listed.body.includes(phone.split("=")[1]!), "no token in the list");
  assert.ok(
    hashes.every((hash) => !listed.body.includes(hash)),
    "no token hash in the list",
  );
  const remoteList = await get("/api/access/sessions", REMOTE, { cookie: phone });
  assert.equal(remoteList.statusCode, 200, "a signed-in browser lists the devices on any device");
  assert.equal(
    (await get("/api/access/sessions", REMOTE, { authorization: basic("owner", "first-password") })).statusCode,
    403,
    "a bare Basic header from a script is not a signed-in browser",
  );
  assert.equal((await local("DELETE", `/api/access/sessions/${String(mine?.id)}`)).statusCode, 204);
  assert.equal((await get("/api/chats", "203.0.113.22", { cookie: phone })).statusCode, 401, "signed out remotely");
  assert.equal((await local("DELETE", "/api/access/sessions/unknown")).statusCode, 404);

  const logout = await app.inject({
    method: "POST",
    url: "/logout",
    remoteAddress: "203.0.113.20",
    headers: { ...HOST, cookie: session },
  });
  assert.equal(logout.statusCode, 303);
  assert.match(String(logout.headers["set-cookie"]), /^marinara_session=; .*Max-Age=0/);
  assert.equal((await get("/api/chats", "203.0.113.21", { cookie: session })).statusCode, 401, "logout ends it");

  const laptop = cookieOf(await signIn("203.0.113.23", { ...first }));
  assert.equal((await get("/api/chats", "203.0.113.23", { cookie: laptop })).statusCode, 200);
  assert.equal((await local("DELETE", "/api/access/sessions")).statusCode, 204);
  assert.equal((await get("/api/chats", "203.0.113.23", { cookie: laptop })).statusCode, 401, "all signed out");
  const keeper = cookieOf(await signIn("203.0.113.25", { ...first }));
  const other = cookieOf(await signIn("203.0.113.26", { ...first }));
  assert.equal((await local("DELETE", "/api/access/sessions", { cookie: keeper })).statusCode, 204);
  assert.equal((await get("/api/chats", "203.0.113.25", { cookie: keeper })).statusCode, 200, "the caller stays");
  assert.equal((await get("/api/chats", "203.0.113.26", { cookie: other })).statusCode, 401, "others end");

  // ── Pairing codes: a signed-in browser or the host adds a device ──
  const pair = (remoteAddress: string, headers: Record<string, string> = {}) =>
    app.inject({
      method: "POST",
      url: "/api/access/pairing-codes",
      remoteAddress,
      headers: { ...(remoteAddress === "127.0.0.1" ? LOCAL : HOST), ...headers },
    });
  assert.equal((await pair("203.0.113.60")).statusCode, 401, "a stranger is asked to sign in first");
  assert.equal(
    (await pair("203.0.113.60", { authorization: right })).statusCode,
    403,
    "a script with Basic Authorization is not a signed-in browser",
  );
  const fromPhone = await pair("203.0.113.25", { cookie: keeper });
  assert.equal(fromPhone.statusCode, 200, "a signed-in browser adds a device");
  const { code: phoneCode, expiresAt } = fromPhone.json() as { code: string; expiresAt: number };
  assert.match(phoneCode, /^[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}$/, "8 characters, without 0, O, 1, I or L");
  assert.ok(Math.abs(expiresAt - (Date.now() + 5 * 60_000)) < 5_000, "valid for 5 minutes");
  assert.equal(
    (await get("/api/access/refusals", "203.0.113.25", { cookie: keeper })).statusCode,
    200,
    "a signed-in browser sees the refused-device banners too",
  );

  const paired = await signIn("203.0.113.61", {
    code: ` ${phoneCode.toLowerCase().replace("-", " ")} `,
    next: "/chats",
  });
  assert.equal(paired.statusCode, 303, "case, spaces and the dash do not matter");
  assert.equal(paired.headers.location, "/chats");
  const pairedSession = cookieOf(paired);
  assert.equal((await get("/api/chats", "203.0.113.61", { cookie: pairedSession })).statusCode, 200);
  assert.equal((await signIn("203.0.113.62", { code: phoneCode })).statusCode, 401, "a code works once");

  const fromHost = (await pair("127.0.0.1")).json() as { code: string };
  Date.now = () => realNow() + 5 * 60_000 + 1;
  assert.equal((await signIn("203.0.113.62", { code: fromHost.code })).statusCode, 401, "a code expires");
  Date.now = realNow;

  const pairGuesser = "203.0.113.63";
  for (let index = 0; index < BASIC_AUTH_FAILURE_LIMIT; index += 1) {
    const response = await signIn(pairGuesser, { code: `ABCD-EF${String(index).padStart(2, "2")}` });
    assert.equal(response.statusCode, 401, `wrong code ${index + 1} is still answered`);
  }
  const live = (await pair("127.0.0.1")).json() as { code: string };
  assert.equal((await signIn(pairGuesser, { code: live.code })).statusCode, 429, "wrong codes lock out like passwords");
  assert.equal((await signIn("203.0.113.64", { code: live.code })).statusCode, 303, "the lockout did not use it up");
  // A good code clears this browser's wrong-guess count, like a good password does.
  const typoGuesser = "203.0.113.69";
  for (let index = 0; index < BASIC_AUTH_FAILURE_LIMIT - 1; index += 1) {
    await signIn(typoGuesser, { code: `ABCD-EG${String(index).padStart(2, "2")}` });
  }
  const goodCode = (await pair("127.0.0.1")).json() as { code: string };
  assert.equal((await signIn(typoGuesser, { code: goodCode.code })).statusCode, 303);
  for (let index = 0; index < BASIC_AUTH_FAILURE_LIMIT - 1; index += 1) {
    const response = await signIn(typoGuesser, { code: `ABCD-EH${String(index).padStart(2, "2")}` });
    assert.equal(response.statusCode, 401, `typo ${index + 1} after a good code is still answered`);
  }
  // Signing out a device ends the codes it made, and signing out every other device ends all open codes,
  // so a signed-out device cannot come back with a code it made before.
  const leaving = cookieOf(await signIn("203.0.113.66", { ...first }));
  const leavingCode = (await pair("203.0.113.66", { cookie: leaving })).json() as { code: string };
  await app.inject({
    method: "POST",
    url: "/logout",
    remoteAddress: "203.0.113.66",
    headers: { ...HOST, cookie: leaving },
  });
  assert.equal((await signIn("203.0.113.67", { code: leavingCode.code })).statusCode, 401, "logout ends its codes");
  const rogue = cookieOf(await signIn("203.0.113.68", { ...first }));
  const rogueCode = (await pair("203.0.113.68", { cookie: rogue })).json() as { code: string };
  assert.equal((await local("DELETE", "/api/access/sessions")).statusCode, 204);
  assert.equal((await signIn("203.0.113.67", { code: rogueCode.code })).statusCode, 401, "sign-out-others ends codes");
  const stale = (await pair("127.0.0.1")).json() as { code: string };

  // ── A new password ends every session and the old Basic header ──
  const before = cookieOf(await signIn("203.0.113.24", { ...first }));
  const change = await putLogin("127.0.0.1", { user: "owner", password: "second-password" });
  assert.equal(change.statusCode, 200);
  assert.equal((await get("/api/chats", "203.0.113.24", { cookie: before })).statusCode, 401, "old sessions end");
  assert.equal((await get("/api/chats", REMOTE, { cookie: setupSession })).statusCode, 401, "all of them");
  assert.equal((await signIn("203.0.113.65", { code: stale.code })).statusCode, 401, "and every open code");
  assert.equal(
    (await local("GET", "/api/access/sessions")).json().sessions.length,
    1,
    "only the browser that changed it",
  );
  assert.equal((await get("/api/chats", "203.0.113.11", { authorization: right })).statusCode, 401, "old password");
  const second = basic("owner", "second-password");
  assert.equal((await get("/api/chats", "203.0.113.11", { authorization: second })).statusCode, 200);

  // ── Wrong passwords on the page count toward the lockout ──
  const guesser = "203.0.113.30";
  for (let index = 0; index < BASIC_AUTH_FAILURE_LIMIT; index += 1) {
    const response = await signIn(guesser, { user: "owner", password: `guess-${index}-password` });
    assert.equal(response.statusCode, 401, `guess ${index + 1} is still answered`);
  }
  const locked = await signIn(guesser, { user: "owner", password: "second-password" });
  assert.equal(locked.statusCode, 429, "after the limit even the right password is refused");
  assert.ok(Number(locked.headers["retry-after"]) > 0);
  assert.equal((await get("/api/chats", guesser, { authorization: second })).statusCode, 429, "the lock covers Basic");

  // ── Slow password checks are capped instead of queued ──
  const burst = await Promise.all(
    Array.from({ length: 8 }, (_, index) =>
      get("/api/chats", `203.0.113.${100 + index}`, { authorization: basic("owner", `burst-${index}-password`) }),
    ),
  );
  assert.ok(
    burst.some((response) => response.statusCode === 429),
    "checks over the cap get 429",
  );
  assert.ok(burst.some((response) => response.statusCode === 401));

  // ── A repeated wrong password skips the slow check, so it cannot fill the slots ──
  const repeat = { authorization: basic("owner", "same-wrong-password") };
  assert.equal((await get("/api/chats", "203.0.113.41", repeat)).statusCode, 401);
  const busy = await Promise.all([
    ...Array.from({ length: 4 }, (_, index) =>
      get("/api/chats", `203.0.113.${130 + index}`, { authorization: basic("owner", `slow-${index}`) }),
    ),
    get("/api/chats", "203.0.113.41", repeat),
  ]);
  assert.deepEqual(
    busy.map((response) => response.statusCode),
    [401, 401, 401, 401, 401],
    "a repeated wrong password does not wait for a slow check",
  );

  // ── Parallel guesses cannot pass the limit ──
  const racer = "203.0.113.77";
  for (let index = 0; index < BASIC_AUTH_FAILURE_LIMIT - 1; index += 1) {
    assert.equal((await get("/api/chats", racer, { authorization: basic("owner", `race-${index}`) })).statusCode, 401);
  }
  const race = await Promise.all([
    ...Array.from({ length: 3 }, (_, index) =>
      get("/api/chats", racer, { authorization: basic("owner", `race-last-${index}`) }),
    ),
    get("/api/chats", racer, { authorization: second }),
  ]);
  assert.notEqual(race[3].statusCode, 200, "a guess past the limit is not checked");
  assert.equal((await get("/api/chats", racer, { authorization: second })).statusCode, 429);

  // ── A login file that cannot be read for a moment keeps the last login ──
  if (process.platform !== "win32" && process.getuid?.() !== 0) {
    chmodSync(LOGIN_FILE, 0);
    const later = new Date(realNow() + 60_000);
    utimesSync(LOGIN_FILE, later, later);
    Date.now = () => realNow() - 60_000;
    assert.equal(await loginSource(), "app", "a failed read keeps the last login");
    chmodSync(LOGIN_FILE, 0o600);
    Date.now = () => realNow() - 120_000;
    assert.equal(await loginSource(), "app");
    Date.now = realNow;
  }

  // ── A signed-in browser manages the login and devices (#7912 friction walk) ──
  // The Docker host arrives from the shared Docker gateway, not loopback. Its cookie session proves
  // the login; changing or removing the login also needs the current password in the same request.
  const BROWSER = { origin: "http://chat.example.com", "sec-fetch-site": "same-origin" };
  const host = "203.0.113.70";
  const asHost = { cookie: cookieOf(await signIn(host, { user: "owner", password: "second-password" }, BROWSER)) };
  const hostStatus = await get("/api/access/status", host, asHost);
  assert.equal(hostStatus.statusCode, 200, "a signed-in browser sees the access status");
  assert.equal(hostStatus.json().needsCurrentPassword, true, "away from this computer the current password is needed");
  assert.equal((await get("/api/access/refusals", host, asHost)).statusCode, 200, "and the refused-device banners");
  assert.equal(
    (await get("/api/access/status", host, { authorization: second })).statusCode,
    403,
    "a Basic header alone is not the owner",
  );
  assert.equal((await local("GET", "/api/access/status")).json().needsCurrentPassword, false, "this computer is");

  // An expired pairing code says so, under the code field, which gets the focus.
  const hostPairing = await pair(host, asHost);
  assert.equal(hostPairing.statusCode, 200, "a signed-in browser adds a device");
  const { code: pairingCode } = hostPairing.json() as { code: string };
  assert.match(pairingCode, /^[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}$/);
  Date.now = () => realNow() + PAIRING_CODE_TTL_MS + 1_000;
  const expired = await signIn(
    "203.0.113.72",
    { code: pairingCode.toLowerCase().replace("-", " "), next: "/" },
    BROWSER,
  );
  Date.now = realNow;
  assert.equal(expired.statusCode, 401);
  assert.match(expired.body, /This code has expired/, "an expired code is not called wrong");
  assert.match(expired.body, /id="code"[^>]*autofocus aria-describedby="code-error"/, "the code field gets the focus");
  const wrongPairing = await signIn("203.0.113.72", { code: "ZZZZ-ZZZZ", next: "/" }, BROWSER);
  assert.match(wrongPairing.body, /This code does not work/);
  assert.match(
    wrongPairing.body,
    /Forgot the password\? On the computer that runs Marinara, run <code>pnpm reset-login<\/code>/,
  );

  const asHostPut = (body: Record<string, string>) => putLogin(host, body, asHost);
  assert.equal(
    (await asHostPut({ user: "owner", password: "session-password" })).statusCode,
    403,
    "no current password, no change",
  );
  const wrongCurrent = await asHostPut({
    user: "owner",
    password: "session-password",
    currentPassword: "not-the-password",
  });
  assert.equal(wrongCurrent.statusCode, 403);
  assert.equal(wrongCurrent.json().reason, "currentPassword", "the client can say the current password is wrong");
  const changedByHost = await asHostPut({
    user: "owner",
    password: "session-password",
    currentPassword: "second-password",
  });
  assert.equal(changedByHost.statusCode, 200, "the current password confirms the change");
  const removeAsHost = (body: Record<string, string>) =>
    app.inject({
      method: "DELETE",
      url: "/api/access/login",
      remoteAddress: host,
      headers: { ...HOST, cookie: cookieOf(changedByHost), "content-type": "application/json" },
      payload: JSON.stringify(body),
    });
  assert.equal((await removeAsHost({})).statusCode, 403, "no current password, no removal");
  assert.equal((await removeAsHost({ currentPassword: "session-password" })).statusCode, 204);
  assert.equal(credential.getLoginConfig(), null, "a signed-in browser removed the login");

  // ── TRUSTED_AUTH_PROXY hides the setup code only when the policy trusts a proxy ──
  process.env.TRUSTED_AUTH_PROXY = "8.8.0.0/16, not-a-range";
  credential.announceSetupCode();
  assert.ok(credential.hasLoginSetupCode(), "typos and public ranges trust no proxy, so a code still prints");
  process.env.TRUSTED_AUTH_PROXY = "10.0.0.5";
  credential.announceSetupCode();
  assert.equal(credential.hasLoginSetupCode(), false, "a trusted forward-auth proxy logs visitors in instead");
  delete process.env.TRUSTED_AUTH_PROXY;
  credential.announceSetupCode();

  // ── No login: Settings on another device takes the setup code, with the lockdown form's rules ──
  process.env.ALLOW_UNAUTHENTICATED_REMOTE = "true"; // stands in for the passwordless Docker host
  const settingsCode = lastSetupCode();
  assert.deepEqual((await get("/api/access/setup-code", host)).json(), { waiting: true, docker: false });
  const ownerAgain = { user: "owner", password: "second-password" };
  for (let index = 0; index < BASIC_AUTH_FAILURE_LIMIT; index += 1) {
    const wrongCode = await putLogin("203.0.113.71", { ...ownerAgain, setupCode: `WRONG-${index}` });
    assert.equal(wrongCode.json().reason, "setupCode");
  }
  const lockedCode = await putLogin("203.0.113.71", { ...ownerAgain, setupCode: settingsCode });
  assert.equal(lockedCode.statusCode, 429, "wrong codes in Settings are capped like the lockdown form");
  assert.ok(lockedCode.json().retryAfter > 0, "the client can say how long to wait");
  const bySettings = await putLogin(host, {
    ...ownerAgain,
    setupCode: ` ${settingsCode.toLowerCase().replaceAll("-", " ")} `,
  });
  assert.equal(bySettings.statusCode, 200, "the setup code sets the login from Settings, in any case and spacing");
  assert.match(cookieOf(bySettings), /^marinara_session=/, "and signs that browser in");
  assert.equal((await get("/api/access/setup-code", host, { cookie: cookieOf(bySettings) })).json().waiting, false);
  assert.notEqual(
    (await putLogin("203.0.113.73", { ...ownerAgain, setupCode: settingsCode })).statusCode,
    200,
    "the code works once",
  );
  delete process.env.ALLOW_UNAUTHENTICATED_REMOTE;

  // ── Remove; a reset brings a new setup code without a restart ──
  assert.ok(existsSync(SESSIONS_FILE));
  assert.equal((await local("DELETE", "/api/access/login")).statusCode, 204);
  assert.equal(existsSync(LOGIN_FILE), false);
  assert.equal(existsSync(SESSIONS_FILE), false, "removing the login ends every session");
  assert.equal(await loginSource(), null);
  const afterRemove = lastSetupCode();
  assert.match(afterRemove, /^[2-9A-HJKMNP-Z]{4}(-[2-9A-HJKMNP-Z]{4}){3}$/);
  assert.notEqual(afterRemove, code, "removing the login brings a new code");
  await credential.setStoredLogin("owner", "third-password");
  assert.equal(credential.getLoginConfig()?.source, "app");
  unlinkSync(LOGIN_FILE);
  Date.now = () => realNow() + 2_001;
  assert.equal(credential.getLoginConfig(), null, "deleting the file removes the login within 2 s");
  assert.equal((await get("/api/chats", "203.0.113.40")).statusCode, 403, "with no login, remote is locked down again");

  // ── Refused devices: the host hears about them, without their address ──
  await get("/api/chats", "203.0.113.40", { "user-agent": IPHONE });
  process.env.IP_ALLOWLIST = "198.51.100.0/24";
  assert.equal((await get("/api/chats", "203.0.113.41")).statusCode, 403);
  const scannerId = ((await local("GET", "/api/access/refusals")).json().refusals as Array<{ id: string }>)[0]?.id;
  // A new address with the same label merges, so one dismissal holds against an internet scan.
  assert.equal((await get("/api/chats", "203.0.113.42")).statusCode, 403);
  delete process.env.IP_ALLOWLIST;
  const refusals = await local("GET", "/api/access/refusals");
  assert.equal(refusals.statusCode, 200);
  assert.ok(!refusals.body.includes("203.0.113"), "no addresses");
  const refused = refusals.json().refusals as Array<{ id: string; label: string; reason: string }>;
  assert.deepEqual(
    refused.map(({ label, reason }) => [label, reason]),
    [
      ["Unknown device", "allowlist"],
      ["Safari on iPhone", "noLogin"],
      ["Unknown device", "noLogin"],
    ],
    "newest first, one entry per device and reason",
  );
  assert.equal(refused[0]?.id, scannerId, "allowlist refusals from new addresses keep one id");
  await get("/api/chats", "203.0.113.40", { "user-agent": IPHONE });
  const retried = (await local("GET", "/api/access/refusals")).json().refusals as typeof refused;
  assert.equal(retried.length, 3, "a retry is no new entry");
  assert.equal(retried[0]?.id, refused[1]?.id, "and keeps its id, so a dismissed banner stays dismissed");
  Date.now = realNow;
  const afterReset = lastSetupCode();
  assert.match(afterReset, /^[2-9A-HJKMNP-Z]{4}(-[2-9A-HJKMNP-Z]{4}){3}$/);
  assert.notEqual(afterReset, afterRemove, "a reset brings a new code");

  process.env.ALLOW_UNAUTHENTICATED_REMOTE = "true";
  assert.equal((await putLogin(REMOTE, { ...first, setupCode: code })).statusCode, 403, "an old code stays used up");
  assert.equal((await putLogin(REMOTE, { ...first, setupCode: afterRemove })).statusCode, 403, "a replaced code fails");
  assert.equal((await putLogin(REMOTE, { ...first, setupCode: afterReset })).statusCode, 200, "the new code works");
  delete process.env.ALLOW_UNAUTHENTICATED_REMOTE;

  // ── .env wins and the app login is read-only meanwhile ──
  process.env.BASIC_AUTH_USER = "envuser";
  process.env.BASIC_AUTH_PASS = "env-password";
  assert.equal(credential.getLoginConfig()?.source, "env");
  assert.deepEqual(
    ((await local("GET", "/api/access/refusals")).json().refusals as Array<{ reason: string }>).map(
      ({ reason }) => reason,
    ),
    ["allowlist"],
    "a login hides the no-login refusals",
  );
  assert.equal(await loginSource(), "env");
  assert.equal((await putLogin("127.0.0.1", { user: "owner", password: "fifth-password" })).statusCode, 409);
  assert.equal((await local("DELETE", "/api/access/login")).statusCode, 409);
  assert.ok(existsSync(LOGIN_FILE), "a refused delete keeps the file");
  const envBasic = basic("envuser", "env-password");
  assert.equal((await get("/api/chats", "203.0.113.50", { authorization: envBasic })).statusCode, 200);
  const ignored = await get("/api/chats", "203.0.113.50", { authorization: basic("owner", "first-password") });
  assert.equal(ignored.statusCode, 401, "the app login is ignored while .env sets one");
  const envSession = cookieOf(await signIn("203.0.113.51", { user: "envuser", password: "env-password" }));
  assert.equal((await get("/api/chats", "203.0.113.51", { cookie: envSession })).statusCode, 200, ".env sessions");
  process.env.BASIC_AUTH_PASS = "env-password-changed";
  assert.equal(
    (await get("/api/chats", "203.0.113.51", { cookie: envSession })).statusCode,
    401,
    "an .env change ends them",
  );

  // ── pnpm reset-login finds DATA_DIR through MARINARA_ENV_FILE ──
  const resetDir = mkdtempSync(join(DATA_DIR, "reset-"));
  const envFile = join(resetDir, "custom.env");
  writeFileSync(envFile, `DATA_DIR=${resetDir}\n`);
  writeFileSync(join(resetDir, ".remote-login.json"), "{}");
  writeFileSync(join(resetDir, ".remote-sessions.json"), "{}");
  const resetEnv: NodeJS.ProcessEnv = { ...process.env, MARINARA_ENV_FILE: envFile };
  delete resetEnv.DATA_DIR;
  const reset = spawnSync(process.execPath, [fileURLToPath(new URL("../reset-login.mjs", import.meta.url))], {
    env: resetEnv,
    encoding: "utf8",
  });
  assert.equal(reset.status, 0, reset.stderr);
  assert.equal(existsSync(join(resetDir, ".remote-login.json")), false, "reset-login removes the login");
  assert.equal(existsSync(join(resetDir, ".remote-sessions.json")), false, "and every session");
  rmSync(resetDir, { recursive: true, force: true });

  console.info("Remote login regressions passed.");
} finally {
  Date.now = realNow;
  logger.warn = priorWarn;
  await app.close();
  for (const key of ENV_KEYS) {
    const value = originalEnv[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  if (ownDataDir) rmSync(ownDataDir, { recursive: true, force: true });
}
