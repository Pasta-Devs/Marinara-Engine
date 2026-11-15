import { useCallback, useEffect, useRef } from "react";

/** The editor's existing topbar is a table of contents for one scrollable form. */
export function useEditorSections<T extends string>(
  editorKey: string | null,
  ready: boolean,
  initialSection: T,
  onSectionChange: (section: T) => void,
) {
  const contentRef = useRef<HTMLDivElement>(null);
  const navigationTargetRef = useRef<HTMLElement | null>(null);

  /** Scroll to an element and keep it anchored while content around it grows, until the user scrolls. */
  const scrollToElement = useCallback((target: HTMLElement, smooth = true) => {
    const root = contentRef.current;
    if (!root?.contains(target)) return;
    navigationTargetRef.current = target;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    root.scrollTo({
      top: root.scrollTop + target.getBoundingClientRect().top - root.getBoundingClientRect().top - 16,
      behavior: smooth && !reducedMotion ? "smooth" : "auto",
    });
  }, []);

  /** Accepts a tab id or a sub-section id (`data-editor-subsection`): a sub-section lights up the tab that holds
   *  it, so old tab ids that became sub-sections (Sprites, Gallery → Images) still land in the right place. */
  const scrollToSection = useCallback(
    (section: string, smooth = true) => {
      const root = contentRef.current;
      // Ids can come from packages (Capability API `openCharacter(id, { tab })`), so escape them.
      const id = CSS.escape(section);
      const target =
        root?.querySelector<HTMLElement>(`[data-editor-section="${id}"]`) ??
        root?.querySelector<HTMLElement>(`[data-editor-subsection="${id}"]`);
      if (!target) return;
      const tab = target.closest<HTMLElement>("[data-editor-section]")?.dataset.editorSection;
      if (tab) onSectionChange(tab as T);
      scrollToElement(target, smooth);
    },
    [onSectionChange, scrollToElement],
  );

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
    // Deferred media sections can grow during a topbar jump. Keep its destination
    // anchored until the user resumes scrolling or editing the form directly.
    const releaseNavigation = () => {
      navigationTargetRef.current = null;
    };
    const gestures = ["wheel", "touchstart", "pointerdown", "keydown"] as const;
    for (const gesture of gestures) root.addEventListener(gesture, releaseNavigation, { passive: true });
    const observer = new ResizeObserver(() => {
      const target = navigationTargetRef.current;
      if (target && root.contains(target)) {
        root.scrollTo({
          top: root.scrollTop + target.getBoundingClientRect().top - root.getBoundingClientRect().top - 16,
          behavior: "instant",
        });
      }
      onScroll();
    });
    observer.observe(root);
    if (root.firstElementChild) observer.observe(root.firstElementChild);
    return () => {
      root.removeEventListener("scroll", onScroll);
      for (const gesture of gestures) root.removeEventListener(gesture, releaseNavigation);
      releaseNavigation();
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [editorKey, ready, initialSection, onSectionChange, scrollToSection]);

  return { contentRef, scrollToSection, scrollToElement };
}
