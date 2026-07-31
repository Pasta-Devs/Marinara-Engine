import assert from "node:assert/strict";
import type { FastifyReply, FastifyRequest } from "fastify";
import { isDockerProxyAuthRequired } from "../../packages/server/src/config/runtime-config.js";
import { isBasicAuthSatisfied } from "../../packages/server/src/middleware/basic-auth.js";
import {
  ipAllowlistHook,
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
  "IP_ALLOWLIST",
  "IP_ALLOWLIST_ENABLED",
  "MARINARA_REQUIRE_ADMIN_SECRET_ON_LOOPBACK",
  "REQUIRE_AUTH_FOR_DOCKER_PROXY",
] as const;

const originalEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));

function request(headers: Record<string, string | string[]> = {}): FastifyRequest {
  return {
    headers: { host: "127.0.0.1:7860", ...headers },
    ip: "172.17.0.2",
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
  ipAllowlistHook(
    request({ "x-forwarded-for": "198.51.100.10" }),
    forwardedAllowlistReply.reply,
    () => {
      forwardedAllowlistDone = true;
    },
  );
  assert.equal(forwardedAllowlistDone, false);
  assert.equal(forwardedAllowlistReply.statusCode(), 403, "forwarded Docker traffic must use the IP allowlist");

  delete process.env.IP_ALLOWLIST;
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

  console.info("Docker proxy authentication regressions passed.");
} finally {
  for (const key of ENV_KEYS) {
    const value = originalEnv[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}
