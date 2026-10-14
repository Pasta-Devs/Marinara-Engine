// ──────────────────────────────────────────────
// Regression: provider lanes for "Queue media generation requests" (#7662)
// ──────────────────────────────────────────────
// With the toggle on, image requests to one provider account must go out one at a
// time whichever feature sends them, because providers like NovelAI reject parallel
// work. Pinned here: the lane itself (serial per key, parallel across keys, re-entrant,
// abort and throw leave nothing behind, toggle off restores parallel requests), the
// server mirror of the synced `ui` setting, and the real generateImage path against a
// local fixture provider reached through two different "connections".
import assert from "node:assert/strict";
import { createServer } from "node:http";

process.env.MARINARA_MEDIA_GENERATION_CONCURRENCY = "4";
const {
  applyMediaQueueUiSettingsValue,
  inspectMediaProviderLanesForTests,
  mediaProviderLaneKey,
  mediaProviderLanesEnabled,
  runInMediaProviderLane,
} = await import("../../packages/server/src/services/image/image-generation-queue.js");
const { generateImage } = await import("../../packages/server/src/services/image/image-generation.js");

const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function concurrencyProbe() {
  let running = 0;
  let peak = 0;
  return {
    get peak() {
      return peak;
    },
    run: async <T>(gate: Promise<void>, value: T) => {
      running += 1;
      peak = Math.max(peak, running);
      try {
        await gate;
        return value;
      } finally {
        running -= 1;
      }
    },
  };
}

const idle = () => assert.equal(inspectMediaProviderLanesForTests().activeLanes, 0, "no lane may stay behind");

// ── 1) The synced `ui` setting drives the toggle; only an explicit false turns it off ──
applyMediaQueueUiSettingsValue(null);
assert.equal(mediaProviderLanesEnabled(), true, "missing setting keeps the default (on)");
applyMediaQueueUiSettingsValue("{not json");
assert.equal(mediaProviderLanesEnabled(), true, "bad JSON keeps the default (on)");
applyMediaQueueUiSettingsValue(JSON.stringify({ queueImageGenerationRequests: false }));
assert.equal(mediaProviderLanesEnabled(), false);
applyMediaQueueUiSettingsValue(JSON.stringify({ queueImageGenerationRequests: true, theme: "dark" }));
assert.equal(mediaProviderLanesEnabled(), true);

// ── 2) Lane keys: one per endpoint and account, never the key in clear ──
const keyA = mediaProviderLaneKey("https://image.novelai.net", "secret-key-a");
assert.equal(keyA, mediaProviderLaneKey("https://image.novelai.net", "  secret-key-a "));
assert.notEqual(keyA, mediaProviderLaneKey("https://image.novelai.net", "secret-key-b"));
assert.notEqual(keyA, mediaProviderLaneKey("https://other.example", "secret-key-a"));
assert.ok(!keyA.includes("secret-key-a"), "the API key must be hashed");

// ── 3) Same lane runs one at a time in FIFO order; other lanes run alongside ──
{
  const probe = concurrencyProbe();
  const order: string[] = [];
  const gates = [deferred(), deferred(), deferred()];
  const same = gates.map((gate, index) =>
    runInMediaProviderLane({
      laneKey: "lane-a",
      task: () => {
        order.push(`a${index}`);
        return probe.run(gate.promise, index);
      },
    }),
  );
  const otherGate = deferred();
  let otherStarted = false;
  const other = runInMediaProviderLane({
    laneKey: "lane-b",
    task: () => {
      otherStarted = true;
      return otherGate.promise;
    },
  });
  await tick();
  assert.equal(probe.peak, 1, "one request at a time per lane");
  assert.equal(otherStarted, true, "a different provider account is not held up");
  for (const gate of gates) gate.resolve();
  otherGate.resolve();
  assert.deepEqual(await Promise.all(same), [0, 1, 2]);
  await other;
  assert.deepEqual(order, ["a0", "a1", "a2"], "FIFO order");
  await tick();
  idle();
}

