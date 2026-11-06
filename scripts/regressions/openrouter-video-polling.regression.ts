import assert from "node:assert/strict";
import { promises as dns } from "node:dns";

process.env.OPENROUTER_VIDEO_POLL_INTERVAL_MS = "1";
process.env.LOG_LEVEL = "silent";
const originalFetch = globalThis.fetch;
const originalLookup = dns.lookup;
dns.lookup = (async () => [{ address: "8.8.8.8", family: 4 }]) as typeof dns.lookup;
let pollingReference: unknown;
let contentReference: string | undefined;
let origin = "https://openrouter.ai";
const requests: Array<{ method: string; url: URL; authorization: string | null }> = [];
const mp4 = Buffer.from("000000186674797069736f6d0000020069736f6d6d703432", "hex");
globalThis.fetch = async (input, init) => {
  const url = new URL(String(input));
  const authorization = new Headers(init?.headers).get("authorization");
  assert.equal(
    authorization,
    url.origin === origin ? "Bearer synthetic-fixture-key" : null,
    "Only the configured API origin may receive authorization, including the initial content request",
  );
  assert.ok([origin, "https://cdn.example"].includes(url.origin), "All HTTP responses are synthetic");
  const method = init?.method || "GET";
  requests.push({ method, url, authorization });
  if (method === "POST") {
    return Response.json({
      id: "fixture",
      ...(pollingReference === undefined ? {} : { polling_url: pollingReference }),
    });
  }
  if (url.pathname.endsWith("/content") || url.origin === "https://cdn.example")
    return new Response(mp4, { headers: { "content-type": "video/mp4" } });
  return Response.json({ status: "completed", ...(contentReference ? { unsigned_urls: [contentReference] } : {}) });
};
const { generateVideo } = await import("../../packages/server/src/services/video/video-generation.js");
const generate = () =>
  generateVideo("openrouter", `${origin}/api/v1`, "synthetic-fixture-key", "openrouter", {
    model: "bytedance/seedance-2.5",
    prompt: "A stationary banner with gently moving fabric",
    durationSeconds: 5,
    aspectRatio: "16:9",
    resolution: "720p",
    referenceImage: { base64: "iVBORw0KGgo=", mimeType: "image/png" },
    lastFrameImage: { base64: "iVBORw0KGgo=", mimeType: "image/png" },
  });
try {
  for (const reference of [
    "/api/v1/videos/fixture?poll=1",
    "videos/fixture",
    "https://openrouter.ai/api/v1/videos/fixture",
    undefined,
  ]) {
    pollingReference = reference;
    requests.length = 0;
    assert.equal((await generate()).base64, mp4.toString("base64"));
    assert.deepEqual(
      requests.map((request) => request.method),
      ["POST", "GET", "GET"],
    );
    assert.equal(requests[1].url.pathname, "/api/v1/videos/fixture");
    assert.equal(requests[1].url.search, reference?.includes("?poll=1") ? "?poll=1" : "");
  }
  for (const reference of [
    "https://foreign.example/api/v1/videos/fixture",
    "//foreign.example/api/v1/videos/fixture",
    "http://openrouter.ai/api/v1/videos/fixture",
    "https://user:password@openrouter.ai/api/v1/videos/fixture",
    "data:application/json,{}",
    "https://[invalid",
  ]) {
    pollingReference = reference;
    requests.length = 0;
    await assert.rejects(generate(), /polling URL/);
    assert.equal(requests.length, 1, "Reject untrusted polling URLs before any authenticated poll");
    assert.equal(requests[0].method, "POST", "Never retry the already-submitted paid request");
  }
  origin = "https://configured-proxy.example";
  pollingReference = "/api/v1/videos/fixture";
  requests.length = 0;
  assert.equal((await generate()).base64, mp4.toString("base64"));
  assert.equal(requests[1].url.origin, origin, "Resolve against the configured API, not a hardcoded public origin");
  for (const reference of [
    "https://cdn.example/clip.mp4?token=synthetic-public",
    "//cdn.example/clip.mp4",
    "/api/v1/videos/fixture/content?token=synthetic-public",
    "videos/fixture/content",
    `${origin}/api/v1/videos/fixture/content`,
  ]) {
    contentReference = reference;
    requests.length = 0;
    assert.equal((await generate()).base64, mp4.toString("base64"));
    assert.deepEqual(
      requests.map((request) => request.method),
      ["POST", "GET", "GET"],
    );
    const target = new URL(reference, `${origin}/api/v1/videos`);
    assert.equal(requests[2].url.href, target.href);
    assert.equal(requests[2].authorization, target.origin === origin ? "Bearer synthetic-fixture-key" : null);
  }
  for (const reference of [
    `${origin.replace("https://", "https://user:password@")}/api/v1/videos/fixture/content`,
    "https://user:password@cdn.example/clip.mp4",
    "http://cdn.example/clip.mp4",
    "data:video/mp4;base64,AAAA",
    "https://[invalid",
  ]) {
    contentReference = reference;
    requests.length = 0;
    await assert.rejects(generate());
    assert.deepEqual(
      requests.map((request) => request.method),
      ["POST", "GET"],
      "Reject unsafe content URLs before download without resubmitting the job",
    );
  }
} finally {
  globalThis.fetch = originalFetch;
  dns.lookup = originalLookup;
}
console.info("OpenRouter video polling/content regression passed (21 cases)");
