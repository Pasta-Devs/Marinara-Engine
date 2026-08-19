import assert from "node:assert/strict";
import type { FastifyReply, FastifyRequest } from "fastify";
import { isDockerProxyAuthRequired } from "../../packages/server/src/config/runtime-config.js";
import { isBasicAuthSatisfied } from "../../packages/server/src/middleware/basic-auth.js";
import {
  ipAllowlistHook,
  isDockerRuntimeNetworkIp,
  isTrustedInterfaceRequest,
} from "../../packages/server/src/middleware/ip-allowlist.js";
import { requirePrivilegedAccess } from "../../packages/server/src/middleware/privileged-gate.js";

const ENV_KEYS = [
  "ADMIN_SECRET",
  "ALLOW_UNAUTHENTICATED_PRIVATE_NETWORK",
  "ALLOW_UNAUTHENTICATED_REMOTE",
  "BASIC_AUTH_PASS",
  "BASIC_AUTH_REALM",
  "BASIC_AUTH_USER",
  "BYPASS_AUTH_DOCKER",
  "BYPASS_AUTH_TAILSCALE",
  "CORS_ORIGINS",
  "CSRF_TRUSTED_ORIGINS",
  "HOST",
  "IP_ALLOWLIST",
  "IP_ALLOWLIST_ENABLED",
  "MARINARA_DOCKER",
  "MARINARA_REQUIRE_ADMIN_SECRET_ON_LOOPBACK",
  "REQUIRE_AUTH_FOR_DOCKER_PROXY",
  "TRUSTED_HOSTS",
] as const;

const originalEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));

function request(
  headers: Record<string, string | string[]> = {},
  ip = "172.17.0.2",
  localAddress = "172.17.0.3",
): FastifyRequest {
  return {
    headers: { host: "127.0.0.1:7860", ...headers },
    ip,
    raw: { socket: { localAddress } },
    url: "/api/security-regression",
  } as unknown as FastifyRequest;
}

function basicHeader(user = "mari", pass = "secret"): string {
  return `Basic ${Buffer.from(`${user}:${pass}`, "utf8").toString("base64")}`;
}

function replyRecorder(): {
  reply: FastifyReply;
  statusCode: () => number | null;
  payload: () => unknown;
} {
  let recordedStatus: number | null = null;
  let recordedPayload: unknown;
  const reply = {
    header() {
      return reply;
    },
    status(code: number) {
      recordedStatus = code;
      return reply;
    },
    send(payload: unknown) {
      recordedPayload = payload;
      return reply;
    },
  } as unknown as FastifyReply;
  return {
    reply,
    statusCode: () => recordedStatus,
    payload: () => recordedPayload,
  };
}

