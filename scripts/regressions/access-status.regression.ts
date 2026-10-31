// The owner-only access status: anonymous remote and proxied callers learn nothing, the
// owner gets configuration facts without secret values, and the "who gets in without a
// password" list follows the same policy the hooks enforce.
import assert from "node:assert/strict";
import type { NetworkInterfaceInfo } from "node:os";
import Fastify from "../../packages/server/node_modules/fastify/fastify.js";
import { dockerTrustWarning, getPasswordlessPeers } from "../../packages/server/src/middleware/ip-allowlist.js";
import { accessStatusRoutes } from "../../packages/server/src/routes/access-status.routes.js";

const ENV_KEYS = [
  "ADMIN_SECRET",
  "ALLOW_UNAUTHENTICATED_PRIVATE_NETWORK",
  "ALLOW_UNAUTHENTICATED_REMOTE",
  "BASIC_AUTH_PASS",
  "BASIC_AUTH_USER",
  "BYPASS_AUTH_DOCKER",
  "BYPASS_AUTH_TAILSCALE",
  "HOST",
  "IP_ALLOWLIST",
  "MARINARA_DOCKER",
  "MARINARA_DOCKER_GROUP",
  "MARINARA_DOCKER_USER",
  "MARINARA_REQUIRE_ADMIN_SECRET_ON_LOOPBACK",
  "REQUIRE_AUTH_FOR_DOCKER_PROXY",
  "REQUIRE_AUTH_FOR_LOOPBACK_PROXY",
  "TRUSTED_AUTH_PROXY",
] as const;
type Env = Partial<Record<(typeof ENV_KEYS)[number], string>>;
const originalEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
const SECRETS = { BASIC_AUTH_PASS: "pass-value-must-not-leak", ADMIN_SECRET: "admin-value-must-not-leak" };
const LOGIN = { BASIC_AUTH_USER: "owner", ...SECRETS };

function setEnv(values: Env) {
  for (const key of ENV_KEYS) delete process.env[key];
  Object.assign(process.env, values);
}

const tailnetAddress: NetworkInterfaceInfo = {
  address: "100.101.102.103",
  netmask: "255.192.0.0",
  family: "IPv4",
  mac: "00:00:00:00:00:00",
  internal: false,
  cidr: "100.101.102.103/10",
};
const NO_TAILNET = {};
const TAILNET = { tailscale0: [tailnetAddress] };

const app = Fastify();
await app.register(accessStatusRoutes, { prefix: "/api/access" });
await app.listen({ host: "127.0.0.1", port: 0 });

const status = (remoteAddress: string, headers: Record<string, string> = {}) =>
  app.inject({
    method: "GET",
    url: "/api/access/status",
    remoteAddress,
    headers: { host: "127.0.0.1:7860", ...headers },
  });

