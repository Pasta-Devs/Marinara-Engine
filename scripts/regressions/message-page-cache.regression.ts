// #4703: refetching the chat-message infinite query re-drains every loaded
// page back-to-back, so a deep page cache amplifies any stray refetch trigger
// into N full-page requests. The fix bounds that amplifier with pure helpers
// in the client lib — these regressions pin their contracts:
//   - trims always drop from the OLD end (pages[0] is the newest chunk; the
//     retained window must stay a suffix so absolute numbering and Load More
//     keep working),
//   - reconnect refetches are allowed only for shallow caches,
//   - concurrent authoritative refreshes coalesce leading+trailing (at most
//     two runs per burst, every caller served by a run started at or after its
//     own call).
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import {
  chatIdOfMessagesQueryKey,
  createLeadingTrailingCoalescer,
  INACTIVE_CHAT_MAX_MESSAGE_PAGES,
  locateMessagesInPages,
  shouldRefetchMessagesOnReconnect,
  trimInactiveMessagePageCaches,
  removeMessagesFromPages,
  restoreMessagesToPages,
  trimMessagePagesToNewest,
} from "../../packages/client/src/lib/message-page-cache";

// ── Query-key matching (must mirror chatKeys.messages in use-chats.ts) ──

assert.equal(chatIdOfMessagesQueryKey(["chats", "messages", "chat-1"]), "chat-1");
assert.equal(chatIdOfMessagesQueryKey(["chats", "list"]), null, "other chat keys never match");
assert.equal(chatIdOfMessagesQueryKey(["chats", "messages"]), null, "a key without a chat id never matches");
assert.equal(chatIdOfMessagesQueryKey(["chats", "messages", 7]), null, "non-string ids never match");
assert.equal(chatIdOfMessagesQueryKey(["chats", "messages", ""]), null, "empty ids never match");
assert.equal(
  chatIdOfMessagesQueryKey(["chats", "messages", "chat-1", "extra"]),
  null,
  "deeper keys never match — the trim must not touch derived caches",
);

// ── Trim direction: the retained window stays a suffix of the chat ──

const fivePages = {
  pages: [["newest"], ["p2"], ["p3"], ["p4"], ["oldest"]],
  pageParams: [undefined, "c2", "c3", "c4", "c5"],
};
const trimmed = trimMessagePagesToNewest(fivePages, 3);
assert.deepEqual(
  trimmed,
  { pages: [["newest"], ["p2"], ["p3"]], pageParams: [undefined, "c2", "c3"] },
  "trims drop from the OLD end and keep pages/pageParams in lockstep",
);
assert.equal(trimmed?.pages[0]?.[0], "newest", "the newest page always survives a trim");
assert.equal(
  trimmed?.pageParams[0],
  undefined,
  "pageParams[0] stays undefined so a full refetch still restarts from the newest page",
);
assert.equal(trimMessagePagesToNewest(trimmed, 3), trimmed, "trimming at the cap is a no-op (idempotent)");
assert.equal(trimMessagePagesToNewest(fivePages, 5), fivePages, "a cache at the cap is returned untouched");
assert.equal(trimMessagePagesToNewest(fivePages, 0), fivePages, "a non-positive cap never trims");
assert.equal(trimMessagePagesToNewest(undefined, 3), undefined, "no data passes through untouched");
assert.deepEqual(fivePages.pages.length, 5, "trimming never mutates the input data");

// ── Reconnect gate: shallow caches refetch, deep caches do not ──

assert.equal(shouldRefetchMessagesOnReconnect(0), true, "an empty cache may refetch on reconnect");
assert.equal(shouldRefetchMessagesOnReconnect(1), true, "a single page is cheap enough to refetch");
assert.equal(shouldRefetchMessagesOnReconnect(2), false, "two or more pages would amplify — no reconnect refetch");
assert.equal(shouldRefetchMessagesOnReconnect(40), false, "deep caches never refetch on reconnect");

// ── Inactive-cache sweep against a minimal QueryClient stand-in ──

