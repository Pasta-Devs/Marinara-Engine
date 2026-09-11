import assert from "node:assert/strict";
import {
  inheritsChatGenerationParameters,
  resolveStoredGameGenerationParameters,
} from "../../packages/server/src/routes/game.routes.js";

// Chat-wide parameters carry a main-connection-only OpenRouter routing object.
const meta = {
  chatParameters: {
    temperature: 0.9,
    customParameters: { provider: { only: ["vertex"] } },
  },
  gameSetupConfig: {
    generationParameters: { topP: 0.5 },
  },
};
const sceneDefaults = { temperature: 0.2, customParameters: { top_k: 40 } };

const inherited = resolveStoredGameGenerationParameters(meta, sceneDefaults);
assert.equal(inherited?.temperature, 0.9, "default path still layers the chat parameters last");
assert.equal(inherited?.topP, 0.5, "setup-config parameters still merge on the default path");
assert.deepEqual(
  inherited?.customParameters,
  { top_k: 40, provider: { only: ["vertex"] } },
  "default path still merges chat customParameters",
);

const scoped = resolveStoredGameGenerationParameters(meta, sceneDefaults, { includeChatParameters: false });
assert.equal(scoped?.temperature, 0.2, "a dedicated satellite connection keeps its own defaults");
assert.equal(scoped?.topP, 0.5, "setup-config parameters still merge for a satellite connection");
assert.deepEqual(scoped?.customParameters, { top_k: 40 }, "main-connection customParameters do not leak");
assert.equal(
  "provider" in (scoped?.customParameters ?? {}),
  false,
  "the OpenRouter provider routing object stays with the main connection",
);

const explicitlyIncluded = resolveStoredGameGenerationParameters(meta, sceneDefaults, {
  includeChatParameters: true,
});
assert.deepEqual(explicitlyIncluded, inherited, "includeChatParameters: true matches the default behavior");

// Guard: only a genuinely separate satellite connection opts out of the chat parameters.
assert.equal(
  inheritsChatGenerationParameters({
    requestedConnectionId: null,
    resolvedConnectionId: "main",
    chatConnectionId: "main",
  }),
  true,
  "no dedicated connection => the chat connection => inherit",
);
assert.equal(
  inheritsChatGenerationParameters({
    requestedConnectionId: "",
    resolvedConnectionId: "main",
    chatConnectionId: "main",
  }),
  true,
  "blank dedicated connection id behaves like none",
);
assert.equal(
  inheritsChatGenerationParameters({
    requestedConnectionId: "main",
    resolvedConnectionId: "main",
    chatConnectionId: "main",
  }),
  true,
  "dedicated connection that IS the chat connection => inherit",
);
assert.equal(
  inheritsChatGenerationParameters({
    requestedConnectionId: "scene",
    resolvedConnectionId: "scene",
    chatConnectionId: "main",
  }),
  false,
  "dedicated scene connection => do not inherit",
);
assert.equal(
  inheritsChatGenerationParameters({
    requestedConnectionId: "scene",
    resolvedConnectionId: "scene",
    chatConnectionId: null,
  }),
  false,
  "dedicated scene connection with no chat connection => do not inherit",
);
assert.equal(
  inheritsChatGenerationParameters({
    requestedConnectionId: "random",
    resolvedConnectionId: "main",
    chatConnectionId: "main",
  }),
  true,
  "random pool that lands on the chat connection => inherit",
);

console.log("game-satellite-connection-parameters regression passed");
