import assert from "node:assert/strict";
import { modelCost } from "../../packages/shared/src/constants/model-lists.js";
import { cachedPlanActive, withNanoGptPlan } from "../../packages/server/src/services/nanogpt/subscription-usage.js";

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

let clock = 0;
let reads = 0;
const answers: Array<boolean | null> = [true, null, null, false];
const read = async () => (reads++, answers.shift() ?? null);
assert.equal(await cachedPlanActive("acct", read, () => clock), true);
clock = 4 * 60_000;
assert.equal(await cachedPlanActive("acct", read, () => clock), true, "a hit within 5 min does not read");
assert.equal(reads, 1);
clock = 5 * 60_000 + 1;
assert.equal(await cachedPlanActive("acct", read, () => clock), null);
clock += 30_000;
assert.equal(await cachedPlanActive("acct", read, () => clock), null, "unknown is cached for 60 s");
assert.equal(reads, 2);
clock += 31_000;
assert.equal(await cachedPlanActive("acct", read, () => clock), null, "unknown expires after 60 s");
assert.equal(reads, 3);
console.log("nanogpt plan badges: ok");
