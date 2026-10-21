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
//     visitors a local proxy relays, who share one count. A browser that signed
//     in before keeps a cookie and gets BASIC_AUTH_FAILURE_LIMIT more tries on
//     top, so it still gets in with the correct password.

import type { FastifyRequest, FastifyReply } from "fastify";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { getBasicAuthConfig } from "../config/runtime-config.js";
import { logger } from "../lib/logger.js";
import { deriveServerKey } from "../utils/crypto.js";
import { cookieValue } from "./android-local-auth.js";
import { getRequestAccess, isForwardedLoopbackRequest } from "./ip-allowlist.js";
// Same grouping as the multiplayer peer server: an IPv4 address, or an IPv6 /64.
import { multiplayerPeerSocketKey as clientAddressKey } from "../services/multiplayer/peer-server.js";

interface CachedConfig {
  user: string;
  pass: string;
  realm: string;
  expectedHeader: Buffer;
  /** Built on first use; null when the server key cannot be read. */
  signedInToken?: Buffer | null;
  announced: boolean;
}

let cached: { raw: { user: string | null; pass: string | null; realm: string }; resolved: CachedConfig | null } | null =
  null;

function buildExpectedHeader(user: string, pass: string): Buffer {
  return Buffer.from(`Basic ${Buffer.from(`${user}:${pass}`, "utf8").toString("base64")}`, "utf8");
}

function loadConfig(): CachedConfig | null {
  const raw = getBasicAuthConfig();
  if (!cached || cached.raw.user !== raw.user || cached.raw.pass !== raw.pass || cached.raw.realm !== raw.realm) {
    if (raw.user && raw.pass) {
      cached = {
        raw,
        resolved: {
          user: raw.user,
          pass: raw.pass,
          realm: raw.realm,
          expectedHeader: buildExpectedHeader(raw.user, raw.pass),
          announced: false,
        },
      };
    } else {
      cached = { raw, resolved: null };
    }
  }

  if (cached.resolved && !cached.resolved.announced) {
    logger.info(
      `[basic-auth] HTTP Basic Auth enabled (realm="${cached.resolved.realm}", user="${cached.resolved.user}")`,
    );
    cached.resolved.announced = true;
  }

  return cached.resolved;
}

