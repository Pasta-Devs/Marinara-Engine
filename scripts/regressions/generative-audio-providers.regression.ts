// Provider wire contracts through real safeFetch, with all HTTP responses local to this process.
// No paid API call, DNS lookup (public literal fixture IPs), file download or provider key leaves it.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const directory = mkdtempSync(join(tmpdir(), "marinara-audio-provider-"));
process.env.DATA_DIR = directory;
process.env.FILE_STORAGE_DIR = join(directory, "storage");
process.env.MARINARA_ENV_FILE = join(directory, ".env");
const { generateAudioBytes, AudioGenerationProviderError } =
  await import("../../packages/server/src/services/audio/generative-audio-providers.js");
const bytes = Buffer.from([0xff, 0xfb, 0x90, 0, 1]);
const apiBase = "https://8.8.8.8";
const downloadUrl = "https://1.1.1.1/track.mp3";
const key = "fixture-private-provider-key";
type Call = {
  url: URL;
  method: string;
  headers: Headers;
  body: Record<string, unknown> | null;
  signal?: AbortSignal | null;
};
const calls: Call[] = [];
let handler: (call: Call) => Response | Promise<Response>;
const originalFetch = globalThis.fetch;
const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });
const audio = () => new Response(bytes, { headers: { "content-type": "audio/mpeg" } });
const success = (url = downloadUrl) =>
  json({ code: 200, data: { status: "SUCCESS", response: { sunoData: [{ audio_url: url }] } } });
