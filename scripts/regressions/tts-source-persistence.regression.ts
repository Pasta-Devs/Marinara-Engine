import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { gzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { TTS_API_KEY_MASK, ttsConfigSchema } from "../../packages/shared/src/types/tts.js";
import { buildTTSVoiceRequests } from "../../packages/client/src/lib/tts-dialogue.ts";
import { normalizeTTSPlaybackDelayMs } from "../../packages/client/src/lib/tts-service.ts";
import {
  buildOfficialPocketTtsForm,
  maskTTSConfigForResponse,
  fetchAllElevenLabsVoiceOptions,
  fetchElevenLabsVoiceOptions,
  parseElevenLabsModelOptions,
  prepareTTSConfigForStorage,
  resolvePocketTtsApiMode,
} from "../../packages/server/src/routes/tts.routes.ts";

const encryptForTest = (value: string) => (value ? `encrypted:${value}` : "");
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

assert.equal(resolvePocketTtsApiMode({ paths: { "/tts": {}, "/health": {} } }), "official");
assert.equal(resolvePocketTtsApiMode({ paths: { "/v1/audio/speech": {}, "/v1/voices": {} } }), "openai");
assert.deepEqual(
  Object.fromEntries(buildOfficialPocketTtsForm("Hello from Marinara.", "alba").entries()),
  { text: "Hello from Marinara.", voice_url: "alba" },
);
const ttsRouteSource = readFileSync(join(repositoryRoot, "packages/server/src/routes/tts.routes.ts"), "utf8");
assert.match(
  ttsRouteSource,
  /if \(!response\.ok\) \{[\s\S]{0,120}pocketTtsApiModeCache\.delete\(base\)[\s\S]{0,180}catch \{[\s\S]{0,120}pocketTtsApiModeCache\.delete\(base\)/u,
  "Failed PocketTTS OpenAPI probes must not remain cached",
);
assert.match(
  ttsRouteSource,
  /clearPocketTtsApiModeCache\(existing\);\s*clearPocketTtsApiModeCache\(storedConfig\);/u,
  "Saving TTS settings must invalidate the old and new PocketTTS mode cache entries",
);

assert.deepEqual(
  parseElevenLabsModelOptions([
    { model_id: "eleven_v3", name: "Eleven v3", can_do_text_to_speech: true },
    { model_id: "eleven_ttv_v3", name: "Voice Design", can_do_text_to_speech: false },
    { name: "Missing ID", can_do_text_to_speech: true },
  ]),
  [{ id: "eleven_v3", name: "Eleven v3" }],
);

process.env.TTS_LOCAL_URLS_ENABLED = "true";
const observedVoiceRequests: Array<{
  apiKey: string | undefined;
  pathname: string;
  pageSize: string | null;
}> = [];
const unexpectedVoiceRequests: string[] = [];
const elevenLabsMock = createServer((request, response) => {
  const url = new URL(request.url ?? "/", "http://localhost");
  const apiKey = request.headers["xi-api-key"];
  observedVoiceRequests.push({
    apiKey: typeof apiKey === "string" ? apiKey : undefined,
    pathname: url.pathname,
    pageSize: url.searchParams.get("page_size"),
  });
  if (
    (apiKey !== "test-elevenlabs-key" && apiKey !== "compressed-error-key") ||
    url.pathname !== "/v2/voices" ||
    url.searchParams.get("page_size") !== "100" ||
    (url.searchParams.has("next_page_token") && url.searchParams.get("next_page_token") !== "custom-page-2")
  ) {
    const detail = `Unexpected voice request: key=${String(apiKey)}, path=${url.pathname}, page_size=${String(url.searchParams.get("page_size"))}`;
    unexpectedVoiceRequests.push(detail);
    response.writeHead(500, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ detail }));
    return;
  }
  if (apiKey === "compressed-error-key") {
    const body = gzipSync(
      JSON.stringify({
        detail: {
          status: "invalid_api_key",
          message:
            url.searchParams.get("voice_type") === "saved"
              ? "Saved ElevenLabs voices are unavailable for this key."
              : "The supplied ElevenLabs API key is invalid.",
        },
      }),
    );
    response.writeHead(401, {
      "Content-Type": "application/json",
      "Content-Encoding": "gzip",
      "Content-Length": String(body.length),
    });
    response.end(body);
    return;
  }

  if (url.searchParams.get("voice_type") === "saved") {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(
      JSON.stringify({
        voices: [
          { voice_id: "personal-second", name: "Personal Second", category: "generated" },
          { voice_id: "saved-custom", name: "Saved Custom Voice", category: "professional" },
        ],
        has_more: false,
        next_page_token: null,
      }),
    );
    return;
  }
  response.writeHead(200, { "Content-Type": "application/json" });
  if (!url.searchParams.get("next_page_token")) {
    response.end(
      JSON.stringify({
        voices: [{ voice_id: "personal-first", name: "Personal First", category: "cloned" }],
        has_more: true,
        next_page_token: "custom-page-2",
      }),
    );
    return;
  }
  response.end(
    JSON.stringify({
      voices: [{ voice_id: "personal-second", name: "Personal Second", category: "generated" }],
      has_more: false,
      next_page_token: null,
    }),
  );
});
await new Promise<void>((resolve) => elevenLabsMock.listen(0, "127.0.0.1", resolve));
try {
  const address = elevenLabsMock.address();
  assert.ok(address && typeof address !== "string");
  const paginatedVoices = await fetchElevenLabsVoiceOptions(`http://127.0.0.1:${address.port}`, "test-elevenlabs-key", {
    voice_type: "personal",
  });
  assert.deepEqual(
    paginatedVoices.map((voice) => voice.id),
    ["personal-first", "personal-second"],
  );
  const allVoices = await fetchAllElevenLabsVoiceOptions(`http://127.0.0.1:${address.port}`, "test-elevenlabs-key");
  assert.deepEqual(
    allVoices.map((voice) => voice.id),
    ["personal-first", "personal-second", "saved-custom"],
  );
  await assert.rejects(
    fetchElevenLabsVoiceOptions(`http://127.0.0.1:${address.port}`, "compressed-error-key"),
    /The supplied ElevenLabs API key is invalid\./,
  );
  await assert.rejects(
    fetchAllElevenLabsVoiceOptions(`http://127.0.0.1:${address.port}`, "compressed-error-key"),
    (error) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /^ElevenLabs voice discovery failed:/);
      assert.match(error.message, /The supplied ElevenLabs API key is invalid\./);
      assert.match(error.message, /Saved ElevenLabs voices are unavailable for this key\./);
      return true;
    },
  );
  assert.ok(observedVoiceRequests.length > 0);
  assert.ok(observedVoiceRequests.every(({ pathname, pageSize }) => pathname === "/v2/voices" && pageSize === "100"));
  assert.deepEqual(unexpectedVoiceRequests, []);
} finally {
  await new Promise<void>((resolve, reject) => {
    elevenLabsMock.close((error) => (error ? reject(error) : resolve()));
  });
}

