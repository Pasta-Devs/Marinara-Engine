import { useCallback, useEffect, useRef } from "react";

/** The editor's existing topbar is a table of contents for one scrollable form. */
export function useEditorSections<T extends string>(
  editorKey: string | null,
  ready: boolean,
  initialSection: T,
  onSectionChange: (section: T) => void,
) {
  const contentRef = useRef<HTMLDivElement>(null);

  const scrollToSection = useCallback((section: T, smooth = true) => {
    const root = contentRef.current;
    const target = root?.querySelector<HTMLElement>(`[data-editor-section="${section}"]`);
    if (!root || !target) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    root.scrollTo({
      top: root.scrollTop + target.getBoundingClientRect().top - root.getBoundingClientRect().top - 16,
      behavior: smooth && !reducedMotion ? "smooth" : "auto",
    });
  }, []);

  useEffect(() => {
    const root = contentRef.current;
    if (!root || !ready) return;
    let frame = 0;
    const sync = () => {
      frame = 0;
      const sections = Array.from(root.querySelectorAll<HTMLElement>("[data-editor-section]"));
      const threshold = root.getBoundingClientRect().top + Math.min(120, root.clientHeight / 4);
      const atBottom = root.scrollTop > 0 && root.scrollTop + root.clientHeight >= root.scrollHeight - 2;
      const current = atBottom
        ? sections.at(-1)
        : (sections.filter((section) => section.getBoundingClientRect().top <= threshold).at(-1) ?? sections[0]);
      if (current) onSectionChange(current.dataset.editorSection as T);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(sync);
    };
    scrollToSection(initialSection, false);
    sync();
    root.addEventListener("scroll", onScroll, { passive: true });
    const observer = new ResizeObserver(onScroll);
    observer.observe(root);
    return () => {
      root.removeEventListener("scroll", onScroll);
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [editorKey, ready, initialSection, onSectionChange, scrollToSection]);

  return { contentRef, scrollToSection };
}