const suno = {
  source: "sunoapi" as const,
  baseUrl: apiBase,
  apiKey: key,
  model: "V6",
  callbackUrl: "https://9.9.9.9/callback",
};
const eleven = { source: "elevenlabs" as const, baseUrl: `${apiBase}/v1`, apiKey: key, model: "music_v2" };
const custom = {
  source: "custom" as const,
  baseUrl: `${apiBase}/v1`,
  apiKey: key,
  model: "custom-music",
  musicEndpoint: "music",
  soundEffectsEndpoint: "sfx",
};
const reset = (next: typeof handler) => {
  calls.length = 0;
  handler = next;
};
try {
  globalThis.fetch = async (input, init) => {
    init?.signal?.throwIfAborted();
    const call: Call = {
      url: new URL(String(input)),
      method: init?.method ?? "GET",
      headers: new Headers(init?.headers),
      body: init?.body ? JSON.parse(String(init.body)) : null,
      signal: init?.signal,
    };
    calls.push(call);
    return handler(call);
  };
  const debug: unknown[] = [];
  reset(() => audio());
  assert.deepEqual(
    await generateAudioBytes(eleven, "music", "A hopeful instrumental", {
      lengthMs: 60_000,
      debugLog: (_label, value) => debug.push(value),
    }),
    bytes,
  );
  assert.equal(calls[0]!.url.href, `${apiBase}/v1/music?output_format=mp3_44100_128`);
  assert.equal(calls[0]!.headers.get("xi-api-key"), key);
  assert.equal(calls[0]!.headers.get("authorization"), null);
  assert.deepEqual(calls[0]!.body, {
    prompt: "A hopeful instrumental",
    model_id: "music_v2",
    music_length_ms: 60_000,
    force_instrumental: true,
  });
  assert.match(JSON.stringify(debug), /hopeful instrumental/);
  assert(!JSON.stringify(debug).includes(key), "debug prompt logging excludes credentials");
  reset(() => audio());
  await generateAudioBytes(eleven, "sfx", "A short chime", { lengthMs: 2500 });
  assert.equal(calls[0]!.url.pathname, "/v1/sound-generation");
  assert.equal(calls[0]!.body?.model_id, "eleven_text_to_sound_v2", "the music model is never used as the SFX default");
  assert.equal(calls[0]!.body?.duration_seconds, 2.5);

  let polls = 0;
  reset((call) => {
    if (call.method === "POST") return json({ code: 200, data: { taskId: "task/one" } });
    if (call.url.origin === apiBase)
      return ++polls === 1 ? json({ code: 200, data: { status: "PENDING" } }) : success();
    return audio();
  });
  assert.deepEqual(await generateAudioBytes(suno, "music", "Bright cinematic strings", { lengthMs: 120_000 }), bytes);
  assert.deepEqual(calls[0]!.body, {
    customMode: true,
    instrumental: true,
    style: "Bright cinematic strings",
    model: "V6",
    callBackUrl: suno.callbackUrl,
    duration: 120,
  });
  assert.equal(calls[0]!.url.pathname, "/api/v1/generate");
  assert.equal(calls[1]!.url.searchParams.get("taskId"), "task/one");
  assert.equal(calls.filter((call) => call.method === "POST").length, 1, "pending tasks are polled, never resubmitted");
  for (const call of calls.filter((call) => call.url.origin === apiBase))
    assert.equal(call.headers.get("authorization"), `Bearer ${key}`);
  const download = calls.at(-1)!;
  assert.equal(download.url.href, downloadUrl);
  assert.equal(download.headers.get("authorization"), null);
  assert.equal(download.headers.get("xi-api-key"), null, "CDN downloads never receive provider credentials");

  const taskHandler = (call: Call) =>
    call.method === "POST"
      ? json({ code: 200, data: { taskId: "sounds" } })
      : call.url.origin === apiBase
        ? success()
        : audio();
  for (const model of ["V4_5", "V5"]) {
    reset(taskHandler);
    assert.deepEqual(
      await generateAudioBytes({ ...suno, model }, "music", "Legacy instrumental", { lengthMs: 60_000 }),
      bytes,
    );
    assert.equal("duration" in calls[0]!.body!, false, "older supported models choose their own duration");
  }
  reset(taskHandler);
  assert.deepEqual(
    await generateAudioBytes({ ...suno, soundEffectsModel: "V6_MINI" }, "sfx", "A decisive sword clash"),
    bytes,
  );
  assert.equal(calls[0]!.url.pathname, "/api/v1/generate/sounds");
  assert.deepEqual(calls[0]!.body, { prompt: "A decisive sword clash", model: "V6_MINI", soundLoop: false });
  assert.equal(
    calls[1]!.url.pathname,
    "/api/v1/generate/record-info",
    "the explicit shared-task lookup inference is covered",
  );

  reset(() => audio());
  assert.deepEqual(await generateAudioBytes(custom, "music", "Custom instrumental", { lengthMs: 15_000 }), bytes);
  assert.equal(calls[0]!.url.pathname, "/v1/music");
  assert.deepEqual(calls[0]!.body, {
    model: "custom-music",
    prompt: "Custom instrumental",
    duration: 15,
    response_format: "mp3",
  });
  reset(() => json({ choices: [{ message: { audio: { data: bytes.toString("base64") } } }] }));
  assert.deepEqual(
    await generateAudioBytes(
      { ...custom, requestFormat: "chat_completions", soundEffectsEndpoint: "chat/completions" },
      "sfx",
      "A chime",
    ),
    bytes,
  );
  assert.equal(calls[0]!.body?.stream, false);
  assert.deepEqual(calls[0]!.body?.audio_config, { duration: 5, instrumental: true, format: "mp3" });

  reset(() => audio());
  await assert.rejects(generateAudioBytes({ ...suno, callbackUrl: null }, "music", "Theme"), /callback URL/);
  await assert.rejects(generateAudioBytes({ ...suno, callbackUrl: "https://127.0.0.1/callback" }, "music", "Theme"));
  await assert.rejects(generateAudioBytes(suno, "sfx", "x".repeat(501)), /500 characters/);
  await assert.rejects(generateAudioBytes(suno, "music", "x".repeat(1001)), /1000 characters/);
  assert.equal(calls.length, 0, "invalid provider input is rejected before any paid submission");

  reset(() => new Response('{"error":"not audio"}', { headers: { "content-type": "audio/mpeg" } }));
  await assert.rejects(generateAudioBytes(eleven, "sfx", "Chime"), /valid MP3/);
  await assert.rejects(generateAudioBytes(custom, "music", "Theme"), /valid MP3/);
  reset(() => new Response(null, { status: 307, headers: { location: downloadUrl } }));
  await assert.rejects(generateAudioBytes(eleven, "music", "Theme"), /redirect limit/);
  assert.equal(calls.length, 1, "a paid native request is never replayed after a redirect");
  reset(() => new Response(key, { status: 401 }));
  await assert.rejects(
    generateAudioBytes(suno, "sfx", "Chime"),
    (error: Error) => /HTTP 401/.test(error.message) && !error.message.includes(key),
  );

  const rejection = async (body: unknown, config: typeof eleven & { callbackUrl?: string } = eleven) => {
    reset(() => new Response(JSON.stringify(body), { status: 400 }));
    let caught: unknown;
    try {
      await generateAudioBytes(config, "music", "A test sample", { lengthMs: 10_000 });
    } catch (error) {
      caught = error;
    }
    assert(caught instanceof AudioGenerationProviderError);
    assert.equal(caught.message, "ElevenLabs audio request returned HTTP 400", "legacy status detail is stable");
    assert.equal(caught.providerStatus, 400);
    assert.equal(calls.length, 1, "an upstream rejection never retries the paid POST");
    return caught;
  };
  const rejected = await rejection({
    detail: { status: "invalid_model_id", message: "Select a supported music model." },
  });
  assert.equal(rejected.reason, "Select a supported music model.");
  assert.equal(rejected.providerCode, "invalid_model_id");
  const validation = await rejection({ detail: [{ msg: "Invalid output format", input: key }] });
  assert.equal(validation.reason, "Invalid output format", "validation input fields are never exposed");
  const stringError = await rejection({ error: "Invalid API key", message: "unrelated fallback" });
  assert.equal(stringError.reason, "Invalid API key");
  assert.equal((await rejection({ error: `Invalid API key ${key}` })).reason, "Invalid API key [redacted]");
  const stringCode = await rejection({ error: "invalid_api_key" });
  assert.equal(stringCode.providerCode, "invalid_api_key");
  assert.equal(stringCode.reason, undefined, "machine codes do not masquerade as human reasons");
  const callbackUrl = `${eleven.baseUrl}/private-callback`;
  const redacted = await rejection(
    {
      detail: {
        message: `Use <b>another model</b>\n${key} ${eleven.baseUrl} ${callbackUrl} https://private.example/token?q=secret ${"x".repeat(400)}`,
      },
    },
    { ...eleven, callbackUrl },
  );
  assert(redacted.reason!.length <= 300);
  for (const secret of [key, eleven.baseUrl, callbackUrl, "private-callback", "private.example", "<b>", "\n"])
    assert(!redacted.reason!.includes(secret), "secrets and markup are removed before the display cap");
  for (const body of [
    null,
    [],
    { raw: key },
    { detail: { message: { secret: key } } },
    { message: "x".repeat(16 * 1024) },
  ])
    assert.equal((await rejection(body)).reason, undefined);
  assert.equal((await rejection({ message: "Safe reason", code: key })).providerCode, undefined);
  reset(() => new Response(JSON.stringify({ code: "quota_exceeded", msg: "Insufficient credits." }), { status: 402 }));
  await assert.rejects(generateAudioBytes(suno, "music", "A test sample"), (error: unknown) => {
    assert(error instanceof AudioGenerationProviderError);
    assert.equal(error.providerStatus, 402);
    assert.equal(error.providerCode, "quota_exceeded");
    assert.equal(error.reason, "Insufficient credits.");
    return true;
  });

  reset((call) =>
    call.method === "POST"
      ? json({ code: 200, data: { taskId: "failed" } })
      : json({ code: 200, data: { status: "GENERATE_AUDIO_FAILED" } }),
  );
  await assert.rejects(generateAudioBytes(suno, "music", "Theme"), /task failed/);
  assert.equal(calls.length, 2);
  for (const url of ["http://127.0.0.1/private", "https://127.0.0.1/private", "https://user:pass@1.1.1.1/audio.mp3"]) {
    reset((call) => (call.method === "POST" ? json({ code: 200, data: { taskId: "unsafe" } }) : success(url)));
    await assert.rejects(generateAudioBytes(suno, "sfx", "Chime"));
    assert.equal(calls.length, 2, "unsafe task-result URLs are rejected before download");
  }
  reset((call) =>
    call.method === "POST"
      ? json({ code: 200, data: { taskId: "redirect" } })
      : call.url.origin === apiBase
        ? success()
        : call.url.hostname === "1.1.1.1"
          ? new Response(null, { status: 302, headers: { location: "https://9.9.9.9/final.mp3" } })
          : audio(),
  );
  await generateAudioBytes(suno, "sfx", "Chime");
  for (const call of calls.filter((call) => call.url.origin !== apiBase))
    assert.equal(call.headers.get("authorization"), null);

  for (const config of [eleven, custom]) {
    const controller = new AbortController();
    reset(
      (call) =>
        new Promise<Response>((_resolve, reject) => {
          call.signal?.addEventListener("abort", () => reject(call.signal!.reason), { once: true });
          queueMicrotask(() => controller.abort(new DOMException("Fixture cancelled", "AbortError")));
        }),
    );
    await assert.rejects(generateAudioBytes(config, "sfx", "Chime", { signal: controller.signal }), {
      name: "AbortError",
    });
    assert.equal(calls.length, 1, "aborting an in-flight request does not submit another");
  }
  const pollingAbort = new AbortController();
  reset((call) => {
    if (call.method === "POST") return json({ code: 200, data: { taskId: "cancelled" } });
    pollingAbort.abort(new DOMException("Stop polling", "AbortError"));
    return json({ code: 200, data: { status: "PENDING" } });
  });
  await assert.rejects(generateAudioBytes(suno, "sfx", "Chime", { signal: pollingAbort.signal }), {
    name: "AbortError",
  });
  assert.equal(calls.length, 2, "cancelling a submitted task ends polling without resubmitting");

  reset(
    () =>
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new Uint8Array(60 * 1024 * 1024 + 1));
            controller.close();
          },
        }),
      ),
  );
  await assert.rejects(generateAudioBytes(eleven, "music", "Theme"), /exceeded 62914560 bytes/);
} finally {
  globalThis.fetch = originalFetch;
  rmSync(directory, { recursive: true, force: true });
}
console.log("Generative audio provider contracts, MP3 bounds, cancellation and credential isolation passed.");
