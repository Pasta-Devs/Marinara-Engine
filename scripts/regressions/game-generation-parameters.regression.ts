import assert from "node:assert/strict";
import {
  assertCompleteGameJson,
  gameGenOptions,
  resolveStoredGameGenerationParameters,
} from "../../packages/server/src/routes/game.routes.js";
import { resolveGenerationProviderRuntime } from "../../packages/server/src/services/generation/provider-generation-runtime.js";
import { resolveModelAccessPolicy } from "../../packages/server/src/services/generation/model-access-policy.js";

const parameters = resolveStoredGameGenerationParameters(
  { chatParameters: { temperature: 0.35, maxTokens: 2500, reasoningEffort: "low" } },
  {
    temperature: 0.8,
    maxTokens: 12000,
    topP: 0.7,
    minP: 0.1,
    stopSequences: ["END"],
    enabledParameters: { topP: false },
  },
)!;
const runtime = (model = "gpt-4.1", maxTokensOverride: number | null = null) =>
  resolveGenerationProviderRuntime({
    connectionId: "fixture",
    connection: { provider: "openai", model, apiKey: "synthetic", defaultParameters: parameters, maxTokensOverride },
    baseUrl: "https://api.openai.com/v1",
    chatMode: "game",
    isSceneChat: false,
    chatParameters: {},
    managedParameterDefinitions: [],
    modelAccessPolicy: resolveModelAccessPolicy({ provider: "openai", model }),
    initial: {
      temperature: 1,
      maxTokens: 4096,
      topP: 1,
      topK: 0,
      minP: 0,
      frequencyPenalty: 0,
      presencePenalty: 0,
      showThoughts: false,
      reasoningEffort: null,
      verbosity: null,
      serviceTier: null,
      assistantPrefill: "",
      assistantReasoningPrefill: "",
      customThinkingTags: [],
      customParameters: {},
      enabledParameters: undefined,
      stopSequences: [],
      effectiveMaxContext: undefined,
    },
  });
const main = runtime();
assert.equal(main.temperature, 0.35, "Game GM keeps the configured sampling value");
assert.equal(main.maxTokens, 2500, "Game GM does not impose an output floor");
assert.equal(main.reasoningEffort, "low");
assert.equal(main.minP, 0.1);
assert.equal(main.enabledParameters?.topP, false);
assert.equal(main.parameterSources.temperature, "connection");
assert.equal(runtime("gpt-4.1", 1000).maxTokens, 1000, "connection output caps still apply");
const signal = AbortSignal.timeout(5000);
const helper = gameGenOptions(
  "gpt-4.1",
  { temperature: 0.6, maxTokens: 1200, responseFormat: { type: "json_object" }, signal },
  parameters,
  "openai",
);
assert.equal(helper.temperature, 0.35, "saved settings win over helper defaults");
assert.equal(helper.maxTokens, 2500);
assert.equal(helper.reasoningEffort, "low");
assert.equal(helper.minP, 0.1);
assert.deepEqual(helper.stop, ["END"]);
assert.equal(helper.enabledParameters?.topP, false);
assert.deepEqual(helper.responseFormat, { type: "json_object" });
assert.equal(helper.signal, signal);
assert.equal(
  gameGenOptions("gpt-4.1", { maxTokens: 1200 }, null, "openai").maxTokens,
  1200,
  "defaults still serve unconfigured helpers",
);
const noReasoning = gameGenOptions("gpt-5.5", {}, { reasoningEffort: null, verbosity: null }, "openai");
assert.equal(noReasoning.reasoningEffort, "none");
assert.equal(noReasoning.enableThinking, false);
assert.equal(noReasoning.verbosity, undefined);
const claude = gameGenOptions("claude-opus-4-7", {}, { temperature: 0.3, topP: 0.6 }, "anthropic");
assert.equal(claude.temperature, undefined, "provider sampling restrictions still apply");
assert.equal(claude.topP, undefined);
console.info("Game generation parameter precedence regression passed");

assert.doesNotThrow(() => assertCompleteGameJson('{"summary":"Finished"}', "stop"));
assert.throws(() => assertCompleteGameJson('{"summary":"Cut off', "length"), /max output tokens/);
assert.throws(() => assertCompleteGameJson('{"summary":"Cut off', "stop"), /max output tokens/);
assert.doesNotThrow(
  () => assertCompleteGameJson("not json", "stop"),
  "complete malformed output keeps the JSON repair path",
);
