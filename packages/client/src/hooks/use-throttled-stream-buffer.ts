import { useEffect, useState } from "react";
import { useChatStore } from "../stores/chat.store";
import { rafThrottle } from "../lib/raf-throttle";

// Subscribe to the live stream buffer but re-render the caller at most once per
// animation frame, even when tokens arrive faster than the display refreshes.
//
// The store's `streamBuffer` is still updated on every token (so token-exact
// consumers such as ChatArea's auto-scroll subscriber are unaffected); only the
// expensive markdown-rendering consumers throttle here. On a fast stream that
// removes the per-token full re-parse of the growing message, which is the
// concrete contributor to streaming GUI lag identified in #2878. The committed
// message is rendered from the query cache once streaming ends, so a live frame
// being up to ~16ms behind is never visible.
export function useThrottledStreamBuffer(): string {
  const [value, setValue] = useState(() => useChatStore.getState().streamBuffer);

  useEffect(() => {
    const throttle = rafThrottle<string>(setValue);
    // Catch up on any change between the initial render and this effect.
    const current = useChatStore.getState().streamBuffer;
    setValue(current);
    const unsubscribe = useChatStore.subscribe(
      (state) => state.streamBuffer,
      (next) => throttle.call(next),
    );
    return () => {
      throttle.cancel();
      unsubscribe();
    };
  }, []);

  return value;
}
