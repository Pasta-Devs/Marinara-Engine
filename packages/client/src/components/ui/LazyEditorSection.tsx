import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Load media/library sections near the viewport once; keep their drafts mounted afterward.
 *
 * `nested` marks a sub-section inside a tab (Sprites inside Images): it carries `data-editor-subsection` instead of
 * `data-editor-section`, so the topbar's scroll-spy keeps reporting the tab that holds it.
 */
export function LazyEditorSection({
  id,
  children,
  nested = false,
}: {
  id: string;
  children: ReactNode;
  nested?: boolean;
}) {
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
  const sectionAttributes = nested ? { "data-editor-subsection": id } : { "data-editor-section": id };
  return (
    <section ref={ref} {...sectionAttributes} aria-busy={!reached} className={reached ? undefined : "min-h-64"}>
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