try {
  // Owner on loopback: facts only, never the values behind them. HOST edited after start
  // does not move the real bind.
  setEnv({ ...LOGIN, HOST: "0.0.0.0", IP_ALLOWLIST: "192.168.1.0/24", TRUSTED_AUTH_PROXY: "192.168.1.5" });
  const owner = await status("127.0.0.1");
  assert.equal(owner.statusCode, 200);
  assert.deepEqual(owner.json(), {
    loopbackOnly: true,
    host: "127.0.0.1",
    basicAuth: true,
    loginSource: "env",
    loginUser: "owner",
    adminSecret: true,
    allowlist: true,
    trustedAuthProxy: true,
    passwordlessPeers: [],
    loginKeepsOpen: [],
    viaProxy: false,
    needsCurrentPassword: false,
  });
  for (const secret of Object.values(SECRETS)) assert.ok(!owner.body.includes(secret), "status must not leak secrets");

  // Anonymous remote, proxied, and remote-with-password-but-no-admin-secret callers are refused.
  assert.equal((await status("203.0.113.5")).statusCode, 403);
  assert.equal((await status("127.0.0.1", { "x-forwarded-for": "203.0.113.5" })).statusCode, 403);
  const basic = `Basic ${Buffer.from(`owner:${SECRETS.BASIC_AUTH_PASS}`).toString("base64")}`;
  const refused = await status("192.168.1.20", { authorization: basic });
  assert.equal(refused.statusCode, 403);
  assert.ok(!refused.body.includes("passwordlessPeers"), "refused callers learn nothing about the posture");

  // An open install: a remote visitor without the admin secret still learns nothing.
  setEnv({ ALLOW_UNAUTHENTICATED_REMOTE: "true", ADMIN_SECRET: SECRETS.ADMIN_SECRET });
  assert.equal((await status("203.0.113.5")).statusCode, 403);
  // The owner reaching a loopback-only install through a proxy with the admin secret: only the proxy is a way in.
  const proxied = await status("127.0.0.1", {
    "x-forwarded-for": "203.0.113.5",
    "x-admin-secret": SECRETS.ADMIN_SECRET,
  });
  assert.equal(proxied.statusCode, 200);
  assert.deepEqual(proxied.json().passwordlessPeers, ["proxy"]);
  assert.equal(proxied.json().viaProxy, true);
  // A LAN visitor names this server's own address; that Host alone is not a proxy.
  const direct = await status("192.168.1.20", {
    host: "192.168.1.10:7860",
    "x-admin-secret": SECRETS.ADMIN_SECRET,
  });
  assert.equal(direct.statusCode, 200);
  assert.equal(direct.json().viaProxy, false, "a direct LAN visitor is not shown as proxied");

  // A plain loopback-only native install lets nobody else in, and never lists LAN or internet kinds.
  const loopbackPeers = async (env: Env) => {
    setEnv(env);
    return (await status("127.0.0.1")).json().passwordlessPeers;
  };
  assert.deepEqual(await loopbackPeers({}), []);
  assert.deepEqual(await loopbackPeers({ ALLOW_UNAUTHENTICATED_PRIVATE_NETWORK: "true" }), []);
  assert.deepEqual(await loopbackPeers({ BYPASS_AUTH_TAILSCALE: "true", MARINARA_DOCKER: "true" }), []);
  assert.deepEqual(await loopbackPeers({ ALLOW_UNAUTHENTICATED_REMOTE: "true" }), ["proxy"]);
  assert.deepEqual(await loopbackPeers({ REQUIRE_AUTH_FOR_LOOPBACK_PROXY: "false" }), ["proxy"]);
  assert.deepEqual(
    await loopbackPeers({ TRUSTED_AUTH_PROXY: "127.0.0.1" }),
    ["proxy"],
    "a same-host login proxy is listed",
  );

  // Bound to every interface: the list follows the enforced policy for a remote device of each kind.
  const networkPeers = (env: Env, interfaces: Record<string, NetworkInterfaceInfo[]> = NO_TAILNET) => {
    setEnv(env);
    return getPasswordlessPeers("0.0.0.0", interfaces, false, "linux");
  };
  assert.deepEqual(networkPeers({}), []);
  assert.deepEqual(
    networkPeers({ TRUSTED_AUTH_PROXY: "192.168.1.5" }),
    ["proxy"],
    "a single proxy address opens no network, but its visitors are listed",
  );
  assert.deepEqual(
    networkPeers({ TRUSTED_AUTH_PROXY: "192.168.1.0/24" }),
    ["privateNetwork"],
    "a proxy range is listed",
  );
  assert.deepEqual(networkPeers({ ALLOW_UNAUTHENTICATED_PRIVATE_NETWORK: "true" }), ["privateNetwork"]);
  assert.deepEqual(networkPeers({ ALLOW_UNAUTHENTICATED_REMOTE: "true" }), ["internet", "privateNetwork", "proxy"]);
  // Direct Tailscale peers are trusted automatically once this machine is on a tailnet.
  assert.deepEqual(networkPeers({}, TAILNET), ["tailscale"]);
  assert.deepEqual(networkPeers({ BYPASS_AUTH_TAILSCALE: "true" }), ["tailscale"]);
  assert.deepEqual(networkPeers({ BYPASS_AUTH_TAILSCALE: "false" }, TAILNET), []);
  // Bound to one LAN address, the tailnet interface is not listening.
  setEnv({});
  assert.deepEqual(getPasswordlessPeers("192.168.1.5", TAILNET), []);
  // A local proxy dials 127.0.0.1, which that bind does not listen on.
  setEnv({ ALLOW_UNAUTHENTICATED_REMOTE: "true" });
  assert.deepEqual(getPasswordlessPeers("192.168.1.5", NO_TAILNET), ["internet", "privateNetwork"]);
  // A default Docker install trusts gateway peers until a login or allowlist is set.
  assert.deepEqual(networkPeers({ MARINARA_DOCKER: "true" }), ["docker"]);
  assert.deepEqual(networkPeers({ MARINARA_DOCKER: "true", ...LOGIN }), []);
  // The startup log names the Docker gateway risk only while that trust is active.
  assert.match(dockerTrustWarning(networkPeers({ MARINARA_DOCKER: "true" }))!, /127\.0\.0\.1/);
  assert.equal(dockerTrustWarning(networkPeers({ MARINARA_DOCKER: "true", ...LOGIN })), null);
  assert.deepEqual(networkPeers({ BYPASS_AUTH_DOCKER: "true" }), ["docker"]);
  // The forced bypass survives a login, so its warning must not advise setting one.
  assert.match(
    dockerTrustWarning(networkPeers({ BYPASS_AUTH_DOCKER: "true", ...LOGIN }))!,
    /or remove BYPASS_AUTH_DOCKER=true before/,
  );
  // Without a login, auto mode would keep the trust after the flag is removed.
  assert.match(
    dockerTrustWarning(networkPeers({ BYPASS_AUTH_DOCKER: "true" }))!,
    /remove BYPASS_AUTH_DOCKER=true and set a login before/,
  );
  // A password wins over the unauthenticated opt-ins; an allowlist keeps everyone else out,
  // but its own devices always skip the password.
  assert.deepEqual(networkPeers({ ALLOW_UNAUTHENTICATED_REMOTE: "true", ...LOGIN }), []);
  assert.deepEqual(networkPeers({ ALLOW_UNAUTHENTICATED_REMOTE: "true", IP_ALLOWLIST: "192.168.1.0/24" }), [
    "allowlist",
  ]);
  assert.deepEqual(networkPeers({ IP_ALLOWLIST: "192.168.1.0/24", ...LOGIN }), ["allowlist"]);
  // A broad allowlist is the open internet in practice; private, CGNAT and small public ranges are not.
  assert.deepEqual(networkPeers({ IP_ALLOWLIST: "0.0.0.0/0" }), ["internet", "allowlist"]);
  assert.deepEqual(networkPeers({ IP_ALLOWLIST: "::/0" }), ["internet", "allowlist"]);
  // IPv6 entries that cover the whole IPv4-mapped block admit every IPv4 peer.
  for (const range of ["::/64", "::ffff:0.0.0.0/80", "::ffff:0:0/96"]) {
    assert.deepEqual(networkPeers({ IP_ALLOWLIST: range }), ["internet", "allowlist"], range);
  }
  for (const range of ["10.0.0.0/8", "203.0.113.0/24", "100.64.0.0/10"]) {
    assert.deepEqual(networkPeers({ IP_ALLOWLIST: range }), ["allowlist"], range);
  }

  // The remedy split: a login closes opt-in and auto-Docker peers, never allowlisted or trusted ones.
  const peersAfterLogin = (env: Env, interfaces: Record<string, NetworkInterfaceInfo[]> = NO_TAILNET) => {
    setEnv(env);
    return getPasswordlessPeers("0.0.0.0", interfaces, true, "linux");
  };
  assert.deepEqual(peersAfterLogin({ ALLOW_UNAUTHENTICATED_REMOTE: "true", MARINARA_DOCKER: "true" }), []);
  assert.deepEqual(peersAfterLogin({ ALLOW_UNAUTHENTICATED_REMOTE: "true", IP_ALLOWLIST: "192.168.1.0/24" }), [
    "allowlist",
  ]);
  assert.deepEqual(peersAfterLogin({ BYPASS_AUTH_DOCKER: "true" }), ["docker"]);
  assert.deepEqual(peersAfterLogin({}, TAILNET), ["tailscale"]);
  assert.deepEqual(peersAfterLogin({ REQUIRE_AUTH_FOR_LOOPBACK_PROXY: "false" }), ["proxy"]);
} finally {
  await app.close();
  for (const key of ENV_KEYS) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
}

console.log("access-status regression passed");
