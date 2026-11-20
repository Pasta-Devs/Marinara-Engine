// One layer stack for dialogs and menus, kept per window (soup step 7, #9623).
//
// `useDismiss` and `Modal` both register here, and each asks at event time whether it is the topmost layer in its
// own window. Three things must hold, or Escape and outside presses close the wrong layer:
//   - a menu opened inside a dialog is above it, so Escape closes the menu and the dialog stays;
//   - a menu inside a popped-out window is topmost in that window, without hiding the main window's dialog;
//   - a press inside a layer opened later (a submenu) is not "outside" the layer below it.
// Plus the `isModalOverlayOpen()` contract the full-page screens rely on: only dialogs count.
import assert from "node:assert/strict";
import {
  isModalOverlayOpen,
  registerLayer,
  registerModalOverlay,
  __resetModalOverlayRegistryForTests,
} from "../../../packages/client/src/lib/layer-stack.js";

const fakeElement = (...children: object[]) =>
  ({ isConnected: true, contains: (node: object) => children.includes(node) }) as unknown as Element;

__resetModalOverlayRegistryForTests();

// ── 1. A menu inside a dialog is above it ──
const dialog = registerModalOverlay();
const menu = registerLayer({ kind: "popover" });
assert.equal(menu.isTopmost(), true, "The menu opened inside the dialog takes Escape");
assert.equal(dialog.isTopmost(), false, "The dialog under the menu must not close on the same press");
menu.release();
assert.equal(dialog.isTopmost(), true, "Once the menu closes, Escape is the dialog's again");

// ── 2. Menus don't count as dialogs for full-page screens ──
dialog.release();
const loneMenu = registerLayer({ kind: "popover" });
assert.equal(isModalOverlayOpen(), false, "A menu stops the Escape it takes; screens must not stand down for it");
loneMenu.release();

// ── 3. One order per window ──
const popOutDoc = {} as Document;
const mainDialog = registerModalOverlay();
const popOutMenu = registerLayer({ kind: "popover", doc: popOutDoc });
assert.equal(popOutMenu.isTopmost(), true, "The pop-out's menu is topmost in the pop-out");
assert.equal(mainDialog.isTopmost(), true, "A menu in another window must not take the main window's Escape");
popOutMenu.release();
mainDialog.release();

// ── 4. Inside a layer opened later is not outside ──
const insideSubmenu = {};
const parent = registerLayer({ kind: "popover", getElement: () => fakeElement() });
const submenu = registerLayer({ kind: "popover", getElement: () => fakeElement(insideSubmenu) });
assert.equal(parent.isInsideLayerAbove(insideSubmenu as Node), true, "A press in the submenu keeps the parent open");
assert.equal(parent.isInsideLayerAbove({} as Node), false, "A press elsewhere is outside the parent");
assert.equal(submenu.isInsideLayerAbove(insideSubmenu as Node), false, "Nothing is above the submenu");
const otherWindowLayer = registerLayer({
  kind: "popover",
  doc: popOutDoc,
  getElement: () => fakeElement(insideSubmenu),
});
submenu.release();
assert.equal(
  parent.isInsideLayerAbove(insideSubmenu as Node),
  false,
  "A layer in another window is never above this one",
);
otherWindowLayer.release();

// ── 5. Release is idempotent ──
parent.release();
parent.release();
assert.equal(parent.isTopmost(), false, "A released layer is never topmost");
const next = registerLayer({ kind: "popover" });
assert.equal(next.isTopmost(), true, "A double release must not disturb the next layer");
next.release();

// ── 6. A layer whose element left the page doesn't count ──
// (A menu can unmount while its owner's open state stays true; it must not swallow the next Escape.)
let menuElement: Element | null = fakeElement();
const underDialog = registerModalOverlay(() => fakeElement());
const ghost = registerLayer({ kind: "popover", getElement: () => menuElement });
assert.equal(ghost.isTopmost(), true, "A mounted menu is topmost");
menuElement = null;
assert.equal(underDialog.isTopmost(), true, "The dialog under an unmounted menu takes Escape again");
// The layer itself still counts: an unmounting dialog asks this from its cleanups, after React cleared its ref, to
// decide whether to hand focus back. (useDismiss checks its own element before taking Escape.)
assert.equal(ghost.isTopmost(), true, "A layer whose element is gone is still topmost to itself");
ghost.release();
underDialog.release();

// ── 7. A dialog opened above a menu is a layer above it ──
const insideConfirm = {};
const menuUnderConfirm = registerLayer({ kind: "popover", getElement: () => fakeElement() });
const confirm = registerModalOverlay(() => fakeElement(insideConfirm));
assert.equal(
  menuUnderConfirm.isInsideLayerAbove(insideConfirm as Node),
  true,
  "A press in a confirm opened above a menu must not close the menu",
);
confirm.release();
menuUnderConfirm.release();

__resetModalOverlayRegistryForTests();
console.log("layer-stack: ok");
