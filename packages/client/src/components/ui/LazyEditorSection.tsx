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
      {reached ? children : <div className="shimmer h-5 w-24 rounded-md" aria-hidden="true" />}
    </section>
  );
}
