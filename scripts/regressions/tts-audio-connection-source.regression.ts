// #7848: the Text to Speech card's Source can be an Audio connection, so its address, key and model
// are entered once. The card stores only the connection's ID. Speech, the preview and voice discovery
// read the address, key and model from the connection on the server, and the key never reaches the
// settings or the browser. Voices and speech settings are kept per connection ID, so two connections
// on the same adapter never borrow each other's. The four regular sources keep their own settings
// untouched, and a missing or unusable connection is refused, never swapped for another one.
//
// Project imports are dynamic, after the env assignments, so nothing opens a real data folder.
import assert from "node:assert/strict";
import { createServer, type IncomingMessage } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-tts-audio-connection-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
process.env.MARINARA_ENV_FILE = join(dataDir, ".env");
process.env.TTS_LOCAL_URLS_ENABLED = "true";

type TTSConfig = import("../../packages/shared/src/types/tts.js").TTSConfig;
const requireServer = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const Fastify = requireServer("fastify") as typeof import("fastify").default;
const { TTS_API_KEY_MASK, TTS_SETTINGS_KEY } = await import("../../packages/shared/src/types/tts.js");
const { createConnectionSchema } = await import("../../packages/shared/src/schemas/connection.schema.js");
const { createFileNativeDB } = await import("../../packages/server/src/db/file-backed-store.js");
const { apiConnections } = await import("../../packages/server/src/db/schema/index.js");
const { eq } = await import("../../packages/server/src/db/file-query.js");
const { createAppSettingsStorage } = await import("../../packages/server/src/services/storage/app-settings.storage.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { decryptApiKey } = await import("../../packages/server/src/utils/crypto.js");
const { errorHandler } = await import("../../packages/server/src/middleware/error-handler.js");
const { ttsRoutes } = await import("../../packages/server/src/routes/tts.routes.js");

// A voice server with three addresses: the card's own source, and two OpenAI-compatible services.
type ProviderRequest = { path: string; authorization: string; body: Record<string, unknown> | null };
const providerRequests: ProviderRequest[] = [];
const VOICE_LISTS: Record<string, string[]> = {
  "/legacy/v1/audio/voices": ["legacy-voice"],
  "/a/v1/audio/voices": ["alpha-1", "alpha-2"],
  "/b/v1/audio/voices": ["beta-1"],
};
const readBody = async (request: IncomingMessage) => {
  let text = "";
  for await (const chunk of request) text += chunk;
  return text ? (JSON.parse(text) as Record<string, unknown>) : null;
};
const provider = createServer(async (request, response) => {
  const path = new URL(request.url ?? "/", "http://localhost").pathname;
  providerRequests.push({ path, authorization: request.headers.authorization ?? "", body: await readBody(request) });
  const voices = VOICE_LISTS[path];
  if (voices) {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ voices: voices.map((id) => ({ voice_id: id, name: id })) }));
    return;
  }
  if (path.endsWith("/audio/speech")) {
    response.writeHead(200, { "content-type": "audio/mpeg" });
    response.end(Buffer.from([0xff, 0xfb, 0x90, 0x00]));
    return;
  }
  response.writeHead(404, { "content-type": "application/json" });
  response.end("{}");
});

const db = await createFileNativeDB();
const settings = createAppSettingsStorage(db);
const connections = createConnectionsStorage(db);
const app = Fastify();
app.decorate("db", db);
app.setErrorHandler(errorHandler);
await app.register(ttsRoutes, { prefix: "/api/tts" });

const stored = async () => JSON.parse((await settings.get(TTS_SETTINGS_KEY)) ?? "null") as TTSConfig;
const readConfig = async () => (await app.inject({ method: "GET", url: "/api/tts/config" })).json<TTSConfig>();
const putConfig = async (config: unknown) => {
  const response = await app.inject({ method: "PUT", url: "/api/tts/config", payload: config as object });
  assert.equal(response.statusCode, 204, response.body);
};
const speak = async (audioConnectionId?: string) => {
  const before = providerRequests.length;
  const response = await app.inject({
    method: "POST",
    url: "/api/tts/speak",
    payload: { text: "Hello there.", ...(audioConnectionId !== undefined ? { audioConnectionId } : {}) },
  });
  return { response, sent: providerRequests.slice(before) };
};
const getRoute = (url: string) => app.inject({ method: "GET", url });