const legacyConfigWithoutDialoguePause = ttsConfigSchema.parse({});
assert.equal(legacyConfigWithoutDialoguePause.dialoguePauseMs, 1000);

const legacySubSecondPause = ttsConfigSchema.parse({ dialoguePauseMs: 300 });
assert.equal(legacySubSecondPause.dialoguePauseMs, 1000);

const dialogueConfig = ttsConfigSchema.parse({ dialogueOnly: true, dialoguePauseMs: 3000 });
const twoUtterances = buildTTSVoiceRequests('"First line." "Second line."', dialogueConfig);
assert.deepEqual(
  twoUtterances.map((request) => request.pauseAfterMs),
  [3000, undefined],
);

const threeUtterances = buildTTSVoiceRequests('"First." "Second." "Third."', dialogueConfig);
assert.deepEqual(
  threeUtterances.map((request) => request.pauseAfterMs),
  [3000, 3000, undefined],
);

const longDialogue = `${"A".repeat(950)}. Short ending.`;
const splitUtteranceRequests = buildTTSVoiceRequests(`"${longDialogue}" "Next line."`, dialogueConfig);
assert.ok(splitUtteranceRequests.length > 2);
assert.ok(splitUtteranceRequests.slice(0, -2).every((request) => request.pauseAfterMs === undefined));
assert.equal(splitUtteranceRequests.at(-2)?.pauseAfterMs, 3000);
assert.equal(splitUtteranceRequests.at(-1)?.pauseAfterMs, undefined);

const fullMessageConfig = ttsConfigSchema.parse({ dialogueOnly: false, dialoguePauseMs: 3000 });
const fullMessageRequests = buildTTSVoiceRequests('"First." "Second."', fullMessageConfig);
assert.ok(fullMessageRequests.every((request) => request.pauseAfterMs === undefined));

const legacyZeroPauseConfig = ttsConfigSchema.parse({ dialogueOnly: true, dialoguePauseMs: 0 });
const legacyZeroPauseRequests = buildTTSVoiceRequests('"First." "Second."', legacyZeroPauseConfig);
assert.deepEqual(
  legacyZeroPauseRequests.map((request) => request.pauseAfterMs),
  [1000, undefined],
);

