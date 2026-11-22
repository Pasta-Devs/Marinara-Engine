/**
 * True on phones and tablets (iPads with a keyboard or trackpad included): `main.tsx` sets the flag once before the
 * first render. Windows touch laptops report hover and a fine pointer, so they are not flagged.
 */
export function isTouchDevice(): boolean {
  return typeof document !== "undefined" && document.documentElement.dataset.marinaraTouchDevice === "true";
}
