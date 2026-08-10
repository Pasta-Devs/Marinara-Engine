import assert from "node:assert/strict";
import {
  getTranscriptRenderWindow,
  getTranscriptWindowStartForIndex,
  TRANSCRIPT_RENDER_WINDOW_STEP,
} from "../../packages/client/src/lib/transcript-render-window.js";

// The surfaces mount at most 80 messages. A /goto or search jump to a message
// outside that window used to be a silent no-op: the data paginated in, but the
// target never rendered, so the scroll had no element to find. These checks pin
// the window math that puts the target on screen.

const MAX_MOUNTED = 80;
const messages = Array.from({ length: 219 }, (_, index) => `m${index}`);

// ── A chat shorter than the window is never windowed ──────────────────
assert.equal(getTranscriptWindowStartForIndex(3, 40, 0), null, "short chats need no window move");
assert.equal(getTranscriptRenderWindow(messages.slice(0, 40)).isWindowed, false);

// ── A target already mounted must not move the window ─────────────────
// Default window on a 219-message chat starts at 139 and covers 139..218.
const latestWindow = getTranscriptRenderWindow(messages);
assert.equal(latestWindow.startIndex, 139);
assert.equal(latestWindow.messages?.length, MAX_MOUNTED);
assert.equal(
  getTranscriptWindowStartForIndex(200, messages.length, latestWindow.startIndex),
  null,
  "a target inside the mounted window must not move it",
);
assert.equal(
  getTranscriptWindowStartForIndex(139, messages.length, latestWindow.startIndex),
  null,
  "the first mounted index is inside the window",
);
assert.equal(
  getTranscriptWindowStartForIndex(218, messages.length, latestWindow.startIndex),
  null,
  "the last mounted index is inside the window",
);

// ── The regression: an older target moves the window and lands mounted ─
// Message 28 (1-based) is index 27 — far outside the default window.
const movedStart = getTranscriptWindowStartForIndex(27, messages.length, latestWindow.startIndex);
assert.notEqual(movedStart, null, "an unmounted target must move the window");
assert.equal(movedStart, 0, "centring index 27 clamps to the start of the log");

const movedWindow = getTranscriptRenderWindow(messages, { startIndex: movedStart });
assert.ok(
  27 >= movedWindow.startIndex && 27 < movedWindow.endIndex,
  "the target must be inside the moved window, or the jump has nothing to scroll to",
);

// A mid-log target centres rather than clamping.
const midStart = getTranscriptWindowStartForIndex(120, messages.length, latestWindow.startIndex);
assert.equal(midStart, 120 - MAX_MOUNTED / 2, "a mid-log target centres in the window");
const midWindow = getTranscriptRenderWindow(messages, { startIndex: midStart });
assert.ok(120 >= midWindow.startIndex && 120 < midWindow.endIndex, "mid-log target is mounted");

// ── The newest messages clamp to the last full window, never past it ───
const nearEndStart = getTranscriptWindowStartForIndex(0, messages.length, 0);
assert.equal(nearEndStart, null, "index 0 with the window already at 0 stays put");
const fromOldest = getTranscriptWindowStartForIndex(218, messages.length, 0);
assert.equal(fromOldest, latestWindow.latestStartIndex, "jumping forward clamps to the newest window");

// ── Out-of-range targets are refused rather than producing a bad window ─
assert.equal(getTranscriptWindowStartForIndex(-1, messages.length, 139), null);
assert.equal(getTranscriptWindowStartForIndex(219, messages.length, 139), null);

// ── The step control still walks the window without skipping messages ──
assert.equal(TRANSCRIPT_RENDER_WINDOW_STEP, 40);
assert.ok(
  TRANSCRIPT_RENDER_WINDOW_STEP <= MAX_MOUNTED,
  "a step larger than the window would skip messages entirely",
);

console.info("Transcript render window regression checks passed.");
