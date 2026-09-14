// ──────────────────────────────────────────────
// Which `Modal` overlays are open right now
//
// `Modal` closes on Escape through a `document` keydown listener that does not
// stop propagation, so the same press keeps bubbling to `window`. A screen that
// draws its own full-page shell instead of a `Modal` — the game setup wizard,
// an Experience's own setup dialog — listens for Escape on `window`, which
// means one press would close the dialog AND tear down the screen underneath
// it. The malformed-JSON repair dialog is the common case: it is mounted over
// setup precisely so a failed opening stays repairable, and dismissing it must
// not also dismiss the setup the player is recovering.
//
// Those screens are not `Modal`s, so there is no shared dialog stack to consult.
// This registry is that stack, deliberately tiny: a count, not a component tree.
// It is read at event time rather than rendered, so no screen re-renders when a
// dialog opens; `Modal` registers from its own open effect, which always runs in
// the commit that mounts it and therefore before any keypress it should absorb.
// ──────────────────────────────────────────────

let openOverlayCount = 0;

/**
 * Registers one open overlay. Called by `Modal` while `open` is true; returns
 * the release function so effect cleanup drops the registration.
 */
export function registerModalOverlay(): () => void {
  openOverlayCount += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    openOverlayCount = Math.max(0, openOverlayCount - 1);
  };
}

/**
 * True while any `Modal` is open, i.e. something is stacked above a screen that
 * owns its own shell. Such a screen must let the topmost dialog take Escape.
 */
export function isModalOverlayOpen(): boolean {
  return openOverlayCount > 0;
}

/** Test seam: drop all state so a regression can drive the module repeatedly. */
export function __resetModalOverlayRegistryForTests() {
  openOverlayCount = 0;
}
