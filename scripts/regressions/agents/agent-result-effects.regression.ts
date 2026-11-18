// Agent result effects shared by normal generation and the retry-agents route (#9508).
import assert from "node:assert/strict";
import { AGENT_RESULT_TYPE_VALUES, type AgentResult } from "../../../packages/shared/src/index.js";
import {
  AGENT_RESULT_EFFECT_COVERAGE,
  SHARED_AGENT_RESULT_EFFECT_TYPES,
  applyAgentResultEffect,
  type AgentResultEffectDeps,
} from "../../../packages/server/src/services/generation/agent-result-effects.js";
import { runNamedCases } from "../fixtures/named-cases.js";

type Write = { id: string; swipeIndex: number; partial: Record<string, unknown> };

function fakeDeps(overrides: Partial<AgentResultEffectDeps> = {}, fail = false) {
  const writes: Write[] = [];
  const deps: AgentResultEffectDeps = {
    origin: "generate",
    chatId: "chat-1",
    messageId: "msg-1",
    swipeIndex: 2,
    chats: {
      updateMessageExtraForSwipe: async (id: string, swipeIndex: number, partial: Record<string, unknown>) => {
        if (fail) throw new Error("disk full");
        writes.push({ id, swipeIndex, partial });
        return null as never;
      },
    },
    ...overrides,
  };
  return { deps, writes };
}

function result(overrides: Partial<AgentResult> = {}): AgentResult {
  return {
    agentId: "agent-cyoa",
    agentType: "cyoa",
    type: "cyoa_choices",
    data: { choices: [{ label: "A", text: "Open the door" }] },
    tokensUsed: 0,
    durationMs: 0,
    success: true,
    error: null,
    ...overrides,
  };
}

await runNamedCases([
  {
    name: "every result type says whether its effect is shared, and every shared type has a handler",
    run: () => {
      assert.deepEqual(Object.keys(AGENT_RESULT_EFFECT_COVERAGE).sort(), [...AGENT_RESULT_TYPE_VALUES].sort());
      const sharedInTable = AGENT_RESULT_TYPE_VALUES.filter((type) => AGENT_RESULT_EFFECT_COVERAGE[type] === "shared");
      assert.deepEqual([...SHARED_AGENT_RESULT_EFFECT_TYPES].sort(), sharedInTable.sort());
    },
  },
  {
    name: "CYOA choices are saved on the message's swipe, the same way from generate and from retry",
    run: async () => {
      for (const origin of ["generate", "retry"] as const) {
        const { deps, writes } = fakeDeps({ origin, signal: new AbortController().signal });
        assert.equal(await applyAgentResultEffect(result(), deps), true);
        assert.deepEqual(writes, [
          { id: "msg-1", swipeIndex: 2, partial: { cyoaChoices: [{ label: "A", text: "Open the door" }] } },
        ]);
      }
    },
  },
  {
    name: "failed results, empty choices and a missing message write nothing",
    run: async () => {
      const { deps, writes } = fakeDeps();
      assert.equal(await applyAgentResultEffect(result({ success: false }), deps), false);
      assert.equal(await applyAgentResultEffect(result({ data: null }), deps), false);
      assert.equal(await applyAgentResultEffect(result({ data: { choices: [] } }), deps), true);
      const noMessage = fakeDeps({ messageId: null });
      assert.equal(await applyAgentResultEffect(result(), noMessage.deps), true);
      assert.deepEqual([...writes, ...noMessage.writes], []);
    },
  },
  {
    name: "types that are not shared yet are left to the route",
    run: async () => {
      const { deps, writes } = fakeDeps();
      assert.equal(await applyAgentResultEffect(result({ type: "quest_update", data: { updates: [] } }), deps), false);
      assert.deepEqual(writes, []);
    },
  },
  {
    name: "a cancelled retry stops before writing and passes the abort on",
    run: async () => {
      const controller = new AbortController();
      controller.abort();
      const { deps, writes } = fakeDeps({ origin: "retry", signal: controller.signal });
      await assert.rejects(applyAgentResultEffect(result(), deps), { name: "AbortError" });
      assert.deepEqual(writes, []);
    },
  },
  {
    name: "a storage failure is logged, not thrown, so the other results still apply",
    run: async () => {
      const { deps } = fakeDeps({}, true);
      assert.equal(await applyAgentResultEffect(result(), deps), true);
    },
  },
]);
