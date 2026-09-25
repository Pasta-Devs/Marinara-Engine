import assert from "node:assert/strict";
import {
  DEFAULT_MAX_MOUNTED_TRANSCRIPT_MESSAGES,
  getTranscriptRenderWindow,
  resolveTranscriptRenderWindowSize,
} from "../../packages/client/src/lib/transcript-render-window";

// #5789: the transcript render window must honor "Messages per page".
assert.equal(
  resolveTranscriptRenderWindowSize(20),
  DEFAULT_MAX_MOUNTED_TRANSCRIPT_MESSAGES,
  "page sizes below the default window keep the default render window",
);
assert.equal(resolveTranscriptRenderWindowSize(80), 80, "a page size equal to the default keeps the default window");
assert.equal(resolveTranscriptRenderWindowSize(100), 100, "a page size above the default widens the render window");
assert.equal(resolveTranscriptRenderWindowSize(500), 500, "the maximum page size widens the render window");
assert.equal(resolveTranscriptRenderWindowSize(0), null, "0 (load all messages) disables the render window");
assert.equal(resolveTranscriptRenderWindowSize(-5), null, "negative page sizes are treated as load all");
assert.equal(
  resolveTranscriptRenderWindowSize(Number.NaN),
  DEFAULT_MAX_MOUNTED_TRANSCRIPT_MESSAGES,
  "an invalid page size falls back to the default window",
);
assert.equal(
  resolveTranscriptRenderWindowSize(undefined),
  DEFAULT_MAX_MOUNTED_TRANSCRIPT_MESSAGES,
  "a missing page size falls back to the default window",
);

const messages = Array.from({ length: 120 }, (_, index) => ({ id: `m${index + 1}` }));

const defaultWindow = getTranscriptRenderWindow(messages, {});
assert.equal(defaultWindow.messages?.length, DEFAULT_MAX_MOUNTED_TRANSCRIPT_MESSAGES, "default window mounts 80");
assert.equal(defaultWindow.hiddenBeforeCount, 40, "default window hides the oldest 40 of 120");
assert.equal(defaultWindow.isWindowed, true, "default window reports itself as windowed");

const hundredWindow = getTranscriptRenderWindow(messages, {
  maxMountedMessages: resolveTranscriptRenderWindowSize(100),
});
assert.equal(hundredWindow.messages?.length, 100, "Messages per page = 100 mounts 100 loaded messages");
assert.equal(hundredWindow.hiddenBeforeCount, 20, "Messages per page = 100 hides only the oldest 20 of 120");
assert.equal(hundredWindow.messages?.[0]?.id, "m21", "the window ends at the newest message");

const allWindow = getTranscriptRenderWindow(messages, {
  maxMountedMessages: resolveTranscriptRenderWindowSize(0),
});
assert.equal(allWindow.messages?.length, 120, "Messages per page = 0 mounts every loaded message");
assert.equal(allWindow.hiddenBeforeCount, 0, "Messages per page = 0 hides nothing before");
assert.equal(allWindow.hiddenAfterCount, 0, "Messages per page = 0 hides nothing after");
assert.equal(allWindow.isWindowed, false, "an unbounded window is not windowed");
assert.equal(allWindow.latestStartIndex, 0, "an unbounded window starts at the first loaded message");

const allWindowWithStart = getTranscriptRenderWindow(messages, { maxMountedMessages: null, startIndex: 50 });
assert.equal(allWindowWithStart.startIndex, 0, "a goto request cannot scroll an unbounded window past its start");
assert.equal(allWindowWithStart.messages?.length, 120, "a goto request keeps every message mounted");

const emptyUnbounded = getTranscriptRenderWindow([], { maxMountedMessages: null });
assert.equal(emptyUnbounded.messages?.length, 0, "an empty unbounded window is empty");
assert.equal(emptyUnbounded.isWindowed, false, "an empty unbounded window is not windowed");

const undefinedUnbounded = getTranscriptRenderWindow(undefined, { maxMountedMessages: null });
assert.equal(undefinedUnbounded.messages, undefined, "an unbounded window passes through missing messages");

const explicitZero = getTranscriptRenderWindow(messages, { maxMountedMessages: 0 });
assert.equal(explicitZero.messages?.length, 1, "an explicit 0 cap still mounts a single message (legacy guard)");

console.log("transcript-render-window regression passed");
