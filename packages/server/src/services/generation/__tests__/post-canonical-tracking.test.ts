import assert from "node:assert/strict";
import test from "node:test";
import type { AgentContext, AgentResult } from "@marinara-engine/shared";
import { runPostCanonicalTracking } from "../post-canonical-tracking.js";

const tracker = {
  id: "runtime-agent",
  type: "humanos-v2-runtime-updater",
  phase: "post_processing",
  settings: { pipelineStage: "post_canonical_tracking" },
} as any;

const result: AgentResult = {
  agentId: "runtime-agent",
  agentType: "humanos-v2-runtime-updater",
  type: "context_injection",
  data: { committed: true },
  tokensUsed: 1,
  durationMs: 1,
  success: true,
  error: null,
};

test("post-canonical tracker receives only reloaded final text after anchor exposure", async () => {
  const events: string[] = ["candidate_persisted", "editor_rewrite_persisted"];
  let observedResponse = "";
  const observedAnchors: Array<{ messageId: string; swipeIndex: number; sourceContentHash: string }> = [];
  let savedMessageId = "";

  const outcome = await runPostCanonicalTracking({
    agents: [tracker],
    chatId: "chat-1",
    messageId: "message-final",
    aborted: false,
    baseContext: { mainResponse: "PRE_REVIEW_CANDIDATE" } as AgentContext,
    preGenInjections: [],
    parallelResults: [],
    loadMessage: async (messageId) => {
      events.push(`reloaded:${messageId}`);
      return {
        id: messageId,
        chatId: "chat-1",
        role: "assistant",
        content: "FINAL_REWRITTEN_TEXT",
        activeSwipeIndex: 2,
      };
    },
    setRuntimeAnchor: (anchor) => {
      if (anchor) observedAnchors.push(anchor);
      events.push(`anchor:${anchor?.messageId}:${anchor?.swipeIndex}:${anchor?.sourceContentHash}`);
    },
    executeTrackers: async (_agents, context) => {
      observedResponse = context.mainResponse ?? "";
      events.push(`tracker:${observedResponse}`);
      return [result];
    },
    saveRun: async (_result, messageId) => {
      savedMessageId = messageId;
      events.push(`saved:${messageId}`);
    },
  });

  const observedAnchor = observedAnchors[0];
  assert.equal(outcome.status, "completed");
  assert.equal(observedResponse, "FINAL_REWRITTEN_TEXT");
  assert.notEqual(observedResponse, "PRE_REVIEW_CANDIDATE");
  assert.equal(observedAnchor?.messageId, "message-final");
  assert.equal(observedAnchor?.swipeIndex, 2);
  assert.match(observedAnchor?.sourceContentHash ?? "", /^[a-f0-9]{64}$/);
  assert.equal(savedMessageId, "message-final");
  assert.deepEqual(events, [
    "candidate_persisted",
    "editor_rewrite_persisted",
    "reloaded:message-final",
    `anchor:message-final:2:${observedAnchor?.sourceContentHash}`,
    "tracker:FINAL_REWRITTEN_TEXT",
    "saved:message-final",
  ]);
});

test("rejected ordered review blocks message loading, Runtime anchoring, and tracker execution", async () => {
  let loaded = false;
  let anchored = false;
  let executed = false;
  const outcome = await runPostCanonicalTracking({
    agents: [tracker],
    chatId: "chat-1",
    messageId: "stored-candidate",
    aborted: false,
    canonicalApproved: false,
    baseContext: {} as AgentContext,
    preGenInjections: [],
    parallelResults: [],
    loadMessage: async () => {
      loaded = true;
      return { id: "stored-candidate", chatId: "chat-1", role: "assistant", content: "REJECTED" };
    },
    setRuntimeAnchor: () => { anchored = true; },
    executeTrackers: async () => {
      executed = true;
      return [result];
    },
    saveRun: async () => undefined,
  });

  assert.equal(outcome.status, "skipped");
  assert.equal(outcome.reason, "review_not_approved");
  assert.equal(loaded, false);
  assert.equal(anchored, false);
  assert.equal(executed, false);
});

test("post-canonical tracker fails closed when canonical assistant message is unavailable", async () => {
  for (const message of [
    null,
    { id: "message-1", chatId: "other-chat", role: "assistant", content: "wrong chat" },
    { id: "message-1", chatId: "chat-1", role: "user", content: "wrong role" },
  ]) {
    let anchored = false;
    let executed = false;
    const outcome = await runPostCanonicalTracking({
      agents: [tracker],
      chatId: "chat-1",
      messageId: "message-1",
      aborted: false,
      baseContext: {} as AgentContext,
      preGenInjections: [],
      parallelResults: [],
      loadMessage: async () => message,
      setRuntimeAnchor: () => {
        anchored = true;
      },
      executeTrackers: async () => {
        executed = true;
        return [result];
      },
      saveRun: async () => undefined,
    });

    assert.equal(outcome.status, "skipped");
    assert.equal(outcome.reason, "canonical_message_unavailable");
    assert.equal(anchored, false);
    assert.equal(executed, false);
  }
});
