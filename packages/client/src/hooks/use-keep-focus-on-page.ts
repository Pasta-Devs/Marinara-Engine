// ──────────────────────────────────────────────
// Focus never falls to <body> when a page changes
// ──────────────────────────────────────────────
// QC Nov 21 A11Y19: a button that opens another page ("Browse the theme gallery", a Library row, a tab)
// goes away with the page it was on, and keyboard focus fell to <body>: the next Tab started over at the
// top bar. When the focused element is removed and nothing else took focus, focus moves to the new page's
// heading (or the main area), so Tab carries on from the page that just opened.
import { useEffect } from "react";

function landingSpot(): HTMLElement | null {
  const main = document.getElementById("mari-main");
  if (!main) return null;
  const heading = Array.from(main.querySelectorAll<HTMLElement>("h1, h2, [role='heading']")).find(
    (element) => element.getClientRects().length > 0 && !element.closest("[inert], [aria-hidden='true']"),
  );
  return heading ?? main;
}

export function useKeepFocusOnPage() {
  useEffect(() => {
    let frame = 0;
    const onFocusOut = (event: FocusEvent) => {
      if (event.relatedTarget) return;
      const lost = event.target;
      if (!(lost instanceof HTMLElement)) return;
      cancelAnimationFrame(frame);
      // Two frames: the new page renders, and a closing window gets to hand focus back first.
      frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(() => {
          if (lost.isConnected) return;
          const active = document.activeElement;
          if (active && active !== document.body) return;
          // Only inside the main area's own pages: a dialog that closed returns focus itself.
          const spot = landingSpot();
          if (!spot) return;
          if (!spot.hasAttribute("tabindex")) spot.setAttribute("tabindex", "-1");
          spot.focus({ preventScroll: true });
        });
      });
    };
    document.addEventListener("focusout", onFocusOut);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("focusout", onFocusOut);
    };
  }, []);
}
