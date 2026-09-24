import assert from "node:assert/strict";

// One shared permit and a short permit wait, so the old deadlock shows up as a
// "saturated" timeout within seconds instead of ten minutes.
process.env.LOG_LEVEL = "silent";
process.env.MARINARA_MEDIA_GENERATION_CONCURRENCY = "1";
process.env.MARINARA_MEDIA_GENERATION_WAIT_TIMEOUT_MS = "1500";

const { generateVideo } = await import("../../packages/server/src/services/video/video-generation.js");
const { runMediaGenerationRequest, inspectMediaGenerationConcurrencyForTests } = await import(
  "../../packages/server/src/services/image/image-generation-queue.js"
);

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
// The permit-wait timer is unref'd, so a deadlock would otherwise just end the process silently.
const watchdog = setTimeout(() => {
  console.error("server-hunt-b35 regression failed: video fallback deadlocked with a request on the fallback connection");
  process.exit(1);
}, 10_000);

// Video fallback must not wait on the fallback connection's FIFO while still
// holding the primary's shared permit. Request Y reaches the head of F's FIFO
// while the primary holds the only permit; the fallback leg then queues behind Y.
{
  let fallbackNotices = 0;
  let yStarted: Promise<string> | null = null;
  let yRan = false;
  let signalFallbackReached: () => void = () => undefined;
  const fallbackReached = new Promise<void>((resolve) => {
    signalFallbackReached = resolve;
  });

  const video = generateVideo("unsupported-primary", "http://127.0.0.1:1", "", "unsupported-primary", {
    prompt: "A wave",
    durationSeconds: 4,
    aspectRatio: "16:9",
    queue: true,
    connectionKey: "primary-connection",
    onFallback: async () => {
      fallbackNotices += 1;
      signalFallbackReached();
      // Let Y take F's FIFO turn and reach the permit wait before the fallback leg queues.
      await delay(100);
    },
    fallback: {
      connectionId: "fallback-connection",
      connectionName: "Fallback",
      source: "unsupported-fallback",
      baseUrl: "http://127.0.0.1:1",
      apiKey: "",
      serviceHint: "unsupported-fallback",
      model: "fallback-model",
    },
  });

  // Start Y from the top-level async context (not inside the primary task, whose
  // permit context would otherwise be inherited by Y).
  await fallbackReached;
  yStarted = runMediaGenerationRequest({
    connectionKey: "fallback-connection",
    queue: true,
    task: async () => {
      yRan = true;
      return "y-done";
    },
  });

  await assert.rejects(video, /Unsupported video generation service: unsupported-fallback/);
  assert.equal(fallbackNotices, 1);
  assert.ok(yStarted, "fallback notice should have started request Y");
  assert.equal(await yStarted, "y-done", "request Y on the fallback connection must not time out");
  assert.equal(yRan, true);
  assert.equal(inspectMediaGenerationConcurrencyForTests().activeGlobalPermits, 0);
  assert.equal(inspectMediaGenerationConcurrencyForTests().queuedWaiters, 0);
}

// A primary that never reached the provider (queue wait aborted) keeps the old
// behaviour of not triggering the fallback.
{
  let fallbackNotices = 0;
  const controller = new AbortController();
  controller.abort(new Error("cancelled by test"));
  await assert.rejects(
    generateVideo("unsupported-primary", "http://127.0.0.1:1", "", "unsupported-primary", {
      prompt: "A wave",
      durationSeconds: 4,
      aspectRatio: "16:9",
      queue: true,
      connectionKey: "primary-connection",
      signal: controller.signal,
      onFallback: async () => {
        fallbackNotices += 1;
      },
      fallback: {
        connectionId: "fallback-connection",
        connectionName: "Fallback",
        source: "unsupported-fallback",
        baseUrl: "http://127.0.0.1:1",
        apiKey: "",
        serviceHint: "unsupported-fallback",
        model: "fallback-model",
      },
    }),
    /cancelled by test/,
  );
  assert.equal(fallbackNotices, 0);
}

clearTimeout(watchdog);
console.log("server-hunt-b35 regression passed");
