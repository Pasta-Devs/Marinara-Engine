// ──────────────────────────────────────────────
// Routes: owner-only access status
// ──────────────────────────────────────────────
// Tells the owner who can open this install without a password. Configuration
// facts only: a bind address or HTTPS does not prove what the network or a proxy
// lets through, so reachability stays the owner's call. Never returns secrets.

import type { FastifyInstance } from "fastify";
import {
  announceSetupCode,
  clearStoredLogin,
  consumeLoginSetupCode,
  getLoginConfig,
  hasLoginSetupCode,
  MIN_LOGIN_PASSWORD_LENGTH,
  setStoredLogin,
} from "../config/login-credential.js";
import { getHost, getIpAllowlist, isDockerRuntime } from "../config/runtime-config.js";
import { logger } from "../lib/logger.js";
import {
  createPairingCode,
  describeSessions,
  endOtherSessions,
  endSession,
  rememberLoginInBrowser,
  requireCurrentPassword,
  trySetupCode,
} from "../middleware/basic-auth.js";
import {
  getAccessPolicy,
  getPasswordlessPeers,
  getTrustedAuthProxies,
  hasProxyForwardingHeaders,
  isLoopbackBind,
  isLoopbackIp,
  isProxiedRequest,
} from "../middleware/ip-allowlist.js";
import { isOwnerWithoutLogin, requirePrivilegedAccess } from "../middleware/privileged-gate.js";
import { ACCESS_LOGIN_RATE_LIMIT, RUNTIME_DIAGNOSTICS_RATE_LIMIT } from "../middleware/rate-limit.js";
import { listRefusals } from "../middleware/refused-devices.js";

const ENV_MANAGED = { error: "The login is set in .env (BASIC_AUTH_USER and BASIC_AUTH_PASS). Change it there." };

