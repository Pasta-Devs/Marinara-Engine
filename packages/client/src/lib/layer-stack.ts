// ──────────────────────────────────────────────
// The open layers, in opening order, one order per window
//
// A layer is anything that closes on its own: a `Modal`, or a menu or popover
// that uses `useDismiss`. Each registers here while open, so at event time any
// of them can ask "am I the topmost layer in my window?" and only that one acts
// on an Escape press. Without a shared record, two stacked `Modal`s would both
// close on one press (each has its own `document` listener), and a menu opened
// inside a dialog would take the dialog down with it.
//
// Screens that draw their own full-page shell instead of a `Modal`, such as the
// legacy Experience setup dialog `GameSurface` mounts the malformed-JSON repair
// dialog beside, read `isModalOverlayOpen()` to let a dialog above them take
// Escape.
//
// Layers are kept per document, so a menu inside a window popped out with
// `DetachedWindow` is topmost in its own window and an Escape there never
// reaches the app's main window. The stack is read at event time rather than
// rendered, so nothing re-renders when a layer opens. Hardware back has its own
// LIFO stack in `back-navigation.ts`; `useDismiss` registers in both.
// ──────────────────────────────────────────────

/** `modal`: a dialog (`Modal`). `popover`: a menu, popover or other layer that uses `useDismiss`. */
export type LayerKind = "modal" | "popover";

export interface LayerRegistration {
  /** Drops the registration. Idempotent, so an effect cleanup may run twice. */
  release: () => void;
  /** True while this layer is the most recently opened one still open in its window. */
  isTopmost: () => boolean;
  /** True when `target` is inside a layer opened after this one in the same window, such as a submenu or a confirm. */
  isInsideLayerAbove: (target: Node) => boolean;
}

/** Kept for `Modal`'s call sites, which predate the other layer kinds. */
export type ModalOverlayRegistration = LayerRegistration;

interface LayerEntry {
  token: symbol;
  kind: LayerKind;
  doc: Document | null;
  getElement: () => Element | null;
}

let openLayers: LayerEntry[] = [];

/**
 * Registers one open layer. Call it from an effect while the layer is open and release it from the cleanup; the
 * registration is consulted at event time. `doc` is the document the layer renders in (its element's
 * `ownerDocument`); `null` means the app's main document.
 */
export function registerLayer(options: {
  kind: LayerKind;
  doc?: Document | null;
  getElement?: () => Element | null;
}): LayerRegistration {
  const entry: LayerEntry = {
    token: Symbol(options.kind),
    kind: options.kind,
    doc: options.doc ?? null,
    getElement: options.getElement ?? (() => null),
  };
  openLayers = [...openLayers, entry];
  let released = false;
  const sameWindow = () => openLayers.filter((other) => sameDoc(other.doc, entry.doc));
  return {
    release: () => {
      if (released) return;
      released = true;
      openLayers = openLayers.filter((other) => other !== entry);
    },
    isTopmost: () => !released && sameWindow().at(-1) === entry,
    isInsideLayerAbove: (target) => {
      const layers = sameWindow();
      const index = layers.indexOf(entry);
      if (index < 0) return false;
      return layers.slice(index + 1).some((above) => above.getElement()?.contains(target) ?? false);
    },
  };
}

function sameDoc(a: Document | null, b: Document | null) {
  const main = typeof document === "undefined" ? null : document;
  return (a ?? main) === (b ?? main);
}

/**
 * Registers one open `Modal`. Called by `Modal` while `open` is true; the returned registration is released from
 * effect cleanup and consulted at Escape time so only the topmost dialog acts on a press.
 */
export function registerModalOverlay(): ModalOverlayRegistration {
  return registerLayer({ kind: "modal" });
}

/**
 * True while any `Modal` is open, i.e. a dialog is stacked above a screen that owns its own shell. Such a screen
 * must let the topmost dialog take Escape. Menus and popovers don't count: they stop the Escape press they take.
 */
export function isModalOverlayOpen(): boolean {
  return openLayers.some((entry) => entry.kind === "modal");
}

/** Test seam: drop all state so a regression can drive the module repeatedly. */
export function __resetModalOverlayRegistryForTests() {
  openLayers = [];
}
