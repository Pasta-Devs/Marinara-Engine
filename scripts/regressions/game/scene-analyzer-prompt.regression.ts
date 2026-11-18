// The scene analyzer's prompt: narration that doesn't fit a local model's context drops its earliest beats first.
// Generated game audio is opt-in, and the analyzer asks for sound effects as text but never for music.
import assert from "node:assert/strict";
import {
  sceneAnalysisRequestSchema,
  SIDECAR_SCENE_ANALYSIS_NARRATION_BUDGET_CHARS,
} from "../../../packages/shared/src/schemas/scene-analysis.schema.js";
import {
  buildSceneAnalyzerUserPrompt,
  fitSceneAnalyzerNarrationBeats,
} from "../../../packages/server/src/services/sidecar/scene-analyzer.js";
import { postProcessSceneResult } from "../../../packages/server/src/services/sidecar/scene-postprocess.js";
import { ttsConfigSchema } from "../../../packages/shared/src/types/tts.js";

const longSceneNarration = Array.from(
  { length: 100 },
  (_, index) => `Narration: beat ${index} ${"context ".repeat(45)}`,
).join("\n");
const sceneAnalysisContext = {
  currentState: "exploration" as const,
  turnNumber: 2,
  availableBackgrounds: [],
  availableSfx: [],
  activeWidgets: [],
  trackedNpcs: [],
  characterNames: [],
  currentBackground: null,
  currentMusic: null,
  currentAmbient: null,
  currentWeather: null,
  currentTimeOfDay: null,
};
const parsedSceneAnalysisRequest = sceneAnalysisRequestSchema.parse({
  narration: longSceneNarration,
  context: sceneAnalysisContext,
});
assert.equal(
  parsedSceneAnalysisRequest.narration,
  longSceneNarration,
  "The shared request contract must accept long narration before endpoint-specific budgeting",
);
assert.equal(parsedSceneAnalysisRequest.context.turnNumber, 2, "The shared schema must preserve turn-aware prompts");
const fittedSceneNarration = fitSceneAnalyzerNarrationBeats(
  longSceneNarration,
  SIDECAR_SCENE_ANALYSIS_NARRATION_BUDGET_CHARS,
);
assert.equal(fittedSceneNarration.truncated, true);
assert.equal(fittedSceneNarration.beats.at(-1)?.index, 99);
assert.ok((fittedSceneNarration.beats[0]?.index ?? 0) > 0);
assert.ok(
  fittedSceneNarration.beats.reduce((total, beat) => total + beat.text.length + String(beat.index).length + 3, 0) <=
    SIDECAR_SCENE_ANALYSIS_NARRATION_BUDGET_CHARS,
);
const fittedScenePrompt = buildSceneAnalyzerUserPrompt(
  longSceneNarration,
  undefined,
  sceneAnalysisContext,
  SIDECAR_SCENE_ANALYSIS_NARRATION_BUDGET_CHARS,
);
assert.match(fittedScenePrompt, /earlier narration beat\(s\) omitted to fit local context/u);
assert.match(fittedScenePrompt, /\[99\] Narration: beat 99/u);
assert.match(fittedScenePrompt, /CINEMATIC DIRECTIONS/u);

// #4120: generated ElevenLabs game audio is off until turned on, and scene analysis asks for sound effects as short free text, never for music (#5161 moved music to context tracks).
{
  const ttsDefaults = ttsConfigSchema.parse({});
  assert.equal(ttsDefaults.elevenLabsGameSoundEffects, false);
  assert.equal(ttsDefaults.elevenLabsGameMusic, false);
  const enabled = ttsConfigSchema.parse({
    source: "elevenlabs",
    elevenLabsGameSoundEffects: true,
    elevenLabsGameMusic: true,
  });
  assert.equal(enabled.elevenLabsGameSoundEffects, true);
  assert.equal(enabled.elevenLabsGameMusic, true);

  const generatedAudioContext = {
    currentState: "exploration" as const,
    turnNumber: 2,
    availableBackgrounds: ["backgrounds:fantasy:forest"],
    availableSfx: [],
    activeWidgets: [],
    trackedNpcs: [],
    characterNames: [],
    currentBackground: "backgrounds:fantasy:forest",
    currentMusic: null,
    currentWeather: null,
    currentTimeOfDay: null,
    generateSoundEffects: true,
    generateMusic: true,
  };
  const prompt = buildSceneAnalyzerUserPrompt("Boots cross the wet stones.", undefined, generatedAudioContext);
  assert.match(prompt, /short sound description/u);
  assert.match(prompt, /"sfxLoopCount": <1-5>/u);
  assert.doesNotMatch(prompt, /"(?:sfxLoopCount|directions|background)"[^\n]*\/\//u);
  // #5161: music free-text prompts are retired — even with generateMusic on,
  // the analyzer is asked for genre/intensity hints, never a music prompt.
  assert.doesNotMatch(prompt, /concise instrumental scene music prompt/u);
  assert.match(prompt, /musicGenre/u);
  assert.match(prompt, /musicIntensity/u);

  const processed = postProcessSceneResult(
    {
      background: null,
      music: " tense strings <then> a hopeful transition ",
      ambient: null,
      weather: null,
      timeOfDay: null,
      reputationChanges: [],
      segmentEffects: [
        { segment: 0, sfx: [" quiet footsteps <on> wet stone "], sfxLoopCount: 9, music: "low suspense pulse" },
      ],
    },
    {
      availableBackgrounds: generatedAudioContext.availableBackgrounds,
      availableSfx: [],
      generateSoundEffects: true,
      generateMusic: true,
      validWidgetIds: new Set(),
      characterNames: [],
    },
  );
  // #5161: free-text music never survives postprocess — scoring fills music
  // downstream from the library (context tracks included). SFX unchanged.
  assert.equal(processed.music, null);
  assert.deepEqual(processed.segmentEffects?.[0]?.sfx, ["quiet footsteps on wet stone"]);
  assert.equal(processed.segmentEffects?.[0]?.sfxLoopCount, 5);
  assert.equal(processed.segmentEffects?.[0]?.music, undefined);

  const lowerBoundProcessed = postProcessSceneResult(
    {
      ...processed,
      segmentEffects: [{ segment: 0, sfx: ["footsteps"], sfxLoopCount: 0 }],
    },
    {
      availableBackgrounds: generatedAudioContext.availableBackgrounds,
      availableSfx: [],
      generateSoundEffects: true,
      generateMusic: true,
      validWidgetIds: new Set(),
      characterNames: [],
    },
  );
  assert.equal(lowerBoundProcessed.segmentEffects?.[0]?.sfxLoopCount, 1);

  const spotifyProcessed = postProcessSceneResult(
    {
      ...processed,
      segmentEffects: [{ segment: 0, music: "generated music prompt" }],
    },
    {
      availableBackgrounds: generatedAudioContext.availableBackgrounds,
      availableSfx: [],
      generateSoundEffects: false,
      generateMusic: true,
      useSpotifyMusic: true,
      validWidgetIds: new Set(),
      characterNames: [],
    },
  );
  assert.equal(spotifyProcessed.music, null);
  assert.equal(spotifyProcessed.segmentEffects?.[0]?.music, undefined);
}
