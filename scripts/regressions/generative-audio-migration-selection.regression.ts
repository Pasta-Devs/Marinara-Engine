import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const directory = mkdtempSync(join(tmpdir(), "marinara-audio-migration-selection-"));
process.env.DATA_DIR = directory;
process.env.FILE_STORAGE_DIR = join(directory, "storage");
process.env.MARINARA_ENV_FILE = join(directory, ".env");
process.env.LOG_LEVEL = "silent";
const { createFileNativeDB } = await import("../../packages/server/src/db/file-backed-store.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { createAppSettingsStorage } = await import("../../packages/server/src/services/storage/app-settings.storage.js");
const { migrateGenerativeAudioConnections } =
  await import("../../packages/server/src/services/connections/generative-audio-connection-migration.js");
const { resolveGenerativeAudioConfig } = await import("../../packages/server/src/services/audio/generative-audio.service.js");
const { createConnectionSchema, TTS_SETTINGS_KEY, ttsConfigSchema } = await import("../../packages/shared/dist/index.js");
const { apiConnections, appSettings } = await import("../../packages/server/src/db/schema/index.js");
const { encryptApiKey } = await import("../../packages/server/src/utils/crypto.js");
const db = await createFileNativeDB();
const connections = createConnectionsStorage(db);
const settings = createAppSettingsStorage(db);
const reset = async () => {
  await db.delete(apiConnections);
  await db.delete(appSettings);
};
const speech = (name: string, extra: Record<string, unknown> = {}) =>
  connections.create(
    createConnectionSchema.parse({
      name,
      provider: "audio",
      audioSource: "elevenlabs",
      baseUrl: `https://${name}.example.com`,
      apiKey: "row-key",
      audioVoice: "retained-voice",
      audioMusic: true,
      ...extra,
    }),
  );
const storeConfig = async (extra: Record<string, unknown> = {}) => {
  const raw = JSON.stringify(
    ttsConfigSchema.parse({
      source: "elevenlabs",
      enabled: false,
      baseUrl: "https://blob.example.com",
      elevenLabsGameMusic: true,
      apiKey: encryptApiKey("blob-key"),
      ...extra,
    }),
  );
  await settings.set(TTS_SETTINGS_KEY, raw);
  return raw;
};
const generationRows = async () => (await connections.list()).filter((row) => row.provider === "audio_generation");
try {
  const row = await speech("unflagged");
  const originalConfig = await storeConfig();
  await migrateGenerativeAudioConnections(db);
  assert.equal((await generationRows()).length, 2, "an explicit row and independent legacy settings remain separate configurations");
  const explicit = await connections.getAudioGenerationForLegacyConnection(row.id);
  assert(explicit);
  assert.equal(explicit.baseUrl, row.baseUrl);
  assert.equal((await resolveGenerativeAudioConfig(db, row.id)).apiKey, "row-key");
  assert.equal((await resolveGenerativeAudioConfig(db)).baseUrl, "https://blob.example.com");
  assert.equal((await resolveGenerativeAudioConfig(db)).apiKey, "blob-key", "the default preserves the legacy settings identity");
  assert.equal((await connections.getById(row.id))?.audioVoice, "retained-voice");
  assert.equal(await settings.get(TTS_SETTINGS_KEY), originalConfig, "speech settings stay byte-identical");
  await migrateGenerativeAudioConnections(db);
  assert.equal((await generationRows()).length, 2, "migration is idempotent");
  for (const migrated of await generationRows()) await connections.remove(migrated.id);
  await migrateGenerativeAudioConnections(db);
  assert.equal((await generationRows()).length, 0, "a deleted migrated selection stays deleted");

  for (const fallbackForAgents of [false, true]) {
    await reset();
    const chosen = await speech("chosen-disabled", { audioMusic: false });
    const fallback = await speech("enabled-fallback", { fallbackForAgents });
    await storeConfig({ connectionId: chosen.id });
    await migrateGenerativeAudioConnections(db);
    const resolved = await resolveGenerativeAudioConfig(db);
    const split = await connections.getAudioGenerationForLegacyConnection(fallback.id);
    assert(split);
    assert.equal(resolved.id, split.id, "a chosen speech-only row cannot hide another row's enabled generation");
    assert.equal(split.defaultForAgents, "false");
    assert.equal(split.fallbackForAgents, "true");
    assert.equal(await connections.getAudioGenerationForLegacyConnection(chosen.id), null);
  }

  await reset();
  const other = await speech("other");
  const chosen = await speech("chosen-enabled");
  await storeConfig({ connectionId: chosen.id });
  await migrateGenerativeAudioConnections(db);
  const chosenSplit = await connections.getAudioGenerationForLegacyConnection(chosen.id);
  const otherSplit = await connections.getAudioGenerationForLegacyConnection(other.id);
  assert(chosenSplit && otherSplit);
  assert.equal((await resolveGenerativeAudioConfig(db)).id, chosenSplit.id, "the explicit chosen row wins over table order");
  assert.equal(chosenSplit.defaultForAgents, "true");
  assert.equal(chosenSplit.fallbackForAgents, "false");
  assert.equal(otherSplit.fallbackForAgents, "true");

  await reset();
  const disabled = await speech("selected-speech-only", { audioMusic: false });
  await speech("unmarked-earlier");
  const marked = await speech("marked-later", { fallbackForAgents: true });
  await storeConfig({ connectionId: disabled.id });
  await migrateGenerativeAudioConnections(db);
  const markedSplit = await connections.getAudioGenerationForLegacyConnection(marked.id);
  assert(markedSplit);
  assert.equal((await resolveGenerativeAudioConfig(db)).id, markedSplit.id, "an explicit fallback wins over earlier unmarked rows");

  await reset();
  await storeConfig();
  await migrateGenerativeAudioConnections(db);
  assert.equal((await generationRows()).length, 1, "settings-only generation survives while speech is disabled");
  assert.equal((await resolveGenerativeAudioConfig(db)).baseUrl, "https://blob.example.com");
  assert.equal((await connections.list()).filter((entry) => entry.provider === "audio").length, 0);
  await migrateGenerativeAudioConnections(db);
  assert.equal((await generationRows()).length, 1);

  console.info("PASS: independent row/blob identities, reachable unflagged/fallback rows, chosen-row priority, idempotence, deletion and speech-off blob continuity");
} finally {
  await db._fileStore.close();
  rmSync(directory, { recursive: true, force: true });
}
