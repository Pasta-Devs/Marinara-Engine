import { useEffect, useState, type RefObject } from "react";

/**
 * Marks <html data-<flag>="true"> while another surface (Professor Mari, an editor, a full panel) sits on top of
 * the element, or the element is hidden. CSS uses it to stop ambient animations nobody can see: on phones they
 * kept a CPU core 40-60% busy under covering screens.
 *
 * Event driven, no polling: DOM changes and resizes schedule one cheap hit test (a few elementFromPoint calls),
 * plus a trailing check so slide-in panels are judged after their transition.
 */
export function useCoveredSurfaceFlag(ref: RefObject<HTMLElement | null>, datasetKey: string) {
  useEffect(() => {
    const root = document.documentElement;
    const stop = watchCovered(
      () => ref.current,
      (covered) => {
        if (covered) root.dataset[datasetKey] = "true";
        else delete root.dataset[datasetKey];
      },
    );
    return () => {
      stop();
      delete root.dataset[datasetKey];
    };
  }, [ref, datasetKey]);
}

/**
 * Whether something covers the element (or it's hidden). A layer that doesn't take clicks, such as the
 * weather canvas, is judged by its nearest ancestor that does.
 */
export function useSurfaceCovered(ref: RefObject<HTMLElement | null>, enabled = true): boolean {
  const [covered, setCovered] = useState(false);
  useEffect(() => {
    if (!enabled) {
      setCovered(false);
      return;
    }
    return watchCovered(() => {
      let element: HTMLElement | null = ref.current;
      while (element && element !== document.body && getComputedStyle(element).pointerEvents === "none") {
        element = element.parentElement;
      }
      return element;
    }, setCovered);
  }, [ref, enabled]);
  return enabled && covered;
}

function watchCovered(getElement: () => HTMLElement | null, onChange: (covered: boolean) => void) {
  let settleTimer: number | null = null;
  let trailingTimer: number | null = null;

  const isCovered = () => {
    const element = getElement();
    if (!element || !element.isConnected) return true;
    const rect = element.getBoundingClientRect();
    const left = Math.max(rect.left, 0);
    const right = Math.min(rect.right, window.innerWidth);
    const top = Math.max(rect.top, 0);
    const bottom = Math.min(rect.bottom, window.innerHeight);
    if (right - left < 2 || bottom - top < 2) return true;
    const xs = [0.25, 0.5, 0.75].map((f) => left + (right - left) * f);
    const ys = [0.25, 0.5, 0.75].map((f) => top + (bottom - top) * f);
    for (const x of xs) {
      for (const y of ys) {
        const hit = document.elementFromPoint(x, y);
        if (hit && element.contains(hit)) return false;
      }
    }
    return true;
  };

  const check = () => {
    settleTimer = null;
    onChange(isCovered());
  };

  const schedule = () => {
    if (settleTimer === null) settleTimer = window.setTimeout(check, 120);
    if (trailingTimer !== null) window.clearTimeout(trailingTimer);
    trailingTimer = window.setTimeout(() => {
      trailingTimer = null;
      check();
    }, 600);
  };

  check();
  const observer = new MutationObserver(schedule);
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class", "hidden", "data-state", "aria-hidden", "open"],
  });
  window.addEventListener("resize", schedule);
  document.addEventListener("visibilitychange", schedule);

  return () => {
    observer.disconnect();
    window.removeEventListener("resize", schedule);
    document.removeEventListener("visibilitychange", schedule);
    if (settleTimer !== null) window.clearTimeout(settleTimer);
    if (trailingTimer !== null) window.clearTimeout(trailingTimer);
  };
}
