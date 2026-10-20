// Add window, "A specific model…": which services and Connections serve a model.
import assert from "node:assert/strict";
import {
  buildOfflineModelIndex,
  keysOf,
  modelKey,
  popularModels,
  searchModels,
  withOwnConnections,
} from "../../packages/client/src/lib/add-model-search.js";

const offline = buildOfflineModelIndex(["anthropic", "openai", "claude_subscription"]);
const services = (key: string) =>
  offline.find((entry) => entry.key === key)?.routes.flatMap((route) => ("service" in route ? [route.service] : []));

// A Claude model lists its vendor, the plan that offers it, and the gateways that route Anthropic models.
assert.deepEqual(services("claude-opus-5-5"), ["anthropic", "claude_subscription", "openrouter", "nanogpt"]);
// Date pins repeat the model they pin; the index keeps the plain id only.
assert.ok(!offline.some((entry) => /-\d{8}$/u.test(entry.key)));
// A gateway id resolves to the same key as the vendor id.
assert.equal(modelKey("anthropic/claude-opus-5-5"), "claude-opus-5-5");

// The user's Bifrost holds the model under a gateway id: it becomes a route with that exact id.
const bifrost = keysOf(new Set(["anthropic/claude-opus-5-5", "zai/glm-only-here"]));
const index = withOwnConnections(offline, [
  {
    accountId: "bifrost",
    models: new Map([...bifrost].map(([key, id]) => [key, { id, kind: "chat" as const }])),
  },
]);
const opus = searchModels(index, "opus 5-5", null, 6).find((entry) => entry.key === "claude-opus-5-5");
assert.ok(opus);
assert.deepEqual(
  opus.routes.find((route) => "accountId" in route),
  { accountId: "bifrost", model: "anthropic/claude-opus-5-5" },
);
// The offline copy is untouched, and a model only the user's Connection knows still shows.
assert.ok(!offline.find((entry) => entry.key === "claude-opus-5-5")?.routes.some((route) => "accountId" in route));
assert.equal(searchModels(index, "glm-only", null, 6)[0]?.key, "glm-only-here");
// A kind filter hides other kinds; an empty search lists nothing.
assert.equal(searchModels(index, "opus", "image", 6).length, 0);
assert.equal(searchModels(index, "  ", null, 6).length, 0);

// Picks before typing: one per service, newest first.
const picks = popularModels(index, null, 4);
assert.deepEqual(
  picks
    .slice(0, 2)
    .map((entry) => entry.routes.find((route) => "service" in route) as { service: string })
    .map((route) => route.service),
  ["anthropic", "openai"],
);

console.log("add-model-search regression passed");
