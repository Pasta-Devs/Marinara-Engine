/** True on phones and tablets, iPads with a keyboard too (set once in main.tsx, before the first render). */
export function isTouchDevice(): boolean {
  return typeof document !== "undefined" && document.documentElement.dataset.marinaraTouchDevice === "true";
}
