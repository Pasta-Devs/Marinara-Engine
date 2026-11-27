import { useCallback, useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import { readTabPlace, tabPlaceKey, writeTabPlace } from "../lib/tab-place";

/** Closer than this to the newest message counts as reading the bottom. */
const AT_BOTTOM_PX = 150;

/** Keep the opening position through late image/font/layout changes until the reader takes over. */
export function useChatOpeningScroll(
  chatId: string | null,
  scrollRef: RefObject<HTMLElement | null>,
  scrollToBottom: (behavior?: ScrollBehavior) => void,
) {
  const cleanupRef = useRef<(() => void) | null>(null);
  useLayoutEffect(() => () => cleanupRef.current?.(), [chatId]);
  // Each chat tab keeps its place: how far above the newest message you were reading. Coming back to the
  // tab (the computer layout opens the chat again after another tab's page) opens there, not at the bottom.
  const restoringRef = useRef(false);
  useEffect(() => {
    const key = tabPlaceKey("chat", chatId);
    if (!key) return;
    // On the document: the message list can mount after this chat is picked.
    const onScroll = (event: Event) => {
      const element = scrollRef.current;
      if (event.target !== element || !element || restoringRef.current || element.clientHeight === 0) return;
      const fromBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
      writeTabPlace(key, "fromBottom", fromBottom > AT_BOTTOM_PX ? fromBottom : 0);
    };
    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    return () => document.removeEventListener("scroll", onScroll, { capture: true });
  }, [chatId, scrollRef]);

  return useCallback(() => {
    cleanupRef.current?.();
    const element = scrollRef.current;
    if (!chatId || !element) return;

    let following = true;
    // Back in a chat you had scrolled up in: hold that place instead of the bottom (same rules otherwise).
    const fromBottom = readTabPlace<number>(tabPlaceKey("chat", chatId), "fromBottom") ?? 0;
    restoringRef.current = fromBottom > 0;
    const atPlace = () => Math.abs(element.scrollHeight - element.scrollTop - element.clientHeight - fromBottom) <= 1;
    const align = () => {
      if (!following || element.clientHeight <= 0) return;
      if (fromBottom > 0) element.scrollTop = Math.max(0, element.scrollHeight - element.clientHeight - fromBottom);
      else scrollToBottom("auto");
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
        if (fromBottom > 0 ? !atPlace() : element.scrollHeight - element.scrollTop - element.clientHeight > 1) align();
      });
    };
    const stop = () => {
      following = false;
      restoringRef.current = false;
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
