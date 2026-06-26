import { useEffect, useState } from "react";
import { useChatStore } from "../stores/chat.store";
import { rafThrottle } from "../lib/raf-throttle";

// Subscribe to the live stream buffer but re-render the caller at most once per
// animation frame for the per-token *growth* that drives streaming lag, while
// delivering resets immediately.
//
// The cost #2878 is about is the per-token re-parse of the growing message, so
// only monotonic growth (buffer getting longer, the same string plus the next
// token) is throttled. Every other transition — the buffer clearing to "" at a
// turn boundary, the first token after a clear, or any shrink/rewrite — is
// delivered synchronously. This keeps the throttled buffer coherent with the
// fields that are NOT throttled (notably `streamingCharacterId`): a group-turn
// boundary does `setStreamBuffer("")` and then `setStreamingCharacterId(next)`
// back to back, so delivering the clear in the same render as the id flip stops
// the new speaker's row from briefly (or, in the bubble layout's monotonic
// preview, persistently) showing the previous speaker's text.
//
// The store's `streamBuffer` itself is still written on every token, so
// token-exact consumers such as ChatArea's auto-scroll subscriber are
// unaffected. The committed message is rendered from the React Query cache once
// streaming ends, so a growth frame being up to ~16ms behind is never visible.

// True when `next` is the previous buffer plus more appended tokens (ongoing
// growth) and should be throttled; false for resets, the first token after a
// clear, shrinks, and any non-append change, which are delivered immediately.
//
// The `startsWith` prefix check is what makes a non-append swap a reset: a
// per-token stream always appends (`next === lastSeen + token`), but switching
// the active chat into a *different* chat that is also streaming replaces the
// buffer with unrelated text. Without the prefix check, if that other chat's
// buffer happened to be longer it would be misclassified as growth and held a
// frame, briefly showing the previous chat's text in the new chat. Requiring
// the prefix delivers cross-chat swaps synchronously instead. Exported for
// unit testing.
export function isOngoingStreamGrowth(lastSeen: string, next: string): boolean {
  return lastSeen.length > 0 && next.length > lastSeen.length && next.startsWith(lastSeen);
}

export function useThrottledStreamBuffer(): string {
  const [value, setValue] = useState(() => useChatStore.getState().streamBuffer);

  useEffect(() => {
    let lastSeen = useChatStore.getState().streamBuffer;
    // Catch up on any change between the initial render and this effect.
    setValue(lastSeen);
    const throttle = rafThrottle<string>(setValue);
    const unsubscribe = useChatStore.subscribe(
      (state) => state.streamBuffer,
      (next) => {
        const growth = isOngoingStreamGrowth(lastSeen, next);
        lastSeen = next;
        throttle.call(next);
        // Reset / clear / first token / shrink: deliver now, dropping any
        // pending growth frame so a stale value can't land after the reset.
        if (!growth) throttle.flush();
      },
    );
    return () => {
      throttle.cancel();
      unsubscribe();
    };
  }, []);

  return value;
}
