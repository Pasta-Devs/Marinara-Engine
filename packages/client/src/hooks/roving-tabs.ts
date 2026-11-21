// ──────────────────────────────────────────────
// Tab rows: one Tab stop, arrows move between tabs
// ──────────────────────────────────────────────
// QC Nov 21 A11Y11: hand-made tab rows (Settings, the Chats | Library switch, Home's Things to try...) made
// every tab its own Tab stop and ignored the arrow keys, so reaching Settings' content took 18 presses.
// The WAI-ARIA tabs pattern, as ui/Tabs already does it: only the selected tab is in the Tab order
// (give tabs `tabIndex={selected ? 0 : -1}`), and on the tablist's onKeyDown arrows, Home and End move.
import type { KeyboardEvent } from "react";

/**
 * The tablist's onKeyDown. "auto" picks the tab focus lands on (cheap switches); "manual" only moves focus
 * and Enter or Space picks it (Settings: a tab switch takes a moment on a tablet, so arrowing past three
 * tabs must not build three of them).
 */
export function onRovingTabsKeyDown(event: KeyboardEvent<HTMLElement>, activation: "auto" | "manual" = "auto") {
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  const vertical = event.currentTarget.getAttribute("aria-orientation") === "vertical";
  const step = (vertical ? { ArrowDown: 1, ArrowUp: -1 } : { ArrowRight: 1, ArrowLeft: -1 }) as Partial<
    Record<string, number>
  >;
  const rtl = getComputedStyle(event.currentTarget).direction === "rtl";
  const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]')).filter(
    (tab) =>
      !tab.matches(":disabled, [aria-disabled='true']") && tab.closest('[role="tablist"]') === event.currentTarget,
  );
  if (tabs.length === 0) return;
  const at = tabs.findIndex((tab) => tab === document.activeElement);
  const current = at >= 0 ? at : tabs.findIndex((tab) => tab.getAttribute("aria-selected") === "true");
  let next: number | null = null;
  const move = step[event.key];
  if (move !== undefined) next = (current + (rtl && !vertical ? -move : move) + tabs.length) % tabs.length;
  else if (event.key === "Home") next = 0;
  else if (event.key === "End") next = tabs.length - 1;
  if (next === null) return;
  event.preventDefault();
  const tab = tabs[next]!;
  tab.focus();
  if (activation === "auto" && tab.getAttribute("aria-selected") !== "true") tab.click();
}
