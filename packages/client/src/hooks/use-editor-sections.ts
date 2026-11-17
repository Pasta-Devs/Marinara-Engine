import { useCallback, useEffect, useRef } from "react";

/** The box that actually scrolls the form: the content itself on desktop, the whole page (rail + fields) on phones,
 *  where the rail stacks above the fields and the content grows to its full height. */
function scrollerFor(root: HTMLElement): HTMLElement {
  for (let el: HTMLElement | null = root; el; el = el.parentElement) {
    if (/(auto|scroll|overlay)/.test(getComputedStyle(el).overflowY)) return el;
  }
  return root;
}

function topWithin(scroller: HTMLElement, target: HTMLElement) {
  return scroller.scrollTop + target.getBoundingClientRect().top - scroller.getBoundingClientRect().top - 16;
}

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
    const scroller = scrollerFor(root);
    scroller.scrollTo({
      top: topWithin(scroller, target),
      behavior: smooth && !reducedMotion ? "smooth" : "auto",
    });
  }, []);

  /** Accepts a tab id, a sub-section id (`data-editor-subsection`) or a field's element id (the rail's
   *  Description / Scenario links): a sub-section or field lights up the tab that holds it, so old tab ids that
   *  became sub-sections (Sprites, Gallery → Images) still land in the right place. Every jump goes through
   *  scrollToElement so the anchor moves to the new target; a jump that skipped it stayed pinned to the
   *  previous section and got pulled back there as soon as pictures or sprites further down finished loading. */
  const scrollToSection = useCallback(
    (section: string, smooth = true) => {
      const root = contentRef.current;
      // Ids can come from packages (Capability API `openCharacter(id, { tab })`), so escape them.
      const id = CSS.escape(section);
      const target =
        root?.querySelector<HTMLElement>(`[data-editor-section="${id}"]`) ??
        root?.querySelector<HTMLElement>(`[data-editor-subsection="${id}"]`) ??
        root?.querySelector<HTMLElement>(`#${id}`);
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
    const scroller = scrollerFor(root);
    let frame = 0;
    const sync = () => {
      frame = 0;
      // Sort by where each section sits on screen, not by markup order: some editors place a section (the
      // persona's Details) earlier in the markup than where it shows, which lit the wrong rail row at the bottom.
      const sections = Array.from(root.querySelectorAll<HTMLElement>("[data-editor-section]"))
        .map((section) => ({ section, top: section.getBoundingClientRect().top }))
        .sort((a, b) => a.top - b.top);
      const threshold = scroller.getBoundingClientRect().top + Math.min(120, scroller.clientHeight / 4);
      const atBottom =
        scroller.scrollTop > 0 && scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2;
      const current = atBottom
        ? sections.at(-1)
        : (sections.filter(({ top }) => top <= threshold).at(-1) ?? sections[0]);
      if (current) onSectionChange(current.section.dataset.editorSection as T);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(sync);
    };
    // Opening on the first section stays at the top: on phones a jump there would scroll the picture and the
    // rail (which sit above the fields) out of view.
    const firstSection = Array.from(root.querySelectorAll<HTMLElement>("[data-editor-section]")).sort(
      (a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top,
    )[0]?.dataset.editorSection;
    if (initialSection !== firstSection) scrollToSection(initialSection, false);
    sync();
    scroller.addEventListener("scroll", onScroll, { passive: true });
    // Deferred media sections can grow during a topbar jump. Keep its destination
    // anchored until the user resumes scrolling or editing the form directly.
    const releaseNavigation = () => {
      navigationTargetRef.current = null;
    };
    const gestures = ["wheel", "touchstart", "pointerdown", "keydown"] as const;
    // On the scroller, not just the form: on phones the rail scrolls with the page, so a swipe that starts on it
    // must let go of the anchor too. A tap on a rail link lets go here first and sets the new target on click.
    for (const gesture of gestures) scroller.addEventListener(gesture, releaseNavigation, { passive: true });
    const observer = new ResizeObserver(() => {
      const target = navigationTargetRef.current;
      if (target && root.contains(target)) {
        scroller.scrollTo({ top: topWithin(scroller, target), behavior: "instant" });
      }
      onScroll();
    });
    observer.observe(root);
    if (root.firstElementChild) observer.observe(root.firstElementChild);
    return () => {
      scroller.removeEventListener("scroll", onScroll);
      for (const gesture of gestures) scroller.removeEventListener(gesture, releaseNavigation);
      releaseNavigation();
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [editorKey, ready, initialSection, onSectionChange, scrollToSection]);

  return { contentRef, scrollToSection, scrollToElement };
}
