// The server's access decision lives in one pure policy. Pin what it says for each
// kind of peer so the owner-facing summary and the hooks can never disagree.
import assert from "node:assert/strict";
import os from "node:os";
import type { FastifyRequest } from "fastify";
import { getAccessPolicy, isNonRoutableNetworkIp } from "../../packages/server/src/middleware/ip-allowlist.js";

const ENV_KEYS = [
  "ADMIN_SECRET",
  "ALLOW_UNAUTHENTICATED_PRIVATE_NETWORK",
  "ALLOW_UNAUTHENTICATED_REMOTE",
  "BASIC_AUTH_PASS",
  "BASIC_AUTH_USER",
  "BYPASS_AUTH_DOCKER",
  "BYPASS_AUTH_TAILSCALE",
  "IP_ALLOWLIST",
  "IP_ALLOWLIST_ENABLED",
  "MARINARA_DOCKER",
  "REQUIRE_AUTH_FOR_DOCKER_PROXY",
  "REQUIRE_AUTH_FOR_LOOPBACK_PROXY",
  "TRUSTED_PRIVATE_NETWORKS",
] as const;
const originalEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));

const containerAddress = {
  address: "192.168.215.2",
  netmask: "255.255.255.0",
  family: "IPv4" as const,
  mac: "00:00:00:00:00:00",
  internal: false,
  cidr: "192.168.215.2/24",
};
const network = {
  interfaces: { eth0: [containerAddress] },
  gatewayIp: "192.168.215.1",
  containerInterfaceNames: new Set(["eth0"]),
};

function request(ip: string, headers: Record<string, string> = {}) {
  return {
    headers: { host: "127.0.0.1:7860", ...headers },
    ip,
    raw: { socket: { localAddress: "127.0.0.1" } },
  } as unknown as FastifyRequest;
}

function reset() {
  for (const key of ENV_KEYS) delete process.env[key];
}

