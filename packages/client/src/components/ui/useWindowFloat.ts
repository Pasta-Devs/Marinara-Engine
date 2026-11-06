import { useLayoutEffect, useState, type RefObject } from "react";

export type FloatBox = { top: number; left: number; right: number; bottom: number; width: number };

/**
 * A dropdown inside a popped-out window (a detached Chat settings section) would be clipped by the
 * window's scroll area. While `open`, this follows `anchorRef` on screen (scrolling, dragging,
 * resizing) and returns its box so the caller can portal the dropdown to the body with fixed
 * coordinates, over the chat. Returns null outside a popped-out window: the caller renders in place.
 */
export function useWindowFloat(anchorRef: RefObject<HTMLElement | null>, open: boolean): FloatBox | null {
  const [box, setBox] = useState<FloatBox | null>(null);
  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    if (!open || !anchor || !anchor.closest('.mari-window[data-detached="true"]')) {
      setBox(null);
      return;
    }
    let frame = 0;
    let last = "";
    const tick = () => {
      const rect = anchor.getBoundingClientRect();
      const key = `${rect.top}|${rect.left}|${rect.width}|${rect.height}`;
      if (key !== last) {
        last = key;
        setBox({ top: rect.top, left: rect.left, right: rect.right, bottom: rect.bottom, width: rect.width });
      }
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(frame);
  }, [anchorRef, open]);
  return box;
}

/** Above every floating window (they stack from 70) and below app dialogs. */
export const WINDOW_FLOAT_Z = 9000;
