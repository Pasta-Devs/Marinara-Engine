import { useCallback, useLayoutEffect, useRef, type RefObject } from "react";

/** Keep the opening position through late image/font/layout changes until the reader takes over. */
export function useChatOpeningScroll(
  chatId: string | null,
  scrollRef: RefObject<HTMLElement | null>,
  scrollToBottom: (behavior?: ScrollBehavior) => void,
) {
  const cleanupRef = useRef<(() => void) | null>(null);
  useLayoutEffect(() => () => cleanupRef.current?.(), [chatId]);

  return useCallback(() => {
    cleanupRef.current?.();
    const element = scrollRef.current;
    if (!chatId || !element) return;

    let following = true;
    const align = () => {
      if (following && element.clientHeight > 0) scrollToBottom("auto");
    };
    const observer = new ResizeObserver(align);
    const inputEvents = ["wheel", "touchmove", "pointerdown", "keydown"] as const;
    const stop = () => {
      following = false;
      observer.disconnect();
      for (const event of inputEvents) window.removeEventListener(event, stop, true);
      document.removeEventListener("selectionchange", align);
      cleanupRef.current = null;
    };
    cleanupRef.current = stop;
    // The scroll viewport has a fixed height; its message rows resize when
    // media and fonts finish loading. Also observe the viewport when hidden.
    // ponytail: opening rows are already mounted; later insertions use normal
    // message scrolling. Observe new rows here only if opening becomes incremental.
    observer.observe(element);
    for (const child of element.children) observer.observe(child);
    for (const event of inputEvents) window.addEventListener(event, stop, { capture: true, passive: true });
    document.addEventListener("selectionchange", align);
    align();
  }, [chatId, scrollRef, scrollToBottom]);
}
