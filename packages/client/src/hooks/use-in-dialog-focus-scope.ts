import { useEffect, type KeyboardEvent, type RefObject } from "react";

const FOCUSABLE =
  'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * A native radio group is one Tab stop, not one per radio. Keeps the checked radio in each
 * `name` group (or the first one, if none is checked yet) and drops its unchecked siblings.
 */
function tabStops(scope: HTMLElement | null): HTMLElement[] {
  const all = Array.from(scope?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
  const checkedGroups = new Set(
    all
      .filter((el): el is HTMLInputElement => el instanceof HTMLInputElement && el.type === "radio" && el.checked)
      .map((el) => el.name),
  );
  const firstSeenGroups = new Set<string>();
  return all.filter((el) => {
    if (!(el instanceof HTMLInputElement) || el.type !== "radio" || el.checked) return true;
    if (checkedGroups.has(el.name)) return false;
    if (firstSeenGroups.has(el.name)) return false;
    firstSeenGroups.add(el.name);
    return true;
  });
}

/**
 * Focus for a view or popover that lives inside the omnibar dialog instead of being its own `Modal`:
 * focus moves in when it opens and back to the opener when it closes, Tab cycles inside it, and Escape
 * closes only it. Handled keys are marked with `preventDefault`, which the omnibar's own key handling
 * (Escape leaves the pane or closes the dialog, Tab cycles the whole panel) skips, so a second Escape
 * is needed to reach the dialog.
 */
export function useInDialogFocusScope(scopeRef: RefObject<HTMLElement | null>, onClose: () => void, open = true) {
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const scope = scopeRef.current;
    tabStops(scope)[0]?.focus();
    return () => {
      // Closed by a click somewhere else: leave focus where that click put it.
      const active = document.activeElement;
      if (!active || active === document.body || scope?.contains(active)) opener?.focus();
    };
  }, [open, scopeRef]);

  return (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = tabStops(scopeRef.current);
    if (focusable.length === 0) return;
    const index = focusable.indexOf(document.activeElement as HTMLElement);
    const next = event.shiftKey
      ? index <= 0
        ? focusable.length - 1
        : index - 1
      : index === focusable.length - 1
        ? 0
        : index + 1;
    event.preventDefault();
    focusable[next]?.focus();
  };
}
