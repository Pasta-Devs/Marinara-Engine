import { useEffect, useState, type RefObject } from "react";
import { hasActiveTextSelection } from "../lib/text-selection";

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
 * exactly where they were. A message being edited is scrolled into the space
 * left above the keyboard.
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
    let revealedEditor: Element | null = null;

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
        revealedEditor = null;
        if (wasKeyboardOpen || !focusedChatComposerAcceptsText()) pendingAnchor = null;
        if (restoreFrame) cancelAnimationFrame(restoreFrame);
        if (settleFrame) cancelAnimationFrame(settleFrame);
        restoreFrame = 0;
        settleFrame = 0;
        return;
      }
      const editor = document.activeElement;
      if (editor && editor !== revealedEditor && editor.matches("[data-chat-message-editor]")) {
        revealedEditor = editor;
        // Phones line the editor up when editing starts, but a taller tablet
        // transcript can still shrink past it. If its first lines are out of
        // view, scroll only the transcript (never the app shell) back to them,
        // below the floating top controls (its scroll padding), as phones do.
        const reveal = () => {
          const scrollElement = scrollRef.current;
          if (!scrollElement?.contains(editor) || document.activeElement !== editor) return;
          const offset = editor.getBoundingClientRect().top - scrollElement.getBoundingClientRect().top;
          const topInset = Number.parseFloat(getComputedStyle(scrollElement).scrollPaddingTop) || 8;
          // Under the top controls counts as out of view, not just above the transcript.
          if (offset < topInset || offset + 48 > scrollElement.clientHeight)
            scrollElement.scrollTop += offset - topInset;
        };
        restoreFrame = requestAnimationFrame(() => {
          restoreFrame = 0;
          reveal();
          settleFrame = requestAnimationFrame(() => {
            settleFrame = 0;
            reveal();
          });
        });
        return;
      }
      if (keyboardOpen || !focusedChatComposerAcceptsText()) return;
      keyboardOpen = true;

      const anchor = pendingAnchor ?? captureAnchor();
      if (!anchor) return;
      pendingAnchor = null;

      const restore = () => {
        if (!keyboardOpen || hasActiveTextSelection()) return;
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
