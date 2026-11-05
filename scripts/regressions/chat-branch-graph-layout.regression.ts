import assert from "node:assert/strict";
import type { ChatBranchGraphEntry } from "@marinara-engine/shared";
import { buildChatBranchRows, type BranchTreeChat } from "../../packages/client/src/lib/chat-branch-tree.js";
import {
  laneSpansGap,
  layoutChatBranchGraph,
  type BranchGraphSpan,
} from "../../packages/client/src/lib/chat-branch-graph-layout.js";

function chat(id: string, createdAt: string, parent?: string): BranchTreeChat {
  return { id, createdAt, metadata: parent ? { branchParentChatId: parent } : {} };
}

function entry(
  chatId: string,
  messageCount: number,
  forkIndex: number | null,
  parentForkIndex: number | null = forkIndex,
): ChatBranchGraphEntry {
  const own = messageCount - (forkIndex === null ? 0 : forkIndex + 1);
  return {
    chatId,
    forkIndex,
    parentForkIndex,
    messageCount,
    roles: "ua".repeat(own).slice(0, own),
    fork: null,
    tip: null,
  };
}

function layout(
  chats: BranchTreeChat[],
  entries: ChatBranchGraphEntry[],
  expanded: readonly BranchGraphSpan[] | "all" = [],
) {
  return layoutChatBranchGraph(
    buildChatBranchRows(chats),
    new Map(entries.map((item) => [item.chatId, item])),
    expanded,
  );
}

// A root with 300 messages, a branch at message 150 and a branch of that branch at its own tip.
const root = chat("root", "2026-10-01T00:00:00.000Z");
const branch = chat("branch", "2026-10-02T00:00:00.000Z", "root");
const nested = chat("nested", "2026-10-03T00:00:00.000Z", "branch");
const legacy = chat("legacy", "2026-10-04T00:00:00.000Z");
const entries = [entry("root", 300, null), entry("branch", 160, 150), entry("nested", 165, 159)];

const collapsed = layout([root, branch, nested], entries);
assert.deepEqual(
  collapsed.lanes.map((lane) => [lane.chat.id, lane.depth, lane.anchorLane, lane.forkAt, lane.start, lane.tip]),
  [
    ["root", 0, null, null, 0, 299],
    ["branch", 1, 0, 150, 151, 159],
    ["nested", 2, 1, 159, 160, 164],
  ],
);
assert.ok(collapsed.lanes.every((lane) => lane.lineageKnown));
assert.equal(collapsed.lanes[1]!.roles.length, collapsed.lanes[1]!.tip - collapsed.lanes[1]!.start + 1);

// Long runs collapse on the shared axis; forks, starts and tips stay visible with three messages of context.
assert.deepEqual(collapsed.gaps, [
  { from: 4, to: 146 },
  { from: 168, to: 295 },
]);
assert.ok(collapsed.columns.length < 40, `${collapsed.columns.length} columns for 300 messages`);
assert.equal(collapsed.xOf(100), collapsed.xOf(4), "a hidden message sits on its run's pill");
assert.ok(collapsed.xOf(150) < collapsed.xOf(151), "the fork sits left of the branch's first message");
assert.equal(laneSpansGap(collapsed.lanes[0]!, collapsed.gaps[0]!), true);
assert.equal(laneSpansGap(collapsed.lanes[1]!, collapsed.gaps[0]!), false, "a branch never draws its parent's run");

// Expanding one run widens only that part; expanding everything leaves no pills.
const oneOpen = layout([root, branch, nested], entries, [{ from: 4, to: 146 }]);
assert.deepEqual(oneOpen.gaps, [{ from: 168, to: 295 }]);
assert.ok(oneOpen.width > collapsed.width);
// A new branch forking inside an opened run cuts it in two; both halves stay open.
const cut = chat("cut", "2026-10-08T00:00:00.000Z", "root");
const cutOpen = layout([root, branch, nested, cut], [...entries, entry("cut", 80, 75)], [{ from: 4, to: 146 }]);
assert.deepEqual(cutOpen.gaps, [{ from: 168, to: 295 }]);
const allOpen = layout([root, branch, nested], entries, "all");
assert.equal(allOpen.gaps.length, 0);
assert.equal(allOpen.columns.length, 300);

// Given the window's room, the shortest runs unfold first, as many as fit, and the dots spread out.
const fitted = (width: number) =>
  layoutChatBranchGraph(
    buildChatBranchRows([root, branch, nested]),
    new Map(entries.map((item) => [item.chatId, item])),
    [],
    { width, height: 200 },
  );
