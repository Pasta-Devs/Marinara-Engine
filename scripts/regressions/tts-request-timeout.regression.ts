import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
const requireServer = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const Fastify = requireServer("fastify") as typeof import("fastify").default;
import {
  TTS_REQUEST_TIMEOUT_MS,
  TTS_SETTINGS_KEY,
  resolveTtsRequestTimeoutMs,
  ttsConfigSchema,
} from "../../packages/shared/src/types/tts.js";
import { createConnectionSchema } from "../../packages/shared/src/schemas/connection.schema.js";
import { ttsRoutes } from "../../packages/server/src/routes/tts.routes.js";

// #7711: a voice server on a laptop needed more than the fixed 60 s, and nothing let the user wait longer.
// Each speech setup now has its own limit, set in the app: the Text to Speech card, and every audio connection.
assert.equal(TTS_REQUEST_TIMEOUT_MS.default, 60_000, "the default is the limit every request had before");
assert.equal(resolveTtsRequestTimeoutMs(undefined), 60_000);
assert.equal(resolveTtsRequestTimeoutMs(null), 60_000);
assert.equal(resolveTtsRequestTimeoutMs(300_000), 300_000);
assert.equal(resolveTtsRequestTimeoutMs(1_000), TTS_REQUEST_TIMEOUT_MS.min);
assert.equal(resolveTtsRequestTimeoutMs(99_000_000), TTS_REQUEST_TIMEOUT_MS.max);
assert.equal(ttsConfigSchema.parse({}).requestTimeoutMs, 60_000, "saved settings without a limit keep 60 s");
assert.equal(ttsConfigSchema.parse({ requestTimeoutMs: 300_000 }).requestTimeoutMs, 300_000);
assert.equal(createConnectionSchema.parse({ name: "Voice", provider: "audio" }).audioTimeoutMs, null);
assert.equal(
  createConnectionSchema.parse({ name: "Voice", provider: "audio", audioTimeoutMs: 300_000 }).audioTimeoutMs,
  300_000,
);

// Real timers, 200 times faster: 60 s waits 300 ms and 300 s waits 1.5 s. The voice server answers after 800 ms,
// so it is too slow for the default and in time for 300 s. Every limit asked for is recorded as given.
const requestedTimeouts: number[] = [];
const realTimeout = AbortSignal.timeout.bind(AbortSignal);
AbortSignal.timeout = (ms: number) => {
  requestedTimeouts.push(ms);
  return realTimeout(ms / 200);
};
// undici stops waiting for a reply after its own 300 s unless the request says otherwise, so a limit above
// that was cut off and reported as an unreachable server. Here that cap is 500 ms, shorter than the voice server.
const { Agent, getGlobalDispatcher, setGlobalDispatcher } = requireServer("undici");
const previousDispatcher = getGlobalDispatcher();
const shortTransport = new Agent({ headersTimeout: 500, bodyTimeout: 500 });
setGlobalDispatcher(shortTransport);

