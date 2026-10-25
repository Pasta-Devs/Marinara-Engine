import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const directory = mkdtempSync(join(tmpdir(), "marinara-audio-readiness-"));
process.env.DATA_DIR = directory;
process.env.FILE_STORAGE_DIR = join(directory, "storage");
process.env.MARINARA_ENV_FILE = join(directory, ".env");
process.env.LOG_LEVEL = "silent";
const require = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const { createFileNativeDB } = await import("../../packages/server/src/db/file-backed-store.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { createConnectionSchema, TTS_SETTINGS_KEY, ttsConfigSchema } =
  await import("../../packages/shared/dist/index.js");
const { createAppSettingsStorage } = await import("../../packages/server/src/services/storage/app-settings.storage.js");
const { migrateGenerativeAudioConnections } =
  await import("../../packages/server/src/services/connections/generative-audio-connection-migration.js");
const { encryptApiKey } = await import("../../packages/server/src/utils/crypto.js");
const { filterAudioGenerationConnections, matchesAudioGenerationConnectionId } =
  await import("../../packages/client/src/lib/connection-filters.js");
const { audioRoutes } = await import("../../packages/server/src/routes/audio.routes.js");
const { connectionsRoutes } = await import("../../packages/server/src/routes/connections.routes.js");
const { errorHandler } = await import("../../packages/server/src/middleware/error-handler.js");
const db = await createFileNativeDB();
const connections = createConnectionsStorage(db);
const app = require("fastify")();
app.decorate("db", db);
app.setErrorHandler(errorHandler);
await app.register(audioRoutes, { prefix: "/api/audio" });
await app.register(connectionsRoutes, { prefix: "/api/connections" });
const originalFetch = globalThis.fetch;
let fetches = 0;
globalThis.fetch = async () => {
  fetches++;
  throw new Error("A readiness probe must never contact a provider");
};
try {
  const savedMusic = {
    name: "Saved Suno music",
    provider: "audio_generation",
    audioGenerationSource: "sunoapi",
    audioMusic: true,
  };
  for (const callback of [
    "https://127.0.0.1/audio",
    "https://localhost:3000/audio",
    "https://[::1]/audio",
    "https://10.0.0.1/audio",
    "https://169.254.169.254/audio",
    "https://speaker.local/audio",
    "https://user:pass@8.8.8.8/audio",
    "http://8.8.8.8/audio",
    null,
  ]) {
    const count = (await connections.list()).length;
    const response = await app.inject({
      method: "POST",
      url: "/api/connections",
      payload: { ...savedMusic, audioGenerationCallbackUrl: callback },
    });
    assert.equal(response.statusCode, 400, `save must reject unusable music callback ${callback}: ${response.body}`);
    assert.equal((await connections.list()).length, count, "failed validation must not persist a connection");
  }
  const accepted = await app.inject({
    method: "POST",
    url: "/api/connections",
    payload: { ...savedMusic, audioGenerationCallbackUrl: "https://8.8.8.8/audio" },
  });
  assert.equal(accepted.statusCode, 200, accepted.body);
  const acceptedId = accepted.json().id;
  const rejectedPatch = await app.inject({
    method: "PATCH",
    url: `/api/connections/${acceptedId}`,
    payload: { name: "Must not persist", audioGenerationCallbackUrl: "https://127.0.0.1/audio" },
  });
  assert.equal(rejectedPatch.statusCode, 400, rejectedPatch.body);
  assert.equal((await connections.getById(acceptedId))?.name, savedMusic.name);
  assert.equal((await connections.getById(acceptedId))?.audioGenerationCallbackUrl, "https://8.8.8.8/audio");
  const sfxOnly = await app.inject({
    method: "POST",
    url: "/api/connections",
    payload: { ...savedMusic, audioMusic: false, audioSoundEffects: true },
  });
  assert.equal(sfxOnly.statusCode, 200, "Suno sound effects do not require a music callback");
  const rejectedEnable = await app.inject({
    method: "PATCH",
    url: `/api/connections/${sfxOnly.json().id}`,
    payload: { audioMusic: true },
  });
  assert.equal(rejectedEnable.statusCode, 400, "partial music enablement validates the merged saved connection");
  const row = await connections.create(
    createConnectionSchema.parse({
      name: "Suno readiness",
      provider: "audio_generation",
      audioGenerationSource: "sunoapi",
      audioMusic: true,
      audioSoundEffects: true,
      apiKey: "fixture-key",
    }),
  );
  const probe = async (id = row.id) => {
    const response = await app.inject({ method: "GET", url: `/api/audio/config?audioConnectionId=${id}` });
    assert.equal(response.statusCode, 200, response.body);
    assert(!response.body.includes("fixture-key"));
    return response.json();
  };
  for (const callback of [null, "http://8.8.8.8/audio", "https://127.0.0.1/audio", "https://user:pass@8.8.8.8/audio"]) {
    await connections.update(row.id, { audioGenerationCallbackUrl: callback });
    assert.deepEqual(
      await probe(),
      {
        connectionId: row.id,
        configured: true,
        music: false,
        soundEffects: true,
        source: "sunoapi",
      },
      `invalid music callback ${callback} leaves usable sound effects available`,
    );
  }
  await connections.update(row.id, { audioGenerationCallbackUrl: "https://8.8.8.8/audio" });
  assert.equal((await probe()).music, true, "a public HTTPS callback satisfies the music prerequisite");
  await connections.update(row.id, { apiKey: "" });
  assert.deepEqual(
    await probe(),
    {
      connectionId: row.id,
      configured: false,
      music: false,
      soundEffects: false,
      source: "sunoapi",
    },
    "a missing remote key makes both capabilities unavailable",
  );

  const custom = await connections.create(
    createConnectionSchema.parse({
      name: "Custom readiness",
      provider: "audio_generation",
      audioGenerationSource: "custom",
      baseUrl: "https://8.8.8.8/v1",
      audioMusic: true,
      audioSoundEffects: true,
    }),
  );
  assert.equal((await probe(custom.id)).music, false, "a compatible source still requires its music endpoint");
  assert.equal((await probe(custom.id)).soundEffects, false, "a compatible source also requires its SFX endpoint");
  await connections.update(custom.id, { audioMusicEndpoint: "music" });
  assert.equal((await probe(custom.id)).music, true, "a compatible source may intentionally have no key");
  assert.equal((await probe(custom.id)).soundEffects, false, "enabling the music endpoint does not enable SFX");
  await connections.update(custom.id, { audioSoundEffectsEndpoint: "sfx" });
  assert.equal((await probe(custom.id)).soundEffects, true);

  await connections.update(custom.id, { defaultForAgents: true });
  await createAppSettingsStorage(db).set(
    TTS_SETTINGS_KEY,
    JSON.stringify(
      ttsConfigSchema.parse({
        enabled: false,
        source: "elevenlabs",
        baseUrl: "https://api.elevenlabs.io",
        apiKey: encryptApiKey("legacy-blob-key"),
        elevenLabsGameMusic: true,
        elevenLabsGameSoundEffects: true,
      }),
    ),
  );
  await migrateGenerativeAudioConnections(db);
  const migratedRows = await connections.list();
  const blob = migratedRows.find((entry) => entry.name === "ElevenLabs — Music & Sound Effects");
  assert(blob && blob.provider === "audio_generation");
  assert.notEqual(
    blob.defaultForAgents,
    "true",
    "preserving another configuration must not replace the chosen default",
  );
  assert.notEqual(blob.fallbackForAgents, "true");
  assert(!blob.audioGenerationLegacyConnectionId, "standalone settings have no historical speech-row id");
  assert(
    filterAudioGenerationConnections(migratedRows).some((entry) => matchesAudioGenerationConnectionId(entry, blob.id)),
    "the preserved non-default connection remains available to the actual Game audio selector",
  );
  assert.deepEqual(await probe(blob.id), {
    connectionId: blob.id,
    configured: true,
    music: true,
    soundEffects: true,
    source: "elevenlabs",
  });
  const defaultProbe = await app.inject({ method: "GET", url: "/api/audio/config" });
  assert.equal(defaultProbe.statusCode, 200, defaultProbe.body);
  assert.equal(defaultProbe.json().connectionId, custom.id, "explicit blob access leaves the chosen default intact");
  await migrateGenerativeAudioConnections(db);
  assert.equal((await connections.list()).length, migratedRows.length, "non-default blob migration remains idempotent");
  await connections.remove(blob.id);
  await migrateGenerativeAudioConnections(db);
  assert.equal(await connections.getById(blob.id), null, "deleting the preserved connection does not recreate it");
  assert.equal(fetches, 0, "checking prerequisites submits no request or paid composition");
  console.info(
    "PASS: independent music/SFX readiness, shared Suno public-HTTPS callback validation, keys, compatible endpoints, selectable non-default legacy settings and no provider I/O",
  );
} finally {
  globalThis.fetch = originalFetch;
  await app.close();
  await db._fileStore.close();
  rmSync(directory, { recursive: true, force: true });
}
