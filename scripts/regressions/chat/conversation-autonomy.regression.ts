// Conversation mode's autonomous messages: which user statuses hold them back, each character's daily cap and budget,
// the order and remaining delay of the characters who answer, which chats the background poller picks, and the
// weekly routine summary's token budget.
import assert from "node:assert/strict";
import {
  orderConversationRespondersByDelay,
  remainingConversationPresenceDelay,
} from "../../../packages/server/src/routes/generate/conversation-presence-runtime.js";
import {
  shouldSuppressAutonomousMessages,
  toAutonomousPresenceStatus,
} from "../../../packages/client/src/lib/user-status.js";
import {
  checkAutonomousMessaging,
  clearChatActivity,
  dailyCapForCharacter,
  initializeActivityFromMessages,
  isAutonomousDailyBudgetExhausted,
} from "../../../packages/server/src/services/conversation/autonomous.service.js";
import {
  type WeekSchedule,
  generateScheduleRoutineSummary,
} from "../../../packages/server/src/services/conversation/schedule.service.js";
import type {
  BaseLLMProvider,
  ChatCompletionResult,
  ChatMessage,
  ChatOptions,
} from "../../../packages/server/src/services/llm/base-provider.js";

assert.equal(toAutonomousPresenceStatus("active"), "active");
assert.equal(toAutonomousPresenceStatus("dnd"), "dnd");
assert.equal(shouldSuppressAutonomousMessages("active"), false);
assert.equal(shouldSuppressAutonomousMessages("dnd"), true);
const autonomousSchedule = (talkativeness: number, cap: number): WeekSchedule => ({
  weekStart: "2026-07-13",
  days: {},
  inactivityThresholdMinutes: 1,
  autonomousDailyCapOverride: cap,
  talkativeness,
});
assert.equal(
  dailyCapForCharacter(undefined, { autonomousDailyCapOverride: 75 }),
  75,
  "chat-level autonomous ceilings should accept numeric overrides above the former limit",
);
assert.equal(
  dailyCapForCharacter(autonomousSchedule(90, 8), { autonomousDailyCapOverride: 75 }),
  8,
  "per-character safety limits should still be able to lower a numeric chat ceiling",
);
const autonomousChatId = "regression-autonomous-candidates";
assert.equal(
  dailyCapForCharacter(autonomousSchedule(90, 1000)),
  1000,
  "custom character limits are not capped at eight",
);
assert.equal(
  dailyCapForCharacter(autonomousSchedule(90, 1000), { autonomousDailyCapOverride: 75 }),
  75,
  "the chat-wide safety cap still limits a larger custom character cap",
);
initializeActivityFromMessages(autonomousChatId, [
  { role: "user", createdAt: new Date(Date.now() - 5 * 60_000).toISOString() },
]);
const autonomousCandidates = checkAutonomousMessaging(
  autonomousChatId,
  {
    capped: autonomousSchedule(90, 1),
    fallback: autonomousSchedule(70, 3),
  },
  true,
);
assert.deepEqual(autonomousCandidates.characterIds, ["capped", "fallback"]);
const today = new Date();
const dateKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
assert.equal(
  isAutonomousDailyBudgetExhausted("capped", autonomousSchedule(90, 1), {
    autonomousDailyBudget: { date: dateKey, counts: { capped: 1 } },
  }),
  true,
);
assert.equal(
  isAutonomousDailyBudgetExhausted("fallback", autonomousSchedule(70, 3), {
    autonomousDailyBudget: { date: dateKey, counts: { fallback: 1 } },
  }),
  false,
);
assert.equal(
  isAutonomousDailyBudgetExhausted("third-character", autonomousSchedule(70, 2), {
    groupChatMode: "individual",
    autonomousDailyBudget: { date: dateKey, counts: { tartaglia: 1, dottore: 1 } },
  }),
  true,
  "individual Conversation groups should share one daily check-in count across their characters",
);
clearChatActivity(autonomousChatId);
const responderDelayOrder = orderConversationRespondersByDelay(
  ["away", "active", "busy"],
  new Map([
    ["away", { delayMs: 120_000, status: "idle" }],
    ["active", { delayMs: 0, status: "online" }],
    ["busy", { delayMs: 240_000, status: "dnd" }],
  ]),
);
assert.deepEqual(
  responderDelayOrder,
  ["active", "away", "busy"],
  "individual Conversation responders should run in availability order without changing equal-delay order",
);
assert.equal(remainingConversationPresenceDelay(120_000, 1_000, 31_000), 90_000);
assert.equal(remainingConversationPresenceDelay(120_000, 1_000, 151_000), 0);