// ── 4) Re-entering a held lane (nested generateImage) must not deadlock ──
assert.equal(
  await runInMediaProviderLane({
    laneKey: "lane-a",
    task: () => runInMediaProviderLane({ laneKey: "lane-a", task: async () => "nested" }),
  }),
  "nested",
);
await tick();
idle();

// ── 5) A throwing task and an aborted waiter both free the lane ──
{
  await assert.rejects(
    runInMediaProviderLane({
      laneKey: "lane-a",
      task: async () => {
        throw new Error("provider exploded");
      },
    }),
    /provider exploded/u,
  );
  const holderGate = deferred();
  const holder = runInMediaProviderLane({ laneKey: "lane-a", task: () => holderGate.promise });
  const controller = new AbortController();
  let waiterRan = false;
  const waiter = runInMediaProviderLane({
    laneKey: "lane-a",
    signal: controller.signal,
    task: async () => {
      waiterRan = true;
    },
  });
  await tick();
  controller.abort(new Error("user cancelled"));
  await assert.rejects(waiter, /user cancelled/u);
  holderGate.resolve();
  await holder;
  assert.equal(waiterRan, false, "an aborted waiter never reaches the provider");
  assert.equal(await runInMediaProviderLane({ laneKey: "lane-a", task: async () => "after" }), "after");
  await tick();
  idle();
}

// ── 6) Toggle off: requests run in parallel as before ──
{
  applyMediaQueueUiSettingsValue(JSON.stringify({ queueImageGenerationRequests: false }));
  const probe = concurrencyProbe();
  const gate = deferred();
  const runs = [0, 1].map((index) =>
    runInMediaProviderLane({ laneKey: "lane-a", task: () => probe.run(gate.promise, index) }),
  );
  await tick();
  assert.equal(probe.peak, 2, "the toggle off leaves requests unqueued");
  gate.resolve();
  await Promise.all(runs);
  applyMediaQueueUiSettingsValue(null);
  idle();
}

// ── 7) Real generateImage path: two "connections" to one provider account ──
let inFlight = 0;
let providerPeak = 0;
const server = createServer(async (request, response) => {
  for await (const _chunk of request) void _chunk;
  inFlight += 1;
  providerPeak = Math.max(providerPeak, inFlight);
  await sleep(40);
  inFlight -= 1;
  response.setHeader("content-type", "application/json");
  response.end(JSON.stringify({ data: [{ b64_json: png }] }));
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
try {
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const baseUrl = `http://127.0.0.1:${address.port}/v1`;
  const request = { prompt: "a lighthouse", model: "flux-2-pro", allowLocalUrls: true };
  // An illustrator, a tracker portrait and a package image, as three independent callers.
  const results = await Promise.all([
    generateImage("openai", baseUrl, "account-key", "openai", request),
    generateImage("openai", `${baseUrl}/`, "account-key", "openai", request),
    generateImage("openai", baseUrl, "account-key", "openai", { ...request, prompt: "an NPC portrait" }),
  ]);
  assert.ok(results.every((result) => result.base64 === png));
  assert.equal(providerPeak, 1, "one provider account must never see parallel requests");

  providerPeak = 0;
  await Promise.all([
    generateImage("openai", baseUrl, "account-key", "openai", request),
    generateImage("openai", baseUrl, "another-account", "openai", request),
  ]);
  assert.equal(providerPeak, 2, "different accounts keep running in parallel");

  providerPeak = 0;
  applyMediaQueueUiSettingsValue(JSON.stringify({ queueImageGenerationRequests: false }));
  await Promise.all([
    generateImage("openai", baseUrl, "account-key", "openai", request),
    generateImage("openai", baseUrl, "account-key", "openai", request),
  ]);
  assert.equal(providerPeak, 2, "with the toggle off only the global ceiling applies");
  applyMediaQueueUiSettingsValue(null);
  await tick();
  idle();
} finally {
  await new Promise<void>((resolve) => server.close(() => resolve()));
}

console.log("media-provider-lane regression passed");
