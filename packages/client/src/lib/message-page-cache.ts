import type { InfiniteData, QueryClient } from "@tanstack/react-query";

// #4703: the chat message list is an infinite query, and React Query refetches
// an infinite query by re-draining EVERY accumulated page sequentially. A deep
// page cache therefore turns any stray refetch trigger (reconnect, workspace
// invalidation, post-generation refresh) into N back-to-back full-page
// requests. These helpers bound that amplifier without touching live
// pagination: backgrounded chats get their OLD pages trimmed away, and
// reconnect refetches are allowed only while the cache is shallow enough to be
// cheap.
//
// Page order matters everywhere here: `pages[0]` is the NEWEST chunk — the
// query paginates backward in time via a `before` cursor (see
// `useChatMessages` in hooks/use-chats.ts) — so trimming must always drop from
// the tail. The retained window stays a suffix of the chat, which keeps
// absolute message numbering exact and lets "Load More" re-fetch the dropped
// history on demand from the oldest retained page's own cursor.

/** Pages a backgrounded chat keeps. Bounds both memory and any stray refetch of that chat. */
export const INACTIVE_CHAT_MAX_MESSAGE_PAGES = 3;

/** Page count at or below which a reconnect refetch is cheap enough to keep. */
export const RECONNECT_REFETCH_MAX_PAGES = 1;

/** Matches `chatKeys.messages(chatId)` from hooks/use-chats.ts — keep in sync. */
export function chatIdOfMessagesQueryKey(queryKey: readonly unknown[]): string | null {
  if (queryKey.length !== 3 || queryKey[0] !== "chats" || queryKey[1] !== "messages") return null;
  const chatId = queryKey[2];
  return typeof chatId === "string" && chatId.length > 0 ? chatId : null;
}

/** Drops pages from the OLD end, keeping `pages`/`pageParams` in lockstep. */
export function trimMessagePagesToNewest<T>(
  data: InfiniteData<T> | undefined,
  keep: number,
): InfiniteData<T> | undefined {
  if (!data?.pages || keep <= 0 || data.pages.length <= keep) return data;
  return {
    ...data,
    pages: data.pages.slice(0, keep),
    pageParams: data.pageParams.slice(0, keep),
  };
}

export function shouldRefetchMessagesOnReconnect(loadedPageCount: number): boolean {
  return loadedPageCount <= RECONNECT_REFETCH_MAX_PAGES;
}

/**
 * Trims the page cache of every chat that is neither on screen nor observed by
 * any other mounted surface. Runs on chat switch; the visible chat keeps its
 * full history so scroll position, Load More, and absolute numbering never
 * shift under the user.
 */
export function trimInactiveMessagePageCaches(
  qc: QueryClient,
  activeChatId: string | null,
  keep: number = INACTIVE_CHAT_MAX_MESSAGE_PAGES,
) {
  for (const query of qc.getQueryCache().getAll()) {
    const chatId = chatIdOfMessagesQueryKey(query.queryKey);
    if (!chatId || chatId === activeChatId) continue;
    if (query.isActive()) continue; // another mounted surface still observes this chat
    // Skip no-op writes entirely: setQueryData dispatches a 'success' state
    // transition even when the updater returns the identical object, which
    // clears isInvalidated — silently dropping a pending stale-mark on every
    // backgrounded chat each time the user switches chats.
    const data = query.state.data as InfiniteData<unknown> | undefined;
    if (!data?.pages || data.pages.length <= keep) continue;
    const wasInvalidated = query.state.isInvalidated;
    // setQueryData stamps dataUpdatedAt with "now" unless told otherwise, which
    // would mark the trimmed cache FRESH and suppress the stale-gated
    // refetchOnMount when the user reopens the chat. Preserve the original.
    qc.setQueryData<InfiniteData<unknown>>(query.queryKey, (old) => trimMessagePagesToNewest(old, keep), {
      updatedAt: query.state.dataUpdatedAt,
    });
    if (wasInvalidated) {
      // The 'success' dispatch from the trim write cleared isInvalidated;
      // restore the pending stale-mark so the next mount still refetches.
      qc.invalidateQueries({ queryKey: query.queryKey, exact: true, refetchType: "none" });
    }
  }
}

type CoalescedRuns<T> = {
  /** The run currently executing (a settled leader stays here until cleanup). */
  active: Promise<T>;
  /** The single queued run that folds every request arriving mid-flight. */
  trailing: Promise<T> | null;
};

/**
 * Leading + single-trailing coalescer. The first caller for a key starts a run
 * immediately; callers arriving while one is in flight all share ONE queued
 * run that starts only after the current one settles. Every caller is thus
 * served by a run that STARTED at or after its own call — which plain promise
 * chaining also guarantees, but chaining serializes N callers into N runs,
 * while this folds them into at most two.
 */
export function createLeadingTrailingCoalescer<T>() {
  const runs = new Map<string, CoalescedRuns<T>>();
  const settled = (p: Promise<T>) =>
    p.then(
      () => undefined,
      () => undefined,
    );

  return function coalesce(key: string, run: () => Promise<T>): Promise<T> {
    const existing = runs.get(key);
    if (existing) {
      if (existing.trailing) return existing.trailing;
      const trailing: Promise<T> = settled(existing.active).then(() => {
        existing.active = trailing;
        existing.trailing = null;
        return run();
      });
      existing.trailing = trailing;
      void settled(trailing).then(() => {
        // A caller that arrived while THIS run executed has queued its own
        // trailing run on the same entry — leave cleanup to that run.
        if (runs.get(key) === existing && existing.active === trailing && !existing.trailing) {
          runs.delete(key);
        }
      });
      return trailing;
    }
    const entry: CoalescedRuns<T> = { active: run(), trailing: null };
    runs.set(key, entry);
    void settled(entry.active).then(() => {
      if (runs.get(key) === entry && !entry.trailing) runs.delete(key);
    });
    return entry.active;
  };
}
