// ──────────────────────────────────────────────
// Hook: show an editor read-only
// Marks every text field inside `ref` read-only and disables its pickers,
// switches and checkboxes, also for fields that mount later (switching pages,
// expanding a section). Navigation buttons keep working, so the content can
// still be browsed. The server stays the real guard for anything missed.
// ──────────────────────────────────────────────
import { useEffect, type RefObject } from "react";

const TEXT_FIELDS =
  "textarea, input:not([type]), input[type='text'], input[type='number'], input[type='search'], input[type='url']";
const TOGGLES =
  "select, input[type='checkbox'], input[type='radio'], input[type='range'], [role='switch'], [role='slider']";

function lock(root: HTMLElement) {
  root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(TEXT_FIELDS).forEach((field) => {
    if (!field.readOnly) field.readOnly = true;
  });
  root.querySelectorAll<HTMLElement>(TOGGLES).forEach((control) => {
    if ("disabled" in control) (control as HTMLButtonElement).disabled = true;
    control.setAttribute("aria-disabled", "true");
  });
  root
    .querySelectorAll<HTMLElement>("[contenteditable='true']")
    .forEach((el) => el.setAttribute("contenteditable", "false"));
}

export function useReadOnlySubtree(ref: RefObject<HTMLElement | null>, active: boolean) {
  useEffect(() => {
    const root = ref.current;
    if (!active || !root) return;
    lock(root);
    let frame = 0;
    const observer = new MutationObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => lock(root));
    });
    observer.observe(root, { childList: true, subtree: true });
    // Nothing can be dragged into a new order either.
    const stopDrag = (event: Event) => event.preventDefault();
    root.addEventListener("dragstart", stopDrag, true);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      root.removeEventListener("dragstart", stopDrag, true);
    };
  }, [ref, active]);
}
