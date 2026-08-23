// #5073: focus management for the self-contained Mari modals (createPortal, not the app Modal).
// On open: remember the trigger, move focus into the dialog, trap Tab / Shift+Tab within it, and close
// on Escape. On close: restore focus to the trigger. `aria-modal` alone does NOT trap focus, so
// keyboard users could otherwise reach controls behind the dialog.
//
// The effect is keyed on `open` ONLY. `onClose` is read through a ref so a fresh inline `onClose`
// (recomputed every parent render) can't re-run the effect and steal focus mid-interaction.
import { useEffect, useRef } from "react";

export function useModalFocusTrap<T extends HTMLElement>(open: boolean, onClose: () => void) {
  const dialogRef = useRef<T>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const container = dialogRef.current;
    container?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !container) return;
      const focusable = Array.from(
        container.querySelectorAll<HTMLElement>(
          'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => !el.hasAttribute("disabled") && el.offsetParent !== null);
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      const active = document.activeElement as HTMLElement | null;
      if (event.shiftKey && (active === first || active === container)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      previouslyFocused.current?.focus?.();
    };
  }, [open]);

  return dialogRef;
}
