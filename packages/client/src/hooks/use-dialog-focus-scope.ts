import { useEffect, type RefObject } from "react";

const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export function useDialogFocusScope(
  open: boolean,
  containerRef: RefObject<HTMLElement | null>,
  initialFocusRef?: RefObject<HTMLElement | null>,
  restoreFocusRef?: RefObject<HTMLElement | null>,
  ownedPortalSelector?: string,
) {
  useEffect(() => {
    if (!open) return;

    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const restoreTarget = restoreFocusRef?.current ?? opener;
    const focusInitial = window.requestAnimationFrame(() => {
      const container = containerRef.current;
      if (!container) return;
      const roots = [
        container,
        ...(ownedPortalSelector ? Array.from(document.querySelectorAll<HTMLElement>(ownedPortalSelector)) : []),
      ];
      if (roots.some((root) => root.contains(document.activeElement))) return;
      initialFocusRef?.current?.focus();
      if (roots.some((root) => root.contains(document.activeElement))) return;
      const fallback =
        container.querySelector<HTMLElement>("[data-autofocus]") ??
        container.querySelector<HTMLElement>(FOCUSABLE_SELECTOR) ??
        container;
      fallback.focus();
    });

    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const container = containerRef.current;
      if (!container) return;
      const roots = [
        container,
        ...(ownedPortalSelector ? Array.from(document.querySelectorAll<HTMLElement>(ownedPortalSelector)) : []),
      ];
      const focusable = roots
        .flatMap((root) => Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)))
        .filter(
          (element) =>
            !element.hidden && element.getAttribute("aria-hidden") !== "true" && element.getClientRects().length > 0,
        );
      if (focusable.length === 0) {
        event.preventDefault();
        container.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (!roots.some((root) => root.contains(active))) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", trapFocus);
    return () => {
      window.cancelAnimationFrame(focusInitial);
      document.removeEventListener("keydown", trapFocus);
      window.requestAnimationFrame(() => restoreTarget?.focus());
    };
  }, [containerRef, initialFocusRef, open, ownedPortalSelector, restoreFocusRef]);
}
