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
    // Opening mounts the newest rows first and older ones just after (use-staged-transcript.ts):
    // follow the rows added while opening too.
    const rows = new MutationObserver((records) => {
      for (const record of records)
        for (const node of record.addedNodes) if (node instanceof Element) observer.observe(node);
      align();
    });
    const inputEvents = ["wheel", "touchmove", "pointerdown", "keydown"] as const;
    // Consistency audit P1/H15: in some themes the browser moves the view on its own once the opening
    // scroll is done (scroll anchoring while the theme's fonts and composer settle), leaving the newest
    // reply under the composer with nothing resized. Until the reader takes over, any scroll that
    // leaves the bottom goes back to it.
    let scrollFrame = 0;
    const onScroll = () => {
      if (!following || scrollFrame) return;
      scrollFrame = requestAnimationFrame(() => {
        scrollFrame = 0;
        if (element.scrollHeight - element.scrollTop - element.clientHeight > 1) align();
      });
    };
    const stop = () => {
      following = false;
      if (scrollFrame) cancelAnimationFrame(scrollFrame);
      element.removeEventListener("scroll", onScroll);
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
    element.addEventListener("scroll", onScroll, { passive: true });
    void document.fonts?.ready.then(align);
    align();
  }, [chatId, scrollRef, scrollToBottom]);
}
