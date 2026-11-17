// The scene analyzer's prompt: narration that doesn't fit a local model's context drops its earliest beats first.
import assert from "node:assert/strict";
import {
  sceneAnalysisRequestSchema,
  SIDECAR_SCENE_ANALYSIS_NARRATION_BUDGET_CHARS,
} from "../../../packages/shared/src/schemas/scene-analysis.schema.js";
import {
  buildSceneAnalyzerUserPrompt,
  fitSceneAnalyzerNarrationBeats,
} from "../../../packages/server/src/services/sidecar/scene-analyzer.js";

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
