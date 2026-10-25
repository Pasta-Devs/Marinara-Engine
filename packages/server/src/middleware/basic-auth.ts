// ──────────────────────────────────────────────
// Middleware: HTTP Basic Auth + safe-by-default remote lockdown
// ──────────────────────────────────────────────
// Set BASIC_AUTH_USER and BASIC_AUTH_PASS to enable HTTP Basic Authentication
// on every request from non-loopback, non-allowlisted IPs.
//
// When credentials are NOT configured, this middleware refuses connections
// from every non-loopback IP (returns 401/403) unless the operator explicitly
// opts into unauthenticated private/public access. This protects LAN, Docker,
// Tailscale, and internet-exposed installs by default.
//
// Note: the private-network exemption applies ONLY when no Basic Auth is
// configured. If you set BASIC_AUTH_USER/PASS, the password is required
// from every IP except loopback and explicit IP_ALLOWLIST matches —
// because if you went out of your way to set a password, you mean it.
//
// To opt back into the legacy "LAN/private networks can connect without auth"
// behaviour, set ALLOW_UNAUTHENTICATED_PRIVATE_NETWORK=true. To allow
// unauthenticated public IPs too, set ALLOW_UNAUTHENTICATED_REMOTE=true.
//
// Optional:
//   BASIC_AUTH_REALM            — string shown in the browser password prompt
//                                 (default: "Marinara Engine")
//   ALLOW_UNAUTHENTICATED_PRIVATE_NETWORK — set to "true" to allow LAN/Docker/
//                                           Tailscale clients without auth
//                                           (NOT recommended on shared networks)
//   ALLOW_UNAUTHENTICATED_REMOTE          — set to "true" to allow public IPs
//                                           without auth (NOT recommended)
//
// Notes:
//   • The `/api/health` endpoint is exempt so external uptime checks /
//     load balancers can probe the server without needing credentials. It
//     only adds the local model and GPU details for callers that pass
//     isBasicAuthSatisfied.
//   • Loopback (127.0.0.1, ::1) is exempt — if you're already on the box,
//     you don't need a password. A reverse proxy or tunnel on this machine
//     also connects from loopback; its requests carry forwarding headers and
//     must authenticate like any remote client. Set
//     REQUIRE_AUTH_FOR_LOOPBACK_PROXY=false only when that proxy itself
//     requires a login from every client.
//   • Any IP that matches IP_ALLOWLIST is also exempt — if you've already
//     vouched for a network, requiring a second factor would be noise.
//   • Direct Tailscale and Docker traffic is detected from the request's local
//     socket or the container's actual networks. Set the matching BYPASS_AUTH_*
//     flag to true for the legacy broad-CIDR bypass, or false to require auth.
//     Docker traffic carrying proxy-forwarding headers requires normal auth
//     by default. Set REQUIRE_AUTH_FOR_DOCKER_PROXY=false only when every
//     forwarded client is trusted.
//   • Use a strong, random password — Basic Auth sends credentials on
//     every request, only base64-encoded. Always pair with HTTPS in
//     production (see SSL_CERT / SSL_KEY).
//   • Wrong passwords are counted per client address (an IPv6 /64 counts as
//     one) on every path, health included. After BASIC_AUTH_FAILURE_LIMIT
//     different wrong passwords within the window, that address gets 429
//     until the window ends. A correct password clears the count, except from
//     visitors a local proxy relays, who share one count. A signed-in browser
//     carries its own session cookie, so other visitors' wrong passwords cannot
//     lock it out.
//   • A login can also be saved in the app (config/login-credential.ts); the
//     .env pair wins. Browser page loads go to /login, which sets the session
//     cookie; scripts and API clients keep sending Basic Authorization.

import { LOGIN_PAGE_RATE_LIMIT } from "./rate-limit.js";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import {
  announceSetupCode,
  consumeLoginSetupCode,
  currentSetupCode,
  createSession,
  deleteOtherSessions,
  deleteSession,
  findSession,
  getLoginConfig,
  hasLoginSetupCode,
  isLoginSetupCode,
  listSessions,
  MIN_LOGIN_PASSWORD_LENGTH,
  normalizeCode,
  readableCode,
  SESSION_MAX_AGE_SECONDS,
  setStoredLogin,
  verifyStoredPassword,
  type LoginConfig,
  type RemoteSession,
  type SignInMethod,
} from "../config/login-credential.js";
import { getBasicAuthConfig, isDockerRuntime } from "../config/runtime-config.js";
import { logger } from "../lib/logger.js";
import { deriveServerKey } from "../utils/crypto.js";
import { cookieValue } from "./android-local-auth.js";
import { getRequestAccess, isForwardedLoopbackRequest } from "./ip-allowlist.js";
import { recordRefusal } from "./refused-devices.js";
// Same grouping as the multiplayer peer server: an IPv4 address, or an IPv6 /64.
import { multiplayerPeerSocketKey as clientAddressKey } from "../services/multiplayer/peer-server.js";

interface CachedConfig {
  login: LoginConfig;
  realm: string;
  /** Changes with the login, so a new password signs out every browser. */
  fingerprint: Buffer;
  /** Built on first use; null when the server key cannot be read. */
  sessionKey?: string | null;
  /** MAC of the last Basic header that passed the slow password check. */
  verifiedHeader?: Buffer;
  announced: boolean;
}

let cached: {
  login: LoginConfig | null;
  user: string | null;
  pass: string | null;
  realm: string;
  resolved: CachedConfig | null;
} | null = null;

function buildExpectedHeader(user: string, pass: string): string {
  return `Basic ${Buffer.from(`${user}:${pass}`, "utf8").toString("base64")}`;
}

/** An .env login keeps its old fingerprint, so browsers that signed in before stay signed in. */
function loginFingerprint(login: LoginConfig): Buffer {
  const id =
    login.source === "env"
      ? buildExpectedHeader(login.user, login.pass)
      : `app:${login.user}:${login.salt}:${login.hash}`;
  return Buffer.from(id, "utf8");
}

