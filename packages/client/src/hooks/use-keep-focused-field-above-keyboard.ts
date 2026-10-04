import { useEffect, type RefObject } from "react";
import {
  CHAT_VISUAL_VIEWPORT_CHANGE_EVENT,
  type ChatVisualViewportChangeDetail,
} from "./use-visual-viewport-chat-bottom";

/** Space kept between the field and the edge of what is visible. */
const REVEAL_MARGIN = 8;
/** Set on the root while the keyboard is open for a field outside its [data-chat-floating-footer] (see globals.css). */
const KEYBOARD_HIDES_FOOTER_ATTRIBUTE = "data-keyboard-hides-footer";

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
 * Keep the text field being edited inside `rootRef` (a panel or dialog) visible when the
 * on-screen keyboard opens or grows and shrinks the space around it. Scrolling the panel
 * yourself afterwards is left alone. While the keyboard is open, the root's pinned footer is
 * hidden unless the field is in it. That choice follows the last field typed in, not live focus,
 * so a tap that moves focus to a button does not show or hide the footer under the finger.
 */
export function useKeepFocusedFieldAboveKeyboard(rootRef: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    let revealedField: Element | null = null;
    let revealedHeight = Number.POSITIVE_INFINITY;
    let frame = 0;
    let settleFrame = 0;

    const handleViewportChange = (event: Event) => {
      const detail = (event as CustomEvent<ChatVisualViewportChangeDetail>).detail;
      const field = document.activeElement;
      const panel = rootRef.current;
      if (!detail?.keyboardOpen) panel?.removeAttribute(KEYBOARD_HIDES_FOOTER_ATTRIBUTE);
      if (!detail?.keyboardOpen || !acceptsText(field) || !panel?.contains(field)) {
        revealedField = null;
        revealedHeight = Number.POSITIVE_INFINITY;
        return;
      }
      panel.toggleAttribute(KEYBOARD_HIDES_FOOTER_ATTRIBUTE, !field.closest("[data-chat-floating-footer]"));
      if (field === revealedField && detail.height >= revealedHeight) return;
      revealedField = field;
      revealedHeight = detail.height;
      const reveal = () => {
        const root = rootRef.current;
        if (root && document.activeElement === field) revealFieldAboveKeyboard(field, root);
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
  }, [rootRef]);
}
