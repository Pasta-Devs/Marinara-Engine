// PUT /api/tts/config/voice-assignment changes one character's voice row and nothing else, so a
// voice saved from the Character Editor cannot undo a Text to Speech setting saved after the
// page last read the config (another tab, or the settings card). PUT /api/tts/config/voice-mode,
// behind the Voice section's "Use a voice per character", changes only the voice mode.
//
// Both config writes also run one at a time. Storage holds plain writes while a transaction is
// open, and reads are not held, so without that a save that read the old settings could land
// after a newer save and overwrite it.
//
// Project imports are dynamic, after the env assignments, so nothing opens a real data folder.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-tts-voice-assignment-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
process.env.MARINARA_ENV_FILE = join(dataDir, ".env");

type TTSConfig = import("../../../packages/shared/src/types/tts.js").TTSConfig;
const requireServer = createRequire(new URL("../../../packages/server/package.json", import.meta.url));
const Fastify = requireServer("fastify") as typeof import("fastify").default;
const { TTS_API_KEY_MASK, TTS_SETTINGS_KEY } = await import("../../../packages/shared/src/types/tts.js");
const { createFileNativeDB } = await import("../../../packages/server/src/db/file-backed-store.js");
const { createAppSettingsStorage } = await import("../../../packages/server/src/services/storage/app-settings.storage.js");
const { decryptApiKey } = await import("../../../packages/server/src/utils/crypto.js");
const { errorHandler } = await import("../../../packages/server/src/middleware/error-handler.js");
const { ttsRoutes } = await import("../../../packages/server/src/routes/tts.routes.js");

let failNextWrite = false;
const db = await createFileNativeDB({
  afterWritableTurn: () => {
    if (!failNextWrite) return;
    failNextWrite = false;
    throw new Error("injected storage write failure");
  },
});
const settings = createAppSettingsStorage(db);
const app = Fastify();
app.decorate("db", db);
app.setErrorHandler(errorHandler);
await app.register(ttsRoutes, { prefix: "/api/tts" });

const stored = async () => JSON.parse((await settings.get(TTS_SETTINGS_KEY)) ?? "null") as TTSConfig;
const readConfig = async () => (await app.inject({ method: "GET", url: "/api/tts/config" })).json<TTSConfig>();
const putConfig = (config: unknown) => app.inject({ method: "PUT", url: "/api/tts/config", payload: config as object });
const putVoice = (body: unknown) =>
  app.inject({ method: "PUT", url: "/api/tts/config/voice-assignment", payload: body as object });
const putVoiceMode = (body: unknown) =>
  app.inject({ method: "PUT", url: "/api/tts/config/voice-mode", payload: body as object });

