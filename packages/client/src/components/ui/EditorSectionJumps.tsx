import type { ReactNode } from "react";

import { cn } from "../../lib/utils";

export type EditorSectionJump = {
  id: string;
  label: string;
};

export function EditorSectionJumps({
  items,
  className,
}: {
  items: readonly EditorSectionJump[];
  className?: string;
}) {
  const scrollToSection = (id: string) => {
    const target = document.getElementById(id);
    if (!target) return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth", block: "start" });
  };

  return (
    <nav aria-label="Card sections" className={cn("mari-editor-section-jumps", className)}>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => scrollToSection(item.id)}
          className="mari-editor-section-jump"
        >
          {item.label}
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
