// ──────────────────────────────────────────────
// Middleware: IP Allowlist
// ──────────────────────────────────────────────
// Set IP_ALLOWLIST env var to a comma-separated list of allowed IPs or CIDRs.
// Examples:
//   IP_ALLOWLIST=192.168.1.100
//   IP_ALLOWLIST=192.168.1.0/24,10.0.0.5,203.0.113.42
//   IP_ALLOWLIST=::1,192.168.1.0/24
//
// When unset or empty, all IPs are allowed (no restriction).
// Loopback addresses (127.0.0.1, ::1, ::ffff:127.0.0.1) are always allowed
// so you can never lock yourself out of local access. A reverse proxy or tunnel
// on this machine also connects from loopback, so loopback requests carrying
// forwarding headers count as the remote clients they relay.

import type { FastifyRequest, FastifyReply } from "fastify";
import { readFileSync } from "node:fs";
import os, { networkInterfaces } from "node:os";
import {
  getAdminSecret,
  getBasicAuthConfig,
  getDockerBypassMode,
  getIpAllowlist,
  getTailscaleBypassMode,
  getTrustedPrivateNetworksOverride,
  isDockerProxyAuthRequired,
  isDockerRuntime,
  isLoopbackProxyAuthRequired,
  isUnauthenticatedPrivateNetworkAllowed,
  isUnauthenticatedRemoteAllowed,
} from "../config/runtime-config.js";
import { logger } from "../lib/logger.js";
import { evaluateAccessPolicy, isForwardedLoopbackPeer, type AccessFacts, type AccessPolicy } from "./access-policy.js";
import { firstHeader, parseRequestHostname } from "./host-validation.js";

// ── CIDR helpers ──

interface CIDREntry {
  /** 4 bytes for IPv4, 16 bytes for IPv6 */
  bytes: number[];
  prefixLen: number;
}

/** Parse a single IP string into a normalised byte array (always 16 bytes — IPv6). */
function ipToBytes(ip: string): number[] | null {
  let addr = ip.trim();

  // Strip IPv6 zone id (e.g. %eth0)
  const zoneIdx = addr.indexOf("%");
  if (zoneIdx !== -1) addr = addr.slice(0, zoneIdx);

  // Try parsing as IPv4
  const ipv4Parts = addr.split(".");
  if (ipv4Parts.length === 4 && ipv4Parts.every((p) => /^\d{1,3}$/.test(p))) {
    const nums = ipv4Parts.map(Number);
    if (nums.every((n) => n >= 0 && n <= 255)) {
      // Map to IPv6-mapped IPv4: ::ffff:a.b.c.d
      return [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xff, 0xff, ...nums];
    }
  }

  // Handle IPv4-mapped IPv6 (::ffff:a.b.c.d)
  if (addr.toLowerCase().startsWith("::ffff:") && addr.includes(".")) {
    const v4Part = addr.slice(7);
    return ipToBytes(v4Part);
  }

  // Parse IPv6
  try {
    // Expand :: shorthand
    const expanded = expandIPv6(addr);
    if (!expanded) return null;
    return expanded;
  } catch {
    return null;
  }
}

/** Expand an IPv6 address string into 16 bytes. */
function expandIPv6(addr: string): number[] | null {
  const parts = addr.split("::");
  if (parts.length > 2) return null;

  const left = parts[0] ? parts[0].split(":") : [];
  const right = parts.length === 2 ? (parts[1] ? parts[1].split(":") : []) : [];

  if (parts.length === 1 && left.length !== 8) return null;

  const missing = 8 - left.length - right.length;
  if (missing < 0) return null;

  const groups = [...left, ...Array(missing).fill("0"), ...right];
  if (groups.length !== 8) return null;

  const bytes: number[] = [];
  for (const g of groups) {
    const val = parseInt(g, 16);
    if (isNaN(val) || val < 0 || val > 0xffff) return null;
    bytes.push((val >> 8) & 0xff, val & 0xff);
  }
  return bytes;
}

