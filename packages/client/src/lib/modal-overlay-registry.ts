// ──────────────────────────────────────────────
// Which `Modal` overlays are open right now, in opening order
//
// `Modal` closes on Escape through a `document` keydown listener that does not
// stop propagation, so one press reaches every open `Modal` and keeps bubbling
// to `window`. Two things go wrong without a shared record of what is open:
//
//   - A screen that draws its own full-page shell instead of a `Modal`, such as
//     the legacy Experience setup dialog `GameSurface` mounts the malformed-JSON
//     repair dialog beside, listens on `window` and would tear itself down on
//     the same press that closed the dialog above it.
//   - Two stacked `Modal`s (a confirm opened from a settings dialog, say) would
//     both close on one press, because each has its own listener and neither
//     knows about the other.
//
// This registry is the missing record: a stack of open overlays in opening
// order, so the topmost one can be told apart from the rest. It is read at
// event time rather than rendered, so no screen re-renders when a dialog opens;
// `Modal` registers from its own open effect, which always runs in the commit
// that mounts it and therefore before any keypress it should absorb. Hardware
// back already has its own LIFO stack in `useBackDismiss`; this one exists for
// Escape and for screens that are not `Modal`s at all.
// ──────────────────────────────────────────────

export interface ModalOverlayRegistration {
  /** Drops the registration. Idempotent, so an effect cleanup may run twice. */
  release: () => void;
  /** True while this overlay is the most recently opened one still open. */
  isTopmost: () => boolean;
}

let openOverlays: symbol[] = [];

/**
 * Registers one open overlay. Called by `Modal` while `open` is true; the
 * returned registration is released from effect cleanup and consulted at
 * Escape time so only the topmost dialog acts on a press.
 */
export function registerModalOverlay(): ModalOverlayRegistration {
  const token = Symbol("modal-overlay");
  openOverlays = [...openOverlays, token];
  let released = false;
  return {
    release: () => {
      if (released) return;
      released = true;
      openOverlays = openOverlays.filter((entry) => entry !== token);
    },
    isTopmost: () => !released && openOverlays[openOverlays.length - 1] === token,
  };
}

/**
 * True while any `Modal` is open, i.e. something is stacked above a screen that
 * owns its own shell. Such a screen must let the topmost dialog take Escape.
 */
export function isModalOverlayOpen(): boolean {
  return openOverlays.length > 0;
}

/** Test seam: drop all state so a regression can drive the module repeatedly. */
export function __resetModalOverlayRegistryForTests() {
  openOverlays = [];
}
