// ──────────────────────────────────────────────
// Regression: text and media take turns on a shared GPU host
// ──────────────────────────────────────────────
// With llama-swap swapping one GPU between a local LLM and ComfyUI, a media request queued while
// text was in flight and every new text request went past it; pictures waited for minutes and
// were lost. Pinned here: a waiting media request holds back new text, the running kind drains
// before the other starts, waiters of one kind start together, an abort while waiting lets the
// queue move on, nested calls run straight through, a stream holds its turn until it closes,
// throws release the turn, and unlisted hosts are untouched.
import assert from "node:assert/strict";
import { createServer } from "node:http";

process.env.MARINARA_SHARED_GPU_HOSTS = "Phoenix:8081, localhost:9000";
const { runSharedGpuTurn, sharedGpuHostFor, withSharedGpuTurnProvider, inspectSharedGpuTurnsForTests } =
  await import("../../packages/server/src/services/generation/shared-gpu-turns.js");
const { BaseLLMProvider } = await import("../../packages/server/src/services/llm/base-provider.js");

const GPU = "http://phoenix:8081/upstream/comfyui_auto";
const LLM = "http://phoenix:8081/v1";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}
const tick = async () => {
  for (let i = 0; i < 5; i += 1) await new Promise((resolve) => setImmediate(resolve));
};
const idle = () => assert.deepEqual(inspectSharedGpuTurnsForTests(), {});