async function captureRoutineSummaryOptions(maxTokensOverrideValue: number | null): Promise<ChatOptions> {
  let capturedOptions: ChatOptions | null = null;
  const provider = {
    maxTokensOverrideValue,
    async chatComplete(_messages: ChatMessage[], options: ChatOptions): Promise<ChatCompletionResult> {
      capturedOptions = options;
      return { content: "Usually available in the evenings.", toolCalls: [], finishReason: "stop" };
    },
  } as unknown as BaseLLMProvider;

  await generateScheduleRoutineSummary(provider, "reasoning-model", "Routine Tester", {
    weekStart: "2026-07-13",
    days: {},
    inactivityThresholdMinutes: 60,
    autonomousDailyCapOverride: 3,
    talkativeness: 50,
  });

  assert.ok(capturedOptions);
  return capturedOptions;
}
for (const [override, expectedMaxTokens] of [
  [null, 8192],
  [16_384, 16_384],
  [4096, 4096],
] as const) {
  const options = await captureRoutineSummaryOptions(override);
  assert.equal(options.maxTokens, expectedMaxTokens);
  assert.equal(options.reasoningEffort, "low");
}
{
  // #4704: the background-autonomous poller's server-side candidate filter
  // must mirror the legacy client filter exactly (conversation mode with
  // autonomousMessages enabled, excluding the Professor Mari home assistant;
  // bad or missing metadata disqualifies).
  const { isBackgroundAutonomousCandidate } =
    await import("../../../packages/server/src/services/conversation/autonomous-candidates.js");
  const meta = (extra: Record<string, unknown>) => JSON.stringify({ autonomousMessages: true, ...extra });
  assert.equal(isBackgroundAutonomousCandidate({ mode: "conversation", metadata: meta({}) }), true);
  assert.equal(
    isBackgroundAutonomousCandidate({ mode: "conversation", metadata: { autonomousMessages: true } }),
    true,
    "object metadata accepted",
  );
  assert.equal(
    isBackgroundAutonomousCandidate({ mode: "roleplay", metadata: meta({}) }),
    false,
    "non-conversation excluded",
  );
  assert.equal(
    isBackgroundAutonomousCandidate({ mode: "conversation", metadata: meta({ internalAssistant: "professor-mari" }) }),
    false,
    "Professor Mari home chat excluded",
  );
  assert.equal(
    isBackgroundAutonomousCandidate({ mode: "conversation", metadata: JSON.stringify({ autonomousMessages: false }) }),
    false,
    "autonomous disabled excluded",
  );
  assert.equal(
    isBackgroundAutonomousCandidate({ mode: "conversation", metadata: "{not json" }),
    false,
    "unparseable metadata excluded",
  );
  assert.equal(isBackgroundAutonomousCandidate({ mode: "conversation" }), false, "missing metadata excluded");

  // The candidates route excludes EMPTIED Roleplay DM threads (the legacy poll
  // ran the DM cleanup as a GET /chats side effect); the marker expression must
  // stay in sync with cleanupEmptyRoleplayDmChats.
  const { hasRoleplayDmThreadMarkers } =
    await import("../../../packages/server/src/services/conversation/autonomous-candidates.js");
  assert.equal(hasRoleplayDmThreadMarkers({ roleplayDmThread: true }), true);
  assert.equal(hasRoleplayDmThreadMarkers({ dmOriginChatId: "chat-1" }), true);
  assert.equal(hasRoleplayDmThreadMarkers({ roleplayDmThread: false }), false);
  assert.equal(hasRoleplayDmThreadMarkers({ dmOriginChatId: 42 }), false, "non-string origin id is not a marker");
  assert.equal(hasRoleplayDmThreadMarkers({}), false);
}
