// The transcript's window buttons share the pager style and drop the muted text colour. Reads component source until
// a test can check them.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const transcriptWindowControlsSource = readFileSync(
  new URL("../../../packages/client/src/components/chat/TranscriptWindowControls.tsx", import.meta.url),
  "utf8",
);
assert.equal(
  transcriptWindowControlsSource.match(/className=\{cn\(HISTORY_PAGER_BUTTON_CLASS, buttonClassName\)\}/gu)?.length,
  3,
);
assert.doesNotMatch(transcriptWindowControlsSource, /text-\[var\(--muted-foreground\)\]/u);
