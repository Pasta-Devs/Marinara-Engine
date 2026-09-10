// Run: pnpm exec tsx scripts/regressions/toast-history.check.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mergeRecentActivity } from "../../packages/client/src/lib/activity-history.ts";
import { captureToastHistory } from "../../packages/client/src/lib/toast-history.ts";

let history = captureToastHistory([], { id: 1, type: "loading", title: "Downloading" }, 100);
history = captureToastHistory(history, { id: 1, type: "success", title: "Downloaded" }, 200);
assert.deepEqual(history, [{ id: 1, kind: "success", title: "Downloaded", occurredAt: 200 }]);

const unchanged = captureToastHistory(history, { id: 1, type: "success", title: "Downloaded" }, 300);
assert.equal(unchanged, history, "an unchanged live toast must not keep refreshing its timestamp");

history = captureToastHistory(
  history,
  { id: 2, type: "error", title: "Unable to save", description: "Try again." },
  300,
);
assert.deepEqual(history[0], {
  id: 2,
  kind: "error",
  title: "Unable to save",
  description: "Try again.",
  occurredAt: 300,
});

assert.equal(captureToastHistory(history, { id: 3, jsx: {} }, 400), history, "custom JSX must remain transient");
assert.equal(
  captureToastHistory(history, { id: 4, title: {} }, 400),
  history,
  "non-text content must remain transient",
);

for (let index = 5; index < 12; index += 1) {
  history = captureToastHistory(history, { id: index, type: "info", title: `Notice ${index}` }, index * 100);
}
assert.equal(history.length, 5);
assert.deepEqual(
  history.map(({ id }) => id),
  [11, 10, 9, 8, 7],
  "history keeps only the five newest notifications",
);

const merged = mergeRecentActivity(
  [
    {
      id: "task-old",
      kind: "generation",
      label: "Generating reply",
      startedAt: 750,
      endedAt: 850,
      outcome: "completed",
    },
    {
      id: "task-new",
      kind: "media",
      label: "Generating image",
      startedAt: 950,
      endedAt: 1_050,
      outcome: "failed",
    },
  ],
  history,
);
assert.equal(merged.length, 5);
assert.equal(merged[0].source, "toast");
assert.equal(merged[0].occurredAt, 1_100);
assert.equal(merged[1].source, "task");
assert.equal(merged.at(-1).occurredAt, 850);

// Capture must live in an always-rendered component. Mission Control moved into a lazily mounted
// Settings tab once, which silently stopped capture until the user opened that tab.
const capturePath = "packages/client/src/components/layout/TopBar.tsx";
assert.match(
  readFileSync(capturePath, "utf8"),
  /useToastHistoryCapture\(\)/,
  `${capturePath} must mount useToastHistoryCapture; a lazily mounted reader captures nothing`,
);

console.log("toast-history self-check passed");
