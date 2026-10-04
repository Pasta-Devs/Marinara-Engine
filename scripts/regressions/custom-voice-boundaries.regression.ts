/**
 * Custom-voice boundary regression — three proof areas:
 *
 * Part 1: Cache connection identity + revision invalidation.
 *   - The voice-context snapshot is the 64-hex "revision" the client keys its
 *     audio cache on. It changes when (and only when) the TTS-relevant fields
 *     of the exact connection change; a trailing-slash-only change does not.
 *   - The client cache-key derivation folds in cacheConnectionId /
 *     cacheVoiceRevision / per-voice revision + status, so the same line of
 *     text produces different keys per connection and per revision, while a
 *     legacy (no-connection) config keeps its own key.
 *   - In the audio cache store, an A revision rotation and an A key deletion
 *     never touch B's cached clip.
 *
 * Part 2: Default/legacy provider compatibility.
 *   - With no audio connection, the TTS settings blob (legacy path) speaks and
 *     discovers voices; an omitted connection id selects the default/fallback
 *     audio connection, while an empty id forces legacy; disabled global TTS does not block an
 *     explicitly named connection (explicit = intent).
 *   - A non-openai (ElevenLabs) default-eligible second connection speaks its
 *     own ordinary voice, lists only provider voices (no managed augmentation),
 *     and rejects a marinara_ managed id (409) that belongs to the OpenAI
 *     connection. On the OpenAI connection, a ready managed voice speaks, a
 *     pending one is 409, and the config/voices/custom-voices endpoints expose
 *     the per-voice revisions.
 *
 * Part 3: Personal backup exclusions.
 *   - The full personal backup (folder + profile zip) includes the avatars
 *     asset directory and the connections table, but must NOT include the
 *     custom-voices management directory, which lives outside BACKUP_DIRS and
 *     the profile asset collection. The seeded management file survives the
 *     backup untouched on disk.
 *
 * Run: node scripts/run-regressions.mjs --filter custom-voice-boundaries
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { Server } from "node:http";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { syncBuiltinESMExports } from "node:module";
import AdmZip from "adm-zip";
import type { TTSConfig, TTSVoiceRequest } from "../../packages/shared/src/types/tts.js";

const temporary = await mkdtemp(join(tmpdir(), "marinara-voice-boundaries-"));
process.env.DATA_DIR = temporary;
process.env.FILE_STORAGE_DIR = join(temporary, "files");
process.env.TTS_LOCAL_URLS_ENABLED = "true";
process.env.ENCRYPTION_KEY = "ab".repeat(32);
syncBuiltinESMExports();

const { ttsConfigSchema } = await import("../../packages/shared/src/types/tts.js");
const { voiceContextSnapshot } = await import("../../packages/server/src/services/tts/custom-voice-service.js");
const { privateContextRevision } = await import("../../packages/server/src/utils/crypto.js");
// Management mutation tokens bind the profile as well as the storage/cache context.
// Directly seeded journals have no profileRevision, so they use the legacy marker.
const managementSnapshot = (snapshot: string) =>
  privateContextRevision(JSON.stringify([snapshot, "vllm-omni", "legacy"]));
const { customVoiceStorage } = await import("../../packages/server/src/services/tts/custom-voice-storage.js");
const {
  __resetTTSMemoryCacheForTests,
  __ttsMemoryCacheStatsForTests,
  getCachedTTSAudioBlob,
  getOrCreateCachedTTSAudioBlob,
  deleteCachedTTSAudioKeys,
} = await import("../../packages/client/src/lib/tts-audio-cache.js");
const { withTTSVoiceRequestCacheKeys, resolveTTSVoiceForSpeaker, resolveTTSNarratorVoice } =
  await import("../../packages/client/src/lib/tts-dialogue.js");

// ---------------------------------------------------------------------------
// Part 1 — connection identity and revision invalidation (pure functions +
// the in-process audio cache tiers; no network involved).
// ---------------------------------------------------------------------------

const baseA: TTSConfig = ttsConfigSchema.parse({
  source: "openai",
  baseUrl: "http://127.0.0.1:9101/v1",
  apiKey: "key-a",
  model: "tts-1",
  voice: "alloy",
});
const baseB: TTSConfig = ttsConfigSchema.parse({
  source: "elevenlabs",
  baseUrl: "http://127.0.0.1:9102",
  apiKey: "key-b",
  model: "eleven_multilingual_v2",
  voice: "rl_1",
});
const contextA = { connectionId: "conn-a", config: baseA, assignments: {} as Record<string, string[]> };
const contextB = { connectionId: "conn-b", config: baseB, assignments: {} as Record<string, string[]> };

const snapshotA = voiceContextSnapshot(contextA);
const snapshotB = voiceContextSnapshot(contextB);
assert.match(snapshotA, /^[0-9a-f]{64}$/, "snapshot must be a 64-hex revision");
assert.equal(snapshotA, voiceContextSnapshot(contextA), "snapshot must be stable for an unchanged context");
assert.notEqual(snapshotA, snapshotB, "different connections must have different revisions");

// Only TTS-relevant changes rotate the revision; cosmetic ones do not.
assert.notEqual(
  voiceContextSnapshot({ ...contextA, config: { ...baseA, apiKey: "key-a-rotated" } }),
  snapshotA,
  "rotating the API key must rotate connection A's revision",
);
assert.notEqual(
  voiceContextSnapshot({ ...contextA, config: { ...baseA, model: "tts-1-hd" } }),
  snapshotA,
  "rotating the model must rotate connection A's revision",
);
assert.equal(
  voiceContextSnapshot({ ...contextA, config: { ...baseA, baseUrl: "http://127.0.0.1:9101/v1/" } }),
  snapshotA,
  "trailing-slash-only baseUrl differences must not rotate the revision",
);
assert.equal(
  voiceContextSnapshot({ ...contextB, config: { ...baseB } }),
  snapshotB,
  "connection B's revision is independent of A's rotation",
);

// Cache-key derivation: same text, different identity inputs -> different keys.
const keyOf = (config: TTSConfig, voice: string, text: string) =>
  withTTSVoiceRequestCacheKeys([{ text, voice } satisfies TTSVoiceRequest], config, "message-1")[0]!;

const configA = {
  ...baseA,
  cacheConnectionId: "conn-a",
  cacheVoiceRevision: snapshotA,
  cacheVoiceRevisions: { alloy: "1700000000000" },
  cacheVoiceStatuses: { alloy: "ready" },
};
const configB = {
  ...baseB,
  cacheConnectionId: "conn-b",
  cacheVoiceRevision: snapshotB,
  cacheVoiceRevisions: { rl_1: "1700000002000" },
  cacheVoiceStatuses: { rl_1: "ready" },
};

const keyLegacy = keyOf(baseA, "alloy", "Boundary line: legacy blob");
const keyA = keyOf(configA, "alloy", "Boundary line: connection A");
const keyB = keyOf(configB, "rl_1", "Boundary line: connection B");
assert.notEqual(keyA.cacheKey, keyLegacy.cacheKey, "connection-scoped key differs from legacy blob key");
assert.notEqual(keyB.cacheKey, keyLegacy.cacheKey, "connection-scoped key differs from legacy blob key");
assert.notEqual(keyA.cacheKey, keyB.cacheKey, "two connections derive different keys");
assert.notEqual(keyA.cacheAliases![0], keyLegacy.cacheAliases![0], "text alias keys also differ across identities");

const keyARevisionRotated = keyOf(
  {
    ...configA,
    cacheVoiceRevision: voiceContextSnapshot({ ...contextA, config: { ...baseA, apiKey: "key-a-rotated" } }),
  },
  "alloy",
  "Boundary line: connection A",
);
assert.notEqual(keyARevisionRotated.cacheKey, keyA.cacheKey, "a revision rotation changes A's cache key");
const keyAVoiceRevisionRotated = keyOf(
  { ...configA, cacheVoiceRevisions: { alloy: "1800000000000" } },
  "alloy",
  "Boundary line: connection A",
);
assert.notEqual(keyAVoiceRevisionRotated.cacheKey, keyA.cacheKey, "a per-voice revision change changes A's cache key");
assert.equal(keyB.cacheKey, keyB.cacheKey);

// In-process cache tiers: store three clips, then rotate + delete A's. B and
// the legacy clip must be completely untouched.
__resetTTSMemoryCacheForTests();
const blobOf = (label: string) => new Blob([new TextEncoder().encode(label)]);
await getOrCreateCachedTTSAudioBlob(keyLegacy.cacheKey, async () => blobOf("LEGACY-CLIP"), [
  keyLegacy.cacheAliases![0]!,
]);
await getOrCreateCachedTTSAudioBlob(keyA.cacheKey, async () => blobOf("A-CLIP"), [keyA.cacheAliases![0]!]);
await getOrCreateCachedTTSAudioBlob(keyB.cacheKey, async () => blobOf("B-CLIP"), [keyB.cacheAliases![0]!]);
assert.equal(await (await getCachedTTSAudioBlob(keyA.cacheKey))?.text(), "A-CLIP");
assert.equal(await (await getCachedTTSAudioBlob(keyB.cacheKey))?.text(), "B-CLIP");
assert.equal(await (await getCachedTTSAudioBlob(keyLegacy.cacheKey))?.text(), "LEGACY-CLIP");

// A new revision creates a NEW clip under the new key; the old A clip and the
// other connections' clips remain valid.
await getOrCreateCachedTTSAudioBlob(keyARevisionRotated.cacheKey, async () => blobOf("A-CLIP-v2"), [
  keyARevisionRotated.cacheAliases![0]!,
]);
assert.equal(await (await getCachedTTSAudioBlob(keyARevisionRotated.cacheKey))?.text(), "A-CLIP-v2");
assert.equal(
  await (await getCachedTTSAudioBlob(keyA.cacheKey))?.text(),
  "A-CLIP",
  "old A revision clip is not replaced by the new one",
);
assert.equal(
  await (await getCachedTTSAudioBlob(keyB.cacheKey))?.text(),
  "B-CLIP",
  "B's clip survives A's revision rotation",
);

// Deleting A's keys (primary + alias) evicts only A's clips.
await deleteCachedTTSAudioKeys([
  keyA.cacheKey,
  keyA.cacheAliases![0]!,
  keyARevisionRotated.cacheKey,
  keyARevisionRotated.cacheAliases![0]!,
]);
assert.equal(await getCachedTTSAudioBlob(keyA.cacheKey), null, "A's old revision clip is evicted");
assert.equal(await getCachedTTSAudioBlob(keyA.cacheAliases![0]!), null, "A's alias clip is evicted");
assert.equal(await getCachedTTSAudioBlob(keyARevisionRotated.cacheKey), null, "A's new revision clip is evicted");
assert.equal(await (await getCachedTTSAudioBlob(keyB.cacheKey))?.text(), "B-CLIP", "B's clip survives A's purge");
assert.equal(
  await (await getCachedTTSAudioBlob(keyLegacy.cacheKey))?.text(),
  "LEGACY-CLIP",
  "legacy clip survives A's purge",
);
const stats = __ttsMemoryCacheStatsForTests();
assert.ok(stats.entries === 4, `only B (2 keys) and legacy (2 keys) clips remain, got ${stats.entries}`);
assert.ok(stats.bytes > 0);

// ---------------------------------------------------------------------------
// Part 2 — legacy / default / non-openai provider compatibility (full app,
// in-process mock providers only).
// ---------------------------------------------------------------------------

const providerRequests: Record<"a" | "b", Array<{ method: string; url: string; body: string }>> = { a: [], b: [] };
const providerUploadedVoices = new Set<string>();
function createMockProvider(which: "a" | "b"): Server {
  const server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    req.on("end", () => {
      const body = Buffer.concat(chunks).toString("utf8");
      const url = req.url ?? "";
      providerRequests[which].push({ method: req.method ?? "", url, body });
      if (which === "a") {
        if (req.method === "GET" && url.startsWith("/v1/audio/voices")) {
          return void res.end(
            JSON.stringify({
              voices: ["alloy", "shimmer"],
              uploaded_voices: [...providerUploadedVoices].map((name) => ({ name })),
            }),
          );
        }
        if (req.method === "DELETE" && url.startsWith("/v1/audio/voices/")) {
          return void res.end(JSON.stringify({ success: true }));
        }
        if (req.method === "POST" && url === "/v1/audio/speech") {
          const voice = (JSON.parse(body) as { voice?: string }).voice ?? "unknown";
          res.setHeader("content-type", "audio/mpeg");
          return void res.end(`AUDIO-A-${voice}`);
        }
      } else {
        if (req.method === "GET" && url.startsWith("/v2/voices")) {
          return void res.end(JSON.stringify({ voices: [{ id: "rl_1", name: "Ryland" }], has_more: false }));
        }
        if (req.method === "POST" && url.startsWith("/v1/text-to-speech/")) {
          const voice = decodeURIComponent(url.split("/").at(-1)!.split("?")[0]!);
          res.setHeader("content-type", "audio/mpeg");
          return void res.end(`AUDIO-B-${voice}`);
        }
      }
      res.statusCode = 404;
      res.end(`unexpected ${req.method} ${url}`);
    });
  });
  server.listen(0, "127.0.0.1");
  return server;
}

const serverA = createMockProvider("a");
const serverB = createMockProvider("b");
if (!serverA.listening) await once(serverA, "listening");
if (!serverB.listening) await once(serverB, "listening");
const originA = `http://127.0.0.1:${(serverA.address() as { port: number }).port}`;
const originB = `http://127.0.0.1:${(serverB.address() as { port: number }).port}`;

const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const Fastify = (await import("../../packages/server/node_modules/fastify/fastify.js")).default;
const app = Fastify({ logger: false });
const db = await getDB();
app.decorate("db", db);
const { connectionsRoutes } = await import("../../packages/server/src/routes/connections.routes.js");
const { ttsRoutes } = await import("../../packages/server/src/routes/tts.routes.js");
const { backupRoutes } = await import("../../packages/server/src/routes/backup.routes.js");
app.register(connectionsRoutes, { prefix: "/api/connections" });
app.register(ttsRoutes, { prefix: "/api/tts" });
app.register(backupRoutes, { prefix: "/api/backup" });
await app.ready();

try {
  // -- Legacy: no audio connections at all -> the settings blob is the config.
  const legacyConfig = {
    enabled: true,
    source: "openai",
    baseUrl: `${originA}/v1`,
    apiKey: "key-a",
    model: "tts-1",
    voice: "alloy",
  };
  let res = await app.inject({ method: "PUT", url: "/api/tts/config", payload: legacyConfig });
  assert.equal(res.statusCode, 204, `PUT /api/tts/config (legacy): ${res.statusCode} ${res.body}`);

  res = await app.inject({
    method: "POST",
    url: "/api/tts/speak",
    payload: { text: "Legacy boundary line", audioConnectionId: "" },
  });
  assert.equal(res.statusCode, 200, `legacy speak: ${res.statusCode} ${res.body}`);
  assert.match(res.headers["content-type"] ?? "", /audio\//);
  assert.equal(res.body, "AUDIO-A-alloy", "legacy blob speaks through its own endpoint");
  assert.equal(providerRequests.a.at(-1)!.url, "/v1/audio/speech");

  res = await app.inject({ method: "GET", url: "/api/tts/voices" });
  assert.equal(res.statusCode, 200);
  const legacyVoices = res.json() as { voices: string[] };
  assert.deepEqual(legacyVoices.voices.sort(), ["alloy", "shimmer"], "legacy voice list is the plain provider list");

  // -- Create the two audio connections: OpenAI (default) and ElevenLabs.
  res = await app.inject({
    method: "POST",
    url: "/api/connections",
    payload: {
      name: "Boundary OpenAI Audio",
      provider: "audio",
      baseUrl: `${originA}/v1`,
      apiKey: "key-a",
      model: "tts-1",
      audioSource: "openai",
      audioVoice: "alloy",
      defaultForAgents: true,
    },
  });
  assert.ok(res.statusCode >= 200 && res.statusCode < 300, `create A: ${res.statusCode} ${res.body}`);
  const connectionA = res.json() as { id: string };

  res = await app.inject({
    method: "POST",
    url: "/api/connections",
    payload: {
      name: "Boundary ElevenLabs Audio",
      provider: "audio",
      baseUrl: originB,
      apiKey: "key-b",
      model: "eleven_multilingual_v2",
      audioSource: "elevenlabs",
      audioVoice: "rl_1",
    },
  });
  assert.ok(res.statusCode >= 200 && res.statusCode < 300, `create B: ${res.statusCode} ${res.body}`);
  const connectionB = res.json() as { id: string };
  assert.notEqual(connectionA.id, connectionB.id);

  // -- The config endpoint reports A's identity and the expected revision.
  const expectedSnapshotA = voiceContextSnapshot({
    connectionId: connectionA.id,
    config: ttsConfigSchema.parse(legacyConfig),
    assignments: {},
  });
  res = await app.inject({ method: "GET", url: "/api/tts/config" });
  assert.equal(res.statusCode, 200);
  let configView = res.json() as {
    cacheConnectionId: string;
    cacheVoiceRevision: string;
    cacheVoiceRevisions: Record<string, string>;
    cacheVoiceStatuses: Record<string, string>;
  };
  assert.equal(configView.cacheConnectionId, connectionA.id, "config is scoped to the default audio connection");
  assert.equal(configView.cacheVoiceRevision, expectedSnapshotA, "reported revision equals the recomputed snapshot");
  assert.equal(Object.keys(configView.cacheVoiceRevisions).length, 0);

  // Runtime config follows the selected backend, but read-modify-write shared
  // settings must never persist that backend over the saved legacy identity.
  res = await app.inject({
    method: "PATCH",
    url: `/api/connections/${connectionA.id}`,
    payload: { defaultForAgents: false },
  });
  assert.equal(res.statusCode, 200);
  res = await app.inject({
    method: "PATCH",
    url: `/api/connections/${connectionB.id}`,
    payload: { fallbackForAgents: true },
  });
  assert.equal(res.statusCode, 200);
  const effectiveView = (await app.inject({ method: "GET", url: "/api/tts/config" })).json() as TTSConfig & {
    legacyConfig: TTSConfig;
  };
  assert.equal(effectiveView.cacheConnectionId, connectionB.id, "fallback-only selection uses B's cache identity");
  assert.equal(effectiveView.source, "elevenlabs");
  assert.equal(resolveTTSVoiceForSpeaker(effectiveView, "Unassigned speaker"), "rl_1");
  assert.equal(resolveTTSNarratorVoice(effectiveView), "rl_1");
  assert.equal(effectiveView.legacyConfig.voice, "alloy", "editor retains the legacy voice");
  res = await app.inject({
    method: "PUT",
    url: "/api/tts/config",
    payload: { ...effectiveView, speed: 1.25 },
  });
  assert.equal(res.statusCode, 204);
  const afterSharedSave = (await app.inject({ method: "GET", url: "/api/tts/config" })).json() as typeof effectiveView;
  assert.equal(afterSharedSave.speed, 1.25);
  for (const field of ["source", "baseUrl", "model", "voice", "apiKey"] as const) {
    assert.equal(
      afterSharedSave.legacyConfig[field],
      effectiveView.legacyConfig[field],
      `shared save preserves ${field}`,
    );
  }
  res = await app.inject({
    method: "PATCH",
    url: `/api/connections/${connectionB.id}`,
    payload: { fallbackForAgents: false },
  });
  assert.equal(res.statusCode, 200);
  res = await app.inject({
    method: "POST",
    url: "/api/tts/speak",
    payload: { text: "Preserved legacy identity" },
  });
  assert.equal(res.statusCode, 200, "legacy endpoint and encrypted credential survive the shared save");
  assert.equal(res.body, "AUDIO-A-alloy");
  res = await app.inject({ method: "PUT", url: "/api/tts/config", payload: legacyConfig });
  assert.equal(res.statusCode, 204);
  res = await app.inject({
    method: "PATCH",
    url: `/api/connections/${connectionA.id}`,
    payload: { defaultForAgents: true },
  });
  assert.equal(res.statusCode, 200);

  // -- Seed A's managed custom voices directly in storage (no provider upload).
  const voiceAReady = {
    id: "marinara_boundary",
    displayName: "Boundary Voice",
    status: "ready",
    createdAt: 1700000000000,
  };
  const voiceAPending = {
    id: "marinara_stale",
    displayName: "Stale Voice",
    status: "pending",
    createdAt: 1700000001000,
  };
  const seededStorageKey = `${connectionA.id}\0${expectedSnapshotA}`;
  await customVoiceStorage(seededStorageKey).write({
    snapshot: expectedSnapshotA,
    profile: "vllm-omni",
    voices: [voiceAReady, voiceAPending],
  });
  const seededFile = join(
    temporary,
    "custom-voices",
    `${createHash("sha256").update(seededStorageKey).digest("hex")}.json`,
  );
  assert.ok(existsSync(seededFile), "the seeded management file lives in dataDir/custom-voices");

  // Generic backends return opaque actual IDs distinct from the upload name.
  // Those IDs must retain the same ownership/readiness boundaries as prefixed IDs.
  const actualVoice = {
    ...voiceAReady,
    id: "backend-voice-42",
    providerName: "marinara_actual_boundary",
  };
  await customVoiceStorage(seededStorageKey).write({
    snapshot: expectedSnapshotA,
    profile: "openai-compatible",
    voices: [voiceAReady, voiceAPending, actualVoice],
  });
  res = await app.inject({
    method: "PATCH",
    url: `/api/connections/${connectionA.id}`,
    payload: { audioVoice: actualVoice.id },
  });
  assert.equal(res.statusCode, 200);
  res = await app.inject({ method: "POST", url: "/api/tts/speak", payload: { text: "Actual ID default line" } });
  assert.equal(res.statusCode, 200, `unprefixed managed default: ${res.body}`);
  assert.equal(res.body, `AUDIO-A-${actualVoice.id}`);
  assert.equal(JSON.parse(providerRequests.a.at(-1)!.body).voice, actualVoice.id);
  const beforeActualDenials = providerRequests.a.length + providerRequests.b.length;
  for (const [audioConnectionId, expectedStatus] of [
    [connectionB.id, 409],
    ["missing-audio", 404],
  ] as const) {
    res = await app.inject({
      method: "POST",
      url: "/api/tts/speak",
      payload: { text: "Actual ID wrong context", audioConnectionId, voice: actualVoice.id },
    });
    assert.equal(res.statusCode, expectedStatus, `unprefixed managed wrong context: ${res.body}`);
  }
  await customVoiceStorage(seededStorageKey).write({
    snapshot: expectedSnapshotA,
    profile: "openai-compatible",
    voices: [voiceAReady, voiceAPending, { ...actualVoice, status: "pending" }],
  });
  res = await app.inject({ method: "POST", url: "/api/tts/speak", payload: { text: "Actual ID pending line" } });
  assert.equal(res.statusCode, 409, "unprefixed managed pending voice is denied on its own default");
  assert.equal(
    providerRequests.a.length + providerRequests.b.length,
    beforeActualDenials,
    "denials never reach providers",
  );
  res = await app.inject({
    method: "POST",
    url: "/api/tts/speak",
    payload: { text: "Ordinary invalid ID fallback", audioConnectionId: "missing-audio", voice: "alloy" },
  });
  assert.equal(res.statusCode, 200, `ordinary voice retains invalid-ID fallback: ${res.body}`);
  assert.equal(res.body, "AUDIO-A-alloy");
  await customVoiceStorage(seededStorageKey).write({
    snapshot: expectedSnapshotA,
    profile: "vllm-omni",
    voices: [voiceAReady, voiceAPending],
  });

  // Text-only speech must check readiness against the same default/fallback
  // identity that supplies its voice, not management's undefined=legacy scope.
  res = await app.inject({
    method: "PATCH",
    url: `/api/connections/${connectionA.id}`,
    payload: { audioVoice: voiceAReady.id },
  });
  assert.equal(res.statusCode, 200);
  for (const selection of ["default", "fallback"] as const) {
    if (selection === "fallback") {
      res = await app.inject({
        method: "PATCH",
        url: `/api/connections/${connectionA.id}`,
        payload: { defaultForAgents: false, fallbackForAgents: true },
      });
      assert.equal(res.statusCode, 200);
    }
    res = await app.inject({ method: "POST", url: "/api/tts/speak", payload: { text: `${selection} managed line` } });
    assert.equal(res.statusCode, 200, `${selection} managed speak: ${res.statusCode} ${res.body}`);
    assert.equal(res.body, "AUDIO-A-marinara_boundary");
    assert.equal(providerRequests.a.at(-1)!.url, "/v1/audio/speech");
    assert.equal(JSON.parse(providerRequests.a.at(-1)!.body).input, `${selection} managed line`);
  }
  const requestsBeforeInvalid = providerRequests.a.length + providerRequests.b.length;
  res = await app.inject({
    method: "POST",
    url: "/api/tts/speak",
    payload: { text: "Invalid explicit managed line", audioConnectionId: "missing-audio", voice: voiceAReady.id },
  });
  assert.equal(res.statusCode, 404, "an invalid explicit managed context cannot inherit fallback A");
  assert.equal(providerRequests.a.length + providerRequests.b.length, requestsBeforeInvalid);

  // A separate ready legacy registration works with the sentinel even while
  // A is selected, and with omitted ID when no default/fallback is selected.
  const legacySnapshot = voiceContextSnapshot({
    connectionId: "",
    config: ttsConfigSchema.parse(legacyConfig),
    assignments: {},
  });
  await customVoiceStorage(`\0${legacySnapshot}`).write({
    snapshot: legacySnapshot,
    profile: "vllm-omni",
    voices: [{ ...voiceAReady, id: "marinara_legacy" }],
  });
  res = await app.inject({
    method: "PUT",
    url: "/api/tts/config",
    payload: { ...legacyConfig, voice: "marinara_legacy" },
  });
  assert.equal(res.statusCode, 204);
  res = await app.inject({
    method: "POST",
    url: "/api/tts/speak",
    payload: { text: "Managed legacy sentinel", audioConnectionId: "" },
  });
  assert.equal(res.statusCode, 200, `managed legacy sentinel: ${res.body}`);
  assert.equal(res.body, "AUDIO-A-marinara_legacy");
  providerUploadedVoices.add("marinara_legacy");
  const legacyManagement = await app.inject({ method: "GET", url: "/api/tts/custom-voices?connectionId=" });
  assert.equal(legacyManagement.statusCode, 200);
  assert.equal(legacyManagement.json().connectionId, "", "management's sentinel remains legacy");
  assert.equal(legacyManagement.json().snapshot, managementSnapshot(legacySnapshot));
  const legacyList = await app.inject({ method: "GET", url: "/api/tts/voices" });
  assert.equal(legacyList.statusCode, 200);
  assert.ok(legacyList.json().voices.includes("marinara_legacy"), "omitted voice-list ID remains legacy");
  assert.ok(!legacyList.json().voices.includes(voiceAReady.id), "voice-list omission must not select A");
  res = await app.inject({
    method: "PATCH",
    url: `/api/connections/${connectionA.id}`,
    payload: { defaultForAgents: false, fallbackForAgents: false },
  });
  assert.equal(res.statusCode, 200);
  res = await app.inject({ method: "POST", url: "/api/tts/speak", payload: { text: "Managed legacy fallback" } });
  assert.equal(res.statusCode, 200, `managed legacy fallback: ${res.body}`);
  assert.equal(res.body, "AUDIO-A-marinara_legacy");
  res = await app.inject({ method: "PUT", url: "/api/tts/config", payload: legacyConfig });
  assert.equal(res.statusCode, 204);
  res = await app.inject({
    method: "PATCH",
    url: `/api/connections/${connectionA.id}`,
    payload: { audioVoice: "alloy", defaultForAgents: true },
  });
  assert.equal(res.statusCode, 200);

  // -- Voices: A is augmented with managed entries; B (non-openai) is not.
  res = await app.inject({ method: "GET", url: `/api/tts/voices?connectionId=${connectionA.id}` });
  assert.equal(res.statusCode, 200);
  const voicesA = res.json() as {
    voices: string[];
    voiceOptions: Array<{ id: string; labels?: { managed?: boolean; status?: string } }>;
  };
  assert.ok(voicesA.voices.includes("marinara_boundary"), "A's voice list includes the ready managed voice");
  const optionA = voicesA.voiceOptions.find((option) => option.id === "marinara_boundary")!;
  assert.equal(optionA.labels?.managed, true);
  assert.equal(optionA.labels?.status, "ready");
  const optionPending = voicesA.voiceOptions.find((option) => option.id === "marinara_stale");
  assert.ok(optionPending?.labels?.managed === true, "a pending managed voice is listed as managed");
  assert.equal(optionPending?.labels?.status, "pending", "the pending status is surfaced in the list");

  res = await app.inject({ method: "GET", url: `/api/tts/voices?connectionId=${connectionB.id}` });
  assert.equal(res.statusCode, 200);
  const voicesB = res.json() as { voices: string[] };
  assert.deepEqual(voicesB.voices, ["rl_1"], "B's voice list is exactly the provider list (no managed augmentation)");

  // -- The config endpoint now exposes per-voice revisions for A.
  res = await app.inject({ method: "GET", url: "/api/tts/config" });
  configView = res.json() as typeof configView;
  assert.equal(configView.cacheVoiceRevisions["marinara_boundary"], "1700000000000");
  assert.equal(configView.cacheVoiceStatuses["marinara_boundary"], "ready");
  assert.equal(configView.cacheVoiceRevisions["marinara_stale"], "1700000001000");
  assert.equal(configView.cacheVoiceStatuses["marinara_stale"], "pending");

  // -- Speak: managed voice on its own connection works; on the other one it 409s.
  res = await app.inject({
    method: "POST",
    url: "/api/tts/speak",
    payload: { text: "Managed boundary line", audioConnectionId: connectionA.id, voice: "marinara_boundary" },
  });
  assert.equal(res.statusCode, 200, `managed speak on A: ${res.statusCode} ${res.body}`);
  assert.equal(res.body, "AUDIO-A-marinara_boundary");

  res = await app.inject({
    method: "POST",
    url: "/api/tts/speak",
    payload: { text: "Cross-connection managed line", audioConnectionId: connectionB.id, voice: "marinara_boundary" },
  });
  assert.equal(
    res.statusCode,
    409,
    `managed voice on a non-openai connection must 409, got ${res.statusCode} ${res.body}`,
  );

  res = await app.inject({
    method: "POST",
    url: "/api/tts/speak",
    payload: { text: "Stale managed line", audioConnectionId: connectionA.id, voice: "marinara_stale" },
  });
  assert.equal(res.statusCode, 409, `a pending managed voice must 409 even on its own connection`);

  res = await app.inject({
    method: "POST",
    url: "/api/tts/speak",
    payload: { text: "Plain elevenlabs line", audioConnectionId: connectionB.id, voice: "rl_1" },
  });
  assert.equal(res.statusCode, 200, `ordinary voice on B: ${res.statusCode} ${res.body}`);
  assert.equal(res.body, "AUDIO-B-rl_1");
  assert.equal(providerRequests.b.at(-1)!.url, `/v1/text-to-speech/rl_1?output_format=mp3_44100_128`);

  // -- The management endpoint binds the seeded context and API profile.
  res = await app.inject({ method: "GET", url: `/api/tts/custom-voices?connectionId=${connectionA.id}` });
  assert.equal(res.statusCode, 200, `custom-voices GET: ${res.statusCode} ${res.body}`);
  const management = res.json() as {
    connectionId: string;
    snapshot: string;
    profile: string;
    voices: Array<{ id: string; status: string }>;
  };
  assert.equal(management.connectionId, connectionA.id);
  assert.equal(management.snapshot, managementSnapshot(expectedSnapshotA));
  assert.equal(management.profile, "vllm-omni");
  assert.deepEqual(management.voices.map((voice) => voice.id).sort(), ["marinara_boundary", "marinara_stale"]);

  // -- Legacy sentinel and the master toggle boundary.
  res = await app.inject({
    method: "POST",
    url: "/api/tts/speak",
    payload: { text: "Legacy line with connections present", audioConnectionId: "" },
  });
  assert.equal(res.statusCode, 200, `the "" sentinel must still use the blob after connections exist`);
  assert.equal(res.body, "AUDIO-A-alloy");

  res = await app.inject({ method: "PUT", url: "/api/tts/config", payload: { ...legacyConfig, enabled: false } });
  assert.equal(res.statusCode, 204);
  res = await app.inject({
    method: "POST",
    url: "/api/tts/speak",
    payload: { text: "Disabled blob line", audioConnectionId: "" },
  });
  assert.equal(res.statusCode, 400, `disabled blob blocks legacy speak, got ${res.statusCode} ${res.body}`);
  res = await app.inject({
    method: "POST",
    url: "/api/tts/speak",
    payload: { text: "Explicit line with disabled blob", audioConnectionId: connectionA.id, voice: "alloy" },
  });
  assert.equal(
    res.statusCode,
    200,
    `an explicitly requested connection is direct intent and speaks despite the disabled blob`,
  );
  assert.equal(res.body, "AUDIO-A-alloy");
  res = await app.inject({ method: "PUT", url: "/api/tts/config", payload: legacyConfig });
  assert.equal(res.statusCode, 204);

  // -------------------------------------------------------------------------
  // Part 2b — tombstone delete recovery: a delete whose local cleanup
  // previously failed can be retried through the same delete flow; the
  // provider DELETE is never repeated, the tombstone is preserved, and the
  // exact matching saved source-profile voice field is the only profile
  // field cleared.
  // -------------------------------------------------------------------------

  // The legacy blob is now driven by a DIFFERENT source, so connection A's
  // saved openai source-profile voice field is a live reference path (the
  // active top-level fields no longer shadow it) while A's snapshot is
  // unchanged (row source/baseUrl/apiKey/model are unchanged).
  res = await app.inject({
    method: "PUT",
    url: "/api/tts/config",
    payload: {
      ...legacyConfig,
      source: "elevenlabs",
      baseUrl: originB,
      apiKey: "key-b",
      model: "eleven_multilingual_v2",
      voice: "rl_1",
      sourceProfiles: { openai: { voice: "marinara_boundary" } },
    },
  });
  assert.equal(res.statusCode, 204, `re-point legacy blob: ${res.statusCode} ${res.body}`);

  // Second matching reference: the connection's own audioVoice.
  res = await app.inject({
    method: "PATCH",
    url: `/api/connections/${connectionA.id}`,
    payload: { audioVoice: "marinara_boundary" },
  });
  assert.equal(res.statusCode, 200, `set connection audioVoice: ${res.statusCode} ${res.body}`);

  // Simulate the previously failed local cleanup: tombstone the voice in the
  // management state while its references remain in the TTS settings.
  const boundaryState = (await customVoiceStorage(seededStorageKey).read())!;
  boundaryState.voices = boundaryState.voices.map((voice) =>
    voice.id === "marinara_boundary" ? { ...voice, status: "deleted" } : voice,
  );
  await customVoiceStorage(seededStorageKey).write(boundaryState);

  res = await app.inject({ method: "GET", url: `/api/tts/custom-voices?connectionId=${connectionA.id}` });
  assert.equal(res.statusCode, 200, `management GET before retry: ${res.statusCode} ${res.body}`);
  const managementBeforeRetry = res.json() as { snapshot: string; assignments: Record<string, string[]> };
  assert.deepEqual(
    managementBeforeRetry.assignments["marinara_boundary"],
    ["Global voice", "Source profile: openai"],
    "the tombstoned voice reports both matching references with a per-source profile label",
  );

  const providerDeletes = () => providerRequests.a.filter((request) => request.method === "DELETE").length;
  const deletesBeforeRetry = providerDeletes();
  const settingsBeforeRetry = (await app.inject({ method: "GET", url: "/api/tts/config" })).json().legacyConfig as {
    source: string;
    voice: string;
    sourceProfiles: { openai?: { voice?: string }; elevenlabs?: { voice?: string } };
  };
  res = await app.inject({
    method: "POST",
    url: `/api/tts/custom-voices/delete?connectionId=${connectionA.id}`,
    payload: {
      snapshot: managementBeforeRetry.snapshot,
      id: "marinara_boundary",
      confirmedAssignments: ["Global voice", "Source profile: openai"],
    },
  });
  assert.equal(res.statusCode, 200, `tombstone retry delete: ${res.statusCode} ${res.body}`);
  assert.equal(providerDeletes(), deletesBeforeRetry, "the provider DELETE was not repeated on retry");
  const managementAfterRetry = res.json() as {
    snapshot: string;
    voices: Array<{ id: string; status: string }>;
    assignments: Record<string, string[]>;
  };
  assert.equal(managementAfterRetry.voices.find((voice) => voice.id === "marinara_boundary")?.status, "deleted");
  assert.equal(managementAfterRetry.assignments["marinara_boundary"], undefined, "all references cleared on retry");

  // The exact matching saved source-profile field was cleared; the active
  // source, the top-level voice, and the other profiles are preserved exactly
  // as they were saved before the delete (profile normalization on the PUT
  // may have populated the elevenlabs profile, so compare against the
  // pre-delete saved config rather than assuming it absent).
  res = await app.inject({ method: "GET", url: "/api/tts/config" });
  assert.equal(res.statusCode, 200);
  const settingsAfter = res.json().legacyConfig as {
    source: string;
    voice: string;
    sourceProfiles: { openai?: { voice?: string }; elevenlabs?: { voice?: string } };
  };
  assert.equal(settingsAfter.source, settingsBeforeRetry.source, "active source preserved");
  assert.equal(settingsAfter.voice, settingsBeforeRetry.voice, "active top-level voice preserved");
  assert.equal(settingsAfter.sourceProfiles.openai?.voice, "", "openai profile voice field cleared");
  assert.deepEqual(
    settingsAfter.sourceProfiles.elevenlabs,
    settingsBeforeRetry.sourceProfiles.elevenlabs,
    "elevenlabs profile preserved exactly as saved before the delete",
  );

  // A second retry with no remaining references is an idempotent no-op.
  res = await app.inject({
    method: "POST",
    url: `/api/tts/custom-voices/delete?connectionId=${connectionA.id}`,
    payload: { snapshot: managementAfterRetry.snapshot, id: "marinara_boundary", confirmedAssignments: [] },
  });
  assert.equal(res.statusCode, 200, `idempotent re-delete: ${res.statusCode} ${res.body}`);
  assert.equal(providerDeletes(), deletesBeforeRetry, "no further provider traffic on the no-op retry");

  // -- 2c: an identical identifier saved in a DIFFERENT source's profile is
  // an unrelated voice for that provider: it is not reported as a reference
  // to the deleted managed voice, and the delete preserves it exactly.
  res = await app.inject({
    method: "PUT",
    url: "/api/tts/config",
    payload: {
      source: "pockettts",
      model: "pockettts",
      voice: "al_1",
      sourceProfiles: {
        openai: { voice: "marinara_boundary" },
        elevenlabs: { voice: "marinara_boundary" },
      },
    },
  });
  assert.equal(
    res.statusCode,
    204,
    `PUT (pockettts active, cross-source same-id profiles): ${res.statusCode} ${res.body}`,
  );

  res = await app.inject({ method: "GET", url: `/api/tts/custom-voices?connectionId=${connectionA.id}` });
  assert.equal(res.statusCode, 200, `management GET before cross-source delete: ${res.statusCode} ${res.body}`);
  const managementCross = res.json() as { snapshot: string; assignments: Record<string, string[]> };
  assert.deepEqual(
    managementCross.assignments["marinara_boundary"],
    ["Global voice", "Source profile: openai"],
    "the unrelated elevenlabs profile with the same id is not reported as a reference",
  );

  res = await app.inject({
    method: "POST",
    url: `/api/tts/custom-voices/delete?connectionId=${connectionA.id}`,
    payload: {
      snapshot: managementCross.snapshot,
      id: "marinara_boundary",
      confirmedAssignments: ["Global voice", "Source profile: openai"],
    },
  });
  assert.equal(res.statusCode, 200, `cross-source delete: ${res.statusCode} ${res.body}`);

  res = await app.inject({ method: "GET", url: "/api/tts/config" });
  assert.equal(res.statusCode, 200);
  const settingsCross = res.json().legacyConfig as {
    source: string;
    voice: string;
    sourceProfiles: { openai: { voice: string }; elevenlabs: { voice: string }; pockettts: { voice: string } };
  };
  assert.equal(settingsCross.source, "pockettts", "the active source is unchanged");
  assert.equal(settingsCross.voice, "al_1", "the active (pockettts) top-level voice is preserved");
  assert.equal(
    settingsCross.sourceProfiles.openai.voice,
    "",
    "the context's own (openai) profile reference is cleared",
  );
  assert.equal(
    settingsCross.sourceProfiles.elevenlabs.voice,
    "marinara_boundary",
    "the unrelated elevenlabs profile with the same identifier survives the delete",
  );

  // Restore the legacy blob for the backup part.
  res = await app.inject({ method: "PUT", url: "/api/tts/config", payload: legacyConfig });
  assert.equal(res.statusCode, 204);

  // -------------------------------------------------------------------------
  // Part 3 — personal backup: included assets vs excluded custom-voice state.
  // -------------------------------------------------------------------------

  // Positive control: an ordinary shared asset dir directly in the data dir
  // (profile asset dirs live under DATA_DIR, not under FILE_STORAGE_DIR).
  await mkdir(join(temporary, "avatars"), { recursive: true });
  await writeFile(join(temporary, "avatars", "character-boundary.png"), "fake-png-bytes");

  res = await app.inject({ method: "POST", url: "/api/backup/" });
  assert.equal(res.statusCode, 200, `backup create: ${res.statusCode} ${res.body}`);
  const { backupName } = res.json() as { success: boolean; backupName: string };
  assert.ok(backupName, "backup named");
  const backupDir = join(temporary, "backups", backupName);
  assert.ok(existsSync(backupDir), "backup folder exists");
  assert.ok(existsSync(join(backupDir, "avatars", "character-boundary.png")), "avatars asset dir is backed up");
  assert.ok(!existsSync(join(backupDir, "custom-voices")), "custom-voices dir is NOT part of the backup folder");
  assert.ok(existsSync(seededFile), "the seeded custom-voice management file survives the backup untouched");

  const zip = new AdmZip(join(backupDir, "marinara-profile.zip"));
  const entries = zip.getEntries().map((entry) => entry.entryName.replace(/\\/g, "/"));
  assert.ok(entries.length > 0, "profile zip is not empty");
  assert.ok(
    entries.some((entry) => entry.includes("avatars/")),
    "profile zip carries the avatars asset dir",
  );
  assert.ok(!entries.some((entry) => entry.includes("custom-voices")), "profile zip excludes custom-voices entirely");
} finally {
  serverA.close();
  serverB.close();
  await app.close();
  closeDB();
  await rm(temporary, { recursive: true, force: true }).catch(() => {});
}

console.log(
  "custom-voice-boundaries: snapshot identity + revision invalidation, legacy/default/non-openai compatibility, and backup exclusions all verified",
);
