import assert from "node:assert/strict";
import {
  estimateEnabledStaticPresetTokens,
  estimatePresetSectionTokens,
} from "../../packages/client/src/lib/preset-section-tokens.js";

// The Sections panel must show rough counts on every text row and total only the enabled static ones.
// Markers are assembled per chat, so they report no estimate rather than a false zero, and a disabled
// section keeps its own count while staying out of the aggregate.

const section = (overrides: Record<string, unknown> = {}) => ({
  content: "abcdefghijkl",
  enabled: "true",
  isMarker: "false",
  ...overrides,
});

// Collapsed and expanded rows read the same shared estimator: twelve Latin characters are three tokens.
assert.equal(estimatePresetSectionTokens(section()), 3);
assert.equal(estimatePresetSectionTokens(section({ content: "" })), 0, "an empty static section is a known zero");
assert.equal(
  estimatePresetSectionTokens(section({ content: undefined })),
  0,
  "a section awaiting fetch content estimates zero rather than NaN",
);

// Markers: every marker kind is dynamic, including agent sections whose text lives in the macro.
for (const marker of [
  { type: "character" },
  { type: "persona" },
  { type: "lorebook" },
  { type: "world_info_before" },
  { type: "dialogue_examples" },
  { type: "chat_history" },
  { type: "chat_summary" },
  { type: "agent_data", agentType: "illustrator" },
]) {
  assert.equal(
    estimatePresetSectionTokens(section({ isMarker: true, markerConfig: marker })),
    null,
    `${marker.type} depends on the current chat`,
  );
}

// Both storage spellings of the flags are honoured; a string "false" is not truthy.
assert.equal(estimatePresetSectionTokens(section({ isMarker: false, content: "abcdefgh" })), 2);
assert.equal(estimatePresetSectionTokens(section({ isMarker: "false", content: "abcdefgh" })), 2);

// Aggregate: enabled static content only.
assert.equal(estimateEnabledStaticPresetTokens([]), 0);
assert.equal(
  estimateEnabledStaticPresetTokens([
    section(),
    section({ content: "abcdefgh" }),
    section({ isMarker: true }),
    section({ content: "abcdefghijklmnopqrstuvwx", enabled: false }),
    section({ content: "abcdefghijklmnopqrstuvwx", enabled: "false" }),
  ]),
  5,
  "markers and disabled sections stay out of the enabled static total",
);

// Duplicating or editing a section moves the total by exactly the new section's estimate: the aggregate
// is a pure sum, so a React render recomputing it from the current section list stays correct.
const before = [section(), section({ content: "abcdefgh" })];
assert.equal(estimateEnabledStaticPresetTokens(before), 5);
assert.equal(
  estimateEnabledStaticPresetTokens([...before, section({ content: "abcdefgh" })]),
  7,
  "a duplicated section adds its own estimate",
);
assert.equal(
  estimateEnabledStaticPresetTokens([before[0]!, section({ ...before[1], content: "abcdefghijkl" })]),
  6,
  "editing content recalculates without any cached total",
);

// Reordering cannot change the sum, and disabling the largest section removes only its own estimate.
assert.equal(
  estimateEnabledStaticPresetTokens([section(), section({ content: "abcdefgh" })]),
  estimateEnabledStaticPresetTokens([section({ content: "abcdefgh" }), section()]),
  "order does not matter",
);
assert.equal(
  estimateEnabledStaticPresetTokens([before[0]!, section({ ...before[1], enabled: false })]),
  3,
  "disabling a section drops exactly its share",
);
