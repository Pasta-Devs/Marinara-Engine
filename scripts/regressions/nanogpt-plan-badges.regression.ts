import assert from "node:assert/strict";
import { modelCost } from "../../packages/shared/src/constants/model-lists.js";
import { withNanoGptPlan } from "../../packages/server/src/services/nanogpt/subscription-usage.js";

// A proxy's `nanogpt/<id>` models take NanoGPT's plan facts for `<id>`; other ids and unknown models stay bare.
const plan = new Map([
  ["z-ai/glm-5.3", { subscriptionIncluded: true, inputTokenMultiplier: 1 }],
  ["deepseek/deepseek-v4-pro", { subscriptionIncluded: true, inputTokenMultiplier: 2 }],
  ["fireworks/ember-1", { subscriptionIncluded: false }],
]);
const models = withNanoGptPlan(
  [
    { id: "nanogpt/z-ai/glm-5.3" },
    { id: "nanogpt/deepseek/deepseek-v4-pro" },
    { id: "nanogpt/fireworks/ember-1" },
    { id: "nanogpt/unknown/model" },
    { id: "openrouter/z-ai/glm-5.3" },
    { id: "z-ai/glm-5.3" },
  ],
  plan,
);
assert.deepEqual(
  models.map((model) => modelCost(model, null)),
  ["included", "multiplier:2", "paid", null, null, null],
);
console.log("nanogpt plan badges: ok");
