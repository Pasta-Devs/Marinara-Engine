import { useEffect, useRef, useState, type ReactNode } from "react";

/** Load media/library sections near the viewport once; keep their drafts mounted afterward. */
export function LazyEditorSection({ id, children }: { id: string; children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const [reached, setReached] = useState(false);
  useEffect(() => {
    const section = ref.current;
    if (reached || !section) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setReached(true);
      },
      { root: section.closest(".mari-editor-content"), rootMargin: "200px" },
    );
    observer.observe(section);
    return () => observer.disconnect();
  }, [reached]);
  return (
    <section ref={ref} data-editor-section={id} aria-busy={!reached} className={reached ? undefined : "min-h-64"}>
      {/* A still bar, not .shimmer: these sit off screen until scrolled to, and an endless shimmer there repainted
          the whole editor every frame (phone heat/battery). */}
      {reached ? (
        children
      ) : (
        <div
          className="h-5 w-24 rounded-md bg-[color-mix(in_srgb,var(--foreground)_8%,transparent)]"
          aria-hidden="true"
        />
      )}
    </section>
  );
}
