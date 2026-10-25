import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const directory = mkdtempSync(join(tmpdir(), "marinara-audio-migration-failure-"));
Object.assign(process.env, {
  DATA_DIR: directory,
  FILE_STORAGE_DIR: join(directory, "storage"),
  MARINARA_ENV_FILE: join(directory, ".env"),
  LOG_LEVEL: "silent",
});
const require = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const Fastify = require("fastify") as typeof import("fastify").default;
const { createFileNativeDB } = await import("../../packages/server/src/db/file-backed-store.js");
const { apiConnections, appSettings } = await import("../../packages/server/src/db/schema/index.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { createAppSettingsStorage } = await import("../../packages/server/src/services/storage/app-settings.storage.js");
const { migrateGenerativeAudioConnections } =
  await import("../../packages/server/src/services/connections/generative-audio-connection-migration.js");
const { resolveGenerativeAudioConfig } =
  await import("../../packages/server/src/services/audio/generative-audio.service.js");
const { connectionsRoutes } = await import("../../packages/server/src/routes/connections.routes.js");
const { audioRoutes } = await import("../../packages/server/src/routes/audio.routes.js");
const { errorHandler } = await import("../../packages/server/src/middleware/error-handler.js");
const { logger } = await import("../../packages/server/src/lib/logger.js");
const { createConnectionSchema, TTS_SETTINGS_KEY, ttsConfigSchema } =
  await import("../../packages/shared/dist/index.js");
const warnings: unknown[][] = [];
const originalWarn = logger.warn;
logger.warn = ((...args: unknown[]) => warnings.push(args)) as typeof logger.warn;
const failures: string[] = [];
const check = async (name: string, run: () => Promise<void>) => {
  try {
    await run();
    console.info(`PASS: ${name}`);
  } catch (error) {
    failures.push(`${name}: ${error instanceof Error ? error.message : String(error)}`);
    console.error(`FAIL: ${failures.at(-1)}`);
  }
};
const db = await createFileNativeDB();
const connections = createConnectionsStorage(db);
const app = Fastify();
app.decorate("db", db);
app.setErrorHandler(errorHandler);
await app.register(connectionsRoutes, { prefix: "/api/connections" });
await app.register(audioRoutes, { prefix: "/api/audio" });
const input = {
  name: "Committed speech import",
  provider: "audio",
  audioSource: "elevenlabs",
  apiKey: "private-fixture-key",
  audioVoice: "preserved-voice",
  audioMusic: true,
};
const originalTransaction = db.transaction.bind(db);
const migrationFailure = new Error("Injected migration transaction failure");
const failTransaction = (position: number) => {
  let calls = 0;
  db.transaction = (async (operation) => {
    calls++;
    return originalTransaction(async (tx) => {
      const result = await operation(tx);
      if (calls === position) throw migrationFailure;
      return result;
    });
  }) as typeof db.transaction;
  return () => calls;
};
try {
  await check("POST retains its committed speech write when only its optional split fails", async () => {
    const count = failTransaction(2);
    const created = await app.inject({ method: "POST", url: "/api/connections", payload: input });
    db.transaction = originalTransaction;
    assert.equal(count(), 2, "the row write and migration are separate actual transactions");
    const rows = (await connections.list()).filter((row) => row.provider === "audio");
    assert.equal(rows.length, 1, "the speech write committed even if splitting rolled back");
    const id = rows[0]!.id;
    assert.equal(await connections.getAudioGenerationForLegacyConnection(id), null);
    assert.equal(created.statusCode, 200, created.body);
    assert.equal(created.json().id, id, "an importer receives the committed ID instead of retrying creation");
    assert.equal(created.json().audioMusic, "true", "the response reflects the failed split, not retired switches");
    assert.equal(created.json().apiKeyEncrypted, "••••••••");
    assert.equal(warnings.at(-1)?.[0], migrationFailure, "the split warning is error-first");
  });

  await check("PATCH retains its committed update and a later retry re-reads the successful split", async () => {
    const speech = (await connections.list()).find((row) => row.provider === "audio");
    assert(speech);
    const id = speech.id;
    failTransaction(2);
    const updated = await app.inject({
      method: "PATCH",
      url: `/api/connections/${id}`,
      payload: { name: "Committed update" },
    });
    db.transaction = originalTransaction;
    assert.equal((await connections.getById(id))?.name, "Committed update", "the row write committed before splitting");
    assert.equal(updated.statusCode, 200, updated.body);
    assert.equal(updated.json().name, "Committed update");
    assert.equal(updated.json().audioMusic, "true");
    assert.equal(await connections.getAudioGenerationForLegacyConnection(id), null);

    const retried = await app.inject({ method: "PATCH", url: `/api/connections/${id}`, payload: { audioMusic: true } });
    assert.equal(retried.statusCode, 200, retried.body);
    assert.equal(retried.json().audioMusic, "false", "a successful split is re-read before replying");
    assert.equal(retried.json().audioVoice, input.audioVoice);
    assert.equal((await connections.list()).filter((row) => row.provider === "audio").length, 1);
    assert(await connections.getAudioGenerationForLegacyConnection(id));
    await migrateGenerativeAudioConnections(db);
    assert.equal((await connections.list()).filter((row) => row.audioGenerationLegacyConnectionId === id).length, 1);
  });

  await check("failed connection writes still fail and create no row", async () => {
    const before = (await connections.list()).length;
    failTransaction(1);
    const response = await app.inject({ method: "POST", url: "/api/connections", payload: input });
    db.transaction = originalTransaction;
    assert.equal(response.statusCode, 500);
    assert.equal((await connections.list()).length, before);
  });

  await check("concurrent actual splits serialize and create one alias per committed source", async () => {
    await db.delete(apiConnections);
    await db.delete(appSettings);
    const responses = await Promise.all(
      ["One", "Two"].map((name) =>
        app.inject({ method: "POST", url: "/api/connections", payload: { ...input, name } }),
      ),
    );
    for (const response of responses) {
      assert.equal(response.statusCode, 200, response.body);
      assert.equal(response.json().audioMusic, "false");
      assert.equal(
        (await connections.list()).filter((row) => row.audioGenerationLegacyConnectionId === response.json().id).length,
        1,
      );
    }
    await Promise.all([migrateGenerativeAudioConnections(db), migrateGenerativeAudioConnections(db)]);
    assert.equal((await connections.list()).filter((row) => row.provider === "audio_generation").length, 2);
    assert.equal(
      await createAppSettingsStorage(db).get("generativeAudioLegacyConfigMigrated"),
      "true",
      "row-only migration still consumes an absent legacy blob",
    );
  });

  await check(
    "a necessary resolver migration failure does not borrow another connection or pretend readiness",
    async () => {
      await db.delete(apiConnections);
      const speech = await connections.create(createConnectionSchema.parse(input));
      assert(speech);
      failTransaction(1);
      await assert.rejects(resolveGenerativeAudioConfig(db, speech.id), migrationFailure);
      db.transaction = originalTransaction;
      assert.equal(await connections.getAudioGenerationForLegacyConnection(speech.id), null);
      assert.equal((await connections.getById(speech.id))?.audioMusic, "true");
      const resolved = await resolveGenerativeAudioConfig(db, speech.id);
      assert.equal(resolved.legacyId, speech.id);
      assert.equal(resolved.apiKey, input.apiKey);
    },
  );

  await check("optional no-row migration failure reports unconfigured readiness and warns once", async () => {
    await db.delete(apiConnections);
    await db.delete(appSettings);
    const start = warnings.length;
    for (let index = 0; index < 2; index++) {
      failTransaction(1);
      const response = await app.inject({ method: "GET", url: "/api/audio/config" });
      db.transaction = originalTransaction;
      assert.equal(response.statusCode, 200, response.body);
      assert.deepEqual(response.json(), {
        connectionId: null,
        configured: false,
        music: false,
        soundEffects: false,
        source: null,
      });
    }
    failTransaction(1);
    const generation = await app.inject({
      method: "POST",
      url: "/api/audio/generate",
      payload: { kind: "sfx", prompt: "A door closes." },
    });
    db.transaction = originalTransaction;
    assert.equal(generation.statusCode, 400, generation.body);
    assert.match(generation.json().error, /Choose a Music & Sound Effects connection/);
    assert.equal(warnings.length, start + 1, "repeated readiness polls emit one migration warning per DB");
    assert.equal(warnings.at(-1)?.[0], migrationFailure, "the warning retains the error as its first argument");
    assert.equal((await connections.list()).length, 0);
  });

  await check(
    "an unavailable explicit legacy selection remains a configuration conflict after optional failure",
    async () => {
      await createAppSettingsStorage(db).set(
        TTS_SETTINGS_KEY,
        JSON.stringify(ttsConfigSchema.parse({ connectionId: "deleted-speech-connection" })),
      );
      failTransaction(1);
      const response = await app.inject({ method: "GET", url: "/api/audio/config" });
      db.transaction = originalTransaction;
      assert.equal(response.statusCode, 409, response.body);
      assert.match(response.json().error, /chosen for Text to Speech is missing/);
      await db.delete(appSettings);
    },
  );

  await check("necessary explicit legacy migration failures never borrow a different ready default", async () => {
    const unrelated = await connections.create(
      createConnectionSchema.parse({
        name: "Unrelated generation default",
        provider: "audio_generation",
        audioGenerationSource: "elevenlabs",
        apiKey: "unrelated-key",
        audioMusic: true,
        audioSoundEffects: true,
        defaultForAgents: true,
      }),
    );
    const speech = await connections.create(createConnectionSchema.parse(input));
    assert(unrelated && speech);
    failTransaction(1);
    const readiness = await app.inject({ method: "GET", url: `/api/audio/config?audioConnectionId=${speech.id}` });
    db.transaction = originalTransaction;
    assert.equal(readiness.statusCode, 500, "the required bridge failure remains an actual server failure");
    failTransaction(1);
    const generation = await app.inject({
      method: "POST",
      url: "/api/audio/generate",
      payload: { kind: "sfx", prompt: "A door closes.", audioConnectionId: speech.id },
    });
    db.transaction = originalTransaction;
    assert.equal(generation.statusCode, 502, "an explicit failed bridge cannot silently choose the unrelated key");
    assert.equal(await connections.getAudioGenerationForLegacyConnection(speech.id), null);
    assert.equal((await connections.getDefaultForAudioGeneration())?.id, unrelated.id);
  });
} finally {
  db.transaction = originalTransaction;
  await app.close();
  await db._fileStore.close();
}

const diagnostics = async (raw: string | null, failure?: "json" | "schema") => {
  let current = await createFileNativeDB();
  try {
    await current.delete(apiConnections);
    await current.delete(appSettings);
    const settings = createAppSettingsStorage(current);
    if (raw !== null) await settings.set(TTS_SETTINGS_KEY, raw);
    const start = warnings.length;
    await migrateGenerativeAudioConnections(current);
    await migrateGenerativeAudioConnections(current);
    const emitted = warnings.slice(start);
    assert.equal(emitted.length, failure ? 1 : 0, "at most one refusal warning per database boot");
    assert.equal(await settings.get("generativeAudioLegacyConfigMigrated"), null);
    assert.equal(await settings.get(TTS_SETTINGS_KEY), raw);
    assert.equal((await createConnectionsStorage(current).list()).length, 0);
    if (failure) {
      const details = emitted[0]![0] as {
        settingsKey: string;
        failure: string;
        issues?: Array<{ path: string; code: string }>;
      };
      assert.equal(details.settingsKey, TTS_SETTINGS_KEY);
      assert.equal(details.failure, failure);
      if (failure === "schema") assert(details.issues?.some((issue) => issue.path === "speed" && issue.code));
      const serialized = JSON.stringify(emitted);
      assert(!serialized.includes("secret-blob-key"));
      if (raw) assert(!serialized.includes(raw));
      await current._fileStore.close();
      current = await createFileNativeDB();
      await migrateGenerativeAudioConnections(current);
      assert.equal(warnings.length, start + 2, "a later boot diagnoses the still-retryable configuration again");
      assert.equal(await createAppSettingsStorage(current).get("generativeAudioLegacyConfigMigrated"), null);
    }
  } finally {
    await current._fileStore.close();
  }
};
try {
  await check("malformed JSON logs a redacted retryable diagnostic once per boot", () =>
    diagnostics('{"apiKey":"secret-blob-key",', "json"),
  );
  await check("an explicitly empty legacy setting is diagnosed rather than treated as absent", () =>
    diagnostics("", "json"),
  );
  await check("schema refusal logs only issue paths/codes once per boot", () =>
    diagnostics(JSON.stringify({ source: "elevenlabs", apiKey: "secret-blob-key", speed: 999 }), "schema"),
  );
  await check("missing legacy settings do not warn or write a completion marker", () => diagnostics(null));
  await check("an unreadable independent blob remains retryable after a valid row-based split", async () => {
    const current = await createFileNativeDB();
    try {
      await current.delete(apiConnections);
      await current.delete(appSettings);
      const settings = createAppSettingsStorage(current);
      const storage = createConnectionsStorage(current);
      const speech = await storage.create(createConnectionSchema.parse(input));
      assert(speech);
      await settings.set(TTS_SETTINGS_KEY, '{"apiKey":"secret-blob-key",');
      await migrateGenerativeAudioConnections(current);
      assert(await storage.getAudioGenerationForLegacyConnection(speech.id), "valid row migration still completes");
      assert.equal(
        await settings.get("generativeAudioLegacyConfigMigrated"),
        null,
        "the unreadable blob was not consumed",
      );
      await settings.set(
        TTS_SETTINGS_KEY,
        JSON.stringify({
          source: "elevenlabs",
          baseUrl: "https://recovered-blob.example.com",
          elevenLabsGameMusic: true,
        }),
      );
      await migrateGenerativeAudioConnections(current);
      assert.equal((await storage.list()).filter((row) => row.provider === "audio_generation").length, 2);
      assert.equal((await resolveGenerativeAudioConfig(current)).baseUrl, "https://recovered-blob.example.com");
      assert.equal(await settings.get("generativeAudioLegacyConfigMigrated"), "true");
      await current.delete(apiConnections);
      await migrateGenerativeAudioConnections(current);
      await migrateGenerativeAudioConnections(current);
      assert.equal(
        (await storage.list()).length,
        0,
        "deleting both migrated and speech rows never resurrects a consumed blob",
      );
    } finally {
      await current._fileStore.close();
    }
  });
} finally {
  logger.warn = originalWarn;
  rmSync(directory, { recursive: true, force: true });
}
assert.deepEqual(failures, []);