const maximumPauseConfig = ttsConfigSchema.parse({ dialogueOnly: true, dialoguePauseMs: 60_000 });
const maximumPauseRequests = buildTTSVoiceRequests('"First." "Second."', maximumPauseConfig);
assert.deepEqual(
  maximumPauseRequests.map((request) => request.pauseAfterMs),
  [60_000, undefined],
);
assert.equal(normalizeTTSPlaybackDelayMs(60_000), 60_000);
assert.equal(normalizeTTSPlaybackDelayMs(60_001), 60_000);
assert.equal(normalizeTTSPlaybackDelayMs(-1), 0);
assert.equal(normalizeTTSPlaybackDelayMs(Number.NaN), 0);
assert.throws(() => ttsConfigSchema.parse({ dialoguePauseMs: 60_001 }));

const legacyOpenAiConfig = ttsConfigSchema.parse({
  enabled: true,
  source: "openai",
  baseUrl: "https://speech.example.test/v1",
  apiKey: "encrypted:openai-secret",
  model: "custom-speech-model",
  voice: "nova",
  speed: 1.25,
});

const maskedOpenAiConfig = maskTTSConfigForResponse(legacyOpenAiConfig);
assert.equal(maskedOpenAiConfig.apiKey, TTS_API_KEY_MASK);
assert.equal(maskedOpenAiConfig.sourceProfiles.openai?.apiKey, TTS_API_KEY_MASK);

const switchToElevenLabs = ttsConfigSchema.parse({
  ...maskedOpenAiConfig,
  source: "elevenlabs",
  baseUrl: "https://api.elevenlabs.io",
  apiKey: "eleven-secret",
  model: "eleven_v3",
  voice: "eleven-voice-id",
  speed: 1.1,
});
const storedElevenLabs = prepareTTSConfigForStorage(switchToElevenLabs, legacyOpenAiConfig, encryptForTest);

assert.equal(storedElevenLabs.apiKey, "encrypted:eleven-secret");
assert.equal(storedElevenLabs.sourceProfiles.openai?.apiKey, "encrypted:openai-secret");
assert.equal(storedElevenLabs.sourceProfiles.openai?.model, "custom-speech-model");
assert.equal(storedElevenLabs.sourceProfiles.elevenlabs?.voice, "eleven-voice-id");

const maskedElevenLabs = maskTTSConfigForResponse(storedElevenLabs);
assert.equal(maskedElevenLabs.apiKey, TTS_API_KEY_MASK);
assert.equal(maskedElevenLabs.sourceProfiles.openai?.apiKey, TTS_API_KEY_MASK);
assert.equal(maskedElevenLabs.sourceProfiles.elevenlabs?.apiKey, TTS_API_KEY_MASK);
const savedOpenAiProfile = maskedElevenLabs.sourceProfiles.openai;
assert.ok(savedOpenAiProfile);

const switchToNewPocketTts = ttsConfigSchema.parse({
  ...maskedElevenLabs,
  source: "pockettts",
  baseUrl: "http://localhost:8000",
  apiKey: "",
  model: "pocket-tts",
  voice: "alba",
});
const storedPocketTts = prepareTTSConfigForStorage(switchToNewPocketTts, storedElevenLabs, encryptForTest);
assert.equal(storedPocketTts.apiKey, "");
assert.equal(storedPocketTts.sourceProfiles.openai?.apiKey, "encrypted:openai-secret");
assert.equal(storedPocketTts.sourceProfiles.elevenlabs?.apiKey, "encrypted:eleven-secret");

const switchBackToOpenAi = ttsConfigSchema.parse({
  ...maskedElevenLabs,
  source: "openai",
  ...savedOpenAiProfile,
});
const restoredOpenAi = prepareTTSConfigForStorage(switchBackToOpenAi, storedElevenLabs, encryptForTest);

assert.equal(restoredOpenAi.apiKey, "encrypted:openai-secret");
assert.equal(restoredOpenAi.baseUrl, "https://speech.example.test/v1");
assert.equal(restoredOpenAi.model, "custom-speech-model");
assert.equal(restoredOpenAi.voice, "nova");
assert.equal(restoredOpenAi.speed, 1.25);
assert.equal(restoredOpenAi.sourceProfiles.elevenlabs?.apiKey, "encrypted:eleven-secret");

console.info("TTS source persistence regression checks passed.");
