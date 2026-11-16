import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent, type RefObject } from "react";
import { isModalOverlayOpen } from "../../lib/modal-overlay-registry";

const TEXT_INPUT_TYPES = new Set(["", "text", "search", "email", "url", "tel", "password", "number"]);

function ownsEscape(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.matches('[aria-expanded="true"]') || target.closest('[role="menu"], [role="listbox"], [role="dialog"]'))
    return true;
  if (target instanceof HTMLTextAreaElement) return target.value.length > 0;
  if (target instanceof HTMLInputElement && TEXT_INPUT_TYPES.has(target.type)) return target.value.length > 0;
  return target.isContentEditable;
}

export function usePanelKeyboardFocus({
  open,
  panelKey,
  containerRef,
  toggleSelector,
  onClose,
}: {
  open: boolean;
  panelKey?: string;
  containerRef: RefObject<HTMLElement | null>;
  toggleSelector: string;
  onClose: () => void;
}) {
  const openerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const active = document.activeElement;
    if (!(active instanceof HTMLElement) || !active.closest('[data-component="TopBar"]')) return;
    openerRef.current = active;
    let attempts = 0;
    let timer = 0;
    const tryFocus = () => {
      const container = containerRef.current;
      if (!container) return;
      container.focus({ preventScroll: true });
      if (document.activeElement !== container && !container.contains(document.activeElement) && attempts++ < 8) {
        timer = window.setTimeout(tryFocus, 60);
      }
    };
    const frame = window.requestAnimationFrame(tryFocus);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [open, panelKey, containerRef]);

  useEffect(() => {
    if (open) return;
    const opener = openerRef.current;
    if (!opener) return;
    const active = document.activeElement;
    const container = containerRef.current;
    if (active === document.body || (container && active && container.contains(active))) {
      if (document.contains(opener)) opener.focus({ preventScroll: true });
    }
    openerRef.current = null;
  }, [open, containerRef]);

  const onKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key !== "Escape" || event.defaultPrevented || event.nativeEvent.isComposing) return;
    if (isModalOverlayOpen() || ownsEscape(event.target)) return;
    // React portals (pickers rendered on <body>) bubble here too; their Escape is theirs to handle.
    if (!event.currentTarget.contains(event.target as Node)) return;
    event.preventDefault();
    onClose();
    // The first match on screen: a phone hides some top-bar toggles and lists them in More instead.
    const opener =
      openerRef.current && document.contains(openerRef.current)
        ? openerRef.current
        : Array.from(document.querySelectorAll<HTMLElement>(toggleSelector)).find((element) =>
            element.checkVisibility ? element.checkVisibility() : element.offsetParent !== null,
          );
    window.requestAnimationFrame(() => opener?.focus({ preventScroll: true }));
  };

  return { onKeyDown };
}
