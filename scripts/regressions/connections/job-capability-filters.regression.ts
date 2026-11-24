import assert from "node:assert/strict";

// Image reading lists only models that can see: when neither the user nor the provider's list says, the model id is
// the guess (well-known families only).
const { modelIdReadsImages, modelIgnoredGenerationParameters } = await import("../../../packages/shared/src/index.js");

assert.equal(modelIdReadsImages("[SP]deepseek-v4-pro"), false);
assert.equal(modelIdReadsImages("glm-5.3"), false);
assert.equal(modelIdReadsImages("glm-4.5v"), true);
assert.equal(modelIdReadsImages("models/gemini-4-argon"), true);
assert.equal(modelIdReadsImages("[芥兰K]Claude-5.5-Opus⑧"), true);
assert.equal(modelIdReadsImages("gpt-6.1-sol"), true);
// Unknown families stay listed.
assert.equal(modelIdReadsImages("qwen3-max"), null);
assert.equal(modelIdReadsImages("mock-roleplay-1"), null);

// A custom endpoint still sends sampling to Gemini 3/4, which ignores it: the editor tucks those away.
const gemini = modelIgnoredGenerationParameters({ provider: "custom", model: "models/gemini-4-argon" });
for (const key of ["temperature", "topP", "topK", "minP", "frequencyPenalty", "presencePenalty"])
  assert.ok(gemini.has(key as never), key);
assert.deepEqual([...modelIgnoredGenerationParameters({ provider: "custom", model: "glm-5.3" })], ["minP"]);
assert.equal(modelIgnoredGenerationParameters({ provider: "custom", model: "qwen3-max" }).size, 0);
// Known providers already hide what they never send.
assert.equal(modelIgnoredGenerationParameters({ provider: "openai", model: "gpt-5" }).size, 0);

console.log("job-capability-filters: ok");
