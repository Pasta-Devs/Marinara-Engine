import assert from "node:assert/strict";
import { modelCost } from "../../packages/shared/src/constants/model-lists.js";
import { withNanoGptPlan } from "../../packages/server/src/services/nanogpt/subscription-usage.js";

// A proxy's `nanogpt/<id>` models take NanoGPT's plan facts for `<id>`; other ids and unknown models stay bare.
// An unlisted id matches by its last part only when one plan model has it (`zai-org/glm-5.2` → `z-ai/glm-5.2`);
// a shared last part (`shared-name`) and a different suffix (`glm-5.2:thinking`) give no badge.
const plan = new Map([
  ["z-ai/glm-5.3", { subscriptionIncluded: true, inputTokenMultiplier: 1 }],
  ["deepseek/deepseek-v4-pro", { subscriptionIncluded: true, inputTokenMultiplier: 2 }],
  ["fireworks/ember-1", { subscriptionIncluded: false }],
  ["z-ai/glm-5.2", { subscriptionIncluded: true, inputTokenMultiplier: 1 }],
  ["vendor-a/shared-name", { subscriptionIncluded: true, inputTokenMultiplier: 1 }],
  ["vendor-b/shared-name", { subscriptionIncluded: false }],
]);
const models = withNanoGptPlan(
  [
    { id: "nanogpt/z-ai/glm-5.3" },
    { id: "nanogpt/deepseek/deepseek-v4-pro" },
    { id: "nanogpt/fireworks/ember-1" },
    { id: "nanogpt/unknown/model" },
    { id: "openrouter/z-ai/glm-5.3" },
    { id: "z-ai/glm-5.3" },
    { id: "nanogpt/zai-org/glm-5.2" },
    { id: "nanogpt/zai-org/glm-5.2:thinking" },
    { id: "nanogpt/other/shared-name" },
  ],
  plan,
);
assert.deepEqual(
  models.map((model) => modelCost(model, null)),
  ["included", "multiplier:2", "paid", null, null, null, "included", null, null],
);
console.log("nanogpt plan badges: ok");
