import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { rememberBoundedSetValue } from "../../packages/client/src/lib/bounded-set.js";
import playwrightConfig from "../../playwright.config.js";

const boundedValues = new Set(["first", "second"]);
rememberBoundedSetValue(boundedValues, "third", 2);
assert.deepEqual([...boundedValues], ["second", "third"]);

rememberBoundedSetValue(boundedValues, "second", 2);
assert.deepEqual([...boundedValues], ["third", "second"]);

const playwrightWebServer = Array.isArray(playwrightConfig.webServer)
  ? playwrightConfig.webServer[0]
  : playwrightConfig.webServer;
assert.deepEqual(playwrightWebServer?.gracefulShutdown, { signal: "SIGTERM", timeout: 10_000 });

const generateRouteSource = readFileSync(
  new URL("../../packages/server/src/routes/generate.routes.ts", import.meta.url),
  "utf8",
);
assert.doesNotMatch(generateRouteSource, /encryptedReasoningCache/u);

const reasoningRecoveryIndex = generateRouteSource.indexOf(
  "// OpenAI Responses API uses encrypted reasoning items for multi-turn continuity.",
);
const toolBranchIndex = generateRouteSource.indexOf("if (enableChatTools && provider.chatComplete)");
assert.ok(reasoningRecoveryIndex >= 0 && reasoningRecoveryIndex < toolBranchIndex);
assert.match(
  generateRouteSource.slice(reasoningRecoveryIndex, toolBranchIndex),
  /reasoningMessages[\s\S]*scopedMessages/u,
);

const hiddenAnchorStart = generateRouteSource.indexOf("const anchoredMsg = savedMsg?.id");
const hiddenAnchorEnd = generateRouteSource.indexOf(
  "\n              if (\n                anchoredMsg?.id",
  hiddenAnchorStart,
);
assert.ok(hiddenAnchorStart >= 0 && hiddenAnchorEnd > hiddenAnchorStart);
const hiddenAnchorSource = generateRouteSource.slice(hiddenAnchorStart, hiddenAnchorEnd);
assert.match(hiddenAnchorSource, /updateMessageExtra\(savedMsg\.id/u);
assert.match(hiddenAnchorSource, /commandOnly: true/u);
assert.match(hiddenAnchorSource, /encryptedReasoning: encryptedReasoningItems\?\.length/u);
