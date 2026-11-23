// ──────────────────────────────────────────────
// Keep a flex list's DOM order the same as its CSS `order` (QC Nov 22 AX6)
// ──────────────────────────────────────────────
// Chat settings places its sections with `order` (the built-in order per layout, then the saved Edit
// arrangement as a generated style sheet). Tab and screen readers follow the DOM, so they walked the classic
// order while the eye saw another. This moves the children into their visual order whenever React adds one or
// an order changes. React keeps working on moved siblings (it inserts and removes by node, not by position), and
// any later insert is sorted again. A display:contents slot (portaled sections) sorts its own children.
import { useEffect } from "react";

function orderOf(element: Element): number {
  const value = Number.parseFloat(getComputedStyle(element).order);
  return Number.isFinite(value) ? value : 0;
}

function isContentsSlot(element: Element): element is HTMLElement {
  return element instanceof HTMLElement && element.dataset.ovContents !== undefined;
}

/** Sorts `container`'s children by computed `order` (ties keep their DOM order). Returns whether anything moved. */
export function sortChildrenByCssOrder(container: Element): boolean {
  const children = Array.from(container.children);
  if (children.length < 2) return false;
  let moved = false;
  const keyed = children.map((element, index) => {
    if (isContentsSlot(element)) {
      moved = sortChildrenByCssOrder(element) || moved;
      const inner = Array.from(element.children).map(orderOf);
      return { element, index, order: inner.length ? Math.min(...inner) : 0 };
    }
    return { element, index, order: orderOf(element) };
  });
  const sorted = [...keyed].sort((a, b) => a.order - b.order || a.index - b.index);
  if (sorted.every((entry, index) => entry.element === children[index])) return moved;
  const focused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  sorted.forEach((entry, index) => {
    const current = container.children[index];
    if (current !== entry.element) container.insertBefore(entry.element, current ?? null);
  });
  // Moving a node blurs what is focused inside it; put focus back where it was.
  if (focused && focused.isConnected && document.activeElement !== focused) focused.focus({ preventScroll: true });
  return true;
}

/**
 * While `container` is mounted, keep its children in CSS order. `revision` re-sorts when something outside the
 * list changes the order (a saved arrangement's style sheet).
 */
export function useDomOrderFollowsCss(container: HTMLElement | null, revision?: unknown) {
  useEffect(() => {
    if (!container || typeof MutationObserver === "undefined") return;
    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => sortChildrenByCssOrder(container));
    };
    // Moving nodes changes nothing on screen: CSS order already placed them there.
    sortChildrenByCssOrder(container);
    const observer = new MutationObserver(schedule);
    observer.observe(container, { childList: true });
    for (const slot of Array.from(container.children).filter(isContentsSlot)) {
      observer.observe(slot, { childList: true });
    }
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [container, revision]);
}
