import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
const requireServer = createRequire(new URL("../../../packages/server/package.json", import.meta.url));
const Fastify = requireServer("fastify") as typeof import("fastify").default;
import { TTS_SETTINGS_KEY, ttsAudioFormatSchema } from "../../../packages/shared/src/types/tts.js";
import { resolveTTSPcmFormat, ttsRoutes, wrapTTSPcm16AsWav } from "../../../packages/server/src/routes/tts.routes.js";

assert.equal(ttsAudioFormatSchema.parse("mp3"), "mp3");
assert.equal(ttsAudioFormatSchema.parse("wav"), "wav");
assert.equal(ttsAudioFormatSchema.parse("pcm"), "pcm");
assert.deepEqual(resolveTTSPcmFormat("audio/pcm; rate=48000; channels=2", "http://localhost:8000/v1"), {
  sampleRate: 48_000,
  channels: 2,
});
assert.deepEqual(resolveTTSPcmFormat("audio/pcm;rate=24000;channels=1", "https://provider.example/v1"), {
  sampleRate: 24_000,
  channels: 1,
});
assert.deepEqual(resolveTTSPcmFormat('audio/pcm; RATE="48000"; CHANNELS="2"', "https://provider.example/v1"), {
  sampleRate: 48_000,
  channels: 2,
});
assert.deepEqual(resolveTTSPcmFormat("audio/pcm", "https://api.openai.com/v1"), { sampleRate: 24_000, channels: 1 });
for (const contentType of [
  "audio/pcm;rate=;channels=1",
  "audio/pcm;rate=7999;channels=1",
  "audio/pcm;rate=192001;channels=1",
  "audio/pcm;rate=24000.5;channels=1",
  "audio/pcm;rate=24000;rate=48000;channels=1",
  "audio/pcm;rate=24000;channels=1;channels=2",
  "audio/pcm;rate=24000;channels=0",
  "audio/pcm;rate=24000;channels=9",
  "audio/pcm;rate=24000",
]) {
  assert.throws(() => resolveTTSPcmFormat(contentType, "https://provider.example/v1"), undefined, contentType);
}
assert.throws(() => resolveTTSPcmFormat("audio/pcm", "http://api.openai.com/v1"), /omitted PCM rate/u);
assert.throws(() => resolveTTSPcmFormat("audio/pcm", "https://api.openai.com.evil.test/v1"), /omitted PCM rate/u);
assert.throws(
  () => resolveTTSPcmFormat("audio/pcm;rate=7999;channels=1", "https://api.openai.com/v1"),
  /invalid PCM rate/u,
);

// The first PCM sample is FF FF, valid signed PCM that a weak sniffer can mistake for MP3.
const pcm = new Uint8Array(4_800 * 4);
const pcmView = new DataView(pcm.buffer);
for (let frame = 0; frame < 4_800; frame++) {
  pcmView.setInt16(frame * 4, frame === 0 ? -1 : 8_192, true);
  pcmView.setInt16(frame * 4 + 2, frame === 0 ? 32_767 : -8_192, true);
}
const wav = wrapTTSPcm16AsWav(pcm, { sampleRate: 48_000, channels: 2 });
const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);
const text = (bytes: Uint8Array, offset: number, length: number) =>
  String.fromCharCode(...bytes.slice(offset, offset + length));
assert.equal(text(wav, 0, 4), "RIFF");
assert.equal(text(wav, 8, 4), "WAVE");
assert.equal(text(wav, 12, 4), "fmt ");
assert.equal(view.getUint16(20, true), 1, "PCM format tag");
assert.equal(view.getUint16(22, true), 2, "stereo channel count");
assert.equal(view.getUint32(24, true), 48_000, "declared sample rate");
assert.equal(view.getUint32(28, true), 192_000, "byte rate");
assert.equal(view.getUint16(32, true), 4, "frame alignment");
assert.equal(view.getUint16(34, true), 16, "16-bit PCM samples");
assert.equal(text(wav, 36, 4), "data");
assert.equal(view.getUint32(40, true), pcm.byteLength);
assert.deepEqual([...wav.slice(44)], [...pcm]);
assert.throws(() => wrapTTSPcm16AsWav(new Uint8Array(), { sampleRate: 24_000, channels: 1 }), /empty PCM/u);
assert.throws(() => wrapTTSPcm16AsWav(new Uint8Array([1]), { sampleRate: 24_000, channels: 1 }), /incomplete frame/u);
assert.throws(
  () => wrapTTSPcm16AsWav(new Uint8Array([1, 2]), { sampleRate: 24_000, channels: 2 }),
  /incomplete frame/u,
);

