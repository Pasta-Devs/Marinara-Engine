// ──────────────────────────────────────────────
// Access policy: the one pure place that decides who a request counts as
// ──────────────────────────────────────────────
// Takes plain facts about the request and the configuration (resolved by
// getAccessPolicy in ip-allowlist.ts) and returns plain data. No Fastify types,
// no env reads, no logging, so the same decision can be shown to the owner.

export type TriBypassMode = "auto" | "enabled" | "disabled";

export interface AccessFacts {
  /** Peer address is in 127.0.0.0/8 or ::1. */
  loopbackIp: boolean;
  /** Request carries reverse-proxy forwarding headers. */
  forwardingHeaders: boolean;
  /** The Host header names another client-facing host (loopback or Docker peer). */
  relayedHost: boolean;
  /** Request arrived over HTTP/1.0, which browsers never use but default reverse proxies do. */
  http10: boolean;
  /** Peer address is in the active IP_ALLOWLIST. */
  allowlisted: boolean;
  /** Peer is in a trusted private / non-routable range. */
  privateNetworkIp: boolean;
  /** Peer address is in 100.64.0.0/10. */
  tailscaleIp: boolean;
  /** The local socket address the peer connected to is in 100.64.0.0/10. */
  tailscaleLocalAddress: boolean;
  /** Peer address is in 172.16.0.0/12. */
  dockerIp: boolean;
  /** Peer matches this container's own networks or default gateway. */
  dockerRuntimeMatch: boolean;
  /** Running in Docker and the peer is in a Docker compatibility network. */
  dockerCompatibilityNetwork: boolean;
  config: {
    basicAuthConfigured: boolean;
    ipAllowlistConfigured: boolean;
    adminSecretConfigured: boolean;
    loopbackProxyAuthRequired: boolean;
    dockerProxyAuthRequired: boolean;
    tailscaleMode: TriBypassMode;
    dockerMode: TriBypassMode;
    allowUnauthenticatedPrivateNetwork: boolean;
    allowUnauthenticatedRemote: boolean;
  };
}

export type AccessReason =
  | "loopback"
  | "allowlisted"
  | "tailscale"
  | "docker"
  | "private-network-optin"
  | "remote-optin"
  | "password-required"
  | "forwarded-loopback-locked"
  | "locked-down";

export interface AccessPolicy {
  /** Loopback peer that relays a remote client: treated as remote. */
  forwardedLoopback: boolean;
  /** Real loopback peer, not a proxy relay. */
  local: boolean;
  /** Trusted Tailscale or Docker peer (bypass flags). */
  trustedInterface: boolean;
  /** Skips Basic Auth entirely: loopback, allowlisted or trusted interface. */
  trustedPeer: boolean;
  /** Peer address is in the active IP_ALLOWLIST. */
  allowlisted: boolean;
  /** IP_ALLOWLIST lets this peer through. */
  ipAllowed: boolean;
  /** Basic Auth password required for this request. */
  authRequired: boolean;
  /** Request is refused outright: no credentials configured and no opt-in. */
  lockedDown: boolean;
  basicAuthConfigured: boolean;
  adminSecretConfigured: boolean;
  /** Announcement hints for the caller to log once. */
  tailscaleTrusted: boolean;
  dockerAutoWithheld: boolean;
  dockerProxyForwarded: boolean;
  reason: AccessReason;
}

/** A loopback peer that relays a remote client (forwarding headers, relayed Host or HTTP/1.0) counts as remote. */
export function isForwardedLoopbackPeer(loopbackIp: boolean, relayed: boolean, proxyAuthRequired: boolean): boolean {
  return loopbackIp && relayed && proxyAuthRequired;
}

export function evaluateAccessPolicy(f: AccessFacts): AccessPolicy {
  const { config } = f;
  const proxied = f.forwardingHeaders || f.relayedHost || f.http10;
  const forwardedLoopback = isForwardedLoopbackPeer(f.loopbackIp, proxied, config.loopbackProxyAuthRequired);
  const local = f.loopbackIp && !forwardedLoopback;

  // Docker Desktop and OrbStack show LAN clients at the gateway address, so
  // automatic Docker trust stands down once a password or allowlist is set.
  const accessControlConfigured = config.basicAuthConfigured || config.ipAllowlistConfigured;
  const dockerAutoWithheld = config.dockerMode === "auto" && f.dockerRuntimeMatch && accessControlConfigured;
  const dockerTrusted =
    config.dockerMode === "enabled"
      ? f.dockerIp || f.dockerRuntimeMatch || f.dockerCompatibilityNetwork
      : config.dockerMode === "auto" && f.dockerRuntimeMatch && !dockerAutoWithheld;
  const dockerProxyForwarded = dockerTrusted && proxied;
  const tailscaleTrusted =
    f.tailscaleIp &&
    (config.tailscaleMode === "enabled" || (config.tailscaleMode === "auto" && f.tailscaleLocalAddress));
  // Forwarding headers on a Tailscale peer mean a proxy relays another client.
  const tailscaleProxyForwarded = tailscaleTrusted && f.forwardingHeaders;
  const trustedInterface =
    (dockerProxyForwarded && config.dockerProxyAuthRequired) || tailscaleProxyForwarded
      ? false
      : tailscaleTrusted || dockerTrusted;

  const trustedPeer = !forwardedLoopback && (f.loopbackIp || f.allowlisted || trustedInterface);
  const openAccess =
    !trustedPeer &&
    !config.basicAuthConfigured &&
    ((f.privateNetworkIp && config.allowUnauthenticatedPrivateNetwork) || config.allowUnauthenticatedRemote);
  const lockedDown = !trustedPeer && !config.basicAuthConfigured && !openAccess;

  const reason: AccessReason = forwardedLoopback
    ? lockedDown
      ? "forwarded-loopback-locked"
      : config.basicAuthConfigured
        ? "password-required"
        : "remote-optin"
    : f.loopbackIp
      ? "loopback"
      : f.allowlisted
        ? "allowlisted"
        : trustedInterface
          ? tailscaleTrusted
            ? "tailscale"
            : "docker"
          : lockedDown
            ? "locked-down"
            : openAccess
              ? f.privateNetworkIp && config.allowUnauthenticatedPrivateNetwork
                ? "private-network-optin"
                : "remote-optin"
              : "password-required";

  return {
    forwardedLoopback,
    local,
    trustedInterface,
    trustedPeer,
    allowlisted: f.allowlisted,
    // A loopback peer passes unless it relays a remote client.
    ipAllowed: f.loopbackIp ? !forwardedLoopback : trustedInterface || f.allowlisted,
    authRequired: !trustedPeer && !openAccess && config.basicAuthConfigured,
    lockedDown,
    basicAuthConfigured: config.basicAuthConfigured,
    adminSecretConfigured: config.adminSecretConfigured,
    tailscaleTrusted,
    dockerAutoWithheld,
    dockerProxyForwarded,
    reason,
  };
}
