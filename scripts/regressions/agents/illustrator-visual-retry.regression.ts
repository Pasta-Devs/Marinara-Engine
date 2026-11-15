import assert from "node:assert/strict";
import {
  illustratorRetryTargetsForFailures,
  mergeAgentFailures,
  toAgentFailure,
} from "../../../packages/client/src/lib/agent-failures.js";
import {
  isExclusiveIllustratorRetryTarget,
  parseIllustratorRetryTargets,
  shouldRetryIllustratorTarget,
} from "../../../packages/server/src/services/generation/illustrator-retry-targets.js";

const illustrationFailure = toAgentFailure({
  agentType: "illustrator",
  agentName: "Illustrator",
  retryTarget: "illustration",
  error: "Image generation failed",
});
const backgroundFailure = toAgentFailure({
  agentType: "illustrator",
  agentName: "Illustrator",
  retryTarget: "background",
  error: "Background generation failed",
});

assert.deepEqual(illustratorRetryTargetsForFailures([illustrationFailure]), ["illustration"]);
assert.deepEqual(illustratorRetryTargetsForFailures([backgroundFailure]), ["background"]);
assert.deepEqual(illustratorRetryTargetsForFailures(mergeAgentFailures([illustrationFailure], [backgroundFailure])), [
  "illustration",
  "background",
]);
assert.equal(
  illustratorRetryTargetsForFailures([toAgentFailure({ agentType: "illustrator", error: "Prompt failed" })]),
  undefined,
  "legacy unscoped Illustrator failures must retain the full retry path",
);
assert.equal(
  illustratorRetryTargetsForFailures(
    mergeAgentFailures(
      [illustrationFailure],
      [toAgentFailure({ agentType: "illustrator", error: "Legacy failure" })],
    ),
  ),
  undefined,
  "mixed scoped and legacy failures must retain the full retry path",
);

const backgroundOnly = parseIllustratorRetryTargets(["background"]);
assert.deepEqual(backgroundOnly, ["background"]);
assert.equal(shouldRetryIllustratorTarget(backgroundOnly ?? undefined, "background"), true);
assert.equal(shouldRetryIllustratorTarget(backgroundOnly ?? undefined, "illustration"), false);
assert.equal(isExclusiveIllustratorRetryTarget(backgroundOnly ?? undefined, "background"), true);
assert.equal(isExclusiveIllustratorRetryTarget(backgroundOnly ?? undefined, "illustration"), false);

const illustrationOnly = parseIllustratorRetryTargets(["illustration"]);
assert.deepEqual(illustrationOnly, ["illustration"]);
assert.equal(shouldRetryIllustratorTarget(illustrationOnly ?? undefined, "illustration"), true);
assert.equal(shouldRetryIllustratorTarget(illustrationOnly ?? undefined, "background"), false);
assert.equal(isExclusiveIllustratorRetryTarget(illustrationOnly ?? undefined, "illustration"), true);

assert.equal(shouldRetryIllustratorTarget(undefined, "illustration"), true);
assert.equal(shouldRetryIllustratorTarget(undefined, "background"), true);
assert.equal(parseIllustratorRetryTargets([]), null);
assert.equal(parseIllustratorRetryTargets(["sprite"]), null);

console.info("Illustrator visual retry regression passed.");