export async function accessStatusRoutes(app: FastifyInstance) {
  app.get("/status", { config: { rateLimit: RUNTIME_DIAGNOSTICS_RATE_LIMIT } }, async (request, reply) => {
    if (!requirePrivilegedAccess(request, reply, { feature: "Access status", signedIn: true })) return;
    const policy = getAccessPolicy(request);
    // The address the server really listens on; HOST in .env can change without a restart.
    const bound = request.server.server.address();
    const host = bound && typeof bound === "object" ? bound.address : getHost();
    return {
      loopbackOnly: isLoopbackBind(host),
      host,
      basicAuth: policy.basicAuthConfigured,
      loginSource: getLoginConfig()?.source ?? null,
      loginUser: getLoginConfig()?.user ?? null,
      adminSecret: policy.adminSecretConfigured,
      allowlist: getIpAllowlist() !== null,
      trustedAuthProxy: getTrustedAuthProxies().length > 0,
      passwordlessPeers: getPasswordlessPeers(host),
      loginKeepsOpen: getPasswordlessPeers(host, undefined, true),
      // A relayed Host means a proxy only behind a loopback peer; a LAN or Docker-gateway visitor
      // names this server's address itself, so only forwarding headers count there.
      viaProxy: hasProxyForwardingHeaders(request) || (isLoopbackIp(request.ip) && isProxiedRequest(request)),
      // A signed-in browser elsewhere confirms changes with the current password.
      needsCurrentPassword: !isOwnerWithoutLogin(request),
    };
  });

  // Sets or changes the app login. The caller is already privileged, so the old password is not asked.
  app.put<{ Body: { user?: unknown; password?: unknown; setupCode?: unknown; currentPassword?: unknown } | undefined }>(
    "/login",
    { config: { rateLimit: ACCESS_LOGIN_RATE_LIMIT } },
    async (request, reply) => {
      const body = request.body ?? {};
      const user = typeof body.user === "string" ? body.user.trim() : "";
      const password = typeof body.password === "string" ? body.password : "";
      if (!user || user.length > 128 || user.includes(":")) {
        return reply.status(400).send({ error: "Enter a username of up to 128 characters, without a colon." });
      }
      if (password.length < MIN_LOGIN_PASSWORD_LENGTH || password.length > 1024) {
        return reply
          .status(400)
          .send({ error: `Enter a password of at least ${MIN_LOGIN_PASSWORD_LENGTH} characters.` });
      }

      const current = getLoginConfig();
      const owner = isOwnerWithoutLogin(request);
      // With no login yet, another device proves itself with the setup code from the server log.
      let setupCode = false;
      if (!current && !owner && body.setupCode !== undefined) {
        const checked = trySetupCode(request, body.setupCode);
        if (typeof checked === "number") {
          reply.header("Retry-After", String(checked));
          return reply.status(429).send({ error: "Too many wrong codes.", retryAfter: checked });
        }
        if (checked === "wrong") {
          return reply.status(403).send({
            error: "This setup code does not work. Copy the newest one from the server log.",
            reason: "setupCode",
          });
        }
        setupCode = true;
      }
      if (
        !requirePrivilegedAccess(request, reply, {
          feature: "Remote login",
          oneTimeCapabilityAuthorized: setupCode,
          signedIn: true,
        })
      ) {
        return;
      }
      if (current?.source === "env") return reply.status(409).send(ENV_MANAGED);
      if (current && !owner && !(await requireCurrentPassword(request, reply, body.currentPassword))) return;
      // No await since trySetupCode, so a code works once.
      if (setupCode) consumeLoginSetupCode();
      try {
        await setStoredLogin(user, password);
      } catch (err) {
        // The used code is gone, so print a new one, like the lockdown form does.
        if (setupCode) announceSetupCode();
        throw err;
      }
      logger.info('[login] Remote login %s for user "%s"', current ? "changed" : "set", user);
      if (!rememberLoginInBrowser(request, reply, setupCode ? "setup" : "password")) {
        return reply
          .status(500)
          .send({ error: "The login is saved, but this browser cannot stay signed in. See the server log." });
      }
      return { loginSource: "app" };
    },
  );

  app.delete<{ Body: { currentPassword?: unknown } | undefined }>(
    "/login",
    { config: { rateLimit: ACCESS_LOGIN_RATE_LIMIT } },
    async (request, reply) => {
      if (!requirePrivilegedAccess(request, reply, { feature: "Remote login", signedIn: true })) return;
      if (getLoginConfig()?.source === "env") return reply.status(409).send(ENV_MANAGED);
      if (
        !isOwnerWithoutLogin(request) &&
        !(await requireCurrentPassword(request, reply, request.body?.currentPassword))
      ) {
        return;
      }
      clearStoredLogin();
      logger.info("[login] Remote login removed");
      return reply.status(204).send();
    },
  );

  // Tells a device that is not this computer whether the Settings login form takes the setup
  // code. True only while no login is set, so it tells nothing to a visitor who has to sign in.
  app.get("/setup-code", { config: { rateLimit: RUNTIME_DIAGNOSTICS_RATE_LIMIT } }, async () => ({
    waiting: hasLoginSetupCode(),
    docker: isDockerRuntime(),
  }));

  // Signed-in browsers, for the owner to review and sign out.
  app.get("/sessions", { config: { rateLimit: RUNTIME_DIAGNOSTICS_RATE_LIMIT } }, async (request, reply) => {
    if (!requirePrivilegedAccess(request, reply, { feature: "Signed-in browsers", signedIn: true })) return;
    return { sessions: describeSessions(request) };
  });

  app.delete<{ Params: { id: string } }>(
    "/sessions/:id",
    { config: { rateLimit: ACCESS_LOGIN_RATE_LIMIT } },
    async (request, reply) => {
      if (!requirePrivilegedAccess(request, reply, { feature: "Signed-in browsers", signedIn: true })) return;
      if (!endSession(request.params.id)) return reply.status(404).send({ error: "Session not found" });
      return reply.status(204).send();
    },
  );

  // Signs out every other browser; the caller's own session stays.
  app.delete("/sessions", { config: { rateLimit: ACCESS_LOGIN_RATE_LIMIT } }, async (request, reply) => {
    if (!requirePrivilegedAccess(request, reply, { feature: "Signed-in browsers", signedIn: true })) return;
    endOtherSessions(request);
    logger.info("[login] Every other browser was signed out");
    return reply.status(204).send();
  });

  // "Add a device": a one-time code a new browser types on /login instead of the password.
  app.post("/pairing-codes", { config: { rateLimit: ACCESS_LOGIN_RATE_LIMIT } }, async (request, reply) => {
    if (!requirePrivilegedAccess(request, reply, { feature: "Add a device", signedIn: true })) return;
    const pairing = createPairingCode(request);
    if (!pairing) return reply.status(409).send({ error: "Set a remote login first." });
    logger.info("[login] A pairing code was created for a new device");
    return pairing;
  });

  // Devices the access gates refused lately, for the banner on this computer and signed-in browsers.
  app.get("/refusals", { config: { rateLimit: RUNTIME_DIAGNOSTICS_RATE_LIMIT } }, async (request, reply) => {
    if (!requirePrivilegedAccess(request, reply, { loopbackOnly: true, signedIn: true, feature: "Refused devices" })) {
      return;
    }
    // "No login yet" is old news once a login exists, and no news when a forward-auth proxy logs visitors in.
    const noLoginNews = getLoginConfig() === null && getTrustedAuthProxies().length === 0;
    return { refusals: listRefusals().filter((device) => noLoginNews || device.reason !== "noLogin") };
  });
}