function safeEqual(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// ── Wrong-password throttle ──
// Kept apart from the /api rate limits, which skip the page and static files.

/** Different wrong passwords one client address may try in a window before it gets 429. */
export const BASIC_AUTH_FAILURE_LIMIT = 10;
/** A browser that signed in before may keep trying until the address reaches this many. */
const SIGNED_IN_FAILURE_LIMIT = 2 * BASIC_AUTH_FAILURE_LIMIT;
export const BASIC_AUTH_FAILURE_WINDOW_MS = 15 * 60_000;
const MAX_TRACKED_CLIENTS = 4096;

type FailureRecord = { guesses: Set<string>; resetAt: number };
const failures = new Map<string, FailureRecord>();

// ponytail: a reverse proxy or tunnel on this computer relays every visitor from
// loopback, so they share one count; the signed-in cookie keeps their owner from
// being locked out. Key on the forwarded client once the server has a
// trusted-proxy setting.
function clientKey(request: FastifyRequest): string {
  return clientAddressKey(request.ip);
}

// A browser that signed in once keeps this cookie. While its address is locked, it
// gets BASIC_AUTH_FAILURE_LIMIT more tries, so other people's wrong passwords
// cannot lock its owner out. The cookie does nothing without the password, and a
// copied cookie gets only those few tries.
const SIGNED_IN_COOKIE = "marinara_signed_in";
const SIGNED_IN_COOKIE_MAX_AGE_SECONDS = 365 * 24 * 60 * 60;

/** Keyed by a server-only secret and the credentials, so it stops working when the password changes. */
function signedInToken(config: CachedConfig): Buffer | null {
  if (config.signedInToken === undefined) {
    try {
      const key = deriveServerKey("basic-auth signed-in browser");
      config.signedInToken = Buffer.from(
        createHmac("sha256", key).update(config.expectedHeader).digest("base64url"),
        "utf8",
      );
    } catch (err) {
      config.signedInToken = null;
      logger.warn(err, "[basic-auth] Could not read the server key; signed-in browsers are not remembered");
    }
  }
  return config.signedInToken;
}

function hasSignedInCookie(request: FastifyRequest, config: CachedConfig): boolean {
  const token = signedInToken(config);
  const value = cookieValue(request, SIGNED_IN_COOKIE);
  return token !== null && value !== null && safeEqual(Buffer.from(value, "utf8"), token);
}

/** Direct HTTPS, or HTTPS as reported by a local proxy. Only ever adds Secure, so a wrong report cannot widen access. */
function isHttpsRequest(request: FastifyRequest): boolean {
  if (request.protocol === "https") return true;
  if (!isForwardedLoopbackRequest(request)) return false;
  const proto = request.headers["x-forwarded-proto"];
  const value = Array.isArray(proto) ? proto[0] : proto;
  return value?.split(",")[0]?.trim().toLowerCase() === "https";
}

function rememberSignedInBrowser(request: FastifyRequest, reply: FastifyReply, config: CachedConfig) {
  const token = signedInToken(config);
  if (!token || hasSignedInCookie(request, config)) return;
  const secure = isHttpsRequest(request) ? "; Secure" : "";
  reply.header(
    "Set-Cookie",
    `${SIGNED_IN_COOKIE}=${token.toString("utf8")}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SIGNED_IN_COOKIE_MAX_AGE_SECONDS}${secure}`,
  );
}

function hasCorrectPassword(request: FastifyRequest, config: CachedConfig): boolean {
  const header = request.headers.authorization;
  return typeof header === "string" && safeEqual(Buffer.from(header, "utf8"), config.expectedHeader);
}

function activeRecord(key: string, now: number): FailureRecord | undefined {
  const record = failures.get(key);
  if (record && record.resetAt <= now) {
    failures.delete(key);
    return undefined;
  }
  return record;
}

/** Seconds this client must wait before trying a password again; 0 when it may try now. */
function lockoutSeconds(request: FastifyRequest, signedIn = false): number {
  const now = Date.now();
  const record = activeRecord(clientKey(request), now);
  const limit = signedIn ? SIGNED_IN_FAILURE_LIMIT : BASIC_AUTH_FAILURE_LIMIT;
  if (!record || record.guesses.size < limit) return 0;
  return Math.max(1, Math.ceil((record.resetAt - now) / 1000));
}

function rememberFailure(request: FastifyRequest, header: string) {
  const now = Date.now();
  const key = clientKey(request);
  let record = activeRecord(key, now);
  if (!record) {
    if (failures.size >= MAX_TRACKED_CLIENTS) {
      for (const [entryKey, entry] of failures) if (entry.resetAt <= now) failures.delete(entryKey);
      if (failures.size >= MAX_TRACKED_CLIENTS) failures.delete(failures.keys().next().value!);
    }
    record = { guesses: new Set(), resetAt: now + BASIC_AUTH_FAILURE_WINDOW_MS };
    failures.set(key, record);
    logger.warn("[basic-auth] Wrong password from %s", request.ip);
  }
  // A browser that keeps resending one saved wrong password counts once; only new guesses add up.
  record.guesses.add(createHash("sha256").update(header).digest("base64url").slice(0, 16));
  if (record.guesses.size === BASIC_AUTH_FAILURE_LIMIT || record.guesses.size === SIGNED_IN_FAILURE_LIMIT) {
    logger.warn(
      "[basic-auth] %d wrong passwords from %s; refusing its sign-ins for %d minutes",
      record.guesses.size,
      request.ip,
      Math.ceil(BASIC_AUTH_FAILURE_WINDOW_MS / 60_000),
    );
  }
}

/** Compares the Authorization header and updates this client's wrong-password count. */
function checkCredentials(request: FastifyRequest, config: CachedConfig): boolean {
  const header = request.headers.authorization;
  if (!header || typeof header !== "string") return false;
  if (hasCorrectPassword(request, config)) {
    // Proxied visitors share one count, so one of them signing in must not clear the others' guesses,
    // and a signed-in browser getting past a lock leaves the lock in place.
    if (!isForwardedLoopbackRequest(request) && lockoutSeconds(request) === 0) failures.delete(clientKey(request));
    return true;
  }
  rememberFailure(request, header);
  return false;
}

function sendTooManyFailures(reply: FastifyReply, retryAfterSeconds: number) {
  reply.header("Retry-After", String(retryAfterSeconds));
  reply.status(429).send({ error: "Too many wrong passwords. Try again later." });
}

function sendChallenge(reply: FastifyReply, realm: string) {
  // Quote the realm and escape any embedded quotes / backslashes so the
  // header stays well-formed even if the user picks an exotic realm string.
  const safeRealm = realm.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  reply.header("WWW-Authenticate", `Basic realm="${safeRealm}", charset="UTF-8"`);
  reply.status(401).send({ error: "Authentication required" });
}

let lockdownAnnounced = false;

const REMOTE_ACCESS_DOCS_URL = "https://github.com/Pasta-Devs/Marinara-Engine/blob/main/docs/REMOTE_ACCESS.md";

const LOCKDOWN_JSON_MESSAGE =
  "Non-loopback access requires authentication because no Basic Auth credentials are configured. " +
  "Set BASIC_AUTH_USER and BASIC_AUTH_PASS, or add this IP to IP_ALLOWLIST. " +
  `Other options: ${REMOTE_ACCESS_DOCS_URL}`;

const PROXIED_LOCKDOWN_JSON_MESSAGE =
  "This request came through a reverse proxy or tunnel on this computer, so it counts as remote. " +
  "Set BASIC_AUTH_USER and BASIC_AUTH_PASS. " +
  `Other options: ${REMOTE_ACCESS_DOCS_URL}`;

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

function renderLockdownPage(clientIp: string, proxied: boolean): string {
  const safeIp = escapeHtml(clientIp);
  const lede = proxied
    ? `This request reached Marinara through a reverse proxy or tunnel on this computer, so it counts as remote. To protect your data, the server refuses proxied traffic until you set a login. Follow the steps below, save <code>.env</code>, wait a couple of seconds, then refresh this page.`
    : `You're connecting from <span class="ip-pill">${safeIp}</span>, which isn't loopback. To protect your data, the server refuses non-local traffic until you choose how this device should authenticate. Pick one of the options below, save <code>.env</code>, wait a couple of seconds, then refresh this page.`;
  // The IP allowlist only helps direct devices. A proxied visitor shows the proxy's address.
  const secondOption = proxied
    ? ""
    : `<section class="panel">
      <h2>Option 2 — IP allowlist</h2>
      <p class="hint">Best when you only need a few known devices to connect — e.g. your phone on a home network, or specific Tailscale peers.</p>
      <ol>
        <li>Open your <code>.env</code> file in the Marinara Engine folder.</li>
        <li>Add this line. Your current IP is already filled in — add more entries (comma-separated, CIDR allowed) for other devices:
          <pre>IP_ALLOWLIST=${safeIp}</pre>
        </li>
        <li>Save <code>.env</code>, wait a couple of seconds, then refresh this page.</li>
      </ol>
      <a class="detail" href="https://github.com/Pasta-Devs/Marinara-Engine/blob/main/docs/REMOTE_ACCESS.md#option-2-ip-allowlist" target="_blank" rel="noopener noreferrer">Detailed walkthrough →</a>
    </section>`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" />
<title>Marinara Engine — Set up access</title>
<style>
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
  html, body { margin: 0; padding: 0; }
  body {
    background: radial-gradient(1200px 800px at 80% -10%, #1a223a 0%, var(--bg) 60%) fixed;
    color: var(--text);
    font: 15px/1.55 system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    min-height: 100vh;
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
    overflow-x: auto;
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
    margin-top: 18px;
    display: flex;
    flex-wrap: wrap;
    gap: 14px;
    font-size: 14px;
  }
</style>
</head>
<body>
  <main>
    <header>
      <span class="badge">Access blocked</span>
      <h1>This Marinara Engine install needs access control before remote devices can connect.</h1>
      <p class="lede">${lede}</p>
    </header>

    <section class="panel">
      <h2>Option 1 — Basic Auth (recommended)</h2>
      <p class="hint">Best for shared networks, Tailscale, or any device you don't fully control. The browser will prompt for the username and password once, then remember it.</p>
      <ol>
        <li>Open your <code>.env</code> file in the Marinara Engine folder.</li>
        <li>Add (or edit) these two lines, picking your own values:
          <pre>BASIC_AUTH_USER=yourname
BASIC_AUTH_PASS=a-long-random-password</pre>
        </li>
        <li>Save <code>.env</code>, wait a couple of seconds, then refresh this page and enter the credentials.</li>
      </ol>
      <a class="detail" href="https://github.com/Pasta-Devs/Marinara-Engine/blob/main/docs/REMOTE_ACCESS.md#option-1-basic-auth-recommended" target="_blank" rel="noopener noreferrer">Detailed walkthrough →</a>
    </section>

    ${secondOption}

    <footer>
      <div class="links">
        <a href="${REMOTE_ACCESS_DOCS_URL}" target="_blank" rel="noopener noreferrer">Other options</a>
        <a href="https://github.com/Pasta-Devs/Marinara-Engine/blob/main/docs/REMOTE_ACCESS.md" target="_blank" rel="noopener noreferrer">Full Remote Access walkthrough</a>
        <a href="https://github.com/Pasta-Devs/Marinara-Engine/blob/main/docs/FAQ.md#how-do-i-access-marinara-engine-from-my-phone-or-another-device" target="_blank" rel="noopener noreferrer">FAQ: Access from another device</a>
        <a href="https://github.com/Pasta-Devs/Marinara-Engine/blob/main/docs/TROUBLESHOOTING.md#app-not-loading-on-mobile--another-device" target="_blank" rel="noopener noreferrer">Troubleshooting</a>
      </div>
    </footer>
  </main>
</body>
</html>`;
}

function sendLockdown(request: FastifyRequest, reply: FastifyReply, proxied: boolean) {
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

  if (lockoutSeconds(request, hasSignedInCookie(request, config)) > 0) return false;
  return hasCorrectPassword(request, config);
}

// ── Fastify onRequest hook ──

export function basicAuthHook(request: FastifyRequest, reply: FastifyReply, done: () => void) {
  // Exempt the health endpoint so external probes still work. Its reply adds
  // details for signed-in callers, so a password sent here counts like anywhere else.
  if (request.url === "/api/health" || request.url.startsWith("/api/health?")) {
    if (request.headers.authorization && !isTrustedPeer(request)) {
      const config = loadConfig();
      if (config && lockoutSeconds(request, hasSignedInCookie(request, config)) === 0) {
        checkCredentials(request, config);
      }
    }
    return done();
  }

  // Exempt loopback, IPs already vouched for by IP_ALLOWLIST, and traffic
  // arriving from a trusted Tailscale / Docker interface (when its bypass
  // flag is on).
  const ip = request.ip;
  const policy = getRequestAccess(request);
  if (policy.trustedPeer) return done();

  const config = loadConfig();

  // No credentials configured → fail closed for every non-loopback IP unless
  // the operator has explicitly opted back into private/public unauthenticated access.
  if (!config) {
    if (!policy.lockedDown) return done();
    const proxied = policy.forwardedLoopback;
    if (!lockdownAnnounced) {
      if (proxied) {
        logger.warn(
          "[basic-auth] Refused a connection forwarded by a reverse proxy or tunnel on this computer. No auth configured; set BASIC_AUTH_USER/BASIC_AUTH_PASS. Other options: %s",
          REMOTE_ACCESS_DOCS_URL,
        );
      } else {
        logger.warn(
          "[basic-auth] Refused non-loopback connection from %s. No auth configured; set BASIC_AUTH_USER/BASIC_AUTH_PASS or add the IP to IP_ALLOWLIST. Other options: %s",
          ip,
          REMOTE_ACCESS_DOCS_URL,
        );
      }
      lockdownAnnounced = true;
    }
    sendLockdown(request, reply, proxied);
    return;
  }

  const retryAfter = lockoutSeconds(request, hasSignedInCookie(request, config));
  if (retryAfter > 0) {
    sendTooManyFailures(reply, retryAfter);
    return;
  }

  if (!checkCredentials(request, config)) {
    sendChallenge(reply, config.realm);
    return;
  }

  rememberSignedInBrowser(request, reply, config);
  return done();
}
