import assert from "node:assert/strict";

// #9116: on a 3,000-message chat, checking the stored memories before a reply normalized and hashed the chat's
// whole summary list once per memory, twice over, and the server's event loop stalled for about 20 seconds before
// the request could leave. The revisions are read once per context now, however many memories name a summary.
const { summaryRevisionsOf } = await import("../../packages/server/src/services/advanced-memory.js");

const entries = Array.from({ length: 400 }, (_, index) => {
  const id = `summary-${index}`;
  return {
    id,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    content: `Scene ${index} summary text.`,
    messageIds: Array.from({ length: 8 }, (_, item) => `message-${index * 8 + item}`),
    hiddenMessageIds: [],
  };
});
let reads = 0;
const metadata = {
  summaryEntries: entries,
  summary: null,
};
const ctx = {
  chatId: "chat",
  mode: "default",
  connectionId: null,
  settings: {},
  messages: [],
  characterIds: [],
  names: new Map(),
  individual: false,
  get metadata() {
    reads += 1;
    return metadata;
  },
} as unknown as Parameters<typeof summaryRevisionsOf>[0];

const first = summaryRevisionsOf(ctx);
const readsAfterFirst = reads;
assert.equal(first.size, entries.length, "every summary entry has a revision");
const revision = first.get("summary:summary-7")!.revision;
assert.equal(typeof revision, "string");
assert.ok(revision.length > 0);
for (let check = 0; check < 500; check += 1) summaryRevisionsOf(ctx);
assert.equal(reads, readsAfterFirst, "500 more checks read the metadata no further");
assert.equal(summaryRevisionsOf(ctx), first, "the same revisions serve the whole context");
assert.equal(summaryRevisionsOf(ctx).get("summary:summary-7")!.revision, revision, "revisions do not change");
summaryRevisionsOf({ ...ctx, summaryRevisions: undefined } as never);
assert.ok(reads > readsAfterFirst, "a fresh context reads its own copy");

console.log("Advanced Memory summary revisions regression passed (read once per context, 400 entries).");
