// Chat summary entries: creating one, combining an entry's history, compiling entries into the summary, and saving them
// to the chat's metadata.
import assert from "node:assert/strict";
import type { ChatSummaryEntry } from "../../../packages/shared/src/types/chat.js";
import {
  appendChatSummaryEntryToMetadata,
  combineChatSummaryEntryHistory,
  compileChatSummaryEntries,
  createChatSummaryEntry,
} from "../../../packages/shared/src/utils/chat-summary-entries.js";

const summaryCombineNow = "2026-08-06T09:00:00.000Z";
const summaryCombineEntries: ChatSummaryEntry[] = [
  createChatSummaryEntry({
    id: "source-a",
    content: "Source A",
    title: "Source A",
    enabled: true,
    rangeStartIndex: 1,
    rangeEndIndex: 2,
    createdAt: "2026-08-01T09:00:00.000Z",
    updatedAt: "2026-08-01T09:00:00.000Z",
  }),
  createChatSummaryEntry({
    id: "source-b",
    content: "Source B",
    title: "Source B",
    enabled: true,
    rangeStartIndex: 3,
    rangeEndIndex: 4,
    createdAt: "2026-08-02T09:00:00.000Z",
    updatedAt: "2026-08-02T09:00:00.000Z",
  }),
  createChatSummaryEntry({
    id: "untouched",
    content: "Untouched",
    title: "Untouched",
    enabled: true,
    rangeStartIndex: 5,
    rangeEndIndex: 6,
    createdAt: "2026-08-03T09:00:00.000Z",
    updatedAt: "2026-08-03T09:00:00.000Z",
  }),
];
const combinedSummaryEntry = createChatSummaryEntry({
  id: "combined",
  content: "Combined A and B",
  title: "Combined",
  enabled: true,
  rangeStartIndex: 1,
  rangeEndIndex: 4,
  createdAt: summaryCombineEntries[0]!.createdAt,
  updatedAt: summaryCombineNow,
});
const retainedSummaryEntries = combineChatSummaryEntryHistory(
  summaryCombineEntries,
  new Set(["source-a", "source-b"]),
  combinedSummaryEntry,
  summaryCombineNow,
);
assert.deepEqual(
  retainedSummaryEntries.map((entry) => entry.id),
  ["combined", "source-a", "source-b", "untouched"],
  "The combined entry must be inserted at the first selected chronological position",
);
for (const sourceId of ["source-a", "source-b"]) {
  const retainedSource = retainedSummaryEntries.find((entry) => entry.id === sourceId);
  assert.equal(retainedSource?.enabled, false, `${sourceId} must remain as inactive history`);
  assert.equal(retainedSource?.updatedAt, summaryCombineNow, `${sourceId} must record when it was combined`);
}
assert.equal(retainedSummaryEntries.find((entry) => entry.id === "untouched")?.enabled, true);
assert.equal(
  compileChatSummaryEntries(retainedSummaryEntries),
  "Combined A and B\n\nUntouched",
  "Compiled Chat Summary output must exclude deactivated source entries",
);
const secondCombinedSummaryEntry = createChatSummaryEntry({
  id: "combined-again",
  content: "Combined summary of summaries",
  title: "Combined again",
  enabled: true,
  rangeStartIndex: 1,
  rangeEndIndex: 6,
  createdAt: summaryCombineEntries[0]!.createdAt,
  updatedAt: "2026-08-06T10:00:00.000Z",
});
const retainedSecondGenerationEntries = combineChatSummaryEntryHistory(
  retainedSummaryEntries,
  new Set(["combined", "untouched"]),
  secondCombinedSummaryEntry,
  secondCombinedSummaryEntry.updatedAt,
);
assert.deepEqual(
  retainedSecondGenerationEntries.map((entry) => entry.id),
  ["combined-again", "combined", "source-a", "source-b", "untouched"],
  "A summary of summaries must retain both generations of source history",
);
const appendedSummaryResult = appendChatSummaryEntryToMetadata(
  { summaryEntries: retainedSummaryEntries },
  {
    id: "automatic-after-combine",
    content: "Newest automatic summary",
    title: "Newest automatic summary",
    enabled: true,
    origin: "automated",
    rangeStartIndex: 2,
    rangeEndIndex: 3,
    createdAt: "2026-08-06T11:00:00.000Z",
    updatedAt: "2026-08-06T11:00:00.000Z",
  },
);
assert.equal(
  appendedSummaryResult.entries.at(-1)?.id,
  "automatic-after-combine",
  "A newly generated summary must append after the existing user-controlled order even when its source range is earlier",
);
const userReorderedSummaryEntries = [
  appendedSummaryResult.entries.at(-1)!,
  ...appendedSummaryResult.entries.slice(0, -1),
];
assert.equal(
  compileChatSummaryEntries(userReorderedSummaryEntries),
  "Newest automatic summary\n\nCombined A and B\n\nUntouched",
  "Prompt compilation must preserve the summary order chosen by the user",
);
for (const sourceId of ["combined", "source-a", "source-b", "untouched"]) {
  assert.equal(
    retainedSecondGenerationEntries.find((entry) => entry.id === sourceId)?.enabled,
    false,
    `${sourceId} must remain as inactive history after combining summaries again`,
  );
}
