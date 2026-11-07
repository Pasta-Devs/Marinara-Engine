// ──────────────────────────────────────────────
// New layout stylesheets, loaded on demand
//
// overhaul.css (the new layout's look, desktop and phones) and overhaul-mobile.css
// (phones and tablets only) are not part of the main stylesheet, so startup with the
// classic layout, and the desktop shell, do not parse rules they never use. Each one
// loads once, as a <style> placed right before the main stylesheet: that keeps the
// cascade order they had when globals.css imported them (after the vendor CSS, before
// the app's own rules and any custom theme), so nothing looks different.
// ──────────────────────────────────────────────

export type OverhaulShell = "desktop" | "mobile";

type Sheet = "base" | "mobile";

const pending: Partial<Record<Sheet, Promise<void>>> = {};
const inserted = new Set<Sheet>();

const importers: Record<Sheet, () => Promise<{ default: string }>> = {
  base: () => import("../styles/overhaul.css?inline"),
  mobile: () => import("../styles/overhaul-mobile.css?inline"),
};

function sheetsFor(shell: OverhaulShell): Sheet[] {
  return shell === "mobile" ? ["base", "mobile"] : ["base"];
}

/** The main stylesheet: the built client CSS, or globals.css under the dev server. */
function mainStylesheet(): Element | null {
  return document.querySelector(
    'link[rel="stylesheet"][href*="/client-"], style[data-vite-dev-id$="/styles/globals.css"]',
  );
}

function insert(sheet: Sheet, css: string) {
  if (inserted.has(sheet)) return;
  const style = document.createElement("style");
  style.dataset.overhaulStyles = sheet;
  style.textContent = css;
  // overhaul-mobile.css must follow overhaul.css; both sit right before the main stylesheet.
  const anchor = mainStylesheet();
  if (anchor?.parentNode) anchor.parentNode.insertBefore(style, anchor);
  else document.head.appendChild(style);
  inserted.add(sheet);
}

function loadSheet(sheet: Sheet, after?: Promise<void>): Promise<void> {
  // A failed download resolves anyway: the shell then draws unstyled instead of not at all.
  pending[sheet] ??= Promise.all([importers[sheet](), after])
    .then(([module]) => {
      insert(sheet, module.default);
    })
    .catch((error: unknown) => {
      console.error(`[overhaul-styles] Could not load the ${sheet} stylesheet`, error);
    });
  return pending[sheet]!;
}

/** True once every stylesheet the shell needs is in the page. */
export function overhaulStylesReady(shell: OverhaulShell): boolean {
  return sheetsFor(shell).every((sheet) => inserted.has(sheet));
}

/** Loads the stylesheets a shell needs (in order). Safe to call repeatedly. */
export function loadOverhaulStyles(shell: OverhaulShell): Promise<void> {
  const base = loadSheet("base");
  return shell === "mobile" ? loadSheet("mobile", base) : base;
}
