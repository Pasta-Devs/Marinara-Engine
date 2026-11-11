import { useLayoutEffect, useRef, type DependencyList } from "react";

/**
 * Steps a segmented switch down until every segment's contents fit, whatever the sidebar width,
 * Display Size or theme font. Sets `data-fit` on the element (0 = everything shown, then each step
 * lets CSS drop one more thing, up to `maxLevel`). Runs synchronously against the DOM, so nothing
 * re-renders and nothing flickers; it measures again when the switch or any segment's contents
 * change size (resizing the sidebar, a theme swapping the font, a count gaining a digit).
 */
export function useSegmentedFit<T extends HTMLElement>(maxLevel: number, enabled: boolean, deps: DependencyList) {
  const ref = useRef<T>(null);
  const fitRef = useRef<() => void>(() => {});

  fitRef.current = () => {
    const el = ref.current;
    if (!el) return;
    if (!enabled) {
      delete el.dataset.fit;
      return;
    }
    const buttons = Array.from(el.children).filter((child): child is HTMLElement => child instanceof HTMLElement);
    const overflows = () =>
      buttons.some((button) => {
        const style = getComputedStyle(button);
        const gap = parseFloat(style.columnGap) || 0;
        const inner = button.clientWidth - (parseFloat(style.paddingLeft) || 0) - (parseFloat(style.paddingRight) || 0);
        let needed = 0;
        let shown = 0;
        for (const child of Array.from(button.children)) {
          if (!(child instanceof HTMLElement)) continue;
          const childStyle = getComputedStyle(child);
          if (childStyle.display === "none" || childStyle.position === "absolute") continue;
          needed +=
            child.getBoundingClientRect().width +
            (parseFloat(childStyle.marginLeft) || 0) +
            (parseFloat(childStyle.marginRight) || 0);
          shown += 1;
        }
        needed += gap * Math.max(0, shown - 1);
        return needed > inner + 0.5;
      });
    let level = 0;
    el.dataset.fit = "0";
    while (level < maxLevel && overflows()) {
      level += 1;
      el.dataset.fit = String(level);
    }
  };

  useLayoutEffect(() => {
    fitRef.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !enabled || typeof ResizeObserver === "undefined") return;
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => fitRef.current());
    });
    observer.observe(el);
    // Each segment's pieces too: a theme font or a count can change their size without the switch resizing.
    el.querySelectorAll("[data-fit-part]").forEach((part) => observer.observe(part));
    void document.fonts?.ready.then(() => fitRef.current());
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps]);

  return ref;
}