type FakeInfinite = { pages: unknown[][]; pageParams: unknown[] };
type FakeQuery = { queryKey: readonly unknown[]; active: boolean; dataUpdatedAt: number; data: FakeInfinite };
function makeFakeQueryClient(queries: FakeQuery[]) {
  const writes: Array<{ queryKey: readonly unknown[]; result: unknown; updatedAt: number | undefined }> = [];
  const qc = {
    getQueryCache: () => ({
      getAll: () =>
        queries.map((q) => ({
          queryKey: q.queryKey,
          isActive: () => q.active,
          state: { dataUpdatedAt: q.dataUpdatedAt, data: q.data, isInvalidated: false },
        })),
    }),
    setQueryData: (
      queryKey: readonly unknown[],
      updater: (old: FakeInfinite | undefined) => FakeInfinite | undefined,
      options?: { updatedAt?: number },
    ) => {
      const match = queries.find((q) => q.queryKey === queryKey);
      writes.push({ queryKey, result: updater(match?.data), updatedAt: options?.updatedAt });
    },
  };
  return { qc: qc as unknown as Parameters<typeof trimInactiveMessagePageCaches>[0], writes };
}

const deepData = (): FakeInfinite => ({
  pages: [["n"], ["2"], ["3"], ["4"], ["5"]],
  pageParams: [undefined, "c2", "c3", "c4", "c5"],
});
const atCapData = (): FakeInfinite => ({
  pages: [["n"], ["2"], ["3"]],
  pageParams: [undefined, "c2", "c3"],
});
const sweep = makeFakeQueryClient([
  { queryKey: ["chats", "messages", "active-chat"], active: false, dataUpdatedAt: 100, data: deepData() },
  { queryKey: ["chats", "messages", "observed-chat"], active: true, dataUpdatedAt: 200, data: deepData() },
  { queryKey: ["chats", "messages", "background-chat"], active: false, dataUpdatedAt: 300, data: deepData() },
  { queryKey: ["chats", "messages", "at-cap-chat"], active: false, dataUpdatedAt: 350, data: atCapData() },
  { queryKey: ["chats", "detail", "background-chat"], active: false, dataUpdatedAt: 400, data: deepData() },
]);
trimInactiveMessagePageCaches(sweep.qc, "active-chat");
assert.equal(sweep.writes.length, 1, "only unobserved background message caches ABOVE the cap are written");
assert.deepEqual(sweep.writes[0]?.queryKey, ["chats", "messages", "background-chat"]);
assert.equal(
  (sweep.writes[0]?.result as FakeInfinite).pages.length,
  INACTIVE_CHAT_MAX_MESSAGE_PAGES,
  "the background cache is trimmed to the inactive cap",
);
assert.equal(
  sweep.writes[0]?.updatedAt,
  300,
  "the trim preserves dataUpdatedAt — otherwise the cache would look fresh and suppress the stale-gated refetchOnMount",
);
assert.equal(
  sweep.writes.some((w) => (w.queryKey as readonly unknown[])[2] === "at-cap-chat"),
  false,
  "an at-cap cache gets NO write at all — a same-object setQueryData still dispatches 'success' and would clear isInvalidated",
);

