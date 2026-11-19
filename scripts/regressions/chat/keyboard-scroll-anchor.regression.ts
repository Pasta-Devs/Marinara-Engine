// When the phone keyboard opens, the transcript keeps the anchor it had before, including a position the reader
// scrolled to. Reads hook source; replacing this needs a browser test.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const visualViewportChatBottomSource = readFileSync(
  new URL("../../../packages/client/src/hooks/use-visual-viewport-chat-bottom.ts", import.meta.url),
  "utf8",
);
assert.match(visualViewportChatBottomSource, /const anchor = pendingAnchor \?\? captureAnchor\(\);/u);
assert.match(
  visualViewportChatBottomSource,
  /scrollElement\.scrollTo\(\{ top: Math\.min\(anchor\.scrollTop, maxScrollTop\), behavior: "auto" \}\);/u,
  "Keyboard opening should restore an intentionally scrolled transcript to its captured position",
);
