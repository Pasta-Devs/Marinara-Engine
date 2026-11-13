import { useEffect, type RefObject } from "react";
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
 * Keep the text field being edited inside `rootRef` (a panel, dialog or window) visible when the
 * on-screen keyboard opens or grows and shrinks the space around it. Scrolling the panel
 * yourself afterwards is left alone.
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
      if (!detail?.keyboardOpen || !acceptsText(field) || !panel?.contains(field)) {
        revealedField = null;
        revealedHeight = Number.POSITIVE_INFINITY;
        return;
      }
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

/** Fields with their own keyboard handling: the chat transcript and composer (useKeepLatestChatMessageVisible)
 *  and Prof Mari's sheet, which rides above the keyboard by CSS. */
const OWN_KEYBOARD_HANDLING = '[data-chat-scroll], [data-chat-composer], [data-component="GlobalOmnibar"]';

function keyboardIsOpen(): boolean {
  return document.documentElement.hasAttribute("data-mari-software-keyboard-open");
}

/** Scroll the areas around a growing field so its last line (where the caret is while typing at the end) stays visible. */
function revealFieldEndAboveKeyboard(field: HTMLElement): void {
  const viewport = window.visualViewport;
  const screenBottom = (viewport?.offsetTop ?? 0) + (viewport?.height ?? window.innerHeight) - REVEAL_MARGIN;
  for (let area = field.parentElement; area && area !== document.body; area = area.parentElement) {
    if (area.scrollHeight <= area.clientHeight || !/auto|scroll/.test(getComputedStyle(area).overflowY)) continue;
    const frame = area.getBoundingClientRect();
    const bottom =
      Math.min(frame.top + area.clientTop + area.clientHeight, screenBottom + REVEAL_MARGIN) - REVEAL_MARGIN;
    const box = field.getBoundingClientRect();
    if (box.bottom > bottom) area.scrollTop += box.bottom - bottom;
  }
}

/**
 * The same, app-wide: any text field in a scrolling page, panel or dialog (the card, persona and
 * lorebook editors among them) stays visible when the keyboard opens, when the next field is tapped
 * while it is open, and while a long text grows past the keyboard line.
 */
export function useKeepAnyFocusedFieldAboveKeyboard(): void {
  useEffect(() => {
    let frame = 0;
    let settleFrame = 0;
    const eligible = (field: Element | null): field is HTMLElement =>
      acceptsText(field) && !field.closest(OWN_KEYBOARD_HANDLING);
    const schedule = (field: HTMLElement) => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(settleFrame);
      const reveal = () => {
        if (document.activeElement === field && keyboardIsOpen()) revealFieldAboveKeyboard(field, document.body);
      };
      frame = requestAnimationFrame(() => {
        reveal();
        settleFrame = requestAnimationFrame(reveal);
      });
    };
    let lastHeight = Number.POSITIVE_INFINITY;
    let lastField: Element | null = null;
    const handleViewportChange = (event: Event) => {
      const detail = (event as CustomEvent<ChatVisualViewportChangeDetail>).detail;
      const field = document.activeElement;
      if (!detail?.keyboardOpen || !eligible(field)) {
        lastHeight = Number.POSITIVE_INFINITY;
        lastField = null;
        return;
      }
      // Only when the space shrinks (or a new field): growing room never hides the field.
      if (field === lastField && detail.height >= lastHeight) return;
      lastField = field;
      lastHeight = detail.height;
      schedule(field);
    };
    const handleFocusIn = (event: FocusEvent) => {
      const field = event.target as Element | null;
      if (!keyboardIsOpen() || !eligible(field)) return;
      lastField = field;
      schedule(field);
    };
    const handleInput = (event: Event) => {
      const field = event.target as Element | null;
      if (!keyboardIsOpen() || !eligible(field) || !(field instanceof HTMLTextAreaElement)) return;
      if (field.selectionEnd !== field.value.length) return;
      requestAnimationFrame(() => {
        if (document.activeElement === field) revealFieldEndAboveKeyboard(field);
      });
    };
    window.addEventListener(CHAT_VISUAL_VIEWPORT_CHANGE_EVENT, handleViewportChange);
    document.addEventListener("focusin", handleFocusIn);
    document.addEventListener("input", handleInput);
    return () => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(settleFrame);
      window.removeEventListener(CHAT_VISUAL_VIEWPORT_CHANGE_EVENT, handleViewportChange);
      document.removeEventListener("focusin", handleFocusIn);
      document.removeEventListener("input", handleInput);
    };
  }, []);
}