// ── The same sweep against the REAL React Query client ──
// The fake above cannot observe isInvalidated; these pin the state-machine
// half of the contract against the installed @tanstack/query-core (resolved
// through the client workspace's react-query, which re-exports it).
{
  // Resolve react-query through the client workspace's own dependency graph
  // instead of hardcoding a node_modules build path.
  const clientRequire = createRequire(new URL("../../packages/client/package.json", import.meta.url));
  const { QueryClient } = clientRequire("@tanstack/react-query") as typeof import("@tanstack/react-query");
  const qc = new QueryClient();
  const seed = (chatId: string, pageCount: number) => {
    const key = ["chats", "messages", chatId];
    qc.setQueryData(key, {
      pages: Array.from({ length: pageCount }, (_, i) => [`p${i}`]),
      pageParams: [undefined, ...Array.from({ length: pageCount - 1 }, (_, i) => `c${i + 2}`)],
    });
    return key;
  };
  const deepKey = seed("deep", 6);
  const capKey = seed("cap", 3);
  // Pending stale-marks on both backgrounded chats (what an autonomous reply
  // or a cache-wide workspace invalidation leaves behind).
  qc.invalidateQueries({ queryKey: deepKey, exact: true, refetchType: "none" });
  qc.invalidateQueries({ queryKey: capKey, exact: true, refetchType: "none" });
  const stateOf = (key: readonly unknown[]) => qc.getQueryCache().find({ queryKey: key, exact: true })!.state;
  const capUpdatesBefore = stateOf(capKey).dataUpdateCount;
  const deepUpdatedAtBefore = stateOf(deepKey).dataUpdatedAt;
  assert.equal(stateOf(deepKey).isInvalidated, true, "seeded stale-mark present before the sweep");

  trimInactiveMessagePageCaches(qc as never, "some-other-chat");

  const deepState = stateOf(deepKey);
  assert.equal((deepState.data as FakeInfinite).pages.length, 3, "real client: deep cache trimmed to the cap");
  assert.equal(deepState.dataUpdatedAt, deepUpdatedAtBefore, "real client: trim preserves dataUpdatedAt");
  assert.equal(
    deepState.isInvalidated,
    true,
    "real client: a pending stale-mark SURVIVES the trim — the 'success' dispatch clears it, so the sweep must re-invalidate",
  );
  const capState = stateOf(capKey);
  assert.equal(
    capState.dataUpdateCount,
    capUpdatesBefore,
    "real client: an at-cap cache receives no 'success' dispatch (no-op writes are skipped)",
  );
  assert.equal(capState.isInvalidated, true, "real client: the at-cap chat's stale-mark is untouched");
  qc.clear();
}

