import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolveChatSummaryTemperatureOptions } from "../../packages/server/src/services/chat-summary/connection-resolution.js";
import { generateMissingConversationSummaries } from "../../packages/server/src/services/conversation/auto-summary.service.js";
import { computeSummaryMessageRange } from "../../packages/server/src/routes/generate/generate-route-utils.js";

assert.deepEqual(
  computeSummaryMessageRange(
    [{ id: "message-1" }, { id: "message-2" }, { id: "message-3" }],
    [{ id: "message-3" }, { id: "message-2" }],
  ),
  { startIndex: 2, endIndex: 3 },
);
assert.equal(computeSummaryMessageRange([{ id: "message-1" }], [{ id: "missing-message" }]), null);

assert.deepEqual(
  resolveChatSummaryTemperatureOptions({
    temperature: 0.42,
    enabledParameters: { temperature: false, topP: false, reasoningEffort: false },
  }),
  {
    temperature: 0.42,
    enabledParameters: { temperature: true, topP: false, reasoningEffort: false },
  },
);
assert.deepEqual(
  resolveChatSummaryTemperatureOptions({
    enabledParameters: { temperature: true, topP: false, reasoningEffort: false },
  }),
  {
    enabledParameters: { temperature: false, topP: false, reasoningEffort: false },
  },
);

const requestedMaxTokens: number[] = [];
const provider = {
  async chatComplete(_messages: unknown, options: { maxTokens?: number }) {
    requestedMaxTokens.push(options.maxTokens ?? 0);
    return {
      content: JSON.stringify({ summary: "A concise day summary.", keyDetails: ["A promise was made."] }),
      toolCalls: [],
      finishReason: "stop",
    };
  },
};

const result = await generateMissingConversationSummaries({
  messages: [
    {
      id: "message-1",
      role: "user",
      content: "I promise to call tomorrow.",
      createdAt: "2026-08-02T12:00:00.000Z",
    },
  ],
  metadata: {},
  provider: provider as never,
  model: "summary-model",
  personaName: "Mari",
  charIdToName: new Map(),
  now: new Date("2026-08-04T12:00:00.000Z"),
  timeZone: "Europe/Warsaw",
  timeoutMs: 50,
  maxTokens: 7777,
});

assert.ok(requestedMaxTokens.length > 0);
assert.equal(requestedMaxTokens.every((value) => value === 7777), true);
assert.equal(result.newlyGeneratedDays["02.08.2026"]?.summary, "A concise day summary.");

const chatsRouteSource = await readFile(
  new URL("../../packages/server/src/routes/chats.routes.ts", import.meta.url),
  "utf8",
);
assert.match(
  chatsRouteSource,
  /backfill-summaries[\s\S]*?resolveChatSummaryConnection\([\s\S]*?maxTokens: clampRoleplaySummaryMaxTokens/u,
  "Conversation backfills should use the selected summary connection and configured output budget",
);
assert.match(
  chatsRouteSource,
  /computeSummaryMessageRange\(allMessages, selectedMessages\)[\s\S]*?rangeStartIndex: selectedRangeStartIndex/u,
  "Manual and backfilled summaries should persist their covered message range",
);

const generateRouteSource = await readFile(
  new URL("../../packages/server/src/routes/generate.routes.ts", import.meta.url),
  "utf8",
);
assert.match(
  generateRouteSource,
  /computeSummaryMessageRange\(freshMessages, selectedMessages\)[\s\S]*?rangeStartIndex: autoRangeStartIndex/u,
  "Automatic summaries should persist their covered message range",
);

const summaryPopoverSource = await readFile(
  new URL("../../packages/client/src/components/chat/SummaryPopover.tsx", import.meta.url),
  "utf8",
);
assert.match(
  summaryPopoverSource,
  /if \(entry\.rangeStartIndex && entry\.rangeEndIndex\)/u,
  "Summary metadata should show ranges for every origin when range metadata exists",
);

process.stdout.write("Conversation summary regression passed.\n");
