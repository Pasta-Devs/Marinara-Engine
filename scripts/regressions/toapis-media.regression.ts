import assert from "node:assert/strict";
import { promises as dns } from "node:dns";
import fs from "node:fs/promises";
import { readdir, readFile, stat } from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import { join } from "node:path";
import { Writable } from "node:stream";
import pino from "../../packages/server/node_modules/pino/pino.js";

// All HTTP and DNS are fixtures: no live API, pricing query, upload or paid task.
process.env.TOAPIS_POLL_INTERVAL_MS = "1";
process.env.SEEDANCE_VIDEO_POLL_INTERVAL_MS = "1";
process.env.IMAGE_GEN_TIMEOUT_MS = "1000";
process.env.IMAGE_GEN_MAX_RESPONSE_BYTES = "1024";
process.env.VIDEO_GEN_MAX_RESPONSE_BYTES = "1024";
process.env.LOG_LEVEL = "silent";
const originalFetch = globalThis.fetch;
const originalLookup = dns.lookup;
dns.lookup = (async () => [{ address: "8.8.8.8", family: 4 }]) as typeof dns.lookup;
const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const mp4 = Buffer.from("000000186674797069736f6d0000020069736f6d6d703432", "hex");
type Call = { url: string; method: string; headers: Headers; body: unknown };
let calls: Call[] = [];
let mode = "complete";
let transientPolls = 0;
let transportGuardFired = false;
let transportAbortReason: unknown;
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
globalThis.fetch = async (input, init) => {
  const url = new URL(String(input));
  const body = typeof init?.body === "string" ? JSON.parse(init.body) : init?.body;
  calls.push({ url: url.href, method: init?.method || "GET", headers: new Headers(init?.headers), body });
  if (url.hostname === "media.toapis.com") {
    assert.equal(new Headers(init?.headers).has("Authorization"), false, "Never leak Key to storage");
    if (mode === "download-error") return new Response("fixture-provider-download-text", { status: 503 });
    if (mode === "oversized-media")
      return new Response(
        Buffer.concat([url.pathname.endsWith(".png") ? Buffer.from(png, "base64") : mp4, Buffer.alloc(2048)]),
      );
    return new Response(
      mode === "bad-media"
        ? Buffer.from("not media")
        : url.pathname.endsWith(".png")
          ? Buffer.from(png, "base64")
          : mp4,
    );
  }
  assert.ok(
    ["toapis.com", "toapis.cn", "api.openai.com", "api.seedance2.ai"].includes(url.hostname),
    "Unexpected network destination",
  );
  if (url.hostname === "api.openai.com") return json({ data: [{ b64_json: png }] });
  if (url.hostname === "api.seedance2.ai") {
    if (init?.method === "POST") return json({ taskId: "legacy" });
    return json({ status: "completed", output: { url: "https://media.toapis.com/legacy.mp4" } });
  }
  assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer fixture-key");
  if (
    (url.pathname === "/v1/chat/completions" && mode === "stall-chat") ||
    (url.pathname === "/v1/uploads/images" && mode === "stall-upload")
  ) {
    const signal = init?.signal;
    assert.ok(signal, "The stalled request must honor the image deadline");
    return new Promise<Response>((_resolve, reject) => {
      // The production deadline is unref'd; keep this stalled transport alive until it aborts.
      const transportTimeout = setTimeout(() => {
        transportGuardFired = true;
        reject(new Error("Fixture transport did not abort"));
      }, 5000);
      const abort = () => {
        clearTimeout(transportTimeout);
        transportAbortReason = signal.reason;
        reject(signal.reason);
      };
      if (signal.aborted) abort();
      else signal.addEventListener("abort", abort, { once: true });
    });
  }
  if (url.pathname === "/v1/uploads/images") {
    assert.ok(body instanceof FormData);
    assert.equal((body.get("file") as Blob).type, "image/png");
    return json({ data: { url: "https://media.toapis.com/uploaded.png" } });
  }
  const kind = url.pathname.includes("images") ? "images" : "videos";
  if (init?.method === "POST") {
    if (mode === "uncertain") throw new Error("fixture transport lost response");
    if (mode === "missing-id") return json({ status: "queued" });
    if (mode === "rejected") return json({ error: { message: "fixture rejection" } }, 401);
    if (mode === "rejected-escaped")
      return new Response('{"error":{"message":"Invalid \\u0066ixture-key"}}', { status: 401 });
    if (mode === "rejected-nested")
      return json(
        { error: String.raw`{"error":{"message":"Invalid fixture-\u006bey at https:\/\/toapis.com\/private"}}` },
        401,
      );
    if (mode === "rejected-nested-long")
      return json({ error: String.raw`{"error":{"message":"${"x".repeat(295)}fixture-\u006bey"}}` }, 401);
    if (mode === "rejected-html")
      return new Response("<html><title>Account not enabled</title></html>", { status: 403 });
    if (mode === "rejected-metadata") return json({ id: "private-task-reference", key: "fixture-key" }, 400);
    if (mode === "rejected-oversized") return new Response("x".repeat(2 * 1024 * 1024 + 1), { status: 401 });
    if (mode === "redirect") return new Response(null, { status: 307, headers: { location: "/v1/replayed" } });
    return json({
      id: mode === "poll-unauthorized" ? `fixture-${kind}/private` : `fixture-${kind}`,
      status: mode === "immediate" ? "completed" : "queued",
      result: { data: [{ url: `https://media.toapis.com/output.${kind === "images" ? "png" : "mp4"}` }] },
    });
  }
  if (mode === "stall") return json({ id: `fixture-${kind}`, status: "processing" });
  if (mode === "failed") return json({ id: `fixture-${kind}`, status: "failed" });
  if (mode === "poll-http") return json({ error: "fixture" }, 503);
  if (mode === "poll-transport") throw new Error("fixture polling transport failure");
  if (mode === "poll-log") return json({ error: "fixture-provider-response-text" }, 503);
  if (mode === "poll-once" && transientPolls++ === 0) return json({ error: "fixture" }, 503);
  if (mode === "poll-unauthorized")
    return json(
      {
        error: {
          message: `Task fixture-${kind}/private denied for fixture-key at https://toapis.com/?key=fixture-key`,
        },
      },
      401,
    );
  if (mode === "private-output") {
    return json({ status: "completed", result: { data: [{ url: "https://127.0.0.1/private.png" }] } });
  }
  return json({
    id: `fixture-${kind}`,
    status: "completed",
    result: { data: [{ url: `https://media.toapis.com/output.${kind === "images" ? "png" : "mp4"}` }] },
  });
};

