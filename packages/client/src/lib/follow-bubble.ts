// ──────────────────────────────────────────────
// A bar that hangs off a message (absolutely placed) follows the message bubble's edges, not the
// full row: themes and settings where bubbles don't fill the row keep the bar under the bubble.
// With `findAlign`, the bar's last button is centred under that element instead (Roleplay: the
// bottom bar's › lines up with the ⋯ above it, wherever a theme puts the top bar).
// With `placeTop`, the bar's vertical spot too (--ov-follow-top).
// Sets --ov-follow-left / --ov-follow-right (px from the bar's containing block) on the bar.
// ──────────────────────────────────────────────
import { useLayoutEffect, type RefObject } from "react";

export function useFollowBubble(
  ref: RefObject<HTMLElement | null>,
  findBubble: (bar: HTMLElement) => HTMLElement | null,
  enabled: boolean,
  /** Changes when the bar may have mounted or moved (e.g. it only renders while shown). */
  trigger?: unknown,
  findAlign?: (bar: HTMLElement) => HTMLElement | null,
  /** Where the bar's top goes, in px from the containing block's padding box (sets --ov-follow-top). */
  placeTop?: (bar: HTMLElement, bubble: HTMLElement) => number | null,
) {
  useLayoutEffect(() => {
    const bar = ref.current;
    if (!enabled || !bar || typeof ResizeObserver === "undefined") return;
    const bubble = findBubble(bar);
    const box = bar.offsetParent instanceof HTMLElement ? bar.offsetParent : null;
    if (!bubble || !box) return;
    const place = () => {
      const b = bubble.getBoundingClientRect();
      const p = box.getBoundingClientRect();
      const padLeft = p.left + box.clientLeft;
      const padRight = padLeft + box.clientWidth;
      const left = Math.max(0, Math.round(b.left - padLeft));
      let right = Math.max(0, Math.round(padRight - b.right));
      bar.style.setProperty("--ov-follow-left", `${left}px`);
      bar.style.setProperty("--ov-follow-right", `${right}px`);
      const target = findAlign?.(bar);
      const buttons = bar.querySelectorAll<HTMLElement>("button");
      const last = buttons[buttons.length - 1];
      if (target && last) {
        const t = target.getBoundingClientRect();
        const l = last.getBoundingClientRect();
        const delta = t.width && l.width ? Math.round((t.left + t.right) / 2 - (l.left + l.right) / 2) : 0;
        if (delta) {
          right = Math.max(0, right - delta);
          bar.style.setProperty("--ov-follow-right", `${right}px`);
        }
      }
      // After the sideways move, so the vertical spot can check what the bar would cover.
      const top = placeTop?.(bar, bubble);
      if (top != null) bar.style.setProperty("--ov-follow-top", `${Math.round(top - (p.top + box.clientTop))}px`);
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(bubble);
    observer.observe(box);
    // The top bar arms on hover, so line up again when the pointer comes in.
    const row = bar.closest<HTMLElement>("[data-message-id]");
    let frame = requestAnimationFrame(place);
    const later = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => (frame = requestAnimationFrame(place)));
    };
    row?.addEventListener("pointerenter", later);
    return () => {
      observer.disconnect();
      row?.removeEventListener("pointerenter", later);
      cancelAnimationFrame(frame);
    };
    // The finders are stable lookups; re-run only when the bar mounts or the setting changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref, enabled, trigger]);
}
