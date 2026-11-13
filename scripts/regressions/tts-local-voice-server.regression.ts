// #8921: GET /api/tts/config says whether the voice server runs locally, so Connections lists it On this device
// with a page to turn it off. PocketTTS always does; any other source does at an address chat connections count as
// local (isLocalInferenceBaseUrl): loopback, private network, LAN, Tailscale or a container host. Cloud voices do not.
//
// Project imports are dynamic, after the env assignments, so nothing opens a real data folder.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-tts-local-voice-server-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
process.env.MARINARA_ENV_FILE = join(dataDir, ".env");

type TTSConfigResponse = import("../../packages/shared/src/types/tts.js").TTSConfigResponse;
const requireServer = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const Fastify = requireServer("fastify") as typeof import("fastify").default;
const { TTS_SETTINGS_KEY } = await import("../../packages/shared/src/types/tts.js");
const { createFileNativeDB } = await import("../../packages/server/src/db/file-backed-store.js");
const { createAppSettingsStorage } = await import("../../packages/server/src/services/storage/app-settings.storage.js");
const { errorHandler } = await import("../../packages/server/src/middleware/error-handler.js");
const { ttsRoutes, ttsRunsLocally } = await import("../../packages/server/src/routes/tts.routes.js");

for (const baseUrl of ["", "http://localhost:8000", "http://192.168.1.20:8000", "https://tts.example.com"]) {
  assert.equal(ttsRunsLocally({ source: "pockettts", baseUrl }), true, `PocketTTS at "${baseUrl}"`);
}
for (const baseUrl of [
  "http://localhost:8880/v1",
  "http://127.0.0.1:8880/v1",
  "http://[::1]:8880/v1",
  "http://[::ffff:127.0.0.1]:8880/v1",
  "http://10.0.0.5:8880/v1",
  "http://172.20.1.2:8880/v1",
  "http://192.168.1.20:8880/v1",
  "http://169.254.1.2:8880/v1",
  "http://[fd12:3456::1]:8880/v1",
  "http://[fe80::1]:8880/v1",
  "http://100.101.102.103:8880/v1",
  "http://kokoro.local:8880/v1",
  "http://tts.internal:8880/v1",
  "http://host.docker.internal:8880/v1",
  "http://host.containers.internal:8880/v1",
  "http://kokoro:8880/v1",
]) {
  assert.equal(ttsRunsLocally({ source: "openai", baseUrl }), true, `local OpenAI-compatible at ${baseUrl}`);
}
for (const tts of [
  { source: "openai", baseUrl: "https://api.openai.com/v1" },
  // An empty address uses the source's default: the cloud service.
  { source: "openai", baseUrl: "" },
  { source: "elevenlabs", baseUrl: "https://api.elevenlabs.io" },
  { source: "xai", baseUrl: "https://api.x.ai/v1" },
  { source: "openai", baseUrl: "http://172.32.0.1:8880/v1" },
  { source: "openai", baseUrl: "http://localhost.example.com/v1" },
  { source: "openai", baseUrl: "not a url" },
] as const) {
  assert.equal(ttsRunsLocally(tts), false, `cloud or unreadable: ${tts.source} "${tts.baseUrl}"`);
}

const db = await createFileNativeDB();
const settings = createAppSettingsStorage(db);
const app = Fastify();
app.decorate("db", db);
app.setErrorHandler(errorHandler);
await app.register(ttsRoutes, { prefix: "/api/tts" });

const readConfig = async () => (await app.inject({ method: "GET", url: "/api/tts/config" })).json<TTSConfigResponse>();
const putConfig = async (config: unknown) => {
  const response = await app.inject({ method: "PUT", url: "/api/tts/config", payload: config as object });
  assert.equal(response.statusCode, 204, response.body);
};

try {
  assert.equal((await readConfig()).local, false, "nothing saved yet: the default is the OpenAI cloud");

  await putConfig({ enabled: true, source: "openai", baseUrl: "http://host.docker.internal:8880/v1" });
  const local = await readConfig();
  assert.equal(local.local, true, "a Kokoro on the Docker host is listed On this device");
  // The card saves what it read; the flag is the server's answer and is never stored.
  await putConfig(local);
  assert.ok(!("local" in JSON.parse((await settings.get(TTS_SETTINGS_KEY)) ?? "{}")), "the flag is not stored");
  assert.equal((await readConfig()).local, true);

  await putConfig({ ...local, baseUrl: "https://api.openai.com/v1" });
  assert.equal((await readConfig()).local, false, "the OpenAI cloud is not On this device");

  await putConfig({ ...local, source: "pockettts", baseUrl: "" });
  assert.equal((await readConfig()).local, true, "PocketTTS is On this device");
} finally {
  await app.close();
  await db._fileStore.close();
  rmSync(dataDir, { recursive: true, force: true });
}

console.info("TTS local voice server regression passed.");