/** Parse "ip" or "ip/prefix" into a CIDREntry. */
function parseCIDR(entry: string): CIDREntry | null {
  const slashIdx = entry.indexOf("/");
  const ip = slashIdx === -1 ? entry : entry.slice(0, slashIdx);
  const bytes = ipToBytes(ip);
  if (!bytes) return null;

  let prefixLen: number;
  if (slashIdx === -1) {
    prefixLen = 128; // single host
  } else {
    prefixLen = parseInt(entry.slice(slashIdx + 1), 10);
    if (isNaN(prefixLen) || prefixLen < 0 || prefixLen > 128) return null;

    // If the original was an IPv4 CIDR (e.g. /24), shift it into the IPv6-mapped range
    const isV4 = ip.includes(".") && !ip.includes(":");
    if (isV4 && prefixLen <= 32) {
      prefixLen += 96; // offset into the ::ffff: prefix
    }
  }

  return { bytes, prefixLen };
}

/** Check if the given IP bytes match the CIDR entry. */
function matchesCIDR(ipBytes: number[], cidr: CIDREntry): boolean {
  const fullBytes = Math.floor(cidr.prefixLen / 8);
  const remainingBits = cidr.prefixLen % 8;

  for (let i = 0; i < fullBytes; i++) {
    if (ipBytes[i] !== cidr.bytes[i]) return false;
  }

  if (remainingBits > 0 && fullBytes < ipBytes.length && fullBytes < cidr.bytes.length) {
    const mask = 0xff << (8 - remainingBits);
    if ((ipBytes[fullBytes]! & mask) !== (cidr.bytes[fullBytes]! & mask)) return false;
  }

  return true;
}

// ── Loopback CIDRs (always allowed) ──
const LOOPBACK_CIDRS: CIDREntry[] = [parseCIDR("127.0.0.0/8")!, parseCIDR("::1")!];

// ── Specific interface CIDRs used by the Tailscale / Docker bypass ──
// Tailscale assigns Tailnet peer IPs from the CGNAT block 100.64.0.0/10.
// Docker's default bridge networks live within 172.16.0.0/12.
const TAILSCALE_CIDR = parseCIDR("100.64.0.0/10")!;
const DOCKER_CIDR = parseCIDR("172.16.0.0/12")!;

/**
 * Resolve the IPv4 default gateway from Linux's route table.
 *
 * Docker Desktop and custom Docker address pools do not necessarily use the
 * conventional 172.16.0.0/12 bridge range. In those environments, traffic
 * forwarded from the host arrives from this exact gateway address.
 */
export function parseDockerDefaultGatewayIp(routeTable: string): string | null {
  const candidates: Array<{ ip: string; metric: number }> = [];

  for (const line of routeTable.split(/\r?\n/u).slice(1)) {
    const columns = line.trim().split(/\s+/u);
    if (columns.length < 8) continue;

    const destination = columns[1];
    const gatewayHex = columns[2];
    const flagsHex = columns[3];
    const metricText = columns[6];
    if (destination !== "00000000" || !/^[0-9a-f]{8}$/iu.test(gatewayHex ?? "")) continue;

    const flags = Number.parseInt(flagsHex ?? "", 16);
    if (!Number.isFinite(flags) || (flags & 0x3) !== 0x3) continue;

    const octets = (gatewayHex!.match(/.{2}/gu) ?? []).map((part) => Number.parseInt(part, 16)).reverse();
    if (octets.length !== 4 || octets.every((octet) => octet === 0)) continue;

    const metric = Number.parseInt(metricText ?? "", 10);
    candidates.push({
      ip: octets.join("."),
      metric: Number.isFinite(metric) ? metric : Number.MAX_SAFE_INTEGER,
    });
  }

  candidates.sort((left, right) => left.metric - right.metric);
  return candidates[0]?.ip ?? null;
}

/** Read and parse Docker's default gateway once during module initialization. */
function readDockerDefaultGatewayIp(): string | null {
  try {
    return parseDockerDefaultGatewayIp(readFileSync("/proc/net/route", "utf8"));
  } catch {
    return null;
  }
}

const dockerDefaultGatewayIp = isDockerRuntime() ? readDockerDefaultGatewayIp() : null;

