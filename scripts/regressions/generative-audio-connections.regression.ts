import assert from "node:assert/strict";
import { createServer } from "node:http";
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const data = mkdtempSync(join(tmpdir(), "marinara-generative-audio-"));
Object.assign(process.env, {
  DATA_DIR: data,
  FILE_STORAGE_DIR: join(data, "storage"),
  MARINARA_ENV_FILE: join(data, ".env"),
  TTS_LOCAL_URLS_ENABLED: "true",
  LOG_LEVEL: "silent",
});
const require = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const Fastify = require("fastify") as typeof import("fastify").default;
const { createFileNativeDB } = await import("../../packages/server/src/db/file-backed-store.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { createAppSettingsStorage } = await import("../../packages/server/src/services/storage/app-settings.storage.js");
const { migrateGenerativeAudioConnections } =
  await import("../../packages/server/src/services/connections/generative-audio-connection-migration.js");
const { generateAudioAsset } = await import("../../packages/server/src/services/audio/generative-audio.service.js");
const { createConnectionSchema, ttsConfigSchema, TTS_SETTINGS_KEY } =
  await import("../../packages/shared/dist/index.js");
const { apiConnections } = await import("../../packages/server/src/db/schema/index.js");
const { eq } = await import("../../packages/server/src/db/file-query.js");
const { audioRoutes } = await import("../../packages/server/src/routes/audio.routes.js");
const { ttsRoutes } = await import("../../packages/server/src/routes/tts.routes.js");
const { connectionsRoutes } = await import("../../packages/server/src/routes/connections.routes.js");
const { quarantineProfileApiConnectionRow } = await import("../../packages/server/src/routes/backup.routes.js");
const { errorHandler } = await import("../../packages/server/src/middleware/error-handler.js");
const { encryptApiKey } = await import("../../packages/server/src/utils/crypto.js");
const db = await createFileNativeDB();
const connections = createConnectionsStorage(db);
const settings = createAppSettingsStorage(db);
const app = Fastify();
app.decorate("db", db);
app.setErrorHandler(errorHandler);
let enteredSampleRequests = 0;
app.addHook("preHandler", async (request) => {
  if (
    request.url === "/api/audio/generate" &&
    (request.body as { context?: { scope?: string } } | undefined)?.context?.scope === "connection-test"
  )
    enteredSampleRequests++;
});
await app.register(audioRoutes, { prefix: "/api/audio" });
await app.register(ttsRoutes, { prefix: "/api/tts" });
await app.register(connectionsRoutes, { prefix: "/api/connections" });
const mp3 = Buffer.from([0xff, 0xfb, 0x90, 0, 1]);
const calls: { path: string; body: Record<string, unknown>; authorization?: string }[] = [];
let held: { release: () => void } | undefined;
const provider = createServer(async (req, res) => {
  let body = "";
  for await (const chunk of req) body += chunk;
  calls.push({ path: req.url!, body: JSON.parse(body), authorization: req.headers.authorization });
  if (req.url === "/v1/error") {
    res.writeHead(500);
    res.end();
    return;
  }
  if (req.url === "/v1/hold")
    await new Promise<void>((release) => {
      held = { release };
    });
  res.setHeader("content-type", "audio/mpeg");
  res.end(mp3);
});
try {
  const localGeneration = {
    id: "local-generation",
    provider: "audio_generation",
    baseUrl: "",
    model: "",
    audioGenerationSource: "elevenlabs",
    apiKeyEncrypted: "local-ciphertext",
    audioGenerationLegacyConnectionId: "real-legacy-id",
    defaultForAgents: "true",
  };
  const unchangedRestore = quarantineProfileApiConnectionRow(
    { ...localGeneration, apiKeyEncrypted: "", audioGenerationLegacyConnectionId: "forged-legacy-id" },
    localGeneration,
  );
  assert.equal(unchangedRestore.trustedIdentity, true);
  assert.equal(unchangedRestore.row.apiKeyEncrypted, "local-ciphertext");
  for (const source of [null, undefined]) {
    for (const [existing, imported] of [
      [{ ...localGeneration, audioGenerationSource: source }, localGeneration],
      [localGeneration, { ...localGeneration, audioGenerationSource: source }],
    ]) {
      const restored = quarantineProfileApiConnectionRow({ ...imported, apiKeyEncrypted: "" }, existing);
      assert.equal(restored.trustedIdentity, true, "a missing generation source resolves to ElevenLabs");
      assert.equal(restored.row.apiKeyEncrypted, "local-ciphertext");
      assert.equal(restored.row.defaultForAgents, "true");
      assert.equal(restored.row.audioGenerationLegacyConnectionId, "real-legacy-id");
    }
  }
  for (const changed of [
    { audioGenerationSource: "" },
    { audioGenerationSource: " " },
    { audioGenerationSource: " elevenlabs " },
    { audioGenerationSource: "future-source" },
    { audioGenerationSource: "sunoapi" },
    { baseUrl: "https://different.example/v1" },
  ]) {
    const rejected = quarantineProfileApiConnectionRow({ ...localGeneration, ...changed }, localGeneration);
    assert.equal(rejected.trustedIdentity, false, "unsupported sources and different endpoints remain untrusted");
    assert.equal(rejected.row.apiKeyEncrypted, "");
    assert.equal(rejected.row.defaultForAgents, "false");
    assert.equal(rejected.row.profileImportReviewRequired, "true");
    assert.equal(rejected.row.audioGenerationLegacyConnectionId, null);
  }
  const changedSource = quarantineProfileApiConnectionRow(
    { ...localGeneration, audioGenerationSource: "sunoapi" },
    localGeneration,
  );
  assert.equal(
    changedSource.trustedIdentity,
    false,
    "switching a default API origin cannot reuse a local provider key",
  );
  assert.equal(changedSource.row.apiKeyEncrypted, "");
  assert.equal(changedSource.row.profileImportReviewRequired, "true");
  assert.equal(changedSource.row.defaultForAgents, "false");
  assert.equal(
    unchangedRestore.row.audioGenerationLegacyConnectionId,
    "real-legacy-id",
    "profile files cannot forge migration aliases",
  );
  assert.equal(quarantineProfileApiConnectionRow(localGeneration).row.audioGenerationLegacyConnectionId, null);
  await new Promise<void>((resolve) => provider.listen(0, "127.0.0.1", resolve));
  const address = provider.address();
  assert.ok(address && typeof address !== "string");
  const baseUrl = `http://127.0.0.1:${address.port}/v1`;
  const create = (extra: Record<string, unknown> = {}) =>
    connections.create(
      createConnectionSchema.parse({
        name: "Generation fixture",
        provider: "audio_generation",
        audioGenerationSource: "custom",
        baseUrl,
        apiKey: "fixture-audio-key",
        model: "music-fixture",
        audioMusic: true,
        audioSoundEffects: true,
        audioMusicEndpoint: "music",
        audioSoundEffectsEndpoint: "sfx",
        ...extra,
      }),
    );
  const language = await connections.create(
    createConnectionSchema.parse({ name: "Language", provider: "custom", isDefault: true, defaultForAgents: true }),
  );
  const legacy = await connections.create(
    createConnectionSchema.parse({
      name: "Speech",
      provider: "audio",
      audioSource: "openai",
      baseUrl: "",
      model: "",
      apiKey: "legacy-key",
      audioVoice: "voice-a",
      audioMusic: true,
      audioSoundEffects: true,
      audioMusicEndpoint: "music",
      audioSoundEffectsEndpoint: "sfx",
      defaultForAgents: true,
    }),
  );
  const cfg = ttsConfigSchema.parse({
    source: "openai",
    enabled: false,
    baseUrl,
    model: "legacy-music",
    voiceAssignments: [{ characterId: "character", characterName: "Fixture", voice: "assigned-voice" }],
  });
  const rawTts = JSON.stringify(cfg);
  await settings.set(TTS_SETTINGS_KEY, rawTts);
  await migrateGenerativeAudioConnections(db);
  const migrated = await connections.getAudioGenerationForLegacyConnection(legacy.id);
  assert.ok(migrated);
  assert.equal(migrated.provider, "audio_generation");
  assert.equal(migrated.baseUrl, baseUrl, "legacy source-profile address survives");
  assert.equal(migrated.model, "legacy-music");
  assert.equal(migrated.apiKey, "legacy-key");
  assert.equal(migrated.defaultForAgents, "true");
  assert.equal((await connections.getById(legacy.id))?.audioVoice, "voice-a");
  assert.equal((await connections.getById(legacy.id))?.audioMusic, "false");
  assert.equal(await settings.get(TTS_SETTINGS_KEY), rawTts, "TTS toggle, voices and profiles are untouched");
  assert.equal((await connections.getDefault())?.id, language.id);
  await migrateGenerativeAudioConnections(db);
  assert.equal(
    (await connections.list()).filter((row) => row.audioGenerationLegacyConnectionId === legacy.id).length,
    1,
  );
  const generate = (audioConnectionId: string, extra: Record<string, unknown> = {}) =>
    app.inject({
      method: "POST",
      url: "/api/audio/generate",
      payload: { kind: "sfx", prompt: "a gentle chime", audioConnectionId, ...extra },
    });
  const legacyRequest = await generate(legacy.id);
  assert.equal(legacyRequest.statusCode, 200, legacyRequest.body);
  assert.equal(calls.at(-1)?.authorization, "Bearer legacy-key");
  await connections.remove(migrated.id);
  await migrateGenerativeAudioConnections(db);
  assert.equal(await connections.getAudioGenerationForLegacyConnection(legacy.id), null, "deletion stays deleted");
  const legacyDeleted = await generate(legacy.id);
  assert.equal(legacyDeleted.statusCode, 400);

  const quarantine = await connections.create(
    createConnectionSchema.parse({
      name: "Imported speech",
      provider: "audio",
      audioSource: "elevenlabs",
      audioMusic: true,
    }),
  );
  await db
    .update(apiConnections)
    .set({ profileImportReviewRequired: "true" })
    .where(eq(apiConnections.id, quarantine.id));
  await migrateGenerativeAudioConnections(db);
  assert.equal(await connections.getAudioGenerationForLegacyConnection(quarantine.id), null);
  assert.equal((await generate(quarantine.id)).statusCode, 409);
  const reviewed = await app.inject({
    method: "PATCH",
    url: `/api/connections/${quarantine.id}`,
    payload: { model: "speech-model" },
  });
  assert.equal(reviewed.statusCode, 200, reviewed.body);
  assert.equal((await connections.getAudioGenerationForLegacyConnection(quarantine.id))?.model, "music_v1");
  const importedAfterBoot = await app.inject({
    method: "POST",
    url: "/api/connections/",
    payload: {
      name: "Old connection file",
      provider: "audio",
      audioSource: "openai",
      baseUrl,
      audioSoundEffects: true,
      audioSoundEffectsEndpoint: "sfx",
    },
  });
  assert.equal(importedAfterBoot.statusCode, 200, importedAfterBoot.body);
  assert.equal(
    importedAfterBoot.json().audioSoundEffects,
    "false",
    "the legacy editor response reflects retired switches",
  );
  assert.ok(
    await connections.getAudioGenerationForLegacyConnection(importedAfterBoot.json().id),
    "a trusted legacy import is available without restarting",
  );

  const row = await create({ defaultForAgents: true, isDefault: true, useForRandom: true });
  assert.equal((await connections.getDefault())?.id, language.id, "generation cannot clear the main default");
  assert.equal((await connections.getById(row.id))?.useForRandom, "false");
  await connections.update(row.id, { isDefault: true, useForRandom: true });
  assert.equal((await connections.getDefault())?.id, language.id);
  assert.equal((await connections.getDefaultForAgents())?.id, language.id);
  assert.equal((await connections.getDefaultForAudio())?.id, legacy.id);
  const originalTransaction = db.transaction;
  db.transaction = async () => {
    throw new Error("Configured audio must not reopen the migration transaction");
  };
  let first;
  try {
    first = await generate(row.id);
  } finally {
    db.transaction = originalTransaction;
  }
  assert.equal(first.statusCode, 200, first.body);
  assert.deepEqual(readFileSync(join(data, "game-assets", first.json().path)), mp3);
  const count = calls.length;
  assert.equal((await generate(row.id)).json().cached, true);
  assert.equal(calls.length, count);
  assert.ok(!first.body.includes("fixture-audio-key"));
  const changed = await create({ model: "different-model" });
  assert.equal((await generate(changed.id)).statusCode, 200);
  assert.equal(calls.length, count + 1, "model-specific effects do not reuse each other");
  const music = { kind: "music", context: { scope: "gacha-forge", key: "world-1-happy", lengthMs: 30_000 } };
  const raced = await Promise.all([
    generate(row.id, music),
    generate(row.id, { ...music, prompt: "another composition" }),
  ]);
  for (const result of raced) assert.equal(result.statusCode, 200, result.body);
  assert.equal(raced[0]!.json().path, raced[1]!.json().path);
  assert.equal(calls.length, count + 2, "racing context requests submit one paid composition");
  const cached = await generate(row.id, { ...music, prompt: "changed later" });
  assert.equal(cached.json().cached, true);
  assert.equal(calls.length, count + 2);
  assert.match(cached.json().path, /^music\/contexts\/gacha-forge\/world-1-happy\//);
  const replacement = join(data, "game-assets/music/contexts/gacha-forge/world-1-sad");
  mkdirSync(replacement, { recursive: true });
  writeFileSync(join(replacement, "my-track.ogg"), "user owned audio");
  assert.equal(
    (await generate(row.id, { ...music, context: { scope: "gacha-forge", key: "world-1-sad" } })).json().path,
    "music/contexts/gacha-forge/world-1-sad/my-track.ogg",
  );
  const sampleInput = {
    kind: "music",
    context: { scope: "connection-test", key: "untrusted-client-key", lengthMs: 10_000 },
  };
  const beforeSamples = calls.length;
  const sample1 = (await generate(row.id, sampleInput)).json();
  const sampleDirectory = dirname(sample1.path);
  assert.equal(
    sampleDirectory,
    `music/contexts/connection-test/${createHash("sha256").update(row.id).digest("hex").slice(0, 32)}`,
    "the server derives sample ownership from the selected connection, not a client key",
  );
  const sampleReplacement = join(data, "game-assets", sampleDirectory, "my-track.ogg");
  writeFileSync(sampleReplacement, "user owned audio");
  const sample2 = (
    await generate(row.id, { ...sampleInput, context: { ...sampleInput.context, key: "other-key" } })
  ).json();
  assert.equal(dirname(sample2.path), sampleDirectory);
  assert.notEqual(sample1.path, sample2.path, "each successful test has a fresh URL despite browser asset caching");
  assert.equal(sample1.cached, false);
  assert.equal(sample2.cached, false);
  assert.equal(calls.length, beforeSamples + 2, "each later click really contacts the selected provider");
  assert.equal(existsSync(join(data, "game-assets", sample1.path)), false, "the previous test track is reclaimed");
  assert.deepEqual(
    readdirSync(join(data, "game-assets", sampleDirectory)).sort(),
    [sample2.path.split("/").at(-1), "my-track.ogg"].sort(),
  );
  assert.equal(readFileSync(sampleReplacement, "utf8"), "user owned audio");
  // POSIX directory permissions reproduce a listing failure after a successful atomic publication.
  if (process.platform !== "win32" && process.getuid?.() !== 0) {
    const absoluteSampleDirectory = join(data, "game-assets", sampleDirectory);
    const beforeCleanupFailure = calls.length;
    let publishedSample;
    try {
      chmodSync(absoluteSampleDirectory, 0o300);
      assert.throws(() => readdirSync(absoluteSampleDirectory), { code: "EACCES" });
      publishedSample = await generate(row.id, sampleInput);
    } finally {
      chmodSync(absoluteSampleDirectory, 0o700);
    }
    assert.equal(publishedSample.statusCode, 200, publishedSample.body);
    assert.equal(publishedSample.json().cached, false);
    assert.equal(calls.length, beforeCleanupFailure + 1);
    assert.deepEqual(readFileSync(join(data, "game-assets", publishedSample.json().path)), mp3);
    assert.equal(readFileSync(sampleReplacement, "utf8"), "user owned audio");
  }
  assert.equal(
    readFileSync(join(replacement, "my-track.ogg"), "utf8"),
    "user owned audio",
    "other scopes remain intact",
  );
  const otherSample = (await generate(changed.id, sampleInput)).json();
  assert.notEqual(dirname(otherSample.path), sampleDirectory, "connections do not share sample assets or locks");
  assert(existsSync(join(data, "game-assets", sample2.path)));
  const beforeRacingSamples = calls.length;
  const racingSamples = await Promise.all([
    generate(row.id, sampleInput),
    generate(row.id, { ...sampleInput, prompt: "  a   gentle chime  " }),
  ]);
  assert.equal(racingSamples[0]!.json().path, racingSamples[1]!.json().path);
  assert.equal(calls.length, beforeRacingSamples + 1, "concurrent listeners share one in-flight sample only");
  assert.equal(
    readdirSync(join(data, "game-assets", sampleDirectory)).filter((name) => /^generated-/.test(name)).length,
    1,
  );
  const queuedConnection = await create({ audioMusicEndpoint: "hold", model: "sample-model-a" });
  for (const changedInput of ["model", "prompt", "apiKey", "length"] as const) {
    held = undefined;
    const beforeQueue = calls.length;
    const enteredBeforeQueue = enteredSampleRequests;
    const earlier = generate(queuedConnection.id, sampleInput).then((result) => result);
    for (let n = 0; n < 100 && !held; n++) await new Promise((resolve) => setTimeout(resolve, 5));
    const firstHold = held as { release: () => void } | undefined;
    assert(firstHold, "the first paid request is in flight");
    if (changedInput === "model") await connections.update(queuedConnection.id, { model: "sample-model-b" });
    if (changedInput === "apiKey")
      await connections.update(queuedConnection.id, { apiKey: "changed-fixture-audio-key" });
    const later = generate(queuedConnection.id, {
      ...sampleInput,
      ...(changedInput === "prompt" ? { prompt: "a different test instrumental" } : {}),
      ...(changedInput === "length" ? { context: { ...sampleInput.context, lengthMs: 15_000 } } : {}),
    }).then((result) => result);
    for (let n = 0; n < 100 && enteredSampleRequests < enteredBeforeQueue + 2; n++)
      await new Promise((resolve) => setTimeout(resolve, 5));
    assert.equal(enteredSampleRequests, enteredBeforeQueue + 2);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(calls.length, beforeQueue + 1, "different requests serialize publication into their shared directory");
    firstHold.release();
    const earlierResult = await earlier;
    for (let n = 0; n < 100 && held === firstHold; n++) await new Promise((resolve) => setTimeout(resolve, 5));
    const nextHold = held as { release: () => void } | undefined;
    assert(
      nextHold && nextHold !== firstHold,
      "changed input submits a distinct provider request after the previous one",
    );
    nextHold.release();
    const laterResult = await later;
    assert.equal(earlierResult.statusCode, 200, earlierResult.body);
    assert.equal(laterResult.statusCode, 200, laterResult.body);
    assert.notEqual(earlierResult.json().path, laterResult.json().path);
    assert.equal(calls.length, beforeQueue + 2);
    assert.notEqual(
      changedInput === "apiKey"
        ? calls[beforeQueue]!.authorization
        : calls[beforeQueue]!.body[changedInput === "length" ? "duration" : changedInput],
      changedInput === "apiKey"
        ? calls[beforeQueue + 1]!.authorization
        : calls[beforeQueue + 1]!.body[changedInput === "length" ? "duration" : changedInput],
    );
    assert.equal(existsSync(join(data, "game-assets", earlierResult.json().path)), false);
    assert(existsSync(join(data, "game-assets", laterResult.json().path)));
  }
  held = undefined;
  const beforeCrossKind = calls.length;
  const crossKind = await Promise.all(
    (["music", "sfx"] as const).map((kind) =>
      generateAudioAsset(db, {
        ...sampleInput,
        audioConnectionId: row.id,
        prompt: "kind-specific test sample",
        kind,
      }),
    ),
  );
  assert.equal(
    calls.length,
    beforeCrossKind + 2,
    "different audio kinds cannot coalesce in the internal shared helper",
  );
  assert.notEqual(crossKind[0]!.path, crossKind[1]!.path);
  for (const extra of [
    { kind: "music" },
    { context: { scope: "gacha-forge", key: "x" } },
    { ...music, context: { scope: "../outside", key: "x" } },
    { ...music, context: { scope: "gacha-forge", key: "../../secret" } },
  ])
    assert.equal((await generate(row.id, extra)).statusCode, 400);
  assert.equal((await generate("missing")).statusCode, 409);
  const configResponse = await app.inject({ method: "GET", url: "/api/audio/config" });
  assert.equal(configResponse.json().connectionId, row.id);
  assert.equal(configResponse.json().configured, true);
  assert.ok(!configResponse.body.includes("fixture-audio-key"));
  const beforeUnsupportedTests = calls.length;
  for (const path of ["test", "test-message"])
    assert.equal(
      (await app.inject({ method: "POST", url: `/api/connections/${row.id}/${path}`, payload: {} })).statusCode,
      400,
    );
  assert.deepEqual(
    (await app.inject({ method: "GET", url: `/api/connections/${row.id}/models?refresh=true` })).json(),
    { models: [] },
  );
  assert.equal(calls.length, beforeUnsupportedTests, "generation connections never send chat/model-list test requests");
  const native = await create({ audioGenerationSource: "elevenlabs", baseUrl: "https://8.8.8.8", model: "music_v2_5" });
  const originalFetch = globalThis.fetch;
  const nativeRequests: Record<string, unknown>[] = [];
  try {
    globalThis.fetch = async (url, init) => {
      assert.equal(new URL(String(url)).hostname, "8.8.8.8");
      nativeRequests.push(JSON.parse(String(init?.body)));
      return new Response(
        JSON.stringify({ detail: { status: "invalid_model_id", message: "Select another model. fixture-audio-key" } }),
        { status: 400 },
      );
    };
    const rejected = await app.inject({
      method: "POST",
      url: "/api/audio/generate",
      payload: {
        audioConnectionId: native.id,
        kind: "music",
        prompt: "A test sample",
        context: { scope: "connection-test", key: "fixture", lengthMs: 10_000 },
      },
    });
    assert.equal(rejected.statusCode, 502);
    assert.deepEqual(rejected.json(), {
      error: "Audio generation failed",
      detail: "ElevenLabs audio request returned HTTP 400",
      providerStatus: 400,
      providerCode: "invalid_model_id",
      reason: "Select another model. [redacted]",
    });
    assert.equal(nativeRequests.length, 1);
    assert.equal(nativeRequests[0]!.model_id, "music_v2_5");
    assert.equal(nativeRequests[0]!.music_length_ms, 10_000);
    assert(!rejected.body.includes("fixture-audio-key"));
    globalThis.fetch = async () => new Response("not MP3 audio");
    const invalidAudio = await generate(native.id, sampleInput);
    assert.equal(invalidAudio.statusCode, 502);
    assert.equal(invalidAudio.json().failureCode, "invalid_audio");
    assert.equal(invalidAudio.json().providerStatus, undefined);
    const suno = await create({ audioGenerationSource: "sunoapi", baseUrl: "https://8.8.8.8", model: "V6" });
    assert.equal((await generate(suno.id, sampleInput)).json().failureCode, "invalid_callback");
    assert.equal(
      (await generate(suno.id, { ...sampleInput, prompt: "x".repeat(1001) })).json().failureCode,
      "invalid_input",
    );
    await connections.update(suno.id, { audioGenerationCallbackUrl: "https://9.9.9.9/callback" });
    globalThis.fetch = async () => new Response(JSON.stringify({ code: 400, msg: "private raw provider text" }));
    const taskFailure = await generate(suno.id, sampleInput);
    assert.equal(taskFailure.json().failureCode, "task_failed");
    assert(!taskFailure.body.includes("private raw provider text"));
  } finally {
    globalThis.fetch = originalFetch;
  }
  const broken = await create({ audioSoundEffectsEndpoint: "error" });
  const beforeFailure = calls.length;
  assert.equal((await generate(broken.id)).statusCode, 502);
  assert.equal((await generate(broken.id)).statusCode, 502);
  assert.equal(calls.length, beforeFailure + 2, "failures release the lock and do not cache");
  const slow = await create({ audioSoundEffectsEndpoint: "hold" });
  const abort = new AbortController();
  const aborted = generateAudioAsset(db, {
    kind: "sfx",
    prompt: "held shared cue",
    audioConnectionId: slow.id,
    signal: abort.signal,
  });
  const abortedProof = assert.rejects(aborted, /stopped listener/);
  const other = generateAudioAsset(db, { kind: "sfx", prompt: "held shared cue", audioConnectionId: slow.id });
  const deadline = Date.now() + 5_000;
  while (!held && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 10));
  assert.ok(held);
  abort.abort(new Error("stopped listener"));
  await abortedProof;
  held.release();
  const retained = await other;
  assert.deepEqual(readFileSync(join(data, "game-assets", retained.path)), mp3, "other listener keeps the paid result");
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: "/api/tts/game-audio",
        payload: {
          kind: "music",
          prompt: "legacy area",
          audioConnectionId: row.id,
          context: { axis: "area", key: "harbor", lengthMs: 30_000 },
        },
      })
    ).statusCode,
    200,
  );
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: "/api/tts/game-audio",
        payload: {
          kind: "music",
          prompt: "invalid tier",
          audioConnectionId: row.id,
          context: { axis: "tier", key: "not-real" },
        },
      })
    ).statusCode,
    400,
  );

  // The pre-connections Game-only configuration migrates even with speech off.
  for (const connection of await connections.list()) await connections.remove(connection.id);
  await settings.remove("generativeAudioLegacyConfigMigrated");
  const explicitOnlySpeech = await connections.create(
    createConnectionSchema.parse({
      name: "Explicit custom generation",
      provider: "audio",
      audioSource: "openai",
      baseUrl,
      audioSoundEffects: true,
      audioSoundEffectsEndpoint: "sfx",
    }),
  );
  const importedDefault = await connections.create(
    createConnectionSchema.parse({
      name: "Unreviewed default",
      provider: "audio",
      audioSource: "elevenlabs",
      defaultForAgents: true,
      audioMusic: true,
    }),
  );
  await db
    .update(apiConnections)
    .set({ profileImportReviewRequired: "true" })
    .where(eq(apiConnections.id, importedDefault.id));
  await settings.set(
    TTS_SETTINGS_KEY,
    JSON.stringify(
      ttsConfigSchema.parse({
        enabled: false,
        source: "elevenlabs",
        apiKey: encryptApiKey("old-game-key"),
        elevenLabsGameMusic: true,
      }),
    ),
  );
  await migrateGenerativeAudioConnections(db);
  assert.equal(
    (await connections.list()).filter((connection) => connection.provider === "audio").length,
    2,
    "no speech connection is added or enabled",
  );
  assert.ok(await connections.getAudioGenerationForLegacyConnection(explicitOnlySpeech.id));
  const gameOnly = await connections.getDefaultForAudioGeneration();
  assert.equal(gameOnly?.apiKey, "old-game-key");
  assert.equal(gameOnly?.model, "music_v1");
  assert.ok(gameOnly);
  await connections.remove(gameOnly.id);
  await connections.remove(explicitOnlySpeech.id);
  await connections.remove(importedDefault.id);
  await migrateGenerativeAudioConnections(db);
  assert.equal(
    (await connections.list()).filter(
      (connection) => connection.provider === "audio_generation" && !connection.audioGenerationLegacyConnectionId,
    ).length,
    0,
    "legacy blob cannot recreate a deleted generation connection",
  );
  // A split from a trusted speech default also consumes the obsolete blob.
  for (const connection of await connections.list()) await connections.remove(connection.id);
  await settings.remove("generativeAudioLegacyConfigMigrated");
  const speechDefault = await connections.create(
    createConnectionSchema.parse({
      name: "Eleven speech default",
      provider: "audio",
      audioSource: "elevenlabs",
      apiKey: "speech-key",
      defaultForAgents: true,
      audioMusic: true,
    }),
  );
  await migrateGenerativeAudioConnections(db);
  const splitDefault = await connections.getAudioGenerationForLegacyConnection(speechDefault.id);
  assert.ok(splitDefault);
  await connections.remove(splitDefault.id);
  await connections.remove(speechDefault.id);
  await migrateGenerativeAudioConnections(db);
  assert.equal(
    (await connections.list()).length,
    0,
    "deleting both split rows cannot resurrect audio from the old blob",
  );
  console.info(
    "PASS: independent generation connections, legacy migration, voices/defaults/quarantine, scoped cache, concurrency/cancellation and Game compatibility",
  );
} finally {
  held?.release();
  await app.close();
  await new Promise<void>((resolve) => provider.close(() => resolve()));
  await db._fileStore.close();
  rmSync(data, { recursive: true, force: true });
}
