import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getAgentRunIntervalMeta, parseCadenceInputValue } from "../../packages/client/src/lib/agent-cadence.js";
import { shouldSkipAgentByMessageInterval } from "../../packages/server/src/services/generation/agent-cadence.js";

const illustrator = getAgentRunIntervalMeta("illustrator")!;
assert.equal(illustrator.min, 0, "Illustrator setup must offer manual-only cadence");
assert.equal(illustrator.defaultValue, 5, "automatic cadence remains the default");
assert.equal(parseCadenceInputValue("0", 5, 100, illustrator.min), 0);
assert.equal(parseCadenceInputValue("-1", 5, 100, illustrator.min), 0);
assert.equal(parseCadenceInputValue("101", 5, 100, illustrator.min), 100);
assert.equal(parseCadenceInputValue("", 5, 100, illustrator.min), 5);
assert.equal(parseCadenceInputValue("0", 8, 100), 1, "other agents keep their positive minimum");
assert.equal(getAgentRunIntervalMeta("lorebook-keeper")?.min ?? 1, 1);
assert.equal(getAgentRunIntervalMeta("custom", false)?.min ?? 1, 1);

let historyReads = 0;
const agentsStore = {
  async getLastSuccessfulRunByType() {
    historyReads++;
    return null;
  },
};
const base = { agentsStore, chatId: "manual-only", agentType: "illustrator", fallbackInterval: 5, messages: [] };
for (const value of [0, "0"]) {
  assert.equal(await shouldSkipAgentByMessageInterval({ ...base, settings: { runInterval: value } }), true);
}
assert.equal(historyReads, 0, "manual-only must skip even before the first successful run");
for (const value of [undefined, null, "", false, -1, "invalid", 1, 5]) {
  assert.equal(
    await shouldSkipAgentByMessageInterval({ ...base, settings: { runInterval: value } }),
    false,
    `invalid or automatic cadence ${String(value)} must not become manual-only`,
  );
}
assert.equal(
  await shouldSkipAgentByMessageInterval({ ...base, agentType: "lorebook-keeper", settings: { runInterval: 0 } }),
  false,
  "zero must not disable unrelated agents",
);
assert.equal(
  await shouldSkipAgentByMessageInterval({
    ...base,
    agentsStore: {
      async getLastSuccessfulRunByType() {
        return { messageId: "prior" };
      },
    },
    settings: { runInterval: 5 },
    messages: [
      { id: "prior", role: "assistant" },
      { id: "new", role: "user" },
    ],
  }),
  true,
  "ordinary interval gating remains intact",
);

const manualRoute = readFileSync(
  new URL("../../packages/server/src/routes/generate/retry-agents-route.ts", import.meta.url),
  "utf8",
);
assert.ok(manualRoute.includes("isManualIllustratorImageRequest"));
assert.ok(!manualRoute.includes("shouldSkipAgentByMessageInterval"), "manual generation must bypass cadence");
console.info("Illustrator manual-only cadence regressions passed");