try {
  for (const key of ENV_KEYS) delete process.env[key];

  const dockerAddress = {
    address: "10.42.0.2",
    netmask: "255.255.255.0",
    family: "IPv4" as const,
    mac: "00:00:00:00:00:00",
    internal: false,
    cidr: "10.42.0.2/24",
  };
  const dockerInterfaces = { eth0: [dockerAddress] };
  const dockerContainerInterfaceNames = new Set(["eth0"]);

  assert.equal(isDockerRuntimeNetworkIp("10.42.0.99", dockerInterfaces, null, dockerContainerInterfaceNames), true);
  assert.equal(
    isDockerRuntimeNetworkIp("10.43.0.99", dockerInterfaces, null, dockerContainerInterfaceNames),
    false,
    "automatic Docker trust must not include an unrelated private network",
  );
  assert.equal(
    isDockerRuntimeNetworkIp("192.168.65.1", dockerInterfaces, "192.168.65.1", dockerContainerInterfaceNames),
    true,
    "the exact Docker gateway remains trusted outside the interface CIDR",
  );
  const hostNetworkInterfaces = {
    eth0: [{ ...dockerAddress, address: "192.168.1.10", cidr: "192.168.1.10/24" }],
  };
  assert.equal(
    isDockerRuntimeNetworkIp("192.168.1.44", hostNetworkInterfaces, null, new Set()),
    false,
    "a host-network LAN must not become automatically trusted without container-interface evidence",
  );
  assert.equal(
    isDockerRuntimeNetworkIp("192.168.1.1", hostNetworkInterfaces, "192.168.1.1", new Set()),
    false,
    "a host-network default gateway is not Docker-specific evidence",
  );

  assert.equal(
    isTrustedInterfaceRequest(request()),
    false,
    "a bare-metal 172.16/12 LAN must not be mistaken for Docker by default",
  );
  process.env.MARINARA_DOCKER = "true";
  assert.equal(
    isTrustedInterfaceRequest(request({}, "10.42.0.99", "10.42.0.2"), {
      interfaces: dockerInterfaces,
      gatewayIp: null,
      containerInterfaceNames: dockerContainerInterfaceNames,
    }),
    true,
    "a peer on the actual container network keeps the automatic bypass",
  );
  assert.equal(
    isTrustedInterfaceRequest(request({ "x-forwarded-for": "198.51.100.10" }, "10.42.0.99", "10.42.0.2"), {
      interfaces: dockerInterfaces,
      gatewayIp: null,
      containerInterfaceNames: dockerContainerInterfaceNames,
    }),
    false,
    "forwarding headers withhold automatic Docker trust",
  );
  assert.equal(
    isTrustedInterfaceRequest(request({}, "192.168.65.1", "10.42.0.2"), {
      interfaces: dockerInterfaces,
      gatewayIp: "192.168.65.1",
      containerInterfaceNames: dockerContainerInterfaceNames,
    }),
    true,
    "the exact detected Docker gateway keeps the automatic bypass",
  );
  assert.equal(
    isTrustedInterfaceRequest(request({}, "172.17.0.2", "10.42.0.2"), {
      interfaces: dockerInterfaces,
      gatewayIp: null,
    }),
    false,
    "automatic Docker trust must not include the whole conventional bridge range",
  );
  assert.equal(
    isTrustedInterfaceRequest(request({}, "192.168.1.44", "192.168.1.10"), {
      interfaces: hostNetworkInterfaces,
      gatewayIp: null,
      containerInterfaceNames: new Set(),
    }),
    false,
    "Docker host-network LAN traffic must authenticate in automatic mode",
  );
  process.env.BYPASS_AUTH_DOCKER = "true";
  assert.equal(
    isTrustedInterfaceRequest(request({}, "192.168.1.44", "192.168.1.10"), {
      interfaces: hostNetworkInterfaces,
      gatewayIp: null,
      containerInterfaceNames: new Set(),
    }),
    true,
    "the explicit Docker bypass retains compatibility for intentional host-network deployments",
  );
  delete process.env.BYPASS_AUTH_DOCKER;
  delete process.env.MARINARA_DOCKER;

  assert.equal(
    isTrustedInterfaceRequest(request({}, "100.64.0.42", "100.100.10.20")),
    true,
    "direct Tailscale traffic is trusted when both socket addresses are in the tailnet range",
  );
  assert.equal(
    isTrustedInterfaceRequest(request({}, "100.64.0.42", "192.168.1.20")),
    false,
    "a CGNAT-shaped peer arriving on a non-Tailscale socket is not trusted automatically",
  );
  process.env.BYPASS_AUTH_TAILSCALE = "true";
  assert.equal(
    isTrustedInterfaceRequest(request({}, "100.64.0.42", "192.168.1.20")),
    true,
    "the explicit Tailscale bypass keeps broad compatibility available",
  );
  process.env.BYPASS_AUTH_TAILSCALE = "false";
  assert.equal(
    isTrustedInterfaceRequest(request({}, "100.64.0.42", "100.100.10.20")),
    false,
    "operators can require authentication from Tailscale clients",
  );

  process.env.BYPASS_AUTH_DOCKER = "true";
  const direct = request();
  assert.equal(isDockerProxyAuthRequired(), true, "proxy-forwarded Docker auth must default on");
  assert.equal(isTrustedInterfaceRequest(direct), true, "direct Docker bridge traffic retains its bypass");

  const forwardingHeaders = [
    ["forwarded", "for=198.51.100.10;proto=https"],
    ["x-forwarded-for", "198.51.100.10"],
    ["x-real-ip", "198.51.100.10"],
    ["x-forwarded-host", "chat.example.com"],
    ["x-forwarded-proto", "https"],
  ] as const;
  for (const [header, value] of forwardingHeaders) {
    assert.equal(
      isTrustedInterfaceRequest(request({ [header]: value })),
      false,
      `${header} must withhold the Docker bypass by default`,
    );
  }

  process.env.REQUIRE_AUTH_FOR_DOCKER_PROXY = "false";
  assert.equal(isDockerProxyAuthRequired(), false);
  assert.equal(
    isTrustedInterfaceRequest(request({ "x-forwarded-for": "198.51.100.10" })),
    true,
    "the explicit legacy opt-out restores forwarded Docker trust",
  );

  delete process.env.REQUIRE_AUTH_FOR_DOCKER_PROXY;
  process.env.IP_ALLOWLIST = "192.0.2.10";
  let directAllowlistDone = false;
  ipAllowlistHook(direct, replyRecorder().reply, () => {
    directAllowlistDone = true;
  });
  assert.equal(directAllowlistDone, true, "direct Docker bridge traffic still bypasses the IP allowlist");

  const forwardedAllowlistReply = replyRecorder();
  let forwardedAllowlistDone = false;
  ipAllowlistHook(request({ "x-forwarded-for": "198.51.100.10" }), forwardedAllowlistReply.reply, () => {
    forwardedAllowlistDone = true;
  });
  assert.equal(forwardedAllowlistDone, false);
  assert.equal(forwardedAllowlistReply.statusCode(), 403, "forwarded Docker traffic must use the IP allowlist");

  process.env.BYPASS_AUTH_DOCKER = "false";
  process.env.IP_ALLOWLIST = "definitely-not-an-ip";
  const invalidAllowlistReply = replyRecorder();
  let invalidAllowlistDone = false;
  ipAllowlistHook(request({}, "192.0.2.44"), invalidAllowlistReply.reply, () => {
    invalidAllowlistDone = true;
  });
  assert.equal(invalidAllowlistDone, false, "an invalid non-empty allowlist must fail closed");
  assert.equal(invalidAllowlistReply.statusCode(), 403);

  let invalidAllowlistLoopbackDone = false;
  ipAllowlistHook(request({}, "127.0.0.1"), replyRecorder().reply, () => {
    invalidAllowlistLoopbackDone = true;
  });
  assert.equal(invalidAllowlistLoopbackDone, true, "loopback remains available after an allowlist typo");

  delete process.env.IP_ALLOWLIST;
  process.env.BYPASS_AUTH_DOCKER = "true";
  process.env.BASIC_AUTH_USER = "mari";
  process.env.BASIC_AUTH_PASS = "secret";
  const forwarded = request({ "x-forwarded-for": "198.51.100.10" });
  assert.equal(isBasicAuthSatisfied(forwarded), false, "Docker forwarding headers must not bypass Basic Auth");
  assert.equal(
    isBasicAuthSatisfied(
      request({
        authorization: basicHeader(),
        "x-forwarded-for": "198.51.100.10",
      }),
    ),
    true,
    "valid Basic Auth must still authorize forwarded Docker traffic",
  );

  process.env.ADMIN_SECRET = "admin-secret";
  const privilegedRejectedReply = replyRecorder();
  assert.equal(
    requirePrivilegedAccess(
      request({
        "x-admin-secret": "admin-secret",
        "x-forwarded-for": "198.51.100.10",
      }),
      privilegedRejectedReply.reply,
      { trustedNetwork: true, feature: "Security regression" },
    ),
    false,
    "the privileged gate must require normal auth before accepting the admin secret",
  );
  assert.equal(privilegedRejectedReply.statusCode(), 403);

  const capabilityWithoutBasicAuthReply = replyRecorder();
  assert.equal(
    requirePrivilegedAccess(
      request({
        "x-forwarded-for": "198.51.100.10",
      }),
      capabilityWithoutBasicAuthReply.reply,
      { oneTimeCapabilityAuthorized: true, feature: "Security regression" },
    ),
    false,
    "a one-time capability must not bypass normal Basic Auth",
  );
  assert.equal(capabilityWithoutBasicAuthReply.statusCode(), 403);

  const capabilityWithUntrustedHostReply = replyRecorder();
  assert.equal(
    requirePrivilegedAccess(
      request({
        authorization: basicHeader(),
        host: "attacker.example",
        "x-forwarded-for": "198.51.100.10",
      }),
      capabilityWithUntrustedHostReply.reply,
      { oneTimeCapabilityAuthorized: true, feature: "Security regression" },
    ),
    false,
    "a one-time capability must not bypass trusted-host validation",
  );
  assert.equal(capabilityWithUntrustedHostReply.statusCode(), 421);

  const capabilityAllowedReply = replyRecorder();
  assert.equal(
    requirePrivilegedAccess(
      request({
        authorization: basicHeader(),
        "x-forwarded-for": "198.51.100.10",
      }),
      capabilityAllowedReply.reply,
      { oneTimeCapabilityAuthorized: true, feature: "Security regression" },
    ),
    true,
    "a verified one-time capability may replace the reusable admin secret after normal auth",
  );

  const privilegedAllowedReply = replyRecorder();
  assert.equal(
    requirePrivilegedAccess(
      request({
        authorization: basicHeader(),
        "x-admin-secret": "admin-secret",
        "x-forwarded-for": "198.51.100.10",
      }),
      privilegedAllowedReply.reply,
      { trustedNetwork: true, feature: "Security regression" },
    ),
    true,
    "forwarded Docker traffic with Basic Auth and the admin secret may use privileged APIs",
  );

  delete process.env.BASIC_AUTH_USER;
  delete process.env.BASIC_AUTH_PASS;
  delete process.env.ADMIN_SECRET;
  process.env.BYPASS_AUTH_DOCKER = "false";
  process.env.IP_ALLOWLIST = "172.17.0.2";
  const professorStyleReply = replyRecorder();
  assert.equal(
    requirePrivilegedAccess(request(), professorStyleReply.reply, {
      feature: "Professor Mari workspace",
    }),
    false,
    "non-loopback workspace access must require ADMIN_SECRET even from an allowlisted client",
  );
  assert.equal(professorStyleReply.statusCode(), 403);

  console.info("Docker proxy authentication regressions passed.");
} finally {
  for (const key of ENV_KEYS) {
    const value = originalEnv[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}
