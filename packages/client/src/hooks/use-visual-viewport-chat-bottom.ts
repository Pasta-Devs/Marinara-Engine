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
      const editor = document.activeElement;
      // Every size report, not only the first: a keyboard that opens in steps (or grows its
      // suggestion bar) keeps shrinking the transcript after the first reveal.
      if (editor && editor.matches("[data-chat-message-editor]")) {
        // Phones line the editor up when editing starts, but a taller tablet
        // transcript can still shrink past it. If its first lines are out of
        // view, scroll only the transcript (never the app shell) back to them,
        // below the floating top controls (its scroll padding), as phones do.
        const reveal = () => {
          const scrollElement = scrollRef.current;
          if (!scrollElement?.contains(editor) || document.activeElement !== editor) return;
          const box = scrollElement.getBoundingClientRect();
          const offset = editor.getBoundingClientRect().top - box.top;
          const topInset = Number.parseFloat(getComputedStyle(scrollElement).scrollPaddingTop) || 8;
          // Under the top controls counts as out of view, not just above the transcript.
          if (offset < topInset || offset + 48 > scrollElement.clientHeight) {
            scrollElement.scrollTop += offset - topInset;
            return;
          }
          // The editor with its Cancel/Save row ends above the message box that floats over the
          // transcript's foot (and above the keyboard), not merely inside the transcript (TLR2).
          const block = editor.parentElement ?? editor;
          const composer = (scrollElement.closest("[data-chat-mode]") ?? document).querySelector<HTMLElement>(
            ".marinara-chat-input-shell",
          );
          const composerRect = composer?.getBoundingClientRect();
          // Only a box that sits over the transcript's foot covers it; one below it already leaves the room.
          const composerTop =
            composerRect && composerRect.height > 0 && composerRect.top < box.bottom ? composerRect.top : Infinity;
          const viewportBottom = window.visualViewport
            ? window.visualViewport.offsetTop + window.visualViewport.height
            : window.innerHeight;
          const visibleBottom = Math.min(box.bottom, composerTop, viewportBottom) - 8;
          const overflow = block.getBoundingClientRect().bottom - visibleBottom;
          // Never past its first lines: a tall editor keeps its top in view and scrolls inside itself.
          if (overflow > 0) scrollElement.scrollTop += Math.min(overflow, offset - topInset);
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

    // Stay at the newest message while the transcript gets shorter from below: the keyboard
    // opening in steps, the suggestion bar appearing, the composer growing a line. Someone reading
    // further up (more than a short way from the bottom) is left where they are.
    let distanceFromBottom = 0;
    let observedHeight = 0;
    let observedWidth = 0;
    let observed: HTMLElement | null = null;
    const measure = () => {
      const el = scrollRef.current;
      if (el) distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    };
    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver((entries) => {
            const el = scrollRef.current;
            const box = entries[entries.length - 1]?.contentRect;
            if (!el || !box || el.clientHeight === 0) return;
            // The content box, not clientHeight: the composer growing a line raises the transcript's
            // bottom padding, which shrinks the content box while the element keeps its size.
            // Narrower (a side panel opening) rewraps every message and moves the bottom too.
            const shrank =
              (observedHeight > 0 && box.height < observedHeight - 0.5) ||
              (observedWidth > 0 && Math.abs(box.width - observedWidth) > 0.5);
            observedHeight = box.height;
            observedWidth = box.width;
            if (shrank && distanceFromBottom < 150 && !hasActiveTextSelection()) {
              const editing = document.activeElement?.matches("[data-chat-message-editor]");
              if (!editing) el.scrollTop = el.scrollHeight;
            }
            measure();
          });
    const watch = () => {
      const el = scrollRef.current;
      if (el === observed) return;
      if (observed) {
        resizeObserver?.unobserve(observed);
        observed.removeEventListener("scroll", measure);
      }
      observed = el;
      if (el) {
        const style = getComputedStyle(el);
        observedHeight = el.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
        observedWidth = el.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
        measure();
        resizeObserver?.observe(el);
        el.addEventListener("scroll", measure, { passive: true });
      }
    };
    watch();
    // The transcript node can be replaced (a chat switch, a remount): pick up the new one.
    const watchTimer = window.setInterval(watch, 1000);

    document.addEventListener("pointerdown", handleComposerPointerDown, true);
    document.addEventListener("focusin", handleComposerFocus, true);
    document.addEventListener("focusout", handleComposerBlur, true);
    window.addEventListener(CHAT_VISUAL_VIEWPORT_CHANGE_EVENT, handleViewportChange);
    return () => {
      if (restoreFrame) cancelAnimationFrame(restoreFrame);
      if (settleFrame) cancelAnimationFrame(settleFrame);
      window.clearInterval(watchTimer);
      resizeObserver?.disconnect();
      observed?.removeEventListener("scroll", measure);
      document.removeEventListener("pointerdown", handleComposerPointerDown, true);
      document.removeEventListener("focusin", handleComposerFocus, true);
      document.removeEventListener("focusout", handleComposerBlur, true);
      window.removeEventListener(CHAT_VISUAL_VIEWPORT_CHANGE_EVENT, handleViewportChange);
    };
  }, [scrollRef, scrollToBottom]);
}
