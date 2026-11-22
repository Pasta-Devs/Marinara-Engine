// ──────────────────────────────────────────────
// Menus: one keyboard behaviour for every ⋯ and right-click menu
// ──────────────────────────────────────────────
// QC Nov 21 (A11Y1-A11Y3): the message ⋯, editor ⋯, tab and rail menus opened without moving focus,
// ignored the arrow keys, and Escape dropped focus on <body>. ui/ContextMenu and the top bar's ⋯
// already did it right; this is that behaviour, shared (WAI-ARIA menu button pattern):
// - Enter, Space or ArrowDown on the button opens the menu on its first item, ArrowUp on its last.
// - ArrowDown/ArrowUp move between items (wrapping), Home/End jump to the ends.
// - Escape closes the menu and puts focus back on its button; Tab closes it and moves on from the button.
// - A mouse click opens the menu without moving focus (no focus ring under the pointer).
import { useCallback, useEffect, useLayoutEffect, useRef, type KeyboardEvent, type MouseEvent } from "react";

// The button of the latest click, and whether the keyboard pressed it (Enter/Space clicks have detail 0), for
// menus whose opener only gets a bare onClick.
let lastClick: { opener: HTMLElement | null; keyboard: boolean } = { opener: null, keyboard: false };
if (typeof document !== "undefined") {
  document.addEventListener(
    "click",
    (event) => {
      const target =
        event.target instanceof Element ? event.target.closest<HTMLElement>("button, [role='button']") : null;
      lastClick = { opener: target, keyboard: event.detail === 0 };
    },
    true,
  );
}

/** Read inside an onClick: the button just clicked, and whether it was pressed from the keyboard. */
export function menuOpenerFromClick() {
  return lastClick;
}

/** A context menu asked for from the keyboard (Shift+F10, the menu key) rather than a right click. */
export function isKeyboardContextMenu(event: { nativeEvent: Event; clientX: number; clientY: number }) {
  const native = event.nativeEvent as Partial<PointerEvent>;
  if (typeof native.pointerType === "string") return native.pointerType === "";
  return event.clientX === 0 && event.clientY === 0;
}

/**
 * Shift+F10 or the menu key on a message's buttons opens that message's ⋯ menu, focused on its first item
 * (QC Nov 22 K7). A right click with the mouse keeps the browser's own menu (copy, spelling).
 */
export function openMessageMoreFromMenuKey(event: {
  nativeEvent: Event;
  clientX: number;
  clientY: number;
  currentTarget: EventTarget & HTMLElement;
  preventDefault: () => void;
  stopPropagation: () => void;
}) {
  if (!isKeyboardContextMenu(event)) return;
  const message = event.currentTarget.closest<HTMLElement>("[data-message-id]") ?? event.currentTarget;
  const more =
    event.currentTarget.querySelector<HTMLButtonElement>("button[data-message-more]") ??
    message.querySelector<HTMLButtonElement>("button[data-message-more]");
  if (!more) return;
  event.preventDefault();
  event.stopPropagation();
  if (more.getAttribute("aria-expanded") === "true") return;
  // A click with detail 0 is the keyboard path: the menu opens with focus on its first item.
  more.click();
}

const ITEM_SELECTOR =
  '[role="menuitem"], [role="menuitemradio"], [role="menuitemcheckbox"], button, a[href], input:not([type="hidden"])';

/** The enabled, visible items of a menu, in order. */
export function menuItems(menu: HTMLElement | null): HTMLElement[] {
  if (!menu) return [];
  return Array.from(menu.querySelectorAll<HTMLElement>(ITEM_SELECTOR)).filter(
    (item) =>
      !item.matches(":disabled, [aria-disabled='true']") &&
      !item.closest("[hidden], [inert], [aria-hidden='true']") &&
      item.getClientRects().length > 0,
  );
}

/** Plain buttons in a menu are its items: screen readers then say "menu item, 2 of 5". */
function markItems(menu: HTMLElement) {
  for (const item of menuItems(menu)) {
    if (item instanceof HTMLButtonElement && !item.hasAttribute("role")) item.setAttribute("role", "menuitem");
  }
}

export function focusMenuItem(menu: HTMLElement | null, which: "first" | "last") {
  const items = menuItems(menu);
  const checked = which === "first" ? items.find((item) => item.getAttribute("aria-checked") === "true") : undefined;
  (checked ?? (which === "first" ? items[0] : items[items.length - 1]))?.focus({ preventScroll: true });
}

/**
 * Moves focus between a menu's items for one key press. Returns true when the key was a menu key
 * (the caller then stops it), false otherwise.
 */
export function moveMenuFocus(menu: HTMLElement | null, key: string): boolean {
  const step = { ArrowDown: 1, ArrowUp: -1, Home: 0, End: 0 }[key];
  if (step === undefined || !menu) return false;
  const items = menuItems(menu);
  if (items.length === 0) return false;
  const at = items.findIndex((item) => item === document.activeElement || item.contains(document.activeElement));
  const next =
    key === "Home"
      ? 0
      : key === "End"
        ? items.length - 1
        : at < 0
          ? step > 0
            ? 0
            : items.length - 1
          : (at + step + items.length) % items.length;
  items[next]?.focus({ preventScroll: true });
  return true;
}

