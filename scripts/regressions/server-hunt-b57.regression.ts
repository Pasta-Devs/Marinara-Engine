import assert from "node:assert/strict";
import { promises as dns } from "node:dns";

process.env.LOG_LEVEL = "silent";

const { safeFetch, validateOutboundUrl } = await import("../../packages/server/src/utils/security.js");

// 1. SSRF blocking of private ranges must not depend on the Basic Auth trust-list override.
const previousTrusted = process.env.TRUSTED_PRIVATE_NETWORKS;
process.env.TRUSTED_PRIVATE_NETWORKS = "192.168.1.0/24";
try {
  for (const target of ["https://169.254.169.254/latest/meta-data/", "https://10.0.0.5/", "https://172.16.3.4/", "https://[fd00::1]/"]) {
    await assert.rejects(
      () => validateOutboundUrl(target, { allowLocal: false }),
      `${target} must stay blocked when TRUSTED_PRIVATE_NETWORKS narrows the auth trust list`,
    );
  }
  // Review problem: a widened trust list (operator-added internal range) must still count as reserved.
  process.env.TRUSTED_PRIVATE_NETWORKS = "10.0.0.0/8,81.2.69.0/24";
  await assert.rejects(
    () => validateOutboundUrl("https://81.2.69.7/", { allowLocal: false }),
    "an operator-added internal range must stay blocked for outbound requests",
  );
  await assert.rejects(
    () => validateOutboundUrl("https://169.254.169.254/", { allowLocal: false }),
    "built-in ranges stay blocked with a widened list too",
  );
  await validateOutboundUrl("https://81.2.69.7/", { allowLocal: true });
} finally {
  if (previousTrusted === undefined) delete process.env.TRUSTED_PRIVATE_NETWORKS;
  else process.env.TRUSTED_PRIVATE_NETWORKS = previousTrusted;
}

const originalFetch = globalThis.fetch;
const originalLookup = dns.lookup;
try {
  // No real DNS or network: resolve every host to a public address and fake the responses.
  dns.lookup = (async () => [{ address: "93.184.216.34", family: 4 }]) as typeof dns.lookup;

  // 2. Credential headers are stripped on a cross-origin redirect.
  const seen: Array<{ url: string; headers: Headers }> = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    seen.push({ url, headers: new Headers(init?.headers) });
    if (url.startsWith("https://proxy.example/")) {
      return new Response(null, { status: 302, headers: { location: "https://third-party.example/final" } });
    }
    return new Response("ok", { status: 200, headers: { "content-type": "text/plain" } });
  }) as typeof fetch;
  const response = await safeFetch("https://proxy.example/v1beta/models", {
    headers: { "x-goog-api-key": "goog-secret", apikey: "horde-secret", accept: "application/json" },
  });
  assert.equal(await response.text(), "ok");
  assert.equal(seen.length, 2);
  assert.equal(seen[0]!.headers.get("x-goog-api-key"), "goog-secret");
  assert.equal(seen[1]!.url, "https://third-party.example/final");
  assert.equal(seen[1]!.headers.get("x-goog-api-key"), null, "x-goog-api-key must not follow a cross-origin redirect");
  assert.equal(seen[1]!.headers.get("apikey"), null, "Horde apikey must not follow a cross-origin redirect");
  assert.equal(seen[1]!.headers.get("accept"), "application/json", "non-credential headers are kept");

  // 3. Exceeding the redirect limit cancels the unread redirect body before throwing.
  let cancelled = 0;
  globalThis.fetch = (async () => {
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(new TextEncoder().encode("redirect body"));
      },
      cancel() {
        cancelled += 1;
      },
    });
    return new Response(body, { status: 302, headers: { location: "https://loop.example/again" } });
  }) as typeof fetch;
  await assert.rejects(
    () => safeFetch("https://loop.example/start", { policy: { maxRedirects: 0 } }),
    /exceeded redirect limit/,
  );
  assert.equal(cancelled, 1, "redirect body must be cancelled on the redirect-limit path");
  cancelled = 0;
  await assert.rejects(
    () => safeFetch("https://loop.example/start", { policy: { maxRedirects: 2 } }),
    /exceeded redirect limit/,
  );
  assert.equal(cancelled, 3, "every redirect hop body must be cancelled");
} finally {
  globalThis.fetch = originalFetch;
  dns.lookup = originalLookup;
}

console.log("server-hunt-b57 regression passed");
