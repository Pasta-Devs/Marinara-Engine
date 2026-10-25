import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const directory = mkdtempSync(join(tmpdir(), "marinara-audio-legacy-cache-"));
Object.assign(process.env, {
  DATA_DIR: directory,
  FILE_STORAGE_DIR: join(directory, "storage"),
  MARINARA_ENV_FILE: join(directory, ".env"),
  TTS_LOCAL_URLS_ENABLED: "true",
  LOG_LEVEL: "silent",
});
const { createFileNativeDB } = await import("../../packages/server/src/db/file-backed-store.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { createAppSettingsStorage } = await import("../../packages/server/src/services/storage/app-settings.storage.js");
const { migrateGenerativeAudioConnections } =
  await import("../../packages/server/src/services/connections/generative-audio-connection-migration.js");
const { generateAudioAsset } = await import("../../packages/server/src/services/audio/generative-audio.service.js");
const { createConnectionSchema, ttsConfigSchema, TTS_SETTINGS_KEY } =
  await import("../../packages/shared/dist/index.js");
const { encryptApiKey } = await import("../../packages/server/src/utils/crypto.js");
const db = await createFileNativeDB();
const connections = createConnectionsStorage(db);
const settings = createAppSettingsStorage(db);
const bytes = Buffer.from([0xff, 0xfb, 0x90, 0, 1]);
const prompt = "Legacy cached cue";
const originalFetch = globalThis.fetch;
const calls: string[] = [];
globalThis.fetch = async (input) => {
  calls.push(String(input));
  return new Response(bytes, { headers: { "content-type": "audio/mpeg" } });
};
const seed = (kind: "music" | "sfx", identity = "") => {
  const hash = createHash("sha256").update(`${identity}${kind}\0${prompt.toLowerCase()}`).digest("hex");
  const path = `${kind}/generated/${hash}.mp3`;
  mkdirSync(join(directory, "game-assets", kind, "generated"), { recursive: true });
  writeFileSync(join(directory, "game-assets", path), bytes);
  return path;
};
try {
  await settings.set(
    TTS_SETTINGS_KEY,
    JSON.stringify(
      ttsConfigSchema.parse({
        enabled: false,
        source: "elevenlabs",
        baseUrl: "https://api.elevenlabs.io",
        apiKey: encryptApiKey("fixture-key"),
        elevenLabsGameMusic: true,
        elevenLabsGameSoundEffects: true,
      }),
    ),
  );
  await migrateGenerativeAudioConnections(db);
  const blob = await connections.getDefaultForAudioGeneration();
  assert(blob && !blob.audioGenerationLegacyConnectionId, "standalone settings migrate without a speech-row alias");
  for (const kind of ["sfx", "music"] as const) {
    const path = seed(kind);
    const asset = await generateAudioAsset(db, { kind, prompt, audioConnectionId: blob.id });
    assert.equal(asset.path, path, `${kind} preserves the legacy standalone ElevenLabs cache`);
    assert.equal(asset.cached, true);
    assert.equal(calls.length, 0, "an existing cue never contacts a provider");
  }

  const speech = await connections.create(
    createConnectionSchema.parse({
      name: "Legacy compatible generation",
      provider: "audio",
      audioSource: "openai",
      apiKey: "fixture-key",
      baseUrl: "https://1.1.1.1/v1",
      model: "legacy-model",
      audioMusic: true,
      audioSoundEffects: true,
      audioMusicEndpoint: "music",
      audioSoundEffectsEndpoint: "sfx",
      audioGenerationFormat: "binary",
    }),
  );
  await migrateGenerativeAudioConnections(db);
  const custom = await connections.getAudioGenerationForLegacyConnection(speech.id);
  assert(custom);
  for (const kind of ["music", "sfx"] as const) {
    const path = seed(kind, `https://1.1.1.1/v1\0legacy-model\0binary\0${kind}\0`);
    for (const audioConnectionId of [speech.id, custom.id]) {
      const asset = await generateAudioAsset(db, { kind, prompt, audioConnectionId });
      assert.equal(asset.path, path, `${kind} preserves the compatible cache through both IDs`);
      assert.equal(asset.cached, true);
      assert.equal(calls.length, 0);
    }
  }

  const otherModel = await connections.create(
    createConnectionSchema.parse({
      name: "Different ElevenLabs model",
      provider: "audio_generation",
      audioGenerationSource: "elevenlabs",
      apiKey: "fixture-key",
      model: "music_v2_5",
      audioMusic: true,
    }),
  );
  const modelPath = seed("music", "elevenlabs\0https://api.elevenlabs.io\0music_v2_5\0binary\0\0");
  const otherModelAsset = await generateAudioAsset(db, { kind: "music", prompt, audioConnectionId: otherModel.id });
  assert.notEqual(otherModelAsset.path, seed("music"), "a genuinely different model cannot consume the old cue");
  assert.equal(otherModelAsset.path, modelPath);
  assert.equal(otherModelAsset.cached, true);
  assert.equal(calls.length, 0);

  const otherEndpoint = await connections.create(
    createConnectionSchema.parse({
      name: "Different ElevenLabs endpoint",
      provider: "audio",
      audioSource: "elevenlabs",
      apiKey: "fixture-key",
      baseUrl: "https://8.8.8.8",
      audioSoundEffects: true,
    }),
  );
  await migrateGenerativeAudioConnections(db);
  const [independent, concurrent] = await Promise.all(
    [1, 2].map(() => generateAudioAsset(db, { kind: "sfx", prompt, audioConnectionId: otherEndpoint.id })),
  );
  assert.notEqual(independent.path, seed("sfx"), "a migrated non-default endpoint cannot claim ambiguous legacy audio");
  assert.equal(independent.cached, false);
  assert.equal(concurrent.path, independent.path);
  assert.equal(calls.length, 1, "concurrent listeners still share one composition");
  assert.equal(
    (await generateAudioAsset(db, { kind: "sfx", prompt, audioConnectionId: otherEndpoint.id })).cached,
    true,
  );
  assert.equal(calls.length, 1);
  console.info(
    "Legacy blob and compatible caches survive migration; different models/endpoints and concurrent calls stay isolated.",
  );
} finally {
  globalThis.fetch = originalFetch;
  rmSync(directory, { recursive: true, force: true });
}
