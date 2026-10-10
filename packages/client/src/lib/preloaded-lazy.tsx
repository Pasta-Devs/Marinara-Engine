import { lazy, useState, type ComponentType } from "react";

/**
 * `lazy()` that renders its component directly once `preload()` has loaded the code. A lazy component
 * suspends on its first render even when its code is already there, and React then holds the revealed
 * Suspense boundary back for its 300 ms fallback throttle, so a preloaded dialog still opened 300 ms late.
 * Picked once per mount: a load that lands while it is mounted never swaps (and so remounts) it.
 */
export function preloadedLazy<P extends object>(load: () => Promise<ComponentType<P>>) {
  let loaded: ComponentType<P> | null = null;
  const preload = () => load().then((component) => (loaded = component));
  const Lazy = lazy(() => preload().then((component) => ({ default: component })));
  function PreloadedLazy(props: P) {
    const [Component] = useState<ComponentType<P>>(() => loaded ?? Lazy);
    return <Component {...props} />;
  }
  return Object.assign(PreloadedLazy, { preload });
}
