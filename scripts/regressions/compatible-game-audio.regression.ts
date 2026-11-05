import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const data = mkdtempSync(join(tmpdir(), "marinara-compatible-game-audio-"));
process.env.DATA_DIR = data;
process.env.FILE_STORAGE_DIR = join(data, "storage");
process.env.MARINARA_ENV_FILE = join(data, ".env");
process.env.TTS_LOCAL_URLS_ENABLED = "true";

const serverRequire = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const Fastify = serverRequire("fastify") as typeof import("fastify").default;
const { createConnectionSchema } = await import("../../packages/shared/src/schemas/connection.schema.js");
const { audioConnectionSupportsGeneration } = await import("../../packages/shared/src/types/connection.js");
const { createFileNativeDB } = await import("../../packages/server/src/db/file-backed-store.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { errorHandler } = await import("../../packages/server/src/middleware/error-handler.js");
const { ttsRoutes } = await import("../../packages/server/src/routes/tts.routes.js");
const { generateCompatibleGameAudio } = await import("../../packages/server/src/services/game/compatible-audio.js");

const mp3 = Buffer.from([0xff, 0xfb, 0x90, 0x00, 0x01]);
const calls: { path: string; authorization?: string; body: Record<string, unknown> }[] = [];
const provider = createServer(async (req, res) => {
  let body = "";
  for await (const chunk of req) body += chunk;
  const sent = JSON.parse(body) as Record<string, unknown>;
  calls.push({ path: req.url!, authorization: req.headers.authorization, body: sent });
  if (req.url?.endsWith("/error")) {
    res.writeHead(400);
    res.end("bad model");
    return;
  }
  if (req.url?.endsWith("/invalid")) {
    res.setHeader("content-type", "application/json");
    res.end('{"error":"not audio"}');
    return;
  }
  if (req.url?.endsWith("/chat/completions")) {
    res.setHeader("content-type", "application/json");
    res.end(
      JSON.stringify({
        choices: [{ message: { audio: [{ audio_url: { url: `data:audio/mpeg;base64,${mp3.toString("base64")}` } }] } }],
      }),
    );
    return;
  }
  res.setHeader("content-type", "audio/mpeg");
  res.end(mp3);
});
const db = await createFileNativeDB();
const connections = createConnectionsStorage(db);
const app = Fastify();
app.decorate("db", db);
app.setErrorHandler(errorHandler);
await app.register(ttsRoutes, { prefix: "/api/tts" });
try {
  await new Promise<void>((resolve) => provider.listen(0, "127.0.0.1", resolve));
  const address = provider.address();
  assert.ok(address && typeof address !== "string");
  const baseUrl = `http://127.0.0.1:${address.port}/v1`;
  const create = (extra: Record<string, unknown> = {}) =>
    connections.create(
      createConnectionSchema.parse({
        name: "Custom audio",
        provider: "audio",
        audioSource: "openai",
        baseUrl,
        apiKey: "fixture-secret",
        model: "music-model",
        audioMusic: true,
        audioSoundEffects: true,
        audioMusicEndpoint: "music",
        audioSoundEffectsEndpoint: "sfx",
        ...extra,
      }),
    );
  const row = await create();
  const generate = (audioConnectionId: string, extra: Record<string, unknown> = {}) =>
    app.inject({
      method: "POST",
      url: "/api/tts/game-audio",
      payload: { kind: "sfx", prompt: "a bright chime", audioConnectionId, ...extra },
    });
  const first = await generate(row.id);
  assert.equal(first.statusCode, 200, first.body);
  assert.deepEqual(calls[0], {
    path: "/v1/sfx",
    authorization: "Bearer fixture-secret",
    body: {
      model: "music-model",
      prompt: "a bright chime",
      duration: 5,
      response_format: "mp3",
    },
  });
  assert.deepEqual(readFileSync(join(data, "game-assets", first.json().path)), mp3);
  assert.ok(!first.body.includes("fixture-secret"));
  assert.equal((await generate(row.id)).json().cached, true);
  assert.equal(calls.length, 1, "repeated prompt uses the existing audio");
  const secondModel = await create({ model: "different-model" });
  assert.equal((await generate(secondModel.id)).statusCode, 200);
  assert.equal(calls.length, 2, "different model must not reuse another model's SFX");
  const chat = await create({ audioGenerationFormat: "chat_completions", audioMusicEndpoint: "chat/completions" });
  const request = { kind: "music", context: { axis: "area", key: "quiet-harbor", lengthMs: 30_000 } };
  const music = await generate(chat.id, request);
  assert.equal(music.statusCode, 200, music.body);
  assert.equal(calls.at(-1)?.path, "/v1/chat/completions");
  assert.deepEqual(calls.at(-1)?.body.audio_config, { duration: 30, instrumental: true, format: "mp3" });
  assert.deepEqual(calls.at(-1)?.body.messages, [{ role: "user", content: "a bright chime" }]);
  assert.deepEqual(readFileSync(join(data, "game-assets", music.json().path)), mp3);
  const count = calls.length;
  assert.equal((await generate(chat.id, { ...request, prompt: "a changed prompt" })).json().cached, true);
  assert.equal(calls.length, count, "context tracks stay once per area regardless of prompt");
  for (const extra of [
    { audioMusic: false, audioSoundEffects: false },
    { audioSoundEffectsEndpoint: null },
    { audioSource: "pockettts" },
  ]) {
    const disabled = await create(extra);
    assert.equal((await generate(disabled.id)).statusCode, 400);
  }
  assert.equal(calls.length, count, "disabled or unsupported capabilities make no request");
  for (const path of ["error", "invalid"]) {
    const broken = await create({ audioSoundEffectsEndpoint: path });
    assert.equal((await generate(broken.id)).statusCode, 502);
    const beforeRetry = calls.length;
    assert.equal((await generate(broken.id)).statusCode, 502);
    assert.equal(calls.length, beforeRetry + 1, "failed requests do not poison the cache/lock");
  }
  const copy = await connections.duplicate(row.id);
  assert.equal(copy?.audioMusicEndpoint, "music");
  assert.equal(copy?.audioSoundEffectsEndpoint, "sfx");
  assert.equal(copy?.audioGenerationFormat, "binary");
  await connections.update(row.id, { audioMusicEndpoint: "new-music", audioGenerationFormat: "chat_completions" });
  assert.equal((await connections.getById(row.id))?.audioMusicEndpoint, "new-music");
  assert.equal(audioConnectionSupportsGeneration({ audioSource: "elevenlabs", audioMusic: "true" }, "music"), true);
  assert.equal(audioConnectionSupportsGeneration({ audioSource: "openai", audioMusic: true }, "music"), false);
  assert.equal(
    createConnectionSchema.safeParse({ name: "valid", provider: "audio", audioMusicEndpoint: "audio/music" }).success,
    true,
  );
  for (const path of ["https://evil.example/steal", "//evil.example/steal", "x?key=secret", "x#fragment", "x\\\\y"]) {
    const invalid = createConnectionSchema.safeParse({ name: "bad", provider: "audio", audioMusicEndpoint: path });
    assert.equal(invalid.success, false, path);
    if (!invalid.success)
      assert.deepEqual(
        invalid.error.issues.map((issue) => issue.path),
        [["audioMusicEndpoint"]],
      );
  }
  await assert.rejects(
    generateCompatibleGameAudio({
      baseUrl,
      endpoint: "https://evil.example/audio",
      apiKey: "",
      model: "",
      format: "binary",
      prompt: "x",
      duration: 5,
      allowLocal: true,
      timeoutMs: 100,
      maxBytes: 10,
    }),
    /must be a path on the configured connection/u,
  );
  await assert.rejects(
    generateCompatibleGameAudio({
      baseUrl,
      endpoint: "sfx",
      apiKey: "",
      model: "",
      format: "binary",
      prompt: "x",
      duration: 5,
      allowLocal: false,
      timeoutMs: 100,
      maxBytes: 10,
    }),
    /protocol 'http' is not allowed/u,
  );
  await assert.rejects(
    generateCompatibleGameAudio({
      baseUrl,
      endpoint: "sfx",
      apiKey: "",
      model: "",
      format: "binary",
      prompt: "x",
      duration: 5,
      allowLocal: true,
      timeoutMs: 1000,
      maxBytes: 2,
    }),
  );
  console.info("Compatible Game audio route, cache, capabilities and boundary controls passed");
} finally {
  await app.close();
  await new Promise<void>((resolve) => provider.close(() => resolve()));
  rmSync(data, { recursive: true, force: true });
}
