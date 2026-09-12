import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { networkInterfaces } from "node:os";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

const ANDROID_AUTH_PREFIX = "/api/android-auth";
const ANDROID_LOGIN_PATH = "/android-login";
const SESSION_COOKIE = "MarinaraAndroidSession";
const SESSION_TTL_MS = 12 * 60 * 60 * 1_000;
const CHALLENGE_TTL_MS = 60_000;
const MAX_PENDING_CHALLENGES = 64;
const MAX_SESSIONS = 64;
const HEX_256 = /^[a-f0-9]{64}$/u;

interface PendingChallenge {
  clientNonce: string;
  expiresAt: number;
}

interface AndroidSession {
  expiresAt: number;
}

const pendingChallenges = new Map<string, PendingChallenge>();
const sessions = new Map<string, AndroidSession>();
const browserTickets = new Map<string, number>();
let localAddresses = new Set<string>();
let localAddressesExpiresAt = 0;

function androidSecret(): string | null {
  const value = process.env.MARINARA_ANDROID_SECRET?.trim().toLowerCase() ?? "";
  return HEX_256.test(value) ? value : null;
}

function isAndroidAuthConfigured(): boolean {
  return !!process.env.MARINARA_ANDROID_SECRET?.trim();
}

function isLoopbackIp(value: string): boolean {
  const normalized = normalizeIp(value);
  return (
    normalized === "127.0.0.1" ||
    normalized === "::1" ||
    normalized === "::ffff:127.0.0.1" ||
    normalized.startsWith("127.")
  );
}

function normalizeIp(value: string): string {
  const normalized = value.toLowerCase().split("%", 1)[0] ?? value.toLowerCase();
  return normalized.startsWith("::ffff:") ? normalized.slice("::ffff:".length) : normalized;
}

function isDeviceLocalIp(value: string): boolean {
  if (isLoopbackIp(value)) return true;
  const now = Date.now();
  if (localAddressesExpiresAt <= now) {
    const refreshed = new Set<string>();
    for (const entries of Object.values(networkInterfaces())) {
      for (const entry of entries ?? []) refreshed.add(normalizeIp(entry.address));
    }
    localAddresses = refreshed;
    localAddressesExpiresAt = now + 5_000;
  }
  return localAddresses.has(normalizeIp(value));
}

function firstPath(url: string): string {
  return url.split("?", 1)[0] ?? url;
}

function isPublicAuthPath(url: string): boolean {
  const path = firstPath(url);
  return (
    path === "/api/health" ||
    path === ANDROID_LOGIN_PATH ||
    path === `${ANDROID_AUTH_PREFIX}/challenge` ||
    path === `${ANDROID_AUTH_PREFIX}/session` ||
    path === `${ANDROID_AUTH_PREFIX}/browser-session`
  );
}

function isStateBoundOAuthCallback(request: FastifyRequest): boolean {
  if (request.method !== "GET" || firstPath(request.url) !== "/api/spotify/callback") return false;
  const query = request.url.split("?", 2)[1] ?? "";
  const params = new URLSearchParams(query);
  return Boolean(params.get("state") && (params.get("code") || params.get("error")));
}

function pruneExpired(now = Date.now()) {
  for (const [nonce, challenge] of pendingChallenges) {
    if (challenge.expiresAt <= now) pendingChallenges.delete(nonce);
  }
  for (const [ticket, expiresAt] of browserTickets) {
    if (expiresAt <= now) browserTickets.delete(ticket);
  }
  for (const [token, session] of sessions) {
    if (session.expiresAt <= now) sessions.delete(token);
  }
}

function trimOldest<T>(map: Map<string, T>, maximum: number) {
  while (map.size >= maximum) {
    const oldest = map.keys().next().value;
    if (oldest === undefined) return;
    map.delete(oldest);
  }
}

function hmac(secret: string, value: string): string {
  return createHmac("sha256", Buffer.from(secret, "hex")).update(value, "utf8").digest("hex");
}

function safeEqualHex(left: string, right: string): boolean {
  if (!HEX_256.test(left) || !HEX_256.test(right)) return false;
  return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}

function cookieValue(request: FastifyRequest, name: string): string | null {
  const raw = request.headers.cookie;
  if (!raw) return null;
  for (const entry of raw.split(";")) {
    const separator = entry.indexOf("=");
    if (separator < 0 || entry.slice(0, separator).trim() !== name) continue;
    return entry.slice(separator + 1).trim() || null;
  }
  return null;
}

