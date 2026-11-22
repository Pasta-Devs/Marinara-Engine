// ──────────────────────────────────────────────
// One polite live region for short confirmations a screen reader would otherwise miss
// ("Copied", "Saved"). Visually hidden; nothing changes on screen (QC Nov 22 K14).
// ──────────────────────────────────────────────

let region: HTMLElement | null = null;
let pending = 0;

function liveRegion(): HTMLElement | null {
  if (typeof document === "undefined" || !document.body) return null;
  if (region && region.isConnected) return region;
  region = document.createElement("div");
  region.setAttribute("role", "status");
  region.setAttribute("aria-live", "polite");
  region.setAttribute("aria-atomic", "true");
  region.setAttribute("data-mari-live-announcer", "");
  region.style.cssText =
    "position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0";
  document.body.appendChild(region);
  return region;
}

/** Says `text` once. The same text twice in a row is said twice: the node is cleared first. */
export function announce(text: string) {
  const node = liveRegion();
  if (!node || !text) return;
  node.textContent = "";
  const run = ++pending;
  requestAnimationFrame(() => {
    if (run === pending) node.textContent = text;
  });
}
