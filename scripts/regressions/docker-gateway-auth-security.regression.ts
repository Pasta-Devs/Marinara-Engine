// Docker Desktop, OrbStack and rootless Docker re-create every published-port
// connection inside their VM, so a container sees phones and other LAN devices
// arriving from the same gateway address as the host's own browser. Automatic
// Docker trust therefore cannot tell those clients apart. It may stand in for
// the no-password lockdown, but it must never override a Basic Auth password
// or IP allowlist the operator configured. The explicit BYPASS_AUTH_DOCKER=true
// compatibility switch keeps its documented meaning.
import assert from "node:assert/strict";
import type { FastifyRequest } from "fastify";
import { isTrustedInterfaceRequest } from "../../packages/server/src/middleware/ip-allowlist.js";

const ENV_KEYS = [
  "BASIC_AUTH_PASS",
  "BASIC_AUTH_USER",
  "BYPASS_AUTH_DOCKER",
  "BYPASS_AUTH_TAILSCALE",
  "IP_ALLOWLIST",
  "IP_ALLOWLIST_ENABLED",
  "MARINARA_DOCKER",
  "REQUIRE_AUTH_FOR_DOCKER_PROXY",
] as const;
const originalEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));

// OrbStack's bridge: the container is 192.168.215.2/24 and every published-port
// client, local or not, arrives from the gateway 192.168.215.1.
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

function request(ip: string): FastifyRequest {
  return {
    headers: { host: "192.168.1.91:7860" },
    ip,
    raw: { socket: { localAddress: "192.168.215.2" } },
    url: "/api/chats",
  } as unknown as FastifyRequest;
}

try {
  for (const key of ENV_KEYS) delete process.env[key];
  process.env.MARINARA_DOCKER = "true";

  assert.equal(
    isTrustedInterfaceRequest(request("192.168.215.1"), network),
    true,
    "without configured access control the gateway still replaces the lockdown for the local compose setup",
  );
  assert.equal(isTrustedInterfaceRequest(request("192.168.215.7"), network), true);

  process.env.BASIC_AUTH_USER = "mari";
  process.env.BASIC_AUTH_PASS = "secret";
  assert.equal(
    isTrustedInterfaceRequest(request("192.168.215.1"), network),
    false,
    "a configured Basic Auth password must apply to clients relayed through the Docker gateway",
  );
  assert.equal(
    isTrustedInterfaceRequest(request("192.168.215.7"), network),
    false,
    "automatic Docker trust must not override a configured password through the container subnet either",
  );
  process.env.BYPASS_AUTH_DOCKER = "true";
  assert.equal(
    isTrustedInterfaceRequest(request("192.168.215.1"), network),
    true,
    "the explicit BYPASS_AUTH_DOCKER=true compatibility switch keeps its meaning",
  );
  delete process.env.BYPASS_AUTH_DOCKER;
  delete process.env.BASIC_AUTH_USER;
  delete process.env.BASIC_AUTH_PASS;

  process.env.IP_ALLOWLIST = "192.0.2.10";
  assert.equal(
    isTrustedInterfaceRequest(request("192.168.215.1"), network),
    false,
    "a configured IP allowlist must apply to clients relayed through the Docker gateway",
  );
  process.env.IP_ALLOWLIST_ENABLED = "false";
  assert.equal(
    isTrustedInterfaceRequest(request("192.168.215.1"), network),
    true,
    "a paused allowlist does not count as configured access control",
  );

  console.info("Docker gateway authentication regressions passed.");
} finally {
  for (const key of ENV_KEYS) {
    const value = originalEnv[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}
