import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { gzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { TTS_API_KEY_MASK, ttsConfigSchema } from "../../packages/shared/src/types/tts.js";
import { buildTTSVoiceRequests, findTTSCharacterIdBySpeakerName } from "../../packages/client/src/lib/tts-dialogue.ts";
import { buildExtractedRoleplayTTSVoiceRequests } from "../../packages/client/src/lib/tts-roleplay-speaker-extractor.ts";
import { normalizeTTSPlaybackDelayMs, ttsService } from "../../packages/client/src/lib/tts-service.ts";
import {
  buildOfficialPocketTtsForm,
  buildElevenLabsTextInput,
  buildRoleplaySpeakerExtractorPrompt,
  buildRoleplaySpeakerExtractorUserPrompt,
  maskTTSConfigForResponse,
  fetchAllElevenLabsVoiceOptions,
  fetchElevenLabsVoiceOptions,
  parseElevenLabsModelOptions,
  parseRoleplaySpeakerExtractorOutput,
  prepareTTSConfigForStorage,
  resolvePocketTtsApiMode,
} from "../../packages/server/src/routes/tts.routes.ts";

const encryptForTest = (value: string) => (value ? `encrypted:${value}` : "");
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

assert.equal(resolvePocketTtsApiMode({ paths: { "/tts": {}, "/health": {} } }), "official");
assert.equal(resolvePocketTtsApiMode({ paths: { "/v1/audio/speech": {}, "/v1/voices": {} } }), "openai");
assert.deepEqual(Object.fromEntries(buildOfficialPocketTtsForm("Hello from Marinara.", "alba").entries()), {
  text: "Hello from Marinara.",
  voice_url: "alba",
});
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
assert.match(
  ttsRouteSource,
  /\[debug\/tts\/speaker-extractor\] raw response:/u,
  "Speaker extractor debug mode must log the provider's raw response",
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

const originalFetch = globalThis.fetch;
const originalAudioDescriptor = Object.getOwnPropertyDescriptor(globalThis, "Audio");
let activeTTSRequests = 0;
let peakActiveTTSRequests = 0;
const startedTTSChunks: number[] = [];

class RegressionAudio {
  volume = 1;
  muted = false;
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(_url: string) {}

  play(): Promise<void> {
    setTimeout(() => this.onended?.(), 0);
    return Promise.resolve();
  }

  pause(): void {}
}

try {
  Object.defineProperty(globalThis, "Audio", { configurable: true, value: RegressionAudio });
  globalThis.fetch = async () => {
    activeTTSRequests += 1;
    peakActiveTTSRequests = Math.max(peakActiveTTSRequests, activeTTSRequests);
    const exceedsProviderConcurrency = activeTTSRequests > 1;
    await new Promise((resolve) => setTimeout(resolve, 5));
    activeTTSRequests -= 1;
    if (exceedsProviderConcurrency) {
      return new Response(JSON.stringify({ error: "Provider concurrency limit reached" }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(new Blob(["audio"]), { status: 200, headers: { "Content-Type": "audio/mpeg" } });
  };

  await ttsService.speakSequence(
    [{ text: "First narration." }, { text: "Second narration." }, { text: "Third narration." }],
    "tts-concurrency-regression",
    {
      throwOnError: true,
      onChunkStart: (_request, index) => startedTTSChunks.push(index),
    },
  );
  assert.equal(peakActiveTTSRequests, 1, "Non-progressive TTS pre-generation must respect serial providers");
  assert.deepEqual(startedTTSChunks, [0, 1, 2], "A provider limit must not silently remove narration chunks");

  let failedProgressiveFetches = 0;
  globalThis.fetch = async () => {
    failedProgressiveFetches += 1;
    return new Response(JSON.stringify({ error: "First chunk failed" }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  };
  await ttsService.speakSequence(
    [{ text: "Failed first chunk." }, { text: "Must not start." }, { text: "Also must not start." }],
    "tts-progressive-failure",
    { progressive: true },
  );
  assert.equal(failedProgressiveFetches, 1, "Progressive TTS must not start a later request after a chunk fails");

  const callerAbortController = new AbortController();
  const callerSignal = callerAbortController.signal;
  const callerAddEventListener = callerSignal.addEventListener.bind(callerSignal);
  const callerRemoveEventListener = callerSignal.removeEventListener.bind(callerSignal);
  let callerAbortListenersAdded = 0;
  let callerAbortListenersRemoved = 0;
  Object.defineProperty(callerSignal, "addEventListener", {
    configurable: true,
    value: (...args: Parameters<AbortSignal["addEventListener"]>) => {
      if (args[0] === "abort") callerAbortListenersAdded += 1;
      return callerAddEventListener(...args);
    },
  });
  Object.defineProperty(callerSignal, "removeEventListener", {
    configurable: true,
    value: (...args: Parameters<AbortSignal["removeEventListener"]>) => {
      if (args[0] === "abort") callerAbortListenersRemoved += 1;
      return callerRemoveEventListener(...args);
    },
  });
  let staleFetchStarted!: () => void;
  const staleFetchReady = new Promise<void>((resolve) => {
    staleFetchStarted = resolve;
  });
  globalThis.fetch = async (_input, init) => {
    staleFetchStarted();
    return await new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
    });
  };
  const staleSequence = ttsService.speakSequence(
    [{ text: "Cancelled narration.", cacheKey: "tts-abort-cleanup-regression" }],
    "tts-abort-cleanup",
    { signal: callerSignal },
  );
  await staleFetchReady;
  ttsService.stop();
  await staleSequence;
  assert.equal(callerAbortListenersAdded, 1, "TTS should attach one caller abort listener per sequence");
  assert.equal(callerAbortListenersRemoved, 1, "A superseded TTS sequence must detach its caller abort listener");
} finally {
  ttsService.stop();
  globalThis.fetch = originalFetch;
  if (originalAudioDescriptor) Object.defineProperty(globalThis, "Audio", originalAudioDescriptor);
  else Reflect.deleteProperty(globalThis, "Audio");
}

assert.equal(legacyConfigWithoutDialoguePause.roleplaySpeakerExtractorEnabled, false);
assert.equal(legacyConfigWithoutDialoguePause.roleplaySpeakerExtractorConnectionId, "");
assert.equal(legacyConfigWithoutDialoguePause.roleplaySpeakerExtractorEmotionsEnabled, false);

const extractorMessage = 'Dottore sighs. "Enough of this," he says. A pause follows. "Skill issue," Mari chuckles.';
const extractedSegments = parseRoleplaySpeakerExtractorOutput(
  JSON.stringify({
    dialogue: [
      { speaker: "Dottore", text: '"Enough of this,"', speech: '[irritated] "Enough of this,"' },
      { speaker: "Mari", text: '"Skill issue,"', speech: '[chuckle] "Skill issue,"' },
    ],
  }),
  extractorMessage,
  true,
).segments;
assert.deepEqual(extractedSegments, [
  { kind: "narration", text: "Dottore sighs." },
  { kind: "dialogue", speaker: "Dottore", text: '[irritated] "Enough of this,"' },
  { kind: "narration", text: "he says. A pause follows." },
  { kind: "dialogue", speaker: "Mari", text: '[chuckle] "Skill issue,"' },
  { kind: "narration", text: "Mari chuckles." },
]);
assert.throws(
  () =>
    parseRoleplaySpeakerExtractorOutput(
      JSON.stringify({ dialogue: [{ speaker: "Dottore", text: '"Changed dialogue"' }] }),
      extractorMessage,
      false,
    ),
  /changed or could not locate/,
);
assert.throws(
  () =>
    parseRoleplaySpeakerExtractorOutput(
      JSON.stringify({
        dialogue: [
          {
            speaker: "Dottore",
            text: '"Enough of this,"',
            speech: '[irritated] "I have had enough,"',
          },
        ],
      }),
      extractorMessage,
      true,
    ),
  /changed dialogue while adding emotion indicators/,
);
assert.throws(
  () =>
    parseRoleplaySpeakerExtractorOutput(
      JSON.stringify({
        dialogue: [{ speaker: "Dottore", text: '"Wait  here."', speech: '[tense] "Wait here."' }],
      }),
      'Dottore says, "Wait  here."',
      true,
    ),
  /changed dialogue while adding emotion indicators/,
  "emotion annotation must not normalize or rewrite source whitespace",
);
assert.deepEqual(
  parseRoleplaySpeakerExtractorOutput(
    JSON.stringify({
      dialogue: [{ speaker: "Dottore", text: '"Use [A] now."', speech: '[firm] "Use [A] now."' }],
    }),
    'Dottore orders, "Use [A] now."',
    true,
  ).segments,
  [
    { kind: "narration", text: "Dottore orders," },
    { kind: "dialogue", speaker: "Dottore", text: '[firm] "Use [A] now."' },
  ],
  "source-authored brackets must survive alongside inserted emotion indicators",
);
assert.match(
  buildRoleplaySpeakerExtractorPrompt({
    group: "Lab group",
    user: "Mari",
    characters: ["Dottore", "Mari"],
    messageAuthor: "Dottore",
    includeEmotions: true,
  }),
  /"speech":"Exact dialogue with only inserted \[indicators\]"/,
);
assert.match(
  buildRoleplaySpeakerExtractorPrompt({
    group: "Lab group",
    user: "Mari",
    characters: ["Dottore", "Mari"],
    messageAuthor: "Dottore",
    includeEmotions: true,
  }),
  /\[irritated\].*\[sigh\]/s,
);
assert.match(
  buildRoleplaySpeakerExtractorPrompt({
    group: "Lab group",
    user: "Mari",
    characters: ["Dottore", "Maukie"],
    messageAuthor: "Maukie",
    includeEmotions: true,
  }),
  /response was generated for Maukie.*exact name.*not explicitly attributed to a different speaker/su,
);
const responsesCompatibleExtractorInput = buildRoleplaySpeakerExtractorUserPrompt('Columbina says, "Sing."');
assert.match(responsesCompatibleExtractorInput, /\bjson\b/u);
assert.match(responsesCompatibleExtractorInput, /Message to prepare:\nColumbina says, "Sing\."/u);

const reportedLongRoleplayMessage = `Columbina guides the clam’s narrow hinge into the freshly scored bolt.

“One verse. When it ends, the sea remembers its weight.”

Her first note vibrates through Mari’s teeth. Moonlight spreads in pale rings, and the surrounding ocean leans away from Belleau. Mari’s new Hydro sense reels beneath the scale of it: tons of water peel from the maintenance throat and gather in a revolving halo behind Columbina.

Warm air hisses through the rosette.

The scratched bolt turns by a quarter. Hidden cams retract all five corroded fasteners at once. The shell fractures between Mari’s fingers; the brass cover springs outward and lands neatly in Columbina’s waiting palm.

A shoulder-wide passage climbs into Belleau. Fresh scrapes mark its lower wall. Eleven meters in, an open isolation wheel gleams beneath a blue lamp.

Red light floods the shaft.

An alarm shudders through the station—the same one now screaming around Maukie’s tea table. Fagio’s cable lashes upward. Columbina catches its hook between two fingers, and the line draws taut enough to sing.

A warning races across Fagio’s distant slate:

> **INNER ISOLATION: OPEN**
> **FLOOD DEFENSE CYCLE: 00:43**
> **CLOSE VALVE OR RESTORE COVER**

Columbina continues her verse. Each note keeps the ocean curved around the opening.

The first red digit falls.

**00:42.**`;
const reportedLongRoleplaySegments = parseRoleplaySpeakerExtractorOutput(
  JSON.stringify({
    dialogue: [
      {
        speaker: "Columbina",
        text: "“One verse. When it ends, the sea remembers its weight.”",
      },
    ],
  }),
  reportedLongRoleplayMessage,
  false,
).segments;
const reportedLongRoleplayRequests = buildExtractedRoleplayTTSVoiceRequests(
  reportedLongRoleplaySegments,
  ttsConfigSchema.parse({ source: "openai", voice: "alloy", narratorVoiceEnabled: true, narratorVoice: "sage" }),
  "Columbina",
);
const reportedLongRoleplaySpeech = reportedLongRoleplayRequests.map(({ text }) => text).join(" ");
assert.match(reportedLongRoleplaySpeech, /Her first note vibrates through Mari’s teeth\./);
assert.match(reportedLongRoleplaySpeech, /Red light floods the shaft\./);
assert.match(reportedLongRoleplaySpeech, /INNER ISOLATION: OPEN/);
assert.match(reportedLongRoleplaySpeech, /The first red digit falls\. 00:42\./);
assert.ok(
  reportedLongRoleplayRequests.length <= 4,
  "Adjacent narration paragraphs should be packed instead of creating a provider request burst",
);

const extractedVoiceConfig = ttsConfigSchema.parse({
  source: "openai",
  voice: "global",
  voiceMode: "per-character",
  voiceAssignments: [
    { characterId: "dottore-id", characterName: "Dottore", voice: "dottore-voice" },
    { characterId: "mari-id", characterName: "Mari", voice: "mari-voice" },
  ],
  narratorVoiceEnabled: true,
  narratorVoice: "narrator-voice",
});
const extractedCharacterIds: Record<string, string> = { Dottore: "dottore-id", Mari: "mari-id" };
const extractedVoiceRequests = buildExtractedRoleplayTTSVoiceRequests(
  extractedSegments,
  extractedVoiceConfig,
  "Dottore",
  "dottore-id",
  (speaker) => extractedCharacterIds[speaker ?? ""],
);
assert.deepEqual(
  extractedVoiceRequests.map(({ speaker, voice, text }) => ({ speaker, voice, text })),
  [
    { speaker: "Narrator", voice: "narrator-voice", text: "Dottore sighs." },
    { speaker: "Dottore", voice: "dottore-voice", text: '[irritated] "Enough of this,"' },
    { speaker: "Narrator", voice: "narrator-voice", text: "he says. A pause follows." },
    { speaker: "Mari", voice: "mari-voice", text: '[chuckle] "Skill issue,"' },
    { speaker: "Narrator", voice: "narrator-voice", text: "Mari chuckles." },
  ],
);
const extractedGlobalNarrationRequests = buildExtractedRoleplayTTSVoiceRequests(
  extractedSegments,
  { ...extractedVoiceConfig, narratorVoiceEnabled: false, narratorVoice: "" },
  "Dottore",
  "dottore-id",
  (speaker) => extractedCharacterIds[speaker ?? ""],
);
assert.deepEqual(
  extractedGlobalNarrationRequests
    .filter(({ speaker }) => speaker === "Narrator")
    .map(({ speaker, voice }) => ({ speaker, voice })),
  [
    { speaker: "Narrator", voice: "global" },
    { speaker: "Narrator", voice: "global" },
    { speaker: "Narrator", voice: "global" },
  ],
);
const extractedDialogueOnlyRequests = buildExtractedRoleplayTTSVoiceRequests(
  extractedSegments,
  { ...extractedVoiceConfig, dialogueOnly: true, dialoguePauseMs: 2000 },
  "Dottore",
  "dottore-id",
);
assert.deepEqual(
  extractedDialogueOnlyRequests.map(({ speaker, pauseAfterMs }) => ({ speaker, pauseAfterMs })),
  [
    { speaker: "Dottore", pauseAfterMs: 2000 },
    { speaker: "Mari", pauseAfterMs: undefined },
  ],
);

const extractedVoiceFallbackConfig = ttsConfigSchema.parse({
  source: "openai",
  voice: "global-voice",
  voiceMode: "per-character",
  voiceAssignments: [{ characterId: "columbina-id", characterName: "Columbina", voice: "columbina-voice" }],
  npcDefaultVoicesEnabled: true,
  npcDefaultMaleVoices: ["random-npc-voice"],
  npcDefaultFemaleVoices: ["random-npc-voice"],
});
const extractedVoiceFallbackRequests = buildExtractedRoleplayTTSVoiceRequests(
  [
    { kind: "dialogue", speaker: "Columbina", text: '"Come closer."' },
    { kind: "dialogue", speaker: "Dottore", text: '"How unfortunate."' },
    { kind: "dialogue", speaker: "Fatui Guard", text: '"At once."' },
  ],
  extractedVoiceFallbackConfig,
  null,
  null,
  (speaker) =>
    speaker === "Columbina" ? "columbina-id" : speaker === "Dottore" ? "dottore-without-assignment-id" : null,
);
assert.deepEqual(
  extractedVoiceFallbackRequests.map(({ speaker, voice }) => ({ speaker, voice })),
  [
    { speaker: "Columbina", voice: "columbina-voice" },
    { speaker: "Dottore", voice: "random-npc-voice" },
    { speaker: "Fatui Guard", voice: "random-npc-voice" },
  ],
);
const extractedDecoratedSpeakerRequests = buildExtractedRoleplayTTSVoiceRequests(
  [{ kind: "dialogue", speaker: "**Maukie:** [chuckle]", text: '[chuckle] "I said it."' }],
  {
    ...extractedVoiceFallbackConfig,
    voiceAssignments: [{ characterId: "maukie-id", characterName: "Maukie", voice: "maukie-voice" }],
  },
  null,
  null,
  (speaker) => findTTSCharacterIdBySpeakerName(speaker, [["maukie-id", { name: "Maukie" }]] as const),
);
assert.deepEqual(
  extractedDecoratedSpeakerRequests.map(({ speaker, voice }) => ({ speaker, voice })),
  [{ speaker: "**Maukie:** [chuckle]", voice: "maukie-voice" }],
  "Extractor label formatting must not send a known character through the Random NPC Voice pool",
);
assert.equal(
  findTTSCharacterIdBySpeakerName("Maukie", [
    ["maukie-one", { name: "Maukie" }],
    ["maukie-two", { name: "Maukie" }],
  ]),
  null,
  "duplicate exact character names must not select an arbitrary voice assignment",
);
assert.equal(buildElevenLabsTextInput('"Skill issue."', "chuckle"), '[chuckle] "Skill issue."');
assert.equal(buildElevenLabsTextInput('[chuckle] "Skill issue."', "chuckle"), '[chuckle] "Skill issue."');

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
