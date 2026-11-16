// Merged group replies: leading message timestamps are stripped, and a reply splits into each speaker's lines.
import assert from "node:assert/strict";
import {
  parseGroupedSpeakerSegments,
  splitGroupedSegmentDisplayLines,
  stripLeadingMessageTimestamps,
} from "../../../packages/shared/src/utils/speaker-segments.js";
import { annotateContentWithReactions } from "../../../packages/server/src/routes/generate/conversation-custom-assets.js";

assert.equal(stripLeadingMessageTimestamps("[11.07 15:53] Character: Hello!"), "Character: Hello!");
assert.equal(stripLeadingMessageTimestamps("[11.07.2026 15:53] Character: Hello!"), "Character: Hello!");
assert.equal(
  stripLeadingMessageTimestamps("We meet at [11.07 15:53] by the station."),
  "We meet at [11.07 15:53] by the station.",
);
const partiallyPrefixedConversationReply = "lol you're such a rebel!!\nPaige: Are you powered by pure caffeine?";
const parsedWithoutAuthor = parseGroupedSpeakerSegments(partiallyPrefixedConversationReply, new Set(["paige"]));
assert.equal(parsedWithoutAuthor?.[0]?.speaker, null);
const parsedWithAuthor = parseGroupedSpeakerSegments(partiallyPrefixedConversationReply, new Set(["paige"]), "Paige");
assert.equal(parsedWithAuthor?.length, 1);
assert.equal(parsedWithAuthor?.[0]?.speaker, "Paige");
assert.deepEqual(parsedWithAuthor?.[0]?.lines, ["lol you're such a rebel!!", "Are you powered by pure caffeine?"]);
const inheritedGroupConversationReply = "Char1: so anyway\ni was thinking about that\nChar2: yeah?";
const inheritedGroupConversationSegments = parseGroupedSpeakerSegments(
  inheritedGroupConversationReply,
  new Set(["char1", "char2"]),
);
assert.deepEqual(inheritedGroupConversationSegments, [
  { speaker: "Char1", lines: ["so anyway\ni was thinking about that"], start: 0, end: 42 },
  { speaker: "Char2", lines: ["yeah?"], start: 43, end: 55 },
]);
assert.deepEqual(splitGroupedSegmentDisplayLines(inheritedGroupConversationSegments![0]!), [
  "so anyway",
  "i was thinking about that",
]);
const newlineAfterSpeakerNameSegments = parseGroupedSpeakerSegments(
  "Char1:\nso anyway\ni was thinking about that\nChar2:\r\nyeah?",
  new Set(["char1", "char2"]),
);
assert.deepEqual(
  newlineAfterSpeakerNameSegments?.map(({ speaker, lines }) => ({ speaker, lines })),
  [
    { speaker: "Char1", lines: ["so anyway\ni was thinking about that"] },
    { speaker: "Char2", lines: ["yeah?"] },
  ],
  "Grouped Conversation parsing must tolerate a newline after a recognized speaker name",
);
assert.deepEqual(
  splitGroupedSegmentDisplayLines({
    ...inheritedGroupConversationSegments![0]!,
    lines: ["so anyway\r\nstill thinking"],
  }),
  ["so anyway", "still thinking"],
);
const annotatedPartiallyPrefixedReply = annotateContentWithReactions(
  partiallyPrefixedConversationReply,
  partiallyPrefixedConversationReply,
  [{ emoji: "🔥", by: ["user"], segment: 0, segmentSpeaker: "Paige" }],
  new Map([["paige", "Paige"]]),
  (reactorId) => (reactorId === "user" ? "Mari" : reactorId),
  "Paige",
);
assert.equal(annotatedPartiallyPrefixedReply, `${partiallyPrefixedConversationReply}\n[Mari reacted with 🔥]`);
