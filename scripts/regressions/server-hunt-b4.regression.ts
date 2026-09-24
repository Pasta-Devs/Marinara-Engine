import assert from "node:assert/strict";
import Fastify from "../../packages/server/node_modules/fastify/fastify.js";

process.env.LOG_LEVEL = "silent";
delete process.env.IP_ALLOWLIST_ENABLED;
delete process.env.MARINARA_E2E_DISABLE_RATE_LIMIT;

const { isInIpAllowlist, isLocalInferenceBaseUrl } = await import(
  "../../packages/server/src/middleware/ip-allowlist.js"
);
const { UTILITY_SIDECAR_RATE_LIMIT, BACKUP_RATE_LIMIT, rateLimitHook, resetRateLimitBucketsForTests } = await import(
  "../../packages/server/src/middleware/rate-limit.js"
);

// 1. An IPv4 CIDR with a prefix over 32 is invalid and must not open the allowlist.
process.env.IP_ALLOWLIST = "192.168.1.10/33";
assert.equal(isInIpAllowlist("8.8.8.8"), false, "IPv4 /33 entry is rejected, not matched by every client");
assert.equal(isInIpAllowlist("192.168.1.10"), false, "invalid entry is ignored entirely");
process.env.IP_ALLOWLIST = "192.168.1.10/33, 10.0.0.0/8";
assert.equal(isInIpAllowlist("10.1.2.3"), true, "valid sibling entries still apply");
assert.equal(isInIpAllowlist("8.8.8.8"), false, "invalid sibling does not widen the list");
process.env.IP_ALLOWLIST = "192.168.1.0/24";
assert.equal(isInIpAllowlist("192.168.1.77"), true, "valid IPv4 /24 still matches");
assert.equal(isInIpAllowlist("192.168.2.1"), false, "valid IPv4 /24 still excludes others");
process.env.IP_ALLOWLIST = "192.168.1.5/32";
assert.equal(isInIpAllowlist("192.168.1.5"), true, "IPv4 /32 still matches its host");
assert.equal(isInIpAllowlist("192.168.1.6"), false);
delete process.env.IP_ALLOWLIST;

// 2. Public IPv6 literals are not local inference hosts; private and loopback ones are.
assert.equal(isLocalInferenceBaseUrl("https://[2606:4700::1111]/v1"), false, "public IPv6 literal is remote");
assert.equal(isLocalInferenceBaseUrl("http://[fd00::5]/v1"), true, "ULA IPv6 literal is local");
assert.equal(isLocalInferenceBaseUrl("http://[::1]:5001/v1"), true, "IPv6 loopback is local");
assert.equal(isLocalInferenceBaseUrl("http://mybox:5001/v1"), true, "dotless hostname still local");
assert.equal(isLocalInferenceBaseUrl("http://192.168.1.4:5001/v1"), true);
assert.equal(isLocalInferenceBaseUrl("https://api.example.com/v1"), false);

// 3. Per-route config.rateLimit is enforced when no ROUTE_RULES pattern matches.
const app = Fastify();
app.addHook("onRequest", rateLimitHook);
app.post("/api/utility-sidecar/start", { config: { rateLimit: UTILITY_SIDECAR_RATE_LIMIT } }, async () => ({ ok: true }));
app.get("/api/utility-sidecar/status", { config: { rateLimit: UTILITY_SIDECAR_RATE_LIMIT } }, async () => ({ ok: true }));
app.get("/api/plain", async () => ({ ok: true }));
app.post("/api/backup", { config: { rateLimit: BACKUP_RATE_LIMIT } }, async () => ({ ok: true }));

try {
  resetRateLimitBucketsForTests();
  for (let i = 0; i < UTILITY_SIDECAR_RATE_LIMIT.max; i += 1) {
    const res = await app.inject({ method: "POST", url: "/api/utility-sidecar/start" });
    assert.equal(res.statusCode, 200, `start request ${i + 1} within declared limit`);
    assert.equal(res.headers["ratelimit-limit"], String(UTILITY_SIDECAR_RATE_LIMIT.max));
  }
  const rejected = await app.inject({ method: "POST", url: "/api/utility-sidecar/start" });
  assert.equal(rejected.statusCode, 429, "declared per-route limit is enforced");

  const otherRoute = await app.inject({ method: "GET", url: "/api/utility-sidecar/status" });
  assert.equal(otherRoute.statusCode, 200, "each declared route has its own bucket");

  const plain = await app.inject({ method: "GET", url: "/api/plain" });
  assert.equal(plain.statusCode, 200);
  assert.equal(plain.headers["ratelimit-limit"], "600", "routes without config keep the default rule");

  const unknown = await app.inject({ method: "GET", url: "/api/does-not-exist" });
  assert.equal(unknown.statusCode, 404, "unmatched routes still fall through to 404");
} finally {
  await app.close();
  resetRateLimitBucketsForTests();
}

console.info("server-hunt-b4 regression passed.");
