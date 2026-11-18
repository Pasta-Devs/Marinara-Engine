// Control windows and phone sheets: a desktop window keeps its set height, a phone sheet for content that scrolls
// itself gets a bounded height, and the Session window leaves scrolling to the Game Journal inside it. Reads component
// source; replacing these needs browser tests.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// #3624: the Session window embeds the Game Journal, whose tabs scroll only inside a bounded height. The old
// popover's fixed height cap moved to the control windows: a computer's window has a set height, and a phone's
// sheet for content that scrolls itself is pinned top and bottom.
const chatControlWindowSource = readFileSync(
  new URL("../../../packages/client/src/components/chat/ChatControlWindow.tsx", import.meta.url),
  "utf8",
);
const floatingWindowSource = readFileSync(
  new URL("../../../packages/client/src/components/ui/FloatingWindow.tsx", import.meta.url),
  "utf8",
);
assert.match(floatingWindowSource, /height: geometry\.height/u, "A computer's control window must have a set height");
assert.match(
  chatControlWindowSource,
  /sheetClassName=\{cn\(PHONE_SHEET_CLASS, !scroll && PHONE_FULL_SHEET_CLASS\)\}/u,
  "A phone sheet whose content scrolls itself must get a bounded height",
);
assert.match(
  floatingWindowSource,
  /export const PHONE_SHEET_CLASS =\s*"fixed[^"]*top-\[[^"]*max-h-\[[^"]*";\s*export const PHONE_FULL_SHEET_CLASS =\s*"bottom-\[/u,
  "Phone sheets must stay on screen, and the full-height one must pin its bottom",
);