assert.deepEqual(fitted(300).gaps, collapsed.gaps, "a narrow window folds what it always did");
assert.equal(fitted(300).width, collapsed.width);
assert.equal(fitted(300).scale, 0.75, "a graph far too wide shrinks only so far, then scrolls");
assert.ok(fitted(300).width * 0.75 > 300);
const snug = fitted(Math.round(collapsed.width * 0.9));
assert.ok(
  snug.scale < 1 && snug.width * snug.scale <= Math.round(collapsed.width * 0.9),
  "a little too wide shrinks to fit",
);
assert.deepEqual(fitted(3000).gaps, [{ from: 4, to: 146 }], "the 128-message run opens before the 143 one");
const wide = fitted(3000);
assert.ok(wide.width * wide.scale <= 3000);
assert.ok((wide.xOf(170) - wide.xOf(169)) * wide.scale > 16, "left-over room spreads the dots");
assert.equal(fitted(6000).gaps.length, 0);
assert.ok(
  wide.height * wide.scale <= 200 && wide.height * wide.scale > 200 - 3 * wide.scale,
  "the lanes share all the height",
);
assert.ok(snug.height * snug.scale > 200 - 3 * snug.scale, "a shrunk graph still fills the height");
const roomy = layoutChatBranchGraph(
  buildChatBranchRows([root, branch]),
  new Map([entry("root", 5, null), entry("branch", 5, 4)].map((item) => [item.chatId, item])),
  [],
  { width: 1000, height: 400 },
);
assert.equal(roomy.scale, 2, "a small graph zooms in, up to twice its size");
assert.equal(roomy.xOf(1) - roomy.xOf(0), 48, "then its dots spread out, up to a limit");
assert.equal(roomy.laneHeight, 100, "its two lanes share all 400px at twice their size");
assert.ok(roomy.width * roomy.scale <= 1000 && roomy.height * roomy.scale <= 400);

// A fork inside history its parent copied is drawn from the lane that actually holds the message.
const early = chat("early", "2026-10-05T00:00:00.000Z", "branch");
const withEarly = layout(
  [root, branch, early],
  [entry("root", 300, null), entry("branch", 160, 150), entry("early", 40, 30)],
);
const earlyLane = withEarly.lanes.find((lane) => lane.chat.id === "early")!;
assert.equal(earlyLane.anchorLane, 0, "message 30 lives on the root's lane, not the branch's");
assert.equal(earlyLane.forkAt, 30);

// Older branches with no lineage, and branches whose parent is gone, hang off the top chat, dashed.
const orphan = chat("orphan", "2026-10-06T00:00:00.000Z", "deleted-parent");
const guessed = layout(
  [root, legacy, orphan],
  [entry("root", 20, null), entry("legacy", 12, null), entry("orphan", 15, 9, null)],
);
const legacyLane = guessed.lanes.find((lane) => lane.chat.id === "legacy")!;
assert.deepEqual(
  [legacyLane.anchorLane, legacyLane.forkAt, legacyLane.start, legacyLane.lineageKnown],
  [0, -1, 0, false],
);
assert.equal(legacyLane.roles.length, 12, "an unknown fork means the whole transcript is the lane's own");
const orphanLane = guessed.lanes.find((lane) => lane.chat.id === "orphan")!;
assert.deepEqual(
  [orphanLane.anchorLane, orphanLane.forkAt, orphanLane.start, orphanLane.lineageKnown],
  [0, 9, 10, false],
);
assert.ok(guessed.xOf(-1) < guessed.xOf(0), "a start column exists for forks before message 1");

// A top chat whose own parent left the group still draws its whole transcript, with the copied part unknown.
const adopted = layout([chat("adopted", "2026-10-07T00:00:00.000Z", "gone")], [entry("adopted", 8, 4)]);
assert.equal(adopted.lanes[0]!.roles, "?????uau");
assert.equal(adopted.lanes[0]!.roles.length, 8);
assert.deepEqual([adopted.lanes[0]!.anchorLane, adopted.lanes[0]!.forkAt], [null, 4], "its fork is still recorded");

// A delete above the fork in either chat shifts one copy of it; the branch's own copy places it, dashed.
const shifted = layout([root, branch], [entry("root", 300, null), entry("branch", 160, 150, 147)]);
assert.deepEqual(
  [shifted.lanes[1]!.forkAt, shifted.lanes[1]!.start, shifted.lanes[1]!.lineageKnown],
  [150, 151, false],
);

// A branch made at its parent's tip, with nothing of its own yet, still gets a lane and a column.
const fresh = layout([root, branch], [entry("root", 5, null), entry("branch", 5, 4)]);
assert.deepEqual([fresh.lanes[1]!.start, fresh.lanes[1]!.tip, fresh.lanes[1]!.roles], [5, 4, ""]);
assert.ok(fresh.xOf(5) > fresh.xOf(4));

console.info("Chat branch graph layout regression passed");
