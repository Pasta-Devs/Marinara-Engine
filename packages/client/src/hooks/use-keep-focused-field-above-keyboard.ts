import { useEffect } from "react";
import {
  CHAT_VISUAL_VIEWPORT_CHANGE_EVENT,
  type ChatVisualViewportChangeDetail,
} from "./use-visual-viewport-chat-bottom";

/** Space kept between the field and the edge of what is visible. */
const REVEAL_MARGIN = 8;

function acceptsText(element: Element | null): element is HTMLElement {
  if (element instanceof HTMLTextAreaElement) return true;
  if (element instanceof HTMLInputElement) {
    return !["button", "checkbox", "color", "file", "hidden", "radio", "range", "reset", "submit"].includes(
      element.type,
    );
  }
  return element instanceof HTMLElement && element.isContentEditable;
}

/**
 * Scroll the scroll areas between `field` and `root` (never the page) so the field sits in
 * the part of the screen the keyboard leaves visible, moving each area as little as it can.
 * ponytail: this reveals the field, not its caret. A field taller than the space left shows
 * from its top while the caret is at its start (where Edit and Write leave it) or when it
 * reaches past both edges, otherwise from its nearer edge, and the browser scrolls to the
 * caret once you type. Upgrade path: measure the caret with a mirror element and reveal
 * that line instead.
 */
function revealFieldAboveKeyboard(field: HTMLElement, root: HTMLElement): void {
  const viewport = window.visualViewport;
  const screenTop = viewport?.offsetTop ?? 0;
  const screenBottom = screenTop + (viewport?.height ?? window.innerHeight);
  const caretAtStart = "selectionStart" in field && field.selectionStart === 0;
  for (let area = field.parentElement; area && root.contains(area); area = area.parentElement) {
    if (area.scrollHeight <= area.clientHeight || !/auto|scroll/.test(getComputedStyle(area).overflowY)) continue;
    const frame = area.getBoundingClientRect();
    const top = Math.max(frame.top + area.clientTop, screenTop) + REVEAL_MARGIN;
    const bottom = Math.min(frame.top + area.clientTop + area.clientHeight, screenBottom) - REVEAL_MARGIN;
    const box = field.getBoundingClientRect();
    const above = box.top < top;
    const below = box.bottom > bottom;
    if (!above && !below) continue; // already in view
    // Like scrollIntoView "nearest": a field that fits shows whole, a taller one from its nearer edge.
    const fits = box.height <= bottom - top;
    const fromTop = fits ? above : below || caretAtStart;
    area.scrollTop += fromTop ? box.top - top : box.bottom - bottom;
  }
}

/**
 * Keep whichever text field is being edited visible when the on-screen
 * keyboard opens or grows and shrinks the space around it. Mounted once by
 * AppShell, so every panel, dialog and window gets it without opting in.
 * Scrolling a panel yourself afterwards is left alone.
 */
export function useKeepFocusedFieldAboveKeyboard(): void {
  useEffect(() => {
    let revealedField: Element | null = null;
    let revealedHeight = Number.POSITIVE_INFINITY;
    let frame = 0;
    let settleFrame = 0;

    const handleViewportChange = (event: Event) => {
      const detail = (event as CustomEvent<ChatVisualViewportChangeDetail>).detail;
      const field = document.activeElement;
      // Inline message editors are aligned by useKeepLatestChatMessageVisible, under the floating chat controls.
      if (!detail?.keyboardOpen || !acceptsText(field) || field.closest("[data-chat-message-editor]")) {
        revealedField = null;
        revealedHeight = Number.POSITIVE_INFINITY;
        return;
      }
      if (field === revealedField && detail.height >= revealedHeight) return;
      revealedField = field;
      revealedHeight = detail.height;
      const reveal = () => {
        if (document.activeElement === field) revealFieldAboveKeyboard(field, document.body);
      };
      cancelAnimationFrame(frame);
      cancelAnimationFrame(settleFrame);
      // Let the panel take its keyboard size first, then check again once layout settles.
      frame = requestAnimationFrame(() => {
        reveal();
        settleFrame = requestAnimationFrame(reveal);
      });
    };

    window.addEventListener(CHAT_VISUAL_VIEWPORT_CHANGE_EVENT, handleViewportChange);
    return () => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(settleFrame);
      window.removeEventListener(CHAT_VISUAL_VIEWPORT_CHANGE_EVENT, handleViewportChange);
    };
  }, []);
}