// ── Leading+trailing coalescer ──

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (err: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
const tick = () => new Promise((resolve) => setImmediate(resolve));

{
  // A burst of callers collapses to exactly two runs: the in-flight leader and
  // one trailing run that starts only after the leader settles.
  const coalesce = createLeadingTrailingCoalescer<boolean>();
  const gates = [deferred<boolean>(), deferred<boolean>(), deferred<boolean>()];
  let runsStarted = 0;
  const run = () => gates[runsStarted++]!.promise;

  const callers = [1, 2, 3, 4, 5].map(() => coalesce("chat-1", run));
  assert.equal(runsStarted, 1, "only the leader starts while a run is in flight");
  assert.equal(callers[1], callers[2], "mid-flight callers share one trailing promise");
  assert.equal(callers[2], callers[4], "every mid-flight caller folds into the same trailing run");

  gates[0]!.resolve(true);
  await tick();
  assert.equal(runsStarted, 2, "the trailing run starts only after the leader settles");

  gates[1]!.resolve(false);
  const results = await Promise.all(callers);
  assert.deepEqual(results, [true, false, false, false, false], "followers get the trailing run's result");
  assert.equal(runsStarted, 2, "five concurrent callers cost exactly two runs");

  // The map must be empty again: a fresh call starts a fresh leader.
  await tick();
  const next = coalesce("chat-1", run);
  assert.equal(runsStarted, 3, "after the burst settles, a new call starts a fresh leader");
  gates[2]!.resolve(true);
  assert.equal(await next, true);
}

{
  // Third wave: a caller arriving while the TRAILING run executes must queue a
  // third run on the same entry instead of orphaning it (the cleanup of the
  // finished trailing run must leave the entry alone).
  const coalesce = createLeadingTrailingCoalescer<number>();
  const gates = [deferred<number>(), deferred<number>(), deferred<number>()];
  let runsStarted = 0;
  const run = () => gates[runsStarted++]!.promise;

  const first = coalesce("chat-1", run);
  const second = coalesce("chat-1", run);
  gates[0]!.resolve(1);
  await tick();
  assert.equal(runsStarted, 2, "trailing run is now executing");

  const third = coalesce("chat-1", run);
  assert.equal(runsStarted, 2, "the third-wave caller queues instead of starting concurrently");
  assert.notEqual(third, second, "a caller during the trailing run gets a NEW queued run, not the executing one");

  gates[1]!.resolve(2);
  await tick();
  assert.equal(runsStarted, 3, "the queued third run starts after the trailing run settles");
  gates[2]!.resolve(3);
  assert.deepEqual(await Promise.all([first, second, third]), [1, 2, 3]);
}

{
  // A rejected leader must not wedge the queue: its own caller sees the
  // rejection, the trailing run still executes, and the key is released.
  const coalesce = createLeadingTrailingCoalescer<string>();
  const gates = [deferred<string>(), deferred<string>()];
  let runsStarted = 0;
  const run = () => gates[runsStarted++]!.promise;

  const leader = coalesce("chat-1", run);
  const follower = coalesce("chat-1", run);
  gates[0]!.reject(new Error("leader failed"));
  await assert.rejects(leader, /leader failed/, "the leader's caller sees its own failure");
  await tick();
  assert.equal(runsStarted, 2, "a failed leader still releases the trailing run");
  gates[1]!.resolve("recovered");
  assert.equal(await follower, "recovered");
}

{
  // Keys are independent: two chats refresh concurrently.
  const coalesce = createLeadingTrailingCoalescer<boolean>();
  let runsStarted = 0;
  const run = () => {
    runsStarted++;
    return Promise.resolve(true);
  };
  void coalesce("chat-a", run);
  void coalesce("chat-b", run);
  assert.equal(runsStarted, 2, "different chats never queue behind each other");
}

// ── Optimistic delete: the messages leave every page, cursors and the input stay intact
{
  const cached = {
    pages: [
      [{ id: "m3" }, { id: "m4" }],
      [{ id: "m1" }, { id: "m2" }],
    ],
    pageParams: [undefined, "c2"],
  };
  const next = removeMessagesFromPages(cached, ["m4", "m1"]);
  assert.deepEqual(next?.pages, [[{ id: "m3" }], [{ id: "m2" }]], "deleted messages leave every page");
  assert.deepEqual(next?.pageParams, [undefined, "c2"], "Load more keeps its cursor");
  assert.equal(cached.pages[0].length, 2, "the snapshot kept for rollback is not mutated");
  assert.equal(removeMessagesFromPages(undefined, ["m1"]), undefined, "an empty cache stays empty");
}

// ── Failed delete: hidden messages return to their old place, without undoing what landed meanwhile
{
  const cached = {
    pages: [
      [{ id: "m3" }, { id: "m4" }, { id: "m5" }],
      [{ id: "m1" }, { id: "m2" }],
    ],
    pageParams: [undefined, "c2"],
  };
  const removed = locateMessagesInPages(cached, ["m4", "m1"]);
  assert.deepEqual(
    removed.map(({ page, index, message }) => [page, index, message.id]),
    [
      [0, 1, "m4"],
      [1, 0, "m1"],
    ],
    "positions are kept per page",
  );
  const hidden = removeMessagesFromPages(cached, ["m4", "m1"]);
  // Meanwhile m5 was deleted elsewhere, a reply m6 arrived, and m1 came back from a refetch.
  const meanwhile = {
    ...hidden!,
    pages: [
      [{ id: "m3" }, { id: "m6" }],
      [{ id: "m1" }, { id: "m2" }],
    ],
  };
  const restored = restoreMessagesToPages(meanwhile, removed);
  assert.deepEqual(
    restored?.pages,
    [
      [{ id: "m3" }, { id: "m4" }, { id: "m6" }],
      [{ id: "m1" }, { id: "m2" }],
    ],
    "the hidden message returns, the reply and the other delete stay, present ids are not doubled",
  );
  assert.deepEqual(restored?.pageParams, [undefined, "c2"], "Load more keeps its cursor");
  assert.equal(meanwhile.pages[0].length, 2, "the current cache is not mutated");
}

console.info("Message page cache regressions passed.");
