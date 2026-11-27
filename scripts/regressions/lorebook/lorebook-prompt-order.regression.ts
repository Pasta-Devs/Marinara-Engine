import assert from "node:assert/strict";
import type { LorebookEntry } from "../../../packages/shared/src/types/lorebook.js";
import {
  compareLorebookEntriesByPromptOrder,
  lorebookPromptPlacement,
} from "../../../packages/shared/src/utils/lorebook-prompt-order.js";
import { lintLorebookEntries } from "../../../packages/shared/src/utils/lorebook-lint.js";
import {
  buildWorldInfoBlocks,
  getDepthInjectedEntries,
  injectAtDepth,
} from "../../../packages/server/src/services/lorebook/prompt-injector.js";

// The entry list's "Prompt order" sort must match where the engine really puts each entry.
const entry = (name: string, position: LorebookEntry["position"], order: number, depth = 4) =>
  ({
    id: name,
    name,
    content: name,
    keys: [`key-${name}`],
    enabled: true,
    constant: true,
    useRegex: false,
    caseSensitive: false,
    position,
    order,
    depth,
    role: "system",
    outletName: position === 7 ? "notes" : "",
  }) as unknown as LorebookEntry;

const entries = [
  entry("template-after-100", 1, 100),
  entry("close-before-400", 0, 400),
  entry("open-before-1", 0, 1),
  entry("depth2-order5", 2, 5, 2),
  entry("depth6-order50", 2, 50, 6),
  entry("depth2-order1", 2, 1, 2),
  entry("outlet-order0", 7, 0),
  entry("after-1", 1, 1),
];

const sorted = [...entries].sort(compareLorebookEntriesByPromptOrder).map((e) => e.name);
assert.deepEqual(sorted, [
  "open-before-1",
  "close-before-400",
  "after-1",
  "template-after-100",
  "depth6-order50",
  "depth2-order1",
  "depth2-order5",
  "outlet-order0",
]);

// The same order as the engine: Before block, After block, then the chat-history insertions top to bottom.
const activated = entries.map((e) => ({ entry: e }) as never);
const blocks = buildWorldInfoBlocks(activated);
const history = Array.from({ length: 8 }, (_, i) => ({ role: "user" as const, content: `m${i}` }));
const withDepth = injectAtDepth(history as never, getDepthInjectedEntries(activated));
const engineOrder = [
  ...blocks.before.split("\n\n"),
  ...blocks.after.split("\n\n"),
  ...withDepth.map((m: { content: string }) => m.content).filter((c: string) => !/^m\d$/.test(c)),
];
assert.deepEqual(
  engineOrder,
  sorted.filter((name) => lorebookPromptPlacement(entries.find((e) => e.name === name)!) !== "outlet"),
);

// Old rows with a negative position count as Before, like the injector's `position <= 0`.
assert.equal(lorebookPromptPlacement({ position: -1 as never }), "before");

// Check lorebook lists issues of one severity in prompt order too.
const issues = lintLorebookEntries([
  { ...entry("template-after-100", 1, 100), content: "  " },
  { ...entry("close-before-400", 0, 400), content: "  " },
]);
assert.deepEqual(
  issues.map((issue) => issue.entryId),
  ["close-before-400", "template-after-100"],
);

console.log("lorebook prompt order: ok");

// Dragging only renumbers Order, so a drag stays among entries at the same prompt spot.
{
  const { clampLorebookEntryMoveToPromptSpot } =
    await import("../../../packages/shared/src/utils/lorebook-prompt-order.js");
  const list = [...entries].sort(compareLorebookEntriesByPromptOrder);
  // close-before-400 (index 1) dropped below the After entries stays last of the Before run.
  assert.equal(clampLorebookEntryMoveToPromptSpot(list, 1, 4), 1);
  // template-after-100 (index 3) dropped at the very top lands first of the After run (index 2).
  assert.equal(clampLorebookEntryMoveToPromptSpot(list, 3, 0), 2);
  // depth6 is alone at its depth: it cannot move.
  assert.equal(clampLorebookEntryMoveToPromptSpot(list, 4, 0), 4);
}
