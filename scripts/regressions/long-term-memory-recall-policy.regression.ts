import assert from "node:assert/strict";
import {
  resolveMemoryRecallPolicy,
  splitCachedLongTermMemory,
} from "../../packages/server/src/routes/generate/memory-recall-policy.js";
import {
  makeRuntimeAgentSectionTokens,
  splitRuntimeHandledAgentInjections,
} from "../../packages/server/src/services/generation/runtime-agent-sections.js";

// A chat that lists Long-term memory while its runtime service is unregistered reaches the
// policy as longTermMemoryActive=false, so the "LTM off" cases also cover that state.
for (const memoriesSlot of [true, false]) {
  assert.deepEqual(
    resolveMemoryRecallPolicy({ longTermMemoryActive: false, memoriesSlot }),
    { builtInRecall: true, longTermMemoryPlacement: "none" },
    `LTM off keeps built-in recall (memories slot: ${memoriesSlot})`,
  );
}

// LTM on replaces built-in recall and follows the conversation memories slot, otherwise the agent section.
assert.deepEqual(resolveMemoryRecallPolicy({ longTermMemoryActive: true, memoriesSlot: true }), {
  builtInRecall: false,
  longTermMemoryPlacement: "memories-slot",
});
assert.deepEqual(resolveMemoryRecallPolicy({ longTermMemoryActive: true, memoriesSlot: false }), {
  builtInRecall: false,
  longTermMemoryPlacement: "agent",
});

// A slot-mode regenerate puts the cached notes in the memories slot once, keeps them out of the
// runtime-section replay, and leaves the cache whole so the new reply stores them again.
const cached = [
  { agentType: "director", text: "PUSH" },
  { agentType: "long-term-memory", text: "Mira likes tea." },
  { agentType: "long-term-memory", text: "Mira fears boats." },
];
const { slotText, replay } = splitCachedLongTermMemory(cached);
assert.equal(slotText, "Mira likes tea.\n\nMira fears boats.");
const tokens = makeRuntimeAgentSectionTokens("long-term-memory", "regenerate");
const prompt = [{ content: `Memories:\n${slotText}\n${tokens.placeholder}` }];
const split = splitRuntimeHandledAgentInjections(prompt, new Map([["long-term-memory", tokens]]), replay, {
  omitUnmatched: true,
});
assert.deepEqual(split, { fallbackInjections: [cached[0]], omittedInjections: [] });
assert.equal(prompt[0]!.content.split("Mira likes tea.").length - 1, 1, "the notes appear once");
assert.equal(cached.length, 3);

console.info("Long-term memory recall policy regression passed.");
