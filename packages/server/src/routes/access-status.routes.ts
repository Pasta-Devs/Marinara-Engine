// ──────────────────────────────────────────────
// Routes: owner-only access status
// ──────────────────────────────────────────────
// Tells the owner who can open this install without a password. Configuration
// facts only: a bind address or HTTPS does not prove what the network or a proxy
// lets through, so reachability stays the owner's call. Never returns secrets.

import type { FastifyInstance } from "fastify";
import { getHost, getIpAllowlist } from "../config/runtime-config.js";
import { getAccessPolicy, getPasswordlessPeers, isLoopbackBind, isProxiedRequest } from "../middleware/ip-allowlist.js";
import { requirePrivilegedAccess } from "../middleware/privileged-gate.js";
import { RUNTIME_DIAGNOSTICS_RATE_LIMIT } from "../middleware/rate-limit.js";

export async function accessStatusRoutes(app: FastifyInstance) {
  app.get("/status", { config: { rateLimit: RUNTIME_DIAGNOSTICS_RATE_LIMIT } }, async (request, reply) => {
    if (!requirePrivilegedAccess(request, reply, { feature: "Access status" })) return;
    const policy = getAccessPolicy(request);
    // The address the server really listens on; HOST in .env can change without a restart.
    const bound = request.server.server.address();
    const host = bound && typeof bound === "object" ? bound.address : getHost();
    return {
      loopbackOnly: isLoopbackBind(host),
      host,
      basicAuth: policy.basicAuthConfigured,
      adminSecret: policy.adminSecretConfigured,
      allowlist: getIpAllowlist() !== null,
      passwordlessPeers: getPasswordlessPeers(host),
      loginKeepsOpen: getPasswordlessPeers(host, undefined, true),
      viaProxy: isProxiedRequest(request),
    };
  });
}