function loadConfig(): CachedConfig | null {
  const raw = getBasicAuthConfig();
  const login = getLoginConfig();
  if (
    !cached ||
    cached.login !== login ||
    cached.user !== raw.user ||
    cached.pass !== raw.pass ||
    cached.realm !== raw.realm
  ) {
    const resolved = login ? { login, realm: raw.realm, fingerprint: loginFingerprint(login), announced: false } : null;
    cached = { login, user: raw.user, pass: raw.pass, realm: raw.realm, resolved };
    if (!raw.user !== !raw.pass) {
      logger.warn(
        "[basic-auth] %s is empty, so the .env login stays off. Set both BASIC_AUTH_USER and BASIC_AUTH_PASS.",
        raw.user ? "BASIC_AUTH_PASS" : "BASIC_AUTH_USER",
      );
    }
  }

  const resolved = cached.resolved;
  if (resolved && !resolved.announced) {
    logger.info(
      `[basic-auth] Remote login enabled from ${resolved.login.source === "env" ? ".env" : "the app"} (realm="${resolved.realm}", user="${resolved.login.user}")`,
    );
    resolved.announced = true;
  }

  return resolved;
}

function safeEqual(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// ── Wrong-password throttle ──
// Kept apart from the /api rate limits, which skip the page and static files.

/** Different wrong passwords one client address may try in a window before it gets 429. */
export const BASIC_AUTH_FAILURE_LIMIT = 10;
export const BASIC_AUTH_FAILURE_WINDOW_MS = 15 * 60_000;
const MAX_TRACKED_CLIENTS = 4096;

type FailureRecord = { guesses: Set<string>; resetAt: number };
const failures = new Map<string, FailureRecord>();

// A reverse proxy or tunnel on this computer relays every visitor from loopback,
// so the address alone cannot tell them apart. There a browser that opened
// /login is counted by its own random pre-auth cookie; visitors without one share
// the address count. All visitors through that address also share a larger cap,
// so new cookies cannot buy unlimited guesses.
// ponytail: the shared cap can still lock new devices behind a busy proxy. A
// TRUSTED_AUTH_PROXY skips this login, so only proxies without their own login
// reach it; count by a forwarded client address if those need more.
const PRE_AUTH_COOKIE = "marinara_login_client";
const SHARED_FAILURE_LIMIT = BASIC_AUTH_FAILURE_LIMIT * 5;

type FailureBucket = { key: string; limit: number; shared: boolean };

function failureBuckets(request: FastifyRequest): FailureBucket[] {
  const address = clientAddressKey(request.ip);
  if (!isForwardedLoopbackRequest(request)) return [{ key: address, limit: BASIC_AUTH_FAILURE_LIMIT, shared: false }];
  const browser = cookieValue(request, PRE_AUTH_COOKIE);
  const own = browser && /^[\w-]{22}$/.test(browser) ? `${address}|${browser}` : null;
  return [
    { key: own ?? address, limit: BASIC_AUTH_FAILURE_LIMIT, shared: !own },
    { key: `${address}|all`, limit: SHARED_FAILURE_LIMIT, shared: true },
  ];
}

// The session cookie of a browser that signed in on /login. The server keeps only
// a hash of it (config/login-credential.ts), so logout and the owner can end one
// session and a new login ends all. Other visitors' wrong passwords cannot lock it out.
const SESSION_COOKIE = "marinara_session";

/** Names the current login in the sessions file without revealing it; null when the server key cannot be read. */
function sessionLoginKey(config: CachedConfig): string | null {
  if (config.sessionKey === undefined) {
    try {
      const key = deriveServerKey("remote login sessions");
      config.sessionKey = createHmac("sha256", key).update(config.fingerprint).digest("base64url");
    } catch (err) {
      config.sessionKey = null;
      logger.warn(err, "[basic-auth] Could not read the server key; browsers cannot stay signed in");
    }
  }
  return config.sessionKey;
}

function requestSession(request: FastifyRequest, config: CachedConfig): RemoteSession | null {
  const token = cookieValue(request, SESSION_COOKIE);
  const key = sessionLoginKey(config);
  return token && key ? findSession(key, token) : null;
}

/** Direct HTTPS, or HTTPS as reported by a local proxy. Only ever adds Secure, so a wrong report cannot widen access. */
function isHttpsRequest(request: FastifyRequest): boolean {
  if (request.protocol === "https") return true;
  if (!isForwardedLoopbackRequest(request)) return false;
  const proto = request.headers["x-forwarded-proto"];
  const value = Array.isArray(proto) ? proto[0] : proto;
  return value?.split(",")[0]?.trim().toLowerCase() === "https";
}

function startBrowserSession(
  request: FastifyRequest,
  reply: FastifyReply,
  config: CachedConfig,
  method: SignInMethod,
): boolean {
  const key = sessionLoginKey(config);
  if (!key) return false;
  const token = createSession(key, request.headers["user-agent"], method);
  const secure = isHttpsRequest(request) ? "; Secure" : "";
  reply.header(
    "Set-Cookie",
    `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE_SECONDS}${secure}`,
  );
  return true;
}

/** Per-process key: verified headers are only kept in memory. */
const HEADER_MAC_KEY = randomBytes(32);
/** Slow password checks that may run at once; more get 429 instead of queueing. */
const MAX_PASSWORD_CHECKS = 4;
let passwordChecks = 0;

function headerMac(header: string): Buffer {
  return createHmac("sha256", HEADER_MAC_KEY).update(header, "utf8").digest();
}

function headerMatches(header: unknown, config: CachedConfig): boolean {
  if (typeof header !== "string") return false;
  if (config.login.source === "env") return safeEqual(Buffer.from(header, "utf8"), config.fingerprint);
  return config.verifiedHeader !== undefined && safeEqual(headerMac(header), config.verifiedHeader);
}

function hasCorrectPassword(request: FastifyRequest, config: CachedConfig): boolean {
  return headerMatches(request.headers.authorization, config);
}

/** True or false for the password, or null when too many slow checks already run. */
async function verifyHeader(header: string, config: CachedConfig): Promise<boolean | null> {
  const login = config.login;
  if (headerMatches(header, config)) return true;
  if (login.source === "env") return false;
  const match = /^Basic\s+(\S+)$/i.exec(header);
  const decoded = match ? Buffer.from(match[1]!, "base64").toString("utf8") : "";
  const colon = decoded.indexOf(":");
  if (colon < 0) return false;
  if (passwordChecks >= MAX_PASSWORD_CHECKS) return null;
  passwordChecks += 1;
  try {
    if (!(await verifyStoredPassword(login, decoded.slice(0, colon), decoded.slice(colon + 1)))) return false;
  } finally {
    passwordChecks -= 1;
  }
  config.verifiedHeader = headerMac(header);
  return true;
}

function activeRecord(key: string, now: number): FailureRecord | undefined {
  const record = failures.get(key);
  if (record && record.resetAt <= now) {
    failures.delete(key);
    return undefined;
  }
  return record;
}

/** Wrong setup codes count apart from wrong passwords, and only per direct address. */
function setupCodeBuckets(request: FastifyRequest): FailureBucket[] {
  // ponytail: visitors behind a proxy on this computer share one address, so a count there would let a
  // stranger keep the owner out. The code is about 79 random bits and works once, so they skip it; count per
  // forwarded client if that ever matters.
  if (isForwardedLoopbackRequest(request)) return [];
  return [{ key: `setup|${clientAddressKey(request.ip)}`, limit: BASIC_AUTH_FAILURE_LIMIT, shared: false }];
}

/**
 * Checks a setup code from the lockdown page or Settings. A wrong one counts in the setup
 * buckets; a number is the seconds this client must wait. Constant time, never echoed.
 */
export function trySetupCode(request: FastifyRequest, code: unknown): "ok" | "wrong" | number {
  const buckets = setupCodeBuckets(request);
  const retryAfter = lockoutSeconds(request, buckets);
  if (retryAfter > 0) return retryAfter;
  const value = typeof code === "string" ? code : "";
  if (isLoginSetupCode(value)) return "ok";
  const guess = createHmac("sha256", HEADER_MAC_KEY).update(normalizeCode(value)).digest("base64url").slice(0, 16);
  countGuess(request, `setup:${guess}`, buckets);
  // Like wrong passwords: the first wrong code and the one that locks, not every try. A forwarded
  // client has no bucket and would only name the proxy; the route rate limit caps its volume.
  for (const bucket of buckets) {
    const size = failures.get(bucket.key)?.guesses.size ?? 0;
    if (size === 1) logger.warn("[basic-auth] Wrong setup code from %s", request.ip);
    if (size === bucket.limit) {
      logger.warn(
        "[basic-auth] %d wrong setup codes from %s; refusing more for %d minutes",
        size,
        request.ip,
        Math.ceil(BASIC_AUTH_FAILURE_WINDOW_MS / 60_000),
      );
    }
  }
  return "wrong";
}

/** Seconds this client must wait before trying a password again; 0 when it may try now. */
function lockoutSeconds(request: FastifyRequest, buckets = failureBuckets(request)): number {
  const now = Date.now();
  let seconds = 0;
  for (const bucket of buckets) {
    const record = activeRecord(bucket.key, now);
    if (record && record.guesses.size >= bucket.limit) {
      seconds = Math.max(seconds, Math.ceil((record.resetAt - now) / 1000), 1);
    }
  }
  return seconds;
}

/** Names a guess for the current login only, so a password change does not keep refusing it. */
function guessId(header: string, config: CachedConfig): string {
  return createHmac("sha256", HEADER_MAC_KEY)
    .update(config.fingerprint)
    .update("\0")
    .update(header)
    .digest("base64url")
    .slice(0, 16);
}

/** Counts a guess for this client before it is checked; a browser resending one saved password counts once. */
function countGuess(request: FastifyRequest, guess: string, buckets = failureBuckets(request)) {
  const now = Date.now();
  for (const bucket of buckets) {
    let record = activeRecord(bucket.key, now);
    if (!record) {
      if (failures.size >= MAX_TRACKED_CLIENTS) {
        for (const [entryKey, entry] of failures) if (entry.resetAt <= now) failures.delete(entryKey);
        if (failures.size >= MAX_TRACKED_CLIENTS) failures.delete(failures.keys().next().value!);
      }
      record = { guesses: new Set(), resetAt: now + BASIC_AUTH_FAILURE_WINDOW_MS };
      failures.set(bucket.key, record);
    }
    record.guesses.add(guess);
  }
}

function logWrongPassword(request: FastifyRequest, pairingCode = false) {
  for (const [index, bucket] of failureBuckets(request).entries()) {
    const size = failures.get(bucket.key)?.guesses.size ?? 0;
    if (index === 0 && size === 1)
      logger.warn(
        pairingCode ? "[basic-auth] Wrong pairing code from %s" : "[basic-auth] Wrong password from %s",
        request.ip,
      );
    if (size === bucket.limit) {
      logger.warn(
        index === 0
          ? "[basic-auth] %d wrong passwords from %s; refusing its sign-ins for %d minutes"
          : "[basic-auth] %d wrong passwords through %s; refusing every new sign-in from there for %d minutes",
        size,
        request.ip,
        Math.ceil(BASIC_AUTH_FAILURE_WINDOW_MS / 60_000),
      );
    }
  }
}

const checksInFlight = new Map<string, Promise<boolean | null>>();

/** Checks a Basic Authorization header and updates this client's wrong-password count; null when it must wait. */
async function checkCredentials(
  request: FastifyRequest,
  config: CachedConfig,
  header: string,
): Promise<boolean | null> {
  if (!headerMatches(header, config)) {
    const guess = guessId(header, config);
    const running = checksInFlight.get(guess);
    if (running) return running;
    const now = Date.now();
    // A password this client already got wrong is wrong again, so it skips the slow check.
    if (failureBuckets(request).some((bucket) => activeRecord(bucket.key, now)?.guesses.has(guess))) return false;
    // Counted before the slow check, in the same step as the caller's lockout check, so parallel
    // guesses see each other and cannot pass the limit.
    countGuess(request, guess);
    const check = verifyHeader(header, config);
    checksInFlight.set(guess, check);
    let verdict: boolean | null;
    try {
      verdict = await check;
    } finally {
      checksInFlight.delete(guess);
    }
    if (verdict === false) {
      logWrongPassword(request);
      return false;
    }
    for (const bucket of failureBuckets(request)) failures.get(bucket.key)?.guesses.delete(guess);
    if (verdict === null) return null;
  }
  clearOwnFailures(request);
  return true;
}

/** Shared counts belong to other visitors too, so signing in clears only this browser's own count. */
function clearOwnFailures(request: FastifyRequest) {
  if (lockoutSeconds(request) === 0) {
    for (const bucket of failureBuckets(request)) if (!bucket.shared) failures.delete(bucket.key);
  }
}

/** "Try again in N minutes." for a Retry-After in seconds. */
function tryAgainIn(seconds: number): string {
  const minutes = Math.ceil(seconds / 60);
  return minutes === 1 ? "Try again in 1 minute." : `Try again in ${minutes} minutes.`;
}

function sendTooManyFailures(reply: FastifyReply, retryAfterSeconds: number) {
  reply.header("Retry-After", String(retryAfterSeconds));
  reply
    .status(429)
    .send({ error: `Too many wrong passwords. ${tryAgainIn(retryAfterSeconds)}`, retryAfter: retryAfterSeconds });
}

function sendBusy(reply: FastifyReply) {
  reply.header("Retry-After", "1");
  reply.status(429).send({ error: "Too many sign-ins at once. Try again in a moment." });
}

function sendChallenge(reply: FastifyReply, realm: string) {
  // Quote the realm and escape any embedded quotes / backslashes so the
  // header stays well-formed even if the user picks an exotic realm string.
  const safeRealm = realm.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  reply.header("WWW-Authenticate", `Basic realm="${safeRealm}", charset="UTF-8"`);
  reply.status(401).send({ error: "Authentication required" });
}

/** The setup code the last lockdown log line named ("" for none), or null before the first. */
let lockdownAnnounced: string | null = null;

const REMOTE_ACCESS_DOCS_URL = "https://github.com/Pasta-Devs/Marinara-Engine/blob/main/docs/REMOTE_ACCESS.md";

const LOCKDOWN_JSON_MESSAGE =
  "Remote access requires a login, and none is set. " +
  "Open this address in a browser and set one with the setup code from the server log, " +
  "or set BASIC_AUTH_USER and BASIC_AUTH_PASS. " +
  `Help: ${REMOTE_ACCESS_DOCS_URL}`;

const PROXIED_LOCKDOWN_JSON_MESSAGE =
  "This request came through a reverse proxy or tunnel on this computer, so it counts as remote. " +
  "Set a login in Settings on the computer that runs Marinara, or set BASIC_AUTH_USER and BASIC_AUTH_PASS. " +
  `Help: ${REMOTE_ACCESS_DOCS_URL}`;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function wantsHtml(request: FastifyRequest): boolean {
  if (request.url.startsWith("/api/")) return false;
  const accept = request.headers.accept;
  const value = Array.isArray(accept) ? accept[0] : accept;
  return typeof value === "string" && value.toLowerCase().includes("text/html");
}

const PAGE_STYLE = `
  :root {
    color-scheme: dark;
    --bg: #0e1320;
    --panel: #161c2c;
    --panel-2: #1d2438;
    --border: #2a3350;
    --text: #e8ecf6;
    --muted: #9aa3bd;
    --accent: #f4a35d;
    --accent-soft: rgba(244, 163, 93, 0.12);
    --code-bg: #0a0f1c;
  }
  * { box-sizing: border-box; }
  html { background: var(--bg); }
  html, body { margin: 0; padding: 0; }
  body {
    background: radial-gradient(1200px 800px at 80% -10%, #1a223a 0%, var(--bg) 60%) no-repeat;
    color: var(--text);
    font: 15px/1.55 system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    min-height: 100dvh;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: 32px 16px 64px;
  }
  main {
    width: 100%;
    max-width: 720px;
  }
  header { margin-bottom: 24px; }
  .badge {
    display: inline-block;
    padding: 4px 10px;
    border-radius: 999px;
    background: var(--accent-soft);
    color: var(--accent);
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  h1 {
    font-size: 26px;
    line-height: 1.25;
    margin: 12px 0 8px;
    font-weight: 600;
  }
  p.lede { color: var(--muted); margin: 0; }
  .panel {
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 20px 22px;
    margin-top: 16px;
  }
  .panel h2 {
    font-size: 17px;
    margin: 0 0 6px;
    font-weight: 600;
  }
  .panel .hint { color: var(--muted); font-size: 14px; margin: 0 0 12px; }
  .panel .detail { display: inline-block; margin-top: 12px; font-size: 13px; }
  ol { margin: 0; padding-left: 20px; }
  ol li { margin: 6px 0; }
  code, pre {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 13px;
  }
  code {
    background: var(--code-bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 1px 6px;
  }
  pre {
    background: var(--code-bg);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 12px 14px;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    margin: 8px 0 0;
  }
  .ip-pill {
    display: inline-block;
    background: var(--accent-soft);
    color: var(--accent);
    border-radius: 6px;
    padding: 1px 8px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 13px;
  }
  footer {
    margin-top: 20px;
    padding: 16px 22px;
    background: var(--panel-2);
    border: 1px dashed var(--border);
    border-radius: 12px;
    color: var(--muted);
    font-size: 13px;
  }
  footer strong { color: var(--text); }
  a { color: var(--accent); text-decoration: none; border-bottom: 1px dotted rgba(244,163,93,0.4); }
  a:hover { border-bottom-color: var(--accent); }
  .links {
    display: flex;
    flex-wrap: wrap;
    gap: 14px;
    font-size: 14px;
  }
`;

/** Fields and button of the sign-in and setup forms. */
const FORM_STYLE = `
  label { display: block; margin: 14px 0 6px; font-size: 14px; color: var(--muted); }
  input { width: 100%; padding: 10px 12px; font: inherit; color: var(--text); background: var(--code-bg); border: 1px solid var(--border); border-radius: 8px; }
  input:focus-visible, button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  button { margin-top: 20px; width: 100%; padding: 10px 12px; font: inherit; font-weight: 600; color: var(--bg); background: var(--accent); border: 0; border-radius: 8px; cursor: pointer; }
  .error { margin: 8px 0 0; color: #f8a5a5; }
  .panel .hint.after { margin: 14px 0 0; }
`;

function renderLockdownPage(clientIp: string, proxied: boolean, error?: string, user = ""): string {
  const docker = isDockerRuntime();
  // In Docker the socket address is often the Docker gateway, not this device, so it is not shown.
  const lede = proxied
    ? "This request reached Marinara through a reverse proxy or tunnel on this computer, so it counts as remote. To protect your data, the server refuses it until you set a login."
    : docker
      ? "This device counts as remote. To protect your data, the server refuses remote devices until you set a login."
      : `You're connecting from <span class="ip-pill">${escapeHtml(clientIp)}</span>, not from the computer that runs Marinara. To protect your data, the server refuses other devices until you set a login.`;
  const findCode = docker
    ? `On the computer that runs Docker, show it with <code>docker logs &lt;container&gt; 2&gt;&amp;1 | grep "setup code"</code>.`
    : "Find it in the terminal or log of the computer that runs Marinara.";
  // Without a setup code (loopback bind behind a proxy, or TRUSTED_AUTH_PROXY) only this computer can set it.
  const firstOption = !hasLoginSetupCode()
    ? `<section class="panel">
      <h2>Option 1 — Set a login on this computer (recommended)</h2>
      <p class="hint">On the computer that runs Marinara, open it in a browser and set a login in Settings &rarr; Advanced &rarr; Access. Then refresh this page and sign in.</p>
    </section>`
    : `<form class="panel" method="post" action="/login/setup">
      <h2>Option 1 — Set a login here (recommended)</h2>
      <p class="hint">While no login is set, the server prints a one-time setup code in its log. ${findCode} On a device that already opens Marinara, you can also set the login in Settings &rarr; Advanced &rarr; Access.</p>
      ${error ? `<p class="error" role="alert">${escapeHtml(error)}</p>` : ""}
      <label for="setup-code">Setup code</label>
      <input id="setup-code" name="setupCode" autocomplete="one-time-code" autocapitalize="characters" spellcheck="false" placeholder="XXXX-XXXX-XXXX-XXXX" required autofocus />
      <label for="user">Username</label>
      <input id="user" name="user" value="${escapeHtml(user)}" autocomplete="username" autocapitalize="none" spellcheck="false" maxlength="128" required />
      <label for="password">Password (at least ${MIN_LOGIN_PASSWORD_LENGTH} characters)</label>
      <input id="password" name="password" type="password" autocomplete="new-password" minlength="${MIN_LOGIN_PASSWORD_LENGTH}" required />
      <button type="submit">Set login and sign in</button>
    </form>`;
  const secondOption = docker
    ? `<section class="panel">
      <h2>Option 2 — Login in the Docker settings</h2>
      <p class="hint">Use this when you manage Marinara through its Docker configuration.</p>
      <ol>
        <li>Add these two lines to <code>/app/data/.env</code> in the Marinara data volume, picking your own values:
          <pre>BASIC_AUTH_USER=yourname
BASIC_AUTH_PASS=a-long-random-password</pre>
        </li>
        <li>Wait a couple of seconds, then refresh this page and sign in.</li>
      </ol>
      <p class="hint after">You can also set the same two variables in the <code>environment</code> section of your Docker Compose file. Then run <code>docker compose up -d</code>.</p>
    </section>`
    : `<section class="panel">
      <h2>Option 2 — Login in <code>.env</code></h2>
      <p class="hint">Use this when you manage Marinara through its config file.</p>
      <ol>
        <li>Open your <code>.env</code> file in the Marinara Engine folder.</li>
        <li>Add (or edit) these two lines, picking your own values:
          <pre>BASIC_AUTH_USER=yourname
BASIC_AUTH_PASS=a-long-random-password</pre>
        </li>
        <li>Save <code>.env</code>, wait a couple of seconds, then refresh this page and sign in.</li>
      </ol>
    </section>`;
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <!-- Overrides no-referrer here, so the form posts its real Origin, not "null". -->
    <meta name="referrer" content="same-origin" />
    <title>Marinara Engine — Set up access</title>
    <style>${PAGE_STYLE}${FORM_STYLE}</style>
  </head>
  <body>
    <main>
      <header>
        <span class="badge">Access blocked</span>
        <h1>This Marinara Engine install needs a login before remote devices can connect.</h1>
        <p class="lede">${lede}</p>
      </header>

      ${firstOption}

      ${secondOption}

      <footer>
        <div class="links">
          <a href="${REMOTE_ACCESS_DOCS_URL}" target="_blank" rel="noopener noreferrer">Remote access guide</a>
          <a href="https://github.com/Pasta-Devs/Marinara-Engine/blob/main/docs/FAQ.md#how-do-i-access-marinara-engine-from-my-phone-or-another-device" target="_blank" rel="noopener noreferrer">FAQ: Access from another device</a>
          <a href="https://github.com/Pasta-Devs/Marinara-Engine/blob/main/docs/TROUBLESHOOTING.md#app-not-loading-on-mobile--another-device" target="_blank" rel="noopener noreferrer">Troubleshooting</a>
        </div>
      </footer>
    </main>
  </body>
</html>`;
}

function sendLockdown(request: FastifyRequest, reply: FastifyReply, proxied: boolean) {
  recordRefusal(request, "noLogin");
  if (wantsHtml(request)) {
    reply.status(403).header("Content-Type", "text/html; charset=utf-8").send(renderLockdownPage(request.ip, proxied));
    return;
  }
  reply
    .status(403)
    .send({ error: "Forbidden", message: proxied ? PROXIED_LOCKDOWN_JSON_MESSAGE : LOCKDOWN_JSON_MESSAGE });
}

/** Loopback, IP_ALLOWLIST and trusted Tailscale/Docker peers skip the password; a local proxy's visitors do not. */
function isTrustedPeer(request: FastifyRequest): boolean {
  return getRequestAccess(request).trustedPeer;
}

export function hasBasicAuthConfigured(): boolean {
  return loadConfig() !== null;
}

export function isBasicAuthSatisfied(request: FastifyRequest): boolean {
  const policy = getRequestAccess(request);
  if (policy.trustedPeer) return true;

  const config = loadConfig();
  if (!config) return !policy.lockedDown;

  if (requestSession(request, config)) return true;
  if (lockoutSeconds(request) > 0) return false;
  return hasCorrectPassword(request, config);
}

/** A same-origin path to return to after sign-in; anything else becomes "/". */
export function safeNextPath(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/")) return "/";
  try {
    const url = new URL(value, "http://marinara.invalid");
    const path = `${url.pathname}${url.search}${url.hash}`;
    // After normalising, a path starting with // or /\ would name another host.
    return url.origin === "http://marinara.invalid" && !/^\/[/\\]/.test(path) ? path : "/";
  } catch {
    return "/";
  }
}

function isLoginPath(request: FastifyRequest): boolean {
  const path = request.url.split("?", 1)[0];
  if (path === "/logout") return request.method === "POST";
  // A lockdown tab left open after another device set the login: its handler sends it to /login.
  if (path === "/login/setup") return request.method === "POST";
  return path === "/login" && ["GET", "HEAD", "POST"].includes(request.method);
}

/** Browser page loads get the login page; scripts and API calls keep the Basic challenge. */
function wantsLoginPage(request: FastifyRequest): boolean {
  return (request.method === "GET" || request.method === "HEAD") && wantsHtml(request);
}

function redirectToLogin(request: FastifyRequest, reply: FastifyReply) {
  reply.redirect(`/login?next=${encodeURIComponent(safeNextPath(request.url))}`, 302);
}

// ── Fastify onRequest hook ──

export async function basicAuthHook(request: FastifyRequest, reply: FastifyReply) {
  // Exempt the health endpoint so external probes still work. Its reply adds
  // details for signed-in callers, so a password sent here counts like anywhere else.
  if (request.url === "/api/health" || request.url.startsWith("/api/health?")) {
    const header = request.headers.authorization;
    if (typeof header === "string" && !isTrustedPeer(request)) {
      const config = loadConfig();
      if (config && !requestSession(request, config) && lockoutSeconds(request) === 0) {
        await checkCredentials(request, config, header);
      }
    }
    return;
  }

  // Exempt loopback, IPs already vouched for by IP_ALLOWLIST, and traffic
  // arriving from a trusted Tailscale / Docker interface (when its bypass
  // flag is on).
  const ip = request.ip;
  const policy = getRequestAccess(request);
  if (policy.trustedPeer) return;

  const config = loadConfig();

  // No credentials configured → fail closed for every non-loopback IP unless
  // the operator has explicitly opted back into private/public unauthenticated access.
  if (!config) {
    if (!policy.lockedDown) return;
    // The lockdown page's setup form posts here; the route checks the setup code.
    if (request.method === "POST" && request.url.split("?")[0] === "/login/setup") return;
    const proxied = policy.forwardedLoopback;
    const code = currentSetupCode();
    // Again whenever the setup code changes, so the newest code sits next to the newest refusal.
    if (lockdownAnnounced !== (code ?? "")) {
      const setIt = code
        ? `type the one-time setup code ${code} on that device, set one in Settings`
        : "set one in Settings on this computer";
      if (proxied) {
        logger.warn(
          "[basic-auth] Refused a connection forwarded by a reverse proxy or tunnel on this computer. No login is set; %s, or set BASIC_AUTH_USER/BASIC_AUTH_PASS in .env. Other options: %s",
          setIt,
          REMOTE_ACCESS_DOCS_URL,
        );
      } else {
        logger.warn(
          "[basic-auth] Refused a remote connection from %s. No login is set; %s, or set BASIC_AUTH_USER/BASIC_AUTH_PASS in .env. You can also add the IP to IP_ALLOWLIST. Other options: %s",
          ip,
          setIt,
          REMOTE_ACCESS_DOCS_URL,
        );
      }
      lockdownAnnounced = code ?? "";
    }
    sendLockdown(request, reply, proxied);
    return reply;
  }

  if (isLoginPath(request) || requestSession(request, config)) return;

  const header = request.headers.authorization;
  if (typeof header !== "string" && wantsLoginPage(request)) {
    redirectToLogin(request, reply);
    return reply;
  }

  const retryAfter = lockoutSeconds(request);
  if (retryAfter > 0) {
    sendTooManyFailures(reply, retryAfter);
    return reply;
  }

  const verdict = typeof header === "string" ? await checkCredentials(request, config, header) : false;
  if (verdict === null) {
    sendBusy(reply);
    return reply;
  }
  if (!verdict) {
    if (wantsLoginPage(request)) redirectToLogin(request, reply);
    else sendChallenge(reply, config.realm);
    return reply;
  }
}

/** Signs the current browser in, e.g. after it set the login, so it is not sent to /login next. */
export function rememberLoginInBrowser(request: FastifyRequest, reply: FastifyReply, method: SignInMethod): boolean {
  const config = loadConfig();
  return !!config && startBrowserSession(request, reply, config, method);
}

/** The owner's list of signed-in browsers; never the token or its hash. */
export function describeSessions(request: FastifyRequest) {
  const config = loadConfig();
  const key = config && sessionLoginKey(config);
  if (!config || !key) return [];
  const current = requestSession(request, config)?.id;
  return listSessions(key).map(({ id, label, createdAt, lastSeenAt, method }) => ({
    id,
    label,
    createdAt,
    lastSeenAt,
    method: method ?? null,
    current: id === current,
  }));
}

export function endSession(id: string): boolean {
  const config = loadConfig();
  const key = config && sessionLoginKey(config);
  pairingCodes = pairingCodes.filter((entry) => entry.sessionId !== id);
  return key ? deleteSession(key, id) : false;
}

/** Signs out every browser except the caller's own. */
export function endOtherSessions(request: FastifyRequest): void {
  const config = loadConfig();
  const key = config && sessionLoginKey(config);
  // A code from a signed-out device would let that device straight back in.
  pairingCodes = [];
  if (key) deleteOtherSessions(key, requestSession(request, config)?.id);
}

/**
 * A signed-in browser must also know the current password to change or remove the login.
 * Wrong tries count toward this client's lockout like any other wrong password.
 */
export async function requireCurrentPassword(
  request: FastifyRequest,
  reply: FastifyReply,
  password: unknown,
): Promise<boolean> {
  const config = loadConfig();
  if (!config) return true;
  const retryAfter = lockoutSeconds(request);
  if (retryAfter > 0) {
    sendTooManyFailures(reply, retryAfter);
    return false;
  }
  const verdict =
    typeof password === "string" && password
      ? await checkCredentials(request, config, buildExpectedHeader(config.login.user, password))
      : false;
  if (verdict === null) sendBusy(reply);
  else if (!verdict) reply.status(403).send({ error: "The current password is wrong.", reason: "currentPassword" });
  return verdict === true;
}

/** True when the caller is a browser that signed in on /login. */
export function hasBrowserSession(request: FastifyRequest): boolean {
  const config = loadConfig();
  return config !== null && requestSession(request, config) !== null;
}

// ── Pairing codes ──

const PAIRING_CODE_LENGTH = 8;
export const PAIRING_CODE_TTL_MS = 5 * 60_000;
const MAX_PAIRING_CODES = 10;

/** Keyed hashes in memory only, so a restart ends every code. */
let pairingCodes: { hash: Buffer; loginKey: string; expiresAt: number; sessionId?: string }[] = [];

function pairingHash(value: string): Buffer {
  return createHmac("sha256", HEADER_MAC_KEY).update("pairing\0").update(normalizeCode(value)).digest();
}

/** A code that signs one more browser in to the current login, once, for a few minutes. */
export function createPairingCode(request: FastifyRequest): { code: string; expiresAt: number } | null {
  const config = loadConfig();
  const loginKey = config && sessionLoginKey(config);
  if (!loginKey) return null;
  // Codes made on the host have no session; signing out the maker's session ends its codes.
  const sessionId = requestSession(request, config)?.id;
  const now = Date.now();
  const code = readableCode(PAIRING_CODE_LENGTH);
  const expiresAt = now + PAIRING_CODE_TTL_MS;
  pairingCodes = [
    // Expired codes stay one more TTL, so a late try hears "expired", not "wrong".
    ...pairingCodes.filter((entry) => entry.expiresAt + PAIRING_CODE_TTL_MS > now),
    { hash: pairingHash(code), loginKey, expiresAt, sessionId },
  ].slice(-MAX_PAIRING_CODES);
  return { code, expiresAt };
}

/** Uses up a code of the login `loginKey`; every stored hash is compared in constant time. */
function redeemPairingCode(hash: Buffer, loginKey: string): "ok" | "expired" | "wrong" {
  const match = pairingCodes.filter((entry) => safeEqual(entry.hash, hash)).at(0);
  if (!match || match.loginKey !== loginKey) return "wrong";
  pairingCodes = pairingCodes.filter((entry) => entry !== match);
  return match.expiresAt <= Date.now() ? "expired" : "ok";
}

// ── Login page ──

type PageError = { field: "password" | "code"; text: string };

/** How to recover a forgotten password, for the login this server uses. */
function forgotPasswordHint(): string {
  const docker = isDockerRuntime();
  if (loadConfig()?.login.source === "env") {
    return docker
      ? "Forgot the password? It is <code>BASIC_AUTH_PASS</code> in the container's environment or in <code>/app/data/.env</code>."
      : "Forgot the password? It is <code>BASIC_AUTH_PASS</code> in the <code>.env</code> file of the computer that runs Marinara.";
  }
  return docker
    ? "Forgot the password? On the computer that runs Docker, run <code>docker exec &lt;container&gt; node scripts/reset-login.mjs</code>, then set a new login."
    : "Forgot the password? On the computer that runs Marinara, run <code>pnpm reset-login</code> in the Marinara Engine folder, then set a new login.";
}

function renderLoginPage(next: string, error?: PageError): string {
  // The error sits under the field it is about, and that field gets the focus.
  const errorFor = (field: PageError["field"]) =>
    error?.field === field ? `<p class="error" id="${field}-error" role="alert">${escapeHtml(error.text)}</p>` : "";
  const codeError = error?.field === "code";
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <!-- Overrides no-referrer here, so the form posts its real Origin, not "null". -->
    <meta name="referrer" content="same-origin" />
    <title>Marinara Engine — Sign in</title>
    <style>${PAGE_STYLE}
      main { max-width: 400px; }
      ${FORM_STYLE}</style>
  </head>
  <body>
    <main>
      <header>
        <span class="badge">Sign in</span>
        <h1>Marinara Engine</h1>
      </header>
      <form class="panel" method="post" action="/login">
        <input type="hidden" name="next" value="${escapeHtml(next)}" />
        <label for="user">Username</label>
        <input id="user" name="user" autocomplete="username" autocapitalize="none" spellcheck="false" required${codeError ? "" : " autofocus"} />
        <label for="password">Password</label>
        <input id="password" name="password" type="password" autocomplete="current-password" required${error?.field === "password" ? ' aria-describedby="password-error"' : ""} />
        ${errorFor("password")}
        <button type="submit">Sign in</button>
        <p class="hint after">${forgotPasswordHint()}</p>
      </form>
      <form class="panel" method="post" action="/login">
        <h2>Sign in with a code</h2>
        <p class="hint">On a device that is signed in, or on the computer that runs Marinara, open Settings &rarr; Advanced &rarr; Access and choose Add a device.</p>
        <input type="hidden" name="next" value="${escapeHtml(next)}" />
        <label for="code">Pairing code</label>
        <input id="code" name="code" autocomplete="one-time-code" autocapitalize="characters" spellcheck="false" maxlength="16" required${codeError ? ' autofocus aria-describedby="code-error"' : ""} />
        ${errorFor("code")}
        <button type="submit">Sign in with code</button>
      </form>
    </main>
  </body>
</html>`;
}

function sendLoginPage(reply: FastifyReply, status: number, next: string, error?: PageError) {
  return reply.status(status).header("Content-Type", "text/html; charset=utf-8").send(renderLoginPage(next, error));
}

/** Anyone may post the public forms during lockdown, so their bodies stay small. */
const FORM_BODY_LIMIT = 8 * 1024;

export async function loginRoutes(app: FastifyInstance) {
  // The login form posts urlencoded fields; this parser stays inside these routes.
  app.addContentTypeParser("application/x-www-form-urlencoded", { parseAs: "string" }, (_request, body, done) =>
    done(null, Object.fromEntries(new URLSearchParams(body as string))),
  );

  app.get<{ Querystring: { next?: string } }>(
    "/login",
    { config: { rateLimit: LOGIN_PAGE_RATE_LIMIT } },
    async (request, reply) => {
      const next = safeNextPath(request.query.next);
      if (!loadConfig() || isBasicAuthSatisfied(request)) return reply.redirect(next, 302);
      if (!cookieValue(request, PRE_AUTH_COOKIE)) {
        const secure = isHttpsRequest(request) ? "; Secure" : "";
        reply.header(
          "Set-Cookie",
          `${PRE_AUTH_COOKIE}=${randomBytes(16).toString("base64url")}; Path=/login; HttpOnly; SameSite=Lax${secure}`,
        );
      }
      return sendLoginPage(reply, 200, next);
    },
  );

  app.post<{ Body: { user?: unknown; password?: unknown; code?: unknown; next?: unknown } | undefined }>(
    "/login",
    { bodyLimit: FORM_BODY_LIMIT, config: { rateLimit: LOGIN_PAGE_RATE_LIMIT } },
    async (request, reply) => {
      const body = request.body ?? {};
      const next = safeNextPath(body.next);
      const config = loadConfig();
      if (!config) return reply.redirect(next, 303);
      const field = typeof body.code === "string" ? "code" : "password";
      const retryAfter = lockoutSeconds(request);
      if (retryAfter > 0) {
        reply.header("Retry-After", String(retryAfter));
        return sendLoginPage(reply, 429, next, { field, text: `Too many wrong tries. ${tryAgainIn(retryAfter)}` });
      }
      if (typeof body.code === "string") {
        const hash = pairingHash(body.code);
        const key = sessionLoginKey(config);
        const redeemed = key ? redeemPairingCode(hash, key) : "wrong";
        if (redeemed === "expired") {
          return sendLoginPage(reply, 401, next, { field, text: "This code has expired. Ask for a new one." });
        }
        if (redeemed === "wrong") {
          // Wrong codes count like wrong passwords, so guessing one locks the address out the same way.
          countGuess(request, `code:${hash.toString("base64url").slice(0, 16)}`);
          logWrongPassword(request, true);
          return sendLoginPage(reply, 401, next, {
            field,
            text: "This code does not work. Check it or ask for a new one.",
          });
        }
        clearOwnFailures(request);
        if (!startBrowserSession(request, reply, config, "pairing")) {
          return sendLoginPage(reply, 500, next, {
            field,
            text: "This browser cannot stay signed in. See the server log.",
          });
        }
        logger.info("[login] A device signed in with a pairing code");
        return reply.redirect(next, 303);
      }
      const user = typeof body.user === "string" ? body.user : "";
      const password = typeof body.password === "string" ? body.password : "";
      const verdict = await checkCredentials(request, config, buildExpectedHeader(user, password));
      if (verdict === null) {
        return sendLoginPage(reply, 429, next, { field, text: "Too many sign-ins at once. Try again in a moment." });
      }
      if (!verdict) return sendLoginPage(reply, 401, next, { field, text: "Wrong username or password." });
      if (!startBrowserSession(request, reply, config, "password")) {
        return sendLoginPage(reply, 500, next, {
          field,
          text: "This browser cannot stay signed in. See the server log.",
        });
      }
      return reply.redirect(next, 303);
    },
  );

  // The lockdown page's form: the one-time setup code from the server log sets the first
  // login from any device, for installs with no browser on the host (Docker, NAS).
  app.post<{ Body: { setupCode?: unknown; user?: unknown; password?: unknown } | undefined }>(
    "/login/setup",
    { bodyLimit: FORM_BODY_LIMIT, config: { rateLimit: LOGIN_PAGE_RATE_LIMIT } },
    async (request, reply) => {
      if (loadConfig()) return reply.redirect("/login", 303);
      const body = request.body ?? {};
      const code = body.setupCode;
      const user = typeof body.user === "string" ? body.user.trim() : "";
      const password = typeof body.password === "string" ? body.password : "";
      // The username stays filled in after a mistake; the code and the password do not.
      const fail = (status: number, error: string) =>
        reply
          .status(status)
          .header("Content-Type", "text/html; charset=utf-8")
          .send(renderLockdownPage(request.ip, isForwardedLoopbackRequest(request), error, user));
      if (!user || user.length > 128 || user.includes(":")) {
        return fail(400, "Enter a username of up to 128 characters, without a colon.");
      }
      if (password.length < MIN_LOGIN_PASSWORD_LENGTH || password.length > 1024) {
        return fail(400, `Enter a password of at least ${MIN_LOGIN_PASSWORD_LENGTH} characters.`);
      }
      const checked = trySetupCode(request, code);
      if (typeof checked === "number") {
        reply.header("Retry-After", String(checked));
        return fail(429, `Too many wrong codes. ${tryAgainIn(checked)}`);
      }
      if (checked === "wrong")
        return fail(403, "This setup code does not work. Copy the newest one from the server log.");
      consumeLoginSetupCode();
      try {
        await setStoredLogin(user, password);
      } catch (err) {
        // The used code is gone, so print a new one; otherwise only a restart could bring one back.
        logger.error(err, "[login] Could not save the login from the setup code");
        announceSetupCode();
        return fail(500, "Marinara could not save the login. Use the new setup code from the server log.");
      }
      logger.info('[login] Remote login set for user "%s" with the setup code', user);
      // The app reads `loginSet` once and confirms the new login; with no session, the sign-in page asks for it.
      return reply.redirect(rememberLoginInBrowser(request, reply, "setup") ? "/?loginSet=1" : "/login", 303);
    },
  );

  app.post("/logout", async (request, reply) => {
    const config = loadConfig();
    const session = config && requestSession(request, config);
    if (session) endSession(session.id);
    const secure = isHttpsRequest(request) ? "; Secure" : "";
    reply.header("Set-Cookie", `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`);
    return reply.redirect("/login", 303);
  });
}
