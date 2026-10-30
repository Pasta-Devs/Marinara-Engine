import assert from "node:assert/strict";
import {
  buildChatBranchRows,
  hasChatBranchLineage,
  type BranchTreeChat,
} from "../../packages/client/src/lib/chat-branch-tree.js";

function chat(
  id: string,
  parent?: string | null,
  createdAt = `2026-10-01T00:00:0${id.length % 10}.000Z`,
): BranchTreeChat {
  return {
    id,
    createdAt,
    metadata: parent ? { branchName: "New Branch", branchParentChatId: parent } : {},
  };
}

function shape(rows: ReturnType<typeof buildChatBranchRows>) {
  return rows.map((row) => `${row.chat.id}:${row.depth}`);
}

// A chat alone in its group is just itself.
assert.deepEqual(shape(buildChatBranchRows([])), []);
assert.deepEqual(shape(buildChatBranchRows([chat("root")])), ["root:0"]);

// Nested lineage: every branch sits under its immediate source, depth growing one level per hop —
// this is the branches-of-branches case the request is about.
const nested = [
  chat("root", null, "2026-10-01T00:00:00.000Z"),
  chat("b1", "root", "2026-10-02T00:00:00.000Z"),
  chat("b1-1", "b1", "2026-10-03T00:00:00.000Z"),
  chat("b1-1-1", "b1-1", "2026-10-04T00:00:00.000Z"),
  chat("b2", "root", "2026-10-05T00:00:00.000Z"),
];
assert.deepEqual(shape(buildChatBranchRows(nested)), ["root:0", "b1:1", "b1-1:2", "b1-1-1:3", "b2:1"]);

// A parent always renders before its children, so indentation reads as lineage.
const nestedRows = buildChatBranchRows(nested);
const position = new Map(nestedRows.map((row, index) => [row.chat.id, index]));
for (const row of nestedRows) {
  const parentId = (row.chat.metadata as { branchParentChatId?: string }).branchParentChatId;
  if (parentId) assert.ok(position.get(parentId)! < position.get(row.chat.id)!);
}

// Siblings keep the caller's ordering (the chat list passes its recency comparator).
const recentFirst = (left: BranchTreeChat, right: BranchTreeChat) =>
  new Date(right.createdAt as string).getTime() - new Date(left.createdAt as string).getTime();
assert.deepEqual(shape(buildChatBranchRows(nested, recentFirst)), ["root:0", "b2:1", "b1:1", "b1-1:2", "b1-1-1:3"]);

// Branches made before lineage existed have no parent: the oldest is the chat, the rest flatten
// under it — nothing may vanish from the list.
const legacy = [
  chat("old-b", null, "2026-10-02T00:00:00.000Z"),
  chat("old-root", null, "2026-10-01T00:00:00.000Z"),
  chat("old-c", null, "2026-10-03T00:00:00.000Z"),
];
assert.deepEqual(shape(buildChatBranchRows(legacy)), ["old-root:0", "old-b:1", "old-c:1"]);

// Legacy siblings hang off the root as ordinary children, so they sort with the real branches
// instead of being appended after the whole subtree.
const oldestFirst = (left: BranchTreeChat, right: BranchTreeChat) =>
  new Date(left.createdAt as string).getTime() - new Date(right.createdAt as string).getTime();
assert.deepEqual(
  shape(buildChatBranchRows([...nested, chat("imported-mid", null, "2026-10-04T12:00:00.000Z")], oldestFirst)),
  ["root:0", "b1:1", "b1-1:2", "b1-1-1:3", "imported-mid:1", "b2:1"],
);

// An imported sibling joins a lineage group the same way.
const withImported = [...nested, chat("imported", null, "2026-10-06T00:00:00.000Z")];
const importedRows = buildChatBranchRows(withImported);
assert.equal(importedRows.length, 6);
assert.equal(importedRows[importedRows.length - 1]?.chat.id, "imported");

// A parent that was deleted is not a level: the orphan is just another child, never a crash.
assert.deepEqual(
  shape(
    buildChatBranchRows([
      chat("root", null, "2026-10-01T00:00:00.000Z"),
      chat("orphan", "deleted-chat", "2026-10-02T00:00:00.000Z"),
    ]),
  ),
  ["root:0", "orphan:1"],
);

// A chat that claims itself as its parent is treated as having no parent.
assert.deepEqual(shape(buildChatBranchRows([chat("self", "self")])), ["self:0"]);

// A cycle with no lineage root still renders every chat exactly once, and terminates.
const cyclic = [chat("a", "b"), chat("b", "a"), chat("c", null)];
const cyclicRows = buildChatBranchRows(cyclic);
assert.equal(new Set(cyclicRows.map((row) => row.chat.id)).size, 3);
assert.equal(cyclicRows[0]?.depth, 0);

// Every chat in a messy group appears exactly once: no drops, no duplicates.
const messyRows = buildChatBranchRows([...nested, ...legacy, ...cyclic]);
assert.equal(messyRows.length, nested.length + legacy.length + cyclic.length);
assert.equal(new Set(messyRows.map((row) => row.chat.id)).size, messyRows.length);

// The issue's repro (#8488): root + a middle branch + a branch of that branch, then the middle
// branch is deleted. The descendant keeps its own branch below it, and the group must still get a
// tree — otherwise deleting a middle branch retires every branch under it from the chat list.
const afterMiddleDeleted = nested.filter((row) => row.id !== "b1");
assert.deepEqual(shape(buildChatBranchRows(afterMiddleDeleted)), ["root:0", "b1-1:1", "b1-1-1:2", "b2:1"]);

// Every survivor pointing at a deleted chat still renders, but the real top is gone: the oldest
// survivor becomes the top row and the rest hang at depth 1 under it. Nothing may be dropped, and
// this is the only hierarchy the data allows, so the fallback is pinned rather than assumed.
const allOrphaned = [
  chat("sib-old", "deleted-source", "2026-10-01T00:00:00.000Z"),
  chat("sib-new", "deleted-source", "2026-10-02T00:00:00.000Z"),
];
assert.deepEqual(shape(buildChatBranchRows(allOrphaned)), ["sib-old:0", "sib-new:1"]);

// A recorded pointer that names a deleted chat is still lineage. Imported and copied chats have the
// pointer stripped, so a pointer with no chat behind it can only mean the source was deleted; hiding
// its descendants would lose them from the list for no reason the data supports.
assert.equal(hasChatBranchLineage(nested), true);
assert.equal(hasChatBranchLineage(afterMiddleDeleted), true);
assert.equal(hasChatBranchLineage([chat("a", "deleted"), chat("b")]), true);
assert.equal(hasChatBranchLineage([chat("a", "deleted-1"), chat("b", "deleted-2")]), true);
assert.equal(hasChatBranchLineage(allOrphaned), true);

// Legacy branch sets, a lone chat and a self-reference still get no tree: nothing records a lineage
// there, and legacy sets and Game sessions stay on the list's single-row behaviour rather than being
// given an invented hierarchy.
assert.equal(hasChatBranchLineage(legacy), false);
assert.equal(hasChatBranchLineage([chat("solo")]), false);
assert.equal(hasChatBranchLineage([chat("self", "self"), chat("other")]), false);
