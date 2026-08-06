import { useEffect, useState, type RefObject } from "react";

export const CHAT_VISUAL_VIEWPORT_CHANGE_EVENT = "marinara:chat-visual-viewport-change";

export interface ChatVisualViewportChangeDetail {
  height: number;
  offsetTop: number;
  keyboardOpen: boolean;
}

export function dispatchChatVisualViewportChange(detail: ChatVisualViewportChangeDetail): void {
  window.dispatchEvent(
    new CustomEvent<ChatVisualViewportChangeDetail>(CHAT_VISUAL_VIEWPORT_CHANGE_EVENT, {
      detail,
    }),
  );
}

export function useChatKeyboardOpen(): boolean {
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    const handleViewportChange = (event: Event) => {
      const detail = (event as CustomEvent<ChatVisualViewportChangeDetail>).detail;
      setKeyboardOpen(detail?.keyboardOpen === true);
    };

    window.addEventListener(CHAT_VISUAL_VIEWPORT_CHANGE_EVENT, handleViewportChange);
    return () => window.removeEventListener(CHAT_VISUAL_VIEWPORT_CHANGE_EVENT, handleViewportChange);
  }, []);

  return keyboardOpen;
}

function focusedChatComposerAcceptsText(): boolean {
  const active = document.activeElement;
  if (!(active instanceof HTMLElement)) return false;
  if (!active.matches("[data-chat-composer]")) return false;
  if (active instanceof HTMLTextAreaElement) return true;
  if (active instanceof HTMLInputElement) {
    return !["button", "checkbox", "color", "file", "hidden", "radio", "range", "reset", "submit"].includes(
      active.type,
    );
  }
  return active.isContentEditable;
}

export function useChatComposerFocused(): boolean {
  const [focused, setFocused] = useState(
    () => typeof document !== "undefined" && document.activeElement?.matches("[data-chat-composer]") === true,
  );

  useEffect(() => {
    let frame = 0;
    const update = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        frame = 0;
        setFocused(document.activeElement?.matches("[data-chat-composer]") === true);
      });
    };
    document.addEventListener("focusin", update);
    document.addEventListener("focusout", update);
    update();
    return () => {
      if (frame) cancelAnimationFrame(frame);
      document.removeEventListener("focusin", update);
      document.removeEventListener("focusout", update);
    };
  }, []);

  return focused;
}

/**
 * Preserve the user's bottom anchor when a mobile software keyboard changes
 * the visual viewport. Readers who intentionally scrolled upward are left
 * exactly where they were.
 */
export function useKeepLatestChatMessageVisible(
  scrollRef: RefObject<HTMLElement | null>,
  scrollToBottom: (behavior?: ScrollBehavior) => void,
): void {
  useEffect(() => {
    let keyboardOpen = false;
    let restoreFrame = 0;
    let settleFrame = 0;
    let pendingAnchor: { scrollTop: number; pinnedToBottom: boolean } | null = null;

    const captureAnchor = () => {
      const scrollElement = scrollRef.current;
      if (!scrollElement) return null;
      const distanceFromBottom = scrollElement.scrollHeight - scrollElement.scrollTop - scrollElement.clientHeight;
      return {
        scrollTop: scrollElement.scrollTop,
        pinnedToBottom: distanceFromBottom < 150,
      };
    };

    const handleComposerPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element) || !target.closest("[data-chat-composer]")) return;
      pendingAnchor = captureAnchor();
    };

    const handleComposerFocus = (event: FocusEvent) => {
      const target = event.target;
      if (!(target instanceof Element) || !target.matches("[data-chat-composer]")) return;
      pendingAnchor ??= captureAnchor();
    };

    const handleComposerBlur = (event: FocusEvent) => {
      const target = event.target;
      if (!(target instanceof Element) || !target.matches("[data-chat-composer]")) return;
      if (!keyboardOpen) pendingAnchor = null;
    };

    const handleViewportChange = (event: Event) => {
      const detail = (event as CustomEvent<ChatVisualViewportChangeDetail>).detail;
      if (!detail?.keyboardOpen) {
        const wasKeyboardOpen = keyboardOpen;
        keyboardOpen = false;
        if (wasKeyboardOpen || !focusedChatComposerAcceptsText()) pendingAnchor = null;
        if (restoreFrame) cancelAnimationFrame(restoreFrame);
        if (settleFrame) cancelAnimationFrame(settleFrame);
        restoreFrame = 0;
        settleFrame = 0;
        return;
      }
      if (keyboardOpen || !focusedChatComposerAcceptsText()) return;
      keyboardOpen = true;

      const anchor = pendingAnchor ?? captureAnchor();
      if (!anchor) return;
      pendingAnchor = null;

      const restore = () => {
        if (!keyboardOpen) return;
        const scrollElement = scrollRef.current;
        if (!scrollElement) return;
        if (anchor.pinnedToBottom) {
          scrollToBottom("auto");
          return;
        }
        const maxScrollTop = Math.max(0, scrollElement.scrollHeight - scrollElement.clientHeight);
        scrollElement.scrollTo({ top: Math.min(anchor.scrollTop, maxScrollTop), behavior: "auto" });
      };

      restoreFrame = requestAnimationFrame(() => {
        restoreFrame = 0;
        restore();
        settleFrame = requestAnimationFrame(() => {
          settleFrame = 0;
          restore();
        });
      });
    };

    document.addEventListener("pointerdown", handleComposerPointerDown, true);
    document.addEventListener("focusin", handleComposerFocus, true);
    document.addEventListener("focusout", handleComposerBlur, true);
    window.addEventListener(CHAT_VISUAL_VIEWPORT_CHANGE_EVENT, handleViewportChange);
    return () => {
      if (restoreFrame) cancelAnimationFrame(restoreFrame);
      if (settleFrame) cancelAnimationFrame(settleFrame);
      document.removeEventListener("pointerdown", handleComposerPointerDown, true);
      document.removeEventListener("focusin", handleComposerFocus, true);
      document.removeEventListener("focusout", handleComposerBlur, true);
      window.removeEventListener(CHAT_VISUAL_VIEWPORT_CHANGE_EVENT, handleViewportChange);
    };
  }, [scrollRef, scrollToBottom]);
}