try {
  await new Promise<void>((resolve) => provider.listen(0, "127.0.0.1", resolve));
  const address = provider.address();
  assert.ok(address && typeof address !== "string");
  const origin = `http://127.0.0.1:${address.port}`;

  const createAudioConnection = async (input: Record<string, unknown>) =>
    connections.create(createConnectionSchema.parse({ provider: "audio", audioSource: "openai", ...input }));
  // Connection A is also the default audio connection, so a refused choice could not quietly fall back to it.
  const connectionA = await createAudioConnection({
    name: "Studio A",
    baseUrl: `${origin}/a/v1`,
    apiKey: "key-a",
    model: "model-a",
    defaultForAgents: true,
  });
  // Connection B uses the same adapter and leaves its model blank.
  const connectionB = await createAudioConnection({ name: "Studio B", baseUrl: `${origin}/b/v1`, apiKey: "key-b" });
  const encryptedKeys = await Promise.all(
    [connectionA.id, connectionB.id].map(async (id) => (await connections.getById(id))!.apiKeyEncrypted),
  );
  const assertNoKeys = (text: string, where: string) => {
    for (const secret of ["key-a", "key-b", "legacy-secret", "eleven-secret", ...encryptedKeys]) {
      assert.ok(!text.includes(secret), `${where} must not carry a key (${secret.slice(0, 6)}…)`);
    }
  };

  // The card's own source settings, saved before any connection is chosen.
  await putConfig({
    enabled: true,
    source: "openai",
    baseUrl: `${origin}/legacy/v1`,
    apiKey: "legacy-secret",
    model: "legacy-model",
    voice: "legacy-voice",
    speed: 1.25,
    sourceProfiles: { elevenlabs: { apiKey: "eleven-secret", voice: "rachel" } },
  });
  const legacyStored = await stored();
  assert.equal(legacyStored.connectionId, "", "no connection is chosen until the card picks one");
  assert.deepEqual(legacyStored.connectionProfiles, {});
  const legacyIdentity = (config: TTSConfig) => ({
    source: config.source,
    baseUrl: config.baseUrl,
    model: config.model,
    apiKey: decryptApiKey(config.apiKey),
    openai: { ...config.sourceProfiles.openai, apiKey: decryptApiKey(config.sourceProfiles.openai!.apiKey) },
    elevenlabs: {
      ...config.sourceProfiles.elevenlabs,
      apiKey: decryptApiKey(config.sourceProfiles.elevenlabs!.apiKey),
    },
  });
  const legacyBefore = legacyIdentity(legacyStored);
  assert.equal(legacyBefore.apiKey, "legacy-secret");

  // ── The card picks connection A. It sends what it read plus the connection ID and its own voices. ──
  const legacyView = await readConfig();
  await putConfig({
    ...legacyView,
    connectionId: connectionA.id,
    voice: "alpha-1",
    narratorVoice: "alpha-1",
    speed: 1.5,
    // What the card shows while A is chosen: A's address and model. The server must not store them.
    baseUrl: `${origin}/a/v1`,
    model: "model-a",
  });
  const chosenA = await stored();
  assert.equal(chosenA.connectionId, connectionA.id, "the choice is stored as the connection's ID");
  assert.deepEqual(legacyIdentity(chosenA), legacyBefore, "the card's own source settings stay exactly as saved");
  assert.equal(chosenA.connectionProfiles[connectionA.id]?.voice, "alpha-1");
  assert.equal(chosenA.connectionProfiles[connectionA.id]?.speed, 1.5);
  for (const field of ["apiKey", "baseUrl", "model"]) {
    assert.ok(!(field in chosenA.connectionProfiles[connectionA.id]!), `a connection profile never holds ${field}`);
  }
  assertNoKeys(JSON.stringify(chosenA), "the stored settings");

  // Readers see the adapter, address and model A speaks with, never a key.
  const viewA = await readConfig();
  assert.equal(viewA.connectionId, connectionA.id);
  assert.equal(viewA.source, "openai");
  assert.equal(viewA.baseUrl, `${origin}/a/v1`);
  assert.equal(viewA.model, "model-a");
  assert.equal(viewA.voice, "alpha-1");
  assert.equal(viewA.apiKey, TTS_API_KEY_MASK);
  assertNoKeys(JSON.stringify(viewA), "GET /api/tts/config");
  // Saving what was read keeps the stored settings as they are.
  await putConfig(viewA);
  assert.deepEqual(await stored(), chosenA, "a save of the read settings changes nothing");

  // ── Speech, the card's preview and voice discovery use A's address, key and model. ──
  for (const audioConnectionId of [undefined, ""]) {
    const { response, sent } = await speak(audioConnectionId);
    assert.equal(response.statusCode, 200, response.body);
    assert.equal(sent.length, 1);
    assert.equal(sent[0]!.path, "/a/v1/audio/speech");
    assert.equal(sent[0]!.authorization, "Bearer key-a", "the key comes from the connection");
    assert.equal(sent[0]!.body?.model, "model-a");
    assert.equal(sent[0]!.body?.voice, "alpha-1");
    assert.equal(sent[0]!.body?.speed, 1.5);
  }
  const voicesA = await getRoute("/api/tts/voices");
  assert.equal(voicesA.statusCode, 200, voicesA.body);
  assert.deepEqual(voicesA.json().voices, ["alpha-1", "alpha-2"]);
  assert.equal(voicesA.json().fromProvider, true);
  assert.equal(providerRequests.at(-1)!.authorization, "Bearer key-a");
  assertNoKeys(voicesA.body, "GET /api/tts/voices");

  // A new key on the connection is used at once: nothing was copied.
  await connections.update(connectionA.id, { apiKey: "key-a-rotated" });
  assert.equal((await speak()).sent[0]!.authorization, "Bearer key-a-rotated");

  // The master switch still holds while a connection is chosen.
  await putConfig({ ...(await readConfig()), enabled: false });
  const switchedOff = await speak();
  assert.equal(switchedOff.response.statusCode, 400);
  assert.equal(switchedOff.sent.length, 0);
  // A game's explicit audio connection is still a direct request, as before.
  assert.equal((await speak(connectionA.id)).response.statusCode, 200);
  await putConfig({ ...(await readConfig()), enabled: true });

  // ── The card switches to connection B, the same adapter. A's voices go to A's profile. ──
  const viewBeforeB = await readConfig();
  await putConfig({
    ...viewBeforeB,
    connectionId: connectionB.id,
    voice: "beta-1",
    narratorVoice: "beta-1",
    speed: 1,
    connectionProfiles: {
      ...viewBeforeB.connectionProfiles,
      [connectionA.id]: viewBeforeB.connectionProfiles[connectionA.id],
    },
  });
  const chosenB = await stored();
  assert.equal(chosenB.connectionId, connectionB.id);
  assert.equal(chosenB.connectionProfiles[connectionA.id]?.voice, "alpha-1", "A keeps its own voice");
  assert.equal(chosenB.connectionProfiles[connectionB.id]?.voice, "beta-1");
  assert.deepEqual(legacyIdentity(chosenB), legacyBefore);
  const viaB = await speak();
  assert.equal(viaB.response.statusCode, 200, viaB.response.body);
  assert.equal(viaB.sent[0]!.path, "/b/v1/audio/speech");
  assert.equal(viaB.sent[0]!.authorization, "Bearer key-b");
  assert.equal(viaB.sent[0]!.body?.voice, "beta-1");
  assert.equal(viaB.sent[0]!.body?.speed, 1);
  assert.equal(viaB.sent[0]!.body?.model, "tts-1", "a blank model is the adapter's default, not A's or the card's");
  const voicesB = await getRoute("/api/tts/voices");
  assert.deepEqual(voicesB.json().voices, ["beta-1"], "B's own voice list");
  assert.equal(providerRequests.at(-1)!.authorization, "Bearer key-b");
  // A game routed to A still speaks with A's voices, not B's or the card's.
  const gameViaA = await speak(connectionA.id);
  assert.equal(gameViaA.sent[0]!.path, "/a/v1/audio/speech");
  assert.equal(gameViaA.sent[0]!.body?.voice, "alpha-1");
  assert.equal(gameViaA.sent[0]!.body?.speed, 1.5);

  // ── B is deleted. The choice stays, and nothing speaks with another connection's key instead. ──
  await connections.remove(connectionB.id);
  assert.equal((await stored()).connectionId, connectionB.id, "deleting the connection keeps the choice visible");
  const missing = await speak();
  assert.equal(missing.response.statusCode, 409);
  assert.match(missing.response.json().error, /Audio connection chosen for Text to Speech is missing or unavailable/u);
  assert.equal(missing.sent.length, 0, "no request goes to the default connection or the card's own source");
  assert.equal((await speak("")).response.statusCode, 409, "the card's preview is refused too");
  assert.equal((await speak("no-such-connection")).response.statusCode, 409);
  for (const url of ["/api/tts/voices", "/api/tts/models"]) {
    assert.equal((await getRoute(url)).statusCode, 409, `${url} is refused`);
  }
  const gameAudio = await app.inject({
    method: "POST",
    url: "/api/tts/game-audio",
    payload: { kind: "sfx", prompt: "a door creaks" },
  });
  assert.equal(gameAudio.statusCode, 409);
  const missingView = await readConfig();
  assert.equal(missingView.connectionId, connectionB.id);
  assertNoKeys(JSON.stringify(missingView), "GET /api/tts/config with a missing connection");
  // A game's own audio connection still works.
  assert.equal((await speak(connectionA.id)).sent[0]!.path, "/a/v1/audio/speech");

  // A connection held for review after an import is refused the same way. Picking A again loads A's
  // voices, as the card does.
  const viewBeforeA = await readConfig();
  await putConfig({ ...viewBeforeA, ...viewBeforeA.connectionProfiles[connectionA.id], connectionId: connectionA.id });
  assert.equal((await stored()).voice, "alpha-1", "A's own voices come back");
  await db
    .update(apiConnections)
    .set({ profileImportReviewRequired: "true" })
    .where(eq(apiConnections.id, connectionA.id));
  const underReview = await speak();
  assert.equal(underReview.response.statusCode, 409);
  assert.equal(underReview.sent.length, 0);
  await db
    .update(apiConnections)
    .set({ profileImportReviewRequired: "false" })
    .where(eq(apiConnections.id, connectionA.id));

  // ── Back to the card's own source: its settings come back as they were. ──
  const viewBeforeLegacy = await readConfig();
  await putConfig({
    ...viewBeforeLegacy,
    ...viewBeforeLegacy.sourceProfiles.openai,
    source: "openai",
    connectionId: "",
  });
  const backToLegacy = await stored();
  assert.equal(backToLegacy.connectionId, "");
  assert.deepEqual(legacyIdentity(backToLegacy), legacyBefore);
  assert.equal(backToLegacy.voice, "legacy-voice");
  assert.equal(backToLegacy.speed, 1.25);
  assert.equal(backToLegacy.connectionProfiles[connectionA.id]?.voice, "alpha-1", "A's profile is kept for later");
  const preview = await speak("");
  assert.equal(preview.sent[0]!.path, "/legacy/v1/audio/speech");
  assert.equal(preview.sent[0]!.authorization, "Bearer legacy-secret");
  assert.equal(preview.sent[0]!.body?.model, "legacy-model");
  assert.equal(preview.sent[0]!.body?.voice, "legacy-voice");
  assertNoKeys((await getRoute("/api/tts/config")).body, "GET /api/tts/config for the card's own source");
} finally {
  await app.close();
  provider.closeAllConnections();
  await new Promise<void>((resolve) => provider.close(() => resolve()));
  await db._fileStore.close();
  rmSync(dataDir, { recursive: true, force: true });
}

console.info("TTS audio connection source regression passed.");