try {
  reset();

  const plain = getAccessPolicy(request("127.0.0.1"));
  assert.equal(plain.local, true);
  assert.equal(plain.trustedPeer, true);
  assert.equal(plain.authRequired, false);
  assert.equal(plain.reason, "loopback");

  for (const headers of [{ "x-forwarded-for": "203.0.113.66" }, { host: "marinara.example.com" }]) {
    const relayed = getAccessPolicy(request("127.0.0.1", headers));
    assert.equal(relayed.forwardedLoopback, true, "a relayed loopback peer counts as remote");
    assert.equal(relayed.trustedPeer, false);
    assert.equal(relayed.ipAllowed, false);
    assert.equal(relayed.lockedDown, true);
    assert.equal(relayed.reason, "forwarded-loopback-locked");
  }

  process.env.REQUIRE_AUTH_FOR_LOOPBACK_PROXY = "false";
  assert.equal(getAccessPolicy(request("127.0.0.1", { "x-forwarded-for": "203.0.113.66" })).local, true);
  delete process.env.REQUIRE_AUTH_FOR_LOOPBACK_PROXY;

  assert.equal(getAccessPolicy(request("127.0.0.1", { host: `${os.hostname()}:7860` })).local, true, "own hostname");

  const http10 = (ip: string) =>
    ({
      ...request(ip),
      raw: { httpVersion: "1.0", socket: { localAddress: "127.0.0.1" } },
    }) as unknown as FastifyRequest;
  const nginx = getAccessPolicy(http10("127.0.0.1"));
  assert.equal(nginx.forwardedLoopback, true, "an HTTP/1.0 loopback request is a proxy relay");
  assert.equal(nginx.reason, "forwarded-loopback-locked");

  const lan = getAccessPolicy(request("192.168.1.50"));
  assert.equal(lan.trustedPeer, false);
  assert.equal(lan.lockedDown, true);
  assert.equal(lan.reason, "locked-down");
  process.env.ALLOW_UNAUTHENTICATED_PRIVATE_NETWORK = "true";
  const optIn = getAccessPolicy(request("192.168.1.50"));
  assert.equal(optIn.lockedDown, false);
  assert.equal(optIn.authRequired, false);
  assert.equal(optIn.reason, "private-network-optin");
  // An ISP's CGNAT peer is not a private-network peer unless the operator lists the range.
  assert.equal(getAccessPolicy(request("100.64.1.2")).lockedDown, true);
  // It still counts as non-routable, which CSRF literal-host trust and isReservedIp rely on.
  assert.equal(isNonRoutableNetworkIp("100.64.1.2"), true);
  process.env.TRUSTED_PRIVATE_NETWORKS = "100.64.0.0/10";
  assert.equal(getAccessPolicy(request("100.64.1.2")).reason, "private-network-optin");
  delete process.env.TRUSTED_PRIVATE_NETWORKS;
  delete process.env.ALLOW_UNAUTHENTICATED_PRIVATE_NETWORK;

  process.env.ALLOW_UNAUTHENTICATED_REMOTE = "true";
  const remoteOptIn = getAccessPolicy(request("198.51.100.1"));
  assert.equal(remoteOptIn.lockedDown, false);
  assert.equal(remoteOptIn.reason, "remote-optin");
  delete process.env.ALLOW_UNAUTHENTICATED_REMOTE;

  const tailnetAddress = {
    ...containerAddress,
    address: "100.100.10.20",
    netmask: "255.192.0.0",
    cidr: "100.100.10.20/10",
  };
  const tailnet = { interfaces: { tailscale0: [tailnetAddress] }, platform: "linux" as const };
  const tailscaleRequest = { ...request("100.64.0.42"), raw: { socket: { localAddress: "100.100.10.20" } } } as never;
  const tailscale = getAccessPolicy(tailscaleRequest, tailnet);
  assert.equal(tailscale.trustedInterface, true, "auto mode trusts a Tailscale peer on a Tailscale local address");
  assert.equal(tailscale.reason, "tailscale");
  // Mobile carriers hand out the same range, so the local address must sit on a Tailscale interface.
  const carrier = getAccessPolicy(tailscaleRequest, { interfaces: { rmnet0: [tailnetAddress] }, platform: "android" });
  assert.equal(carrier.trustedInterface, false, "a 100.64.0.0/10 address on mobile data is not a tailnet");
  assert.equal(carrier.reason, "locked-down");
  // macOS and Android give every VPN the same interface name, so Tailscale's IPv6 range has to be there too.
  const tailnetV6 = {
    ...containerAddress,
    address: "fd7a:115c:a1e0::1",
    netmask: "ffff:ffff:ffff::",
    family: "IPv6" as const,
    cidr: "fd7a:115c:a1e0::1/48",
    scopeid: 0,
  };
  for (const [platform, name, addresses, trusted] of [
    ["darwin", "utun4", [tailnetAddress, tailnetV6], true],
    ["darwin", "utun4", [tailnetAddress], false],
    ["darwin", "tailscale0", [tailnetAddress, tailnetV6], false],
    ["android", "tun0", [tailnetAddress, tailnetV6], true],
    ["android", "tun0", [tailnetAddress], false],
  ] as const) {
    const policy = getAccessPolicy(tailscaleRequest, { interfaces: { [name]: [...addresses] }, platform });
    assert.equal(policy.trustedInterface, trusted, `${platform} ${name} with ${addresses.length} address(es)`);
  }

  process.env.BASIC_AUTH_USER = "mari";
  process.env.BASIC_AUTH_PASS = "secret";
  process.env.ADMIN_SECRET = "admin";
  const authed = getAccessPolicy(request("192.168.1.50"));
  assert.equal(authed.authRequired, true);
  assert.equal(authed.basicAuthConfigured, true);
  assert.equal(authed.adminSecretConfigured, true);
  assert.equal(authed.lockedDown, false);
  assert.equal(authed.reason, "password-required");
  reset();

  process.env.IP_ALLOWLIST = "203.0.113.0/24";
  const listed = getAccessPolicy(request("203.0.113.9"));
  assert.equal(listed.allowlisted, true);
  assert.equal(listed.trustedPeer, true);
  assert.equal(listed.ipAllowed, true);
  assert.equal(listed.reason, "allowlisted");
  const unlisted = getAccessPolicy(request("198.51.100.1"));
  assert.equal(unlisted.ipAllowed, false);
  assert.equal(unlisted.trustedPeer, false);
  reset();

  // An IPv4 prefix above /32 is invalid, not an allow-everything entry.
  process.env.IP_ALLOWLIST = "0.0.0.0/33";
  assert.equal(getAccessPolicy(request("198.51.100.1")).ipAllowed, false);
  reset();

  process.env.MARINARA_DOCKER = "true";
  const gateway = getAccessPolicy(request("192.168.215.1"), network);
  assert.equal(gateway.trustedInterface, true);
  assert.equal(gateway.reason, "docker");
  const forwarded = getAccessPolicy(request("192.168.215.1", { "x-forwarded-for": "203.0.113.66" }), network);
  assert.equal(forwarded.trustedInterface, false, "a Docker proxy that forwards a client needs normal auth");
  assert.equal(forwarded.dockerProxyForwarded, true);
  const relayedHost = getAccessPolicy(request("192.168.215.1", { host: "marinara:7860" }), network);
  assert.equal(relayedHost.trustedInterface, false, "a gateway request with a relayed Host needs auth");
  assert.equal(relayedHost.dockerProxyForwarded, true);
  assert.equal(
    getAccessPolicy(http10("192.168.215.1"), network).trustedInterface,
    false,
    "an HTTP/1.0 gateway request needs auth",
  );

  process.env.REQUIRE_AUTH_FOR_DOCKER_PROXY = "false";
  assert.equal(
    getAccessPolicy(request("192.168.215.1", { "x-forwarded-for": "203.0.113.66" }), network).trustedInterface,
    true,
  );
  delete process.env.REQUIRE_AUTH_FOR_DOCKER_PROXY;
  process.env.BASIC_AUTH_USER = "mari";
  process.env.BASIC_AUTH_PASS = "secret";
  const tsRaw = { socket: { localAddress: "100.100.10.20" } };
  const tsPeer = (headers: Record<string, string>) =>
    getAccessPolicy({ ...request("100.64.0.42", headers), raw: tsRaw } as unknown as FastifyRequest, tailnet);
  assert.equal(tsPeer({}).trustedInterface, true, "a direct Tailscale peer stays passwordless");
  assert.equal(
    tsPeer({ "x-forwarded-for": "203.0.113.66" }).trustedInterface,
    false,
    "a forwarded Tailscale peer needs auth",
  );
  assert.equal(
    tsPeer({ host: "box.tail1234.ts.net:7860" }).trustedInterface,
    true,
    "a Host name alone does not end direct Tailscale trust",
  );
  process.env.REQUIRE_AUTH_FOR_DOCKER_PROXY = "false";
  assert.equal(
    tsPeer({ "x-forwarded-for": "203.0.113.66" }).trustedInterface,
    false,
    "REQUIRE_AUTH_FOR_DOCKER_PROXY=false does not restore trust for a forwarded Tailscale peer",
  );
  delete process.env.REQUIRE_AUTH_FOR_DOCKER_PROXY;

  const withheld = getAccessPolicy(request("192.168.215.1"), network);
  assert.equal(withheld.trustedInterface, false, "automatic Docker trust stands down once a password is set");
  assert.equal(withheld.dockerAutoWithheld, true);
  assert.equal(withheld.authRequired, true);
} finally {
  for (const key of ENV_KEYS) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
}

console.log("access-policy regression passed");
