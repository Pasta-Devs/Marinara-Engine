import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  normalizeGameStoryboardKeyframeCount,
  normalizeStoryboardAgentSettings,
} from "../../packages/shared/src/index.js";
import {
  buildRuntimeAgentSectionEligibleTypes,
  makeRuntimeAgentSectionTokens,
  splitRuntimeHandledAgentInjections,
  clearUnusedRuntimeAgentSections,
} from "../../packages/server/src/services/generation/runtime-agent-sections.js";
import { completeStoryboardPlan } from "../../packages/server/src/services/game/storyboard-planner-fallback.js";
import type {
  BaseLLMProvider,
  ChatMessage,
  ChatOptions,
  ChatCompletionResult,
} from "../../packages/server/src/services/llm/base-provider.js";

const eligible = buildRuntimeAgentSectionEligibleTypes({
  enableAgents: true,
  activeAgentIds: ["director"],
  configuredAgents: [{ type: "director", phase: "pre_generation", settings: { resultType: "director_event" } }],
});
assert.ok(eligible.has("director"), "Director markers must be runtime-resolved, not replay the previous stored run");
const tokens = makeRuntimeAgentSectionTokens("director", "current-turn");
const current = { agentType: "director", text: "CURRENT_DIRECTION" };
for (const marked of [false, true]) {
  const messages = [{ content: marked ? `${tokens.start}${tokens.placeholder}${tokens.end}` : "SYSTEM" }];
  const placed = splitRuntimeHandledAgentInjections(messages, new Map([["director", tokens]]), [current], {
    omitUnmatched: true,
  });
  assert.deepEqual(placed.omittedInjections, []);
  assert.deepEqual(placed.fallbackInjections, marked ? [] : [current]);
  if (marked) assert.equal(messages[0]?.content, "CURRENT_DIRECTION");
  clearUnusedRuntimeAgentSections(messages, [["director", tokens]]);
  assert.ok(!JSON.stringify(messages).includes("__MARINARA_RUNTIME"));
}
assert.equal(normalizeGameStoryboardKeyframeCount(12), 12);
assert.equal(normalizeStoryboardAgentSettings({ keyframeCount: 12 }).keyframeCount, 12);
assert.equal(normalizeGameStoryboardKeyframeCount(10000), 200);
assert.equal(normalizeGameStoryboardKeyframeCount(undefined), 3);
const validPlan = { keyframes: Array.from({ length: 12 }, (_, index) => ({ imagePrompt: `Frame ${index}` })) };
const attempts: boolean[] = [];
assert.deepEqual(
  await completeStoryboardPlan({
    retryWithoutReasoning: true,
    generate: async (withoutReasoning) => {
      attempts.push(withoutReasoning);
      return { content: withoutReasoning ? JSON.stringify(validPlan) : "<think>Budget spent thinking</think>" };
    },
  }),
  validPlan,
);
assert.deepEqual(attempts, [false, true]);
let calls = 0;
await assert.rejects(
  completeStoryboardPlan({
    retryWithoutReasoning: true,
    generate: async () => {
      calls++;
      return { content: "bad JSON" };
    },
  }),
  /no usable keyframes/,
);
assert.equal(calls, 2);
calls = 0;
await assert.rejects(
  completeStoryboardPlan({
    retryWithoutReasoning: false,
    generate: async () => {
      calls++;
      return { content: "" };
    },
  }),
  /no usable keyframes/,
);
assert.equal(calls, 1);
calls = 0;
await assert.rejects(
  completeStoryboardPlan({
    retryWithoutReasoning: true,
    generate: async () => {
      calls++;
      throw new Error("cancelled");
    },
  }),
  /cancelled/,
);
assert.equal(calls, 1);

const storage = mkdtempSync(join(tmpdir(), "marinara-chat-sweep-"));
process.env.FILE_STORAGE_DIR = storage;
try {
  const { ProfessorMariWorkspaceService } =
    await import("../../packages/server/src/services/professor-mari/workspace-agent.service.js");
  const service = Object.create(ProfessorMariWorkspaceService.prototype) as {
    chatCompleteWorkspace(
      provider: BaseLLMProvider,
      messages: ChatMessage[],
      options: ChatOptions,
    ): Promise<ChatCompletionResult>;
  };
  const original: ChatMessage[] = [
    { role: "system", content: "RULES" },
    { role: "system", content: "PERMISSIONS" },
    { role: "user", content: "REQUEST", images: ["image-fixture"] },
    { role: "assistant", content: "RESPONSE" },
    { role: "system", content: "ATTACHED_CONTEXT" },
    { role: "user", content: "COMMAND_RESULT" },
  ];
  const saved = structuredClone(original);
  const provider = {
    chatComplete: async (messages: ChatMessage[]) => {
      assert.deepEqual(
        messages.map((message) => message.role),
        ["system", "user", "assistant", "user"],
      );
      assert.equal(messages[0]?.content, "RULES\n\nPERMISSIONS\n\nATTACHED_CONTEXT");
      assert.deepEqual(messages[1]?.images, ["image-fixture"]);
      return { content: "OK" };
    },
  } as unknown as BaseLLMProvider;
  await service.chatCompleteWorkspace(provider, original, { model: "local-fixture" });
  await service.chatCompleteWorkspace(provider, original, { model: "local-fixture" });
  assert.deepEqual(original, saved, "provider normalization must not rewrite stored history");
} finally {
  rmSync(storage, { recursive: true, force: true });
}
console.info("Chat sweep regression passed");
