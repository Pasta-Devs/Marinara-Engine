import type { ReactNode } from "react";

/** The access and device setup screen. */
export function AccessStep({ children }: { children: ReactNode }) {
  return (
    <section className="h-full min-h-0 overflow-y-auto overscroll-contain">
      <div className="mx-auto max-w-xl">{children}</div>
    </section>
  );
}
