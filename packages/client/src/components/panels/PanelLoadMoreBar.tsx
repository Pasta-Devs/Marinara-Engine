import { useEffect, useRef, type ReactNode } from "react";

interface PanelLoadMoreBarProps {
  children: ReactNode;
  disabled?: boolean;
  /** Off after a failed page, so the button retries instead of an endless loop. */
  autoLoad?: boolean;
  onLoadMore: () => void;
}

/** Calls onLoadMore when the returned sentinel nears the end of its scroll container. */
export function useLoadMoreWhenNear(onLoadMore: () => void, disabled: boolean) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const onLoadMoreRef = useRef(onLoadMore);
  useEffect(() => {
    onLoadMoreRef.current = onLoadMore;
  });
  // A new observer per `disabled` change reports the current state, so a short list keeps
  // loading after each page instead of waiting for another scroll.
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || disabled) return;
    let root = node.parentElement;
    while (root && !/(auto|scroll)/.test(getComputedStyle(root).overflowY)) root = root.parentElement;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) onLoadMoreRef.current();
      },
      { root, rootMargin: "600px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [disabled]);
  return sentinelRef;
}

export function PanelLoadMoreBar({ children, disabled = false, autoLoad = true, onLoadMore }: PanelLoadMoreBarProps) {
  const sentinelRef = useLoadMoreWhenNear(onLoadMore, disabled || !autoLoad);
  return (
    <>
      <div ref={sentinelRef} aria-hidden className="h-px" />
      <div className="sticky bottom-0 z-20 -mx-3 mt-2 border-t border-[var(--marinara-chat-chrome-panel-divider)] bg-[var(--sidebar)]/95 px-3 pb-3 pt-2 backdrop-blur-md">
        <button
          type="button"
          onClick={onLoadMore}
          disabled={disabled}
          className="mari-chrome-control mari-chrome-control--primary w-full justify-center text-xs"
        >
          {children}
        </button>
      </div>
    </>
  );
}
