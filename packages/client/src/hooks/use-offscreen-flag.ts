import { useCallback, useRef } from "react";

/**
 * A ref callback that marks the element data-offscreen="true" while none of it is on screen (scrolled out of
 * view, as the Home Professor often is on a phone), so CSS can stop its endless animations there.
 */
export function useOffscreenFlag<T extends HTMLElement>() {
  const observerRef = useRef<IntersectionObserver | null>(null);
  return useCallback((element: T | null) => {
    observerRef.current?.disconnect();
    observerRef.current = null;
    if (!element || typeof IntersectionObserver !== "function") return;
    const observer = new IntersectionObserver((entries) => {
      const entry = entries[entries.length - 1];
      if (!entry) return;
      if (entry.isIntersecting) delete element.dataset.offscreen;
      else element.dataset.offscreen = "true";
    });
    observer.observe(element);
    observerRef.current = observer;
  }, []);
}
