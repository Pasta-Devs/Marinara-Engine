// ──────────────────────────────────────────────
// Lazy pages that open without a "Loading…" flash
//
// React.lazy suspends the first time a lazy component renders, even when its code
// was fetched in the background already, and React then keeps the Suspense fallback
// on screen for at least 300 ms. So every page's first visit flashed "Loading…".
// A preloadable lazy component renders the loaded module straight away once its
// code is in (preload() fetches it ahead), and only falls back to React.lazy before.
// Each mount keeps the component it started with, so a page is never remounted
// (and never loses its unsaved edits) when the code arrives.
// ──────────────────────────────────────────────
import { lazy, useState, type ComponentProps, type ComponentType } from "react";

type AnyComponent = ComponentType<any>;

export type PreloadableLazy<T extends AnyComponent> = ComponentType<ComponentProps<T>> & {
  preload: () => Promise<void>;
};

export function preloadableLazy<T extends AnyComponent>(load: () => Promise<{ default: T }>): PreloadableLazy<T> {
  let loaded: T | null = null;
  let pending: Promise<{ default: T }> | null = null;
  const fetchModule = () => {
    pending ??= load().then(
      (module) => {
        loaded = module.default;
        return module;
      },
      (error: unknown) => {
        // A failed download can be tried again on the next visit.
        pending = null;
        throw error;
      },
    );
    return pending;
  };
  const Lazy = lazy(fetchModule) as unknown as AnyComponent;
  function Preloadable(props: ComponentProps<T>) {
    const [Component] = useState<AnyComponent>(() => loaded ?? Lazy);
    return <Component {...props} />;
  }
  return Object.assign(Preloadable, {
    preload: () =>
      fetchModule().then(
        () => undefined,
        () => undefined,
      ),
  });
}
