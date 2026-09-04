import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolveChatSummaryTemperatureOptions } from "../../packages/server/src/services/chat-summary/connection-resolution.js";
import { generateMissingConversationSummaries } from "../../packages/server/src/services/conversation/auto-summary.service.js";
import { computeSummaryMessageRange } from "../../packages/server/src/routes/generate/generate-route-utils.js";
import {
  createNextChatSummaryBatchRange,
  inspectChatSummaryBatchRanges,
  orderChatSummaryBatchEntries,
} from "../../packages/client/src/lib/chat-summary-batch.ts";

assert.deepEqual(
  computeSummaryMessageRange(
    [{ id: "message-1" }, { id: "message-2" }, { id: "message-3" }],
    [{ id: "message-3" }, { id: "message-2" }],
  ),
  { startIndex: 2, endIndex: 3 },
);
assert.equal(computeSummaryMessageRange([{ id: "message-1" }], [{ id: "missing-message" }]), null);

const inspectedBatchRanges = inspectChatSummaryBatchRanges(
  [
    { id: "first", start: "50", end: "1" },
    { id: "second", start: "40", end: "60" },
    { id: "too-large", start: "1", end: "501" },
    { id: "missing", start: "", end: "4" },
    { id: "non-integer", start: "2.5", end: "4" },
    { id: "outside", start: "601", end: "602" },
  ],
  600,
);
assert.deepEqual(
  inspectedBatchRanges
    .slice(0, 2)
    .map((range) => ({ start: range.normalizedStart, end: range.normalizedEnd, overlaps: range.overlaps })),
  [
    { start: 1, end: 50, overlaps: true },
    { start: 40, end: 60, overlaps: true },
  ],
);
assert.equal(inspectedBatchRanges[2]?.error, "tooLarge");
assert.equal(inspectedBatchRanges[3]?.error, "missing");
assert.equal(inspectedBatchRanges[4]?.error, "invalid");
assert.equal(inspectedBatchRanges[5]?.error, "outside");
assert.deepEqual(createNextChatSummaryBatchRange(inspectedBatchRanges[0]!, 60), { start: "51", end: "60" });
assert.equal(createNextChatSummaryBatchRange(inspectedBatchRanges[0]!, 50), null);
const clippedRange = inspectChatSummaryBatchRanges([{ id: "clipped", start: "1", end: "500" }], 520)[0]!;
assert.deepEqual(createNextChatSummaryBatchRange(clippedRange, 520), { start: "501", end: "520" });
assert.deepEqual(
  orderChatSummaryBatchEntries(
    ["old-a", "new-late", "old-b", "new-early"],
    [
      { id: "new-late", start: 51, end: 60 },
      { id: "new-early", start: 1, end: 50 },
    ],
  ),
  ["old-a", "old-b", "new-early", "new-late"],
);
assert.deepEqual(
  orderChatSummaryBatchEntries(
    ["same-b", "same-a"],
    [
      { id: "same-b", start: 1, end: 10 },
      { id: "same-a", start: 1, end: 10 },
    ],
  ),
  ["same-a", "same-b"],
);

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
assert.equal(
  requestedMaxTokens.every((value) => value === 7777),
  true,
);
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
assert.match(summaryPopoverSource, /signal: controller\.signal/u, "Batch summary requests should be cancellable");
assert.match(
  summaryPopoverSource,
  /handleClearCompletedRanges[\s\S]*?status !== "success"/u,
  "Completed batch ranges should be removable without clearing retryable ranges",
);
assert.match(
  summaryPopoverSource,
  /grid-cols-1 gap-1\.5 sm:grid-cols-2/u,
  "Batch ranges should use one column on mobile and two on desktop",
);
assert.match(
  summaryPopoverSource,
  /remaining\.length > 0[\s\S]*?status: "pending"/u,
  "Clearing the final completed range should leave an editable pending range",
);
assert.match(
  summaryPopoverSource,
  /handleClearExtraRanges[\s\S]*?return \[kept\]/u,
  "Clearing extra batch ranges should retain one range",
);
assert.match(
  summaryPopoverSource,
  /text-emerald-600[\s\S]*?batchClearCompleted/u,
  "Completed controls should be green",
);
assert.match(
  summaryPopoverSource,
  /w-\[4\.5rem\][\s\S]*?aria-label=.*batchRangeFrom/u,
  "Range inputs should fit four digits",
);
assert.match(summaryPopoverSource, /<span[^>]*>\s*-\s*<\/span>/u, "Range inputs should show a separator");
assert.match(
  summaryPopoverSource,
  /batchErrorInfoId[\s\S]*?role="tooltip"[\s\S]*?range\.error/u,
  "Failed range details should be available through an info popover",
);
assert.match(
  summaryPopoverSource,
  /batchRanges\.length > 1[\s\S]*?handleClearExtraRanges[\s\S]*?batchClear/u,
  "The clear-all action should remain available even without completed ranges",
);
assert.match(summaryPopoverSource, /batchMessageTotal[\s\S]*?normalizedEnd - range\.normalizedStart \+ 1/u);
assert.match(summaryPopoverSource, /chat\.summary\.source\.batchRanges/u);
assert.match(summaryPopoverSource, /chat\.summary\.source\.batchMessages/u);
assert.match(
  summaryPopoverSource,
  /grid-cols-\[1\.25rem_4\.5rem_minmax\(0,1fr\)_4\.5rem_1rem_1rem\].*?gap-0\.5/u,
  "Range controls should keep the number left and the separator centered within the card",
);
assert.match(
  summaryPopoverSource,
  /range\.status === "pending" \|\| range\.status === "cancelled"[\s\S]*?h-4 w-4[\s\S]*?<button/u,
  "Pending ranges should reserve the status column so the remove button stays inside the card",
);
assert.match(
  summaryPopoverSource,
  /className="rounded-full p-0 text-\[var\(--destructive\)\]/u,
  "The failed status control should fit inside its compact status column",
);
assert.doesNotMatch(
  summaryPopoverSource,
  /batchRangeCount.*batchRanges\.length/u,
  "The footer should not display a separate batch range count",
);
assert.match(
  summaryPopoverSource,
  /onClick=\{handleAddBatchRange\}[\s\S]*?disabled=\{isBatchGenerating \|\| !nextBatchRange\}/u,
  "Batch range editing should lock while a run is active",
);
assert.match(
  summaryPopoverSource,
  /if \(batchRun !== null \|\| batchAbortControllerRef\.current\)[\s\S]*?batchAbortControllerRef\.current\?\.abort\(\)[\s\S]*?onClose\(\)/u,
  "Closing during a batch should abort and discard active work",
);
assert.match(
  chatsRouteSource,
  /provider\.chatComplete\([\s\S]*?signal,[\s\S]*?throwIfChatSummaryAborted\(signal\)/u,
  "Summary generation should propagate disconnect cancellation and check it before persistence",
);

process.stdout.write("Conversation summary regression passed.\n");