async function main() {
  // ── 1) Hosts match on host:port, case-insensitively; unlisted hosts run untouched ──
  assert.equal(sharedGpuHostFor(LLM), "phoenix:8081");
  assert.equal(sharedGpuHostFor("http://localhost:9000"), "localhost:9000");
  assert.equal(sharedGpuHostFor("http://phoenix:8082/v1"), null);
  assert.equal(sharedGpuHostFor("https://api.openai.com/v1"), null);
  assert.equal(await runSharedGpuTurn("media", "https://api.openai.com/v1", async () => "ran"), "ran");
  idle();

  // ── 2) A waiting media request holds back new text; the running text drains first ──
  const order: string[] = [];
  const text1 = deferred();
  const media = deferred();
  const t1 = runSharedGpuTurn("text", LLM, async () => {
    order.push("text1 start");
    await text1.promise;
    order.push("text1 end");
  });
  await tick();
  const m = runSharedGpuTurn("media", GPU, async () => {
    order.push("media start");
    await media.promise;
    order.push("media end");
  });
  await tick();
  const t2 = runSharedGpuTurn("text", LLM, async () => {
    order.push("text2 start");
  });
  await tick();
  assert.deepEqual(order, ["text1 start"], "media and the later text both wait while text1 runs");
  text1.resolve();
  await tick();
  assert.deepEqual(order, ["text1 start", "text1 end", "media start"], "media goes before the text that came after it");
  media.resolve();
  await Promise.all([t1, m, t2]);
  assert.deepEqual(order, ["text1 start", "text1 end", "media start", "media end", "text2 start"]);
  idle();

  // ── 3) Requests of one kind run together ──
  let running = 0;
  let peak = 0;
  const gate = deferred();
  const together = [1, 2, 3].map(() =>
    runSharedGpuTurn("media", GPU, async () => {
      running += 1;
      peak = Math.max(peak, running);
      await gate.promise;
      running -= 1;
    }),
  );
  await tick();
  assert.equal(peak, 3);
  gate.resolve();
  await Promise.all(together);
  idle();

  // ── 4) Aborting a waiting media request lets text that queued behind it start ──
  const holdText = deferred();
  const firstText = runSharedGpuTurn("text", LLM, () => holdText.promise);
  await tick();
  const abort = new AbortController();
  const abortedMedia = runSharedGpuTurn(
    "media",
    GPU,
    async () => assert.fail("aborted media must not run"),
    abort.signal,
  );
  let lateTextRan = false;
  const lateText = runSharedGpuTurn("text", LLM, async () => {
    lateTextRan = true;
  });
  await tick();
  assert.equal(lateTextRan, false, "late text waits behind the waiting media");
  abort.abort(new Error("stop"));
  await assert.rejects(abortedMedia, /stop/);
  await lateText;
  assert.equal(lateTextRan, true, "late text joins once the media waiter is gone");
  holdText.resolve();
  await firstText;
  idle();

  // ── 5) A nested call inside a held turn runs straight through instead of waiting on itself ──
  const nested = await runSharedGpuTurn("media", GPU, () => runSharedGpuTurn("text", LLM, async () => "nested"));
  assert.equal(nested, "nested");
  idle();

  // ── 6) A throw releases the turn ──
  await assert.rejects(
    runSharedGpuTurn("media", GPU, async () => {
      throw new Error("render failed");
    }),
    /render failed/,
  );
  idle();

  // ── 7) The provider wrapper holds a stream's turn until the stream closes, even when cut short ──
  const streamGate = deferred();
  class FakeProvider extends BaseLLMProvider {
    async *chat() {
      yield "a";
      await streamGate.promise;
      yield "b";
    }
  }
  const unlisted = new FakeProvider("https://api.example.com/v1", "");
  assert.equal(
    withSharedGpuTurnProvider(unlisted, "https://api.example.com/v1"),
    unlisted,
    "unlisted hosts are not wrapped",
  );
  const provider = withSharedGpuTurnProvider(new FakeProvider(LLM, ""), LLM);
  const stream = provider.chat([], { model: "m" });
  assert.deepEqual(await stream.next(), { value: "a", done: false });
  let mediaRan = false;
  const waitingMedia = runSharedGpuTurn("media", GPU, async () => {
    mediaRan = true;
  });
  await tick();
  assert.equal(mediaRan, false, "media waits while the stream is open");
  await stream.return(undefined);
  await waitingMedia;
  assert.equal(mediaRan, true, "closing the stream early releases its turn");
  streamGate.resolve();
  const completion = await provider.chatComplete([], { model: "m" });
  assert.equal(completion.content, "ab");
  idle();

  // ── 8) A media request waits no longer than MARINARA_MEDIA_GENERATION_WAIT_TIMEOUT_MS, and text queued behind it
  // then goes ahead ──
  process.env.MARINARA_MEDIA_GENERATION_WAIT_TIMEOUT_MS = "300";
  const stalled = deferred();
  const stalledText = runSharedGpuTurn("text", LLM, () => stalled.promise);
  await tick();
  // Checked from the start, so a slow tick can only make the wait end sooner, never unobserved.
  const timedOut = assert.rejects(
    runSharedGpuTurn("media", GPU, async () => "never"),
    /Waited over 0 seconds for the shared GPU/u,
    "the media wait has a deadline",
  );
  await tick();
  let queuedTextRan = false;
  const queuedText = runSharedGpuTurn("text", LLM, async () => {
    queuedTextRan = true;
  });
  await tick();
  assert.equal(queuedTextRan, false, "new text waits behind the waiting media request");
  // AbortSignal.timeout doesn't keep the process alive (a server always is), so hold it open across the wait.
  const keepAlive = setTimeout(() => undefined, 5_000);
  await timedOut;
  clearTimeout(keepAlive);
  await queuedText;
  assert.equal(queuedTextRan, true, "text queued behind the timed-out media request goes ahead");
  stalled.resolve();
  await stalledText;
  delete process.env.MARINARA_MEDIA_GENERATION_WAIT_TIMEOUT_MS;
  idle();

  // ── 9) Through the real image and video entry points: a media request waiting for its turn holds no media permit
  // and no connection admission, so an unrelated backend still renders, a timeout names the shared GPU, and a
  // cancelled wait leaves nothing behind ──
  const { generateImage, imageAdmissionKey } =
    await import("../../packages/server/src/services/image/image-generation.js");
  const { generateVideo } = await import("../../packages/server/src/services/video/video-generation.js");
  const { inspectMediaGenerationConcurrencyForTests } =
    await import("../../packages/server/src/services/image/image-generation-queue.js");
  const { tryBackgroundConnection } =
    await import("../../packages/server/src/services/generation/connection-admission.js");
  const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  const physicalCalls = { gpu: 0, other: 0 };
  const startImageServer = async (name: keyof typeof physicalCalls) => {
    const server = createServer((request, response) => {
      request.resume();
      physicalCalls[name] += 1;
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ data: [{ b64_json: png }] }));
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    assert.ok(address && typeof address === "object");
    return { server, base: `http://127.0.0.1:${address.port}/v1` };
  };
  const gpuServer = await startImageServer("gpu");
  const otherServer = await startImageServer("other");
  const previousHosts = process.env.MARINARA_SHARED_GPU_HOSTS;
  process.env.MARINARA_SHARED_GPU_HOSTS = `${previousHosts}, ${new URL(gpuServer.base).host}`;
  process.env.MARINARA_MEDIA_GENERATION_CONCURRENCY = "1";
  process.env.MARINARA_MEDIA_GENERATION_WAIT_TIMEOUT_MS = "600";
  const draw = (base: string, signal?: AbortSignal) =>
    generateImage("openai", base, "fixture-key", "openai", {
      prompt: "a moonlit laboratory",
      model: "local-flux",
      allowLocalUrls: true,
      signal,
    });
  const noPermitsHeld = (why: string) =>
    assert.deepEqual(
      inspectMediaGenerationConcurrencyForTests(),
      { activeGlobalPermits: 0, queuedWaiters: 0, foregroundWaiters: 0, backgroundWaiters: 0 },
      why,
    );
  const keepAliveGpu = setTimeout(() => undefined, 10_000);
  try {
    const stalledGpuText = deferred();
    const gpuText = runSharedGpuTurn("text", gpuServer.base, () => stalledGpuText.promise);
    await tick();
    // Checked from the start, so its rejection is never unobserved.
    const waitingDraw = assert.rejects(
      draw(gpuServer.base),
      /seconds for the shared GPU \(MARINARA_SHARED_GPU_HOSTS\)/u,
      "the wait that timed out names the shared GPU",
    );
    await tick();
    assert.equal(inspectSharedGpuTurnsForTests()[new URL(gpuServer.base).host]?.waiting, 1, "the picture waits");
    noPermitsHeld("waiting for the shared GPU holds no media permit");
    const probe = tryBackgroundConnection(imageAdmissionKey(gpuServer.base, "openai"), new Date());
    assert.equal(probe.acquired, true, "waiting for the shared GPU holds no connection admission");
    if (probe.acquired) probe.release();
    // With one permit, an unlisted backend renders at once instead of reporting a saturated media queue.
    assert.equal((await draw(otherServer.base)).base64, png, "an unrelated backend still renders");
    assert.equal(physicalCalls.other, 1);
    await waitingDraw;
    assert.equal(physicalCalls.gpu, 0, "nothing reached the shared GPU while text held it");
    noPermitsHeld("a timed-out wait leaves no permit behind");

    // A cancelled wait, for a picture or a clip, leaves no turn, permit or admission behind.
    const cancelDraw = new AbortController();
    const cancelledDraw = assert.rejects(draw(gpuServer.base, cancelDraw.signal));
    const cancelClip = new AbortController();
    const cancelledClip = assert.rejects(
      generateVideo("comfyui", gpuServer.base.replace(/\/v1$/u, ""), "", "comfyui", {
        prompt: "Aster waves",
        durationSeconds: 4,
        aspectRatio: "16:9",
        signal: cancelClip.signal,
      }),
    );
    await tick();
    assert.equal(inspectSharedGpuTurnsForTests()[new URL(gpuServer.base).host]?.waiting, 2, "picture and clip wait");
    noPermitsHeld("a clip waiting for the shared GPU holds no media permit either");
    cancelDraw.abort();
    cancelClip.abort();
    await Promise.all([cancelledDraw, cancelledClip]);
    noPermitsHeld("cancelled waits leave no permit");
    assert.equal(inspectSharedGpuTurnsForTests()[new URL(gpuServer.base).host]?.waiting ?? 0, 0, "no waiter left");

    // Once text lets go, the picture takes its turn, then its permit, and renders.
    stalledGpuText.resolve();
    await gpuText;
    assert.equal((await draw(gpuServer.base)).base64, png);
    assert.equal(physicalCalls.gpu, 1);
    noPermitsHeld("a finished picture returns its permit");
    idle();
  } finally {
    clearTimeout(keepAliveGpu);
    process.env.MARINARA_SHARED_GPU_HOSTS = previousHosts;
    delete process.env.MARINARA_MEDIA_GENERATION_CONCURRENCY;
    delete process.env.MARINARA_MEDIA_GENERATION_WAIT_TIMEOUT_MS;
    for (const { server } of [gpuServer, otherServer]) {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  }

  // ── 10) A clip queued behind its connection holds no GPU turn while the clip ahead renders, so text waiting for the
  // GPU goes before it; and a wait that times out behind media work says so ──
  const { runMediaGenerationRequest } =
    await import("../../packages/server/src/services/image/image-generation-queue.js");
  delete process.env.MARINARA_MEDIA_GENERATION_CONCURRENCY;
  const queuedOrder: string[] = [];
  const firstClip = deferred();
  const queuedClip = (name: string, gate?: Promise<void>) =>
    runMediaGenerationRequest({
      connectionKey: "comfy-video",
      queue: true,
      aroundPermit: (work) => runSharedGpuTurn("media", GPU, work),
      task: async () => {
        queuedOrder.push(`${name} start`);
        await gate;
        queuedOrder.push(`${name} end`);
      },
    });
  const clipOne = queuedClip("clip1", firstClip.promise);
  await tick();
  const clipTwo = queuedClip("clip2");
  await tick();
  assert.equal(inspectSharedGpuTurnsForTests()["phoenix:8081"]?.running, 1, "the queued clip holds no turn");
  const textAfterClip = runSharedGpuTurn("text", LLM, async () => {
    queuedOrder.push("text");
  });
  await tick();
  firstClip.resolve();
  await Promise.all([clipOne, clipTwo, textAfterClip]);
  assert.deepEqual(queuedOrder, ["clip1 start", "clip1 end", "text", "clip2 start", "clip2 end"]);
  idle();

  process.env.MARINARA_MEDIA_GENERATION_WAIT_TIMEOUT_MS = "300";
  const runningMedia = deferred();
  const mediaHolder = runSharedGpuTurn("media", GPU, () => runningMedia.promise);
  await tick();
  const textWaiting = runSharedGpuTurn("text", LLM, async () => undefined);
  await tick();
  const keepAliveMedia = setTimeout(() => undefined, 5_000);
  await assert.rejects(
    runSharedGpuTurn("media", GPU, async () => "never"),
    /for the shared GPU \(MARINARA_SHARED_GPU_HOSTS\) while other media work held it/u,
    "a wait behind media work doesn't blame text",
  );
  clearTimeout(keepAliveMedia);
  runningMedia.resolve();
  await Promise.all([mediaHolder, textWaiting]);
  delete process.env.MARINARA_MEDIA_GENERATION_WAIT_TIMEOUT_MS;
  idle();

  console.log("shared-gpu-turns regression passed");
}

await main();
