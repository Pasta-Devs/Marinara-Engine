import type { FastifyReply, FastifyRequest } from "fastify";
import { getAdminSecret, isAdminSecretRequiredOnLoopback } from "../config/runtime-config.js";
import { hasBrowserSession, isBasicAuthSatisfied } from "./basic-auth.js";
import { getRequestAccess } from "./ip-allowlist.js";
import { safeCompareString } from "../utils/security.js";
import { isRequestHostTrusted } from "./host-validation.js";

export function isAdminAuthorized(request: FastifyRequest): boolean {
  const adminSecret = getAdminSecret();
  if (!adminSecret) return false;
  const provided = request.headers["x-admin-secret"];
  const value = Array.isArray(provided) ? provided[0] : provided;
  return typeof value === "string" && safeCompareString(value, adminSecret);
}

/** This computer or the admin secret: owners who do not need the login password. */
export function isOwnerWithoutLogin(request: FastifyRequest): boolean {
  return (getRequestAccess(request).local && !isAdminSecretRequiredOnLoopback()) || isAdminAuthorized(request);
}

export function requirePrivilegedAccess(
  request: FastifyRequest,
  reply: FastifyReply,
  options: {
    loopbackOnly?: boolean;
    /** A browser signed in with the login may pass too. */
    signedIn?: boolean;
    trustedNetwork?: boolean;
    feature?: string;
    oneTimeCapabilityAuthorized?: boolean;
  } = {},
): boolean {
  if (!isRequestHostTrusted(request)) {
    reply.status(421).send({
      error: "Untrusted request host",
      message: "Privileged APIs require an allowed Marinara hostname.",
    });
    return false;
  }

  if (!isBasicAuthSatisfied(request)) {
    reply.status(403).send({
      error: "Privileged API requires authenticated access",
      message: "Configure Basic Auth or use loopback/local access before calling privileged APIs.",
    });
    return false;
  }

  // A browser that signed in on /login (a cookie session, not a bare Basic header) proves the
  // login. Never the Docker gateway address: on Docker Desktop every LAN client shares it.
  if (options.signedIn && hasBrowserSession(request)) return true;

  // A reverse proxy or tunnel on this machine connects from loopback too; its
  // forwarded visitors are remote clients, not the local user.
  const access = getRequestAccess(request);
  const localRequest = access.local;
  if (options.loopbackOnly && !localRequest) {
    reply.status(403).send({
      error: "Privileged API is loopback-only",
      message: `${options.feature ?? "This feature"} is available only from loopback unless explicitly enabled.`,
    });
    return false;
  }

  if (localRequest && !isAdminSecretRequiredOnLoopback()) {
    return true;
  }

  if (options.trustedNetwork && !access.forwardedLoopback && (access.allowlisted || access.trustedInterface)) {
    return true;
  }

  // A route-scoped, single-use capability may replace the reusable admin secret,
  // but never the trusted-host or normal-authentication checks above.
  if (options.oneTimeCapabilityAuthorized) return true;

  if (!getAdminSecret()) {
    reply.status(403).send({
      error: "ADMIN_SECRET is required for privileged APIs",
      message: "Set ADMIN_SECRET=<secret> in the server .env and send the same value in the X-Admin-Secret header.",
    });
    return false;
  }

  if (!isAdminAuthorized(request)) {
    reply.status(403).send({ error: "Invalid or missing X-Admin-Secret header" });
    return false;
  }

  return true;
}