try {
  // Saved the way the Text to Speech card saves: a whole config with a plain key, encrypted on the server.
  const seeded = await putConfig({
    enabled: true,
    source: "openai",
    apiKey: "sk-regression-secret",
    voice: "alloy",
    voiceMode: "per-character",
    narratorVoiceEnabled: true,
    narratorVoice: "sage",
    voiceAssignments: [
      { characterId: "alice", characterName: "Alice", voice: "nova" },
      { characterId: "dottore", characterName: "Dottore", voice: "onyx" },
    ],
    sourceProfiles: { elevenlabs: { apiKey: "eleven-secret", voice: "rachel" } },
  });
  assert.equal(seeded.statusCode, 204);

  // The editor page reads the config; then another tab saves a new speed the page has not seen.
  const pageView = await readConfig();
  assert.equal(pageView.speed, 1);
  assert.equal((await putConfig({ ...pageView, speed: 1.75 })).statusCode, 204);
  const beforeVoiceSave = await stored();
  assert.equal(beforeVoiceSave.speed, 1.75);
  assert.ok(beforeVoiceSave.apiKey && beforeVoiceSave.apiKey !== "sk-regression-secret", "the key is stored encrypted");

  const voiceSave = await putVoice({ characterId: "alice", characterName: "Alice", voice: "shimmer" });
  assert.equal(voiceSave.statusCode, 204);
  assert.equal(voiceSave.body, "", "the route answers with no body, so nothing stored is sent back");
  const afterVoiceSave = await stored();
  const expected = structuredClone(beforeVoiceSave);
  expected.voiceAssignments = [
    { characterId: "alice", characterName: "Alice", voice: "shimmer" },
    { characterId: "dottore", characterName: "Dottore", voice: "onyx" },
  ];
  // The active source profile mirrors the list, exactly as PUT /config stores it.
  expected.sourceProfiles.openai!.voiceAssignments = expected.voiceAssignments;
  assert.deepEqual(
    afterVoiceSave,
    expected,
    "only this character's row changes: the newer speed, other rows, settings and stored keys stay as stored",
  );
  assert.equal(decryptApiKey(afterVoiceSave.apiKey), "sk-regression-secret");
  assert.equal(decryptApiKey(afterVoiceSave.sourceProfiles.elevenlabs!.apiKey), "eleven-secret");
  assert.equal((await readConfig()).apiKey, TTS_API_KEY_MASK);
  assert.equal((await putConfig(await readConfig())).statusCode, 204);
  assert.deepEqual(await stored(), afterVoiceSave, "the stored format is the one a fresh PUT /config keeps unchanged");

  // A new card gets its own row after the others; a renamed card keeps its row's place with the new name.
  assert.equal((await putVoice({ characterId: "alice-au", characterName: "Alice", voice: "coral" })).statusCode, 204);
  assert.equal(
    (await putVoice({ characterId: "dottore", characterName: "Il Dottore", voice: "onyx" })).statusCode,
    204,
  );
  assert.deepEqual((await stored()).voiceAssignments, [
    { characterId: "alice", characterName: "Alice", voice: "shimmer" },
    { characterId: "dottore", characterName: "Il Dottore", voice: "onyx" },
    { characterId: "alice-au", characterName: "Alice", voice: "coral" },
  ]);

  // A blank voice drops the character's row, so it uses the default voice again.
  assert.equal((await putVoice({ characterId: "alice", characterName: "Alice", voice: "  " })).statusCode, 204);
  const afterClear = await stored();
  assert.deepEqual(afterClear.voiceAssignments, [
    { characterId: "dottore", characterName: "Il Dottore", voice: "onyx" },
    { characterId: "alice-au", characterName: "Alice", voice: "coral" },
  ]);
  assert.deepEqual(afterClear.sourceProfiles.openai!.voiceAssignments, afterClear.voiceAssignments);

  // Invalid input is rejected and changes nothing.
  for (const body of [
    {},
    { characterId: "", characterName: "Alice", voice: "nova" },
    { characterId: "alice", characterName: "Alice" },
    { characterId: "alice", characterName: "Alice", voice: 7 },
    { characterId: "x".repeat(201), characterName: "Alice", voice: "nova" },
    // POST /speak takes at most 200 characters, so a longer voice could never be spoken.
    { characterId: "alice", characterName: "Alice", voice: "v".repeat(201) },
  ]) {
    const rejected = await putVoice(body);
    assert.equal(rejected.statusCode, 400, `rejects ${JSON.stringify(body).slice(0, 80)}`);
  }
  assert.deepEqual(await stored(), afterClear);

  // An open transaction holds both writes. The settings save arrives first and has read the
  // stored config; the voice save arrives while it is held. The voice save must read only after
  // the settings save lands, or one of the two changes is overwritten.
  const tabView = await readConfig();
  let releaseTransaction!: () => void;
  const transactionHeld = new Promise<void>((resolve) => {
    releaseTransaction = resolve;
  });
  const transaction = db.transaction(async () => {
    await transactionHeld;
  });
  const settle = () => new Promise((resolve) => setTimeout(resolve, 50));
  const settingsSave = putConfig({ ...tabView, speed: 2.5 });
  await settle();
  const racedVoiceSave = putVoice({ characterId: "alice-au", characterName: "Alice", voice: "echo" });
  await settle();
  releaseTransaction();
  await transaction;
  assert.equal((await settingsSave).statusCode, 204);
  assert.equal((await racedVoiceSave).statusCode, 204);
  const raced = await stored();
  assert.equal(raced.speed, 2.5, "a voice save that read the old settings must not undo the newer speed");
  assert.deepEqual(
    raced.voiceAssignments,
    [
      { characterId: "dottore", characterName: "Il Dottore", voice: "onyx" },
      { characterId: "alice-au", characterName: "Alice", voice: "echo" },
    ],
    "the settings save must not overwrite the voice saved after it",
  );

  // A failed write answers 500 and stores nothing, and the saves after it still go through.
  failNextWrite = true;
  assert.equal((await putVoice({ characterId: "dottore", characterName: "Il Dottore", voice: "ash" })).statusCode, 500);
  assert.deepEqual(await stored(), raced);
  assert.equal((await putConfig({ ...(await readConfig()), speed: 3 })).statusCode, 204);
  assert.equal((await putVoice({ characterId: "dottore", characterName: "Il Dottore", voice: "ash" })).statusCode, 204);
  const recovered = await stored();
  assert.equal(recovered.speed, 3);
  assert.deepEqual(recovered.voiceAssignments[0], {
    characterId: "dottore",
    characterName: "Il Dottore",
    voice: "ash",
  });

  // "Use a voice per character" changes only the voice mode, so it cannot undo a newer save either.
  assert.equal((await putVoiceMode({ voiceMode: "single" })).statusCode, 204);
  const expectedSingle = structuredClone(recovered);
  expectedSingle.voiceMode = "single";
  expectedSingle.sourceProfiles.openai!.voiceMode = "single";
  assert.deepEqual(
    await stored(),
    expectedSingle,
    "only the voice mode changes, in the settings and the active profile",
  );
  assert.equal((await putVoiceMode({ voiceMode: "per-character" })).statusCode, 204);
  assert.deepEqual(await stored(), recovered);
  for (const body of [{}, { voiceMode: "both" }, { voiceMode: 1 }]) {
    assert.equal((await putVoiceMode(body)).statusCode, 400, `rejects ${JSON.stringify(body)}`);
  }
  assert.deepEqual(await stored(), recovered);

  // Settings this version cannot read, such as a newer version's provider, are kept instead of replaced by defaults.
  const unreadable = JSON.stringify({ ...recovered, source: "newer-provider" });
  await settings.set(TTS_SETTINGS_KEY, unreadable);
  assert.equal((await putVoice({ characterId: "alice", characterName: "Alice", voice: "nova" })).statusCode, 409);
  assert.equal((await putVoiceMode({ voiceMode: "single" })).statusCode, 409);
  assert.equal(await settings.get(TTS_SETTINGS_KEY), unreadable);
} finally {
  await app.close();
  await db._fileStore.close();
  rmSync(dataDir, { recursive: true, force: true });
}

console.info("TTS voice assignment route regression passed.");
