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
    // Rows that mount after opening (Novel Mode's lazy editor) are followed too.
    const rows = new MutationObserver((records) => {
      for (const record of records)
        for (const node of record.addedNodes) if (node instanceof Element) observer.observe(node);
      align();
    });
    const inputEvents = ["wheel", "touchmove", "pointerdown", "keydown"] as const;
    const stop = () => {
      following = false;
      observer.disconnect();
      rows.disconnect();
      for (const event of inputEvents) window.removeEventListener(event, stop, true);
      document.removeEventListener("selectionchange", align);
      cleanupRef.current = null;
    };
    cleanupRef.current = stop;
    // The scroll viewport has a fixed height; its message rows resize when
    // media and fonts finish loading. Also observe the viewport when hidden.
    observer.observe(element);
    for (const child of element.children) observer.observe(child);
    rows.observe(element, { childList: true });
    for (const event of inputEvents) window.addEventListener(event, stop, { capture: true, passive: true });
    document.addEventListener("selectionchange", align);
    align();
  }, [chatId, scrollRef, scrollToBottom]);
}
