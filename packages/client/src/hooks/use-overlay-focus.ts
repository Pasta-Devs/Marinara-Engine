// ──────────────────────────────────────────────
// Overlays: take focus, close on Escape, give focus back
// ──────────────────────────────────────────────
// QC Nov 21 (A11Y4, A11Y5, A11Y20): tour cards opened with focus on <body> and ignored Escape until you
// tabbed into them; the coachmark never closed with Escape; the hold sheet opened from the keyboard left
// focus behind it. One helper for all of them:
// - modal (a card that dims the page, a sheet): focus moves in, Tab stays inside, focus returns on close.
// - non-modal (a tip beside the control it explains): focus stays where it is; Escape still closes it.
import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";

const FOCUSABLE =
  'button:not(:disabled), [href], input:not(:disabled):not([type="hidden"]), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

export function focusableIn(root: HTMLElement | null): HTMLElement[] {
  if (!root) return [];
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (element) => !element.closest("[inert], [aria-hidden='true']") && element.getClientRects().length > 0,
  );
}

type Options = {
  /** Off while the overlay is hidden but still mounted. */
  active?: boolean;
  /** Escape closes it. Without it Escape is left alone; returning false also leaves this Escape alone. */
  onEscape?: () => boolean | void;
  /** Focus moves in, Tab is kept inside and focus returns on close. Default true. */
  modal?: boolean;
  /** What gets focus when it opens: a selector inside the overlay, else its first control. */
  initialFocus?: string;
  /** Focus moves in again whenever this changes (a tour's next step). */
  focusKey?: unknown;
};

export function useOverlayFocus(ref: RefObject<HTMLElement | null>, options: Options = {}) {
  const { active = true, modal = true, initialFocus, focusKey } = options;
  const escapeRef = useRef(options.onEscape);
  escapeRef.current = options.onEscape;

  useLayoutEffect(() => {
    if (!active || !modal) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const root = ref.current;
    if (root && !root.contains(document.activeElement)) {
      const wanted = initialFocus ? root.querySelector<HTMLElement>(initialFocus) : null;
      const target = wanted ?? focusableIn(root)[0] ?? root;
      if (target === root && !root.hasAttribute("tabindex")) root.setAttribute("tabindex", "-1");
      target.focus({ preventScroll: true });
    }
    return () => {
      // Closed with focus inside (or lost with it): back to where the person was.
      const now = document.activeElement;
      if (!previous?.isConnected) return;
      if (!now || now === document.body || !now.isConnected || root?.contains(now))
        previous.focus({ preventScroll: true });
    };
  }, [active, focusKey, initialFocus, modal, ref]);

  useEffect(() => {
    if (!active) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing) return;
      if (event.key === "Escape" && escapeRef.current) {
        // An open menu or window above this one gets the Escape first.
        const target = event.target instanceof Element ? event.target : null;
        const above = target?.closest('[role="menu"], [aria-modal="true"]');
        if (above && ref.current && !ref.current.contains(above) && !above.contains(ref.current)) return;
        if (escapeRef.current() === false) return;
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (event.key !== "Tab" || !modal) return;
      const root = ref.current;
      if (!root) return;
      const items = focusableIn(root);
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const at = items.indexOf(document.activeElement as HTMLElement);
      const leaving = event.shiftKey ? at <= 0 : at === items.length - 1 || at < 0;
      if (!leaving && root.contains(document.activeElement)) return;
      event.preventDefault();
      (event.shiftKey ? items[items.length - 1] : items[0])?.focus();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [active, modal, ref]);
}
