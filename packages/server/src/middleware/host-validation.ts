import { isIP } from "node:net";
import type { FastifyReply, FastifyRequest } from "fastify";
import { getCorsConfig, getCsrfTrustedOrigins, getHost, getTrustedHosts } from "../config/runtime-config.js";
import { logger } from "../lib/logger.js";

const MAX_ANNOUNCED_REJECTED_HOSTS = 256;
const announcedRejectedHosts = new Set<string>();
const DNS_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;
const UNSPECIFIED_BIND_HOSTS = new Set(["0.0.0.0", "::"]);

export function firstHeader(value: string | string[] | undefined): string | null {
  if (!value) return null;
  const raw = Array.isArray(value) ? value[0] : value;
  return raw?.trim() || null;
}

function isValidDnsName(hostname: string): boolean {
  if (hostname.length > 253 || (!hostname.includes(".") && hostname.length > 63)) return false;
  return hostname.split(".").every((label) => DNS_LABEL.test(label));
}

/**
 * Parse an HTTP Host value without URL parser ambiguities. The returned value
 * intentionally excludes the port because rebinding protection is about the
 * authority name, while Marinara can be served on a configured or proxied port.
 */
export function parseRequestHostname(value: string | null | undefined): string | null {
  const raw = value?.trim();
  if (!raw || /[\s,/@\\?#]/.test(raw)) return null;

  let hostname: string;
  let port: string | undefined;
  if (raw.startsWith("[")) {
    const match = raw.match(/^\[([^\]]+)\](?::(\d{1,5}))?$/);
    const ipv6 = match?.[1];
    if (!ipv6 || isIP(ipv6) !== 6) return null;
    hostname = ipv6;
    port = match[2];
  } else {
    const colon = raw.lastIndexOf(":");
    if (colon >= 0) {
      if (raw.indexOf(":") !== colon) return null;
      hostname = raw.slice(0, colon);
      port = raw.slice(colon + 1);
      if (!/^\d{1,5}$/.test(port)) return null;
    } else {
      hostname = raw;
    }
  }

  if (port !== undefined) {
    const parsedPort = Number(port);
    if (!Number.isInteger(parsedPort) || parsedPort < 1 || parsedPort > 65_535) return null;
  }

  hostname = hostname.toLowerCase().replace(/\.$/, "");
  if (!hostname) return null;
  if (isIP(hostname)) return hostname;
  return isValidDnsName(hostname) ? hostname : null;
}

function hostnameFromOrigin(origin: string): string | null {
  if (origin === "*") return null;
  try {
    return parseRequestHostname(new URL(origin).hostname);
  } catch {
    return null;
  }
}

function configuredTrustedHostnames(): Set<string> {
  const trusted = new Set<string>();
  const addHost = (value: string | null | undefined) => {
    const hostname = parseRequestHostname(value);
    if (hostname && !UNSPECIFIED_BIND_HOSTS.has(hostname)) trusted.add(hostname);
  };

  addHost(getHost());
  for (const value of getTrustedHosts()) addHost(value);
  for (const origin of getCsrfTrustedOrigins()) {
    const hostname = hostnameFromOrigin(origin);
    if (hostname) trusted.add(hostname);
  }

  const corsOrigins = getCorsConfig().origin;
  if (typeof corsOrigins === "string") {
    const hostname = hostnameFromOrigin(corsOrigins);
    if (hostname) trusted.add(hostname);
  } else {
    for (const origin of corsOrigins) {
      const hostname = hostnameFromOrigin(origin);
      if (hostname) trusted.add(hostname);
    }
  }

  return trusted;
}

/**
 * IP literals remain trusted so phones, tablets, Tailscale peers, and other LAN
 * devices can keep connecting directly. Local-only DNS namespaces and
 * single-label machine/container names are also safe defaults. Public DNS
 * names must be explicitly configured, preventing an attacker-controlled name
 * from becoming a readable same-origin alias for loopback after DNS rebinding.
 */
export function isRequestHostTrusted(request: FastifyRequest): boolean {
  const rawHost = firstHeader(request.headers.host) ?? firstHeader(request.headers[":authority"]);
  const hostname = parseRequestHostname(rawHost);
  if (!hostname) return false;
  if (isIP(hostname)) return true;
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".home.arpa") ||
    !hostname.includes(".")
  ) {
    return true;
  }
  return configuredTrustedHostnames().has(hostname);
}

function announceRejectedHost(rawHost: string) {
  if (announcedRejectedHosts.has(rawHost)) return;
  if (announcedRejectedHosts.size >= MAX_ANNOUNCED_REJECTED_HOSTS) {
    const oldest = announcedRejectedHosts.values().next().value;
    if (oldest !== undefined) announcedRejectedHosts.delete(oldest);
  }
  announcedRejectedHosts.add(rawHost);
  logger.warn(
    "[host-validation] Rejected request Host '%s'. Add the exact hostname to TRUSTED_HOSTS if this is an intentional Marinara address.",
    rawHost,
  );
}

export function hostValidationHook(request: FastifyRequest, reply: FastifyReply, done: () => void) {
  if (isRequestHostTrusted(request)) {
    done();
    return;
  }

  const rawHost = firstHeader(request.headers.host) ?? firstHeader(request.headers[":authority"]) ?? "<missing>";
  announceRejectedHost(rawHost);
  reply.status(421).send({
    error: "Untrusted request host",
    message: `Host '${rawHost}' is not an allowed Marinara address. Use an IP address, a local hostname, or add the exact hostname to TRUSTED_HOSTS.`,
  });
}
