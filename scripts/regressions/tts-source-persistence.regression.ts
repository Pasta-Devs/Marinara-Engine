import assert from "node:assert/strict";
import { TTS_API_KEY_MASK, ttsConfigSchema } from "../../packages/shared/src/types/tts.js";
import { buildTTSVoiceRequests } from "../../packages/client/src/lib/tts-dialogue.ts";
import { normalizeTTSPlaybackDelayMs } from "../../packages/client/src/lib/tts-service.ts";
import { maskTTSConfigForResponse, prepareTTSConfigForStorage } from "../../packages/server/src/routes/tts.routes.ts";

const encryptForTest = (value: string) => (value ? `encrypted:${value}` : "");

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
  baseUrl: "http://localhost:49112",
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
