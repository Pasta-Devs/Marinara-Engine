import assert from "node:assert/strict";
import { prepareAdvancedMemoryContext } from "../../packages/server/src/services/generation/advanced-memory-context.js";
import { createAdvancedMemoryPlacement } from "../../packages/server/src/services/prompt/advanced-memory-prompt.js";
import { fitMessagesToContext, measureContextBudget } from "../../packages/server/src/services/llm/base-provider.js";

const settings = {
  enabled: true,
  maxContextTokens: 65_000,
  summaryBudgetTokens: 4096,
  helperConnectionId: null,
  initialProcessingModel: "helper" as const,
  retrieveMinMessages: 3,
  retrieveMaxMessages: 10,
  narratorCharacterId: null,
  knowledgeStarts: {},
  knowledgeConfirmed: true,
};
type Input = Parameters<typeof prepareAdvancedMemoryContext>[0];
const source = Array.from({ length: 22 }, (_, index) => ({
  id: `source-${index}`,
  role: index % 2 ? "assistant" : "user",
  content: "x".repeat(4000),
}));
const placements = [
  createAdvancedMemoryPlacement("chat_summary", "xml"),
  createAdvancedMemoryPlacement("recalled_messages", "xml"),
];
const prompt: Input["messages"] = [
  {
    role: "system",
    content: `Character rules\n${placements.map((item) => item.token).join("\n")}`,
    contextKind: "prompt",
  },
  ...source.map((item) => ({ ...item, role: item.role as "user" | "assistant", contextKind: "history" as const })),
];
const calls: Array<{ budget: number; readOnly?: boolean }> = [];
let recall = "";
const service = {
  async prepare(input: Parameters<Input["service"]["prepare"]>[0]) {
    calls.push({ budget: input.budgetTokens, readOnly: input.readOnly });
    const count = Math.min(source.length, Math.max(1, Math.floor((input.budgetTokens - 256) / 1010)));
    return {
      messageIds: source.slice(-count).map((item) => item.id),
      chatSummary: count < source.length ? "Earlier events remain in continuity." : null,
      currentSceneSummary: null,
      recalledScenes: null,
      recalledMessages: recall,
      receipt: {
        sourceFingerprint: "fixture",
        policyRevision: "fixture",
        recordRevisions: {},
        estimatedTokensBefore: 0,
        estimatedTokensAfter: 0,
        budgetTokens: input.budgetTokens,
        boundaryMessageId: source.at(-count)!.id,
        checkpointId: "checkpoint",
        recalledSceneIds: [],
        recalledMessageIds: recall ? ["older-promise"] : [],
        reasons: [],
      },
    };
  },
} as Input["service"];
const input: Input = {
  service,
  chatId: "proof",
  settings,
  sourceMessages: source,
  messages: prompt,
  placements,
  audienceCharacterIds: ["character"],
  maxTokens: 4096,
  toProviderMessages: (messages) => messages,
};

const roomy = await prepareAdvancedMemoryContext(input);
assert.equal(
  roomy.messages.filter((message) => message.contextKind === "history").length,
  22,
  "22k of live history must grow naturally beneath a 65k complete-context cap",
);
assert.equal(calls.length, 1);
assert.ok(!roomy.providerMessages.some((message) => message.content.includes("__MARINARA_ADVANCED_MEMORY_")));

recall = "Optional old promise ".repeat(3000);
const limited = await prepareAdvancedMemoryContext({ ...input, maxContext: 12_000 });
assert.ok(limited.messages.length < roomy.messages.length);
assert.equal(limited.receipt.recalledMessageIds.length, 0, "discard optional excerpts before further cutting history");
assert.equal(limited.messages.filter((message) => message.content.includes("Earlier events remain")).length, 1);
assert.ok(measureContextBudget(limited.providerMessages, { maxContext: 12_000, maxTokens: 4096 }).fits);
assert.ok(limited.providerMessages.some((message) => message.content.includes("Character rules")));

recall = "";
const preview = await prepareAdvancedMemoryContext({ ...input, readOnly: true });
assert.equal(calls.at(-1)!.readOnly, true);
assert.deepEqual(preview.providerMessages, roomy.providerMessages);
assert.ok(prompt[0]!.content.includes(placements[0]!.token), "prepared snapshot must stay reusable");

const synthetic = {
  role: "user" as const,
  content: "New unsaved input",
  id: "__dryrun_user__",
  contextKind: "history" as const,
};
const withInput = await prepareAdvancedMemoryContext({
  ...input,
  messages: [...prompt, synthetic],
  maxContext: 12_000,
});
assert.equal(withInput.messages.at(-1)?.id, synthetic.id, "current unsaved input cannot disappear during selection");

await assert.rejects(
  prepareAdvancedMemoryContext({
    ...input,
    maxContext: 5000,
    messages: [{ role: "system", content: "Required rules".repeat(4000) }, ...prompt],
  }),
  /fixed instructions/,
);
await assert.rejects(
  prepareAdvancedMemoryContext({
    ...input,
    maxContext: 5000,
    messages: [{ ...synthetic, files: [{ type: "application/pdf", data: "a".repeat(10000) }] }, ...prompt],
  }),
  /fixed instructions/,
);

const original = structuredClone(roomy.providerMessages);
assert.throws(
  () =>
    fitMessagesToContext(roomy.providerMessages, {
      maxContext: 6000,
      maxTokens: 4096,
      preserveContext: true,
    }),
  /exceeds the context cap/,
);
assert.deepEqual(roomy.providerMessages, original, "managed failure cannot silently mutate or trim history");
const fitting = fitMessagesToContext(limited.providerMessages, {
  maxContext: 12_000,
  maxTokens: 4096,
  preserveContext: true,
});
assert.equal(fitting.trimmed, false);
assert.equal(fitting.maxTokens, 4096, "managed context preserves the requested completion reserve");
process.stdout.write("Advanced memory complete-context regression passed.\n");
