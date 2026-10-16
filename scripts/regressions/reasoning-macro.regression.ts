import assert from "node:assert/strict";
import { resolveMacros, type MacroContext } from "../../packages/shared/src/utils/macro-engine.js";
import { resolveReasoningMacroValue } from "../../packages/server/src/services/generation/provider-generation-runtime.js";

// {{reasoning}} reads the level the request runs with, so a preset can keep a chain-of-thought
// section only while the model thinks, and {{model}} can pick model-specific sections.
const ctx = (overrides: Partial<MacroContext> = {}): MacroContext => ({
  user: "Pat",
  char: "Mira",
  characters: ["Mira"],
  variables: {},
  model: "claude-opus-5-5",
  ...overrides,
});
const cot = "{{#if reasoning}}Think step by step.{{else}}Answer directly.{{/if}}";

assert.equal(resolveMacros("Level: {{reasoning}}", ctx({ reasoning: "high" })), "Level: high");
assert.equal(resolveMacros(cot, ctx({ reasoning: "high" })), "Think step by step.");
assert.equal(resolveMacros(cot, ctx({ reasoning: "off" })), "Answer directly.");
assert.equal(resolveMacros('{{#if reasoning == "max"}}deep{{/if}}', ctx({ reasoning: "max" })), "deep");
assert.equal(resolveMacros('{{#if reasoning != "off"}}on{{/if}}', ctx({ reasoning: "off" })), "");
assert.equal(resolveMacros('{{#if model contains "opus"}}Opus notes{{/if}}', ctx()), "Opus notes");
assert.equal(resolveMacros('{{#if {{model}} == "claude-opus-5-5"}}exact{{/if}}', ctx()), "exact");

// A preset or chat variable named `reasoning` predates the macro and keeps the name.
assert.equal(resolveMacros("{{reasoning}}", ctx({ reasoning: "high", variables: { reasoning: "yes" } })), "yes");
assert.equal(resolveMacros(cot, ctx({ reasoning: "high", localVariables: { reasoning: "no" } })), "Answer directly.");
// The macro matches any case, but a variable owns only its exact spelling, as in the catch-all pass.
const ownsCapital = ctx({ reasoning: "high", variables: { Reasoning: "x" } });
assert.equal(resolveMacros("{{Reasoning}}|{{reasoning}}", ownsCapital), "x|high");
assert.equal(resolveMacros('{{#if Reasoning == "x"}}own{{/if}}', ownsCapital), "own");
assert.equal(resolveMacros('{{#if @reasoning == "yes"}}own{{/if}}', ctx({ variables: { reasoning: "yes" } })), "own");
// A preset value still pending defers the block and the tag rather than deciding from the request's level.
const pending = ctx({ reasoning: "high", deferredPresetVariableNames: new Set(["reasoning"]) });
assert.equal(resolveMacros("{{reasoning}}", pending), "{{reasoning}}");
assert.ok(resolveMacros(cot, pending).includes("MARINARA_DEFERRED_RELOCATION_IF"));

const level = (args: Partial<Parameters<typeof resolveReasoningMacroValue>[0]> = {}) =>
  resolveReasoningMacroValue({
    connection: { provider: "anthropic", model: "claude-opus-5-5", defaultParameters: null },
    chatMode: "roleplay",
    isSceneChat: false,
    chatParameters: null,
    baseReasoningEffort: "medium",
    ...args,
  });

assert.equal(level(), "medium");
assert.equal(level({ baseReasoningEffort: null }), "off");
// Maximum is named by what the model is sent: Opus takes max, older GPT models top out lower.
assert.equal(level({ baseReasoningEffort: "maximum" }), "max");
assert.equal(
  level({
    connection: { provider: "openai", model: "gpt-4.1", defaultParameters: null },
    baseReasoningEffort: "maximum",
  }),
  "high",
);
// Connection, then chat, override the preset, as they do for the request.
assert.equal(
  level({
    connection: { provider: "anthropic", model: "claude-opus-5-5", defaultParameters: '{"reasoningEffort":"low"}' },
  }),
  "low",
);
assert.equal(level({ chatParameters: { reasoningEffort: null } }), "off");
// Scenes always run at the top level.
assert.equal(level({ isSceneChat: true, baseReasoningEffort: null }), "max");

console.log("reasoning macro regression passed");
