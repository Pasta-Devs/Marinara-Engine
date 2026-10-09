/**
 * Speech to Text server (#7344): Calls can send recorded speech to the user's own OpenAI-compatible
 * transcription server instead of Local Whisper. The fixture server below is loopback-only, answers
 * on fixed routes with fixed delays, and never contacts a real provider.
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { SPEECH_TO_TEXT_SETTINGS_KEY, TTS_API_KEY_MASK } from "../../packages/shared/src/types/tts.js";

const requireServer = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const Fastify = requireServer("fastify") as typeof import("fastify").default;

const dataDir = mkdtempSync(join(tmpdir(), "marinara-speech-to-text-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
delete process.env.STT_LOCAL_URLS_ENABLED;

const SECRET = "sk-fixture-secret";
const SLOW_REPLY_MS = 3_000;
type Captured = { path: string; authorization: string | undefined; body: string };
const requests: Captured[] = [];
const slowTimers = new Set<ReturnType<typeof setTimeout>>();
const server = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const path = request.url ?? "";
  requests.push({ path, authorization: request.headers.authorization, body: Buffer.concat(chunks).toString("utf8") });
  if (path === "/v1/audio/transcriptions") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ text: " Cześć, jak się masz? " }));
  } else if (path === "/plain/v1/audio/transcriptions") {
    response.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
    response.end("plain transcript\n");
  } else if (path === "/fail/v1/audio/transcriptions") {
    response.writeHead(401, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: { message: "Invalid API key" } }));
  } else if (path === "/slow/v1/audio/transcriptions") {
    const timer = setTimeout(() => {
      slowTimers.delete(timer);
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ text: "too late" }));
    }, SLOW_REPLY_MS);
    slowTimers.add(timer);
  } else {
    response.writeHead(404).end();
  }
});

let app: ReturnType<typeof Fastify> | undefined;
try {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;

  const { createFileNativeDB } = await import("../../packages/server/src/db/file-backed-store.js");
  const { createAppSettingsStorage } =
    await import("../../packages/server/src/services/storage/app-settings.storage.js");
  const { speechToTextRoutes } = await import("../../packages/server/src/routes/speech-to-text.routes.js");
  const { errorHandler } = await import("../../packages/server/src/middleware/error-handler.js");
  const { adminRoutes } = await import("../../packages/server/src/routes/admin.routes.js");
  const { createCapabilityIntegrationHost } =
    await import("../../packages/server/src/services/capability-packages/capability-integrations.service.js");
  const { createSilentTestClip, loadSpeechToTextConfig, transcribeWithSpeechToTextServer } =
    await import("../../packages/server/src/services/speech-to-text.service.js");

  const db = await createFileNativeDB();
  const settings = createAppSettingsStorage(db);
  app = Fastify();
  app.decorate("db", db);
  app.setErrorHandler(errorHandler);
  await app.register(speechToTextRoutes, { prefix: "/api/speech-to-text" });
  await app.register(adminRoutes, { prefix: "/api/admin" });
  const getConfig = () => app!.inject({ method: "GET", url: "/api/speech-to-text/config" });
  const putConfig = (payload: Record<string, unknown>) =>
    app!.inject({ method: "PUT", url: "/api/speech-to-text/config", payload });
  const test = () => app!.inject({ method: "POST", url: "/api/speech-to-text/test", payload: {} });
  const host = createCapabilityIntegrationHost(["network"], db);
  const transcribe = (audio: Uint8Array) =>
    host.speech!.transcribe(audio, { filename: "call-audio.wav", mimeType: "audio/wav" });
  const clip = createSilentTestClip();

  // Nothing set: Calls keep Local Whisper, and the host never reaches a server.
  const initial = await getConfig();
  assert.equal(initial.statusCode, 200);
  assert.deepEqual(initial.json(), { enabled: false, baseUrl: "", apiKey: "", model: "", language: "" });
  assert.equal(await transcribe(clip), null);
  assert.equal(requests.length, 0);

  // The key is stored encrypted and only ever returned masked; sending the mask back keeps it.
  assert.equal(
    (await putConfig({ enabled: true, baseUrl: `${base}/v1/`, apiKey: ` ${SECRET} `, model: "", language: "pl" }))
      .statusCode,
    204,
  );
  const stored = await settings.get(SPEECH_TO_TEXT_SETTINGS_KEY);
  assert.ok(stored && !stored.includes(SECRET), "the API key is not stored in plain text");
  assert.equal((await getConfig()).json().apiKey, TTS_API_KEY_MASK);
  assert.equal(
    (
      await putConfig({
        enabled: true,
        baseUrl: `${base}/v1/`,
        apiKey: TTS_API_KEY_MASK,
        model: "Systran/faster-whisper-small",
        language: "pl",
      })
    ).statusCode,
    204,
  );
  assert.equal((await loadSpeechToTextConfig(db)).apiKey, SECRET, "the masked key keeps the saved one");
  assert.equal((await putConfig({ enabled: true, baseUrl: base, language: "pl_PL;" })).statusCode, 400);
  assert.equal((await loadSpeechToTextConfig(db)).model, "Systran/faster-whisper-small", "a bad save changes nothing");
  // fetch would refuse a key with a line break and print the whole key in its error, so the save refuses it.
  assert.equal((await putConfig({ enabled: true, baseUrl: base, apiKey: "sk-a\nb" })).statusCode, 400);
  assert.equal((await loadSpeechToTextConfig(db)).apiKey, SECRET, "a refused key keeps the saved one");
  // A long key, such as a 2,500-character token, is accepted; once encrypted it is longer than that limit
  // and must still load, or every setting would quietly reset to off.
  const longKey = `eyJ${"a".repeat(2_500)}`;
  const savedSettings = {
    enabled: true,
    baseUrl: `${base}/v1/`,
    model: "Systran/faster-whisper-small",
    language: "pl",
  };
  assert.equal((await putConfig({ ...savedSettings, apiKey: longKey })).statusCode, 204);
  const withLongKey = await loadSpeechToTextConfig(db);
  assert.equal(withLongKey.apiKey, longKey, "a long key survives encryption");
  assert.equal(withLongKey.enabled, true, "a long key keeps the server turned on");
  assert.equal((await putConfig({ ...savedSettings, apiKey: SECRET })).statusCode, 204);

  // The Test button sends a short clip as an OpenAI-style multipart upload.
  const tested = await test();
  assert.equal(tested.statusCode, 200, tested.body);
  const testRequest = requests.at(-1)!;
  assert.equal(testRequest.path, "/v1/audio/transcriptions", "a trailing slash does not double the path");
  assert.equal(testRequest.authorization, `Bearer ${SECRET}`);
  assert.match(testRequest.body, /name="file"; filename="marinara-test\.wav"/u);
  assert.match(testRequest.body, /name="model"\r\n\r\nSystran\/faster-whisper-small\r\n/u);
  assert.match(testRequest.body, /name="language"\r\n\r\npl\r\n/u);
  assert.match(testRequest.body, /name="response_format"\r\n\r\njson\r\n/u);

  // Packages reach the saved server through the host and get the trimmed transcript.
  assert.equal(await transcribe(clip), "Cześć, jak się masz?");
  assert.match(requests.at(-1)!.body, /filename="call-audio\.wav"/u);
  assert.throws(
    () => createCapabilityIntegrationHost([], db).speech!.transcribe(clip),
    /network permission/u,
    "a package without the network permission cannot send audio out",
  );

  // The full endpoint is accepted too, a blank model sends whisper-1, and plain-text answers work.
  await putConfig({ enabled: true, baseUrl: `${base}/plain/v1/audio/transcriptions`, apiKey: "", model: "" });
  assert.equal(await transcribe(clip), "plain transcript");
  assert.equal(requests.at(-1)!.path, "/plain/v1/audio/transcriptions");
  assert.equal(requests.at(-1)!.authorization, undefined, "a cleared key sends no Authorization header");
  assert.match(requests.at(-1)!.body, /name="model"\r\n\r\nwhisper-1\r\n/u);
  assert.doesNotMatch(requests.at(-1)!.body, /name="language"/u, "a blank language lets the server detect it");

  // Turning it off brings Local Whisper back without contacting the server.
  const beforeOff = requests.length;
  await putConfig({ enabled: false, baseUrl: `${base}/v1`, apiKey: SECRET });
  assert.equal(await transcribe(clip), null);
  assert.equal(requests.length, beforeOff);

  // A refusal reports the server's reason and status, never the key.
  await putConfig({ enabled: true, baseUrl: `${base}/fail/v1`, apiKey: SECRET });
  const failed = await test();
  assert.equal(failed.statusCode, 502);
  assert.match(failed.json().error, /answered 401: Invalid API key/u);
  assert.ok(!failed.body.includes(SECRET));
  await assert.rejects(transcribe(clip), /answered 401/u);

  // Other private addresses need the opt-in, and the refusal names it; the server on this machine does not.
  const config = await loadSpeechToTextConfig(db);
  const beforePrivate = requests.length;
  await assert.rejects(
    transcribeWithSpeechToTextServer({ ...config, baseUrl: "http://10.255.255.1/v1" }, clip),
    /STT_LOCAL_URLS_ENABLED=true/u,
  );
  await assert.rejects(
    transcribeWithSpeechToTextServer({ ...config, baseUrl: "http://169.254.169.254/v1" }, clip),
    /STT_LOCAL_URLS_ENABLED=true/u,
  );
  await assert.rejects(
    transcribeWithSpeechToTextServer({ ...config, baseUrl: "file:///etc/passwd" }, clip),
    /protocol 'file' is not allowed/u,
  );
  assert.equal(requests.length, beforePrivate);

  // A user name or password in the URL is refused before fetch can put it in an error or the log.
  for (const baseUrl of [`http://user:hunter2@127.0.0.1:${address.port}/v1`, `${base}/v1?token=x`, `${base}/v1#x`]) {
    await assert.rejects(
      transcribeWithSpeechToTextServer({ ...config, baseUrl }, clip),
      (error: unknown) =>
        error instanceof Error && /Remove the user name/u.test(error.message) && !error.message.includes("hunter2"),
    );
  }
  await assert.rejects(
    transcribeWithSpeechToTextServer({ ...config, baseUrl: "not a url" }, clip),
    /not a valid web address/u,
  );
  assert.equal(requests.length, beforePrivate);

  // Time and size limits.
  await assert.rejects(
    transcribeWithSpeechToTextServer({ ...config, baseUrl: `${base}/slow/v1` }, clip, { timeoutMs: 300 }),
    /took too long/u,
  );
  const cancel = new AbortController();
  const cancelled = transcribeWithSpeechToTextServer({ ...config, baseUrl: `${base}/slow/v1` }, clip, {
    signal: cancel.signal,
  });
  cancel.abort();
  await assert.rejects(cancelled, (error: unknown) => !/took too long/u.test(String(error)));
  const beforeLarge = requests.length;
  await assert.rejects(transcribeWithSpeechToTextServer(config, new Uint8Array(25 * 1024 * 1024 + 1)), /too large/u);
  assert.equal(requests.length, beforeLarge, "an oversized recording is refused before upload");

  // Clearing Connections data also removes the saved server and its key, like Text to Speech.
  const expunged = await app.inject({
    method: "POST",
    url: "/api/admin/expunge",
    payload: { confirm: true, scopes: ["connections"] },
  });
  assert.equal(expunged.statusCode, 200, expunged.body);
  assert.equal(await settings.get(SPEECH_TO_TEXT_SETTINGS_KEY), null, "clearing Connections removes the saved key");
} finally {
  for (const timer of slowTimers) clearTimeout(timer);
  await app?.close();
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  rmSync(dataDir, { recursive: true, force: true });
}

console.info("Speech to Text: masked keys, OpenAI-style uploads, host transcription, URL policy and limits hold.");