function readInterfaceIndex(interfaceName: string, field: "ifindex" | "iflink"): number | null {
  if (!/^[a-z0-9_.:-]+$/iu.test(interfaceName)) return null;
  try {
    const raw = readFileSync(`/sys/class/net/${interfaceName}/${field}`, "utf8").trim();
    if (!/^\d+$/u.test(raw)) return null;
    const value = Number(raw);
    return Number.isSafeInteger(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

/**
 * A bridge/macvlan container interface links to a different peer index in the
 * host namespace. Host-network interfaces link to themselves, so they are not
 * sufficient evidence for the automatic bypass.
 */
function readContainerPeerInterfaceNames(
  interfaces: ReturnType<typeof networkInterfaces> = networkInterfaces(),
): ReadonlySet<string> {
  const names = new Set<string>();
  for (const interfaceName of Object.keys(interfaces)) {
    const ifindex = readInterfaceIndex(interfaceName, "ifindex");
    const iflink = readInterfaceIndex(interfaceName, "iflink");
    if (ifindex !== null && iflink !== null && ifindex !== iflink) names.add(interfaceName);
  }
  return names;
}

const dockerContainerInterfaceNames = isDockerRuntime() ? readContainerPeerInterfaceNames() : new Set<string>();
const DOCKER_INTERFACE_CACHE_TTL_MS = 5_000;
type ParsedDockerInterfaceCidr = { interfaceName: string; cidr: CIDREntry };
let cachedDockerInterfaces:
  | {
      expiresAt: number;
      interfaces: ReturnType<typeof networkInterfaces>;
      parsedCidrs: ParsedDockerInterfaceCidr[];
    }
  | undefined;

function parseDockerInterfaceCidrs(interfaces: ReturnType<typeof networkInterfaces>): ParsedDockerInterfaceCidr[] {
  const entries: ParsedDockerInterfaceCidr[] = [];
  for (const [interfaceName, addresses] of Object.entries(interfaces)) {
    for (const address of addresses ?? []) {
      if (address.internal || typeof address.cidr !== "string") continue;
      const cidr = parseCIDR(address.cidr);
      if (cidr) entries.push({ interfaceName, cidr });
    }
  }
  return entries;
}

function getDockerInterfaceSnapshot() {
  const timestamp = Date.now();
  if (!cachedDockerInterfaces || cachedDockerInterfaces.expiresAt <= timestamp) {
    const interfaces = networkInterfaces();
    cachedDockerInterfaces = {
      expiresAt: timestamp + DOCKER_INTERFACE_CACHE_TTL_MS,
      interfaces,
      parsedCidrs: parseDockerInterfaceCidrs(interfaces),
    };
  }
  return cachedDockerInterfaces;
}

function matchesIp(ip: string, cidr: string): boolean {
  const bytes = ipToBytes(ip);
  const parsed = parseCIDR(cidr);
  return Boolean(bytes && parsed && matchesCIDR(bytes, parsed));
}

/** True only when the client matches an actual container network or its exact gateway. */
export function isDockerRuntimeNetworkIp(
  ip: string,
  interfaces?: ReturnType<typeof networkInterfaces>,
  gatewayIp: string | null = dockerDefaultGatewayIp,
  containerInterfaceNames: ReadonlySet<string> = dockerContainerInterfaceNames,
  parsedInterfaceCidrs?: readonly ParsedDockerInterfaceCidr[],
): boolean {
  const defaultNetwork = interfaces === undefined ? getDockerInterfaceSnapshot() : undefined;
  const resolvedInterfaces = interfaces ?? defaultNetwork!.interfaces;
  const resolvedCidrs =
    parsedInterfaceCidrs ?? defaultNetwork?.parsedCidrs ?? parseDockerInterfaceCidrs(resolvedInterfaces);
  const hasContainerInterface = Object.keys(resolvedInterfaces).some((interfaceName) =>
    containerInterfaceNames.has(interfaceName),
  );
  if (!hasContainerInterface) return false;
  if (gatewayIp && matchesIp(ip, gatewayIp)) return true;
  const bytes = ipToBytes(ip);
  return Boolean(
    bytes &&
    resolvedCidrs.some((entry) => containerInterfaceNames.has(entry.interfaceName) && matchesCIDR(bytes, entry.cidr)),
  );
}

function isDockerCompatibilityNetworkIp(
  ip: string,
  interfaces: ReturnType<typeof networkInterfaces>,
  gatewayIp: string | null,
  parsedInterfaceCidrs: readonly ParsedDockerInterfaceCidr[] = parseDockerInterfaceCidrs(interfaces),
): boolean {
  if (gatewayIp && matchesIp(ip, gatewayIp)) return true;
  const bytes = ipToBytes(ip);
  return Boolean(bytes && parsedInterfaceCidrs.some((entry) => matchesCIDR(bytes, entry.cidr)));
}

// ── Private / non-routable network CIDRs ──
// Used by the safe-by-default Basic Auth lockdown to avoid breaking
// LAN, Docker bridge, Kubernetes pod, and Tailscale traffic when no
// auth is configured. Public IPs are NOT in this list.
//
// These are *defaults* — operators can override the entire list via the
// TRUSTED_PRIVATE_NETWORKS env var (comma-separated IPs / CIDRs) to
// strip ranges they consider untrusted (e.g. a publicly-routable
// corporate /16) or to substitute their own list entirely.
const DEFAULT_PRIVATE_NETWORK_CIDRS: CIDREntry[] = [
  parseCIDR("10.0.0.0/8")!, // RFC 1918
  parseCIDR("172.16.0.0/12")!, // RFC 1918 (covers Docker default bridge 172.17.0.0/16)
  parseCIDR("192.168.0.0/16")!, // RFC 1918
  parseCIDR("169.254.0.0/16")!, // RFC 3927 link-local
  parseCIDR("100.64.0.0/10")!, // RFC 6598 CGNAT (Tailscale, carrier NAT)
  parseCIDR("fc00::/7")!, // RFC 4193 unique local (IPv6 ULA)
  parseCIDR("fe80::/10")!, // RFC 4291 IPv6 link-local
];

let cachedPrivateNetworks: { raw: string | null; entries: CIDREntry[]; announced: boolean } | null = null;

function getPrivateNetworkCidrs(): CIDREntry[] {
  const raw = getTrustedPrivateNetworksOverride();
  if (!cachedPrivateNetworks || cachedPrivateNetworks.raw !== raw) {
    if (!raw) {
      cachedPrivateNetworks = { raw: null, entries: DEFAULT_PRIVATE_NETWORK_CIDRS, announced: true };
    } else {
      const entries: CIDREntry[] = [];
      for (const part of raw.split(",")) {
        const trimmed = part.trim();
        if (!trimmed) continue;
        const cidr = parseCIDR(trimmed);
        if (!cidr) {
          logger.warn(`[trusted-private-networks] Ignoring invalid entry: "${trimmed}"`);
          continue;
        }
        entries.push(cidr);
      }
      cachedPrivateNetworks = { raw, entries, announced: false };
    }
  }

  if (cachedPrivateNetworks.raw && !cachedPrivateNetworks.announced) {
    logger.info(
      `[trusted-private-networks] Overriding default private-network list with: ${cachedPrivateNetworks.raw}`,
    );
    cachedPrivateNetworks.announced = true;
  }

  return cachedPrivateNetworks.entries;
}

// ── Build allowlist on startup ──

function buildAllowlist(raw: string | null): CIDREntry[] | null {
  if (!raw) return null; // no restriction

  const entries: CIDREntry[] = [];
  for (const part of raw.split(",")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const cidr = parseCIDR(trimmed);
    if (!cidr) {
      logger.warn(`[ip-allowlist] Ignoring invalid entry: "${trimmed}"`);
      continue;
    }
    entries.push(cidr);
  }

  if (entries.length === 0) {
    logger.error("[ip-allowlist] IP_ALLOWLIST contains no valid entries; denying all non-loopback traffic");
  }
  // A configured but invalid list must fail closed. An empty array still lets
  // loopback through in ipAllowlistHook while matching no remote address.
  return entries;
}

let cachedAllowlist: {
  raw: string | null;
  entries: CIDREntry[] | null;
  announced: boolean;
} | null = null;

function getAllowlist() {
  const raw = getIpAllowlist();
  if (!cachedAllowlist || cachedAllowlist.raw !== raw) {
    cachedAllowlist = {
      raw,
      entries: buildAllowlist(raw),
      announced: false,
    };
  }

  if (cachedAllowlist.entries && !cachedAllowlist.announced) {
    logger.info(`[ip-allowlist] Restricting access to: ${cachedAllowlist.raw}  (+ loopback always allowed)`);
    cachedAllowlist.announced = true;
  }

  return cachedAllowlist.entries;
}

// ── Reusable predicates (shared with basic-auth) ──

/** True if the given IP string is a loopback address. */
/**
 * True when a base URL points at an inference server running on this machine
 * or this LAN (llama.cpp, Ollama, vLLM, LM Studio). Such servers expose
 * arbitrary model names that never match any provider catalog, so callers use
 * this to decide when local-server-specific request shaping is safe.
 */
export function isLocalInferenceBaseUrl(baseUrl: string): boolean {
  try {
    const hostname = new URL(baseUrl).hostname.toLowerCase().replace(/^\[|\]$|\.$/g, "");
    if (hostname === "localhost" || isLoopbackIp(hostname)) return true;
    if (hostname.endsWith(".local") || hostname.endsWith(".localhost")) return true;
    if (hostname === "host.docker.internal" || hostname === "host.containers.internal") return true;
    if (!hostname.includes(".") || hostname.endsWith(".internal")) return true;
    return isNonRoutableNetworkIp(hostname);
  } catch {
    return false;
  }
}

export function isLoopbackIp(ip: string): boolean {
  const bytes = ipToBytes(ip);
  if (!bytes) return false;
  for (const lb of LOOPBACK_CIDRS) {
    if (matchesCIDR(bytes, lb)) return true;
  }
  return false;
}

/** True when the IP belongs to the built-in private/non-routable ranges, independent of auth configuration. */
export function isNonRoutableNetworkIp(ip: string): boolean {
  const bytes = ipToBytes(ip);
  return Boolean(bytes && DEFAULT_PRIVATE_NETWORK_CIDRS.some((cidr) => matchesCIDR(bytes, cidr)));
}

/**
 * True if the given IP belongs to a trusted private / non-routable range.
 * Defaults to RFC 1918, CGNAT, link-local, and IPv6 ULA — but the operator
 * can override the entire list via the TRUSTED_PRIVATE_NETWORKS env var.
 */
export function isPrivateNetworkIp(ip: string): boolean {
  const bytes = ipToBytes(ip);
  if (!bytes) return false;
  for (const cidr of getPrivateNetworkCidrs()) {
    if (matchesCIDR(bytes, cidr)) return true;
  }
  return false;
}

/**
 * True if the given IP is configured in the active IP_ALLOWLIST.
 * Returns false when no allowlist is configured (so callers can decide
 * what to do with "no list" vs "list says no").
 */
export function isInIpAllowlist(ip: string): boolean {
  const allowlist = getAllowlist();
  if (!allowlist) return false;
  const bytes = ipToBytes(ip);
  if (!bytes) return false;
  for (const entry of allowlist) {
    if (matchesCIDR(bytes, entry)) return true;
  }
  return false;
}

/** True if the given IP is in the Tailscale CGNAT range (100.64.0.0/10). */
export function isTailscaleIp(ip: string): boolean {
  const bytes = ipToBytes(ip);
  if (!bytes) return false;
  return matchesCIDR(bytes, TAILSCALE_CIDR);
}

/** True if the given IP is in the Docker bridge range (172.16.0.0/12). */
export function isDockerIp(ip: string): boolean {
  const bytes = ipToBytes(ip);
  if (!bytes) return false;
  return matchesCIDR(bytes, DOCKER_CIDR);
}

/** Headers that reverse proxies and tunnels (nginx, Caddy, Traefik, cloudflared, Tailscale, ngrok) add. */
export const PROXY_FORWARDING_HEADERS = [
  "forwarded",
  "x-forwarded-for",
  "x-real-ip",
  "x-forwarded-host",
  "x-forwarded-proto",
  "cf-connecting-ip",
  "true-client-ip",
  "tailscale-user-login",
  "tailscale-funnel-request",
  "via",
] as const;

function hasHeaderValue(value: string | string[] | undefined): boolean {
  if (Array.isArray(value)) return value.some((entry) => entry.trim().length > 0);
  return typeof value === "string" && value.trim().length > 0;
}

/** True when a request carries common reverse-proxy forwarding headers. */
function hasProxyForwardingHeaders(request: Pick<FastifyRequest, "headers">): boolean {
  return PROXY_FORWARDING_HEADERS.some((header) => hasHeaderValue(request.headers[header]));
}

/**
 * A browser on this computer addresses Marinara by a loopback name. A loopback socket that
 * announces any other Host (a domain or a LAN address) was relayed by a local proxy or tunnel,
 * even when that proxy adds no forwarding headers. A Docker gateway peer that
 * names another Host is relayed too.
 */
function hasRelayedHost(request: Pick<FastifyRequest, "headers">): boolean {
  const hostname = parseRequestHostname(
    firstHeader(request.headers.host) ?? firstHeader(request.headers[":authority"]),
  );
  if (!hostname) return false;
  if (hostname === "localhost" || hostname.endsWith(".localhost")) return false;
  if (hostname === "0.0.0.0" || hostname === "::") return false;
  // The machine's own name (Debian maps it to 127.0.1.1) is local too.
  const own = os.hostname().toLowerCase();
  if (hostname === own || hostname === `${own}.local`) return false;
  return !isLoopbackIp(hostname);
}

/** Browsers speak HTTP/1.1 or newer; nginx's default proxy_pass speaks HTTP/1.0. */
function isHttp10(request: Pick<AccessRequest, "raw">): boolean {
  return request.raw?.httpVersion === "1.0";
}

/**
 * True when a loopback socket relays another client: a reverse proxy or tunnel
 * on this machine connects from 127.0.0.1 but announces itself with forwarding
 * headers. Such requests get the checks of a remote client, not loopback trust.
 */
export function isForwardedLoopbackRequest(request: AccessRequest): boolean {
  return isForwardedLoopbackPeer(isLoopbackIp(request.ip), isProxiedRequest(request), isLoopbackProxyAuthRequired());
}

/** True when the request comes from this machine itself rather than through a local proxy. */
export function isLoopbackRequest(request: AccessRequest): boolean {
  return isLoopbackIp(request.ip) && !isForwardedLoopbackRequest(request);
}

let bypassAnnounced = { tailscale: false, docker: false, dockerProxyForwarded: false, dockerAutoWithheld: false };

type DockerNetworkOverride = NonNullable<Parameters<typeof isTrustedInterfaceRequest>[1]>;

/** Resolve the request and runtime config into plain facts, then let the pure access policy decide. */
type AccessRequest = Pick<FastifyRequest, "headers" | "ip"> & Partial<Pick<FastifyRequest, "raw">>;

// Hooks ask several times per request; the facts (hostname, Docker matching) are not free.
const policyByRequest = new WeakMap<object, AccessPolicy>();

export function getAccessPolicy(request: AccessRequest, dockerNetwork?: DockerNetworkOverride): AccessPolicy {
  if (dockerNetwork) return computeAccessPolicy(request, dockerNetwork);
  let policy = policyByRequest.get(request);
  if (!policy) {
    policy = computeAccessPolicy(request, {});
    policyByRequest.set(request, policy);
  }
  return policy;
}

function computeAccessPolicy(request: AccessRequest, dockerNetwork: DockerNetworkOverride): AccessPolicy {
  const localAddress = request.raw?.socket?.localAddress;
  const defaultDockerNetwork = dockerNetwork.interfaces === undefined ? getDockerInterfaceSnapshot() : undefined;
  const dockerInterfaces = dockerNetwork.interfaces ?? defaultDockerNetwork!.interfaces;
  const parsedDockerCidrs = defaultDockerNetwork?.parsedCidrs;
  const dockerGatewayIp = dockerNetwork.gatewayIp === undefined ? dockerDefaultGatewayIp : dockerNetwork.gatewayIp;
  const dockerRuntimeMatch =
    isDockerRuntime() &&
    isDockerRuntimeNetworkIp(
      request.ip,
      dockerInterfaces,
      dockerGatewayIp,
      dockerNetwork.containerInterfaceNames ?? dockerContainerInterfaceNames,
      parsedDockerCidrs,
    );
  const ip = request.ip;
  return evaluateAccessPolicy({
    loopbackIp: isLoopbackIp(ip),
    forwardingHeaders: hasProxyForwardingHeaders(request),
    relayedHost: hasRelayedHost(request),
    http10: isHttp10(request),
    allowlisted: isInIpAllowlist(ip),
    privateNetworkIp: isPrivateNetworkIp(ip),
    tailscaleIp: isTailscaleIp(ip),
    tailscaleLocalAddress: typeof localAddress === "string" && isTailscaleIp(localAddress),
    dockerIp: isDockerIp(ip),
    dockerRuntimeMatch,
    dockerCompatibilityNetwork:
      isDockerRuntime() && isDockerCompatibilityNetworkIp(ip, dockerInterfaces, dockerGatewayIp, parsedDockerCidrs),
    config: getAccessConfig(),
  });
}

function getAccessConfig(): AccessFacts["config"] {
  const basicAuth = getBasicAuthConfig();
  return {
    basicAuthConfigured: Boolean(basicAuth.user && basicAuth.pass),
    ipAllowlistConfigured: getIpAllowlist() !== null,
    adminSecretConfigured: Boolean(getAdminSecret()),
    loopbackProxyAuthRequired: isLoopbackProxyAuthRequired(),
    dockerProxyAuthRequired: isDockerProxyAuthRequired(),
    tailscaleMode: getTailscaleBypassMode(),
    dockerMode: getDockerBypassMode(),
    allowUnauthenticatedPrivateNetwork: isUnauthenticatedPrivateNetworkAllowed(),
    allowUnauthenticatedRemote: isUnauthenticatedRemoteAllowed(),
  };
}

export type PasswordlessPeer = "internet" | "privateNetwork" | "allowlist" | "tailscale" | "docker" | "proxy";

/** True when a bind address is loopback only, so other devices reach it only through a local proxy. */
export function isLoopbackBind(host: string): boolean {
  return host === "localhost" || isLoopbackIp(host);
}

/** A peer with no facts set; each sample below overrides only what makes it that kind of device. */
const NO_PEER_FACTS: Omit<AccessFacts, "config"> = {
  loopbackIp: false,
  forwardingHeaders: false,
  relayedHost: false,
  http10: false,
  allowlisted: false,
  privateNetworkIp: false,
  tailscaleIp: false,
  tailscaleLocalAddress: false,
  dockerIp: false,
  dockerRuntimeMatch: false,
  dockerCompatibilityNetwork: false,
};

/**
 * Kinds of remote device the current configuration lets in without a password. Asks the same
 * policy the hooks use about one sample device per kind, so the owner summary cannot drift from
 * enforcement. `bindHost` is the address the server actually listens on. `withLogin` asks which
 * kinds would still get in once a login password is set.
 */
export function getPasswordlessPeers(
  bindHost: string,
  interfaces: ReturnType<typeof networkInterfaces> = networkInterfaces(),
  withLogin = false,
): PasswordlessPeer[] {
  const config = withLogin ? { ...getAccessConfig(), basicAuthConfigured: true } : getAccessConfig();
  const direct = !isLoopbackBind(bindHost);
  // A tailnet device connects directly only when the bind covers the tailnet address.
  const anyAddress = ["0.0.0.0", "::", ""].includes(bindHost);
  const tailscaleBind = anyAddress || isTailscaleIp(bindHost);
  const tailscaleHere =
    tailscaleBind &&
    (config.tailscaleMode === "enabled" ||
      Object.values(interfaces).some((addresses) => addresses?.some((a) => isTailscaleIp(a.address))));
  const dockerHere = config.dockerMode === "enabled" || isDockerRuntime();
  const samples: [PasswordlessPeer, Partial<AccessFacts>, boolean][] = [
    ["internet", {}, direct],
    ["privateNetwork", { privateNetworkIp: true }, direct],
    ["allowlist", { allowlisted: true }, direct && config.ipAllowlistConfigured],
    ["tailscale", { tailscaleIp: true, privateNetworkIp: true, tailscaleLocalAddress: true }, direct && tailscaleHere],
    // No relayed Host: the client picks the Host header, and `localhost` passes host validation.
    ["docker", { dockerIp: true, privateNetworkIp: true, dockerRuntimeMatch: isDockerRuntime() }, direct && dockerHere],
    // A remote device behind a local proxy names this server by its own address, so it looks relayed.
    // The proxy dials 127.0.0.1, which a bind to one LAN address does not listen on.
    ["proxy", { loopbackIp: true, forwardingHeaders: true, relayedHost: true }, !direct || anyAddress],
  ];
  return samples
    .filter(([, facts, reachable]) => {
      if (!reachable) return false;
      const policy = evaluateAccessPolicy({ ...NO_PEER_FACTS, ...facts, config });
      return !policy.authRequired && !policy.lockedDown && (!config.ipAllowlistConfigured || policy.ipAllowed);
    })
    .map(([peer]) => peer);
}

/** True when the request reached this server through a proxy or tunnel. */
export function isProxiedRequest(request: AccessRequest): boolean {
  return hasProxyForwardingHeaders(request) || hasRelayedHost(request) || isHttp10(request);
}

/** Log each automatic or explicit trust bypass once, the first time a peer takes it. */
function announceBypass(policy: AccessPolicy, ip: string): void {
  const tailscaleMode = getTailscaleBypassMode();
  const dockerMode = getDockerBypassMode();
  if (policy.dockerAutoWithheld && !bypassAnnounced.dockerAutoWithheld) {
    logger.warn(
      "[auth-bypass] Docker peer %s must pass Basic Auth/IP_ALLOWLIST: automatic Docker trust is off while either is configured, because Docker Desktop and OrbStack show LAN clients at the gateway address. Set BYPASS_AUTH_DOCKER=true only if every client of the published port is trusted.",
      ip,
    );
    bypassAnnounced.dockerAutoWithheld = true;
  }
  if (policy.dockerProxyForwarded && !isDockerProxyAuthRequired()) {
    if (!bypassAnnounced.dockerProxyForwarded) {
      logger.warn(
        "[auth-bypass] REQUIRE_AUTH_FOR_DOCKER_PROXY=false — forwarded Docker clients will skip Basic Auth and IP allowlist while Docker trust remains enabled",
      );
      bypassAnnounced.dockerProxyForwarded = true;
    }
  }
  if (policy.trustedInterface && policy.tailscaleTrusted) {
    if (!bypassAnnounced.tailscale) {
      logger.warn(
        tailscaleMode === "enabled"
          ? "[auth-bypass] BYPASS_AUTH_TAILSCALE=true — clients in 100.64.0.0/10 will skip Basic Auth and IP allowlist"
          : "[auth-bypass] Direct Tailscale connection detected — the peer and local socket are both in 100.64.0.0/10 and will skip Basic Auth and IP allowlist",
      );
      bypassAnnounced.tailscale = true;
    }
  }
  if (policy.trustedInterface && !policy.tailscaleTrusted) {
    if (!bypassAnnounced.docker) {
      logger.warn(
        dockerMode === "enabled"
          ? "[auth-bypass] BYPASS_AUTH_DOCKER=true — clients in 172.16.0.0/12 or this container's detected networks will skip Basic Auth and IP allowlist"
          : "[auth-bypass] Direct Docker connection detected — a peer on this container's network will skip Basic Auth and IP allowlist",
      );
      bypassAnnounced.docker = true;
    }
  }
}

/** getAccessPolicy for the hooks: also logs the bypass a non-loopback peer takes. */
export function getRequestAccess(request: Parameters<typeof getAccessPolicy>[0]): AccessPolicy {
  const policy = getAccessPolicy(request);
  if (!isLoopbackIp(request.ip)) announceBypass(policy, request.ip);
  return policy;
}

export function isTrustedInterfaceRequest(
  request: Pick<FastifyRequest, "headers" | "ip"> & Partial<Pick<FastifyRequest, "raw">>,
  dockerNetwork: {
    interfaces?: ReturnType<typeof networkInterfaces>;
    gatewayIp?: string | null;
    containerInterfaceNames?: ReadonlySet<string>;
  } = {},
): boolean {
  const policy = getAccessPolicy(request, dockerNetwork);
  announceBypass(policy, request.ip);
  return policy.trustedInterface;
}

// ── Fastify onRequest hook ──

export function ipAllowlistHook(request: FastifyRequest, reply: FastifyReply, done: () => void) {
  const allowlist = getAllowlist();

  // No allowlist configured → allow everything
  if (!allowlist) return done();

  const ip = request.ip;
  const bytes = ipToBytes(ip);

  // If we can't parse the IP, deny
  if (!bytes) {
    reply.status(403).send({ error: "Forbidden" });
    return;
  }

  // Loopback is allowed unless a local proxy relays another client; trusted
  // Tailscale / Docker peers are treated like loopback and skip the allowlist.
  const policy = getRequestAccess(request);
  if (policy.ipAllowed) return done();
  reply.status(403).send({ error: "Forbidden" });
}
