import { useEffect, useState, type ReactNode } from "react";

/**
 * A Suspense fallback that stays empty for its first `delay` ms. Pages whose code is already loading
 * (or loaded ahead) usually arrive within that, so a quick open never flashes "Loading…" (QC Nov 14 #2).
 */
export function DelayedFallback({ children, delay = 300 }: { children: ReactNode; delay?: number }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setShow(true), delay);
    return () => window.clearTimeout(timer);
  }, [delay]);
  return show ? <>{children}</> : null;
}