type Options = {
  open: boolean;
  /** Opens the menu (ArrowDown/ArrowUp on its button). Without it those keys do nothing while closed. */
  onOpen?: () => void;
  onClose: () => void;
  /**
   * Also take the arrow keys while focus is outside the menu (a right-click menu opened with the mouse),
   * except from a text field. Off for menus that sit next to a page the arrows also scroll.
   */
  anywhere?: boolean;
  /** For a menu component that is only mounted while open: the button that opened it. */
  trigger?: HTMLElement | null;
  /** For a menu component that is only mounted while open: where focus goes when it mounts. */
  initialFocus?: "first" | "last" | null;
};

export function useMenuKeyboard<TMenu extends HTMLElement = HTMLDivElement>({
  open,
  onOpen,
  onClose,
  anywhere = false,
  trigger,
  initialFocus = null,
}: Options) {
  const menuRef = useRef<TMenu | null>(null);
  const triggerRef = useRef<HTMLElement | null>(trigger ?? null);
  if (trigger) triggerRef.current = trigger;
  /** Where focus goes once the menu shows: set when it is opened from the keyboard. */
  const focusOnOpen = useRef<"first" | "last" | null>(null);
  const initialFocusRef = useRef(initialFocus);
  initialFocusRef.current = initialFocus;
  const hadFocus = useRef(false);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useLayoutEffect(() => {
    if (!open) return;
    if (menuRef.current) markItems(menuRef.current);
    const which = focusOnOpen.current ?? initialFocusRef.current;
    focusOnOpen.current = null;
    // A menu that places itself first (hidden until measured, or fading in), or that is drawn a moment later,
    // cannot take focus yet: try for a few frames until it can.
    let frame = 0;
    let tries = 10;
    const attempt = () => {
      const current = menuRef.current;
      if (current) markItems(current);
      if (!which) return;
      if (current) focusMenuItem(current, which);
      if (!current?.contains(document.activeElement) && tries-- > 0) frame = requestAnimationFrame(attempt);
    };
    frame = requestAnimationFrame(attempt);
    return () => cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onFocusIn = (event: FocusEvent) => {
      if (menuRef.current?.contains(event.target as Node)) hadFocus.current = true;
    };
    const onKey = (event: globalThis.KeyboardEvent) => {
      const menu = menuRef.current;
      if (!menu || event.altKey || event.ctrlKey || event.metaKey || event.defaultPrevented) return;
      const active = document.activeElement;
      const inside = Boolean(active && menu.contains(active));
      if (event.key === "Escape") {
        if (!inside && !anywhere && active !== triggerRef.current) return;
        // The menu's alone: the panel or dialog under it stays open.
        event.preventDefault();
        event.stopPropagation();
        hadFocus.current = false;
        closeRef.current();
        triggerRef.current?.focus({ preventScroll: true });
        return;
      }
      if (event.key === "Tab") {
        if (!inside) return;
        // Tab leaves the menu: close it and carry on from its button, as if the menu were never there.
        hadFocus.current = false;
        triggerRef.current?.focus({ preventScroll: true });
        closeRef.current();
        return;
      }
      if (!inside) {
        if (!anywhere && active !== triggerRef.current) return;
        if (active instanceof HTMLElement && active.matches("input, textarea, select, [contenteditable]")) return;
      }
      // A text field inside the menu (a search box) keeps Home/End for its caret.
      if (inside && active instanceof HTMLInputElement && (event.key === "Home" || event.key === "End")) return;
      if (moveMenuFocus(menu, event.key)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    document.addEventListener("focusin", onFocusIn);
    window.addEventListener("keydown", onKey, true);
    if (menuRef.current?.contains(document.activeElement)) hadFocus.current = true;
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      window.removeEventListener("keydown", onKey, true);
      // Closed (or unmounted) with focus inside, after an item ran: that focus went with the menu, so hand it
      // back to the button instead of leaving it on <body>.
      if (hadFocus.current) {
        hadFocus.current = false;
        const active = document.activeElement;
        if (!active || active === document.body || !active.isConnected)
          triggerRef.current?.focus({ preventScroll: true });
      }
    };
  }, [anywhere, open]);

  /** Put on the button's onClick (before toggling): a keyboard click (Enter/Space) opens on the first item. */
  const noteOpener = useCallback((event: MouseEvent<HTMLElement>) => {
    triggerRef.current = event.currentTarget;
    focusOnOpen.current = event.detail === 0 ? "first" : null;
  }, []);

  /** The button's onKeyDown: ArrowDown/ArrowUp open the menu on its first/last item. */
  const onTriggerKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      triggerRef.current = event.currentTarget;
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      if (open) {
        event.preventDefault();
        focusMenuItem(menuRef.current, event.key === "ArrowDown" ? "first" : "last");
        return;
      }
      if (!onOpen) return;
      event.preventDefault();
      focusOnOpen.current = event.key === "ArrowDown" ? "first" : "last";
      onOpen();
    },
    [onOpen, open],
  );

  return {
    menuRef,
    triggerRef,
    noteOpener,
    /** Spread on the button that opens the menu. */
    triggerProps: {
      "aria-haspopup": "menu" as const,
      "aria-expanded": open,
      onKeyDown: onTriggerKeyDown,
    },
  };
}