let passed = 0;
async function check(name: string, run: () => void | Promise<void>) {
  calls = [];
  mode = "complete";
  transientPolls = 0;
  transportGuardFired = false;
  transportAbortReason = undefined;
  await run();
  passed++;
  process.stdout.write(`PASS ${name}\n`);
}
async function captureLogs(run: (lines: Array<Record<string, unknown>>) => Promise<void>) {
  const { logger } = await import("../../packages/server/src/lib/logger.js");
  const lines: Array<Record<string, unknown>> = [];
  const stream = Reflect.get(logger, pino.symbols.streamSym);
  const level = logger.level;
  const sink = new Writable({
    write(chunk, _encoding, done) {
      for (const line of String(chunk).split("\n")) if (line.trim()) lines.push(JSON.parse(line));
      done();
    },
  });
  Reflect.set(logger, pino.symbols.streamSym, sink);
  logger.level = "debug";
  try {
    await run(lines);
  } finally {
    logger.level = level;
    Reflect.set(logger, pino.symbols.streamSym, stream);
    sink.end();
  }
}
try {
  const { generateImage } = await import("../../packages/server/src/services/image/image-generation.js");
  const { generateVideo } = await import("../../packages/server/src/services/video/video-generation.js");
  const { isToAPIsMediaUrl } = await import("../../packages/server/src/services/media/toapis-media.js");
  const { DATA_DIR } = await import("../../packages/server/src/utils/data-dir.js");
  const image = (patch = {}) =>
    generateImage("openai", "https://toapis.com/v1", "fixture-key", "openai", {
      model: "gpt-image-2",
      prompt: "library",
      width: 1024,
      height: 576,
      ...patch,
    });
  const video = (patch = {}) =>
    generateVideo("seedance", "https://toapis.com/v1", "fixture-key", "seedance", {
      model: "seedance-2-mini",
      prompt: "gentle motion",
      durationSeconds: 4,
      aspectRatio: "16:9",
      resolution: "480p",
      referenceImage: { base64: png, mimeType: "image/png" },
      ...patch,
    });
  const submissions = () => calls.filter((c) => c.method === "POST" && c.url.endsWith("/generations"));
  const imageFallback = {
    connectionId: "fallback-image",
    connectionName: "Fallback image",
    source: "openai",
    baseUrl: "https://api.openai.com/v1",
    apiKey: "legacy-key",
    serviceHint: "openai",
    model: "gpt-image-2",
  };
  const videoFallback = {
    connectionId: "fallback-video",
    connectionName: "Fallback video",
    source: "seedance",
    baseUrl: "https://api.seedance2.ai",
    apiKey: "legacy-key",
    serviceHint: "seedance",
    model: "seedance-2-0",
  };
  await check("strict origin selection", () => {
    for (const url of ["https://toapis.com", "https://toapis.cn/v1/"]) assert.ok(isToAPIsMediaUrl(url));
    for (const url of [
      "https://toapis.com.attacker.org/v1",
      "http://toapis.com",
      "https://toapis.com:8443",
      "https://user@toapis.com",
      "https://toapis.com/other",
      "https://toapis.com/?x=1",
    ])
      assert.equal(isToAPIsMediaUrl(url), false);
  });
  await check("image async creation, exact parameters and pixels", async () => {
    assert.deepEqual(await image({ negativePrompt: "people" }), { base64: png, mimeType: "image/png", ext: "png" });
    assert.deepEqual(submissions()[0]!.body, {
      model: "gpt-image-2",
      prompt: "library\n\nDo not include: people.",
      size: "16:9",
      resolution: "1k",
      n: 1,
    });
    assert.equal(submissions().length, 1);
    assert.ok(calls.some((c) => c.url.endsWith("images/generations/fixture-images")));
  });
  await check("reference edit uploads image instead of dropping it", async () => {
    await image({ referenceImage: png });
    assert.deepEqual((submissions()[0]!.body as Record<string, unknown>).reference_images, [
      "https://media.toapis.com/uploaded.png",
    ]);
  });
  await check("first-frame video uses ToAPIs upload and task route", async () => {
    assert.equal((await video()).base64, mp4.toString("base64"));
    assert.deepEqual(submissions()[0]!.body, {
      model: "seedance-2-mini",
      prompt: "gentle motion",
      duration: 4,
      resolution: "480p",
      aspect_ratio: "16:9",
      generate_audio: false,
      image_with_roles: [{ url: "https://media.toapis.com/uploaded.png", role: "first_frame" }],
    });
    assert.ok(calls.some((c) => c.url.endsWith("videos/generations/fixture-videos")));
    assert.equal(
      calls.some((c) => c.url.includes("/tasks/") || c.url.includes("catbox")),
      false,
    );
  });
  await check("text-only Test Video route", async () => {
    await video({ referenceImage: null });
    assert.equal(
      calls.some((c) => c.url.endsWith("uploads/images")),
      false,
    );
  });
  await check("unsupported image model fails before upload or POST", async () => {
    await assert.rejects(image({ model: "gpt-image-2-vip", referenceImage: png }), /ordinary gpt-image-2/);
    assert.equal(calls.length, 0);
  });
  await check("unmapped quality, transparency, ratio and multiple references fail early", async () => {
    for (const patch of [
      { quality: "high" },
      { transparentBackground: true },
      { width: 500, height: 1000 },
      { referenceImages: [png, png] },
    ])
      await assert.rejects(image(patch));
    assert.equal(calls.length, 0);
  });
  await check("invalid video inputs fail before upload or POST", async () => {
    for (const patch of [
      { durationSeconds: 3 },
      { durationSeconds: 5 },
      { durationSeconds: 15 },
      { resolution: "720p" },
      { resolution: "1080p" },
      { aspectRatio: "9:16" },
      { model: "seedance-2" },
      { lastFrameImage: { base64: png, mimeType: "image/png" } },
      { referenceImage: { base64: "bad-data", mimeType: "image/png" } },
    ])
      await assert.rejects(video(patch));
    assert.equal(calls.length, 0);
  });
  await check("failed task does not trigger legacy automatic retry", async () => {
    mode = "failed";
    await assert.rejects(video(), /no replacement/);
    assert.equal(submissions().length, 1);
  });
  await check("lost submission response is not retried", async () => {
    mode = "uncertain";
    await assert.rejects(image(), /submission unconfirmed/);
    assert.equal(submissions().length, 1);
  });
  await check("missing task ID is not retried", async () => {
    mode = "missing-id";
    await assert.rejects(image(), /no task ID/);
    assert.equal(submissions().length, 1);
  });
  await check("polling HTTP failure is not a new generation", async () => {
    mode = "poll-http";
    await assert.rejects(image(), /HTTP 503/);
    assert.equal(submissions().length, 1);
    assert.equal(calls.filter((call) => call.method === "GET").length, 30);
  });
  await check("a transient polling error is retried without a new paid job", async () => {
    mode = "poll-once";
    assert.equal((await image()).base64, png);
    assert.equal(submissions().length, 1);
    assert.equal(calls.filter((call) => call.url.endsWith("fixture-images")).length, 2);
  });
  await check("definite polling rejection fails immediately without a new job", async () => {
    mode = "poll-unauthorized";
    await assert.rejects(video({ fallback: videoFallback }), /HTTP 401/);
    assert.equal(submissions().length, 1);
    assert.equal(calls.filter((call) => call.method === "GET").length, 1);
  });
  await check("definite submission rejection retains the HTTP status", async () => {
    mode = "rejected";
    await assert.rejects(image(), /HTTP 401: fixture rejection/);
    assert.equal(submissions().length, 1);
  });
  await check("marked provider errors serialize as metadata while ordinary errors keep causes", async () => {
    const { logger } = await import("../../packages/server/src/lib/logger.js");
    const { ToAPIsHttpError, ToAPIsSubmittedTaskError } =
      await import("../../packages/server/src/services/media/toapis-media.js");
    const provider = new ToAPIsHttpError(401, "images", "fixture-private-provider-text");
    let deeplyWrapped: Error = provider;
    for (let depth = 0; depth < 40; depth++)
      deeplyWrapped = new Error("fixture-private-deep-wrapper", { cause: deeplyWrapped });
    const errors = [
      provider,
      new ToAPIsSubmittedTaskError(provider),
      new Error("fixture-private-wrapper-text", { cause: provider }),
      deeplyWrapped,
    ];
    await captureLogs(async (lines) => {
      const child = logger.child({ component: "fixture" });
      for (const error of errors) {
        logger.warn(error);
        logger.error({ err: error }, "explicit error field");
        child.fatal({ error }, "child error field");
        logger.info("formatted error: %s", error);
      }
      assert.equal(lines.length, 16);
      assert.ok(!JSON.stringify(lines).includes("fixture-private"));
      assert.ok(!JSON.stringify(lines).includes('"stack"'));
      assert.ok(!JSON.stringify(lines).includes('"cause"'));
      assert.ok(JSON.stringify(lines).includes("ToAPIsHttpError"));
      logger.debug(provider, "debug retains diagnostics");
      assert.ok(JSON.stringify(lines.filter((line) => line.level === 20)).includes("fixture-private-provider-text"));
      const ordinary = new Error("ordinary error", { cause: new Error("ordinary cause") });
      logger.warn(ordinary, "ordinary control");
      assert.deepEqual(lines.at(-1)!.err, JSON.parse(JSON.stringify(pino.stdSerializers.err(ordinary))));
      const cyclic = new Error("ordinary cycle");
      cyclic.cause = cyclic;
      logger.warn(cyclic, "cyclic control");
      assert.deepEqual(lines.at(-1)!.err, JSON.parse(JSON.stringify(pino.stdSerializers.err(cyclic))));
      assert.equal(provider.message, "ToAPIs images HTTP 401: fixture-private-provider-text");
    });
  });
  await check("provider reasons stay at debug across polling and image/video fallback warnings", async () => {
    const { resetRateLimitedLogs } = await import("../../packages/server/src/lib/log-rate-limit.js");
    try {
      resetRateLimitedLogs();
      await captureLogs(async (lines) => {
        const warnings = () => lines.filter((line) => Number(line.level) >= 40);
        const details = () => lines.filter((line) => Number(line.level) === 20);
        mode = "poll-log";
        await assert.rejects(image(), { message: /fixture-provider-response-text/, retryable: false });
        assert.equal(submissions().length, 1);
        assert.equal(warnings().length, 1, "Repeated polling failures share one rate-limit slot");
        assert.ok(JSON.stringify(details()).includes("fixture-provider-response-text"));
        mode = "rejected";
        assert.equal((await image({ fallback: imageFallback })).base64, png);
        assert.equal((await video({ referenceImage: undefined, fallback: videoFallback })).ext, "mp4");
        assert.equal(warnings().length, 3, "Both pre-submission fallbacks retain a metadata warning");
        assert.ok(JSON.stringify(details()).includes("fixture rejection"));
        assert.ok(!JSON.stringify(warnings()).includes("fixture-provider-response-text"));
        assert.ok(!JSON.stringify(warnings()).includes("fixture rejection"));
        mode = "download-error";
        await assert.rejects(image({ fallback: imageFallback }), {
          message: /media download HTTP 503/,
          retryable: false,
        });
        assert.equal(warnings().length, 3);
        assert.ok(!JSON.stringify(details()).includes("fixture-provider-download-text"));
      });
    } finally {
      resetRateLimitedLogs();
    }
  });
  await check("polling transport diagnostics remain available at debug without paid replay", async () => {
    await captureLogs(async (lines) => {
      mode = "poll-transport";
      await assert.rejects(image(), { message: /fixture polling transport failure/, retryable: false });
      assert.equal(submissions().length, 1);
      assert.equal(calls.filter((call) => call.method === "GET").length, 30);
      const warnings = lines.filter((line) => Number(line.level) >= 40);
      assert.equal(warnings.length, 1);
      assert.ok(!JSON.stringify(warnings).includes("fixture polling transport failure"));
      assert.ok(
        JSON.stringify(lines.filter((line) => line.level === 20)).includes("fixture polling transport failure"),
        "Transport diagnostic text must be present at debug",
      );
    });
  });
  await check("HTTP rejection details strip HTML and omit unrecognized task metadata", async () => {
    mode = "rejected-escaped";
    await assert.rejects(image(), { message: "ToAPIs images HTTP 401: Invalid [redacted]" });
    mode = "rejected-nested";
    await assert.rejects(image(), { message: "ToAPIs images HTTP 401: Invalid [redacted] at [redacted URL]" });
    mode = "rejected-nested-long";
    await assert.rejects(image(), (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.ok(error.message.length < 350);
      assert.equal(error.message.includes("fixtu"), false, "Truncation must not expose a partial key");
      return true;
    });
    mode = "rejected-escaped";
    await assert.rejects(
      generateImage("openai", "https://toapis.com/v1", "fixture-key ", "openai", {
        model: "gpt-image-2",
        prompt: "library",
      }),
      { message: "ToAPIs images HTTP 401: Invalid [redacted]" },
    );
    mode = "rejected-html";
    await assert.rejects(image(), { message: "ToAPIs images HTTP 403: Account not enabled" });
    mode = "rejected-metadata";
    await assert.rejects(image(), { message: "ToAPIs images HTTP 400" });
    assert.equal(submissions().length, 6);
  });
  await check("poll rejection diagnostics redact credentials, task IDs and URLs", async () => {
    mode = "poll-unauthorized";
    await assert.rejects(video({ fallback: videoFallback }), (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /HTTP 401: Task .* denied/);
      assert.ok(error.message.length < 350);
      for (const privateValue of ["fixture-key", "fixture-videos/private", "https://"]) {
        assert.equal(error.message.includes(privateValue), false);
      }
      assert.equal((error as Error & { retryable?: boolean }).retryable, false);
      return true;
    });
    assert.equal(submissions().length, 1);
  });
  await check("oversized HTTP error bodies remain capped and cannot activate paid fallback", async () => {
    mode = "rejected-oversized";
    await assert.rejects(image({ fallback: imageFallback }), { retryable: false });
    assert.equal(submissions().length, 1);
    assert.equal(
      calls.some((call) => new URL(call.url).hostname === "api.openai.com"),
      false,
    );
  });
  await check("validation before any paid submission can use the configured fallback", async () => {
    assert.equal((await image({ model: "unsupported", fallback: imageFallback })).base64, png);
    await video({ model: "unsupported", referenceImage: null, fallback: videoFallback });
    assert.equal(
      calls.some((call) => new URL(call.url).hostname === "toapis.com"),
      false,
    );
    assert.equal(submissions().length, 2);
  });
  await check("ambiguous and completed submissions never activate a paid fallback", async () => {
    for (const failure of ["uncertain", "missing-id", "poll-http", "bad-media", "failed"]) {
      mode = failure;
      await assert.rejects(image({ fallback: imageFallback }), { retryable: false });
      await assert.rejects(video({ fallback: videoFallback }), { retryable: false });
    }
    assert.equal(submissions().length, 10);
    assert.equal(
      calls.some((call) => ["api.openai.com", "api.seedance2.ai"].includes(new URL(call.url).hostname)),
      false,
    );
  });
  await check("API redirects cannot replay a paid POST or activate fallback", async () => {
    mode = "redirect";
    await assert.rejects(image({ fallback: imageFallback }), /submission unconfirmed/);
    assert.equal(submissions().length, 1);
    assert.equal(calls.length, 1);
  });
  await check("private output URLs are rejected before download", async () => {
    mode = "private-output";
    await assert.rejects(image());
    assert.equal(
      calls.some((call) => call.url.includes("127.0.0.1")),
      false,
    );
  });
  await check("cancellation before submission buys no task", async () => {
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(image({ signal: controller.signal }));
    await assert.rejects(video({ signal: controller.signal }));
    assert.equal(calls.length, 0);
  });
  await check("caller cancellation stops polling, preserves receipt", async () => {
    mode = "stall";
    const started = Date.now();
    await assert.rejects(video({ signal: AbortSignal.timeout(100) }));
    assert.ok(Date.now() - started < 1500);
    assert.equal(submissions().length, 1);
  });
  await check("invalid media rejected", async () => {
    mode = "bad-media";
    await assert.rejects(video(), /non-MP4/);
  });
  await check("image output honors the configured image response ceiling without paid fallback", async () => {
    mode = "oversized-media";
    await assert.rejects(image({ fallback: imageFallback }), { message: /exceeded 1024 bytes/, retryable: false });
    assert.equal(submissions().length, 1);
  });
  await check("video output honors the configured video response ceiling without paid fallback", async () => {
    mode = "oversized-media";
    await assert.rejects(video({ fallback: videoFallback }), { message: /exceeded 1024 bytes/, retryable: false });
    assert.equal(submissions().length, 1);
  });
  await check("reference upload deadline can use fallback before a paid task starts", async () => {
    const receiptCount = (await readdir(join(DATA_DIR, "toapis-tasks"))).length;
    mode = "stall-upload";
    const result = await image({ referenceImage: png, fallback: imageFallback });
    assert.equal(result.base64, png);
    assert.equal(transportGuardFired, false, "The provider deadline must fire before the fixture guard");
    assert.ok(transportAbortReason instanceof Error);
    assert.equal(transportAbortReason.name, "ImageGenerationDeadlineError");
    assert.equal(calls.filter((call) => new URL(call.url).pathname === "/v1/uploads/images").length, 1);
    assert.equal(
      calls.filter((call) => new URL(call.url).hostname === "toapis.com" && call.url.endsWith("/generations")).length,
      0,
    );
    assert.equal(calls.filter((call) => new URL(call.url).hostname === "api.openai.com").length, 1);
    assert.equal((await readdir(join(DATA_DIR, "toapis-tasks"))).length, receiptCount);
  });
  await check("deadline while saving an unpaid receipt preserves fallback and records no submission", async () => {
    const originalWrite = fs.writeFile;
    let receiptPath = "";
    let releaseSave: (() => void) | undefined;
    let receiptResaved: (() => void) | undefined;
    const heldSave = new Promise<void>((resolve) => (releaseSave = resolve));
    const resaved = new Promise<void>((resolve) => (receiptResaved = resolve));
    let guardFired = false;
    const guard = setTimeout(() => {
      guardFired = true;
      releaseSave?.();
    }, 5000);
    fs.writeFile = (async (...args: Parameters<typeof fs.writeFile>) => {
      const result = await originalWrite(...args);
      if (String(args[0]).includes("toapis-tasks")) {
        const receipt = JSON.parse(String(args[1]));
        if (receipt.status === "submitting") {
          receiptPath = String(args[0]);
          await heldSave;
        } else if (String(args[0]) === receiptPath) receiptResaved?.();
      }
      return result;
    }) as typeof fs.writeFile;
    syncBuiltinESMExports();
    let settleGuard: ReturnType<typeof setTimeout> | undefined;
    try {
      const result = await image({ fallback: imageFallback });
      releaseSave?.();
      await Promise.race([resaved, new Promise<void>((resolve) => (settleGuard = setTimeout(resolve, 500)))]);
      const receipt = JSON.parse(await readFile(receiptPath, "utf8"));
      assert.equal(result.base64, png);
      assert.equal(guardFired, false);
      assert.equal(receipt.status, "not_submitted");
      assert.equal(receipt.taskId, "");
      assert.equal(
        calls.filter((call) => new URL(call.url).hostname === "toapis.com" && call.url.endsWith("/generations")).length,
        0,
      );
      assert.equal(calls.filter((call) => new URL(call.url).hostname === "api.openai.com").length, 1);
    } finally {
      releaseSave?.();
      clearTimeout(guard);
      if (settleGuard) clearTimeout(settleGuard);
      fs.writeFile = originalWrite;
      syncBuiltinESMExports();
    }
  });
  await check("image deadline never submits a paid fallback", async () => {
    mode = "stall";
    await assert.rejects(image({ fallback: imageFallback }), { message: /timed out/, retryable: false });
    assert.equal(submissions().length, 1);
    assert.equal(
      calls.some((call) => new URL(call.url).hostname === "api.openai.com"),
      false,
    );
  });
  await check("custom connection image deadline is nonretryable too", async () => {
    mode = "stall";
    await assert.rejects(
      generateImage("custom", "https://toapis.com/v1", "fixture-key", "custom", {
        model: "gpt-image-2",
        prompt: "library",
        fallback: imageFallback,
      }),
      { message: /timed out/, retryable: false },
    );
    assert.equal(submissions().length, 1);
    assert.equal(
      calls.some((call) => new URL(call.url).hostname === "api.openai.com"),
      false,
    );
  });
  await check("a Gemini chat-image deadline on ToAPIs keeps its ordinary fallback", async () => {
    mode = "stall-chat";
    const result = await image({ model: "gemini-3-image", fallback: imageFallback });
    assert.equal(transportGuardFired, false, "The provider deadline must fire before the fixture guard");
    assert.ok(transportAbortReason instanceof Error);
    assert.equal(transportAbortReason.name, "ImageGenerationDeadlineError");
    assert.equal(result.base64, png);
    assert.equal(calls.filter((call) => new URL(call.url).pathname === "/v1/chat/completions").length, 1);
    assert.equal(
      calls.filter((call) => new URL(call.url).hostname === "toapis.com" && call.url.includes("/images/generations"))
        .length,
      0,
    );
    assert.equal(calls.filter((call) => new URL(call.url).hostname === "api.openai.com").length, 1);
  });
  await check("ordinary OpenAI path preserved", async () => {
    assert.equal(
      (
        await generateImage("openai", "https://api.openai.com/v1", "legacy-key", "openai", {
          model: "gpt-image-2",
          prompt: "library",
        })
      ).base64,
      png,
    );
    assert.equal(calls[0]!.url, "https://api.openai.com/v1/images/generations");
  });
  await check("ordinary Seedance path preserved", async () => {
    await generateVideo("seedance", "https://api.seedance2.ai", "legacy-key", "seedance", {
      prompt: "motion",
      durationSeconds: 4,
      aspectRatio: "16:9",
      resolution: "480p",
    });
    assert.ok((submissions()[0]!.body as Record<string, unknown>).input);
    assert.ok(calls.some((c) => c.url === "https://api.seedance2.ai/v1/tasks/legacy"));
  });
  await check("private receipts retain task identity without Key", async () => {
    const dir = join(DATA_DIR, "toapis-tasks");
    const receipts = await Promise.all((await readdir(dir)).map((file) => readFile(join(dir, file), "utf8")));
    assert.ok(receipts.some((text) => JSON.parse(text).status === "interrupted"));
    assert.ok(receipts.some((text) => JSON.parse(text).status === "submission_uncertain"));
    assert.ok(receipts.some((text) => JSON.parse(text).taskId === "fixture-videos"));
    assert.ok(receipts.every((text) => !text.includes("fixture-key")));
    assert.ok(receipts.every((text) => !text.includes("library") && !text.includes("gentle motion")));
    if (process.platform !== "win32") {
      assert.equal((await stat(dir)).mode & 0o777, 0o700);
      for (const file of await readdir(dir)) assert.equal((await stat(join(dir, file))).mode & 0o777, 0o600);
    }
  });

  const { createRequire } = await import("node:module");
  const requireServer = createRequire(new URL("../../packages/server/package.json", import.meta.url));
  const Fastify = requireServer("fastify") as typeof import("fastify").default;
  const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
  const { connectionsRoutes } = await import("../../packages/server/src/routes/connections.routes.js");
  const app = Fastify();
  app.decorate("db", await getDB());
  await app.register(connectionsRoutes, { prefix: "/api/connections" });
  let imageId = "",
    videoId = "";
  try {
    await check("real HTTP connection save, reload and Key masking", async () => {
      for (const kind of ["image", "video"]) {
        const saved = await app.inject({
          method: "POST",
          url: "/api/connections/",
          payload: {
            name: `ToAPIs fixture ${kind}`,
            provider: `${kind}_generation`,
            baseUrl: "https://toapis.com/v1",
            apiKey: "fixture-key",
            model: kind === "image" ? "gpt-image-2" : "seedance-2-mini",
            ...(kind === "image"
              ? { imageService: "openai", imageGenerationSource: "openai", defaultForAgents: true }
              : {
                  videoService: "seedance",
                  videoGenerationSource: "seedance",
                  defaultForAgents: true,
                }),
          },
        });
        assert.equal(saved.statusCode, 200, saved.body);
        const id = saved.json().id;
        assert.ok(id);
        if (kind === "image") imageId = id;
        else {
          videoId = id;
          const defaults = await app.inject({
            method: "PUT",
            url: `/api/connections/${id}/default-parameters`,
            payload: {
              videoGeneration: { service: "seedance", durationSeconds: 4, aspectRatio: "16:9", resolution: "480p" },
            },
          });
          assert.equal(defaults.statusCode, 200, defaults.body);
        }
        const loaded = await app.inject(`/api/connections/${id}`);
        assert.equal(loaded.statusCode, 200);
        assert.equal(loaded.json().baseUrl, "https://toapis.com/v1");
        assert.equal(loaded.body.includes("fixture-key"), false);
      }
    });
    await check("real HTTP Test Image button route", async () => {
      const response = await app.inject({ method: "POST", url: `/api/connections/${imageId}/test-image`, payload: {} });
      assert.equal(response.statusCode, 200, response.body);
      assert.equal(response.json().success, true, response.body);
      assert.equal(response.json().base64, png);
      assert.equal(submissions().length, 1);
    });
    await check("real HTTP Test Video button route", async () => {
      const response = await app.inject({ method: "POST", url: `/api/connections/${videoId}/test-video`, payload: {} });
      assert.equal(response.statusCode, 200, response.body);
      assert.equal(response.json().success, true, response.body);
      assert.equal(response.json().base64, mp4.toString("base64"));
      assert.equal(submissions().length, 1);
    });
    const { galleryRoutes } = await import("../../packages/server/src/routes/gallery.routes.js");
    const galleryApp = Fastify();
    galleryApp.decorate("db", app.db);
    await galleryApp.register(galleryRoutes, { prefix: "/api/gallery" });
    try {
      const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
      const { createChatSchema } = await import("../../packages/shared/src/schemas/chat.schema.js");
      const chats = createChatsStorage(app.db);
      const chat = await chats.create(
        createChatSchema.parse({
          name: "ToAPIs offline acceptance",
          mode: "roleplay",
        }),
      );
      await chats.updateMetadata(chat!.id, { sceneVideoConnectionId: videoId, illustratorImageConnectionId: imageId });
      let imageRow: { id: string; url: string };
      await check("real Gallery image generation and file download", async () => {
        const response = await galleryApp.inject({
          method: "POST",
          url: `/api/gallery/${chat!.id}/generate-image`,
          payload: { prompt: "library", promptOverride: "library" },
        });
        assert.equal(response.statusCode, 200, response.body);
        imageRow = response.json();
        assert.ok(imageRow.id && imageRow.url, response.body);
        const file = await galleryApp.inject(imageRow.url);
        assert.equal(file.statusCode, 200, file.body);
        assert.deepEqual(file.rawPayload, Buffer.from(png, "base64"));
      });
      await check("real Gallery first-frame video generation", async () => {
        const response = await galleryApp.inject({
          method: "POST",
          url: "/api/gallery/generate-scene-video",
          payload: {
            chatId: chat!.id,
            galleryImageId: imageRow!.id,
            promptOverride: "gentle motion",
            durationSeconds: 4,
            aspectRatio: "16:9",
          },
        });
        assert.equal(response.statusCode, 200, response.body);
        assert.equal(submissions().length, 1);
        assert.ok((submissions()[0]!.body as Record<string, unknown>).image_with_roles);
        const list = await galleryApp.inject(`/api/gallery/scene-videos/${chat!.id}`);
        assert.equal(list.statusCode, 200, list.body);
        assert.ok(list.body.includes("seedance-2-mini"), list.body);
      });
      await check("real Gallery rejection keeps its UI reason while serialized warning stays private", async () => {
        await captureLogs(async (lines) => {
          mode = "rejected";
          const response = await galleryApp.inject({
            method: "POST",
            url: `/api/gallery/${chat!.id}/generate-image`,
            payload: { prompt: "library", promptOverride: "library" },
          });
          assert.equal(response.statusCode, 502, response.body);
          assert.match(response.json().error, /HTTP 401: fixture rejection/);
          const warnings = lines.filter((line) => Number(line.level) >= 40);
          assert.ok(warnings.some((line) => String(line.msg).includes("[gallery/generate-image]")));
          assert.ok(!JSON.stringify(warnings).includes("fixture rejection"));
          assert.ok(JSON.stringify(warnings).includes('"status":401'));
          assert.ok(JSON.stringify(lines.filter((line) => line.level === 20)).includes("fixture rejection"));
          assert.equal(submissions().length, 1);
        });
      });
      await check("real Gallery uncertain tasks retain a safe receipt pointer in serialized warnings", async () => {
        await captureLogs(async (lines) => {
          const receiptIds = new Set<string>();
          for (const failure of ["uncertain", "missing-id"]) {
            mode = failure;
            const response = await galleryApp.inject({
              method: "POST",
              url: `/api/gallery/${chat!.id}/generate-image`,
              payload: { prompt: "library", promptOverride: "library" },
            });
            assert.equal(response.statusCode, 502, response.body);
            const receiptId = /local receipt ([a-f0-9-]{36})/i.exec(response.json().error)?.[1];
            assert.ok(receiptId, "The existing UI message names its local receipt");
            receiptIds.add(receiptId);
            const warning = lines
              .filter((line) => Number(line.level) >= 40 && String(line.msg).includes("[gallery/generate-image]"))
              .at(-1);
            assert.ok(warning);
            assert.equal(warning.localReceiptId, receiptId);
            const receipt = JSON.parse(await readFile(join(DATA_DIR, "toapis-tasks", `${receiptId}.json`), "utf8"));
            assert.equal(receipt.localId, receiptId);
            assert.equal(receipt.status, "submission_uncertain");
            assert.ok(!JSON.stringify(warning).includes("fixture-key"));
            assert.ok(!JSON.stringify(warning).includes('"stack"'));
            assert.ok(!JSON.stringify(warning).includes('"cause"'));
          }
          assert.equal(receiptIds.size, 2, "Separate tasks retain distinguishable local receipt pointers");
          assert.equal(submissions().length, 2);
        });
      });
    } finally {
      await galleryApp.close();
    }
  } finally {
    await app.close();
    await closeDB();
  }
} finally {
  globalThis.fetch = originalFetch;
  dns.lookup = originalLookup;
}
process.stdout.write(`${passed} offline integration checks passed; 0 live tasks.\n`);
