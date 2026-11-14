import type { ReactNode } from "react";

import { cn } from "../../lib/utils";
import { useLocalizedUiText } from "../../localization/use-localized-ui-text";

export type EditorSectionJump = {
  id: string;
  label: string;
};

export function EditorSectionJumps({
  items,
  className,
  onJump,
}: {
  items: readonly EditorSectionJump[];
  className?: string;
  /** Replaces the plain `scrollIntoView`, e.g. with the editor's anchored scroll when lazy sections sit between. */
  onJump?: (id: string) => void;
}) {
  const localize = useLocalizedUiText();

  const scrollToSection = (id: string) => {
    if (onJump) {
      onJump(id);
      return;
    }
    const target = document.getElementById(id);
    if (!target) return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth", block: "start" });
  };

  return (
    <nav aria-label={localize("Card sections")} className={cn("mari-editor-section-jumps", className)}>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => scrollToSection(item.id)}
          className="mari-editor-section-jump"
        >
          {localize(item.label)}
        </button>
      ))}
    </nav>
  );
}

export function EditorSectionAnchor({
  id,
  children,
  className,
}: {
  id: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={cn("scroll-mt-6", className)}>
      {children}
    </section>
  );
}