process.env.TTS_LOCAL_URLS_ENABLED = "true";
const provider = createServer(async (request, response) => {
  for await (const _chunk of request);
  await new Promise((resolve) => setTimeout(resolve, 800));
  if (response.destroyed) return;
  response.writeHead(200, { "content-type": "audio/mpeg" });
  response.end(Buffer.from([0xff, 0xfb, 0x90, 0x00]));
});
provider.on("clientError", () => {});
const realFetch = globalThis.fetch;
let app: ReturnType<typeof Fastify> | undefined;
try {
  await new Promise<void>((resolve) => provider.listen(0, "127.0.0.1", resolve));
  const address = provider.address();
  assert.ok(address && typeof address !== "string");
  const baseUrl = `http://127.0.0.1:${address.port}/v1`;

  const isolatedData = mkdtempSync(join(tmpdir(), "marinara-tts-timeout-"));
  process.env.DATA_DIR = isolatedData;
  process.env.FILE_STORAGE_DIR = join(isolatedData, "storage");
  const { createFileNativeDB } = await import("../../packages/server/src/db/file-backed-store.js");
  const { createAppSettingsStorage } =
    await import("../../packages/server/src/services/storage/app-settings.storage.js");
  const { createConnectionsStorage } =
    await import("../../packages/server/src/services/storage/connections.storage.js");
  const db = await createFileNativeDB();
  const settings = createAppSettingsStorage(db);
  const saveSettings = (extra: Record<string, unknown> = {}) =>
    settings.set(
      TTS_SETTINGS_KEY,
      JSON.stringify({
        enabled: true,
        source: "openai",
        apiKey: "",
        baseUrl,
        model: "tts-1",
        voice: "alloy",
        ...extra,
      }),
    );

  app = Fastify();
  app.decorate("db", db);
  await app.register(ttsRoutes, { prefix: "/api/tts" });
  const speak = async (audioConnectionId?: string) => {
    requestedTimeouts.length = 0;
    const response = await app!.inject({
      method: "POST",
      url: "/api/tts/speak",
      payload: { text: "A long line", ...(audioConnectionId !== undefined ? { audioConnectionId } : {}) },
    });
    return { response, requested: [...requestedTimeouts] };
  };

  // The Text to Speech card's settings.
  await saveSettings();
  let { response, requested } = await speak("");
  assert.equal(response.statusCode, 502, "the default 60 s is still the limit");
  assert.deepEqual(requested, [60_000]);
  assert.deepEqual(response.json(), {
    error: "TTS request timed out",
    code: "tts_timeout",
    timeoutSeconds: 60,
    connectionName: null,
  });

  await saveSettings({ requestTimeoutMs: 300_000 });
  ({ response, requested } = await speak(""));
  assert.deepEqual(requested, [300_000], "the speech request uses the limit saved in the card");
  assert.equal(response.statusCode, 200, "a slow voice server finishes within the raised limit");

  // An audio connection uses its own limit, not the card's.
  await saveSettings();
  const connections = createConnectionsStorage(db);
  const slowServer = await connections.create(
    createConnectionSchema.parse({
      name: "Laptop voice",
      provider: "audio",
      audioSource: "openai",
      baseUrl,
      model: "tts-1",
      audioVoice: "alloy",
      audioTimeoutMs: 300_000,
    }),
  );
  ({ response, requested } = await speak(slowServer.id));
  assert.deepEqual(requested, [300_000], "the connection's limit is used");
  assert.equal(response.statusCode, 200);

  await connections.update(slowServer.id, { audioTimeoutMs: null });
  ({ response, requested } = await speak(slowServer.id));
  assert.deepEqual(requested, [60_000], "a connection that never set a limit keeps 60 s");
  assert.equal(response.statusCode, 502);
  assert.equal(response.json().connectionName, "Laptop voice", "the error names the connection to change");

  // The browser turns the timeout into a message that says where to raise the limit.
  const { i18n } = await import("../../packages/client/src/localization/i18n.js");
  const english = JSON.parse(
    readFileSync(new URL("../../packages/client/src/localization/locales/en.json", import.meta.url), "utf8"),
  );
  i18n.addResourceBundle("en", "translation", english);
  const { ttsService } = await import("../../packages/client/src/lib/tts-service.js");
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input) !== "/api/tts/speak") return realFetch(input, init);
    const reply = await app!.inject({ method: "POST", url: "/api/tts/speak", payload: JSON.parse(String(init?.body)) });
    return new Response(new Uint8Array(reply.rawPayload), {
      status: reply.statusCode,
      headers: { "content-type": String(reply.headers["content-type"] ?? "") },
    });
  }) as typeof fetch;
  await assert.rejects(
    ttsService.generateAudio("A long line", { audioConnectionId: slowServer.id }),
    new Error("No audio after 60 s. To wait longer, raise Request timeout in the Laptop voice audio connection."),
  );
  await assert.rejects(
    ttsService.generateAudio("A long line", { audioConnectionId: "" }),
    new Error("No audio after 60 s. To wait longer, raise Request timeout in Connections > Text to Speech."),
  );
} finally {
  globalThis.fetch = realFetch;
  AbortSignal.timeout = realTimeout;
  setGlobalDispatcher(previousDispatcher);
  await shortTransport.close();
  try {
    await app?.close();
  } finally {
    provider.closeAllConnections();
    await new Promise<void>((resolve) => provider.close(() => resolve()));
  }
}

console.info("TTS request timeout regression passed");