function hasValidSession(request: FastifyRequest): boolean {
  const token = cookieValue(request, SESSION_COOKIE);
  if (!token || !HEX_256.test(token)) return false;
  const session = sessions.get(token);
  if (!session || session.expiresAt <= Date.now()) {
    sessions.delete(token);
    return false;
  }
  return true;
}

function hasValidSecretHeader(request: FastifyRequest, secret: string): boolean {
  const raw = request.headers["x-marinara-android-secret"];
  const value = (Array.isArray(raw) ? raw[0] : raw)?.trim().toLowerCase() ?? "";
  return safeEqualHex(value, secret);
}

function setSessionCookie(reply: FastifyReply, token: string) {
  reply.header(
    "Set-Cookie",
    `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${Math.floor(SESSION_TTL_MS / 1_000)}`,
  );
}

function noStore(reply: FastifyReply) {
  reply.header("Cache-Control", "no-store");
  reply.header("Pragma", "no-cache");
}

function issueSession(reply: FastifyReply): string {
  pruneExpired();
  trimOldest(sessions, MAX_SESSIONS);
  const token = randomBytes(32).toString("hex");
  sessions.set(token, { expiresAt: Date.now() + SESSION_TTL_MS });
  setSessionCookie(reply, token);
  return token;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/gu, (character) => {
    switch (character) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}

/**
 * APK-managed Termux installations set a per-install secret. When present,
 * requests originating on the Android device need either an authenticated
 * browser session or the secret header used by the local `mari` CLI. LAN peers
 * and installs without the Android wrapper retain their existing behavior.
 */
export function androidLocalAuthHook(request: FastifyRequest, reply: FastifyReply, done: () => void) {
  if (!isAndroidAuthConfigured() || !isDeviceLocalIp(request.ip)) {
    done();
    return;
  }
  const secret = androidSecret();
  if (!secret) {
    noStore(reply);
    reply.status(503).send({
      error: "Android local authentication is misconfigured",
      message: "MARINARA_ANDROID_SECRET must contain exactly 64 hexadecimal characters.",
    });
    return;
  }
  if (
    isPublicAuthPath(request.url) ||
    isStateBoundOAuthCallback(request) ||
    hasValidSession(request) ||
    hasValidSecretHeader(request, secret)
  ) {
    done();
    return;
  }

  noStore(reply);
  const acceptsHtml = request.headers.accept?.includes("text/html") && request.method === "GET";
  if (acceptsHtml) {
    reply.redirect(ANDROID_LOGIN_PATH, 303);
    return;
  }
  reply.status(401).send({
    error: "Android local authentication required",
    message: "Open Marinara through its Android app, or authenticate this browser at /android-login.",
  });
}

export async function androidLocalAuthRoutes(app: FastifyInstance) {
  app.addContentTypeParser("application/x-www-form-urlencoded", { parseAs: "string" }, (_request, body, done) => {
    const formBody = typeof body === "string" ? body : body.toString("utf8");
    done(null, Object.fromEntries(new URLSearchParams(formBody)));
  });

  app.post<{ Body: { clientNonce?: unknown } }>("/challenge", async (request, reply) => {
    noStore(reply);
    const secret = androidSecret();
    const clientNonce = typeof request.body?.clientNonce === "string" ? request.body.clientNonce.toLowerCase() : "";
    if (!secret || !isDeviceLocalIp(request.ip) || !HEX_256.test(clientNonce)) {
      return reply.status(404).send({ error: "Android authentication is unavailable" });
    }

    pruneExpired();
    if (pendingChallenges.size >= MAX_PENDING_CHALLENGES) {
      reply.header("Retry-After", Math.ceil(CHALLENGE_TTL_MS / 1_000));
      return reply.status(429).send({ error: "Too many pending Android authentication challenges" });
    }
    const serverNonce = randomBytes(32).toString("hex");
    pendingChallenges.set(serverNonce, { clientNonce, expiresAt: Date.now() + CHALLENGE_TTL_MS });
    return {
      serverNonce,
      proof: hmac(secret, `server:${clientNonce}:${serverNonce}`),
    };
  });

  app.post<{
    Body: { clientNonce?: unknown; serverNonce?: unknown; proof?: unknown; browser?: unknown };
  }>("/session", async (request, reply) => {
    noStore(reply);
    const secret = androidSecret();
    const clientNonce = typeof request.body?.clientNonce === "string" ? request.body.clientNonce.toLowerCase() : "";
    const serverNonce = typeof request.body?.serverNonce === "string" ? request.body.serverNonce.toLowerCase() : "";
    const proof = typeof request.body?.proof === "string" ? request.body.proof.toLowerCase() : "";
    const pending = pendingChallenges.get(serverNonce);
    pendingChallenges.delete(serverNonce);

    if (
      !secret ||
      !isDeviceLocalIp(request.ip) ||
      !pending ||
      pending.expiresAt <= Date.now() ||
      pending.clientNonce !== clientNonce ||
      !safeEqualHex(proof, hmac(secret, `client:${clientNonce}:${serverNonce}`))
    ) {
      return reply.status(401).send({ error: "Invalid or expired Android authentication challenge" });
    }

    if (request.body.browser === "true" || request.body.browser === true) {
      pruneExpired();
      trimOldest(browserTickets, MAX_PENDING_CHALLENGES);
      const browserTicket = randomBytes(32).toString("hex");
      browserTickets.set(browserTicket, Date.now() + CHALLENGE_TTL_MS);
      return { browserTicket };
    }

    issueSession(reply);
    return reply.redirect("/", 303);
  });

  app.post<{ Body: { secret?: unknown; ticket?: unknown } }>("/browser-session", async (request, reply) => {
    noStore(reply);
    const expected = androidSecret();
    const provided = typeof request.body?.secret === "string" ? request.body.secret.trim().toLowerCase() : "";
    const ticket = typeof request.body?.ticket === "string" ? request.body.ticket : "";
    const expiresAt = browserTickets.get(ticket) ?? 0;
    const validTicket = HEX_256.test(ticket) && expiresAt > Date.now();
    if (!expected || !isDeviceLocalIp(request.ip) || (!validTicket && !safeEqualHex(provided, expected))) {
      return reply
        .status(401)
        .type("text/html")
        .send(
          '<!doctype html><title>Marinara authentication failed</title><p>The browser link expired or the local access secret was not accepted. Open the Android app and choose Open in browser again.</p><p><a href="/android-login">Try again</a></p>',
        );
    }
    browserTickets.delete(ticket);
    issueSession(reply);
    return reply.redirect("/", 303);
  });

  app.get("/login", async (_request, reply) => {
    noStore(reply);
    return reply.redirect(ANDROID_LOGIN_PATH, 303);
  });
}

export async function androidLocalLoginRoute(app: FastifyInstance) {
  app.get(ANDROID_LOGIN_PATH, async (request, reply) => {
    noStore(reply);
    if (!androidSecret() || !isDeviceLocalIp(request.ip)) return reply.status(404).send({ error: "Not found" });
    // The fragment carries a one-use ticket, never the persistent install secret.
    // Handle it before redirecting an already authenticated browser.
    const nonce = randomBytes(16).toString("base64");
    reply.header(
      "Content-Security-Policy",
      `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'`,
    );

    const action = escapeHtml(`${ANDROID_AUTH_PREFIX}/browser-session`);
    return reply.type("text/html; charset=utf-8").send(`<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Marinara local authentication</title>
<style>body{max-width:38rem;margin:12vh auto;padding:1.5rem;background:#0a0a0f;color:#eee;font:16px system-ui}input,button{box-sizing:border-box;width:100%;margin:.5rem 0;padding:.8rem;border-radius:.5rem}button{cursor:pointer}</style>
<h1>Authenticate this local browser</h1>
<p>In the Marinara Android app, select <strong>Open in browser</strong> and tap <strong>Retry connection</strong> to sign in automatically. The app remembers your choice for next time.</p>
<details><summary>Manual sign-in for older APKs</summary><p>Paste the local secret shown by <code>cat ~/.marinara-engine/android-secret</code> in Termux.</p>
<form method="post" action="${action}"><label>Local access secret<input name="secret" type="password" required minlength="64" maxlength="64" autocomplete="off" spellcheck="false"></label><button type="submit">Open Marinara</button></form></details>
<script nonce="${nonce}">
function signIn() {
const ticket = new URLSearchParams(location.hash.slice(1)).get("ticket");
history.replaceState(null, "", location.pathname);
if (ticket && /^[a-f0-9]{64}$/.test(ticket)) {
  const form = document.createElement("form");
  form.method = "post";
  form.action = "${action}";
  const input = document.createElement("input");
  input.type = "hidden";
  input.name = "ticket";
  input.value = ticket;
  form.append(input);
  document.body.append(form);
  form.submit();
} else if (${hasValidSession(request)}) {
  location.replace("/");
}
}
window.addEventListener("hashchange", signIn);
signIn();
</script>
</html>`);
  });
}

export const androidLocalAuthTesting = {
  clear() {
    pendingChallenges.clear();
    sessions.clear();
    browserTickets.clear();
    localAddresses = new Set<string>();
    localAddressesExpiresAt = 0;
  },
  hmac,
};