// The provider fixture is loopback-only: it captures the actual route request and never contacts a provider.
process.env.TTS_LOCAL_URLS_ENABLED = "true";
let providerMode: { contentType: string; body: Uint8Array; status?: number } = {
  contentType: "audio/pcm;rate=48000;channels=2",
  body: pcm,
};
let capturedRequest: { pathname: string; body: Record<string, unknown> } | null = null;
const provider = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  capturedRequest = {
    pathname: new URL(request.url ?? "/", "http://127.0.0.1").pathname,
    body: JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>,
  };
  response.writeHead(
    providerMode.status ?? 200,
    providerMode.contentType ? { "content-type": providerMode.contentType } : {},
  );
  response.end(providerMode.body);
});
let app: ReturnType<typeof Fastify> | undefined;
let browser: import("playwright").Browser | undefined;
try {
  await new Promise<void>((resolve) => provider.listen(0, "127.0.0.1", resolve));
  const providerAddress = provider.address();
  assert.ok(providerAddress && typeof providerAddress !== "string");

  const isolatedData = mkdtempSync(join(tmpdir(), "marinara-tts-pcm-"));
  process.env.DATA_DIR = isolatedData;
  process.env.FILE_STORAGE_DIR = join(isolatedData, "storage");
  const { createFileNativeDB } = await import("../../../packages/server/src/db/file-backed-store.js");
  const { createAppSettingsStorage } =
    await import("../../../packages/server/src/services/storage/app-settings.storage.js");
  const db = await createFileNativeDB();
  await createAppSettingsStorage(db).set(
    TTS_SETTINGS_KEY,
    JSON.stringify({
      enabled: true,
      source: "openai",
      apiKey: "",
      baseUrl: `http://127.0.0.1:${providerAddress.port}/v1`,
      model: "tts-1",
      voice: "alloy",
      audioFormat: "pcm",
    }),
  );
  app = Fastify();
  app.decorate("db", db);
  await app.register(ttsRoutes, { prefix: "/api/tts" });
  const speak = () => app!.inject({ method: "POST", url: "/api/tts/speak", payload: { text: "fixture speech" } });
  const response = await speak();
  assert.equal(response.statusCode, 200);
  const captured = capturedRequest as { pathname: string; body: Record<string, unknown> } | null;
  assert.ok(captured, "the synthetic provider received the request");
  assert.equal(captured.pathname, "/v1/audio/speech");
  assert.equal(captured.body.response_format, "pcm", "the actual route must request raw PCM");
  assert.equal(response.headers["content-type"], "audio/wav");
  assert.equal(Number(response.headers["content-length"]), response.rawPayload.byteLength);
  assert.deepEqual([...response.rawPayload], [...wav]);
  assert.deepEqual(
    [...response.rawPayload.slice(44, 46)],
    [0xff, 0xff],
    "the weak MP3-signature samples are preserved",
  );

  if (process.env.TTS_PCM_BROWSER_PROOF === "1") {
    // Chromium's WebAudio decoder verifies that the actual route response is playable WAV.
    const regressionRequire = createRequire(import.meta.url);
    const { chromium, webkit, devices } = regressionRequire("@playwright/test") as typeof import("@playwright/test");
    for (const [browserType, device] of [
      [chromium, devices["Desktop Chrome"]],
      [chromium, devices["Pixel 7"]],
      [webkit, devices["iPhone 15 Pro"]],
    ] as const) {
      browser = await browserType.launch({ headless: true });
      const page = await browser.newPage({ ...device });
      const decoded = await page.evaluate(async (base64) => {
        const binary = atob(base64);
        const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
        const context = new AudioContext({ sampleRate: 48_000 });
        try {
          const audio = await context.decodeAudioData(bytes.buffer);
          return {
            duration: audio.duration,
            channels: audio.numberOfChannels,
            sampleRate: audio.sampleRate,
            firstLeftSample: audio.getChannelData(0)[0],
            firstRightSample: audio.getChannelData(1)[0],
          };
        } finally {
          await context.close();
        }
      }, response.rawPayload.toString("base64"));
      assert.equal(decoded.channels, 2);
      assert.equal(decoded.sampleRate, 48_000);
      assert.ok(Math.abs(decoded.duration - pcm.byteLength / (48_000 * 4)) < 0.0001);
      assert.ok(Math.abs(decoded.firstLeftSample + 1 / 32_768) < 0.00001);
      assert.ok(Math.abs(decoded.firstRightSample - 32_767 / 32_768) < 0.0001);
      console.info(`TTS PCM browser decode proof ran: ${browserType.name()} ${device.userAgent}`);
      await browser.close();
      browser = undefined;
    }
  } else {
    console.info("TTS PCM browser decode proof not run (set TTS_PCM_BROWSER_PROOF=1 to opt in)");
  }

  const wavFixture = wrapTTSPcm16AsWav(pcm, { sampleRate: 24_000, channels: 1 });
  providerMode = { contentType: "audio/wav", body: wavFixture };
  const wavResponse = await speak();
  assert.equal(wavResponse.statusCode, 200);
  assert.equal(wavResponse.headers["content-type"], "audio/wav");
  assert.deepEqual([...wavResponse.rawPayload], [...wavFixture], "provider WAV passes through unchanged");

  providerMode = { contentType: "audio/pcm;rate=24000;channels=1", body: wavFixture };
  const pcmDeclaredWav = await speak();
  assert.equal(pcmDeclaredWav.statusCode, 200);
  assert.equal(pcmDeclaredWav.headers["content-type"], "audio/wav");
  assert.deepEqual(
    [...pcmDeclaredWav.rawPayload],
    [...wavFixture],
    "WAV in an audio/pcm response passes through unchanged",
  );

  providerMode = { contentType: "audio/pcm;rate=24000;channels=1", body: wavFixture.slice(0, 44) };
  const truncatedWav = await speak();
  assert.equal(truncatedWav.statusCode, 502, "truncated RIFF data is rejected");
  assert.match(truncatedWav.json<{ detail: string }>().detail, /malformed WAV/u);

  // Internally consistent RIFF lengths must not hide invalid subchunks.
  const emptyData = wavFixture.slice(0, 44);
  new DataView(emptyData.buffer).setUint32(4, emptyData.length - 8, true);
  new DataView(emptyData.buffer).setUint32(40, 0, true);
  const overflowingData = emptyData.slice();
  new DataView(overflowingData.buffer).setUint32(40, 8, true);
  const missingFormat = wavFixture.slice();
  missingFormat.set(new TextEncoder().encode("JUNK"), 12);
  const shortFormat = wavFixture.slice();
  new DataView(shortFormat.buffer).setUint32(16, 2, true);
  const partialFrame = wav.slice(0, 46);
  new DataView(partialFrame.buffer).setUint32(4, partialFrame.length - 8, true);
  new DataView(partialFrame.buffer).setUint32(40, 2, true);
  const invalidFloatFields = [32, 34].map((offset) => {
    const body = wavFixture.slice();
    const view = new DataView(body.buffer);
    view.setUint16(20, 3, true);
    view.setUint16(offset, 0, true);
    return body;
  });
  const invalidFormatFields = [
    [22, 0],
    [24, 0],
    [28, 0],
    [32, 0],
    [34, 0],
    [28, 1],
    [32, 1],
  ].map(([offset, value]) => {
    const body = wavFixture.slice();
    const view = new DataView(body.buffer);
    if (offset === 24 || offset === 28) view.setUint32(offset, value, true);
    else view.setUint16(offset, value, true);
    return body;
  });
  for (const body of [
    emptyData,
    overflowingData,
    missingFormat,
    shortFormat,
    partialFrame,
    ...invalidFormatFields,
    ...invalidFloatFields,
  ]) {
    providerMode = { contentType: "audio/pcm", body };
    const invalidWav = await speak();
    assert.equal(invalidWav.statusCode, 502, "invalid WAV subchunks are rejected despite a valid RIFF size");
    assert.match(invalidWav.json<{ detail: string }>().detail, /malformed WAV/u);
  }
  const floatWav = wrapTTSPcm16AsWav(new Uint8Array(8), { sampleRate: 24_000, channels: 1 });
  const floatView = new DataView(floatWav.buffer);
  floatView.setUint16(20, 3, true);
  floatView.setUint32(28, 96_000, true);
  floatView.setUint16(32, 4, true);
  floatView.setUint16(34, 32, true);
  providerMode = { contentType: "audio/pcm", body: floatWav };
  const floatResponse = await speak();
  assert.equal(floatResponse.statusCode, 200);
  assert.deepEqual([...floatResponse.rawPayload], [...floatWav], "complete float WAV frames pass through unchanged");
  // A padded odd-sized metadata chunk is valid and must be passed through.
  const withMetadata = new Uint8Array(wavFixture.length + 10);
  withMetadata.set(wavFixture.subarray(0, 12));
  withMetadata.set(new TextEncoder().encode("JUNK"), 12);
  new DataView(withMetadata.buffer).setUint32(16, 1, true);
  withMetadata[20] = 42;
  withMetadata.set(wavFixture.subarray(12), 22);
  new DataView(withMetadata.buffer).setUint32(4, withMetadata.length - 8, true);
  providerMode = { contentType: "audio/pcm", body: withMetadata };
  const metadataWav = await speak();
  assert.equal(metadataWav.statusCode, 200);
  assert.deepEqual(metadataWav.rawPayload, Buffer.from(withMetadata));

  const mp3Fixture = new Uint8Array([0xff, 0xff, 0x90, 0x64]);
  providerMode = { contentType: "audio/mpeg", body: mp3Fixture };
  const mp3Response = await speak();
  assert.equal(mp3Response.statusCode, 200);
  assert.equal(mp3Response.headers["content-type"], "audio/mpeg");
  assert.deepEqual([...mp3Response.rawPayload], [...mp3Fixture], "provider MP3 passes through unchanged");

  providerMode = { contentType: "audio/pcm;rate=24000;rate=48000;channels=1", body: pcm };
  const malformedMetadata = await speak();
  assert.equal(malformedMetadata.statusCode, 502, "invalid PCM metadata is rejected by the route");
  assert.match(malformedMetadata.json<{ error: string }>().error, /invalid PCM audio/u);

  providerMode = { contentType: "application/octet-stream", body: pcm };
  const unknownFormat = await speak();
  assert.equal(unknownFormat.statusCode, 502, "generic audio without PCM layout is rejected");
  assert.match(unknownFormat.json<{ detail: string }>().detail, /omitted PCM rate/u);

  providerMode = { contentType: "", body: pcm };
  const missingMime = await speak();
  assert.equal(missingMime.statusCode, 502, "missing media type without PCM metadata is rejected");
  assert.match(missingMime.json<{ detail: string }>().detail, /omitted PCM rate/u);

  providerMode = { contentType: "audio/pcm;rate=48000;channels=2", body: new Uint8Array() };
  const emptyPcm = await speak();
  assert.equal(emptyPcm.statusCode, 502, "empty PCM is rejected");
  assert.match(emptyPcm.json<{ detail: string }>().detail, /empty PCM/u);

  providerMode = { contentType: "audio/pcm;rate=24000;channels=1", body: new Uint8Array([1]) };
  const oddPcm = await speak();
  assert.equal(oddPcm.statusCode, 502, "odd PCM byte count is rejected");
  assert.match(oddPcm.json<{ detail: string }>().detail, /incomplete frame/u);

  providerMode = { contentType: "audio/pcm;rate=48000;channels=2", body: new Uint8Array([0, 0]) };
  const incompleteFrame = await speak();
  assert.equal(incompleteFrame.statusCode, 502, "incomplete stereo frame is rejected at the route");
  assert.match(incompleteFrame.json<{ detail: string }>().detail, /incomplete frame/u);

  providerMode = { contentType: "application/json", body: new TextEncoder().encode('{"error":"bad provider body"}') };
  const jsonBody = await speak();
  assert.equal(jsonBody.statusCode, 502, "a successful JSON provider response is not treated as audio");
  assert.match(jsonBody.json<{ error: string }>().error, /non-audio response/u);

  providerMode = { contentType: "audio/pcm;rate=48000;channels=2", body: pcm, status: 503 };
  const providerFailure = await speak();
  assert.equal(providerFailure.statusCode, 502, "provider errors remain gateway errors");
  assert.match(providerFailure.json<{ error: string }>().error, /provider returned 503/u);
} finally {
  try {
    await browser?.close();
  } finally {
    try {
      await app?.close();
    } finally {
      if (provider.listening) {
        await new Promise<void>((resolve, reject) => provider.close((error) => (error ? reject(error) : resolve())));
      }
    }
  }
}

console.info("TTS PCM regression passed");
